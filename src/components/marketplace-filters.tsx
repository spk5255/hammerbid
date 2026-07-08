"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { LISTING_CATEGORIES } from "@/lib/constants";
import { cn } from "@/lib/utils";

const TYPE_TABS = [
  { value: "", label: "All" },
  { value: "product", label: "Products" },
  { value: "service", label: "Services" },
] as const;

const SORTS = [
  { value: "ending", label: "Ending soon" },
  { value: "newest", label: "Newest" },
  { value: "price_asc", label: "Price ↑" },
  { value: "price_desc", label: "Price ↓" },
] as const;

const pillCls = (active: boolean) =>
  cn(
    "shrink-0 rounded-full px-3 py-1.5 text-sm font-medium transition-colors",
    active
      ? "bg-primary/15 text-primary"
      : "text-muted-foreground hover:bg-muted hover:text-foreground"
  );

/** Polymarket-style category tab bar: one scrollable row, sort docked right. */
export function MarketplaceFilters() {
  const router = useRouter();
  const sp = useSearchParams();
  const type = sp.get("type") ?? "";
  const category = sp.get("category") ?? "";
  const sort = sp.get("sort") ?? "ending";

  function apply(next: Record<string, string>) {
    const p = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(next)) {
      if (v) p.set(k, v);
      else p.delete(k);
    }
    const qs = p.toString();
    router.push(qs ? `/?${qs}` : "/");
  }

  return (
    <div className="flex items-center gap-2 border-b border-border/60 pb-2">
      <div className="scrollbar-none flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
        {TYPE_TABS.map((t) => (
          <button
            key={t.label}
            type="button"
            onClick={() => apply({ type: t.value })}
            className={pillCls(type === t.value && !category)}
          >
            {t.label}
          </button>
        ))}
        <span className="mx-1 h-4 w-px shrink-0 bg-border" />
        {LISTING_CATEGORIES.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => apply({ category: category === c ? "" : c })}
            className={cn(pillCls(category === c), "capitalize")}
          >
            {c}
          </button>
        ))}
      </div>

      <select
        aria-label="Sort"
        className="h-8 shrink-0 rounded-lg border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring dark:bg-input/30 [&>option]:bg-popover"
        value={sort}
        onChange={(e) =>
          apply({ sort: e.target.value === "ending" ? "" : e.target.value })
        }
      >
        {SORTS.map((s) => (
          <option key={s.value} value={s.value}>
            {s.label}
          </option>
        ))}
      </select>
    </div>
  );
}
