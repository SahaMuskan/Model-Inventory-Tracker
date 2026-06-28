// ---------------------------------------------------------------------------
// app.js — front-end router and all views.
// ---------------------------------------------------------------------------
import { api } from './api.js';
import {
  esc, fmtDate, daysPhrase, tierBadge, valBadge, sevBadge,
  findingStatusBadge, modelStatusBadge, toast, openModal, confirmDialog,
} from './ui.js';

const appEl = () => document.getElementById('app');
const TIER_COLORS = { 1: '#dc2626', 2: '#d97706', 3: '#059669' };
const SEV_COLORS = { Critical: '#991b1b', High: '#dc2626', Medium: '#d97706', Low: '#64748b' };
const VAL_COLORS = { overdue: '#dc2626', due_soon: '#d97706', current: '#059669', pending_initial: '#4f46e5' };
const scoreColor = (s) => ({ 1: '#059669', 2: '#d97706', 3: '#dc2626' }[s] || '#64748b');

const MODEL_TYPES = ['PD (Probability of Default)', 'LGD (Loss Given Default)', 'EAD (Exposure at Default)',
  'IFRS 9 / Impairment (ECL)', 'Economic Capital', 'Stress Testing', 'Pricing', 'Fraud (ML classifier)',
  'AML / Transaction Monitoring', 'Counterparty Credit Risk (CVA)', 'IRRBB / ALM', 'Liquidity / LCR',
  'Application Scorecard', 'Marketing / Propensity (ML)', 'Climate Risk Scenario'];
const BUSINESS_UNITS = ['Retail Banking', 'Cards & Unsecured', 'Business & Commercial Banking',
  'Corporate & Institutional Banking', 'Markets / Treasury', 'Financial Crime', 'Group Risk', 'Finance'];

let methCache = null;
async function getMethodology() { if (!methCache) methCache = await api.methodology(); return methCache; }

// ---------- helpers ----------
function setHeader(title, subtitle = '') {
  document.getElementById('page-title').textContent = title;
  document.getElementById('page-subtitle').textContent = subtitle;
}
function setActions(buttons = []) {
  const root = document.getElementById('topbar-actions');
  root.innerHTML = '';
  for (const b of buttons) {
    const el = document.createElement('button');
    el.className = 'btn ' + (b.cls || '');
    el.innerHTML = b.label;
    el.onclick = b.onClick;
    root.appendChild(el);
  }
}
const go = (hash) => { location.hash = hash; };
const opt = (v, label, sel) => `<option value="${esc(v)}" ${sel ? 'selected' : ''}>${esc(label)}</option>`;

function legendBars(items) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return `<div class="legend">` + items.map((i) => `
    <div class="legend-row">
      <div class="lr-label">${i.badge || ''}<span>${esc(i.label)}</span></div>
      <div class="lr-track"><div class="lr-fill" style="width:${Math.round((i.value / max) * 100)}%;background:${i.color}"></div></div>
      <div class="lr-num">${i.value}</div>
    </div>`).join('') + `</div>`;
}

