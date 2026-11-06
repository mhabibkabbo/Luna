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

import { LUNAR_FEATURES } from '../data/lunarFeatures.js';
import { LANDING_SITES } from '../data/landingSites.js';

export const SOUTH_POLE_REFERENCE_LANDMARKS = [
  { id: "shackleton-crater", name: "Shackleton Crater", type: "Crater (21 km)", lat: -89.67, lon: 129.78, elevM: -2768 },
  { id: "malapert-mountain", name: "Malapert Massif", type: "Polar Massif (5.1 km)", lat: -86.02, lon: 2.7, elevM: 5113 },
  { id: "haworth-crater", name: "Haworth Crater", type: "PSR Basin (51 km)", lat: -87.4, lon: -5.1, elevM: -3385 },
  { id: "shoemaker-crater", name: "Shoemaker Crater", type: "PSR Basin (51 km)", lat: -88.1, lon: 45.0, elevM: -3934 },
  { id: "cabeus-crater", name: "Cabeus Crater (LCROSS)", type: "Volatile Basin (98 km)", lat: -84.9, lon: -35.5, elevM: -2870 },
  { id: "amundsen-crater", name: "Amundsen Crater", type: "Impact Basin (103 km)", lat: -84.5, lon: 82.8, elevM: -3628 },
  { id: "de-gerlache-crater", name: "De Gerlache Crater", type: "PSR Crater (32 km)", lat: -88.5, lon: -87.1, elevM: -1013 },
  { id: "faustini-crater", name: "Faustini Crater", type: "PSR Crater (42 km)", lat: -87.3, lon: 77.0, elevM: -2750 },
  { id: "nobile-rim", name: "Nobile Crater (VIPER)", type: "Polar Rim (73 km)", lat: -85.2, lon: 53.5, elevM: 690 },
  { id: "malapert-a", name: "Malapert A (IM-1)", type: "CLPS Landing Zone", lat: -80.13, lon: 1.44, elevM: 2584 },
  { id: "sverdrup-crater", name: "Sverdrup Crater", type: "Far-Side PSR (33 km)", lat: -88.3, lon: -152.0, elevM: -2899 },
  { id: "slater-crater", name: "Slater Crater", type: "Polar Crater (25 km)", lat: -88.1, lon: 111.0, elevM: -1753 },
];

/**
 * Determines the verified geological province and terrane based on published USGS and lunar science boundaries
 * (Jolliff et al., 2000, "Major lunar crustal terranes").
 *
 * @param {number} lat - Selenographic latitude (-90 to +90)
 * @param {number} lon - Selenographic longitude (-180 to +180)
 * @returns {{ province: string, terrane: string, isSouthPole: boolean, description: string }}
 */
