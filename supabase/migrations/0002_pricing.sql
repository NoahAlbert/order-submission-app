-- Applied on top of 0001 by the GitHub integration. Idempotent, so it lands
-- cleanly whether or not this was already run by hand in the SQL Editor.

-- The order form quotes a price before submitting, and the admin page edits the
-- numbers behind it. One row per priced aspect: `base` always applies, and the
-- row whose id matches the order's img_source_flag is added on top.
create table if not exists public.pricing (
  id text primary key,
  label text not null,
  per_sheet numeric not null default 0,
  per_deck numeric not null default 0,
  -- true = the quote is a floor ("from $X"), not a fixed price.
  is_minimum boolean not null default false,
  sort_order integer not null default 0,
  updated_at timestamptz not null default now()
);

-- Same posture as `orders`: no policies, so only the service_role key (the
-- Cloudflare Pages Functions) touches it. The public form reads these numbers
-- through GET /api/pricing, never from Supabase directly.
alter table public.pricing enable row level security;

insert into public.pricing (id, label, per_sheet, per_deck, is_minimum, sort_order) values
  ('base',          'Base printing',          1.25, 15, false, 0),
  ('scryfall',      'Scryfall images',        0,     0, false, 1),
  ('custom-frames', 'Custom Frames',          0.75, 10, false, 2),
  ('custom-art',    'Full Custom',            6.75, 20, true,  3),
  ('client',        'Client-provided images', 0,     0, false, 4)
on conflict (id) do nothing;
