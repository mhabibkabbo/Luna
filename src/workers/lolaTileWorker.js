/**
 * @file lolaTileWorker.js
 * Web Worker for STEP 1 (Diagnose) & STEP 2 (Decode) & STEP 4 (Hillshade + Clamped Ramp)
 * of the NASA LRO LOLA South Pole (80°S–90°S) Polar Stereographic DEM.
 *
 * Source Dataset: NASA PDS LRO-L-LOLA-4-GDR-V1.0 (LDEM_75S / LDEM_80S Polar Stereographic GDR)
 * Reference Sphere Offset: 1,737,400 m
 * Sample Type: Signed 16-bit Little-Endian Integer (LSB_INTEGER), Scaling Factor = 0.5 m/DN, NoData = -32768
 * Projection: +proj=stere +lat_0=-90 +lon_0=0 +k=1 +a=1737400 +b=1737400 +units=m
 * Bounds: [-304000, -304000] m to [+304000, +304000] m (20 m/px base pyramid)
 */

const HALF_EXTENT_M = 304000; // 304 km radius from South Pole (~80°S)
const FULL_EXTENT_M = HALF_EXTENT_M * 2; // 608,000 m
const REFERENCE_RADIUS_M = 1737400;
const MIN_EXPECTED_ELEV_M = -9000;
const MAX_EXPECTED_ELEV_M = 10700;
const NODATA_INT16 = -32768;

// Resolutions matching 20 m/px base pyramid (z=0..6)
const RESOLUTIONS = [1280, 640, 320, 160, 80, 40, 20];

let demInt16View = null;
let demGridSize = 1520;
let demCellSizeM = FULL_EXTENT_M / demGridSize; // 400 m/px
let demLoaded = false;
let demLoadPromise = null;
let globalDiagnosticStats = null;

/**
 * NASA Scientific Visualization Studio (SVS) 5127:
 * "Lunar South Pole Terrain in Coded Color" (Ernie Wright / NASA GSFC LOLA Science Team)
 * https://svs.gsfc.nasa.gov/5127/
 *
 * Coded color spectrum relative to lunar reference sphere (R = 1,737,400 m):
 * - Deep impact depressions (-9000m to -6000m): Deep indigo / royal navy blue
 * - Crater floors & low basins (-6000m to -3500m): Rich cobalt blue / vibrant cyan
 * - Main South Pole terrain (-3500m to -1200m): Vivid Greenish-Blue / Teal
 * - Intermediate slopes (-1200m to -200m): Emerald / blue-green
 * - Mean Datum transition (-200m to +800m): Fresh spring green
 * - Low massifs & ridges (+800m to +2200m): Chartreuse / warm golden ochre
 * - Prominent crater rims (+2200m to +3800m): Terracotta / warm orange-red
 * - High massifs & mountain peaks (+3800m to +6000m): Crimson / magenta
 * - Highest summits (+6000m to +10700m): Rose tan / bright white
 */
const NASA_SVS_5127_RAMP_STOPS = [
  { elev: -9000, rgb: [36, 14, 78] },    // Deepest basin floor (deep indigo)
  { elev: -6500, rgb: [20, 42, 132] },   // Deep impact basin (royal navy blue)
  { elev: -4500, rgb: [16, 84, 166] },   // Lower depression (cobalt blue)
  { elev: -3000, rgb: [12, 136, 178] },  // Lowlands (vivid ocean cyan)
  { elev: -1600, rgb: [16, 168, 150] },  // South Pole terrain (greenish-blue / teal)
  { elev: -600,  rgb: [28, 182, 122] },  // Low plain transition (emerald / blue-green)
  { elev: 300,   rgb: [78, 196, 74] },   // Datum (fresh spring green)
  { elev: 1400,  rgb: [168, 204, 48] },  // Low ridges (chartreuse / yellow-green)
  { elev: 2600,  rgb: [232, 186, 38] },  // Mid rims & crests (warm gold / amber)
  { elev: 3800,  rgb: [232, 112, 34] },  // High crater rims (terracotta orange)
  { elev: 5200,  rgb: [204, 44, 74] },   // Massif peaks (crimson / magenta)
  { elev: 7200,  rgb: [228, 142, 172] }, // High summits (rose tan)
  { elev: 10700, rgb: [255, 255, 255] }, // Lunar peaks (pure white)
];

