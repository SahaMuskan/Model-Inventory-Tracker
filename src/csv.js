// ---------------------------------------------------------------------------
// csv.js — a tiny, dependency-free CSV reader/writer.
// Handles quoted fields, embedded commas/quotes/newlines, and writes a UTF-8
// BOM + CRLF line endings so files open cleanly in Excel.
// ---------------------------------------------------------------------------

const BOM = '﻿';

// Parse CSV text into an array of row objects keyed by the header row.
export function parseCSV(text) {
  if (typeof text !== 'string') return [];
  text = text.replace(/^﻿/, ''); // strip a leading byte-order-mark

  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  let i = 0;

  while (i < text.length) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 2; continue; }
        inQuotes = false; i++; continue;
      }
      field += c; i++; continue;
    }
    if (c === '"') { inQuotes = true; i++; continue; }
    if (c === ',') { row.push(field); field = ''; i++; continue; }
    if (c === '\r') { i++; continue; }
    if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; i++; continue; }
    field += c; i++;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }

  if (!rows.length) return [];
  // Strip any byte-order-mark and surrounding whitespace from header names so a
  // BOM-prefixed file (common from Excel) doesn't corrupt the first column name.
  const headers = rows[0].map((h) => h.replace(/﻿/g, '').trim());
  return rows.slice(1)
    .filter((r) => r.some((v) => String(v).trim() !== '')) // drop blank lines
    .map((r) => {
      const o = {};
      headers.forEach((h, idx) => { o[h] = (r[idx] ?? '').trim(); });
      return o;
    });
}

function csvCell(v) {
  const s = v === null || v === undefined ? '' : String(v);
  return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

// Build CSV text from a header list and an array of row objects.
export function toCSV(headers, rows) {
  const lines = [headers.map(csvCell).join(',')];
  for (const r of rows) lines.push(headers.map((h) => csvCell(r[h])).join(','));
  return BOM + lines.join('\r\n');
}

// Interpret common truthy spellings ("Yes"/"true"/"1"/"y") as a boolean.
export function parseBool(v) {
  return /^(y|yes|true|1|t)$/i.test(String(v ?? '').trim());
}

// Normalise a date to yyyy-mm-dd. Accepts yyyy-mm-dd as-is, and converts the
// UK-style dd/mm/yyyy that Excel often produces. Anything else is returned
// unchanged (the app simply won't compute a due-date from an unrecognised date).
export function normalizeDate(v) {
  const s = String(v ?? '').trim();
  if (!s) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) {
    const [, d, mo, y] = m;
    return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  return s;
}
