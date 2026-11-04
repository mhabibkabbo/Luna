/**
 * @file communicationAnalysis.js
 * Scientifically grounded Direct-to-Earth (DTE) communication analysis system
 * based on NASA LRO LOLA elevation data, NAIF SPICE lunar ephemeris frames,
 * and NASA Deep Space Network (DSN) ground tracking complexes.
 *
 * Distinguishes strictly between:
 *  - NASA Observational Data (PDS LOLA DEM elevations, PDS Radio Science tracking records)
 *  - Physics-Based Calculations (IAU 2009/2015 body-fixed ephemeris, topocentric Earth geometry, terrain horizon intersection)
 *  - Explicitly Modeled Relay Orbits (LRO 50 km polar orbit, EML-2 Southern Halo orbit)
 *
 * Never generates fabricated dBm signal measurements or artificial curves.
 */

import {
  computeCelestialState,
  MOON_RADIUS_KM,
  EARTH_MEAN_RADIUS_KM,
} from './lunarEphemeris.js';
import {
  horizonAt,
  HORIZON_TABLE,
  sampleDemMeters,
  latLonToStereoMeters,
  ensurePolarDemLoaded,
} from './horizons.js';
import { earthLookFromMoon, DEFAULT_DTE_CONSTRAINTS } from './earthLink.js';
import { computeCommunicationLink } from './communication.js';

const DEG = Math.PI / 180;
const RAD = 180 / Math.PI;

// Gravitational parameter for the Moon (km^3 / s^2) - NASA JPL DE421 / LRO GGM02
const MU_MOON_KM3_S2 = 4902.800066;

/**
 * Official NASA Dataset Provenance and Reference Information
 */
export const COMMUNICATION_DATA_SOURCES = Object.freeze({
  LOLA_DEM: {
    name: 'NASA Lunar Reconnaissance Orbiter (LRO) LOLA Polar DEM',
    product: 'LOLA GDR Polar Stereographic 80°S–90°S (400 m/pixel)',
    pdsNode: 'PDS Geosciences Node (Washington University in St. Louis)',
    verticalDatum: 'IAU Lunar Reference Sphere (R₀ = 1,737,400.0 m)',
    verticalAccuracy: '±1.0 m absolute, ±0.1–0.3 m relative precision',
    horizontalAccuracy: '±20 m orbital reconstruction precision',
    citation: 'Smith, D. E., et al. (2010, 2017). Summary of the results from the Lunar Orbiter Laser Altimeter (LOLA). Icarus, 283, 70-91.',
    url: 'https://pds-geosciences.wustl.edu/missions/lro/lola.htm',
  },
  SPICE_EPHEMERIS: {
    name: 'NAIF SPICE Ephemeris & Planetary Reference Frames',
    kernelTypes: 'SPK (DE421 / DE430 Planetary Ephemeris), PCK (IAU/IAG WGCCRE 2009/2015 Lunar Orientation)',
    frame: 'MOON_ME (Mean-Earth / Polar Axis Body-Fixed Frame)',
    accuracy: '< 1 arcminute lunar geocentric vector, ~0.001° body orientation',
    citation: 'Archinal, B. A., et al. (2011). Report of the IAU/IAG Working Group on Cartographic Coordinates and Rotational Elements: 2009. Celest Mech Dyn Astr 109, 101–135.',
    url: 'https://naif.jpl.nasa.gov/naif/data.html',
  },
  DSN_NETWORK: {
    name: 'NASA Deep Space Network (DSN)',
    complexes: 'Goldstone (California), Madrid (Spain), Canberra (Australia)',
    stations: '34m Beam Waveguide (BWG) & 70m High-Gain Antenna Networks',
    elevationMask: '10.0° minimum ground station elevation above local Earth horizon',
    citation: 'NASA Jet Propulsion Laboratory, DSN Telecommunications Link Design Handbook (810-005).',
    url: 'https://eyes.nasa.gov/dsn/dsn.html',
  },
  RADIO_SCIENCE: {
    name: 'NASA LRO Radio Science Subsystem (RSS) Archival Baseline',
    archive: 'NASA PDS Geosciences Node LRO-L-RSS-1/2/3/4-RAW/EDR/RDR/DDT V1.0',
    frequencyBands: 'S-Band (2.2 GHz) and X-Band (8.4 GHz) coherent Doppler tracking',
    methodologyNote: 'Historical radio-science tracking data confirms line-of-sight acquisition and occultation timestamps. Displayed communication availability is derived from geometric line-of-sight physics rather than fabricated RF signal measurements.',
    url: 'https://pds.nasa.gov/',
  },
});

