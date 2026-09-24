/**
 * @file lunarEphemeris.js
 * Earth and Sun geometry as seen from the Moon, expressed in the Moon's
 * body-fixed (mean-Earth / polar-axis) frame.
 *
 * That frame is the one Cesium's Ellipsoid.MOON globe lives in:
 *   +X -> selenographic (0°N, 0°E), +Y -> (0°N, 90°E), +Z -> lunar north pole.
 * So a direction returned here can be used directly as a Cesium Cartesian3.
 *
 * Data sources
 *  - Moon and Sun positions: Astronomy Engine (Don Cross), J2000 equatorial
 *    vectors, accurate to about an arcminute for the Moon and far better for the Sun.
 *  - Moon orientation (libration included): IAU/IAG WGCCRE 2009 rotation model
 *    (Archinal et al. 2011), the same model used for NASA/LROC selenographic coordinates.
 *  - Earth orientation: Astronomy Engine precession/nutation + Greenwich apparent
 *    sidereal time.
 */

import * as Astronomy from 'astronomy-engine';

export const MOON_RADIUS_KM = 1737.4;
export const EARTH_MEAN_RADIUS_KM = 6371.0;
export const SUN_RADIUS_KM = 695700;
export const AU_KM = 149597870.7;

const DEG = Math.PI / 180;
const RAD = 180 / Math.PI;

// ---------------------------------------------------------------------------
// Small 3x3 helpers (row-major arrays of arrays)
// ---------------------------------------------------------------------------

const mul = (A, B) =>
  A.map((_, i) => B[0].map((__, j) => A[i][0] * B[0][j] + A[i][1] * B[1][j] + A[i][2] * B[2][j]));

const apply = (M, v) => [
  M[0][0] * v[0] + M[0][1] * v[1] + M[0][2] * v[2],
  M[1][0] * v[0] + M[1][1] * v[1] + M[1][2] * v[2],
  M[2][0] * v[0] + M[2][1] * v[1] + M[2][2] * v[2],
];

const transpose = (M) => M[0].map((_, j) => M.map((row) => row[j]));
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const norm = (a) => Math.hypot(a[0], a[1], a[2]);
const unit = (a) => {
  const n = norm(a);
  return [a[0] / n, a[1] / n, a[2] / n];
};

/** Passive rotations, as used in the IAU/SPICE body-fixed definition. */
const R1 = (a) => [[1, 0, 0], [0, Math.cos(a), Math.sin(a)], [0, -Math.sin(a), Math.cos(a)]];
const R3 = (a) => [[Math.cos(a), Math.sin(a), 0], [-Math.sin(a), Math.cos(a), 0], [0, 0, 1]];

/** Converts an Astronomy Engine rotation into a plain matrix, independent of its storage order. */
function matrixFromRotation(rot, time) {
  const cols = [[1, 0, 0], [0, 1, 0], [0, 0, 1]].map((e) => {
    const r = Astronomy.RotateVector(rot, new Astronomy.Vector(e[0], e[1], e[2], time));
    return [r.x, r.y, r.z];
  });
  return [0, 1, 2].map((i) => [cols[0][i], cols[1][i], cols[2][i]]);
}

// ---------------------------------------------------------------------------
// Moon orientation (IAU 2009 / 2015 model, mean-Earth frame)
// ---------------------------------------------------------------------------

// Nutation-like arguments E1..E13: [epoch deg, rate deg/day]
const E_ARGS = [
  [125.045, -0.0529921],
  [250.089, -0.1059842],
  [260.008, 13.0120009],
  [176.625, 13.3407154],
  [357.529, 0.9856003],
  [311.589, 26.4057084],
  [134.963, 13.0649930],
  [276.617, 0.3287146],
  [34.226, 1.7484877],
  [15.134, -0.1589763],
  [119.743, 0.0036096],
  [239.961, 0.1643573],
  [25.053, 12.9590088],
];

/**
 * Rotation matrix taking J2000 equatorial (ICRF) vectors into the Moon body-fixed frame.
 * @param {number} d - days since J2000.0 (TT)
 */
