// Small presentational helpers shared across views: escaping, formatting,
// badges, toasts, and a generic modal dialog.

export const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Render a yyyy-mm-dd string as e.g. "20 May 2025".
export function fmtDate(s) {
  if (!s) return '—';
  const d = new Date(s + 'T00:00:00Z');
  if (isNaN(d)) return esc(s);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

export function daysPhrase(days) {
  if (days === null || days === undefined) return '';
  if (days < 0) return `${Math.abs(days)} day${Math.abs(days) === 1 ? '' : 's'} overdue`;
  if (days === 0) return 'due today';
  return `in ${days} day${days === 1 ? '' : 's'}`;
}

export function tierBadge(tier, label) {
  const cls = `b-tier${tier}`;
  return `<span class="badge ${cls}"><span class="dot"></span>${esc(label || 'Tier ' + tier)}</span>`;
}

const VAL_CLASS = {
  overdue: 'b-red', due_soon: 'b-amber', current: 'b-green',
  pending_initial: 'b-blue', not_applicable: 'b-slate',
};
export function valBadge(status, label) {
  return `<span class="badge ${VAL_CLASS[status] || 'b-slate'}"><span class="dot"></span>${esc(label || status)}</span>`;
}

const SEV_CLASS = { Critical: 'b-red', High: 'b-red', Medium: 'b-amber', Low: 'b-slate' };
export function sevBadge(sev) {
  return `<span class="badge ${SEV_CLASS[sev] || 'b-slate'}">${esc(sev)}</span>`;
}

const FSTATUS_CLASS = { 'Open': 'b-amber', 'In Progress': 'b-blue', 'Fixed': 'b-green', 'Closed': 'b-slate' };
export function findingStatusBadge(status) {
  return `<span class="badge ${FSTATUS_CLASS[status] || 'b-slate'}">${esc(status)}</span>`;
}

const MSTATUS = { development: ['b-blue', 'In development'], in_use: ['b-green', 'In use'], retired: ['b-slate', 'Retired'] };
export function modelStatusBadge(status) {
  const [cls, label] = MSTATUS[status] || ['b-slate', status];
  return `<span class="badge ${cls}">${esc(label)}</span>`;
}

export function toast(message, type = 'ok') {
  const root = document.getElementById('toast-root');
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = message;
  root.appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity .3s'; }, 2600);
  setTimeout(() => el.remove(), 3000);
}

// Generic modal. bodyHtml is a string; onSubmit(formData, formElement) runs on
// submit and should throw to keep the modal open (an error toast is shown).
export function openModal({ title, bodyHtml, submitLabel = 'Save', onSubmit, wide = false }) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal ${wide ? 'modal-wide' : ''}" role="dialog" aria-modal="true">
      <div class="modal-header">
        <h3>${esc(title)}</h3>
        <button type="button" class="modal-close" aria-label="Close">&times;</button>
      </div>
      <form class="modal-body">
        <div class="modal-content">${bodyHtml}</div>
        <div class="modal-footer">
          <button type="button" class="btn btn-ghost" data-cancel>Cancel</button>
          <button type="submit" class="btn btn-primary">${esc(submitLabel)}</button>
        </div>
      </form>
    </div>`;
  document.body.appendChild(overlay);
  const close = () => overlay.remove();
  overlay.querySelector('.modal-close').onclick = close;
  overlay.querySelector('[data-cancel]').onclick = close;
  overlay.addEventListener('mousedown', (e) => { if (e.target === overlay) close(); });
  document.addEventListener('keydown', function onEsc(e) {
    if (e.key === 'Escape') { close(); document.removeEventListener('keydown', onEsc); }
  });

  const form = overlay.querySelector('form');
  const submitBtn = form.querySelector('button[type=submit]');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(form).entries());
    submitBtn.disabled = true;
    try {
      await onSubmit(data, form);
      close();
    } catch (err) {
      toast(err.message || 'Could not save', 'err');
      submitBtn.disabled = false;
    }
  });

  // Focus first field for convenience.
  const first = form.querySelector('input, select, textarea');
  if (first) first.focus();
  return { overlay, form, close };
}

export function confirmDialog(message) {
  return Promise.resolve(window.confirm(message));
}

// A simple read-only modal (no form) for showing information such as import results.
export function infoModal({ title, bodyHtml }) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal" role="dialog" aria-modal="true">
      <div class="modal-header">
        <h3>${esc(title)}</h3>
        <button type="button" class="modal-close" aria-label="Close">&times;</button>
      </div>
      <div class="modal-body"><div class="modal-content">${bodyHtml}</div>
        <div class="modal-footer"><button type="button" class="btn btn-primary" data-close>Done</button></div>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  const close = () => overlay.remove();
  overlay.querySelector('.modal-close').onclick = close;
  overlay.querySelector('[data-close]').onclick = close;
  overlay.addEventListener('mousedown', (e) => { if (e.target === overlay) close(); });
  return { overlay, close };
}

// Trigger a browser download from a URL (used for CSV export/template links).
export function downloadUrl(url) {
  const a = document.createElement('a');
  a.href = url;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
}
