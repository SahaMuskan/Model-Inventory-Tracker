// API routes for the findings / issues tracker.
import express from 'express';
import { load, save } from '../db.js';
import { enrichFinding, todayUTC } from '../riskEngine.js';
import { parseCSV, toCSV, normalizeDate } from '../csv.js';

const router = express.Router();

const SOURCES = ['Validation', 'Ongoing Monitoring', 'Internal Audit', 'Regulator'];
const SEVERITIES = ['Low', 'Medium', 'High', 'Critical'];
const STATUSES = ['Open', 'In Progress', 'Fixed', 'Closed'];

const CSV_INPUT_COLS = ['id', 'modelId', 'source', 'severity', 'description', 'owner', 'dateRaised', 'targetDate', 'status'];
const CSV_COMPUTED_COLS = ['modelName', 'overdue'];

const FINDING_DEFAULTS = {
  modelId: '', source: 'Validation', severity: 'Medium', description: '',
  owner: '', dateRaised: '', targetDate: '', status: 'Open',
};

function mapRowToFinding(row) {
  const f = {};
  for (const k of ['modelId', 'source', 'severity', 'description', 'owner', 'status']) {
    if (row[k] !== undefined && row[k] !== '') f[k] = row[k];
  }
  if (row.dateRaised !== undefined) f.dateRaised = normalizeDate(row.dateRaised);
  if (row.targetDate !== undefined) f.targetDate = normalizeDate(row.targetDate);
  return f;
}

function findingExportRow(f) {
  return {
    id: f.id, modelId: f.modelId, source: f.source, severity: f.severity,
    description: f.description, owner: f.owner, dateRaised: f.dateRaised,
    targetDate: f.targetDate, status: f.status,
    modelName: f.modelName, overdue: f.overdue ? 'Yes' : 'No',
  };
}

function nextFindingId(findings) {
  let max = 0;
  for (const f of findings) {
    const n = parseInt(String(f.id).replace(/\D/g, ''), 10);
    if (!Number.isNaN(n) && n > max) max = n;
  }
  return 'FND-' + String(max + 1).padStart(3, '0');
}

function sanitiseFinding(body, existing = {}) {
  const out = { ...existing };
  if (body.modelId !== undefined) out.modelId = String(body.modelId).trim();
  if (body.description !== undefined) out.description = String(body.description).trim();
  if (body.owner !== undefined) out.owner = String(body.owner).trim();
  if (body.dateRaised !== undefined) out.dateRaised = String(body.dateRaised).trim();
  if (body.targetDate !== undefined) out.targetDate = String(body.targetDate).trim();
  if (body.source !== undefined) out.source = SOURCES.includes(body.source) ? body.source : 'Validation';
  if (body.severity !== undefined) out.severity = SEVERITIES.includes(body.severity) ? body.severity : 'Medium';
  if (body.status !== undefined) out.status = STATUSES.includes(body.status) ? body.status : 'Open';
  return out;
}

// GET /api/findings (optional ?modelId=MDL-001)
router.get('/', (req, res) => {
  const data = load();
  const today = todayUTC();
  let findings = data.findings;
  if (req.query.modelId) findings = findings.filter((f) => f.modelId === req.query.modelId);
  res.json(findings.map((f) => enrichFinding(f, today, data.models)));
});

// GET /api/findings/export.csv
router.get('/export.csv', (req, res) => {
  const data = load();
  const today = todayUTC();
  const rows = data.findings.map((f) => findingExportRow(enrichFinding(f, today, data.models)));
  const csv = toCSV([...CSV_INPUT_COLS, ...CSV_COMPUTED_COLS], rows);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="findings.csv"');
  res.send(csv);
});

// GET /api/findings/template.csv
router.get('/template.csv', (req, res) => {
  const example = {
    id: '', modelId: 'MDL-001', source: 'Validation', severity: 'High',
    description: 'Example issue description', owner: 'Jane Doe',
    dateRaised: '2026-01-15', targetDate: '2026-06-30', status: 'Open',
  };
  const csv = toCSV(CSV_INPUT_COLS, [example]);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="findings-template.csv"');
  res.send(csv);
});

// POST /api/findings/import -> bulk create/update from CSV
router.post('/import', (req, res) => {
  const csv = typeof req.body === 'string' ? req.body : (req.body && req.body.csv);
  if (!csv || !String(csv).trim()) return res.status(400).json({ error: 'No CSV data was provided.' });
  let rows;
  try { rows = parseCSV(String(csv)); } catch (e) { return res.status(400).json({ error: 'Could not read the CSV: ' + e.message }); }
  if (!rows.length) return res.status(400).json({ error: 'The CSV had no data rows.' });

  const data = load();
  const result = { created: 0, updated: 0, skipped: 0, errors: [] };
  rows.forEach((row, idx) => {
    const lineNo = idx + 2;
    try {
      const mapped = mapRowToFinding(row);
      if (!mapped.modelId) { result.skipped++; result.errors.push(`Row ${lineNo}: no modelId — skipped.`); return; }
      if (!data.models.some((m) => m.id === mapped.modelId)) { result.skipped++; result.errors.push(`Row ${lineNo}: model "${mapped.modelId}" not found — skipped.`); return; }
      if (!mapped.description || !mapped.description.trim()) { result.skipped++; result.errors.push(`Row ${lineNo}: no description — skipped.`); return; }
      const id = (row.id || '').trim();
      const existing = id ? data.findings.find((f) => f.id === id) : null;
      if (existing) {
        Object.assign(existing, sanitiseFinding(mapped, existing));
        existing.id = id;
        result.updated++;
      } else {
        const finding = sanitiseFinding(mapped, { ...FINDING_DEFAULTS, dateRaised: todayUTC().toISOString().slice(0, 10) });
        finding.id = id && !data.findings.some((f) => f.id === id) ? id : nextFindingId(data.findings);
        data.findings.push(finding);
        result.created++;
      }
    } catch (e) { result.errors.push(`Row ${lineNo}: ${e.message}`); }
  });
  save();
  res.json(result);
});

// POST /api/findings
router.post('/', (req, res) => {
  const data = load();
  if (!req.body || !String(req.body.modelId || '').trim()) {
    return res.status(400).json({ error: 'A finding must be linked to a model.' });
  }
  if (!data.models.some((m) => m.id === req.body.modelId)) {
    return res.status(400).json({ error: 'Linked model does not exist.' });
  }
  if (!String(req.body.description || '').trim()) {
    return res.status(400).json({ error: 'A description is required.' });
  }
  const defaults = {
    modelId: '', source: 'Validation', severity: 'Medium', description: '',
    owner: '', dateRaised: todayUTC().toISOString().slice(0, 10), targetDate: '', status: 'Open',
  };
  const finding = sanitiseFinding(req.body, defaults);
  finding.id = nextFindingId(data.findings);
  data.findings.push(finding);
  save();
  res.status(201).json(enrichFinding(finding, todayUTC(), data.models));
});

// PUT /api/findings/:id
router.put('/:id', (req, res) => {
  const data = load();
  const idx = data.findings.findIndex((f) => f.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Finding not found' });
  const updated = sanitiseFinding(req.body, data.findings[idx]);
  updated.id = req.params.id;
  data.findings[idx] = updated;
  save();
  res.json(enrichFinding(updated, todayUTC(), data.models));
});

// DELETE /api/findings/:id
router.delete('/:id', (req, res) => {
  const data = load();
  const idx = data.findings.findIndex((f) => f.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Finding not found' });
  const removed = data.findings.splice(idx, 1)[0];
  save();
  res.json({ ok: true, deleted: removed.id });
});

export default router;
