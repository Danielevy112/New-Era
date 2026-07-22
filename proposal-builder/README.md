# New Era — Gift Package Proposal Builder

A lightweight dashboard for managing corporate gifting inquiries and turning them
into branded, printable price proposals in a few clicks. Product prices are stored
once in a catalog and flow automatically into every package and proposal, so you
never re-type a price.

## What it does

- **Product catalog** — your price list, with images, SKUs and categories.
  Import your existing spreadsheet as CSV, or add products by hand.
- **Packages** — reusable bundles of products (e.g. "Rosh Hashana Premium Box").
  Build one once, then drop it into any proposal.
- **Proposal builder** — pick a package and/or individual products for a specific
  company, add delivery / logistics / extras, apply a discount and tax/VAT.
  Totals recalculate live from the current catalog prices.
- **Inquiries dashboard** — every company request in one place, with statuses
  (draft → sent → accepted / declined) and a pipeline value.
- **Printable proposal** — a clean, branded page you open and save as PDF from the
  browser (⌘/Ctrl-P → Save as PDF). Includes your logo, the client's company name,
  itemised prices, extras, discount, tax and a validity date.

## Running it

```bash
cd proposal-builder
npm install
npm start
```

Then open http://localhost:3100

Data is stored in `proposal-builder/data/store.json` (created automatically, and
git-ignored). Back this file up to keep your catalog and proposals.

## Typical workflow

1. **Settings** — fill in your business name, logo URL, currency and default VAT.
2. **Products** — click *Import CSV* and paste your price spreadsheet (or upload
   the `.csv`). Expected columns: `name, sku, category, price, description, imageUrl`
   — only `name` is required and column order is auto-detected. `sample-products.csv`
   is included as a template.
3. **Packages** (optional) — group products you sell together into named bundles.
4. **New Proposal** — enter the company name, add a package or products, add
   delivery and any extras, then save. Prices come straight from the catalog.
5. Click the **🖨 printer icon** on the proposal to open the PDF-ready view and
   save/send it.

## Images from your website

Product and logo images are referenced by URL. Paste the image address from your
website (right-click an image → *Copy image address*) into the product's
*Image URL* field, and it appears in the catalog and on the printed proposal.

## Notes

- Prices are snapshotted onto a proposal's totals at view time from the live
  catalog, so updating a product price updates open drafts. Once you've sent a
  proposal, set its status to *Sent* to track it in the pipeline.
- No database or external service required — it's a single Node/Express process
  with a JSON file store, so it runs anywhere Node runs.
