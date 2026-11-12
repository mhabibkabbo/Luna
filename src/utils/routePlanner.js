import {
  sampleDemMeters,
  computeHornSlopeAtMeters,
  computeDemHorizonProfile,
  latLonToStereoMeters,
  ensurePolarDemLoaded,
} from './horizons.js';
import { computeCelestialState, solarPosition } from './lunarEphemeris.js';

export const DEM_SIZE = 1520;
export const DEM_HALF_EXTENT_M = 304000;
export const CELL_SIZE_M = (2 * DEM_HALF_EXTENT_M) / (DEM_SIZE - 1);
export const LUNAR_RADIUS_M = 1737400;

export const DEFAULT_ROVER_CONFIG = {
  maxSlopeDeg: 15.0, // Hard tip-over hazard threshold (15°)
  roverSpeedKmh: 0.15, // Nominal VIPER / Artemis LTV roving speed ~150 m/h (0.15 km/h)
  avoidPsr: false, // If true, applies heavy penalty for entering permanently shadowed cold-traps
  weightSlope: 3.5, // Energy expenditure penalty exponent / factor
  stepHours: 1.0, // Time step for illumination sampling along traverse
};

class PriorityQueue {
  constructor() {
    this.heap = [];
  }

  push(val, priority) {
    this.heap.push({ val, priority });
    this._bubbleUp(this.heap.length - 1);
  }

  pop() {
    if (this.heap.length === 0) return null;
    const top = this.heap[0];
    const bottom = this.heap.pop();
    if (this.heap.length > 0) {
      this.heap[0] = bottom;
      this._bubbleDown(0);
    }
    return top.val;
  }

  isEmpty() {
    return this.heap.length === 0;
  }

  _bubbleUp(i) {
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this.heap[i].priority < this.heap[p].priority) {
        const tmp = this.heap[i];
        this.heap[i] = this.heap[p];
        this.heap[p] = tmp;
        i = p;
      } else break;
    }
  }

  _bubbleDown(i) {
    const len = this.heap.length;
    while (true) {
      const left = (i << 1) + 1;
      const right = left + 1;
      let smallest = i;
      if (left < len && this.heap[left].priority < this.heap[smallest].priority) {
        smallest = left;
      }
      if (right < len && this.heap[right].priority < this.heap[smallest].priority) {
        smallest = right;
      }
      if (smallest !== i) {
        const tmp = this.heap[i];
        this.heap[i] = this.heap[smallest];
        this.heap[smallest] = tmp;
        i = smallest;
      } else break;
    }
  }
}

/**
 * Converts polar stereographic meters (x, y) to integer DEM grid indices [gx, gy].
 */
export function stereoMetersToGrid(xMeters, yMeters) {
  const u = (xMeters + DEM_HALF_EXTENT_M) / (2 * DEM_HALF_EXTENT_M);
  const v = (DEM_HALF_EXTENT_M - yMeters) / (2 * DEM_HALF_EXTENT_M);
  const gx = Math.round(u * (DEM_SIZE - 1));
  const gy = Math.round(v * (DEM_SIZE - 1));
  return {
    gx: Math.max(0, Math.min(DEM_SIZE - 1, gx)),
    gy: Math.max(0, Math.min(DEM_SIZE - 1, gy)),
  };
}

/**
 * Converts integer DEM grid indices [gx, gy] to polar stereographic meters (x, y).
 */
export function gridToStereoMeters(gx, gy) {
  const x = (gx / (DEM_SIZE - 1)) * (2 * DEM_HALF_EXTENT_M) - DEM_HALF_EXTENT_M;
  const y = DEM_HALF_EXTENT_M - (gy / (DEM_SIZE - 1)) * (2 * DEM_HALF_EXTENT_M);
  return { x, y };
}

/**
 * Inverse projection: South Polar Stereographic (x, y) meters -> Selenographic (lat, lon) in degrees.
 */
