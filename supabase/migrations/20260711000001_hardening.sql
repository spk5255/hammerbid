-- Hardening pass from the July 2026 evaluation.
--
-- 1) CRITICAL: withdraw_bid must refuse ended auctions. Settlement flips
--    status to 'closed' on a slow cron, so lots sit "ended but active" for
--    hours — during which winners could dodge the binding-bid promise.
-- 2) handle_referral: validate the username shape server-side and match
--    exactly (ilike treated % and _ as wildcards → spoofable attribution),
--    and take an advisory lock so the 20-referral cap is atomic.
-- 3) messages_select: don't serve auto-hidden messages to clients that
--    omit the .eq('hidden', false) filter.

-- ===== 1. withdraw_bid: no withdrawals after the hammer =====
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
  -- bids are binding at close: once ends_at passes the book is frozen even
  -- if the settlement worker hasn't flipped status to 'closed' yet
  if now() >= v_listing.ends_at then raise exception 'Auction has ended — bids are binding at close'; end if;

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

-- ===== 2. handle_referral: server-side validation + exact match =====
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
    -- shape-check HERE, not just in the client: metadata is caller-controlled
    if ref_username is null or ref_username !~ '^[A-Za-z0-9_]{3,20}$' then
      return new;
    end if;

    -- exact (case-insensitive) match — never pattern matching on user input
    select id into ref_profile
    from public.profiles
    where lower(username) = lower(ref_username)
    limit 1;

    if ref_profile is null or ref_profile = new.id then
      return new;
    end if;

    -- serialize per-referrer so the cap check-then-insert is atomic
    perform pg_advisory_xact_lock(hashtext('referral:' || ref_profile::text));
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

-- ===== 3. messages: hidden rows only visible to their author =====
drop policy if exists messages_select on public.messages;
create policy messages_select on public.messages
  for select using (hidden = false or user_id = auth.uid());
