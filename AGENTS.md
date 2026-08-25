# ICP Reporter

ICP Reporter is a single-file, client-side Progressive Web App for a chemistry lab. A user
drops or pastes raw ICP‑OES instrument data (an `.xlsx` file, or cells copied from ICP Expert)
and the app parses it and renders a formatted analytical report (macro nutrients, micro
analytes, and heavy‑metal qualification), which can be exported and committed to a shared
"tracker" workbook.

Everything runs in the browser. `index.html` is a ~1.8 MB self‑contained file with the
SheetJS (`xlsx`) library inlined. `sw.js` is the service worker and `manifest.json`/`icon-*.png`
make it an installable PWA. `.nojekyll` indicates it is deployed as a static site (GitHub Pages).

## Cursor Cloud specific instructions

### Running the app (no build, no dependencies)
There is no package manager, build step, bundler, or backend. "Development" just means serving
the static files over HTTP. From the repo root:

```
python3 -m http.server 8000
```

Then open `http://localhost:8000/index.html`. `python3` is preinstalled; nothing needs to be
installed to run the app. There are no automated tests, linters, or build commands in this repo —
testing is manual in the browser.

Note: the service worker (`sw.js`) is network‑first for the app document and cache‑first for
icons, and it deletes caches from other versions on activate. If you edit `index.html` and don't
see changes, hard‑reload (or use an Incognito window / DevTools "Update on reload").

### Getting past the license / login gates for local testing (important, non‑obvious)
On load the app shows a full‑screen **license activation** gate. The key is an ECDSA‑signed
string verified against a public key baked into `index.html` (`startLicenseGate` /
`verifyLicenseString`), so a valid key cannot be produced without the private signing key, which
is not in this repo or environment. Do **not** modify or weaken the license code. For local UI
testing, dismiss the overlays from the DevTools console:

```js
localStorage.setItem('icpTermsAccepted', new Date().toISOString());
document.getElementById('licModal').style.display = 'none';
document.getElementById('loginModal').style.display = 'none';
```

The app underneath is fully functional (parsing and report generation are not otherwise gated).
Where a real login is needed, a built‑in failsafe admin account exists: username `admin`,
password `password` (`verifyCreds`). Admin‑only features (master template, user management) use
this. If the user wants the genuine gated flow tested, they must supply a valid license key.

### Feeding test data (hello‑world)
Fresh browser state starts with an **empty sample‑type catalog**, so any sample will show an
`ERR-UNKNOWN-TYPE` warning badge and fall back to default P₂O₅/K₂O analytes — this is expected
and still generates a full report. The parser needs a header row containing `Solution Label`,
element columns like `P 213.618 nm`, and sample rows bracketed between a `Preparation Blank` row
and a `Continuing Calibration Blank` row.

Two easy ways to test the parse → report pipeline:
- **Paste** (no file): use "Paste from instrument…", or right‑click/Ctrl+V on the drop zone, with
  tab‑ or comma‑separated rows.
- **`.xlsx` file**: click the drop zone to open the file picker. To generate a valid sample file,
  `openpyxl` is available (`pip install openpyxl`); build a sheet whose first row is
  `Solution Label, P 213.618 nm, K 766.491 nm, As 188.980 nm, Cd 214.439 nm, Pb 220.353 nm, Hg 194.164 nm, Timestamp`,
  a `Preparation Blank` row, a data row (e.g. label `12345 Example` with elemental values), and a
  `Continuing Calibration Blank` row. Raw values are elemental % and are converted for display
  (P ×2.2914 → P₂O₅, K ×1.2046 → K₂O).
