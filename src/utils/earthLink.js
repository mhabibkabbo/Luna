/**
 * @file earthLink.js
 * Earth as seen from a lunar site, and the direct-to-Earth (DTE) link built on it.
 *
 * Extends the purely geometric line of sight in communication.js with the constraints a
 * real link has: minimum Earth elevation, terrain at the Earth's azimuth, the ground
 * station's own elevation mask, the antenna's zenith keyhole and its slew rate.
 */

import { computeCelestialState, EARTH_MEAN_RADIUS_KM } from './lunarEphemeris.js';
import {
  computeCommunicationLink,
  lunarFixedPositionKm,
  lunarLocalCoordinates,
} from './communication.js';

const RAD = 180 / Math.PI;

/**
 * Assumed link constraints. They are generic mission-design values, not those of any
 * specific lander, so the UI states them next to the results.
 */
export const DEFAULT_DTE_CONSTRAINTS = Object.freeze({
  /** Lander antenna: Earth centre must be at least this high (mounting/field-of-view mask). */
  minEarthElevationDeg: 5,
  /** Ground station elevation mask toward the Moon. */
  stationMinElevationDeg: 10,
  /** Az/el gimbals lose azimuth authority near zenith (keyhole). */
  antennaMaxElevationDeg: 88,
  /** Maximum gimbal slew rate needed to keep tracking Earth. */
  maxSlewDegPerHour: 360,
});

export const LINK_REASON_LABELS = {
  ok: 'Link available',
  'below-horizon': 'Earth below horizon',
  terrain: 'Blocked by terrain',
  'terrain-partial': 'Earth disc grazes terrain',
  'min-elevation': 'Below antenna minimum elevation',
  station: 'Below station mask',
  'earth-facing-away': 'Selected site faces away from Earth',
  keyhole: 'Antenna zenith keyhole',
  slew: 'Antenna slew limit exceeded',
};

const coordinates = (feature) => ({
  lat: feature?.latitude ?? feature?.lat,
  lon: feature?.longitude ?? feature?.lon,
});

/**
 * Topocentric Earth-centre direction from a lunar site. Includes the ~0.25° parallax
 * from standing on the surface rather than at the Moon's centre.
 */
export function earthLookFromMoon(state, moonFeature) {
  const { lat, lon } = coordinates(moonFeature);
  const site = lunarFixedPositionKm(lat, lon, (moonFeature.elevationM ?? 0) / 1000);
  const centre = state.earth.dir.map((v) => v * state.earth.distanceKm);
  const toEarth = [centre[0] - site[0], centre[1] - site[1], centre[2] - site[2]];
  const rangeKm = Math.hypot(...toEarth);
  const local = lunarLocalCoordinates(
    lat,
    lon,
    toEarth.map((v) => v / rangeKm)
  );
  return {
    azimuthDeg: local.azimuthDeg,
    elevationDeg: local.elevationDeg,
    rangeKm,
    radiusDeg: Math.asin(EARTH_MEAN_RADIUS_KM / rangeKm) * RAD,
  };
}

/** Rates (deg/h) at which the antenna must move to follow Earth around `whenMs`. */
export function earthSlewRates(moonFeature, whenMs, halfSpanMin = 15) {
  const before = earthLookFromMoon(computeCelestialState(whenMs - halfSpanMin * 60000), moonFeature);
  const after = earthLookFromMoon(computeCelestialState(whenMs + halfSpanMin * 60000), moonFeature);
  const hours = (2 * halfSpanMin) / 60;
  const dAz = ((after.azimuthDeg - before.azimuthDeg + 540) % 360) - 180;
  return {
    azimuthDegPerHour: Math.abs(dAz) / hours,
    elevationDegPerHour: Math.abs(after.elevationDeg - before.elevationDeg) / hours,
  };
}

