-- Run once in the Supabase SQL Editor against an existing project.
-- schema.sql already reflects these changes for a fresh one.

-- How the finished cards should be sleeved, picked on the order form.
alter table public.orders
  add column if not exists sleeving text not null default 'none'
    check (sleeving in ('none', 'penny', 'colored'));

-- Two more priced aspects. Unlike the image-source rows these are additive
-- rather than alternatives, so a quote is now base + image source + sleeving.
-- Seeded as full-deck rates only: per-sheet sleeving is unpriced until someone
-- fills those numbers in from the admin page's Pricing panel.
insert into public.pricing (id, label, per_sheet, per_deck, is_minimum, sort_order) values
  ('sleeve-penny',   'Penny Sleeves',   0, 1.25, false, 5),
  ('sleeve-colored', 'Colored Sleeves', 0, 4,    false, 6)
on conflict (id) do nothing;

-- The fulfillment record, created once an order has been confirmed with the
-- client. Separate from `orders` so the intake record stays as submitted: this
-- table holds only what happens afterwards. order_id is the primary key, so
-- confirming the same order twice is a conflict rather than a duplicate.
create table if not exists public.confirmed_orders (
  order_id uuid primary key references public.orders(id) on delete cascade,
  confirmed_at timestamptz not null default now(),
  -- Seeded from the order's price_quote, then edited by hand as needed.
  confirmed_price numeric,
  paid boolean not null default false,
  printed boolean not null default false,
  -- Forced true for unsleeved orders, which have no sleeving step to wait on.
  cut_and_sleeved boolean not null default false,
  delivered boolean not null default false
);

-- Same posture as `orders` and `pricing`: no policies, so only the service_role
-- key (the Cloudflare Pages Functions) can reach it.
alter table public.confirmed_orders enable row level security;
