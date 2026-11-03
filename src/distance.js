/**
 * @file distance.js
 * Geodesic distance and spatial measurement utilities for the Moon.
 * 
 * IMPORTANT:
 * Uses the scientific mean lunar radius:
 * R_MOON = 1737.4 km (1,737,400 meters)
 * Earth radius (~6371 km) is STRICTLY PROHIBITED.
 */

export const MOON_MEAN_RADIUS_KM = 1737.4;
export const MOON_MEAN_RADIUS_M = 1737400;

/**
 * Converts degrees to radians.
 * @param {number} deg 
 * @returns {number}
 */
function toRad(deg) {
  return (deg * Math.PI) / 180;
}

/**
 * Converts radians to degrees.
 * @param {number} rad 
 * @returns {number}
 */
function toDeg(rad) {
  return (rad * 180) / Math.PI;
}

/**
 * Calculates the great-circle geodesic distance between two selenographic points
 * using the Haversine formula on a sphere of radius R_MOON = 1737.4 km.
 * 
 * @param {[number, number]} coordA - [longitude, latitude] in degrees
 * @param {[number, number]} coordB - [longitude, latitude] in degrees
 * @returns {number} Distance in kilometers
 */
export function calculateLunarDistanceKm(coordA, coordB) {
  if (!coordA || !coordB) return 0;
  const [lon1, lat1] = coordA;
  const [lon2, lat2] = coordB;

  const phi1 = toRad(lat1);
  const phi2 = toRad(lat2);
  const deltaPhi = toRad(lat2 - lat1);
  const deltaLambda = toRad(lon2 - lon1);

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) *
    Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(Math.max(0, 1 - a)));

  return MOON_MEAN_RADIUS_KM * c;
}

/**
 * Calculates the total path distance and individual segment distances
 * across an array of selenographic coordinates.
 * 
 * @param {Array<[number, number]>} coords - Array of [lon, lat] points
 * @returns {{ totalKm: number, segmentsKm: Array<number> }}
 */
export function calculateLunarPathDistance(coords) {
  if (!coords || coords.length < 2) {
    return { totalKm: 0, segmentsKm: [] };
  }

  const segmentsKm = [];
  let totalKm = 0;

  for (let i = 0; i < coords.length - 1; i++) {
    const d = calculateLunarDistanceKm(coords[i], coords[i + 1]);
    segmentsKm.push(d);
    totalKm += d;
  }

  return { totalKm, segmentsKm };
}

/**
 * Calculates the initial forward azimuth/bearing from coordA to coordB on the Moon.
 * 
 * @param {[number, number]} coordA - [longitude, latitude]
 * @param {[number, number]} coordB - [longitude, latitude]
 * @returns {number} Bearing in degrees from true North (0° to 360°)
 */
export function calculateLunarBearing(coordA, coordB) {
  if (!coordA || !coordB) return 0;
  const [lon1, lat1] = coordA;
  const [lon2, lat2] = coordB;

  const y = Math.sin(toRad(lon2 - lon1)) * Math.cos(toRad(lat2));
  const x =
    Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
    Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(toRad(lon2 - lon1));

  const initialBearing = toDeg(Math.atan2(y, x));
  return (initialBearing + 360) % 360;
}

/**
 * Formats a lunar distance into a human-readable string.
 * Uses meters for < 1 km, and kilometers for >= 1 km.
 * 
 * @param {number} distanceKm - Distance in kilometers
 * @returns {string} Formatted distance (e.g. "384.7 km" or "450 m")
 */
export function formatLunarDistance(distanceKm) {
  if (typeof distanceKm !== 'number' || isNaN(distanceKm) || distanceKm <= 0) {
    return '0 km';
  }

  if (distanceKm < 1) {
    const meters = Math.round(distanceKm * 1000);
    return `${meters} m`;
  }

  if (distanceKm < 10) {
    return `${distanceKm.toFixed(2)} km`;
  }

  if (distanceKm < 100) {
    return `${distanceKm.toFixed(1)} km`;
  }

  return `${Math.round(distanceKm).toLocaleString()} km`;
}

/**
 * Calculates the great-circle spherical polygon area on the Moon in square kilometers.
 * Uses Girard's theorem / l'Huilier formula on a sphere of R_MOON = 1737.4 km.
 * 
 * @param {Array<[number, number]>} ring - Array of [lon, lat] closed loop
 * @returns {number} Area in km²
 */
export function calculateLunarPolygonAreaKm2(ring) {
  if (!ring || ring.length < 3) return 0;

  // Spherical excess formula
  let totalAngle = 0;
  const n = ring.length;

  for (let i = 0; i < n; i++) {
    const p1 = ring[(i + n - 1) % n];
    const p2 = ring[i];
    const p3 = ring[(i + 1) % n];

    const bearing1 = calculateLunarBearing(p2, p1);
    const bearing2 = calculateLunarBearing(p2, p3);

    let angle = bearing2 - bearing1;
    if (angle < 0) angle += 360;
    totalAngle += toRad(angle);
  }

  const excess = Math.abs(totalAngle - (n - 2) * Math.PI);
  return excess * MOON_MEAN_RADIUS_KM * MOON_MEAN_RADIUS_KM;
}
