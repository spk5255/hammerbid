"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function ConfirmReceiptButton({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [arming, setArming] = useState(false);
  const [pending, setPending] = useState(false);

  async function confirm() {
    if (!arming) {
      setArming(true);
      setTimeout(() => setArming(false), 4000);
      return;
    }
    setPending(true);
    const res = await fetch(`/api/orders/${orderId}/confirm-delivery`, {
      method: "POST",
    });
    const json = await res.json().catch(() => ({}));
    setPending(false);
    setArming(false);
    if (!res.ok) {
      toast.error(json.error ?? "Could not confirm receipt");
      return;
    }
    if (json.ok) {
      toast.success("Receipt confirmed — payout released to the seller.");
    } else {
      toast.info(
        `Receipt recorded — payout still held (${json.detail ?? "pending"}).`
      );
    }
    router.refresh();
  }

  return (
    <Button size="sm" onClick={confirm} disabled={pending}>
      {pending ? "Confirming…" : arming ? "Really received?" : "Confirm receipt"}
    </Button>
  );
}
