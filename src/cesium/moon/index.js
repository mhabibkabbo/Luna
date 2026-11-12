import * as Cesium from 'cesium';
import 'cesium/Build/Cesium/Widgets/widgets.css';
import { createCelestialOverlay } from './moonCelestial.js';
import { createMoonGlobe, setMoonRasterLayer } from './moonGlobe.js';
import { createMoonFeatures } from './moonFeatures.js';
import { createGlobeCameraControls } from '../globeCameraControls.js';
import { celestialTimeStore } from '../../utils/celestialTime.js';
import { isSoftwareGl, setupCesiumRenderLoop } from '../../utils/softwareGl.js';

// Ensure no Cesium Ion authentication prompt
Cesium.Ion.defaultAccessToken = '';

// Pin Cesium's global default ellipsoid to the Moon BEFORE any Viewer, camera,
// or provider is constructed. Cesium's Viewer defaults its internal
// mapProjection to WGS84 (Earth) unless told otherwise, and several
// distance/LOD/culling computations read that projection's ellipsoid rather
// than scene.globe.ellipsoid. Left unset, the globe renders at the correct
// (Moon) size while other subsystems still assume an Earth-sized body —
// causing feature markers to be culled inconsistently depending on camera
// distance/angle (works "sometimes", not others).
// See: https://github.com/CesiumGS/cesium/issues/4244
if ('default' in Cesium.Ellipsoid) {
  Cesium.Ellipsoid.default = Cesium.Ellipsoid.MOON;  // not changed (for now)
}

const pinTextureCache = new Map();

/**
 * Creates high-DPI crisp vector billboard icons categorized by feature type.
 * Rendered at 2x resolution (112x112) for razor-sharp display on Retina/4K displays.
 * @param {'landing_apollo' | 'landing_robotic' | 'south_pole' | 'crater_major' | 'crater_minor' | 'mountain' | 'mare' | 'valley' | 'custom_pin'} category
 * @param {boolean} isSelected
 */
