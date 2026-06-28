// API routes for user-configurable settings (validation intervals + due-soon window).
import express from 'express';
import { load, save } from '../db.js';

const router = express.Router();

// GET /api/settings
router.get('/', (req, res) => {
  res.json(load().settings);
});

// PUT /api/settings -> update validation intervals and the "due soon" window
router.put('/', (req, res) => {
  const data = load();
  const s = data.settings;

  if (req.body.validationIntervalsMonths && typeof req.body.validationIntervalsMonths === 'object') {
    const intervals = { ...s.validationIntervalsMonths };
    for (const tier of [1, 2, 3]) {
      const v = req.body.validationIntervalsMonths[tier] ?? req.body.validationIntervalsMonths[String(tier)];
      if (v !== undefined) {
        const n = Math.round(Number(v));
        if (!Number.isNaN(n) && n >= 1 && n <= 120) intervals[tier] = n;
      }
    }
    s.validationIntervalsMonths = intervals;
  }

  if (req.body.dueSoonWindowDays !== undefined) {
    const n = Math.round(Number(req.body.dueSoonWindowDays));
    if (!Number.isNaN(n) && n >= 1 && n <= 365) s.dueSoonWindowDays = n;
  }

  save();
  res.json(s);
});

export default router;
