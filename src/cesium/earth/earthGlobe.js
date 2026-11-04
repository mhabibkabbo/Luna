/**
 * @file earthGlobe.js
 * Creates and configures the Cesium Globe used for Earth with preloaded Blue Marble imagery.
 */

import * as Cesium from 'cesium';

const EARTH_TEXTURE_URL = '/assets/earth-blue-marble.jpg';

export function configureEarthImageryLayer(layer) {
  layer.brightness = 0.9;
  layer.contrast = 1.0;
  layer.saturation = 1.7;
  layer.gamma = 1.2;
  layer.hue = -0.1;
  return layer;
}

export function createEarthGlobe() {
  const globe = new Cesium.Globe(Cesium.Ellipsoid.WGS84);

  const earthImageryProvider = new Cesium.SingleTileImageryProvider({
    url: EARTH_TEXTURE_URL,
    tileWidth: 4096,
    tileHeight: 2048,
    rectangle: Cesium.Rectangle.MAX_VALUE,
  });

  const fallbackImageryLayer = configureEarthImageryLayer(
    globe.imageryLayers.addImageryProvider(earthImageryProvider)
  );

  globe.terrainProvider = new Cesium.EllipsoidTerrainProvider({
    ellipsoid: Cesium.Ellipsoid.WGS84,
  });
  globe.showGroundAtmosphere = true;
  globe.atmosphereBrightnessShift = -0.5;
  globe.atmosphereSaturationShift = 0.1;
  globe.atmosphereLightIntensity = 15.0;
  globe.baseColor = Cesium.Color.fromCssColorString('#141A16');
  globe.atmosphereRayleighScaleHeight = 10000;
  globe.atmosphereMieScaleHeight = 5500;
  globe.atmosphereMieCoefficient = new Cesium.Cartesian3(14e-6, 14e-6, 14e-6);

  return { globe, fallbackImageryLayer, earthImageryProvider };
}