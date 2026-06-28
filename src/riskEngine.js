// ---------------------------------------------------------------------------
// riskEngine.js
// The single source of truth for how model risk is scored and how validation
// due-dates are worked out. Both the API and the on-screen "Methodology" page
// read from the constants defined here, so the explanation the user sees always
// matches the numbers the tool actually uses.
// ---------------------------------------------------------------------------

// The five risk factors. Each is scored 1 (Low), 2 (Medium) or 3 (High).
// Weights are expressed as fractions that add up to 1.0, so the weighted score
// is simply a weighted AVERAGE on the same 1-3 scale as the inputs.
//
// Why these weights:
//   Materiality (30%)  - the size of the exposure is the single biggest driver
//                        of how much damage a wrong model can do.
//   Regulatory  (25%)  - models feeding capital, financial reporting or external
//                        submissions carry regulatory and reputational risk on
//                        top of financial risk, so they rank second.
//   Reliance    (20%)  - interconnected models can spread an error widely, so
//                        how much else depends on the output matters a lot.
//   Complexity  (15%)  - more complex / opaque models (e.g. ML/AI) are harder to
//                        challenge and more prone to hidden failure.
//   Uncertainty (10%)  - weak data or an unproven method raises risk, but is the
//                        most fixable factor, so it carries the least weight.
export const FACTORS = [
  {
    key: 'materiality',
    label: 'Materiality',
    weight: 0.30,
    question: 'How much money or how large a portfolio rides on this model?',
    levels: {
      1: 'Low — small exposure; limited financial impact if wrong.',
      2: 'Medium — meaningful portfolio or P&L impact.',
      3: 'High — very large exposure; a material loss if the model is wrong.',
    },
  },
  {
    key: 'regulatory',
    label: 'Regulatory impact',
    weight: 0.25,
    question: 'Does it feed regulatory capital, financial reporting, or anything reported externally?',
    levels: {
      1: 'Low — internal / business use only.',
      2: 'Medium — informs regulatory or financial processes indirectly.',
      3: 'High — directly feeds capital, financial reporting or regulatory submissions.',
    },
  },
  {
    key: 'reliance',
    label: 'Reliance / interconnectedness',
    weight: 0.20,
    question: 'How many decisions and other models depend on its output?',
    levels: {
      1: 'Low — stand-alone; few downstream dependencies.',
      2: 'Medium — feeds several decisions or one or two other models.',
      3: 'High — feeds many decisions and multiple downstream models.',
    },
  },
  {
    key: 'complexity',
    label: 'Complexity',
    weight: 0.15,
    question: 'How complex is the methodology?',
    levels: {
      1: 'Low — simple rules-based / deterministic logic.',
      2: 'Medium — standard statistical / regression model.',
      3: 'High — machine-learning / AI or otherwise opaque methodology.',
    },
  },
  {
    key: 'uncertainty',
    label: 'Uncertainty',
    weight: 0.10,
    question: 'How good is the data and how mature / proven is the model?',
    levels: {
      1: 'Low — rich data; well-established, proven approach.',
      2: 'Medium — adequate data; reasonably mature.',
      3: 'High — sparse/poor data or a new, unproven approach.',
    },
  },
];

export const SCORE_LABELS = { 1: 'Low', 2: 'Medium', 3: 'High' };

// Tier boundaries on the 1-3 weighted-average scale. These split the 1.0-3.0
// range into three equal bands (each two-thirds of a point wide).
//   >= 2.333  -> Tier 1 (High)
//   >= 1.667  -> Tier 2 (Medium)
//   <  1.667  -> Tier 3 (Low)
export const TIER_THRESHOLDS = { tier1: 7 / 3, tier2: 5 / 3 };

