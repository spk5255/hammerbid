"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { REBID_COOLDOWN_MINUTES } from "@/lib/constants";
import { createClient } from "@/lib/supabase/client";

export function WithdrawBidButton({ listingId }: { listingId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function withdraw() {
    setPending(true);
    const { error } = await createClient().rpc("withdraw_bid", {
      p_listing_id: listingId,
    });
    setPending(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(
      `Bid withdrawn — the price falls to the next-highest bid. You can re-enter this auction in ${REBID_COOLDOWN_MINUTES} minutes.`
    );
    router.refresh();
  }

  return (
    <Button variant="outline" size="sm" onClick={withdraw} disabled={pending}>
      {pending ? "…" : "Withdraw"}
    </Button>
  );
}
