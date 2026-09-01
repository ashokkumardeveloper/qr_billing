# QR Billing — GST Billing Prototype (HTML mockup)

A clickable mockup of the **QR Billing** app for demo/approval **before** we build it in Flutter.
Pure HTML/CSS/JS, no build step. Data is saved to your browser (localStorage), so the demo keeps its state.

## Run it
Just open `index.html` in any browser (Chrome/Edge recommended).
For QR codes to load, keep an internet connection on first load (the QR library is a CDN script);
everything else works offline.

## Screens
| Screen | What it shows |
|---|---|
| **New Bill** | Product picker (search + category chips) on the left, live **GST cart** on the right with CGST/SGST or IGST split, customer details, and **Generate & Print Invoice**. |
| **Products** | Catalogue table — image, title, SKU, stock, MRP, selling price, GST, and a **QR code** per product. Add / edit / delete. |
| **Invoices** | Every bill (incl. sample history); reopen to re-print or switch template. Search + view. |
| **Analytics** | **Sales reports** — KPIs (sales, invoices, avg bill, GST collected), **month-wise** bar chart, **date-wise** daily chart + a day-wise numbers table, and top products. Period filter: Last 30 days / This month / This year / All time. |
| **Settings** | Business details, **tax rules**, and the **invoice format** picker. |

## The features you asked for
1. **Select products → print a GST invoice.** Add items to the bill; the invoice prints with full GST breakup, amount in words, and business + customer details. Uses `window.print()` → print or *Save as PDF*.
2. **Business details in Settings** — name, GSTIN, address, logo, prefix, footer/terms. Printed on every invoice.
3. **Multiple invoice formats** — **Classic**, **Modern**, and **Thermal 80mm**. Pick a default in Settings; you can also switch format live on any invoice.
4. **Admin adds products** — image (URL or upload), title, SKU *(optional)*, stock *(optional)*, MRP, selling price, GST.
5. **QR code per product** — scanning opens a clean product page showing **image, title, selling price & MRP**. Tap the QR (or *Preview scan*) in the Products table to see exactly what the customer sees (`product-view.html`).
6. **GST-inclusive toggle** — Settings › *Selling prices include GST*. ON = tax back-worked out of the price; OFF = tax added at checkout. Affects the cart math and the QR product page.
7. **Responsive** — sidebar on desktop/tablet, bottom nav on mobile; the billing screen stacks the cart below the picker on small screens.
8. **Reports & Analytics** — month-wise and date-wise sales with numbers (see Analytics tab). *The app ships with ~5 months of sample sales history so the reports look real on first open; real bills add to it.*

## Files
- `index.html` — app shell + the four screens
- `styles.css` — all styling (warm ledger-paper + deep teal-green + terracotta)
- `app.js` — state, GST math, product CRUD, cart, QR generation, invoice templates
- `product-view.html` — the page a customer lands on after scanning a product QR

## Notes for the Flutter build (after approval)
- QR encodes a URL to a hosted product page. In production, host `product-view.html` (or a Flutter web route) so real phone scans open it. In this local mockup, *Preview scan* opens it directly.
- GST split (CGST+SGST vs IGST) is decided by comparing the customer's **place of supply** to the business **home state**.
- Invoice numbering auto-increments from the prefix + sequence in Settings.

> This is a design prototype to lock the look and flow. No real data leaves the browser.
