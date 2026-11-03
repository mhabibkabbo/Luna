/**
 * @file photoMap.js
 * Utility for mapping lunar features, CLPS missions, and Earth DSN stations
 * to authentic NASA mission photographs in /pictures/.
 */

export const NASA_PICTURES = [
  {
    id: 'pic-odysseus-malapert',
    title: 'IM-1 Odysseus · Malapert A',
    subtitle: 'First Commercial Lunar Soft Landing (80.13°S, 1.44°E)',
    src: '/pictures/odysseus-malapert-landing.jpg',
    credit: 'NASA / Intuitive Machines / LROC',
  },
  {
    id: 'pic-blue-ghost-crisium',
    title: 'Firefly Blue Ghost · Mare Crisium',
    subtitle: 'Mare Crisium Basalt Basin Plain (18.56°N, 61.81°E)',
    src: '/pictures/blue-ghost-mare-crisium.jpg',
    credit: 'NASA / Firefly Aerospace',
  },
  {
    id: 'pic-shackleton-ridge',
    title: 'Shackleton Connecting Ridge',
    subtitle: 'Lunar South Pole Volatile Reservoir (89.54°S, 315.0°E)',
    src: '/pictures/shackleton-polar-ridge.jpg',
    credit: 'NASA LRO LOLA Altimetry',
  },
  {
    id: 'pic-south-pole-horizon',
    title: 'Lunar South Pole Horizon & Shadowed Basins',
    subtitle: 'Extreme Low-Sun Elevation Profile (89.4°S, 0.0°E)',
    src: '/pictures/lunar-south-pole-horizon.jpg',
    credit: 'NASA LROC WFC / Goddard',
  },
  {
    id: 'pic-earth-marble',
    title: 'Earth Deep Space Network (DSN)',
    subtitle: 'Cislunar Telemetry & Ground Facilities (Goldstone / Madrid / Canberra)',
    src: '/pictures/earth-blue-marble.jpg',
    credit: 'NASA Apollo 17 / DSN Network',
  },
];

/**
 * Returns the best-matching NASA photograph object for a given feature or mission.
 * @param {Object} feature - Feature object or CLPS mission
 * @returns {typeof NASA_PICTURES[0]}
 */
export function getPhotoForFeature(feature) {
  if (!feature) return NASA_PICTURES[0];

  const body = feature.body;
  if (body === 'earth' || feature.type === 'earth-station') {
    return NASA_PICTURES.find((p) => p.id === 'pic-earth-marble');
  }

  const name = (feature.name || '').toLowerCase();
  const id = (feature.id || '').toLowerCase();
  const provider = (feature.provider || '').toLowerCase();
  const site = (feature.landingSiteName || '').toLowerCase();

  // IM-1 / Odysseus / Malapert A
  if (
    id.includes('odysseus') ||
    id.includes('im1') ||
    name.includes('odysseus') ||
    name.includes('im-1') ||
    site.includes('malapert')
  ) {
    return NASA_PICTURES.find((p) => p.id === 'pic-odysseus-malapert');
  }

  // Blue Ghost / Mare Crisium / Firefly
  if (
    id.includes('blueghost') ||
    id.includes('firefly') ||
    name.includes('blue ghost') ||
    provider.includes('firefly') ||
    site.includes('crisium')
  ) {
    return NASA_PICTURES.find((p) => p.id === 'pic-blue-ghost-crisium');
  }

  // Shackleton / PRIME-1 / IM-2 / Artemis
  if (
    id.includes('shackleton') ||
    id.includes('im2') ||
    name.includes('shackleton') ||
    name.includes('artemis') ||
    site.includes('shackleton')
  ) {
    return NASA_PICTURES.find((p) => p.id === 'pic-shackleton-ridge');
  }

  // Latitude fallback
  const lat = typeof feature.latitude === 'number' ? feature.latitude : feature.lat;
  if (typeof lat === 'number') {
    if (Math.abs(lat) >= 80) {
      return NASA_PICTURES.find((p) => p.id === 'pic-south-pole-horizon');
    }
  }

  return NASA_PICTURES[0];
}
