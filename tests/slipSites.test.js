import test from 'node:test';
import assert from 'node:assert/strict';
import { SITES_TO_ANALYZE } from '../src/data/slipSites.js';
import { CANONICAL_POLAR_COORDS } from '../src/data/lunarCanonicalCatalog.js';

test('Slip Simulator Candidate Sites Deduplication & Integrity', async (t) => {
  await t.test('contains exactly 6 deduplicated canonical South Pole candidate sites', () => {
    assert.equal(SITES_TO_ANALYZE.length, 6);

    const ids = SITES_TO_ANALYZE.map((s) => s.id);
    const uniqueIds = new Set(ids);
    assert.equal(
      uniqueIds.size,
      6,
      'All 6 candidate sites must have strictly unique IDs with zero duplicates'
    );

    assert.deepEqual(ids, [
      'landing-artemis3-shackleton',
      'landing-artemis3-malapert',
      'haworth-crater',
      'de-gerlache-crater',
      'amundsen-crater',
      'cabeus-crater',
    ]);
  });

  await t.test('all sites have valid coordinates, elevations, and terrain slopes', () => {
    for (const site of SITES_TO_ANALYZE) {
      assert.ok(typeof site.lat === 'number' && site.lat <= -80);
      assert.ok(typeof site.lon === 'number' && site.lon >= -180 && site.lon <= 180);
      assert.equal(site.latitude, site.lat);
      assert.equal(site.longitude, site.lon);

      assert.ok(typeof site.elevationM === 'number');
      assert.equal(site.elevationMeters, site.elevationM);

      assert.ok(typeof site.slopeDeg === 'number' && site.slopeDeg > 0);
      assert.ok(typeof site.roughnessM === 'number' && site.roughnessM > 0);
    }
  });

  await t.test('Shackleton and Malapert elevations match authoritative LOLA DEM vertical datum', () => {
    const shackleton = SITES_TO_ANALYZE.find((s) => s.id === 'landing-artemis3-shackleton');
    assert.ok(shackleton);
    assert.equal(shackleton.elevationM, 1251);

    const malapert = SITES_TO_ANALYZE.find((s) => s.id === 'landing-artemis3-malapert');
    assert.ok(malapert);
    assert.equal(malapert.elevationM, 5098);
  });
});
