/**
 * @file planetManager.js
 * Lazily creates planet controllers and coordinates switching and cleanup.
 */

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
  let activeId = 'moon';
  let viewportVisible = isVisible;
  let destroyed = false;

  function assertPlanetId(id) {
    if (!Object.hasOwn(PLANET_FACTORIES, id)) {
      throw new Error(`Unknown planet: "${id}"`);
    }
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
      const controller = withDefaults(
        id === 'moon'
          ? createController(container, callbacks)
          : createController(container)
      );
      controllers.set(id, controller);
      try {
        controller.setActive(false);
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
    if (id === activeId) return;

    // Initialize the target before changing the active viewer, so a failed factory
    // leaves the currently visible planet untouched.
    const target = getPlanet(id);
    const current = controllers.get(activeId);

    if (!viewportVisible) {
      setControllerActive(target, false);
    } else {
      setControllerActive(current, false);
      try {
        setControllerActive(target, true);
      } catch (error) {
        try {
          setControllerActive(current, true);
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
    planet: getPlanet,
    switchTo,
    setVisible,
    destroy,
  };

  assertPlanetId(initialPlanet);
  const moonController = getPlanet('moon');
  if (initialPlanet === 'moon') {
    setControllerActive(moonController, true);
  } else {
    switchTo(initialPlanet);
  }

  return manager;
}
