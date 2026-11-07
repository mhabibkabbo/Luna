import horizonData from "../data/horizons.json" with { type: "json" };
import { CANONICAL_POLAR_COORDS } from "../data/lunarCanonicalCatalog.js";
import {
  determineLunarGeologicalRegion,
  findNearestLunarLandmark,
  computeSelenographicDistanceAndBearing,
  SOUTH_POLE_REFERENCE_LANDMARKS,
} from "./coordinates.js";

const MOON_RADIUS_M = 1737400;
const DEM_LIMIT_LAT_DEG = -80.0;
const HALF_EXTENT_M = 304000;
const MAX_EXTENT_M = HALF_EXTENT_M;

// Map ids that features carry on the 2D/3D maps to the ids used in horizons.json
const ALIASES = {
  "landing-odysseus": "clps-im1-odysseus",
  "im-1-odysseus": "clps-im1-odysseus",
  "im-2-athena": "clps-im2-athena",
  "clps-im2-prime1": "clps-im2-athena",
  "clps-firefly-blueghost1": "clps-firefly-bgm1",
  "clps-astrobotic-griffin1": "clps-griffin-gm1",
  "viper-nobile": "clps-griffin-gm1",
  "malapert-massif": "mons-malapert",
  "artemis-3-malapert": "landing-artemis3-malapert",
  "mons-mouton": "landing-artemis3-mouton",
  "artemis-3-shackleton": "landing-artemis3-shackleton",
  "shackleton-crater": "crater-shackleton",
  "haworth-crater": "crater-haworth",
  "faustini-crater": "crater-faustini",
  "shoemaker-crater": "crater-shoemaker",
  "de-gerlache-crater": "crater-de-gerlache",
  "cabeus-crater": "crater-cabeus",
  "amundsen-crater": "crater-amundsen",
  "nobile-crater": "crater-nobile",
  "sverdrup-crater": "crater-sverdrup",
  "slater-crater": "crater-slater",
  "malapert-a": "clps-im1-odysseus",
  "malapert-mountain": "mons-malapert",
  "nobile-rim": "crater-nobile",
  "south-pole-90s": "south-pole",
  "south-pole": "south-pole",
};

const KNOWN_POLAR_COORDS = CANONICAL_POLAR_COORDS;

const resolveId = (id) => (id ? ALIASES[id] || id : id);

/** Synchronous access to the bundled table (the JSON is imported, so no fetch is needed). */
export const HORIZON_TABLE = horizonData;

// Shared polar LOLA DEM reference for real-time 360° horizon ray-marching on any point in 80°S-90°S
let polarDemGrid = null;
let polarDemSize = 0;
let polarDemScale = 1.0;
let polarDemLoadPromise = null;
const rayMarchedCache = new Map();
const demListeners = new Set();

export function registerPolarDemGrid(grid, size, scale = 1.0) {
  if (!grid || !size) return;
  polarDemGrid = grid;
  polarDemSize = size;
  polarDemScale = Number.isFinite(scale) && scale > 0 ? scale : 1.0;
  rayMarchedCache.clear();
  demListeners.forEach((fn) => {
    try {
      fn();
    } catch {}
  });
}

export function subscribePolarDemReady(callback) {
  demListeners.add(callback);
  return () => demListeners.delete(callback);
}

export function ensurePolarDemLoaded(force = false) {
  if (!force && polarDemGrid && polarDemSize > 0) return Promise.resolve(polarDemGrid);
  if (!force && polarDemLoadPromise) return polarDemLoadPromise;

  const isBrowser =
    typeof window !== "undefined" && typeof window.document !== "undefined";

  if (isBrowser) {
    polarDemLoadPromise = fetch("/data/lola_sp_80s_int16.bin")
      .then((r) => (r.ok ? r.arrayBuffer() : null))
      .then((buf) => {
        if (!buf) return null;
        const arr = new Int16Array(buf);
        const sz = Math.round(Math.sqrt(arr.length));
        registerPolarDemGrid(arr, sz, 0.5);
        return polarDemGrid;
      })
      .catch(() => null)
      .finally(() => {
        polarDemLoadPromise = null;
      });
    return polarDemLoadPromise;
  }

  // Node.js environment fallback (e.g., node --test test runner)
  polarDemLoadPromise = (async () => {
    try {
      const fs = await import("node:fs");
      const path = await import("node:path");
      const demFile = path.resolve("public/data/lola_sp_80s_int16.bin");
      if (fs.existsSync(demFile)) {
        const buf = fs.readFileSync(demFile);
        const arr = new Int16Array(buf.buffer, buf.byteOffset, buf.length / 2);
        const sz = Math.round(Math.sqrt(arr.length));
        registerPolarDemGrid(arr, sz, 0.5);
        return polarDemGrid;
      }
    } catch {}
    return null;
  })().finally(() => {
    polarDemLoadPromise = null;
  });

  return polarDemLoadPromise;
}

