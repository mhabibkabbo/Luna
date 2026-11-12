import * as Astronomy from "astronomy-engine";
import { AU_KM, SUN_RADIUS_KM, MOON_RADIUS_KM } from "./lunarEphemeris.js";
import { normalizeCelestialTimeMs } from "./celestialTime.js";

const DEG = Math.PI / 180;
const RAD = 180 / Math.PI;

const norm = (vector) => Math.hypot(vector[0], vector[1], vector[2]);
const unit = (vector) => {
  const length = norm(vector);
  return vector.map((value) => value / length);
};
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

function matrixFromRotation(rotation, time) {
  const columns = [
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1],
  ].map((axis) => {
    const result = Astronomy.RotateVector(
      rotation,
      new Astronomy.Vector(axis[0], axis[1], axis[2], time),
    );
    return [result.x, result.y, result.z];
  });
  return [0, 1, 2].map((row) => [
    columns[0][row],
    columns[1][row],
    columns[2][row],
  ]);
}

function apply(matrix, vector) {
  return matrix.map((row) => dot(row, vector));
}

function toLatLon(vector) {
  const direction = unit(vector);
  return {
    lat: Math.asin(Math.max(-1, Math.min(1, direction[2]))) * RAD,
    lon: Math.atan2(direction[1], direction[0]) * RAD,
  };
}

/**
 * Computes the apparent Sun and Moon positions from Earth's centre.
 * Longitudes are east-positive and latitudes are north-positive.
 *
 * @param {Date|number} when UTC date or epoch milliseconds
 */
export function computeEarthCelestialState(when) {
  const inputDate = when instanceof Date ? when : new Date(when);
  if (Number.isNaN(inputDate.getTime())) {
    throw new RangeError("computeEarthCelestialState: invalid date");
  }
  const date = new Date(normalizeCelestialTimeMs(inputDate));
  const time = Astronomy.MakeTime(date);
  const sunEqj = Astronomy.GeoVector(Astronomy.Body.Sun, time, false);
  const moonEqj = Astronomy.GeoMoon(time);
  const sunVector = [sunEqj.x, sunEqj.y, sunEqj.z];
  const moonVector = [moonEqj.x, moonEqj.y, moonEqj.z];

  const gastHours = Astronomy.SiderealTime(time);
  const gast = gastHours * 15 * DEG;
  const eqjToEqd = matrixFromRotation(Astronomy.Rotation_EQJ_EQD(time), time);
  const eqdToEarthFixed = [
    [Math.cos(gast), Math.sin(gast), 0],
    [-Math.sin(gast), Math.cos(gast), 0],
    [0, 0, 1],
  ];
  const toEarthFixed = (vector) =>
    apply(eqdToEarthFixed, apply(eqjToEqd, vector));
  const sunEarthFixed = toEarthFixed(sunVector);
  const moonEarthFixed = toEarthFixed(moonVector);
  const sunDistanceKm = norm(sunVector) * AU_KM;
  const moonDistanceKm = norm(moonVector) * AU_KM;

  const moonToEarth = unit(moonVector.map((value) => -value));
  const moonToSun = unit(
    sunVector.map((value, index) => value - moonVector[index]),
  );
  const phaseCosine = Math.max(-1, Math.min(1, dot(moonToEarth, moonToSun)));
  const sunSubpoint = toLatLon(sunEarthFixed);
  const moonSubpoint = toLatLon(moonEarthFixed);

  return {
    date,
    earth: {
      siderealTimeHours: gastHours,
      subsolar: sunSubpoint,
      sublunar: moonSubpoint,
    },
    sun: {
      dir: unit(sunEarthFixed),
      distanceKm: sunDistanceKm,
      distanceAU: sunDistanceKm / AU_KM,
      angularDiameterDeg: 2 * Math.asin(SUN_RADIUS_KM / sunDistanceKm) * RAD,
      subLat: sunSubpoint.lat,
      subLon: sunSubpoint.lon,
    },
    moon: {
      dir: unit(moonEarthFixed),
      distanceKm: moonDistanceKm,
      angularDiameterDeg: 2 * Math.asin(MOON_RADIUS_KM / moonDistanceKm) * RAD,
      subLat: moonSubpoint.lat,
      subLon: moonSubpoint.lon,
      illuminatedFraction: (1 + phaseCosine) / 2,
      phaseAngleDeg: Math.acos(phaseCosine) * RAD,
    },
  };
}
