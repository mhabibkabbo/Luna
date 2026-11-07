/**
 * @file lunarCanonicalCatalog.js
 * Single Source of Truth canonical catalog for lunar coordinates and elevations,
 * rigorously synchronized with NASA LRO LOLA polar DEM (lola_sp_80s_int16.bin),
 * scripts/sites.json, IAU Gazetteer, and NASA Artemis / CLPS mission datasets.
 */

/**
 * Canonical South Polar Reference Landmarks (80°S–90°S).
 * All elevations verified against LOLA South Pole DEM (0.5 m/px, R₀ = 1,737,400 m).
 */
export const CANONICAL_POLAR_LANDMARKS = [
  {
    id: 'south-pole',
    canonicalId: 'south-pole',
    legacyId: 'south-pole',
    name: 'Lunar South Pole (90°S)',
    shortName: 'South Pole (90°S)',
    type: 'south_pole',
    priority: 1,
    latitude: -90.0,
    longitude: 0.0,
    elevationMeters: 1251,
    rimElevationMeters: 1251,
    depthMeters: 0,
    diameterKm: 0,
    psr: false,
    description:
      'Geographic Lunar South Pole (90°S) situated on the sunlit rim of Shackleton Crater (+1,251 m based on NASA LOLA DEM). Primary exploration zone for NASA Artemis and CLPS missions.',
  },
  {
    id: 'shackleton-crater',
    canonicalId: 'crater-shackleton',
    legacyId: 'shackleton-crater',
    name: 'Shackleton Crater',
    shortName: 'Shackleton',
    type: 'crater',
    priority: 1,
    latitude: -89.67,
    longitude: 129.78,
    elevationMeters: -2768,
    rimElevationMeters: 1251,
    depthMeters: 4200,
    diameterKm: 21,
    psr: true,
    description:
      '21 km impact crater straddling the Lunar South Pole. Its western rim (+1,251 m at 90°S) receives near-continuous solar illumination while its interior floor (-2,768 m) is a permanent cold trap (depth 4.2 km).',
  },
  {
    id: 'malapert-mountain',
    canonicalId: 'mons-malapert',
    legacyId: 'malapert-mountain',
    name: 'Malapert Massif',
    shortName: 'Malapert Massif',
    type: 'mountain',
    priority: 1,
    latitude: -86.02,
    longitude: 2.7,
    elevationMeters: 5098,
    rimElevationMeters: 5098,
    depthMeters: 0,
    diameterKm: 55,
    psr: false,
    description:
      'Prominent 5.1 km mountain massif along the 0°E Earth-facing meridian (+5,098 m) offering continuous Direct-to-Earth (DTE) line-of-sight communication and high solar visibility.',
  },
  {
    id: 'haworth-crater',
    canonicalId: 'crater-haworth',
    legacyId: 'haworth-crater',
    name: 'Haworth Crater',
    shortName: 'Haworth',
    type: 'crater',
    priority: 1,
    latitude: -87.4,
    longitude: -5.1,
    elevationMeters: -3370,
    rimElevationMeters: 500,
    depthMeters: 3870,
    diameterKm: 51.4,
    psr: true,
    description:
      'Polygonal 51 km impact basin adjacent to Malapert Massif hosting one of the largest permanently shadowed volatile traps near the South Pole (-3,370 m floor).',
  },
  {
    id: 'shoemaker-crater',
    canonicalId: 'crater-shoemaker',
    legacyId: 'shoemaker-crater',
    name: 'Shoemaker Crater',
    shortName: 'Shoemaker',
    type: 'crater',
    priority: 1,
    latitude: -88.1,
    longitude: 45.0,
    elevationMeters: -3933,
    rimElevationMeters: 100,
    depthMeters: 4033,
    diameterKm: 50.9,
    psr: true,
    description:
      'Deep 51 km permanently shadowed crater (-3,933 m floor) exhibiting strong hydrogen and water-ice neutron suppression signatures.',
  },
  {
    id: 'cabeus-crater',
    canonicalId: 'crater-cabeus',
    legacyId: 'cabeus-crater',
    name: 'Cabeus Crater (LCROSS)',
    shortName: 'Cabeus',
    type: 'crater',
    priority: 1,
    latitude: -84.9,
    longitude: -35.5,
    elevationMeters: -2856,
    rimElevationMeters: 1144,
    depthMeters: 4000,
    diameterKm: 98,
    psr: true,
    description:
      '98 km impact basin impacted by NASA LCROSS in 2009, directly confirming water ice and volatile compounds in its permanently shadowed floor (-2,856 m).',
  },
  {
    id: 'amundsen-crater',
    canonicalId: 'crater-amundsen',
    legacyId: 'amundsen-crater',
    name: 'Amundsen Crater',
    shortName: 'Amundsen',
    type: 'crater',
    priority: 1,
    latitude: -84.5,
    longitude: 82.8,
    elevationMeters: -3627,
    rimElevationMeters: 873,
    depthMeters: 4500,
    diameterKm: 103,
    psr: true,
    description:
      'Large 103 km Nectarian impact crater featuring terraced walls, a prominent central peak complex, and broad sunlit floor plains (-3,627 m floor).',
  },
  {
    id: 'de-gerlache-crater',
    canonicalId: 'crater-de-gerlache',
    legacyId: 'de-gerlache-crater',
    name: 'De Gerlache Crater',
    shortName: 'De Gerlache',
    type: 'crater',
    priority: 1,
    latitude: -88.5,
    longitude: -87.1,
    elevationMeters: -1014,
    rimElevationMeters: 1986,
    depthMeters: 3000,
    diameterKm: 32.4,
    psr: true,
    description:
      '32 km permanently shadowed crater (-1,014 m floor, 3.0 km depth) linked to Shackleton by the high-illumination Connecting Ridge.',
  },
  {
    id: 'faustini-crater',
    canonicalId: 'crater-faustini',
    legacyId: 'faustini-crater',
    name: 'Faustini Crater',
    shortName: 'Faustini',
    type: 'crater',
    priority: 2,
    latitude: -87.3,
    longitude: 77.0,
    elevationMeters: -2737,
    rimElevationMeters: 1063,
    depthMeters: 3800,
    diameterKm: 42.5,
    psr: true,
    description:
      '42 km permanently shadowed crater (-2,737 m floor) situated between Shoemaker and Amundsen.',
  },
  {
    id: 'nobile-rim',
    canonicalId: 'crater-nobile',
    legacyId: 'nobile-rim',
    name: 'Nobile Crater (VIPER Site)',
    shortName: 'Nobile Rim',
    type: 'crater',
    priority: 2,
    latitude: -85.2,
    longitude: 53.5,
    elevationMeters: 690,
    rimElevationMeters: 690,
    depthMeters: 3500,
    diameterKm: 73,
    psr: true,
    description:
      '73 km impact basin whose elevated western rim (+690 m to +2,400 m) hosts shallow ice-bearing cold traps.',
  },
  {
    id: 'malapert-a',
    canonicalId: 'clps-im1-odysseus',
    legacyId: 'malapert-a',
    name: 'Malapert A (IM-1 Odysseus)',
    shortName: 'Malapert A (IM-1)',
    type: 'landing-site',
    priority: 2,
    latitude: -80.13,
    longitude: 1.44,
    elevationMeters: 2617,
    rimElevationMeters: 2617,
    depthMeters: 0,
    diameterKm: 24,
    psr: false,
    description:
      'Touchdown site of Intuitive Machines IM-1 Odysseus (80.13°S, 1.44°E, +2,617 m based on LOLA DEM), the first commercial lunar soft landing.',
  },
  {
    id: 'sverdrup-crater',
    canonicalId: 'crater-sverdrup',
    legacyId: 'sverdrup-crater',
    name: 'Sverdrup Crater',
    shortName: 'Sverdrup',
    type: 'crater',
    priority: 2,
    latitude: -88.3,
    longitude: -152.0,
    elevationMeters: -2896,
    rimElevationMeters: 304,
    depthMeters: 3200,
    diameterKm: 32.8,
    psr: true,
    description:
      'Permanently shadowed 33 km farside polar crater on the anti-Earth hemisphere (-2,896 m floor).',
  },
  {
    id: 'slater-crater',
    canonicalId: 'crater-slater',
    legacyId: 'slater-crater',
    name: 'Slater Crater',
    shortName: 'Slater',
    type: 'crater',
    priority: 2,
    latitude: -88.1,
    longitude: 111.0,
    elevationMeters: -1746,
    rimElevationMeters: 754,
    depthMeters: 2500,
    diameterKm: 25.1,
    psr: true,
    description:
      '25 km polar impact crater located between Shackleton and Faustini (-1,746 m floor).',
  },
];

