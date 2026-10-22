/**
 * @file earthGlobe.js
 * Creates and configures the Cesium Globe used for Earth.
 */

import * as Cesium from 'cesium';

const EARTH_TEXTURE_URL = '/assets/earth-blue-marble.jpg';

export function createEarthGlobe() {
  const earthImageryProvider =
    new Cesium.SingleTileImageryProvider({
      url: EARTH_TEXTURE_URL,
      tileWidth: 256, 
      tileHeight: 256,
      rectangle: Cesium.Rectangle.MAX_VALUE,
      ellipsoid: Cesium.Ellipsoid.WGS84,
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

  return { globe, fallbackImageryLayer: baseLayer };
}