
/**
 * @file earthGlobe.js
 * Creates and configures the Cesium Globe used for Earth.
 */

import * as Cesium from 'cesium';

const EARTH_TEXTURE_URL = '/assets/earth-blue-marble.jpg';

export function createEarthGlobe() {
    const globe = new Cesium.Globe(Cesium.Ellipsoid.WGS84);

    const earthImageryProvider = new Cesium.SingleTileImageryProvider({
        url: EARTH_TEXTURE_URL,
        tileWidth: 2048,
        tileHeight: 1024,
        rectangle: Cesium.Rectangle.MAX_VALUE,
    });

    const fallbackImageryLayer = globe.imageryLayers.addImageryProvider(
        earthImageryProvider
    );

    globe.terrainProvider = new Cesium.EllipsoidTerrainProvider();
    globe.showGroundAtmosphere = true;

    return { globe, fallbackImageryLayer };
}