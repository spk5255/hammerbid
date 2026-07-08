import { NextResponse } from "next/server";
import { getStripe, stripeConfigured } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/**
 * Called by the card dialog right after confirmSetup succeeds. Verifies the
 * SetupIntent with Stripe server-side and flips has_payment_method — so local
 * dev works even without `stripe listen` forwarding webhooks. The
 * setup_intent.succeeded webhook does the same thing in production.
 */
export async function POST(request: Request) {
  if (!stripeConfigured()) {
    return NextResponse.json({ error: "Stripe isn't configured" }, { status: 503 });
  }

  const body = await request.json().catch(() => ({}));
  const setupIntentId = typeof body?.setup_intent_id === "string" ? body.setup_intent_id : null;
  if (!setupIntentId) {
    return NextResponse.json({ error: "setup_intent_id required" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: pay } = await admin
    .from("payment_profiles")
    .select("stripe_customer_id")
    .eq("id", user.id)
    .maybeSingle();
  if (!pay?.stripe_customer_id) {
    return NextResponse.json({ error: "No Stripe customer on file" }, { status: 400 });
  }

  const setupIntent = await getStripe().setupIntents.retrieve(setupIntentId);
  if (
    setupIntent.status !== "succeeded" ||
    setupIntent.customer !== pay.stripe_customer_id
  ) {
    return NextResponse.json(
      { error: "Setup intent is not complete for this account" },
      { status: 400 }
    );
  }

  await admin
    .from("payment_profiles")
    .update({ has_payment_method: true })
    .eq("id", user.id);

  return NextResponse.json({ ok: true });
}
