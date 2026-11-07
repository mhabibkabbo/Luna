import test from 'node:test';
import assert from 'node:assert/strict';
import { CLPS_MISSIONS } from '../src/data/clpsMissions.js';
import { LANDING_SITES } from '../src/data/landingSites.js';
import { sampleLunarTerrainMetrics } from '../src/utils/horizons.js';

test('CLPS Missions Data Validation & Placeholder Telemetry Suppression', async (t) => {
  await t.test('Blue Ghost Mission 2 (clps-firefly-bgm2) has locationType === "placeholder"', () => {
    const bgm2 = CLPS_MISSIONS.find((m) => m.id === 'clps-firefly-bgm2');
    assert.ok(bgm2, 'clps-firefly-bgm2 must exist in CLPS_MISSIONS catalog');
    assert.equal(
      bgm2.locationType,
      'placeholder',
      'clps-firefly-bgm2 locationType must be "placeholder" to reflect unannounced coordinates'
    );
  });

  await t.test('LANDING_SITES synchronizes placeholder locationType from CLPS_MISSIONS', () => {
    const bgm2Site = LANDING_SITES.find((s) => s.id === 'clps-firefly-bgm2');
    assert.ok(bgm2Site, 'clps-firefly-bgm2 must exist in LANDING_SITES catalog');
    assert.equal(
      bgm2Site.locationType,
      'placeholder',
      'LANDING_SITES must inherit placeholder locationType'
    );
  });

  await t.test('sampleLunarTerrainMetrics suppresses terrain/telemetry for placeholder locations', () => {
    const bgm2 = CLPS_MISSIONS.find((m) => m.id === 'clps-firefly-bgm2');
    const result = sampleLunarTerrainMetrics(bgm2.latitude, bgm2.longitude, bgm2);

    assert.equal(result.isPlaceholder, true, 'isPlaceholder must be true');
    assert.equal(result.elevationM, null, 'elevationM must be null');
    assert.equal(result.slopeDeg, null, 'slopeDeg must be null');
    assert.equal(result.roughnessM, null, 'roughnessM must be null');
    assert.equal(result.reliefM, null, 'reliefM must be null');
    assert.equal(result.elevationSource, 'Coordinates Withheld (Placeholder)');
    assert.ok(result.warnings.some((w) => w.id === 'placeholder-coordinates'));
  });

  await t.test('sampleLunarTerrainMetrics suppresses terrain/telemetry when feature.clpsData is placeholder', () => {
    const result = sampleLunarTerrainMetrics(-45.0, 160.0, {
      clpsData: { locationType: 'placeholder' },
    });

    assert.equal(result.isPlaceholder, true);
    assert.equal(result.elevationM, null);
    assert.equal(result.slopeDeg, null);
    assert.equal(result.elevationSource, 'Coordinates Withheld (Placeholder)');
  });
});
