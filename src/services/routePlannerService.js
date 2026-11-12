import { computeSurfaceRoute, profileRouteIllumination } from '../utils/routePlanner.js';

let workerInstance = null;
let reqIdCounter = 0;
const pendingRequests = new Map();

function getWorker() {
  if (!workerInstance && typeof window !== 'undefined' && typeof window.Worker !== 'undefined') {
    try {
      workerInstance = new Worker(
        new URL('../workers/routePlanner.worker.js', import.meta.url),
        { type: 'module' }
      );

      workerInstance.onmessage = (event) => {
        const { type, id, payload, error } = event.data || {};
        const pending = pendingRequests.get(id);
        if (!pending) return;

        pendingRequests.delete(id);
        if (type === 'ROUTE_ERROR') {
          pending.reject(new Error(error || 'Route planner worker error'));
        } else {
          pending.resolve(payload);
        }
      };

      workerInstance.onerror = (err) => {
        console.error('[routePlannerService] Worker error:', err);
        const crashedWorker = workerInstance;
        workerInstance = null;
        try {
          crashedWorker?.terminate?.();
        } catch {
          // Ignore termination failures on crashed worker
        }
        for (const [id, pending] of pendingRequests.entries()) {
          pending.reject(err instanceof Error ? err : new Error(err?.message || 'Route planner worker error'));
          pendingRequests.delete(id);
        }
      };
    } catch {
      workerInstance = null;
    }
  }
  return workerInstance;
}

/**
 * Plans a rover surface route with illumination profiling.
 *
 * @param {Object} start - { lat, lon }
 * @param {Object} goal - { lat, lon }
 * @param {Object} [options] - Rover constraints (maxSlopeDeg, roverSpeedKmh, etc.)
 * @param {Object} [illuminationOptions] - Solar options (startEpochMs, roverSpeedKmh)
 * @returns {Promise<Object>}
 */
export async function planRoverTraverse(start, goal, options = {}, illuminationOptions = {}) {
  const worker = getWorker();
  if (worker) {
    const id = ++reqIdCounter;
    return new Promise((resolve, reject) => {
      pendingRequests.set(id, { resolve, reject });
      worker.postMessage({
        type: 'COMPUTE_ROUTE',
        id,
        payload: {
          start,
          goal,
          options,
          illuminationOptions,
        },
      });
    });
  }

  // Headless/fallback direct computation
  const routeResult = await computeSurfaceRoute(start, goal, options);
  if (!routeResult.success) {
    return routeResult;
  }
  const profiledWaypoints = profileRouteIllumination(routeResult.waypoints, illuminationOptions);
  let sunlitCount = 0;
  let blockedCount = 0;
  let nightCount = 0;
  for (const wp of profiledWaypoints) {
    if (wp.sunStatus === 'sunlit') sunlitCount++;
    else if (wp.sunStatus === 'night') nightCount++;
    else blockedCount++;
  }
  const totalWp = Math.max(1, profiledWaypoints.length);
  return {
    ...routeResult,
    waypoints: profiledWaypoints,
    sunlitPct: Math.round((sunlitCount / totalWp) * 100),
    shadowedPct: Math.round(((blockedCount + nightCount) / totalWp) * 100),
    sunlitCount,
    shadowedCount: blockedCount + nightCount,
  };
}

export function terminateRoutePlannerWorker() {
  if (workerInstance) {
    for (const [id, pending] of pendingRequests.entries()) {
      pending.reject(new Error('Route planner worker terminated'));
      pendingRequests.delete(id);
    }
    workerInstance.terminate();
    workerInstance = null;
  }
}
