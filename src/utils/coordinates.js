/**
 * @file coordinates.js
 * Selenographic coordinate formatting and normalization utilities.
 * Conforms to IAU lunar standards:
 * - Latitude: -90° (South) to +90° (North)
 * - Longitude: -180° (West) to +180° (East)
 * - Origin (0°, 0°): Mean sub-Earth point at the lunar equator and prime meridian
 */

/**
 * Normalizes selenographic longitude to the range [-180, 180].
 * @param {number} lon 
 * @returns {number}
 */
export function normalizeLongitude(lon) {
  if (typeof lon !== 'number' || isNaN(lon)) return 0;
  let n = (lon + 180) % 360;
  if (n < 0) n += 360;
  return n - 180;
}

/**
 * Clamps selenographic latitude to [-90, 90].
 * @param {number} lat 
 * @returns {number}
 */
export function clampLatitude(lat) {
  if (typeof lat !== 'number' || isNaN(lat)) return 0;
  return Math.max(-90, Math.min(90, lat));
}

/**
 * Formats a selenographic coordinate pair into standard human-readable notation.
 * Example: Lat: 43.31° S, Lon: 11.36° W
 * 
 * @param {number} lon - Longitude in degrees (-180 to 180)
 * @param {number} lat - Latitude in degrees (-90 to 90)
 * @param {number} [decimals=2] - Number of decimal digits to display
 * @returns {{ latStr: string, lonStr: string, combined: string }}
 */
export function formatLunarCoordinates(lon, lat, decimals = 2) {
  if (typeof lon !== 'number' || isNaN(lon) || typeof lat !== 'number' || isNaN(lat)) {
    return {
      latStr: '0.00° N',
      lonStr: '0.00° E',
      combined: '0.00° N, 0.00° E'
    };
  }

  const normLon = normalizeLongitude(lon);
  const normLat = clampLatitude(lat);

  const latDir = normLat >= 0 ? 'N' : 'S';
  const lonDir = normLon >= 0 ? 'E' : 'W';

  const absLat = Math.abs(normLat).toFixed(decimals);
  const absLon = Math.abs(normLon).toFixed(decimals);

  const latStr = `${absLat}° ${latDir}`;
  const lonStr = `${absLon}° ${lonDir}`;

  return {
    latStr,
    lonStr,
    combined: `Lat: ${latStr}  Lon: ${lonStr}`
  };
}

/**
 * Parses user-typed coordinate strings into [longitude, latitude].
 * Supports formats like "43.31S, 11.36W", "-43.31, -11.36", "43.31 S 11.36 W".
 * 
 * @param {string} input 
 * @returns {[number, number]|null} [longitude, latitude] or null if invalid
 */
export function parseLunarCoordinates(input) {
  if (!input || typeof input !== 'string') return null;
  const cleaned = input.trim();

  // Pattern: Optional +/- or N/S/E/W indicators
  // e.g. "43.31S, 11.36W" or "-43.31, -11.36"
  const regex = /([+-]?\d+(?:\.\d+)?)\s*([NSEWnsew])?/g;
  const matches = [...cleaned.matchAll(regex)];

  if (matches.length < 2) return null;

  let lat = null;
  let lon = null;

  for (const m of matches) {
    let val = parseFloat(m[1]);
    const dir = m[2] ? m[2].toUpperCase() : null;

    if (dir === 'S') val = -Math.abs(val);
    if (dir === 'N') val = Math.abs(val);
    if (dir === 'W') val = -Math.abs(val);
    if (dir === 'E') val = Math.abs(val);

    if (dir === 'N' || dir === 'S') {
      lat = val;
    } else if (dir === 'E' || dir === 'W') {
      lon = val;
    } else if (lat === null) {
      lat = val;
    } else if (lon === null) {
      lon = val;
    }
  }

  if (lat !== null && lon !== null && !isNaN(lat) && !isNaN(lon)) {
    return [normalizeLongitude(lon), clampLatitude(lat)];
  }

  return null;
}
