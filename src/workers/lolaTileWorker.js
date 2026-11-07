import { ELEVATION_RAMP } from '../constants/topoStyle.js';

let demGrid = null;
let demSize = 0; // Expected 1520 for 400m LOLA grid (-80° to -90°S, ±304km)
let demScale = 0.5; // LOLA LDEM_80S Int16 vertical scale factor (0.5 m per unit)
let demLoadPromise = null;
const pendingMessages = [];

const DEM_SCALE_M = 0.5;
const DEM_NODATA = -32768;
const MOON_RADIUS_M = 1737400;
const HALF_EXTENT_M = 304000;
const SP_RESOLUTIONS = [1280, 640, 320, 160, 80, 40, 20];

// Precompute an O(1) color lookup table (LUT) for elevations from -9000m to +9000m at 1m resolution
const LUT_MIN_ELEV = -9000;
const LUT_MAX_ELEV = 9000;
const LUT_SIZE = LUT_MAX_ELEV - LUT_MIN_ELEV + 1;
const RAMP_LUT = new Uint8Array(LUT_SIZE * 3);

(function buildRampLut() {
  for (let e = LUT_MIN_ELEV; e <= LUT_MAX_ELEV; e++) {
    const idx = (e - LUT_MIN_ELEV) * 3;
    if (e <= ELEVATION_RAMP[0].elev) {
      RAMP_LUT[idx] = ELEVATION_RAMP[0].rgb[0];
      RAMP_LUT[idx + 1] = ELEVATION_RAMP[0].rgb[1];
      RAMP_LUT[idx + 2] = ELEVATION_RAMP[0].rgb[2];
      continue;
    }
    const last = ELEVATION_RAMP[ELEVATION_RAMP.length - 1];
    if (e >= last.elev) {
      RAMP_LUT[idx] = last.rgb[0];
      RAMP_LUT[idx + 1] = last.rgb[1];
      RAMP_LUT[idx + 2] = last.rgb[2];
      continue;
    }
    for (let i = 0; i < ELEVATION_RAMP.length - 1; i++) {
      const a = ELEVATION_RAMP[i];
      const b = ELEVATION_RAMP[i + 1];
      if (e >= a.elev && e <= b.elev) {
        const t = (e - a.elev) / (b.elev - a.elev);
        RAMP_LUT[idx] = Math.round(a.rgb[0] + t * (b.rgb[0] - a.rgb[0]));
        RAMP_LUT[idx + 1] = Math.round(a.rgb[1] + t * (b.rgb[1] - a.rgb[1]));
        RAMP_LUT[idx + 2] = Math.round(a.rgb[2] + t * (b.rgb[2] - a.rgb[2]));
        break;
      }
    }
  }
})();

async function ensureDemLoaded(demUrl) {
  if (demGrid && demSize > 0) return true;
  if (demLoadPromise) return demLoadPromise;
  const url = demUrl || '/data/lola_sp_80s_int16.bin';
  demLoadPromise = fetch(url)
    .then((res) => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.arrayBuffer();
    })
    .then((buf) => {
      demGrid = new Int16Array(buf);
      demSize = Math.round(Math.sqrt(demGrid.length));
      demScale = DEM_SCALE_M;
      return true;
    })
    .catch((err) => {
      demLoadPromise = null;
      throw err;
    });
  return demLoadPromise;
}

/**
 * Fast inline bilinear interpolation on the Int16 DEM grid,
 * converting raw 0.5m half-meter units to meters and checking -32768 nodata.
 */
function sampleElevation(gx, gy) {
  if (!demGrid || gx < 0 || gx >= demSize - 1 || gy < 0 || gy >= demSize - 1) {
    return null;
  }
  const x0 = gx | 0;
  const y0 = gy | 0;
  const dx = gx - x0;
  const dy = gy - y0;

  const row0 = y0 * demSize;
  const row1 = (y0 + 1) * demSize;

  const raw00 = demGrid[row0 + x0];
  const raw10 = demGrid[row0 + x0 + 1];
  const raw01 = demGrid[row1 + x0];
  const raw11 = demGrid[row1 + x0 + 1];

  if (
    raw00 === DEM_NODATA ||
    raw10 === DEM_NODATA ||
    raw01 === DEM_NODATA ||
    raw11 === DEM_NODATA
  ) {
    return null;
  }

  return (
    (raw00 * (1 - dx) * (1 - dy) +
      raw10 * dx * (1 - dy) +
      raw01 * (1 - dx) * dy +
      raw11 * dx * dy) *
    demScale
  );
}

