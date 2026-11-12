import { computeCelestialState } from './lunarEphemeris.js';
import { normalizeCelestialTimeMs } from './celestialTime.js';

export const THERMAL_CONSTANTS = Object.freeze({
  T_MAX_K: 390, // Subsolar maximum temperature (~ +117°C)
  T_MIN_K: 100, // Lunar night baseline equilibrium floor (~ -173°C)
  T_PSR_K: 40,  // Permanently Shadowed Region (PSR) cryogenic floor (~ -233°C)
  POLAR_PSR_LAT_THRESHOLD: 80, // Latitude threshold for polar craters / PSRs (degrees)
  THERMAL_INERTIA_TAU_HOURS: 42, // Regolith thermal inertia radiative cooldown e-folding time (Vasavada et al. 2012; Hayne et al. 2017)
  SUNSET_SURFACE_DELTA_K: 35, // Post-sunset upper regolith thermal excess above night floor (K)
});

const DEG2RAD = Math.PI / 180;
const RAD2DEG = 180 / Math.PI;

/**
 * Analytical offline fallback for the Moon's subsolar point
 * if high-precision celestial ephemeris is unavailable.
 *
 * NOTE ON ACCURACY: This simplified 2-term circular approximation assumes a constant
 * mean synodic rate (29.530589 d) and circular orbital plane inclination (1.543°).
 * True subsolar coordinates experience elliptical equation of center perturbations
 * and lunar physical librations, giving an analytical series residual of ~0.1° to 0.5°
 * relative to the sub-arcsecond Astronomy Engine / JPL Horizons ephemerides.
 *
 * @param {Date} date - UTC Date
 * @returns {{ lat: number, lon: number, accuracyDeg: number }}
 */
function getApproximateSubsolarPoint(date) {
  // Epoch J2000.0: 2000-01-01T12:00:00Z (timestamp 946728000000)
  const J2000_MS = 946728000000;
  const daysSinceJ2000 = (date.getTime() - J2000_MS) / 86400000;

  const SYNODIC_MONTH = 29.530588853;

  // Mean solar longitude on the Moon decreases by ~360° / 29.530588853 days (~12.19°/day)
  // At J2000 noon, the subsolar selenographic longitude was ~0°
  let subLon = -(daysSinceJ2000 % SYNODIC_MONTH) * (360 / SYNODIC_MONTH);
  while (subLon <= -180) subLon += 360;
  while (subLon > 180) subLon -= 360;

  // The Moon's axial tilt relative to the ecliptic is small (~1.543°)
  // The subsolar latitude oscillates within ±1.54° over the nodical month (~27.212 days)
  const NODICAL_MONTH = 27.21222;
  const subLat = 1.543 * Math.sin((daysSinceJ2000 / NODICAL_MONTH) * 2 * Math.PI);

  return { lat: subLat, lon: subLon, accuracyDeg: 0.5 };
}

/**
 * Resolves the Moon's subsolar latitude (δ_sun) and longitude (λ_sun)
 * in the mean-Earth / polar-axis selenographic frame.
 *
 * @param {Date} date
 * @returns {{ lat: number, lon: number }}
 */
export function getSubsolarPoint(date) {
  try {
    const celestial = computeCelestialState(date);
    if (
      celestial?.sun &&
      typeof celestial.sun.subLat === 'number' &&
      typeof celestial.sun.subLon === 'number'
    ) {
      return {
        lat: celestial.sun.subLat,
        lon: celestial.sun.subLon,
      };
    }
  } catch (err) {
    // Graceful fallback to analytical derivation
    console.warn('[LunarThermal] Falling back to approximate subsolar calculation:', err);
  }

  return getApproximateSubsolarPoint(date);
}

/**
 * Computes deterministic lunar surface temperature and solar elevation
 * for any given selenographic coordinate (latDeg, lonDeg) and UTC date/time.
 *
 * @param {number} latDeg - Selenographic latitude (-90° to +90°, North positive)
 * @param {number} lonDeg - Selenographic longitude (-180° to +180°, East positive)
 * @param {Date | number | string} [date=new Date()] - UTC date/time (default: current system time)
 * @returns {{
 *   tempK: number,
 *   tempC: number,
 *   tempF: number,
 *   isDaylight: boolean,
 *   solarElevationDeg: number,
 *   isPSR?: boolean,
 *   subsolarPoint?: { lat: number, lon: number }
 * }}
 */
