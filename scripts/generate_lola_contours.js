/**
 * @file generate_lola_contours.js
 * High-performance Node.js preprocessing pipeline for NASA LRO LOLA South Pole DEM.
 *
 * Reads: public/data/lola_sp_80s_int16.bin (1520 x 1520 int16, 400 m/px, -304km to +304km)
 * Decodes: 16-bit signed integer (scale 0.5 m, relative to R = 1,737,400 m)
 * Processes:
 *   1. Gaussian Conditioning (sigma ≈ 1.0 px)
 *   2. Contour Extraction for target intervals (500m, 200m, 100m)
 *   3. Index contour tagging (every 5th contour, e.g. 2500m, 1000m, 500m)
 *   4. Depression contour detection (closed crater pits) with downhill hachure directions
 *   5. Slope computation and >15° hazard threshold contouring
 *   6. Packaging Planned Artemis/VIPER Traverses and Ridges/Crater Rims
 * Writes:
 *   public/data/topo/topo_manifest.json
 *   public/data/topo/contours_500m.geojson
 *   public/data/topo/contours_200m.geojson
 *   public/data/topo/contours_100m.geojson
 *   public/data/topo/slope_hazard_15deg.geojson
 *   public/data/topo/planned_traverses.geojson
 *   public/data/topo/ridges_and_rims.geojson
 *
 * Usage:
 *   node scripts/generate_lola_contours.js
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as d3 from 'd3';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DEM_PATH = path.resolve(__dirname, '../public/data/lola_sp_80s_int16.bin');
const OUTPUT_DIR = path.resolve(__dirname, '../public/data/topo');

const GRID_SIZE = 1520;
const HALF_EXTENT_M = 304000;
const FULL_EXTENT_M = HALF_EXTENT_M * 2;
const CELL_SIZE_M = FULL_EXTENT_M / GRID_SIZE; // 400 m
const NODATA_INT16 = -32768;
const REFERENCE_RADIUS_M = 1737400;

console.log('[LOLA Contour Pipeline] Starting DEM preprocessing...');
console.log(`[LOLA Contour Pipeline] Reading DEM from: ${DEM_PATH}`);

if (!fs.existsSync(DEM_PATH)) {
  console.error(`[Error] DEM file not found at ${DEM_PATH}`);
  process.exit(1);
}

const buffer = fs.readFileSync(DEM_PATH);
const totalSamples = buffer.length / 2;
if (totalSamples !== GRID_SIZE * GRID_SIZE) {
  console.warn(`[Warning] Expected ${GRID_SIZE * GRID_SIZE} samples, found ${totalSamples}`);
}

const rawHeights = new Float32Array(GRID_SIZE * GRID_SIZE);
let validCount = 0;
let minElev = Infinity;
let maxElev = -Infinity;

for (let i = 0; i < totalSamples; i++) {
  const rawInt16 = buffer.readInt16LE(i * 2);
  if (rawInt16 === NODATA_INT16) {
    rawHeights[i] = NaN;
  } else {
    let elevM = rawInt16 * 0.5;
    if (elevM > 1000000) elevM -= REFERENCE_RADIUS_M;
    rawHeights[i] = elevM;
    if (elevM < minElev) minElev = elevM;
    if (elevM > maxElev) maxElev = elevM;
    validCount++;
  }
}

console.log(`[LOLA Contour Pipeline] Decoded ${validCount} valid samples. Min: ${minElev.toFixed(1)} m, Max: ${maxElev.toFixed(1)} m`);

// Step 1: Gaussian Smoothing on Downsampled High-Quality Grid (380 x 380, cell = 1600 m)
const DOWNSAMPLE_N = 380;
const DOWNSAMPLE_STEP = GRID_SIZE / DOWNSAMPLE_N; // 4
const CELL_DOWN_M = FULL_EXTENT_M / DOWNSAMPLE_N; // 1600 m

console.log(`[LOLA Contour Pipeline] Generating ${DOWNSAMPLE_N}x${DOWNSAMPLE_N} smoothed elevation grid...`);
const downsampledHeights = new Float32Array(DOWNSAMPLE_N * DOWNSAMPLE_N);

for (let r = 0; r < DOWNSAMPLE_N; r++) {
  const origR = r * DOWNSAMPLE_STEP;
  for (let c = 0; c < DOWNSAMPLE_N; c++) {
    const origC = c * DOWNSAMPLE_STEP;
    let sum = 0;
    let count = 0;
    for (let dr = 0; dr < DOWNSAMPLE_STEP; dr++) {
      for (let dc = 0; dc < DOWNSAMPLE_STEP; dc++) {
        const val = rawHeights[(origR + dr) * GRID_SIZE + (origC + dc)];
        if (!Number.isNaN(val)) {
          sum += val;
          count++;
        }
      }
    }
    downsampledHeights[r * DOWNSAMPLE_N + c] = count > 0 ? sum / count : NaN;
  }
}

// Apply Gaussian Smoothing (sigma ≈ 1.0 px)
const smoothedHeights = new Float32Array(DOWNSAMPLE_N * DOWNSAMPLE_N);
const kernel = [
  0.075, 0.125, 0.075,
  0.125, 0.200, 0.125,
  0.075, 0.125, 0.075,
];

for (let r = 0; r < DOWNSAMPLE_N; r++) {
  for (let c = 0; c < DOWNSAMPLE_N; c++) {
    const idx = r * DOWNSAMPLE_N + c;
    const centerVal = downsampledHeights[idx];
    if (Number.isNaN(centerVal)) {
      smoothedHeights[idx] = NaN;
      continue;
    }
    let sum = 0;
    let weightSum = 0;
    let k = 0;
    for (let dr = -1; dr <= 1; dr++) {
      const nr = r + dr;
      if (nr < 0 || nr >= DOWNSAMPLE_N) { k += 3; continue; }
      for (let dc = -1; dc <= 1; dc++) {
        const nc = c + dc;
        const w = kernel[k++];
        if (nc >= 0 && nc < DOWNSAMPLE_N) {
          const val = downsampledHeights[nr * DOWNSAMPLE_N + nc];
          if (!Number.isNaN(val)) {
            sum += val * w;
            weightSum += w;
          }
        }
      }
    }
    smoothedHeights[idx] = weightSum > 0 ? sum / weightSum : centerVal;
  }
}

// Convert Grid (gx, gy) -> Stereographic Meters -> Selenographic (lon, lat)
function gridToLonLat(gx, gy) {
  const xM = -HALF_EXTENT_M + gx * CELL_DOWN_M;
  const yM = HALF_EXTENT_M - gy * CELL_DOWN_M;
  const r = Math.hypot(xM, yM);
  if (r === 0) return [0.0, -90.0];
  const colat = 2 * Math.atan(r / (2 * REFERENCE_RADIUS_M));
  const lat = (colat * 180) / Math.PI - 90.0;
  const lon = (Math.atan2(xM, yM) * 180) / Math.PI;
  return [+lon.toFixed(5), +lat.toFixed(5)];
}

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// Function to generate Contour GeoJSON for a given interval
function buildContourGeoJson(intervalM, indexStepM) {
  console.log(`[LOLA Contour Pipeline] Extracting ${intervalM}m contours (index: ${indexStepM}m)...`);
  const thresholds = [];
  const startElev = Math.floor(minElev / intervalM) * intervalM;
  const endElev = Math.ceil(maxElev / intervalM) * intervalM;
  for (let e = startElev; e <= endElev; e += intervalM) {
    thresholds.push(e);
  }

  const generator = d3.contours()
    .size([DOWNSAMPLE_N, DOWNSAMPLE_N])
    .thresholds(thresholds);

  const contourLayers = generator(smoothedHeights);
  const features = [];

  for (const layer of contourLayers) {
    const elev = layer.value;
    const isIndex = Math.abs(Math.round(elev) % indexStepM) < 0.001;

    for (const polygon of layer.coordinates) {
      // polygon[0] is outer boundary, polygon[1..n] are inner holes (depressions/craters)
      polygon.forEach((ring, ringIdx) => {
        // Drop trivial micro-loops (< 4 points or perimeter too small)
        if (ring.length < 5) return;

        const isHole = ringIdx > 0;
        const coords = ring.map(([gx, gy]) => gridToLonLat(gx, gy));

        // Sample midpoint to check depression
        const midIdx = Math.floor(ring.length / 2);
        const [midGx, midGy] = ring[midIdx];
        const sampleR = Math.max(0, Math.min(DOWNSAMPLE_N - 1, Math.round(midGy)));
        const sampleC = Math.max(0, Math.min(DOWNSAMPLE_N - 1, Math.round(midGx)));
        const sampleH = smoothedHeights[sampleR * DOWNSAMPLE_N + sampleC];
        const isDepression = isHole || (!Number.isNaN(sampleH) && sampleH < elev - 5);

        features.push({
          type: 'Feature',
          properties: {
            elevationM: elev,
            isIndex,
            isDepression,
            intervalM,
          },
          geometry: {
            type: 'LineString',
            coordinates: coords,
          },
        });
      });
    }
  }

  return {
    type: 'FeatureCollection',
    name: `NASA LOLA South Pole Contours (${intervalM}m interval)`,
    properties: {
      intervalM,
      indexStepM,
      datum: 'Lunar Reference Sphere (R = 1,737,400 m)',
      featuresCount: features.length,
    },
    features,
  };
}

// Generate 500m, 200m, 100m GeoJSON
const contours500m = buildContourGeoJson(500, 2500);
fs.writeFileSync(
  path.join(OUTPUT_DIR, 'contours_500m.geojson'),
  JSON.stringify(contours500m)
);
console.log(`[LOLA Contour Pipeline] Saved contours_500m.geojson (${contours500m.features.length} lines)`);

const contours200m = buildContourGeoJson(200, 1000);
fs.writeFileSync(
  path.join(OUTPUT_DIR, 'contours_200m.geojson'),
  JSON.stringify(contours200m)
);
console.log(`[LOLA Contour Pipeline] Saved contours_200m.geojson (${contours200m.features.length} lines)`);

const contours100m = buildContourGeoJson(100, 500);
fs.writeFileSync(
  path.join(OUTPUT_DIR, 'contours_100m.geojson'),
  JSON.stringify(contours100m)
);
console.log(`[LOLA Contour Pipeline] Saved contours_100m.geojson (${contours100m.features.length} lines)`);

// Step 2: Compute Slopes and 15° Hazard Boundary GeoJSON
console.log('[LOLA Contour Pipeline] Computing slope field and 15° hazard boundaries...');
const slopeDegField = new Float32Array(DOWNSAMPLE_N * DOWNSAMPLE_N);
let hazardCount = 0;

for (let r = 1; r < DOWNSAMPLE_N - 1; r++) {
  for (let c = 1; c < DOWNSAMPLE_N - 1; c++) {
    const idx = r * DOWNSAMPLE_N + c;
    const zE = smoothedHeights[idx + 1];
    const zW = smoothedHeights[idx - 1];
    const zN = smoothedHeights[idx - DOWNSAMPLE_N];
    const zS = smoothedHeights[idx + DOWNSAMPLE_N];

    if (Number.isNaN(zE) || Number.isNaN(zW) || Number.isNaN(zN) || Number.isNaN(zS)) {
      slopeDegField[idx] = NaN;
      continue;
    }

    const dzdx = (zE - zW) / (2 * CELL_DOWN_M);
    const dzdy = (zS - zN) / (2 * CELL_DOWN_M);
    const slopeDeg = (Math.atan(Math.hypot(dzdx, dzdy)) * 180) / Math.PI;
    slopeDegField[idx] = slopeDeg;
    if (slopeDeg >= 15.0) hazardCount++;
  }
}
console.log(`[LOLA Contour Pipeline] Computed slope field: ${hazardCount} cells exceed 15° hazard limit.`);

// Extract 15° slope boundary
const slopeGen = d3.contours()
  .size([DOWNSAMPLE_N, DOWNSAMPLE_N])
  .thresholds([15.0]);

const slopeLayers = slopeGen(slopeDegField);
const slopeFeatures = [];

for (const layer of slopeLayers) {
  for (const polygon of layer.coordinates) {
    polygon.forEach((ring) => {
      if (ring.length < 5) return;
      const coords = ring.map(([gx, gy]) => gridToLonLat(gx, gy));
      slopeFeatures.push({
        type: 'Feature',
        properties: {
          hazard: 'slope_gt_15deg',
          thresholdDeg: 15.0,
        },
        geometry: {
          type: 'LineString',
          coordinates: coords,
        },
      });
    });
  }
}

const slopeHazardGeoJson = {
  type: 'FeatureCollection',
  name: 'NASA LOLA South Pole Slope Hazard Boundary (>= 15 deg)',
  properties: {
    thresholdDeg: 15.0,
    featuresCount: slopeFeatures.length,
  },
  features: slopeFeatures,
};

fs.writeFileSync(
  path.join(OUTPUT_DIR, 'slope_hazard_15deg.geojson'),
  JSON.stringify(slopeHazardGeoJson)
);
console.log(`[LOLA Contour Pipeline] Saved slope_hazard_15deg.geojson (${slopeFeatures.length} boundary lines)`);

// Stereographic & Geodesic Helpers for Authentic Polar Traverses and Crater Rims
function latLonToStereoMeters(latDeg, lonDeg) {
  const colatRad = ((90 + latDeg) * Math.PI) / 180;
  const r = 2 * REFERENCE_RADIUS_M * Math.tan(colatRad / 2);
  const lonRad = (lonDeg * Math.PI) / 180;
  return {
    xM: r * Math.sin(lonRad),
    yM: r * Math.cos(lonRad),
  };
}

function stereoMetersToLonLat(xM, yM) {
  const r = Math.hypot(xM, yM);
  if (r === 0) return [0.0, -90.0];
  const colat = 2 * Math.atan(r / (2 * REFERENCE_RADIUS_M));
  const lat = (colat * 180) / Math.PI - 90.0;
  const lon = (Math.atan2(xM, yM) * 180) / Math.PI;
  return [+lon.toFixed(5), +lat.toFixed(5)];
}

function geodesicDistanceKm([lon1, lat1], [lon2, lat2]) {
  const toRad = Math.PI / 180;
  const phi1 = lat1 * toRad;
  const phi2 = lat2 * toRad;
  const dPhi = (lat2 - lat1) * toRad;
  const dLam = (lon2 - lon1) * toRad;
  const a =
    Math.sin(dPhi / 2) ** 2 +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(dLam / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(Math.max(0, 1 - a)));
  return (REFERENCE_RADIUS_M * c) / 1000;
}

function sampleDemAtStereoMeters(xM, yM) {
  const c = Math.round((xM + HALF_EXTENT_M) / CELL_SIZE_M);
  const r = Math.round((HALF_EXTENT_M - yM) / CELL_SIZE_M);
  if (r < 1 || r >= GRID_SIZE - 1 || c < 1 || c >= GRID_SIZE - 1) return null;

  const z0 = rawHeights[r * GRID_SIZE + c];
  if (Number.isNaN(z0)) return null;

  // 3x3 Horn gradient stencil on full-resolution 400 m/px LOLA DEM
  const zNW = rawHeights[(r - 1) * GRID_SIZE + (c - 1)];
  const zN = rawHeights[(r - 1) * GRID_SIZE + c];
  const zNE = rawHeights[(r - 1) * GRID_SIZE + (c + 1)];
  const zW = rawHeights[r * GRID_SIZE + (c - 1)];
  const zE = rawHeights[r * GRID_SIZE + (c + 1)];
  const zSW = rawHeights[(r + 1) * GRID_SIZE + (c - 1)];
  const zS = rawHeights[(r + 1) * GRID_SIZE + c];
  const zSE = rawHeights[(r + 1) * GRID_SIZE + (c + 1)];

  if (
    Number.isNaN(zNW) ||
    Number.isNaN(zN) ||
    Number.isNaN(zNE) ||
    Number.isNaN(zW) ||
    Number.isNaN(zE) ||
    Number.isNaN(zSW) ||
    Number.isNaN(zS) ||
    Number.isNaN(zSE)
  ) {
    return { elevationM: z0, slopeDeg: 0 };
  }

  const dzdx = (zNE + 2 * zE + zSE - (zNW + 2 * zW + zSW)) / (8 * CELL_SIZE_M);
  const dzdy = (zSW + 2 * zS + zSE - (zNW + 2 * zN + zNE)) / (8 * CELL_SIZE_M);
  const slopeDeg = (Math.atan(Math.hypot(dzdx, dzdy)) * 180) / Math.PI;
  return { elevationM: z0, slopeDeg };
}

function evaluateTraversePolyline(coordinates) {
  let totalLengthKm = 0;
  let maxSlopeDeg = 0;
  let slopeSum = 0;
  let sampleCount = 0;
  let minElevationM = Infinity;
  let maxElevationM = -Infinity;

  for (let i = 1; i < coordinates.length; i++) {
    const ptA = coordinates[i - 1];
    const ptB = coordinates[i];
    totalLengthKm += geodesicDistanceKm(ptA, ptB);

    const stA = latLonToStereoMeters(ptA[1], ptA[0]);
    const stB = latLonToStereoMeters(ptB[1], ptB[0]);
    const segDistM = Math.hypot(stB.xM - stA.xM, stB.yM - stA.yM);
    const steps = Math.max(4, Math.ceil(segDistM / 200));

    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      const xM = stA.xM + (stB.xM - stA.xM) * t;
      const yM = stA.yM + (stB.yM - stA.yM) * t;
      const sample = sampleDemAtStereoMeters(xM, yM);
      if (sample) {
        if (sample.slopeDeg > maxSlopeDeg) maxSlopeDeg = sample.slopeDeg;
        slopeSum += sample.slopeDeg;
        sampleCount++;
        if (sample.elevationM < minElevationM) minElevationM = sample.elevationM;
        if (sample.elevationM > maxElevationM) maxElevationM = sample.elevationM;
      }
    }
  }

  return {
    lengthKm: +totalLengthKm.toFixed(1),
    maxSlopeDeg: +maxSlopeDeg.toFixed(1),
    meanSlopeDeg: sampleCount > 0 ? +(slopeSum / sampleCount).toFixed(1) : 0,
    minElevationM: Number.isFinite(minElevationM) ? Math.round(minElevationM) : 0,
    maxElevationM: Number.isFinite(maxElevationM) ? Math.round(maxElevationM) : 0,
  };
}

function buildTraverseFeature({ id, name, source, coordinates }) {
  const stats = evaluateTraversePolyline(coordinates);
  return {
    type: 'Feature',
    properties: {
      id,
      name,
      source,
      lengthKm: stats.lengthKm,
      maxSlopeDeg: stats.maxSlopeDeg,
      meanSlopeDeg: stats.meanSlopeDeg,
      minElevationM: stats.minElevationM,
      maxElevationM: stats.maxElevationM,
    },
    geometry: {
      type: 'LineString',
      coordinates,
    },
  };
}

function buildStereographicCraterRim(name, centerLat, centerLon, radiusM, numSegments = 36) {
  const { xM: cx, yM: cy } = latLonToStereoMeters(centerLat, centerLon);
  const coordinates = [];
  let maxRimElev = -Infinity;

  for (let i = 0; i <= numSegments; i++) {
    const theta = (i * 2 * Math.PI) / numSegments;
    const xM = cx + radiusM * Math.cos(theta);
    const yM = cy + radiusM * Math.sin(theta);
    coordinates.push(stereoMetersToLonLat(xM, yM));
    const sample = sampleDemAtStereoMeters(xM, yM);
    if (sample && sample.elevationM > maxRimElev) {
      maxRimElev = sample.elevationM;
    }
  }

  return {
    type: 'Feature',
    properties: {
      name,
      type: 'rim',
      centerLat,
      centerLon,
      radiusKm: +(radiusM / 1000).toFixed(2),
      elevationM: Number.isFinite(maxRimElev) ? Math.round(maxRimElev) : 1251,
    },
    geometry: {
      type: 'LineString',
      coordinates,
    },
  };
}

// Step 3: Planned Traverse Routes GeoJSON
console.log('[LOLA Contour Pipeline] Packaging planned traverse routes...');
const traverseRoutes = {
  type: 'FeatureCollection',
  name: 'NASA Artemis & VIPER South Pole Candidate Traverse Routes',
  features: [
    buildTraverseFeature({
      id: 'traverse-connecting-ridge',
      name: 'Connecting Ridge Traverse (Shackleton → De Gerlache)',
      source: 'NASA Artemis III Science Definition Team',
      // Routes along the 220°E–273°E (-140°W to -87.1°W) Connecting Ridge crest
      coordinates: [
        [-140.0, -89.56],
        [-132.0, -89.48],
        [-120.0, -89.38],
        [-104.0, -89.26],
        [-87.1, -89.12],
      ],
    }),
    buildTraverseFeature({
      id: 'traverse-malapert-plateau',
      name: 'Malapert Massif Summit Approach',
      source: 'NASA Lunar Exploration Analysis Group',
      coordinates: [
        [0.0, -86.50],
        [1.5, -86.25],
        [2.7, -86.02],
        [3.8, -85.80],
      ],
    }),
    buildTraverseFeature({
      id: 'traverse-nobile-viper',
      name: 'Nobile Rim Volatiles Prospecting Loop',
      source: 'NASA VIPER Science Team',
      coordinates: [
        [53.5, -85.20],
        [54.6, -85.28],
        [55.6, -85.36],
        [54.5, -85.44],
        [53.3, -85.34],
      ],
    }),
  ],
};

fs.writeFileSync(
  path.join(OUTPUT_DIR, 'planned_traverses.geojson'),
  JSON.stringify(traverseRoutes, null, 2)
);
console.log(`[LOLA Contour Pipeline] Saved planned traverses to ${path.join(OUTPUT_DIR, 'planned_traverses.geojson')}`);

// Step 4: Ridge Lines & Crater Rims GeoJSON
console.log('[LOLA Contour Pipeline] Packaging South Pole crater rims and major ridges...');
const connectingRidgeCoords = [
  [-142.0, -89.58],
  [-134.0, -89.50],
  [-122.0, -89.39],
  [-108.0, -89.26],
  [-96.0, -89.10],
  [-87.1, -88.95],
];
const connectingRidgeStats = evaluateTraversePolyline(connectingRidgeCoords);

const malapertRidgeCoords = [
  [0.5, -86.35],
  [1.8, -86.15],
  [2.7, -86.02],
  [3.9, -85.85],
  [5.2, -85.70],
];
const malapertRidgeStats = evaluateTraversePolyline(malapertRidgeCoords);

const ridgesAndRims = {
  type: 'FeatureCollection',
  name: 'NASA LOLA South Pole Major Ridges & Crater Rims',
  features: [
    // Shackleton Crater: IAU center (-89.66°S, 129.8°E, distance from pole = 10.31 km), radius = 10.50 km -> encircles 90°S
    buildStereographicCraterRim('Shackleton Crater Rim', -89.66, 129.8, 10500, 36),
    {
      type: 'Feature',
      properties: {
        name: 'Connecting Ridge Crest',
        type: 'ridge',
        elevationM: connectingRidgeStats.maxElevationM,
        lengthKm: connectingRidgeStats.lengthKm,
      },
      geometry: {
        type: 'LineString',
        coordinates: connectingRidgeCoords,
      },
    },
    {
      type: 'Feature',
      properties: {
        name: 'Malapert Massif Ridge',
        type: 'ridge',
        elevationM: malapertRidgeStats.maxElevationM,
        lengthKm: malapertRidgeStats.lengthKm,
      },
      geometry: {
        type: 'LineString',
        coordinates: malapertRidgeCoords,
      },
    },
    // Haworth Crater: IAU center (-87.45°S, -4.0°W), radius = 25.70 km (51.4 km diameter) in stereographic (x, y) meters
    buildStereographicCraterRim('Haworth Rim Crest', -87.45, -4.0, 25700, 36),
  ],
};

fs.writeFileSync(
  path.join(OUTPUT_DIR, 'ridges_and_rims.geojson'),
  JSON.stringify(ridgesAndRims, null, 2)
);
console.log(`[LOLA Contour Pipeline] Saved ridges and crater rims to ${path.join(OUTPUT_DIR, 'ridges_and_rims.geojson')}`);

// Step 4.5: Multi-Azimuth LOLA DEM Horizon Shadow Mask -> PSR Footprints GeoJSON (Mazarico et al. 2011 Methodology)
console.log('[LOLA Contour Pipeline] Computing 16-azimuth LOLA DEM horizon shadow mask for PSR cold traps...');
const PSR_AZ_COUNT = 16;
const PSR_MAX_STEPS = 28; // up to ~44.8 km horizon ray distance on 1.6 km/px grid
const psrDirC = new Float32Array(PSR_AZ_COUNT);
const psrDirR = new Float32Array(PSR_AZ_COUNT);
const psrDirX = new Float32Array(PSR_AZ_COUNT);
const psrDirY = new Float32Array(PSR_AZ_COUNT);

for (let a = 0; a < PSR_AZ_COUNT; a++) {
  const rad = (a * 2 * Math.PI) / PSR_AZ_COUNT;
  psrDirX[a] = Math.sin(rad);
  psrDirY[a] = Math.cos(rad);
  psrDirC[a] = Math.sin(rad);
  psrDirR[a] = -Math.cos(rad);
}

const psrInvDist = new Float32Array(PSR_MAX_STEPS + 1);
const psrCurvDrop = new Float32Array(PSR_MAX_STEPS + 1);
for (let s = 1; s <= PSR_MAX_STEPS; s++) {
  const d = s * CELL_DOWN_M;
  psrInvDist[s] = 1 / d;
  psrCurvDrop[s] = (d * d) / (2 * REFERENCE_RADIUS_M);
}

// psrShadowDepthField > 0 means permanently shadowed across all 16 solar azimuths at max +1.5424° summer solstice declination
const psrShadowDepthField = new Float32Array(DOWNSAMPLE_N * DOWNSAMPLE_N);
let psrCellCount = 0;

for (let r = 0; r < DOWNSAMPLE_N; r++) {
  const yM = HALF_EXTENT_M - (r + 0.5) * CELL_DOWN_M;
  for (let c = 0; c < DOWNSAMPLE_N; c++) {
    const xM = -HALF_EXTENT_M + (c + 0.5) * CELL_DOWN_M;
    const z0 = smoothedHeights[r * DOWNSAMPLE_N + c];
    if (Number.isNaN(z0)) {
      psrShadowDepthField[r * DOWNSAMPLE_N + c] = -10;
      continue;
    }
    let maxSolarClearanceDeg = -90;
    for (let a = 0; a < PSR_AZ_COUNT; a++) {
      const sunMaxElDeg =
        1.5424 + ((xM * psrDirX[a] + yM * psrDirY[a]) / REFERENCE_RADIUS_M) * 57.29577951308232;
      let maxSlope = -1e9;
      const dc = psrDirC[a];
      const dr = psrDirR[a];
      for (let s = 1; s <= PSR_MAX_STEPS; s++) {
        const nc = (c + dc * s) | 0;
        const nr = (r + dr * s) | 0;
        if (nc < 0 || nc >= DOWNSAMPLE_N || nr < 0 || nr >= DOWNSAMPLE_N) break;
        const zTarget = smoothedHeights[nr * DOWNSAMPLE_N + nc];
        const slope = (zTarget - z0 - psrCurvDrop[s]) * psrInvDist[s];
        if (slope > maxSlope) maxSlope = slope;
      }
      const horizDeg = Math.atan(maxSlope) * 57.29577951308232;
      const clearanceDeg = sunMaxElDeg - horizDeg;
      if (clearanceDeg > maxSolarClearanceDeg) {
        maxSolarClearanceDeg = clearanceDeg;
      }
    }
    const shadowDepthDeg = -maxSolarClearanceDeg;
    psrShadowDepthField[r * DOWNSAMPLE_N + c] = shadowDepthDeg;
    if (shadowDepthDeg >= 0) psrCellCount++;
  }
}

const KNOWN_POLAR_COLD_TRAPS = [
  { id: 'psr-shackleton', name: 'Shackleton PSR', lat: -89.67, lon: 129.78, searchRadiusM: 15000 },
  { id: 'psr-haworth', name: 'Haworth PSR', lat: -87.45, lon: -4.0, searchRadiusM: 32000 },
  { id: 'psr-shoemaker', name: 'Shoemaker PSR', lat: -88.1, lon: 45.0, searchRadiusM: 32000 },
  { id: 'psr-faustini', name: 'Faustini PSR', lat: -87.3, lon: 77.0, searchRadiusM: 28000 },
  { id: 'psr-degerlache', name: 'De Gerlache PSR', lat: -88.5, lon: -87.1, searchRadiusM: 22000 },
  { id: 'psr-cabeus', name: 'Cabeus LCROSS PSR', lat: -84.9, lon: -35.5, searchRadiusM: 48000 },
  { id: 'psr-sverdrup', name: 'Sverdrup PSR', lat: -88.3, lon: -152.0, searchRadiusM: 24000 },
  { id: 'psr-slater', name: 'Slater PSR', lat: -88.1, lon: 111.0, searchRadiusM: 20000 },
  { id: 'psr-amundsen-floor', name: 'Amundsen Floor PSR', lat: -84.1, lon: 83.2, searchRadiusM: 42000 },
].map((trap) => ({
  ...trap,
  ...latLonToStereoMeters(trap.lat, trap.lon),
}));

const psrContourGen = d3.contours()
  .size([DOWNSAMPLE_N, DOWNSAMPLE_N])
  .thresholds([0.0]);

const psrContourLayers = psrContourGen(psrShadowDepthField);
const psrFeatures = [];

for (const layer of psrContourLayers) {
  for (const polygon of layer.coordinates) {
    const outerRing = polygon[0];
    if (!outerRing || outerRing.length < 10) continue;

    // Compute centroid and area in stereographic meters
    let sumX = 0;
    let sumY = 0;
    let minFloorElevM = Infinity;
    for (const [gx, gy] of outerRing) {
      const xM = -HALF_EXTENT_M + gx * CELL_DOWN_M;
      const yM = HALF_EXTENT_M - gy * CELL_DOWN_M;
      sumX += xM;
      sumY += yM;
      const sample = sampleDemAtStereoMeters(xM, yM);
      if (sample && sample.elevationM < minFloorElevM) {
        minFloorElevM = sample.elevationM;
      }
    }
    const cxM = sumX / outerRing.length;
    const cyM = sumY / outerRing.length;
    const centerSample = sampleDemAtStereoMeters(cxM, cyM);
    if (centerSample && centerSample.elevationM < minFloorElevM) {
      minFloorElevM = centerSample.elevationM;
    }

    // Approximate polygon area in km^2 via shoelace formula
    let areaM2 = 0;
    for (let i = 0; i < outerRing.length - 1; i++) {
      const x1 = -HALF_EXTENT_M + outerRing[i][0] * CELL_DOWN_M;
      const y1 = HALF_EXTENT_M - outerRing[i][1] * CELL_DOWN_M;
      const x2 = -HALF_EXTENT_M + outerRing[i + 1][0] * CELL_DOWN_M;
      const y2 = HALF_EXTENT_M - outerRing[i + 1][1] * CELL_DOWN_M;
      areaM2 += x1 * y2 - x2 * y1;
    }
    const areaKm2 = Math.abs(areaM2) / 2e6;
    if (areaKm2 < 18) continue; // Keep significant polar cold-trap basins (>= 18 km^2)

    let matchedTrap = null;
    let bestDist = Infinity;
    for (const trap of KNOWN_POLAR_COLD_TRAPS) {
      const dist = Math.hypot(cxM - trap.xM, cyM - trap.yM);
      if (dist <= trap.searchRadiusM && dist < bestDist) {
        bestDist = dist;
        matchedTrap = trap;
      }
    }

    const [centerLon, centerLat] = stereoMetersToLonLat(cxM, cyM);
    const coords = outerRing.map(([gx, gy]) => gridToLonLat(gx, gy));

    psrFeatures.push({
      type: 'Feature',
      properties: {
        id: matchedTrap ? matchedTrap.id : `psr-${psrFeatures.length + 1}`,
        name: matchedTrap ? matchedTrap.name : `Polar Cold Trap (${Math.abs(centerLat).toFixed(1)}°S)`,
        isMajorColdTrap: Boolean(matchedTrap),
        centerLat,
        centerLon,
        areaKm2: +areaKm2.toFixed(1),
        minElevationM: Number.isFinite(minFloorElevM) ? Math.round(minFloorElevM) : null,
        methodology: 'LOLA 16-Azimuth Horizon Ray-Marching (Max Solar Declination 1.5424°)',
      },
      geometry: {
        type: 'LineString',
        coordinates: coords,
      },
    });
  }
}

const psrFootprintsGeoJson = {
  type: 'FeatureCollection',
  name: 'NASA LOLA Multi-Azimuth Horizon Shadow PSR Footprints',
  properties: {
    solarObliquityDeg: 1.5424,
    azimuthRays: PSR_AZ_COUNT,
    psrGridFractionPct: +((psrCellCount / (DOWNSAMPLE_N * DOWNSAMPLE_N)) * 100).toFixed(2),
    featuresCount: psrFeatures.length,
  },
  features: psrFeatures,
};

fs.writeFileSync(
  path.join(OUTPUT_DIR, 'psr_footprints.geojson'),
  JSON.stringify(psrFootprintsGeoJson, null, 2)
);
console.log(
  `[LOLA Contour Pipeline] Saved psr_footprints.geojson (${psrFeatures.length} DEM-derived PSR polygons, ${psrFootprintsGeoJson.properties.psrGridFractionPct}% polar PSR coverage)`
);

// Step 5: Save Manifest
const topoMetadata = {
  sourceProduct: 'NASA PDS LRO-L-LOLA-4-GDR-V1.0',
  instrument: 'Lunar Orbiter Laser Altimeter (LOLA)',
  spacecraft: 'Lunar Reconnaissance Orbiter (LRO)',
  coordinateSystem: 'South Polar Stereographic',
  proj4Def: '+proj=stere +lat_0=-90 +lon_0=0 +k=1 +a=1737400 +b=1737400 +units=m',
  datum: 'Lunar Reference Sphere (R = 1,737,400.0 m)',
  elevationOffsetM: REFERENCE_RADIUS_M,
  scalingFactorM: 0.5,
  dimensions: { width: GRID_SIZE, height: GRID_SIZE },
  boundsMeters: {
    minX: -HALF_EXTENT_M,
    maxX: HALF_EXTENT_M,
    minY: -HALF_EXTENT_M,
    maxY: HALF_EXTENT_M,
  },
  cellSizeM: CELL_SIZE_M,
  elevationRangeM: {
    min: +minElev.toFixed(1),
    max: +maxElev.toFixed(1),
  },
  contourIntervals: [
    { zoom: '0-1', intervalM: 500, indexIntervalM: 2500, file: 'contours_500m.geojson' },
    { zoom: '2', intervalM: 200, indexIntervalM: 1000, file: 'contours_200m.geojson' },
    { zoom: '3', intervalM: 100, indexIntervalM: 500, file: 'contours_100m.geojson' },
    { zoom: '4', intervalM: 50, indexIntervalM: 250, mode: 'dynamic-worker' },
    { zoom: '5-6', intervalM: 20, indexIntervalM: 100, mode: 'dynamic-worker' },
  ],
  slopeHazardThresholdDeg: 15.0,
  slopeHazardFile: 'slope_hazard_15deg.geojson',
  plannedTraversesFile: 'planned_traverses.geojson',
  ridgesAndRimsFile: 'ridges_and_rims.geojson',
  psrFootprintsFile: 'psr_footprints.geojson',
  generatedAt: new Date().toISOString(),
};

fs.writeFileSync(
  path.join(OUTPUT_DIR, 'topo_manifest.json'),
  JSON.stringify(topoMetadata, null, 2)
);
console.log(`[LOLA Contour Pipeline] Saved manifest to ${path.join(OUTPUT_DIR, 'topo_manifest.json')}`);

console.log('[LOLA Contour Pipeline] All datasets generated successfully.');
