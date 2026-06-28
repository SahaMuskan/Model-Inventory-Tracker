// API routes for the model register (the master list of models).
import express from 'express';
import { load, save } from '../db.js';
import { enrichModel, enrichFinding, todayUTC, clampScore } from '../riskEngine.js';
import { parseCSV, toCSV, parseBool, normalizeDate } from '../csv.js';

const router = express.Router();

const STATUSES = ['development', 'in_use', 'retired'];
const BUILD_TYPES = ['in-house', 'vendor'];

// The columns used for CSV import/export (in order). The first block are the
// editable inputs; the trailing block are computed, read-only reference columns
// (ignored on import).
const CSV_INPUT_COLS = [
  'id', 'name', 'purpose', 'owner', 'developer', 'validator', 'businessUnit',
  'modelType', 'buildType', 'vendorName', 'dependsOn', 'regulatoryUse', 'status',
  'goLiveDate', 'lastValidated', 'limitations',
  'materiality', 'complexity', 'reliance', 'regulatory', 'uncertainty',
];
const CSV_COMPUTED_COLS = ['riskTier', 'weightedScore', 'validationStatus', 'nextDue'];

const MODEL_DEFAULTS = {
  name: '', purpose: '', owner: '', developer: '', validator: '',
  businessUnit: '', modelType: '', buildType: 'in-house', vendorName: '',
  dependsOn: [], regulatoryUse: false, status: 'in_use',
  goLiveDate: '', lastValidated: '', limitations: '',
  materiality: 2, complexity: 2, reliance: 2, regulatory: 2, uncertainty: 2,
};

// Convert one CSV row (all strings) into a typed object for sanitiseModel().
function mapRowToModel(row) {
  const m = {};
  const passthrough = ['name', 'purpose', 'owner', 'developer', 'validator', 'businessUnit',
    'modelType', 'buildType', 'vendorName', 'limitations',
    'materiality', 'complexity', 'reliance', 'regulatory', 'uncertainty', 'status'];
  for (const k of passthrough) if (row[k] !== undefined && row[k] !== '') m[k] = row[k];
  if (row.goLiveDate !== undefined) m.goLiveDate = normalizeDate(row.goLiveDate);
  if (row.lastValidated !== undefined) m.lastValidated = normalizeDate(row.lastValidated);
  if (row.regulatoryUse !== undefined && row.regulatoryUse !== '') m.regulatoryUse = parseBool(row.regulatoryUse);
  if (row.dependsOn !== undefined) m.dependsOn = String(row.dependsOn).split(/[;|]/).map((s) => s.trim()).filter(Boolean);
  return m;
}

// Build a flat export row (input fields + computed reference fields).
function modelExportRow(enriched) {
  return {
    id: enriched.id, name: enriched.name, purpose: enriched.purpose, owner: enriched.owner,
    developer: enriched.developer, validator: enriched.validator, businessUnit: enriched.businessUnit,
    modelType: enriched.modelType, buildType: enriched.buildType, vendorName: enriched.vendorName,
    dependsOn: (enriched.dependsOn || []).join(';'),
    regulatoryUse: enriched.regulatoryUse ? 'Yes' : 'No',
    status: enriched.status, goLiveDate: enriched.goLiveDate, lastValidated: enriched.lastValidated,
    limitations: enriched.limitations,
    materiality: enriched.materiality, complexity: enriched.complexity, reliance: enriched.reliance,
    regulatory: enriched.regulatory, uncertainty: enriched.uncertainty,
    riskTier: enriched.risk.tier, weightedScore: enriched.risk.weightedScore,
    validationStatus: enriched.validation.statusLabel, nextDue: enriched.validation.nextDue || '',
  };
}

function nextModelId(models) {
  let max = 0;
  for (const m of models) {
    const n = parseInt(String(m.id).replace(/\D/g, ''), 10);
    if (!Number.isNaN(n) && n > max) max = n;
  }
  return 'MDL-' + String(max + 1).padStart(3, '0');
}

// Pull only the known fields out of a request body and sanitise them.
function sanitiseModel(body, existing = {}) {
  const out = { ...existing };
  const strFields = [
    'name', 'purpose', 'owner', 'developer', 'validator', 'businessUnit',
    'modelType', 'vendorName', 'goLiveDate', 'lastValidated', 'limitations',
  ];
  for (const f of strFields) {
    if (body[f] !== undefined) out[f] = body[f] === null ? '' : String(body[f]).trim();
  }
  if (body.buildType !== undefined) {
    out.buildType = BUILD_TYPES.includes(body.buildType) ? body.buildType : 'in-house';
  }
  if (body.status !== undefined) {
    out.status = STATUSES.includes(body.status) ? body.status : 'in_use';
  }
  if (body.regulatoryUse !== undefined) {
    out.regulatoryUse = Boolean(body.regulatoryUse);
  }
  if (body.dependsOn !== undefined) {
    out.dependsOn = Array.isArray(body.dependsOn)
      ? body.dependsOn.map((x) => String(x).trim()).filter(Boolean)
      : [];
  }
  for (const f of ['materiality', 'complexity', 'reliance', 'regulatory', 'uncertainty']) {
    if (body[f] !== undefined) out[f] = clampScore(body[f]);
  }
  return out;
}