function sampleElevationAtMeters(xMeters, yMeters, halfExtent = HALF_EXTENT_M) {
  if (!demGrid || demSize <= 0) return null;
  const normX = (xMeters + halfExtent) / (2 * halfExtent);
  const normY = (halfExtent - yMeters) / (2 * halfExtent);
  const gx = normX * (demSize - 1);
  const gy = normY * (demSize - 1);
  return sampleElevation(gx, gy);
}

function computeSlopeAtMeters(xMeters, yMeters, stepM = 400, halfExtent = HALF_EXTENT_M) {
  const zC = sampleElevationAtMeters(xMeters, yMeters, halfExtent);
  if (zC === null) return { elevationM: null, slopeDeg: null };
  const zN = sampleElevationAtMeters(xMeters, yMeters + stepM, halfExtent) ?? zC;
  const zS = sampleElevationAtMeters(xMeters, yMeters - stepM, halfExtent) ?? zC;
  const zE = sampleElevationAtMeters(xMeters + stepM, yMeters, halfExtent) ?? zC;
  const zW = sampleElevationAtMeters(xMeters - stepM, yMeters, halfExtent) ?? zC;
  const dzdx = (zE - zW) / (2 * stepM);
  const dzdy = (zN - zS) / (2 * stepM);
  const slopeRad = Math.atan(Math.sqrt(dzdx * dzdx + dzdy * dzdy));
  return {
    elevationM: zC,
    slopeDeg: slopeRad * (180 / Math.PI),
  };
}

// Precomputed 16-azimuth ray tables for Mazarico et al. (2011) multi-azimuth LOLA DEM PSR horizon masking
const PSR_AZ_COUNT = 16;
const PSR_RAY_STEPS = 14;
const PSR_STEP_M = 2400; // 2.4 km radial steps up to 33.6 km crater rim horizon
const PSR_DIR_X = new Float32Array(PSR_AZ_COUNT);
const PSR_DIR_Y = new Float32Array(PSR_AZ_COUNT);
const PSR_INV_DIST = new Float32Array(PSR_RAY_STEPS + 1);
const PSR_CURV_DROP = new Float32Array(PSR_RAY_STEPS + 1);

(function initPsrTables() {
  for (let a = 0; a < PSR_AZ_COUNT; a++) {
    const rad = (a * 2 * Math.PI) / PSR_AZ_COUNT;
    PSR_DIR_X[a] = Math.sin(rad);
    PSR_DIR_Y[a] = Math.cos(rad);
  }
  for (let s = 1; s <= PSR_RAY_STEPS; s++) {
    const d = s * PSR_STEP_M;
    PSR_INV_DIST[s] = 1 / d;
    PSR_CURV_DROP[s] = (d * d) / (2 * MOON_RADIUS_M);
  }
})();

/**
 * Computes maximum annual solar elevation clearance (in degrees) above the local 360° LOLA DEM
 * terrain horizon across 16 solar azimuths at maximum lunar summer obliquity (+1.5424°).
 * Returns <= 0° if and only if surrounding topography blocks the Sun at ALL azimuths (true PSR).
 */
function computePsrClearanceAtMeters(xMeters, yMeters, zCenter = null, halfExtent = HALF_EXTENT_M) {
  if (!demGrid || demSize <= 0) return null;
  const z0 = zCenter !== null && Number.isFinite(zCenter)
    ? zCenter
    : sampleElevationAtMeters(xMeters, yMeters, halfExtent);
  if (z0 === null) return null;

  const invWorldSpan = (demSize - 1) / (2 * halfExtent);
  const c0 = (xMeters + halfExtent) * invWorldSpan;
  const r0 = (halfExtent - yMeters) * invWorldSpan;
  const stepGrid = PSR_STEP_M * invWorldSpan;

  let maxSolarClearanceDeg = -90;

  for (let a = 0; a < PSR_AZ_COUNT; a++) {
    const ux = PSR_DIR_X[a];
    const uy = PSR_DIR_Y[a];
    const sunMaxElDeg =
      1.5424 + ((xMeters * ux + yMeters * uy) / MOON_RADIUS_M) * 57.29577951308232;

    let maxSlope = -1e9;
    let validRaySamples = 0;
    const dc = ux * stepGrid;
    const dr = -uy * stepGrid;

    for (let s = 1; s <= PSR_RAY_STEPS; s++) {
      const nc = (c0 + dc * s) | 0;
      const nr = (r0 + dr * s) | 0;
      if (nc < 0 || nc >= demSize || nr < 0 || nr >= demSize) break;
      const rawZ = demGrid[nr * demSize + nc];
      if (rawZ === DEM_NODATA) continue;
      validRaySamples++;
      const zTarget = rawZ * demScale;
      const slope = (zTarget - z0 - PSR_CURV_DROP[s]) * PSR_INV_DIST[s];
      if (slope > maxSlope) maxSlope = slope;
    }

    const horizDeg = validRaySamples > 0 ? Math.atan(maxSlope) * 57.29577951308232 : 0;
    const clearanceDeg = sunMaxElDeg - horizDeg;
    if (clearanceDeg > maxSolarClearanceDeg) {
      maxSolarClearanceDeg = clearanceDeg;
    }
  }

  return maxSolarClearanceDeg;
}