function moonBodyFixedMatrix(d) {
  const T = d / 36525;
  const s = E_ARGS.map(([a, b]) => Math.sin((a + b * d) * DEG));
  const c = E_ARGS.map(([a, b]) => Math.cos((a + b * d) * DEG));
  // s[0] is sin(E1) ... s[12] is sin(E13)

  const ra =
    269.9949 + 0.0031 * T - 3.8787 * s[0] - 0.1204 * s[1] + 0.07 * s[2] - 0.0172 * s[3] +
    0.0072 * s[5] - 0.0052 * s[9] + 0.0043 * s[12];

  const dec =
    66.5392 + 0.013 * T + 1.5419 * c[0] + 0.0239 * c[1] - 0.0278 * c[2] + 0.0068 * c[3] -
    0.0029 * c[5] + 0.0009 * c[6] + 0.0008 * c[9] - 0.0009 * c[12];

  const w =
    38.3213 + 13.17635815 * d - 1.4e-12 * d * d + 3.561 * s[0] + 0.1208 * s[1] - 0.0642 * s[2] +
    0.0158 * s[3] + 0.0252 * s[4] - 0.0066 * s[5] - 0.0047 * s[6] - 0.0046 * s[7] +
    0.0028 * s[8] + 0.0052 * s[9] + 0.004 * s[10] + 0.0019 * s[11] - 0.0044 * s[12];

  return mul(R3(w * DEG), mul(R1((90 - dec) * DEG), R3((ra + 90) * DEG)));
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

const toLatLon = (v) => ({
  lat: Math.asin(Math.max(-1, Math.min(1, v[2] / norm(v)))) * RAD,
  lon: Math.atan2(v[1], v[0]) * RAD,
});

/**
 * Computes the full Earth/Sun geometry for a moment in time.
 *
 * @param {Date|number} when - Date or epoch milliseconds (UTC)
 * @returns {{
 *   date: Date,
 *   earth: {
 *     dir: number[], distanceKm: number, angularDiameterDeg: number,
 *     subLat: number, subLon: number,
 *     sublunar: { lat: number, lon: number },
 *     litFraction: number,
 *     toMoonFixed: number[][]
 *   },
 *   sun: {
 *     dir: number[], distanceKm: number, distanceAU: number, angularDiameterDeg: number,
 *     subLat: number, subLon: number
 *   },
 *   moon: { illuminatedFraction: number, phaseAngleDeg: number, elongationDeg: number }
 * }}
 *  `dir` vectors are unit vectors from the Moon's centre in the Moon body-fixed frame.
 *  Longitudes are east-positive, in degrees (-180..180); latitudes north-positive.
 */
export function computeCelestialState(when) {
  const date = when instanceof Date ? when : new Date(when);
  if (Number.isNaN(date.getTime())) {
    throw new RangeError('computeCelestialState: invalid date');
  }

  const time = Astronomy.MakeTime(date);

  // Geocentric J2000 equatorial vectors, AU
  const moonGeo = Astronomy.GeoMoon(time);
  const sunGeo = Astronomy.GeoVector(Astronomy.Body.Sun, time, false);

  const moonG = [moonGeo.x, moonGeo.y, moonGeo.z];
  const sunG = [sunGeo.x, sunGeo.y, sunGeo.z];

  // Vectors from the Moon's centre, J2000 equatorial
  const earthFromMoon = [-moonG[0], -moonG[1], -moonG[2]];
  const sunFromMoon = [sunG[0] - moonG[0], sunG[1] - moonG[1], sunG[2] - moonG[2]];

  // J2000 -> Moon body-fixed
  const moonFixed = moonBodyFixedMatrix(time.tt);
  const earthDir = unit(apply(moonFixed, earthFromMoon));
  const sunDir = unit(apply(moonFixed, sunFromMoon));

  const earthDistKm = norm(earthFromMoon) * AU_KM;
  const sunDistKm = norm(sunFromMoon) * AU_KM;

  // Earth-fixed -> Moon body-fixed (used to orient the Earth model and find the sub-lunar point)
  //   Earth-fixed --Rz(GAST)--> true equator of date --> J2000 --> Moon-fixed
  const gast = Astronomy.SiderealTime(time) * 15 * DEG;
  const eqdToEqj = matrixFromRotation(
    Astronomy.InverseRotation(Astronomy.Rotation_EQJ_EQD(time)),
    time
  );
  const earthFixedToEqd = transpose(R3(gast)); // active rotation about +Z by GAST
  const earthFixedToEqj = mul(eqdToEqj, earthFixedToEqd);
  const earthToMoonFixed = mul(moonFixed, earthFixedToEqj);

  // Sub-lunar point on Earth: Earth-fixed direction toward the Moon
  const moonDirEarthFixed = apply(transpose(earthFixedToEqj), unit(moonG));
  const sublunar = toLatLon(moonDirEarthFixed);

  // Phase geometry
  const cosPhaseAngle = Math.max(-1, Math.min(1, dot(earthDir, sunDir))); // Sun-Moon-Earth angle
  const cosElongation = Math.max(-1, Math.min(1, dot(unit(sunG), unit(moonG)))); // Sun-Earth-Moon angle

  const earthSub = toLatLon(earthDir);
  const sunSub = toLatLon(sunDir);

  return {
    date,
    earth: {
      dir: earthDir,
      distanceKm: earthDistKm,
      angularDiameterDeg: 2 * Math.asin(EARTH_MEAN_RADIUS_KM / earthDistKm) * RAD,
      subLat: earthSub.lat,
      subLon: earthSub.lon,
      sublunar,
      litFraction: (1 + cosElongation) / 2,
      toMoonFixed: earthToMoonFixed,
    },
    sun: {
      dir: sunDir,
      distanceKm: sunDistKm,
      distanceAU: sunDistKm / AU_KM,
      angularDiameterDeg: 2 * Math.asin(SUN_RADIUS_KM / sunDistKm) * RAD,
      subLat: sunSub.lat,
      subLon: sunSub.lon,
    },
    moon: {
      illuminatedFraction: (1 + cosPhaseAngle) / 2,
      phaseAngleDeg: Math.acos(cosPhaseAngle) * RAD,
      elongationDeg: Math.acos(cosElongation) * RAD,
    },
  };
}

/**
 * Solar elevation above the local horizon at a selenographic point, in degrees.
 * (Spherical Moon; ignores terrain and the Sun's finite disc.)
 */
export function solarElevationDeg(state, latDeg, lonDeg) {
  const lat = latDeg * DEG;
  const lon = lonDeg * DEG;
  const up = [Math.cos(lat) * Math.cos(lon), Math.cos(lat) * Math.sin(lon), Math.sin(lat)];
  return Math.asin(Math.max(-1, Math.min(1, dot(up, state.sun.dir)))) * RAD;
}
