/**
 * @file layers.js
 * Catalog of NASA Moon Trek scientific WMTS and GIS layers.
 * All layers are verified against NASA Solar System Treks endpoints (https://trek.nasa.gov/tiles/Moon/EQ/).
 */

/**
 * @type {Array<import('../../types/lunar.js').LunarLayer>}
 */
export const LUNAR_LAYERS_CATALOG = [
  // ==========================================
  // BASE MAP & SCIENTIFIC NASA WMTS RASTERS
  // ==========================================
  {
    id: 'lro-wac-morphology',
    name: 'Photo Basemap (LRO WAC)',
    description: 'NASA Lunar Reconnaissance Orbiter Wide Angle Camera global mosaic at 100 m/pixel (303 pixels/degree). Primary photographic basemap.',
    type: 'wmts',
    category: 'BASE',
    visible: true,
    opacity: 1.0,
    wmtsLayer: 'LRO_WAC_Mosaic_Global_303ppd_v02',
    format: 'image/jpeg',
    maxZoom: 8,
    attribution: 'NASA / GSFC / Arizona State University (LROC Team)',
  },
  {
    id: 'lola-shaded-relief',
    name: '3D Terrain Relief (LOLA Hillshade)',
    description: 'NASA Lunar Orbiter Laser Altimeter shaded relief map accentuating crater rims, depths, central peaks, and South Pole massifs.',
    type: 'wmts',
    category: 'TERRAIN',
    visible: false,
    opacity: 0.85,
    wmtsLayer: 'LOLA_Shade_Global_128ppd_v04',
    format: 'image/jpeg',
    maxZoom: 7,
    attribution: 'NASA GSFC / LOLA Science Team',
  },
  {
    id: 'lola-color-dem',
    name: 'Color Elevation DEM (LOLA Topography)',
    description: 'Rainbow color-coded digital elevation model showing topography from deep South Pole impact basins (-9 km) to high mountain peaks (+10 km).',
    type: 'wmts',
    category: 'TERRAIN',
    visible: false,
    opacity: 0.75,
    wmtsLayer: 'LOLA_ClrShade_Global_128ppd_v04',
    format: 'image/jpeg',
    maxZoom: 7,
    attribution: 'NASA GSFC / LOLA Science Team',
  },
  {
    id: 'diviner-rock-abundance',
    name: 'Rock Abundance (LRO Diviner)',
    description: 'NASA Diviner Lunar Radiometer Experiment surface rock abundance and thermal inertia mapping rocks exposed across impact ejecta.',
    type: 'wmts',
    category: 'TERRAIN',
    visible: false,
    opacity: 0.70,
    wmtsLayer: 'LRO_Diviner_RockAbundance_Global_128ppd',
    format: 'image/jpeg',
    maxZoom: 6,
    attribution: 'NASA / UCLA / JPL Diviner Team',
  },
  {
    id: 'kaguya-tc-ortho',
    name: 'Kaguya TC Ortho Mosaic',
    description: 'JAXA SELENE (Kaguya) Terrain Camera high-contrast global orthomosaic highlighting polar shadowed morphology and crater floors.',
    type: 'wmts',
    category: 'TERRAIN',
    visible: false,
    opacity: 0.75,
    wmtsLayer: 'Moon_Kaguya_TC_Ortho_Global_Mosaic_64ppd',
    format: 'image/jpeg',
    maxZoom: 6,
    attribution: 'JAXA / ISAS / SELENE Team',
  },
  {
    id: 'clementine-uvvis',
    name: 'Mineralogy UVVIS (Clementine)',
    description: 'Clementine 5-band UV-Visible false-color mosaic showing surface iron/titanium mineralogy and basalt vs. anorthositic highlands.',
    type: 'wmts',
    category: 'TERRAIN',
    visible: false,
    opacity: 0.70,
    wmtsLayer: 'Clementine_UVVIS_War_Global_Mosaic_100m_v02',
    format: 'image/jpeg',
    maxZoom: 6,
    attribution: 'NASA / USGS Astrogeology Science Center',
  },

  // ==========================================
  // FEATURES (VECTOR OVERLAYS)
  // ==========================================
  {
    id: 'lunar-craters',
    name: 'Impact Craters',
    description: 'Named lunar impact craters cataloged by the IAU, with diameter, depth, and Copernican/Eratosthenian geologic age.',
    type: 'vector',
    category: 'FEATURES',
    visible: true,
    opacity: 1.0,
    attribution: 'IAU / NASA LROC SOC / USGS Astrogeology',
  },
  {
    id: 'lunar-mountains',
    name: 'Mountains & Ridges',
    description: 'Prominent lunar mountain chains (Montes) and polar massifs rising several kilometers above surrounding basins.',
    type: 'vector',
    category: 'FEATURES',
    visible: true,
    opacity: 1.0,
    attribution: 'IAU Gazetteer of Planetary Nomenclature',
  },
  {
    id: 'lunar-maria',
    name: 'Lunar Maria (Seas)',
    description: 'Dark basaltic plains formed by ancient volcanic flooding during late heavy bombardment.',
    type: 'vector',
    category: 'FEATURES',
    visible: true,
    opacity: 1.0,
    attribution: 'NASA / USGS Geologic Investigations',
  },
  {
    id: 'lunar-valleys',
    name: 'Valleys & Rilles',
    description: 'Tectonic graben, volcanic lava tubes, and sinuous rilles traversing the lunar surface.',
    type: 'vector',
    category: 'FEATURES',
    visible: true,
    opacity: 1.0,
    attribution: 'NASA LROC Science Operations Center',
  },
  {
    id: 'lunar-landing-sites',
    name: 'Historic Landing Sites',
    description: 'Crewed Apollo landing sites and international robotic lunar landing missions (Luna, Surveyor, Chang\'e, Chandrayaan, SLIM, Odysseus).',
    type: 'vector',
    category: 'FEATURES',
    visible: true,
    opacity: 1.0,
    attribution: 'NASA History / NSSDC Master Catalog',
  },
];
