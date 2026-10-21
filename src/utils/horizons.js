import horizonData from "../data/horizons.json";

// Map ids that features carry on the map to the ids used in horizons.json
const ALIASES = {
  "landing-odysseus": "clps-im1-odysseus",
  "mons-malapert": "landing-artemis3-malapert",
  "mons-mouton": "landing-artemis3-mouton",
};

const resolveId = (id) => ALIASES[id] || id;

export function loadHorizons() {
  return Promise.resolve(horizonData);
}

export function hasHorizon(table, siteId) {
  return Boolean(table?.[resolveId(siteId)]?.horizon);
}

/** Terrain horizon angle (deg) toward an azimuth, linearly interpolated. null = not modeled. */
export function horizonAt(table, siteId, azDeg) {
  const h = table?.[resolveId(siteId)]?.horizon;
  if (!h) return null;
  const n = h.length;
  const a = (((azDeg % 360) + 360) % 360) * (n / 360);
  const i0 = Math.floor(a) % n;
  const i1 = (i0 + 1) % n;
  const f = a - Math.floor(a);
  return h[i0] * (1 - f) + h[i1] * f;
}