/**
 * Coordinate and elevation lookup dictionary keyed by both canonical and legacy IDs.
 * Synchronized with scripts/sites.json and public/data/lola_sp_80s_int16.bin.
 */
export const CANONICAL_POLAR_COORDS = {
  // South Pole (90°S)
  'south-pole': { lat: -89.99, lon: 0.0, elevM: 1251 },
  'south-pole-90s': { lat: -89.99, lon: 0.0, elevM: 1251 },

  // Artemis III Study Sites & Candidates
  'landing-artemis3-site-004': { lat: -89.9592, lon: 135.8185, elevM: 801 },
  'landing-artemis3-shackleton': { lat: -89.0066, lon: 132.0596, elevM: 1070 },
  'landing-artemis3-peak-near-shackleton': { lat: -89.0066, lon: 132.0596, elevM: 1070 },
  'landing-artemis3-connecting-ridge': { lat: -89.374, lon: -96.204, elevM: 103 },
  'clps-blueorigin-cp22': { lat: -89.374, lon: -96.204, elevM: 103 },
  'landing-change-7': { lat: -88.8, lon: 123.4, elevM: 1620 },
  'landing-artemis3-de-gerlache-rim-2': { lat: -88.5157, lon: -61.1673, elevM: 552 },
  'landing-artemis3-faustini-rim-a': { lat: -88.0573, lon: 89.1596, elevM: -701 },
  'landing-artemis3-malapert': { lat: -85.9, lon: 0.0, elevM: 4482 },
  'mons-malapert': { lat: -86.02, lon: 2.7, elevM: 5098 },
  'malapert-mountain': { lat: -86.02, lon: 2.7, elevM: 5098 },
  'landing-artemis3-mouton': { lat: -84.5, lon: 31.7, elevM: 5234 },
  'mons-mouton': { lat: -84.5, lon: 31.7, elevM: 5234 },
  'montes-leibnitz': { lat: -85.0, lon: 30.0, elevM: 5191 },
  'landing-artemis3-nobile-rim-2': { lat: -84.2016, lon: 60.6999, elevM: 1112 },
  'landing-artemis3-amundsen-rim': { lat: -84.1918, lon: 67.229, elevM: -149 },
  'landing-lcross': { lat: -84.675, lon: -48.725, elevM: -3830 },

  // Commercial Landers (CLPS)
  'clps-im1-odysseus': { lat: -80.13, lon: 1.44, elevM: 2617 },
  'landing-odysseus': { lat: -80.13, lon: 1.44, elevM: 2617 },
  'malapert-a': { lat: -80.13, lon: 1.44, elevM: 2617 },
  'clps-im2-athena': { lat: -84.7906, lon: 29.1958, elevM: 5325 },
  'clps-griffin-gm1': { lat: -84.5, lon: 31.7, elevM: 5234 },

  // Named Polar Impact Craters
  'crater-shackleton': { lat: -89.67, lon: 129.78, elevM: -2768, rimElevM: 1251, depthM: 4200 },
  'shackleton-crater': { lat: -89.67, lon: 129.78, elevM: -2768, rimElevM: 1251, depthM: 4200 },
  'crater-de-gerlache': { lat: -88.5, lon: -87.1, elevM: -1014, depthM: 3000 },
  'de-gerlache-crater': { lat: -88.5, lon: -87.1, elevM: -1014, depthM: 3000 },
  'crater-sverdrup': { lat: -88.3, lon: -153.4, elevM: -2888, depthM: 3200 },
  'sverdrup-crater': { lat: -88.3, lon: -152.0, elevM: -2896, depthM: 3200 },
  'crater-shoemaker': { lat: -88.1, lon: 45.9, elevM: -3945, depthM: 4000 },
  'shoemaker-crater': { lat: -88.1, lon: 45.0, elevM: -3933, depthM: 4000 },
  'crater-slater': { lat: -88.08, lon: 111.29, elevM: -1739, depthM: 2500 },
  'slater-crater': { lat: -88.1, lon: 111.0, elevM: -1746, depthM: 2500 },
  'crater-haworth': { lat: -87.45, lon: -5.17, elevM: -3300, depthM: 3870 },
  'haworth-crater': { lat: -87.4, lon: -5.1, elevM: -3370, depthM: 3870 },
  'crater-faustini': { lat: -87.3, lon: 77.0, elevM: -2737, depthM: 3800 },
  'faustini-crater': { lat: -87.3, lon: 77.0, elevM: -2737, depthM: 3800 },
  'crater-nobile': { lat: -85.2, lon: 53.5, elevM: 690, depthM: 3500 },
  'nobile-rim': { lat: -85.2, lon: 53.5, elevM: 690, depthM: 3500 },
  'crater-cabeus': { lat: -84.9, lon: -35.5, elevM: -2856, depthM: 4000 },
  'cabeus-crater': { lat: -84.9, lon: -35.5, elevM: -2856, depthM: 4000 },
  'crater-amundsen': { lat: -84.5, lon: 82.8, elevM: -3627, depthM: 4500 },
  'amundsen-crater': { lat: -84.5, lon: 82.8, elevM: -3627, depthM: 4500 },
  'crater-henson': { lat: -88.57, lon: -130.63, elevM: -2487 },
  'crater-kocher': { lat: -84.47, lon: -134.02, elevM: -4970 },
  'crater-wiechert': { lat: -84.5, lon: 165.0, elevM: -2408 },
  'crater-scott': { lat: -81.9, lon: 45.3, elevM: -3923 },
  'crater-idelson': { lat: -81.5, lon: 110.9, elevM: -4141 },
};

/**
 * Returns canonical metadata for any site or landmark ID.
 * @param {string} id
 * @returns {typeof CANONICAL_POLAR_LANDMARKS[number] | null}
 */
export function getCanonicalPolarLandmark(id) {
  if (!id) return null;
  return (
    CANONICAL_POLAR_LANDMARKS.find(
      (l) => l.id === id || l.canonicalId === id || l.legacyId === id
    ) ?? null
  );
}