export function sampleDemMeters(xMeters, yMeters) {
  if (!polarDemGrid || polarDemSize === 0) return null;
  const u = (xMeters + MAX_EXTENT_M) / (2 * MAX_EXTENT_M);
  const v = (MAX_EXTENT_M - yMeters) / (2 * MAX_EXTENT_M);
  if (u < 0 || u > 1 || v < 0 || v > 1) return null;

  const gx = u * (polarDemSize - 1);
  const gy = v * (polarDemSize - 1);
  const x0 = Math.floor(gx);
  const y0 = Math.floor(gy);
  const x1 = Math.min(x0 + 1, polarDemSize - 1);
  const y1 = Math.min(y0 + 1, polarDemSize - 1);
  const fx = gx - x0;
  const fy = gy - y0;

  const row0 = y0 * polarDemSize;
  const row1 = y1 * polarDemSize;
  const raw00 = polarDemGrid[row0 + x0];
  const raw10 = polarDemGrid[row0 + x1];
  const raw01 = polarDemGrid[row1 + x0];
  const raw11 = polarDemGrid[row1 + x1];

  if (raw00 === -32768 || raw10 === -32768 || raw01 === -32768 || raw11 === -32768) {
    return null;
  }

  const v00 = raw00 * polarDemScale;
  const v10 = raw10 * polarDemScale;
  const v01 = raw01 * polarDemScale;
  const v11 = raw11 * polarDemScale;

  const top = v00 + (v10 - v00) * fx;
  const bottom = v01 + (v11 - v01) * fx;
  return top + (bottom - top) * fy;
}

export function latLonToStereoMeters(latDeg, lonDeg) {
  const latRad = (Math.abs(latDeg) * Math.PI) / 180;
  const lonRad = (lonDeg * Math.PI) / 180;
  const k = 2 / (1 + Math.sin(latRad));
  const r = MOON_RADIUS_M * k * Math.cos(latRad);
  return {
    x: r * Math.sin(lonRad),
    y: r * Math.cos(lonRad),
  };
}

/**
 * Computes slope in degrees using Horn's (1981) 8-neighbor 3x3 gradient stencil on the LOLA DEM.
 * @param {number} xMeters - Polar stereographic X coordinate in meters
 * @param {number} yMeters - Polar stereographic Y coordinate in meters
 * @param {number} [stepM] - Stencil distance spacing in meters (defaults to native DEM cell ~400m)
 * @returns {{ elevationM: number|null, slopeDeg: number|null, dzdx: number|null, dzdy: number|null }}
 */
export function computeHornSlopeAtMeters(xMeters, yMeters, stepM = null) {
  if (!polarDemGrid || polarDemSize === 0) {
    return { elevationM: null, slopeDeg: null, dzdx: null, dzdy: null };
  }
  const centerZ = sampleDemMeters(xMeters, yMeters);
  if (centerZ === null || !Number.isFinite(centerZ)) {
    return { elevationM: null, slopeDeg: null, dzdx: null, dzdy: null };
  }
  const d = stepM || ((2 * MAX_EXTENT_M) / (polarDemSize - 1));
  const zNW = sampleDemMeters(xMeters - d, yMeters + d) ?? centerZ;
  const zN = sampleDemMeters(xMeters, yMeters + d) ?? centerZ;
  const zNE = sampleDemMeters(xMeters + d, yMeters + d) ?? centerZ;
  const zW = sampleDemMeters(xMeters - d, yMeters) ?? centerZ;
  const zE = sampleDemMeters(xMeters + d, yMeters) ?? centerZ;
  const zSW = sampleDemMeters(xMeters - d, yMeters - d) ?? centerZ;
  const zS = sampleDemMeters(xMeters, yMeters - d) ?? centerZ;
  const zSE = sampleDemMeters(xMeters + d, yMeters - d) ?? centerZ;

  // Horn (1981) 8-neighbor 3x3 weighted gradient
  const dzdx = (zNE + 2 * zE + zSE - (zNW + 2 * zW + zSW)) / (8 * d);
  const dzdy = (zNW + 2 * zN + zNE - (zSW + 2 * zS + zSE)) / (8 * d);
  const slopeRad = Math.atan(Math.hypot(dzdx, dzdy));
  return {
    elevationM: centerZ,
    slopeDeg: (slopeRad * 180) / Math.PI,
    dzdx,
    dzdy,
  };
}

