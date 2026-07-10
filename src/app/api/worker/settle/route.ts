import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import {
  autoReleaseDueOrders,
  chargePendingOrder,
  type MoneyResult,
} from "@/lib/orders";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * Settlement worker (§6). One scheduled job owns money movement end-to-end:
 *   (a) close every auction whose ends_at has passed (this milestone)
 *   (b) charge the winner of each pending_payment order   — milestone 15
 *   (c) auto-release held orders after AUTO_RELEASE_DAYS  — milestone 15
 *
 * Runs with the service role: auth.uid() is NULL inside close_listing, so
 * the RPC's IS DISTINCT FROM guard only lets it close *after* ends_at —
 * an anon/worker call can never end an auction early (§16.P).
 */
async function settle() {
  const admin = createAdminClient();

  const { data: due, error } = await admin
    .from("listings")
    .select("id")
    .eq("status", "active")
    .lte("ends_at", new Date().toISOString())
    .limit(100);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const closed: string[] = [];
  const failures: { id: string; error: string }[] = [];
  for (const listing of due ?? []) {
    const { error: closeError } = await admin.rpc("close_listing", {
      p_listing_id: listing.id,
    });
    if (closeError) failures.push({ id: listing.id, error: closeError.message });
    else closed.push(listing.id);
  }

  // (b) charge every unclaimed pending_payment order
  const { data: pendingOrders } = await admin
    .from("orders")
    .select("id")
    .eq("status", "pending_payment")
    .is("stripe_payment_intent_id", null)
    .limit(50);
  const charges: { id: string; result: MoneyResult }[] = [];
  for (const order of pendingOrders ?? []) {
    charges.push({ id: order.id, result: await chargePendingOrder(order.id) });
  }

  // (c) auto-release held orders past AUTO_RELEASE_DAYS
  const releases = await autoReleaseDueOrders();

  return NextResponse.json({
    closed: closed.length,
    ids: closed,
    failures,
    charges,
    releases,
  });
}

function authorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  // no secret configured: open in dev, locked in production
  if (!secret) return process.env.NODE_ENV !== "production";
  const got = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  // constant-time comparison — no timing oracle on the cron secret
  return got.length === expected.length && timingSafeEqual(got, expected);
}

export async function GET(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return settle();
}

export async function POST(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return settle();
}
