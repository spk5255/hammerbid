import { NextResponse } from "next/server";
import { getStripe, stripeConfigured } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/**
 * Seller onboarding (§6A step 1): create (or reuse) a Stripe Express account
 * and return a hosted onboarding link. The account.updated webhook flips
 * payouts_enabled when Stripe finishes verification.
 */
export async function POST(request: Request) {
  if (!stripeConfigured()) {
    return NextResponse.json(
      {
        error:
          "Stripe isn't configured yet — add STRIPE_SECRET_KEY to .env.local and restart the dev server.",
      },
      { status: 503 }
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_seller")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile?.is_seller) {
    return NextResponse.json(
      { error: "Enable selling first" },
      { status: 400 }
    );
  }

  const admin = createAdminClient();
  const { data: pay } = await admin
    .from("payment_profiles")
    .select("stripe_account_id")
    .eq("id", user.id)
    .maybeSingle();

  const stripe = getStripe();
  let accountId = pay?.stripe_account_id ?? null;
  if (!accountId) {
    const account = await stripe.accounts.create({
      type: "express",
      email: user.email ?? undefined,
      metadata: { user_id: user.id },
    });
    accountId = account.id;
    await admin
      .from("payment_profiles")
      .update({ stripe_account_id: accountId })
      .eq("id", user.id);
  }

  const origin = request.headers.get("origin") ?? new URL(request.url).origin;
  const link = await stripe.accountLinks.create({
    account: accountId,
    refresh_url: `${origin}/settings?onboarding=refresh`,
    return_url: `${origin}/settings?onboarding=done`,
    type: "account_onboarding",
  });

  return NextResponse.json({ url: link.url });
}