// =========================================================================
// DASHBOARD
// =========================================================================
async function viewDashboard() {
  setHeader('Dashboard', 'A single view of model risk, validation status and open issues.');
  setActions([{ label: '+ Add model', cls: 'btn-primary', onClick: () => openModelForm() }]);
  const d = await api.dashboard();

  const stats = [
    { label: 'Active models', value: d.totals.activeModels, hint: `${d.totals.inDevelopment} in development · ${d.totals.retired} retired`, color: '#1d4ed8' },
    { label: 'Tier 1 (high risk)', value: d.tierCounts[1], hint: `${d.tierCounts[2]} Tier 2 · ${d.tierCounts[3]} Tier 3`, color: TIER_COLORS[1] },
    { label: 'Overdue validations', value: d.validationCounts.overdue, hint: `${d.validationCounts.due_soon} due within 90 days`, color: '#dc2626' },
    { label: 'Open findings', value: d.totals.openFindings, hint: `${d.totals.overdueFindings} past target date`, color: '#d97706' },
  ];
  const statHtml = stats.map((s) => `
    <div class="stat"><div class="accent-bar" style="background:${s.color}"></div>
      <div class="label">${esc(s.label)}</div>
      <div class="value" style="color:${s.color}">${s.value}</div>
      <div class="hint">${esc(s.hint)}</div>
    </div>`).join('');

  const tierBars = legendBars([
    { label: 'Tier 1 — High', value: d.tierCounts[1], color: TIER_COLORS[1], badge: dot(TIER_COLORS[1]) },
    { label: 'Tier 2 — Medium', value: d.tierCounts[2], color: TIER_COLORS[2], badge: dot(TIER_COLORS[2]) },
    { label: 'Tier 3 — Low', value: d.tierCounts[3], color: TIER_COLORS[3], badge: dot(TIER_COLORS[3]) },
  ]);
  const valBars = legendBars([
    { label: 'Overdue', value: d.validationCounts.overdue, color: VAL_COLORS.overdue, badge: dot(VAL_COLORS.overdue) },
    { label: 'Due soon (≤90d)', value: d.validationCounts.due_soon, color: VAL_COLORS.due_soon, badge: dot(VAL_COLORS.due_soon) },
    { label: 'Current', value: d.validationCounts.current, color: VAL_COLORS.current, badge: dot(VAL_COLORS.current) },
    { label: 'Pending initial', value: d.validationCounts.pending_initial, color: VAL_COLORS.pending_initial, badge: dot(VAL_COLORS.pending_initial) },
  ]);
  const sevBars = legendBars([
    { label: 'Critical', value: d.severityCounts.Critical, color: SEV_COLORS.Critical, badge: dot(SEV_COLORS.Critical) },
    { label: 'High', value: d.severityCounts.High, color: SEV_COLORS.High, badge: dot(SEV_COLORS.High) },
    { label: 'Medium', value: d.severityCounts.Medium, color: SEV_COLORS.Medium, badge: dot(SEV_COLORS.Medium) },
    { label: 'Low', value: d.severityCounts.Low, color: SEV_COLORS.Low, badge: dot(SEV_COLORS.Low) },
  ]);

  const glance = `<div class="kv">
    ${kvRow('Models in use', d.totals.inUse)}
    ${kvRow('In development', d.totals.inDevelopment)}
    ${kvRow('Retired', d.totals.retired)}
    ${kvRow('Vendor (bought-in)', d.totals.vendor)}
    ${kvRow('Used for regulatory purposes', d.totals.regulatory)}
    ${kvRow('Total open findings', d.totals.openFindings)}
  </div>`;

  const upcomingRows = d.upcoming.map((u) => `
    <tr class="clickable" data-id="${esc(u.id)}">
      <td class="cell-id">${esc(u.id)}</td>
      <td class="cell-strong">${esc(u.name)}</td>
      <td>${tierBadge(u.tier, u.tierShort)}</td>
      <td class="nowrap">${fmtDate(u.lastValidated)}</td>
      <td class="nowrap">${u.nextDue ? fmtDate(u.nextDue) : '—'}</td>
      <td>${valBadge(u.status, u.statusLabel)}</td>
      <td class="nowrap muted">${u.daysUntilDue === null ? esc(u.statusLabel) : esc(daysPhrase(u.daysUntilDue))}</td>
    </tr>`).join('') || emptyRow(7, 'No validations scheduled.');

  appEl().innerHTML = `
    <div class="grid grid-4" style="margin-bottom:18px">${statHtml}</div>
    <div class="grid grid-3" style="margin-bottom:18px">
      <div class="card"><div class="card-head"><h3>Models by risk tier</h3></div><div class="card-pad">${tierBars}</div></div>
      <div class="card"><div class="card-head"><h3>Validation status</h3></div><div class="card-pad">${valBars}</div></div>
      <div class="card"><div class="card-head"><h3>Open issues by severity</h3></div><div class="card-pad">${sevBars}</div></div>
    </div>
    <div class="grid" style="grid-template-columns: 1.6fr 1fr; gap:18px">
      <div class="card">
        <div class="card-head"><h3>Upcoming &amp; overdue validations</h3><span class="sub">Most urgent first</span></div>
        <div class="table-wrap"><table class="tbl">
          <thead><tr><th>ID</th><th>Model</th><th>Tier</th><th>Last validated</th><th>Next due</th><th>Status</th><th>Timing</th></tr></thead>
          <tbody>${upcomingRows}</tbody>
        </table></div>
      </div>
      <div class="card"><div class="card-head"><h3>Portfolio at a glance</h3></div><div class="card-pad">${glance}</div></div>
    </div>`;

  appEl().querySelectorAll('tr.clickable').forEach((tr) => {
    tr.onclick = () => go('/models/' + tr.dataset.id);
  });
}
const dot = (c) => `<span class="dot" style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${c}"></span>`;
const kvRow = (k, v) => `<div class="k">${esc(k)}</div><div class="v">${typeof v === 'string' ? v : esc(String(v))}</div>`;
const emptyRow = (cols, msg) => `<tr><td colspan="${cols}" class="center muted" style="padding:28px">${esc(msg)}</td></tr>`;

