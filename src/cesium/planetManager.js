import * as Cesium from 'cesium';
import { createEarth } from './earth/index.js';
import { createMoon } from './moon/index.js';
import { withDefaults } from './planetController.js';

const PLANET_FACTORIES = {
  moon: createMoon,
  earth: createEarth,
};

/**
 * Creates planet controllers lazily and coordinates their shared visibility and lifecycle.
 *
 * @param {{
 *   containers: { moon: HTMLElement, earth: HTMLElement },
 *   callbacks?: Object,
 *   initialPlanet?: 'moon' | 'earth',
 *   isVisible?: boolean
 * }} options
 */
export function createPlanetManager({
  containers,
  callbacks = {},
  initialPlanet = 'moon',
  isVisible = true,
}) {
  const controllers = new Map();
  let activeId = initialPlanet === 'earth' ? 'earth' : 'moon';
  let viewportVisible = isVisible;
  let destroyed = false;
  let pendingCommunicationLink = null;

  function assertPlanetId(id) {
    if (!Object.hasOwn(PLANET_FACTORIES, id)) {
      throw new Error(`Unknown planet: "${id}"`);
    }
  }

  function hasPlanet(id) {
    return controllers.has(id);
  }

  function getInitializedPlanets() {
    return Array.from(controllers.keys());
  }

  function getPlanet(id) {
    if (destroyed) {
      throw new Error('Cannot access a planet after the manager has been destroyed.');
    }
    assertPlanetId(id);

    if (!controllers.has(id)) {
      const container = containers[id];
      if (!container) {
        throw new Error(`The ${id} viewer container is not available.`);
      }

      const createController = PLANET_FACTORIES[id];
      const controller = withDefaults(createController(container, callbacks));
      controllers.set(id, controller);
      try {
        controller.setActive(false);
        if (pendingCommunicationLink !== null) {
          controller.setCommunicationLink(pendingCommunicationLink);
        }
      } catch (error) {
        controllers.delete(id);
        try {
          controller.destroy();
        } catch (cleanupError) {
          throw new AggregateError(
            [error, cleanupError],
            `Failed to initialize and clean up the ${id} controller.`
          );
        }
        throw error;
      }
    }

    return controllers.get(id);
  }

  function setControllerActive(controller, active) {
    controller.setActive(active && viewportVisible);
  }

  function switchTo(id) {
    assertPlanetId(id);
    if (id === activeId && controllers.has(id)) return;

    if ('default' in Cesium.Ellipsoid) {
      Cesium.Ellipsoid.default = id === 'earth' ? Cesium.Ellipsoid.WGS84 : Cesium.Ellipsoid.MOON;
    }

    const target = getPlanet(id);
    const current = controllers.get(activeId);

    if (!viewportVisible) {
      setControllerActive(target, false);
    } else {
      if (current && current !== target) {
        setControllerActive(current, false);
      }
      try {
        setControllerActive(target, true);
      } catch (error) {
        try {
          if (current && current !== target) {
            setControllerActive(current, true);
          }
        } catch (restoreError) {
          throw new AggregateError(
            [error, restoreError],
            `Failed to activate ${id} and restore ${activeId}.`
          );
        }
        throw error;
      }
    }

    activeId = id;
  }

  function setCommunicationLink(link) {
    if (destroyed) return;
    pendingCommunicationLink = link;
    for (const controller of controllers.values()) {
      try {
        controller.setCommunicationLink(link);
      } catch {}
    }
  }

  function setVisible(visible) {
    if (destroyed) return;
    viewportVisible = Boolean(visible);
    const errors = [];
    for (const [id, controller] of controllers) {
      try {
        setControllerActive(controller, id === activeId);
      } catch (error) {
        errors.push(error);
      }
    }
    if (errors.length) {
      throw new AggregateError(errors, 'One or more planet viewers failed to update visibility.');
    }
  }

  function destroy() {
    if (destroyed) return;
    destroyed = true;
    pendingCommunicationLink = null;

    const errors = [];
    for (const controller of controllers.values()) {
      try {
        controller.destroy();
      } catch (error) {
        errors.push(error);
      }
    }
    controllers.clear();

    if (errors.length) {
      throw new AggregateError(errors, 'One or more planet controllers failed to destroy.');
    }
  }

  const manager = {
    get activeId() {
      return activeId;
    },
    get active() {
      return getPlanet(activeId);
    },
    hasPlanet,
    getInitializedPlanets,
    planet: getPlanet,
    switchTo,
    setCommunicationLink,
    setVisible,
    destroy,
  };

  assertPlanetId(initialPlanet);
  activeId = initialPlanet;
  if ('default' in Cesium.Ellipsoid) {
    Cesium.Ellipsoid.default =
      initialPlanet === 'earth' ? Cesium.Ellipsoid.WGS84 : Cesium.Ellipsoid.MOON;
  }
  const initialController = getPlanet(initialPlanet);
  setControllerActive(initialController, true);

  return manager;
}
