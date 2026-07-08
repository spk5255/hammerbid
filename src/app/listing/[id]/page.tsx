import Image from "next/image";
import { notFound } from "next/navigation";
import { BidActivityFeed } from "@/components/bid-activity-feed";
import { BidPanel } from "@/components/bid-panel";
import { CountdownTimer } from "@/components/countdown-timer";
import { ListingChat, type ChatMessage } from "@/components/listing-chat";
import { ListingRealtime } from "@/components/listing-realtime";
import { ListingTabs } from "@/components/listing-tabs";
import { MessageSellerButton } from "@/components/message-seller-button";
import { OrderBook } from "@/components/order-book";
import { PriceChart } from "@/components/price-chart";
import { SellerBadge } from "@/components/seller-badge";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/server";
import type { Listing } from "@/lib/types";

export default async function ListingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: listing } = await supabase
    .from("listings")
    .select("*")
    .eq("id", id)
    .maybeSingle<Listing>();
  if (!listing) notFound();

  const [
    { data: seller },
    {
      data: { user },
    },
    { data: history },
    { count: activeBidCount },
    { data: rawMessages },
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("username,is_seller")
      .eq("id", listing.seller_id)
      .maybeSingle(),
    supabase.auth.getUser(),
    supabase
      .from("price_history")
      .select("price,created_at")
      .eq("listing_id", id)
      .order("created_at", { ascending: false })
      .limit(500),
    supabase
      .from("bids")
      .select("id", { count: "exact", head: true })
      .eq("listing_id", id)
      .eq("status", "active"),
    supabase
      .from("messages")
      .select("id,user_id,body,created_at,profiles(username)")
      .eq("listing_id", id)
      .eq("hidden", false)
      .order("created_at", { ascending: true })
      .limit(100),
  ]);

  let myBidAmount: string | null = null;
  let hasCard = false;
  let myUsername: string | null = null;
  let blockedWithSeller = false;
  if (user) {
    const [{ data: myBid }, { data: pay }, { data: myProfile }, { data: blk }] =
      await Promise.all([
        supabase
          .from("bids")
          .select("amount")
          .eq("listing_id", id)
          .eq("bidder_id", user.id)
          .eq("status", "active")
          .maybeSingle(),
        supabase
          .from("payment_profiles")
          .select("has_payment_method")
          .eq("id", user.id)
          .maybeSingle(),
        supabase
          .from("profiles")
          .select("username")
          .eq("id", user.id)
          .maybeSingle(),
        supabase.rpc("users_blocked", { a: user.id, b: listing.seller_id }),
      ]);
    myBidAmount = myBid ? String(myBid.amount) : null;
    hasCard = pay?.has_payment_method ?? false;
    myUsername = myProfile?.username ?? null;
    blockedWithSeller = blk === true;
  }

  const chatMessages: ChatMessage[] = (rawMessages ?? []).map((m) => ({
    id: m.id as string,
    user_id: m.user_id as string,
    body: m.body as string,
    created_at: m.created_at as string,
    username:
      (m.profiles as unknown as { username: string } | null)?.username ??
      "unknown",
  }));

  // newest 500 fetched; chart wants ascending order
  const chartPoints = (history ?? [])
    .slice()
    .reverse()
    .map((p) => ({ t: p.created_at as string, price: String(p.price) }));
  // eslint-disable-next-line react-hooks/purity -- server component: auction state is request-time by design
  const nowMs = Date.now();
  const ended =
    listing.status !== "active" ||
    new Date(listing.ends_at).getTime() <= nowMs;

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
      <ListingRealtime listingId={id} />
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="capitalize">
              {listing.type}
            </Badge>
            {listing.category && (
              <Badge variant="outline" className="capitalize">
                {listing.category}
              </Badge>
            )}
            {ended && (
              <Badge variant="outline" className="border-red-400/40 text-red-400">
                Ended
              </Badge>
            )}
          </div>
          <h1 className="text-2xl font-bold tracking-tight">{listing.title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Sold by <span className="text-sky-400">@{seller?.username ?? "unknown"}</span>{" "}
            {seller?.is_seller && <SellerBadge />}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted-foreground">
            {ended ? "Ended" : "Time remaining"}
          </p>
          <CountdownTimer endsAt={listing.ends_at} className="text-lg font-semibold" />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="min-w-0">
          <PriceChart
            points={chartPoints}
            currentPrice={String(listing.current_price)}
            nowMs={nowMs}
          />
        </div>

        <div className="flex flex-col gap-4 self-start lg:sticky lg:top-20">
          <BidPanel
            key={`${listing.current_price}-${myBidAmount ?? "none"}`}
            listingId={id}
            ended={ended}
            buyNowPrice={
              listing.buy_now_price != null
                ? String(listing.buy_now_price)
                : null
            }
            startingPrice={String(listing.starting_price)}
            minIncrement={String(listing.min_increment)}
            currentPrice={String(listing.current_price)}
            hasActiveBids={(activeBidCount ?? 0) > 0}
            isOwner={user?.id === listing.seller_id}
            signedIn={!!user}
            hasCard={hasCard}
            myBidAmount={myBidAmount}
          />
          <OrderBook
            listingId={id}
            viewerId={user?.id ?? null}
            startingPrice={String(listing.starting_price)}
          />
          {user?.id !== listing.seller_id && (
            <MessageSellerButton
              listingId={id}
              signedIn={!!user}
              blocked={blockedWithSeller}
            />
          )}
          <p className="px-1 text-xs text-muted-foreground">
            Bids are binding at close, but you can withdraw anytime before the
            auction ends — the price then falls to the next-highest standing
            bid in the book.
          </p>
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="flex min-w-0 flex-col gap-6">
          {(listing.image_url || listing.description) && (
            <div className="flex flex-col gap-4 rounded-xl border border-border/60 bg-card p-4">
              {listing.image_url && (
                <div className="relative aspect-video overflow-hidden rounded-lg bg-muted/40">
                  <Image
                    src={listing.image_url}
                    alt={listing.title}
                    fill
                    sizes="(max-width: 1024px) 100vw, 60vw"
                    className="object-cover"
                  />
                </div>
              )}
              {listing.description && (
                <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                  {listing.description}
                </p>
              )}
            </div>
          )}

          <ListingTabs
            activity={<BidActivityFeed listingId={id} />}
            chat={
              <ListingChat
                listingId={id}
                viewerId={user?.id ?? null}
                viewerUsername={myUsername}
                isOwner={user?.id === listing.seller_id}
                initialMessages={chatMessages}
              />
            }
          />
        </div>

      </div>
    </main>
  );
}
