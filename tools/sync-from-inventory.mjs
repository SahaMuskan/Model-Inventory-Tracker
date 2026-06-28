// ---------------------------------------------------------------------------
// sync-from-inventory.mjs
//
// A SAMPLE/TEMPLATE script showing how a bank could automate loading its model
// inventory into the tracker from an existing system-of-record export, instead
// of typing models in by hand.
//
// What it does:
//   1. Reads a CSV "extract" with the bank's own column names.
//   2. Maps those columns to the tracker's fields (the COLUMN_MAP below).
//   3. DERIVES the five risk-factor scores from quantitative columns using
//      simple, transparent rules you tailor to your bank's policy.
//   4. Posts the result to the tracker's /api/models/import endpoint.
//
// This is intentionally a thin, readable template. In a real deployment you
// would point step 1 at a scheduled database extract or a source-system API,
// run it on a server, and add authentication, logging and reconciliation.
//
// Usage (with the tracker running on http://localhost:3000):
//   node tools/sync-from-inventory.mjs                         # uses the sample file
//   node tools/sync-from-inventory.mjs path/to/extract.csv     # your own extract
//   node tools/sync-from-inventory.mjs --dry-run               # show, don't send
//   node tools/sync-from-inventory.mjs --api http://host:3000  # different server
// ---------------------------------------------------------------------------

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { parseCSV, toCSV, normalizeDate } from '../src/csv.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// --- 1. Map your bank's column names -> the tracker's field names ------------
const COLUMN_MAP = {
  'Model ID': 'id',
  'Model Name': 'name',
  'Description': 'purpose',
  'Model Owner': 'owner',
  'Built By': 'developer',
  'Validated By': 'validator',
  'Division': 'businessUnit',
  'Risk Type': 'modelType',
  'Vendor': 'vendorName',
  'Depends On (model ids)': 'dependsOn',
  'Known Issues': 'limitations',
};

// --- value transforms for the non-derived fields ----------------------------
const mapSourcing = (v) => (/vendor|bought|third/i.test(v) ? 'vendor' : 'in-house');
const mapLifecycle = (v) => {
  if (/build|develop|prototyp/i.test(v)) return 'development';
  if (/decommission|retire|legacy/i.test(v)) return 'retired';
  return 'in_use';
};
const yes = (v) => /^(y|yes|true|1)$/i.test(String(v || '').trim());

// --- 2/3. Derive the five risk factors (1-3) from quantitative columns -------
// Tailor every threshold here to your bank's tiering policy.
function deriveFactors(row) {
  const exposure = parseFloat(String(row['Exposure (GBP m)'] || '0').replace(/[^0-9.]/g, '')) || 0;
  const technique = String(row['Technique'] || '');
  const downstream = parseInt(row['Downstream Count'] || '0', 10) || 0;
  const dataQuality = String(row['Data Quality'] || '').trim().toLowerCase();
  const regulatory = yes(row['Regulatory Use']);

  const materiality = exposure >= 1000 ? 3 : exposure >= 100 ? 2 : 1;          // £m exposure bands
  const complexity = /ml|ai|neural|gradient|forest|boost/i.test(technique) ? 3 // machine learning
    : /regression|statistical|scorecard|overlay/i.test(technique) ? 2          // statistical
      : 1;                                                                       // rules-based
  const reliance = downstream >= 3 ? 3 : downstream >= 1 ? 2 : 1;              // interconnectedness
  const regulatoryScore = regulatory ? 3 : 1;                                  // capital/reporting
  const uncertainty = dataQuality === 'low' ? 3 : dataQuality === 'high' ? 1 : 2; // data quality

  return { materiality, complexity, reliance, regulatory: regulatoryScore, uncertainty };
}

// --- glue: turn one bank row into one tracker row ---------------------------
function toTrackerRow(row) {
  const out = {};
  for (const [bankCol, field] of Object.entries(COLUMN_MAP)) {
    if (row[bankCol] !== undefined) out[field] = row[bankCol];
  }
  out.buildType = mapSourcing(row['Sourcing']);
  out.status = mapLifecycle(row['Lifecycle']);
  out.regulatoryUse = yes(row['Regulatory Use']) ? 'Yes' : 'No';
  out.goLiveDate = normalizeDate(row['Live Date']);
  out.lastValidated = normalizeDate(row['Last Review']);
  out.dependsOn = String(out.dependsOn || '').replace(/[, ]+/g, ';'); // tracker wants ; separated
  Object.assign(out, deriveFactors(row));
  return out;
}

const APP_COLUMNS = ['id', 'name', 'purpose', 'owner', 'developer', 'validator', 'businessUnit',
  'modelType', 'buildType', 'vendorName', 'dependsOn', 'regulatoryUse', 'status',
  'goLiveDate', 'lastValidated', 'limitations',
  'materiality', 'complexity', 'reliance', 'regulatory', 'uncertainty'];

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const apiIdx = args.indexOf('--api');
  const apiBase = apiIdx !== -1 ? args[apiIdx + 1] : (process.env.TRACKER_API || 'http://localhost:3000');
  const fileArg = args.find((a) => !a.startsWith('--') && a !== apiBase);
  const file = fileArg ? path.resolve(fileArg) : path.join(__dirname, 'sample-inventory-extract.csv');

  if (!fs.existsSync(file)) { console.error('Extract file not found:', file); process.exit(1); }
  const bankRows = parseCSV(fs.readFileSync(file, 'utf-8'));
  console.log(`Read ${bankRows.length} row(s) from ${file}`);

  const trackerRows = bankRows.map(toTrackerRow);
  const csv = toCSV(APP_COLUMNS, trackerRows);

  if (dryRun) {
    console.log('\n--- DRY RUN: mapped CSV that WOULD be sent ---\n');
    console.log(csv.replace(/^﻿/, ''));
    console.log('\n(no data sent; remove --dry-run to load it)');
    return;
  }

  const url = `${apiBase}/api/models/import`;
  console.log(`Posting to ${url} ...`);
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'text/csv' }, body: csv });
  if (!res.ok) {
    let msg = res.statusText; try { msg = (await res.json()).error || msg; } catch (_) {}
    console.error('Import failed:', msg); process.exit(1);
  }
  const summary = await res.json();
  console.log(`Done: ${summary.created} added, ${summary.updated} updated, ${summary.skipped} skipped.`);
  if (summary.errors && summary.errors.length) {
    console.log('Notes:'); summary.errors.forEach((e) => console.log('  - ' + e));
  }
}

main().catch((e) => { console.error('Error:', e.message); process.exit(1); });