// GET /api/models  -> all models, enriched with risk + validation + relationships
router.get('/', (req, res) => {
  const data = load();
  const enriched = data.models.map((m) => enrichModel(m, data.models, data.settings));
  res.json(enriched);
});

// GET /api/models/export.csv -> all models as an Excel-compatible CSV
router.get('/export.csv', (req, res) => {
  const data = load();
  const rows = data.models.map((m) => modelExportRow(enrichModel(m, data.models, data.settings)));
  const csv = toCSV([...CSV_INPUT_COLS, ...CSV_COMPUTED_COLS], rows);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="models.csv"');
  res.send(csv);
});

// GET /api/models/template.csv -> a blank import template with one example row
router.get('/template.csv', (req, res) => {
  const example = {
    id: '', name: 'Example Mortgage PD', purpose: 'Probability of default for mortgages',
    owner: 'Jane Doe', developer: 'Credit Analytics', validator: 'Independent Validation',
    businessUnit: 'Retail Banking', modelType: 'PD (Probability of Default)', buildType: 'in-house',
    vendorName: '', dependsOn: '', regulatoryUse: 'Yes', status: 'in_use',
    goLiveDate: '2022-01-01', lastValidated: '2025-01-01',
    limitations: 'Example limitation', materiality: 3, complexity: 2, reliance: 3,
    regulatory: 3, uncertainty: 2,
  };
  const csv = toCSV(CSV_INPUT_COLS, [example]);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="models-template.csv"');
  res.send(csv);
});

// POST /api/models/import -> bulk create/update from CSV (raw text/csv or { csv })
router.post('/import', (req, res) => {
  const csv = typeof req.body === 'string' ? req.body : (req.body && req.body.csv);
  if (!csv || !String(csv).trim()) return res.status(400).json({ error: 'No CSV data was provided.' });
  let rows;
  try { rows = parseCSV(String(csv)); } catch (e) { return res.status(400).json({ error: 'Could not read the CSV: ' + e.message }); }
  if (!rows.length) return res.status(400).json({ error: 'The CSV had no data rows.' });

  const data = load();
  const result = { created: 0, updated: 0, skipped: 0, errors: [] };
  rows.forEach((row, idx) => {
    const lineNo = idx + 2; // +1 for header, +1 for 1-based
    try {
      if (!row.name || !row.name.trim()) { result.skipped++; result.errors.push(`Row ${lineNo}: no name — skipped.`); return; }
      const mapped = mapRowToModel(row);
      const id = (row.id || '').trim();
      const existing = id ? data.models.find((m) => m.id === id) : null;
      if (existing) {
        if (Array.isArray(mapped.dependsOn)) mapped.dependsOn = mapped.dependsOn.filter((x) => x !== existing.id);
        const updated = sanitiseModel(mapped, existing);
        updated.id = existing.id;
        Object.assign(existing, updated);
        result.updated++;
      } else {
        const model = sanitiseModel(mapped, { ...MODEL_DEFAULTS });
        model.id = id && !data.models.some((m) => m.id === id) ? id : nextModelId(data.models);
        data.models.push(model);
        result.created++;
      }
    } catch (e) { result.errors.push(`Row ${lineNo}: ${e.message}`); }
  });
  save();
  res.json(result);
});

// GET /api/models/:id -> one model plus its findings
router.get('/:id', (req, res) => {
  const data = load();
  const model = data.models.find((m) => m.id === req.params.id);
  if (!model) return res.status(404).json({ error: 'Model not found' });
  const today = todayUTC();
  const enriched = enrichModel(model, data.models, data.settings);
  enriched.findings = data.findings
    .filter((f) => f.modelId === model.id)
    .map((f) => enrichFinding(f, today, data.models));
  res.json(enriched);
});

// POST /api/models -> create
router.post('/', (req, res) => {
  const data = load();
  if (!req.body || !String(req.body.name || '').trim()) {
    return res.status(400).json({ error: 'A model name is required.' });
  }
  const model = sanitiseModel(req.body, { ...MODEL_DEFAULTS });
  model.id = nextModelId(data.models);
  data.models.push(model);
  save();
  res.status(201).json(enrichModel(model, data.models, data.settings));
});

// PUT /api/models/:id -> update
router.put('/:id', (req, res) => {
  const data = load();
  const idx = data.models.findIndex((m) => m.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Model not found' });
  // A model cannot depend on itself.
  if (Array.isArray(req.body.dependsOn)) {
    req.body.dependsOn = req.body.dependsOn.filter((x) => x !== req.params.id);
  }
  const updated = sanitiseModel(req.body, data.models[idx]);
  updated.id = req.params.id; // id is immutable
  data.models[idx] = updated;
  save();
  res.json(enrichModel(updated, data.models, data.settings));
});

// DELETE /api/models/:id -> delete (cascades to its findings and dependency links)
router.delete('/:id', (req, res) => {
  const data = load();
  const idx = data.models.findIndex((m) => m.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Model not found' });
  const removed = data.models.splice(idx, 1)[0];
  // Remove findings attached to this model.
  data.findings = data.findings.filter((f) => f.modelId !== removed.id);
  // Remove this model from other models' dependency lists.
  for (const m of data.models) {
    if (Array.isArray(m.dependsOn) && m.dependsOn.includes(removed.id)) {
      m.dependsOn = m.dependsOn.filter((d) => d !== removed.id);
    }
  }
  save();
  res.json({ ok: true, deleted: removed.id });
});

export default router;
