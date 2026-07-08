-- Milestone 3 — full schema, atomic bid/price engine, RLS, realtime.
-- Apply via the Supabase SQL editor (paste + run) or `supabase db push`.
-- Requires 20260702000001_profiles_and_auth.sql.

-- ============================================================
-- ENUMS
-- ============================================================
create type listing_type   as enum ('product', 'service');
create type listing_status as enum ('active', 'closed', 'cancelled');
create type bid_status     as enum ('active', 'withdrawn', 'won', 'lost');
create type price_event    as enum ('open', 'bid_placed', 'bid_withdrawn', 'close');
create type report_reason  as enum ('spam', 'harassment', 'scam', 'offensive', 'other');
create type order_status   as enum ('pending_payment', 'paid_held', 'released', 'payment_failed', 'refunded', 'cancelled');

-- ============================================================
-- TABLES & INDEXES
-- ============================================================

-- ===== LISTINGS =====
create table public.listings (
  id             uuid primary key default gen_random_uuid(),
  seller_id      uuid not null references public.profiles(id) on delete cascade,
  title          text not null,
  description    text,
  type           listing_type not null,
  category       text,
  image_url      text,
  starting_price numeric(12,2) not null check (starting_price >= 0),
  min_increment  numeric(12,2) not null default 1 check (min_increment > 0),
  current_price  numeric(12,2) not null,        -- denormalized: = max active bid or starting_price
  status         listing_status not null default 'active',
  ends_at        timestamptz not null,          -- app enforces +15 min … +30 days at creation
  created_at     timestamptz not null default now(),
  check (ends_at > created_at)
);
-- fast scan for the settlement worker ("what's due to close?")
create index listings_due_idx on public.listings (ends_at) where status = 'active';

-- ===== BIDS =====
create table public.bids (
  id           uuid primary key default gen_random_uuid(),
  listing_id   uuid not null references public.listings(id) on delete cascade,
  bidder_id    uuid not null references public.profiles(id) on delete cascade,
  amount       numeric(12,2) not null check (amount > 0),
  status       bid_status not null default 'active',
  created_at   timestamptz not null default now(),
  withdrawn_at timestamptz
);
-- at most ONE active bid per buyer per listing
create unique index one_active_bid_per_user
  on public.bids (listing_id, bidder_id) where status = 'active';
create index bids_listing_active_idx on public.bids (listing_id) where status = 'active';

-- ===== PRICE HISTORY (the chart's data source) =====
create table public.price_history (
  id         uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  price      numeric(12,2) not null,
  event_type price_event not null,
  created_at timestamptz not null default now()
);
create index price_history_listing_time_idx on public.price_history (listing_id, created_at);

-- ===== LISTING CHAT =====
-- Any signed-in user can post EXCEPT the listing's owner (read-only).
create table public.messages (
  id         uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  body       text not null check (char_length(btrim(body)) between 1 and 500),
  hidden     boolean not null default false,   -- auto-hidden once enough distinct reports land
  created_at timestamptz not null default now()
);
create index messages_listing_time_idx on public.messages (listing_id, created_at);

-- ===== REPORTS (chat moderation) =====
create table public.reports (
  id          uuid primary key default gen_random_uuid(),
  message_id  uuid not null references public.messages(id) on delete cascade,
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  reason      report_reason not null,
  note        text check (note is null or char_length(note) <= 300),
  created_at  timestamptz not null default now()
);
-- one report per user per message
create unique index one_report_per_user on public.reports (message_id, reporter_id);

-- ===== PRIVATE MESSAGING (1:1 buyer ↔ listing owner, scoped to a listing) =====
create table public.conversations (
  id              uuid primary key default gen_random_uuid(),
  listing_id      uuid not null references public.listings(id) on delete cascade,
  buyer_id        uuid not null references public.profiles(id) on delete cascade,
  seller_id       uuid not null references public.profiles(id) on delete cascade,
  created_at      timestamptz not null default now(),
  last_message_at timestamptz not null default now()
);
create unique index one_convo_per_buyer_listing on public.conversations (listing_id, buyer_id);
create index conversations_buyer_idx  on public.conversations (buyer_id,  last_message_at desc);
create index conversations_seller_idx on public.conversations (seller_id, last_message_at desc);

create table public.direct_messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id       uuid not null references public.profiles(id) on delete cascade,
  body            text not null check (char_length(btrim(body)) between 1 and 2000),
  read_at         timestamptz,                              -- set when the recipient reads it
  created_at      timestamptz not null default now()
);
create index dm_convo_time_idx on public.direct_messages (conversation_id, created_at);

