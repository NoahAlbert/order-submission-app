# Order Submission App

A dynamic form for clients to submit print orders, plus a password-gated
admin page to manage them. Hosted on Cloudflare Pages (free), backed by
Supabase (free Postgres + file storage).

## How it works

- `index.html` — the public order form. The image-upload section only
  appears when the client selects "I'm providing my own images."
- `admin.html` — password-gated table of all orders. Lets you edit `status`,
  `paid`, and `price_quote` inline; changes save immediately. Above the table,
  a **Pricing** editor sets the numbers the form quotes from; below it, a
  **Confirmed orders** table tracks the jobs whose price you've agreed.
- `functions/api/orders/index.js` — `GET` (list, admin-only) / `POST`
  (create, public) for `/api/orders`.
- `functions/api/orders/[id].js` — `PATCH` (admin-only) for
  `/api/orders/:id`.
- `functions/api/pricing/index.js` — `GET` (public, feeds the quote) / `PUT`
  (admin-only) for `/api/pricing`.
- `functions/api/confirmed-orders/index.js` — `GET` (list) / `POST` (promote an
  order) for `/api/confirmed-orders`, both admin-only.
- `functions/api/confirmed-orders/[id].js` — `PATCH` (admin-only) for
  `/api/confirmed-orders/:orderId`, keyed by the **order's** id.
- `functions/_lib.js` — shared Supabase client + admin-password check.
- `supabase/schema.sql` — the `orders`, `pricing` and `confirmed_orders` tables
  + `order-uploads` storage bucket definition (already applied to the live
  project).

## Confirmed orders

The orders table is the intake queue: everything a client submitted, as they
submitted it. Once you've talked to someone and agreed a price, **Confirm** on
their row promotes the order into `confirmed_orders` — a separate table holding
only what happens afterwards, so the original submission is never edited.

A confirmed order starts with its `confirmed_price` copied from the quote
(edit it inline from there) and four independent checkboxes: **Paid**,
**Printed**, **Cut and sleeved**, **Delivered**. The order stays visible in the
table above, with its Confirm button replaced by a "Confirmed" label.

An order submitted **unsleeved** has no sleeving step, so its *Cut and sleeved*
box is ticked when the order is confirmed and shown greyed out. The API enforces
the same rule: `PATCH` refuses to unset that flag on an unsleeved order.

## Fields

| Column | Set by | Type | Notes |
|---|---|---|---|
| id | app | uuid | |
| created_at | app | timestamptz | auto |
| name | client | text | |
| email | client | text | |
| status | **you** | enum | `new` / `wip` / `complete` / `delivered`; starts at `new`, edited in the admin page |
| order_size | client | int | number of card slots — sheets x 8, or 104 for a full deck |
| img_source_flag | client | enum | `scryfall` / `custom-frames` / `custom-art` / `client` |
| img_source | app/client | text, nullable | Supabase Storage public URL if a file was uploaded, or the link the client pasted |
| cardlist | client | text | one line per physical card, line-aligned with `card_images` and `card_frame_styles` |
| sleeving | client | enum | `none` / `penny` / `colored`; defaults to `none`, priced into the quote |
| price_quote | **you** | numeric, nullable | starts blank, edited in the admin page |
| paid | **you** | bool | starts `false`, edited in the admin page |
| custom_requests | client | text, nullable | free-form notes |

`status`, `price_quote`, and `paid` are intentionally not on the public form
— a client shouldn't be able to set their own price or mark an order paid.

`confirmed_orders` holds one row per confirmed order, keyed by the order's id:

| Column | Set by | Type | Notes |
|---|---|---|---|
| order_id | app | uuid | primary key, references `orders.id`; deleting the order deletes this |
| confirmed_at | app | timestamptz | auto |
| confirmed_price | **you** | numeric, nullable | seeded from the order's `price_quote`, then edited |
| paid | **you** | bool | starts `false` |
| printed | **you** | bool | starts `false` |
| cut_and_sleeved | **you** | bool | starts `true` for unsleeved orders, and locked there |
| delivered | **you** | bool | starts `false` |

## Quoting

The bottom of the order form, just above **Submit Order**, shows a running
estimate. It has no inputs of its own — it reads Order Size, Image Source and
Sleeving from the form above it, so it can never quote something different from
what gets submitted.

A quote is always three lines: the **base** rate, the row matching the chosen
image source, and the row matching the chosen sleeving. Each row carries a
per-sheet rate and a flat full-deck rate, and the order-size mode picks which
one applies (`N sheets × per_sheet`, or `per_deck` once for a Commander deck).
An aspect that costs nothing is still shown, as "Included" rather than $0.00.

A print sheet holds **8 cards** and a full deck is **13 sheets = 104 card
slots** — not the format's 100, because the sheet is the unit that actually
gets printed. The form checks the submitted card list against that number and
says so when they differ; it warns rather than blocks, since a short list just
leaves spare slots and an over-full one is fixed by adding a sheet.

