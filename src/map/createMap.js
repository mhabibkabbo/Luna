/**
 * @file createMap.js
 * OpenLayers Lunar Map factory module.
 * Instantiates the OpenLayers Map, lunar projection, WMTS raster datasets,
 * vector feature layers (craters, rims, mountains, maria, valleys, landing sites), and GIS interactions.
 */

import OlMap from 'ol/Map.js';
import View from 'ol/View.js';
import { defaults as defaultControls } from 'ol/control.js';
import { initializeLunarProjection, LUNAR_EXTENT, LUNAR_CENTER } from './projection.js';
import { createNasaWmtsLayer } from './nasaWmts.js';
import { createLunarVectorLayers } from './layers.js';
import { createMeasurementLayer, LunarMeasurementController, setupPointerTracking } from './interactions.js';
import { LUNAR_LAYERS_CATALOG } from '../services/nasa/layers.js';
import { NASA_MOON_RESOLUTIONS } from '../services/nasa/capabilities.js';

/**
 * Extended lunar resolutions for smooth zooming from global overview to deep feature inspection.
 */
const EXTENDED_RESOLUTIONS = [
  ...NASA_MOON_RESOLUTIONS,
  0.001373291015625,   // Zoom 9
  0.0006866455078125,  // Zoom 10
  0.00034332275390625, // Zoom 11
];

/**
 * Instantiates and configures the complete OpenLayers lunar map application.
 * 
 * @param {HTMLElement} targetElement - DOM element container
 * @param {Object} callbacks
 * @param {Function} [callbacks.onPointerCoordinates]
 * @param {Function} [callbacks.onFeatureSelect]
 * @param {Function} [callbacks.onMeasurementUpdate]
 * @param {Function} [callbacks.onResolutionChange]
 * @param {Function} [callbacks.onTileLoading]
 * @param {Function} [callbacks.onTileLoaded]
 * @param {Function} [callbacks.onTileError]
 * @returns {Object} Map controller instance and API methods
 */
