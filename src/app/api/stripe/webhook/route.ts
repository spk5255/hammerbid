import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripe, stripeConfigured } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * Stripe webhook (§6A): signature-verified and idempotent — the stripe_events
 * primary key makes re-delivered events no-ops. This endpoint (service role)
 * is one of the only writers of payment_profiles / orders.
 */
export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripeConfigured() || !secret) {
    return NextResponse.json(
      { error: "Stripe webhook isn't configured (STRIPE_WEBHOOK_SECRET)" },
      { status: 503 }
    );
  }

  const signature = request.headers.get("stripe-signature");
  const payload = await request.text();

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(payload, signature ?? "", secret);
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const admin = createAdminClient();

  // idempotency: the PK insert fails on a replay → acknowledge and stop
  const { error: dup } = await admin
    .from("stripe_events")
    .insert({ id: event.id, type: event.type });
  if (dup) {
    return NextResponse.json({ received: true, duplicate: true });
  }

  switch (event.type) {
    case "account.updated": {
      const account = event.data.object as Stripe.Account;
      await admin
        .from("payment_profiles")
        .update({ payouts_enabled: !!account.payouts_enabled })
        .eq("stripe_account_id", account.id);
      break;
    }

    case "setup_intent.succeeded": {
      const si = event.data.object as Stripe.SetupIntent;
      if (typeof si.customer === "string") {
        await admin
          .from("payment_profiles")
          .update({ has_payment_method: true })
          .eq("stripe_customer_id", si.customer);
      }
      break;
    }

    case "payment_method.attached": {
      const pm = event.data.object as Stripe.PaymentMethod;
      if (typeof pm.customer === "string") {
        await admin
          .from("payment_profiles")
          .update({ has_payment_method: true })
          .eq("stripe_customer_id", pm.customer);
      }
      break;
    }

    // ===== order lifecycle (wired fully in milestone 15) =====
    case "payment_intent.succeeded": {
      const pi = event.data.object as Stripe.PaymentIntent;
      await admin
        .from("orders")
        .update({ status: "paid_held" })
        .eq("stripe_payment_intent_id", pi.id)
        .eq("status", "pending_payment");
      break;
    }

    case "payment_intent.payment_failed": {
      const pi = event.data.object as Stripe.PaymentIntent;
      await admin
        .from("orders")
        .update({ status: "payment_failed" })
        .eq("stripe_payment_intent_id", pi.id)
        .eq("status", "pending_payment");
      break;
    }

    case "charge.refunded": {
      const charge = event.data.object as Stripe.Charge;
      if (typeof charge.payment_intent === "string") {
        await admin
          .from("orders")
          .update({ status: "refunded" })
          .eq("stripe_payment_intent_id", charge.payment_intent)
          .in("status", ["pending_payment", "paid_held"]);
      }
      break;
    }

    case "charge.dispute.created": {
      // flagged for manual review; a disputed order must never auto-release
      const dispute = event.data.object as Stripe.Dispute;
      console.warn(`[stripe] dispute created: ${dispute.id} (pi: ${dispute.payment_intent})`);
      break;
    }
  }

  return NextResponse.json({ received: true });
}
