import Link from "next/link";
import { MenuIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getUserAndProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { SellerBadge } from "@/components/seller-badge";
import { SignOutButton } from "@/components/sign-out-button";

export async function Navbar() {
  const { profile } = await getUserAndProfile();

  // Signed-out visitors only ever reach the /auth gate, which brings its own
  // full-screen chrome — the navbar belongs to the signed-in app.
  if (!profile) return null;

  // unread DM count for the inbox badge (RLS scopes both queries to the viewer)
  let unread = 0;
  {
    const supabase = await createClient();
    const { data: convos } = await supabase.from("conversations").select("id");
    if (convos?.length) {
      const { count } = await supabase
        .from("direct_messages")
        .select("id", { count: "exact", head: true })
        .in(
          "conversation_id",
          convos.map((c) => c.id)
        )
        .neq("sender_id", profile.id)
        .is("read_at", null);
      unread = count ?? 0;
    }
  }

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 pt-[env(safe-area-inset-top)] backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-4 px-4">
        <Link href="/" className="text-lg font-bold tracking-tight">
          Hammer<span className="text-sky-400">bid</span>
        </Link>

        <form action="/" className="min-w-0 max-w-sm flex-1">
          <Input
            name="q"
            placeholder="Search auctions"
            className="h-8"
            aria-label="Search auctions"
          />
        </form>

        <nav className="ml-auto hidden shrink-0 items-center gap-3 md:flex">
          <Button
            variant="ghost"
            size="sm"
            nativeButton={false}
            render={<Link href="/create" />}
          >
            Sell
          </Button>
          <Button
            variant="ghost"
            size="sm"
            nativeButton={false}
            render={<Link href="/referrals" />}
          >
            Invite
          </Button>
          <Button
            variant="ghost"
            size="sm"
            nativeButton={false}
            render={<Link href="/dashboard" />}
          >
            Dashboard
          </Button>
          <Button
            variant="ghost"
            size="sm"
            nativeButton={false}
            render={<Link href="/messages" />}
          >
            Messages
            {unread > 0 && (
              <span className="ml-1 rounded-full bg-sky-500 px-1.5 text-[10px] font-semibold text-white tabular-nums">
                {unread}
              </span>
            )}
          </Button>
          <Link
            href="/settings"
            className="text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            @{profile.username}
          </Link>
          {profile.is_seller && <SellerBadge />}
          <SignOutButton />
        </nav>

        {/* phones: everything folds into one menu (no dropdown JS needed) */}
        <details className="relative ml-auto md:hidden">
          <summary
            aria-label="Menu"
            className="flex size-9 cursor-pointer list-none items-center justify-center rounded-lg border border-border/60 transition-colors hover:bg-muted [&::-webkit-details-marker]:hidden"
          >
            <MenuIcon className="size-4" />
          </summary>
          <div className="absolute right-0 top-11 z-50 flex w-52 flex-col rounded-xl border border-border bg-popover p-1 shadow-lg">
            {[
              ["/create", "Sell"],
              ["/referrals", "Invite"],
              ["/dashboard", "Dashboard"],
            ].map(([href, text]) => (
              <Link
                key={href}
                href={href}
                className="rounded-lg px-3 py-2 text-sm transition-colors hover:bg-muted"
              >
                {text}
              </Link>
            ))}
            <Link
              href="/messages"
              className="flex items-center rounded-lg px-3 py-2 text-sm transition-colors hover:bg-muted"
            >
              Messages
              {unread > 0 && (
                <span className="ml-2 rounded-full bg-sky-500 px-1.5 text-[10px] font-semibold text-white tabular-nums">
                  {unread}
                </span>
              )}
            </Link>
            <Link
              href="/settings"
              className="rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              @{profile.username} — settings
            </Link>
            <div className="my-1 border-t border-border/60" />
            <div className="px-1 pb-1">
              <SignOutButton />
            </div>
          </div>
        </details>
      </div>
    </header>
  );
}