/**
 * @param {object} options
 * @param {object} options.state - computeCelestialState() result
 * @param {object} options.moonFeature
 * @param {object} [options.earthFeature] - ground station; omit to look at Earth's centre
 * @param {object} [options.constraints]
 * @param {(azDeg:number)=>number|null} [options.terrainFn] - terrain horizon, null = not modeled
 * @param {number} [options.slewDegPerHour] - required antenna slew rate, if known
 * @returns {{status:'clear'|'doubtful'|'blocked', reason:string, elevationDeg:number,
 *   azimuthDeg:number, radiusDeg:number, terrainHorizonDeg:number|null,
 *   stationElevationDeg:number|null, marginDeg:number}}
 */
export function evaluateEarthLink({
  state,
  moonFeature,
  earthFeature = null,
  constraints = DEFAULT_DTE_CONSTRAINTS,
  terrainFn = null,
  slewDegPerHour = null,
}) {
  const look = earthLookFromMoon(state, moonFeature);
  let azimuthDeg = look.azimuthDeg;
  let elevationDeg = look.elevationDeg;
  let stationElevationDeg = null;

  if (earthFeature) {
    const link = computeCommunicationLink({ moonFeature, earthFeature, state });
    azimuthDeg = link.moonAzimuthDeg;
    elevationDeg = link.moonElevationDeg;
    stationElevationDeg = link.earthElevationDeg;
  }

  const radius = look.radiusDeg;
  const terrainHorizonDeg = terrainFn ? terrainFn(azimuthDeg) : null;
  const terrain = terrainHorizonDeg ?? 0;
  const c = constraints;

  let status = 'clear';
  let reason = 'ok';
  const block = (why) => {
    status = 'blocked';
    reason = why;
  };

  if (elevationDeg + radius <= 0) block('below-horizon');
  else if (
    stationElevationDeg !== null &&
    stationElevationDeg < c.stationMinElevationDeg
  ) {
    block(
      stationElevationDeg < 0 && look.elevationDeg >= c.minEarthElevationDeg
        ? 'earth-facing-away'
        : 'station'
    );
  } else if (elevationDeg + radius <= terrain) block('terrain');
  else if (elevationDeg < c.minEarthElevationDeg) block('min-elevation');
  else if (elevationDeg > c.antennaMaxElevationDeg) block('keyhole');
  else if (slewDegPerHour !== null && slewDegPerHour > c.maxSlewDegPerHour) block('slew');
  else if (elevationDeg - radius < terrain) {
    status = 'doubtful';
    reason = 'terrain-partial';
  }

  return {
    status,
    reason,
    elevationDeg,
    azimuthDeg,
    radiusDeg: radius,
    terrainHorizonDeg,
    stationElevationDeg,
    marginDeg: elevationDeg - Math.max(terrain, c.minEarthElevationDeg),
  };
}

/**
 * Samples the DTE link over a window. Same result shape as sweepCommunication, plus the
 * reason for every sample. Slew is not evaluated here (it needs extra ephemeris calls);
 * the keyhole check covers the case where it matters most.
 */
export async function sweepEarthLink({
  moonFeature,
  earthFeature = null,
  startMs,
  days = 30,
  stepMin = 30,
  constraints = DEFAULT_DTE_CONSTRAINTS,
  terrainFn = null,
  signal,
}) {
  const sampleCount = Math.round((days * 1440) / stepMin);
  const stepMs = stepMin * 60000;
  const visibility = new Array(sampleCount);
  const reasons = new Array(sampleCount);

  for (let index = 0; index < sampleCount; index++) {
    if (signal?.aborted) return null;
    const state = computeCelestialState(startMs + (index + 0.5) * stepMs);
    const result = evaluateEarthLink({ state, moonFeature, earthFeature, constraints, terrainFn });
    visibility[index] = result.status;
    reasons[index] = result.reason;
    if (index % 30 === 29) await new Promise((resolve) => setTimeout(resolve, 0));
  }

  return { startMs, endMs: startMs + days * 86400000, stepMin, visibility, reasons };
}
