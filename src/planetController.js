/**
 * @file planetController.js
 * Documents and validates the shared API implemented by planet controllers.
 */

/**
 * @typedef {Object} PlanetController
 * @property {'moon' | 'earth'} id
 * @property {Cesium.Viewer} viewer
 * @property {() => Cesium.Viewer} getViewer
 * @property {(active: boolean) => void} setActive
 * @property {(longitude: number, latitude: number, height?: number) => void} flyTo
 * @property {() => void} zoomIn
 * @property {() => void} zoomOut
 * @property {() => void} resetOverview
 * @property {(layerId: string, visible: boolean) => void} setLayerVisibility
 * @property {() => void} destroy
 * @property {Object} extras Planet-specific APIs which are not shared by all controllers.
 */

const REQUIRED_METHODS = [
  'getViewer',
  'setActive',
  'flyTo',
  'zoomIn',
  'zoomOut',
  'resetOverview',
  'destroy',
];

/**
 * Validates the shared controller API and supplies defaults only for optional actions.
 *
 * @param {Object} controller
 * @returns {PlanetController}
 */
export function withDefaults(controller) {
  if (!controller || !['moon', 'earth'].includes(controller.id)) {
    throw new TypeError('A planet controller must have an id of "moon" or "earth".');
  }

  for (const method of REQUIRED_METHODS) {
    if (typeof controller[method] !== 'function') {
      throw new TypeError(`The ${controller.id} controller must implement ${method}().`);
    }
  }

  return {
    ...controller,
    setLayerVisibility:
      typeof controller.setLayerVisibility === 'function'
        ? controller.setLayerVisibility
        : () => {},
    toggleLighting:
      typeof controller.toggleLighting === 'function'
        ? controller.toggleLighting
        : () => false,
    toggleAutoRotate:
      typeof controller.toggleAutoRotate === 'function'
        ? controller.toggleAutoRotate
        : () => false,
    extras: controller.extras || {},
  };
}
