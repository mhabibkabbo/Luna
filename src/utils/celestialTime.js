/**
 * @file celestialTime.js
 * Shared UTC time source for the Moon, Earth, and other celestial renderers.
 */

import { createStore } from './pointerStore.js';

export const MIN_CELESTIAL_TIME_MS = Date.UTC(1900, 0, 1);
export const MAX_CELESTIAL_TIME_MS = Date.UTC(2100, 11, 31, 23, 59);

const store = createStore({ ms: Date.now() });

export const celestialTimeStore = {
  get: store.get,

  setTime(when) {
    const ms = when instanceof Date ? when.getTime() : when;
    if (!Number.isFinite(ms)) {
      throw new TypeError('Celestial time must be a valid Date or timestamp.');
    }
    if (ms < MIN_CELESTIAL_TIME_MS || ms > MAX_CELESTIAL_TIME_MS) {
      throw new RangeError('Celestial time must be between 1900 and 2100 UTC.');
    }

    store.set({ ms });
    return ms;
  },

  subscribe: store.subscribe,
};
