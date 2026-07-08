-- §13 hardening: re-bid cooldown after a withdrawal.
-- After withdrawing a bid on a listing, a buyer must sit out
-- REBID_COOLDOWN (5 minutes) before placing a NEW bid on that listing.
-- Raising/adjusting a still-active bid is unaffected. This curbs
-- pump-and-withdraw games that free withdrawals + a standing book invite.
-- (Keep the constant in sync with REBID_COOLDOWN_MINUTES in lib/constants.ts.)

create or replace function public.place_bid(p_listing_id uuid, p_amount numeric)
returns public.listings language plpgsql security definer set search_path = public as $$
declare
  v_listing listings;
  v_uid uuid := auth.uid();
  v_book_top numeric(12,2);  -- highest ACTIVE bid not owned by the caller
  v_old_price numeric(12,2);
  v_new_price numeric(12,2);
  v_last_withdrawn timestamptz;
  c_max_bid constant numeric := 10000.00;          -- MAX_BID_AMOUNT (§6A)
  c_rebid_cooldown constant interval := interval '5 minutes';
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

  -- cooldown: recent withdrawal on this listing blocks NEW entries only
  -- (a buyer with a live bid is just adjusting it, not re-entering)
  if not exists (select 1 from bids
                 where listing_id = p_listing_id and bidder_id = v_uid
                   and status = 'active') then
    select max(withdrawn_at) into v_last_withdrawn
      from bids
      where listing_id = p_listing_id and bidder_id = v_uid
        and status = 'withdrawn';
    if v_last_withdrawn is not null
       and v_last_withdrawn > now() - c_rebid_cooldown then
      raise exception 'You withdrew a bid recently — you can bid again in % seconds',
        ceil(extract(epoch from (v_last_withdrawn + c_rebid_cooldown - now())));
    end if;
  end if;

  -- the floor applies to every bid, in the book or leading
  if p_amount < v_listing.starting_price then
    raise exception 'Bids must be at least the starting price';
  end if;

  select max(amount) into v_book_top
    from bids
    where listing_id = p_listing_id and status = 'active' and bidder_id <> v_uid;

  -- leadership changes still step by the full increment; at-or-below the
  -- rival top simply joins the book
  if v_book_top is not null
     and p_amount > v_book_top
     and p_amount < v_book_top + v_listing.min_increment then
    raise exception 'To take the lead, bid at least %',
      to_char(v_book_top + v_listing.min_increment, 'FM9999999990.00');
  end if;

  -- raise/adjust this buyer's existing active bid, or insert a new one
  update bids set amount = p_amount, created_at = now()
    where listing_id = p_listing_id and bidder_id = v_uid and status = 'active';
  if not found then
    insert into bids (listing_id, bidder_id, amount, status)
    values (p_listing_id, v_uid, p_amount, 'active');
  end if;

  -- the price is the top of the book; chart it only when it actually moves
  v_old_price := v_listing.current_price;
  select max(amount) into v_new_price
    from bids where listing_id = p_listing_id and status = 'active';

  if v_new_price is distinct from v_old_price then
    update listings set current_price = v_new_price where id = p_listing_id;
    insert into price_history (listing_id, price, event_type)
    values (p_listing_id, v_new_price,
            case when v_new_price > v_old_price then 'bid_placed'::price_event
                 else 'bid_withdrawn'::price_event end);
  end if;

  select * into v_listing from listings where id = p_listing_id;
  return v_listing;
end; $$;
