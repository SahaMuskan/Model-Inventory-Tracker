// ---------------------------------------------------------------------------
// db.js
// A tiny, dependency-free persistence layer. All data lives in data/data.json,
// which is written atomically on every change so your records survive restarts
// and won't be left half-written if something is interrupted.
// ---------------------------------------------------------------------------

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { buildSeedData } from './seed.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', 'data');
const DATA_FILE = path.join(DATA_DIR, 'data.json');

let cache = null;

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

export function load() {
  if (cache) return cache;
  ensureDir();
  if (fs.existsSync(DATA_FILE)) {
    try {
      cache = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
    } catch (err) {
      // If the file is somehow corrupt, fall back to seed rather than crash.
      console.error('Could not parse data.json, re-seeding. Error:', err.message);
      cache = buildSeedData();
      save();
    }
  } else {
    // First run: create the file from the seed data.
    cache = buildSeedData();
    save();
    console.log('Initialised data store with seed data at', DATA_FILE);
  }
  // Make sure the core collections always exist.
  cache.models = cache.models || [];
  cache.findings = cache.findings || [];
  cache.settings = cache.settings || buildSeedData().settings;
  return cache;
}

export function save() {
  ensureDir();
  const tmp = DATA_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(cache, null, 2), 'utf-8');
  fs.renameSync(tmp, DATA_FILE); // atomic replace on the same volume
}

export function resetToSeed() {
  cache = buildSeedData();
  save();
  return cache;
}

// Wipe everything to a blank inventory (keeps sensible default settings).
// This is what a new organisation uses to start from scratch.
export function resetToEmpty() {
  const seed = buildSeedData();
  cache = {
    models: [],
    findings: [],
    settings: seed.settings,
    meta: { startedEmptyAt: new Date().toISOString(), schemaVersion: 1 },
  };
  save();
  return cache;
}

// Convenience accessors used by the routes.
export const getData = () => load();
export const getModels = () => load().models;
export const getFindings = () => load().findings;
export const getSettings = () => load().settings;

// CLI entry point: `npm run seed` (-> node src/db.js --reset) rebuilds the
// data file from the seed data, discarding any current contents.
const invokedDirectly =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
  if (process.argv.includes('--empty')) {
    resetToEmpty();
    console.log('Data store reset to EMPTY (blank inventory) at', DATA_FILE);
  } else {
    resetToSeed();
    console.log('Data store reset to seed/sample data at', DATA_FILE);
  }
}
