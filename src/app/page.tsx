import { Suspense } from "react";
import { EmptyState } from "@/components/empty-state";
import { Hero } from "@/components/hero";
import { ListingCard } from "@/components/listing-card";
import { MarketplaceFilters } from "@/components/marketplace-filters";
import { createClient } from "@/lib/supabase/server";
import type { Listing } from "@/lib/types";

const SPARK_POINTS = 24;

type Params = Record<string, string | string[] | undefined>;
const str = (v: string | string[] | undefined) =>
  typeof v === "string" ? v : "";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<Params>;
}) {
  const params = await searchParams;
  const type = str(params.type);
  const category = str(params.category);
  const q = str(params.q);
  const sort = str(params.sort) || "ending";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let query = supabase
    .from("listings")
    .select(
      "id,seller_id,title,description,type,category,image_url,starting_price,min_increment,current_price,buy_now_price,status,ends_at,created_at"
    )
    .eq("status", "active")
    .gt("ends_at", new Date().toISOString())
    .limit(60);

  if (type === "product" || type === "service") query = query.eq("type", type);
  if (category) query = query.eq("category", category);
  if (q) {
    // strip PostgREST filter syntax characters from the user's search text
    const safe = q.replace(/[,()]/g, " ").trim();
    if (safe) query = query.or(`title.ilike.%${safe}%,description.ilike.%${safe}%`);
  }

  switch (sort) {
    case "newest":
      query = query.order("created_at", { ascending: false });
      break;
    case "price_asc":
      query = query.order("current_price", { ascending: true });
      break;
    case "price_desc":
      query = query.order("current_price", { ascending: false });
      break;
    default: // "ending"
      query = query.order("ends_at", { ascending: true });
  }

  const { data: listings, error } = await query;

  // two batched queries feed every card's sparkline + bid count
  const pointsById = new Map<string, number[]>();
  const bidCountById = new Map<string, number>();
  if (listings?.length) {
    const ids = listings.map((l) => l.id);
    const [{ data: history }, { data: bidRows }] = await Promise.all([
      supabase
        .from("price_history")
        .select("listing_id,price")
        .in("listing_id", ids)
        .order("created_at", { ascending: true }),
      supabase.from("bids").select("listing_id").in("listing_id", ids),
    ]);
    for (const row of history ?? []) {
      const arr = pointsById.get(row.listing_id) ?? [];
      arr.push(Number(row.price));
      pointsById.set(row.listing_id, arr);
    }
    for (const [id, arr] of pointsById) {
      if (arr.length > SPARK_POINTS) pointsById.set(id, arr.slice(-SPARK_POINTS));
    }
    for (const row of bidRows ?? []) {
      bidCountById.set(row.listing_id, (bidCountById.get(row.listing_id) ?? 0) + 1);
    }
  }

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
      {!user && <Hero />}
      <div id="live" className="mb-5 flex scroll-mt-20 flex-col gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Live auctions</h1>
          <p className="text-sm text-muted-foreground">
            Bid in real time — withdraw anytime before close.
          </p>
        </div>
        <Suspense>
          <MarketplaceFilters />
        </Suspense>
      </div>

      {error ? (
        <EmptyState
          title="Something went wrong"
          hint="Could not load listings — refresh to try again."
        />
      ) : !listings?.length ? (
        <EmptyState
          title="No live auctions match"
          hint="Try different filters — or hit Sell and list the first one."
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {listings.map((l) => (
            <ListingCard
              key={l.id}
              listing={l as Listing}
              points={pointsById.get(l.id) ?? [Number(l.starting_price)]}
              bidCount={bidCountById.get(l.id) ?? 0}
            />
          ))}
        </div>
      )}
    </main>
  );
}
