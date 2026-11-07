#!/usr/bin/env node
/**
 * Exports every pre-dropped pin from the app's own data files into scripts/sites.json,
 * so compute_horizons.py never needs a hand-maintained site list.
 *
 * Run from the repo root:
 *   node scripts/export_sites.mjs                    # every pin (default)
 *   node scripts/export_sites.mjs --point-like-only  # skip maria, valleys, rilles and craters > 150 km
 *
 * Output: scripts/sites.json -> [{ id, name, lat, lon, kind, locationType }, ...]
 *
 * CHANGED 2026-11-02 (why):
 *  - Now also exports LUNAR_FEATURES (craters, mountains, maria, ...) and the hard-coded "south-pole" pin from
 *    src/cesium/moon/moonFeatures.js. Before, only CLPS + landing sites were exported, so ~60 pins never got a horizon.
 *  - Skips entries with horizonEligible === false (placeholder positions such as the Blue Ghost 2 far-side pin).
 *  - Rounds coordinates to 4 decimals (removes float noise like 31.700000000000045) and moves the exact pole (-90) to -89.99,
 *    because azimuth is undefined at the pole.
 *  - Prints how many sites fall in each LOLA DEM latitude band so you know which GeoTIFFs to download.
 */

import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { CLPS_MISSIONS } from '../src/data/clpsMissions.js';
import { LANDING_SITES } from '../src/data/landingSites.js';
import { LUNAR_FEATURES } from '../src/data/lunarFeatures.js';

const pointLikeOnly = process.argv.includes('--point-like-only');
const here = dirname(fileURLToPath(import.meta.url));
const outPath = join(here, 'sites.json');

const SITE_TYPES = new Set(['landing-site', 'mission-site', 'clps-mission']);
const LARGE_FEATURE_TYPES = new Set(['mare', 'valley', 'rille']);
const LARGE_CRATER_KM = 150;

const round4 = (v) => Math.round(v * 1e4) / 1e4;
const byId = new Map();
const skipped = [];

const add = (id, name, lat, lon, kind, locationType, eligible = true, elev = null) => {
  if (!id || byId.has(id)) return;
  if (eligible === false) { skipped.push(`${id} (placeholder position)`); return; }
  if (typeof lat !== 'number' || typeof lon !== 'number' || Number.isNaN(lat) || Number.isNaN(lon)) return;
  let la = Math.max(-90, Math.min(90, lat));
  if (la <= -89.995) la = -89.99; // azimuth is undefined exactly at the pole
  const entry = {
    id,
    name,
    lat: round4(la),
    lon: round4(((((lon + 180) % 360) + 360) % 360) - 180),
    kind,
    locationType: locationType ?? 'confirmed',
  };
  if (typeof elev === 'number' && Number.isFinite(elev)) {
    entry.elevM = Math.round(elev);
  }
  byId.set(id, entry);
};

// 1. CLPS missions (ids like "clps-im1-odysseus")
for (const m of CLPS_MISSIONS) {
  add(m.id, m.name, m.latitude, m.longitude, 'clps-mission', m.locationType, m.horizonEligible, m.elevationMeters);
}

// 2. Landing / mission sites (ids like "landing-apollo-11"); CLPS-derived entries share ids with step 1 and are skipped there.
for (const s of LANDING_SITES) {
  if (SITE_TYPES.has(s.type)) add(s.id, s.name, s.latitude, s.longitude, s.type, s.locationType, s.horizonEligible, s.elevationMeters);
}

// 3. Named lunar features (craters, mountains, maria, valleys, rilles)
for (const f of LUNAR_FEATURES) {
  const large =
    LARGE_FEATURE_TYPES.has(f.type) || (f.type === 'crater' && (f.diameterKm ?? 0) > LARGE_CRATER_KM);
  if (pointLikeOnly && large) { skipped.push(`${f.id} (large feature)`); continue; }
  add(f.id, f.name, f.latitude, f.longitude, f.type, f.locationType, f.horizonEligible, f.elevationM);
}

// 4. Hard-coded pin created in src/cesium/moon/moonFeatures.js (keep in sync if that file changes)
add('south-pole', 'Lunar South Pole (90S)', -90, 0, 'south_pole', 'confirmed', true, 1251);

const sites = [...byId.values()].sort((a, b) => a.lat - b.lat);
writeFileSync(outPath, JSON.stringify(sites, null, 2));

const band = (lo, hi) => sites.filter((s) => s.lat > lo && s.lat <= hi).length;
const uniq = new Set(sites.map((s) => `${s.lat},${s.lon}`)).size;
console.log(`Wrote ${sites.length} sites (${uniq} unique coordinates) to ${outPath}`);
console.log('Sites per latitude band -> DEM to download (finest first when running compute_horizons.py):');
console.log(`  <= -85    : ${band(-91, -85)}   LDEM_85S_10M if you have it, otherwise LDEM_80S_20M`);
console.log(`  -85..-80  : ${band(-85, -80)}   LDEM_80S_20M`);
console.log(`  -80..-75  : ${band(-80, -75)}   LDEM_75S_30M  (sites near -80 need a DEM that extends past 80 S)`);
console.log(`  -75..-60  : ${band(-75, -60)}   LDEM_60S_60M`);
console.log(`  -60..-45  : ${band(-60, -45)}   LDEM_45S_100M`);
console.log(`  > -45     : ${band(-45, 91)}   a global DEM such as LDEM_64 or LDEM_128`);
const approx = sites.filter((s) => s.locationType === 'approximate' || s.locationType === 'planned');
console.log(`${approx.length} sites have approximate/planned coordinates - treat their horizons as indicative.`);
const skippedUnique = [...new Set(skipped)];
if (skippedUnique.length) console.log(`Skipped: ${skippedUnique.join(', ')}`);