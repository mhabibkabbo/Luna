import { computeSurfaceRoute, profileRouteIllumination } from '../utils/routePlanner.js';

self.onmessage = async (e) => {
  const { type, id, payload } = e.data || {};

  if (type === 'COMPUTE_ROUTE') {
    try {
      const { start, goal, options, illuminationOptions } = payload;
      const routeResult = await computeSurfaceRoute(start, goal, options);

      if (!routeResult.success) {
        self.postMessage({
          type: 'ROUTE_RESULT',
          id,
          payload: routeResult,
        });
        return;
      }

      const profiledWaypoints = profileRouteIllumination(
        routeResult.waypoints,
        illuminationOptions
      );

      let sunlitCount = 0;
      let blockedCount = 0;
      let nightCount = 0;
      for (const wp of profiledWaypoints) {
        if (wp.sunStatus === 'sunlit') sunlitCount++;
        else if (wp.sunStatus === 'night') nightCount++;
        else blockedCount++;
      }
      const totalWp = Math.max(1, profiledWaypoints.length);
      const sunlitPct = Math.round((sunlitCount / totalWp) * 100);
      const shadowedPct = Math.round(((blockedCount + nightCount) / totalWp) * 100);

      self.postMessage({
        type: 'ROUTE_RESULT',
        id,
        payload: {
          ...routeResult,
          waypoints: profiledWaypoints,
          sunlitPct,
          shadowedPct,
          sunlitCount,
          shadowedCount: blockedCount + nightCount,
        },
      });
    } catch (err) {
      self.postMessage({
        type: 'ROUTE_ERROR',
        id,
        error: err?.message || 'Route planning worker error',
      });
    }
  }
};
