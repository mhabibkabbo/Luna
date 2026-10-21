#!/usr/bin/env node
/**
 * Exports every landing/mission site from the app's own data files into sites.json,
 * so the Python horizon script never needs a hand-maintained site list.
 *
 * Place this file in <repo>/scripts/ and run from the repo root:
 *   node scripts/export_sites.mjs
 *
 * Output: scripts/sites.json  ->  [{ id, name, lat, lon }, ...]
 *
 * Both CLPS_MISSIONS ids (e.g. "clps-im1-odysseus") and LANDING_SITES ids
 * (e.g. "landing-odysseus") are exported, so the lookup works no matter which
 * id a selected feature carries. Duplicate coordinates are computed only once
 * by the Python script.
 */

import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { CLPS_MISSIONS } from '../src/data/clpsMissions.js';
import { LANDING_SITES } from '../src/data/landingSites.js';

const here = dirname(fileURLToPath(import.meta.url));
const outPath = join(here, 'sites.json');

const SITE_TYPES = new Set(['landing-site', 'mission-site', 'clps-mission']);

const byId = new Map();

const add = (id, name, lat, lon) => {
  if (!id || byId.has(id)) return;
  if (typeof lat !== 'number' || typeof lon !== 'number') return;
  if (Number.isNaN(lat) || Number.isNaN(lon)) return;
  byId.set(id, {
    id,
    name,
    lat: Math.max(-90, Math.min(90, lat)),
    lon: ((((lon + 180) % 360) + 360) % 360) - 180,
  });
};

for (const m of CLPS_MISSIONS) {
  add(m.id, m.name, m.latitude, m.longitude);
}

for (const s of LANDING_SITES) {
  if (SITE_TYPES.has(s.type)) {
    add(s.id, s.name, s.latitude, s.longitude);
  }
}

const sites = [...byId.values()].sort((a, b) => a.lat - b.lat);
writeFileSync(outPath, JSON.stringify(sites, null, 2));

const polar = sites.filter((s) => s.lat <= -80).length;
console.log(`Wrote ${sites.length} sites to ${outPath}`);
console.log(`  ${polar} at or below 80°S (covered by LDEM_80S)`);
console.log(`  ${sites.length - polar} elsewhere (need a global LDEM for terrain)`);