export function getLunarTemperature(latDeg, lonDeg, date = new Date(), options = {}) {
  const targetDate = date instanceof Date ? date : new Date(date);
  const validDate = new Date(
    normalizeCelestialTimeMs(
      isNaN(targetDate.getTime()) ? new Date() : targetDate
    )
  );

  const subsolar = getSubsolarPoint(validDate);
  const subLatDeg = subsolar.lat;
  const subLonDeg = subsolar.lon;

  const latRad = latDeg * DEG2RAD;
  const lonRad = lonDeg * DEG2RAD;
  const subLatRad = subLatDeg * DEG2RAD;
  const subLonRad = subLonDeg * DEG2RAD;

  const cosTheta =
    Math.sin(latRad) * Math.sin(subLatRad) +
    Math.cos(latRad) * Math.cos(subLatRad) * Math.cos(lonRad - subLonRad);

  const clampedCosTheta = Math.max(-1, Math.min(1, cosTheta));

  // Solar Elevation Angle above local tangent plane: 90° - zenith angle
  const solarElevationDeg = Math.asin(clampedCosTheta) * RAD2DEG;
  const terrainHorizonDeg =
    typeof options?.terrainHorizonDeg === 'number' && Number.isFinite(options.terrainHorizonDeg)
      ? options.terrainHorizonDeg
      : 0;
  const elevationM =
    typeof options?.elevationM === 'number' && Number.isFinite(options.elevationM)
      ? options.elevationM
      : null;

  const SOLAR_LIMB_DEG = 0.266;
  const isDaylight = solarElevationDeg + SOLAR_LIMB_DEG > terrainHorizonDeg;
  const isTerrainShadowed = !isDaylight && solarElevationDeg + SOLAR_LIMB_DEG > 0;

  let tempK;
  let isPSR = false;

  if (isDaylight) {
    const effCosTheta =
      clampedCosTheta > 0
        ? clampedCosTheta
        : Math.max(0.008, Math.sin(Math.max(0.25, solarElevationDeg - terrainHorizonDeg) * DEG2RAD));
    tempK =
      THERMAL_CONSTANTS.T_MIN_K +
      (THERMAL_CONSTANTS.T_MAX_K - THERMAL_CONSTANTS.T_MIN_K) * Math.pow(effCosTheta, 0.25);
  } else {
    // Night / Terrain Shadow with regolith thermal inertia lag
    // (Vasavada et al. 2012; Paige et al. 2010; Hayne et al. 2017)
    let nightFloorK;
    if (Math.abs(latDeg) > THERMAL_CONSTANTS.POLAR_PSR_LAT_THRESHOLD) {
      // Distinguish true cold-trap depressions (elevation <= -1500m, or deep negative sun elevation when elevation is unknown)
      // from transient terrain shadows and lunar night on elevated polar ridges/plateaus
      const isDeepColdTrap =
        elevationM !== null ? elevationM <= -1500 : solarElevationDeg <= -4.0;
      if (isDeepColdTrap) {
        nightFloorK = THERMAL_CONSTANTS.T_PSR_K;
        isPSR = true;
      } else {
        // Polar shadow / night on highland ridge or rim (Vasavada et al. 2012 polar regime ~75-85 K)
        nightFloorK = isTerrainShadowed || (elevationM !== null && elevationM > 0) ? 85 : 75;
      }
    } else {
      nightFloorK = THERMAL_CONSTANTS.T_MIN_K;
    }

    if (isPSR) {
      // Deep cryogenic cold traps remain in equilibrium with geothermal flux (~40 K)
      tempK = nightFloorK;
    } else {
      // Regolith thermal inertia cooldown lag:
      // Upper regolith low thermal conductivity (k ~ 1e-3 W/(m K)) yields an exponential
      // radiative cooldown with decay constant tau ≈ 42 hours (Vasavada et al. 2012).
      const sunBelowHorizonDeg = isTerrainShadowed
        ? Math.max(0, terrainHorizonDeg - solarElevationDeg)
        : Math.max(0, -solarElevationDeg);
      const SYNODIC_HOURS = 708.734;
      const degPerHour = 360 / SYNODIC_HOURS; // ~0.50795 deg/hour
      const elapsedNightHours = sunBelowHorizonDeg / degPerHour;

      const thermalLagExcessK =
        THERMAL_CONSTANTS.SUNSET_SURFACE_DELTA_K *
        Math.exp(-elapsedNightHours / THERMAL_CONSTANTS.THERMAL_INERTIA_TAU_HOURS);

      tempK = nightFloorK + thermalLagExcessK;
    }
  }

  const tempC = tempK - 273.15;
  const tempF = (tempC * 9) / 5 + 32;

  const roundedTempK = Math.round(tempK);
  const roundedTempC = Math.round(tempC);
  const roundedTempF = Math.round(tempF);
  const subsurfaceTempC = Math.round(
    isPSR ? -228 : -20 - Math.pow(Math.abs(latDeg) / 90, 1.5) * 145
  );

  return {
    tempK: roundedTempK,
    tempC: roundedTempC,
    tempF: roundedTempF,
    kelvin: roundedTempK,
    celsius: roundedTempC,
    fahrenheit: roundedTempF,
    surfaceTempK: roundedTempK,
    surfaceTempC: roundedTempC,
    subsurfaceTempC,
    isDaylight,
    isTerrainShadowed,
    solarElevationDeg: Math.round(solarElevationDeg * 10) / 10,
    terrainHorizonDeg: Math.round(terrainHorizonDeg * 10) / 10,
    isPSR,
    provenance: 'Calculated',
    modelName:
      'Calculated (Analytical Radiative Balance Model — Diviner gridded dataset not present)',
    subsolarPoint: {
      lat: Math.round(subLatDeg * 100) / 100,
      lon: Math.round(subLonDeg * 100) / 100,
    },
  };
}

