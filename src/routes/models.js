// API routes for the model register (the master list of models).
import express from 'express';
import { load, save } from '../db.js';
import { enrichModel, enrichFinding, todayUTC, clampScore } from '../riskEngine.js';

const router = express.Router();

const STATUSES = ['development', 'in_use', 'retired'];
const BUILD_TYPES = ['in-house', 'vendor'];

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
  const defaults = {
    name: '', purpose: '', owner: '', developer: '', validator: '',
    businessUnit: '', modelType: '', buildType: 'in-house', vendorName: '',
    dependsOn: [], regulatoryUse: false, status: 'in_use',
    goLiveDate: '', lastValidated: '', limitations: '',
    materiality: 2, complexity: 2, reliance: 2, regulatory: 2, uncertainty: 2,
  };
  const model = sanitiseModel(req.body, defaults);
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
