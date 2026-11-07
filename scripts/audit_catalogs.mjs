import fs from 'node:fs';
import { LUNAR_FEATURES } from '../src/data/lunarFeatures.js';
import { LANDING_SITES } from '../src/data/landingSites.js';
// Read SOUTH_POLE_LANDMARKS from SouthPoleTopoMap.jsx as text and eval
const topoText = fs.readFileSync('./src/components/map/SouthPoleTopoMap.jsx', 'utf8');
const topoMatch = topoText.match(/export const SOUTH_POLE_LANDMARKS = (\[[\s\S]*?\n\];)/);
let SOUTH_POLE_LANDMARKS = [];
if (topoMatch) {
  SOUTH_POLE_LANDMARKS = eval(topoMatch[1]);
}
import { SOUTH_POLE_REFERENCE_LANDMARKS } from '../src/utils/coordinates.js';
import * as horizons from '../src/utils/horizons.js';

await horizons.ensurePolarDemLoaded();

const sites = JSON.parse(fs.readFileSync('./scripts/sites.json', 'utf8'));
console.log('Total sites in sites.json:', sites.length);

console.log('\n--- Comparing SOUTH_POLE_LANDMARKS vs SOUTH_POLE_REFERENCE_LANDMARKS ---');
for (const sp of SOUTH_POLE_LANDMARKS) {
  const ref = SOUTH_POLE_REFERENCE_LANDMARKS.find((r) => r.id === sp.id);
  if (!ref) {
    console.log('Missing in coordinates.js:', sp.id);
  } else {
    if (ref.lat !== sp.latitude || ref.lon !== sp.longitude || ref.elevM !== sp.elevationMeters) {
      console.log('Mismatch for', sp.id, 'TopoMap:', { lat: sp.latitude, lon: sp.longitude, elev: sp.elevationMeters }, 'Coords:', { lat: ref.lat, lon: ref.lon, elev: ref.elevM });
    }
  }
}

console.log('\n--- Checking horizons.js KNOWN_POLAR_COORDS vs sites.json ---');
const hText = fs.readFileSync('./src/utils/horizons.js', 'utf8');
const match = hText.match(/const KNOWN_POLAR_COORDS = \{([\s\S]*?)\};/);
if (match) {
  const lines = match[1].split('\n').filter((l) => l.includes(': {'));
  for (const line of lines) {
    const id = line.split('"')[1];
    const latM = line.match(/lat:\s*([-\d.]+)/);
    const lonM = line.match(/lon:\s*([-\d.]+)/);
    if (id && latM && lonM) {
      const lat = Number(latM[1]);
      const lon = Number(lonM[1]);
      const site = sites.find((s) => s.id === id);
      if (site) {
        if (site.lat !== lat || site.lon !== lon) {
          console.log('Mismatch in KNOWN_POLAR_COORDS for', id, '\n  horizons:', { lat, lon }, '\n  sites.json:', { lat: site.lat, lon: site.lon });
        }
      } else {
        console.log('KNOWN_POLAR_COORDS id NOT in sites.json:', id, { lat, lon });
      }
    }
  }
}

console.log('\n--- Checking DEM elevations for polar features (lat <= -80) in sites.json ---');
const polarSites = sites.filter((s) => s.lat <= -80);
for (const s of polarSites) {
  const stereo = horizons.latLonToStereoMeters(s.lat, s.lon);
  const demElev = horizons.sampleDemMeters(stereo.x, stereo.y);
  // Check if s.id exists in SOUTH_POLE_LANDMARKS or LUNAR_FEATURES or LANDING_SITES
  const topo = SOUTH_POLE_LANDMARKS.find((l) => l.id === s.id);
  const lf = LUNAR_FEATURES.find((f) => f.id === s.id);
  const ls = LANDING_SITES.find((l) => l.id === s.id);
  const elevHardcoded = topo?.elevationMeters ?? topo?.elevM ?? ls?.elevationMeters ?? lf?.elevationM;
  console.log(s.id.padEnd(35), 'lat:', s.lat, 'lon:', s.lon, 'DEM:', demElev ? demElev.toFixed(1) + 'm' : 'null', 'Hardcoded:', elevHardcoded);
}
