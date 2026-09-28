/**
 * @file createEarthGlobe.js
 * Creates and configures the Cesium Globe used for Earth.
 */

import * as Cesium from 'cesium';

const EARTH_TEXTURE_URL =
  'https://cdn.jsdelivr.net/npm/three-globe@2.31.0/example/img/earth-blue-marble.jpg';

export function createEarthGlobe() {
  const earthImageryProvider =
    new Cesium.SingleTileImageryProvider({
      url: EARTH_TEXTURE_URL,
      tileWidth: 256, 
      tileHeight: 256,
      rectangle: Cesium.Rectangle.MAX_VALUE,
    });

  const baseLayer = new Cesium.ImageryLayer(
    earthImageryProvider
  );

  const globe = new Cesium.Globe(
    Cesium.Ellipsoid.WGS84
  );

  globe.imageryLayers.add(baseLayer);

  globe.terrainProvider =
    new Cesium.EllipsoidTerrainProvider({
      ellipsoid: Cesium.Ellipsoid.WGS84,
    });

  globe.showGroundAtmosphere = true;

  return globe;
}