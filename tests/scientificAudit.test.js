import test from 'node:test';
import assert from 'node:assert/strict';
import { computeOverallSuitability } from '../src/utils/suitabilityScoring.js';
import {
  evaluateCandidateForMissionWindow,
  rankLandingCandidates,
  DEFAULT_PLANNER_CONSTRAINTS,
} from '../src/utils/plannerEngine.js';
import { PLANNER_CANDIDATES } from '../src/data/plannerCandidates.js';
import { parseLatestPlasma } from '../src/services/spaceWeather.js';
import { getVolatileDataForFeature } from '../src/data/lunarCanonicalCatalog.js';
import { NASA_DATASETS_REGISTRY } from '../src/data/nasaProvenance.js';
import { ensurePolarDemLoaded } from '../src/utils/horizons.js';

test('Scientific Integrity & Computational Audit Verification Suite', async (t) => {
  await ensurePolarDemLoaded();

  await t.test('Partial-score normalized weights sum to exactly 100% (44% + 37% + 19% = 100%)', () => {
    const partial = computeOverallSuitability({
      solarSuitability: 78,
      commSuitability: 100,
      terrainSuitability: null,
      thermalSuitability: 26,
    });
    assert.equal(partial.isPartialScore, true);
    assert.equal(partial.overallScore, null);
    assert.match(
      partial.formulaString,
      /44%·Sun\(78\) \+ 37%·DTE\(100\) \+ 19%·Thermal\(26\)/
    );
    const matches = [...partial.formulaString.matchAll(/(\d+)%·/g)].map((m) => Number(m[1]));
    assert.equal(matches.length, 3);
    assert.equal(matches[0] + matches[1] + matches[2], 100);
  });

  await t.test('Planner compliance strictly rejects touchdown shadow and insufficient insolation violations', () => {
    // At 2026-11-08T21:15:00Z, Mare Crisium (18.56°N, 61.81°E) is in lunar night (-35.6° sun el)
    const epochMs = Date.parse('2026-11-08T21:15:00Z');
    const mareCrisium = PLANNER_CANDIDATES.find((c) => c.id.includes('crisium') || c.name.includes('Crisium'));
    assert.ok(mareCrisium, 'Mare Crisium candidate must exist');

    const ev = evaluateCandidateForMissionWindow(mareCrisium, epochMs, 14, DEFAULT_PLANNER_CONSTRAINTS);
    assert.ok(ev.violations.some((v) => v.type === 'touchdown_shadow'));
    assert.equal(ev.isCompliant, false, 'Site with touchdown shadow violation must not be marked compliant');
    assert.equal(ev.isFullyCompliant, false);
  });

  await t.test('rankLandingCandidates prioritizes Fully Compliant 4-factor DEM sites ahead of partial or violating sites', () => {
    const epochMs = Date.parse('2026-12-21T12:00:00Z');
    const ranked = rankLandingCandidates(PLANNER_CANDIDATES, epochMs, 14, DEFAULT_PLANNER_CONSTRAINTS);
    assert.ok(ranked.length > 0);

    let currentTier = 0;
    for (const item of ranked) {
      const itemTier = item.isFullyCompliant ? 0 : item.isConditionalCompliant ? 1 : 2;
      assert.ok(
        itemTier >= currentTier,
        `Ranking order violated at ${item.candidate.name} (tier ${itemTier} after tier ${currentTier})`
      );
      currentTier = itemTier;
    }
  });

  await t.test('parseLatestPlasma returns null (never hardcoded 100000 K) when plasma temperature is missing', () => {
    const summaryRowWithoutTemp = [{ proton_speed: 412.3, proton_density: 3.4, time_tag: '2026-11-08T12:00:00Z' }];
    const parsed = parseLatestPlasma(summaryRowWithoutTemp);
    assert.ok(parsed);
    assert.equal(parsed.speed, 412.3);
    assert.equal(parsed.density, 3.4);
    assert.equal(parsed.temperature, null, 'Missing plasma temperature must be null, never 100000');
  });

  await t.test('getVolatileDataForFeature labels uncataloged coordinates as Literature Regional Baseline', () => {
    const uncatalogedPolar = getVolatileDataForFeature({
      id: 'custom-user-pin',
      name: 'Custom Dropped Pin',
      latitude: -83.25,
      longitude: 14.5,
    });
    assert.equal(uncatalogedPolar.isRegionalEstimate, true);
    assert.match(uncatalogedPolar.provenance, /Literature Regional Baseline/);
    assert.match(uncatalogedPolar.h2oAbundance, /no local volatile raster loaded/);
  });

  await t.test('NASA_DATASETS_REGISTRY includes verificationStatus, temporalCoverage, and knownLimitations', () => {
    for (const ds of NASA_DATASETS_REGISTRY) {
      assert.ok(ds.verificationStatus, `Dataset ${ds.id} must declare verificationStatus`);
      assert.ok(ds.temporalCoverage, `Dataset ${ds.id} must declare temporalCoverage`);
      assert.ok(ds.knownLimitations, `Dataset ${ds.id} must declare knownLimitations`);
    }
  });

  await t.test('Elevated polar peaks (elevationM > 0) are not misclassified as cryogenic PSRs (40 K) during lunar night', async () => {
    const { getLunarTemperature } = await import('../src/utils/lunarThermal.js');
    // Simulate polar night on Mons Mouton plateau (+5235m) when Sun is at +1.5°N sub-solar latitude
    const moutonNight = getLunarTemperature(-84.5, 31.7, 1.5, 211.7, {
      elevationM: 5235,
      terrainHorizonDeg: 1.2,
    });
    assert.equal(moutonNight.isPSR, false, 'Elevated +5235m plateau must not be classified as PSR');
    assert.ok(moutonNight.tempK >= 85, `Elevated polar plateau night temperature (${moutonNight.tempK} K) must be >= 85 K`);
    assert.ok(moutonNight.tempC >= -188, `Elevated polar plateau night temperature (${moutonNight.tempC}°C) must exceed -190°C limit`);
  });

  await t.test('discoverSouthPoleCandidates computes true topocentric DTE uptime for Connecting Ridge (-89.45°S, -137.2°W)', async () => {
    const { discoverSouthPoleCandidates } = await import('../src/utils/plannerEngine.js');
    const epochMs = Date.parse('2026-12-21T12:00:00Z');
    const discovered = discoverSouthPoleCandidates(epochMs, 14, DEFAULT_PLANNER_CONSTRAINTS);
    const connRidge = discovered.find((d) => d.id === 'disc-connecting-ridge-alpha');
    assert.ok(connRidge, 'Connecting Ridge Crest Alpha should be present in discovered candidates');
    assert.equal(connRidge.candidate.isFarSide, false, 'Polar site at 89.45°S must not be marked unconditionally far side');
    assert.ok(connRidge.dteUptimeRatio > 0, `Connecting Ridge at 89.45°S must have > 0% DTE uptime, got ${connRidge.dteUptimeRatio}%`);
  });

  await t.test('Precomputed polar horizon profiles in HORIZON_TABLE match LOLA DEM without sub-pixel step cliffs', async () => {
    const { HORIZON_TABLE, getHorizonProfile } = await import('../src/utils/horizons.js');
    const shackletonPeak = getHorizonProfile(HORIZON_TABLE, 'landing-artemis3-shackleton');
    assert.ok(shackletonPeak?.horizon, 'Peak Near Shackleton horizon must exist');
    const minShack = Math.min(...shackletonPeak.horizon);
    const maxShack = Math.max(...shackletonPeak.horizon);
    assert.ok(minShack < 0, `Peak Near Shackleton minimum horizon (${minShack}°) must dip below 0°`);
    assert.ok(maxShack < 6.0, `Peak Near Shackleton maximum horizon (${maxShack}°) must be free of +15.8° step cliff artifacts`);

    const malapertSummit = getHorizonProfile(HORIZON_TABLE, 'mons-malapert');
    assert.ok(malapertSummit?.horizon, 'Mons Malapert horizon must exist');
    assert.equal(malapertSummit.latitude, -86.02);
    assert.equal(malapertSummit.longitude, 2.7);
    assert.ok(Math.max(...malapertSummit.horizon) < 5.0, 'Mons Malapert +5098m summit must have an unobstructed low horizon (< 5°)');
  });

  await t.test('SITES_TO_ANALYZE (slipSites.js) and PLANNER_CANDIDATES polar rims sit on actual LOLA DEM elevated terrain', async () => {
    const { SITES_TO_ANALYZE } = await import('../src/data/slipSites.js');
    const { latLonToStereoMeters, sampleDemMeters } = await import('../src/utils/horizons.js');

    for (const s of SITES_TO_ANALYZE) {
      const st = latLonToStereoMeters(s.lat, s.lon);
      const demElev = sampleDemMeters(st.x, st.y);
      assert.ok(demElev !== null, `DEM elevation must exist for ${s.id}`);
      assert.ok(
        Math.abs(demElev - s.elevationM) < 25,
        `Slip site ${s.id} (${s.name}) nominal elevation (${s.elevationM}m) must match LOLA DEM (${Math.round(demElev)}m)`
      );
    }

    const haworthRim = PLANNER_CANDIDATES.find((c) => c.id === 'landing-candidate-haworth-rim');
    const stHaworth = latLonToStereoMeters(haworthRim.lat, haworthRim.lon);
    const haworthElev = sampleDemMeters(stHaworth.x, stHaworth.y);
    assert.ok(haworthElev > 1000, `Haworth Crater Rim candidate must sit on elevated rim (> +1000m), got ${Math.round(haworthElev)}m`);

    const slaterPlain = PLANNER_CANDIDATES.find((c) => c.id === 'landing-candidate-slater-plain');
    const stSlater = latLonToStereoMeters(slaterPlain.lat, slaterPlain.lon);
    const slaterElev = sampleDemMeters(stSlater.x, stSlater.y);
    assert.ok(slaterElev > 0, `Slater Plain candidate must sit on elevated plain (> 0m), got ${Math.round(slaterElev)}m`);
  });
});
