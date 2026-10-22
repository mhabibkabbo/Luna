/**
 * @file moonGlobe.js
 * Creates and configures the Cesium Globe used for the Moon.
 */

import * as Cesium from 'cesium';

export function createMoonGlobe() {
  // NASA LRO WAC Global Multi-Resolution Equirectangular WMTS Imagery Provider
  const nasaLroProvider = new Cesium.UrlTemplateImageryProvider({
    url: 'https://trek.nasa.gov/tiles/Moon/EQ/LRO_WAC_Mosaic_Global_303ppd_v02/1.0.0/default/default028mm/{z}/{y}/{x}.jpg',
    ellipsoid: Cesium.Ellipsoid.MOON,

    tilingScheme: new Cesium.GeographicTilingScheme({
      ellipsoid: Cesium.Ellipsoid.MOON,
      numberOfLevelZeroTilesX: 2,
      numberOfLevelZeroTilesY: 1,
    }),

    tileWidth: 256,
    tileHeight: 256,
    minimumLevel: 0,
    maximumLevel: 8,
    hasAlphaChannel: false,

    credit: new Cesium.Credit('NASA / LROC / USGS Moon Trek'),
  });

  const baseLayer = new Cesium.ImageryLayer(nasaLroProvider);

  baseLayer.brightness = 1.06;
  baseLayer.contrast = 1.12;

  // Create the Moon globe with Cesium.Ellipsoid.MOON
  const globe = new Cesium.Globe(Cesium.Ellipsoid.MOON);

  // Surface base color matches deep space lunar mare before tiles finish streaming
  globe.baseColor = Cesium.Color.fromCssColorString('#0b0f19');

  // Give the globe its imagery
  globe.imageryLayers.add(baseLayer);

  // Lunar ellipsoid terrain provider
  globe.terrainProvider = new Cesium.EllipsoidTerrainProvider({
    ellipsoid: Cesium.Ellipsoid.MOON,
  });

  return globe;
}