"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/money";

/**
 * Seller earnings summary + entry to the Stripe Express payouts dashboard.
 * Figures are computed server-side from orders; the "Manage payouts" button
 * opens Stripe's hosted dashboard where the real balance lives and payouts
 * to the bank happen.
 */
export function SellerEarnings({
  held,
  pending,
  released,
  payoutsEnabled,
}: {
  held: string;
  pending: string;
  released: string;
  payoutsEnabled: boolean;
}) {
  const [loading, setLoading] = useState(false);

  async function openDashboard() {
    setLoading(true);
    const res = await fetch("/api/stripe/connect/dashboard", { method: "POST" });
    const json = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      toast.error(json.error ?? "Could not open your payouts dashboard");
      return;
    }
    window.location.href = json.url;
  }

  const stats = [
    {
      label: "Available to release",
      value: held,
      hint: "held until the buyer confirms receipt",
      cls: "text-sky-400",
    },
    {
      label: "Awaiting payment",
      value: pending,
      hint: "buyer not charged yet",
      cls: "text-amber-400",
    },
    {
      label: "Paid out to you",
      value: released,
      hint: "transferred to your Stripe balance",
      cls: "text-emerald-400",
    },
  ];

  return (
    <div className="mb-3 rounded-xl border border-border/60 bg-card p-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {stats.map((s) => (
          <div key={s.label}>
            <p className="text-xs text-muted-foreground">{s.label}</p>
            <p className={`text-xl font-bold tabular-nums ${s.cls}`}>
              {formatMoney(s.value)}
            </p>
            <p className="text-[11px] text-muted-foreground">{s.hint}</p>
          </div>
        ))}
      </div>

      <div className="mt-4 flex flex-col gap-2 border-t border-border/60 pt-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-muted-foreground">
          Stripe pays your balance out to your bank automatically. Open your
          dashboard to see the schedule, change your bank, or cash out instantly.
        </p>
        <Button
          size="sm"
          variant="outline"
          onClick={openDashboard}
          disabled={loading || !payoutsEnabled}
          className="shrink-0"
        >
          {loading ? "Opening…" : "Manage payouts & bank"}
        </Button>
      </div>
    </div>
  );
}
