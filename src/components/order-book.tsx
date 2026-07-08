import { createClient } from "@/lib/supabase/server";
import { formatMoney, toCents } from "@/lib/money";
import { cn } from "@/lib/utils";

type BookRow = {
  id: string;
  bidder_id: string;
  amount: string | number;
  created_at: string;
  profiles: { username: string } | null;
};

/**
 * The standing-bid book, top of book first (ties broken by time, matching
 * close_listing). Depth bars are proportional to the leading bid. Re-renders
 * live via ListingRealtime's refresh on any bids change.
 */
export async function OrderBook({
  listingId,
  viewerId,
  startingPrice,
}: {
  listingId: string;
  viewerId: string | null;
  startingPrice: string;
}) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("bids")
    .select("id,bidder_id,amount,created_at,profiles(username)")
    .eq("listing_id", listingId)
    .eq("status", "active")
    .order("amount", { ascending: false })
    .order("created_at", { ascending: true })
    .limit(25);
  const rows = (data ?? []) as unknown as BookRow[];
  const topCents = rows.length ? toCents(String(rows[0].amount)) : 0;

  return (
    <div className="rounded-xl border border-border/60 bg-card">
      <div className="flex items-center justify-between border-b border-border/60 px-4 py-2">
        <p className="text-sm font-medium">Order book</p>
        <p className="text-xs text-muted-foreground">
          {rows.length} standing bid{rows.length === 1 ? "" : "s"}
        </p>
      </div>
      <ul className="p-2">
        {rows.length === 0 ? (
          <li className="px-2 py-4 text-center text-sm text-muted-foreground">
            The book is empty — the first bid leads.
          </li>
        ) : (
          rows.map((b, i) => {
            const isLead = i === 0;
            const mine = b.bidder_id === viewerId;
            const width =
              topCents > 0
                ? Math.max(
                    8,
                    Math.round((toCents(String(b.amount)) / topCents) * 100)
                  )
                : 0;
            return (
              <li key={b.id} className="relative overflow-hidden rounded-md">
                <div
                  aria-hidden
                  className={cn(
                    "absolute inset-y-0 left-0",
                    isLead ? "bg-emerald-400/10" : "bg-sky-400/[0.07]"
                  )}
                  style={{ width: `${width}%` }}
                />
                <div className="relative flex items-center justify-between gap-2 px-2 py-1.5 text-sm">
                  <span className="min-w-0 truncate">
                    <span
                      className={cn(
                        "font-medium",
                        isLead ? "text-emerald-400" : "text-sky-400"
                      )}
                    >
                      @{b.profiles?.username ?? "unknown"}
                    </span>
                    {mine && (
                      <span className="ml-1 text-[10px] text-muted-foreground">
                        (you)
                      </span>
                    )}
                    {isLead && (
                      <span className="ml-1.5 rounded-full bg-emerald-400/15 px-1.5 text-[10px] font-medium text-emerald-400">
                        leading
                      </span>
                    )}
                  </span>
                  <span className="font-semibold tabular-nums">
                    {formatMoney(b.amount)}
                  </span>
                </div>
              </li>
            );
          })
        )}
        <li className="mt-1 flex items-center justify-between border-t border-dashed border-border/60 px-2 pt-1.5 text-xs text-muted-foreground">
          <span>floor (starting price)</span>
          <span className="tabular-nums">{formatMoney(startingPrice)}</span>
        </li>
      </ul>
    </div>
  );
}
