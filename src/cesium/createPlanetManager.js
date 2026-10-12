/**
 * @file createPlanetManager.js
 * Controls two persistent Cesium viewers and delegates
 * commands to whichever planet is currently active.
 */

export function createPlanetManager({ moonController, earthController: initialEarthController, getEarthController }) {
  const moonViewer = moonController.getViewer();
  let earthController = initialEarthController || null;
  let earthViewer = earthController?.viewer || null;

  let activePlanet = "moon";

  function setViewerActive(viewer, active) {
    if (!viewer) return;
    viewer.useDefaultRenderLoop = active;
    if (viewer.container) {
      viewer.container.style.display = active ? "block" : "none";
    }
    if (active) {
      viewer.resize?.();
      viewer.scene?.requestRender?.();
    }
  }

  function ensureEarth() {
    if (!earthController && getEarthController) {
      earthController = getEarthController();
      if (earthController) {
        earthViewer = earthController.viewer;
        setViewerActive(earthViewer, false);
      }
    }
    return earthController;
  }

  function switchTo(planetName) {
    if (planetName !== 'moon' && planetName !== 'earth') {
      throw new Error(`Unknown planet: "${planetName}"`);
    }

    if (planetName === activePlanet) {
      return;
    }

    if (planetName === 'earth') {
      ensureEarth();
    }

    const currentViewer = activePlanet === 'moon' ? moonViewer : earthViewer;
    const targetViewer = planetName === 'moon' ? moonViewer : earthViewer;

    if (currentViewer) setViewerActive(currentViewer, false);
    if (targetViewer) setViewerActive(targetViewer, true);

    activePlanet = planetName;
  }

  function getActivePlanet() {
    return activePlanet;
  }

  function getActiveController() {
    if (activePlanet === 'earth') {
      return ensureEarth();
    }
    return moonController;
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

  function selectFeaturePin(featureId) {
    moonController.selectFeaturePin?.(featureId);
  }

  function setCelestialTime(when) {
    return moonController.setCelestialTime?.(when);
  }

  function setCelestialVisible(visible) {
    moonController.setCelestialVisible?.(visible);
  }

  function setCelestialVectorsVisible(visible) {
    return moonController.setCelestialVectorsVisible?.(visible);
  }

  function areCelestialVectorsVisible() {
    return moonController.areCelestialVectorsVisible?.() ?? false;
  }

  function flyToCelestialOverview() {
    moonController.flyToCelestialOverview?.();
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
    moonController?.destroy?.();
    earthController?.destroy?.();
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
    selectFeaturePin,

    setCelestialTime,
    setCelestialVisible,
    setCelestialVectorsVisible,
    areCelestialVectorsVisible,
    flyToCelestialOverview,

    destroy,
  };
}
