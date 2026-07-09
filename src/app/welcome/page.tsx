import type { Metadata } from "next";
import { Suspense } from "react";
import { WelcomeTour } from "@/components/welcome-tour";
import { getUserAndProfile } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Quick tour — Hammerbid",
  description: "A one-minute guide to bidding, withdrawing, and selling.",
};

// Shown once, right after signup (both the instant-session path and the
// email-confirmation path land here). Reachable any time at /welcome.
export default async function WelcomePage() {
  const { profile } = await getUserAndProfile();

  return (
    <main className="flex flex-1 items-center justify-center px-6 py-12">
      <Suspense>
        <WelcomeTour username={profile?.username ?? null} />
      </Suspense>
    </main>
  );
}