/**
 * Standard Lunar Relay Satellite Orbital Configurations
 */
export const LUNAR_RELAYS = Object.freeze({
  NONE: {
    id: 'none',
    name: 'Direct-to-Earth Only (No Relay)',
    description: 'Relies solely on direct line of sight between the lunar surface and Earth.',
    altitudeKm: 0,
    orbitType: 'Surface',
  },
  LRO: {
    id: 'lro',
    name: 'NASA LRO Orbital Pass (50 km Polar)',
    description: 'NASA Lunar Reconnaissance Orbiter in ~50 km circular polar orbit (period ~113.3 min, inclination 90°). Provides periodic overhead contact passes.',
    altitudeKm: 50,
    semiMajorAxisKm: MOON_RADIUS_KM + 50,
    periodSec: 2 * Math.PI * Math.sqrt(Math.pow(MOON_RADIUS_KM + 50, 3) / MU_MOON_KM3_S2),
    inclinationDeg: 90.0,
    orbitType: 'Low Lunar Orbit (LLO)',
  },
  EML2_HALO: {
    id: 'eml2_halo',
    name: 'Artemis EML-2 Southern Halo Relay',
    description: 'Southern Earth-Moon L2 Halo / Near-Rectilinear Halo Orbit (Gateway baseline). Hovers over the lunar South Pole with continuous line-of-sight coverage ~85–92% of the orbit.',
    altitudeKm: 70000,
    semiMajorAxisKm: 71737,
    periodSec: 6.5 * 86400, // ~6.5 day orbital period
    inclinationDeg: 85.0,
    orbitType: 'Halo Orbit (EML-2)',
  },
});

/**
 * Retrieves the actual surface elevation (meters) from the LOLA South Pole DEM.
 * Returns null if the coordinate is north of 80°S (outside high-res DEM extent).
 */
export function getSurfaceElevationM(latDeg, lonDeg) {
  if (!Number.isFinite(latDeg) || !Number.isFinite(lonDeg)) return null;
  if (latDeg > -80.0) return null;

  ensurePolarDemLoaded();
  const { x, y } = latLonToStereoMeters(latDeg, lonDeg);
  return sampleDemMeters(x, y);
}

/**
 * Computes the terrain obstacle horizon angle (degrees above local tangent plane)
 * at a given azimuth for a lunar location.
 */
export function getTerrainHorizonAngleDeg(latDeg, lonDeg, azimuthDeg, siteId = null) {
  if (!Number.isFinite(azimuthDeg)) return 0;
  const horizon = horizonAt(HORIZON_TABLE, siteId, azimuthDeg, latDeg, lonDeg);
  return horizon !== null ? horizon : 0;
}

/**
 * Calculates 3D Cartesian position vector of a point on the lunar surface
 * in the Moon body-fixed frame (km).
 */
export function lunarSurfacePositionKm(latDeg, lonDeg, elevationM = 0) {
  const lat = latDeg * DEG;
  const lon = lonDeg * DEG;
  const radiusKm = MOON_RADIUS_KM + (elevationM || 0) / 1000;
  return [
    radiusKm * Math.cos(lat) * Math.cos(lon),
    radiusKm * Math.cos(lat) * Math.sin(lon),
    radiusKm * Math.sin(lat),
  ];
}

/**
 * Evaluates the line of sight between an orbital relay satellite and Earth.
 * Checks whether the Moon body (radius 1737.4 km) geometrically occults Earth from the satellite.
 *
 * @param {number[]} satPosKm - Satellite position in Moon body-fixed frame
 * @param {number[]} earthPosKm - Earth position in Moon body-fixed frame
 * @returns {boolean} True if line of sight to Earth is unobstructed
 */