function evaluateSvs5127Ramp(elevM) {
  const clamped = Math.max(MIN_EXPECTED_ELEV_M, Math.min(MAX_EXPECTED_ELEV_M, elevM));
  for (let i = 0; i < NASA_SVS_5127_RAMP_STOPS.length - 1; i++) {
    const s0 = NASA_SVS_5127_RAMP_STOPS[i];
    const s1 = NASA_SVS_5127_RAMP_STOPS[i + 1];
    if (clamped <= s1.elev) {
      const t = (clamped - s0.elev) / (s1.elev - s0.elev);
      return [
        s0.rgb[0] + (s1.rgb[0] - s0.rgb[0]) * t,
        s0.rgb[1] + (s1.rgb[1] - s0.rgb[1]) * t,
        s0.rgb[2] + (s1.rgb[2] - s0.rgb[2]) * t,
      ];
    }
  }
  const last = NASA_SVS_5127_RAMP_STOPS[NASA_SVS_5127_RAMP_STOPS.length - 1];
  return [last.rgb[0], last.rgb[1], last.rgb[2]];
}

/**
 * Convert raw decoded sample to meters relative to 1,737,400 m reference sphere.
 */
function decodeSampleToMeters(rawInt16) {
  if (rawInt16 === NODATA_INT16) return NaN;
  // NASA PDS LOLA GDR stores signed 16-bit integer with SCALING_FACTOR = 0.5 m
  // relative to OFFSET = 1,737,400 m.
  let elevM = rawInt16 * 0.5;
  // Guard against any dataset that includes the 1,737,400 m reference radius directly
  if (elevM > 1000000) {
    elevM -= REFERENCE_RADIUS_M;
  }
  return elevM;
}

/**
 * Sample decoded elevation in meters at stereographic coordinates (xMeters, yMeters)
 * using bilinear interpolation and proper NoData masking.
 */
function sampleElevationAtMeters(xMeters, yMeters) {
  if (!demInt16View) return NaN;
  if (
    xMeters < -HALF_EXTENT_M ||
    xMeters > HALF_EXTENT_M ||
    yMeters < -HALF_EXTENT_M ||
    yMeters > HALF_EXTENT_M
  ) {
    return NaN;
  }

  const colF = (xMeters + HALF_EXTENT_M) / demCellSizeM - 0.5;
  const rowF = (HALF_EXTENT_M - yMeters) / demCellSizeM - 0.5;

  const c0 = Math.max(0, Math.min(demGridSize - 1, Math.floor(colF)));
  const r0 = Math.max(0, Math.min(demGridSize - 1, Math.floor(rowF)));
  const c1 = Math.min(demGridSize - 1, c0 + 1);
  const r1 = Math.min(demGridSize - 1, r0 + 1);

  const fx = Math.max(0, Math.min(1, colF - c0));
  const fy = Math.max(0, Math.min(1, rowF - r0));

  const z00 = decodeSampleToMeters(demInt16View.getInt16((r0 * demGridSize + c0) * 2, true));
  const z10 = decodeSampleToMeters(demInt16View.getInt16((r0 * demGridSize + c1) * 2, true));
  const z01 = decodeSampleToMeters(demInt16View.getInt16((r1 * demGridSize + c0) * 2, true));
  const z11 = decodeSampleToMeters(demInt16View.getInt16((r1 * demGridSize + c1) * 2, true));

  if (Number.isNaN(z00) || Number.isNaN(z10) || Number.isNaN(z01) || Number.isNaN(z11)) {
    return NaN;
  }

  const top = z00 * (1 - fx) + z10 * fx;
  const bot = z01 * (1 - fx) + z11 * fx;
  return top * (1 - fy) + bot * fy;
}