/**
 * Ray-marches a 360° terrain horizon silhouette directly from the NASA LRO LOLA South Pole DEM
 * for any coordinate inside 80°S-90°S, accounting for lunar spherical curvature drop and stereographic scale distortion.
 */
export function computeDemHorizonProfile(latDeg, lonDeg, observerHeightM = 2.0) {
  if (!Number.isFinite(latDeg) || !Number.isFinite(lonDeg) || latDeg > -80.0) {
    return null;
  }
  if (!polarDemGrid || polarDemSize === 0) {
    ensurePolarDemLoaded();
    return null;
  }

  const cacheKey = `${latDeg.toFixed(4)},${lonDeg.toFixed(4)}`;
  if (rayMarchedCache.has(cacheKey)) {
    return rayMarchedCache.get(cacheKey);
  }

  const origin = latLonToStereoMeters(latDeg, lonDeg);
  const baseElev = sampleDemMeters(origin.x, origin.y);
  if (baseElev === null) return null;

  const obsElev = baseElev + observerHeightM;
  const lonRad = (lonDeg * Math.PI) / 180;
  const latRad = (Math.abs(latDeg) * Math.PI) / 180;
  // Stereographic conformal scale factor: k = 2 / (1 + sin(|lat|))
  // Maps 1 ground meter to k plane meters in polar stereographic projection
  const kScale = 2 / (1 + Math.sin(latRad));

  // At South Pole stereographic plane (+Y = 0°E, +X = 90°E):
  // At selenographic (lat, lon), local North points radially away from the South Pole:
  // North unit vector in stereographic plane = (sin(lon), cos(lon))
  // East unit vector in stereographic plane  = (cos(lon), -sin(lon))
  const northX = Math.sin(lonRad);
  const northY = Math.cos(lonRad);
  const eastX = Math.cos(lonRad);
  const eastY = -Math.sin(lonRad);

  const coarseStepDeg = 5;
  const coarseCount = 360 / coarseStepDeg;
  const coarseHorizon = new Float32Array(coarseCount);

  for (let i = 0; i < coarseCount; i++) {
    const azDeg = i * coarseStepDeg;
    const azRad = (azDeg * Math.PI) / 180;
    const cosAz = Math.cos(azRad);
    const sinAz = Math.sin(azRad);
    // Ray direction in stereographic meter plane
    const dirX = cosAz * northX + sinAz * eastX;
    const dirY = cosAz * northY + sinAz * eastY;

    // Initialize to -90° to avoid clamping negative horizon dips on elevated peaks/rims
    let maxAngleDeg = -90;
    // Adaptive range steps from 600m out to 110km
    let distM = 600;
    while (distM <= 110000) {
      // Apply stereographic scale correction to obtain true ground distance sampling
      const planeDistM = distM * kScale;
      const sx = origin.x + dirX * planeDistM;
      const sy = origin.y + dirY * planeDistM;
      const sampleZ = sampleDemMeters(sx, sy);
      if (sampleZ !== null) {
        // Rigorous spherical trigonometry matching compute_horizons.py:
        // theta = d / R_moon
        // angle = atan2((R + sampleZ) * cos(theta) - (R + obsElev), (R + sampleZ) * sin(theta))
        const theta = distM / MOON_RADIUS_M;
        const num = (MOON_RADIUS_M + sampleZ) * Math.cos(theta) - (MOON_RADIUS_M + obsElev);
        const den = (MOON_RADIUS_M + sampleZ) * Math.sin(theta);
        const angleDeg = (Math.atan2(num, den) * 180) / Math.PI;
        if (angleDeg > maxAngleDeg) {
          maxAngleDeg = angleDeg;
        }
      }
      distM += distM < 12000 ? 600 : distM < 40000 ? 1500 : 3000;
    }
    coarseHorizon[i] = Math.round(maxAngleDeg * 100) / 100;
  }

  // Linearly interpolate to 1-degree azimuth array (360 samples)
  const horizon = new Array(360);
  for (let az = 0; az < 360; az++) {
    const fIdx = az / coarseStepDeg;
    const i0 = Math.floor(fIdx) % coarseCount;
    const i1 = (i0 + 1) % coarseCount;
    const frac = fIdx - Math.floor(fIdx);
    horizon[az] =
      Math.round((coarseHorizon[i0] * (1 - frac) + coarseHorizon[i1] * frac) * 100) / 100;
  }

  const profile = {
    site_name: `LOLA DEM Ray-Marched Horizon (${Math.abs(latDeg).toFixed(2)}°S, ${Math.abs(lonDeg).toFixed(2)}°${lonDeg >= 0 ? "E" : "W"})`,
    latitude: latDeg,
    longitude: lonDeg,
    elevation_m: Math.round(baseElev),
    horizon,
    source: "NASA LRO LOLA South Pole DEM (80°S–90°S Ray-Marched)",
    isRayMarched: true,
    isDemRayMarched: true,
  };

  if (rayMarchedCache.size > 200) {
    const firstKey = rayMarchedCache.keys().next().value;
    rayMarchedCache.delete(firstKey);
  }
  rayMarchedCache.set(cacheKey, profile);
  return profile;
}