// Precomputed radial step distances (800 m to 36.8 km) for directional solar shadow & Earth occlusion ray-marching
const RAY_MARCH_STEPS = 16;
const RAY_DIST_M = new Float32Array(RAY_MARCH_STEPS);
const RAY_INV_DIST_M = new Float32Array(RAY_MARCH_STEPS);
const RAY_CURV_DROP_M = new Float32Array(RAY_MARCH_STEPS);

(function initDirectionalRayTables() {
  for (let i = 0; i < RAY_MARCH_STEPS; i++) {
    // Near-field 800 m / 1600 m steps transitioning to 2400 m far-field steps up to 36.8 km
    const d = i === 0 ? 800 : i === 1 ? 1600 : i * 2400;
    RAY_DIST_M[i] = d;
    RAY_INV_DIST_M[i] = 1 / d;
    RAY_CURV_DROP_M[i] = (d * d) / (2 * MOON_RADIUS_M);
  }
})();

/**
 * Marches a single directional ray along planar unit vector (dirX, dirY) across the LOLA DEM
 * from (xMeters, yMeters) and returns the maximum terrain horizon elevation angle (in degrees),
 * accounting for lunar spherical curvature drop d^2 / (2 * R0).
 */
function computeDirectionalHorizonDeg(
  xMeters,
  yMeters,
  zCenter = null,
  dirX = 0,
  dirY = 1,
  halfExtent = HALF_EXTENT_M
) {
  if (!demGrid || demSize <= 0) return 0;
  const z0 =
    zCenter !== null && Number.isFinite(zCenter)
      ? zCenter
      : sampleElevationAtMeters(xMeters, yMeters, halfExtent);
  if (z0 === null) return 0;

  const invWorldSpan = (demSize - 1) / (2 * halfExtent);
  const c0 = (xMeters + halfExtent) * invWorldSpan;
  const r0 = (halfExtent - yMeters) * invWorldSpan;

  let maxSlope = -1e9;
  let validCount = 0;

  for (let i = 0; i < RAY_MARCH_STEPS; i++) {
    const distM = RAY_DIST_M[i];
    const gridOffset = distM * invWorldSpan;
    const nc = (c0 + dirX * gridOffset) | 0;
    const nr = (r0 - dirY * gridOffset) | 0;
    if (nc < 0 || nc >= demSize || nr < 0 || nr >= demSize) break;
    const rawZ = demGrid[nr * demSize + nc];
    if (rawZ === DEM_NODATA) continue;
    validCount++;
    const zTarget = rawZ * demScale;
    const slope = (zTarget - z0 - RAY_CURV_DROP_M[i]) * RAY_INV_DIST_M[i];
    if (slope > maxSlope) maxSlope = slope;
  }

  return validCount > 0 ? Math.atan(maxSlope) * 57.29577951308232 : 0;
}

function handleExtractContourGrid(payload) {
  const gridSize = payload?.gridSize || 240;
  const halfExtentM = payload?.halfExtentM || HALF_EXTENT_M;
  const cellM = (2 * halfExtentM) / gridSize;
  const raw = new Float32Array(gridSize * gridSize);

  for (let row = 0; row < gridSize; row++) {
    const yM = halfExtentM - (row + 0.5) * cellM;
    for (let col = 0; col < gridSize; col++) {
      const xM = -halfExtentM + (col + 0.5) * cellM;
      const elev = sampleElevationAtMeters(xM, yM, halfExtentM);
      raw[row * gridSize + col] = elev === null ? 0 : elev;
    }
  }

  // Separable 3x3 Gaussian smoothing pass so d3-contour produces clean cartographic isolines
  const smoothed = new Float32Array(gridSize * gridSize);
  for (let r = 0; r < gridSize; r++) {
    const r0 = Math.max(0, r - 1) * gridSize;
    const r1 = r * gridSize;
    const r2 = Math.min(gridSize - 1, r + 1) * gridSize;
    for (let c = 0; c < gridSize; c++) {
      const c0 = Math.max(0, c - 1);
      const c1 = c;
      const c2 = Math.min(gridSize - 1, c + 1);
      smoothed[r1 + c1] =
        (raw[r0 + c0] + 2 * raw[r0 + c1] + raw[r0 + c2] +
         2 * raw[r1 + c0] + 4 * raw[r1 + c1] + 2 * raw[r1 + c2] +
         raw[r2 + c0] + 2 * raw[r2 + c1] + raw[r2 + c2]) / 16;
    }
  }

  self.postMessage(
    {
      type: 'CONTOUR_GRID_READY',
      payload: {
        gridSize,
        cellM,
        halfExtentM,
        valuesBuffer: smoothed.buffer,
      },
    },
    [smoothed.buffer]
  );
}

