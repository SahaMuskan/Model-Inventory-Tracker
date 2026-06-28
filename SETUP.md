# Setup Guide — running the Model Inventory & Risk Tracker on your PC

*A step-by-step guide for a non-technical user setting this up on a Windows computer. No coding required.*

---

## What you need

- A **Windows PC**.
- An **internet connection the first time you run it** (so it can fetch what it needs). After that it works offline.
- About **5 minutes**.

You do **not** need to install anything yourself first — the tool sets up its own runtime on the first run.

## Step 1 — Get the files

Get the project folder onto your PC, either by:

- **Downloading it** from `https://github.com/SahaMuskan/Model-Inventory-Tracker` (click the green **Code** button → **Download ZIP**, then unzip it), or
- copying the folder from a colleague.

> If you copied it from someone who was already using it, you can ignore (or delete) any `node_modules` folder and the `data\data.json` file — both are recreated automatically, and deleting `data\data.json` gives you a clean start with the sample models.

## Step 2 — Start it

Open the folder and **double-click `Start Model Tracker.bat`**.

The first time, a black window appears and:
1. downloads a small private copy of the runtime (about 30 MB — this only happens once),
2. installs the app's components,
3. starts the tool and opens it in your browser at **http://localhost:3000**.

That first run can take a minute or two. Every run after that is just a few seconds.

## Step 3 — Use it

- Keep the **black window open** while you work — that's the engine. Closing it stops the tool.
- If the browser didn't open by itself, open it yourself and go to **http://localhost:3000**.

To stop: close the black window. To start again later: double-click `Start Model Tracker.bat`.

---

## Where your data is saved

Everything you enter is stored in one file inside the folder:

```
data\data.json
```

- It's there every time you come back.
- **To back it up:** copy that file somewhere safe.
- **To move to a new PC:** copy the whole folder.
- **To start over from the sample data:** delete `data\data.json` and start the tool again.

## Starting blank (for a new organisation)

The tool deliberately opens with ~20 **sample** models so it doesn't look empty. When you're ready to enter your own real models:

1. Open **Settings** (left menu) → **Clear all data — start fresh**, and confirm. The inventory is now empty.
2. Add models with **+ Add model**, or load many at once with **Import CSV** on the Model Register (see [README.md](README.md)).

You can put the samples back any time with **Settings → Reload sample data**. There's also a CSV **backup** button on the Settings page — worth doing before you clear anything.

> IT alternative (command line): `npm run seed:empty` starts blank; `npm run seed:sample` restores the demo data.

## If something doesn't work

| Problem | What to do |
|---|---|
| **"Windows protected your PC"** when you double-click the launcher | Click **More info → Run anyway**. (You can also right-click the `.bat` → **Properties** → tick **Unblock** → **OK**.) |
| The browser shows **"can't connect"** | The engine isn't running. Make sure the black window is open, wait a few seconds, then refresh the page. |
| The black window says it **couldn't set up Node.js** | Your network may block the download. Install **Node.js LTS** manually from [nodejs.org](https://nodejs.org), then double-click the launcher again. |
| It says **port 3000 is in use** | Another copy is already running. Close the other black window, or just open http://localhost:3000. |
| Your workplace blocks scripts/downloads | Ask IT, or see the team/server option in **DEPLOYMENT.md**. |

---

For sharing it with a whole team or rolling it out properly across a bank, see **[DEPLOYMENT.md](DEPLOYMENT.md)**. For how the risk rating works, see **[METHODOLOGY.md](METHODOLOGY.md)**.