-- ===== BLOCKS (DM safety) =====
create table public.blocks (
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id)
);

-- ===== DM REPORTS (admin-reviewed; no auto-hide since DMs are 1:1) =====
create table public.dm_reports (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  reporter_id     uuid not null references public.profiles(id) on delete cascade,
  reason          report_reason not null,
  note            text check (note is null or char_length(note) <= 300),
  created_at      timestamptz not null default now()
);

-- ===== ORDERS (one per closed listing that had a winner) =====
create table public.orders (
  id                       uuid primary key default gen_random_uuid(),
  listing_id               uuid not null unique references public.listings(id) on delete cascade,
  buyer_id                 uuid not null references public.profiles(id),
  seller_id                uuid not null references public.profiles(id),
  hammer_price             numeric(12,2) not null check (hammer_price > 0),
  amount_charged           numeric(12,2) not null,   -- hammer + buyer's premium
  platform_fee             numeric(12,2) not null,   -- buyer's premium + seller commission
  seller_payout            numeric(12,2) not null,   -- amount_charged − platform_fee
  status                   order_status not null default 'pending_payment',
  stripe_payment_intent_id text,
  stripe_transfer_id       text,
  delivery_confirmed_at    timestamptz,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);
create index orders_buyer_idx  on public.orders (buyer_id,  created_at desc);
create index orders_seller_idx on public.orders (seller_id, created_at desc);
create index orders_status_idx on public.orders (status);

-- keep orders.updated_at honest on every server write
create or replace function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end; $$;
create trigger orders_touch before update on public.orders
  for each row execute function public.touch_updated_at();

-- ===== STRIPE EVENTS (idempotent webhook log) =====
create table public.stripe_events (
  id           text primary key,        -- Stripe event id; PK makes webhook processing idempotent
  type         text not null,
  processed_at timestamptz not null default now()
);

-- ============================================================
-- LISTING CREATION TRIGGERS
-- current_price starts at starting_price and the 'open' chart
-- point is recorded atomically, no matter what the client sends.
-- ============================================================
create or replace function public.listing_set_open_price()
returns trigger language plpgsql as $$
begin
  new.current_price := new.starting_price;
  return new;
end; $$;
create trigger listings_before_insert before insert on public.listings
  for each row execute function public.listing_set_open_price();

create or replace function public.listing_record_open_point()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.price_history (listing_id, price, event_type)
  values (new.id, new.starting_price, 'open');
  return new;
end; $$;
create trigger listings_after_insert after insert on public.listings
  for each row execute function public.listing_record_open_point();

-- ============================================================
-- HELPER: block check that works under RLS
-- (blocks rows are only visible to their creator, so policies use
-- this definer function to see blocks in BOTH directions.)
-- ============================================================
create or replace function public.users_blocked(a uuid, b uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.blocks
    where (blocker_id = a and blocked_id = b)
       or (blocker_id = b and blocked_id = a)
  );
$$;

-- ============================================================
-- THE ATOMIC ENGINE (security-definer RPCs; the ONLY write path
-- for bids, current_price, price_history, reports, conversations)
-- ============================================================

