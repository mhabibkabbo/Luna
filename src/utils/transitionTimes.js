/**
 * @file transitionTimes.js
 * High-precision calculation of upcoming lunar celestial transitions:
 * - Time until Sunset (end of power generation window) or Sunrise (end of lunar night/shadow)
 * - Time until Earthset (loss of Direct-to-Earth link) or Earthrise (acquisition of signal)
 * - Power generation efficiency metrics for polar (vertical array) and planar arrays
 */

import { computeCelestialState, solarPosition } from './lunarEphemeris.js';
import { evaluateEarthLink, DEFAULT_DTE_CONSTRAINTS } from './earthLink.js';
import { horizonAt, HORIZON_TABLE } from './horizons.js';

const MINUTE_MS = 60000;
const HOUR_MS = 3600000;
const DAY_MS = 86400000;

/**
 * Formats a duration in milliseconds into a concise, readable string.
 * e.g. "14d 6h 25m" or "3h 42m" or "< 1m"
 */
export function formatDuration(ms) {
  if (ms <= 0 || !Number.isFinite(ms)) return 'Now';
  const totalMin = Math.round(ms / MINUTE_MS);
  const days = Math.floor(totalMin / 1440);
  const hours = Math.floor((totalMin % 1440) / 60);
  const minutes = totalMin % 60;

  if (days > 0) {
    return `${days}d ${hours}h ${minutes}m`;
  }
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

/**
 * Calculates the next solar transition (Sunset if currently lit, Sunrise if currently dark).
 * Uses step sampling across 35 days (one full synodic lunation) followed by bisection.
 *
 * @param {number} currentTimeMs
 * @param {number} latitude - Selenographic latitude (-90 to +90)
 * @param {number} longitude - Selenographic longitude (-180 to +180)
 * @param {string|null} siteId - Feature id for LOLA DEM lookup
 * @returns {object} Solar transition & power generation report
 */
export function calculateSolarTransition(currentTimeMs, latitude, longitude, siteId = null) {
  const getHz = (az) => (siteId ? horizonAt(HORIZON_TABLE, siteId, az) ?? 0 : 0);

  // 1. Current State
  const currentState = computeCelestialState(currentTimeMs);
  const currentFlat = solarPosition(currentState, latitude, longitude);
  const currentHz = getHz(currentFlat.azimuthDeg);
  const currentSun = solarPosition(currentState, latitude, longitude, currentHz);
  const isCurrentlySunlit = currentSun.status === 'sunlit';

  // 2. Scan forward up to 35 days (1.2 synodic months)
  const maxScanDays = 35;
  const stepMin = 30; // 30-minute coarse steps
  const stepMs = stepMin * MINUTE_MS;
  const maxSteps = Math.round((maxScanDays * DAY_MS) / stepMs);

  let transitionBracket = null;
  let prevStatus = isCurrentlySunlit;

  for (let step = 1; step <= maxSteps; step++) {
    const t = currentTimeMs + step * stepMs;
    const state = computeCelestialState(t);
    const flat = solarPosition(state, latitude, longitude);
    const hz = getHz(flat.azimuthDeg);
    const pos = solarPosition(state, latitude, longitude, hz);
    const isLit = pos.status === 'sunlit';

    if (isLit !== prevStatus) {
      transitionBracket = [t - stepMs, t];
      break;
    }
  }

  // 3. Bisect down to ~1 minute resolution if transition found
  let transitionTimeMs = null;
  if (transitionBracket) {
    let [t0, t1] = transitionBracket;
    for (let iter = 0; iter < 8; iter++) {
      const mid = (t0 + t1) / 2;
      const state = computeCelestialState(mid);
      const flat = solarPosition(state, latitude, longitude);
      const hz = getHz(flat.azimuthDeg);
      const pos = solarPosition(state, latitude, longitude, hz);
      const isLit = pos.status === 'sunlit';

      if (isLit === isCurrentlySunlit) {
        t0 = mid;
      } else {
        t1 = mid;
      }
    }
    transitionTimeMs = (t0 + t1) / 2;
  }

  // 4. Power potential index
  // Solar constant at 1 AU is ~1361 W/m²
  // At polar latitudes (|lat| >= 75°), the sun is near the horizon (0°–2°).
  // Mission landers use vertical bifacial solar panels (e.g. VIPER, Nova-C) which capture near 100% of grazing sunlight!
  const isPolar = Math.abs(latitude) >= 70;
  const sunElev = currentSun.elevationDeg;
  let powerEfficiencyPct = 0;

  if (isCurrentlySunlit) {
    if (isPolar) {
      // Vertical panel facing the sun: efficiency = cos(sunElev) ≈ 99.9%
      powerEfficiencyPct = Math.max(0, Math.min(100, Math.cos((sunElev * Math.PI) / 180) * 100));
    } else {
      // Planar horizontal array or tilted array:
      powerEfficiencyPct = Math.max(0, Math.min(100, Math.sin((sunElev * Math.PI) / 180) * 100));
    }
  }

  const timeUntilMs = transitionTimeMs ? Math.max(0, transitionTimeMs - currentTimeMs) : null;

  return {
    isCurrentlySunlit,
    currentStatus: currentSun.status, // 'sunlit' | 'blocked' | 'night'
    nextEvent: isCurrentlySunlit ? 'sunset' : 'sunrise',
    timeUntilMs,
    formattedDuration: timeUntilMs !== null ? formatDuration(timeUntilMs) : 'Continuous (No Transition)',
    transitionDate: transitionTimeMs ? new Date(transitionTimeMs) : null,
    solarElevationDeg: sunElev,
    solarAzimuthDeg: currentSun.azimuthDeg,
    terrainHorizonDeg: currentHz,
    powerEfficiencyPct: Math.round(powerEfficiencyPct),
    isPolar,
  };
}

/**
 * Calculates Direct-To-Earth (DTE) communication status and next Earthset / Earthrise transition.
 * Handles near-side continuous line of sight, far-side permanent shadow, and polar libration occultation.
 *
 * @param {number} currentTimeMs
 * @param {object} moonFeature - Selected lunar landing site or custom pin
 * @param {object|null} earthFeature - Ground station (or null for Earth center)
 * @param {object} constraints - DTE constraints
 * @returns {object} Earth link transition & communication window report
 */
export function calculateEarthTransition(
  currentTimeMs,
  moonFeature,
  earthFeature = null,
  constraints = DEFAULT_DTE_CONSTRAINTS
) {
  const siteId = moonFeature.id;
  const terrainFn = (az) => (siteId ? horizonAt(HORIZON_TABLE, siteId, az) : null);

  const lat = moonFeature.latitude ?? moonFeature.lat ?? 0;
  const lon = moonFeature.longitude ?? moonFeature.lon ?? 0;

  // 1. Current Link Evaluation
  const currentState = computeCelestialState(currentTimeMs);
  const currentLink = evaluateEarthLink({
    state: currentState,
    moonFeature,
    earthFeature,
    constraints,
    terrainFn,
  });

  const isCurrentlyLinked = currentLink.status === 'clear' || currentLink.status === 'doubtful';

  // 2. Classify Geometric Regime (Farside vs Center Near-Side vs Polar/Limb Libration)
  // Check longitude and latitude to quickly assess permanent visibility/blockage
  const absLon = Math.abs(lon);

  // Extreme farside (> 95° from prime meridian): Earth is geometrically behind the Moon.
  if (absLon > 95 && Math.abs(lat) < 70) {
    return {
      status: 'farside',
      isLinked: false,
      isPermanent: true,
      nextEvent: null,
      timeUntilMs: null,
      formattedDuration: 'Permanent Blockage',
      headline: 'Lunar Far Side · No Direct Earth Link',
      message: 'Direct Line of Sight permanently blocked by lunar body. Requires orbital relay satellite (e.g. Queqiao / Lunar Relay).',
      earthElevationDeg: currentLink.elevationDeg,
      earthAzimuthDeg: currentLink.azimuthDeg,
      terrainHorizonDeg: currentLink.terrainHorizonDeg,
      linkMarginDeg: currentLink.marginDeg,
    };
  }

  // Deep Near-side center (e.g. Apollo 11, 12, 14, 16): Earth is always 50°–90° overhead.
  if (absLon < 65 && Math.abs(lat) < 65 && currentLink.elevationDeg > 20) {
    return {
      status: 'perpetual_los',
      isLinked: true,
      isPermanent: true,
      nextEvent: null,
      timeUntilMs: null,
      formattedDuration: 'Continuous (Never Sets)',
      headline: 'Continuous DTE Line of Sight',
      message: 'Earth remains high in the selenographic sky at all times. Constant direct communication with Earth DSN stations.',
      earthElevationDeg: currentLink.elevationDeg,
      earthAzimuthDeg: currentLink.azimuthDeg,
      terrainHorizonDeg: currentLink.terrainHorizonDeg,
      linkMarginDeg: currentLink.marginDeg,
    };
  }

  // 3. Polar or Limb Site (Libration & Terrain Occultation)
  // Scan forward up to 35 days to find next Earthset or Earthrise
  const maxScanDays = 35;
  const stepMin = 30;
  const stepMs = stepMin * MINUTE_MS;
  const maxSteps = Math.round((maxScanDays * DAY_MS) / stepMs);

  let transitionBracket = null;
  let prevLinked = isCurrentlyLinked;

  for (let step = 1; step <= maxSteps; step++) {
    const t = currentTimeMs + step * stepMs;
    const state = computeCelestialState(t);
    const link = evaluateEarthLink({
      state,
      moonFeature,
      earthFeature,
      constraints,
      terrainFn,
    });
    const linked = link.status === 'clear' || link.status === 'doubtful';

    if (linked !== prevLinked) {
      transitionBracket = [t - stepMs, t];
      break;
    }
  }

  // 4. Bisect down to ~1 min
  let transitionTimeMs = null;
  if (transitionBracket) {
    let [t0, t1] = transitionBracket;
    for (let iter = 0; iter < 8; iter++) {
      const mid = (t0 + t1) / 2;
      const state = computeCelestialState(mid);
      const link = evaluateEarthLink({
        state,
        moonFeature,
        earthFeature,
        constraints,
        terrainFn,
      });
      const linked = link.status === 'clear' || link.status === 'doubtful';

      if (linked === isCurrentlyLinked) {
        t0 = mid;
      } else {
        t1 = mid;
      }
    }
    transitionTimeMs = (t0 + t1) / 2;
  }

  const timeUntilMs = transitionTimeMs ? Math.max(0, transitionTimeMs - currentTimeMs) : null;
  const nextEvent = isCurrentlyLinked ? 'earthset' : 'earthrise';

  return {
    status: currentLink.status, // 'clear' | 'doubtful' | 'blocked'
    isLinked: isCurrentlyLinked,
    isPermanent: transitionTimeMs === null,
    nextEvent,
    timeUntilMs,
    formattedDuration: timeUntilMs !== null ? formatDuration(timeUntilMs) : (isCurrentlyLinked ? 'Continuous (30d+)' : 'No Link Window (30d+)'),
    transitionDate: transitionTimeMs ? new Date(transitionTimeMs) : null,
    headline: isCurrentlyLinked
      ? (transitionTimeMs ? `Earthset (LOS) in ${formatDuration(timeUntilMs)}` : 'Continuous DTE Link (30d+)')
      : (transitionTimeMs ? `Earthrise (AOS) in ${formatDuration(timeUntilMs)}` : 'Link Blocked by Terrain/Limb'),
    message: isCurrentlyLinked
      ? `Earth is ${currentLink.elevationDeg.toFixed(1)}° above the horizon. Margin: +${currentLink.marginDeg.toFixed(1)}°.`
      : `Earth is ${currentLink.elevationDeg.toFixed(1)}° (below mask or terrain). Next acquisition in ${formatDuration(timeUntilMs)}.`,
    earthElevationDeg: currentLink.elevationDeg,
    earthAzimuthDeg: currentLink.azimuthDeg,
    terrainHorizonDeg: currentLink.terrainHorizonDeg,
    linkMarginDeg: currentLink.marginDeg,
    reason: currentLink.reason,
  };
}
