import { redirect } from "next/navigation";
import { AddPaymentMethodDialog } from "@/components/add-payment-method-dialog";
import { EmptyState } from "@/components/empty-state";
import { EnableSellingCard } from "@/components/enable-selling-card";
import { SellerBadge } from "@/components/seller-badge";
import { UnblockButton } from "@/components/unblock-button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getUserAndProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

type BlockRow = {
  blocker_id: string;
  blocked_id: string;
  created_at: string;
  blocked: { username: string } | null;
};

export default async function SettingsPage() {
  const { user, profile } = await getUserAndProfile();
  if (!user || !profile) redirect("/auth?next=/settings");

  const supabase = await createClient();
  const [{ data: pay }, { data: blocksData }] = await Promise.all([
    supabase
      .from("payment_profiles")
      .select("has_payment_method,terms_accepted_at,payouts_enabled")
      .eq("id", user.id)
      .maybeSingle(),
    supabase
      .from("blocks")
      .select(
        "blocker_id,blocked_id,created_at,blocked:profiles!blocks_blocked_id_fkey(username)"
      )
      .order("created_at", { ascending: false }),
  ]);
  const blocks = (blocksData ?? []) as unknown as BlockRow[];

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-8">
      <h1 className="text-2xl font-bold tracking-tight">Settings</h1>

      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center gap-3 text-sm">
          <span className="font-medium text-sky-400">@{profile.username}</span>
          {profile.is_seller && <SellerBadge />}
          <span className="text-muted-foreground">{user.email}</span>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Payment method</CardTitle>
          <CardDescription>
            A card on file is required to bid — it&apos;s only charged if you
            win.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 text-sm">
          {pay?.has_payment_method ? (
            <p className="flex items-center gap-2">
              <Badge
                variant="outline"
                className="border-emerald-400/40 text-emerald-400"
              >
                Card on file
              </Badge>
              <span className="text-muted-foreground">
                dev flag — the real card form (Stripe SetupIntent) arrives in
                milestone 14
              </span>
            </p>
          ) : (
            <p className="flex items-center gap-2">
              <Badge
                variant="outline"
                className="border-amber-400/40 text-amber-400"
              >
                No card
              </Badge>
              <span className="text-muted-foreground">
                Adding a card arrives with payments (milestone 14).
              </span>
            </p>
          )}
          {pay?.terms_accepted_at && (
            <p className="text-xs text-muted-foreground">
              &quot;Bids are binding&quot; terms accepted{" "}
              {new Date(pay.terms_accepted_at).toLocaleDateString()}
            </p>
          )}
          <div className="mt-2 max-w-60">
            <AddPaymentMethodDialog
              triggerLabel={pay?.has_payment_method ? "Replace card" : "Add a card"}
              triggerVariant="outline"
            />
          </div>
        </CardContent>
      </Card>

      {profile.is_seller && pay?.payouts_enabled ? (
        <Card>
          <CardHeader>
            <CardTitle>Selling &amp; payouts</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center gap-2 text-sm">
            <Badge
              variant="outline"
              className="border-emerald-400/40 text-emerald-400"
            >
              Payouts enabled
            </Badge>
            <span className="text-muted-foreground">
              dev flag — real Stripe Express onboarding arrives in milestone 14
            </span>
          </CardContent>
        </Card>
      ) : (
        <EnableSellingCard
          isSeller={profile.is_seller}
          payoutsEnabled={pay?.payouts_enabled ?? false}
        />
      )}

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Blocked users
        </h2>
        {blocks.length === 0 ? (
          <EmptyState
            title="Nobody blocked"
            hint="Blocking someone from a DM thread disables messaging both ways — manage it here."
          />
        ) : (
          <ul className="divide-y divide-border/60 rounded-xl border border-border/60 bg-card">
            {blocks.map((b) => (
              <li
                key={b.blocked_id}
                className="flex items-center justify-between gap-3 px-4 py-3 text-sm"
              >
                <span className="font-medium text-sky-400">
                  @{b.blocked?.username ?? "unknown"}
                </span>
                <UnblockButton
                  blockerId={b.blocker_id}
                  blockedId={b.blocked_id}
                  username={b.blocked?.username ?? "user"}
                />
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
