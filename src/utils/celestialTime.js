/**
 * @file celestialTime.js
 * Shared UTC time source for the Moon, Earth, and other celestial renderers.
 */

import { createStore } from './pointerStore.js';

export const MIN_CELESTIAL_TIME_MS = Date.UTC(1900, 0, 1);
export const MAX_CELESTIAL_TIME_MS = Date.UTC(2100, 11, 31, 23, 59);
export const CELESTIAL_MINUTE_MS = 60_000;

export function normalizeCelestialTimeMs(when) {
  const ms = when instanceof Date ? when.getTime() : when;
  if (!Number.isFinite(ms)) {
    throw new TypeError('Celestial time must be a valid Date or timestamp.');
  }
  return Math.floor(ms / CELESTIAL_MINUTE_MS) * CELESTIAL_MINUTE_MS;
}

const store = createStore({
  ms: normalizeCelestialTimeMs(Date.now()),
  source: 'initial',
});

export const celestialTimeStore = {
  get: store.get,

  setTime(when, source = 'ephemeris') {
    const ms = normalizeCelestialTimeMs(when);
    if (ms < MIN_CELESTIAL_TIME_MS || ms > MAX_CELESTIAL_TIME_MS) {
      throw new RangeError('Celestial time must be between 1900 and 2100 UTC.');
    }

    if (ms !== store.get().ms) {
      store.set({ ms, source });
    }
    return ms;
  },

  setMs(when, source = 'ephemeris') {
    return this.setTime(when, source);
  },

  subscribe: store.subscribe,
};
