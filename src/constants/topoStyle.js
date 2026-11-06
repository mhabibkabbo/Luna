/**
 * @file topoStyle.js
 * Design system and cartographic styling constants for the NASA LOLA
 * Lunar South Pole (80°S–90°S) Topographical Map, incorporating
 * NASA Scientific Visualization Studio (SVS) Entry 5127:
 * "Lunar South Pole Terrain in Coded Color" (https://svs.gsfc.nasa.gov/5127/)
 *
 * Elevations are in meters relative to the lunar reference sphere (R = 1,737,400 m).
 */

export const TOPO_STYLE = Object.freeze({
  // NASA SVS 5127 Coded Color Elevation System
  svs5127: {
    id: '5127',
    name: 'Lunar South Pole Terrain in Coded Color',
    sourceUrl: 'https://svs.gsfc.nasa.gov/5127/',
    citation: 'NASA SVS 5127 · LRO LOLA Science Team',
    gradientCss:
      'linear-gradient(to right, #240E4E 0%, #142A84 15%, #1054A6 30%, #0C88B2 45%, #10A896 60%, #1CB67A 70%, #4EC44A 80%, #A8CC30 88%, #E8BA26 93%, #E87022 96%, #CC2C4A 98%, #FFFFFF 100%)',
    stops: [
      { elev: -9000, rgb: [36, 14, 78], hex: '#240E4E', label: '-9 km' },
      { elev: -6500, rgb: [20, 42, 132], hex: '#142A84', label: '-6.5 km' },
      { elev: -4500, rgb: [16, 84, 166], hex: '#1054A6', label: '-4.5 km' },
      { elev: -3000, rgb: [12, 136, 178], hex: '#0C88B2', label: '-3 km' },
      { elev: -1600, rgb: [16, 168, 150], hex: '#10A896', label: '-1.6 km' },
      { elev: -600, rgb: [28, 182, 122], hex: '#1CB67A', label: '-600 m' },
      { elev: 300, rgb: [78, 196, 74], hex: '#4EC44A', label: 'Datum (0 m)' },
      { elev: 1400, rgb: [168, 204, 48], hex: '#A8CC30', label: '+1.4 km' },
      { elev: 2600, rgb: [232, 186, 38], hex: '#E8BA26', label: '+2.6 km' },
      { elev: 3800, rgb: [232, 112, 34], hex: '#E87022', label: '+3.8 km' },
      { elev: 5200, rgb: [204, 44, 74], hex: '#CC2C4A', label: '+5.2 km' },
      { elev: 7200, rgb: [228, 142, 172], hex: '#E48EAC', label: '+7.2 km' },
      { elev: 10700, rgb: [255, 255, 255], hex: '#FFFFFF', label: '+10.7 km' },
    ],
  },

  // Cartographic Canvas Colors & Vectors
  canvas: {
    // Deep Space canvas background (highlights the glowing polar cap)
    backgroundColor: '#070A10',
    paperBackgroundColor: '#E4EDE0',

    // Contours: crisp semi-transparent vector lines that sit beautifully over SVS 5127 coded color
    contourIntermediate: 'rgba(255, 255, 255, 0.28)',
    contourIntermediateWidth: 0.65,

    contourIndex: 'rgba(255, 255, 255, 0.75)',
    contourIndexWidth: 1.35,
    contourHaloColor: 'rgba(4, 8, 16, 0.85)',
    contourHaloWidth: 3.5,
    contourLabelColor: '#FFFFFF',
    contourLabelFont: 'bold 9px "Space Mono", ui-monospace, monospace',

    // Depression contour downhill hachure ticks
    depressionTickColor: 'rgba(255, 255, 255, 0.45)',
    depressionTickWidth: 0.75,
    depressionTickLengthPx: 4.5,
    depressionTickSpacingPx: 16,

    // Red dashed lines: (a) slope-hazard (>15°) and (b) planned traverse routes
    slopeHazardColor: '#EF4444',
    slopeHazardWidth: 1.4,
    slopeHazardDash: [5, 4],

    traverseRouteColor: '#F59E0B',
    traverseRouteWidth: 2.2,
    traverseRouteDash: [7, 4],

    // Dark / subtle dotted lines: ridge lines and crater rims
    ridgeRimColor: 'rgba(255, 255, 255, 0.55)',
    ridgeRimWidth: 1.25,
    ridgeRimDash: [2, 3],

    // Polar-stereographic rectilinear grid
    gridColor: 'rgba(255, 255, 255, 0.12)',
    gridWidth: 0.65,
    gridLabelColor: 'rgba(203, 213, 225, 0.65)',
    gridLabelFont: '600 8.5px "Space Mono", ui-monospace, monospace',

    // Neatline border & scale bar
    neatlineColor: 'rgba(255, 255, 255, 0.35)',
    neatlineWidth: 1.0,
    scaleBarColor: '#E2E8F0',
    scaleBarFont: '600 9px "Space Mono", ui-monospace, monospace',
  },

  // Panels & HUD Warm UI Palette
  hud: {
    panelBg: '#12110D',
    panelBorder: '#2D2A22',
    accentTerracotta: '#E59A6D',
    accentSage: '#88B38A',
    textPrimary: '#F4EFE6',
    textMuted: '#A8A193',
  },

  // Zoom-adaptive contour intervals (every 5th line is an index contour)
  contourIntervals: [
    { maxZoom: 1, intervalM: 500, indexIntervalM: 2500, label: '500 m' },
    { maxZoom: 2, intervalM: 200, indexIntervalM: 1000, label: '200 m' },
    { maxZoom: 3, intervalM: 100, indexIntervalM: 500, label: '100 m' },
    { maxZoom: 4, intervalM: 50, indexIntervalM: 250, label: '50 m' },
    { maxZoom: 6, intervalM: 20, indexIntervalM: 100, label: '20 m' },
  ],

  // Polar-stereographic rectilinear grid intervals by zoom (in meters)
  gridIntervals: [
    { maxZoom: 1, spacingM: 50000, label: '50 km' },
    { maxZoom: 3, spacingM: 20000, label: '20 km' },
    { maxZoom: 4, spacingM: 10000, label: '10 km' },
    { maxZoom: 6, spacingM: 5000, label: '5 km' },
  ],

  // Scientific metadata
  metadata: {
    svsId: '5127',
    svsTitle: 'Lunar South Pole Terrain in Coded Color',
    svsUrl: 'https://svs.gsfc.nasa.gov/5127/',
    product: 'NASA PDS LRO-L-LOLA-4-GDR-V1.0',
    coverage: '80.0°S to 90.0°S Polar Stereographic',
    datum: 'Lunar Reference Sphere (R = 1,737,400.0 m)',
    projection: '+proj=stere +lat_0=-90 +lon_0=0 +k=1 +units=m',
    nativeResolution: '20 m/pixel base GDR pyramid (400 m grid sample)',
    slopeHazardThresholdDeg: 15.0,
  },
});

