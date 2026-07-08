"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

export function MessageSellerButton({
  listingId,
  signedIn,
  blocked,
}: {
  listingId: string;
  signedIn: boolean;
  blocked: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  if (!signedIn) {
    return (
      <Button
        variant="outline"
        className="w-full"
        nativeButton={false}
        render={<Link href={`/auth?next=/listing/${listingId}`} />}
      >
        Sign in to message the seller
      </Button>
    );
  }

  if (blocked) {
    return (
      <div title="Messaging is unavailable between these users">
        <Button variant="outline" className="w-full" disabled>
          Messaging unavailable
        </Button>
        <p className="mt-1 text-center text-xs text-muted-foreground">
          One of you has blocked the other.
        </p>
      </div>
    );
  }

  async function open() {
    setPending(true);
    const { data, error } = await createClient().rpc(
      "get_or_create_conversation",
      { p_listing_id: listingId }
    );
    setPending(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    router.push(`/messages/${data.id}`);
  }

  return (
    <Button
      variant="outline"
      className="w-full"
      onClick={open}
      disabled={pending}
    >
      {pending ? "Opening…" : "Message the seller"}
    </Button>
  );
}
