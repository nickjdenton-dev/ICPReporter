# How to open a Lot Trace export on your computer

`lot-trace-export.zip` is **not a program**. It is a data dump (spreadsheets + JSON) of lots, ICP results, and Drive attachments. There is nothing to install or execute inside the zip.

## Fastest: Excel / Sheets

1. Right-click `lot-trace-export.zip` → **Extract All…** (Windows) or double-click it (Mac).
2. Open the folder. Double-click:
   - `results.csv` — every analytical result
   - `batches.csv` — one row per lot
   - `timeline.csv` — import / file history
   - `attachments.csv` — Google Drive links
   - `products.csv` — product catalog

Excel, Google Sheets, and Numbers all open `.csv` files.

## Better: this viewer (search lots, results, files)

The zip has no UI. This folder **is** the program.

**Windows:** double-click `open.bat`, then drop `lot-trace-export.zip` onto the page.

**Mac:** double-click `index.html` (or `open.command`), then drop the zip onto the page.

You can also drop `lot-trace-full-export.json` after unzipping. Chrome, Edge, or Safari work. You do not need Python, Node, or an installer.

Your lot data never leaves this computer — the page reads the file you drop and does not upload it.
