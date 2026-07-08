import Link from "next/link";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";

/**
 * Homepage hero — the product's mechanic told as a picture: a price line
 * that steps up with bids, drops at a withdrawal, and ends live. Draws
 * itself on load (CSS, reduced-motion aware). Real marketplace counts,
 * no decorative stats.
 */
export async function Hero() {
  const supabase = await createClient();
  const nowIso = new Date().toISOString();
  const [{ count: liveCount }, { count: bidCount }, { count: moveCount }] =
    await Promise.all([
      supabase
        .from("listings")
        .select("id", { count: "exact", head: true })
        .eq("status", "active")
        .gt("ends_at", nowIso),
      supabase.from("bids").select("id", { count: "exact", head: true }),
      supabase
        .from("price_history")
        .select("id", { count: "exact", head: true }),
    ]);

  return (
    <section className="relative mb-10 overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-b from-card to-background">
      {/* faint price-level gridlines */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage:
            "repeating-linear-gradient(to bottom, transparent, transparent 47px, oklch(1 0 0 / 4%) 48px)",
        }}
      />

      {/* the signature: bids step the line up, a withdrawal drops it */}
      <svg
        aria-hidden
        viewBox="0 0 1200 230"
        preserveAspectRatio="none"
        className="pointer-events-none absolute inset-x-0 bottom-0 h-40 w-full sm:h-52"
      >
        <defs>
          <linearGradient id="hero-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#34d399" stopOpacity="0.10" />
            <stop offset="100%" stopColor="#34d399" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path
          d="M0 190 L130 190 L138 160 L260 160 L268 128 L410 128 L418 102 L545 102 L556 158 L690 158 L698 124 L845 124 L853 92 L1000 92 L1008 58 L1165 58 L1165 230 L0 230 Z"
          fill="url(#hero-fill)"
          className="hero-area"
        />
        <path
          d="M0 190 L130 190 L138 160 L260 160 L268 128 L410 128 L418 102 L545 102 L556 158 L690 158 L698 124 L845 124 L853 92 L1000 92 L1008 58 L1165 58"
          fill="none"
          stroke="#34d399"
          strokeWidth="2"
          pathLength="1"
          className="hero-line"
        />
        {/* the withdrawal drop, marked in the product's own red */}
        <path
          d="M545 102 L556 158"
          fill="none"
          stroke="#f87171"
          strokeWidth="2.5"
          className="hero-drop"
        />
      </svg>

      {/* the withdrawal annotation */}
      <div
        aria-hidden
        className="hero-note absolute bottom-[7.2rem] left-[42%] hidden items-center gap-1 text-[10px] font-medium text-red-400 sm:flex"
      >
        <span>▼</span>
        <span>bid withdrawn</span>
      </div>

      {/* live dot at the line's edge */}
      <span
        aria-hidden
        className="hero-dot absolute right-[2.4%] bottom-[9.3rem] hidden h-2.5 w-2.5 sm:block"
      >
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
        <span className="relative block h-2.5 w-2.5 rounded-full bg-emerald-400" />
      </span>

      <div className="relative flex flex-col gap-5 px-6 pt-10 pb-36 sm:px-10 sm:pt-14 sm:pb-44 lg:max-w-2xl">
        <p className="hero-rise flex items-center gap-2 text-xs font-medium tracking-widest text-muted-foreground uppercase">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
          </span>
          {liveCount ?? 0} auction{(liveCount ?? 0) === 1 ? "" : "s"} live now
        </p>

        <h1 className="hero-rise text-4xl font-bold tracking-tight text-balance sm:text-5xl [animation-delay:80ms]">
          Every bid moves the price{" "}
          <span className="text-emerald-400">up</span>. Walking away moves it{" "}
          <span className="text-red-400">down</span>.
        </h1>

        <p className="hero-rise max-w-xl text-base text-muted-foreground sm:text-lg [animation-delay:160ms]">
          An auction house with a trading floor&apos;s pulse — every bid and
          withdrawal is charted live. Sellers are paid only after you confirm
          delivery.
        </p>

        <div className="hero-rise flex flex-wrap items-center gap-3 [animation-delay:240ms]">
          <Button size="lg" nativeButton={false} render={<a href="#live" />}>
            Explore live auctions
          </Button>
          <Button
            size="lg"
            variant="outline"
            nativeButton={false}
            render={<Link href="/create" />}
          >
            Start selling
          </Button>
        </div>

        <dl className="hero-rise flex flex-wrap gap-x-8 gap-y-2 pt-1 [animation-delay:320ms]">
          {[
            { label: "bids placed", value: bidCount ?? 0 },
            { label: "price moves charted", value: moveCount ?? 0 },
          ].map((s) => (
            <div key={s.label} className="flex items-baseline gap-2">
              <dt className="order-2 text-xs text-muted-foreground">
                {s.label}
              </dt>
              <dd className="order-1 text-lg font-semibold tabular-nums">
                {s.value.toLocaleString("en-US")}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
