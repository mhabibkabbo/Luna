/**
 * @file nasaWmts.js
 * OpenLayers TileLayer and WMTS Source constructor for NASA Moon Trek datasets.
 * Constructs high-performance, tiled raster layers for the Moon.
 */

import TileLayer from 'ol/layer/Tile.js';
import WMTSSource from 'ol/source/WMTS.js';
import WMTSTileGrid from 'ol/tilegrid/WMTS.js';
import { NASA_MOON_RESOLUTIONS, NASA_MOON_MATRIX_IDS } from '../services/nasa/capabilities.js';
import { LUNAR_EXTENT } from './projection.js';

/**
 * Creates an OpenLayers WMTSTileGrid mathematically matching NASA Moon Trek specifications.
 * @returns {WMTSTileGrid}
 */
export function createNasaWmtsTileGrid() {
  return new WMTSTileGrid({
    origin: [-180.0, 90.0],
    resolutions: NASA_MOON_RESOLUTIONS,
    matrixIds: NASA_MOON_MATRIX_IDS,
    tileSize: [256, 256],
    extent: LUNAR_EXTENT,
  });
}

/**
 * Constructs an OpenLayers TileLayer for a NASA Moon Trek WMTS layer.
 * 
 * @param {import('../types/lunar.js').LunarLayer} layerConfig
 * @param {import('ol/proj/Projection.js').default} moonProjection
 * @param {Object} [options]
 * @param {Function} [options.onTileLoading] - Callback when tiles begin loading
 * @param {Function} [options.onTileLoaded] - Callback when tiles finish loading
 * @param {Function} [options.onTileError] - Callback when tile load fails
 * @returns {TileLayer}
 */
export function createNasaWmtsLayer(layerConfig, moonProjection, options = {}) {
  const tileGrid = createNasaWmtsTileGrid();
  const formatExt = layerConfig.format === 'image/png' ? 'png' : 'jpg';
  const wmtsLayerName = layerConfig.wmtsLayer || 'LRO_WAC_Mosaic_Global_303ppd_v02';

  // RESTful URL template matching NASA Moon Trek GetCapabilities
  const urlTemplate = `https://trek.nasa.gov/tiles/Moon/EQ/${wmtsLayerName}/1.0.0/default/default028mm/{TileMatrix}/{TileRow}/{TileCol}.${formatExt}`;

  const wmtsSource = new WMTSSource({
    urls: [urlTemplate],
    requestEncoding: 'REST',
    layer: wmtsLayerName,
    matrixSet: 'default028mm',
    format: layerConfig.format || 'image/jpeg',
    projection: moonProjection,
    tileGrid: tileGrid,
    style: 'default',
    wrapX: false,
    crossOrigin: 'anonymous',
    transition: 200, // Smooth 200ms opacity fade between tile zooms
  });

  if (options.onTileLoading) {
    wmtsSource.on('tileloadstart', options.onTileLoading);
  }
  if (options.onTileLoaded) {
    wmtsSource.on('tileloadend', options.onTileLoaded);
  }
  if (options.onTileError) {
    wmtsSource.on('tileloaderror', (e) => {
      // Gracefully handle tile errors without breaking map
      if (options.onTileError) options.onTileError(e);
    });
  }

  const tileLayer = new TileLayer({
    source: wmtsSource,
    visible: layerConfig.visible,
    opacity: layerConfig.opacity,
    extent: LUNAR_EXTENT,
    properties: {
      id: layerConfig.id,
      category: layerConfig.category,
      wmtsLayer: wmtsLayerName,
      layerType: 'wmts',
    },
  });

  return tileLayer;
}
