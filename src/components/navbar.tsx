import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getUserAndProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { SellerBadge } from "@/components/seller-badge";
import { SignOutButton } from "@/components/sign-out-button";

export async function Navbar() {
  const { profile } = await getUserAndProfile();

  // unread DM count for the inbox badge (RLS scopes both queries to the viewer)
  let unread = 0;
  if (profile) {
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
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-4 px-4">
        <Link href="/" className="text-lg font-bold tracking-tight">
          Hammer<span className="text-sky-400">bid</span>
        </Link>

        <form action="/" className="hidden max-w-sm flex-1 sm:block">
          <Input
            name="q"
            placeholder="Search auctions"
            className="h-8"
            aria-label="Search auctions"
          />
        </form>

        <nav className="ml-auto flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            nativeButton={false}
            render={<Link href="/create" />}
          >
            Sell
          </Button>
          {profile ? (
            <>
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
            </>
          ) : (
            <Button
              size="sm"
              nativeButton={false}
              render={<Link href="/auth" />}
            >
              Sign in
            </Button>
          )}
        </nav>
      </div>
    </header>
  );
}