export const ELEVATION_RAMP = TOPO_STYLE.svs5127.stops;


/**
 * Helper to select the appropriate contour interval for a given zoom level.
 */
export function getContourIntervalForZoom(zoom) {
  for (const entry of TOPO_STYLE.contourIntervals) {
    if (zoom <= entry.maxZoom) return entry;
  }
  return TOPO_STYLE.contourIntervals[TOPO_STYLE.contourIntervals.length - 1];
}

/**
 * Helper to select the appropriate rectilinear grid spacing for a given zoom level.
 */
export function getGridSpacingForZoom(zoom) {
  for (const entry of TOPO_STYLE.gridIntervals) {
    if (zoom <= entry.maxZoom) return entry;
  }
  return TOPO_STYLE.gridIntervals[TOPO_STYLE.gridIntervals.length - 1];
}

/**
 * Helper to check whether an elevation value is an index contour.
 */
export function isIndexContour(elevM, intervalM) {
  const indexStep = intervalM * 5;
  return Math.abs(Math.round(elevM) % indexStep) < 0.001;
}

/**
 * Compute slope in degrees from elevation grid neighbors.
 * Uses Horn's 3x3 algorithm or central difference.
 * @param {number} dzdx - Rate of change in X (m/m)
 * @param {number} dzdy - Rate of change in Y (m/m)
 * @returns {number} Slope in degrees [0, 90]
 */
export function computeSlopeDeg(dzdx, dzdy) {
  const rise = Math.hypot(dzdx, dzdy);
  return (Math.atan(rise) * 180) / Math.PI;
}
