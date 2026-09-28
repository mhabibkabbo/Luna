/**
 * @file createPlanetManager.js
 * Controls two persistent Cesium viewers and delegates
 * commands to whichever planet is currently active.
 */

export function createPlanetManager({ moonController, earthController }) {
  const moonViewer = moonController.getViewer();
  const earthViewer = earthController.viewer;

  const controllers = {
    moon: moonController,
    earth: earthController,
  };

  const viewers = {
    moon: moonViewer,
    earth: earthViewer,
  };

  let activePlanet = "moon";

  function setViewerActive(viewer, active) {
    viewer.useDefaultRenderLoop = active;
    viewer.container.style.display = active ? "block" : "none";
  }

  function switchTo(planetName) {
    if (!(planetName in controllers)) {
      throw new Error(`Unknown planet: "${planetName}"`);
    }

    if (planetName === activePlanet) {
      return;
    }

    setViewerActive(viewers[activePlanet], false);
    setViewerActive(viewers[planetName], true);

    activePlanet = planetName;
  }

  function getActivePlanet() {
    return activePlanet;
  }

  function getActiveController() {
    return controllers[activePlanet];
  }

  // --- Delegate methods ---------------------------------------------------

  function toggleLighting() {
    return getActiveController()?.toggleLighting?.();
  }

  function toggleAutoRotate() {
    return getActiveController()?.toggleAutoRotate?.();
  }

  function setLayerVisibility(layerId, isVisible) {
    getActiveController()?.setLayerVisibility?.(layerId, isVisible);
  }

  function dropCustomPin(lon, lat, name) {
    return moonController.dropCustomPin?.(lon, lat, name);
  }

  function clearCustomPin() {
    moonController.clearCustomPin?.();
  }

  function setCelestialTime(when) {
    moonController.setCelestialTime(when);
  }

  function setCelestialVisible(visible) {
    moonController.setCelestialVisible(visible);
  }

  function flyToCelestialOverview() {
    moonController.flyToCelestialOverview();
  }

  function resetOverview() {
    getActiveController()?.resetOverview();
  }

  function zoomIn() {
    getActiveController()?.zoomIn();
  }

  function zoomOut() {
    getActiveController()?.zoomOut();
  }

  function flyToCoordinate(longitude, latitude, height) {
    getActiveController()?.flyToCoordinate(
      longitude,
      latitude,
      height
    );
  }

  function destroy() {
    moonController.destroy();
    earthController.destroy();
  }

  // --- Initial viewer state -----------------------------------------------

  setViewerActive(moonViewer, true);
  setViewerActive(earthViewer, false);

  // --- Public API ----------------------------------------------------------

  return {
    switchTo,
    getActivePlanet,
    getActiveController,

    resetOverview,
    zoomIn,
    zoomOut,
    flyToCoordinate,

    toggleLighting,
    toggleAutoRotate,
    setLayerVisibility,

    dropCustomPin,
    clearCustomPin,

    setCelestialTime,
    setCelestialVisible,
    flyToCelestialOverview,

    destroy,
  };
}
