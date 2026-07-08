"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function EnableSellingCard({
  isSeller,
}: {
  isSeller: boolean;
  // still part of the prop contract for callers; the parent gates on it
  payoutsEnabled: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function enableSelling() {
    setPending(true);
    const { error } = await createClient().rpc("enable_selling");
    setPending(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Selling enabled!");
    router.refresh();
  }

  async function startOnboarding() {
    setPending(true);
    const res = await fetch("/api/stripe/connect/onboard", { method: "POST" });
    const json = await res.json().catch(() => ({}));
    setPending(false);
    if (!res.ok) {
      toast.error(json.error ?? "Could not start Stripe onboarding");
      return;
    }
    window.location.href = json.url;
  }

  if (!isSeller) {
    return (
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Become a seller</CardTitle>
          <CardDescription>
            Enable selling to list products and services for auction. You can
            still bid on everything either way.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={enableSelling} disabled={pending} className="w-full">
            {pending ? "Enabling…" : "Enable selling"}
          </Button>
        </CardContent>
      </Card>
    );
  }

  // isSeller but payouts not enabled yet
  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Finish payout setup</CardTitle>
        <CardDescription>
          Selling is enabled — now connect a payout account. Stripe verifies
          your identity and bank details on their hosted page, then you can
          create listings. (Test mode: any test data works.)
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button onClick={startOnboarding} disabled={pending} className="w-full">
          {pending ? "Opening Stripe…" : "Start Stripe onboarding"}
        </Button>
      </CardContent>
    </Card>
  );
}
