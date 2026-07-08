"use client";

import {
  Elements,
  PaymentElement,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
const stripePromise = publishableKey ? loadStripe(publishableKey) : null;

export function AddPaymentMethodDialog({
  triggerLabel = "Add a card to bid",
  triggerVariant = "default",
}: {
  triggerLabel?: string;
  triggerVariant?: "default" | "outline";
}) {
  const [open, setOpen] = useState(false);
  const [consent, setConsent] = useState(false);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function begin() {
    setLoading(true);
    const res = await fetch("/api/stripe/setup-intent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ consent: true }),
    });
    const json = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      toast.error(json.error ?? "Could not start card setup");
      return;
    }
    setClientSecret(json.clientSecret);
  }

  function reset(nextOpen: boolean) {
    setOpen(nextOpen);
    if (!nextOpen) {
      setClientSecret(null);
      setConsent(false);
    }
  }

  return (
    <>
      <Button
        variant={triggerVariant}
        className="w-full"
        onClick={() => setOpen(true)}
      >
        {triggerLabel}
      </Button>

      <Dialog open={open} onOpenChange={reset}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add a payment method</DialogTitle>
            <DialogDescription>
              Your card is saved now and only charged if you win an auction.
            </DialogDescription>
          </DialogHeader>

          {!publishableKey ? (
            <p className="text-sm text-muted-foreground">
              Stripe isn&apos;t configured yet — add{" "}
              <code>NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY</code> and{" "}
              <code>STRIPE_SECRET_KEY</code> to <code>.env.local</code>, then
              restart the dev server.
            </p>
          ) : !clientSecret ? (
            <div className="flex flex-col gap-4">
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                  className="mt-0.5 accent-sky-400"
                />
                <span>
                  <span className="font-medium">Bids are binding:</span> if you
                  win, this card is charged the final price plus the 5%
                  buyer&apos;s premium when the auction closes.
                </span>
              </label>
              <Button
                onClick={begin}
                disabled={!consent || loading}
                className="w-full"
              >
                {loading ? "Starting…" : "Continue"}
              </Button>
            </div>
          ) : stripePromise ? (
            <Elements
              stripe={stripePromise}
              options={{ clientSecret, appearance: { theme: "night" } }}
            >
              <SetupForm onDone={() => reset(false)} />
            </Elements>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}

function SetupForm({ onDone }: { onDone: () => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!stripe || !elements) return;
    setSaving(true);
    const { error, setupIntent } = await stripe.confirmSetup({
      elements,
      redirect: "if_required",
    });
    if (error || !setupIntent) {
      setSaving(false);
      toast.error(error?.message ?? "Card setup failed");
      return;
    }
    // server-side verification fallback (webhook does this in production)
    const res = await fetch("/api/stripe/setup-intent/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ setup_intent_id: setupIntent.id }),
    });
    setSaving(false);
    if (!res.ok) {
      toast.error("Card saved, but confirmation failed — check Settings");
      return;
    }
    toast.success("Card saved — you can bid now.");
    onDone();
    router.refresh();
  }

  return (
    <form onSubmit={save} className="flex flex-col gap-4">
      <PaymentElement />
      <Button type="submit" disabled={saving} className="w-full">
        {saving ? "Saving…" : "Save card"}
      </Button>
    </form>
  );
}