export const TIER_META = {
  1: { tier: 1, label: 'Tier 1 — High', short: 'Tier 1', color: '#dc2626',
       description: 'High model risk. The most intensive oversight; re-validated most frequently.' },
  2: { tier: 2, label: 'Tier 2 — Medium', short: 'Tier 2', color: '#d97706',
       description: 'Medium model risk. Standard oversight and validation cadence.' },
  3: { tier: 3, label: 'Tier 3 — Low', short: 'Tier 3', color: '#059669',
       description: 'Low model risk. Lighter-touch oversight; least frequent re-validation.' },
};

// Validation status colours / labels (used by the API + UI legend).
export const VALIDATION_META = {
  overdue:         { label: 'Overdue',        color: '#dc2626' },
  due_soon:        { label: 'Due soon',       color: '#d97706' },
  current:         { label: 'Current',        color: '#059669' },
  pending_initial: { label: 'Pending initial', color: '#6366f1' },
  not_applicable:  { label: 'N/A (retired)',  color: '#94a3b8' },
};

// Sensible defaults used when the stored settings don't specify something.
export const DEFAULT_SETTINGS = {
  // How often each tier must be re-validated, in months. The user can change these.
  validationIntervalsMonths: { 1: 12, 2: 24, 3: 36 },
  // A validation counts as "due soon" when it falls within this many days.
  dueSoonWindowDays: 90,
};

// --- small date helpers (everything is treated as a calendar date in UTC) ----

function parseDate(s) {
  if (!s || typeof s !== 'string') return null;
  const parts = s.split('-').map(Number);
  if (parts.length !== 3 || parts.some(Number.isNaN)) return null;
  const [y, m, d] = parts;
  return new Date(Date.UTC(y, m - 1, d));
}

export function todayUTC() {
  const n = new Date();
  return new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate()));
}

function addMonths(date, months) {
  const d = new Date(date.getTime());
  d.setUTCMonth(d.getUTCMonth() + months);
  return d;
}

function diffDays(a, b) {
  return Math.round((a.getTime() - b.getTime()) / 86400000);
}

