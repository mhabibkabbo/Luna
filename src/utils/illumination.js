/**
 * High-precision time-series solar illumination and shadow transition sweep engine.
 *
 * Couples sub-arcsecond solar selenographic ephemeris vectors (Astronomy Engine + IAU WGCCRE 2009)
 * with 360° ray-marched LOLA DEM local terrain horizon profiles (LDEM_80S_400M) to compute
 * rigorous topocentric solar disk masking without taulogical or truncated analytical approximations.
 */

import { computeCelestialState, solarPosition } from "./lunarEphemeris.js";

/**
 * Samples Sun visibility and disk elevation over a configurable time window.
 * Yields regularly so it never blocks the browser's main thread.
 *
 * @param {Object} params
 * @param {string} params.key - Unique cache or task identifier
 * @param {number} params.lat - Selenographic latitude (-90° to +90°)
 * @param {number} params.lon - Selenographic longitude (-180° to +180°)
 * @param {(azDeg: number) => number} params.horizonFn - Horizon elevation angle lookup in degrees
 * @param {number} [params.startMs=Date.now()] - UTC start epoch in milliseconds
 * @param {number} [params.days=30] - Total sweep duration in days
 * @param {number} [params.stepMin=30] - Temporal discretization step in minutes
 * @param {AbortSignal} [params.signal] - Cancellation signal
 * @returns {Promise<{
 *   key: string,
 *   startMs: number,
 *   endMs: number,
 *   stepMin: number,
 *   visibility: ('sunlit'|'blocked'|'night')[],
 *   sunlitPct: number,
 *   longestDarkHours: number
 * } | null>}
 */
export async function sweepIllumination({
  key,
  lat,
  lon,
  horizonFn,
  startMs = Date.now(),
  days = 30,
  stepMin = 30,
  signal,
}) {
  const n = Math.round((days * 1440) / stepMin);
  const visibility = new Array(n);
  const stepMs = stepMin * 60000;

  for (let i = 0; i < n; i++) {
    if (signal?.aborted) return null;
    const state = computeCelestialState(startMs + (i + 0.5) * stepMs);
    const flat = solarPosition(state, lat, lon);
    const hz = horizonFn(flat.azimuthDeg);
    visibility[i] = solarPosition(state, lat, lon, hz).status;
    if (i % 30 === 29) await new Promise((r) => setTimeout(r, 0));
  }

  let longestDark = 0;
  let run = 0;
  let lit = 0;
  for (const status of visibility) {
    if (status === "sunlit") {
      lit++;
      run = 0;
    } else {
      run++;
      longestDark = Math.max(longestDark, run);
    }
  }

  const result = {
    key,
    startMs,
    endMs: startMs + days * 86400000,
    stepMin,
    visibility,
    sunlitPct: (lit / Math.max(1, n)) * 100,
    longestDarkHours: (longestDark * stepMin) / 60,
  };
  return result;
}
