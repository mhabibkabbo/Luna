/**
 * @file communication.test.js
 * Unit tests for the NASA-based Lunar Direct-to-Earth (DTE) Communication Availability Analysis System:
 * - NASA dataset integration & metadata provenance verification
 * - Elevation extraction & obstacle ray-marching against LOLA DEM
 * - Topocentric Earth line of sight & lunar curvature calculations
 * - Instantaneous DTE visibility evaluation (clear, blocked, doubtful, unavailable, relay)
 * - 30-day communication availability time sweep
 * - Contact window clustering & blackout interval accounting
 * - Spacecraft orbital relay modeling (LRO polar pass & EML-2 halo relay)
 * - Strict prohibition of fabricated dBm values & simulated measurements
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  COMMUNICATION_DATA_SOURCES,
  LUNAR_RELAYS,
  getSurfaceElevationM,
  getTerrainHorizonAngleDeg,
  computeRelayPositionKm,
  evaluateRelayVisibility,
  evaluateDteInstantaneous,
  sweepCommunicationAvailability,
} from '../src/utils/communicationAnalysis.js';
import { ensurePolarDemLoaded } from '../src/utils/horizons.js';
import { computeCelestialState } from '../src/utils/lunarEphemeris.js';

test('Communication Analysis: NASA Data Sources & Provenance Metadata', () => {
  // LOLA DEM verification
  assert.ok(COMMUNICATION_DATA_SOURCES.LOLA_DEM);
  assert.ok(COMMUNICATION_DATA_SOURCES.LOLA_DEM.name.includes('LOLA'));
  assert.equal(COMMUNICATION_DATA_SOURCES.LOLA_DEM.verticalDatum, 'IAU Lunar Reference Sphere (R₀ = 1,737,400.0 m)');
  assert.ok(COMMUNICATION_DATA_SOURCES.LOLA_DEM.verticalAccuracy.includes('±1.0 m'));

  // SPICE ephemeris verification
  assert.ok(COMMUNICATION_DATA_SOURCES.SPICE_EPHEMERIS);
  assert.ok(COMMUNICATION_DATA_SOURCES.SPICE_EPHEMERIS.name.includes('SPICE'));
  assert.equal(COMMUNICATION_DATA_SOURCES.SPICE_EPHEMERIS.frame, 'MOON_ME (Mean-Earth / Polar Axis Body-Fixed Frame)');

  // DSN network verification
  assert.ok(COMMUNICATION_DATA_SOURCES.DSN_NETWORK);
  assert.ok(COMMUNICATION_DATA_SOURCES.DSN_NETWORK.complexes.includes('Goldstone'));
  assert.ok(COMMUNICATION_DATA_SOURCES.DSN_NETWORK.elevationMask.includes('10.0°'));

  // Radio science baseline verification
  assert.ok(COMMUNICATION_DATA_SOURCES.RADIO_SCIENCE);
  assert.ok(COMMUNICATION_DATA_SOURCES.RADIO_SCIENCE.methodologyNote.includes('geometric line-of-sight physics rather than fabricated RF signal measurements'));
});

test('Communication Analysis: Surface Elevation Retrieval & South Pole Boundary Guards', async () => {
  await ensurePolarDemLoaded(true);

  // South Pole coordinate within 80°S-90°S DEM
  const malapertElev = getSurfaceElevationM(-85.97, 0.0);
  assert.ok(malapertElev !== null, 'Should return numeric elevation for South Pole coordinate');
  assert.ok(Number.isFinite(malapertElev));

  // Non-South-Pole coordinate (> -80°S) should return null (Data unavailable) rather than fake numbers
  const equatorElev = getSurfaceElevationM(0.0, 23.47);
  assert.equal(equatorElev, null, 'Should return null for non-South-Pole coordinates outside DEM');

  const crisiumElev = getSurfaceElevationM(17.0, 59.1);
  assert.equal(crisiumElev, null, 'Mare Crisium is outside 80°S-90°S DEM');
});

test('Communication Analysis: Topocentric Line-of-Sight & Terrain Obstacle Masking', async () => {
  await ensurePolarDemLoaded(true);

  const testEpochMs = new Date('2026-11-04T00:00:00Z').getTime();

  // Evaluate Mons Malapert Peak (-85.97°, 0.0°) - prominent ridge with high DTE visibility
  const malapertEval = evaluateDteInstantaneous({
    lat: -85.97,
    lon: 0.0,
    timeMs: testEpochMs,
    relayType: 'none',
  });

  assert.ok(Number.isFinite(malapertEval.elevationDeg));
  assert.ok(Number.isFinite(malapertEval.azimuthDeg));
  assert.ok(Number.isFinite(malapertEval.terrainMaskDeg));
  assert.ok(Number.isFinite(malapertEval.marginDeg));
  assert.ok(Number.isFinite(malapertEval.oneWayLightTimeSec));
  assert.ok(malapertEval.oneWayLightTimeSec > 1.1 && malapertEval.oneWayLightTimeSec < 1.4);

  // Evaluate Shackleton Crater interior (-89.9°, 0.0°) - deep crater floor prone to terrain blockage
  const shackletonEval = evaluateDteInstantaneous({
    lat: -89.9,
    lon: 0.0,
    timeMs: testEpochMs,
    relayType: 'none',
  });

  assert.ok(shackletonEval.status === 'clear' || shackletonEval.status === 'blocked' || shackletonEval.status === 'doubtful');
  assert.ok(typeof shackletonEval.reason === 'string');
});

test('Communication Analysis: Orbital Relay Mechanics (LRO 50 km Polar & EML-2 Halo)', () => {
  const testEpochMs = new Date('2026-11-04T12:00:00Z').getTime();
  const state = computeCelestialState(testEpochMs);

  // 1. LRO position calculation
  const lroPos = computeRelayPositionKm('lro', testEpochMs);
  assert.ok(lroPos, 'Should return LRO 3D position vector');
  assert.equal(lroPos.length, 3);
  const lroDistFromCenter = Math.hypot(...lroPos);
  // Radius should match ~1787.4 km (1737.4 + 50 km)
  assert.ok(Math.abs(lroDistFromCenter - 1787.4) < 1.0, `LRO radius should be ~1787.4 km, got ${lroDistFromCenter}`);

  // 2. EML-2 Halo position calculation
  const haloPos = computeRelayPositionKm('eml2_halo', testEpochMs);
  assert.ok(haloPos, 'Should return EML-2 Halo 3D position vector');
  assert.equal(haloPos.length, 3);
  // Position should hover south of the Moon (negative Z)
  assert.ok(haloPos[2] < -10000, `EML-2 Halo should hover over lunar South Pole (Z < -10000 km), got ${haloPos[2]}`);

  // 2b. Verify orthogonal phasing (Y uses sin, Z uses cos) preventing 1D diagonal collapse
  const haloPeriodMs = LUNAR_RELAYS.EML2_HALO.periodSec * 1000;
  const p0 = computeRelayPositionKm('eml2_halo', 0);
  const pQuarter = computeRelayPositionKm('eml2_halo', haloPeriodMs / 4);
  // At t=0 (phase=0): Y = 0, Z = -28000 + 12000 = -16000
  assert.ok(Math.abs(p0[1]) < 1e-3, `Y at phase 0 should be 0, got ${p0[1]}`);
  assert.ok(Math.abs(p0[2] - -16000) < 1, `Z at phase 0 should be -16000 km, got ${p0[2]}`);
  // At t=T/4 (phase=pi/2): Y = 14000, Z = -28000
  assert.ok(Math.abs(pQuarter[1] - 14000) < 1, `Y at phase pi/2 should be 14000 km, got ${pQuarter[1]}`);
  assert.ok(Math.abs(pQuarter[2] - -28000) < 1, `Z at phase pi/2 should be -28000 km, got ${pQuarter[2]}`);

  // 3. Relay visibility evaluation with siteId
  const relayEval = evaluateRelayVisibility({
    latDeg: -85.97,
    lonDeg: 0.0,
    elevationM: 3000,
    relayType: 'eml2_halo',
    timeMs: testEpochMs,
    state,
    siteId: 'mons-malapert',
  });

  assert.equal(typeof relayEval.isRelayAvailable, 'boolean');
  assert.ok(typeof relayEval.reason === 'string');
});

test('Communication Analysis: Multi-Day Time Sweep & Contact Window Clustering', async () => {
  await ensurePolarDemLoaded(true);

  const startEpochMs = new Date('2026-11-04T00:00:00Z').getTime();

  // Run 7-day sweep at 120-minute resolution for fast, thorough unit test
  const sweep = await sweepCommunicationAvailability({
    lat: -85.97,
    lon: 0.0,
    startMs: startEpochMs,
    durationDays: 7,
    stepMinutes: 120,
    relayType: 'none',
  });

  assert.ok(sweep, 'Sweep result should be defined');
  assert.ok(sweep.meta);
  assert.equal(sweep.meta.lat, -85.97);
  assert.equal(sweep.meta.durationDays, 7);

  // Statistics verification
  const stats = sweep.statistics;
  assert.ok(Number.isFinite(stats.directAvailabilityPct));
  assert.ok(stats.directAvailabilityPct >= 0 && stats.directAvailabilityPct <= 100);
  assert.ok(Number.isFinite(stats.totalAvailableHours));
  assert.ok(Number.isFinite(stats.totalBlackoutHours));
  assert.ok(Number.isFinite(stats.longestBlackoutHours));
  assert.ok(Number.isInteger(stats.windowCount));
  assert.ok(typeof stats.terrainObstructionStatus === 'string');

  // Verify total hours sum correctly
  const sumHours = stats.totalAvailableHours + stats.totalBlackoutHours;
  const expectedTotalHours = 7 * 24;
  assert.ok(Math.abs(sumHours - expectedTotalHours) < 1.0, `Sum of hours (${sumHours}) should equal 168h`);

  // Verify sample count
  const expectedSamples = Math.round((7 * 24 * 60) / 120); // 84 samples
  assert.equal(sweep.samples.length, expectedSamples);

  // Verify no fabricated signal strengths
  for (const sample of sweep.samples) {
    assert.equal(sample.signalDbm, undefined, 'Must NEVER generate fabricated dBm values');
    assert.ok(['clear', 'blocked', 'doubtful', 'relay', 'unavailable'].includes(sample.status));
  }
});
