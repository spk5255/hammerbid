import Link from "next/link";
import { redirect } from "next/navigation";
import { CloseListingButton } from "@/components/close-listing-button";
import { ConfirmReceiptButton } from "@/components/confirm-receipt-button";
import { CountdownTimer } from "@/components/countdown-timer";
import { EmptyState } from "@/components/empty-state";
import { SellerEarnings } from "@/components/seller-earnings";
import { WithdrawBidButton } from "@/components/withdraw-bid-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getUserAndProfile } from "@/lib/auth";
import { centsToAmount, formatMoney, toCents } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

type BidRow = {
  id: string;
  amount: string | number;
  status: "active" | "withdrawn" | "won" | "lost";
  created_at: string;
  listing_id: string;
  listings: {
    title: string;
    current_price: string | number;
    status: "active" | "closed" | "cancelled";
    ends_at: string;
  } | null;
};

type OrderRow = {
  id: string;
  listing_id: string;
  hammer_price: string | number;
  amount_charged: string | number;
  seller_payout: string | number;
  status:
    | "pending_payment"
    | "paid_held"
    | "released"
    | "payment_failed"
    | "refunded"
    | "cancelled";
  created_at: string;
  listings: { title: string } | null;
};

type ListingRow = {
  id: string;
  title: string;
  current_price: string | number;
  status: "active" | "closed" | "cancelled";
  ends_at: string;
};

const ORDER_BADGE: Record<OrderRow["status"], { label: string; cls: string }> = {
  pending_payment: { label: "Payment pending", cls: "border-amber-400/40 text-amber-400" },
  paid_held: { label: "Held — payment protection", cls: "border-sky-400/40 text-sky-400" },
  released: { label: "Released", cls: "border-emerald-400/40 text-emerald-400" },
  payment_failed: { label: "Payment failed", cls: "border-red-400/40 text-red-400" },
  refunded: { label: "Refunded", cls: "border-muted-foreground/40 text-muted-foreground" },
  cancelled: { label: "Cancelled", cls: "border-muted-foreground/40 text-muted-foreground" },
};

const BID_BADGE: Record<Exclude<BidRow["status"], "active">, { label: string; cls: string }> = {
  won: { label: "Won", cls: "border-emerald-400/40 text-emerald-400" },
  lost: { label: "Lost", cls: "border-red-400/40 text-red-400" },
  withdrawn: { label: "Withdrawn", cls: "border-muted-foreground/40 text-muted-foreground" },
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h2>
      {children}
    </section>
  );
}

