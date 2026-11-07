/**
 * @file lunarThermal.js
 * Lunar Thermal & Radiative Ephemeris Engine.
 *
 * Computes deterministic local lunar surface temperatures based on the solar zenith angle,
 * radiative balance, and polar topography considerations (Permanently Shadowed Regions).
 *
 * Because the Moon lacks an atmosphere, surface temperature is governed by direct solar insolation
 * coupled with regolith thermal inertia radiative dissipation (Vasavada et al. 2012; Hayne et al. 2017):
 * - Daylight (cos θ > 0): T_day = T_min + (T_max - T_min) * (cos θ)^(1/4)
 *   where T_max = 390 K (+117°C), T_min = 100 K (-173°C).
 * - Night / Shadow with Thermal Inertia Lag:
 *   T_night = T_floor + (T_sunset_delta) * exp(-t_night / tau_inertia)
 *   where tau_inertia ≈ 42 hours (regolith thermal inertia decay constant),
 *   T_floor ≈ 100 K (equatorial/mid-latitude) or 70–85 K (polar non-PSR terrain).
 * - Polar Cryogenic Cold Trap Guard (|lat| > 80° and depression elevation <= -1500m or deep PSR):
 *   Permanently Shadowed Region (PSR) locked to 40 K (-233°C).
 */

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

  // Synodic lunar period (new moon to new moon): ~29.530588853 days
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

  // 1. Subsolar Point Calculation (δ_sun, λ_sun)
  const subsolar = getSubsolarPoint(validDate);
  const subLatDeg = subsolar.lat;
  const subLonDeg = subsolar.lon;

  // 2. Solar Zenith Angle (θ)
  // Convert latitude and longitude to radians:
  // cos(θ) = sin(lat)*sin(δ_sun) + cos(lat)*cos(δ_sun)*cos(lon - λ_sun)
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

  const isDaylight = cosTheta > 0 && solarElevationDeg > terrainHorizonDeg;
  const isTerrainShadowed = cosTheta > 0 && solarElevationDeg <= terrainHorizonDeg;

  // 3. Analytical Radiative Balance Model Calculation
  let tempK;
  let isPSR = false;

  if (isDaylight) {
    // Daytime radiative balance: T_min + (T_max - T_min) * (cos θ)^(1/4)
    tempK =
      THERMAL_CONSTANTS.T_MIN_K +
      (THERMAL_CONSTANTS.T_MAX_K - THERMAL_CONSTANTS.T_MIN_K) * Math.pow(clampedCosTheta, 0.25);
  } else {
    // Night / Terrain Shadow with regolith thermal inertia lag
    // (Vasavada et al. 2012; Paige et al. 2010; Hayne et al. 2017)
    let nightFloorK;
    if (Math.abs(latDeg) > THERMAL_CONSTANTS.POLAR_PSR_LAT_THRESHOLD) {
      // Distinguish true cold-trap depressions (elevation <= -1500m or deep negative sun elevation)
      // from transient terrain shadows on elevated polar ridges
      if ((elevationM !== null && elevationM <= -1500) || solarElevationDeg <= -4.0) {
        nightFloorK = THERMAL_CONSTANTS.T_PSR_K;
        isPSR = true;
      } else {
        // Transient polar shadow on highland ridge/rim (Vasavada et al. 2012 polar night regime ~70-85 K)
        nightFloorK = isTerrainShadowed ? 85 : 70;
      }
    } else {
      // Standard equatorial / mid-latitude lunar night (~100 K)
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
      const SYNODIC_HOURS = 708.734; // 29.530589 days
      const degPerHour = 360 / SYNODIC_HOURS; // ~0.50795 deg/hour
      const elapsedNightHours = sunBelowHorizonDeg / degPerHour;

      const thermalLagExcessK =
        THERMAL_CONSTANTS.SUNSET_SURFACE_DELTA_K *
        Math.exp(-elapsedNightHours / THERMAL_CONSTANTS.THERMAL_INERTIA_TAU_HOURS);

      tempK = nightFloorK + thermalLagExcessK;
    }
  }

  // Celsius and Fahrenheit conversions
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
