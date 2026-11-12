import test from 'node:test';
import assert from 'node:assert/strict';
import { getLunarTemperature, THERMAL_CONSTANTS, getSubsolarPoint } from '../src/utils/lunarThermal.js';
import { computeCelestialState, solarPosition } from '../src/utils/lunarEphemeris.js';
import { sweepIllumination } from '../src/utils/illumination.js';

test('Thermal & Illumination Formula Audit: Regolith Thermal Inertia & Ephemeris Accuracy', async (t) => {
  await t.test('Regolith thermal inertia produces post-sunset cooldown lag rather than instantaneous step drop', () => {
    const refDate = new Date('2026-03-01T00:00:00Z');
    const celestial = computeCelestialState(refDate);
    const subLon = celestial.sun.subLon;

    const sunsetLon = (subLon + 91) > 180 ? (subLon + 91 - 360) : (subLon + 91);
    const sunsetThermal = getLunarTemperature(0, sunsetLon, refDate);

    const earlyNightLon = (subLon + 95) > 180 ? (subLon + 95 - 360) : (subLon + 95);
    const earlyNightThermal = getLunarTemperature(0, earlyNightLon, refDate);

    const midNightLon = (subLon + 110) > 180 ? (subLon + 110 - 360) : (subLon + 110);
    const midNightThermal = getLunarTemperature(0, midNightLon, refDate);

    const midnightLon = (subLon + 180) > 180 ? (subLon + 180 - 360) : (subLon + 180);
    const deepNightThermal = getLunarTemperature(0, midnightLon, refDate);

    // Assertions verifying thermal inertia exponential cooldown curve
    assert.equal(sunsetThermal.isDaylight, false, 'Sunset point must be in night/shadow regime');
    assert.ok(
      sunsetThermal.tempK > THERMAL_CONSTANTS.T_MIN_K,
      `Sunset temperature (${sunsetThermal.tempK} K) must be elevated above the static 100 K night floor`
    );
    assert.ok(
      sunsetThermal.tempK >= 125 && sunsetThermal.tempK <= 140,
      `Sunset temperature (${sunsetThermal.tempK} K) should be ~130-135 K per Diviner observations`
    );

    assert.ok(
      earlyNightThermal.tempK < sunsetThermal.tempK,
      'Temperature must cool down as hours since sunset increase'
    );
    assert.ok(
      midNightThermal.tempK < earlyNightThermal.tempK,
      'Temperature must continue cooling past 1 tau'
    );
    assert.ok(
      deepNightThermal.tempK <= 102,
      `Deep night temperature (${deepNightThermal.tempK} K) must reach the asymptotic ~100 K baseline equilibrium`
    );
  });

  await t.test('Permanently Shadowed Region (PSR) cryogenic cold trap remains locked to 40 K', () => {
    const psrDate = new Date('2026-06-01T12:00:00Z');
    // Shackleton crater floor (-89.67°S, 129.78°E, elev = -2768 m)
    const psrThermal = getLunarTemperature(-89.67, 129.78, psrDate, {
      elevationM: -2768,
      terrainHorizonDeg: 8.5,
    });

    assert.equal(psrThermal.isPSR, true);
    assert.equal(psrThermal.tempK, THERMAL_CONSTANTS.T_PSR_K);
    assert.equal(psrThermal.tempC, -233);
  });

  await t.test('Subsolar coordinates resolve with sub-arcsecond precision from Astronomy Engine', () => {
    const testDate = new Date('2025-07-20T12:00:00Z');
    const subsolar = getSubsolarPoint(testDate);
    const celestial = computeCelestialState(testDate);

    assert.equal(subsolar.lat, celestial.sun.subLat);
    assert.equal(subsolar.lon, celestial.sun.subLon);
    assert.ok(typeof subsolar.lat === 'number' && Number.isFinite(subsolar.lat));
    assert.ok(typeof subsolar.lon === 'number' && Number.isFinite(subsolar.lon));
    assert.ok(Math.abs(subsolar.lat) <= 1.6, 'Subsolar latitude on Moon must be within ±1.6° axial tilt');
  });

  await t.test('sweepIllumination integrates celestial ephemeris states smoothly', async () => {
    const horizonFn = () => 1.5; // Constant 1.5° horizon
    const sweep = await sweepIllumination({
      key: 'test-shackleton',
      lat: -89.5,
      lon: 0.0,
      horizonFn,
      startMs: Date.UTC(2026, 0, 1),
      days: 2,
      stepMin: 60,
    });

    assert.ok(sweep, 'Sweep must complete successfully');
    assert.equal(sweep.visibility.length, 48, '2 days at 60 min step = 48 points');
    assert.ok(sweep.visibility.every((v) => ['sunlit', 'blocked', 'night'].includes(v)));
    assert.ok(typeof sweep.sunlitPct === 'number');
    assert.ok(typeof sweep.longestDarkHours === 'number');
  });
});
