import "server-only";
import type Stripe from "stripe";
import { AUTO_RELEASE_DAYS } from "@/lib/constants";
import { toCents } from "@/lib/money";
import { getStripe, stripeConfigured } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";

export type MoneyResult = { ok: boolean; status: string; detail?: string };

/**
 * Charge the winner of a pending_payment order (§6 worker step b).
 * Overlap-safe: an atomic claim on stripe_payment_intent_id means only one
 * run owns the order, and the Stripe idempotency key makes retries safe.
 * A failed charge NEVER pays the seller — the order lands in payment_failed.
 */
export async function chargePendingOrder(orderId: string): Promise<MoneyResult> {
  const admin = createAdminClient();

  // atomic claim: no row back → another run owns it (or it's not pending)
  const { data: claimed } = await admin
    .from("orders")
    .update({ stripe_payment_intent_id: `claim:${orderId}` })
    .eq("id", orderId)
    .eq("status", "pending_payment")
    .is("stripe_payment_intent_id", null)
    .select("id,buyer_id,amount_charged")
    .maybeSingle();
  if (!claimed) {
    return { ok: false, status: "skipped", detail: "already claimed or not pending" };
  }

  const unclaim = () =>
    admin
      .from("orders")
      .update({ stripe_payment_intent_id: null })
      .eq("id", orderId);

  if (!stripeConfigured()) {
    await unclaim(); // a future configured run retries
    return { ok: false, status: "skipped", detail: "stripe not configured" };
  }

  const fail = async (detail: string): Promise<MoneyResult> => {
    await admin
      .from("orders")
      .update({ status: "payment_failed" })
      .eq("id", orderId);
    return { ok: false, status: "payment_failed", detail };
  };

  const { data: buyerPay } = await admin
    .from("payment_profiles")
    .select("stripe_customer_id")
    .eq("id", claimed.buyer_id)
    .maybeSingle();
  if (!buyerPay?.stripe_customer_id) {
    return fail("buyer has no Stripe customer (dev-flag card only)");
  }

  const stripe = getStripe();
  const methods = await stripe.paymentMethods.list({
    customer: buyerPay.stripe_customer_id,
    type: "card",
    limit: 1,
  });
  const paymentMethod = methods.data[0];
  if (!paymentMethod) return fail("no card saved on the Stripe customer");

  try {
    // separate charges & transfers: the money lands in the PLATFORM balance,
    // held under payment protection until release (§6A step 5)
    const intent = await stripe.paymentIntents.create(
      {
        amount: toCents(String(claimed.amount_charged)),
        currency: "usd",
        customer: buyerPay.stripe_customer_id,
        payment_method: paymentMethod.id,
        off_session: true,
        confirm: true,
        metadata: { order_id: orderId },
      },
      { idempotencyKey: `order-${orderId}-charge` }
    );

    if (intent.status !== "succeeded") {
      await admin
        .from("orders")
        .update({ stripe_payment_intent_id: intent.id, status: "payment_failed" })
        .eq("id", orderId);
      return { ok: false, status: "payment_failed", detail: `intent ${intent.status}` };
    }

    await admin
      .from("orders")
      .update({ stripe_payment_intent_id: intent.id, status: "paid_held" })
      .eq("id", orderId);
    return { ok: true, status: "paid_held" };
  } catch (err) {
    const stripeErr = err as Stripe.errors.StripeError;
    const intentId =
      typeof stripeErr.payment_intent?.id === "string"
        ? stripeErr.payment_intent.id
        : null;
    await admin
      .from("orders")
      .update({
        status: "payment_failed",
        ...(intentId ? { stripe_payment_intent_id: intentId } : {}),
      })
      .eq("id", orderId);
    return { ok: false, status: "payment_failed", detail: stripeErr.message };
  }
}

/**
 * Release held funds to the seller (§6A step 7): transfer seller_payout to
 * the connected account. Claimed atomically via stripe_transfer_id; never
 * releases while a dispute is open; idempotent via the Stripe key.
 */
export async function releaseOrder(orderId: string): Promise<MoneyResult> {
  const admin = createAdminClient();

  const { data: claimed } = await admin
    .from("orders")
    .update({ stripe_transfer_id: `claim:${orderId}` })
    .eq("id", orderId)
    .eq("status", "paid_held")
    .is("stripe_transfer_id", null)
    .select("id,seller_id,seller_payout,stripe_payment_intent_id")
    .maybeSingle();
  if (!claimed) {
    return { ok: false, status: "skipped", detail: "not held or already releasing" };
  }

  const unclaim = () =>
    admin
      .from("orders")
      .update({ stripe_transfer_id: null })
      .eq("id", orderId);

  if (!stripeConfigured()) {
    await unclaim();
    return { ok: false, status: "skipped", detail: "stripe not configured" };
  }

  const stripe = getStripe();

  // a disputed order never releases (§12.31)
  if (
    claimed.stripe_payment_intent_id &&
    !claimed.stripe_payment_intent_id.startsWith("claim:")
  ) {
    const disputes = await stripe.disputes.list({
      payment_intent: claimed.stripe_payment_intent_id,
      limit: 10,
    });
    const open = disputes.data.some(
      (d) => d.status !== "won" && d.status !== "lost"
    );
    if (open) {
      await unclaim();
      return { ok: false, status: "skipped", detail: "open dispute — held" };
    }
  }

  const { data: sellerPay } = await admin
    .from("payment_profiles")
    .select("stripe_account_id,payouts_enabled")
    .eq("id", claimed.seller_id)
    .maybeSingle();
  if (!sellerPay?.stripe_account_id || !sellerPay.payouts_enabled) {
    await unclaim();
    return {
      ok: false,
      status: "skipped",
      detail: "seller not onboarded — funds stay held",
    };
  }

  try {
    const transfer = await stripe.transfers.create(
      {
        amount: toCents(String(claimed.seller_payout)),
        currency: "usd",
        destination: sellerPay.stripe_account_id,
        metadata: { order_id: orderId },
      },
      { idempotencyKey: `order-${orderId}-release` }
    );
    await admin
      .from("orders")
      .update({ stripe_transfer_id: transfer.id, status: "released" })
      .eq("id", orderId);
    return { ok: true, status: "released" };
  } catch (err) {
    await unclaim();
    return { ok: false, status: "error", detail: (err as Error).message };
  }
}

/** Orders paid AUTO_RELEASE_DAYS ago with no transfer yet (§6 worker step c). */
export async function autoReleaseDueOrders(): Promise<
  { id: string; result: MoneyResult }[]
> {
  const admin = createAdminClient();
  const cutoff = new Date(
    Date.now() - AUTO_RELEASE_DAYS * 86_400_000
  ).toISOString();
  const { data: due } = await admin
    .from("orders")
    .select("id")
    .eq("status", "paid_held")
    .is("stripe_transfer_id", null)
    .lte("updated_at", cutoff)
    .limit(50);

  const results: { id: string; result: MoneyResult }[] = [];
  for (const order of due ?? []) {
    results.push({ id: order.id, result: await releaseOrder(order.id) });
  }
  return results;
}
