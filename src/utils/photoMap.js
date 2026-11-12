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
 * Returns the best-matching NASA photograph object for a given feature or mission,
 * explicitly annotating whether the imagery is in-situ/site-specific or a
 * representative regional illustration.
 *
 * @param {Object} [feature] - Feature object, landing site, or CLPS mission
 * @returns {typeof NASA_PICTURES[0] & {
 *   isSiteSpecific: boolean,
 *   photoType: 'site-specific' | 'representative',
 *   label: 'Site-Specific Photograph' | 'Representative Regional Illustration',
 *   representationNotice: string | null
 * }}
 */
export function getPhotoForFeature(feature) {
  if (!feature) {
    const defaultPhoto = NASA_PICTURES.find((p) => p.id === 'pic-south-pole-horizon') || NASA_PICTURES[0];
    return {
      ...defaultPhoto,
      isSiteSpecific: false,
      photoType: 'representative',
      label: 'Representative Regional Illustration',
      representationNotice: 'Representative Regional Illustration: General lunar surface illustration.',
    };
  }

  const name = (feature.name || '').trim();
  const id = (feature.id || '').trim().toLowerCase();
  const provider = (feature.provider || '').trim().toLowerCase();
  const site = (feature.landingSiteName || '').trim().toLowerCase();
  const body = (feature.body || '').trim().toLowerCase();
  const type = (feature.type || '').trim().toLowerCase();
  const lat = typeof feature.latitude === 'number' ? feature.latitude : feature.lat;
  const displayName = name || feature.id || 'this site';

  if (
    body === 'earth' ||
    type === 'earth-station' ||
    type === 'earth-launch-site' ||
    id.startsWith('earth-') ||
    id.includes('goldstone') ||
    id.includes('madrid') ||
    id.includes('canberra')
  ) {
    const photo = NASA_PICTURES.find((p) => p.id === 'pic-earth-marble');
    return {
      ...photo,
      isSiteSpecific: true,
      photoType: 'site-specific',
      label: 'Site-Specific Photograph',
      representationNotice: null,
    };
  }

  const isOdysseusExact =
    id === 'clps-im1-odysseus' ||
    id === 'landing-odysseus' ||
    name.toLowerCase() === 'im-1 (odysseus)' ||
    name.toLowerCase() === 'odysseus' ||
    (id === 'malapert-a') ||
    (site === 'malapert a' && id.includes('odysseus'));

  if (isOdysseusExact) {
    const photo = NASA_PICTURES.find((p) => p.id === 'pic-odysseus-malapert');
    return {
      ...photo,
      isSiteSpecific: true,
      photoType: 'site-specific',
      label: 'Site-Specific Photograph',
      representationNotice: null,
    };
  }

  const isBlueGhost1Exact =
    id === 'clps-firefly-bgm1' ||
    id === 'landing-firefly-bgm1' ||
    (id.includes('firefly') && !id.includes('bgm2') && (name.toLowerCase().includes('blue ghost 1') || name.toLowerCase().includes('blue ghost mission 1')));

  const isMareCrisiumBasin =
    id === 'mare-crisium' ||
    name.toLowerCase() === 'mare crisium';

  if (isBlueGhost1Exact || isMareCrisiumBasin) {
    const photo = NASA_PICTURES.find((p) => p.id === 'pic-blue-ghost-crisium');
    return {
      ...photo,
      isSiteSpecific: true,
      photoType: 'site-specific',
      label: 'Site-Specific Photograph',
      representationNotice: null,
    };
  }

  const isShackletonExact =
    id === 'crater-shackleton' ||
    id === 'landing-artemis3-shackleton' ||
    id === 'landing-artemis3-connecting-ridge' ||
    id === 'landing-artemis3-site-004' ||
    name.toLowerCase() === 'shackleton' ||
    name.toLowerCase() === 'shackleton crater' ||
    name.toLowerCase() === 'shackleton connecting ridge';

  if (isShackletonExact) {
    const photo = NASA_PICTURES.find((p) => p.id === 'pic-shackleton-ridge');
    return {
      ...photo,
      isSiteSpecific: true,
      photoType: 'site-specific',
      label: 'Site-Specific Photograph',
      representationNotice: null,
    };
  }

  const isSouthPoleExact =
    id === 'south-pole' ||
    id === 'south-pole-90s' ||
    name.toLowerCase() === 'south pole' ||
    (typeof lat === 'number' && Math.abs(lat) === 90);

  if (isSouthPoleExact) {
    const photo = NASA_PICTURES.find((p) => p.id === 'pic-south-pole-horizon');
    return {
      ...photo,
      isSiteSpecific: true,
      photoType: 'site-specific',
      label: 'Site-Specific Photograph',
      representationNotice: null,
    };
  }

  const isMareBasin =
    id.startsWith('mare-') ||
    id.startsWith('oceanus-') ||
    id.startsWith('sinus-') ||
    id.startsWith('palus-') ||
    id.startsWith('lacus-') ||
    /mare|oceanus|sinus|sea of/i.test(name) ||
    /mare|oceanus|sinus|sea of/i.test(site);

  const selectedPhoto = isMareBasin
    ? NASA_PICTURES.find((p) => p.id === 'pic-blue-ghost-crisium')
    : NASA_PICTURES.find((p) => p.id === 'pic-south-pole-horizon');

  return {
    ...selectedPhoto,
    isSiteSpecific: false,
    photoType: 'representative',
    label: 'Representative Regional Illustration',
    representationNotice: `Representative Regional Illustration: Not an in-situ photograph of ${displayName}.`,
  };
}
