"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * One realtime channel per listing (§10). Any bid, withdrawal, price move,
 * or status change triggers a debounced router.refresh(), so the price,
 * chart, activity feed, and bid panel all update without a manual reload.
 */
export function ListingRealtime({ listingId }: { listingId: string }) {
  const router = useRouter();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const supabase = createClient();

    // a single bid produces several events (bids + price_history + listings);
    // coalesce them into one refresh
    const refresh = () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => router.refresh(), 150);
    };

    const channel = supabase
      .channel(`listing-${listingId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "price_history",
          filter: `listing_id=eq.${listingId}`,
        },
        refresh
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "bids",
          filter: `listing_id=eq.${listingId}`,
        },
        refresh
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "listings",
          filter: `id=eq.${listingId}`,
        },
        refresh
      )
      .subscribe();

    return () => {
      if (timer.current) clearTimeout(timer.current);
      supabase.removeChannel(channel);
    };
  }, [listingId, router]);

  return null;
}