| Aspect | Per sheet | Full deck | Quoted total |
|---|---|---|---|
| Base printing | $1.25 | $15.00 | applies to every order |
| Scryfall images | $0.00 | $0.00 | base alone — $1.25/sheet, $15.00/deck |
| Custom Frames | $0.75 | $10.00 | $2.00/sheet, $25.00/deck |
| Full Custom | $6.75 | $20.00 | from $8.00/sheet, from $35.00/deck |
| Client-provided images | $0.00 | $0.00 | base alone — $1.25/sheet, $15.00/deck |

A row flagged **minimum** makes its quote a floor: the form shows "from $X"
and explains that the final price depends on the work involved. Full Custom is
the only one seeded that way.

**Sleeving** is priced the same way but added on top rather than chosen
instead of a source, so a quote is base + image source + sleeving:

| Sleeving | Per sheet | Full deck |
| --- | --- | --- |
| Unsleeved | — | — |
| Penny Sleeves | $0.00 | $1.25 |
| Colored Sleeves | $0.00 | $4.00 |

Unsleeved has no `pricing` row: it is free by definition. The per-sheet rates
are seeded at $0, so by-the-sheet orders add nothing for sleeving until you
fill those two numbers in from the Pricing panel.

Every one of those numbers — including the minimum flag — is edited in the
admin page's Pricing panel and stored in the `pricing` table; nothing is
hardcoded server-side. `index.html` does carry a `DEFAULT_PRICING` copy of the
seeded values, used only as a fallback when `/api/pricing` can't be reached, so
the quote degrades to a sensible number instead of an empty box. Update it if
you change the seeds and want the offline fallback to stay honest.

The quote is an estimate shown to the client; it is **not** written to the
order. `price_quote` stays yours to fill in from the admin table.

## Local development

1. `npm install`
2. Copy the three secrets into a `.dev.vars` file (gitignored, never
   committed) in the repo root:
   ```
   SUPABASE_URL=...
   SUPABASE_SERVICE_ROLE_KEY=...
   ADMIN_PASSWORD=...
   ```
   Find `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in the Supabase
   dashboard under Project Settings > API (use the `service_role` secret
   key, not `anon`).
3. `npm run dev` — runs `wrangler pages dev`, serving the site + API on
   `http://127.0.0.1:8788`.

## Deploying

Deploys are manual via the Cloudflare CLI (no GitHub auto-deploy is wired
up — see note below):

```
npx wrangler pages deploy . --project-name order-submission-app
```

This uploads the current working directory (frontend + Functions) as a new
production deployment.

**Note on auto-deploy**: Cloudflare Pages *can* auto-deploy on every
`git push` if you connect this GitHub repo in the Cloudflare dashboard
(Pages project > Settings > Builds > connect to Git — requires installing
the Cloudflare Pages GitHub App, a one-time browser step). Without that,
use the `wrangler pages deploy` command above after pushing.

## Supabase setup

**Run `supabase/migrations/0003_sleeving_and_confirmed_orders.sql` in the live
project's SQL Editor once.** It adds the `sleeving` column to `orders`, the two
sleeving rows to `pricing`, and the `confirmed_orders` table. Until you do,
submitting an order fails (the form now sends `sleeving`), and the admin page's
Confirmed orders table won't load.

Migrations are cumulative and each is safe to re-run; if a project is further
behind, apply the earlier files in `supabase/migrations/` in order first.

### Recreating from scratch (already done for the live project)

If you ever need to recreate this from scratch (e.g. a new Supabase
project): create the project, open SQL Editor, paste in and run
`supabase/schema.sql`, then grab the Project URL and `service_role` key from
Project Settings > API and set them as Cloudflare Pages secrets:

```
npx wrangler pages secret put SUPABASE_URL --project-name order-submission-app
npx wrangler pages secret put SUPABASE_SERVICE_ROLE_KEY --project-name order-submission-app
npx wrangler pages secret put ADMIN_PASSWORD --project-name order-submission-app
```

## Notes / limits

- Direct file uploads are capped client-side at ~25MB. For anything bigger,
  the form's link field lets the client paste a Drive/Dropbox/WeTransfer
  link instead.
- The `order-uploads` Supabase Storage bucket is public-read, so uploaded
  files get plain URLs with no signing needed. Row-level security is
  enabled on the `orders` table with no policies — only server-side code
  using the `service_role` key (the Cloudflare Functions) can read/write it;
  the `anon` key has no access.
- Admin auth is a single shared password (no per-user accounts), checked
  server-side and sent as `Authorization: Bearer <password>`. Kept in
  `sessionStorage` client-side, so it clears when the admin tab closes.
- This replaces an earlier Google Sheets/Apps Script version of this app.
  That Sheet still has whatever historical rows it had; nothing here reads
  from or writes to it anymore, and no migration was done automatically.
