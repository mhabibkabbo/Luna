/**
 * @file spaceWeather.js
 * Space Weather Telemetry Service for the Lunar Explorer.
 *
 * Fetches real-time solar wind plasma and interplanetary magnetic field (IMF) data
 * from NOAA Space Weather Prediction Center (SWPC) open JSON feeds.
 *
 * Primary Endpoints:
 * - Propagated Solar Wind (1-hour high-resolution plasma & IMF stream):
 *   https://services.swpc.noaa.gov/products/geospace/propagated-solar-wind-1-hour.json
 * - Real-time Solar Wind (RTSW L1 1-minute feeds):
 *   https://services.swpc.noaa.gov/json/rtsw/rtsw_wind_1m.json
 *   https://services.swpc.noaa.gov/json/rtsw/rtsw_mag_1m.json
 * - Operational Summary Feeds:
 *   https://services.swpc.noaa.gov/products/summary/solar-wind-speed.json
 *   https://services.swpc.noaa.gov/products/summary/solar-wind-mag-field.json
 */

export const NOAA_ENDPOINTS = {
  // Real-time propagated L1 solar wind (1-hour lightweight table containing both plasma & IMF)
  propagated1Hour: 'https://services.swpc.noaa.gov/products/geospace/propagated-solar-wind-1-hour.json',
  // Full multi-day propagated feed (fallback)
  propagatedFallback: 'https://services.swpc.noaa.gov/products/geospace/propagated-solar-wind.json',
  // Real-time Solar Wind (RTSW 1-minute plasma)
  plasmaPrimary: 'https://services.swpc.noaa.gov/json/rtsw/rtsw_wind_1m.json',
  plasmaFallback: 'https://services.swpc.noaa.gov/products/geospace/propagated-solar-wind-1-hour.json',
  // Real-time Solar Wind (RTSW 1-minute magnetic field)
  magPrimary: 'https://services.swpc.noaa.gov/json/rtsw/rtsw_mag_1m.json',
  magFallback: 'https://services.swpc.noaa.gov/products/geospace/propagated-solar-wind-1-hour.json',
  // Operational 1-minute summary feeds
  speedSummary: 'https://services.swpc.noaa.gov/products/summary/solar-wind-speed.json',
  magSummary: 'https://services.swpc.noaa.gov/products/summary/solar-wind-mag-field.json',
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
  source: 'NOAA SWPC Live Feed Unavailable (Offline / Standby)',
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
 * Helper to fetch a single JSON endpoint with timeout guard.
 *
 * @param {string} url
 * @param {number} timeoutMs
 * @returns {Promise<any[] | null>}
 */
async function fetchEndpoint(url, timeoutMs = 6000) {
  if (!url) return null;
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
    return Array.isArray(data) && data.length > 0 ? data : null;
  } catch {
    clearTimeout(timer);
    return null;
  }
}

/**
 * Helper to fetch a JSON endpoint with an automatic fallback URL if 404/network fails.
 *
 * @param {string} primaryUrl
 * @param {string} fallbackUrl
 * @param {number} timeoutMs
 * @returns {Promise<any[] | null>}
 */
export async function fetchWithFallback(primaryUrl, fallbackUrl, timeoutMs = 8000) {
  const primaryResult = await fetchEndpoint(primaryUrl, timeoutMs);
  if (primaryResult && primaryResult.length > 0) {
    return primaryResult;
  }

  if (fallbackUrl) {
    return await fetchEndpoint(fallbackUrl, timeoutMs);
  }

  return null;
}

/**
 * Extracts the most recent valid solar wind plasma measurement from NOAA JSON array.
 * Supports:
 * - NOAA SWPC 2D array format with headers ([["time_tag","speed","density","temperature",...], ...])
 * - Legacy 2D array format ([["time_tag","density","speed","temperature"], ...])
 * - Modern RTSW and summary object array format ([{ proton_speed, proton_density, proton_temperature, time_tag }, ...])
 *
 * @param {Array<any>} array
 * @returns {{ density: number | null, speed: number, temperature: number, timestamp: string } | null}
 */