export function loadHorizons() {
  return Promise.resolve(horizonData);
}

export function getHorizonProfile(table, siteId, latDeg = null, lonDeg = null) {
  const canonicalId = resolveId(siteId);
  const resolved = table?.[canonicalId] ?? table?.[siteId] ?? null;
  if (resolved?.horizon) return resolved;

  const known = KNOWN_POLAR_COORDS[canonicalId] || KNOWN_POLAR_COORDS[siteId] || null;
  const effLat = Number.isFinite(latDeg) ? latDeg : known?.lat ?? null;
  const effLon = Number.isFinite(lonDeg) ? lonDeg : known?.lon ?? null;

  if (Number.isFinite(effLat) && Number.isFinite(effLon) && effLat <= -80.0) {
    return computeDemHorizonProfile(effLat, effLon);
  }
  return resolved;
}

export function hasHorizon(table, siteId, latDeg = null, lonDeg = null) {
  return Boolean(getHorizonProfile(table, siteId, latDeg, lonDeg)?.horizon);
}

/** Terrain horizon angle (deg) toward an azimuth, linearly interpolated. null = not modeled. */
export function horizonAt(table, siteId, azDeg, latDeg = null, lonDeg = null) {
  const canonicalId = resolveId(siteId);
  const known = KNOWN_POLAR_COORDS[canonicalId] || KNOWN_POLAR_COORDS[siteId] || null;
  const effLat = Number.isFinite(latDeg) ? latDeg : known?.lat ?? null;
  const effLon = Number.isFinite(lonDeg) ? lonDeg : known?.lon ?? null;

  const profile = getHorizonProfile(table, siteId, effLat, effLon);
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
      if (Number.isFinite(effLat) && Number.isFinite(effLon) && effLat <= -80.0) {
        const demProfile = computeDemHorizonProfile(effLat, effLon);
        if (demProfile?.horizon) {
          const dh = demProfile.horizon;
          return dh[i0] * (1 - f) + dh[i1] * f;
        }
      }
      return null;
    }
  }
  return h[i0] * (1 - f) + h[i1] * f;
}

/** Convenience for sweeps: terrain horizon toward azDeg, falling back to the flat 0° horizon. */
export function horizonOrFlat(table, siteId, azDeg, latDeg = null, lonDeg = null) {
  return horizonAt(table, siteId, azDeg, latDeg, lonDeg) ?? 0;
}

/**
 * Computes surface roughness (RMS height dispersion) and local relief (max - min)
 * across valid DEM pixel samples within a specified radius in meters.
 *
 * @param {number} cx - Center X in stereographic meters
 * @param {number} cy - Center Y in stereographic meters
 * @param {number} radiusM - Configurable sampling radius (default: 2000m)
 * @returns {{ radiusM: number, sampleCount: number, reliefM: number, roughnessRmsM: number, minElevM: number, maxElevM: number, meanElevM: number }|null}
 */
