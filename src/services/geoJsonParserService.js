let workerInstance = null;
let messageIdCounter = 0;
const pendingRequests = new Map();

function getWorker() {
  if (!workerInstance && typeof window !== 'undefined') {
    workerInstance = new Worker(
      new URL('../workers/geoJsonParser.worker.js', import.meta.url),
      { type: 'module' }
    );

    workerInstance.onmessage = (event) => {
      const { type, id, data, count, error } = event.data || {};
      const pending = pendingRequests.get(id);
      if (!pending) return;

      pendingRequests.delete(id);

      if (type === 'PARSER_ERROR') {
        pending.reject(new Error(error || 'GeoJSON parser worker error'));
      } else {
        pending.resolve({ data, count });
      }
    };

    workerInstance.onerror = (err) => {
      console.error('[geoJsonParserService] Worker runtime error:', err);
      const crashedWorker = workerInstance;
      workerInstance = null;
      try {
        crashedWorker?.terminate?.();
      } catch {
        // Ignore termination failures on crashed worker
      }
      for (const [id, pending] of pendingRequests.entries()) {
        pending.reject(err instanceof Error ? err : new Error(err?.message || 'GeoJSON worker runtime error'));
        pendingRequests.delete(id);
      }
    };
  }
  return workerInstance;
}

function sendWorkerMessage(type, payload) {
  const worker = getWorker();
  if (!worker) return Promise.reject(new Error('Web Workers not supported in current environment'));

  const id = ++messageIdCounter;
  return new Promise((resolve, reject) => {
    pendingRequests.set(id, { resolve, reject });
    worker.postMessage({ type, id, payload });
  });
}

/**
 * Fetches GeoJSON from `url` and transforms its coordinates into stereographic meters in the worker.
 * @param {string} url - GeoJSON URL to fetch
 * @param {string} [cacheKey] - Optional key to cache in worker memory
 * @returns {Promise<GeoJSON.FeatureCollection>}
 */
export async function fetchAndProjectGeoJson(url, cacheKey) {
  const result = await sendWorkerMessage('FETCH_AND_PROJECT_GEOJSON', {
    url,
    cacheKey: cacheKey || url,
  });
  return result.data;
}

/**
 * Transforms an existing GeoJSON object into stereographic meters in the worker.
 * @param {GeoJSON.FeatureCollection} geoJson
 * @param {string} [cacheKey]
 * @returns {Promise<GeoJSON.FeatureCollection>}
 */
export async function projectGeoJson(geoJson, cacheKey) {
  const result = await sendWorkerMessage('PROJECT_GEOJSON', {
    geoJson,
    cacheKey,
  });
  return result.data;
}

/**
 * Loads a contour dataset (e.g., contours_100m.geojson, contours_200m.geojson)
 * and returns pre-projected lines and metadata off the main thread.
 * @param {string} url
 * @param {number} [minElevation]
 * @param {number} [maxElevation]
 * @returns {Promise<Array<{ elevationM: number, isIndex: boolean, isDepression: boolean, lines: number[][][] }>>}
 */
export async function loadContoursFromWorker(url, minElevation = -10000, maxElevation = 10000) {
  const result = await sendWorkerMessage('LOAD_CONTOURS', {
    url,
    minElevation,
    maxElevation,
  });
  return result.data;
}

export function clearGeoJsonParserCache() {
  if (workerInstance) {
    workerInstance.postMessage({ type: 'CLEAR_CACHE' });
  }
}

export function terminateGeoJsonParserWorker() {
  if (workerInstance) {
    workerInstance.terminate();
    workerInstance = null;
    pendingRequests.clear();
  }
}
