# Order Submission App

A static form for clients to submit print orders. Submissions land as rows in
a Google Sheet, which doubles as your admin table — you manage `status`,
`price_quote`, and `paid` by editing the sheet directly.

## How it works

- `index.html` — the public order form (name, email, order size, image
  source, card list, custom requests). Optionally uploads a zip of images.
- `apps-script.gs` — code that runs inside Google Sheets. On each submission
  it appends a row and, if a file was uploaded, saves it to a Drive folder
  and stores the file link in the `Img Source` column.

## Fields

| Column | Set by | Type | Notes |
|---|---|---|---|
| Timestamp | app | datetime | auto |
| Name | client | text | |
| Email | client | text | |
| Status | **you** | enum | `new` / `wip` / `complete` / `delivered` — set by the app to `new` on submit, you change it as the order progresses |
| Order Size | client | int | number of cards |
| Img Source Flag | client | enum | `scryfall` / `custom-frames` / `custom-art` / `client` |
| Img Source | app/client | text | Drive link if a file was uploaded, or the link the client pasted; blank if neither |
| Cardlist | client | multi-line text | one card per line |
| Price Quote | **you** | float | left blank on submit, you fill in |
| Paid | **you** | bool | left unchecked on submit, you check off once paid |
| Custom Requests | client | multi-line text | free-form notes, not tied to specific cardlist lines |

`Status`, `Price Quote`, and `Paid` are intentionally not on the public form —
a client shouldn't be able to set their own price or mark an order paid.

## Setup

### 1. Create the Google Sheet

1. Go to https://sheets.google.com and create a new spreadsheet.
2. Add this exact header row (order matters — it must match `apps-script.gs`):
   ```
   Timestamp | Name | Email | Status | Order Size | Img Source Flag | Img Source | Cardlist | Price Quote | Paid | Custom Requests
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
  link field lets the client paste a Drive/Dropbox/WeTransfer link instead.
- If you ever create a **new** Apps Script deployment (rather than editing
  the existing one), the Web app URL changes and `index.html` needs updating.
  Use **Manage deployments > Edit > New version** to keep the same URL.
- To add more fields, add the input in `index.html`, add it to the `data`
  object in the submit handler, and add a matching column + `appendRow` entry
  in `apps-script.gs`.
