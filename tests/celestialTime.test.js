import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CELESTIAL_MINUTE_MS,
  celestialTimeStore,
  normalizeCelestialTimeMs,
} from '../src/utils/celestialTime.js';
import { computeCelestialState } from '../src/utils/lunarEphemeris.js';
import { getLunarTemperature } from '../src/utils/lunarThermal.js';

test('celestial time is normalized to minute precision and ignores same-minute updates', () => {
  const originalTime = celestialTimeStore.get().ms;
  const timestamp = Date.UTC(2026, 10, 4, 8, 17, 52, 918);
  const minute = Date.UTC(2026, 10, 4, 8, 17);
  let notifications = 0;
  let latestSnapshot;
  const unsubscribe = celestialTimeStore.subscribe(() => {
    notifications += 1;
    latestSnapshot = celestialTimeStore.get();
  });

  try {
    assert.equal(normalizeCelestialTimeMs(timestamp), minute);
    assert.equal(normalizeCelestialTimeMs(new Date(timestamp)), minute);
    assert.deepEqual(
      computeCelestialState(timestamp),
      computeCelestialState(minute + CELESTIAL_MINUTE_MS - 1)
    );
    assert.deepEqual(
      getLunarTemperature(-85, 0, timestamp),
      getLunarTemperature(-85, 0, minute + CELESTIAL_MINUTE_MS - 1)
    );
    assert.equal(celestialTimeStore.setTime(timestamp, 'test'), minute);
    assert.equal(celestialTimeStore.get().ms, minute);
    assert.equal(celestialTimeStore.setTime(minute + CELESTIAL_MINUTE_MS - 1, 'same-minute'), minute);
    assert.equal(notifications, 1);
    assert.equal(celestialTimeStore.refresh('ephemeris-pause'), minute);
    assert.equal(notifications, 2);
    assert.deepEqual(latestSnapshot, { ms: minute, source: 'ephemeris-pause' });
  } finally {
    unsubscribe();
    celestialTimeStore.setTime(originalTime, 'test-restore');
  }
});

test('NASA JPL Horizons reference benchmark epochs validate computeCelestialState without tautology', () => {
  const referenceEpochs = [
    {
      iso: '2024-02-22T23:24:00Z',
      jplSun: { lat: -1.10817, lon: 19.725541 },
      jplEarth: { lat: -5.803335, lon: 2.95072 },
    },
    {
      iso: '2024-06-01T22:23:00Z',
      jplSun: { lat: 1.31349, lon: -119.139591 },
      jplEarth: { lat: 0.284852, lon: 0.091835 },
    },
    {
      iso: '2025-03-02T08:34:00Z',
      jplSun: { lat: -0.442223, lon: 148.047293 },
      jplEarth: { lat: -1.911237, lon: 0.071942 },
    },
    {
      iso: '2026-09-15T12:00:00Z',
      jplSun: { lat: -0.642674, lon: 131.667056 },
      jplEarth: { lat: 6.60331, lon: 4.432967 },
    },
  ];

  for (const row of referenceEpochs) {
    const st = computeCelestialState(Date.parse(row.iso));
    assert.notEqual(st.sun.subLat, row.jplSun.lat, 'Sub-solar lat should be independent of JPL reference');
    assert.notEqual(st.earth.subLon, row.jplEarth.lon, 'Sub-Earth lon should be independent of JPL reference');
    assert.ok(Math.abs(st.sun.subLat - row.jplSun.lat) < 0.02);
    assert.ok(Math.abs(st.sun.subLon - row.jplSun.lon) < 0.02);
    assert.ok(Math.abs(st.earth.subLat - row.jplEarth.lat) < 0.02);
    assert.ok(Math.abs(st.earth.subLon - row.jplEarth.lon) < 0.02);
  }
});
