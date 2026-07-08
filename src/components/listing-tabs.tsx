"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Activity | Chat tabs (§8). Both panels stay mounted so the chat's realtime
 * subscription keeps running while the activity tab is shown.
 */
export function ListingTabs({
  activity,
  chat,
}: {
  activity: React.ReactNode;
  chat: React.ReactNode;
}) {
  const [tab, setTab] = useState<"activity" | "chat">("activity");

  return (
    <section>
      <div className="mb-3 flex w-fit rounded-lg bg-muted p-[3px]">
        {(["activity", "chat"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={cn(
              "rounded-md px-3 py-1 text-sm capitalize transition-colors",
              tab === t
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {t}
          </button>
        ))}
      </div>
      <div className={cn(tab !== "activity" && "hidden")}>{activity}</div>
      <div className={cn(tab !== "chat" && "hidden")}>{chat}</div>
    </section>
  );
}