-- ===== place_bid =====
create or replace function public.place_bid(p_listing_id uuid, p_amount numeric)
returns public.listings language plpgsql security definer set search_path = public as $$
declare
  v_listing listings;
  v_uid uuid := auth.uid();
  v_has_bid boolean;
  c_max_bid constant numeric := 10000.00;  -- MAX_BID_AMOUNT: a saved card is not proof of funds
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;

  -- LOCK the listing to serialize concurrent bids
  select * into v_listing from listings where id = p_listing_id for update;
  if not found then raise exception 'Listing not found'; end if;
  if v_listing.status <> 'active' then raise exception 'Listing is not active'; end if;
  if now() >= v_listing.ends_at then raise exception 'Auction has ended'; end if;
  if v_listing.seller_id = v_uid then raise exception 'You cannot bid on your own listing'; end if;
  if p_amount > c_max_bid then
    raise exception 'Bid exceeds the per-bid maximum';
  end if;
  if not coalesce((select has_payment_method from payment_profiles where id = v_uid), false) then
    raise exception 'Add a payment method before bidding';
  end if;

  select exists(select 1 from bids where listing_id = p_listing_id and status = 'active')
    into v_has_bid;

  if v_has_bid then
    if p_amount < v_listing.current_price + v_listing.min_increment then
      raise exception 'Bid must beat the current price by at least the minimum increment';
    end if;
  else
    if p_amount < v_listing.starting_price then
      raise exception 'First bid must be at least the starting price';
    end if;
  end if;

  -- raise this buyer's existing active bid, or insert a new one
  update bids set amount = p_amount, created_at = now()
    where listing_id = p_listing_id and bidder_id = v_uid and status = 'active';
  if not found then
    insert into bids (listing_id, bidder_id, amount, status)
    values (p_listing_id, v_uid, p_amount, 'active');
  end if;

  update listings set current_price = p_amount where id = p_listing_id returning * into v_listing;
  insert into price_history (listing_id, price, event_type) values (p_listing_id, p_amount, 'bid_placed');
  return v_listing;
end; $$;

-- ===== withdraw_bid =====
create or replace function public.withdraw_bid(p_listing_id uuid)
returns public.listings language plpgsql security definer set search_path = public as $$
declare
  v_listing listings;
  v_uid uuid := auth.uid();
  v_new_price numeric(12,2);
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;

  select * into v_listing from listings where id = p_listing_id for update;
  if not found then raise exception 'Listing not found'; end if;
  if v_listing.status <> 'active' then raise exception 'Listing is not active'; end if;

  update bids set status = 'withdrawn', withdrawn_at = now()
    where listing_id = p_listing_id and bidder_id = v_uid and status = 'active';
  if not found then raise exception 'You have no active bid to withdraw'; end if;

  -- price falls to the highest remaining active bid, else the starting price
  select coalesce(max(amount), v_listing.starting_price) into v_new_price
    from bids where listing_id = p_listing_id and status = 'active';

  update listings set current_price = v_new_price where id = p_listing_id returning * into v_listing;
  insert into price_history (listing_id, price, event_type) values (p_listing_id, v_new_price, 'bid_withdrawn');
  return v_listing;
end; $$;

