-- Run this once in the Supabase project's SQL Editor (Dashboard > SQL Editor > New query > Run).

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text not null,
  email text,
  status text not null default 'new' check (status in ('new', 'wip', 'complete', 'delivered')),
  order_size integer not null,
  img_source_flag text not null check (img_source_flag in ('scryfall', 'custom-frames', 'custom-art', 'client')),
  img_source text,
  cardlist text not null,
  price_quote numeric,
  paid boolean not null default false,
  custom_requests text,
  frame_style text,
  card_images text,
  card_frame_styles text
);

-- RLS is enabled with no policies: only requests using the service_role key
-- (used server-side by the Cloudflare Pages Functions) can read/write this
-- table. The public/anon key has zero access, since clients never talk to
-- Supabase directly — only through our API.
alter table public.orders enable row level security;

-- Public-read bucket so uploaded files get plain public URLs (no signed URLs
-- needed). Uploads themselves go through the service_role key server-side,
-- so no storage RLS policies are needed either.
insert into storage.buckets (id, name, public)
values ('order-uploads', 'order-uploads', true)
on conflict (id) do nothing;
