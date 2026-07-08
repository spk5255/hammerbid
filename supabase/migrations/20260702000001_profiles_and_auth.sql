-- Milestone 2 — profiles, payment_profiles, and the atomic signup trigger.
-- Apply via the Supabase SQL editor (paste + run) or `supabase db push`.

-- ===== PROFILES (extends auth.users; PUBLICLY READABLE — safe columns only) =====
create table public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  username   text unique not null check (username ~ '^[A-Za-z0-9_]{3,20}$'),
  is_seller  boolean not null default false,  -- intends to sell; listing also requires payouts_enabled
  created_at timestamptz not null default now()
);

-- ===== PAYMENT PROFILES (PRIVATE; owner-read-only, server-write-only) =====
-- Never put Stripe IDs on the public profiles row. One row per user, created with the profile.
create table public.payment_profiles (
  id                 uuid primary key references public.profiles(id) on delete cascade,
  stripe_customer_id text,                            -- buyer side: charge a saved card
  has_payment_method boolean not null default false,  -- card on file (required to bid)
  terms_accepted_at  timestamptz,                     -- "bids are binding" consent
  stripe_account_id  text,                            -- seller side: Stripe Connect Express account
  payouts_enabled    boolean not null default false,  -- Connect onboarding complete (required to list)
  created_at         timestamptz not null default now()
);

-- ===== SIGNUP TRIGGER =====
-- Creates the profiles + payment_profiles rows in the same transaction as the
-- auth.users insert (reading raw_user_meta_data), so signup is atomic — no orphan users.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, username, is_seller)
  values (
    new.id,
    coalesce(nullif(btrim(new.raw_user_meta_data->>'username'), ''),
             'user_' || left(replace(new.id::text, '-', ''), 10)),
    coalesce((new.raw_user_meta_data->>'is_seller')::boolean, false)
  );
  insert into public.payment_profiles (id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ===== ROW-LEVEL SECURITY =====
alter table public.profiles enable row level security;
alter table public.payment_profiles enable row level security;

-- profiles: public read (holds only safe columns); a user writes only their own row.
create policy "profiles_select_all" on public.profiles
  for select using (true);
create policy "profiles_insert_own" on public.profiles
  for insert with check (auth.uid() = id);
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- payment_profiles: owner may read their own row only; NO client writes whatsoever —
-- only server endpoints / webhooks (service role) write here. No insert/update/delete
-- policies exist, so all client writes are rejected by RLS.
create policy "payment_profiles_select_own" on public.payment_profiles
  for select using (auth.uid() = id);
