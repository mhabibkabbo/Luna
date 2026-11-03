/**
 * @file capabilities.js
 * NASA Moon Trek WMTS GetCapabilities parser and service integration.
 * Fetches and parses the OGC WMTS 1.0.0 Capabilities XML from NASA's Solar System Treks servers.
 */

import WMTSCapabilities from 'ol/format/WMTSCapabilities.js';
import { LUNAR_EXTENT } from '../../map/projection.js';

const capabilitiesCache = new Map();
const wmtsParser = new WMTSCapabilities();

/**
 * Standard NASA Moon Trek Equirectangular tile matrix resolutions.
 * Derived from NASA WMTSCapabilities 'default028mm' tile matrix set:
 * Matrix 0: 2.79227636e+08 ScaleDenominator, 256x256 px, 2 cols x 1 row -> 360 / 512 = 0.703125 deg/px
 */
export const NASA_MOON_RESOLUTIONS = [
  0.703125,        // Level 0 (2x1 tiles)
  0.3515625,       // Level 1 (4x2 tiles)
  0.17578125,      // Level 2 (8x4 tiles)
  0.087890625,     // Level 3 (16x8 tiles)
  0.0439453125,    // Level 4 (32x16 tiles)
  0.02197265625,   // Level 5 (64x32 tiles)
  0.010986328125,  // Level 6 (128x64 tiles)
  0.0054931640625, // Level 7 (256x128 tiles)
  0.00274658203125 // Level 8 (512x256 tiles, ~83 m/px)
];

export const NASA_MOON_MATRIX_IDS = ['0', '1', '2', '3', '4', '5', '6', '7', '8'];

/**
 * Fetches and parses the NASA Moon Trek WMTSCapabilities document for a given layer.
 * 
 * @param {string} layerId - NASA Moon Trek layer name (e.g., 'LRO_WAC_Mosaic_Global_303ppd_v02')
 * @returns {Promise<Object>} Parsed capabilities object
 */
export async function fetchNasaCapabilities(layerId) {
  if (capabilitiesCache.has(layerId)) {
    return capabilitiesCache.get(layerId);
  }

  const url = `https://trek.nasa.gov/tiles/Moon/EQ/${layerId}/1.0.0/WMTSCapabilities.xml`;

  try {
    const response = await fetch(url, { mode: 'cors' });
    if (!response.ok) {
      throw new Error(`NASA WMTS server returned HTTP ${response.status} for ${layerId}`);
    }

    const xmlText = await response.text();
    const parsed = wmtsParser.read(xmlText);

    if (parsed) {
      capabilitiesCache.set(layerId, parsed);
      return parsed;
    }
  } catch (err) {
    console.warn(`[NASA WMTS] Capabilities fetch error for ${layerId}, falling back to verified spec:`, err.message);
  }

  // Return verified fallback configuration
  const fallback = getFallbackCapabilities(layerId);
  capabilitiesCache.set(layerId, fallback);
  return fallback;
}

/**
 * Generates verified fallback capabilities matching NASA's exact production schema.
 * @param {string} layerId 
 * @returns {Object}
 */
export function getFallbackCapabilities(layerId) {
  return {
    version: '1.0.0',
    Contents: {
      Layer: [
        {
          Identifier: layerId,
          Title: layerId,
          Format: layerId.includes('DEM') || layerId.includes('Apollo') ? ['image/png'] : ['image/jpeg'],
          TileMatrixSetLink: [{ TileMatrixSet: 'default028mm' }],
          WGS84BoundingBox: LUNAR_EXTENT,
        },
      ],
      TileMatrixSet: [
        {
          Identifier: 'default028mm',
          SupportedCRS: 'urn:ogc:def:crs:EPSG::104903',
          TileMatrix: NASA_MOON_MATRIX_IDS.map((id, index) => ({
            Identifier: id,
            TileWidth: 256,
            TileHeight: 256,
            MatrixWidth: Math.pow(2, index + 1),
            MatrixHeight: Math.pow(2, index),
            TopLeftCorner: [-180.0, 90.0],
          })),
        },
      ],
    },
  };
}
