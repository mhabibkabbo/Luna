import { computeCelestialState, solarPosition } from "./lunarEphemeris.js";

/**
 * Samples Sun visibility over a time window. Yields regularly so it never blocks the
 * browser's main thread. horizonFn(azDeg) -> horizon angle in degrees (0 if unmodeled).
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
    if (i % 30 === 29) await new Promise((r) => setTimeout(r, 0)); // yield
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
    sunlitPct: (lit / n) * 100,
    longestDarkHours: (longestDark * stepMin) / 60,
  };
  return result;
}
