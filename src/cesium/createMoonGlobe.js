/**
 * @file createMoonGlobe.js
 * Creates and configures the Cesium Globe used for the Moon.
 */

import * as Cesium from 'cesium';

export function createMoonGlobe() {
  // Moon imagery
  const nasaLroProvider = new Cesium.UrlTemplateImageryProvider({
    url: 'https://trek.nasa.gov/tiles/Moon/EQ/LRO_WAC_Mosaic_Global_303ppd_v02/1.0.0/default/default028mm/{z}/{y}/{x}.jpg',
    ellipsoid: Cesium.Ellipsoid.MOON,

    tilingScheme: new Cesium.GeographicTilingScheme({
      ellipsoid: Cesium.Ellipsoid.MOON,
      numberOfLevelZeroTilesX: 2,
      numberOfLevelZeroTilesY: 1,
    }),

    maximumLevel: 8,
    hasAlphaChannel: false,

    credit: new Cesium.Credit(
      'NASA / LROC / USGS Moon Trek'
    ),
  });

  const baseLayer = new Cesium.ImageryLayer(nasaLroProvider);

  baseLayer.brightness = 1.06;
  baseLayer.contrast = 1.12;

  // Create the actual Moon globe.
  const globe = new Cesium.Globe(
    Cesium.Ellipsoid.MOON
  );

  // Give the globe its imagery.
  globe.imageryLayers.add(baseLayer);

  // The Moon currently uses an ellipsoid terrain provider.
  globe.terrainProvider =
    new Cesium.EllipsoidTerrainProvider({
      ellipsoid: Cesium.Ellipsoid.MOON,
    });

  return globe;
}