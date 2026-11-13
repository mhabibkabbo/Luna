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

  refresh(source = 'ephemeris') {
    const current = store.get();
    store.set({ ms: current.ms, source });
    return current.ms;
  },

  setMs(when, source = 'ephemeris') {
    return this.setTime(when, source);
  },

  subscribe: store.subscribe,
};

/**
 * Formats a celestial or mission date into a standardized UTC timestamp string.
 * @internal Test & mission timeline utility export.
 * @param {Date|number|string} when - Date instance, epoch timestamp in ms, or ISO date string
 * @returns {string} Standardized UTC string (e.g., "2026-03-15 12:00 UTC")
 */
export function formatMissionDate(when) {
  const d = when instanceof Date ? when : new Date(when);
  if (!Number.isFinite(d.getTime())) return 'Invalid Date';
  return `${d.toISOString().replace('T', ' ').substring(0, 16)} UTC`;
}
