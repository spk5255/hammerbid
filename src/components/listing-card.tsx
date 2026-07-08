import Image from "next/image";
import Link from "next/link";
import { CountdownTimer } from "@/components/countdown-timer";
import { Sparkline } from "@/components/sparkline";
import { formatMoney, toCents } from "@/lib/money";
import type { Listing } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Dense Polymarket-style market card: thumb + title, price + trend, stats footer. */
export function ListingCard({
  listing,
  points,
  bidCount = 0,
}: {
  listing: Listing;
  points: number[];
  bidCount?: number;
}) {
  const up = points.length > 1 ? points[points.length - 1] >= points[0] : true;
  const first = points[0] ?? Number(listing.starting_price);
  const cur = toCents(String(listing.current_price));
  const base = toCents(String(first));
  // display-only percentage (§3.2)
  const pct = base > 0 ? (((cur - base) / base) * 100).toFixed(0) : "0";

  return (
    <Link
      href={`/listing/${listing.id}`}
      className="group flex flex-col gap-3 rounded-xl border border-border/60 bg-card p-4 transition-colors hover:border-primary/40"
    >
      <div className="flex items-start gap-3">
        <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-muted/60">
          {listing.image_url ? (
            <Image
              src={listing.image_url}
              alt=""
              fill
              sizes="40px"
              className="object-cover"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-lg opacity-50">
              {listing.type === "service" ? "🛠️" : "📦"}
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="line-clamp-2 text-sm font-medium leading-snug">
            {listing.title}
          </h3>
          {listing.buy_now_price != null &&
            cur < toCents(String(listing.buy_now_price)) && (
              <span className="mt-1 inline-block rounded bg-primary/15 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                ⚡ Buy now {formatMoney(listing.buy_now_price)}
              </span>
            )}
        </div>
      </div>

      <div className="flex items-end justify-between gap-3">
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold tabular-nums">
            {formatMoney(listing.current_price)}
          </span>
          <span
            className={cn(
              "text-xs font-medium tabular-nums",
              up ? "text-emerald-400" : "text-red-400"
            )}
          >
            {up ? "▲" : "▼"} {pct}%
          </span>
        </div>
        <div className="h-8 w-20 shrink-0 opacity-80">
          <Sparkline points={points} up={up} />
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-border/60 pt-2.5 text-xs text-muted-foreground">
        <span className="tabular-nums">
          {bidCount} bid{bidCount === 1 ? "" : "s"}
          <span className="mx-1.5 opacity-50">·</span>
          <span className="capitalize">{listing.type}</span>
        </span>
        <CountdownTimer endsAt={listing.ends_at} />
      </div>
    </Link>
  );
}
