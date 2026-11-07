import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeTerrainSuitability,
  computeSolarSuitability,
  computeCommunicationSuitability,
  computeThermalSuitability,
  computeOverallSuitability,
  DEFAULT_SUITABILITY_WEIGHTS,
  DEFAULT_STEP_HOURS,
} from '../src/utils/suitabilityScoring.js';
import {
  COMPARISON_PARAMETER_DEFINITIONS,
  evaluateComparisonLocation,
} from '../src/utils/comparisonEngine.js';

test('Unified Suitability Scoring & Provenance Formula Alignment', async (t) => {
  await t.test('Terrain suitability respects 15° tip-over limit and handles roughness penalty', () => {
    // 0° slope = 100
    assert.equal(computeTerrainSuitability(0), 100);
    // 7.5° slope = ~50
    assert.equal(computeTerrainSuitability(7.5), 50);
    // 15° slope = 0
    assert.equal(computeTerrainSuitability(15), 0);
    // >15° slope clamped to 0
    assert.equal(computeTerrainSuitability(18), 0);
    // Missing slope returns null (strict scientific integrity)
    assert.equal(computeTerrainSuitability(null), null);
    assert.equal(computeTerrainSuitability(undefined), null);

    // Roughness penalty for > 10 m
    assert.equal(computeTerrainSuitability(0, 5), 100);
    assert.equal(computeTerrainSuitability(0, 15), 94); // 100 - (15-10)*1.2 = 94
  });

  await t.test('Solar suitability executes 75% insolation + 25% darkness survival matching provenance', () => {
    // 100% sunlit with 0 dark hours = 100
    assert.equal(computeSolarSuitability(100, 0, 336), 100);

    // 50% sunlit with 168 hours of continuous darkness in 336 hour window:
    // darkSurvival = round(100 - (168/336)*100) = 50
    // score = round(0.75 * 50 + 0.25 * 50) = 50
    assert.equal(computeSolarSuitability(50, 168, 336), 50);

    // Verify provenance formula definition string in comparisonEngine matches
    const solarDef = COMPARISON_PARAMETER_DEFINITIONS.find((p) => p.id === 'solarSuitability');
    assert.ok(solarDef);
    assert.match(
      solarDef.provenance.method,
      /S_solar = round\(0\.75 \* sunlitPct \+ 0\.25 \* max\(0, min\(100, round\(100 - \(longestDarkHours \/ totalHours\) \* 100\)\)\)\)/
    );
  });

  await t.test('Communication suitability enforces 80% DTE + 20% blackout resistance and farside 0', () => {
    // 100% DTE with 0 blackout hours = 100
    assert.equal(computeCommunicationSuitability(100, 0, 336, false), 100);

    // Farside is strictly 0 without relay
    assert.equal(computeCommunicationSuitability(100, 0, 336, true), 0);
    assert.equal(computeCommunicationSuitability(0, 336, 336, false), 0);

    // 50% DTE with 168 hours blackout in 336 hour window = 50
    assert.equal(computeCommunicationSuitability(50, 168, 336, false), 50);

    // Verify provenance definition in comparisonEngine matches
    const commDef = COMPARISON_PARAMETER_DEFINITIONS.find((p) => p.id === 'commSuitability');
    assert.ok(commDef);
    assert.match(
      commDef.provenance.method,
      /S_comm = earthVisibilityPct === 0 \? 0 : round\(0\.80 \* dteAvailabilityPct \+ 0\.20 \* max\(0, min\(100, round\(100 - \(maxBlackoutHours \/ totalHours\) \* 100\)\)\)\)/
    );
  });

  await t.test('Thermal suitability executes 70% min temp norm + 30% swing norm with 3.2 divisor matching provenance', () => {
    // 250 K min temp, 0 swing = 100
    assert.equal(computeThermalSuitability(250, 0), 100);

    // 40 K min temp (PSR floor), 0 swing = 30 (from 30% swingNorm)
    assert.equal(computeThermalSuitability(40, 0), 30);

    // Verify divisor 3.2 in provenance definition matches code
    const thermalDef = COMPARISON_PARAMETER_DEFINITIONS.find((p) => p.id === 'thermalSuitability');
    assert.ok(thermalDef);
    assert.match(thermalDef.provenance.method, /tempVariationC \/ 3\.2/);
  });

  await t.test('Overall suitability strictly guards missing terrain data (never fabricates 0 or 50)', () => {
    // Missing terrain slope returns null overall score
    const missingSlopeResult = computeOverallSuitability({
      solarSuitability: 85,
      commSuitability: 90,
      terrainSuitability: null,
      thermalSuitability: 70,
    });
    assert.equal(missingSlopeResult.overallScore, null);
    assert.equal(missingSlopeResult.overallSuitability, null);
    assert.equal(missingSlopeResult.hasCompleteScoringInputs, false);
    assert.equal(missingSlopeResult.isPartialScore, true);
    assert.equal(missingSlopeResult.suitabilityLabel, 'Insufficient Data for Scoring');
    assert.match(missingSlopeResult.formulaString, /Slope: Not present/);

    // Complete inputs calculate 35% Sun, 30% Comm, 20% Terrain, 15% Thermal
    const completeResult = computeOverallSuitability({
      solarSuitability: 100,
      commSuitability: 100,
      terrainSuitability: 100,
      thermalSuitability: 100,
    });
    assert.equal(completeResult.overallScore, 100);
    assert.equal(completeResult.hasCompleteScoringInputs, true);
    assert.equal(completeResult.isPartialScore, false);
    assert.match(completeResult.formulaString, /35%·Sun\(100\) \+ 30%·DTE\(100\) \+ 20%·Slope\(100\) \+ 15%·Thermal\(100\)/);
  });

  await t.test('Overall suitability flags slope >= 15° as disqualified', () => {
    const steepResult = computeOverallSuitability({
      solarSuitability: 90,
      commSuitability: 90,
      terrainSuitability: 0,
      thermalSuitability: 90,
      slopeDeg: 16.5,
    });
    assert.match(steepResult.suitabilityLabel, /Disqualified: Slope ≥ 15°/);
  });

  await t.test('Standard step hours is unified to 2 hours', () => {
    assert.equal(DEFAULT_STEP_HOURS, 2);
  });
});
