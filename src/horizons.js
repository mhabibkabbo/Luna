import horizonData from "../data/horizons.json";

// Map ids that features carry on the map to the ids used in horizons.json
const ALIASES = {
  "landing-odysseus": "clps-im1-odysseus",
  "mons-malapert": "landing-artemis3-malapert",
  "mons-mouton": "landing-artemis3-mouton",
};

const resolveId = (id) => ALIASES[id] || id;

/** Synchronous access to the bundled table (the JSON is imported, so no fetch is needed). */
export const HORIZON_TABLE = horizonData;

export function loadHorizons() {
  return Promise.resolve(horizonData);
}

export function getHorizonProfile(table, siteId) {
  return table?.[resolveId(siteId)] ?? null;
}

export function hasHorizon(table, siteId) {
  return Boolean(getHorizonProfile(table, siteId)?.horizon);
}

/** Terrain horizon angle (deg) toward an azimuth, linearly interpolated. null = not modeled. */
export function horizonAt(table, siteId, azDeg) {
  const profile = getHorizonProfile(table, siteId);
  const h = profile?.horizon;
  if (!h) return null;
  const n = h.length;
  const a = (((azDeg % 360) + 360) % 360) * (n / 360);
  const i0 = Math.floor(a) % n;
  const i1 = (i0 + 1) % n;
  const f = a - Math.floor(a);
  if (profile.horizon_coverage) {
    const coverage0 = profile.horizon_coverage[i0];
    const coverage1 = profile.horizon_coverage[i1];
    if (
      !Number.isFinite(coverage0) ||
      !Number.isFinite(coverage1) ||
      coverage0 < 0.98 ||
      coverage1 < 0.98
    ) {
      return null;
    }
  }
  return h[i0] * (1 - f) + h[i1] * f;
}

/** Convenience for sweeps: terrain horizon toward azDeg, falling back to the flat 0° horizon. */
export function horizonOrFlat(table, siteId, azDeg) {
  return horizonAt(table, siteId, azDeg) ?? 0;
}
