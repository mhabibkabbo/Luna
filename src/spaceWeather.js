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
  plasmaPrimary: 'https://services.swpc.noaa.gov/json/rtsw/rtsw_plasma_1h.json',
  plasmaFallback: 'https://services.swpc.noaa.gov/json/rtsw/rtsw_wind_1m.json',
  magPrimary: 'https://services.swpc.noaa.gov/json/rtsw/rtsw_mag_1h.json',
  magFallback: 'https://services.swpc.noaa.gov/json/rtsw/rtsw_mag_1m.json',
};

/** Cache TTL: 5 minutes (in milliseconds) */
export const CACHE_TTL_MS = 5 * 60 * 1000;

/**
 * Fallback defaults in case of network interruption, offline mode,
 * or NOAA rate limiting.
 */
export const FALLBACK_SPACE_WEATHER = Object.freeze({
  density: 5.4, // protons/cm³
  speed: 420.0, // km/s
  temperature: 120000, // Kelvin
  bz: -0.6, // nT (IMF Bz component)
  bt: 5.2, // nT (IMF total field)
  speedStatus: 'Moderate',
  timestamp: new Date().toISOString(),
  source: 'NOAA SWPC Baseline Model (Fallback)',
  isFallback: true,
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
 * Scans backwards to avoid trailing null telemetry packets.
 *
 * @param {Array<object>} array
 * @returns {{ density: number, speed: number, temperature: number, timestamp: string } | null}
 */
function parseLatestPlasma(array) {
  if (!Array.isArray(array) || array.length === 0) return null;

  for (let i = array.length - 1; i >= 0; i--) {
    const entry = array[i];
    if (!entry) continue;

    const densityRaw = entry.density ?? entry.proton_density;
    const speedRaw = entry.speed ?? entry.proton_speed;
    const tempRaw = entry.temperature ?? entry.proton_temperature;

    const density = densityRaw != null ? parseFloat(densityRaw) : NaN;
    const speed = speedRaw != null ? parseFloat(speedRaw) : NaN;
    const temperature = tempRaw != null ? parseFloat(tempRaw) : NaN;

    if (!isNaN(density) && !isNaN(speed)) {
      return {
        density: Number(density.toFixed(2)),
        speed: Number(speed.toFixed(1)),
        temperature: !isNaN(temperature) ? Math.round(temperature) : 100000,
        timestamp: entry.time_tag || new Date().toISOString(),
      };
    }
  }

  return null;
}

/**
 * Extracts the most recent valid IMF magnetic field reading from NOAA MAG JSON array.
 *
 * @param {Array<object>} array
 * @returns {{ bz: number, bt: number, timestamp: string } | null}
 */
function parseLatestMag(array) {
  if (!Array.isArray(array) || array.length === 0) return null;

  for (let i = array.length - 1; i >= 0; i--) {
    const entry = array[i];
    if (!entry) continue;

    const bzRaw = entry.bz ?? entry.bz_gsm ?? entry.bz_gse;
    const btRaw = entry.bt;

    const bz = bzRaw != null ? parseFloat(bzRaw) : NaN;
    const bt = btRaw != null ? parseFloat(btRaw) : NaN;

    if (!isNaN(bz)) {
      return {
        bz: Number(bz.toFixed(2)),
        bt: !isNaN(bt) ? Number(bt.toFixed(2)) : Number(Math.abs(bz).toFixed(2)),
        timestamp: entry.time_tag || new Date().toISOString(),
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

  // Return cached result if valid and not forcing refresh
  if (!forceRefresh && cache.data && now - cache.timestamp < CACHE_TTL_MS) {
    return {
      ...cache.data,
      cached: true,
    };
  }

  try {
    const [plasmaData, magData] = await Promise.all([
      fetchWithFallback(NOAA_ENDPOINTS.plasmaPrimary, NOAA_ENDPOINTS.plasmaFallback),
      fetchWithFallback(NOAA_ENDPOINTS.magPrimary, NOAA_ENDPOINTS.magFallback),
    ]);

    const latestPlasma = parseLatestPlasma(plasmaData);
    const latestMag = parseLatestMag(magData);

    if (!latestPlasma && !latestMag) {
      // If both fail, return fallback defaults (or previously cached data if available)
      if (cache.data) {
        return { ...cache.data, cached: true, isStale: true };
      }
      return { ...FALLBACK_SPACE_WEATHER, cached: false };
    }

    const speed = latestPlasma?.speed ?? FALLBACK_SPACE_WEATHER.speed;
    const density = latestPlasma?.density ?? FALLBACK_SPACE_WEATHER.density;
    const temperature = latestPlasma?.temperature ?? FALLBACK_SPACE_WEATHER.temperature;
    const bz = latestMag?.bz ?? FALLBACK_SPACE_WEATHER.bz;
    const bt = latestMag?.bt ?? FALLBACK_SPACE_WEATHER.bt;
    const timestamp = latestPlasma?.timestamp || latestMag?.timestamp || new Date().toISOString();

    const result = {
      density,
      speed,
      temperature,
      bz,
      bt,
      speedStatus: categorizeSolarWindSpeed(speed),
      timestamp,
      source: 'NOAA SWPC Real-Time Solar Wind (RTSW)',
      isFallback: false,
      cached: false,
    };

    cache = {
      data: result,
      timestamp: now,
    };

    return result;
  } catch (error) {
    console.warn('[SpaceWeather] Network fetch failed, falling back to nominal defaults:', error);
    if (cache.data) {
      return { ...cache.data, cached: true, isStale: true };
    }
    return { ...FALLBACK_SPACE_WEATHER, cached: false };
  }
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

