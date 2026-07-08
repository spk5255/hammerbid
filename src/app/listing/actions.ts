"use server";

import { chargePendingOrder } from "@/lib/orders";
import { createClient } from "@/lib/supabase/server";

/**
 * Buy It Now — the RPC atomically wins + closes the auction and creates the
 * order; then the winner's charge is attempted immediately (the settlement
 * worker retries if it's skipped).
 */
export async function buyNow(
  listingId: string
): Promise<{ error: string } | { ok: true }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sign in first" };

  const { error } = await supabase.rpc("buy_now", {
    p_listing_id: listingId,
  });
  if (error) return { error: error.message };

  const { data: order } = await supabase
    .from("orders")
    .select("id")
    .eq("listing_id", listingId)
    .maybeSingle();
  if (order) await chargePendingOrder(order.id);

  return { ok: true };
}
