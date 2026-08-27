# Order Submission App

A static form for clients to submit print orders. Submissions land as rows in
a Google Sheet, which doubles as your admin table — you manage `status`,
`price_quote`, and `paid` by editing the sheet directly.

## How it works

- `index.html` — the public order form (name, order size, image source, card
  list, custom requests). Optionally uploads a zip of images. The card list has
  a **Look Up Cards** button that resolves every line against the Scryfall API
  and lets the client pick the exact printing of each card.
- `apps-script.gs` — code that runs inside Google Sheets. On each submission
  it appends a row and, if a file was uploaded, saves it to a Drive folder
  and stores the file link in the `Img Source` column.

## Theming

The form is **dark by default**, with a toggle beside the heading that switches
to light and remembers the choice in `localStorage`. Every colour is a CSS custom
property: the dark values live on `:root` and the light ones on
`:root[data-theme="light"]`, so adding or changing a colour means touching both
blocks. Defining dark on bare `:root` (rather than behind a media query) is what
stops the page flashing light before the script runs.

`color-scheme` is set alongside each palette so native widgets — `<select>`
dropdowns, scrollbars, the file-picker button — follow the theme as well.

## Fields

| Column | Set by | Type | Notes |
|---|---|---|---|
| Timestamp | app | datetime | auto |
| Name | client | text | |
| Status | **you** | enum | `new` / `wip` / `complete` / `delivered` — set by the app to `new` on submit, you change it as the order progresses |
| Order Size | client | int | number of cards; the client picks *Full Commander Deck* (always 100) or *Order by sheet* and enters a sheet count, which the form multiplies by 8 (one sheet = 8 cards) |
| Img Source Flag | client | enum | `scryfall` / `custom-frames` / `custom-art` / `client` |
| Frame Style | client | enum | slug of the chosen frame treatment (`extended`, `neon`, …), matching a file in `img/`; set when `Img Source Flag` is `custom-frames` or `custom-art`, blank otherwise |
| Img Source | app/client | text | Drive link if a file was uploaded, or the link the client pasted; blank if neither |
| Cardlist | client | multi-line text | one card per line; canonicalized to `4 Lightning Bolt (2XM) 129` once the client runs the lookup |
| Card Images | app | multi-line text | direct Scryfall image URL per line of `Cardlist`, same order; only populated when `Img Source Flag` is `scryfall` |
| Card Frame Styles | client | multi-line text | frame style slug per line of `Cardlist`, same order, every line resolved (cards using the order default repeat it); populated when `Img Source Flag` is `custom-frames` or `custom-art` |
| Price Quote | **you** | float | left blank on submit, you fill in |
| Paid | **you** | bool | left unchecked on submit, you check off once paid |
| Custom Requests | client | multi-line text | free-form notes, not tied to specific cardlist lines |

`Status`, `Price Quote`, and `Paid` are intentionally not on the public form —
a client shouldn't be able to set their own price or mark an order paid.

Image Source (`Img Source Flag`) also controls which parts of the form show:

| Image Source (label) | value | Frame Style | Image Files | Card List |
|---|---|---|---|---|
| Scryfall | `scryfall` | hidden | hidden | shown |
| Custom Frames | `custom-frames` | **shown** | hidden | shown |
| Full Custom | `custom-art` | **shown** | shown | shown |
| I'm providing my own images | `client` | hidden | shown | hidden |

Only `client` drops the card list — every other option still needs it so you
know what to print. `custom-art` ("Full Custom") shows both, since the client
supplies the art but you still need the list of cards it goes with.

## Frame styles

Choosing **Custom Frames** or **Full Custom** reveals a style picker: a grid of
thumbnails beside a large preview that follows both hover and selection. Picking
one is **required** before the order can be submitted.

Both sources get the identical frame selection — Full Custom supplies its own
art, but that art still gets printed in one of our frame treatments, so it needs
the same choice. In the code this is the `SOURCES_WITH_FRAMES` list; add a value
there and the picker, the per-card dropdown, the override notice, the submit
gate, and both frame columns all follow.

That choice is the **default for the order**, not a fixed decision for every
card. Once the card list is looked up, each card's panel — the one that opens
for choosing a printing — also carries a Frame Style dropdown, so a client can
give individual cards their own treatment. Its first option, "Use order
default", is how a card reverts.

Cards that deviate from the default are badged with their style in the grid;
cards following the default are left unbadged so the exceptions stand out. When
overrides exist, a notice above the grid counts them and offers a one-click
**Apply &lt;style&gt; to all** to flatten them. Changing the order-level style
afterwards *keeps* per-card overrides and only re-styles the untouched cards.

