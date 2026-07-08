"use client";

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
  // Computed only after mount to avoid a server/client hydration mismatch.
  const [text, setText] = useState<string | null>(null);

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
  return (
    <span
      className={cn("tabular-nums", ended && "font-medium text-red-400", className)}
    >
      {text ?? "—"}
    </span>
  );
}