// =========================================================================
// MODEL REGISTER (list)
// =========================================================================
async function viewModelList() {
  setHeader('Model Register', 'The master list of every model in the organisation.');
  setActions([{ label: '+ Add model', cls: 'btn-primary', onClick: () => openModelForm() }]);
  const models = await api.models();

  appEl().innerHTML = `
    <div class="toolbar">
      <input class="input search" id="f-search" placeholder="Search name, ID, owner, unit…" />
      <select class="select" id="f-tier"><option value="">All tiers</option><option value="1">Tier 1</option><option value="2">Tier 2</option><option value="3">Tier 3</option></select>
      <select class="select" id="f-status"><option value="">All statuses</option><option value="in_use">In use</option><option value="development">In development</option><option value="retired">Retired</option></select>
      <select class="select" id="f-val"><option value="">All validation states</option><option value="overdue">Overdue</option><option value="due_soon">Due soon</option><option value="current">Current</option><option value="pending_initial">Pending initial</option></select>
      <div class="spacer"></div>
      <span class="muted" id="f-count"></span>
    </div>
    <div class="card"><div class="table-wrap"><table class="tbl">
      <thead><tr><th>ID</th><th>Model</th><th>Business unit</th><th>Build</th><th>Risk tier</th><th>Validation</th><th>Owner</th></tr></thead>
      <tbody id="model-rows"></tbody>
    </table></div></div>`;

  const tbody = document.getElementById('model-rows');
  const render = () => {
    const q = document.getElementById('f-search').value.toLowerCase().trim();
    const ft = document.getElementById('f-tier').value;
    const fs = document.getElementById('f-status').value;
    const fv = document.getElementById('f-val').value;
    const rows = models.filter((m) => {
      if (ft && String(m.risk.tier) !== ft) return false;
      if (fs && m.status !== fs) return false;
      if (fv && m.validation.status !== fv) return false;
      if (q) {
        const hay = `${m.id} ${m.name} ${m.owner} ${m.businessUnit} ${m.modelType}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    document.getElementById('f-count').textContent = `${rows.length} of ${models.length} models`;
    tbody.innerHTML = rows.map((m) => `
      <tr class="clickable" data-id="${esc(m.id)}">
        <td class="cell-id">${esc(m.id)}</td>
        <td><div class="cell-strong">${esc(m.name)}</div><div class="muted" style="font-size:12px">${esc(m.modelType)}</div></td>
        <td>${esc(m.businessUnit)}</td>
        <td>${m.buildType === 'vendor' ? `<span class="badge b-blue">Vendor</span>` : `<span class="badge b-slate">In-house</span>`}</td>
        <td>${tierBadge(m.risk.tier, m.risk.tierShort)} <span class="muted" style="font-size:11px">${m.risk.weightedScore}</span></td>
        <td>${valBadge(m.validation.status, m.validation.statusLabel)}</td>
        <td>${esc(m.owner || '—')}</td>
      </tr>`).join('') || emptyRow(7, 'No models match your filters.');
    tbody.querySelectorAll('tr.clickable').forEach((tr) => { tr.onclick = () => go('/models/' + tr.dataset.id); });
  };
  ['f-search', 'f-tier', 'f-status', 'f-val'].forEach((id) => {
    document.getElementById(id).addEventListener('input', render);
  });
  render();
}

// =========================================================================
// MODEL DETAIL
// =========================================================================
async function viewModelDetail(id) {
  let m;
  try { m = await api.model(id); }
  catch (e) { appEl().innerHTML = `<div class="empty"><div class="big">🔍</div>Model “${esc(id)}” not found.</div>`; setHeader('Model not found'); setActions([{ label: '← Register', cls: 'btn-ghost', onClick: () => go('/models') }]); return; }

  setHeader(m.name, `${m.id} · ${m.modelType}`);
  setActions([
    { label: '← Register', cls: 'btn-ghost', onClick: () => go('/models') },
    { label: '✎ Edit', onClick: () => openModelForm(m) },
    { label: '🗑 Delete', cls: 'btn-danger', onClick: () => deleteModel(m) },
  ]);

  // Risk breakdown
  const maxContribution = Math.max(...m.risk.breakdown.map((b) => b.contribution));
  const breakdownRows = m.risk.breakdown.map((b) => `
    <tr>
      <td><div class="cell-strong">${esc(b.label)}</div></td>
      <td><span class="badge score-pill" style="color:${scoreColor(b.score)};background:${scoreColor(b.score)}1a;border-color:${scoreColor(b.score)}55">${b.score} · ${esc(b.scoreLabel)}</span></td>
      <td class="muted">${b.weightPct}%</td>
      <td style="min-width:160px">
        <div style="display:flex;align-items:center;gap:10px">
          <div class="bar-track"><div class="bar-fill" style="width:${Math.round((b.contribution / maxContribution) * 100)}%;background:${scoreColor(b.score)}"></div></div>
          <span class="muted nowrap" style="font-variant-numeric:tabular-nums">${b.contribution.toFixed(2)}</span>
        </div>
      </td>
    </tr>`).join('');

  const riskCard = `
    <div class="card" style="margin-bottom:18px">
      <div class="card-head"><h3>Risk rating</h3><span class="sub">Computed from the factors below — not entered by hand</span></div>
      <div class="card-pad">
        <div class="score-hero">
          <div class="score-ring" style="--pct:${m.risk.score100};--ring-color:${m.risk.tierColor}">
            <div class="inner"><div><div class="num" style="color:${m.risk.tierColor}">${m.risk.score100}</div><div class="of">/ 100</div></div></div>
          </div>
          <div>
            <div style="margin-bottom:8px">${tierBadge(m.risk.tier, m.risk.tierLabel)}</div>
            <div class="muted">Weighted score <strong style="color:var(--text)">${m.risk.weightedScore}</strong> / 3.00</div>
            <div class="muted" style="font-size:12px;margin-top:6px;max-width:360px">The score is a weighted average of the five factors. Higher weight on materiality and regulatory impact.</div>
          </div>
          <div style="flex:1;min-width:280px">
            <table class="breakdown">
              <thead><tr><th>Factor</th><th>Assessment</th><th>Weight</th><th>Contribution</th></tr></thead>
              <tbody>${breakdownRows}</tbody>
            </table>
          </div>
        </div>
      </div>
    </div>`;

  const depList = (arr) => arr.length
    ? arr.map((x) => `<a href="#/models/${esc(x.id)}">${esc(x.id)}</a>`).join(', ')
    : '<span class="faint">None</span>';

  const detailsCard = `
    <div class="card">
      <div class="card-head"><h3>Model details</h3></div>
      <div class="card-pad"><div class="kv">
        ${kvRow('Purpose', esc(m.purpose) || '—')}
        ${kvRow('Owner', esc(m.owner) || '—')}
        ${kvRow('Developer', esc(m.developer) || '—')}
        ${kvRow('Validator', esc(m.validator) || '—')}
        ${kvRow('Business unit', esc(m.businessUnit) || '—')}
        ${kvRow('Model type', esc(m.modelType) || '—')}
        ${kvRow('Build', m.buildType === 'vendor' ? `Vendor${m.vendorName ? ' — ' + esc(m.vendorName) : ''}` : 'In-house')}
        ${kvRow('Regulatory use', m.regulatoryUse ? '<span class="badge b-blue">Yes</span>' : '<span class="badge b-slate">No</span>')}
        ${kvRow('Status', modelStatusBadge(m.status))}
        ${kvRow('Go-live date', fmtDate(m.goLiveDate))}
        ${kvRow('Depends on', depList(m.dependsOnDetails))}
        ${kvRow('Feeds into', depList(m.feedsInto))}
        ${kvRow('Known limitations', esc(m.limitations) || '—')}
      </div></div>
    </div>`;

  const v = m.validation;
  const validationCard = `
    <div class="card">
      <div class="card-head"><h3>Validation &amp; lifecycle</h3></div>
      <div class="card-pad"><div class="kv">
        ${kvRow('Risk tier', tierBadge(m.risk.tier, m.risk.tierShort))}
        ${kvRow('Validation status', valBadge(v.status, v.statusLabel))}
        ${kvRow('Last validated', fmtDate(v.lastValidated))}
        ${kvRow('Re-validation interval', v.intervalMonths ? `Every ${v.intervalMonths} months` : '—')}
        ${kvRow('Next due', v.nextDue ? fmtDate(v.nextDue) : '—')}
        ${kvRow('Timing', v.daysUntilDue === null || v.daysUntilDue === undefined ? (v.note ? esc(v.note) : '—') : esc(daysPhrase(v.daysUntilDue)))}
      </div>
      ${v.note && v.daysUntilDue !== null && v.daysUntilDue !== undefined ? `<div class="banner banner-info" style="margin-top:14px">${esc(v.note)}</div>` : ''}
      </div>
    </div>`;

  // Findings for this model
  window.__findingsCache = m.findings || [];
  const fRows = (m.findings || []).map((f) => findingRowHtml(f, false)).join('') || emptyRow(7, 'No findings logged against this model.');
  const findingsCard = `
    <div class="card" style="margin-top:18px">
      <div class="card-head"><h3>Findings &amp; issues</h3>
        <button class="btn btn-sm btn-primary" id="add-finding">+ Add finding</button></div>
      <div class="table-wrap"><table class="tbl">
        <thead><tr><th>ID</th><th>Source</th><th>Severity</th><th>Description</th><th>Target date</th><th>Status</th><th></th></tr></thead>
        <tbody id="finding-rows">${fRows}</tbody>
      </table></div>
    </div>`;

  appEl().innerHTML = riskCard +
    `<div class="grid grid-2">${detailsCard}${validationCard}</div>` +
    findingsCard;

  document.getElementById('add-finding').onclick = () => openFindingForm(null, m.id);
  wireFindingRows(document.getElementById('finding-rows'), () => viewModelDetail(id));
}

async function deleteModel(m) {
  if (!(await confirmDialog(`Delete ${m.id} “${m.name}”?\n\nThis also removes its findings and dependency links. This cannot be undone.`))) return;
  try { await api.deleteModel(m.id); toast(`Deleted ${m.id}`); go('/models'); }
  catch (e) { toast(e.message, 'err'); }
}

// =========================================================================
// VALIDATION SCHEDULE
// =========================================================================
async function viewValidation() {
  setHeader('Validation Schedule', 'When each model is next due for re-validation, driven by its risk tier.');
  setActions([]);
  const [models, settings] = await Promise.all([api.models(), api.settings()]);

  const rank = { overdue: 0, due_soon: 1, current: 2, pending_initial: 3, not_applicable: 4 };
  const applicable = models.filter((m) => m.validation.applicable)
    .sort((a, b) => {
      const ra = rank[a.validation.status] ?? 9, rb = rank[b.validation.status] ?? 9;
      if (ra !== rb) return ra - rb;
      return (a.validation.daysUntilDue ?? 1e9) - (b.validation.daysUntilDue ?? 1e9);
    });

  const counts = { overdue: 0, due_soon: 0, current: 0, pending_initial: 0 };
  applicable.forEach((m) => { if (m.validation.status in counts) counts[m.validation.status]++; });

  const tiles = [
    { label: 'Overdue', value: counts.overdue, color: VAL_COLORS.overdue },
    { label: 'Due soon (≤' + settings.dueSoonWindowDays + 'd)', value: counts.due_soon, color: VAL_COLORS.due_soon },
    { label: 'Current', value: counts.current, color: VAL_COLORS.current },
    { label: 'Pending initial', value: counts.pending_initial, color: VAL_COLORS.pending_initial },
  ].map((t) => `<div class="stat"><div class="accent-bar" style="background:${t.color}"></div>
      <div class="label">${esc(t.label)}</div><div class="value" style="color:${t.color}">${t.value}</div></div>`).join('');

  const settingsCard = `
    <div class="card" style="margin:18px 0">
      <div class="card-head"><h3>Schedule settings</h3><span class="sub">How often each tier must be re-validated</span></div>
      <div class="card-pad">
        <div class="form-grid">
          <div class="fld"><label>Tier 1 (high) — months</label><input type="number" min="1" max="120" id="iv1" value="${settings.validationIntervalsMonths[1]}"></div>
          <div class="fld"><label>Tier 2 (medium) — months</label><input type="number" min="1" max="120" id="iv2" value="${settings.validationIntervalsMonths[2]}"></div>
          <div class="fld"><label>Tier 3 (low) — months</label><input type="number" min="1" max="120" id="iv3" value="${settings.validationIntervalsMonths[3]}"></div>
          <div class="fld"><label>“Due soon” window — days</label><input type="number" min="1" max="365" id="ivd" value="${settings.dueSoonWindowDays}"></div>
        </div>
        <div style="margin-top:14px;display:flex;gap:10px;align-items:center">
          <button class="btn btn-primary" id="save-settings">Save schedule</button>
          <span class="muted" style="font-size:12px">Changing these recalculates every model's next-due date.</span>
        </div>
      </div>
    </div>`;

  const rows = applicable.map((m) => {
    const v = m.validation;
    const alert = v.status === 'overdue';
    return `<tr class="clickable ${alert ? 'row-alert' : ''}" data-id="${esc(m.id)}">
      <td class="cell-id">${esc(m.id)}</td>
      <td class="cell-strong">${esc(m.name)}</td>
      <td>${tierBadge(m.risk.tier, m.risk.tierShort)}</td>
      <td class="nowrap">${fmtDate(v.lastValidated)}</td>
      <td class="nowrap muted">${v.intervalMonths} mo</td>
      <td class="nowrap">${v.nextDue ? fmtDate(v.nextDue) : '—'}</td>
      <td>${valBadge(v.status, v.statusLabel)}</td>
      <td class="nowrap muted">${v.daysUntilDue === null || v.daysUntilDue === undefined ? esc(v.note || '') : esc(daysPhrase(v.daysUntilDue))}</td>
    </tr>`;
  }).join('') || emptyRow(8, 'No models with a validation obligation.');

  appEl().innerHTML = `
    <div class="grid grid-4">${tiles}</div>
    ${settingsCard}
    <div class="card">
      <div class="card-head"><h3>Re-validation schedule</h3><span class="sub">Most urgent first · retired models excluded</span></div>
      <div class="table-wrap"><table class="tbl">
        <thead><tr><th>ID</th><th>Model</th><th>Tier</th><th>Last validated</th><th>Interval</th><th>Next due</th><th>Status</th><th>Timing</th></tr></thead>
        <tbody>${rows}</tbody>
      </table></div>
    </div>`;

  appEl().querySelectorAll('tr.clickable').forEach((tr) => { tr.onclick = () => go('/models/' + tr.dataset.id); });
  document.getElementById('save-settings').onclick = async () => {
    const payload = {
      validationIntervalsMonths: {
        1: +document.getElementById('iv1').value,
        2: +document.getElementById('iv2').value,
        3: +document.getElementById('iv3').value,
      },
      dueSoonWindowDays: +document.getElementById('ivd').value,
    };
    try { await api.updateSettings(payload); toast('Schedule updated'); viewValidation(); }
    catch (e) { toast(e.message, 'err'); }
  };
}

// =========================================================================
// FINDINGS
// =========================================================================
function findingRowHtml(f, showModel = true) {
  return `<tr class="${f.overdue ? 'row-alert' : ''}" data-id="${esc(f.id)}">
    <td class="cell-id">${esc(f.id)}</td>
    ${showModel ? `<td><a href="#/models/${esc(f.modelId)}">${esc(f.modelId)}</a><div class="muted" style="font-size:12px">${esc(f.modelName)}</div></td>` : ''}
    <td class="nowrap">${esc(f.source)}</td>
    <td>${sevBadge(f.severity)}</td>
    <td style="max-width:340px">${esc(f.description)}</td>
    <td class="nowrap">${fmtDate(f.targetDate)}${f.overdue ? ' <span class="badge b-red" style="margin-left:4px">Overdue</span>' : ''}</td>
    <td>${findingStatusBadge(f.status)}</td>
    <td class="cell-actions">
      <button class="btn btn-sm btn-ghost" data-act="edit" data-id="${esc(f.id)}">✎</button>
      <button class="btn btn-sm btn-ghost" data-act="del" data-id="${esc(f.id)}">🗑</button>
    </td>
  </tr>`;
}

function wireFindingRows(container, refresh) {
  container.querySelectorAll('button[data-act]').forEach((btn) => {
    btn.onclick = async (e) => {
      e.stopPropagation();
      const id = btn.dataset.id;
      const all = window.__findingsCache || [];
      const f = all.find((x) => x.id === id);
      if (btn.dataset.act === 'edit') openFindingForm(f, null, refresh);
      else if (btn.dataset.act === 'del') {
        if (!(await confirmDialog(`Delete finding ${id}? This cannot be undone.`))) return;
        try { await api.deleteFinding(id); toast(`Deleted ${id}`); refresh(); }
        catch (err) { toast(err.message, 'err'); }
      }
    };
  });
}

async function viewFindings() {
  setHeader('Findings & Issues', 'Track problems raised against models through to resolution.');
  setActions([{ label: '+ Add finding', cls: 'btn-primary', onClick: () => openFindingForm(null, null, viewFindings) }]);
  const [findings, models] = await Promise.all([api.findings(), api.models()]);
  window.__findingsCache = findings;

  const modelOptions = ['<option value="">All models</option>']
    .concat(models.map((m) => `<option value="${esc(m.id)}">${esc(m.id)} — ${esc(m.name)}</option>`)).join('');

  appEl().innerHTML = `
    <div class="toolbar">
      <input class="input search" id="f-search" placeholder="Search description, owner…" />
      <select class="select" id="f-model">${modelOptions}</select>
      <select class="select" id="f-status"><option value="">All statuses</option><option>Open</option><option>In Progress</option><option>Fixed</option><option>Closed</option></select>
      <select class="select" id="f-sev"><option value="">All severities</option><option>Critical</option><option>High</option><option>Medium</option><option>Low</option></select>
      <select class="select" id="f-source"><option value="">All sources</option><option>Validation</option><option>Ongoing Monitoring</option><option>Internal Audit</option><option>Regulator</option></select>
      <label class="check" style="margin-left:4px"><input type="checkbox" id="f-overdue"> <span class="muted">Overdue only</span></label>
      <div class="spacer"></div>
      <span class="muted" id="f-count"></span>
    </div>
    <div class="card"><div class="table-wrap"><table class="tbl">
      <thead><tr><th>ID</th><th>Model</th><th>Source</th><th>Severity</th><th>Description</th><th>Target date</th><th>Status</th><th></th></tr></thead>
      <tbody id="finding-rows"></tbody>
    </table></div></div>`;

  const tbody = document.getElementById('finding-rows');
  const sevRank = { Critical: 0, High: 1, Medium: 2, Low: 3 };
  const render = () => {
    const q = document.getElementById('f-search').value.toLowerCase().trim();
    const fm = document.getElementById('f-model').value;
    const fst = document.getElementById('f-status').value;
    const fsv = document.getElementById('f-sev').value;
    const fsr = document.getElementById('f-source').value;
    const fo = document.getElementById('f-overdue').checked;
    let rows = findings.filter((f) => {
      if (fm && f.modelId !== fm) return false;
      if (fst && f.status !== fst) return false;
      if (fsv && f.severity !== fsv) return false;
      if (fsr && f.source !== fsr) return false;
      if (fo && !f.overdue) return false;
      if (q && !`${f.description} ${f.owner} ${f.modelName} ${f.id}`.toLowerCase().includes(q)) return false;
      return true;
    });
    rows.sort((a, b) => (sevRank[a.severity] - sevRank[b.severity]) || (a.targetDate || '').localeCompare(b.targetDate || ''));
    document.getElementById('f-count').textContent = `${rows.length} of ${findings.length} findings`;
    tbody.innerHTML = rows.map((f) => findingRowHtml(f, true)).join('') || emptyRow(8, 'No findings match your filters.');
    wireFindingRows(tbody, viewFindings);
  };
  ['f-search', 'f-model', 'f-status', 'f-sev', 'f-source', 'f-overdue'].forEach((id) => {
    document.getElementById(id).addEventListener('input', render);
  });
  render();
}

// =========================================================================
// METHODOLOGY
// =========================================================================
async function viewMethodology() {
  setHeader('Methodology', 'How the automatic risk rating works — and why.');
  setActions([]);
  const meth = await getMethodology();

  const factorRows = meth.factors.map((f) => `
    <tr>
      <td class="cell-strong">${esc(f.label)}</td>
      <td><span class="badge b-blue">${Math.round(f.weight * 100)}%</span></td>
      <td>${esc(f.question)}</td>
      <td class="muted" style="font-size:12px">1 ${esc(meth.scoreLabels[1])} · 2 ${esc(meth.scoreLabels[2])} · 3 ${esc(meth.scoreLabels[3])}</td>
    </tr>`).join('');

  const tierRows = [1, 2, 3].map((t) => `
    <tr>
      <td>${tierBadge(t, meth.tiers[t].label)}</td>
      <td class="muted">${t === 1 ? `score ≥ ${meth.tierThresholds.tier1}` : t === 2 ? `${meth.tierThresholds.tier2} ≤ score < ${meth.tierThresholds.tier1}` : `score < ${meth.tierThresholds.tier2}`}</td>
      <td class="nowrap">Every ${meth.validationIntervalsMonths[t]} months</td>
      <td class="muted">${esc(meth.tiers[t].description)}</td>
    </tr>`).join('');

  appEl().innerHTML = `
    <div class="prose">
      <div class="card"><div class="card-pad">
        <p>Every model is scored on <strong>five risk factors</strong>. Each factor is rated <strong>Low (1)</strong>, <strong>Medium (2)</strong> or <strong>High (3)</strong>. The factors are combined into a single <strong>weighted score</strong> on a 1–3 scale, which is then mapped to an overall <strong>risk tier</strong>. The tier in turn sets how often the model must be re-validated.</p>
        <p>Crucially, the tier is <strong>calculated, never typed in by hand</strong> — and the individual factor scores are always shown alongside the result, so any rating can be explained and challenged.</p>
      </div></div>

      <h3>The five factors and their weights</h3>
      <div class="card"><div class="table-wrap"><table class="tbl">
        <thead><tr><th>Factor</th><th>Weight</th><th>What it captures</th><th>Scale</th></tr></thead>
        <tbody>${factorRows}</tbody>
      </table></div></div>

      <h3>How the score is calculated</h3>
      <div class="card"><div class="card-pad">
        <div class="formula">weighted score = 0.30·Materiality + 0.25·Regulatory + 0.20·Reliance + 0.15·Complexity + 0.10·Uncertainty</div>
        <p>Because the weights add up to 1.0, the result is simply a <em>weighted average</em> of the five factor scores, always between 1.00 and 3.00. The 0–100 figure shown on each model is the same number rescaled (1.00 → 0, 3.00 → 100) for quick reading.</p>
        <p><strong>Why these weights?</strong> Materiality leads because the size of the exposure is the biggest driver of potential damage. Regulatory impact is next, because models feeding capital or financial reporting carry regulatory and reputational risk on top of financial risk. Reliance reflects contagion — how widely an error could spread. Complexity captures how hard a model is to challenge (machine-learning/AI rate highest). Uncertainty — data quality and how proven the method is — carries the least weight because it is usually the most fixable.</p>
      </div></div>

      <h3>From score to tier and validation cycle</h3>
      <div class="card"><div class="table-wrap"><table class="tbl">
        <thead><tr><th>Tier</th><th>Score band</th><th>Re-validation</th><th>Meaning</th></tr></thead>
        <tbody>${tierRows}</tbody>
      </table></div></div>

      <h3>Validation status flags</h3>
      <div class="card"><div class="card-pad">
        <p>From the last validation date and the tier's interval, the tool works out each model's next-due date and flags it:</p>
        <ul>
          <li>${valBadge('overdue', 'Overdue')} — the next-due date has passed.</li>
          <li>${valBadge('due_soon', 'Due soon')} — due within the configurable window (currently ${meth.dueSoonWindowDays} days).</li>
          <li>${valBadge('current', 'Current')} — validated and not yet approaching its due date.</li>
          <li>${valBadge('pending_initial', 'Pending initial')} — still in development; first validation not yet due.</li>
        </ul>
        <p class="muted" style="font-size:12px">The score bands split the 1–3 range into three equal parts. Weights and bands are deliberately simple and transparent so the scheme is easy to govern. A plain-English version of this page is in the project's <strong>METHODOLOGY.md</strong> file.</p>
      </div></div>
    </div>`;
}

// =========================================================================
// MODEL FORM (add / edit)
// =========================================================================
async function openModelForm(model = null) {
  const isEdit = !!model;
  const [meth, allModels] = await Promise.all([getMethodology(), api.models()]);
  const m = model || {
    name: '', purpose: '', owner: '', developer: '', validator: '', businessUnit: '',
    modelType: '', buildType: 'in-house', vendorName: '', dependsOn: [], regulatoryUse: false,
    status: 'in_use', goLiveDate: '', lastValidated: '', limitations: '',
    materiality: 2, complexity: 2, reliance: 2, regulatory: 2, uncertainty: 2,
  };

  const typeList = MODEL_TYPES.map((t) => `<option value="${esc(t)}">`).join('');
  const buList = BUSINESS_UNITS.map((t) => `<option value="${esc(t)}">`).join('');
  const depOptions = allModels.filter((x) => x.id !== m.id)
    .map((x) => `<option value="${esc(x.id)}" ${(m.dependsOn || []).includes(x.id) ? 'selected' : ''}>${esc(x.id)} — ${esc(x.name)}</option>`).join('');

  const factorField = (f) => {
    const cur = Number(m[f.key]) || 2;
    const opts = [1, 2, 3].map((s) => `<option value="${s}" ${cur === s ? 'selected' : ''}>${s} — ${esc(meth.scoreLabels[s])}: ${esc(f.levels[s])}</option>`).join('');
    return `<div class="fld">
      <label>${esc(f.label)} <span class="hint">· ${Math.round(f.weight * 100)}% weight</span></label>
      <select name="${f.key}" data-factor>${opts}</select>
    </div>`;
  };

  const body = `
    <div class="form-grid">
      <div class="fld full"><label>Model name *</label><input name="name" required value="${esc(m.name)}" placeholder="e.g. Retail Mortgage PD"></div>
      <div class="fld full"><label>Purpose <span class="hint">· what it is used for</span></label><textarea name="purpose" placeholder="What the model does and where its output is used">${esc(m.purpose)}</textarea></div>

      <div class="fld"><label>Model type</label><input name="modelType" list="dl-types" value="${esc(m.modelType)}" placeholder="e.g. PD, LGD, Fraud"><datalist id="dl-types">${typeList}</datalist></div>
      <div class="fld"><label>Business unit</label><input name="businessUnit" list="dl-bus" value="${esc(m.businessUnit)}"><datalist id="dl-bus">${buList}</datalist></div>

      <div class="fld"><label>Owner</label><input name="owner" value="${esc(m.owner)}"></div>
      <div class="fld"><label>Developer (who built it)</label><input name="developer" value="${esc(m.developer)}"></div>
      <div class="fld"><label>Validator</label><input name="validator" value="${esc(m.validator)}"></div>
      <div class="fld"><label>Status</label><select name="status">
        ${opt('in_use', 'In use', m.status === 'in_use')}${opt('development', 'In development', m.status === 'development')}${opt('retired', 'Retired', m.status === 'retired')}
      </select></div>

      <div class="fld"><label>Build type</label><select name="buildType" id="fld-build">
        ${opt('in-house', 'In-house', m.buildType === 'in-house')}${opt('vendor', 'Vendor (bought-in)', m.buildType === 'vendor')}
      </select></div>
      <div class="fld"><label>Vendor name <span class="hint">· if bought-in</span></label><input name="vendorName" value="${esc(m.vendorName)}" placeholder="e.g. ClimaRisk Analytics"></div>

      <div class="fld"><label>Go-live date</label><input type="date" name="goLiveDate" value="${esc(m.goLiveDate)}"></div>
      <div class="fld"><label>Last validated</label><input type="date" name="lastValidated" value="${esc(m.lastValidated)}"></div>

      <div class="fld full check" style="margin-top:4px"><input type="checkbox" name="regulatoryUse" id="fld-reg" ${m.regulatoryUse ? 'checked' : ''}><label for="fld-reg" style="margin:0">Used for regulatory purposes (capital, financial reporting, external submissions)</label></div>

      <div class="fld full"><label>Depends on / draws from <span class="hint">· Ctrl/Cmd-click to select several. “Feeds into” is derived automatically.</span></label>
        <select name="dependsOn" multiple>${depOptions || '<option disabled>No other models yet</option>'}</select></div>

      <div class="fld full"><label>Known weaknesses / limitations</label><textarea name="limitations">${esc(m.limitations)}</textarea></div>

      <div class="section-title">Risk factors — the rating is calculated from these</div>
      ${meth.factors.map(factorField).join('')}

      <div class="preview-box" id="tier-preview">
        <div><div class="pv-label">Calculated rating</div><div class="pv-score" id="pv-score">—</div></div>
        <div id="pv-badge"></div>
      </div>
    </div>`;

  const modal = openModal({
    title: isEdit ? `Edit ${m.id}` : 'Add a new model',
    bodyHtml: body, wide: true,
    submitLabel: isEdit ? 'Save changes' : 'Create model',
    onSubmit: async (data, form) => {
      if (!data.name || !data.name.trim()) throw new Error('A model name is required.');
      data.regulatoryUse = form.querySelector('[name=regulatoryUse]').checked;
      const depSel = form.querySelector('[name=dependsOn]');
      data.dependsOn = depSel ? Array.from(depSel.selectedOptions).map((o) => o.value).filter((v) => v) : [];
      if (isEdit) { await api.updateModel(m.id, data); toast(`Saved ${m.id}`); }
      else { const created = await api.createModel(data); toast(`Created ${created.id}`); }
      refreshCurrent();
    },
  });

  // Live tier preview
  const updatePreview = () => {
    let total = 0;
    meth.factors.forEach((f) => { total += (Number(modal.form.querySelector(`[name=${f.key}]`).value) || 2) * f.weight; });
    const tier = total >= meth.tierThresholds.tier1 ? 1 : total >= meth.tierThresholds.tier2 ? 2 : 3;
    const score100 = Math.round(((total - 1) / 2) * 100);
    modal.form.querySelector('#pv-score').textContent = `${(Math.round(total * 100) / 100).toFixed(2)} / 3.00  ·  ${score100}/100`;
    modal.form.querySelector('#pv-badge').innerHTML = tierBadge(tier, meth.tiers[tier].label);
  };
  modal.form.querySelectorAll('[data-factor]').forEach((s) => s.addEventListener('change', updatePreview));
  updatePreview();
}

// =========================================================================
// FINDING FORM (add / edit)
// =========================================================================
async function openFindingForm(finding = null, presetModelId = null, refresh = null) {
  const isEdit = !!finding;
  const models = await api.models();
  const f = finding || {
    modelId: presetModelId || '', source: 'Validation', severity: 'Medium', description: '',
    owner: '', dateRaised: new Date().toISOString().slice(0, 10), targetDate: '', status: 'Open',
  };
  const modelOptions = models.map((m) => `<option value="${esc(m.id)}" ${f.modelId === m.id ? 'selected' : ''}>${esc(m.id)} — ${esc(m.name)}</option>`).join('');
  const sel = (name, list, cur) => `<select name="${name}">${list.map((o) => opt(o, o, cur === o)).join('')}</select>`;

  const body = `
    <div class="form-grid">
      <div class="fld full"><label>Model *</label><select name="modelId" required ${presetModelId && !isEdit ? '' : ''}>
        <option value="">Select a model…</option>${modelOptions}</select></div>
      <div class="fld"><label>Source</label>${sel('source', ['Validation', 'Ongoing Monitoring', 'Internal Audit', 'Regulator'], f.source)}</div>
      <div class="fld"><label>Severity</label>${sel('severity', ['Critical', 'High', 'Medium', 'Low'], f.severity)}</div>
      <div class="fld full"><label>Description *</label><textarea name="description" required placeholder="What is the issue?">${esc(f.description)}</textarea></div>
      <div class="fld"><label>Owner (who fixes it)</label><input name="owner" value="${esc(f.owner)}"></div>
      <div class="fld"><label>Status</label>${sel('status', ['Open', 'In Progress', 'Fixed', 'Closed'], f.status)}</div>
      <div class="fld"><label>Date raised</label><input type="date" name="dateRaised" value="${esc(f.dateRaised)}"></div>
      <div class="fld"><label>Target fix date</label><input type="date" name="targetDate" value="${esc(f.targetDate)}"></div>
    </div>`;

  openModal({
    title: isEdit ? `Edit ${f.id}` : 'Add a finding',
    bodyHtml: body,
    submitLabel: isEdit ? 'Save changes' : 'Create finding',
    onSubmit: async (data) => {
      if (!data.modelId) throw new Error('Please choose a model.');
      if (!data.description || !data.description.trim()) throw new Error('A description is required.');
      if (isEdit) { await api.updateFinding(f.id, data); toast(`Saved ${f.id}`); }
      else { const c = await api.createFinding(data); toast(`Created ${c.id}`); }
      if (refresh) refresh(); else refreshCurrent();
    },
  });
}

// =========================================================================
// ROUTER
// =========================================================================
const routes = [
  { re: /^\/?$/, view: viewDashboard },
  { re: /^\/dashboard$/, view: viewDashboard },
  { re: /^\/models$/, view: viewModelList },
  { re: /^\/models\/(.+)$/, view: (m) => viewModelDetail(decodeURIComponent(m[1])) },
  { re: /^\/validation$/, view: viewValidation },
  { re: /^\/findings$/, view: viewFindings },
  { re: /^\/methodology$/, view: viewMethodology },
];

function currentPath() { return location.hash.replace(/^#/, '') || '/dashboard'; }

async function router() {
  const path = currentPath();
  // highlight nav
  document.querySelectorAll('#nav a').forEach((a) => {
    const r = a.getAttribute('data-route');
    a.classList.toggle('active', path === r || (r === '/models' && path.startsWith('/models')) || (r === '/dashboard' && path === '/'));
  });
  const match = routes.find((r) => r.re.test(path));
  appEl().innerHTML = '<div class="loading">Loading…</div>';
  try {
    if (match) await match.view(path.match(match.re));
    else { setHeader('Not found'); appEl().innerHTML = `<div class="empty"><div class="big">🤷</div>Page not found.</div>`; }
  } catch (e) {
    console.error(e);
    appEl().innerHTML = `<div class="empty"><div class="big">⚠️</div>Could not load this page.<div class="muted" style="margin-top:8px">${esc(e.message)}</div></div>`;
  }
}
function refreshCurrent() { router(); }

window.addEventListener('hashchange', router);
window.addEventListener('DOMContentLoaded', () => {
  document.getElementById('today-label').textContent = 'Today: ' + new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  router();
});
// In case the module loads after DOMContentLoaded has already fired.
if (document.readyState !== 'loading') {
  const t = document.getElementById('today-label');
  if (t && !t.textContent) t.textContent = 'Today: ' + new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  router();
}
