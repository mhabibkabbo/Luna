/**
 * @file spaceWeather.js
 * Space Weather Telemetry Service for the Lunar Explorer.
 *
 * Fetches real-time solar wind plasma and interplanetary magnetic field (IMF) data
 * from the NOAA Space Weather Prediction Center (SWPC) open JSON feeds.
 *
 * Endpoints:
 * - Real-time Solar Wind Plasma: https://services.swpc.noaa.gov/json/rtsw/rtsw_plasma_1h.json (fallback: rtsw_wind_1m.json)
 * - Real-time Interplanetary Magnetic Field: https://services.swpc.noaa.gov/json/rtsw/rtsw_mag_1h.json (fallback: rtsw_mag_1m.json)
 */

export const NOAA_ENDPOINTS = {
  plasmaPrimary: 'https://services.swpc.noaa.gov/products/solar-wind/plasma-5-minute.json',
  plasmaFallback: 'https://services.swpc.noaa.gov/products/solar-wind/plasma-2-hour.json',
  magPrimary: 'https://services.swpc.noaa.gov/products/solar-wind/mag-5-minute.json',
  magFallback: 'https://services.swpc.noaa.gov/products/solar-wind/mag-2-hour.json',
};

/** Cache TTL: 5 minutes (in milliseconds) */
export const CACHE_TTL_MS = 5 * 60 * 1000;

/**
 * Fallback defaults in case of network interruption, offline mode,
 * or NOAA rate limiting.
 */
export const FALLBACK_SPACE_WEATHER = Object.freeze({
  density: null,
  speed: null,
  temperature: null,
  bz: null,
  bt: null,
  speedStatus: 'Live telemetry unavailable',
  timestamp: new Date().toISOString(),
  source: 'NOAA SWPC Live Feed Unavailable (Offline / CORS)',
  isFallback: true,
  isUnavailable: true,
});

/**
 * In-memory cache singleton.
 */
let cache = {
  data: null,
  timestamp: 0,
};

/**
 * Categorize solar wind speed status according to SWPC operational thresholds:
 * - < 400 km/s: "Nominal / Slow"
 * - 400 - 600 km/s: "Moderate"
 * - > 600 km/s: "High Speed Stream"
 *
 * @param {number} speed - Solar wind velocity in km/s
 * @returns {'Nominal / Slow' | 'Moderate' | 'High Speed Stream'}
 */
export function categorizeSolarWindSpeed(speed) {
  if (typeof speed !== 'number' || isNaN(speed)) {
    return 'Moderate';
  }
  if (speed < 400) {
    return 'Nominal / Slow';
  }
  if (speed <= 600) {
    return 'Moderate';
  }
  return 'High Speed Stream';
}

/**
 * Helper to fetch a JSON endpoint with an automatic fallback URL if 404/network fails.
 *
 * @param {string} primaryUrl
 * @param {string} fallbackUrl
 * @param {number} timeoutMs
 * @returns {Promise<any[] | null>}
 */
async function fetchWithFallback(primaryUrl, fallbackUrl, timeoutMs = 8000) {
  const tryFetch = async (url) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: { Accept: 'application/json' },
      });
      clearTimeout(timer);
      if (!response.ok) return null;
      const data = await response.json();
      return Array.isArray(data) ? data : null;
    } catch {
      clearTimeout(timer);
      return null;
    }
  };

  const primaryResult = await tryFetch(primaryUrl);
  if (primaryResult && primaryResult.length > 0) {
    return primaryResult;
  }

  if (fallbackUrl) {
    return await tryFetch(fallbackUrl);
  }

  return null;
}

/**
 * Extracts the most recent valid solar wind plasma measurement from NOAA JSON array.
 * Supports both NOAA SWPC 2D array format ([["time_tag","density","speed","temperature"], ...])
 * and legacy object array format.
 *
 * @param {Array<any>} array
 * @returns {{ density: number, speed: number, temperature: number, timestamp: string } | null}
 */
function parseLatestPlasma(array) {
  if (!Array.isArray(array) || array.length === 0) return null;

  const isTable = Array.isArray(array[0]);
  const startIdx = isTable ? 1 : 0;

  for (let i = array.length - 1; i >= startIdx; i--) {
    const entry = array[i];
    if (!entry) continue;

    const densityRaw = Array.isArray(entry) ? entry[1] : (entry.density ?? entry.proton_density);
    const speedRaw = Array.isArray(entry) ? entry[2] : (entry.speed ?? entry.proton_speed);
    const tempRaw = Array.isArray(entry) ? entry[3] : (entry.temperature ?? entry.proton_temperature);
    const timeTag = Array.isArray(entry) ? entry[0] : entry.time_tag;

    const density = densityRaw != null ? parseFloat(densityRaw) : NaN;
    const speed = speedRaw != null ? parseFloat(speedRaw) : NaN;
    const temperature = tempRaw != null ? parseFloat(tempRaw) : NaN;

    if (!isNaN(density) && !isNaN(speed)) {
      return {
        density: Number(density.toFixed(2)),
        speed: Number(speed.toFixed(1)),
        temperature: !isNaN(temperature) ? Math.round(temperature) : 100000,
        timestamp: timeTag || new Date().toISOString(),
      };
    }
  }

  return null;
}

