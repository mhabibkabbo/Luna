import * as Cesium from 'cesium';
import { LUNAR_FEATURES } from '../../data/lunarFeatures.js';
import { LANDING_SITES } from '../../data/landingSites.js';
import { formatLunarCoordinates, getLunarRegionInfo, findNearestLunarFeature } from '../../utils/coordinates.js';
import { selectBestPickedMarker } from '../../utils/markerHitSelection.js';
import { comparisonSelectionStore } from '../../utils/comparisonEngine.js';
import { createCustomPinId } from '../../utils/customPinId.js';

export function createMoonFeatures({ viewer, container, callbacks, isMobile, flyToCoordinate, getLunarMarkerDataUrl }) {
  const scene = viewer.scene;
  const ALL_CATALOG_FEATURES = [...LUNAR_FEATURES, ...LANDING_SITES];
  const pinEntities = [];
  const customPinEntities = [];
  let selectedEntity = null;
  let hoveredEntity = null;
  const isCompared = (entity) =>
    comparisonSelectionStore.isFeatureInComparison(
      entity?.properties?.feature?.getValue?.()
    );

  /**
   * Helper to add an entity pin with LOD distance culling and categorized vector icons.
   * @param {Object} feat
   * @param {string} category
   * @param {'landing_apollo' | 'landing_robotic' | 'south_pole' | 'crater_major' | 'crater_minor' | 'mountain' | 'mare' | 'valley'} markerType
   * @param {1 | 2 | 3} tier LOD Tier (1 = Global, 2 = Regional, 3 = Close-up)
   */
  const addFeaturePin = (feat, category, markerType = 'crater_minor', tier = 3) => {
    if (!feat || feat.locationType === 'placeholder') {
      return null;
    }
    const dataUrl = getLunarMarkerDataUrl(markerType, false);
    const altitude = 2500; // Elevation in meters above lunar ellipsoid

    let maxBillboardDist = 2.8e6;
    let maxLabelDist = 9.0e5;
    let baseScale = 0.20;
    let labelFont = '600 22px "Inter", -apple-system, BlinkMacSystemFont, sans-serif';
    let labelOffset = -18;

    if (tier === 1) {
      maxBillboardDist = 2.5e7;
      maxLabelDist = 5.2e6;
      baseScale = 0.28;
      labelFont = '600 24px "Inter", -apple-system, BlinkMacSystemFont, sans-serif';
      labelOffset = -22;
    } else if (tier === 2) {
      maxBillboardDist = 7.0e6;
      maxLabelDist = 1.8e6;
      baseScale = 0.23;
      labelFont = '600 22px "Inter", -apple-system, BlinkMacSystemFont, sans-serif';
      labelOffset = -20;
    } else {
      maxBillboardDist = 2.6e6;
      maxLabelDist = 7.5e5;
    }

    const shortName = feat.name.split('(')[0].trim();

    const entity = viewer.entities.add({
      name: feat.name,
      position: Cesium.Cartesian3.fromDegrees(feat.longitude, feat.latitude, altitude, Cesium.Ellipsoid.MOON),
      billboard: {
        image: dataUrl,
        verticalOrigin: Cesium.VerticalOrigin.CENTER,
        horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
        scale: baseScale,
        // Keep billboard icons closer to the camera than label text boxes so overlapping labels never block site marker clicks.
        eyeOffset: new Cesium.Cartesian3(
          0,
          0,
          markerType === 'landing_apollo' || markerType === 'landing_robotic' ? -55 : -45
        ),
        distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0.0, maxBillboardDist),
        scaleByDistance: new Cesium.NearFarScalar(1.0e5, 1.0, 2.5e7, 0.8),
        translucencyByDistance: new Cesium.NearFarScalar(2.0e7, 1.0, 3.5e7, 0.7),
      },
      label: {
        text: shortName,
        font: labelFont,
        style: Cesium.LabelStyle.FILL,
        fillColor: Cesium.Color.fromCssColorString('#F8FAFC'),
        showBackground: true,
        backgroundColor: Cesium.Color.fromCssColorString('rgba(10, 11, 14, 0.90)'),
        backgroundPadding: new Cesium.Cartesian2(10, 6),
        verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
        pixelOffset: new Cesium.Cartesian2(0, labelOffset),
        eyeOffset: new Cesium.Cartesian3(0, 0, -20),
        scale: 0.5,
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

  const selectFeaturePin = (featureId) => {
    if (!viewer || viewer.isDestroyed()) return;

    if (selectedEntity && !viewer.entities.contains(selectedEntity)) {
      selectedEntity = null;
    }

    const target = featureId
      ? [...pinEntities, ...customPinEntities]
          .filter((e) => e && viewer.entities.contains(e))
          .find((e) => {
            const f = e?.properties?.feature?.getValue();
            return f?.id === featureId;
          })
      : null;

    if (target && target === selectedEntity) {
      scene.requestRender();
      return;
    }

    if (selectedEntity) {
      try {
        const prevProps = selectedEntity.properties;
        const prevScale = prevProps.baseScale?.getValue() || 0.22;
        const prevMaxDist = prevProps.maxLabelDist?.getValue() || 9.0e5;
        const prevType = prevProps.markerType?.getValue() || 'crater_minor';

        if (selectedEntity.billboard) {
          selectedEntity.billboard.scale = prevScale;
          selectedEntity.billboard.image = getLunarMarkerDataUrl(prevType, false, isCompared(selectedEntity));
          const maxBillboardDist =
            prevProps.maxBillboardDist?.getValue() ?? 2.8e6;
          selectedEntity.billboard.distanceDisplayCondition =
            new Cesium.DistanceDisplayCondition(0.0, maxBillboardDist);
        }
        if (selectedEntity.label) {
          selectedEntity.label.distanceDisplayCondition = new Cesium.DistanceDisplayCondition(0.0, prevMaxDist);
          selectedEntity.label.fillColor = Cesium.Color.fromCssColorString(
            isCompared(selectedEntity) ? '#00D2C4' : '#F8FAFC'
          );
          selectedEntity.label.style = Cesium.LabelStyle.FILL;
        }
      } catch {}
      selectedEntity = null;
    }

    if (!featureId) {
      scene.requestRender();
      return;
    }

    if (target) {
      selectedEntity = target;
      try {
        const markerType = target.properties?.markerType?.getValue() || 'landing_apollo';
        const base = target.properties?.baseScale?.getValue() || 0.22;
        if (target.billboard) {
          target.billboard.scale = base * 1.4;
          target.billboard.image = getLunarMarkerDataUrl(markerType, true, isCompared(target));
          target.billboard.distanceDisplayCondition =
            new Cesium.DistanceDisplayCondition(0.0, 1.0e9);
        }
        if (target.label) {
          target.label.distanceDisplayCondition = new Cesium.DistanceDisplayCondition(0.0, 5.0e7);
          target.label.fillColor = Cesium.Color.fromCssColorString(
            isCompared(target) ? '#00D2C4' : '#FDE68A'
          );
          target.label.style = Cesium.LabelStyle.FILL;
        }
      } catch {}
      scene.requestRender();
    }
  };

  const southPoleFeature = {
    id: 'south-pole',
    name: 'Lunar South Pole (90°S)',
    type: 'south_pole',
    latitude: -90,
    longitude: 0,
    regionInfo: getLunarRegionInfo(0, -90),
    elevationM: 1251,
    rimElevationM: 1251,
    description: 'Permanently shadowed craters (PSRs) harboring volatile water ice deposits. Prime target zone for NASA Artemis and CLPS lunar landers. Surface elevation: +1,251 m along Shackleton rim crest (NASA LOLA DEM).',
  };
  addFeaturePin(southPoleFeature, 'lunar-landing-sites', 'south_pole', 1);

  LANDING_SITES.forEach((site) => {
    if (site.locationType === 'placeholder') {
      return;
    }
    const isApollo11 = site.id === 'landing-apollo-11';
    const isOdysseus = site.id === 'landing-odysseus';
    const isArtemisCandidate = site.id.includes('artemis');
    const isCrewedApollo = site.id.includes('apollo');
    const isMajorRobotic = ['landing-change-4', 'landing-change-5', 'landing-change-6', 'landing-chandrayaan-3', 'landing-slim', 'landing-lcross'].includes(site.id);

    if (isApollo11 || isOdysseus) {
      addFeaturePin(site, 'lunar-landing-sites', 'landing_apollo', 1);
    } else if (isArtemisCandidate || isCrewedApollo) {
      addFeaturePin(site, 'lunar-landing-sites', 'landing_apollo', 2);
    } else if (isMajorRobotic) {
      addFeaturePin(site, 'lunar-landing-sites', 'landing_robotic', 2);
    } else {
      addFeaturePin(site, 'lunar-landing-sites', 'landing_robotic', 3);
    }
  });

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

  const refreshComparisonStyles = () => {
    [...pinEntities, ...customPinEntities].forEach((entity) => {
      const compared = isCompared(entity);
      const selected = entity === selectedEntity || entity === hoveredEntity;
      const markerType = entity.properties?.markerType?.getValue() || 'crater_minor';
      if (entity.billboard) {
        entity.billboard.image = getLunarMarkerDataUrl(markerType, selected, compared);
      }
      if (entity.label) {
        entity.label.fillColor = Cesium.Color.fromCssColorString(
          compared ? '#00D2C4' : entity === selectedEntity ? '#FDE68A' : '#F8FAFC'
        );
      }
    });
    scene.requestRender();
  };
  const unsubscribeComparison = comparisonSelectionStore.subscribe(refreshComparisonStyles);
  refreshComparisonStyles();

  const setLayerVisibility = (layerId, isVisible) => {
    pinEntities.forEach((entity) => {
      const cat = entity.properties?.category?.getValue();
      if (cat === layerId) {
        entity.show = isVisible;
      }
    });
  };

  const handler = new Cesium.ScreenSpaceEventHandler(scene.canvas);

  let clickStartPosition = null;

  const dropCustomPin = (lon, lat, customName) => {
    if (!viewer || viewer.isDestroyed()) return null;
    if (!Number.isFinite(lon) || !Number.isFinite(lat)) return null;

    const normLon = ((((lon + 180) % 360) + 360) % 360) - 180;
    const normLat = Math.max(-90, Math.min(90, lat));
    const pinTitle = customName || 'Custom Dropped Pin';

    const matchingEntity = customPinEntities.find((entity) => {
      const existing = entity.properties?.feature?.getValue?.();
      return (
        viewer.entities.contains(entity) &&
        existing &&
        Math.abs(existing.longitude - normLon) < 1e-5 &&
        Math.abs(existing.latitude - normLat) < 1e-5 &&
        existing.name === pinTitle
      );
    });
    if (matchingEntity) {
      const existingFeature = matchingEntity.properties?.feature?.getValue?.();
      if (existingFeature) {
        selectFeaturePin(existingFeature.id);
        scene.requestRender();
        return existingFeature;
      }
    }

    const { latStr, lonStr, combined } = formatLunarCoordinates(normLon, normLat, 4);
    const region = getLunarRegionInfo(normLon, normLat);
    const nearest = findNearestLunarFeature(normLon, normLat, ALL_CATALOG_FEATURES);

    const customPinData = {
      id: createCustomPinId('custom-user-pin', normLat, normLon),
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

    const pinIconUrl = getLunarMarkerDataUrl('custom_pin', true);

    const customPinEntity = viewer.entities.add({
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
        font: '600 23px "Inter", -apple-system, BlinkMacSystemFont, sans-serif',
        style: Cesium.LabelStyle.FILL,
        fillColor: Cesium.Color.fromCssColorString('#F8FAFC'),
        showBackground: true,
        backgroundColor: Cesium.Color.fromCssColorString('rgba(10, 11, 14, 0.92)'),
        backgroundPadding: new Cesium.Cartesian2(16, 10),
        verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
        pixelOffset: new Cesium.Cartesian2(0, -42),
        eyeOffset: new Cesium.Cartesian3(0, 0, -30),
        scale: 0.5,
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
    customPinEntities.push(customPinEntity);

    selectFeaturePin(customPinData.id);
    return customPinData;
  };

  const clearCustomPin = (featureId) => {
    const entitiesToRemove = featureId
      ? customPinEntities.filter(
          (entity) => entity.properties?.feature?.getValue?.()?.id === featureId
        )
      : [...customPinEntities];

    entitiesToRemove.forEach((entity) => {
      if (hoveredEntity === entity) hoveredEntity = null;
      if (selectedEntity === entity) selectedEntity = null;
      if (!viewer.isDestroyed() && viewer.entities.contains(entity)) {
        viewer.entities.remove(entity);
      }
      const index = customPinEntities.indexOf(entity);
      if (index !== -1) customPinEntities.splice(index, 1);
    });
    if (entitiesToRemove.length > 0) scene.requestRender();
  };

  // Throttled mouse move event handler to avoid 60fps React state updates during navigation
  let lastCoordsThrottleTime = 0;
  let lastHoverPickTime = 0;
  const COORDS_THROTTLE_MS = 100;
  const HOVER_THROTTLE_MS = 200;
  let pointerIsDown = false;

  const pickFeatureEntity = (windowPosition) => {
    if (!windowPosition || !scene || viewer.isDestroyed()) return null;

    let pickedList = [];
    try {
      pickedList = scene.drillPick(windowPosition, 16) || [];
    } catch {
      pickedList = [];
    }
    if (pickedList.length === 0) {
      const singlePick = scene.pick(windowPosition);
      if (singlePick) pickedList = [singlePick];
    }

    const candidates = [];

    for (const picked of pickedList) {
      const entity = picked?.id;
      const feat = entity?.properties?.feature?.getValue?.();
      if (!entity || !feat || entity.show === false) continue;

      const primitive = picked?.primitive;
      const isLabel =
        (Cesium.Label && primitive instanceof Cesium.Label) ||
        (primitive && typeof primitive.text === 'string' && !primitive.image);
      const hitType = isLabel ? 'label' : 'billboard';
      const pos = entity.position?.getValue?.(viewer.clock.currentTime);
      const centerPt = pos
        ? Cesium.SceneTransforms.worldToWindowCoordinates(scene, pos)
        : null;

      candidates.push({
        entity,
        feature: feat,
        centerPt,
        hitType,
        maxHitRadiusPx: 26,
        isSelected: entity === selectedEntity,
      });
    }

    return selectBestPickedMarker(windowPosition, candidates);
  };

  handler.setInputAction((movement) => {
    if (pointerIsDown || isMobile) return;
    const now = performance.now();

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

    if (now - lastHoverPickTime >= HOVER_THROTTLE_MS) {
      lastHoverPickTime = now;
      if (hoveredEntity && !viewer.entities.contains(hoveredEntity)) {
        hoveredEntity = null;
      }
      const pickedEntity = pickFeatureEntity(movement.endPosition);
      if (pickedEntity?.properties?.feature) {
        container.style.cursor = 'pointer';
        const feature = pickedEntity.properties.feature.getValue();
        const markerType = pickedEntity.properties.markerType?.getValue() || 'crater_minor';
        const baseScale = pickedEntity.properties.baseScale?.getValue() || 0.55;

        if (hoveredEntity !== pickedEntity) {
          if (hoveredEntity && viewer.entities.contains(hoveredEntity)) {
            const prevBase = hoveredEntity.properties?.baseScale?.getValue() || 0.55;
            const prevType = hoveredEntity.properties?.markerType?.getValue() || 'crater_minor';
            const remainsSelected = hoveredEntity === selectedEntity;
            if (hoveredEntity.billboard) {
              hoveredEntity.billboard.scale = remainsSelected ? prevBase * 1.4 : prevBase;
              hoveredEntity.billboard.image = getLunarMarkerDataUrl(
                prevType,
                remainsSelected,
                isCompared(hoveredEntity)
              );
            }
          }
          hoveredEntity = pickedEntity;
          if (hoveredEntity.billboard) {
            hoveredEntity.billboard.scale = baseScale * 1.35;
            hoveredEntity.billboard.image = getLunarMarkerDataUrl(
              markerType,
              true,
              isCompared(hoveredEntity)
            );
          }
          scene.requestRender();
        }

        callbacks.onFeatureHover?.(feature, movement.endPosition.x, movement.endPosition.y);
      } else if (hoveredEntity) {
        container.style.cursor = 'default';
        if (viewer.entities.contains(hoveredEntity)) {
          const prevBase = hoveredEntity.properties?.baseScale?.getValue() || 0.55;
          const prevType = hoveredEntity.properties?.markerType?.getValue() || 'crater_minor';
          // Hover ending must not remove the highlight from a still-selected catalog pin.
          const remainsSelected = hoveredEntity === selectedEntity;
          if (hoveredEntity.billboard) {
            hoveredEntity.billboard.scale = remainsSelected ? prevBase * 1.4 : prevBase;
            hoveredEntity.billboard.image = getLunarMarkerDataUrl(
              prevType,
              remainsSelected,
              isCompared(hoveredEntity)
            );
          }
        }
        hoveredEntity = null;
        scene.requestRender();
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
    pointerIsDown = false;
    if (clickStartPosition) {
      const dx = click.position.x - clickStartPosition.x;
      const dy = click.position.y - clickStartPosition.y;
      clickStartPosition = null;
      if (Math.hypot(dx, dy) > 6) {
        return;
      }
    }

    if (!viewer || viewer.isDestroyed()) return;
    if (viewer.trackedEntity) {
      viewer.trackedEntity = undefined;
    }

    const pickedEntity = pickFeatureEntity(click.position);
    if (pickedEntity?.properties?.feature) {
      const feature = pickedEntity.properties.feature.getValue();
      selectFeaturePin(feature.id);
      callbacks.onFeatureSelect?.(feature);
      flyToCoordinate(feature.longitude, feature.latitude);
      return;
    }

    const ray = viewer.camera.getPickRay(click.position);
    if (ray) {
      const cartesian = viewer.camera.pickEllipsoid(click.position, Cesium.Ellipsoid.MOON);
      if (cartesian) {
        const cartographic = Cesium.Ellipsoid.MOON.cartesianToCartographic(cartesian);
        if (!cartographic) return;
        const lon = Cesium.Math.toDegrees(cartographic.longitude);
        const lat = Cesium.Math.toDegrees(cartographic.latitude);

        const customPinData = dropCustomPin(lon, lat);
        if (customPinData) {
          callbacks.onDropCustomPin?.(customPinData);
          callbacks.onFeatureSelect?.(customPinData);
        }
      }
    }
  }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

  handler.setInputAction(() => {
    pointerIsDown = false;
    clickStartPosition = null;
    if (viewer && !viewer.isDestroyed() && viewer.trackedEntity) {
      viewer.trackedEntity = undefined;
    }
  }, Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK);

  let lastDeclutterTime = 0;
  const DECLUTTER_THROTTLE_MS = 100;

  const declutterLabels = (force = false) => {
    const now = performance.now();
    if (!force && now - lastDeclutterTime < DECLUTTER_THROTTLE_MS) return;
    lastDeclutterTime = now;

    if (!scene || viewer.isDestroyed()) return;
    const camPos = viewer.camera.positionWC;
    const canvasW = scene.canvas.clientWidth || 1280;
    const canvasH = scene.canvas.clientHeight || 800;

    const allEntities = [...pinEntities, ...customPinEntities];
    allEntities.sort((a, b) => {
      const aForce = a === selectedEntity ? 3 : a === hoveredEntity ? 2 : customPinEntities.includes(a) ? 1 : 0;
      const bForce = b === selectedEntity ? 3 : b === hoveredEntity ? 2 : customPinEntities.includes(b) ? 1 : 0;
      if (aForce !== bForce) return bForce - aForce;
      const aTier = a.properties?.tier?.getValue?.() ?? 3;
      const bTier = b.properties?.tier?.getValue?.() ?? 3;
      return aTier - bTier;
    });

    const acceptedBoxes = [];

    const setLabelVisible = (entity, visible) => {
      if (!entity?.label) return;
      const cur = entity.label.show?.getValue?.() ?? true;
      if (cur !== visible) {
        entity.label.show = visible;
      }
    };

    for (const entity of allEntities) {
      if (!entity.show || !entity.label) continue;
      const isPriority =
        entity === selectedEntity || entity === hoveredEntity || customPinEntities.includes(entity);

      const pos = entity.position?.getValue(viewer.clock.currentTime);
      if (!pos) {
        setLabelVisible(entity, false);
        continue;
      }

      // Horizon backface check: ensure pin is on the camera-facing hemisphere of the Moon
      const camToPin = Cesium.Cartesian3.subtract(pos, camPos, new Cesium.Cartesian3());
      const dist = Cesium.Cartesian3.magnitude(camToPin);
      const maxLabelDist = isPriority
        ? 5.0e7
        : entity.properties?.maxLabelDist?.getValue?.() ?? 9.0e5;

      if (dist > maxLabelDist) {
        setLabelVisible(entity, false);
        continue;
      }

      const surfNormal = Cesium.Cartesian3.normalize(pos, new Cesium.Cartesian3());
      const viewDir = Cesium.Cartesian3.normalize(camToPin, new Cesium.Cartesian3());
      if (Cesium.Cartesian3.dot(surfNormal, viewDir) > 0.15) {
        setLabelVisible(entity, false);
        continue;
      }

      const winCoord = Cesium.SceneTransforms.worldToWindowCoordinates(scene, pos);
      if (
        !winCoord ||
        !Number.isFinite(winCoord.x) ||
        !Number.isFinite(winCoord.y) ||
        winCoord.x < 10 ||
        winCoord.x > canvasW - 10 ||
        winCoord.y < 10 ||
        winCoord.y > canvasH - 10
      ) {
        setLabelVisible(entity, false);
        continue;
      }

      const rawText = String(entity.label.text?.getValue?.() ?? entity.name ?? '');
      const firstLine = rawText.split('\n')[0] || rawText;
      const halfW = Math.max(38, Math.min(115, firstLine.length * 3.8 + 10));
      const box = {
        left: winCoord.x - halfW,
        right: winCoord.x + halfW,
        top: winCoord.y - 38,
        bottom: winCoord.y - 6,
      };

      if (isPriority) {
        setLabelVisible(entity, true);
        acceptedBoxes.push(box);
        continue;
      }

      const pad = 6;
      const overlaps = acceptedBoxes.some(
        (b) =>
          !(
            box.right + pad < b.left ||
            box.left - pad > b.right ||
            box.bottom + pad < b.top ||
            box.top - pad > b.bottom
          )
      );

      if (overlaps) {
        setLabelVisible(entity, false);
      } else {
        setLabelVisible(entity, true);
        acceptedBoxes.push(box);
      }
    }
  };

  const removePostRender = scene.postRender.addEventListener(() => {
    declutterLabels(false);
  });

  viewer.camera.setView({
    destination: Cesium.Cartesian3.fromDegrees(0, 0, 9200000, Cesium.Ellipsoid.MOON),
  });

  const destroy = () => {
    unsubscribeComparison();
    if (removePostRender) {
      removePostRender();
    }
    if (!viewer.isDestroyed()) {
      customPinEntities.forEach((entity) => viewer.entities.remove(entity));
      customPinEntities.length = 0;
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
