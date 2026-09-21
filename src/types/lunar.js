/**
 * @file lunar.js
 * JSDoc definitions for Lunar Explorer data models.
 * Used across map and UI layers to maintain a clean abstraction
 * compatible with both 2D OpenLayers and future 3D CesiumJS integration.
 */

/**
 * @typedef {Object} LunarFeature
 * @property {string} id - Unique identifier (e.g., 'crater-tycho')
 * @property {string} name - Feature name (e.g., 'Tycho')
 * @property {'crater'|'mare'|'mountain'|'valley'|'rille'|'landing-site'|'mission-site'} type - Feature classification
 * @property {number} latitude - Selenographic latitude (-90 to +90, North positive)
 * @property {number} longitude - Selenographic longitude (-180 to +180, East positive)
 * @property {number=} diameterKm - Crater diameter or mare approximate diameter in kilometers
 * @property {number=} depthKm - Crater depth in kilometers
 * @property {number=} elevationM - Peak elevation in meters relative to 1737.4 km lunar datum
 * @property {number=} lengthKm - Mountain range or valley/rille length in kilometers
 * @property {string=} period - Geological epoch (e.g., 'Copernican', 'Imbrian', 'Nectarian')
 * @property {string=} description - Verified scientific / historical description
 * @property {string=} source - Originating catalog (e.g., 'NASA / IAU Gazetteer / LROC')
 * @property {string=} date - Historic landing or mission date (for landing sites)
 * @property {string=} agency - Operating space agency (e.g., 'NASA', 'CNSA', 'ISRO')
 * @property {string=} status - Mission outcome (e.g., 'Successful soft landing')
 */

/**
 * @typedef {Object} LunarLayer
 * @property {string} id - Layer identifier matching NASA WMTS or vector layer
 * @property {string} name - Human-readable layer display title
 * @property {string} description - Scientific description of dataset
 * @property {'wmts'|'vector'} type - Layer rendering type
 * @property {'BASE'|'TERRAIN'|'FEATURES'|'MISSIONS'} category - UI section
 * @property {boolean} visible - Visibility toggle state
 * @property {number} opacity - Layer opacity (0 to 1)
 * @property {string=} wmtsLayer - NASA Moon Trek WMTS layer identifier
 * @property {string=} format - Tile image format ('image/jpeg' or 'image/png')
 * @property {number=} maxZoom - Highest native tile matrix level
 * @property {string=} attribution - Scientific dataset attribution
 */

/**
 * @typedef {Object} LunarMeasurement
 * @property {Array<[number, number]>} coordinates - Array of [lon, lat] selenographic points
 * @property {number} totalDistanceKm - Total geodesic path length in kilometers
 * @property {Array<number>} segmentDistancesKm - Individual segment lengths in kilometers
 * @property {number=} initialBearingDeg - Initial azimuth in degrees (0 = North, 90 = East)
 * @property {boolean} isComplete - Whether measurement is finalized
 */

/**
 * @typedef {Object} LunarLocation
 * @property {number} longitude - Selenographic longitude (-180 to +180)
 * @property {number} latitude - Selenographic latitude (-90 to +90)
 * @property {number=} zoom - Map zoom level
 */

export {};
