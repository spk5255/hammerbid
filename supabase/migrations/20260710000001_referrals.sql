-- Referral program: give $5, get $5 in bid credit.
--
-- This migration adds TRACKING: who referred whom, captured at signup from
-- the referred_by username the auth form stores in user metadata.
-- Credit application (offsetting the buyer's premium at settlement) lands
-- with the payments milestone — mark rows 'qualified' on first bid and
-- 'credited' once the discount is applied.

create table if not exists public.referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_id uuid not null references public.profiles(id) on delete cascade,
  -- unique: a person can only ever be referred once
  referred_id uuid not null unique references public.profiles(id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'qualified', 'credited')),
  created_at timestamptz not null default now(),
  qualified_at timestamptz,
  check (referrer_id <> referred_id)
);

create index if not exists referrals_referrer_idx on public.referrals (referrer_id);

alter table public.referrals enable row level security;

-- both sides may see the row; only the backend (service role / triggers)
-- writes them
create policy "participants read own referrals" on public.referrals
  for select using (auth.uid() = referrer_id or auth.uid() = referred_id);

-- Resolve the referred_by username from signup metadata into a referrals row.
-- Defensive by design: any failure is swallowed so signup never breaks.
create or replace function public.handle_referral()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  ref_username text;
  ref_profile uuid;
begin
  begin
    ref_username := new.raw_user_meta_data ->> 'referred_by';
    if ref_username is null or ref_username = '' then
      return new;
    end if;

    select id into ref_profile
    from public.profiles
    where username ilike ref_username
    limit 1;

    if ref_profile is null or ref_profile = new.id then
      return new;
    end if;

    -- cap: at most 20 credited-track referrals per referrer
    if (select count(*) from public.referrals where referrer_id = ref_profile) >= 20 then
      return new;
    end if;

    insert into public.referrals (referrer_id, referred_id)
    values (ref_profile, new.id)
    on conflict (referred_id) do nothing;
  exception when others then
    -- never block account creation over referral bookkeeping
    null;
  end;
  return new;
end;
$$;

-- 'zz_' prefix: same-event triggers on auth.users fire in name order, and the
-- profile row (created by the existing on_auth_user_created trigger) must
-- exist before the referrals FK references it.
drop trigger if exists zz_on_auth_user_referral on auth.users;
create trigger zz_on_auth_user_referral
  after insert on auth.users
  for each row execute function public.handle_referral();
