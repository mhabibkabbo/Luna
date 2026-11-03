/**
 * @file earthGlobe.js
 * Creates and configures the Cesium Globe used for Earth with preloaded Blue Marble imagery.
 */

import * as Cesium from 'cesium';

const EARTH_TEXTURE_URL = '/assets/earth-blue-marble.jpg';

export function createEarthGlobe() {
  const globe = new Cesium.Globe(Cesium.Ellipsoid.WGS84);

<<<<<<< HEAD
    // Use Blue Marble for global views, then let the viewer switch to detailed Cesium tiles near the surface.
    const earthImageryProvider = new Cesium.SingleTileImageryProvider({
        url: EARTH_TEXTURE_URL,
        tileWidth: 2048,
        tileHeight: 1024,
        rectangle: Cesium.Rectangle.MAX_VALUE,
    });
=======
  const earthImageryProvider = new Cesium.SingleTileImageryProvider({
    url: EARTH_TEXTURE_URL,
    tileWidth: 2048,
    tileHeight: 1024,
    rectangle: Cesium.Rectangle.MAX_VALUE,
  });
>>>>>>> 66b8661a38360fddf9890f8e655a4868134e6291

  const fallbackImageryLayer = globe.imageryLayers.addImageryProvider(
    earthImageryProvider
  );

<<<<<<< HEAD
    globe.terrainProvider = new Cesium.EllipsoidTerrainProvider();
    globe.showGroundAtmosphere = true;
=======
  globe.terrainProvider = new Cesium.EllipsoidTerrainProvider({
    ellipsoid: Cesium.Ellipsoid.WGS84,
  });
  globe.showGroundAtmosphere = true;
  globe.baseColor = Cesium.Color.fromCssColorString('#141A16');
>>>>>>> 66b8661a38360fddf9890f8e655a4868134e6291

  return { globe, fallbackImageryLayer, earthImageryProvider };
}