/**
 * Classifies instantaneous lunar lighting state into distinct operational polar/selenographic regimes:
 * - 'day': Sun clears both astronomical 0° horizon and local terrain obstacles.
 * - 'terrain-shadowed': Sun has positive elevation above astronomical 0° horizon (e.g. +1.6°)
 *   but is occluded by local crater rims or massif topography.
 * - 'psr': Deep permanently shadowed floor / cryogenic cold trap.
 * - 'night': True solar night where the Sun disc is below astronomical 0°.
 *
 * @param {Object} params
 * @param {string=} params.sunStatus - Optional ephemeris status ('sunlit'|'blocked'|'night')
 * @param {number=} params.solarElevationDeg - Solar center elevation relative to 0° horizontal
 * @param {number=} params.terrainHorizonDeg - Local topographic horizon mask angle
 * @param {boolean=} params.isDaylight
 * @param {boolean=} params.isTerrainShadowed
 * @param {boolean=} params.isPSR
 */
export function classifySolarLightingState({
  sunStatus,
  solarElevationDeg,
  terrainHorizonDeg = 0,
  isDaylight,
  isTerrainShadowed,
  isPSR,
} = {}) {
  const hasEl = typeof solarElevationDeg === 'number' && Number.isFinite(solarElevationDeg);
  const elStr = hasEl
    ? `${solarElevationDeg >= 0 ? '+' : ''}${solarElevationDeg.toFixed(1)}°`
    : '—';
  const hzStr =
    typeof terrainHorizonDeg === 'number' && Number.isFinite(terrainHorizonDeg)
      ? `${terrainHorizonDeg.toFixed(1)}°`
      : 'local mask';

  if (isPSR) {
    return {
      key: 'psr',
      label: 'Permanent Shadow',
      shortLabel: 'PSR',
      exposureLabel: '0% (PSR)',
      badgeClass: 'bg-purple-950/50 text-purple-300 border-purple-500/40',
      detail: `Deep Permanently Shadowed Region (PSR); sun blocked year-round (${elStr} sun vs ${hzStr} rim).`,
      isSunlit: false,
      isTerrainShadowed: false,
      isTrueNight: false,
      isPSR: true,
    };
  }

  if (sunStatus === 'sunlit' || (sunStatus === undefined && isDaylight)) {
    return {
      key: 'day',
      label: 'Day',
      shortLabel: 'Day',
      exposureLabel: 'Day (Sunlit)',
      badgeClass: 'bg-amber-950/40 text-amber-300 border-amber-500/40',
      detail: `Direct sunlight clearing local ${hzStr} horizon (${elStr} solar elevation).`,
      isSunlit: true,
      isTerrainShadowed: false,
      isTrueNight: false,
      isPSR: false,
    };
  }

  // Low positive elevation (+1.6° etc.) blocked by topography MUST be classified as Terrain-Shadowed, never Night
  const positiveSunAboveAstronomical = hasEl && solarElevationDeg > -0.266;
  if (sunStatus === 'blocked' || isTerrainShadowed || positiveSunAboveAstronomical) {
    return {
      key: 'terrain-shadowed',
      label: 'Terrain-Shadowed',
      shortLabel: 'Terrain-Shadowed',
      exposureLabel: `Terrain-Shadowed (${elStr})`,
      badgeClass: 'bg-orange-950/45 text-orange-300 border-orange-500/40',
      detail: `Sun is above astronomical horizon (${elStr}) but occluded by local ${hzStr} topography.`,
      isSunlit: false,
      isTerrainShadowed: true,
      isTrueNight: false,
      isPSR: false,
    };
  }

  return {
    key: 'night',
    label: 'Night',
    shortLabel: 'Night',
    exposureLabel: '0% (Night)',
    badgeClass: 'bg-indigo-950/50 text-indigo-300 border-indigo-500/40',
    detail: `True lunar night: Sun is below 0° astronomical horizon (${elStr}).`,
    isSunlit: false,
    isTerrainShadowed: false,
    isTrueNight: true,
    isPSR: false,
  };
}
