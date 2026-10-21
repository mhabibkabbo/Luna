import { computeCelestialState, solarPosition } from "./lunarEphemeris.js";

const cache = new Map();

/**
 * Samples Sun visibility over the next `days` days. Yields to the browser regularly so it
 * never blocks the main thread. horizonFn(azDeg) -> horizon angle in degrees (0 if unmodeled).
 */
export async function sweepIllumination({
  key,
  lat,
  lon,
  horizonFn,
  days = 30,
  stepMin = 120,
}) {
  const dayKey = `${key}|${Math.floor(Date.now() / 86400000)}`;
  if (cache.has(dayKey)) return cache.get(dayKey);

  const start = Date.now();
  const n = Math.round((days * 1440) / stepMin);
  const sunlit = new Array(n);

  for (let i = 0; i < n; i++) {
    const state = computeCelestialState(start + i * stepMin * 60000);
    const flat = solarPosition(state, lat, lon);
    const hz = horizonFn(flat.azimuthDeg);
    sunlit[i] = solarPosition(state, lat, lon, hz).status === "sunlit";
    if (i % 30 === 29) await new Promise((r) => setTimeout(r, 0)); // yield
  }

  let longestDark = 0;
  let run = 0;
  let lit = 0;
  for (const s of sunlit) {
    if (s) {
      lit++;
      run = 0;
    } else {
      run++;
      longestDark = Math.max(longestDark, run);
    }
  }

  const result = {
    stepMin,
    sunlit,
    sunlitPct: (lit / n) * 100,
    longestDarkHours: (longestDark * stepMin) / 60,
  };
  cache.set(dayKey, result);
  return result;
}
