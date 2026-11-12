import * as Cesium from 'cesium';

const EARTH_TEXTURE_URL = '/assets/earth-blue-marble.jpg';

export function configureEarthImageryLayer(layer) {
  layer.brightness = 0.8;
  layer.contrast = 1.0;
  layer.saturation = 2.5;
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
  globe.baseColor = Cesium.Color.fromCssColorString('#14171a');

  return { globe, fallbackImageryLayer, earthImageryProvider };
}
