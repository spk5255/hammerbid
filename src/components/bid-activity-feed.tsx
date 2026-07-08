import { EmptyState } from "@/components/empty-state";
import { formatMoney } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

type BidRow = {
  id: string;
  amount: string | number;
  status: "active" | "withdrawn" | "won" | "lost";
  created_at: string;
  withdrawn_at: string | null;
  profiles: { username: string } | null;
};

type FeedEvent = {
  key: string;
  username: string;
  kind: "bid" | "withdrew";
  amount: string | number;
  at: string;
};

function timeAgo(iso: string) {
  const s = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export async function BidActivityFeed({ listingId }: { listingId: string }) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("bids")
    .select("id,amount,status,created_at,withdrawn_at,profiles(username)")
    .eq("listing_id", listingId)
    .order("created_at", { ascending: false })
    .limit(50);

  const bids = (data ?? []) as unknown as BidRow[];
  const events: FeedEvent[] = [];
  for (const b of bids) {
    const username = b.profiles?.username ?? "unknown";
    events.push({
      key: `${b.id}-bid`,
      username,
      kind: "bid",
      amount: b.amount,
      at: b.created_at,
    });
    if (b.withdrawn_at) {
      events.push({
        key: `${b.id}-wd`,
        username,
        kind: "withdrew",
        amount: b.amount,
        at: b.withdrawn_at,
      });
    }
  }
  events.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

  if (!events.length) {
    return (
      <EmptyState
        title="No bids yet"
        hint="Be the first — the opening bid only has to meet the starting price."
      />
    );
  }

  return (
    <ul className="divide-y divide-border/60 rounded-xl border border-border/60 bg-card">
      {events.slice(0, 30).map((e) => (
        <li
          key={e.key}
          className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm"
        >
          <div className="min-w-0">
            <span className="font-medium text-sky-400">@{e.username}</span>{" "}
            <span
              className={cn(
                e.kind === "withdrew" ? "text-red-400" : "text-muted-foreground"
              )}
            >
              {e.kind === "bid" ? "bid" : "withdrew"}
            </span>{" "}
            <span className="font-medium tabular-nums">
              {formatMoney(e.amount)}
            </span>
          </div>
          <span className="shrink-0 text-xs text-muted-foreground">
            {timeAgo(e.at)}
          </span>
        </li>
      ))}
    </ul>
  );
}
