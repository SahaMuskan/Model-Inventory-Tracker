# CLAUDE.md

Guidance for Claude Code (and other contributors) working in this repository.

## What this is

A self-contained **Model Risk Management** tool: a model inventory with an
automatic risk-rating engine, a tier-driven validation schedule, a findings/issues
tracker, and a dashboard. Built for a **non-developer** end user — favour simplicity,
clear plain-English copy, and "it just works" over cleverness.

## Running it

This machine has **no system Node.js** — a portable Node LTS lives at
`%LOCALAPPDATA%\node-portable\node-v*-win-x64\`. To use node/npm in a shell,
prepend it to PATH first:

```powershell
$env:Path = "C:\Users\muskan.saha\AppData\Local\node-portable\node-v24.18.0-win-x64;" + $env:Path
```

- **Start (non-technical):** double-click `Start Model Tracker.bat` (auto-finds portable node, opens the browser).
- **Start (CLI):** `npm start` → open http://localhost:3000
- **Reset to sample data:** `npm run seed` (rebuilds `data/data.json` from the seed).
- **Install deps:** `npm install` (only dependency is `express`).

## Architecture

Single Express server serves both the JSON REST API and the static web UI.

```
server.js              Express app: mounts /api/* routers, serves /public, SPA fallback
src/
  riskEngine.js        SINGLE SOURCE OF TRUTH for scoring + validation logic
  seed.js              ~20 fictional models + 15 findings (buildSeedData())
  db.js                Loads/saves data/data.json (atomic write); CLI reset entry point
  csv.js               Dependency-free CSV parse/serialise (BOM-safe, Excel-friendly)
  routes/
    models.js          CRUD + GET export.csv / template.csv + POST import (upsert by id)
    findings.js        CRUD + GET export.csv / template.csv + POST import (upsert by id)
    settings.js        GET/PUT validation intervals + due-soon window
    dashboard.js       Aggregated stats for the dashboard
    methodology.js     Exposes the scoring scheme (weights, tiers, intervals)
tools/
  sync-from-inventory.mjs      Sample: map a bank inventory export -> import API
  sample-inventory-extract.csv Example input for the sync script
public/
  index.html           App shell (sidebar nav + content area)
  styles.css           All styling (CSS variables; no framework)
  js/
    api.js             fetch wrappers for the REST API
    ui.js              esc/format helpers, badges, toast, generic modal
    app.js             Hash router + all views + add/edit forms
data/data.json         User data (git-ignored; created on first run from seed)
METHODOLOGY.md         Plain-English explanation of the risk rating
```

Frontend is **vanilla ES modules** (no build step). Views are functions in `app.js`
that fetch data and render HTML strings into `#app`; a hash router dispatches on
`location.hash`.

## Key conventions & invariants

- **Risk is computed, never stored as an editable tier.** Users set the five factor
  scores (`materiality`, `complexity`, `reliance`, `regulatory`, `uncertainty`, each
  1–3); `computeRisk()` derives the weighted score and tier. Don't add a
  hand-entered tier field.
- **`riskEngine.js` is the single source of truth.** Weights, tier thresholds,
  validation intervals, and date math all live there. The UI's live tier-preview and
  the Methodology page read it via `/api/methodology` — do not duplicate the weights
  in the frontend. If you change the scheme, update `riskEngine.js` and `METHODOLOGY.md`
  together.
- **Weights** (sum to 1.0): materiality .30, regulatory .25, reliance .20,
  complexity .15, uncertainty .10. **Tiers** split the 1–3 range in equal thirds
  (≥2.33 → T1, ≥1.67 → T2, else T3). **Intervals**: T1 12mo, T2 24mo, T3 36mo (editable).
- **Dates** are `yyyy-mm-dd` strings, handled in UTC to avoid timezone drift.
- **Persistence:** every mutation calls `save()` (write-temp-then-rename). The whole
  store is one JSON file; fine for single-user local use.
- **IDs** are generated server-side: `MDL-###` for models, `FND-###` for findings.
- API responses are **enriched** (`enrichModel` / `enrichFinding`) with computed
  fields; the frontend stays presentational.

## Testing

No automated test suite. Verify changes by:
1. `npm start`, then exercise the API (e.g. `Invoke-RestMethod http://localhost:3000/api/...`).
2. Headless render check with Edge:
   `msedge --headless --disable-gpu --dump-dom "http://localhost:3000/#/dashboard"`.
3. For form/interaction tests, drive Edge via `--remote-debugging-port=9222` and the
   DevTools Protocol (Node has a global `WebSocket`).

Always restore clean seed state after manual testing (delete any scratch records, or
`npm run seed`).

## Gotchas

- The seed validation statuses assume "today" is mid-2026; the app computes due-dates
  dynamically against the real current date, so flags stay correct over time.
- `Start Model Tracker.bat` globs `node-v*-win-x64`, so it survives a Node version
  bump. If Node is reinstalled elsewhere, update the path note above.
- Don't commit `data/data.json` (it's git-ignored — it holds the user's real records).
- CSV: `GET /export.csv` and `/template.csv` are registered **before** `GET /:id` in
  `models.js`, otherwise `:id` would swallow them. Exports carry a UTF-8 BOM; `csv.js`
  strips a leading BOM and any BOM stuck to a header name (Excel/PowerShell add them).
  Import upserts by the `id` column; computed columns in an exported file are ignored.
- `server.js` parses both `application/json` and `text/csv`/`text/plain` bodies
  (import endpoints accept raw CSV text).
