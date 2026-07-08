"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { closeListingNow } from "@/app/dashboard/actions";
import { Button } from "@/components/ui/button";

export function CloseListingButton({ listingId }: { listingId: string }) {
  const router = useRouter();
  const [arming, setArming] = useState(false);
  const [pending, setPending] = useState(false);

  async function close() {
    if (!arming) {
      setArming(true);
      setTimeout(() => setArming(false), 4000);
      return;
    }
    setPending(true);
    const res = await closeListingNow(listingId);
    setPending(false);
    setArming(false);
    if ("error" in res) {
      toast.error(res.error);
      return;
    }
    toast.success("Auction closed — the highest active bid wins.");
    router.refresh();
  }

  return (
    <Button
      variant={arming ? "destructive" : "outline"}
      size="sm"
      onClick={close}
      disabled={pending}
    >
      {pending ? "Closing…" : arming ? "Confirm close" : "Close now"}
    </Button>
  );
}