function handleRenderTile(msgPayload) {
  // Support both SouthPoleTopoMap payload and legacy/test payload
  const tileKey = msgPayload.tileKey;
  const requestId = msgPayload.requestId || tileKey;
  const tileSize = msgPayload.tileSize || 256;
  const coords = msgPayload.coords || { x: msgPayload.x, y: msgPayload.y, z: msgPayload.z };
  const z = coords.z ?? 1;
  const resolution = msgPayload.resolution || SP_RESOLUTIONS[z] || 640;
  const mapExtentM = msgPayload.mapExtentM || HALF_EXTENT_M;
  const renderMode = msgPayload.renderMode || 'hypsometric';
  const enableHillshade = msgPayload.enableHillshade !== false;
  const subSunLonDeg = msgPayload.subSunLonDeg ?? msgPayload.sunAzimuthDeg ?? 315;
  const subSunLatDeg =
    msgPayload.subSunLatDeg !== undefined
      ? msgPayload.subSunLatDeg
      : -(msgPayload.sunElevationDeg ?? 1.5);
  const subEarthLonDeg = msgPayload.subEarthLonDeg ?? 0;
  const subEarthLatDeg = msgPayload.subEarthLatDeg ?? -6.5;
  const showSlopeHazard = Boolean(msgPayload.showSlopeHazard);

  const pixelData = new Uint8ClampedArray(tileSize * tileSize * 4);
  if (!demGrid || demSize <= 0) {
    self.postMessage(
      {
        type: 'TILE_RENDERED',
        requestId,
        pixelBuffer: pixelData.buffer,
        payload: { tileKey, tileSize, rgbaBuffer: pixelData.buffer },
      },
      [pixelData.buffer]
    );
    return;
  }

  // Planar unit vectors in South Polar Stereographic frame (+Y = 0°E, +X = 90°E)
  const subSunLonRad = (subSunLonDeg * Math.PI) / 180;
  const sunDirX = Math.sin(subSunLonRad);
  const sunDirY = Math.cos(subSunLonRad);
  const rimLonRad = subSunLonRad + Math.PI * 0.75;
  const rimDirX = Math.sin(rimLonRad);
  const rimDirY = Math.cos(rimLonRad);

  // Hillshade illumination elevation (clamped >= 15° for cartographic relief visibility on non-solar layers)
  const hillElRad = (Math.max(15, -subSunLatDeg) * Math.PI) / 180;
  const cosHillEl = Math.cos(hillElRad);
  const sinHillEl = Math.sin(hillElRad);

  const earthLonRad = (subEarthLonDeg * Math.PI) / 180;
  const earthDirX = Math.sin(earthLonRad);
  const earthDirY = Math.cos(earthLonRad);

  const minorInterval = z >= 4 ? 100 : z >= 2 ? 250 : 500;
  const majorInterval = minorInterval * 5;

  const stride = tileSize + 2;
  const elevBuf = new Float32Array(stride * stride);
  const validBuf = new Uint8Array(stride * stride);

  const invExtent = 1 / (2 * mapExtentM);
  const gridMax = demSize - 1;
  const baseTileX = coords.x * tileSize;
  const baseTileY = coords.y * tileSize;

  for (let py = -1; py <= tileSize; py++) {
    const worldY = mapExtentM - (baseTileY + py) * resolution;
    const gy = (mapExtentM - worldY) * invExtent * gridMax;
    const rowOffset = (py + 1) * stride;

    for (let px = -1; px <= tileSize; px++) {
      const worldX = -mapExtentM + (baseTileX + px) * resolution;
      const gx = (worldX + mapExtentM) * invExtent * gridMax;
      const elev = sampleElevation(gx, gy);
      const bufIdx = rowOffset + (px + 1);
      if (elev === null) {
        validBuf[bufIdx] = 0;
        elevBuf[bufIdx] = 0;
      } else {
        validBuf[bufIdx] = 1;
        elevBuf[bufIdx] = elev;
      }
    }
  }

  const invTwoRes = 1 / (2 * resolution);

  for (let py = 0; py < tileSize; py++) {
    const rPrev = py * stride;
    const rCurr = (py + 1) * stride;
    const rNext = (py + 2) * stride;
    const worldY = mapExtentM - (baseTileY + py) * resolution;

    for (let px = 0; px < tileSize; px++) {
      const cIdx = rCurr + (px + 1);
      if (!validBuf[cIdx]) continue;

      const worldX = -mapExtentM + (baseTileX + px) * resolution;
      const elev = elevBuf[cIdx];
      const zN = validBuf[rPrev + px + 1] ? elevBuf[rPrev + px + 1] : elev;
      const zS = validBuf[rNext + px + 1] ? elevBuf[rNext + px + 1] : elev;
      const zE = validBuf[rCurr + px + 2] ? elevBuf[rCurr + px + 2] : elev;
      const zW = validBuf[rCurr + px] ? elevBuf[rCurr + px] : elev;

      const dzdx = (zE - zW) * invTwoRes;
      const dzdy = (zN - zS) * invTwoRes;

      const slopeGradSq = dzdx * dzdx + dzdy * dzdy;
      const slopeRad = Math.atan(Math.sqrt(slopeGradSq));
      const slopeDeg = slopeRad * 57.29577951308232;
      const cosSlope = 1 / Math.sqrt(1 + slopeGradSq);

      let shade = 0.85;
      if (enableHillshade || renderMode === 'hillshade' || renderMode === 'illumination') {
        const rawShade =
          (sinHillEl - cosHillEl * (dzdx * sunDirX + dzdy * sunDirY)) * cosSlope;
        const rimShade =
          (0.45 - 0.55 * (dzdx * rimDirX + dzdy * rimDirY)) * cosSlope;
        shade = Math.max(0.14, Math.min(1.15, rawShade * 0.82 + Math.max(0, rimShade) * 0.24));
      }

      let r, g, b;
      if (renderMode === 'slope') {
        // Layer 2: Slope severity ramp: slate (<5°) -> cyan/emerald (5-10°) -> amber (10-15°) -> crimson (>15°)
        const t = Math.max(0, Math.min(1, slopeDeg / 24));
        if (t < 0.22) {
          const u = t / 0.22;
          r = Math.round(30 + u * 16);
          g = Math.round(45 + u * 135);
          b = Math.round(85 + u * 135);
        } else if (t < 0.58) {
          const u = (t - 0.22) / 0.36;
          r = Math.round(46 + u * 199);
          g = Math.round(180 - u * 22);
          b = Math.round(220 - u * 205);
        } else {
          const u = (t - 0.58) / 0.42;
          r = Math.round(245 - u * 6);
          g = Math.round(158 - u * 110);
          b = Math.round(15 + u * 45);
        }
        r = Math.round(r * (0.62 + shade * 0.38));
        g = Math.round(g * (0.62 + shade * 0.38));
        b = Math.round(b * (0.62 + shade * 0.38));
      } else if (renderMode === 'roughness') {
        // Layer 3: RMS Surface Roughness across 3x3 neighborhood
        const zNW = validBuf[rPrev + px] ? elevBuf[rPrev + px] : elev;
        const zNE = validBuf[rPrev + px + 2] ? elevBuf[rPrev + px + 2] : elev;
        const zSW = validBuf[rNext + px] ? elevBuf[rNext + px] : elev;
        const zSE = validBuf[rNext + px + 2] ? elevBuf[rNext + px + 2] : elev;
        const meanZ = (zNW + zN + zNE + zW + elev + zE + zSW + zS + zSE) / 9;
        const varZ =
          ((zNW - meanZ) ** 2 +
            (zN - meanZ) ** 2 +
            (zNE - meanZ) ** 2 +
            (zW - meanZ) ** 2 +
            (elev - meanZ) ** 2 +
            (zE - meanZ) ** 2 +
            (zSW - meanZ) ** 2 +
            (zS - meanZ) ** 2 +
            (zSE - meanZ) ** 2) /
          9;
        const rmsM = Math.sqrt(varZ);
        const t = Math.max(0, Math.min(1, rmsM / 25));
        r = Math.round((15 + t * 229) * (0.6 + shade * 0.4));
        g = Math.round((35 + (1 - Math.abs(t - 0.5) * 1.6) * 155) * (0.6 + shade * 0.4));
        b = Math.round((115 + (1 - t) * 110) * (0.6 + shade * 0.4));
      } else if (renderMode === 'hillshade') {
        // Layer 4: Pure high-contrast Lambertian monochromatic hillshade
        const lum = Math.max(12, Math.min(248, Math.round(shade * 215)));
        r = lum;
        g = Math.min(255, lum + 3);
        b = Math.min(255, lum + 8);
      } else if (renderMode === 'illumination') {
        // Layer 6: Time-Dynamic Solar Illumination with Planar Solar Vector & DEM Horizon Ray-Marching
        const sunDistM = worldX * sunDirX + worldY * sunDirY;
        const localSunElevDeg =
          -subSunLatDeg + (sunDistM / MOON_RADIUS_M) * 57.29577951308232;
        const localSunElRad = (localSunElevDeg * Math.PI) / 180;
        const sinSunEl = Math.sin(localSunElRad);
        const cosSunEl = Math.cos(localSunElRad);
        const cosInc =
          (sinSunEl - cosSunEl * (dzdx * sunDirX + dzdy * sunDirY)) * cosSlope;

        let isShadowed = localSunElevDeg <= 0.0 || cosInc <= 0.0;
        if (!isShadowed) {
          const sunHorizonDeg = computeDirectionalHorizonDeg(
            worldX,
            worldY,
            elev,
            sunDirX,
            sunDirY,
            mapExtentM
          );
          if (localSunElevDeg <= sunHorizonDeg) {
            isShadowed = true;
          }
        }

        if (isShadowed) {
          const depth = Math.max(0.18, Math.min(0.6, (elev + 5000) / 8000));
          r = Math.round(10 * depth);
          g = Math.round(16 * depth);
          b = Math.round(36 * depth);
        } else {
          const flux = Math.min(1, Math.pow(cosInc, 0.65));
          r = Math.min(255, Math.round(45 + flux * 210));
          g = Math.min(255, Math.round(28 + flux * 195));
          b = Math.min(255, Math.round(15 + Math.pow(flux, 1.8) * 155));
        }
      } else if (renderMode === 'psr') {
        // Layer 7: Permanently Shadowed Regions (PSRs) via 16-Azimuth LOLA DEM Horizon Ray-Marching (Mazarico et al. 2011)
        const clampedElev = Math.max(LUT_MIN_ELEV, Math.min(LUT_MAX_ELEV, Math.round(elev)));
        const lutIdx = (clampedElev - LUT_MIN_ELEV) * 3;
        r = Math.min(255, (RAMP_LUT[lutIdx] * shade * 0.55) | 0);
        g = Math.min(255, (RAMP_LUT[lutIdx + 1] * shade * 0.55) | 0);
        b = Math.min(255, (RAMP_LUT[lutIdx + 2] * shade * 0.65) | 0);

        const maxSolarClearanceDeg = computePsrClearanceAtMeters(worldX, worldY, elev, mapExtentM);
        if (maxSolarClearanceDeg !== null && maxSolarClearanceDeg <= 0.0) {
          // True multi-azimuth permanent shadow: horizon blocks Sun at all 16 azimuths
          const shadowDepthFactor = Math.min(1, Math.max(0.25, -maxSolarClearanceDeg / 4.0));
          r = Math.round(r * (1 - 0.82 * shadowDepthFactor) + 8 * shadowDepthFactor);
          g = Math.round(g * (1 - 0.72 * shadowDepthFactor) + 178 * shadowDepthFactor);
          b = Math.round(b * (1 - 0.52 * shadowDepthFactor) + 250 * shadowDepthFactor);
        } else if (maxSolarClearanceDeg !== null && maxSolarClearanceDeg <= 0.75) {
          // Marginal seasonal penumbra (< 0.75° max summer clearance)
          const penumbraFactor = (0.75 - maxSolarClearanceDeg) / 0.75;
          r = Math.round(r * (1 - 0.35 * penumbraFactor) + 30 * penumbraFactor);
          g = Math.round(g * (1 - 0.35 * penumbraFactor) + 115 * penumbraFactor);
          b = Math.round(b * (1 - 0.35 * penumbraFactor) + 195 * penumbraFactor);
        }
      } else if (renderMode === 'earth-visibility') {
        // Layer 8: Direct-to-Earth (DTE) Libration-Synced Visibility with DEM Obstacle Ray-Marching
        const earthDistM = worldX * earthDirX + worldY * earthDirY;
        const angularOffsetDeg = (earthDistM / MOON_RADIUS_M) * 57.29577951308232;
        const localEarthElevDeg = -subEarthLatDeg + angularOffsetDeg;
        const localSlopeAlongEarthDeg =
          Math.atan(dzdx * earthDirX + dzdy * earthDirY) * 57.29577951308232;
        const earthHorizonDeg =
          localEarthElevDeg > 0.0
            ? computeDirectionalHorizonDeg(worldX, worldY, elev, earthDirX, earthDirY, mapExtentM)
            : 90.0;
        const effectiveHorizonDeg = Math.max(0.0, earthHorizonDeg, localSlopeAlongEarthDeg);
        const earthClearanceDeg = localEarthElevDeg - effectiveHorizonDeg;

        if (localEarthElevDeg <= 0.0 || earthClearanceDeg <= 0.0) {
          // Below local horizon or occluded by intervening DEM terrain
          r = Math.round(75 * shade);
          g = Math.round(20 * shade);
          b = Math.round(30 * shade);
        } else if (earthClearanceDeg < 1.5) {
          // Marginal grazing horizon (< 1.5° clearance above terrain mask)
          r = Math.round(215 * shade);
          g = Math.round(145 * shade);
          b = Math.round(25 * shade);
        } else {
          // Clear Direct-to-Earth visibility
          const visT = Math.min(1, (earthClearanceDeg - 1.5) / 10);
          r = Math.round((16 + visT * 36) * (0.65 + shade * 0.35));
          g = Math.round((145 + visT * 95) * (0.65 + shade * 0.35));
          b = Math.round((110 + visT * 65) * (0.65 + shade * 0.35));
        }
      } else if (renderMode === 'risk') {
        // Layer 9: Time-Dependent Composite Mission Risk (Slope + Cast Solar Shadow + DEM DTE Occultation)
        const sunDistM = worldX * sunDirX + worldY * sunDirY;
        const localSunElevDeg =
          -subSunLatDeg + (sunDistM / MOON_RADIUS_M) * 57.29577951308232;
        const localSunElRad = (localSunElevDeg * Math.PI) / 180;
        const sinSunEl = Math.sin(localSunElRad);
        const cosSunEl = Math.cos(localSunElRad);
        const cosInc =
          (sinSunEl - cosSunEl * (dzdx * sunDirX + dzdy * sunDirY)) * cosSlope;
        const sunHorizonDeg =
          localSunElevDeg > 0.0 && cosInc > 0.0
            ? computeDirectionalHorizonDeg(worldX, worldY, elev, sunDirX, sunDirY, mapExtentM)
            : 90.0;
        const isSunShadowed =
          localSunElevDeg <= 0.0 || cosInc <= 0.0 || localSunElevDeg <= sunHorizonDeg;

        const earthDistM = worldX * earthDirX + worldY * earthDirY;
        const localEarthElevDeg =
          -subEarthLatDeg + (earthDistM / MOON_RADIUS_M) * 57.29577951308232;
        const earthHorizonDeg =
          localEarthElevDeg > 0.0
            ? computeDirectionalHorizonDeg(worldX, worldY, elev, earthDirX, earthDirY, mapExtentM)
            : 90.0;
        const isEarthBlocked = localEarthElevDeg <= 0.0 || localEarthElevDeg <= earthHorizonDeg;

        let riskScore = 0;
        if (slopeDeg >= 15) riskScore += 55;
        else if (slopeDeg >= 10) riskScore += 28;
        else riskScore += (slopeDeg / 10) * 15;

        if (isSunShadowed) riskScore += 32;
        if (isEarthBlocked) riskScore += 25;
        const rNorm = Math.max(0, Math.min(1, riskScore / 95));

        if (rNorm < 0.35) {
          // Favorable (Emerald -> Cyan)
          const u = rNorm / 0.35;
          r = Math.round(16 + u * 18);
          g = Math.round(185 + u * 26);
          b = Math.round(129 + u * 109);
        } else if (rNorm < 0.68) {
          // Conditional (Cyan -> Amber)
          const u = (rNorm - 0.35) / 0.33;
          r = Math.round(34 + u * 211);
          g = Math.round(211 - u * 53);
          b = Math.round(238 - u * 227);
        } else {
          // Challenging / High Hazard (Amber -> Rose)
          const u = (rNorm - 0.68) / 0.32;
          r = Math.round(245 - u * 6);
          g = Math.round(158 - u * 105);
          b = Math.round(11 + u * 75);
        }
        r = Math.round(r * (0.65 + shade * 0.35));
        g = Math.round(g * (0.65 + shade * 0.35));
        b = Math.round(b * (0.65 + shade * 0.35));
      } else {
        const clampedElev = Math.max(LUT_MIN_ELEV, Math.min(LUT_MAX_ELEV, Math.round(elev)));
        const lutIdx = (clampedElev - LUT_MIN_ELEV) * 3;
        r = Math.min(255, (RAMP_LUT[lutIdx] * shade) | 0);
        g = Math.min(255, (RAMP_LUT[lutIdx + 1] * shade) | 0);
        b = Math.min(255, (RAMP_LUT[lutIdx + 2] * shade) | 0);
      }

      if ((showSlopeHazard || renderMode === 'slope') && slopeDeg > 15.0 && renderMode !== 'risk') {
        r = (r * 0.52 + 239 * 0.48) | 0;
        g = (g * 0.52 + 68 * 0.48) | 0;
        b = (b * 0.52 + 68 * 0.48) | 0;
      }

      const bMajC = Math.floor(elev / majorInterval);
      const isMajor =
        bMajC !== Math.floor(zE / majorInterval) ||
        bMajC !== Math.floor(zS / majorInterval);

      if (isMajor) {
        r = (r * 0.58 + 250 * 0.42) | 0;
        g = (g * 0.58 + 204 * 0.42) | 0;
        b = (b * 0.58 + 21 * 0.42) | 0;
      } else {
        const bMinC = Math.floor(elev / minorInterval);
        const isMinor =
          bMinC !== Math.floor(zE / minorInterval) ||
          bMinC !== Math.floor(zS / minorInterval);
        if (isMinor) {
          r = (r * 0.8 + 226 * 0.2) | 0;
          g = (g * 0.8 + 232 * 0.2) | 0;
          b = (b * 0.8 + 240 * 0.2) | 0;
        }
      }

      const idx = (py * tileSize + px) * 4;
      pixelData[idx] = r;
      pixelData[idx + 1] = g;
      pixelData[idx + 2] = b;
      pixelData[idx + 3] = 255;
    }
  }

  self.postMessage(
    {
      type: 'TILE_RENDERED',
      requestId,
      pixelBuffer: pixelData.buffer,
      payload: {
        tileKey,
        tileSize,
        rgbaBuffer: pixelData.buffer,
      },
    },
    [pixelData.buffer]
  );
}

