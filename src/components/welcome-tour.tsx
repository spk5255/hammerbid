"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  CheckIcon,
  GavelIcon,
  SearchIcon,
  ShieldCheckIcon,
  StoreIcon,
  TimerIcon,
  Undo2Icon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Each step's visual is a small mock built from the app's own UI vocabulary,
// so the tour teaches what the real screens will look like. Mocks are divs,
// not buttons — nothing here is interactive except the tour controls.

function BrowseVisual() {
  return (
    <div className="mx-auto w-full max-w-xs rounded-xl border border-border/60 bg-card p-4">
      <div className="flex h-24 items-center justify-center rounded-lg bg-[oklch(0.24_0.02_258)]">
        <GavelIcon className="size-8 text-muted-foreground" />
      </div>
      <div className="mt-3 flex items-center justify-between gap-2">
        <p className="truncate text-sm font-medium">Vintage Omega Seamaster</p>
        <span className="shrink-0 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2 py-0.5 font-mono text-[10px] tracking-widest text-emerald-300">
          LIVE
        </span>
      </div>
      <div className="mt-2 flex items-center justify-between">
        <span className="font-mono text-lg">$2,340</span>
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          <TimerIcon className="size-3.5" />
          2h 14m · 23 bids
        </span>
      </div>
    </div>
  );
}

function BidVisual() {
  return (
    <div className="mx-auto w-full max-w-xs rounded-xl border border-border/60 bg-card p-5">
      <p className="text-xs text-muted-foreground">Current price</p>
      <div className="mt-1 flex items-baseline gap-2">
        <span className="font-mono text-3xl">$195</span>
        <span className="font-mono text-sm text-muted-foreground line-through">
          $180
        </span>
        <span className="text-xs font-medium text-emerald-300">▲ your bid</span>
      </div>
      <div className="mt-4 rounded-lg bg-primary py-2.5 text-center text-sm font-semibold text-primary-foreground">
        Place bid — $195
      </div>
    </div>
  );
}

function WithdrawVisual() {
  return (
    <div className="mx-auto w-full max-w-xs rounded-xl border border-border/60 bg-card p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs text-muted-foreground">Your bid</p>
          <span className="font-mono text-2xl">$195</span>
        </div>
        <div className="rounded-lg border border-border px-3 py-2 text-sm text-muted-foreground">
          Withdraw bid
        </div>
      </div>
      <p className="mt-3 flex items-center gap-1.5 text-xs text-amber-300">
        <Undo2Icon className="size-3.5 shrink-0" />
        Available any time until the lot closes
      </p>
    </div>
  );
}

function ProtectVisual() {
  const rows: [string, string][] = [
    ["Hammer falls", "the highest bid wins the lot"],
    ["Payment held", "the money waits in escrow"],
    ["Delivery confirmed", "only then is the seller paid"],
  ];
  return (
    <div className="mx-auto w-full max-w-xs space-y-3 rounded-xl border border-border/60 bg-card p-5">
      {rows.map(([title, sub]) => (
        <div key={title} className="flex items-start gap-2.5">
          <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full bg-emerald-400/15">
            <CheckIcon className="size-3 text-emerald-300" />
          </span>
          <p className="text-sm leading-tight">
            <span className="font-medium">{title}</span>{" "}
            <span className="text-muted-foreground">— {sub}</span>
          </p>
        </div>
      ))}
    </div>
  );
}

const STEPS = [
  {
    icon: SearchIcon,
    title: "Browse the floor",
    body: "Every lot is a live auction. Search, filter, and open anything that catches your eye — the price you see is moving right now.",
    visual: <BrowseVisual />,
  },
  {
    icon: GavelIcon,
    title: "Bid in one tap",
    body: "Place your bid and the price updates for everyone instantly — the chart redraws with every move.",
    visual: <BidVisual />,
  },
  {
    icon: Undo2Icon,
    title: "Changed your mind? Step back",
    body: "Withdraw your bid any time before the lot closes. No penalty — the price simply settles back.",
    visual: <WithdrawVisual />,
  },
  {
    icon: ShieldCheckIcon,
    title: "Win with protection",
    body: "When the hammer falls, the highest bid wins. Payment is held until delivery is confirmed, so buyers and sellers are both covered.",
    visual: <ProtectVisual />,
  },
];

export function WelcomeTour({ username }: { username: string | null }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/";

  // steps 0..3 teach; the last index is the send-off
  const total = STEPS.length + 1;
  const [step, setStep] = useState(0);
  const finale = step === total - 1;

  // Seeing the tour once is enough — the sign-in fallback checks this
  // marker so returning users aren't re-toured on this device.
  useEffect(() => {
    localStorage.setItem("hb_tour_done", "1");
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowRight") setStep((s) => Math.min(s + 1, total - 1));
      if (e.key === "ArrowLeft") setStep((s) => Math.max(s - 1, 0));
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [total]);

  function finish() {
    router.push(next);
    router.refresh();
  }

  return (
    <div className="w-full max-w-lg">
      <div className="flex items-center justify-between">
        <p className="font-mono text-[11px] tracking-[0.2em] text-muted-foreground">
          QUICK TOUR · {step + 1} / {total}
        </p>
        {!finale && (
          <Button variant="ghost" size="sm" onClick={finish}>
            Skip tour
          </Button>
        )}
      </div>

      {/* keyed so each step re-runs the entrance animation */}
      <div key={step} className="hero-rise mt-6">
        {finale ? (
          <div className="flex min-h-[19rem] flex-col items-start justify-center">
            <div className="flex size-12 items-center justify-center rounded-2xl border border-emerald-400/30 bg-emerald-400/10">
              <GavelIcon className="size-6 text-emerald-300" />
            </div>
            <h1 className="mt-5 text-3xl font-semibold sm:text-4xl">
              You&apos;re set{username ? `, @${username}` : ""}.
            </h1>
            <p className="mt-3 max-w-md text-muted-foreground">
              That&apos;s all you need. Lots are closing all the time — go find
              your first one.
            </p>
            <div className="mt-8 flex w-full flex-col gap-3 sm:flex-row">
              <Button
                onClick={finish}
                className="h-11 flex-1 text-sm font-semibold"
              >
                Enter the floor
              </Button>
              <Button
                variant="outline"
                onClick={() => router.push("/settings")}
                className="h-11 flex-1 text-sm"
              >
                <StoreIcon className="size-4" />
                Set up selling
              </Button>
            </div>
          </div>
        ) : (
          <div className="min-h-[19rem]">
            <div className="flex min-h-[12rem] items-center">
              {STEPS[step].visual}
            </div>
            <h1 className="mt-6 text-2xl font-semibold sm:text-3xl">
              {STEPS[step].title}
            </h1>
            <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground sm:text-base">
              {STEPS[step].body}
            </p>
          </div>
        )}
      </div>

      <div className="mt-8 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {Array.from({ length: total }, (_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setStep(i)}
              aria-label={`Go to step ${i + 1}`}
              aria-current={i === step ? "step" : undefined}
              className={cn(
                "h-1.5 rounded-full transition-all",
                i === step
                  ? "w-6 bg-sky-400"
                  : "w-1.5 bg-muted hover:bg-muted-foreground/40"
              )}
            />
          ))}
        </div>
        {!finale && (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setStep((s) => Math.max(s - 1, 0))}
              disabled={step === 0}
              aria-label="Previous step"
            >
              <ArrowLeftIcon className="size-4" />
            </Button>
            <Button
              size="sm"
              onClick={() => setStep((s) => s + 1)}
              className="font-semibold"
            >
              Next
              <ArrowRightIcon className="size-4" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
