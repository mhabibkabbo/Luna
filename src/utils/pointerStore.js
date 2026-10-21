/**
 * Tiny external pub/sub stores so high-frequency values (pointer coordinates,
 * map zoom/resolution) update only the components that display them, instead of
 * re-rendering the whole <App /> tree on every pointer move or zoom frame.
 */
function createStore(initial) {
  let value = initial;
  const subs = new Set();
  return {
    get: () => value,
    set(next) {
      value = next;
      subs.forEach((fn) => fn(value));
    },
    subscribe(fn) {
      subs.add(fn);
      return () => subs.delete(fn);
    },
  };
}

export const pointerStore = createStore({ lon: 0, lat: 0 });
export const mapViewStore = createStore({ zoom: 2.5, resolution: 0.24859 });
