# Model Inventory & Risk Tracker

A simple, self-contained tool for **Model Risk Management**. It keeps a register of every model your organisation uses, **automatically rates each model's risk**, drives a **validation schedule** off that rating, and tracks **findings/issues** through to resolution — with a dashboard pulling it all together.

It comes pre-loaded with ~20 realistic (but entirely made-up) bank models so it looks like a real setup the moment you open it.

---

## What it does

1. **Model register** — the master list of models, with all the key details (owner, developer, validator, business unit, type, in-house vs vendor, dependencies, regulatory use, status, go-live and last-validation dates, known limitations).
2. **Automatic risk rating** — each model is scored on five factors (materiality, complexity, reliance, regulatory impact, uncertainty). The tool computes a weighted score and an overall **Tier 1 / 2 / 3** rating, and always shows the individual scores behind it. See **[METHODOLOGY.md](METHODOLOGY.md)**.
3. **Validation schedule** — the tier sets how often a model is re-validated (12 / 24 / 36 months by default, all editable). The tool works out the next-due date and flags everything as **overdue / due soon / current**.
4. **Findings & issues tracker** — log issues against models (source, severity, owner, target date, status) and see at a glance which are **overdue**.
5. **Dashboard** — models per tier, validation status, open issues by severity, and upcoming/overdue validations.

You can **add, edit and delete** models and findings yourself. **All data is saved on this machine** and is there when you come back.

---

## How to start it

### The easy way (Windows)

**Double-click `Start Model Tracker.bat`.**

It launches the tool and opens it in your browser at **http://localhost:3000**. Leave that small black window open while you use the tool; close it when you're done.

### The command-line way

```sh
npm install      # first time only — installs the one dependency (Express)
npm start
```

Then open **http://localhost:3000** in your browser.

> This project was set up with a portable copy of Node.js in your user folder
> (`%LOCALAPPDATA%\node-portable\...`), so nothing was installed system-wide and
> no admin rights were needed. The launcher finds it automatically.

---

## Where your data lives

Everything you enter is stored in a single file:

```
data/data.json
```

- It's created automatically the first time you run the tool, from the built-in seed data.
- It's saved every time you add, edit or delete something — so your records survive restarts.
- To **back it up**, just copy that file. To move the tool to another machine, copy the whole folder.
- To **start over from the sample data**, delete `data/data.json` (or run `npm run seed`) and restart.

---

## Importing & exporting data (CSV)

You don't have to type every model in. On both the **Model Register** and **Findings** pages there are **Import CSV** and **Export CSV** buttons.

- **Export CSV** downloads everything as a spreadsheet (opens directly in Excel). It includes read-only reference columns (tier, score, validation status, next-due) alongside the editable fields.
- **Import CSV** uploads a spreadsheet. Rows are matched to existing records by their **`id`** column and updated; rows with a blank or new id are added. The dialog has a **Download blank template** link to get the exact columns.
- Dates should be `YYYY-MM-DD` (UK `DD/MM/YYYY` is also accepted). Risk factors are `1`/`2`/`3` — the tier is always recalculated, never imported. `dependsOn` is a semicolon-separated list of IDs (e.g. `MDL-001;MDL-004`).

A typical workflow: **Export**, edit in Excel, **Import** back.

## Automating the feed (sync script)

`tools/sync-from-inventory.mjs` is a sample/template script showing how a bank could load models automatically from an existing inventory export, instead of by hand. It reads a CSV with your own column names, **maps** them to the tracker's fields, **derives** the five risk-factor scores from quantitative columns (exposure, technique, downstream count, etc.) using transparent rules you tailor, and posts the result to the import API.

```sh
node tools/sync-from-inventory.mjs --dry-run        # show the mapped data, send nothing
node tools/sync-from-inventory.mjs                  # load the bundled sample extract
node tools/sync-from-inventory.mjs path/to/your.csv # load your own extract
```

See `tools/sample-inventory-extract.csv` for the bank-style input it expects. In a real deployment you'd point it at a scheduled database extract or a source-system API and run it on a server. (Note: the tool as shipped is a single-user local app — production integration would also need hosting, a database, and access controls.)

## Project layout

```
server.js              Express server (serves the API and the web interface)
src/
  riskEngine.js        The risk-scoring + validation logic (single source of truth)
  seed.js              The ~20 sample models and findings
  db.js                Reads/writes data/data.json
  csv.js               Dependency-free CSV reader/writer (import/export)
  routes/              API endpoints (models, findings, settings, dashboard, methodology)
public/                The web interface (HTML, CSS, JavaScript)
tools/
  sync-from-inventory.mjs      Sample script to load models from an inventory export
  sample-inventory-extract.csv Example bank-style input for that script
data/data.json         Your saved data (created on first run)
METHODOLOGY.md         Plain-English explanation of the risk rating
```

No internet connection is needed to use the tool — it runs entirely on your machine.
