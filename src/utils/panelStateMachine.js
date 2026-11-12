/**
 * Checks whether a feature or location object has valid Lunar South Pole DEM coordinates (80°S–90°S).
 *
 * @param {Object | null | undefined} feature
 * @returns {boolean}
 */
export function isEligibleSouthPoleRoutePoint(feature) {
  if (!feature) return false;
  const lat = feature.latitude ?? feature.lat;
  const lon = feature.longitude ?? feature.lon;
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return false;
  if (feature.body && feature.body !== 'moon') return false;
  return lat <= -79.9 && lat >= -90.0;
}

/**
 * Converts a selected feature or location into a normalized Route Planner waypoint.
 *
 * @param {Object | null | undefined} feature
 * @returns {{ lat: number, lon: number, name: string } | null}
 */
export function featureToRouteWaypoint(feature) {
  if (!isEligibleSouthPoleRoutePoint(feature)) return null;
  const lat = feature.latitude ?? feature.lat;
  const lon = feature.longitude ?? feature.lon;
  const name =
    feature.name ||
    feature.shortName ||
    `${Math.abs(lat).toFixed(2)}°S, ${Math.abs(lon).toFixed(2)}°${lon >= 0 ? 'E' : 'W'}`;
  return { lat, lon, name };
}

/**
 * Transition when a user selects a location on the map.
 * - Stores the normalized selected feature as persistent state.
 * - Opens the contextual location panel only when Route Planner is not active.
 *
 * @param {{
 *   selectedFeature: Object | null,
 *   isFeaturePanelOpen: boolean,
 *   isRouteActive: boolean,
 *   routeStartPoint: Object | null,
 *   routeGoalPoint: Object | null
 * }} state
 * @param {Object | null} nextFeature
 * @returns {{
 *   selectedFeature: Object | null,
 *   isFeaturePanelOpen: boolean,
 *   isRouteActive: boolean,
 *   routeStartPoint: Object | null,
 *   routeGoalPoint: Object | null
 * }}
 */
export function transitionSelectLocation(state, nextFeature) {
  if (!nextFeature) {
    return {
      ...state,
      selectedFeature: null,
      isFeaturePanelOpen: false,
    };
  }

  return {
    ...state,
    selectedFeature: nextFeature,
    isFeaturePanelOpen: !state.isRouteActive,
  };
}

/**
 * Transition when opening or closing the Surface Route Planner.
 * - Opening Route Planner immediately closes and hides the contextual location panel,
 *   preserves selectedFeature, and if a valid South Pole location is selected and
 *   routeStartPoint is unset, initializes routeStartPoint from selectedFeature.
 * - Closing Route Planner preserves selectedFeature and keeps panel states clean.
 *
 * @param {{
 *   selectedFeature: Object | null,
 *   isFeaturePanelOpen: boolean,
 *   isRouteActive: boolean,
 *   routeStartPoint: Object | null,
 *   routeGoalPoint: Object | null
 * }} state
 * @param {boolean} [forceActive] - Optional explicit target state for isRouteActive
 * @returns {{
 *   selectedFeature: Object | null,
 *   isFeaturePanelOpen: boolean,
 *   isRouteActive: boolean,
 *   routeStartPoint: Object | null,
 *   routeGoalPoint: Object | null
 * }}
 */
export function transitionToggleRoutePlanner(state, forceActive) {
  const nextRouteActive =
    typeof forceActive === 'boolean' ? forceActive : !state.isRouteActive;

  if (nextRouteActive) {
    const candidateStart =
      (!state.routeStartPoint || !state.routeGoalPoint) && state.selectedFeature
        ? featureToRouteWaypoint(state.selectedFeature)
        : state.routeStartPoint;

    return {
      ...state,
      isRouteActive: true,
      isFeaturePanelOpen: false,
      routeStartPoint: candidateStart || state.routeStartPoint || null,
    };
  }

  return {
    ...state,
    isRouteActive: false,
    isFeaturePanelOpen: false,
  };
}

/**
 * Transition when closing the contextual location information panel.
 * - Hides the panel (isFeaturePanelOpen = false) while preserving selectedFeature.
 *
 * @param {{
 *   selectedFeature: Object | null,
 *   isFeaturePanelOpen: boolean,
 *   isRouteActive: boolean,
 *   routeStartPoint: Object | null,
 *   routeGoalPoint: Object | null
 * }} state
 * @returns {{
 *   selectedFeature: Object | null,
 *   isFeaturePanelOpen: boolean,
 *   isRouteActive: boolean,
 *   routeStartPoint: Object | null,
 *   routeGoalPoint: Object | null
 * }}
 */
export function transitionCloseLocationPanel(state) {
  return {
    ...state,
    isFeaturePanelOpen: false,
  };
}

/**
 * Transition when reopening the contextual location information panel for the
 * currently preserved selectedFeature.
 * - Ensures mutual exclusivity by closing Route Planner if active.
 *
 * @param {{
 *   selectedFeature: Object | null,
 *   isFeaturePanelOpen: boolean,
 *   isRouteActive: boolean,
 *   routeStartPoint: Object | null,
 *   routeGoalPoint: Object | null
 * }} state
 * @returns {{
 *   selectedFeature: Object | null,
 *   isFeaturePanelOpen: boolean,
 *   isRouteActive: boolean,
 *   routeStartPoint: Object | null,
 *   routeGoalPoint: Object | null
 * }}
 */
export function transitionReopenLocationPanel(state) {
  if (!state.selectedFeature) {
    return {
      ...state,
      isFeaturePanelOpen: false,
    };
  }

  return {
    ...state,
    isRouteActive: false,
    isFeaturePanelOpen: true,
  };
}
