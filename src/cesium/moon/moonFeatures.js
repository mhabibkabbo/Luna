/**
 * @file moonFeatures.js
 * Creates lunar catalog pins and handles their interaction and custom waypoints.
 */

import * as Cesium from 'cesium';
import { LUNAR_FEATURES } from '../../data/lunarFeatures.js';
import { LANDING_SITES } from '../../data/landingSites.js';
import { formatLunarCoordinates, getLunarRegionInfo, findNearestLunarFeature } from '../../utils/coordinates.js';

/**
 * Creates the Moon's catalog pins and keeps their selection and layer state together.
 * The marker-image factory is injected so marker rendering remains owned by the Moon UI.
 */
export function createMoonFeatures({ viewer, container, callbacks, isMobile, flyToCoordinate, getLunarMarkerDataUrl }) {
  const scene = viewer.scene;
  const ALL_CATALOG_FEATURES = [...LUNAR_FEATURES, ...LANDING_SITES];
  const pinEntities = [];
  let selectedEntity = null;
  let customPinEntity = null;

  /**
   * Helper to add an entity pin with LOD distance culling and categorized vector icons.
   * @param {Object} feat
   * @param {string} category
   * @param {'landing_apollo' | 'landing_robotic' | 'south_pole' | 'crater_major' | 'crater_minor' | 'mountain' | 'mare' | 'valley'} markerType
   * @param {1 | 2 | 3} tier LOD Tier (1 = Global, 2 = Regional, 3 = Close-up)
   */
  const addFeaturePin = (feat, category, markerType = 'crater_minor', tier = 3) => {
    const dataUrl = getLunarMarkerDataUrl(markerType, false);
    const altitude = 2500; // Elevation in meters above lunar ellipsoid

    // Restrained, zoom-dependent LOD distance thresholds to eliminate label collisions & clutter
    let maxBillboardDist = 2.8e6;
    let maxLabelDist = 9.0e5;
    let baseScale = 0.20;
    let labelFont = '600 11px system-ui, -apple-system, sans-serif';
    let labelOffset = -18;

    if (tier === 1) {
      maxBillboardDist = 2.5e7;
      maxLabelDist = 5.2e6; // Only top missions (Apollo 11, Odysseus CLPS, South Pole) visible from orbit
      baseScale = 0.28;
      labelFont = '700 12px system-ui, -apple-system, sans-serif';
      labelOffset = -22;
    } else if (tier === 2) {
      maxBillboardDist = 7.0e6;
      maxLabelDist = 2.2e6; // Regional landmarks visible when zooming closer
      baseScale = 0.23;
      labelFont = '600 11px system-ui, -apple-system, sans-serif';
      labelOffset = -20;
    }

    // Clean, readable short name without excessive subtitles on map
    const shortName = feat.name.split('(')[0].trim();

    const entity = viewer.entities.add({
      name: feat.name,
      position: Cesium.Cartesian3.fromDegrees(feat.longitude, feat.latitude, altitude, Cesium.Ellipsoid.MOON),
      billboard: {
        image: dataUrl,
        verticalOrigin: Cesium.VerticalOrigin.CENTER,
        horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
        scale: baseScale,
        eyeOffset: new Cesium.Cartesian3(0, 0, -20),
        distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0.0, maxBillboardDist),
        scaleByDistance: new Cesium.NearFarScalar(1.0e5, 1.0, 2.5e7, 0.8),
        translucencyByDistance: new Cesium.NearFarScalar(2.0e7, 1.0, 3.5e7, 0.7),
      },
      label: {
        text: shortName,
        font: labelFont,
        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
        fillColor: Cesium.Color.fromCssColorString('#f8fafc'),
        outlineColor: Cesium.Color.fromCssColorString('#020617'),
        outlineWidth: 2.5,
        showBackground: true,
        backgroundColor: Cesium.Color.fromCssColorString('rgba(6, 11, 22, 0.88)'),
        backgroundPadding: new Cesium.Cartesian2(6, 3),
        verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
        pixelOffset: new Cesium.Cartesian2(0, labelOffset),
        eyeOffset: new Cesium.Cartesian3(0, 0, -30),
        scale: 1.0,
        distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0.0, maxLabelDist),
        scaleByDistance: new Cesium.NearFarScalar(1.0e5, 1.0, 1.8e7, 0.9),
      },
      properties: {
        feature: feat,
        category,
        markerType,
        tier,
        baseScale,
        maxBillboardDist,
        maxLabelDist,
      },
    });

    pinEntities.push(entity);
  };

  /**
   * Highlights and scales a selected pin entity, ensuring its label is always visible.
   */
  const selectFeaturePin = (featureId) => {
    if (selectedEntity) {
      try {
        const prevProps = selectedEntity.properties;
        const prevScale = prevProps.baseScale?.getValue() || 0.22;
        const prevMaxDist = prevProps.maxLabelDist?.getValue() || 9.0e5;
        const prevType = prevProps.markerType?.getValue() || 'crater_minor';

        if (selectedEntity.billboard) {
          selectedEntity.billboard.scale = prevScale;
          selectedEntity.billboard.image = getLunarMarkerDataUrl(prevType, false);
          const maxBillboardDist =
            prevProps.maxBillboardDist?.getValue() ?? 2.8e6;
          selectedEntity.billboard.distanceDisplayCondition =
            new Cesium.DistanceDisplayCondition(0.0, maxBillboardDist);
        }
        if (selectedEntity.label) {
          selectedEntity.label.distanceDisplayCondition = new Cesium.DistanceDisplayCondition(0.0, prevMaxDist);
          selectedEntity.label.fillColor = Cesium.Color.fromCssColorString('#f8fafc');
        }
      } catch {}
      selectedEntity = null;
    }

    if (!featureId) return;

    const target = [...pinEntities, customPinEntity].find((e) => {
      const f = e.properties?.feature?.getValue();
      return f?.id === featureId;
    });

    if (target) {
      selectedEntity = target;
      try {
        const markerType = target.properties?.markerType?.getValue() || 'landing_apollo';
        const base = target.properties?.baseScale?.getValue() || 0.22;
        if (target.billboard) {
          target.billboard.scale = base * 1.4;
          target.billboard.image = getLunarMarkerDataUrl(markerType, true);
          target.billboard.distanceDisplayCondition =
            new Cesium.DistanceDisplayCondition(0.0, 1.0e9);
        }
        if (target.label) {
          // Force selected label visible across orbital zooms
          target.label.distanceDisplayCondition = new Cesium.DistanceDisplayCondition(0.0, 5.0e7);
          target.label.fillColor = Cesium.Color.fromCssColorString('#38bdf8');
        }
      } catch {}
    }
  };

  // A. South Pole (90°S) - Prime Artemis Site (Tier 1)
  const southPoleFeature = {
    id: 'south-pole',
    name: 'Lunar South Pole (90°S)',
    type: 'south_pole',
    latitude: -90,
    longitude: 0,
    description: 'Permanently shadowed craters (PSRs) harboring volatile water ice deposits. Prime target zone for NASA Artemis and CLPS lunar landers.',
  };
  addFeaturePin(southPoleFeature, 'lunar-landing-sites', 'south_pole', 1);

  // B. Landing Sites (CLPS, Apollo, Chang\'e, Chandrayaan, SLIM)
  LANDING_SITES.forEach((site) => {
    const isApollo11 = site.id === 'landing-apollo-11';
    const isOdysseus = site.id === 'landing-odysseus';
    const isArtemisCandidate = site.id.includes('artemis');
    const isCrewedApollo = site.id.includes('apollo');
    const isMajorRobotic = ['landing-change-4', 'landing-change-5', 'landing-change-6', 'landing-chandrayaan-3', 'landing-slim', 'landing-lcross'].includes(site.id);

    if (isApollo11 || isOdysseus) {
      // Tier 1: Global visibility for Apollo 11 and Odysseus (CLPS)
      addFeaturePin(site, 'lunar-landing-sites', 'landing_apollo', 1);
    } else if (isArtemisCandidate || isCrewedApollo) {
      // Tier 2: Regional visibility
      addFeaturePin(site, 'lunar-landing-sites', 'landing_apollo', 2);
    } else if (isMajorRobotic) {
      addFeaturePin(site, 'lunar-landing-sites', 'landing_robotic', 2);
    } else {
      addFeaturePin(site, 'lunar-landing-sites', 'landing_robotic', 3);
    }
  });

  // C. Named Craters, Mountains, Maria, and Valleys from LUNAR_FEATURES
  const iconicFeatures = ['Tycho', 'Copernicus', 'Mare Tranquillitatis'];
  const majorLandmarks = ['Plato', 'Aristarchus', 'Kepler', 'Clavius', 'Archimedes', 'Langrenus', 'Shackleton', 'Mare Imbrium', 'Mare Serenitatis', 'Oceanus Procellarum', 'Mare Crisium', 'Montes Apenninus', 'Mons Huygens', 'Mons Malapert'];

  LUNAR_FEATURES.forEach((feat) => {
    if (feat.type === 'crater') {
      if (iconicFeatures.includes(feat.name)) {
        addFeaturePin(feat, 'lunar-craters', 'crater_major', 1);
      } else if (majorLandmarks.includes(feat.name) || (feat.diameterKm && feat.diameterKm >= 80)) {
        addFeaturePin(feat, 'lunar-craters', 'crater_major', 2);
      } else {
        addFeaturePin(feat, 'lunar-craters', 'crater_minor', 3);
      }
    } else if (feat.type === 'mountain') {
      const isMajor = majorLandmarks.includes(feat.name) || (feat.elevationM && feat.elevationM >= 3000);
      addFeaturePin(feat, 'lunar-mountains', 'mountain', isMajor ? 2 : 3);
    } else if (feat.type === 'mare') {
      if (iconicFeatures.includes(feat.name)) {
        addFeaturePin(feat, 'lunar-maria', 'mare', 1);
      } else {
        addFeaturePin(feat, 'lunar-maria', 'mare', 2);
      }
    } else if (feat.type === 'valley' || feat.type === 'rille') {
      addFeaturePin(feat, 'lunar-valleys', 'valley', 3);
    }
  });

  const setLayerVisibility = (layerId, isVisible) => {
    pinEntities.forEach((entity) => {
      const cat = entity.properties?.category?.getValue();
      if (cat === layerId) {
        entity.show = isVisible;
      }
    });
  };

  // 4. Screen Space Event Handler for Mouse Hover and Clicks
  const handler = new Cesium.ScreenSpaceEventHandler(scene.canvas);

  let hoveredEntity = null;
  let clickStartPosition = null;

  /**
   * Drops or moves the custom user pin on the 3D Moon surface.
   */
  const dropCustomPin = (lon, lat, customName) => {
    const normLon = ((((lon + 180) % 360) + 360) % 360) - 180;
    const normLat = Math.max(-90, Math.min(90, lat));
    const { latStr, lonStr, combined } = formatLunarCoordinates(normLon, normLat, 4);
    const region = getLunarRegionInfo(normLon, normLat);
    const nearest = findNearestLunarFeature(normLon, normLat, ALL_CATALOG_FEATURES);

    const pinTitle = customName || 'Custom Dropped Pin';

    const customPinData = {
      id: 'custom-user-pin',
      name: pinTitle,
      type: 'custom_pin',
      latitude: normLat,
      longitude: normLon,
      latStr,
      lonStr,
      combinedCoordinates: combined,
      regionInfo: region,
      nearestFeature: nearest?.feature?.name || null,
      nearestFeatureDistanceKm: nearest?.distanceKm || null,
      nearestFeatureType: nearest?.feature?.type || null,
      isCustomPin: true,
      description: `Selenographic waypoint recorded at ${combined} (${normLat.toFixed(4)}°, ${normLon.toFixed(4)}°). Positioned in ${region.regionDescription}.${nearest ? ` Nearest cataloged lunar landmark: ${nearest.feature.name} (${nearest.distanceKm} km away).` : ''}`,
      source: 'User Selenographic Waypoint',
    };

    // Remove existing custom pin entity if present
    if (customPinEntity) {
      viewer.entities.remove(customPinEntity);
      customPinEntity = null;
    }

    const pinIconUrl = getLunarMarkerDataUrl('custom_pin', true);

    customPinEntity = viewer.entities.add({
      name: pinTitle,
      position: Cesium.Cartesian3.fromDegrees(normLon, normLat, 3000, Cesium.Ellipsoid.MOON),
      billboard: {
        image: pinIconUrl,
        verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
        horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
        scale: 0.35,
        eyeOffset: new Cesium.Cartesian3(0, 0, -20),
        scaleByDistance: new Cesium.NearFarScalar(1.0e5, 1.0, 2.0e7, 0.75),
      },
      label: {
        text: `${pinTitle}\n${latStr}, ${lonStr}`,
        font: 'bold 12px "Space Mono", monospace',
        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
        fillColor: Cesium.Color.fromCssColorString('#ffe4e6'),
        outlineColor: Cesium.Color.fromCssColorString('#881337'),
        outlineWidth: 2,
        showBackground: true,
        backgroundColor: Cesium.Color.fromCssColorString('rgba(15, 23, 42, 0.94)'),
        backgroundPadding: new Cesium.Cartesian2(7, 4),
        verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
        pixelOffset: new Cesium.Cartesian2(0, -42),
        eyeOffset: new Cesium.Cartesian3(0, 0, -30),
        scale: 1.0,
        scaleByDistance: new Cesium.NearFarScalar(1.0e5, 1.0, 1.8e7, 0.9),
      },
      properties: {
        feature: customPinData,
        category: 'custom-pin',
        markerType: 'custom_pin',
        baseScale: 0.35,
        maxBillboardDist: 2.8e6,
      },
    });

    selectFeaturePin(customPinData.id);
    return customPinData;
  };

  /**
   * Clears the active custom pin from the 3D Moon scene.
   */
  const clearCustomPin = () => {
    if (customPinEntity) {
      viewer.entities.remove(customPinEntity);
      customPinEntity = null;
    }
  };

  // Throttled mouse move event handler to avoid 60fps React state updates during navigation
  let lastCoordsThrottleTime = 0;
  let lastHoverPickTime = 0;
  const COORDS_THROTTLE_MS = 100;
  const HOVER_THROTTLE_MS = 140;
  let pointerIsDown = false;

  handler.setInputAction((movement) => {
    // Skip all picking while dragging the camera and on touch devices (no hover there)
    if (pointerIsDown || isMobile) return;
    const now = performance.now();

    // 1. Raycast on Moon globe surface to calculate Selenographic Longitude / Latitude (throttled)
    if (now - lastCoordsThrottleTime >= COORDS_THROTTLE_MS) {
      lastCoordsThrottleTime = now;
      // Analytic ray/ellipsoid intersection: far cheaper than globe.pick against tile geometry
      const cartesian = viewer.camera.pickEllipsoid(movement.endPosition, Cesium.Ellipsoid.MOON);
      if (cartesian) {
        const cartographic = Cesium.Ellipsoid.MOON.cartesianToCartographic(cartesian);
        callbacks.onPointerCoordinates?.(
          Cesium.Math.toDegrees(cartographic.longitude),
          Cesium.Math.toDegrees(cartographic.latitude)
        );
      }
    }

    // 2. Pick feature pins on hover (throttled)
    if (now - lastHoverPickTime >= HOVER_THROTTLE_MS) {
      lastHoverPickTime = now;
      const pickedObject = scene.pick(movement.endPosition);
      if (Cesium.defined(pickedObject) && pickedObject.id?.properties?.feature) {
        container.style.cursor = 'pointer';
        const feature = pickedObject.id.properties.feature.getValue();
        const markerType = pickedObject.id.properties.markerType?.getValue() || 'crater_minor';
        const baseScale = pickedObject.id.properties.baseScale?.getValue() || 0.55;

        if (hoveredEntity !== pickedObject.id) {
          if (hoveredEntity) {
            const prevBase = hoveredEntity.properties.baseScale?.getValue() || 0.55;
            const prevType = hoveredEntity.properties.markerType?.getValue() || 'crater_minor';
            hoveredEntity.billboard.scale = prevBase;
            hoveredEntity.billboard.image = getLunarMarkerDataUrl(prevType, false);
          }
          hoveredEntity = pickedObject.id;
          hoveredEntity.billboard.scale = baseScale * 1.35;
          hoveredEntity.billboard.image = getLunarMarkerDataUrl(markerType, true);
        }

        scene.requestRender();
        callbacks.onFeatureHover?.(feature, movement.endPosition.x, movement.endPosition.y);
      } else {
        container.style.cursor = 'default';
        if (hoveredEntity) {
          const prevBase = hoveredEntity.properties.baseScale?.getValue() || 0.55;
          const prevType = hoveredEntity.properties.markerType?.getValue() || 'crater_minor';
          hoveredEntity.billboard.scale = prevBase;
          hoveredEntity.billboard.image = getLunarMarkerDataUrl(prevType, false);
          hoveredEntity = null;
          scene.requestRender();
        }
        callbacks.onFeatureHover?.(null, 0, 0);
      }
    }
  }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

  // Track pointer down to avoid triggering pin drops during camera orbit drags
  handler.setInputAction((down) => {
    clickStartPosition = Cesium.Cartesian2.clone(down.position);
    pointerIsDown = true;
  }, Cesium.ScreenSpaceEventType.LEFT_DOWN);

  handler.setInputAction(() => {
    pointerIsDown = false;
  }, Cesium.ScreenSpaceEventType.LEFT_UP);

  handler.setInputAction((click) => {
    // If pointer was dragged more than 6 pixels, ignore as orbit drag
    if (clickStartPosition) {
      const dx = click.position.x - clickStartPosition.x;
      const dy = click.position.y - clickStartPosition.y;
      if (Math.hypot(dx, dy) > 6) {
        return;
      }
    }

    const pickedObject = scene.pick(click.position);
    if (Cesium.defined(pickedObject) && pickedObject.id?.properties?.feature) {
      const feature = pickedObject.id.properties.feature.getValue();
      selectFeaturePin(feature.id);
      callbacks.onFeatureSelect?.(feature);
      const targetHeight =
        feature.type === 'mare'
          ? 2600000
          : feature.type === 'crater' && feature.diameterKm < 50
          ? 600000
          : 1200000;
      flyToCoordinate(feature.longitude, feature.latitude, targetHeight);
      return;
    }

    // User clicked on the 3D Moon surface itself -> Drop custom pin!
    const ray = viewer.camera.getPickRay(click.position);
    if (ray) {
      const cartesian = viewer.camera.pickEllipsoid(click.position, Cesium.Ellipsoid.MOON);
      if (cartesian) {
        const cartographic = Cesium.Ellipsoid.MOON.cartesianToCartographic(cartesian);
        const lon = Cesium.Math.toDegrees(cartographic.longitude);
        const lat = Cesium.Math.toDegrees(cartographic.latitude);

        const customPinData = dropCustomPin(lon, lat);
        callbacks.onDropCustomPin?.(customPinData);
        callbacks.onFeatureSelect?.(customPinData);
      }
    }
  }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

  // 5. Initial Camera Positioning over Lunar Nearside
  viewer.camera.setView({
    destination: Cesium.Cartesian3.fromDegrees(0, 0, 7500000, Cesium.Ellipsoid.MOON),
  });


  const destroy = () => {
    if (customPinEntity && !viewer.isDestroyed()) {
      viewer.entities.remove(customPinEntity);
      customPinEntity = null;
    }
    if (handler && !handler.isDestroyed()) {
      handler.destroy();
    }
    if (container) {
      container.style.cursor = 'default';
    }
  };

  return { pinEntities, selectFeaturePin, setLayerVisibility, dropCustomPin, clearCustomPin, destroy };
}