function getLunarMarkerDataUrl(category = 'crater_minor', isSelected = false) {
  const cacheKey = `${category}_${isSelected ? 'sel' : 'norm'}`;
  if (pinTextureCache.has(cacheKey)) {
    return pinTextureCache.get(cacheKey);
  }

  const width = 96;
  const height = 96;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  const cx = width / 2;
  const cy = height / 2;

  ctx.clearRect(0, 0, width, height);

  let primaryColor = isSelected ? '#FDE047' : '#00D2C4';
  let glowColor = isSelected ? 'rgba(253, 224, 71, 0.95)' : 'rgba(0, 210, 196, 0.5)';

  switch (category) {
    case 'south_pole':
      primaryColor = isSelected ? '#FDE047' : '#00D2C4';
      glowColor = isSelected ? 'rgba(253, 224, 71, 0.95)' : 'rgba(0, 210, 196, 0.85)';
      break;
    case 'landing_apollo':
      primaryColor = isSelected ? '#FDE047' : '#00E5FF';
      glowColor = isSelected ? 'rgba(253, 224, 71, 0.95)' : 'rgba(0, 229, 255, 0.75)';
      break;
    case 'landing_robotic':
      primaryColor = isSelected ? '#FDE047' : '#14B8A6';
      glowColor = isSelected ? 'rgba(253, 224, 71, 0.95)' : 'rgba(20, 184, 166, 0.7)';
      break;
    case 'crater_major':
      primaryColor = isSelected ? '#FDE047' : '#06B6D4';
      glowColor = isSelected ? 'rgba(253, 224, 71, 0.95)' : 'rgba(6, 182, 212, 0.65)';
      break;
    case 'crater_minor':
      primaryColor = isSelected ? '#FDE047' : '#0284C7';
      glowColor = isSelected ? 'rgba(253, 224, 71, 0.95)' : 'rgba(2, 132, 199, 0.55)';
      break;
    case 'mountain':
      primaryColor = isSelected ? '#FDE047' : '#38BDF8';
      glowColor = isSelected ? 'rgba(253, 224, 71, 0.95)' : 'rgba(56, 189, 248, 0.65)';
      break;
    case 'mare':
      primaryColor = isSelected ? '#FDE047' : '#0D9488';
      glowColor = isSelected ? 'rgba(253, 224, 71, 0.95)' : 'rgba(13, 148, 136, 0.6)';
      break;
    case 'valley':
      primaryColor = isSelected ? '#FDE047' : '#22D3EE';
      glowColor = isSelected ? 'rgba(253, 224, 71, 0.95)' : 'rgba(34, 211, 238, 0.6)';
      break;
    case 'custom_pin':
      primaryColor = isSelected ? '#FDE047' : '#00D2C4';
      glowColor = isSelected ? 'rgba(253, 224, 71, 0.95)' : 'rgba(0, 210, 196, 0.85)';
      break;
  }

  ctx.save();
  ctx.shadowColor = glowColor;
  ctx.shadowBlur = isSelected ? 20 : 12;

  if (category === 'custom_pin') {
    const headRadius = 22;
    const headY = 30;
    const tipY = 82;

    ctx.beginPath();
    ctx.ellipse(cx, tipY + 3, 20, 6, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fill();

    ctx.beginPath();
    ctx.arc(cx, headY, headRadius, Math.PI * 0.8, Math.PI * 0.2, true);
    ctx.lineTo(cx, tipY);
    ctx.closePath();
    ctx.fillStyle = primaryColor;
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#ffffff';
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(cx, headY, 10, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
  } else if (category === 'south_pole') {
    ctx.beginPath();
    ctx.arc(cx, cy, 30, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(229, 154, 109, 0.45)';
    ctx.lineWidth = 3.5;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(cx, cy, 20, 0, Math.PI * 2);
    ctx.fillStyle = primaryColor;
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3.5;
    ctx.stroke();

    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.moveTo(cx - 36, cy); ctx.lineTo(cx - 24, cy);
    ctx.moveTo(cx + 24, cy); ctx.lineTo(cx + 36, cy);
    ctx.moveTo(cx, cy - 36); ctx.lineTo(cx, cy - 24);
    ctx.moveTo(cx, cy + 24); ctx.lineTo(cx, cy + 36);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(cx, cy, 7, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
  } else if (category === 'landing_apollo' || category === 'landing_robotic') {
    ctx.beginPath();
    ctx.arc(cx, cy, 30, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(18, 17, 13, 0.9)';
    ctx.fill();
    ctx.strokeStyle = primaryColor;
    ctx.lineWidth = 5;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(cx, cy, 16, 0, Math.PI * 2);
    ctx.fillStyle = primaryColor;
    ctx.fill();

    ctx.beginPath();
    ctx.arc(cx, cy, 7, 0, Math.PI * 2);
    ctx.fillStyle = '#F4EFE6';
    ctx.fill();
  } else if (category === 'mountain') {
    ctx.beginPath();
    ctx.arc(cx, cy, 28, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(18, 17, 13, 0.85)';
    ctx.fill();
    ctx.strokeStyle = primaryColor;
    ctx.lineWidth = 4;
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(cx, cy - 14);
    ctx.lineTo(cx + 14, cy + 12);
    ctx.lineTo(cx - 14, cy + 12);
    ctx.closePath();
    ctx.fillStyle = primaryColor;
    ctx.fill();
  } else if (category === 'mare') {
    ctx.beginPath();
    ctx.arc(cx, cy, 26, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(18, 17, 13, 0.85)';
    ctx.fill();
    ctx.strokeStyle = primaryColor;
    ctx.lineWidth = 4;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(cx, cy, 12, 0, Math.PI * 2);
    ctx.fillStyle = primaryColor;
    ctx.fill();
  } else {
    ctx.beginPath();
    ctx.arc(cx, cy, category === 'crater_major' ? 26 : 18, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(18, 17, 13, 0.85)';
    ctx.fill();
    ctx.strokeStyle = primaryColor;
    ctx.lineWidth = 4;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(cx, cy, category === 'crater_major' ? 10 : 7, 0, Math.PI * 2);
    ctx.fillStyle = primaryColor;
    ctx.fill();
  }

  ctx.restore();

  const dataUrl = canvas.toDataURL('image/png');
  pinTextureCache.set(cacheKey, dataUrl);
  return dataUrl;
}

/**
 * Initializes Cesium Moon Viewer.
 * 
 * @param {HTMLElement} container
 * @param {Object} callbacks
 * @param {Function} [callbacks.onPointerCoordinates]
 * @param {Function} [callbacks.onFeatureSelect]
 * @param {Function} [callbacks.onFeatureHover]
 * @returns {Object} Cesium Moon Controller API
 */
export function createMoon(container, callbacks = {}) {
  let destroyed = false;
  const isMobile = typeof window !== 'undefined' && (
    window.innerWidth < 768 ||
    navigator.maxTouchPoints > 1 ||
    /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
  );

  if ('default' in Cesium.Ellipsoid) {
    Cesium.Ellipsoid.default = Cesium.Ellipsoid.MOON;
  }

  callbacks.onLoadingStageChange?.('Initializing WebGL 3D Planetary Canvas...');
  const moonGlobe = createMoonGlobe();
  callbacks.onLoadingStageChange?.('Connecting to NASA Moon Trek WMTS Basemap...');

  const viewer = new Cesium.Viewer(container, {
    globe: moonGlobe,
    baseLayer: false,

    mapProjection: new Cesium.GeographicProjection(
      Cesium.Ellipsoid.MOON
    ),

    skyBox: isSoftwareGl ? false : Cesium.SkyBox.createEarthSkyBox(),
    skyAtmosphere: false,

    baseLayerPicker: false,
    geocoder: false,
    homeButton: false,
    infoBox: false,
    selectionIndicator: false,
    timeline: false,
    animation: false,
    navigationHelpButton: false,
    fullscreenButton: false,
    sceneModePicker: false,

    orderIndependentTranslucency: false,

    useDefaultRenderLoop: !isSoftwareGl,
    requestRenderMode: true,
    maximumRenderTimeChange: Infinity,

    contextOptions: {
      webgl: {
        alpha: true,
        antialias: !isSoftwareGl,
        powerPreference: 'high-performance',
      },
    },
  });

  // Disable Cesium Viewer's default LEFT_CLICK / LEFT_DOUBLE_CLICK entity
  // selection & camera tracking (`viewer.trackedEntity`), which attaches EntityView
  // and corrupts camera.transform when clicking markers or dropping custom pins repeatedly.
  viewer.screenSpaceEventHandler.removeInputAction(
    Cesium.ScreenSpaceEventType.LEFT_CLICK
  );
  viewer.screenSpaceEventHandler.removeInputAction(
    Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK
  );
  viewer.trackedEntity = undefined;
  viewer.selectedEntity = undefined;

  // Adaptive Resolution:
  // Mobile starts at 0.70 to avoid 3x retina fragment shader bottlenecks while preserving CSS layout.
  // Desktop defaults to 1.0 (clamped to prevent 4K GPU exhaustion).
  // Effective render ratio = devicePixelRatio * resolutionScale. Cap it so 3x/4x displays
  // do not shade 9-16 pixels per CSS pixel.
  const dpr = (typeof window !== 'undefined' && window.devicePixelRatio) || 1;
  const targetRatio = isMobile ? 1.0 : Math.min(dpr, 1.5);
  let currentResolutionScale = isSoftwareGl ? 0.65 : targetRatio / dpr;
  const minResolutionScale = (isMobile ? 0.6 : 0.75) * currentResolutionScale;
  const maxResolutionScale = isMobile ? currentResolutionScale : Math.min(1.0, currentResolutionScale * 1.15);

  viewer.resolutionScale = currentResolutionScale;
  viewer.useBrowserRecommendedResolution = false;

  const scene = viewer.scene;
  scene.backgroundColor = Cesium.Color.TRANSPARENT;
  scene.globe.baseColor = Cesium.Color.fromCssColorString('#0f172a');
  scene.globe.depthTestAgainstTerrain = false;
  scene.highDynamicRange = false;
  scene.msaaSamples = isMobile || isSoftwareGl ? 1 : 2; // Cesium default is 4x MSAA
  scene.fog.enabled = false;
  scene.globe.showGroundAtmosphere = false;
  scene.globe.showWaterEffect = false;

  // Adaptive Level-of-Detail (LOD) & Tile Memory Limits:
  // Dynamically tuned based on window.devicePixelRatio and hardware capabilities.
  // High-DPI screens (dpr >= 2.0) render 4x pixel density; setting SSE to 2.5 avoids GPU fragment
  // fill-rate saturation while preserving crisp visual sharpness.
  // Standard displays (dpr < 2.0) use 1.9 for balanced geometric and texture detail.
  const isHighDpi = dpr >= 2.0;
  scene.globe.maximumScreenSpaceError = isSoftwareGl ? 8.0 : (isMobile ? 2.8 : (isHighDpi ? 2.5 : 1.9));
  scene.globe.tileCacheSize = isMobile ? 120 : (isHighDpi ? 180 : 250);
  scene.globe.preloadAncestors = true;
  scene.globe.preloadSiblings = false;
  scene.globe.loadingDescendantLimit = isSoftwareGl ? 8 : 2;
  scene.globe.lambertDiffuseMultiplier = 1.35;
  scene.globe.vertexShadowDarkness = 0.55;

  scene.globe.enableLighting = true;

  // Gradual adaptive resolution controller:
  // Monitors actual frame times over a 40-frame window with hysteresis cooldown to avoid thrashing
  let frameCount = 0;
  let accumulatedFrameDuration = 0;
  let lastFrameTimestamp = performance.now();
  let lastScaleAdjustTimestamp = performance.now();
  const SCALE_ADJUST_COOLDOWN_MS = 2000;

  const removeAdaptiveResolutionListener = scene.postRender.addEventListener(() => {
    const now = performance.now();
    const delta = now - lastFrameTimestamp;
    lastFrameTimestamp = now;

    if (delta > 250) return;

    accumulatedFrameDuration += delta;
    frameCount++;

    const sampleWindow = isMobile ? 35 : 45;
    if (frameCount >= sampleWindow) {
      const avgDuration = accumulatedFrameDuration / frameCount;
      const timeSinceAdjust = now - lastScaleAdjustTimestamp;
      // requestRenderMode produces idle gaps; those were already filtered by the >250 ms check
      const isCameraFlying = viewer.camera._currentFlight !== undefined;

      if (!isCameraFlying && timeSinceAdjust >= SCALE_ADJUST_COOLDOWN_MS) {
        if (avgDuration > 26.0 && currentResolutionScale > minResolutionScale) {
          currentResolutionScale = Math.max(minResolutionScale, currentResolutionScale - 0.08);
          viewer.resolutionScale = Number(currentResolutionScale.toFixed(2));
          lastScaleAdjustTimestamp = now;
        }
        // Substantial performance headroom: frame time < 16.5ms (> 60 fps)
        else if (!isMobile && avgDuration < 16.5 && currentResolutionScale < maxResolutionScale) {
          currentResolutionScale = Math.min(maxResolutionScale, currentResolutionScale + 0.05);
          viewer.resolutionScale = Number(currentResolutionScale.toFixed(2));
          lastScaleAdjustTimestamp = now;
        }
      }

      frameCount = 0;
      accumulatedFrameDuration = 0;
    }
  });

  const cameraController = scene.screenSpaceCameraController;
  cameraController._ellipsoid = Cesium.Ellipsoid.MOON;
  viewer.camera._ellipsoid = Cesium.Ellipsoid.MOON;
  cameraController.enableRotate = true;
  cameraController.enableTranslate = true;
  cameraController.enableZoom = true;
  cameraController.enableTilt = true;
  // Keep the default two-finger gesture zoom-only instead of tilting during a pinch.
  cameraController.tiltEventTypes = [
    Cesium.CameraEventType.MIDDLE_DRAG,
    {
      eventType: Cesium.CameraEventType.LEFT_DRAG,
      modifier: Cesium.KeyboardEventModifier.CTRL,
    },
    {
      eventType: Cesium.CameraEventType.RIGHT_DRAG,
      modifier: Cesium.KeyboardEventModifier.CTRL,
    },
  ];
  cameraController.enableLook = false;
  cameraController.enableCollisionDetection = false;
  cameraController.inertiaSpin = isMobile ? 0.82 : 0.88;
  cameraController.inertiaTranslate = isMobile ? 0.80 : 0.85;
  cameraController.inertiaZoom = isMobile ? 0.76 : 0.80;
  cameraController.zoomFactor = 2.0;
  cameraController.minimumZoomDistance = 20000.0; // 20 km minimum altitude
  cameraController.maximumZoomDistance = 1_000_000_000;

  const globeControls = createGlobeCameraControls(viewer, {
    ellipsoid: Cesium.Ellipsoid.MOON,
    minHeight: 20000,
    maxHeight: 1_000_000_000,
    isMobile,
  });

  // Prevent near-plane frustum slicing into lunar features
  viewer.camera.frustum.near = 1.0;

  if (!scene.sun) {
    scene.sun = new Cesium.Sun();
  }
  scene.sun.show = !isSoftwareGl;

  const celestial = createCelestialOverlay(viewer, {
    initialDate: celestialTimeStore.get().ms,
    showVectors: false,
    syncLighting: true,
  });
  const removeTimeListener = celestialTimeStore.subscribe(({ ms }) => {
    celestial.setCelestialTime(ms);
  });

const flyToCoordinate = (lon, lat, height = null, duration = 1.2) => {
    if (!viewer || viewer.isDestroyed()) return;
    if (!Number.isFinite(lon) || !Number.isFinite(lat)) return;
    if (viewer.trackedEntity) {
      viewer.trackedEntity = undefined;
    }
    const rawHeight = viewer.camera.positionCartographic?.height;
    const currentHeight =
      Number.isFinite(rawHeight) && rawHeight > 0 ? rawHeight : 1400000;
    const targetHeight =
      typeof height === 'number' && Number.isFinite(height) && height > 100
        ? Math.max(height, 20000)
        : Math.max(currentHeight, 20000);
    viewer.camera.cancelFlight?.();
    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(lon, lat, targetHeight, Cesium.Ellipsoid.MOON),
      duration: isSoftwareGl ? 0 : duration,
      easingFunction: Cesium.EasingFunction.QUADRATIC_OUT,
    });
    viewer.scene.requestRender();
  };

  callbacks.onLoadingStageChange?.('Loading Catalog Landmarks & Ephemeris...');
  const features = createMoonFeatures({ viewer, container, callbacks, isMobile, flyToCoordinate, getLunarMarkerDataUrl });

  const removeTileLoadListener = scene.globe.tileLoadProgressEvent.addEventListener((queuedCount) => {
    callbacks.onTileLoadProgress?.(isSoftwareGl ? 0 : queuedCount);
  });

  const renderLoop = setupCesiumRenderLoop(viewer);

  setTimeout(() => {
    callbacks.onInitialized?.();
  }, 400);

  let communicationEntity = null;
  let communicationPositions = null;

  function getCommunicationTubeRadius() {
    const cameraHeight = viewer.camera.positionCartographic.height;

    // Scale the tube with camera altitude.
    return Cesium.Math.clamp(cameraHeight * 0.001,100,10_000);
  }

  function getCommunicationOrientation(start, end) {
    const direction = Cesium.Cartesian3.normalize(
      Cesium.Cartesian3.subtract(
        end,
        start,
        new Cesium.Cartesian3()
      ),
      new Cesium.Cartesian3()
    );

    const zAxis = Cesium.Cartesian3.UNIT_Z;
    const axis = Cesium.Cartesian3.cross(
      zAxis,
      direction,
      new Cesium.Cartesian3()
    );

    const axisLength = Cesium.Cartesian3.magnitude(axis);
    const dot = Cesium.Cartesian3.dot(zAxis, direction);

    if (axisLength < 1e-8) {
      return dot >= 0
        ? Cesium.Quaternion.IDENTITY
        : Cesium.Quaternion.fromAxisAngle(
            Cesium.Cartesian3.UNIT_X,
            Math.PI
          );
    }

    Cesium.Cartesian3.normalize(axis, axis);

    return Cesium.Quaternion.fromAxisAngle(
      axis,
      Math.acos(Cesium.Math.clamp(dot, -1, 1))
    );
  }

  function updateCommunicationTube() {
    if (!communicationEntity || !communicationPositions) return;

    const [start, end] = communicationPositions;
    const radius = getCommunicationTubeRadius();

    communicationEntity.position = Cesium.Cartesian3.midpoint(
      start,
      end,
      new Cesium.Cartesian3()
    );

    communicationEntity.orientation =
      getCommunicationOrientation(start, end);

    communicationEntity.cylinder.topRadius = radius;
    communicationEntity.cylinder.bottomRadius = radius;
    communicationEntity.cylinder.length =
      Cesium.Cartesian3.distance(start, end);
  }

  const updateCommunicationTubeOnCameraChange = () => {
    updateCommunicationTube();
  };

  viewer.camera.changed.addEventListener(
    updateCommunicationTubeOnCameraChange
  );

  const setCommunicationLink = (link) => {
    if (!link) {
      if (communicationEntity) {
        viewer.entities.remove(communicationEntity);
        communicationEntity = null;
      }

      communicationPositions = null;
      scene.requestRender();
      return;
    }

    const statusColor = {
      clear: '#1dffac',
      doubtful: '#facc15',
      blocked: '#f43f5e',
      away: '#f43f5e',
    }[link.status];

    if (!statusColor) {
      throw new TypeError(
        `Unknown communication-link status: ${link.status}`
      );
    }

    communicationPositions = [
      Cesium.Cartesian3.fromArray(link.moonPositionMoonFixedMeters),
      Cesium.Cartesian3.fromArray(link.earthPositionMoonFixedMeters),
    ];

    const color = Cesium.Color
      .fromCssColorString(statusColor)
      .withAlpha(0.75);

    if (!communicationEntity) {
      communicationEntity = viewer.entities.add({
        id: 'earth-moon-communication-link',

        position: Cesium.Cartesian3.midpoint(
          communicationPositions[0],
          communicationPositions[1],
          new Cesium.Cartesian3()
        ),

        orientation: getCommunicationOrientation(
          communicationPositions[0],
          communicationPositions[1]
        ),

        cylinder: {
          length: Cesium.Cartesian3.distance(
            communicationPositions[0],
            communicationPositions[1]
          ),
          topRadius: getCommunicationTubeRadius(),
          bottomRadius: getCommunicationTubeRadius(),
          slices: 12,
          material: color,
          outline: false,
        },
      });
    } else {
      communicationEntity.cylinder.material = color;
    }

    updateCommunicationTube();
    scene.requestRender();
  };

  const flyToSouthPole = () => {
    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(0, -90, 2200000, Cesium.Ellipsoid.MOON),
      orientation: {
        heading: Cesium.Math.toRadians(0),
        pitch: Cesium.Math.toRadians(-90),
        roll: 0,
      },
      duration: isSoftwareGl ? 0 : 1.8,
      easingFunction: Cesium.EasingFunction.QUADRATIC_OUT,
    });
  };

  const resetOverview = () => {
    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(0, 0, 9200000, Cesium.Ellipsoid.MOON),
      orientation: {
        heading: 0,
        pitch: -Cesium.Math.PI_OVER_TWO,
        roll: 0,
      },
      duration: isSoftwareGl ? 0 : 1.4,
      easingFunction: Cesium.EasingFunction.QUADRATIC_OUT,
    });
  };

  const setLayerVisibility = (layerId, visible, opacity) => {
    if (destroyed || viewer.isDestroyed()) return;
    const handledRaster = setMoonRasterLayer(moonGlobe, scene, layerId, visible, opacity);
    if (!handledRaster) {
      features.setLayerVisibility(layerId, visible);
    }
  };

// Smooth Zoom In helper using spherical flight to prevent distortion
  const zoomIn = () => {
    const currentHeight = viewer.camera.positionCartographic?.height || 5000000;
    const targetHeight = Math.max(8000.0, currentHeight * 0.52);
    const lon = Cesium.Math.toDegrees(viewer.camera.positionCartographic.longitude);
    const lat = Cesium.Math.toDegrees(viewer.camera.positionCartographic.latitude);
    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(lon, lat, targetHeight, Cesium.Ellipsoid.MOON),
      duration: isSoftwareGl ? 0 : 0.45,
      easingFunction: Cesium.EasingFunction.QUADRATIC_OUT,
    });
  };

  // Smooth Zoom Out helper using spherical flight to prevent distortion
  const zoomOut = () => {
    const currentHeight = viewer.camera.positionCartographic?.height || 5000000;
    const targetHeight = Math.min(28000000.0, currentHeight * 1.65);
    const lon = Cesium.Math.toDegrees(viewer.camera.positionCartographic.longitude);
    const lat = Cesium.Math.toDegrees(viewer.camera.positionCartographic.latitude);
    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(lon, lat, targetHeight, Cesium.Ellipsoid.MOON),
      duration: isSoftwareGl ? 0 : 0.45,
      easingFunction: Cesium.EasingFunction.QUADRATIC_OUT,
    });
  };

  let isAutoRotating = false;
  let removeRotationListener = null;

  const toggleAutoRotate = () => {
    isAutoRotating = !isAutoRotating;
    if (isAutoRotating) {
      removeRotationListener = scene.postUpdate.addEventListener(() => {
        scene.camera.rotate(Cesium.Cartesian3.UNIT_Z, -0.0012);
        scene.requestRender();
      });
    } else if (removeRotationListener) {
      removeRotationListener();
      removeRotationListener = null;
    }
    return isAutoRotating;
  };

  let isLightingEnabled = true;
  const setLightingEnabled = (enabled) => {
    isLightingEnabled = Boolean(enabled);
    scene.globe.enableLighting = isLightingEnabled;
    scene.requestRender();
    return isLightingEnabled;
  };
  const toggleLighting = () => setLightingEnabled(!isLightingEnabled);

  const destroy = () => {
    if (destroyed) return;
    destroyed = true;
    renderLoop.destroy();
    globeControls.destroy();
    if (removeAdaptiveResolutionListener) {
      removeAdaptiveResolutionListener();
    }
    if (celestial) {
      try {
        removeTimeListener();
        celestial.destroy();
      } catch {}
    }
    if (removeRotationListener) {
      removeRotationListener();
      removeRotationListener = null;
    }
    if (removeTileLoadListener) {
      removeTileLoadListener();
    }
    features.destroy();
    if (communicationEntity) {
      viewer.entities.remove(communicationEntity);
      communicationEntity = null;
    }
    communicationPositions = null;
    if (viewer && !viewer.isDestroyed()) {
      viewer.camera.changed.removeEventListener(updateCommunicationTubeOnCameraChange);
      viewer.destroy();
    }
  };

  const waitUntilReady = () => {
    if (destroyed || viewer.isDestroyed()) return Promise.resolve();
    return new Promise((resolve) => {
      let settled = false;
      let frames = 0;
      const finish = () => {
        if (settled) return;
        settled = true;
        removeCheck?.();
        clearTimeout(safetyTimer);
        resolve();
      };
      const safetyTimer = setTimeout(finish, 1400);
      const removeCheck = scene.postRender.addEventListener(() => {
        frames += 1;
        if (scene.globe.tilesLoaded || frames >= 2) {
          finish();
        } else {
          scene.requestRender();
        }
      });
      viewer.resize?.();
      scene.requestRender();
    });
  };

  return {
    id: 'moon',
    viewer,
    globe: moonGlobe,
    getViewer: () => viewer,
    waitUntilReady,
    setActive(active) {
      if (destroyed || viewer.isDestroyed()) return;
      if (active && 'default' in Cesium.Ellipsoid) {
        Cesium.Ellipsoid.default = Cesium.Ellipsoid.MOON;
      }
      if (active) {
        cameraController._ellipsoid = Cesium.Ellipsoid.MOON;
        viewer.camera._ellipsoid = Cesium.Ellipsoid.MOON;
        cameraController.enableInputs = true;
      }
      if (viewer.container) {
        viewer.container.style.display = active ? 'block' : 'none';
      }
      renderLoop.setActive(active);
    },

    flyTo: flyToCoordinate,
    setCommunicationLink,
    flyToSouthPole,
    resetOverview,
    setLayerVisibility,
    zoomIn,
    zoomOut,
    toggleAutoRotate,
    toggleLighting,
    setLightingEnabled,
    getLightingEnabled: () => isLightingEnabled,
    extras: {
      features: {
        pinEntities: features.pinEntities,
        selectFeaturePin: features.selectFeaturePin,
        dropCustomPin: features.dropCustomPin,
        clearCustomPin: features.clearCustomPin,
      },
      celestial,
    },

    destroy,
  };
}
