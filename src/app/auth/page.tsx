import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { ActivityIcon, ShieldCheckIcon, Undo2Icon } from "lucide-react";
import { AuthForm } from "@/components/auth-form";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Join Hammerbid — Live Auction Marketplace",
  description:
    "Create a free account to bid live, sell, and watch prices move in real time.",
};

// Illustrative floor activity for the gate's tape — copy, not live data.
// Each tag doubles as a lesson in how the floor works.
type TapeItem = {
  tag: "SOLD" | "BID" | "NEW LOT" | "WITHDRAWN";
  text: string;
  price?: string;
};

const TAPE: TapeItem[] = [
  { tag: "SOLD", text: "Vintage Omega Seamaster", price: "$2,340" },
  { tag: "BID", text: "@nadia raised on Custom neon sign", price: "$180" },
  { tag: "NEW LOT", text: "1978 Polaroid SX-70, serviced" },
  { tag: "SOLD", text: "Courtside seats, Friday night", price: "$960" },
  { tag: "BID", text: "@tomek raised on Signed first edition", price: "$75" },
  { tag: "WITHDRAWN", text: "@silas stepped back before close", price: "$410" },
  { tag: "SOLD", text: "Mid-century desk lamp", price: "$140" },
  { tag: "BID", text: "@june raised on Weekend cabin stay", price: "$520" },
];

const TAG_STYLES: Record<TapeItem["tag"], string> = {
  SOLD: "border-emerald-400/25 bg-emerald-400/10 text-emerald-300",
  BID: "border-sky-400/25 bg-sky-400/10 text-sky-300",
  "NEW LOT": "border-white/10 bg-white/5 text-muted-foreground",
  WITHDRAWN: "border-amber-400/25 bg-amber-400/10 text-amber-300",
};

function HammerTape() {
  return (
    <div
      aria-hidden="true"
      className="relative h-60 overflow-hidden [mask-image:linear-gradient(to_bottom,transparent,black_18%,black_82%,transparent)]"
    >
      <div className="gate-tape">
        {/* the list is doubled so the loop is seamless */}
        {[...TAPE, ...TAPE].map((item, i) => (
          <div
            key={i}
            className="mb-2 flex items-center gap-3 rounded-lg border border-border/60 bg-card/60 px-3 py-2"
          >
            <span
              className={`shrink-0 rounded border px-1.5 py-0.5 font-mono text-[10px] font-medium tracking-widest ${TAG_STYLES[item.tag]}`}
            >
              {item.tag}
            </span>
            <span className="truncate text-sm text-muted-foreground">
              {item.text}
            </span>
            {item.price && (
              <span className="ml-auto shrink-0 font-mono text-sm text-foreground">
                {item.price}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

const PROOF = [
  {
    icon: ActivityIcon,
    title: "Live prices",
    sub: "Every bid redraws the chart in real time",
  },
  {
    icon: Undo2Icon,
    title: "Withdraw any time",
    sub: "Change your mind before the lot closes",
  },
  {
    icon: ShieldCheckIcon,
    title: "Protected payments",
    sub: "Held until delivery is confirmed",
  },
];

export default async function AuthPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/");

  return (
    <main className="flex min-h-dvh flex-1 flex-col lg:flex-row">
      {/* The floor: brand thesis + the hammer tape */}
      <section className="flex flex-col justify-center px-6 pb-2 pt-[calc(3rem+env(safe-area-inset-top))] sm:px-12 lg:w-[55%] lg:py-16 xl:px-20">
        <div className="w-full max-w-xl lg:ml-auto lg:mr-10">
          <div
            className="hero-rise flex items-center gap-3"
            style={{ animationDelay: "0ms" }}
          >
            <span className="text-xl font-bold tracking-tight">
              Hammer<span className="text-sky-400">bid</span>
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2.5 py-1 font-mono text-[10px] font-medium tracking-widest text-emerald-300">
              <span className="relative flex size-1.5">
                <span className="absolute inset-0 animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative size-1.5 rounded-full bg-emerald-400" />
              </span>
              LIVE
            </span>
          </div>

          <h1
            className="hero-rise mt-8 text-4xl font-semibold sm:text-5xl xl:text-6xl"
            style={{ animationDelay: "60ms" }}
          >
            The floor is live.
          </h1>
          <p
            className="hero-rise mt-4 max-w-md text-base text-muted-foreground sm:text-lg"
            style={{ animationDelay: "120ms" }}
          >
            Every bid moves the price in real time. Step in, raise your
            paddle, and step back any time before the hammer falls.
          </p>

          <div
            className="hero-rise mt-10 hidden lg:block"
            style={{ animationDelay: "180ms" }}
          >
            <HammerTape />
          </div>

          <dl
            className="hero-rise mt-10 hidden grid-cols-3 gap-6 lg:grid"
            style={{ animationDelay: "240ms" }}
          >
            {PROOF.map(({ icon: Icon, title, sub }) => (
              <div key={title}>
                <dt className="flex items-center gap-1.5 text-sm font-medium">
                  <Icon className="size-4 text-sky-400" />
                  {title}
                </dt>
                <dd className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  {sub}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* The desk: quiet panel where the account gets made */}
      <section className="flex flex-1 justify-center px-6 py-10 sm:px-12 lg:items-center lg:border-l lg:border-border/60 lg:bg-card/25 lg:py-16">
        <div
          className="hero-rise w-full max-w-sm"
          style={{ animationDelay: "150ms" }}
        >
          <Suspense>
            <AuthForm />
          </Suspense>

          {/* on small screens the proof points follow the form */}
          <ul className="mt-10 space-y-3 lg:hidden">
            {PROOF.map(({ icon: Icon, title, sub }) => (
              <li
                key={title}
                className="flex items-start gap-2.5 text-sm text-muted-foreground"
              >
                <Icon className="mt-0.5 size-4 shrink-0 text-sky-400" />
                <span>
                  <span className="font-medium text-foreground">{title}</span>{" "}
                  — {sub.toLowerCase()}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </main>
  );
}
