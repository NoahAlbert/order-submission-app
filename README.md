# Order Submission App

A dynamic form for clients to submit print orders, plus a password-gated
admin page to manage them. Hosted on Cloudflare Pages (free), backed by
Supabase (free Postgres + file storage).

## How it works

- `index.html` — the public order form. The image-upload section only
  appears when the client selects "I'm providing my own images."
- `admin.html` — password-gated table of all orders. Lets you edit `status`,
  `paid`, and `price_quote` inline; changes save immediately.
- `functions/api/orders/index.js` — `GET` (list, admin-only) / `POST`
  (create, public) for `/api/orders`.
- `functions/api/orders/[id].js` — `PATCH` (admin-only) for
  `/api/orders/:id`.
- `functions/_lib.js` — shared Supabase client + admin-password check.
- `supabase/schema.sql` — the `orders` table + `order-uploads` storage
  bucket definition (already applied to the live project).

## Fields

| Column | Set by | Type | Notes |
|---|---|---|---|
| id | app | uuid | |
| created_at | app | timestamptz | auto |
| name | client | text | |
| email | client | text | |
| status | **you** | enum | `new` / `wip` / `complete` / `delivered`; starts at `new`, edited in the admin page |
| order_size | client | int | number of cards |
| img_source_flag | client | enum | `scryfall` / `custom-frames` / `custom-art` / `client` |
| img_source | app/client | text, nullable | Supabase Storage public URL if a file was uploaded, or the link the client pasted |
| cardlist | client | text | one card per line |
| price_quote | **you** | numeric, nullable | starts blank, edited in the admin page |
| paid | **you** | bool | starts `false`, edited in the admin page |
| custom_requests | client | text, nullable | free-form notes |

`status`, `price_quote`, and `paid` are intentionally not on the public form
— a client shouldn't be able to set their own price or mark an order paid.

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

## Supabase setup (already done for the live project)

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
