"use client";

import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { CurrentPriceDisplay } from "@/components/current-price-display";
import { formatMoney, toCents } from "@/lib/money";
import { cn } from "@/lib/utils";

export type PricePoint = { t: string; price: string };

const RANGES = [
  { key: "1H", ms: 3_600_000 },
  { key: "6H", ms: 21_600_000 },
  { key: "1D", ms: 86_400_000 },
  { key: "1W", ms: 604_800_000 },
  { key: "ALL", ms: null },
] as const;

type RangeKey = (typeof RANGES)[number]["key"];

type Datum = { ts: number; price: string; v: number };

export function PriceChart({
  points,
  currentPrice,
  nowMs,
}: {
  points: PricePoint[];
  currentPrice: string;
  /** request-time clock from the server — keeps this render pure */
  nowMs: number;
}) {
  const [range, setRange] = useState<RangeKey>("ALL");

  const { data, baseline, up } = useMemo(() => {
    const now = nowMs;
    const all: Datum[] = points
      .map((p) => ({
        ts: new Date(p.t).getTime(),
        price: p.price,
        // plotting coordinate only — money math stays in cents (§3.2)
        v: toCents(p.price) / 100,
      }))
      .sort((a, b) => a.ts - b.ts);

    const win = RANGES.find((r) => r.key === range)!.ms;
    let series = all;
    if (win != null) {
      const start = now - win;
      const inWin = all.filter((p) => p.ts >= start);
      const before = all.filter((p) => p.ts < start);
      // carry the last pre-window price forward so short ranges still
      // draw a line (flat until the first in-window move)
      const carry = before.length ? before[before.length - 1] : null;
      series = carry ? [{ ...carry, ts: start }, ...inWin] : inWin;
    }
    if (series.length) {
      series = [
        ...series,
        { ts: now, price: currentPrice, v: toCents(currentPrice) / 100 },
      ];
    }

    const base = series.length ? String(series[0].price) : currentPrice;
    return {
      data: series,
      baseline: base,
      up: toCents(currentPrice) >= toCents(base),
    };
  }, [points, range, currentPrice, nowMs]);

  const color = up ? "#34d399" : "#f87171";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <CurrentPriceDisplay
          current={currentPrice}
          start={baseline}
          label={range === "ALL" ? "since open" : `past ${range.toLowerCase()}`}
        />
        <div className="flex rounded-lg bg-muted p-[3px]">
          {RANGES.map((r) => (
            <button
              key={r.key}
              type="button"
              onClick={() => setRange(r.key)}
              className={cn(
                "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                range === r.key
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {r.key}
            </button>
          ))}
        </div>
      </div>

      <div className="h-64 rounded-xl border border-border/60 bg-card p-3 sm:h-72">
        {data.length >= 2 ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: 4 }}>
              <defs>
                <linearGradient id="price-chart-fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={color} stopOpacity={0.3} />
                  <stop offset="100%" stopColor={color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="ts" type="number" domain={["dataMin", "dataMax"]} hide />
              <YAxis
                hide
                domain={[
                  (min: number) => Math.max(0, min * 0.95),
                  (max: number) => max * 1.05,
                ]}
              />
              <Tooltip
                content={<PriceTooltip />}
                cursor={{ stroke: "#64748b", strokeDasharray: "3 3" }}
              />
              <Area
                type="monotone"
                dataKey="v"
                stroke={color}
                strokeWidth={2}
                fill="url(#price-chart-fill)"
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            No price activity in this range yet.
          </div>
        )}
      </div>
    </div>
  );
}

function PriceTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload: Datum }[];
}) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="rounded-md border border-border bg-popover px-3 py-2 text-xs shadow-md">
      <p className="font-semibold tabular-nums">{formatMoney(p.price)}</p>
      <p className="text-muted-foreground">
        {new Date(p.ts).toLocaleString()}
      </p>
    </div>
  );
}
