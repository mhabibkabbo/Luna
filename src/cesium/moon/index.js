/**
 * @file moon/index.js
 * Assembles the Moon globe, celestial overlay, and camera controls into a controller.
 */

import * as Cesium from 'cesium';
import 'cesium/Build/Cesium/Widgets/widgets.css';
import { createCelestialOverlay } from './moonCelestial.js';
import { createMoonGlobe } from './moonGlobe.js';
import { createMoonFeatures } from './moonFeatures.js';
import { celestialTimeStore } from '../../utils/celestialTime.js';

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
  // Cesium >= 1.113: the officially supported way to switch bodies.
  Cesium.Ellipsoid.default = Cesium.Ellipsoid.MOON;  // not changed (for now)
}

// In-memory cache for high-DPI category pin data URLs
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

  const width = 112;
  const height = 112;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  const cx = width / 2;
  const cy = height / 2;

  ctx.clearRect(0, 0, width, height);

  // Configuration per marker type
  let primaryColor = '#06b6d4'; // cyan
  let glowColor = 'rgba(6, 182, 212, 0.45)';

  switch (category) {
    case 'south_pole':
      primaryColor = isSelected ? '#38bdf8' : '#00f2fe';
      glowColor = 'rgba(0, 242, 254, 0.7)';
      break;
    case 'landing_apollo':
      primaryColor = isSelected ? '#38bdf8' : '#06b6d4';
      glowColor = 'rgba(6, 182, 212, 0.6)';
      break;
    case 'landing_robotic':
      primaryColor = isSelected ? '#34d399' : '#10b981';
      glowColor = 'rgba(16, 185, 129, 0.6)';
      break;
    case 'crater_major':
      primaryColor = isSelected ? '#f8fafc' : '#e2e8f0';
      glowColor = 'rgba(241, 245, 249, 0.5)';
      break;
    case 'crater_minor':
      primaryColor = isSelected ? '#cbd5e1' : '#94a3b8';
      glowColor = 'rgba(148, 163, 184, 0.4)';
      break;
    case 'mountain':
      primaryColor = isSelected ? '#fbbf24' : '#f59e0b';
      glowColor = 'rgba(245, 158, 11, 0.6)';
      break;
    case 'mare':
      primaryColor = isSelected ? '#60a5fa' : '#38bdf8';
      glowColor = 'rgba(56, 189, 248, 0.5)';
      break;
    case 'valley':
      primaryColor = isSelected ? '#d8b4fe' : '#c084fc';
      glowColor = 'rgba(192, 132, 252, 0.5)';
      break;
    case 'custom_pin':
      primaryColor = isSelected ? '#fda4af' : '#f43f5e';
      glowColor = 'rgba(244, 63, 94, 0.75)';
      break;
  }

  // Draw sleek glowing radar/target beacon
  ctx.save();
  ctx.shadowColor = glowColor;
  ctx.shadowBlur = isSelected ? 20 : 12;

  if (category === 'custom_pin') {
    // Elegant teardrop waypoint with needle
    const headRadius = 28;
    const headY = 36;
    const tipY = 100;

    // Ground shadow
    ctx.beginPath();
    ctx.ellipse(cx, tipY + 4, 28, 8, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fill();

    // Pin body
    ctx.beginPath();
    ctx.arc(cx, headY, headRadius, Math.PI * 0.8, Math.PI * 0.2, true);
    ctx.lineTo(cx, tipY);
    ctx.closePath();
    ctx.fillStyle = primaryColor;
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#ffffff';
    ctx.stroke();

    // Inner white dot
    ctx.beginPath();
    ctx.arc(cx, headY, 10, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
  } else if (category === 'south_pole') {
    // Pulsing polar reticle
    ctx.beginPath();
    ctx.arc(cx, cy, 36, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(0, 242, 254, 0.4)';
    ctx.lineWidth = 4;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(cx, cy, 24, 0, Math.PI * 2);
    ctx.fillStyle = primaryColor;
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 4;
    ctx.stroke();

    // Reticle cross lines
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(cx - 44, cy); ctx.lineTo(cx - 28, cy);
    ctx.moveTo(cx + 28, cy); ctx.lineTo(cx + 44, cy);
    ctx.moveTo(cx, cy - 44); ctx.lineTo(cx, cy - 28);
    ctx.moveTo(cx, cy + 28); ctx.lineTo(cx, cy + 44);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(cx, cy, 8, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
  } else if (category === 'landing_apollo' || category === 'landing_robotic') {
    // Mission badge with outer ring & inner icon
    ctx.beginPath();
    ctx.arc(cx, cy, 30, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(5, 8, 17, 0.9)';
    ctx.fill();
    ctx.strokeStyle = primaryColor;
    ctx.lineWidth = 5;
    ctx.stroke();

    // Inner core
    ctx.beginPath();
    ctx.arc(cx, cy, 16, 0, Math.PI * 2);
    ctx.fillStyle = primaryColor;
    ctx.fill();

    // Center white dot
    ctx.beginPath();
    ctx.arc(cx, cy, 7, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
  } else if (category === 'mountain') {
    // Peak triangle badge
    ctx.beginPath();
    ctx.arc(cx, cy, 28, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(5, 8, 17, 0.85)';
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
    // Celestial sea plain badge
    ctx.beginPath();
    ctx.arc(cx, cy, 26, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(5, 8, 17, 0.85)';
    ctx.fill();
    ctx.strokeStyle = primaryColor;
    ctx.lineWidth = 4;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(cx, cy, 12, 0, Math.PI * 2);
    ctx.fillStyle = primaryColor;
    ctx.fill();
  } else {
    // Crater circular ring with illuminated center
    ctx.beginPath();
    ctx.arc(cx, cy, category === 'crater_major' ? 26 : 18, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(5, 8, 17, 0.85)';
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
  // Detect mobile / touch environment for tailored performance defaults
  const isMobile = typeof window !== 'undefined' && (
    window.innerWidth < 768 ||
    navigator.maxTouchPoints > 1 ||
    /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
  );

  // 1. Initialize Cesium.Viewer with Moon Ellipsoid and custom baseLayer (disabling Ion)
  const moonGlobe = createMoonGlobe();

  const viewer = new Cesium.Viewer(container, {
    globe: moonGlobe,
    baseLayer: false,

    mapProjection: new Cesium.GeographicProjection(
      Cesium.Ellipsoid.MOON
    ),

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

    // Render only when something changed (camera, tiles, entities) instead of 60 fps forever
    requestRenderMode: true,
    maximumRenderTimeChange: Infinity,

    contextOptions: {
      webgl: {
        alpha: true,
        powerPreference: 'high-performance',
      },
    },
  });

  // Adaptive Resolution:
  // Mobile starts at 0.70 to avoid 3x retina fragment shader bottlenecks while preserving CSS layout.
  // Desktop defaults to 1.0 (clamped to prevent 4K GPU exhaustion).
  // Effective render ratio = devicePixelRatio * resolutionScale. Cap it so 3x/4x displays
  // do not shade 9-16 pixels per CSS pixel.
  const dpr = (typeof window !== 'undefined' && window.devicePixelRatio) || 1;
  const targetRatio = isMobile ? 1.0 : Math.min(dpr, 1.5);
  let currentResolutionScale = targetRatio / dpr;
  const minResolutionScale = (isMobile ? 0.6 : 0.75) * currentResolutionScale;
  const maxResolutionScale = isMobile ? currentResolutionScale : Math.min(1.0, currentResolutionScale * 1.15);

  viewer.resolutionScale = currentResolutionScale;
  viewer.useBrowserRecommendedResolution = false;

  // Optimize scene and globe for fast lunar tile streaming & crisp rendering
  const scene = viewer.scene;
  scene.backgroundColor = Cesium.Color.TRANSPARENT;
  scene.globe.baseColor = Cesium.Color.fromCssColorString('#0f172a');
  scene.globe.depthTestAgainstTerrain = true; // Occlude markers on the far side of the Moon
  scene.highDynamicRange = false;
  scene.msaaSamples = isMobile ? 1 : 2; // Cesium default is 4x MSAA
  scene.fog.enabled = false;
  scene.globe.showGroundAtmosphere = false;
  scene.globe.showWaterEffect = false;

  // Benchmark-tuned Screen Space Error (SSE) & Tile Cache:
  // 2.0 on desktop gives standard crisp LOD; 2.8 on mobile cuts concurrent tile floods by ~50%
  scene.globe.maximumScreenSpaceError = isMobile ? 2.8 : 2.0;
  scene.globe.tileCacheSize = isMobile ? 150 : 250;
  scene.globe.preloadAncestors = true;
  scene.globe.preloadSiblings = false;
  scene.globe.loadingDescendantLimit = 2;
  scene.globe.lambertDiffuseMultiplier = 1.0;
  scene.globe.vertexShadowDarkness = 2.0;

  // Start with solar illumination enabled; the toolbar can still toggle it.
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

    // Disregard anomalous frames (tab backgrounding, hitch > 250ms)
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
        // High GPU load: frame time > 32ms (< 31 fps)
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

  // Configure Moon camera controller with Moon ellipsoid and mobile-friendly touch responsiveness
  const cameraController = scene.screenSpaceCameraController;
  cameraController._ellipsoid = Cesium.Ellipsoid.MOON;
  viewer.camera._ellipsoid = Cesium.Ellipsoid.MOON;
  cameraController.enableRotate = true;
  cameraController.enableTranslate = true;
  cameraController.enableZoom = true;
  cameraController.enableTilt = true;
  cameraController.enableLook = false;
  cameraController.enableCollisionDetection = false;
  cameraController.inertiaSpin = isMobile ? 0.82 : 0.88;
  cameraController.inertiaTranslate = isMobile ? 0.80 : 0.85;
  cameraController.inertiaZoom = isMobile ? 0.76 : 0.80;
  cameraController.zoomFactor = 2.0;
  cameraController.minimumZoomDistance = 20000.0; // 20 km minimum altitude
  cameraController.maximumZoomDistance = 1_000_000_000; // 1M km overview

  // Enable Cesium's built-in Sun
  if (!scene.sun) {
    scene.sun = new Cesium.Sun();
  }
  scene.sun.show = true;

  // Real-time Earth & Sun overlay (synchronizes Cesium built-in Sun, Moon & Earth ephemeris)
  const celestial = createCelestialOverlay(viewer, {
    initialDate: celestialTimeStore.get().ms,
    showVectors: false,
    syncLighting: true,
  });
  const removeTimeListener = celestialTimeStore.subscribe(({ ms }) => {
    celestial.setCelestialTime(ms);
  });


  /**
   * Smoothly animates the camera to a given selenographic coordinate.
   */
  const flyToCoordinate = (lon, lat, height = 1400000, duration = 1.6) => {
    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(lon, lat, height, Cesium.Ellipsoid.MOON),
      duration,
      easingFunction: Cesium.EasingFunction.QUADRATIC_OUT,
    });
  };

  // Create pins and input handlers after camera actions exist, since pin clicks fly the camera.
  const features = createMoonFeatures({ viewer, container, callbacks, isMobile, flyToCoordinate, getLunarMarkerDataUrl });

  /**
   * Flies camera directly to South Pole (90°S).
   */
  const flyToSouthPole = () => {
    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(0, -90, 2200000, Cesium.Ellipsoid.MOON),
      orientation: {
        heading: Cesium.Math.toRadians(0),
        pitch: Cesium.Math.toRadians(-90),
        roll: 0,
      },
      duration: 1.8,
      easingFunction: Cesium.EasingFunction.QUADRATIC_OUT,
    });
  };

  /**
   * Resets camera to standard global lunar overview.
   */
  const resetOverview = () => {
    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(0, 0, 7500000, Cesium.Ellipsoid.MOON),
      duration: 1.4,
      easingFunction: Cesium.EasingFunction.QUADRATIC_OUT,
    });
  };


  // Smooth Zoom In helper using spherical flight to prevent distortion
  const zoomIn = () => {
    const currentHeight = viewer.camera.positionCartographic?.height || 5000000;
    const targetHeight = Math.max(8000.0, currentHeight * 0.52);
    const lon = Cesium.Math.toDegrees(viewer.camera.positionCartographic.longitude);
    const lat = Cesium.Math.toDegrees(viewer.camera.positionCartographic.latitude);
    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(lon, lat, targetHeight, Cesium.Ellipsoid.MOON),
      duration: 0.45,
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
      duration: 0.45,
      easingFunction: Cesium.EasingFunction.QUADRATIC_OUT,
    });
  };

  // Auto rotation state
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

  // Lighting toggle
  let isLightingEnabled = true;
  const toggleLighting = () => {
    isLightingEnabled = !isLightingEnabled;
    scene.globe.enableLighting = isLightingEnabled;
    scene.requestRender();
    return isLightingEnabled;
  };

  // Destruction / cleanup
  const destroy = () => {
    if (destroyed) return;
    destroyed = true;
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
    features.destroy();
    if (viewer && !viewer.isDestroyed()) {
      viewer.destroy();
    }
  };

  return {
    id: 'moon',
    viewer,
    globe: moonGlobe,
    getViewer: () => viewer,
    setActive(active) {
      viewer.useDefaultRenderLoop = active;
      if (viewer.container) {
        viewer.container.style.display = active ? 'block' : 'none';
      }
      if (active) {
        viewer.resize?.();
        viewer.scene?.requestRender?.();
      }
    },

    flyTo: flyToCoordinate,
    flyToSouthPole,
    resetOverview,
    setLayerVisibility: features.setLayerVisibility,
    zoomIn,
    zoomOut,
    toggleAutoRotate,
    toggleLighting,
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