function processMessage(data) {
  const { type, payload } = data;
  if (type === 'EXTRACT_CONTOUR_GRID') {
    handleExtractContourGrid(payload || data);
  } else if (type === 'PROBE_POINT') {
    const p = payload || data;
    const res = computeSlopeAtMeters(p.xMeters || 0, p.yMeters || 0, 400, p.halfExtentM || HALF_EXTENT_M);
    self.postMessage({
      type: 'PROBE_RESULT',
      payload: res,
    });
  } else if (type === 'RENDER_TILE') {
    handleRenderTile(payload || data);
  }
}

export function initWorkerDemBuffer(buffer, size = null, scale = DEM_SCALE_M) {
  demGrid = buffer instanceof Int16Array ? buffer : new Int16Array(buffer);
  demSize = size || Math.round(Math.sqrt(demGrid.length));
  demScale = Number.isFinite(scale) && scale > 0 ? scale : DEM_SCALE_M;
}

export {
  sampleElevation,
  sampleElevationAtMeters,
  computeSlopeAtMeters,
  computePsrClearanceAtMeters,
  computeDirectionalHorizonDeg,
};

if (typeof self !== 'undefined') {
  self.onmessage = async (e) => {
    const data = e.data || {};
    const { type, payload } = data;

    if (type === 'INIT_DEM') {
      const p = payload || data;
      if (p.buffer) {
        demGrid = new Int16Array(p.buffer);
        demSize = p.size || Math.round(Math.sqrt(demGrid.length));
        demScale = Number.isFinite(p.scale) && p.scale > 0 ? p.scale : DEM_SCALE_M;
        self.postMessage({ type: 'DEM_READY', payload: { size: demSize } });
        while (pendingMessages.length > 0) {
          processMessage(pendingMessages.shift());
        }
        return;
      }
      try {
        await ensureDemLoaded(p.demUrl);
        self.postMessage({ type: 'DEM_READY', payload: { size: demSize } });
        while (pendingMessages.length > 0) {
          processMessage(pendingMessages.shift());
        }
      } catch (err) {
        self.postMessage({
          type: 'WORKER_ERROR',
          payload: { message: err?.message || 'Failed to load LOLA South Pole DEM' },
        });
      }
      return;
    }

    if (!demGrid || demSize <= 0) {
      pendingMessages.push(data);
      const demUrl = payload?.demUrl || data?.demUrl || '/data/lola_sp_80s_int16.bin';
      ensureDemLoaded(demUrl)
        .then(() => {
          while (pendingMessages.length > 0) {
            processMessage(pendingMessages.shift());
          }
        })
        .catch(() => {});
      return;
    }

    processMessage(data);
  };
}