export function stereoMetersToLatLonDeg(x, y) {
  const r = Math.hypot(x, y);
  if (r === 0) return { lat: -90, lon: 0 };
  const lonRad = Math.atan2(x, y);
  let lon = (lonRad * 180) / Math.PI;
  if (lon > 180) lon -= 360;
  if (lon < -180) lon += 360;

  // Inverse stereographic projection for sphere:
  // r = 2 * R * cos(lat) / (1 + sin(|lat|)) = 2 * R * tan((90 - |lat|) / 2)
  const c = 2 * Math.atan(r / (2 * LUNAR_RADIUS_M));
  const lat = -((Math.PI / 2 - c) * 180) / Math.PI;
  return { lat, lon };
}

/**
 * Computes an optimal, slope-constrained rover route between two points on the LOLA DEM.
 *
 * @param {Object} start - Start point { lat, lon }
 * @param {Object} goal - Goal point { lat, lon }
 * @param {Object} [options]
 * @param {number} [options.maxSlopeDeg=15] - Maximum traversable slope limit (degrees)
 * @param {number} [options.weightSlope=3.5] - Slope cost multiplier
 * @param {boolean} [options.avoidPsr=false] - Whether to heavily penalize permanently shadowed regions
 * @returns {Promise<{
 *   success: boolean,
 *   reason?: string,
 *   waypoints: Array<{ lat: number, lon: number, xM: number, yM: number, elevationM: number, slopeDeg: number, cumulativeDistKm: number }>,
 *   totalDistanceKm: number,
 *   maxSlopeDeg: number,
 *   meanSlopeDeg: number,
 *   minElevationM: number,
 *   maxElevationM: number,
 *   elevationChangeM: number
 * }>}
 */
