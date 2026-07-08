-- Milestone 3 fix — RLS alias-capture bug in the listings policies.
--
-- In the original policies the unqualified `id` inside the bids subquery
-- resolved to b.id (the bid's own id), not the listing's id, so:
--   • listings_update: the "no bids yet" guard never fired — an owner could
--     edit price/status even after bids existed (violates §12.10);
--   • listings_select: past bidders could never see closed listings they
--     bid on (dashboards would break after close).
-- Qualifying the column as listings.id fixes both. Found by the milestone 3
-- acceptance suite (owner direct-update attack unexpectedly succeeded).

drop policy listings_select on public.listings;
create policy listings_select on public.listings for select using (
  status = 'active'
  or seller_id = auth.uid()
  or exists (select 1 from public.bids b
             where b.listing_id = listings.id and b.bidder_id = auth.uid())
);

drop policy listings_update on public.listings;
create policy listings_update on public.listings for update using (
  seller_id = auth.uid()
  and not exists (select 1 from public.bids b where b.listing_id = listings.id)
) with check (seller_id = auth.uid());
