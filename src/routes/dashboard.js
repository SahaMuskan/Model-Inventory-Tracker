// API route that aggregates everything for the at-a-glance dashboard.
import express from 'express';
import { load } from '../db.js';
import { enrichModel, enrichFinding, todayUTC } from '../riskEngine.js';

const router = express.Router();

router.get('/', (req, res) => {
  const data = load();
  const today = todayUTC();
  const models = data.models.map((m) => enrichModel(m, data.models, data.settings));
  const findings = data.findings.map((f) => enrichFinding(f, today, data.models));

  const active = models.filter((m) => m.status !== 'retired');

  // --- Models by tier (active models only) ---
  const tierCounts = { 1: 0, 2: 0, 3: 0 };
  for (const m of active) tierCounts[m.risk.tier] += 1;

  // --- Validation status counts (all non-retired models) ---
  const validationCounts = { overdue: 0, due_soon: 0, current: 0, pending_initial: 0 };
  for (const m of models) {
    if (m.validation.status in validationCounts) validationCounts[m.validation.status] += 1;
  }

  // --- Open issues by severity (Open + In Progress) ---
  const openFindings = findings.filter((f) => f.status === 'Open' || f.status === 'In Progress');
  const severityCounts = { Critical: 0, High: 0, Medium: 0, Low: 0 };
  for (const f of openFindings) {
    if (f.severity in severityCounts) severityCounts[f.severity] += 1;
  }
  const overdueFindings = openFindings.filter((f) => f.overdue);

  // --- Upcoming validations: overdue first, then due-soon, then nearest current ---
  const rank = { overdue: 0, due_soon: 1, current: 2, pending_initial: 3 };
  const upcoming = models
    .filter((m) => m.validation.applicable && m.validation.status !== 'not_applicable')
    .sort((a, b) => {
      const ra = rank[a.validation.status] ?? 9;
      const rb = rank[b.validation.status] ?? 9;
      if (ra !== rb) return ra - rb;
      const da = a.validation.daysUntilDue ?? 1e9;
      const db = b.validation.daysUntilDue ?? 1e9;
      return da - db;
    })
    .slice(0, 8)
    .map((m) => ({
      id: m.id,
      name: m.name,
      tier: m.risk.tier,
      tierShort: m.risk.tierShort,
      tierColor: m.risk.tierColor,
      lastValidated: m.validation.lastValidated,
      nextDue: m.validation.nextDue,
      daysUntilDue: m.validation.daysUntilDue,
      status: m.validation.status,
      statusLabel: m.validation.statusLabel,
    }));

  res.json({
    totals: {
      totalModels: models.length,
      activeModels: active.length,
      inUse: models.filter((m) => m.status === 'in_use').length,
      inDevelopment: models.filter((m) => m.status === 'development').length,
      retired: models.filter((m) => m.status === 'retired').length,
      vendor: models.filter((m) => m.buildType === 'vendor').length,
      regulatory: models.filter((m) => m.regulatoryUse).length,
      openFindings: openFindings.length,
      overdueFindings: overdueFindings.length,
      totalFindings: findings.length,
    },
    tierCounts,
    validationCounts,
    severityCounts,
    upcoming,
  });
});

export default router;