/**
 * Extracts the most recent valid IMF magnetic field reading from NOAA MAG JSON array.
 * Supports both NOAA SWPC 2D array format ([["time_tag","bx_gsm","by_gsm","bz_gsm","lon_gsm","lat_gsm","bt"], ...])
 * and legacy object array format.
 *
 * @param {Array<any>} array
 * @returns {{ bz: number, bt: number, timestamp: string } | null}
 */
function parseLatestMag(array) {
  if (!Array.isArray(array) || array.length === 0) return null;

  const isTable = Array.isArray(array[0]);
  const startIdx = isTable ? 1 : 0;

  for (let i = array.length - 1; i >= startIdx; i--) {
    const entry = array[i];
    if (!entry) continue;

    const bzRaw = Array.isArray(entry) ? entry[3] : (entry.bz ?? entry.bz_gsm ?? entry.bz_gse);
    const btRaw = Array.isArray(entry) ? entry[6] : entry.bt;
    const timeTag = Array.isArray(entry) ? entry[0] : entry.time_tag;

    const bz = bzRaw != null ? parseFloat(bzRaw) : NaN;
    const bt = btRaw != null ? parseFloat(btRaw) : NaN;

    if (!isNaN(bz)) {
      return {
        bz: Number(bz.toFixed(2)),
        bt: !isNaN(bt) ? Number(bt.toFixed(2)) : Number(Math.abs(bz).toFixed(2)),
        timestamp: timeTag || new Date().toISOString(),
      };
    }
  }

  return null;
}

/**
 * Fetches real-time space weather telemetry from NOAA SWPC.
 * Results are cached in-memory for 5–10 minutes.
 *
 * @param {boolean} [forceRefresh=false] - Ignore cache and trigger network fetch
 * @returns {Promise<{
 *   density: number,
 *   speed: number,
 *   temperature: number,
 *   bz: number,
 *   bt: number,
 *   speedStatus: 'Nominal / Slow' | 'Moderate' | 'High Speed Stream',
 *   timestamp: string,
 *   source: string,
 *   isFallback: boolean,
 *   cached: boolean
 * }>}
 */
export async function fetchSpaceWeather(forceRefresh = false) {
  const now = Date.now();

  if (!forceRefresh && cache.data && now - cache.timestamp < CACHE_TTL_MS) {
    return {
      ...cache.data,
      cached: true,
    };
  }

  try {
    const [plasmaRaw, magRaw] = await Promise.all([
      fetchWithFallback(NOAA_ENDPOINTS.plasmaPrimary, NOAA_ENDPOINTS.plasmaFallback, 5000),
      fetchWithFallback(NOAA_ENDPOINTS.magPrimary, NOAA_ENDPOINTS.magFallback, 5000),
    ]);

    const plasma = parseLatestPlasma(plasmaRaw);
    const mag = parseLatestMag(magRaw);

    if (plasma && mag) {
      const liveResult = {
        density: plasma.density,
        speed: plasma.speed,
        temperature: plasma.temperature,
        bz: mag.bz,
        bt: mag.bt,
        speedStatus: categorizeSolarWindSpeed(plasma.speed),
        timestamp: plasma.timestamp || mag.timestamp || new Date(now).toISOString(),
        source: 'NOAA SWPC DSCOVR/ACE Real-Time L1 Telemetry (Measured)',
        isFallback: false,
        isUnavailable: false,
        cached: false,
      };
      cache = {
        data: liveResult,
        timestamp: now,
      };
      return liveResult;
    }
  } catch {
    // Fall through to explicit unavailable state (never invent synthetic telemetry)
  }

  const unavailableResult = {
    ...FALLBACK_SPACE_WEATHER,
    timestamp: new Date(now).toISOString(),
    cached: false,
  };

  cache = {
    data: unavailableResult,
    timestamp: now,
  };

  return unavailableResult;
}

/**
 * Returns currently cached space weather telemetry synchronously (or null if empty).
 */
export function getCachedSpaceWeather() {
  return cache.data ? { ...cache.data, cached: true } : null;
}

/**
 * Resets the in-memory cache (useful for testing or manual reloads).
 */
export function clearSpaceWeatherCache() {
  cache = { data: null, timestamp: 0 };
}

