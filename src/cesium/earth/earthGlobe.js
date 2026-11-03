/**
 * @file earthGlobe.js
 * Creates and configures the Cesium Globe used for Earth with preloaded Blue Marble imagery.
 */

import * as Cesium from 'cesium';

const EARTH_TEXTURE_URL = '/assets/earth-blue-marble.jpg';

export function createEarthGlobe() {
  const globe = new Cesium.Globe(Cesium.Ellipsoid.WGS84);

  const earthImageryProvider = new Cesium.SingleTileImageryProvider({
    url: EARTH_TEXTURE_URL,
    tileWidth: 4096,
    tileHeight: 2048,
    rectangle: Cesium.Rectangle.MAX_VALUE,
  });

  const fallbackImageryLayer = globe.imageryLayers.addImageryProvider(
    earthImageryProvider
  );

  globe.terrainProvider = new Cesium.EllipsoidTerrainProvider({
    ellipsoid: Cesium.Ellipsoid.WGS84,
  });
  globe.showGroundAtmosphere = false;
  globe.baseColor = Cesium.Color.fromCssColorString('#141A16');

  return { globe, fallbackImageryLayer, earthImageryProvider };
}