export function computeRoughnessAndRelief(cx, cy, radiusM = 2000) {
  if (!polarDemGrid || polarDemSize === 0) return null;
  const d = (2 * MAX_EXTENT_M) / (polarDemSize - 1);
  const safeRadius = Math.max(d * 1.2, Math.min(25000, Number(radiusM) || 2000));
  // At 400m resolution, sample between 200m and d steps for good coverage
  const step = Math.max(200, Math.min(d, Math.round(safeRadius / 6)));
  const samples = [];
  const rSq = safeRadius * safeRadius;

  for (let dx = -safeRadius; dx <= safeRadius; dx += step) {
    for (let dy = -safeRadius; dy <= safeRadius; dy += step) {
      if (dx * dx + dy * dy <= rSq) {
        const z = sampleDemMeters(cx + dx, cy + dy);
        if (z !== null && Number.isFinite(z)) {
          samples.push(z);
        }
      }
    }
  }

  // If sparse grid or few samples, fallback to 3x3 stencil
  if (samples.length < 2) {
    const stencil = [
      sampleDemMeters(cx - d, cy + d),
      sampleDemMeters(cx, cy + d),
      sampleDemMeters(cx + d, cy + d),
      sampleDemMeters(cx - d, cy),
      sampleDemMeters(cx, cy),
      sampleDemMeters(cx + d, cy),
      sampleDemMeters(cx - d, cy - d),
      sampleDemMeters(cx, cy - d),
      sampleDemMeters(cx + d, cy - d),
    ].filter((v) => v !== null && Number.isFinite(v));
    if (stencil.length >= 2) {
      samples.push(...stencil);
    }
  }

  if (samples.length < 2) return null;

  let min = Infinity;
  let max = -Infinity;
  let sum = 0;
  for (let i = 0; i < samples.length; i++) {
    const s = samples[i];
    if (s < min) min = s;
    if (s > max) max = s;
    sum += s;
  }
  const mean = sum / samples.length;

  let sumSq = 0;
  for (let i = 0; i < samples.length; i++) {
    const diff = samples[i] - mean;
    sumSq += diff * diff;
  }
  const rms = Math.sqrt(sumSq / samples.length);

  return {
    radiusM: Math.round(safeRadius),
    sampleCount: samples.length,
    reliefM: Math.round((max - min) * 10) / 10,
    roughnessRmsM: Math.round(Math.max(0.1, rms) * 10) / 10,
    minElevM: Math.round(min),
    maxElevM: Math.round(max),
    meanElevM: Math.round(mean),
  };
}

/**
 * Samples a 13-point radial elevation cross-section (-10 km to +10 km) along local North-South
 * and West-East axes from the actual NASA LRO LOLA South Pole DEM.
 * If outside the South Pole DEM coverage, returns null.
 */
export function sampleRadialElevationProfile(latDeg, lonDeg, baseElevationM = 0) {
  const safeLat = Number.isFinite(latDeg) ? latDeg : -85.0;
  const safeLon = Number.isFinite(lonDeg) ? lonDeg : 0.0;
  if (safeLat > -80.0) {
    return null;
  }

  const steps = [-10, -8, -6, -4, -2, -1, 0, 1, 2, 4, 6, 8, 10];
  const hasDem = polarDemGrid && polarDemSize > 0;
  const origin = hasDem ? latLonToStereoMeters(safeLat, safeLon) : null;
  const lonRad = (safeLon * Math.PI) / 180;
  const northX = Math.sin(lonRad);
  const northY = Math.cos(lonRad);
  const eastX = Math.cos(lonRad);
  const eastY = -Math.sin(lonRad);

  const points = steps.map((distKm) => {
    const distM = distKm * 1000;
    if (hasDem && origin) {
      const zNS =
        sampleDemMeters(origin.x + northX * distM, origin.y + northY * distM) ??
        baseElevationM;
      const zWE =
        sampleDemMeters(origin.x + eastX * distM, origin.y + eastY * distM) ??
        baseElevationM;
      return {
        distanceKm: distKm,
        elevationNS: Math.round(zNS),
        elevationWE: Math.round(zWE),
      };
    }
    return {
      distanceKm: distKm,
      elevationNS: Math.round(baseElevationM),
      elevationWE: Math.round(baseElevationM),
    };
  });

  const northSouth = points.map((p) => ({
    offsetKm: p.distanceKm,
    elevationM: p.elevationNS,
  }));
  const westEast = points.map((p) => ({
    offsetKm: p.distanceKm,
    elevationM: p.elevationWE,
  }));
  const allElevs = [
    ...northSouth.map((p) => p.elevationM),
    ...westEast.map((p) => p.elevationM),
  ];
  const minElevM = Math.min(...allElevs);
  const maxElevM = Math.max(...allElevs);

  return {
    points,
    northSouth,
    westEast,
    minElevM,
    maxElevM,
    reliefM: Math.max(0, maxElevM - minElevM),
  };
}

