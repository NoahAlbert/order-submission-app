-- Run once in the Supabase SQL Editor against an existing project.
-- schema.sql already reflects these changes for a fresh one.

-- The order form no longer collects an email address.
alter table public.orders alter column email drop not null;

-- Frame styles picked in the form had nowhere to land: the order-level default,
-- the resolved per-line styles, and the Scryfall image URLs per line.
alter table public.orders add column if not exists frame_style text;
alter table public.orders add column if not exists card_images text;
alter table public.orders add column if not exists card_frame_styles text;