export default async function DashboardPage() {
  const { user, profile } = await getUserAndProfile();
  if (!user || !profile) redirect("/auth?next=/dashboard");

  const supabase = await createClient();

  const [{ data: bidsData }, { data: purchasesData }, { data: payData }] =
    await Promise.all([
      supabase
        .from("bids")
        .select(
          "id,amount,status,created_at,listing_id,listings(title,current_price,status,ends_at)"
        )
        .eq("bidder_id", user.id)
        .order("created_at", { ascending: false })
        .limit(100),
      supabase
        .from("orders")
        .select(
          "id,listing_id,hammer_price,amount_charged,seller_payout,status,created_at,listings(title)"
        )
        .eq("buyer_id", user.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("payment_profiles")
        .select("payouts_enabled")
        .eq("id", user.id)
        .maybeSingle(),
    ]);

  const bids = (bidsData ?? []) as unknown as BidRow[];
  const purchases = (purchasesData ?? []) as unknown as OrderRow[];
  const payoutsEnabled = payData?.payouts_enabled ?? false;

  // A lot whose ends_at has passed is frozen even if settlement hasn't
  // flipped its status yet — bids are binding at close, so no Withdraw
  // button in that window (mirrors the withdraw_bid DB guard).
  const nowMs = Date.now();
  const isLive = (b: BidRow) =>
    b.status === "active" &&
    b.listings?.status === "active" &&
    new Date(b.listings.ends_at).getTime() > nowMs;
  const activeBids = bids.filter(isLive);
  const historyBids = bids.filter((b) => !isLive(b));

  let myListings: ListingRow[] = [];
  let sales: OrderRow[] = [];
  const activeBidCount = new Map<string, number>();
  if (profile.is_seller) {
    const [{ data: listingsData }, { data: salesData }] = await Promise.all([
      supabase
        .from("listings")
        .select("id,title,current_price,status,ends_at")
        .eq("seller_id", user.id)
        .order("created_at", { ascending: false })
        .limit(100),
      supabase
        .from("orders")
        .select(
          "id,listing_id,hammer_price,amount_charged,seller_payout,status,created_at,listings(title)"
        )
        .eq("seller_id", user.id)
        .order("created_at", { ascending: false }),
    ]);
    myListings = (listingsData ?? []) as ListingRow[];
    sales = (salesData ?? []) as unknown as OrderRow[];
    if (myListings.length) {
      const { data: activeBidRows } = await supabase
        .from("bids")
        .select("listing_id")
        .in(
          "listing_id",
          myListings.map((l) => l.id)
        )
        .eq("status", "active");
      for (const b of activeBidRows ?? []) {
        activeBidCount.set(
          b.listing_id,
          (activeBidCount.get(b.listing_id) ?? 0) + 1
        );
      }
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-8 px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <Button
          variant="outline"
          size="sm"
          nativeButton={false}
          render={<Link href="/messages" />}
        >
          My messages
        </Button>
      </div>

      <Link
        href="/referrals"
        className="flex items-center justify-between gap-3 rounded-xl border border-emerald-400/30 bg-emerald-400/10 px-4 py-3 text-sm transition-colors hover:bg-emerald-400/15"
      >
        <span>
          <span className="font-semibold">Give $5, get $5.</span>{" "}
          <span className="text-muted-foreground">
            Invite a friend — you both earn bid credit when they place their
            first bid.
          </span>
        </span>
        <span className="shrink-0 font-medium text-emerald-400">
          Invite →
        </span>
      </Link>

      <Section title="My bids">
        {activeBids.length === 0 ? (
          <EmptyState
            title="No active bids"
            hint="Find something on the marketplace and place the first bid."
          />
        ) : (
          <ul className="divide-y divide-border/60 rounded-xl border border-border/60 bg-card">
            {activeBids.map((b) => {
              const onTop =
                b.listings &&
                toCents(String(b.amount)) >=
                  toCents(String(b.listings.current_price));
              return (
                <li
                  key={b.id}
                  className="flex flex-wrap items-center gap-3 px-4 py-3"
                >
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/listing/${b.listing_id}`}
                      className="font-medium hover:text-sky-400"
                    >
                      {b.listings?.title ?? "Listing"}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      Your bid{" "}
                      <span className="tabular-nums">
                        {formatMoney(b.amount)}
                      </span>{" "}
                      · current{" "}
                      <span className="tabular-nums">
                        {formatMoney(b.listings?.current_price ?? 0)}
                      </span>{" "}
                      ·{" "}
                      <span className={onTop ? "text-emerald-400" : "text-sky-400"}>
                        {onTop ? "leading" : "in the book"}
                      </span>
                    </p>
                  </div>
                  {b.listings && (
                    <CountdownTimer
                      endsAt={b.listings.ends_at}
                      className="text-xs text-muted-foreground"
                    />
                  )}
                  <WithdrawBidButton listingId={b.listing_id} />
                </li>
              );
            })}
          </ul>
        )}

        {historyBids.length > 0 && (
          <details className="mt-3">
            <summary className="cursor-pointer text-xs text-muted-foreground transition-colors hover:text-foreground">
              Bid history ({historyBids.length}) — won, lost, withdrawn
            </summary>
            <ul className="mt-2 divide-y divide-border/60 rounded-xl border border-border/60 bg-card/50">
            {historyBids.slice(0, 15).map((b) => {
              const badge =
                b.status === "active"
                  ? BID_BADGE.withdrawn // active bid on an ended listing awaiting close
                  : BID_BADGE[b.status];
              return (
                <li
                  key={b.id}
                  className="flex items-center gap-3 px-4 py-2 text-sm"
                >
                  <Link
                    href={`/listing/${b.listing_id}`}
                    className="min-w-0 flex-1 truncate text-muted-foreground hover:text-foreground"
                  >
                    {b.listings?.title ?? "Listing"}
                  </Link>
                  <span className="tabular-nums">{formatMoney(b.amount)}</span>
                  <Badge
                    variant="outline"
                    className={cn("text-xs", badge.cls)}
                  >
                    {b.status === "active" ? "Pending close" : badge.label}
                  </Badge>
                </li>
              );
            })}
            </ul>
          </details>
        )}
      </Section>

      <Section title="My purchases">
        {purchases.length === 0 ? (
          <EmptyState
            title="Nothing won yet"
            hint="Win an auction and your order shows up here."
          />
        ) : (
          <ul className="divide-y divide-border/60 rounded-xl border border-border/60 bg-card">
            {purchases.map((o) => {
              const badge = ORDER_BADGE[o.status];
              return (
                <li
                  key={o.id}
                  className="flex flex-wrap items-center gap-3 px-4 py-3"
                >
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/listing/${o.listing_id}`}
                      className="font-medium hover:text-sky-400"
                    >
                      {o.listings?.title ?? "Listing"}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      Hammer{" "}
                      <span className="tabular-nums">
                        {formatMoney(o.hammer_price)}
                      </span>{" "}
                      · charged{" "}
                      <span className="tabular-nums">
                        {formatMoney(o.amount_charged)}
                      </span>
                    </p>
                  </div>
                  <Badge variant="outline" className={cn("text-xs", badge.cls)}>
                    {badge.label}
                  </Badge>
                  {o.status === "paid_held" && (
                    <ConfirmReceiptButton orderId={o.id} />
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Section>

      {profile.is_seller && (
        <>
          <Section title="My listings">
            {myListings.length === 0 ? (
              <EmptyState
                title="No listings yet"
                hint="Hit Sell in the navbar to create your first auction."
              />
            ) : (
              <ul className="divide-y divide-border/60 rounded-xl border border-border/60 bg-card">
                {myListings.map((l) => (
                  <li
                    key={l.id}
                    className="flex flex-wrap items-center gap-3 px-4 py-3"
                  >
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/listing/${l.id}`}
                        className="font-medium hover:text-sky-400"
                      >
                        {l.title}
                      </Link>
                      <p className="text-xs text-muted-foreground">
                        Current{" "}
                        <span className="tabular-nums">
                          {formatMoney(l.current_price)}
                        </span>{" "}
                        · {activeBidCount.get(l.id) ?? 0} active bid
                        {(activeBidCount.get(l.id) ?? 0) === 1 ? "" : "s"}
                      </p>
                    </div>
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-xs capitalize",
                        l.status === "active"
                          ? "border-emerald-400/40 text-emerald-400"
                          : "border-muted-foreground/40 text-muted-foreground"
                      )}
                    >
                      {l.status}
                    </Badge>
                    {l.status === "active" && (
                      <>
                        <CountdownTimer
                          endsAt={l.ends_at}
                          className="text-xs text-muted-foreground"
                        />
                        <CloseListingButton listingId={l.id} />
                      </>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section title="My sales">
            {!payoutsEnabled && (
              <p className="mb-3 rounded-md border border-amber-400/30 bg-amber-400/10 p-3 text-sm text-amber-200">
                Finish seller onboarding in Settings to receive payouts.
              </p>
            )}
            {sales.length > 0 && (
              <SellerEarnings
                held={centsToAmount(
                  sales
                    .filter((o) => o.status === "paid_held")
                    .reduce((sum, o) => sum + toCents(String(o.seller_payout)), 0)
                )}
                pending={centsToAmount(
                  sales
                    .filter((o) => o.status === "pending_payment")
                    .reduce((sum, o) => sum + toCents(String(o.seller_payout)), 0)
                )}
                released={centsToAmount(
                  sales
                    .filter((o) => o.status === "released")
                    .reduce((sum, o) => sum + toCents(String(o.seller_payout)), 0)
                )}
                payoutsEnabled={payoutsEnabled}
              />
            )}
            {sales.length === 0 ? (
              <EmptyState
                title="No sales yet"
                hint="When one of your auctions closes with a winner, the order lands here."
              />
            ) : (
              <ul className="divide-y divide-border/60 rounded-xl border border-border/60 bg-card">
                {sales.map((o) => {
                  const badge = ORDER_BADGE[o.status];
                  return (
                    <li
                      key={o.id}
                      className="flex flex-wrap items-center gap-3 px-4 py-3"
                    >
                      <div className="min-w-0 flex-1">
                        <Link
                          href={`/listing/${o.listing_id}`}
                          className="font-medium hover:text-sky-400"
                        >
                          {o.listings?.title ?? "Listing"}
                        </Link>
                        <p className="text-xs text-muted-foreground">
                          Hammer{" "}
                          <span className="tabular-nums">
                            {formatMoney(o.hammer_price)}
                          </span>{" "}
                          · your payout{" "}
                          <span className="tabular-nums">
                            {formatMoney(o.seller_payout)}
                          </span>
                        </p>
                      </div>
                      <Badge
                        variant="outline"
                        className={cn("text-xs", badge.cls)}
                      >
                        {badge.label}
                      </Badge>
                    </li>
                  );
                })}
              </ul>
            )}
          </Section>
        </>
      )}
    </main>
  );
}
