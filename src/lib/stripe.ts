import "server-only";
import Stripe from "stripe";

export function stripeConfigured(): boolean {
  return !!process.env.STRIPE_SECRET_KEY;
}

/** Server-side Stripe client. Never import from client components (§3.10). */
export function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error("Stripe is not configured — set STRIPE_SECRET_KEY");
  }
  return new Stripe(key);
}
