import proj4 from 'proj4';

// Lunar datum definitions for IAU Moon R = 1,737,400 m
const LUNAR_LONLAT_DEF = '+proj=longlat +a=1737400 +b=1737400 +no_defs';
const SP_PROJ4_DEF = '+proj=stere +lat_0=-90 +lon_0=0 +k=1 +a=1737400 +b=1737400 +units=m +no_defs';

/**
 * Transforms a single [lon, lat] coordinate pair into stereographic meters [x, y].
 */
function transformCoord(lon, lat) {
  return proj4(LUNAR_LONLAT_DEF, SP_PROJ4_DEF, [lon, lat]);
}

/**
 * Recursively transforms GeoJSON coordinate arrays from [lon, lat] into [x, y] meters.
 */
function projectCoordinates(coords, geomType) {
  if (!Array.isArray(coords) || coords.length === 0) return coords;

  switch (geomType) {
    case 'Point':
      return transformCoord(coords[0], coords[1]);

    case 'MultiPoint':
    case 'LineString':
      return coords.map(([lon, lat]) => transformCoord(lon, lat));

    case 'MultiLineString':
    case 'Polygon':
      return coords.map((ring) => ring.map(([lon, lat]) => transformCoord(lon, lat)));

    case 'MultiPolygon':
      return coords.map((poly) =>
        poly.map((ring) => ring.map(([lon, lat]) => transformCoord(lon, lat)))
      );

    default:
      return coords;
  }
}

/**
 * Projects an entire GeoJSON feature collection into stereographic coordinates.
 */
function projectFeatureCollection(geoJson) {
  if (!geoJson || geoJson.type !== 'FeatureCollection' || !Array.isArray(geoJson.features)) {
    return geoJson;
  }

  const projectedFeatures = geoJson.features.map((feature) => {
    if (!feature || !feature.geometry) return feature;
    const geom = feature.geometry;
    return {
      type: 'Feature',
      id: feature.id,
      properties: { ...(feature.properties || {}), isProjected: true },
      geometry: {
        type: geom.type,
        coordinates: projectCoordinates(geom.coordinates, geom.type),
      },
    };
  });

  return {
    type: 'FeatureCollection',
    properties: geoJson.properties || {},
    features: projectedFeatures,
  };
}

/**
 * Specialized parser for lunar topographic contour line datasets (e.g., contours_100m.geojson).
 * Extracts elevation, index flags, and projects vertices to stereographic meters.
 */
function parseContourLines(geoJson, minElevation = -10000, maxElevation = 10000) {
  if (!geoJson || !Array.isArray(geoJson.features)) return [];

  const parsedContours = [];

  for (const feature of geoJson.features) {
    const props = feature.properties || {};
    const elevationM = Number(props.elevationM ?? props.elev ?? props.elevation ?? 0);
    if (elevationM < minElevation || elevationM > maxElevation) continue;

    const geom = feature.geometry;
    if (!geom || (geom.type !== 'LineString' && geom.type !== 'MultiLineString')) continue;

    const isIndex = Boolean(props.isIndex ?? (Math.abs(elevationM % 500) < 1e-3));
    const isDepression = Boolean(props.isDepression ?? false);

    let lines = [];
    if (geom.type === 'LineString') {
      lines = [geom.coordinates.map(([lon, lat]) => transformCoord(lon, lat))];
    } else if (geom.type === 'MultiLineString') {
      lines = geom.coordinates.map((line) => line.map(([lon, lat]) => transformCoord(lon, lat)));
    }

    parsedContours.push({
      elevationM,
      isIndex,
      isDepression,
      lines,
    });
  }

  return parsedContours;
}

const workerDataCache = new Map();

self.onmessage = async (event) => {
  const { type, id, payload } = event.data || {};

  try {
    switch (type) {
      case 'PROJECT_GEOJSON': {
        const { geoJson, cacheKey } = payload;
        if (cacheKey && workerDataCache.has(cacheKey)) {
          self.postMessage({
            type: 'GEOJSON_PROJECTED',
            id,
            data: workerDataCache.get(cacheKey),
            fromCache: true,
          });
          return;
        }

        const projected = projectFeatureCollection(geoJson);
        if (cacheKey) workerDataCache.set(cacheKey, projected);

        self.postMessage({
          type: 'GEOJSON_PROJECTED',
          id,
          data: projected,
        });
        break;
      }

      case 'FETCH_AND_PROJECT_GEOJSON': {
        const { url, cacheKey = url } = payload;
        if (workerDataCache.has(cacheKey)) {
          self.postMessage({
            type: 'GEOJSON_PROJECTED',
            id,
            data: workerDataCache.get(cacheKey),
            fromCache: true,
          });
          return;
        }

        const resp = await fetch(url);
        if (!resp.ok) throw new Error(`HTTP ${resp.status} fetching ${url}`);
        const rawJson = await resp.json();
        const projected = projectFeatureCollection(rawJson);
        workerDataCache.set(cacheKey, projected);

        self.postMessage({
          type: 'GEOJSON_PROJECTED',
          id,
          data: projected,
        });
        break;
      }

      case 'LOAD_CONTOURS': {
        const { url, minElevation, maxElevation, cacheKey = `${url}_${minElevation}_${maxElevation}` } = payload;
        if (workerDataCache.has(cacheKey)) {
          self.postMessage({
            type: 'CONTOURS_LOADED',
            id,
            data: workerDataCache.get(cacheKey),
            fromCache: true,
          });
          return;
        }

        const resp = await fetch(url);
        if (!resp.ok) throw new Error(`HTTP ${resp.status} fetching ${url}`);
        const rawJson = await resp.json();
        const parsed = parseContourLines(rawJson, minElevation, maxElevation);
        workerDataCache.set(cacheKey, parsed);

        self.postMessage({
          type: 'CONTOURS_LOADED',
          id,
          data: parsed,
          count: parsed.length,
        });
        break;
      }

      case 'CLEAR_CACHE': {
        workerDataCache.clear();
        self.postMessage({ type: 'CACHE_CLEARED', id });
        break;
      }

      default:
        self.postMessage({
          type: 'PARSER_ERROR',
          id,
          error: `Unknown worker action: "${type}"`,
        });
    }
  } catch (error) {
    self.postMessage({
      type: 'PARSER_ERROR',
      id,
      error: error?.message || String(error),
    });
  }
};