export async function computeSurfaceRoute(start, goal, options = {}) {
  await ensurePolarDemLoaded();

  const maxSlope = options.maxSlopeDeg ?? DEFAULT_ROVER_CONFIG.maxSlopeDeg;
  const maxSlopeTan = Math.tan((maxSlope * Math.PI) / 180);
  const weightSlope = options.weightSlope ?? DEFAULT_ROVER_CONFIG.weightSlope;

  // Verify coordinates are within 80°S-90°S coverage
  if (start.lat > -79.9 || goal.lat > -79.9) {
    return {
      success: false,
      reason: 'Coordinates outside high-resolution LOLA South Pole DEM coverage (80°S–90°S).',
      waypoints: [],
      totalDistanceKm: 0,
    };
  }

  const startStereo = latLonToStereoMeters(start.lat, start.lon);
  const goalStereo = latLonToStereoMeters(goal.lat, goal.lon);

  const startGrid = stereoMetersToGrid(startStereo.x, startStereo.y);
  const goalGrid = stereoMetersToGrid(goalStereo.x, goalStereo.y);

  const startIdx = startGrid.gy * DEM_SIZE + startGrid.gx;
  const goalIdx = goalGrid.gy * DEM_SIZE + goalGrid.gx;

  if (startIdx === goalIdx) {
    const elev = sampleDemMeters(startStereo.x, startStereo.y) ?? 0;
    const slope = computeHornSlopeAtMeters(startStereo.x, startStereo.y)?.slopeDeg ?? 0;
    return {
      success: true,
      waypoints: [
        {
          lat: start.lat,
          lon: start.lon,
          xM: startStereo.x,
          yM: startStereo.y,
          elevationM: Math.round(elev),
          slopeDeg: Math.round(slope * 10) / 10,
          cumulativeDistKm: 0,
        },
      ],
      totalDistanceKm: 0,
      maxSlopeDeg: slope,
      meanSlopeDeg: slope,
      minElevationM: elev,
      maxElevationM: elev,
      elevationChangeM: 0,
    };
  }

  const dist = new Map();
  const parent = new Map();
  const openSet = new PriorityQueue();

  dist.set(startIdx, 0);
  const h0 = Math.hypot(goalGrid.gx - startGrid.gx, goalGrid.gy - startGrid.gy) * CELL_SIZE_M;
  openSet.push(startIdx, h0);

  const dx = [1, -1, 0, 0, 1, -1, 1, -1];
  const dy = [0, 0, 1, -1, 1, 1, -1, -1];
  const stepDist = [
    CELL_SIZE_M,
    CELL_SIZE_M,
    CELL_SIZE_M,
    CELL_SIZE_M,
    CELL_SIZE_M * Math.SQRT2,
    CELL_SIZE_M * Math.SQRT2,
    CELL_SIZE_M * Math.SQRT2,
    CELL_SIZE_M * Math.SQRT2,
  ];

  let reached = false;
  let iterations = 0;
  const maxIterations = 200000;

  while (!openSet.isEmpty()) {
    const curr = openSet.pop();
    if (curr === goalIdx) {
      reached = true;
      break;
    }

    iterations++;
    if (iterations > maxIterations) break;

    const cx = curr % DEM_SIZE;
    const cy = Math.floor(curr / DEM_SIZE);
    const currStereo = gridToStereoMeters(cx, cy);
    const currZ = sampleDemMeters(currStereo.x, currStereo.y);
    if (currZ === null) continue;

    const currentG = dist.get(curr);

    for (let k = 0; k < 8; k++) {
      const nx = cx + dx[k];
      const ny = cy + dy[k];
      if (nx < 0 || nx >= DEM_SIZE || ny < 0 || ny >= DEM_SIZE) continue;

      const nidx = ny * DEM_SIZE + nx;
      const nextStereo = gridToStereoMeters(nx, ny);
      const nextZ = sampleDemMeters(nextStereo.x, nextStereo.y);
      if (nextZ === null) continue;

      const dM = stepDist[k];
      const dz = Math.abs(nextZ - currZ);
      const stepSlopeTan = dz / dM;

      if (stepSlopeTan > maxSlopeTan) continue;

      const slopeCostFactor = 1.0 + weightSlope * Math.pow(stepSlopeTan / maxSlopeTan, 2);
      const stepCost = dM * slopeCostFactor;
      const tentG = currentG + stepCost;

      const prevG = dist.get(nidx);
      if (prevG === undefined || tentG < prevG) {
        dist.set(nidx, tentG);
        parent.set(nidx, curr);
        const h = Math.hypot(goalGrid.gx - nx, goalGrid.gy - ny) * CELL_SIZE_M;
        openSet.push(nidx, tentG + h);
      }
    }
  }

  if (!reached) {
    return {
      success: false,
      reason: `No safe rover path found below ${maxSlope}° maximum slope constraint. Terrain impassable or blocked by steep crater walls.`,
      waypoints: [],
      totalDistanceKm: 0,
    };
  }

  const pathIndices = [];
  let curr = goalIdx;
  while (curr !== undefined) {
    pathIndices.push(curr);
    curr = parent.get(curr);
  }
  pathIndices.reverse();

  const rawWaypoints = [];
  let cumDistM = 0;
  let maxObservedSlope = 0;
  let totalSlope = 0;
  let minElev = Infinity;
  let maxElev = -Infinity;

  for (let i = 0; i < pathIndices.length; i++) {
    const idx = pathIndices[i];
    const gx = idx % DEM_SIZE;
    const gy = Math.floor(idx / DEM_SIZE);
    const stereo = gridToStereoMeters(gx, gy);
    const latLon = stereoMetersToLatLonDeg(stereo.x, stereo.y);
    const elev = sampleDemMeters(stereo.x, stereo.y) ?? 0;
    const slopeData = computeHornSlopeAtMeters(stereo.x, stereo.y);
    const slope = slopeData?.slopeDeg ?? 0;

    let stepSlopeDeg = 0;
    if (i > 0) {
      const prev = rawWaypoints[i - 1];
      const dStep = Math.hypot(stereo.x - prev.xM, stereo.y - prev.yM);
      cumDistM += dStep;
      const dz = Math.abs(elev - prev.elevationM);
      stepSlopeDeg = (Math.atan2(dz, dStep) * 180) / Math.PI;
    }

    if (stepSlopeDeg > maxObservedSlope) maxObservedSlope = stepSlopeDeg;
    totalSlope += stepSlopeDeg;
    if (elev < minElev) minElev = elev;
    if (elev > maxElev) maxElev = elev;

    rawWaypoints.push({
      lat: Math.round(latLon.lat * 100000) / 100000,
      lon: Math.round(latLon.lon * 100000) / 100000,
      xM: Math.round(stereo.x),
      yM: Math.round(stereo.y),
      elevationM: Math.round(elev),
      slopeDeg: Math.round(stepSlopeDeg * 10) / 10,
      cumulativeDistKm: Math.round((cumDistM / 1000) * 100) / 100,
    });
  }

  if (rawWaypoints.length > 0) {
    rawWaypoints[0].lat = start.lat;
    rawWaypoints[0].lon = start.lon;
    rawWaypoints[rawWaypoints.length - 1].lat = goal.lat;
    rawWaypoints[rawWaypoints.length - 1].lon = goal.lon;
  }

  const totalDistanceKm = Math.round((cumDistM / 1000) * 100) / 100;

  return {
    success: true,
    waypoints: rawWaypoints,
    totalDistanceKm,
    maxSlopeDeg: Math.round(maxObservedSlope * 10) / 10,
    meanSlopeDeg: Math.round((totalSlope / Math.max(1, rawWaypoints.length)) * 10) / 10,
    minElevationM: Math.round(minElev),
    maxElevationM: Math.round(maxElev),
    elevationChangeM: Math.round(maxElev - minElev),
  };
}