function isSatEarthClear(satPosKm, earthPosKm) {
  const ray = [
    earthPosKm[0] - satPosKm[0],
    earthPosKm[1] - satPosKm[1],
    earthPosKm[2] - satPosKm[2],
  ];
  const rayLen = Math.hypot(...ray);
  if (rayLen === 0) return true;
  const rayDir = [ray[0] / rayLen, ray[1] / rayLen, ray[2] / rayLen];

  // Vector from Moon center (0,0,0) to satellite
  const toSat = satPosKm;
  // Projection of Moon center onto ray
  const t = -(toSat[0] * rayDir[0] + toSat[1] * rayDir[1] + toSat[2] * rayDir[2]);

  // If closest approach is behind satellite or beyond Earth, Moon body is not between them
  if (t <= 0 || t >= rayLen) return true;

  // Closest approach distance squared from Moon center
  const dSq =
    Math.pow(toSat[0] + t * rayDir[0], 2) +
    Math.pow(toSat[1] + t * rayDir[1], 2) +
    Math.pow(toSat[2] + t * rayDir[2], 2);

  // If closest approach is greater than Moon radius, line of sight is clear
  return dSq > MOON_RADIUS_KM * MOON_RADIUS_KM;
}

/**
 * Computes position of LRO or EML-2 relay in Moon body-fixed frame (km) at time t.
 */
export function computeRelayPositionKm(relayType, timeMs) {
  if (relayType === 'lro') {
    const lro = LUNAR_RELAYS.LRO;
    const tSec = timeMs / 1000;
    // Mean motion
    const n = (2 * Math.PI) / lro.periodSec;
    // Argument of latitude
    const u = (n * tSec) % (2 * Math.PI);
    // Lunar sidereal rotation rate (approx 1 rev per 27.32166 days)
    const moonRotRate = (2 * Math.PI) / (27.32166 * 86400);
    // Node precession / body rotation in Moon body-fixed frame
    const omega = (-moonRotRate * tSec) % (2 * Math.PI);

    const a = lro.semiMajorAxisKm;
    // Circular polar orbit in Moon-fixed coordinates
    return [
      a * Math.cos(u) * Math.cos(omega),
      a * Math.cos(u) * Math.sin(omega),
      a * Math.sin(u),
    ];
  }

  if (relayType === 'eml2_halo') {
    const halo = LUNAR_RELAYS.EML2_HALO;
    const tSec = timeMs / 1000;
    const n = (2 * Math.PI) / halo.periodSec;
    const phase = (n * tSec) % (2 * Math.PI);

    // EML-2 halo orbit hovers predominantly south of the Moon (+X toward Earth, +Z toward North)
    // Halo trajectory extends -Z into southern hemisphere (-15,000 to -45,000 km)
    const x = -61350 + 8000 * Math.cos(phase); // On farside of Moon at L2 (~61,350 km behind Moon)
    const y = 14000 * Math.sin(phase);
    const z = -28000 + 12000 * Math.sin(phase); // Hovering high over South Pole
    return [x, y, z];
  }

  return null;
}

/**
 * Evaluates whether a surface site can communicate with an orbital relay satellite.
 */
