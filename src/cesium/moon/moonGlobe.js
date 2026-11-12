import * as Cesium from 'cesium';
import { LUNAR_LAYERS_CATALOG } from '../../services/nasa/layers.js';

const RASTER_LAYER_ORDER = [
  'lro-wac-morphology',
  'lola-shaded-relief',
  'lola-color-dem',
  'diviner-rock-abundance',
  'kaguya-tc-ortho',
  'clementine-uvvis',
];

function createImageryProviderForLayer(layerDef) {
  const tilingScheme = new Cesium.GeographicTilingScheme({
    ellipsoid: Cesium.Ellipsoid.MOON,
    numberOfLevelZeroTilesX: 2,
    numberOfLevelZeroTilesY: 1,
  });

  if (layerDef.wmsUrl && layerDef.wmsLayer) {
    return new Cesium.WebMapServiceImageryProvider({
      url: layerDef.wmsUrl,
      layers: layerDef.wmsLayer,
      ellipsoid: Cesium.Ellipsoid.MOON,
      tilingScheme,
      tileWidth: 256,
      tileHeight: 256,
      minimumLevel: 0,
      maximumLevel: layerDef.maxZoom || 7,
      parameters: {
        transparent: false,
        format: layerDef.format || 'image/jpeg',
      },
      enablePickFeatures: false,
      credit: new Cesium.Credit(layerDef.attribution || 'USGS / NASA Moon Trek'),
    });
  }

  const ext = layerDef.tileExtension || (layerDef.format === 'image/png' ? 'png' : 'jpg');
  return new Cesium.UrlTemplateImageryProvider({
    url: `https://trek.nasa.gov/tiles/Moon/EQ/${layerDef.wmtsLayer}/1.0.0/default/default028mm/{z}/{y}/{x}.${ext}`,
    ellipsoid: Cesium.Ellipsoid.MOON,
    tilingScheme,
    tileWidth: 256,
    tileHeight: 256,
    minimumLevel: 0,
    maximumLevel: layerDef.maxZoom || 8,
    hasAlphaChannel: ext === 'png',
    credit: new Cesium.Credit(layerDef.attribution || 'NASA / LROC / USGS Moon Trek'),
  });
}

export function createMoonGlobe() {
  const globe = new Cesium.Globe(Cesium.Ellipsoid.MOON);

  globe.baseColor = Cesium.Color.fromCssColorString('#0b0f19');

  const lunarImageryLayers = new Map();
  globe._lunarImageryLayers = lunarImageryLayers;

  const baseDef = LUNAR_LAYERS_CATALOG.find((l) => l.id === 'lro-wac-morphology') || {
    id: 'lro-wac-morphology',
    wmtsLayer: 'LRO_WAC_Mosaic_Global_303ppd_v02',
    tileExtension: 'jpg',
    format: 'image/jpeg',
    maxZoom: 8,
    visible: true,
    opacity: 1.0,
    attribution: 'NASA / LROC / USGS Moon Trek',
  };

  const baseProvider = createImageryProviderForLayer(baseDef);
  const baseLayer = new Cesium.ImageryLayer(baseProvider);
  baseLayer.brightness = 1.06;
  baseLayer.contrast = 1.12;
  baseLayer.alpha = typeof baseDef.opacity === 'number' ? baseDef.opacity : 1.0;
  baseLayer.show = baseDef.visible !== false;

  globe.imageryLayers.add(baseLayer);
  lunarImageryLayers.set('lro-wac-morphology', baseLayer);

  globe.terrainProvider = new Cesium.EllipsoidTerrainProvider({
    ellipsoid: Cesium.Ellipsoid.MOON,
  });

  return globe;
}

export function setMoonRasterLayer(globe, scene, layerId, visible, opacity) {
  if (!globe || !globe.imageryLayers) return false;
  const layerDef = LUNAR_LAYERS_CATALOG.find(
    (l) => l.id === layerId && l.type === 'wmts'
  );
  if (!layerDef) return false;

  const map = globe._lunarImageryLayers || new Map();
  globe._lunarImageryLayers = map;

  let imageryLayer = map.get(layerId);

  if (!imageryLayer && visible) {
    try {
      const provider = createImageryProviderForLayer(layerDef);
      imageryLayer = new Cesium.ImageryLayer(provider);
      if (layerId === 'lro-wac-morphology') {
        imageryLayer.brightness = 1.06;
        imageryLayer.contrast = 1.12;
      }
      imageryLayer.alpha = Cesium.Math.clamp(
        typeof opacity === 'number' ? opacity : (layerDef.opacity ?? 0.85),
        0.05,
        1.0
      );
      imageryLayer.show = Boolean(visible);

      // Insert in canonical stacking order so overlays always sit above the basemap
      const targetOrderIdx = RASTER_LAYER_ORDER.indexOf(layerId);
      let insertIndex = globe.imageryLayers.length;
      if (targetOrderIdx !== -1) {
        let countBefore = 0;
        for (let i = 0; i < targetOrderIdx; i++) {
          const prevId = RASTER_LAYER_ORDER[i];
          if (map.has(prevId) && globe.imageryLayers.contains(map.get(prevId))) {
            countBefore++;
          }
        }
        insertIndex = Math.min(countBefore, globe.imageryLayers.length);
      }

      globe.imageryLayers.add(imageryLayer, insertIndex);
      map.set(layerId, imageryLayer);
    } catch (err) {
      console.warn(`[moonGlobe] Failed to initialize imagery layer ${layerId}:`, err);
      return false;
    }
  } else if (imageryLayer) {
    if (typeof visible === 'boolean') {
      imageryLayer.show = visible;
    }
    if (typeof opacity === 'number' && Number.isFinite(opacity)) {
      imageryLayer.alpha = Cesium.Math.clamp(opacity, 0.05, 1.0);
    }
  }

  scene?.requestRender?.();
  return true;
}