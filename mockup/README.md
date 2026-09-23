# QR Billing — GST Billing Prototype (HTML mockup)

A clickable mockup of the **QR Billing** app for demo/approval **before** we build it in Flutter.
Pure HTML/CSS/JS, no build step. Data is saved to your browser (localStorage), so the demo keeps its state.

## Run it
Open `index.html` in any browser (Chrome/Edge). Keep internet on first load (QR + barcode libraries
are CDN scripts); everything else works offline. Deploy note: the 4 files also live in the repo **root**
for GitHub Pages → live at `https://ashokkumardeveloper.github.io/qr_billing/`.

Deep links: `#billing` `#scan` `#products` `#invoices` `#analytics` `#settings`.

## Screens
| Screen | What it shows |
|---|---|
| **New Bill** | **Classic table billing on one screen**: scan a barcode → adds instantly; or type a name → suggestions dropdown → click to add. Editable **number qty** (keyboard Tab/Enter), full-height table, customer details collapsed at the top (optional), and a sticky GST/total bar. |
| **Products** | Catalogue table — image, title, SKU, **barcode**, stock, MRP, selling, GST. Add / edit / delete. Each product has a **QR** (customer) and a **barcode** (billing). |
| **Invoices** | Every bill (incl. sample history); reopen to re-print or switch template. |
| **Analytics** | KPIs, **month-wise** + **date-wise** sales charts, day-wise numbers table, top products. Period filter. |
| **Settings** | Business details, tax rules (GST-inclusive toggle), and the invoice-format picker. |

## Features
1. **Classic single-screen billing** — scan a barcode (adds instantly) or type a name → **suggestions dropdown** → click to add. Line items show in a **table** with an editable **number qty** field (keyboard **Tab** between rows, **Enter** returns to the scan box, **Del** removes). The table fills the screen height and scrolls internally — the page doesn't.
2. **Barcode scanning** — every product has a barcode. A hardware scanner (e.g. **TVS**, USB/Bluetooth) works as a *keyboard-wedge*: it types the code and presses Enter, and the item is added. The cursor stays in the scan box; a stray keypress re-focuses it. Beep + status on each scan.
3. **QR + barcode per product, downloadable** — open a product's **label** (tap the QR in Products): shows the QR *and* barcode, with **Download QR** and **Download barcode** (PNG) plus **Print label**.
4. **Checkout → Cash / UPI → thermal receipt** — **Print receipt (F9)** opens a payment step: choose **Cash** (enter amount received → shows **change**) or **UPI**, then it commits the bill and prints the **80mm thermal** receipt (payment + change printed on it) and clears for the next customer.
5. **Sticky action bar** — never scrolls away; shows **Taxable · CGST · SGST (or IGST) · Total** and the Print button. (Hold and full-Invoice are on the keyboard — F6 / F8.)
6. **Multiple invoice formats** — Classic, Modern, Thermal 80mm; default in Settings, switchable live on any invoice.
7. **Business details + GST-inclusive toggle** in Settings (tax back-worked from price, or added on top).
8. **Reports & Analytics** — month-wise + date-wise sales with numbers (ships with ~5 months of sample history).
9. **Responsive** — sidebar on desktop, bottom nav on mobile; the action bar floats above the mobile nav.

## Keyboard shortcuts (native-app feel — press **?** in-app for the list)
| Key | Action |
|---|---|
| **F2** | Focus the scan box |
| **F4** | Customer details |
| **F6 / F7** | Hold bill / Resume last held |
| **F8** | Save invoice (chosen format) |
| **F9** | Checkout — Cash / UPI → print receipt |
| **Enter / ↑ ↓** | Add scanned or highlighted item / move suggestions |
| **Alt + 1…5** | Switch tabs |
| **Ctrl + P** | Print the open invoice · **Esc** close dialog |

## Files
- `index.html` — app shell + all screens
- `styles.css` — styling (warm ledger-paper + deep teal-green + terracotta)
- `app.js` — state, GST math, product CRUD, barcode scan/suggest, cart, QR + barcode, invoice templates, analytics, shortcuts
- `product-view.html` — the page a customer lands on after scanning a product **QR**

---

## Flutter build plan (after approval) — Android + Web + Windows

**Barcode scanning**
- **Hardware scanner (TVS / any USB or Bluetooth):** works as a **keyboard-wedge** on all three platforms — capture rapid key events ending in Enter (`HardwareKeyboard` / a focused hidden `TextField` / `RawKeyboardListener`). Same code path everywhere; this is the primary counter workflow.
- **Camera scanning (optional, Android/phone):** `mobile_scanner` (ML Kit) to scan with the device camera.
- **Windows:** USB/Bluetooth wedge scanner is the norm; camera scanning is optional.

**Barcode & QR generation / download**
- Render with `barcode_widget` (barcodes) and `qr_flutter` (QR). Export PNG via widget-to-image (`RenderRepaintBoundary.toImage`) → save with `file_saver`/`path_provider` (desktop/mobile) or a Blob download (web). Mirrors the mockup's *Download QR / Download barcode*.

**Thermal / receipt printing (80mm)**
- **Android:** ESC/POS over Bluetooth/USB — `blue_thermal_printer` or `flutter_pos_printer_platform` with `esc_pos_utils`.
- **Windows:** send ESC/POS to the USB/serial thermal printer via `flutter_pos_printer_platform` (or raw printing); or use the OS print dialog with an 80mm page.
- **Web:** `window.print()` with the 80mm CSS receipt (as in this mockup), or WebUSB/Web Serial for direct ESC/POS.
- Keep the current one-click flow: commit bill → render thermal template → send to printer.

**Keyboard shortcuts (native feel, esp. Windows):** map the same F-keys/Alt-number via Flutter `Shortcuts`/`Actions` + `CallbackShortcuts`.

**Shared logic to port:** GST math (inclusive/exclusive; CGST+SGST intra-state vs IGST inter-state by comparing customer *place of supply* to business *home state*), invoice numbering (prefix + sequence), amount-in-words (Indian), and the three invoice templates. Palette stays warm ledger-paper + deep teal-green + terracotta.

> This is a design prototype to lock the look and flow. No real data leaves the browser.
