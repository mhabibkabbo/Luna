/**
 * @file earthFeatures.js
 * Creates Earth facility markers and handles their interaction and custom waypoints.
 */

import * as Cesium from 'cesium';
import { EARTH_COMMUNICATION_SITES } from '../../data/earthCommunicationSites.js';
import { formatLunarCoordinates } from '../../utils/coordinates.js';

const EARTH_PIN_STYLE = {
  baseScale: 0.17,
  selectedScale: 0.24,
  nearDistance: 100_000,
  overviewDistance: 100_000_000,
  farDistance: 250_000_000,
  labelFarDistance: 50_000_000,
  surfaceClearance: 40,
};

const SITE_MARKER_COLORS = {
  'deep-space-communication': '#22d3ee',
  'spacecraft-tracking': '#60a5fa',
  'launch-tracking': '#c084fc',
  'relay-communications': '#fbbf24',
  'mission-operations': '#34d399',
};

const EARTH_DRAG_SENSITIVITY = 1.0;
const EARTH_DRAG_THRESHOLD_PIXELS = 6;
const sitePinImages = new Map();

function createSitePinImage(type, selected) {
  const cacheKey = `${type}:${selected}`;
  if (sitePinImages.has(cacheKey)) return sitePinImages.get(cacheKey);

  const canvas = document.createElement('canvas');
  canvas.width = 112;
  canvas.height = 112;
  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Unable to create the Earth communication-site marker canvas.');
  }

  const color = selected ? '#e0f2fe' : SITE_MARKER_COLORS[type] || '#38bdf8';
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.save();
  context.shadowColor = color;
  context.shadowBlur = selected ? 24 : 14;

  context.beginPath();
  context.arc(56, 56, 35, 0, Math.PI * 2);
  context.fillStyle = 'rgba(2, 6, 23, 0.94)';
  context.fill();
  context.lineWidth = selected ? 7 : 6;
  context.strokeStyle = color;
  context.stroke();

  context.beginPath();
  context.arc(56, 56, 22, 0, Math.PI * 2);
  context.fillStyle = color;
  context.fill();
  context.restore();

  context.strokeStyle = '#ffffff';
  context.lineWidth = 5;
  context.lineCap = 'round';
  context.beginPath();
  context.moveTo(44, 62);
  context.lineTo(56, 48);
  context.lineTo(68, 62);
  context.moveTo(56, 48);
  context.lineTo(56, 72);
  context.moveTo(47, 72);
  context.lineTo(65, 72);
  context.stroke();

  context.beginPath();
  context.arc(56, 43, 7, Math.PI, Math.PI * 2);
  context.stroke();

  const image = canvas.toDataURL('image/png');
  sitePinImages.set(cacheKey, image);
  return image;
}

function createPinImage(selected) {
  const canvas = document.createElement('canvas');
  canvas.width = 112;
  canvas.height = 112;
  const context = canvas.getContext('2d');

  if (!context) {
    throw new Error('Unable to create the Earth pin marker canvas.');
  }

  const cx = canvas.width / 2;
  const primaryColor = selected ? '#fda4af' : '#f43f5e';

  context.save();
  context.shadowColor = 'rgba(244, 63, 94, 0.75)';
  context.shadowBlur = selected ? 20 : 12;

  context.beginPath();
  context.ellipse(cx, 104, 28, 8, 0, 0, Math.PI * 2);
  context.fillStyle = 'rgba(0, 0, 0, 0.5)';
  context.fill();

  context.beginPath();
  context.arc(cx, 36, 28, Math.PI * 0.8, Math.PI * 0.2, true);
  context.lineTo(cx, 100);
  context.closePath();
  context.fillStyle = primaryColor;
  context.fill();
  context.lineWidth = 4;
  context.strokeStyle = '#ffffff';
  context.stroke();
  context.restore();

  context.beginPath();
  context.arc(cx, 36, 10, 0, Math.PI * 2);
  context.fillStyle = '#ffffff';
  context.fill();

  return canvas.toDataURL('image/png');
}

