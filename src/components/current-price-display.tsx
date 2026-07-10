import { centsToAmount, formatMoney, toCents } from "@/lib/money";
import { cn } from "@/lib/utils";

export function CurrentPriceDisplay({
  current,
  start,
  label = "since open",
}: {
  current: string;
  start: string;
  label?: string;
}) {
  const cur = toCents(current);
  const st = toCents(start);
  const diff = cur - st;
  const up = diff >= 0;
  // percentage is display-only — never stored (§3.2)
  const pct = st > 0 ? ((diff / st) * 100).toFixed(1) : "0.0";

  return (
    // polite live region: screen readers hear realtime price moves
    <div aria-live="polite" aria-atomic="true">
      <p className="text-sm text-muted-foreground">Current price</p>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="text-4xl font-bold tabular-nums">
          {formatMoney(current)}
        </span>
        <span
          className={cn(
            "text-sm font-medium tabular-nums",
            up ? "text-emerald-400" : "text-red-400"
          )}
        >
          {up ? "▲" : "▼"} {formatMoney(centsToAmount(Math.abs(diff)))} ({pct}
          %) {label}
        </span>
      </div>
    </div>
  );
}