export function evaluateRelayVisibility({
  latDeg,
  lonDeg,
  elevationM = 0,
  relayType = 'lro',
  timeMs,
  state,
}) {
  if (!relayType || relayType === 'none') {
    return { isRelayAvailable: false, reason: 'Relay model disabled' };
  }

  const satPosKm = computeRelayPositionKm(relayType, timeMs);
  if (!satPosKm) return { isRelayAvailable: false, reason: 'Invalid relay configuration' };

  const sitePosKm = lunarSurfacePositionKm(latDeg, lonDeg, elevationM);

  // Vector from surface site to relay
  const toSat = [
    satPosKm[0] - sitePosKm[0],
    satPosKm[1] - sitePosKm[1],
    satPosKm[2] - sitePosKm[2],
  ];
  const satDistKm = Math.hypot(...toSat);
  if (satDistKm === 0) return { isRelayAvailable: false, reason: 'Coincident position' };

  // Local site surface normal (Up vector)
  const lat = latDeg * DEG;
  const lon = lonDeg * DEG;
  const up = [Math.cos(lat) * Math.cos(lon), Math.cos(lat) * Math.sin(lon), Math.sin(lat)];
  const east = [-Math.sin(lon), Math.cos(lon), 0];
  const north = [-Math.sin(lat) * Math.cos(lon), -Math.sin(lat) * Math.sin(lon), Math.cos(lat)];

  const satDir = [toSat[0] / satDistKm, toSat[1] / satDistKm, toSat[2] / satDistKm];
  const sinEl = up[0] * satDir[0] + up[1] * satDir[1] + up[2] * satDir[2];
  const satElevDeg = Math.asin(Math.max(-1, Math.min(1, sinEl))) * RAD;

  const satAzDeg =
    (((Math.atan2(
      east[0] * satDir[0] + east[1] * satDir[1] + east[2] * satDir[2],
      north[0] * satDir[0] + north[1] * satDir[1] + north[2] * satDir[2]
    ) *
      RAD) %
      360) +
      360) %
    360;

  // Check terrain horizon toward relay
  const terrainMaskDeg = getTerrainHorizonAngleDeg(latDeg, lonDeg, satAzDeg);
  const isSiteToSatClear = satElevDeg > terrainMaskDeg && satElevDeg > 5.0; // 5 deg lander antenna elevation mask

  if (!isSiteToSatClear) {
    return {
      isRelayAvailable: false,
      reason: satElevDeg <= 0 ? 'Relay below lunar horizon' : 'Relay blocked by local terrain ridge',
      satElevDeg,
      satDistKm,
    };
  }

  // Check relay to Earth line of sight
  const earthPosKm = state.earth.dir.map((v) => v * state.earth.distanceKm);
  const isSatToEarthClear = isSatEarthClear(satPosKm, earthPosKm);

  if (!isSatToEarthClear) {
    return {
      isRelayAvailable: false,
      reason: 'Relay occulted by Moon body from Earth',
      satElevDeg,
      satDistKm,
    };
  }

  return {
    isRelayAvailable: true,
    reason: 'Relay contact active',
    satElevDeg,
    satDistKm,
    relayName: LUNAR_RELAYS[relayType.toUpperCase()]?.name || relayType,
  };
}

/**
 * Evaluates the instantaneous Direct-to-Earth communication state
 * for a specific lunar coordinate at a given epoch.
 *
 * @param {object} params
 * @param {number} params.lat - Latitude (-90 to +90)
 * @param {number} params.lon - Longitude (-180 to +180)
 * @param {number} [params.elevationM] - Surface elevation in meters (from LOLA DEM)
 * @param {number} params.timeMs - UTC epoch milliseconds
 * @param {object|null} [params.earthStation] - Target DSN ground station or null for Earth center
 * @param {object} [params.constraints] - Slew and elevation constraints
 * @param {string} [params.relayType] - 'none' | 'lro' | 'eml2_halo'
 * @param {string} [params.siteId] - Precomputed horizon profile ID if known
 */
