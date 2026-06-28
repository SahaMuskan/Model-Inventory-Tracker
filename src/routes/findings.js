// API routes for the findings / issues tracker.
import express from 'express';
import { load, save } from '../db.js';
import { enrichFinding, todayUTC } from '../riskEngine.js';

const router = express.Router();

const SOURCES = ['Validation', 'Ongoing Monitoring', 'Internal Audit', 'Regulator'];
const SEVERITIES = ['Low', 'Medium', 'High', 'Critical'];
const STATUSES = ['Open', 'In Progress', 'Fixed', 'Closed'];

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