async function ensureDemLoaded(demUrl) {
  if (demLoaded && demInt16View) return globalDiagnosticStats;
  if (demLoadPromise) return demLoadPromise;

  demLoadPromise = (async () => {
    let targetUrl = demUrl;
    if (!demUrl.startsWith('http')) {
      if (typeof self !== 'undefined' && self.location && self.location.origin && self.location.origin !== 'null') {
        targetUrl = new URL(demUrl, self.location.origin).href;
      }
    }
    const response = await fetch(targetUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch NASA LOLA DEM (${response.status}) from ${targetUrl}`);
    }
    const buffer = await response.arrayBuffer();
    demInt16View = new DataView(buffer);
    const totalSamples = buffer.byteLength / 2;
    demGridSize = Math.round(Math.sqrt(totalSamples));
    demCellSizeM = FULL_EXTENT_M / demGridSize;

    // STEP 1 & STEP 2: Verify endianness, NoData masking, and global min/max/mean relative to 1,737,400 m
    let minM = Infinity;
    let maxM = -Infinity;
    let sumM = 0;
    let validCount = 0;
    let nodataCount = 0;
    let outOfRangeCount = 0;

    for (let i = 0; i < totalSamples; i++) {
      const rawInt16 = demInt16View.getInt16(i * 2, true); // explicit little-endian (LSB_INTEGER)
      const elevM = decodeSampleToMeters(rawInt16);
      if (Number.isNaN(elevM)) {
        nodataCount++;
        continue;
      }
      if (elevM < MIN_EXPECTED_ELEV_M || elevM > MAX_EXPECTED_ELEV_M) {
        outOfRangeCount++;
      }
      if (elevM < minM) minM = elevM;
      if (elevM > maxM) maxM = elevM;
      sumM += elevM;
      validCount++;
    }

    globalDiagnosticStats = {
      gridSize: demGridSize,
      cellSizeM: demCellSizeM,
      referenceRadiusM: REFERENCE_RADIUS_M,
      minElevM: minM,
      maxElevM: maxM,
      meanElevM: validCount > 0 ? +(sumM / validCount).toFixed(2) : 0,
      validCount,
      nodataCount,
      outOfRangeCount,
    };
    demLoaded = true;
    return globalDiagnosticStats;
  })();

  return demLoadPromise;
}

// Precompute Hillshade light vector: Azimuth = 315° (NW), Altitude = 30°
const AZIMUTH_RAD = (315 * Math.PI) / 180;
const ALTITUDE_RAD = (30 * Math.PI) / 180;
const SIN_ALT = Math.sin(ALTITUDE_RAD);
const COS_ALT = Math.cos(ALTITUDE_RAD);
// Map geographic azimuth (clockwise from North/+Y) to Cartesian unit vector (lx, ly, lz)
const LIGHT_X = COS_ALT * Math.sin(AZIMUTH_RAD); // -0.61237
const LIGHT_Y = COS_ALT * Math.cos(AZIMUTH_RAD); // +0.61237
const LIGHT_Z = SIN_ALT;                         // +0.50000
const VERTICAL_EXAGGERATION = 2.0;

self.onmessage = async (event) => {
  const { type, payload } = event.data;

  try {
    if (type === 'INIT_DEM') {
      const stats = await ensureDemLoaded(payload.demUrl);
      self.postMessage({ type: 'DEM_READY', payload: stats });
      return;
    }

    if (type === 'RENDER_TILE') {
      const {
        tileKey,
        z,
        x,
        y,
        tileSize = 256,
        renderMode = 'svs-5127', // 'svs-5127' (NASA SVS 5127 Coded Color) | 'grayscale-all' | 'grayscale-center-tile'
        enableHillshade = true,
        demUrl,
      } = payload;

      await ensureDemLoaded(demUrl);

      const resolution = RESOLUTIONS[z] ?? 20 * Math.pow(2, Math.max(0, 6 - z));
      const tileSpanM = tileSize * resolution;
      const tileMinXM = -HALF_EXTENT_M + x * tileSpanM;
      const tileMaxYM = HALF_EXTENT_M - y * tileSpanM;

      // Step 1 & Step 2: Decode heights for every pixel in this 256x256 tile
      const heights = new Float32Array(tileSize * tileSize);
      let tileMin = Infinity;
      let tileMax = -Infinity;
      let tileSum = 0;
      let validCount = 0;
      let nodataCount = 0;
      let outOfRangeCount = 0;

      for (let py = 0; py < tileSize; py++) {
        const yMeters = tileMaxYM - (py + 0.5) * resolution;
        const rowOffset = py * tileSize;
        for (let px = 0; px < tileSize; px++) {
          const xMeters = tileMinXM + (px + 0.5) * resolution;
          const elevM = sampleElevationAtMeters(xMeters, yMeters);
          heights[rowOffset + px] = elevM;

          if (Number.isNaN(elevM)) {
            nodataCount++;
          } else {
            if (elevM < tileMin) tileMin = elevM;
            if (elevM > tileMax) tileMax = elevM;
            tileSum += elevM;
            validCount++;
            if (elevM < MIN_EXPECTED_ELEV_M || elevM > MAX_EXPECTED_ELEV_M) {
              outOfRangeCount++;
            }
          }
        }
      }

      const rgba = new Uint8ClampedArray(tileSize * tileSize * 4);

      // Determine whether this specific tile should render as plain min-max stretched grayscale (STEP 1)
      const isDiagnosticGrayscaleTile =
        renderMode === 'grayscale-all' ||
        (renderMode === 'grayscale-center-tile' && x === 1 && y === 1);

      if (validCount > 0) {
        const span = Math.max(1, tileMax - tileMin);
        const stepM = Math.max(resolution, demCellSizeM * 0.75);

        for (let py = 0; py < tileSize; py++) {
          const yMeters = tileMaxYM - (py + 0.5) * resolution;
          const rowOffset = py * tileSize;

          for (let px = 0; px < tileSize; px++) {
            const idx = rowOffset + px;
            const elevM = heights[idx];
            const outIdx = idx * 4;

            // Mask NoData (never render NoData as 0 m)
            if (Number.isNaN(elevM)) {
              rgba[outIdx] = 0;
              rgba[outIdx + 1] = 0;
              rgba[outIdx + 2] = 0;
              rgba[outIdx + 3] = 0;
              continue;
            }

            if (isDiagnosticGrayscaleTile) {
              // Plain grayscale diagnostic
              const gray = Math.max(
                0,
                Math.min(255, Math.round(((elevM - tileMin) / span) * 255))
              );
              rgba[outIdx] = gray;
              rgba[outIdx + 1] = gray;
              rgba[outIdx + 2] = gray;
              rgba[outIdx + 3] = 255;
            } else {
              // NASA SVS 5127: Lunar South Pole Terrain in Coded Color with Directional Shaded Relief
              const xMeters = tileMinXM + (px + 0.5) * resolution;
              const zE = sampleElevationAtMeters(xMeters + stepM, yMeters);
              const zW = sampleElevationAtMeters(xMeters - stepM, yMeters);
              const zN = sampleElevationAtMeters(xMeters, yMeters + stepM);
              const zS = sampleElevationAtMeters(xMeters, yMeters - stepM);

              const dzdx =
                !Number.isNaN(zE) && !Number.isNaN(zW)
                  ? (zE - zW) / (2 * stepM)
                  : 0;
              const dzdy =
                !Number.isNaN(zN) && !Number.isNaN(zS)
                  ? (zN - zS) / (2 * stepM)
                  : 0;

              const nx = -VERTICAL_EXAGGERATION * dzdx;
              const ny = -VERTICAL_EXAGGERATION * dzdy;
              const nz = 1.0;
              const invLen = 1.0 / Math.sqrt(nx * nx + ny * ny + nz * nz);

              const cosIllum = Math.max(
                0,
                (nx * LIGHT_X + ny * LIGHT_Y + nz * LIGHT_Z) * invLen
              );

              // Directional shaded relief: preserves vibrant SVS 5127 elevation colors with crisp crater wall contrast
              const shadeFactor = 0.42 + 0.82 * cosIllum;
              const [baseR, baseG, baseB] = evaluateSvs5127Ramp(elevM);

              rgba[outIdx] = Math.max(0, Math.min(255, Math.round(baseR * shadeFactor)));
              rgba[outIdx + 1] = Math.max(0, Math.min(255, Math.round(baseG * shadeFactor)));
              rgba[outIdx + 2] = Math.max(0, Math.min(255, Math.round(baseB * shadeFactor)));
              rgba[outIdx + 3] = 255;
            }
          }
        }
      }

      const tileStats =
        validCount > 0
          ? {
              z,
              x,
              y,
              minM: +tileMin.toFixed(1),
              maxM: +tileMax.toFixed(1),
              meanM: +(tileSum / validCount).toFixed(1),
              validCount,
              nodataCount,
              outOfRangeCount,
              isDiagnosticGrayscaleTile,
            }
          : null;

      self.postMessage(
        {
          type: 'TILE_RENDERED',
          payload: {
            tileKey,
            tileSize,
            rgbaBuffer: rgba.buffer,
            tileStats,
          },
        },
        [rgba.buffer]
      );
      return;
    }

    if (type === 'EXTRACT_CONTOUR_GRID') {
      const { gridSize = 380, demUrl } = payload;
      await ensureDemLoaded(demUrl);

      const rawValues = new Float32Array(gridSize * gridSize);
      const cellM = FULL_EXTENT_M / gridSize;

      for (let r = 0; r < gridSize; r++) {
        const yMeters = HALF_EXTENT_M - (r + 0.5) * cellM;
        for (let c = 0; c < gridSize; c++) {
          const xMeters = -HALF_EXTENT_M + (c + 0.5) * cellM;
          const elevM = sampleElevationAtMeters(xMeters, yMeters);
          rawValues[r * gridSize + c] = elevM;
        }
      }

      // Apply Gaussian Smoothing (sigma ≈ 1.0 px) to eliminate contour noise
      const values = new Float32Array(gridSize * gridSize);
      const kernel = [
        0.075, 0.125, 0.075,
        0.125, 0.200, 0.125,
        0.075, 0.125, 0.075,
      ];

      for (let r = 0; r < gridSize; r++) {
        for (let c = 0; c < gridSize; c++) {
          const idx = r * gridSize + c;
          const centerVal = rawValues[idx];
          if (Number.isNaN(centerVal)) {
            values[idx] = NaN;
            continue;
          }
          let sum = 0;
          let weightSum = 0;
          let k = 0;
          for (let dr = -1; dr <= 1; dr++) {
            const nr = r + dr;
            if (nr < 0 || nr >= gridSize) { k += 3; continue; }
            for (let dc = -1; dc <= 1; dc++) {
              const nc = c + dc;
              const w = kernel[k++];
              if (nc >= 0 && nc < gridSize) {
                const val = rawValues[nr * gridSize + nc];
                if (!Number.isNaN(val)) {
                  sum += val * w;
                  weightSum += w;
                }
              }
            }
          }
          values[idx] = weightSum > 0 ? sum / weightSum : centerVal;
        }
      }

      self.postMessage(
        {
          type: 'CONTOUR_GRID_READY',
          payload: {
            gridSize,
            cellM,
            halfExtentM: HALF_EXTENT_M,
            valuesBuffer: values.buffer,
          },
        },
        [values.buffer]
      );
      return;
    }

    if (type === 'PROBE_POINT') {
      const { xMeters, yMeters, demUrl } = payload;
      await ensureDemLoaded(demUrl);
      const elevM = sampleElevationAtMeters(xMeters, yMeters);

      let slopeDeg = null;
      if (!Number.isNaN(elevM)) {
        const stepM = demCellSizeM; // 400 m
        const zE = sampleElevationAtMeters(xMeters + stepM, yMeters);
        const zW = sampleElevationAtMeters(xMeters - stepM, yMeters);
        const zN = sampleElevationAtMeters(xMeters, yMeters + stepM);
        const zS = sampleElevationAtMeters(xMeters, yMeters - stepM);
        if (!Number.isNaN(zE) && !Number.isNaN(zW) && !Number.isNaN(zN) && !Number.isNaN(zS)) {
          const dzdx = (zE - zW) / (2 * stepM);
          const dzdy = (zN - zS) / (2 * stepM);
          slopeDeg = Math.round(((Math.atan(Math.hypot(dzdx, dzdy)) * 180) / Math.PI) * 10) / 10;
        }
      }

      self.postMessage({
        type: 'PROBE_RESULT',
        payload: {
          xMeters,
          yMeters,
          elevationM: Number.isNaN(elevM) ? null : Math.round(elevM * 10) / 10,
          slopeDeg,
        },
      });
    }
  } catch (err) {
    self.postMessage({
      type: 'WORKER_ERROR',
      payload: { message: err?.message || String(err) },
    });
  }
};
