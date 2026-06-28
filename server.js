// ---------------------------------------------------------------------------
// server.js
// A single Node/Express server that exposes the REST API and serves the web
// interface. Start it with `npm start`, then open http://localhost:3000.
// ---------------------------------------------------------------------------

import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

import modelsRouter from './src/routes/models.js';
import findingsRouter from './src/routes/findings.js';
import settingsRouter from './src/routes/settings.js';
import dashboardRouter from './src/routes/dashboard.js';
import methodologyRouter from './src/routes/methodology.js';
import adminRouter from './src/routes/admin.js';
import { load } from './src/db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '5mb' }));
app.use(express.text({ type: ['text/csv', 'text/plain'], limit: '5mb' }));

// Lightweight health check for containers, orchestrators and load balancers.
app.get('/healthz', (req, res) => res.json({ status: 'ok', uptime: process.uptime() }));

// --- API ---
app.use('/api/models', modelsRouter);
app.use('/api/findings', findingsRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/methodology', methodologyRouter);
app.use('/api/admin', adminRouter);

// Any other /api/* path is a genuine 404 (don't fall through to the SPA).
app.use('/api', (req, res) => res.status(404).json({ error: 'API endpoint not found' }));

// --- Static web interface ---
app.use(express.static(path.join(__dirname, 'public')));

// SPA fallback: send the app shell for any non-API route so deep links / reloads
// still work (the front end uses in-page routing).
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Centralised error handler so a bad request returns JSON, not an HTML stack trace.
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Something went wrong on the server.' });
});

// Make sure the data store is initialised (seeds on first run) before we listen.
load();

app.listen(PORT, () => {
  console.log('\n  Model Inventory & Risk Tracker is running.');
  console.log(`  Open your browser at:  http://localhost:${PORT}\n`);
});
