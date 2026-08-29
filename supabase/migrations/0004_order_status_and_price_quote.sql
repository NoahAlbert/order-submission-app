-- Run once in the Supabase SQL Editor against an existing project.
-- schema.sql already reflects these changes for a fresh one.

-- Status now answers "did we take this order?" rather than "how far along is
-- it?" — the fulfillment stages live in confirmed_orders as their own flags.
-- The three old working values all meant the order had been taken, so they
-- fold into 'accepted'.
alter table public.orders drop constraint if exists orders_status_check;

update public.orders
  set status = 'accepted'
  where status in ('wip', 'complete', 'delivered');

alter table public.orders
  add constraint orders_status_check
  check (status in ('new', 'accepted', 'rejected'));

-- No schema change needed for the two other pieces of this round:
--   * confirming an order sets its status to 'accepted' (done in the API), and
--   * price_quote is now filled in at submission with the quote the client was
--     shown, instead of being left null for the admin page to type in.
-- Existing rows keep their null price_quote; only new orders carry a quote.