export function determineLunarGeologicalRegion(lat, lon) {
  const normLon = normalizeLongitude(lon);
  const normLat = clampLatitude(lat);

  // South Polar Region (strict definition: latitude <= -75.0°)
  if (normLat <= -75.0) {
    return {
      province: 'South Polar Highlands',
      terrane: 'Feldspathic Highlands Terrane (FHT-An)',
      isSouthPole: true,
      description: 'Ancient anorthositic crust heavily sculpted by impact craters, high-relief massifs, and cryogenic permanently shadowed regions (PSRs). Primary Artemis exploration sector.',
    };
  }

  // North Polar Region (latitude >= +75.0°)
  if (normLat >= 75.0) {
    return {
      province: 'North Polar Highlands',
      terrane: 'Feldspathic Highlands Terrane (FHT-An)',
      isSouthPole: false,
      description: 'Heavily cratered anorthositic polar terrain with extreme low-angle solar incidence and cryogenic cold traps.',
    };
  }

  // South Pole-Aitken (SPA) Basin: Southern farside between -16° and -75°S, lon > 120°E or < -120°W
  if (normLat >= -75 && normLat <= -16 && (normLon >= 120 || normLon <= -120)) {
    if (normLat >= -38 && normLat <= -30 && normLon >= 160 && normLon <= 170) {
      return {
        province: 'Mare Ingenii (SPA)',
        terrane: 'South Pole-Aitken (SPA) Basin',
        isSouthPole: false,
        description: 'Isolated farside basaltic mare pond within the South Pole-Aitken impact basin.',
      };
    }
    return {
      province: 'South Pole-Aitken (SPA) Basin',
      terrane: 'South Pole-Aitken (SPA) Terrane',
      isSouthPole: false,
      description: 'The Moon’s oldest and deepest confirmed impact basin (~2,500 km diameter), excavating lower-crustal material.',
    };
  }

  // Specific major lunar maria geographic boundaries
  if (normLat >= 10 && normLat <= 25 && normLon >= 50 && normLon <= 70) {
    return {
      province: 'Mare Crisium Basin',
      terrane: 'Eastern Nearside Mare',
      isSouthPole: false,
      description: 'Circular multi-ring impact basin filled with flood basalts.',
    };
  }
  if (normLat >= 3 && normLat <= 18 && normLon >= 15 && normLon <= 45) {
    return {
      province: 'Mare Tranquillitatis',
      terrane: 'Eastern Nearside Mare',
      isSouthPole: false,
      description: 'Extensive titanium-rich basaltic plain; site of Apollo 11 (Statio Tranquillitatis).',
    };
  }
  if (normLat >= 18 && normLat <= 42 && normLon >= -40 && normLon <= -2) {
    return {
      province: 'Mare Imbrium Basin',
      terrane: 'Procellarum KREEP Terrane (PKT)',
      isSouthPole: false,
      description: 'Giant multi-ring impact basin ringed by Montes Apenninus, Montes Caucasus, and Montes Alpes.',
    };
  }
  if (normLat >= 15 && normLat <= 36 && normLon >= 8 && normLon <= 32) {
    return {
      province: 'Mare Serenitatis Basin',
      terrane: 'Procellarum KREEP Terrane (PKT-Adjacent)',
      isSouthPole: false,
      description: 'Prominent mascon basin filled with multi-epoch basalt flows.',
    };
  }
  if (normLat >= -15 && normLat <= 48 && normLon >= -80 && normLon <= -25) {
    return {
      province: 'Oceanus Procellarum',
      terrane: 'Procellarum KREEP Terrane (PKT)',
      isSouthPole: false,
      description: 'The vast western lunar mare plain, uniquely enriched in thorium and incompatible trace elements.',
    };
  }
  if (normLat >= -15 && normLat <= 5 && normLon >= 40 && normLon <= 62) {
    return {
      province: 'Mare Fecunditatis',
      terrane: 'Eastern Nearside Mare',
      isSouthPole: false,
      description: 'Eastern nearside basaltic plain with complex graben and rilles.',
    };
  }
  if (normLat >= -22 && normLat <= -10 && normLon >= 30 && normLon <= 45) {
    return {
      province: 'Mare Nectaris Basin',
      terrane: 'Nectaris Impact Basin',
      isSouthPole: false,
      description: 'Type specimen for the Nectarian stratigraphic period.',
    };
  }
  if (normLat >= -25 && normLat <= -10 && normLon >= -25 && normLon <= -10) {
    return {
      province: 'Mare Nubium',
      terrane: 'Procellarum KREEP Terrane (PKT)',
      isSouthPole: false,
      description: 'Nearside southern circular basin inundated by ancient mare lavas.',
    };
  }
  if (normLat >= -30 && normLat <= -18 && normLon >= -45 && normLon <= -35) {
    return {
      province: 'Mare Humorum',
      terrane: 'Humorum Impact Basin',
      isSouthPole: false,
      description: 'Circular mascon basin surrounded by concentric fracture rilles.',
    };
  }
  if (normLat >= -30 && normLat <= -10 && normLon >= -105 && normLon <= -85) {
    return {
      province: 'Mare Orientale Basin',
      terrane: 'Orientale Impact Basin',
      isSouthPole: false,
      description: 'The freshest, least-flooded major multi-ring impact basin on the Moon.',
    };
  }
  if (normLat >= 20 && normLat <= 32 && normLon >= 140 && normLon <= 155) {
    return {
      province: 'Mare Moscoviense',
      terrane: 'Farside Mare Basin',
      isSouthPole: false,
      description: 'Isolated farside mare basin residing on thin lunar crust.',
    };
  }

  // Nearside Central Highlands
  if (normLat >= -35 && normLat <= 5 && normLon >= -15 && normLon <= 25) {
    return {
      province: 'Nearside Central Highlands',
      terrane: 'Feldspathic Highlands Terrane (FHT-Nearside)',
      isSouthPole: false,
      description: 'Ancient cratered anorthositic highlands between the near-side maria.',
    };
  }

  // Broad Terranes
  if (Math.abs(normLon) <= 90) {
    if (normLat >= -25 && normLat <= 60 && normLon >= -100 && normLon <= 25) {
      return {
        province: 'PKT Highland Regolith',
        terrane: 'Procellarum KREEP Terrane (PKT)',
        isSouthPole: false,
        description: 'High-thorium crustal province surrounding the western mare reservoirs.',
      };
    }
    if (normLat < -35) {
      return {
        province: 'Southern Highlands',
        terrane: 'Feldspathic Highlands Terrane (FHT)',
        isSouthPole: false,
        description: 'Old, heavily cratered anorthositic southern crust.',
      };
    }
    return {
      province: 'Northern Highlands',
      terrane: 'Feldspathic Highlands Terrane (FHT)',
      isSouthPole: false,
      description: 'High-albedo anorthositic northern crust.',
    };
  }

  // Farside
  return {
    province: 'Farside Feldspathic Highlands',
    terrane: 'Feldspathic Highlands Terrane (FHT)',
    isSouthPole: false,
    description: 'Thick, high-albedo anorthositic crust on the Moon’s farside.',
  };
}

