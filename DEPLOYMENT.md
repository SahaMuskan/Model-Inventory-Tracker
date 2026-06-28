# Deployment Guide

This covers two scenarios beyond a single personal PC (which is in **[SETUP.md](SETUP.md)**):

- **A. Shared server** — one copy that a whole team uses through their browsers.
- **B. Production / enterprise** — what a bank's IT needs to add for a real, secure rollout.

> Reality check: as shipped, this is a **single-process app that stores all data in one
> JSON file with no authentication**. That's ideal for one person or a small trusted
> team. Before real, sensitive model-inventory data is used at scale, treat Section B as
> required, not optional.

---

## A. Shared server (a team uses one copy)

The idea: run **one instance** on an always-on machine or VM; everyone else just opens a browser to it. They all share the same inventory.

### Steps

1. **Pick a host** — an always-on Windows or Linux machine/VM on the internal network.
2. **Install Node.js LTS** on it (from [nodejs.org](https://nodejs.org), or your package manager).
3. **Get the code** onto the host:
   ```sh
   git clone https://github.com/SahaMuskan/Model-Inventory-Tracker.git
   cd Model-Inventory-Tracker
   npm install
   ```
4. **Choose a port** (default 3000) and start it:
   ```sh
   # Windows PowerShell:  $env:PORT=8080; npm start
   # Linux/macOS:         PORT=8080 npm start
   ```
5. **Keep it running** so it survives logoffs/reboots — pick one:
   - **Windows:** run it as a service with [NSSM](https://nssm.cc/) (`nssm install ModelTracker`), or a Task Scheduler task "At startup".
   - **Linux:** a small `systemd` unit, or a process manager like `pm2` (`pm2 start server.js --name model-tracker`).
6. **Open the port** on the host's firewall (internal network only).
7. Users browse to **`http://<host-name-or-ip>:<port>`**.

### Things to know
- **Start with your own data, not the samples.** A fresh deployment opens with ~20 sample models. Before the team starts, clear them via **Settings → Clear all data** (or run `npm run seed:empty` on the host), then populate by adding models, **Import CSV**, or the sync script (see README). Restore the demo any time with `npm run seed:sample`.
- **One shared file.** All instances/users share `data/data.json`. For a small team this is fine; edits are last-write-wins (no record locking).
- **No logins.** Anyone who can reach the address can view and edit. Keep it on the internal network, or put it behind a reverse proxy that enforces SSO (see Section B).
- **Back up `data/data.json`** on a schedule (it holds everything).
- **Don't run two instances against the same folder** unless they're meant to share that file.

---

## B. Production / enterprise — brief for IT

The application logic (risk scoring, scheduling, findings, dashboard) is reusable as-is; the work is hardening the surrounding platform. Recommended additions before bank-wide use:

| Area | What to add | Where it touches the code |
|---|---|---|
| **Storage** | Replace the JSON file with a managed database (PostgreSQL / SQL Server). Gives concurrency, integrity, transactions. | Swap `src/db.js` for a DB-backed data layer; the route and risk logic stay the same. |
| **Authentication** | SSO via SAML/OIDC (e.g. Entra ID/Okta). | Add auth middleware in `server.js`; protect `/api/*`. |
| **Authorisation** | Role-based access — e.g. *viewer*, *editor*, *admin* (who can change settings/delete). | Per-route checks; add a user/role concept. |
| **Audit trail** | Immutable log of who changed what and when (regulatory expectation for MRM). | Write audit records on every create/update/delete. |
| **Transport security** | HTTPS/TLS, secure headers, CSRF protection. | Front with a reverse proxy (nginx/IIS) or terminate TLS in-app. |
| **Backups / DR** | Automated DB backups, retention, restore testing. | Infra/DB layer. |
| **Packaging** | Containerise (Docker) and deploy to approved internal infra/Kubernetes. | Add a `Dockerfile`; externalise config via env vars. |
| **Observability** | Centralised logging, health checks, monitoring/alerting. | Add logging + a `/healthz` endpoint. |
| **Config/secrets** | Move ports, DB creds, etc. to environment/secret stores. | `server.js` already reads `PORT` from env; extend this. |
| **Governance** | Validate the risk weights/thresholds against the bank's model-risk policy; document any change. | `src/riskEngine.js` is the single source of truth — change weights/tiers/intervals there. |

### Why the code is friendly to this
- The **risk and validation logic is isolated** in `src/riskEngine.js` (one file, no I/O) — easy to reuse and unit-test independently of storage or transport.
- **Persistence is isolated** in `src/db.js` behind a few functions (`load`, `save`, accessors), so swapping the JSON file for a database is a contained change.
- The API is a standard Express REST service, so SSO/proxy/containerisation follow normal patterns.

### Rough shape of effort
A pilot on a shared server (Section A) is hours. A hardened, SSO-protected, database-backed enterprise deployment is a small engineering project (think weeks, mostly auth + database + IT review), not a rebuild — the domain logic carries over.

---

For data import/automation (loading models from an existing inventory export), see the CSV import/export feature and `tools/sync-from-inventory.mjs`, described in **[README.md](README.md)**.
