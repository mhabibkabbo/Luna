/**
 * @file createPlanetManager.js
 * Controls two persistent Cesium viewers and delegates
 * commands to whichever planet is currently active.
 */

export function createPlanetManager({
  moonController,
  earthController,
}) {
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

  let activePlanet = 'moon';

  function setViewerActive(viewer, active) {
    viewer.useDefaultRenderLoop = active;
    viewer.container.style.display =
      active ? 'block' : 'none';
  }

  
  function switchTo(planetName) {
    if (!(planetName in controllers)) {
      throw new Error(
        `Unknown planet: "${planetName}"`
      );
    }
    
    if (planetName === activePlanet) {
      return;
    }
    
    setViewerActive(
      viewers[activePlanet],
      false
    );
    
    setViewerActive(
      viewers[planetName],
      true
    );
    
    activePlanet = planetName;
  }
  
  function getActivePlanet() {
    return activePlanet;
  }
  
  function getActiveController() {
    return controllers[activePlanet];
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
    getActiveController().resetOverview();
  }

  function zoomIn() {
    getActiveController().zoomIn();
  }

  function zoomOut() {
    getActiveController().zoomOut();
  }

  function flyToCoordinate(
    longitude,
    latitude,
    height
  ) {
    getActiveController().flyToCoordinate(
      longitude,
      latitude,
      height
    );
  }

  function destroy() {
    moonController.destroy();
    earthController.destroy();
  }

  // Start with Moon visible.
  setViewerActive(moonViewer, true);
  setViewerActive(earthViewer, false);

  return {
    switchTo,
    getActivePlanet,
    getActiveController,

    resetOverview,
    zoomIn,
    zoomOut,
    flyToCoordinate,

    setCelestialTime,
    setCelestialVisible,
    flyToCelestialOverview,

    destroy,
  };
}