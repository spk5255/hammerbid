import Link from "next/link";
import { redirect } from "next/navigation";
import { EmptyState } from "@/components/empty-state";
import { Badge } from "@/components/ui/badge";
import { getUserAndProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

type ConvoRow = {
  id: string;
  listing_id: string;
  buyer_id: string;
  seller_id: string;
  last_message_at: string;
  listings: { title: string } | null;
  buyer: { username: string } | null;
  seller: { username: string } | null;
};

export default async function MessagesPage() {
  const { user } = await getUserAndProfile();
  if (!user) redirect("/auth?next=/messages");

  const supabase = await createClient();
  // RLS returns only threads where the viewer is a participant
  const { data } = await supabase
    .from("conversations")
    .select(
      "id,listing_id,buyer_id,seller_id,last_message_at,listings(title),buyer:profiles!conversations_buyer_id_fkey(username),seller:profiles!conversations_seller_id_fkey(username)"
    )
    .order("last_message_at", { ascending: false })
    .limit(100);

  const convos = (data ?? []) as unknown as ConvoRow[];

  // one batched query for snippets + unread counts
  const snippets = new Map<string, { body: string; at: string }>();
  const unread = new Map<string, number>();
  if (convos.length) {
    const { data: msgs } = await supabase
      .from("direct_messages")
      .select("conversation_id,sender_id,body,created_at,read_at")
      .in(
        "conversation_id",
        convos.map((c) => c.id)
      )
      .order("created_at", { ascending: false })
      .limit(500);
    for (const m of msgs ?? []) {
      if (!snippets.has(m.conversation_id)) {
        snippets.set(m.conversation_id, { body: m.body, at: m.created_at });
      }
      if (m.sender_id !== user.id && !m.read_at) {
        unread.set(m.conversation_id, (unread.get(m.conversation_id) ?? 0) + 1);
      }
    }
  }

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold tracking-tight">Messages</h1>

      {convos.length === 0 ? (
        <EmptyState
          title="No conversations yet"
          hint="Open a listing and hit “Message the seller” to start one."
        />
      ) : (
        <ul className="divide-y divide-border/60 rounded-xl border border-border/60 bg-card">
          {convos.map((c) => {
            const iAmBuyer = c.buyer_id === user.id;
            const other = iAmBuyer ? c.seller?.username : c.buyer?.username;
            const snip = snippets.get(c.id);
            const n = unread.get(c.id) ?? 0;
            return (
              <li key={c.id}>
                <Link
                  href={`/messages/${c.id}`}
                  className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/40"
                >
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 text-sm">
                      <span className="font-medium text-sky-400">
                        @{other ?? "unknown"}
                      </span>
                      <span className="truncate text-xs text-muted-foreground">
                        {c.listings?.title ?? "listing"}
                      </span>
                    </p>
                    <p className="truncate text-sm text-muted-foreground">
                      {snip?.body ?? "No messages yet"}
                    </p>
                  </div>
                  {n > 0 && (
                    <Badge className="shrink-0 bg-sky-500 text-white tabular-nums">
                      {n}
                    </Badge>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