export function parseLatestPlasma(array) {
  if (!Array.isArray(array) || array.length === 0) return null;

  const isTable = Array.isArray(array[0]);
  let hasHeader = false;
  let speedIdx = 2;
  let densityIdx = 1;
  let tempIdx = 3;
  let timeIdx = 0;

  if (isTable) {
    const headerStrings = array[0].map((col) => String(col).toLowerCase().trim());
    const recognizedHeader = headerStrings.some((h) =>
      ['time_tag', 'time', 'speed', 'proton_speed', 'density', 'proton_density', 'temperature'].includes(h)
    );
    if (recognizedHeader) {
      hasHeader = true;
      const sIdx = headerStrings.findIndex((h) => h === 'speed' || h === 'proton_speed' || h.includes('speed'));
      const dIdx = headerStrings.findIndex((h) => h === 'density' || h === 'proton_density' || h.includes('density'));
      const tIdx = headerStrings.findIndex((h) => h === 'temperature' || h === 'proton_temperature' || h.includes('temp'));
      const tmIdx = headerStrings.findIndex((h) => h === 'time_tag' || h.includes('time'));
      if (sIdx !== -1) speedIdx = sIdx;
      if (dIdx !== -1) densityIdx = dIdx;
      if (tIdx !== -1) tempIdx = tIdx;
      if (tmIdx !== -1) timeIdx = tmIdx;
    }
  }

  const startIdx = hasHeader ? 1 : 0;

  for (let i = array.length - 1; i >= startIdx; i--) {
    const entry = array[i];
    if (!entry) continue;

    const densityRaw = Array.isArray(entry) ? entry[densityIdx] : (entry.density ?? entry.proton_density);
    const speedRaw = Array.isArray(entry) ? entry[speedIdx] : (entry.speed ?? entry.proton_speed);
    const tempRaw = Array.isArray(entry) ? entry[tempIdx] : (entry.temperature ?? entry.proton_temperature);
    const timeTag = Array.isArray(entry) ? entry[timeIdx] : entry.time_tag;

    const density = densityRaw != null && densityRaw !== '' ? parseFloat(densityRaw) : NaN;
    const speed = speedRaw != null && speedRaw !== '' ? parseFloat(speedRaw) : NaN;
    const temperature = tempRaw != null && tempRaw !== '' ? parseFloat(tempRaw) : NaN;

    if (!isNaN(speed) && speed > 0) {
      return {
        density: !isNaN(density) ? Number(density.toFixed(2)) : null,
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
 * Supports:
 * - NOAA SWPC 2D array format with headers ([["time_tag",...,"bz","bt",...], ...])
 * - Legacy 2D array format ([["time_tag","bx_gsm","by_gsm","bz_gsm","lon_gsm","lat_gsm","bt"], ...])
 * - Modern RTSW and summary object array format ([{ bt, bz_gsm, bz_gse, time_tag }, ...])
 *
 * @param {Array<any>} array
 * @returns {{ bz: number | null, bt: number | null, timestamp: string } | null}
 */
export function parseLatestMag(array) {
  if (!Array.isArray(array) || array.length === 0) return null;

  const isTable = Array.isArray(array[0]);
  let hasHeader = false;
  let bzIdx = 3;
  let btIdx = 6;
  let timeIdx = 0;

  if (isTable) {
    const headerStrings = array[0].map((col) => String(col).toLowerCase().trim());
    const recognizedHeader = headerStrings.some((h) =>
      ['time_tag', 'time', 'bz', 'bz_gsm', 'bz_gse', 'bt', 'bx'].includes(h)
    );
    if (recognizedHeader) {
      hasHeader = true;
      const bzMatch = headerStrings.findIndex((h) => h === 'bz' || h === 'bz_gsm' || h === 'bz_gse');
      const btMatch = headerStrings.findIndex((h) => h === 'bt');
      const tmMatch = headerStrings.findIndex((h) => h === 'time_tag' || h.includes('time'));
      if (bzMatch !== -1) bzIdx = bzMatch;
      if (btMatch !== -1) btIdx = btMatch;
      if (tmMatch !== -1) timeIdx = tmMatch;
    }
  }

  const startIdx = hasHeader ? 1 : 0;

  for (let i = array.length - 1; i >= startIdx; i--) {
    const entry = array[i];
    if (!entry) continue;

    const bzRaw = Array.isArray(entry) ? entry[bzIdx] : (entry.bz ?? entry.bz_gsm ?? entry.bz_gse);
    const btRaw = Array.isArray(entry) ? entry[btIdx] : entry.bt;
    const timeTag = Array.isArray(entry) ? entry[timeIdx] : entry.time_tag;

    const bz = bzRaw != null && bzRaw !== '' ? parseFloat(bzRaw) : NaN;
    const bt = btRaw != null && btRaw !== '' ? parseFloat(btRaw) : NaN;

    if (!isNaN(bz) || !isNaN(bt)) {
      return {
        bz: !isNaN(bz) ? Number(bz.toFixed(2)) : null,
        bt: !isNaN(bt) ? Number(bt.toFixed(2)) : (!isNaN(bz) ? Number(Math.abs(bz).toFixed(2)) : null),
        timestamp: timeTag || new Date().toISOString(),
      };
    }
  }

  return null;
}

/**
 * Fetches real-time space weather telemetry from NOAA SWPC.
 * Results are cached in-memory for 5 minutes.
 *
 * Strategy:
 * 1. Propagated solar wind 1-hour feed (fast, consolidated plasma + IMF)
 * 2. Real-time solar wind (RTSW 1-minute plasma & IMF feeds)
 * 3. SWPC operational summary feeds (speed & mag field)
 * 4. Fallback to explicit offline/unavailable state (no fabricated data)
 *
 * @param {boolean} [forceRefresh=false] - Ignore cache and trigger network fetch
 * @returns {Promise<{
 *   density: number | null,
 *   speed: number | null,
 *   temperature: number | null,
 *   bz: number | null,
 *   bt: number | null,
 *   speedStatus: string,
 *   timestamp: string,
 *   source: string,
 *   isFallback: boolean,
 *   isUnavailable: boolean,
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
    // 1. Primary Strategy: Propagated Solar Wind 1-hour feed (lightweight, contains both plasma and IMF)
    let tableData = await fetchEndpoint(NOAA_ENDPOINTS.propagated1Hour, 5000);
    if (!tableData) {
      tableData = await fetchEndpoint(NOAA_ENDPOINTS.propagatedFallback, 6000);
    }

    if (tableData) {
      const plasma = parseLatestPlasma(tableData);
      const mag = parseLatestMag(tableData);

      if (plasma && mag) {
        const liveResult = {
          density: plasma.density,
          speed: plasma.speed,
          temperature: plasma.temperature,
          bz: mag.bz,
          bt: mag.bt,
          speedStatus: categorizeSolarWindSpeed(plasma.speed),
          timestamp: plasma.timestamp || mag.timestamp || new Date(now).toISOString(),
          source: 'NOAA SWPC Real-Time L1 Telemetry (Measured)',
          isFallback: false,
          isUnavailable: false,
          cached: false,
        };
        cache = { data: liveResult, timestamp: now };
        return liveResult;
      }
    }

    // 2. Secondary Strategy: Real-Time Solar Wind (RTSW 1m feeds)
    const [plasmaRaw, magRaw] = await Promise.all([
      fetchEndpoint(NOAA_ENDPOINTS.plasmaPrimary, 5000),
      fetchEndpoint(NOAA_ENDPOINTS.magPrimary, 5000),
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
      cache = { data: liveResult, timestamp: now };
      return liveResult;
    }

    // 3. Tertiary Strategy: NOAA operational 1-minute summaries
    const [speedRaw, magSummaryRaw] = await Promise.all([
      fetchEndpoint(NOAA_ENDPOINTS.speedSummary, 4000),
      fetchEndpoint(NOAA_ENDPOINTS.magSummary, 4000),
    ]);

    const summaryPlasma = parseLatestPlasma(speedRaw) || plasma;
    const summaryMag = parseLatestMag(magSummaryRaw) || mag;

    if (summaryPlasma || summaryMag) {
      const speed = summaryPlasma?.speed ?? null;
      const density = summaryPlasma?.density ?? null;
      const temp = summaryPlasma?.temperature ?? 100000;
      const bz = summaryMag?.bz ?? null;
      const bt = summaryMag?.bt ?? null;

      if (speed != null || bz != null) {
        const liveResult = {
          density,
          speed,
          temperature: temp,
          bz,
          bt,
          speedStatus: categorizeSolarWindSpeed(speed),
          timestamp: summaryPlasma?.timestamp || summaryMag?.timestamp || new Date(now).toISOString(),
          source: 'NOAA SWPC Solar Wind Summary (Measured)',
          isFallback: false,
          isUnavailable: false,
          cached: false,
        };
        cache = { data: liveResult, timestamp: now };
        return liveResult;
      }
    }
  } catch {
    // Network interruption or unhandled fetch error: fall through to explicit unavailable state
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