-- ===== close_listing =====
-- Highest active bid wins. Seller may close early; anyone/cron may close after
-- ends_at. With a winner it atomically creates the orders row (pending_payment).
create or replace function public.close_listing(p_listing_id uuid)
returns public.listings language plpgsql security definer set search_path = public as $$
declare
  v_listing listings;
  v_top bids;
  c_buyer_premium constant numeric := 0.05;  -- 5% on top of the hammer (buyer pays)
  c_seller_comm   constant numeric := 0.05;  -- 5% off the hammer (seller's cut)
  c_min_fee       constant numeric := 1.00;  -- floor so tiny sales never run at a loss
  v_amount_charged numeric(12,2);
  v_platform_fee   numeric(12,2);
  v_seller_payout  numeric(12,2);
begin
  select * into v_listing from listings where id = p_listing_id for update;
  if not found then raise exception 'Listing not found'; end if;
  if v_listing.status = 'closed' then return v_listing; end if;

  -- Only the owner may close early. auth.uid() is NULL for the service-role
  -- worker (and anon); IS DISTINCT FROM handles NULL correctly, so before
  -- ends_at everyone except the owner is rejected.
  if auth.uid() is distinct from v_listing.seller_id
     and now() < v_listing.ends_at then
    raise exception 'Not allowed to close this listing yet';
  end if;

  select * into v_top from bids
    where listing_id = p_listing_id and status = 'active'
    order by amount desc, created_at asc limit 1;

  if found then
    update bids set status = 'won' where id = v_top.id;
    update bids set status = 'lost'
      where listing_id = p_listing_id and status = 'active' and id <> v_top.id;

    v_amount_charged := round(v_top.amount * (1 + c_buyer_premium), 2);
    v_platform_fee   := greatest(round(v_top.amount * (c_buyer_premium + c_seller_comm), 2), c_min_fee);
    v_seller_payout  := v_amount_charged - v_platform_fee;

    insert into orders (listing_id, buyer_id, seller_id, hammer_price,
                        amount_charged, platform_fee, seller_payout, status)
    values (p_listing_id, v_top.bidder_id, v_listing.seller_id, v_top.amount,
            v_amount_charged, v_platform_fee, v_seller_payout, 'pending_payment');
  end if;

  update listings set status = 'closed' where id = p_listing_id returning * into v_listing;
  insert into price_history (listing_id, price, event_type) values (p_listing_id, v_listing.current_price, 'close');
  return v_listing;
end; $$;

-- ===== report_message =====
-- Records a report and auto-hides a message once REPORT_THRESHOLD (3)
-- distinct users have reported it.
create or replace function public.report_message(p_message_id uuid, p_reason report_reason, p_note text default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_author uuid;
  v_count int;
  v_threshold constant int := 3;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;

  select user_id into v_author from messages where id = p_message_id;
  if not found then raise exception 'Message not found'; end if;
  if v_author = v_uid then raise exception 'You cannot report your own message'; end if;

  -- one report per user per message; duplicates are ignored, not errored
  insert into reports (message_id, reporter_id, reason, note)
  values (p_message_id, v_uid, p_reason, p_note)
  on conflict (message_id, reporter_id) do nothing;

  select count(*) into v_count from reports where message_id = p_message_id;
  if v_count >= v_threshold then
    update messages set hidden = true where id = p_message_id;  -- realtime UPDATE removes it for everyone
  end if;
end; $$;

-- ===== enable_selling =====
create or replace function public.enable_selling()
returns public.profiles language plpgsql security definer set search_path = public as $$
declare v_profile profiles;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  update profiles set is_seller = true where id = auth.uid() returning * into v_profile;
  return v_profile;
end; $$;

-- ===== get_or_create_conversation =====
create or replace function public.get_or_create_conversation(p_listing_id uuid)
returns public.conversations language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_listing listings;
  v_convo conversations;
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;

  select * into v_listing from listings where id = p_listing_id;
  if not found then raise exception 'Listing not found'; end if;
  if v_listing.seller_id = v_uid then raise exception 'You own this listing — buyers message you here'; end if;

  -- a block in either direction disables messaging
  if users_blocked(v_uid, v_listing.seller_id) then
    raise exception 'Messaging is unavailable between these users';
  end if;

  insert into conversations (listing_id, buyer_id, seller_id)
  values (p_listing_id, v_uid, v_listing.seller_id)
  on conflict (listing_id, buyer_id) do update set listing_id = excluded.listing_id  -- no-op to return the existing row
  returning * into v_convo;

  return v_convo;
end; $$;

-- ===== DM bump trigger =====
create or replace function public.bump_conversation() returns trigger language plpgsql as $$
begin
  update conversations set last_message_at = new.created_at where id = new.conversation_id;
  return new;
end; $$;
create trigger dm_bump after insert on public.direct_messages
  for each row execute function public.bump_conversation();

-- ============================================================
-- ROW-LEVEL SECURITY
-- ============================================================
alter table public.listings         enable row level security;
alter table public.bids             enable row level security;
alter table public.price_history    enable row level security;
alter table public.messages         enable row level security;
alter table public.reports          enable row level security;
alter table public.conversations    enable row level security;
alter table public.direct_messages  enable row level security;
alter table public.blocks           enable row level security;
alter table public.dm_reports       enable row level security;
alter table public.orders           enable row level security;
alter table public.stripe_events    enable row level security;

-- listings: active listings are public; the owner sees their own non-active
-- ones; past bidders keep access for won/lost history.
create policy listings_select on public.listings for select using (
  status = 'active'
  or seller_id = auth.uid()
  or exists (select 1 from public.bids b
             where b.listing_id = id and b.bidder_id = auth.uid())
);
-- insert: only a fully onboarded seller, and only as themselves
create policy listings_insert on public.listings for insert with check (
  seller_id = auth.uid()
  and exists (select 1 from public.profiles p
              where p.id = auth.uid() and p.is_seller)
  and exists (select 1 from public.payment_profiles pp
              where pp.id = auth.uid() and pp.payouts_enabled)
);
-- update/cancel: owner only, and only while the listing has never had a bid
create policy listings_update on public.listings for update using (
  seller_id = auth.uid()
  and not exists (select 1 from public.bids b where b.listing_id = id)
) with check (seller_id = auth.uid());

-- bids: public read (activity feed / chart); NO direct writes — RPCs only.
create policy bids_select on public.bids for select using (true);

-- price_history: public read; no client writes (RPC + triggers only).
create policy price_history_select on public.price_history for select using (true);

-- messages: public read (the chat query filters hidden = true); any signed-in
-- user may post EXCEPT the listing's owner; users delete only their own;
-- no client update (the hidden flip happens only inside report_message).
create policy messages_select on public.messages for select using (true);
create policy messages_insert on public.messages for insert with check (
  user_id = auth.uid()
  and hidden = false
  and auth.uid() <> (select l.seller_id from public.listings l where l.id = listing_id)
);
create policy messages_delete_own on public.messages for delete using (user_id = auth.uid());

-- reports: NO client access at all — reporting goes through report_message();
-- a future admin dashboard reads them with the service role.

-- conversations: participants only; created via get_or_create_conversation().
create policy conversations_select on public.conversations for select using (
  auth.uid() in (buyer_id, seller_id)
);
create policy conversations_update on public.conversations for update using (
  auth.uid() in (buyer_id, seller_id)
) with check (auth.uid() in (buyer_id, seller_id));

-- direct_messages: participants read; sender inserts (unless blocked);
-- only the recipient may update (column grant below limits that to read_at).
create policy dm_select on public.direct_messages for select using (
  exists (select 1 from public.conversations c
          where c.id = conversation_id and auth.uid() in (c.buyer_id, c.seller_id))
);
create policy dm_insert on public.direct_messages for insert with check (
  sender_id = auth.uid()
  and exists (select 1 from public.conversations c
              where c.id = conversation_id
                and auth.uid() in (c.buyer_id, c.seller_id)
                and not public.users_blocked(c.buyer_id, c.seller_id))
);
create policy dm_update_read on public.direct_messages for update using (
  sender_id <> auth.uid()
  and exists (select 1 from public.conversations c
              where c.id = conversation_id and auth.uid() in (c.buyer_id, c.seller_id))
) with check (sender_id <> auth.uid());

-- recipients can only touch read_at, nothing else
revoke update on public.direct_messages from anon, authenticated;
grant update (read_at) on public.direct_messages to authenticated;

-- blocks: a user manages only their own rows.
create policy blocks_select_own on public.blocks for select using (blocker_id = auth.uid());
create policy blocks_insert_own on public.blocks for insert with check (
  blocker_id = auth.uid() and blocked_id <> auth.uid()
);
create policy blocks_delete_own on public.blocks for delete using (blocker_id = auth.uid());

-- dm_reports: participants may file; no reads for regular users.
create policy dm_reports_insert on public.dm_reports for insert with check (
  reporter_id = auth.uid()
  and exists (select 1 from public.conversations c
              where c.id = conversation_id and auth.uid() in (c.buyer_id, c.seller_id))
);

-- orders: buyer or seller may read; NO client writes at all — orders are
-- created by close_listing() and updated only by the server.
create policy orders_select_own on public.orders for select using (
  auth.uid() in (buyer_id, seller_id)
);

-- stripe_events: no policies — service role only.

-- ============================================================
-- REALTIME
-- Publish only the tables the app actually subscribes to.
-- ============================================================
alter publication supabase_realtime add table
  public.listings,
  public.bids,
  public.price_history,
  public.messages,
  public.conversations,
  public.direct_messages,
  public.orders;
