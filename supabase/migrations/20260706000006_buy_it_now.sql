-- Buy It Now: sellers may set an optional instant-purchase price on a
-- listing. A buyer with a card on file can win instantly at that price —
-- the RPC atomically records the winning bid, closes the auction, and
-- creates the order with the same fee math as close_listing. The option
-- disappears once bidding reaches the Buy Now price.

alter table public.listings add column buy_now_price numeric(12,2)
  check (buy_now_price is null or buy_now_price >= starting_price);

create or replace function public.buy_now(p_listing_id uuid)
returns public.listings language plpgsql security definer set search_path = public as $$
declare
  v_listing listings;
  v_uid uuid := auth.uid();
  v_bid_id uuid;
  c_buyer_premium constant numeric := 0.05;  -- keep in sync with close_listing
  c_seller_comm   constant numeric := 0.05;
  c_min_fee       constant numeric := 1.00;
  v_amount_charged numeric(12,2);
  v_platform_fee   numeric(12,2);
  v_seller_payout  numeric(12,2);
begin
  if v_uid is null then raise exception 'Not authenticated'; end if;

  select * into v_listing from listings where id = p_listing_id for update;
  if not found then raise exception 'Listing not found'; end if;
  if v_listing.status <> 'active' then raise exception 'Listing is not active'; end if;
  if now() >= v_listing.ends_at then raise exception 'Auction has ended'; end if;
  if v_listing.seller_id = v_uid then raise exception 'You cannot buy your own listing'; end if;
  if v_listing.buy_now_price is null then
    raise exception 'This listing has no Buy Now price';
  end if;
  if not coalesce((select has_payment_method from payment_profiles where id = v_uid), false) then
    raise exception 'Add a payment method before buying';
  end if;
  if exists (select 1 from bids
             where listing_id = p_listing_id and status = 'active'
               and amount >= v_listing.buy_now_price) then
    raise exception 'Bidding has already reached the Buy Now price';
  end if;

  -- the buyer's bid becomes the winning bid at the Buy Now price
  update bids set amount = v_listing.buy_now_price, created_at = now()
    where listing_id = p_listing_id and bidder_id = v_uid and status = 'active';
  if not found then
    insert into bids (listing_id, bidder_id, amount, status)
    values (p_listing_id, v_uid, v_listing.buy_now_price, 'active');
  end if;

  select id into v_bid_id from bids
    where listing_id = p_listing_id and bidder_id = v_uid and status = 'active';

  update bids set status = 'won' where id = v_bid_id;
  update bids set status = 'lost'
    where listing_id = p_listing_id and status = 'active' and id <> v_bid_id;

  v_amount_charged := round(v_listing.buy_now_price * (1 + c_buyer_premium), 2);
  v_platform_fee   := greatest(
    round(v_listing.buy_now_price * (c_buyer_premium + c_seller_comm), 2),
    c_min_fee);
  v_seller_payout  := v_amount_charged - v_platform_fee;

  insert into orders (listing_id, buyer_id, seller_id, hammer_price,
                      amount_charged, platform_fee, seller_payout, status)
  values (p_listing_id, v_uid, v_listing.seller_id, v_listing.buy_now_price,
          v_amount_charged, v_platform_fee, v_seller_payout, 'pending_payment');

  update listings set current_price = v_listing.buy_now_price, status = 'closed'
    where id = p_listing_id returning * into v_listing;

  insert into price_history (listing_id, price, event_type)
  values (p_listing_id, v_listing.current_price, 'bid_placed');
  insert into price_history (listing_id, price, event_type)
  values (p_listing_id, v_listing.current_price, 'close');

  return v_listing;
end; $$;