export function createEarthFeatures({ viewer, container, callbacks }) {
  const scene = viewer.scene;
  const handler = new Cesium.ScreenSpaceEventHandler(scene.canvas);
  const sitePinEntities = [];
  let customPinEntity = null;
  let selectedEntity = null;
  let hoveredEntity = null;
  let clickStartPosition = null;
  let pointerIsDown = false;
  let dragStarted = false;
  let previousDragPosition = null;
  let lastCoordsThrottleTime = 0;
  let lastHoverPickTime = 0;

  const updatePinStyle = (entity) => {
    if (!entity) return;
    const selected = entity === selectedEntity || entity === hoveredEntity;
    const feature = entity.properties?.feature?.getValue();
    const markerType = entity.properties?.markerType?.getValue();
    const baseScale =
      entity.properties?.baseScale?.getValue() ?? EARTH_PIN_STYLE.baseScale;

    if (entity.billboard) {
      entity.billboard.scale = selected
        ? feature?.isCustomPin && entity === selectedEntity
          ? EARTH_PIN_STYLE.selectedScale
          : baseScale * (entity === selectedEntity ? 1.4 : 1.2)
        : baseScale;
      entity.billboard.distanceDisplayCondition =
        new Cesium.DistanceDisplayCondition(
          0,
          entity === selectedEntity
            ? EARTH_PIN_STYLE.farDistance
            : EARTH_PIN_STYLE.overviewDistance
        );
      entity.billboard.image =
        feature?.isCustomPin
          ? createPinImage(selected)
          : createSitePinImage(markerType, selected);
    }
    if (entity.label) {
      const maxLabelDistance =
        entity.properties?.maxLabelDistance?.getValue() ??
        EARTH_PIN_STYLE.labelFarDistance;
      entity.label.distanceDisplayCondition = new Cesium.DistanceDisplayCondition(
        0,
        entity === selectedEntity
          ? EARTH_PIN_STYLE.farDistance
          : Math.min(maxLabelDistance, EARTH_PIN_STYLE.overviewDistance)
      );
      entity.label.fillColor = selected
        ? Cesium.Color.fromCssColorString(
            feature?.isCustomPin ? '#ffe4e6' : '#7dd3fc'
          )
        : Cesium.Color.WHITE;
    }
  };

  EARTH_COMMUNICATION_SITES.forEach((site) => {
    const feature = { ...site, body: 'earth' };
    const baseScale =
      site.type === 'deep-space-communication'
        ? EARTH_PIN_STYLE.baseScale
        : EARTH_PIN_STYLE.baseScale * 0.88;
    const maxLabelDistance =
      site.type === 'deep-space-communication'
        ? 35_000_000
        : 18_000_000;

    const entity = viewer.entities.add({
      name: feature.name,
      position: Cesium.Cartesian3.fromDegrees(
        feature.longitude,
        feature.latitude,
        EARTH_PIN_STYLE.surfaceClearance,
        Cesium.Ellipsoid.WGS84
      ),
      billboard: {
        image: createSitePinImage(feature.type, false),
        verticalOrigin: Cesium.VerticalOrigin.CENTER,
        horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
        heightReference: Cesium.HeightReference.RELATIVE_TO_GROUND,
        scale: baseScale,
        scaleByDistance: new Cesium.NearFarScalar(
          EARTH_PIN_STYLE.nearDistance,
          1.0,
          EARTH_PIN_STYLE.farDistance,
          0.68
        ),
        translucencyByDistance: new Cesium.NearFarScalar(
          EARTH_PIN_STYLE.farDistance * 0.7,
          1.0,
          EARTH_PIN_STYLE.farDistance,
          0.65
        ),
      },
      label: {
        text: feature.name,
        font: '600 11px system-ui, sans-serif',
        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
        fillColor: Cesium.Color.WHITE,
        outlineColor: Cesium.Color.fromCssColorString('#020617'),
        outlineWidth: 3,
        showBackground: true,
        backgroundColor: Cesium.Color.fromCssColorString('rgba(6, 11, 22, 0.9)'),
        backgroundPadding: new Cesium.Cartesian2(7, 4),
        verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
        pixelOffset: new Cesium.Cartesian2(0, -24),
        heightReference: Cesium.HeightReference.RELATIVE_TO_GROUND,
        scaleByDistance: new Cesium.NearFarScalar(
          EARTH_PIN_STYLE.nearDistance,
          1.0,
          EARTH_PIN_STYLE.farDistance,
          0.8
        ),
        distanceDisplayCondition: new Cesium.DistanceDisplayCondition(
          0,
          maxLabelDistance
        ),
      },
      properties: {
        feature,
        category: 'earth-communication-sites',
        markerType: feature.type,
        baseScale,
        maxLabelDistance,
      },
    });

    sitePinEntities.push(entity);
    updatePinStyle(entity);
  });

  const getSurfaceCartesian = (position) => {
    const ray = viewer.camera.getPickRay(position);
    return (
      (ray && scene.globe.pick(ray, scene)) ||
      viewer.camera.pickEllipsoid(position, Cesium.Ellipsoid.WGS84)
    );
  };

  const getSurfacePosition = (position) => {
    const cartesian = getSurfaceCartesian(position);
    if (!cartesian) return null;
    return Cesium.Cartographic.fromCartesian(
      cartesian,
      Cesium.Ellipsoid.WGS84
    );
  };

  const rotateSurfaceWithPointer = (startPosition, endPosition) => {
    const startSurface = getSurfaceCartesian(startPosition);
    const endSurface = getSurfaceCartesian(endPosition);
    if (!startSurface || !endSurface) {
      const canvas = scene.canvas;
      const cameraController = scene.screenSpaceCameraController;
      const cameraHeight = viewer.camera.positionCartographic.height;
      const rotateRate = Cesium.Math.clamp(
        cameraHeight / Cesium.Ellipsoid.WGS84.maximumRadius,
        1 / 5000,
        1.77
      );
      const deltaPhi =
        ((startPosition.x - endPosition.x) / canvas.clientWidth) *
        rotateRate *
        Math.PI *
        2 *
        EARTH_DRAG_SENSITIVITY;
      const deltaTheta =
        ((startPosition.y - endPosition.y) / canvas.clientHeight) *
        rotateRate *
        Math.PI *
        EARTH_DRAG_SENSITIVITY;
      const maxMovement = cameraController.maximumMovementRatio;

      viewer.camera.rotateRight(
        Cesium.Math.clamp(
          deltaPhi,
          -maxMovement * rotateRate * Math.PI * 2,
          maxMovement * rotateRate * Math.PI * 2
        )
      );
      viewer.camera.rotateUp(
        Cesium.Math.clamp(
          deltaTheta,
          -maxMovement * rotateRate * Math.PI,
          maxMovement * rotateRate * Math.PI
        )
      );
      scene.requestRender();
      return true;
    }

    const startNormal = Cesium.Cartesian3.normalize(
      startSurface,
      new Cesium.Cartesian3()
    );
    const endNormal = Cesium.Cartesian3.normalize(
      endSurface,
      new Cesium.Cartesian3()
    );
    const axis = Cesium.Cartesian3.cross(
      startNormal,
      endNormal,
      new Cesium.Cartesian3()
    );
    const axisMagnitude = Cesium.Cartesian3.magnitude(axis);
    if (axisMagnitude < Cesium.Math.EPSILON12) return false;

    Cesium.Cartesian3.divideByScalar(axis, axisMagnitude, axis);
    const dot = Cesium.Math.clamp(
      Cesium.Cartesian3.dot(startNormal, endNormal),
      -1,
      1
    );
    const angle =
      Math.atan2(axisMagnitude, dot) * EARTH_DRAG_SENSITIVITY;

    // Inverse camera rotation makes the picked surface point follow the cursor.
    viewer.camera.rotate(axis, angle);
    scene.requestRender();
    return true;
  };

  const dropCustomPin = (longitude, latitude, customName, terrainHeight = 0) => {
    if (
      !Number.isFinite(longitude) ||
      !Number.isFinite(latitude) ||
      !Number.isFinite(terrainHeight)
    ) {
      throw new TypeError('Earth pin coordinates must be finite numbers.');
    }

    const normalizedLongitude =
      ((((longitude + 180) % 360) + 360) % 360) - 180;
    const normalizedLatitude = Cesium.Math.clamp(latitude, -90, 90);
    const pinTitle = customName || 'Earth Waypoint';
    const pinHeight = EARTH_PIN_STYLE.surfaceClearance;
    const { latStr, lonStr } = formatLunarCoordinates(
      normalizedLongitude,
      normalizedLatitude,
      4
    );
    const feature = {
      id: 'custom-earth-pin',
      name: pinTitle,
      type: 'custom_pin',
      latitude: normalizedLatitude,
      longitude: normalizedLongitude,
      height: terrainHeight,
      isCustomPin: true,
      body: 'earth',
      latStr,
      lonStr,
      combinedCoordinates: `${latStr}, ${lonStr}`,
      description: `Earth waypoint at ${latStr}, ${lonStr}.`,
      source: 'User Earth Waypoint',
    };

    if (selectedEntity) {
      const previousSelectedEntity = selectedEntity;
      selectedEntity = null;
      updatePinStyle(previousSelectedEntity);
    }

    if (customPinEntity) {
      if (hoveredEntity === customPinEntity) hoveredEntity = null;
      viewer.entities.remove(customPinEntity);
    }

    customPinEntity = viewer.entities.add({
      name: pinTitle,
      position: Cesium.Cartesian3.fromDegrees(
        normalizedLongitude,
        normalizedLatitude,
        pinHeight,
        Cesium.Ellipsoid.WGS84
      ),
      billboard: {
        image: createPinImage(true),
        verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
        horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
        heightReference: Cesium.HeightReference.RELATIVE_TO_GROUND,
        scale: EARTH_PIN_STYLE.baseScale,
        scaleByDistance: new Cesium.NearFarScalar(
          EARTH_PIN_STYLE.nearDistance,
          1.0,
          EARTH_PIN_STYLE.farDistance,
          0.68
        ),
        translucencyByDistance: new Cesium.NearFarScalar(
          EARTH_PIN_STYLE.farDistance * 0.7,
          1.0,
          EARTH_PIN_STYLE.farDistance,
          0.65
        ),
        disableDepthTestDistance: 0,
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
        heightReference: Cesium.HeightReference.RELATIVE_TO_GROUND,
        scaleByDistance: new Cesium.NearFarScalar(
          EARTH_PIN_STYLE.nearDistance,
          1.0,
          18_000_000,
          0.9
        ),
        distanceDisplayCondition: new Cesium.DistanceDisplayCondition(
          0,
          EARTH_PIN_STYLE.farDistance
        ),
        disableDepthTestDistance: 0,
      },
      properties: {
        feature,
        category: 'custom-pin',
        baseScale: EARTH_PIN_STYLE.baseScale,
      },
    });

    selectedEntity = customPinEntity;
    updatePinStyle(customPinEntity);
    scene.requestRender();
    return feature;
  };

  const clearCustomPin = () => {
    if (customPinEntity) {
      if (selectedEntity === customPinEntity) selectedEntity = null;
      if (hoveredEntity === customPinEntity) hoveredEntity = null;
      viewer.entities.remove(customPinEntity);
      customPinEntity = null;
      scene.requestRender();
    }
  };

  const selectFeaturePin = (featureId) => {
    if (selectedEntity) {
      const previous = selectedEntity;
      selectedEntity = null;
      updatePinStyle(previous);
    }

    selectedEntity =
      [...sitePinEntities, customPinEntity].find(
        (entity) =>
          entity?.properties?.feature?.getValue()?.id === featureId
      ) || null;
    updatePinStyle(selectedEntity);
    scene.requestRender();
  };

  handler.setInputAction((movement) => {
    if (pointerIsDown) {
      if (clickStartPosition) {
        const downDeltaX = movement.endPosition.x - clickStartPosition.x;
        const downDeltaY = movement.endPosition.y - clickStartPosition.y;
        dragStarted ||=
          Math.hypot(downDeltaX, downDeltaY) > EARTH_DRAG_THRESHOLD_PIXELS;
      }

      if (dragStarted && previousDragPosition) {
        rotateSurfaceWithPointer(
          previousDragPosition,
          movement.endPosition
        );
      }
      previousDragPosition = Cesium.Cartesian2.clone(
        movement.endPosition,
        previousDragPosition
      );
      return;
    }

    const now = performance.now();

    if (now - lastCoordsThrottleTime >= 100) {
      lastCoordsThrottleTime = now;
      const cartographic = getSurfacePosition(movement.endPosition);
      if (cartographic) {
        callbacks.onPointerCoordinates?.(
          Cesium.Math.toDegrees(cartographic.longitude),
          Cesium.Math.toDegrees(cartographic.latitude)
        );
      }
    }

    if (now - lastHoverPickTime < 140) return;
    lastHoverPickTime = now;
    const pickedObject = scene.pick(movement.endPosition);
    const pickedEntity = pickedObject?.id;
    const feature = pickedEntity?.properties?.feature?.getValue();

    if (feature) {
      container.style.cursor = 'pointer';
      if (hoveredEntity !== pickedEntity) {
        const previous = hoveredEntity;
        hoveredEntity = pickedEntity;
        updatePinStyle(previous);
        updatePinStyle(hoveredEntity);
        scene.requestRender();
      }
      callbacks.onFeatureHover?.(
        feature,
        movement.endPosition.x,
        movement.endPosition.y
      );
    } else {
      container.style.cursor = 'default';
      updatePinStyle(hoveredEntity);
      hoveredEntity = null;
      scene.requestRender();
      callbacks.onFeatureHover?.(null, 0, 0);
    }
  }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

  handler.setInputAction((down) => {
    clickStartPosition = Cesium.Cartesian2.clone(down.position);
    previousDragPosition = Cesium.Cartesian2.clone(down.position);
    dragStarted = false;
    pointerIsDown = true;
  }, Cesium.ScreenSpaceEventType.LEFT_DOWN);

  handler.setInputAction(() => {
    pointerIsDown = false;
    previousDragPosition = null;
  }, Cesium.ScreenSpaceEventType.LEFT_UP);

  handler.setInputAction((click) => {
    pointerIsDown = false;
    if (clickStartPosition) {
      const dx = click.position.x - clickStartPosition.x;
      const dy = click.position.y - clickStartPosition.y;
      if (Math.hypot(dx, dy) > EARTH_DRAG_THRESHOLD_PIXELS) return;
    }

    const pickedObject = scene.pick(click.position);
    const feature = pickedObject?.id?.properties?.feature?.getValue();
    if (feature) {
      selectFeaturePin(feature.id);
      callbacks.onFeatureSelect?.(feature);
      const targetHeight = Math.max(
        500_000,
        scene.screenSpaceCameraController.minimumZoomDistance
      );
      viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(
          feature.longitude,
          feature.latitude,
          targetHeight,
          Cesium.Ellipsoid.WGS84
        ),
        duration: 0.8,
      });
      return;
    }

    const cartographic = getSurfacePosition(click.position);
    if (!cartographic) return;
    const pin = dropCustomPin(
      Cesium.Math.toDegrees(cartographic.longitude),
      Cesium.Math.toDegrees(cartographic.latitude),
      undefined,
      cartographic.height
    );
    callbacks.onDropCustomPin?.(pin);
    callbacks.onFeatureSelect?.(pin);
  }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

  return {
    dropCustomPin,
    clearCustomPin,
    selectFeaturePin,
    setLayerVisibility(layerId, visible) {
      if (layerId === 'earth-communication-sites') {
        sitePinEntities.forEach((entity) => {
          entity.show = visible;
        });
        scene.requestRender();
      }
      if (layerId === 'earth-custom-pin' && customPinEntity) {
        customPinEntity.show = visible;
        scene.requestRender();
      }
    },
    destroy() {
      if (!viewer.isDestroyed()) {
        clearCustomPin();
        sitePinEntities.forEach((entity) => viewer.entities.remove(entity));
        handler.destroy();
      }
      if (container) container.style.cursor = 'default';
    },
  };
}