The `Card Frame Styles` column resolves every line, so a card following the
default records the default's slug rather than a blank — the column can be read
on its own without cross-referencing `Frame Style`. Re-running **Look Up Cards**
rebuilds the rows and therefore clears per-card overrides, the same way it
clears chosen printings.

The catalog is the `FRAME_STYLES` array in `index.html`, hardcoded because
there's no build step and a page opened over `file://` can't list a directory.
Each entry is `[slug, label]`, where the slug is both the value written to the
`Frame Style` column and the image filename — so `['neon', 'Neon']` renders
`img/neon.jpg`. **To add a style, drop the render in `img/` and add one line to
that array**; the two must stay in sync or the picker shows a broken image.

`img/Land/` holds five basic-land treatments that are deliberately not wired up
yet — they'd need a second selector, since a basic-land frame isn't meaningful
as a whole-deck choice.

The thumbnails are only built the first time Custom Frames is selected, since
`img/` totals ~11.7MB and most visitors never open the picker.

> `img/` is **not** covered by `.gitignore` but is currently untracked — commit
> it, or the picker will render broken images once the form is hosted.

## Card list syntax

The **Look Up Cards** button parses the pasted list, resolves each line against
[Scryfall](https://scryfall.com/docs/api), and stages the results into a grid
where each card can be swapped to any other printing. Accepted line formats:

```
4 Lightning Bolt (2XM) 129     Moxfield / Archidekt export — set code, optional collector number
2 Counterspell [MH2]           bracket style
3x Brainstorm                  bare name (quantity optional, `x` optional)
```

Lines with a set code resolve straight to that printing and are marked
**matched**. Lines without one fall back to Scryfall's default printing and are
marked **review** so the client knows to check them. Blank lines, `//` and `#`
comments, and section headers (`Deck`, `Sideboard`, …) are ignored.

The lookup is **required before submitting** when Image Source is `scryfall` or
`custom-frames`, since both need an exact printing to work from. The other two
sources submit the card list as typed.

## Setup

### 1. Create the Google Sheet

1. Go to https://sheets.google.com and create a new spreadsheet.
2. Add this exact header row (order matters — it must match `apps-script.gs`):
   ```
   Timestamp | Name | Status | Order Size | Img Source Flag | Frame Style | Img Source | Cardlist | Card Images | Card Frame Styles | Price Quote | Paid | Custom Requests
   ```
3. Recommended (not required, but makes the sheet nicer to work in):
   - Select the `Status` column > Data > Data validation > List of items:
     `new, wip, complete, delivered` (dropdown per cell).
   - Select the `Paid` column > Data > Data validation > Checkbox.

### 2. Add the script

1. Extensions > Apps Script.
2. Delete the placeholder code and paste in the contents of `apps-script.gs`.
3. Click **Deploy > New deployment**.
   - Type: **Web app**
   - Execute as: **Me**
   - Who has access: **Anyone**
4. Deploy, authorize the permissions it asks for (Sheets + Drive access —
   Drive is needed to store uploaded zip files), and copy the **Web app URL**
   (looks like `https://script.google.com/macros/s/XXXX/exec`).

Uploaded files are saved into a Drive folder named **"Order Submissions"**
(auto-created on first upload, in the Drive of whoever deployed the script).

### 3. Wire up the form

Open `index.html` and replace `PASTE_YOUR_APPS_SCRIPT_URL_HERE` with the Web
app URL from step 2.4.

### 4. Test locally

Open `index.html` directly in a browser and submit a test order (try both
with and without a file upload). Check that a new row appears in the sheet
and, if you uploaded a file, that the `Img Source` cell has a working Drive
link.

### 5. Host it for free

**GitHub Pages** (see repo setup — already in progress) or **Cloudflare
Pages** both work for this static file, same as before.

## Notes / limits

- Direct file uploads are capped client-side at ~25MB (Apps Script web app
  request bodies have a practical size ceiling, and base64 encoding adds
  ~33% overhead on top of the raw file size). For anything bigger, the form's
  link field lets the client paste a Drive/Dropbox/WeTransfer/Wormhole link
  instead. Note that Wormhole links expire (by default after a few days), so
  don't wait too long to pull the file before it's gone.
- If you ever create a **new** Apps Script deployment (rather than editing
  the existing one), the Web app URL changes and `index.html` needs updating.
  Use **Manage deployments > Edit > New version** to keep the same URL.
- To add more fields, add the input in `index.html`, add it to the `data`
  object in the submit handler, and add a matching column + `appendRow` entry
  in `apps-script.gs`.