export function evaluateDteInstantaneous({
  lat,
  lon,
  elevationM = null,
  timeMs,
  earthStation = null,
  constraints = DEFAULT_DTE_CONSTRAINTS,
  relayType = 'none',
  siteId = null,
}) {
  const normLat = Math.max(-90, Math.min(90, Number(lat) || 0));
  const normLon = ((((Number(lon) || 0) + 180) % 360) + 360) % 360 - 180;

  // Retrieve actual elevation from LOLA DEM if not supplied
  const actualElevM =
    elevationM !== null && Number.isFinite(elevationM)
      ? elevationM
      : getSurfaceElevationM(normLat, normLon);

  const state = computeCelestialState(timeMs);
  const moonPoint = {
    id: siteId || `site-${normLat.toFixed(2)}-${normLon.toFixed(2)}`,
    latitude: normLat,
    longitude: normLon,
    elevationM: actualElevM || 0,
  };

  const earthLook = earthLookFromMoon(state, moonPoint);
  let azimuthDeg = earthLook.azimuthDeg;
  let elevationDeg = earthLook.elevationDeg;
  let stationElevationDeg = null;

  if (earthStation) {
    const link = computeCommunicationLink({ moonFeature: moonPoint, earthFeature: earthStation, state });
    azimuthDeg = link.moonAzimuthDeg;
    elevationDeg = link.moonElevationDeg;
    stationElevationDeg = link.earthElevationDeg;
  }

  const radiusDeg = earthLook.radiusDeg; // ~0.95° Earth angular radius
  const terrainMaskDeg = getTerrainHorizonAngleDeg(normLat, normLon, azimuthDeg, siteId);
  const marginDeg = elevationDeg - terrainMaskDeg;

  // Check if location is outside LOLA South Pole DEM coverage
  const hasDemCoverage = normLat <= -80.0;

  // Geometric visibility determination
  let status = 'clear';
  let reason = 'Direct line of sight clear';
  let isTerrainBlocked = false;
  let isBodyBlocked = false;

  // 1. Earth Station Elevation Check (if target station chosen)
  if (earthStation && stationElevationDeg !== null && stationElevationDeg < constraints.stationMinElevationDeg) {
    status = 'blocked';
    reason = `Earth station below ${constraints.stationMinElevationDeg}° DSN mask (${stationElevationDeg.toFixed(1)}°)`;
    isBodyBlocked = true;
  }
  // 2. Earth below local tangent horizon (spherical Moon occultation)
  else if (earthStation ? elevationDeg <= 0 : elevationDeg + radiusDeg <= 0) {
    status = 'blocked';
    reason = 'Earth below local lunar horizon (occulted by Moon)';
    isBodyBlocked = true;
  }
  // 3. Blocked by local terrain ridge (LOLA DEM horizon mask)
  else if (earthStation ? elevationDeg <= terrainMaskDeg : elevationDeg + radiusDeg <= terrainMaskDeg) {
    status = 'blocked';
    reason = `Blocked by lunar terrain (${terrainMaskDeg.toFixed(1)}° obstacle vs ${elevationDeg.toFixed(1)}° Earth el)`;
    isTerrainBlocked = true;
  }
  // 4. Marginal / Grazing terrain obstruction (Earth disc intersects ridge)
  else if (!earthStation && elevationDeg - radiusDeg < terrainMaskDeg) {
    status = 'doubtful';
    reason = `Partial terrain grazing (margin: ${marginDeg >= 0 ? '+' : ''}${marginDeg.toFixed(2)}°)`;
  }

  // 5. Orbital Relay Evaluation (if DTE is blocked or doubtful and relay is enabled)
  let relayEval = null;
  if ((status === 'blocked' || status === 'doubtful') && relayType && relayType !== 'none') {
    relayEval = evaluateRelayVisibility({
      latDeg: normLat,
      lonDeg: normLon,
      elevationM: actualElevM || 0,
      relayType,
      timeMs,
      state,
    });

    if (relayEval.isRelayAvailable) {
      status = 'relay';
      reason = `Relay-assisted link active via ${relayEval.relayName} (sat el: ${relayEval.satElevDeg.toFixed(1)}°)`;
    }
  }

  return {
    timestamp: timeMs,
    date: new Date(timeMs),
    status, // 'clear' (green) | 'blocked' (red) | 'doubtful' (amber) | 'relay' (blue) | 'unavailable' (grey)
    reason,
    elevationDeg,
    azimuthDeg,
    radiusDeg,
    terrainMaskDeg,
    marginDeg,
    stationElevationDeg,
    earthDistanceKm: state.earth.distanceKm,
    oneWayLightTimeSec: state.earth.distanceKm / 299792.458,
    isTerrainBlocked,
    isBodyBlocked,
    hasDemCoverage,
    surfaceElevationM: actualElevM,
    relayEval,
  };
}

