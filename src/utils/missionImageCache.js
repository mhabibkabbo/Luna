const memoryImageCache = new Map();
const inFlightPromises = new Map();

const CACHE_NAME = 'luna-missions-images-v1';

/**
 * Returns true if the image is already decoded and stored in memory.
 * @param {string} url
 * @returns {boolean}
 */
export function isImageDecoded(url) {
  return memoryImageCache.has(url);
}

/**
 * Preload and decode a single image into memory and persistent CacheStorage.
 * @param {string} url
 * @param {'high'|'low'|'auto'} [priority='auto']
 * @returns {Promise<string>}
 */
export function preloadImage(url, priority = 'auto') {
  if (!url) return Promise.resolve('');

  if (memoryImageCache.has(url)) {
    return Promise.resolve(url);
  }

  if (inFlightPromises.has(url)) {
    return inFlightPromises.get(url);
  }

  if (typeof window === 'undefined' || typeof Image === 'undefined') {
    return Promise.resolve(url);
  }

  const promise = new Promise((resolve) => {
    const img = new Image();
    img.decoding = 'async';
    if ('fetchPriority' in img) {
      img.fetchPriority = priority;
    }

    img.onload = () => {
      if (typeof img.decode === 'function') {
        img
          .decode()
          .then(() => {
            memoryImageCache.set(url, img);
            inFlightPromises.delete(url);
            resolve(url);
          })
          .catch(() => {
            memoryImageCache.set(url, img);
            inFlightPromises.delete(url);
            resolve(url);
          });
      } else {
        memoryImageCache.set(url, img);
        inFlightPromises.delete(url);
        resolve(url);
      }
    };

    img.onerror = () => {
      inFlightPromises.delete(url);
      resolve(url);
    };

    img.src = url;

    if (typeof window !== 'undefined' && 'caches' in window) {
      window.caches
        .open(CACHE_NAME)
        .then((cache) => cache.add(url))
        .catch(() => {
          // Ignore cache errors in private mode or unsupported schemes
        });
    }
  });

  inFlightPromises.set(url, promise);
  return promise;
}

/**
 * Preload adjacent mission images with high priority, and others in idle time.
 * @param {Array<{id: string}>} missions
 * @param {number} activeIndex
 */
export function preloadAdjacentMissionImages(missions, activeIndex = 0) {
  if (!missions || !missions.length) return;

  const getMissionUrl = (idx) => {
    if (idx === -1) return '/images/missions/home.webp';
    const mission = missions[idx];
    return mission ? `/images/missions/${mission.id}.webp` : null;
  };

  const priorityIndices = [
    activeIndex - 1, // hero or prev
    activeIndex,     // current mission
    activeIndex + 1, // next
    activeIndex + 2, // next+1
    activeIndex - 2, // prev-1
  ];

  priorityIndices.forEach((idx) => {
    const url = getMissionUrl(idx);
    if (url) {
      preloadImage(url, 'high');
    }
  });

  const idleCallback =
    typeof window !== 'undefined' && window.requestIdleCallback
      ? window.requestIdleCallback
      : (cb) => setTimeout(cb, 200);

  idleCallback(() => {
    missions.forEach((m) => {
      const url = `/images/missions/${m.id}.webp`;
      if (!memoryImageCache.has(url) && !inFlightPromises.has(url)) {
        preloadImage(url, 'low');
      }
    });
  });
}

/**
 * Eagerly preloads all mission images in catalog.
 * Useful for hover preloading from navigation links.
 * @param {Array<{id: string}>} [missions]
 */
export function preloadEntireMissionCatalog(missions = []) {
  const homeUrl = '/images/missions/home.webp';
  preloadImage(homeUrl, 'high');

  if (!missions || !missions.length) return;

  missions.slice(0, 3).forEach((m) => {
    preloadImage(`/images/missions/${m.id}.webp`, 'high');
  });

  const scheduleTimer = setTimeout(() => {
    missions.slice(3).forEach((m, idx) => {
      setTimeout(() => {
        preloadImage(`/images/missions/${m.id}.webp`, 'low');
      }, idx * 60);
    });
  }, 100);

  return () => clearTimeout(scheduleTimer);
}
