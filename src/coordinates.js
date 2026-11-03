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

/**
 * Calculates great-circle geodesic distance between two selenographic points in kilometers.
 * Lunar radius = 1737.4 km.
 * 
 * @param {number} lon1 
 * @param {number} lat1 
 * @param {number} lon2 
 * @param {number} lat2 
 * @returns {number} Distance in kilometers
 */
export function calculateLunarDistance(lon1, lat1, lon2, lat2) {
  const R = 1737.4; // Mean Moon radius in km
  const toRad = (d) => (d * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const rLat1 = toRad(lat1);
  const rLat2 = toRad(lat2);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(rLat1) * Math.cos(rLat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Determines the lunar hemisphere, quadrant, and region metadata for a selenographic coordinate.
 * 
 * @param {number} lon 
 * @param {number} lat 
 * @returns {{ hemisphere: string, face: string, quadrant: string, regionDescription: string }}
 */
export function getLunarRegionInfo(lon, lat) {
  const normLon = normalizeLongitude(lon);
  const normLat = clampLatitude(lat);

  const latHemisphere = normLat >= 0 ? 'Northern Hemisphere' : 'Southern Hemisphere';
  const isNearside = Math.abs(normLon) <= 90;
  const face = isNearside ? 'Lunar Nearside (Earth-Facing)' : 'Lunar Farside';

  let quadrant = '';
  if (normLat >= 0 && normLon >= 0 && normLon <= 90) quadrant = 'Nearside Northeast (Quadrant I)';
  else if (normLat >= 0 && normLon < 0 && normLon >= -90) quadrant = 'Nearside Northwest (Quadrant II)';
  else if (normLat < 0 && normLon < 0 && normLon >= -90) quadrant = 'Nearside Southwest (Quadrant III)';
  else if (normLat < 0 && normLon >= 0 && normLon <= 90) quadrant = 'Nearside Southeast (Quadrant IV)';
  else if (normLat >= 0 && normLon > 90) quadrant = 'Farside Northeast';
  else if (normLat >= 0 && normLon < -90) quadrant = 'Farside Northwest';
  else if (normLat < 0 && normLon > 90) quadrant = 'Farside Southeast';
  else quadrant = 'Farside Southwest';

  let regionDescription = `${face} • ${latHemisphere}`;
  if (normLat <= -75) regionDescription = `South Polar Region (Artemis Exploration Zone) • ${face}`;
  else if (normLat >= 75) regionDescription = `North Polar Region • ${face}`;

  return {
    hemisphere: latHemisphere,
    face,
    quadrant,
    regionDescription,
  };
}

/**
 * Finds the nearest cataloged lunar feature to a given selenographic coordinate.
 * 
 * @param {number} lon 
 * @param {number} lat 
 * @param {Array} featureCatalog 
 * @returns {{ feature: Object, distanceKm: number }|null}
 */
export function findNearestLunarFeature(lon, lat, featureCatalog = []) {
  if (!featureCatalog || featureCatalog.length === 0) return null;

  let minDistance = Infinity;
  let nearestFeature = null;

  for (const feat of featureCatalog) {
    if (typeof feat.longitude === 'number' && typeof feat.latitude === 'number') {
      const dist = calculateLunarDistance(lon, lat, feat.longitude, feat.latitude);
      if (dist < minDistance) {
        minDistance = dist;
        nearestFeature = feat;
      }
    }
  }

  if (nearestFeature) {
    return {
      feature: nearestFeature,
      distanceKm: Math.round(minDistance * 10) / 10,
    };
  }

  return null;
}
