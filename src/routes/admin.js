// Admin / setup actions: reset the data store to blank or to the sample data.
import express from 'express';
import { resetToSeed, resetToEmpty, load } from '../db.js';

const router = express.Router();

// POST /api/admin/reset  { mode: 'empty' | 'sample' }
//   empty  -> wipe to a blank inventory (a new organisation starts here)
//   sample -> restore the built-in demo models/findings
router.post('/reset', (req, res) => {
  const mode = (req.body && req.body.mode) || 'empty';
  if (mode === 'sample') resetToSeed();
  else if (mode === 'empty') resetToEmpty();
  else return res.status(400).json({ error: 'mode must be "empty" or "sample"' });

  const data = load();
  res.json({ ok: true, mode, models: data.models.length, findings: data.findings.length });
});

export default router;
