// Platform money rules (brief §6A). Keep in sync with the SQL constants in
// place_bid / close_listing (supabase/migrations/20260702000002_schema_and_engine.sql).
export const BUYER_PREMIUM_PCT = 0.05; // 5% added on top of the hammer (buyer pays)
export const SELLER_COMMISSION_PCT = 0.05; // 5% off the hammer (seller's cut)
export const MIN_PLATFORM_FEE = "1.00"; // floor so tiny sales never run at a loss
export const MIN_STARTING_PRICE = 5; // listings can't start below this
export const MAX_BID_AMOUNT = 10000; // per-bid ceiling
export const AUTO_RELEASE_DAYS = 7;
export const MIN_LISTING_MINUTES = 15; // ends_at at least this far out
export const MAX_LISTING_DAYS = 30; // ends_at at most this far out
// §13: sit-out after withdrawing before re-bidding on the same listing
// (keep in sync with c_rebid_cooldown in place_bid — migration 0005)
export const REBID_COOLDOWN_MINUTES = 5;

// NOTE: "services" was removed — it double-encoded the Product/Service type
// toggle and showed up twice in the marketplace filter row. Existing rows
// with category "services" stay valid in the DB; service listings pick the
// closest category (usually "other") and are found via the Service type chip.
export const LISTING_CATEGORIES = [
  "electronics",
  "collectibles",
  "fashion",
  "home",
  "art",
  "gaming",
  "other",
] as const;