export function createLunarMap(targetElement, callbacks = {}) {
  const moonProjection = initializeLunarProjection();

  // Create raster WMTS layers
  const rasterLayersMap = new Map();
  const wmtsLayerConfigs = LUNAR_LAYERS_CATALOG.filter((l) => l.type === 'wmts');

  wmtsLayerConfigs.forEach((layerConfig) => {
    const tileLayer = createNasaWmtsLayer(layerConfig, moonProjection, {
      onTileLoading: callbacks.onTileLoading,
      onTileLoaded: callbacks.onTileLoaded,
      onTileError: callbacks.onTileError,
    });
    rasterLayersMap.set(layerConfig.id, tileLayer);
  });

  // Create vector layers
  const {
    craterRimsLayer,
    cratersLayer,
    mountainsLayer,
    mariaLayer,
    valleysLayer,
    apolloSitesLayer,
    roboticSitesLayer,
    vectorLayers,
    vectorSources,
  } = createLunarVectorLayers();

  // Create measurement layer
  const { measureLayer, measureSource } = createMeasurementLayer();

  // Assemble all layers in proper stacking order
  const allLayers = [
    ...Array.from(rasterLayersMap.values()),
    craterRimsLayer,
    mariaLayer,
    valleysLayer,
    cratersLayer,
    mountainsLayer,
    apolloSitesLayer,
    roboticSitesLayer,
    measureLayer,
  ];

  // Configure View: Equirectangular 360° x 180° bounds with minZoom 2.5x
  const view = new View({
    projection: moonProjection,
    center: LUNAR_CENTER,
    zoom: 2.5,
    minZoom: 2.5,
    maxZoom: 12,
    extent: LUNAR_EXTENT,
    smoothExtentConstraint: true,
    constrainOnlyCenter: false,
  });

  // Create Map instance
  const map = new OlMap({
    target: targetElement,
    layers: allLayers,
    view: view,
    controls: defaultControls({
      zoom: false, // Custom Google Maps-style controls used
      rotate: false,
      attribution: false,
    }),
  });

  // Pointer coordinate tracking
  const cleanupPointerTracking = setupPointerTracking(map, (lon, lat) => {
    if (callbacks.onPointerCoordinates) {
      callbacks.onPointerCoordinates(lon, lat);
    }
  });

  // Measurement controller
  const measurementController = new LunarMeasurementController(
    map,
    measureSource,
    callbacks.onMeasurementUpdate
  );

  // Helper to find feature by ID across all sources
  const findFeatureById = (id) => {
    if (!id) return null;
    return (
      vectorSources.cratersSource.getFeatureById(id) ||
      vectorSources.mountainsSource.getFeatureById(id) ||
      vectorSources.mariaSource.getFeatureById(id) ||
      vectorSources.valleysSource.getFeatureById(id) ||
      vectorSources.apolloSource.getFeatureById(id) ||
      vectorSources.roboticSource.getFeatureById(id)
    );
  };

  // Click interaction for feature selection
  let selectedFeatureId = null;

  const handleMapClick = (evt) => {
    // If measurement mode is active, don't trigger feature selection
    if (measurementController.isActive) return;

    let hit = null;
    map.forEachFeatureAtPixel(evt.pixel, (feat, layer) => {
      // If user clicks directly on a crater rim polygon, select the parent crater
      if (feat.get('isRim')) {
        const parentCraterId = feat.get('craterId');
        hit = findFeatureById(parentCraterId);
        if (hit) return true;
      }

      // Check if feature belongs to one of our interactive vector layers
      if (
        layer === cratersLayer ||
        layer === mountainsLayer ||
        layer === mariaLayer ||
        layer === valleysLayer ||
        layer === apolloSitesLayer ||
        layer === roboticSitesLayer
      ) {
        hit = feat;
        return true;
      }
    });

    // Reset previous selection styles
    if (selectedFeatureId) {
      const prevFeat = findFeatureById(selectedFeatureId);
      if (prevFeat) prevFeat.set('isSelected', false);

      const prevRim = vectorSources.craterRimsSource.getFeatureById(`rim-${selectedFeatureId}`);
      if (prevRim) prevRim.set('isSelected', false);
    }

    if (hit) {
      selectedFeatureId = hit.getId();
      hit.set('isSelected', true);

      // Also highlight associated crater rim polygon if applicable
      const associatedRim = vectorSources.craterRimsSource.getFeatureById(`rim-${selectedFeatureId}`);
      if (associatedRim) associatedRim.set('isSelected', true);

      const props = hit.getProperties();
      if (callbacks.onFeatureSelect) {
        callbacks.onFeatureSelect(props);
      }
    } else {
      selectedFeatureId = null;
      if (callbacks.onFeatureSelect) {
        callbacks.onFeatureSelect(null);
      }
    }
  };

  map.on('singleclick', handleMapClick);

  // Helper to fly/center to a coordinate
  const flyToCoordinate = (longitude, latitude, targetZoom = 4) => {
    view.animate({
      center: [longitude, latitude],
      zoom: Math.max(2.5, targetZoom),
      duration: 800,
    });
  };

  // Helper to reset to whole-Moon overview
  const resetToMoonOverview = () => {
    view.animate({
      center: LUNAR_CENTER,
      zoom: 2.5,
      duration: 700,
    });
  };

  // Helper to fly to Lunar South Pole (Shackleton, Malapert, Cabeus region)
  const flyToSouthPole = (targetZoom = 4.8) => {
    view.animate({
      center: [0.0, -88.5],
      zoom: targetZoom,
      duration: 900,
    });
  };

  // Helper to select and highlight a feature by ID
  const selectFeatureById = (featureId, zoomIn = true) => {
    const feat = findFeatureById(featureId);

    if (selectedFeatureId && selectedFeatureId !== featureId) {
      const prev = findFeatureById(selectedFeatureId);
      if (prev) prev.set('isSelected', false);

      const prevRim = vectorSources.craterRimsSource.getFeatureById(`rim-${selectedFeatureId}`);
      if (prevRim) prevRim.set('isSelected', false);
    }

    if (feat) {
      selectedFeatureId = featureId;
      feat.set('isSelected', true);

      const associatedRim = vectorSources.craterRimsSource.getFeatureById(`rim-${featureId}`);
      if (associatedRim) associatedRim.set('isSelected', true);

      const props = feat.getProperties();

      if (zoomIn) {
        const targetZoom = props.type === 'mare' ? 2.8 : 4.5;
        flyToCoordinate(props.longitude, props.latitude, targetZoom);
      }

      if (callbacks.onFeatureSelect) {
        callbacks.onFeatureSelect(props);
      }
    }
  };

  // Layer toggle handler
  const setLayerVisibility = (layerId, isVisible, opacity = null) => {
    if (rasterLayersMap.has(layerId)) {
      const layer = rasterLayersMap.get(layerId);
      layer.setVisible(isVisible);
      if (opacity !== null && opacity !== undefined) layer.setOpacity(opacity);
      return;
    }

    const applyVector = (layer) => {
      if (!layer) return;
      layer.setVisible(isVisible);
      if (opacity !== null && opacity !== undefined) layer.setOpacity(opacity);
    };

    switch (layerId) {
      case 'lunar-craters':
        applyVector(cratersLayer);
        applyVector(craterRimsLayer);
        break;
      case 'lunar-mountains':
        applyVector(mountainsLayer);
        break;
      case 'lunar-maria':
        applyVector(mariaLayer);
        break;
      case 'lunar-valleys':
        applyVector(valleysLayer);
        break;
      case 'apollo-landing-sites':
        applyVector(apolloSitesLayer);
        break;
      case 'robotic-landing-sites':
        applyVector(roboticSitesLayer);
        break;
      default:
        break;
    }
  };

  // Quick preset terrain mode switcher (Photographic, Shaded Relief, Elevation, Blended)
  const setTerrainMode = (mode) => {
    const wac = rasterLayersMap.get('lro-wac-morphology');
    const shade = rasterLayersMap.get('lola-shaded-relief');
    const clrShade = rasterLayersMap.get('lola-color-hillshade');
    const dem = rasterLayersMap.get('lola-dem-elevation');

    if (!wac) return;

    if (mode === 'photographic') {
      wac.setVisible(true);
      wac.setOpacity(1.0);
      if (shade) shade.setVisible(false);
      if (clrShade) clrShade.setVisible(false);
      if (dem) dem.setVisible(false);
    } else if (mode === 'terrain') {
      // 3D Shaded Relief
      if (shade) {
        shade.setVisible(true);
        shade.setOpacity(1.0);
      }
      wac.setVisible(false);
      if (clrShade) clrShade.setVisible(false);
      if (dem) dem.setVisible(false);
    } else if (mode === 'elevation') {
      // Color Hillshade Topography
      if (clrShade) {
        clrShade.setVisible(true);
        clrShade.setOpacity(0.9);
      }
      wac.setVisible(false);
      if (shade) shade.setVisible(false);
      if (dem) dem.setVisible(false);
    } else if (mode === 'blended') {
      // Real photographic surface + 3D Shaded Relief overlay
      wac.setVisible(true);
      wac.setOpacity(1.0);
      if (shade) {
        shade.setVisible(true);
        shade.setOpacity(0.55);
      }
      if (clrShade) clrShade.setVisible(false);
      if (dem) dem.setVisible(false);
    }
  };

  // Resolution change observer
  if (callbacks.onResolutionChange) {
    view.on('change:resolution', () => {
      callbacks.onResolutionChange(view.getResolution());
    });
  }

  // Cleanup on unmount
  const destroy = () => {
    cleanupPointerTracking();
    measurementController.deactivate();
    map.un('singleclick', handleMapClick);
    map.setTarget(null);
  };

  return {
    map,
    view,
    rasterLayersMap,
    craterRimsLayer,
    cratersLayer,
    mountainsLayer,
    mariaLayer,
    valleysLayer,
    apolloSitesLayer,
    roboticSitesLayer,
    vectorLayers,
    measurementController,
    flyToCoordinate,
    resetToMoonOverview,
    flyToSouthPole,
    selectFeatureById,
    setLayerVisibility,
    setTerrainMode,
    destroy,
  };
}
