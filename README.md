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

## Project layout

```
server.js              Express server (serves the API and the web interface)
src/
  riskEngine.js        The risk-scoring + validation logic (single source of truth)
  seed.js              The ~20 sample models and findings
  db.js                Reads/writes data/data.json
  routes/              API endpoints (models, findings, settings, dashboard, methodology)
public/                The web interface (HTML, CSS, JavaScript)
data/data.json         Your saved data (created on first run)
METHODOLOGY.md         Plain-English explanation of the risk rating
```

No internet connection is needed to use the tool — it runs entirely on your machine.
