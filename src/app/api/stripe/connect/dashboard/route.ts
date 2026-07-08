import { NextResponse } from "next/server";
import { getStripe, stripeConfigured } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/**
 * Seller payouts: return a one-time login link to the seller's Stripe Express
 * dashboard, where they see their real balance, payout schedule, bank details,
 * and can trigger an instant payout if eligible. With Express, Stripe owns the
 * payout-to-bank step — the platform only transfers into the connected account
 * (see releaseOrder); this is the compliant "cash out" surface.
 */
export async function POST() {
  if (!stripeConfigured()) {
    return NextResponse.json(
      { error: "Stripe isn't configured yet." },
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

  const admin = createAdminClient();
  const { data: pay } = await admin
    .from("payment_profiles")
    .select("stripe_account_id, payouts_enabled")
    .eq("id", user.id)
    .maybeSingle();

  if (!pay?.stripe_account_id) {
    return NextResponse.json(
      { error: "Finish seller onboarding first." },
      { status: 400 }
    );
  }

  try {
    const link = await getStripe().accounts.createLoginLink(
      pay.stripe_account_id
    );
    return NextResponse.json({ url: link.url });
  } catch {
    // login links need onboarding to be complete
    return NextResponse.json(
      { error: "Finish seller onboarding to open your payouts dashboard." },
      { status: 400 }
    );
  }
}