function toISO(d) {
  return d ? d.toISOString().slice(0, 10) : null;
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

function clampScore(v) {
  const n = Math.round(Number(v));
  if (Number.isNaN(n)) return 2;
  return Math.min(3, Math.max(1, n));
}

// ---------------------------------------------------------------------------
// computeRisk: turns the five factor scores into a weighted score + tier, and
// returns the full breakdown so the rating can always be explained.
// ---------------------------------------------------------------------------
export function computeRisk(model) {
  let weightedTotal = 0;
  const breakdown = FACTORS.map((f) => {
    const score = clampScore(model[f.key]);
    const contribution = score * f.weight;
    weightedTotal += contribution;
    return {
      key: f.key,
      label: f.label,
      score,
      scoreLabel: SCORE_LABELS[score],
      weight: f.weight,
      weightPct: Math.round(f.weight * 100),
      contribution: round2(contribution),
    };
  });

  const weightedScore = round2(weightedTotal); // weighted average on the 1-3 scale
  // 0-100 view: maps 1.0 -> 0 and 3.0 -> 100, for easy "at a glance" reading.
  const score100 = Math.round(((weightedTotal - 1) / 2) * 100);

  let tier;
  if (weightedTotal >= TIER_THRESHOLDS.tier1) tier = 1;
  else if (weightedTotal >= TIER_THRESHOLDS.tier2) tier = 2;
  else tier = 3;

  return {
    weightedScore,
    score100,
    tier,
    tierLabel: TIER_META[tier].label,
    tierShort: TIER_META[tier].short,
    tierColor: TIER_META[tier].color,
    breakdown,
  };
}

// ---------------------------------------------------------------------------
// computeValidation: uses the tier (from computeRisk) and the configured
// intervals to work out the next-due date and a clear status flag.
// ---------------------------------------------------------------------------
export function computeValidation(model, settings = DEFAULT_SETTINGS) {
  const intervals = settings.validationIntervalsMonths || DEFAULT_SETTINGS.validationIntervalsMonths;
  const dueSoonWindow = settings.dueSoonWindowDays ?? DEFAULT_SETTINGS.dueSoonWindowDays;

  // Retired models carry no live validation obligation.
  if (model.status === 'retired') {
    return { applicable: false, status: 'not_applicable', statusLabel: VALIDATION_META.not_applicable.label };
  }

  const risk = computeRisk(model);
  const intervalMonths = Number(intervals[risk.tier] ?? intervals[String(risk.tier)] ?? DEFAULT_SETTINGS.validationIntervalsMonths[risk.tier]);
  const last = parseDate(model.lastValidated);
  const today = todayUTC();

  if (!last) {
    // No validation on record.
    if (model.status === 'development') {
      // Still being built — initial validation not yet due.
      return {
        applicable: true, tier: risk.tier, intervalMonths,
        lastValidated: null, nextDue: null, daysUntilDue: null,
        status: 'pending_initial', statusLabel: VALIDATION_META.pending_initial.label,
        note: 'In development — awaiting initial validation.',
      };
    }
    // In use but never validated -> treat as overdue (needs attention now).
    return {
      applicable: true, tier: risk.tier, intervalMonths,
      lastValidated: null, nextDue: null, daysUntilDue: null,
      status: 'overdue', statusLabel: VALIDATION_META.overdue.label,
      note: 'In use but never validated.',
    };
  }

  const nextDue = addMonths(last, intervalMonths);
  const daysUntilDue = diffDays(nextDue, today);
  let status;
  if (daysUntilDue < 0) status = 'overdue';
  else if (daysUntilDue <= dueSoonWindow) status = 'due_soon';
  else status = 'current';

  return {
    applicable: true,
    tier: risk.tier,
    intervalMonths,
    lastValidated: model.lastValidated,
    nextDue: toISO(nextDue),
    daysUntilDue,
    status,
    statusLabel: VALIDATION_META[status].label,
  };
}

// ---------------------------------------------------------------------------
// enrichModel: attaches the computed risk + validation + relationship details
// to a stored model record, ready to send to the front end.
// ---------------------------------------------------------------------------
export function enrichModel(model, allModels = [], settings = DEFAULT_SETTINGS) {
  const risk = computeRisk(model);
  const validation = computeValidation(model, settings);

  const dependsOnDetails = (model.dependsOn || []).map((id) => {
    const m = allModels.find((x) => x.id === id);
    return { id, name: m ? m.name : '(unknown model)' };
  });
  const feedsInto = allModels
    .filter((m) => (m.dependsOn || []).includes(model.id))
    .map((m) => ({ id: m.id, name: m.name }));

  return { ...model, risk, validation, dependsOnDetails, feedsInto };
}

// ---------------------------------------------------------------------------
// enrichFinding: flags whether an open finding has blown past its target date.
// ---------------------------------------------------------------------------
export function enrichFinding(finding, today = todayUTC(), models = []) {
  const closedStates = ['fixed', 'closed'];
  const target = parseDate(finding.targetDate);
  const overdue = !closedStates.includes(finding.status) && target !== null && target < today;
  const daysToTarget = target ? diffDays(target, today) : null;
  const model = models.find((m) => m.id === finding.modelId);
  return { ...finding, overdue, daysToTarget, modelName: model ? model.name : '(unknown model)' };
}

// ---------------------------------------------------------------------------
// getMethodology: a description of the scheme for the front-end Methodology
// page and the live tier-preview in the add/edit form.
// ---------------------------------------------------------------------------
export function getMethodology(settings = DEFAULT_SETTINGS) {
  return {
    factors: FACTORS,
    scoreLabels: SCORE_LABELS,
    tierThresholds: { tier1: round2(TIER_THRESHOLDS.tier1), tier2: round2(TIER_THRESHOLDS.tier2) },
    tiers: TIER_META,
    validation: VALIDATION_META,
    validationIntervalsMonths: settings.validationIntervalsMonths,
    dueSoonWindowDays: settings.dueSoonWindowDays,
  };
}

// Used by the routes to sanitise the five factor scores on save.
export { clampScore };
