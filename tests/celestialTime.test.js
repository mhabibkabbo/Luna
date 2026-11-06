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
  const unsubscribe = celestialTimeStore.subscribe(() => {
    notifications += 1;
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
  } finally {
    unsubscribe();
    celestialTimeStore.setTime(originalTime, 'test-restore');
  }
});
