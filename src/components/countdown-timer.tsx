"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

function label(endsAt: string): string {
  const ms = new Date(endsAt).getTime() - Date.now();
  if (ms <= 0) return "Ended";
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${sec}s`;
  return `${sec}s`;
}

export function CountdownTimer({
  endsAt,
  className,
}: {
  endsAt: string;
  className?: string;
}) {
  const router = useRouter();
  // Server-rendered with the request-time label so the countdown is visible
  // before hydration; the client re-computes with its own clock (differences
  // are a second or two, hence suppressHydrationWarning).
  const [text, setText] = useState<string>(() => label(endsAt));

  useEffect(() => {
    const update = () => setText(label(endsAt));
    // first paint via rAF (async) — avoids a sync setState inside the effect
    const raf = requestAnimationFrame(update);
    const t = setInterval(update, 1000);
    return () => {
      cancelAnimationFrame(raf);
      clearInterval(t);
    };
  }, [endsAt]);

  const ended = text === "Ended";

  // One server re-render on the zero-cross so ended lots close their bid UI
  // without waiting for a manual reload. Deps only flip once, so an
  // already-ended mount refreshes at most once and never loops.
  useEffect(() => {
    if (ended) router.refresh();
  }, [ended, router]);

  return (
    <span
      suppressHydrationWarning
      className={cn("tabular-nums", ended && "font-medium text-red-400", className)}
    >
      {text}
    </span>
  );
}
