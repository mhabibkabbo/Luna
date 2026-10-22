/**
 * @file earthFeatures.js
 * Handles Earth surface coordinates and the user's custom waypoint pin.
 */

import * as Cesium from 'cesium';

const EARTH_PIN_STYLE = {
  baseScale: 0.42,
  selectedScale: 0.58,
  nearDistance: 100_000,
  farDistance: 250_000_000,
  labelFarDistance: 50_000_000,
  surfaceClearance: 40,
};

const EARTH_DRAG_SENSITIVITY = 1.0;
const EARTH_DRAG_THRESHOLD_PIXELS = 6;

function createPinImage(selected) {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 80;
  const context = canvas.getContext('2d');

  if (!context) {
    throw new Error('Unable to create the Earth pin marker canvas.');
  }

  context.beginPath();
  context.moveTo(32, 78);
  context.bezierCurveTo(26, 66, 8, 47, 8, 28);
  context.arc(32, 28, 24, Math.PI, 0);
  context.bezierCurveTo(56, 47, 38, 66, 32, 78);
  context.closePath();
  context.fillStyle = selected ? '#38bdf8' : '#f43f5e';
  context.fill();
  context.lineWidth = 4;
  context.strokeStyle = '#fff1f2';
  context.stroke();

  context.beginPath();
  context.arc(32, 28, 8, 0, Math.PI * 2);
  context.fillStyle = '#fff';
  context.fill();

  return canvas.toDataURL('image/png');
}

export function createEarthFeatures({ viewer, container, callbacks }) {
  const scene = viewer.scene;
  const handler = new Cesium.ScreenSpaceEventHandler(scene.canvas);
  let customPinEntity = null;
  let hoveredEntity = null;
  let clickStartPosition = null;
  let pointerIsDown = false;
  let dragStarted = false;
  let previousDragPosition = null;
  let lastCoordsThrottleTime = 0;
  let lastHoverPickTime = 0;

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

  const setPinSelected = (selected) => {
    if (!customPinEntity?.billboard) return;
    customPinEntity.billboard.scale = selected
      ? EARTH_PIN_STYLE.selectedScale
      : EARTH_PIN_STYLE.baseScale;
    customPinEntity.billboard.image = createPinImage(selected);
    scene.requestRender();
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
    const feature = {
      id: 'custom-earth-pin',
      name: pinTitle,
      type: 'custom_pin',
      latitude: normalizedLatitude,
      longitude: normalizedLongitude,
      height: terrainHeight,
      isCustomPin: true,
      body: 'earth',
      description: `Earth waypoint at ${normalizedLatitude.toFixed(4)}°, ${normalizedLongitude.toFixed(4)}°.`,
      source: 'User Earth Waypoint',
    };

    if (customPinEntity) {
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
        scale: EARTH_PIN_STYLE.selectedScale,
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
        text: pinTitle,
        font: 'bold 12px system-ui, sans-serif',
        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
        fillColor: Cesium.Color.WHITE,
        outlineColor: Cesium.Color.fromCssColorString('#881337'),
        outlineWidth: 3,
        showBackground: true,
        backgroundColor: Cesium.Color.fromCssColorString('rgba(15, 23, 42, 0.94)'),
        verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
        pixelOffset: new Cesium.Cartesian2(0, -42),
        heightReference: Cesium.HeightReference.RELATIVE_TO_GROUND,
        scaleByDistance: new Cesium.NearFarScalar(
          EARTH_PIN_STYLE.nearDistance,
          1.0,
          EARTH_PIN_STYLE.labelFarDistance,
          0.8
        ),
        distanceDisplayCondition: new Cesium.DistanceDisplayCondition(
          0,
          EARTH_PIN_STYLE.farDistance
        ),
        disableDepthTestDistance: 0,
      },
      properties: { feature, category: 'custom-pin' },
    });

    scene.requestRender();
    return feature;
  };

  const clearCustomPin = () => {
    if (customPinEntity) {
      viewer.entities.remove(customPinEntity);
      customPinEntity = null;
      scene.requestRender();
    }
  };

  const selectFeaturePin = (featureId) => {
    setPinSelected(Boolean(customPinEntity && featureId === 'custom-earth-pin'));
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
        if (hoveredEntity === customPinEntity) setPinSelected(false);
        hoveredEntity = pickedEntity;
        if (hoveredEntity === customPinEntity) setPinSelected(true);
      }
      callbacks.onFeatureHover?.(
        feature,
        movement.endPosition.x,
        movement.endPosition.y
      );
    } else {
      container.style.cursor = 'default';
      if (hoveredEntity === customPinEntity) setPinSelected(false);
      hoveredEntity = null;
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
      viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(
          feature.longitude,
          feature.latitude,
          500_000,
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
      if (layerId === 'earth-custom-pin' && customPinEntity) {
        customPinEntity.show = visible;
        scene.requestRender();
      }
    },
    destroy() {
      if (!viewer.isDestroyed()) {
        clearCustomPin();
        handler.destroy();
      }
      if (container) container.style.cursor = 'default';
    },
  };
}
