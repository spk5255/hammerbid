"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

export function UnblockButton({
  blockerId,
  blockedId,
  username,
}: {
  blockerId: string;
  blockedId: string;
  username: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function unblock() {
    setPending(true);
    const { error } = await createClient()
      .from("blocks")
      .delete()
      .eq("blocker_id", blockerId)
      .eq("blocked_id", blockedId);
    setPending(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`@${username} unblocked — messaging restored.`);
    router.refresh();
  }

  return (
    <Button variant="outline" size="sm" onClick={unblock} disabled={pending}>
      {pending ? "…" : "Unblock"}
    </Button>
  );
}