/**
 * Evaluates real-time / scheduled solar illumination along the computed rover traverse.
 *
 * Discretizes the route into time-stamped schedule steps based on rover speed,
 * then checks solar disk elevation relative to local 360° terrain horizon ray-marching.
 *
 * @param {Array<Object>} waypoints - Route waypoints from computeSurfaceRoute
 * @param {Object} [options]
 * @param {number} [options.startEpochMs=Date.now()] - Mission start UTC timestamp
 * @param {number} [options.roverSpeedKmh=0.15] - Average roving speed (km/h)
 * @returns {Array<Object>} Enriched waypoints with illumination status and solar metrics
 */
export function profileRouteIllumination(waypoints, options = {}) {
  if (!waypoints || waypoints.length === 0) return [];

  const startMs = options.startEpochMs ?? Date.now();
  const speedKmh = Math.max(0.01, options.roverSpeedKmh ?? DEFAULT_ROVER_CONFIG.roverSpeedKmh);

  let prevDistKm = 0;
  let prevMs = startMs;

  return waypoints.map((wp, idx) => {
    const deltaDistKm = wp.cumulativeDistKm - prevDistKm;
    const transitHours = deltaDistKm / speedKmh;
    const epochMs = prevMs + transitHours * 3600000;
    prevDistKm = wp.cumulativeDistKm;
    prevMs = epochMs;

    const celestial = computeCelestialState(epochMs);
    const horizonProfile = computeDemHorizonProfile(wp.lat, wp.lon);

    let sunStatus = 'sunlit';
    let sunElevationDeg = 0;
    let sunAzimuthDeg = 0;
    let terrainHorizonDeg = 0;

    if (celestial && celestial.sun) {
      const flat = solarPosition(celestial, wp.lat, wp.lon);
      sunAzimuthDeg = flat.azimuthDeg;
      sunElevationDeg = flat.elevationDeg;

      if (horizonProfile && horizonProfile.horizon) {
        const azIdx = Math.floor(sunAzimuthDeg) % 360;
        terrainHorizonDeg = horizonProfile.horizon[azIdx >= 0 ? azIdx : azIdx + 360] ?? 0;
      }

      const masked = solarPosition(celestial, wp.lat, wp.lon, terrainHorizonDeg);
      sunStatus = masked.status; // 'sunlit' | 'blocked' | 'night'
    }

    return {
      ...wp,
      epochMs: Math.round(epochMs),
      timeOffsetHours: Math.round((transitHours + (wp.cumulativeDistKm / speedKmh)) * 10) / 10,
      sunStatus, // 'sunlit' | 'blocked' | 'night'
      sunElevationDeg: Math.round(sunElevationDeg * 100) / 100,
      sunAzimuthDeg: Math.round(sunAzimuthDeg * 10) / 10,
      terrainHorizonDeg: Math.round(terrainHorizonDeg * 100) / 100,
    };
  });
}
