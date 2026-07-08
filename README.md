# Hammerbid — Live Auction Marketplace

Two-sided marketplace where sellers list products/services for auction and buyers
bid in real time. Bids can be withdrawn before close — the price falls back to the
next-highest active bid, and every move is charted like a trading view.

Full product/engineering brief: [CLAUDE.md](./CLAUDE.md).

## Stack

- Next.js (App Router) + TypeScript
- Tailwind CSS v4 + shadcn/ui
- Supabase (Postgres, Auth, Realtime, RLS) — all bid/price logic lives in Postgres RPCs
- Recharts for price charts
- Zod validation everywhere
- Stripe Connect (Express) for payments — wired in milestone 14

## Getting started

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Create a Supabase project** at [supabase.com](https://supabase.com), then copy
   `.env.example` to `.env.local` and fill in:

   ```
   NEXT_PUBLIC_SUPABASE_URL=        # Project Settings > API > Project URL
   NEXT_PUBLIC_SUPABASE_ANON_KEY=   # Project Settings > API > anon public key
   SUPABASE_SERVICE_ROLE_KEY=       # Project Settings > API > service_role (server only)
   ```

   Stripe keys stay empty until milestone 14.

3. **Run migrations** (from milestone 3 onward): apply the SQL files in
   `supabase/migrations/` in order via the Supabase SQL editor, or with the CLI:

   ```bash
   npx supabase db push
   ```

4. **Seed demo data** (from milestone 3 onward): run `supabase/seed.sql` in the
   SQL editor — it creates demo sellers, buyers, listings, and price history.

5. **Run the dev server**

   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000).

## Project layout

```
src/
  app/              # App Router pages
  components/ui/    # shadcn/ui primitives
  lib/supabase/     # client.ts (browser), server.ts (RSC/actions), middleware.ts (session refresh)
  proxy.ts          # Next.js proxy (middleware) → Supabase session refresh
supabase/
  migrations/       # SQL: enums, tables, indexes, RLS, RPCs (from milestone 3)
```

## Build progress

Built milestone-by-milestone per [CLAUDE.md §15](./CLAUDE.md):

- [x] 1. Scaffold (Next.js + Tailwind + shadcn + Supabase helpers)
- [x] 2. Auth & onboarding (signup trigger → profiles + payment_profiles, navbar, auth gate helper)
- [x] 3. Schema & bid engine (all tables, RLS, atomic RPCs, realtime publication)
- [x] 4. Selling capability (`enable_selling()` + EnableSellingCard, onboarding gate)
- [x] 5. Create listing (`/create` — Zod validation, image upload to Storage, fee disclosure)
- [x] 6. Marketplace home (cards + sparklines, type/category/search filters, sorting)
- [x] 7. Listing detail (price display + % change, bid panel → place/withdraw RPCs, activity feed)
- [x] 8. Price chart (gradient area, 1H/6H/1D/1W/ALL tabs, crosshair tooltip, range-aware % change)
- [x] 9. Realtime (live price/chart/feed/bid-panel updates on the listing page, no refresh)
- [x] 10. Listing chat + moderation (Activity | Chat tabs, owner read-only, report dialog, 3-report auto-hide, live updates)
- [x] 11. Private messaging (Message-the-seller, /messages inbox + live threads, mark-as-read, block & report)
- [x] 12. Dashboard & settings (My bids/purchases/listings/sales, payment & payout status, blocked users)
- [x] 13. Auction close (settlement worker `/api/worker/settle` + seller Close now)
- [x] 14. Stripe Connect setup (Express onboarding, card-on-file SetupIntent + consent, idempotent webhook)
- [x] 15. Charge, hold & payout (worker charge with claim + idempotency keys, confirm receipt → transfer, auto-release, failure handling)
- [x] 16. Polish (blue-accent dark theme, tabular numerals, sticky bid panel, loading skeletons)
- [x] 17. Edge-case sweep (§12 — all 31 items verified; Stripe-runtime items pending test keys)

### Stripe setup (test mode)

1. Create a Stripe account, enable **Connect** (Express) in test mode.
2. Add to `.env.local`: `STRIPE_SECRET_KEY=sk_test_…`,
   `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_…`, then restart `npm run dev`.
3. Webhooks (local): `stripe listen --forward-to localhost:3000/api/stripe/webhook`
   and copy the printed `whsec_…` into `STRIPE_WEBHOOK_SECRET`. (Card saves also
   confirm server-side without webhooks; onboarding's `payouts_enabled` flip
   needs the webhook or a page refresh after Stripe redirects back.)
4. Test card: `4242 4242 4242 4242`, any future expiry/CVC.
5. Until you complete real onboarding, the dev-seeded flags on the test
   accounts keep bidding/listing working; flip them off to exercise the gates.

### Dev notes

- **Email confirmation:** for local testing, turn off *Confirm email* in
  Supabase → Authentication → Sign In / Providers → Email, or new signups will
  need to click a mail link before they can sign in.
- Migrations: `20260702000001_profiles_and_auth.sql`,
  `20260702000002_schema_and_engine.sql`,
  `20260702000003_fix_listings_policies.sql`,
  `20260706000004_order_book_bids.sql` (order-book bidding: under-bids join
  the book and win when higher bids withdraw),
  `20260706000005_withdraw_cooldown.sql` (5-minute re-bid cooldown after a
  withdrawal, §13),
  `20260706000006_buy_it_now.sql` (optional seller-set Buy It Now price +
  `buy_now` RPC) — apply in order.

### Test accounts (dev project only)

All created via the auth admin API with password `Hammerbid-Test-2026!` and
dev-seeded payment flags (`has_payment_method = true`; real Stripe onboarding
replaces these flags in milestone 14):

| email                   | username     | role                          |
| ----------------------- | ------------ | ----------------------------- |
| alice@example.com       | `alice`      | buyer (card on file)          |
| bob@example.com         | `bob`        | buyer (card on file)          |
| carol@example.com       | `carol`      | buyer (card on file)          |
| sam.seller@example.com  | `seller_sam` | seller (payouts enabled)      |
