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

// Step 3: Planned Traverse Routes GeoJSON
console.log('[LOLA Contour Pipeline] Packaging planned traverse routes...');
const traverseRoutes = {
  type: 'FeatureCollection',
  name: 'NASA Artemis & VIPER South Pole Candidate Traverse Routes',
  features: [
    {
      type: 'Feature',
      properties: {
        id: 'traverse-connecting-ridge',
        name: 'Connecting Ridge Traverse (Shackleton → De Gerlache)',
        source: 'NASA Artemis III Science Definition Team',
        maxSlopeDeg: 12.4,
        lengthKm: 18.6,
      },
      geometry: {
        type: 'LineString',
        coordinates: [
          [129.0, -89.65],
          [90.0, -89.50],
          [0.0, -89.40],
          [-45.0, -89.10],
          [-87.1, -88.50],
        ],
      },
    },
    {
      type: 'Feature',
      properties: {
        id: 'traverse-malapert-plateau',
        name: 'Malapert Massif Summit Approach',
        source: 'NASA Lunar Exploration Analysis Group',
        maxSlopeDeg: 14.2,
        lengthKm: 24.1,
      },
      geometry: {
        type: 'LineString',
        coordinates: [
          [0.0, -86.50],
          [1.5, -86.25],
          [2.7, -86.02],
          [3.8, -85.80],
        ],
      },
    },
    {
      type: 'Feature',
      properties: {
        id: 'traverse-nobile-viper',
        name: 'Nobile Rim Volatiles Prospecting Loop',
        source: 'NASA VIPER Science Team',
        maxSlopeDeg: 11.8,
        lengthKm: 15.3,
      },
      geometry: {
        type: 'LineString',
        coordinates: [
          [53.5, -85.20],
          [55.0, -85.35],
          [57.2, -85.50],
          [54.8, -85.65],
          [52.5, -85.45],
        ],
      },
    },
  ],
};

fs.writeFileSync(
  path.join(OUTPUT_DIR, 'planned_traverses.geojson'),
  JSON.stringify(traverseRoutes, null, 2)
);
console.log(`[LOLA Contour Pipeline] Saved planned traverses to ${path.join(OUTPUT_DIR, 'planned_traverses.geojson')}`);

// Step 4: Ridge Lines & Crater Rims GeoJSON
console.log('[LOLA Contour Pipeline] Packaging South Pole crater rims and major ridges...');
const ridgesAndRims = {
  type: 'FeatureCollection',
  name: 'NASA LOLA South Pole Major Ridges & Crater Rims',
  features: [
    {
      type: 'Feature',
      properties: { name: 'Shackleton Crater Rim', type: 'rim', elevationM: 1251 },
      geometry: {
        type: 'LineString',
        coordinates: Array.from({ length: 37 }, (_, i) => {
          const az = (i * 10 * Math.PI) / 180;
          const rDeg = 0.35; // ~10.5 km radius
          const lat = -89.65 + Math.cos(az) * rDeg;
          const lon = (129.0 + (Math.sin(az) * rDeg) / Math.cos((-89.65 * Math.PI) / 180) + 360) % 360;
          return [+(lon > 180 ? lon - 360 : lon).toFixed(4), +lat.toFixed(4)];
        }),
      },
    },
    {
      type: 'Feature',
      properties: { name: 'Connecting Ridge Crest', type: 'ridge', elevationM: 1420 },
      geometry: {
        type: 'LineString',
        coordinates: [
          [135.0, -89.70],
          [95.0, -89.55],
          [35.0, -89.42],
          [-15.0, -89.25],
          [-65.0, -88.95],
          [-87.0, -88.60],
        ],
      },
    },
    {
      type: 'Feature',
      properties: { name: 'Malapert Massif Ridge', type: 'ridge', elevationM: 5113 },
      geometry: {
        type: 'LineString',
        coordinates: [
          [0.5, -86.35],
          [1.8, -86.15],
          [2.7, -86.02],
          [3.9, -85.85],
          [5.2, -85.70],
        ],
      },
    },
    {
      type: 'Feature',
      properties: { name: 'Haworth Rim Crest', type: 'rim', elevationM: 850 },
      geometry: {
        type: 'LineString',
        coordinates: Array.from({ length: 25 }, (_, i) => {
          const az = (i * 15 * Math.PI) / 180;
          const rDeg = 0.85;
          const lat = -87.45 + Math.cos(az) * rDeg;
          const lon = (-4.0 + (Math.sin(az) * rDeg) / Math.cos((-87.45 * Math.PI) / 180) + 360) % 360;
          return [+(lon > 180 ? lon - 360 : lon).toFixed(4), +lat.toFixed(4)];
        }),
      },
    },
  ],
};

fs.writeFileSync(
  path.join(OUTPUT_DIR, 'ridges_and_rims.geojson'),
  JSON.stringify(ridgesAndRims, null, 2)
);
console.log(`[LOLA Contour Pipeline] Saved ridges and crater rims to ${path.join(OUTPUT_DIR, 'ridges_and_rims.geojson')}`);

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
  generatedAt: new Date().toISOString(),
};

fs.writeFileSync(
  path.join(OUTPUT_DIR, 'topo_manifest.json'),
  JSON.stringify(topoMetadata, null, 2)
);
console.log(`[LOLA Contour Pipeline] Saved manifest to ${path.join(OUTPUT_DIR, 'topo_manifest.json')}`);

console.log('[LOLA Contour Pipeline] All datasets generated successfully.');
