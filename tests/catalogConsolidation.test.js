import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { SOUTH_POLE_REFERENCE_LANDMARKS } from '../src/utils/coordinates.js';
import { CANONICAL_POLAR_LANDMARKS, CANONICAL_POLAR_COORDS } from '../src/data/lunarCanonicalCatalog.js';
import { LUNAR_FEATURES } from '../src/data/lunarFeatures.js';
import { LANDING_SITES } from '../src/data/landingSites.js';
import { ensurePolarDemLoaded, latLonToStereoMeters, sampleDemMeters } from '../src/utils/horizons.js';

test('Lunar Coordinate & Elevation Catalog Consolidation Audit', async (t) => {
  await ensurePolarDemLoaded();
  const sites = JSON.parse(fs.readFileSync('./scripts/sites.json', 'utf8'));

  await t.test('South Pole (90°S) elevation is +1251 m (eradicating -2540 m contradiction)', () => {
    const spCoord = SOUTH_POLE_REFERENCE_LANDMARKS.find((l) => l.id === 'south-pole');
    assert.ok(spCoord, 'South pole must exist in SOUTH_POLE_REFERENCE_LANDMARKS');
    assert.equal(spCoord.elevM, 1251, 'South pole elevation must be +1251 m in coordinates.js');

    const spFeat = LUNAR_FEATURES.find((f) => f.id === 'south-pole');
    assert.ok(spFeat, 'South pole must exist in LUNAR_FEATURES');
    assert.equal(spFeat.elevationM, 1251, 'South pole elevation must be +1251 m in lunarFeatures.js');

    const spSite = sites.find((s) => s.id === 'south-pole');
    assert.ok(spSite, 'South pole must exist in sites.json');
    assert.equal(spSite.elevM, 1251, 'South pole elevation must be +1251 m in sites.json');
  });

  await t.test('Shackleton crater floor elevation is -2768 m (eradicating -4200 m contradiction)', () => {
    const shackCoord = SOUTH_POLE_REFERENCE_LANDMARKS.find((l) => l.id === 'shackleton-crater');
    assert.ok(shackCoord);
    assert.equal(shackCoord.elevM, -2768, 'Shackleton floor must be -2768 m in coordinates.js');
    assert.equal(shackCoord.depthM, 4200, '4200 m must represent crater depth, not floor elevation');

    const shackFeat = LUNAR_FEATURES.find((f) => f.id === 'crater-shackleton');
    assert.ok(shackFeat);
    assert.equal(shackFeat.elevationM, -2768, 'crater-shackleton floor must be -2768 m in lunarFeatures.js');

    const shackSite = sites.find((s) => s.id === 'crater-shackleton');
    assert.ok(shackSite);
    assert.equal(shackSite.elevM, -2768, 'crater-shackleton floor must be -2768 m in sites.json');
  });

  await t.test('De Gerlache crater floor is canonical -1014 m across all catalogs (eradicating -3944 m and -1013 m)', () => {
    const deGCoord = SOUTH_POLE_REFERENCE_LANDMARKS.find((l) => l.id === 'de-gerlache-crater');
    assert.ok(deGCoord);
    assert.equal(deGCoord.elevM, -1014, 'De Gerlache floor must be -1014 m in coordinates.js');

    const deGCanonical = CANONICAL_POLAR_LANDMARKS.find((l) => l.id === 'de-gerlache-crater' || l.canonicalId === 'crater-de-gerlache');
    assert.ok(deGCanonical);
    assert.equal(deGCanonical.elevationMeters, -1014, 'De Gerlache floor must be -1014 m in CANONICAL_POLAR_LANDMARKS');

    const topoMapSrc = fs.readFileSync('./src/components/map/SouthPoleTopoMap.jsx', 'utf8');
    assert.ok(
      topoMapSrc.includes('SOUTH_POLE_LANDMARKS = CANONICAL_POLAR_LANDMARKS'),
      'SouthPoleTopoMap must import CANONICAL_POLAR_LANDMARKS'
    );

    const deGFeat = LUNAR_FEATURES.find((f) => f.id === 'crater-de-gerlache');
    assert.ok(deGFeat);
    assert.equal(deGFeat.elevationM, -1014, 'crater-de-gerlache floor must be -1014 m in lunarFeatures.js');

    const deGSite = sites.find((s) => s.id === 'crater-de-gerlache');
    assert.ok(deGSite);
    assert.equal(deGSite.elevM, -1014, 'crater-de-gerlache floor must be -1014 m in sites.json');
  });

  await t.test('Mons Malapert coordinates and elevations are synchronized with DEM (+5098 m summit at -86.02, 2.7)', () => {
    const mmFeat = LUNAR_FEATURES.find((f) => f.id === 'mons-malapert');
    assert.ok(mmFeat);
    assert.equal(mmFeat.latitude, -86.02);
    assert.equal(mmFeat.longitude, 2.7);
    assert.equal(mmFeat.elevationM, 5098);

    const mmSite = sites.find((s) => s.id === 'mons-malapert');
    assert.ok(mmSite);
    assert.equal(mmSite.lat, -86.02);
    assert.equal(mmSite.lon, 2.7);
    assert.equal(mmSite.elevM, 5098);

    const mmCoord = CANONICAL_POLAR_COORDS['mons-malapert'];
    assert.ok(mmCoord);
    assert.equal(mmCoord.lat, -86.02);
    assert.equal(mmCoord.lon, 2.7);
    assert.equal(mmCoord.elevM, 5098);
  });

  await t.test('All polar features in sites.json (lat <= -80) have valid LOLA DEM elevations', () => {
    const polarSites = sites.filter((s) => s.lat <= -80);
    assert.ok(polarSites.length >= 35, 'Must contain all 36 polar sites');

    for (const s of polarSites) {
      assert.ok(typeof s.elevM === 'number' && Number.isFinite(s.elevM), `Site ${s.id} must have numeric elevM`);
      const stereo = latLonToStereoMeters(s.lat, s.lon);
      const demVal = sampleDemMeters(stereo.x, stereo.y);
      if (demVal != null) {
        // Discrepancy between rounded/nominal coordinate elevation and bilinear DEM probe should be small (<30m)
        const diff = Math.abs(demVal - s.elevM);
        assert.ok(
          diff < 30,
          `Elevation discrepancy for ${s.id} (nominal: ${s.elevM}m, DEM: ${demVal.toFixed(1)}m, diff: ${diff.toFixed(1)}m) must be <30m`
        );
      }
    }
  });
});
