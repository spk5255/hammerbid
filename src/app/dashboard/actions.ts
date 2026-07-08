"use server";

import { chargePendingOrder } from "@/lib/orders";
import { createClient } from "@/lib/supabase/server";

/**
 * Seller "close now" — hits the same server path the settlement worker uses.
 * close_listing enforces that only the owner may close early (auth.uid()
 * check inside the RPC); with a winner it atomically creates the order.
 * Milestone 15 extends this to trigger the winner's charge immediately.
 */
export async function closeListingNow(
  listingId: string
): Promise<{ error: string } | { status: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sign in first" };

  const { data, error } = await supabase.rpc("close_listing", {
    p_listing_id: listingId,
  });
  if (error) return { error: error.message };

  // charge the winner right away (milestone 15) — the worker retries if
  // this is skipped (e.g. Stripe not configured yet)
  const { data: order } = await supabase
    .from("orders")
    .select("id")
    .eq("listing_id", listingId)
    .maybeSingle();
  if (order) await chargePendingOrder(order.id);

  return { status: data.status as string };
}