/**
 * Calculates great-circle spherical distance and forward azimuth bearing between two points
 * on the lunar sphere (R = 1,737.4 km).
 *
 * @param {number} lat1 
 * @param {number} lon1 
 * @param {number} lat2 
 * @param {number} lon2 
 * @returns {{ distanceKm: number, bearingDeg: number }}
 */
export function computeSelenographicDistanceAndBearing(lat1, lon1, lat2, lon2) {
  const toRad = Math.PI / 180;
  const phi1 = lat1 * toRad;
  const phi2 = lat2 * toRad;
  const dPhi = (lat2 - lat1) * toRad;
  const dLam = (lon2 - lon1) * toRad;

  const a =
    Math.sin(dPhi / 2) * Math.sin(dPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(dLam / 2) * Math.sin(dLam / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(Math.max(0, 1 - a)));
  const distanceKm = 1737.4 * c;

  const y = Math.sin(dLam) * Math.cos(phi2);
  const x =
    Math.cos(phi1) * Math.sin(phi2) -
    Math.sin(phi1) * Math.cos(phi2) * Math.cos(dLam);
  const bearingDeg = ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;

  return {
    distanceKm: Math.round(distanceKm * 10) / 10,
    bearingDeg: Math.round(bearingDeg),
  };
}

// Master list of all lunar reference landmarks for nearest-neighbor spatial queries
let CACHED_ALL_LANDMARKS = null;
function getAllLunarLandmarks() {
  if (CACHED_ALL_LANDMARKS) return CACHED_ALL_LANDMARKS;

  const landmarks = [];
  const seenIds = new Set();

  SOUTH_POLE_REFERENCE_LANDMARKS.forEach((l) => {
    seenIds.add(l.id);
    landmarks.push({
      id: l.id,
      name: l.name,
      type: l.type,
      lat: l.lat,
      lon: l.lon,
      elevM: l.elevM,
    });
  });

  if (Array.isArray(LUNAR_FEATURES)) {
    LUNAR_FEATURES.forEach((f) => {
      if (!seenIds.has(f.id)) {
        seenIds.add(f.id);
        const lat = f.latitude ?? f.lat;
        const lon = f.longitude ?? f.lon;
        if (Number.isFinite(lat) && Number.isFinite(lon)) {
          landmarks.push({
            id: f.id,
            name: f.name,
            type: f.type ? `${f.type.charAt(0).toUpperCase() + f.type.slice(1)}${f.diameterKm ? ` (${f.diameterKm} km)` : ''}` : 'Lunar Feature',
            lat,
            lon,
            elevM: null,
          });
        }
      }
    });
  }

  if (Array.isArray(LANDING_SITES)) {
    LANDING_SITES.forEach((s) => {
      if (!seenIds.has(s.id)) {
        seenIds.add(s.id);
        const lat = s.latitude ?? s.lat;
        const lon = s.longitude ?? s.lon;
        if (Number.isFinite(lat) && Number.isFinite(lon)) {
          landmarks.push({
            id: s.id,
            name: s.name,
            type: 'Landing Site',
            lat,
            lon,
            elevM: s.elevationMeters || null,
          });
        }
      }
    });
  }

  CACHED_ALL_LANDMARKS = landmarks;
  return landmarks;
}

/**
 * Finds the nearest cataloged lunar landmark anywhere on the lunar surface using
 * great-circle spherical distance calculations.
 *
 * @param {number} lat - Selenographic latitude
 * @param {number} lon - Selenographic longitude
 * @returns {{ name: string, type: string, distanceKm: number, bearingDeg: number, lat: number, lon: number }|null}
 */
export function findNearestLunarLandmark(lat, lon) {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  const landmarks = getAllLunarLandmarks();
  if (!landmarks || landmarks.length === 0) return null;

  let best = null;
  for (const lm of landmarks) {
    const { distanceKm, bearingDeg } = computeSelenographicDistanceAndBearing(
      lat,
      lon,
      lm.lat,
      lm.lon
    );
    if (!best || distanceKm < best.distanceKm) {
      best = {
        ...lm,
        distanceKm,
        bearingDeg,
      };
    }
  }
  return best;
}

/**
 * Determines the lunar hemisphere, quadrant, and region metadata for a selenographic coordinate.
 * 
 * @param {number} lon 
 * @param {number} lat 
 * @returns {{ hemisphere: string, face: string, quadrant: string, regionDescription: string, province: string, terrane: string, isSouthPole: boolean, geologicalDescription: string }}
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

  const geo = determineLunarGeologicalRegion(normLat, normLon);

  let regionDescription = `${face} • ${latHemisphere}`;
  if (normLat <= -75) regionDescription = `South Polar Region (Artemis Exploration Zone) • ${face}`;
  else if (normLat >= 75) regionDescription = `North Polar Region • ${face}`;

  return {
    hemisphere: latHemisphere,
    face,
    quadrant,
    regionDescription,
    province: geo.province,
    terrane: geo.terrane,
    isSouthPole: geo.isSouthPole,
    geologicalDescription: geo.description,
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

