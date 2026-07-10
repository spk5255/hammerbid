import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { GavelIcon, GiftIcon, Share2Icon, UsersIcon } from "lucide-react";
import { ReferralLink } from "@/components/referral-link";
import { getUserAndProfile } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Give $5, get $5 — Hammerbid referrals",
  description:
    "Invite a friend to the floor. You both earn $5 in bid credit when they place their first bid.",
};

const STEPS = [
  {
    icon: Share2Icon,
    title: "Share your link",
    body: "Send it to anyone who'd love a live auction floor — chat, text, group thread.",
  },
  {
    icon: GavelIcon,
    title: "They join and bid",
    body: "Your friend signs up with your link and places their first bid on any lot.",
  },
  {
    icon: GiftIcon,
    title: "You both get $5",
    body: "Each of you earns $5 in bid credit, applied against the buyer's premium on your next win.",
  },
];

export default async function ReferralsPage() {
  const { profile } = await getUserAndProfile();
  if (!profile) redirect("/auth?next=/referrals");

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-12">
      <p
        className="hero-rise font-mono text-[11px] tracking-[0.2em] text-muted-foreground"
        style={{ animationDelay: "0ms" }}
      >
        REFERRALS · GIVE $5, GET $5
      </p>
      <h1
        className="hero-rise mt-3 text-3xl font-semibold sm:text-4xl"
        style={{ animationDelay: "60ms" }}
      >
        Bring a friend to the floor.
      </h1>
      <p
        className="hero-rise mt-3 max-w-lg text-muted-foreground"
        style={{ animationDelay: "120ms" }}
      >
        Auctions are better with rivals. Invite a friend — when they place
        their first bid, you <span className="text-foreground">both</span> get{" "}
        <span className="font-medium text-emerald-400">$5 in bid credit</span>.
      </p>

      <div className="hero-rise mt-8" style={{ animationDelay: "180ms" }}>
        <p className="mb-2 text-sm font-medium">
          Your link{" "}
          <span className="text-muted-foreground">
            — tied to @{profile.username}
          </span>
        </p>
        <ReferralLink username={profile.username} />
      </div>

      <div
        className="hero-rise mt-10 grid gap-4 sm:grid-cols-3"
        style={{ animationDelay: "240ms" }}
      >
        {STEPS.map(({ icon: Icon, title, body }, i) => (
          <div
            key={title}
            className="rounded-xl border border-border/60 bg-card p-4"
          >
            <div className="flex items-center gap-2">
              <span className="flex size-8 items-center justify-center rounded-lg border border-sky-400/30 bg-sky-400/10">
                <Icon className="size-4 text-sky-400" />
              </span>
              <span className="font-mono text-xs text-muted-foreground">
                0{i + 1}
              </span>
            </div>
            <p className="mt-3 text-sm font-medium">{title}</p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              {body}
            </p>
          </div>
        ))}
      </div>

      <div
        className="hero-rise mt-10 flex items-start gap-2.5 rounded-xl border border-border/60 bg-card/50 p-4"
        style={{ animationDelay: "300ms" }}
      >
        <UsersIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
        <div className="text-xs leading-relaxed text-muted-foreground">
          <p className="font-medium text-foreground">The fine print</p>
          <ul className="mt-1 list-disc space-y-1 pl-4">
            <li>
              Your friend must be new to Hammerbid and sign up through your
              link.
            </li>
            <li>
              Credit unlocks when they place their first bid (a saved card is
              required to bid, which keeps things fair).
            </li>
            <li>
              Bid credit offsets the 5% buyer&apos;s premium on wins — it
              isn&apos;t withdrawable cash.
            </li>
            <li>Up to 20 referred friends ($100 in credit) per account.</li>
            <li>
              Self-referrals and duplicate accounts void the credit — the
              floor plays fair.
            </li>
          </ul>
        </div>
      </div>
    </main>
  );
}
