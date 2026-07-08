import { NextResponse } from "next/server";
import { getStripe, stripeConfigured } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/**
 * Buyer card-on-file (§6A step 2): create a SetupIntent against the user's
 * Stripe customer. Refuses without the binding-bid consent, and records
 * terms_accepted_at server-side. Cards are saved, never charged, here.
 */
export async function POST(request: Request) {
  if (!stripeConfigured()) {
    return NextResponse.json(
      {
        error:
          "Stripe isn't configured yet — add STRIPE_SECRET_KEY and NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY to .env.local.",
      },
      { status: 503 }
    );
  }

  const body = await request.json().catch(() => ({}));
  if (body?.consent !== true) {
    return NextResponse.json(
      { error: "You must accept the binding-bid terms to save a card" },
      { status: 400 }
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
    .select("stripe_customer_id")
    .eq("id", user.id)
    .maybeSingle();

  const stripe = getStripe();
  let customerId = pay?.stripe_customer_id ?? null;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email ?? undefined,
      metadata: { user_id: user.id },
    });
    customerId = customer.id;
  }

  // consent recorded before the card is saved (§12.30)
  await admin
    .from("payment_profiles")
    .update({
      stripe_customer_id: customerId,
      terms_accepted_at: new Date().toISOString(),
    })
    .eq("id", user.id);

  const setupIntent = await stripe.setupIntents.create({
    customer: customerId,
    usage: "off_session",
    automatic_payment_methods: { enabled: true, allow_redirects: "never" },
  });

  return NextResponse.json({ clientSecret: setupIntent.client_secret });
}