/**
 * Runs a multi-day communication availability analysis sweep across a time period.
 * Clusters contiguous time intervals into contact windows and blackout periods.
 *
 * @param {object} params
 * @param {number} params.lat
 * @param {number} params.lon
 * @param {number} [params.elevationM]
 * @param {number} params.startMs - UTC epoch milliseconds
 * @param {number} [params.durationDays=30] - Analysis period (e.g. 7, 14, 30, 60 days)
 * @param {number} [params.stepMinutes=60] - Sampling interval in minutes
 * @param {object|null} [params.earthStation]
 * @param {object} [params.constraints]
 * @param {string} [params.relayType='none']
 * @param {string} [params.siteId]
 * @param {AbortSignal} [params.signal]
 * @param {(progress:number)=>void} [params.onProgress]
 * @returns {Promise<object>} Detailed analysis results and statistics
 */
export async function sweepCommunicationAvailability({
  lat,
  lon,
  elevationM = null,
  startMs,
  durationDays = 30,
  stepMinutes = 60,
  earthStation = null,
  constraints = DEFAULT_DTE_CONSTRAINTS,
  relayType = 'none',
  siteId = null,
  signal,
  onProgress,
}) {
  const normLat = Math.max(-90, Math.min(90, Number(lat) || 0));
  const normLon = ((((Number(lon) || 0) + 180) % 360) + 360) % 360 - 180;
  const actualElevM =
    elevationM !== null && Number.isFinite(elevationM)
      ? elevationM
      : getSurfaceElevationM(normLat, normLon);

  const stepMs = Math.max(10, stepMinutes) * 60000;
  const totalSamples = Math.round((durationDays * 86400000) / stepMs);
  const endMs = startMs + durationDays * 86400000;

  const samples = new Array(totalSamples);
  let clearCount = 0;
  let doubtfulCount = 0;
  let blockedCount = 0;
  let relayCount = 0;
  let terrainBlockedCount = 0;

  const CHUNK_SIZE = 40;

  for (let i = 0; i < totalSamples; i++) {
    if (signal?.aborted) return null;

    const t = startMs + i * stepMs;
    const evalResult = evaluateDteInstantaneous({
      lat: normLat,
      lon: normLon,
      elevationM: actualElevM,
      timeMs: t,
      earthStation,
      constraints,
      relayType,
      siteId,
    });

    samples[i] = evalResult;

    if (evalResult.status === 'clear') clearCount++;
    else if (evalResult.status === 'doubtful') doubtfulCount++;
    else if (evalResult.status === 'relay') relayCount++;
    else if (evalResult.status === 'blocked') {
      blockedCount++;
      if (evalResult.isTerrainBlocked) terrainBlockedCount++;
    }

    if (i % CHUNK_SIZE === 0) {
      if (onProgress) onProgress(i / totalSamples);
      await new Promise((r) => setTimeout(r, 0));
    }
  }

  if (signal?.aborted) return null;

  // Cluster contiguous samples into Contact Windows & Blackout Intervals
  const contactWindows = [];
  const blackoutIntervals = [];

  let currentWindow = null;
  let currentBlackout = null;

  for (let i = 0; i < samples.length; i++) {
    const s = samples[i];
    const isContact = s.status === 'clear' || s.status === 'relay';

    if (isContact) {
      if (!currentWindow) {
        currentWindow = {
          startIndex: i,
          startMs: s.timestamp,
          endMs: s.timestamp + stepMs,
          samples: [s],
          isRelayAssisted: s.status === 'relay',
          maxElevationDeg: s.elevationDeg,
          minMarginDeg: s.marginDeg,
        };
      } else {
        currentWindow.endMs = s.timestamp + stepMs;
        currentWindow.samples.push(s);
        if (s.status === 'relay') currentWindow.isRelayAssisted = true;
        currentWindow.maxElevationDeg = Math.max(currentWindow.maxElevationDeg, s.elevationDeg);
        currentWindow.minMarginDeg = Math.min(currentWindow.minMarginDeg, s.marginDeg);
      }

      // Close open blackout if any
      if (currentBlackout) {
        currentBlackout.durationHours = (currentBlackout.endMs - currentBlackout.startMs) / 3600000;
        blackoutIntervals.push(currentBlackout);
        currentBlackout = null;
      }
    } else {
      if (!currentBlackout) {
        currentBlackout = {
          startIndex: i,
          startMs: s.timestamp,
          endMs: s.timestamp + stepMs,
          samples: [s],
          reason: s.reason,
          isTerrainInduced: s.isTerrainBlocked,
        };
      } else {
        currentBlackout.endMs = s.timestamp + stepMs;
        currentBlackout.samples.push(s);
        if (s.isTerrainBlocked) currentBlackout.isTerrainInduced = true;
      }

      // Close open window if any
      if (currentWindow) {
        currentWindow.durationHours = (currentWindow.endMs - currentWindow.startMs) / 3600000;
        contactWindows.push(currentWindow);
        currentWindow = null;
      }
    }
  }

  // Final flush of remaining intervals
  if (currentWindow) {
    currentWindow.durationHours = (currentWindow.endMs - currentWindow.startMs) / 3600000;
    contactWindows.push(currentWindow);
  }
  if (currentBlackout) {
    currentBlackout.durationHours = (currentBlackout.endMs - currentBlackout.startMs) / 3600000;
    blackoutIntervals.push(currentBlackout);
  }

  const totalHours = totalSamples * (stepMinutes / 60);
  const directAvailableHours = clearCount * (stepMinutes / 60);
  const relayAvailableHours = relayCount * (stepMinutes / 60);
  const totalAvailableHours = directAvailableHours + relayAvailableHours;
  const totalBlackoutHours = (blockedCount + doubtfulCount) * (stepMinutes / 60);

  const directAvailabilityPct = totalHours > 0 ? Math.round((directAvailableHours / totalHours) * 1000) / 10 : 0;
  const totalAvailabilityPct = totalHours > 0 ? Math.round((totalAvailableHours / totalHours) * 1000) / 10 : 0;

  // Find longest continuous blackout
  let longestBlackoutHours = 0;
  let longestBlackout = null;
  for (const b of blackoutIntervals) {
    if (b.durationHours > longestBlackoutHours) {
      longestBlackoutHours = b.durationHours;
      longestBlackout = b;
    }
  }

  // Find next upcoming contact window
  const nowMs = Date.now();
  const nextWindow = contactWindows.find((w) => w.startMs >= startMs) || null;

  // Determine terrain obstruction assessment
  let terrainObstructionStatus = 'Continuous Line of Sight';
  if (directAvailabilityPct === 0) {
    terrainObstructionStatus = normLat > -80.0
      ? 'Geometric Far-Side / Lunar Horizon Occultation'
      : 'Permanent Crater Rim / Ridge Shadow Masking';
  } else if (terrainBlockedCount > 0) {
    terrainObstructionStatus = 'Periodic Terrain Occultation by Crater Rim / Ridge';
  } else if (directAvailabilityPct > 95) {
    terrainObstructionStatus = 'Unobstructed Polar Ridge Crest Line of Sight';
  } else {
    terrainObstructionStatus = 'Libration-Induced Lunar Curvature Occultation';
  }

  return {
    meta: {
      lat: normLat,
      lon: normLon,
      surfaceElevationM: actualElevM,
      startMs,
      endMs,
      durationDays,
      stepMinutes,
      totalSamples,
      relayType,
      earthStation: earthStation?.name || 'Earth Center (Geometric Mean)',
    },
    statistics: {
      directAvailabilityPct,
      totalAvailabilityPct,
      totalAvailableHours: Math.round(directAvailableHours * 10) / 10,
      relayAvailableHours: Math.round(relayAvailableHours * 10) / 10,
      totalBlackoutHours: Math.round(totalBlackoutHours * 10) / 10,
      longestBlackoutHours: Math.round(longestBlackoutHours * 10) / 10,
      windowCount: contactWindows.length,
      nextWindow: nextWindow
        ? {
            startMs: nextWindow.startMs,
            durationHours: Math.round(nextWindow.durationHours * 10) / 10,
            isRelayAssisted: nextWindow.isRelayAssisted,
          }
        : null,
      terrainObstructionStatus,
      isTerrainLimited: terrainBlockedCount > 0,
      terrainBlockedFraction: totalHours > 0 ? Math.round((terrainBlockedCount / totalSamples) * 100) : 0,
    },
    samples,
    contactWindows,
    blackoutIntervals,
  };
}
