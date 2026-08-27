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

-- Priced aspects behind the order form's quote generator and the admin page's
-- pricing editor. `base` always applies; the row whose id matches the order's
-- img_source_flag is added on top of it.
create table public.pricing (
  id text primary key,
  label text not null,
  per_sheet numeric not null default 0,
  per_deck numeric not null default 0,
  -- true = the quote is a floor ("from $X"), not a fixed price.
  is_minimum boolean not null default false,
  sort_order integer not null default 0,
  updated_at timestamptz not null default now()
);

-- Same posture as `orders`: no policies, so only the service_role key reaches
-- it. The public form reads these numbers through GET /api/pricing.
alter table public.pricing enable row level security;

insert into public.pricing (id, label, per_sheet, per_deck, is_minimum, sort_order) values
  ('base',          'Base printing',          1.25, 15, false, 0),
  ('scryfall',      'Scryfall images',        0,     0, false, 1),
  ('custom-frames', 'Custom Frames',          0.75, 10, false, 2),
  ('custom-art',    'Full Custom',            6.75, 20, true,  3),
  ('client',        'Client-provided images', 0,     0, false, 4)
on conflict (id) do nothing;
