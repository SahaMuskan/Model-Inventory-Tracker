// Thin wrapper around fetch for talking to the REST API.
async function req(method, url, body) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (body !== undefined) opts.body = JSON.stringify(body);
  const res = await fetch(url, opts);
  if (!res.ok) {
    let msg = res.statusText;
    try { const j = await res.json(); msg = j.error || msg; } catch (_) {}
    throw new Error(msg);
  }
  if (res.status === 204) return null;
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

export const api = {
  models: () => req('GET', '/api/models'),
  model: (id) => req('GET', `/api/models/${encodeURIComponent(id)}`),
  createModel: (d) => req('POST', '/api/models', d),
  updateModel: (id, d) => req('PUT', `/api/models/${encodeURIComponent(id)}`, d),
  deleteModel: (id) => req('DELETE', `/api/models/${encodeURIComponent(id)}`),

  findings: (modelId) => req('GET', '/api/findings' + (modelId ? `?modelId=${encodeURIComponent(modelId)}` : '')),
  createFinding: (d) => req('POST', '/api/findings', d),
  updateFinding: (id, d) => req('PUT', `/api/findings/${encodeURIComponent(id)}`, d),
  deleteFinding: (id) => req('DELETE', `/api/findings/${encodeURIComponent(id)}`),

  settings: () => req('GET', '/api/settings'),
  updateSettings: (d) => req('PUT', '/api/settings', d),

  methodology: () => req('GET', '/api/methodology'),
  dashboard: () => req('GET', '/api/dashboard'),

  importModels: (csv) => postText('/api/models/import', csv),
  importFindings: (csv) => postText('/api/findings/import', csv),

  resetData: (mode) => req('POST', '/api/admin/reset', { mode }),
};

// Send raw CSV text to an import endpoint.
async function postText(url, text) {
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'text/csv' }, body: text });
  if (!res.ok) {
    let msg = res.statusText;
    try { const j = await res.json(); msg = j.error || msg; } catch (_) {}
    throw new Error(msg);
  }
  return res.json();
}