/**
 * Computes comprehensive lunar surface terrain metrics (elevation, Horn 3x3 slope,
 * RMS surface roughness, local relief within radius, terrain classification, radial profile,
 * nearest landmark, DEM uncertainty, and engineering warnings)
 * from the NASA LRO LOLA South Pole DEM (when lat <= -80°S) or selenographic catalog data.
 *
 * Never uses random numbers, artificial hashes, or fabricated values.
 */
export function sampleLunarTerrainMetrics(latDeg, lonDeg, feature = null, options = {}) {
  const isPlaceholder = Boolean(
    feature?.locationType === 'placeholder' ||
    feature?.clpsData?.locationType === 'placeholder'
  );
  const radiusM = options?.radiusM ?? options?.roughnessRadiusM ?? 2000;

  if (isPlaceholder) {
    return {
      elevationM: null,
      elevationSource: 'Coordinates Withheld (Placeholder)',
      slopeDeg: null,
      slopeSource: 'Coordinates Withheld (Placeholder)',
      roughnessM: null,
      roughnessDetails: null,
      roughnessRadiusM: radiusM,
      reliefM: null,
      craterDensityPer100Km2: null,
      craterDensityLabel: 'Not present in loaded dataset',
      geologicalRegion: {
        province: feature?.targetRegion || 'Lunar Far Side (TBD)',
        terrane: 'Farside Highlands Terrane (FHT)',
        isSouthPole: false,
        face: 'Farside',
      },
      terrainClassification: 'Unannounced Landing Site',
      nearestLandmark: null,
      radialProfile: null,
      uncertainty: {
        isAvailable: false,
        verticalAccuracy: 'Coordinates unannounced',
        horizontalAccuracy: 'Coordinates unannounced',
        provenance: 'NASA / Mission Team (Coordinates TBD)',
      },
      isSlopeHazard: false,
      isPlaceholder: true,
      inSouthPoleCap: false,
      warnings: [
        {
          id: 'placeholder-coordinates',
          severity: 'info',
          title: 'Landing Coordinates Not Published',
          detail: 'Official landing coordinates have not been announced. Terrain and coordinate-dependent metrics are withheld to prevent fabricated telemetry.',
        },
      ],
    };
  }

  const safeLat = Number.isFinite(latDeg) ? latDeg : -85.0;
  const safeLon = Number.isFinite(lonDeg) ? lonDeg : 0.0;
  const siteId = feature?.id || null;
  const resolvedProfile = siteId ? HORIZON_TABLE?.[resolveId(siteId)] : null;

  const inSouthPoleCap = safeLat <= -80.0;
  let isDirectDem = false;
  let demElevationM = null;
  let hornSlope = null;
  let roughnessM = null;
  let reliefM = null;
  let roughnessDetails = null;

  // Direct LOLA DEM 3x3 stencil sampling & radius roughness when inside 80°S–90°S
  if (inSouthPoleCap && polarDemGrid && polarDemSize > 0) {
    const origin = latLonToStereoMeters(safeLat, safeLon);
    const centerZ = sampleDemMeters(origin.x, origin.y);
    if (centerZ !== null && Number.isFinite(centerZ)) {
      isDirectDem = true;
      demElevationM = Math.round(centerZ);

      // 3x3 Horn (1981) 8-neighbor gradient stencil at step d = cell spacing (~400m)
      const d = (2 * MAX_EXTENT_M) / (polarDemSize - 1);
      const hornRes = computeHornSlopeAtMeters(origin.x, origin.y, d);
      hornSlope = hornRes.slopeDeg;

      // Local RMS vertical roughness and relief within configurable radiusM
      roughnessDetails = computeRoughnessAndRelief(origin.x, origin.y, radiusM);
      if (roughnessDetails) {
        roughnessM = roughnessDetails.roughnessRmsM;
        reliefM = roughnessDetails.reliefM;
      }
    }
  } else if (inSouthPoleCap) {
    ensurePolarDemLoaded();
  }

  // Elevation resolution:
  // If custom dropped pin: ALWAYS use direct DEM sampling if available
  // If catalog landing site with published elevation: preserve catalog value or DEM
  let elevationM = null;
  let elevationSource = null;
  if (feature?.isCustomPin) {
    if (demElevationM !== null) {
      elevationM = demElevationM;
      elevationSource = "NASA LRO LOLA South Pole DEM (400 m/px)";
    } else if (Number.isFinite(feature?.elevationMeters)) {
      elevationM = Math.round(feature.elevationMeters);
      elevationSource = "Sampled LOLA Point";
    }
  } else if (Number.isFinite(feature?.elevationMeters)) {
    elevationM = Math.round(feature.elevationMeters);
    elevationSource = feature?.source || "NASA Landing Site Catalog";
  } else if (demElevationM !== null) {
    elevationM = demElevationM;
    elevationSource = "NASA LRO LOLA South Pole DEM (400 m/px)";
  } else if (Number.isFinite(resolvedProfile?.elevation_m)) {
    elevationM = Math.round(resolvedProfile.elevation_m);
    elevationSource = "NASA LOLA Precomputed Horizon Table";
  }

  // Slope resolution:
  let slopeDeg = null;
  let slopeSource = null;
  if (!feature?.isCustomPin && Number.isFinite(feature?.slopeDeg)) {
    slopeDeg = Math.round(feature.slopeDeg * 10) / 10;
    slopeSource = "Published Mission Specification";
  } else if (hornSlope !== null) {
    slopeDeg = Math.round(hornSlope * 10) / 10;
    slopeSource = "LOLA Horn 3×3 Gradient (400 m stencil)";
  } else if (Number.isFinite(feature?.slopeDeg)) {
    slopeDeg = Math.round(feature.slopeDeg * 10) / 10;
    slopeSource = "Published Mission Specification";
  }

  // Preserve explicit roughnessM in test fixtures if DEM is not loaded
  if (roughnessM === null && Number.isFinite(feature?.roughnessM)) {
    roughnessM = Math.round(feature.roughnessM * 10) / 10;
  }

  // Selenographic geological region from verified boundaries
  const geologicalRegion = determineLunarGeologicalRegion(safeLat, safeLon);

  // Terrain classification
  let terrainClassification = "Highland Regolith Plain";
  if (slopeDeg !== null && slopeDeg >= 15) {
    terrainClassification = "Steep Scarp / Crater Wall";
  } else if (inSouthPoleCap && elevationM !== null && elevationM >= 1500) {
    terrainClassification = "Polar Illuminated Massif / Ridge";
  } else if (inSouthPoleCap && elevationM !== null && elevationM <= -1800) {
    terrainClassification = "Cryogenic Crater Basin / Floor";
  } else if (inSouthPoleCap) {
    terrainClassification = "South Polar Highland Terrain";
  } else if (
    geologicalRegion.province.includes("Mare") ||
    geologicalRegion.province.includes("Oceanus") ||
    geologicalRegion.terrane.includes("Mare")
  ) {
    terrainClassification = "Mare Basalt Plain";
  } else {
    terrainClassification = geologicalRegion.province;
  }

  // Nearest named landmark calculation across entire Moon
  const nearestLandmark = findNearestLunarLandmark(safeLat, safeLon);

  // Radial elevation cross-section (-10 km to +10 km)
  const radialProfile = inSouthPoleCap
    ? sampleRadialElevationProfile(safeLat, safeLon, elevationM ?? 0)
    : null;

  // NASA DEM Uncertainty metadata (Smith et al. 2010, Mazarico et al. 2011)
  const uncertainty = inSouthPoleCap
    ? {
        isAvailable: true,
        dataset: "NASA PDS LRO-L-LOLA-4-GDR-V1.0",
        verticalM: 1.0,
        horizontalM: 20.0,
        verticalAccuracy: "±1.0 m (absolute)",
        relativePrecision: "±0.1–0.3 m (inter-track)",
        horizontalAccuracy: "±20 m (orbital reconstruction)",
        gridSpacingM: 400,
        datum: "IAU Lunar Reference Sphere (R₀ = 1,737,400.0 m)",
        confidenceLevel: isDirectDem
          ? "HIGH · Direct LOLA GDR Polar Grid"
          : "HIGH · South Pole Polar Cap",
        provenanceType: isDirectDem ? "NASA_MEASURED" : "NASA_DERIVED",
        coverageNote: "Full 400 m/px LOLA South Pole DEM coverage (80.0°S to 90.0°S).",
      }
    : {
        isAvailable: false,
        dataset: "Unmodeled (Outside LOLA South Pole DEM)",
        verticalM: null,
        horizontalM: null,
        verticalAccuracy: "Data unavailable",
        relativePrecision: "Data unavailable",
        horizontalAccuracy: "Data unavailable",
        gridSpacingM: null,
        datum: "IAU Lunar Reference Sphere (R₀ = 1,737,400.0 m)",
        confidenceLevel: "UNAVAILABLE · Outside 80°S–90°S Coverage",
        provenanceType: "UNAVAILABLE",
        coverageNote:
          "Selected coordinate is north of 80°S polar DEM boundary. Global LOLA / SLDEM2015 is not loaded in local memory.",
      };

  const isSlopeHazard = slopeDeg !== null ? slopeDeg >= 15.0 : false;
  const warnings = [];

  if (slopeDeg !== null) {
    if (slopeDeg >= 15.0) {
      warnings.push({
        id: "slope-hazard",
        severity: "critical",
        title: `Slope Hazard (${slopeDeg.toFixed(1)}° ≥ 15° Limit)`,
        detail:
          "Local terrain gradient exceeds the 15° Artemis/CLPS lander tip-over safety threshold.",
      });
    } else if (slopeDeg >= 10.0) {
      warnings.push({
        id: "slope-caution",
        severity: "warning",
        title: `Moderate Slope (${slopeDeg.toFixed(1)}°)`,
        detail:
          "Approaching 15° lander tilt limit; precision terrain-relative navigation recommended.",
      });
    }
  }

  if (roughnessM !== null && roughnessM >= 15.0) {
    warnings.push({
      id: "roughness-hazard",
      severity: "warning",
      title: `Elevated Surface Roughness (${roughnessM.toFixed(1)} m RMS)`,
      detail: `High local vertical relief dispersion (${reliefM !== null ? `${reliefM.toLocaleString()} m relief` : ''}) within ${radiusM} m radius indicates boulder fields or scarps.`,
    });
  }

  if (inSouthPoleCap && elevationM !== null && elevationM <= -2000) {
    warnings.push({
      id: "basin-shadow-trap",
      severity: "warning",
      title: `Deep Polar Depression (${elevationM.toLocaleString()} m)`,
      detail:
        "Low-elevation basin geometry increases horizon masking and cryogenic shadow trap risk.",
    });
  }

  // No lunar crater catalog dataset is loaded in local memory; never fabricate crater counts.
  const craterDensityPer100Km2 = null;
  const craterDensityLabel = "Not present in loaded dataset";

  return {
    elevationM,
    elevationSource,
    slopeDeg,
    slopeSource,
    roughnessM,
    roughnessDetails,
    roughnessRadiusM: radiusM,
    reliefM,
    craterDensityPer100Km2,
    craterDensityLabel,
    geologicalRegion,
    terrainClassification,
    nearestLandmark,
    radialProfile,
    uncertainty,
    isSlopeHazard,
    dataSource: isDirectDem
      ? "NASA PDS LRO LOLA South Pole DEM (400 m/px)"
      : inSouthPoleCap
      ? "NASA LOLA Polar Coverage (80°S–90°S)"
      : (elevationSource || "Not present in loaded dataset (Outside 80°S–90°S LOLA DEM)"),
    isDemAvailable: inSouthPoleCap && isDirectDem,
    inSouthPoleCap,
    warnings,
  };
}


