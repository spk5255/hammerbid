import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { DMThread, type DM } from "@/components/dm-thread";
import { getUserAndProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

type ConvoRow = {
  id: string;
  listing_id: string;
  buyer_id: string;
  seller_id: string;
  listings: { title: string } | null;
  buyer: { username: string } | null;
  seller: { username: string } | null;
};

export default async function ThreadPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { user } = await getUserAndProfile();
  if (!user) redirect(`/auth?next=/messages/${id}`);

  const supabase = await createClient();
  // RLS: only the two participants can read the thread — others get nothing
  const { data } = await supabase
    .from("conversations")
    .select(
      "id,listing_id,buyer_id,seller_id,listings(title),buyer:profiles!conversations_buyer_id_fkey(username),seller:profiles!conversations_seller_id_fkey(username)"
    )
    .eq("id", id)
    .maybeSingle();
  if (!data) notFound();
  const convo = data as unknown as ConvoRow;

  const iAmBuyer = convo.buyer_id === user.id;
  const otherId = iAmBuyer ? convo.seller_id : convo.buyer_id;
  const otherUsername =
    (iAmBuyer ? convo.seller?.username : convo.buyer?.username) ?? "unknown";

  const [{ data: messages }, { data: blocked }] = await Promise.all([
    supabase
      .from("direct_messages")
      .select("id,sender_id,body,created_at,read_at")
      .eq("conversation_id", id)
      .order("created_at", { ascending: true })
      .limit(200),
    supabase.rpc("users_blocked", { a: user.id, b: otherId }),
  ]);

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <Link
            href="/messages"
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            ← All messages
          </Link>
          <h1 className="truncate text-lg font-bold tracking-tight">
            {convo.listings?.title ?? "Listing"}
          </h1>
        </div>
        <Link
          href={`/listing/${convo.listing_id}`}
          className="shrink-0 text-sm text-sky-400 hover:underline"
        >
          View listing
        </Link>
      </div>

      <DMThread
        conversationId={id}
        viewerId={user.id}
        otherId={otherId}
        otherUsername={otherUsername}
        initialMessages={(messages ?? []) as DM[]}
        initiallyBlocked={blocked === true}
      />
    </main>
  );
}
