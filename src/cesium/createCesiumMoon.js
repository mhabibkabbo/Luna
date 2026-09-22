/**
 * @file createCesiumMoon.js
 * Comprehensive CesiumJS 3D Moon controller using Cesium.Ellipsoid.MOON,
 * high-resolution NASA Moon Trek WMTS multi-resolution tile imagery,
 * and persistent, non-vanishing, depth-independent lunar feature markers.
 */

import * as Cesium from 'cesium';
import 'cesium/Build/Cesium/Widgets/widgets.css';
import { LUNAR_FEATURES } from '../data/lunarFeatures.js';
import { LANDING_SITES } from '../data/landingSites.js';
import {
  formatLunarCoordinates,
  getLunarRegionInfo,
  findNearestLunarFeature,
} from '../utils/coordinates.js';

// Combined catalog for nearest neighbor calculations
const ALL_CATALOG_FEATURES = [...LUNAR_FEATURES, ...LANDING_SITES];

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
  Cesium.Ellipsoid.default = Cesium.Ellipsoid.MOON;
}

// In-memory cache for high-DPI 3D Red Location Pin data URLs
let redPinDataUrl = null;
let redPinSelectedDataUrl = null;

/**
 * Creates high-DPI 3D Red Location Pointer Pin billboard matching the classic 3D location marker
 * with circular teardrop head, inner cutout hole, specular sheen, and ground landing ellipse.
 */
function getRedLocationPinDataUrl(isSelected = false) {
  if (isSelected && redPinSelectedDataUrl) return redPinSelectedDataUrl;
  if (!isSelected && redPinDataUrl) return redPinDataUrl;

  const width = 64;
  const height = 80;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  const centerX = width / 2; // 32
  const headCenterY = 26;
  const outerRadius = 20;
  const innerRadius = 8;
  const tipY = 70;
  const groundRingY = 72;

  ctx.clearRect(0, 0, width, height);

  // 1. Draw Red Ground Landing Ellipse Ring
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(centerX, groundRingY, 22, 6.5, 0, 0, Math.PI * 2);
  ctx.strokeStyle = isSelected ? '#ff4d6d' : '#ef4444';
  ctx.lineWidth = isSelected ? 3.5 : 2.5;
  ctx.stroke();

  // Subtle ground shadow inside the ring
  ctx.beginPath();
  ctx.ellipse(centerX, groundRingY, 18, 5, 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
  ctx.fill();
  ctx.restore();

  // 2. Outer Teardrop Pin Path
  ctx.save();
  ctx.beginPath();
  const angle = Math.atan2(tipY - headCenterY, outerRadius) - 0.26;
  ctx.arc(centerX, headCenterY, outerRadius, Math.PI - angle, angle, true);
  // Sharp needle point at bottom
  ctx.lineTo(centerX, tipY);
  ctx.closePath();

  // 3D Rich Crimson-to-Ruby Gradient Fill
  const pinGrad = ctx.createRadialGradient(
    centerX - 6,
    headCenterY - 7,
    3,
    centerX,
    headCenterY + 10,
    outerRadius + 15
  );
  if (isSelected) {
    pinGrad.addColorStop(0, '#ff758f');
    pinGrad.addColorStop(0.35, '#ff2e55');
    pinGrad.addColorStop(0.75, '#e11d48');
    pinGrad.addColorStop(1, '#881337');
  } else {
    pinGrad.addColorStop(0, '#ff6b6b');
    pinGrad.addColorStop(0.3, '#ee2222');
    pinGrad.addColorStop(0.75, '#cc1111');
    pinGrad.addColorStop(1, '#880808');
  }

  // Pin drop shadow for 3D appearance
  ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
  ctx.shadowBlur = 6;
  ctx.shadowOffsetY = 3;
  ctx.fillStyle = pinGrad;
  ctx.fill();
  ctx.restore();

  // 3. Cutout Inner Hole with 3D Inner Bevel
  ctx.save();
  ctx.beginPath();
  ctx.arc(centerX, headCenterY, innerRadius, 0, Math.PI * 2);
  ctx.fillStyle = '#050811'; // Space dark inner cutout
  ctx.fill();

  // Inner ring shadow / bevel
  ctx.lineWidth = 2;
  ctx.strokeStyle = isSelected ? '#be123c' : '#7f1d1d';
  ctx.stroke();
  ctx.restore();

  // 4. 3D Left Glossy Specular Highlight Sheen
  ctx.save();
  ctx.beginPath();
  ctx.arc(centerX, headCenterY, outerRadius - 3, Math.PI * 0.85, Math.PI * 1.45);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.stroke();
  ctx.restore();

  const dataUrl = canvas.toDataURL('image/png');
  if (isSelected) {
    redPinSelectedDataUrl = dataUrl;
  } else {
    redPinDataUrl = dataUrl;
  }
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
export function createCesiumMoon(container, callbacks = {}) {
  // 1. Create NASA LRO WAC Global Multi-Resolution WMTS Imagery Provider
  const nasaLroProvider = new Cesium.UrlTemplateImageryProvider({
    url: 'https://trek.nasa.gov/tiles/Moon/EQ/LRO_WAC_Mosaic_Global_303ppd_v02/1.0.0/default/default028mm/{z}/{y}/{x}.jpg',
    ellipsoid: Cesium.Ellipsoid.MOON,
    tilingScheme: new Cesium.GeographicTilingScheme({
      ellipsoid: Cesium.Ellipsoid.MOON,
      numberOfLevelZeroTilesX: 2,
      numberOfLevelZeroTilesY: 1,
    }),
    maximumLevel: 8,
    hasAlphaChannel: false,
    credit: new Cesium.Credit('NASA / LROC / USGS Moon Trek'),
  });

  const baseLayer = new Cesium.ImageryLayer(nasaLroProvider);
  baseLayer.brightness = 1.06;
  baseLayer.contrast = 1.12;

  // 2. Initialize Cesium.Viewer with Moon Ellipsoid and custom baseLayer (disabling Ion)
  const viewer = new Cesium.Viewer(container, {
    globe: new Cesium.Globe(Cesium.Ellipsoid.MOON),
    // Explicit, version-independent belt-and-suspenders fix alongside the
    // Ellipsoid.default assignment above: without this, mapProjection
    // defaults to `new GeographicProjection()`, i.e. WGS84.
    mapProjection: new Cesium.GeographicProjection(Cesium.Ellipsoid.MOON),
    baseLayer: baseLayer,
    terrainProvider: new Cesium.EllipsoidTerrainProvider({
      ellipsoid: Cesium.Ellipsoid.MOON,
    }),
    skyAtmosphere: false, // Lunar space environment has no atmosphere
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
    contextOptions: {
      webgl: {
        alpha: true,
        powerPreference: 'high-performance',
      },
    },
  });

  // Optimize scene for Moon visualization
  const scene = viewer.scene;
  scene.backgroundColor = Cesium.Color.fromCssColorString('#050811');
  scene.globe.baseColor = Cesium.Color.fromCssColorString('#2d333b');
  scene.globe.enableLighting = false; // Default clean full surface illumination
  scene.highDynamicRange = true;
  // Request the highest-detail tile already available sooner (default is 2).
  // This does not create detail beyond the source imagery's native
  // resolution, but reduces visible blockiness right at that ceiling.
  scene.globe.maximumScreenSpaceError = 1.5;

  // Configure Moon camera controller with Moon ellipsoid to prevent sphere distortion
  const cameraController = scene.screenSpaceCameraController;
  cameraController._ellipsoid = Cesium.Ellipsoid.MOON;
  viewer.camera._ellipsoid = Cesium.Ellipsoid.MOON;
  cameraController.enableRotate = true;
  cameraController.enableTranslate = true;
  cameraController.enableZoom = true;
  cameraController.enableTilt = true;
  cameraController.enableLook = false;
  cameraController.enableCollisionDetection = false;
  cameraController.inertiaSpin = 0.88;
  cameraController.inertiaTranslate = 0.85;
  cameraController.inertiaZoom = 0.80;
  cameraController.zoomFactor = 2.0;
  // NASA's LRO_WAC_Mosaic_Global_303ppd_v02 WMTS layer only goes to tile
  // level 8 (~83 m/pixel — see NASA_MOON_RESOLUTIONS). At the old 8km floor
  // the camera could get ~7x closer than that native resolution, so Cesium
  // was stretching/upsampling the last available tile (visible blur/mush).
  // 20km keeps close-up views near what the source data can render sharply.
  // This is a data-resolution ceiling, not a rendering bug: getting genuinely
  // sharp close-ups would require pointing at a higher-resolution NASA layer
  // (e.g. a regional LROC NAC mosaic) in addition to this global WAC layer.
  cameraController.minimumZoomDistance = 20000.0; // 20 km minimum altitude
  cameraController.maximumZoomDistance = 30000000.0; // 30,000 km overview

  // 3. Populate Lunar Feature Pin Entities using 3D Red Location Pointers
  const pinEntities = [];

  // Helper to add entity pin with unified 3D red pointer marker
  const addFeaturePin = (feat, category, isMajor = false) => {
    const dataUrl = getRedLocationPinDataUrl(false);
    const altitude = 1500; // Elevation in meters above lunar ellipsoid

    const entity = viewer.entities.add({
      name: feat.name,
      position: Cesium.Cartesian3.fromDegrees(feat.longitude, feat.latitude, altitude, Cesium.Ellipsoid.MOON),
      billboard: {
        image: dataUrl,
        verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
        horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
        pixelOffset: new Cesium.Cartesian2(0, 0),
        scale: isMajor ? 0.78 : 0.65,
        disableDepthTestDistance: Number.POSITIVE_INFINITY, // Never vanishes behind terrain/horizon
        scaleByDistance: new Cesium.NearFarScalar(1.0e5, 0.95, 2.0e7, 0.65),
        translucencyByDistance: new Cesium.NearFarScalar(2.0e7, 1.0, 3.5e7, 0.5),
      },
      label: {
        text: feat.name,
        font: isMajor ? 'bold 12px "Plus Jakarta Sans", sans-serif' : '11px "Plus Jakarta Sans", sans-serif',
        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
        fillColor: Cesium.Color.WHITE,
        outlineColor: Cesium.Color.fromCssColorString('#020617'),
        outlineWidth: 4,
        verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
        pixelOffset: new Cesium.Cartesian2(0, isMajor ? -64 : -54),
        disableDepthTestDistance: Number.POSITIVE_INFINITY, // Label never vanishes
        distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0.0, isMajor ? 3.0e7 : 1.6e7),
        scaleByDistance: new Cesium.NearFarScalar(1.0e5, 1.0, 1.8e7, 0.75),
      },
      properties: {
        feature: feat,
        category,
        baseScale: isMajor ? 0.78 : 0.65,
      },
    });

    pinEntities.push(entity);
  };

  // A. South Pole (90°S) - Prime Artemis site
  const southPoleFeature = {
    id: 'south-pole',
    name: 'Lunar South Pole (90°S)',
    type: 'south_pole',
    latitude: -90,
    longitude: 0,
    description: 'Permanently shadowed craters (PSRs) harboring volatile water ice deposits. Prime target zone for NASA Artemis and CLPS lunar landers.',
  };
  addFeaturePin(southPoleFeature, 'south_pole', true);

  // B. Landing Sites (Apollo, Luna, Chang\'e, Chandrayaan, SLIM, Odysseus)
  LANDING_SITES.forEach((site) => {
    const isApollo = site.id.includes('apollo');
    addFeaturePin(site, 'lunar-landing-sites', isApollo);
  });

  // C. Named Craters, Mountains, Maria, and Valleys from LUNAR_FEATURES
  LUNAR_FEATURES.forEach((feat) => {
    if (feat.type === 'crater') {
      const isMajor = (feat.diameterKm && feat.diameterKm >= 60) || ['Tycho', 'Copernicus', 'Plato', 'Aristarchus', 'Kepler', 'Clavius', 'Archimedes', 'Langrenus', 'Shackleton'].includes(feat.name);
      addFeaturePin(feat, 'lunar-craters', isMajor);
    } else if (feat.type === 'mountain') {
      addFeaturePin(feat, 'lunar-mountains', true);
    } else if (feat.type === 'mare') {
      addFeaturePin(feat, 'lunar-maria', true);
    } else if (feat.type === 'valley' || feat.type === 'rille') {
      addFeaturePin(feat, 'lunar-valleys', false);
    }
  });

  // 4. Screen Space Event Handler for Mouse Hover and Clicks
  const handler = new Cesium.ScreenSpaceEventHandler(scene.canvas);

  let hoveredEntity = null;
  let clickStartPosition = null;
  let customPinEntity = null;

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

    const pinIconUrl = getRedLocationPinDataUrl(true);

    customPinEntity = viewer.entities.add({
      name: pinTitle,
      position: Cesium.Cartesian3.fromDegrees(normLon, normLat, 1500, Cesium.Ellipsoid.MOON),
      billboard: {
        image: pinIconUrl,
        verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
        horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
        scale: 0.90,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
        scaleByDistance: new Cesium.NearFarScalar(1.0e5, 1.0, 2.0e7, 0.75),
      },
      label: {
        text: `${pinTitle}\n${latStr}, ${lonStr}`,
        font: 'bold 12px "Space Mono", monospace',
        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
        fillColor: Cesium.Color.fromCssColorString('#ffe4e6'),
        outlineColor: Cesium.Color.fromCssColorString('#881337'),
        outlineWidth: 5,
        verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
        pixelOffset: new Cesium.Cartesian2(0, -74),
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
        scaleByDistance: new Cesium.NearFarScalar(1.0e5, 1.0, 1.8e7, 0.8),
      },
      properties: {
        feature: customPinData,
        category: 'custom-pin',
        baseScale: 0.90,
      },
    });

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

  handler.setInputAction((movement) => {
    // 1. Raycast on Moon globe surface to calculate Selenographic Longitude / Latitude
    const ray = viewer.camera.getPickRay(movement.endPosition);
    if (ray) {
      const cartesian = scene.globe.pick(ray, scene);
      if (cartesian) {
        const cartographic = Cesium.Ellipsoid.MOON.cartesianToCartographic(cartesian);
        const lon = Cesium.Math.toDegrees(cartographic.longitude);
        const lat = Cesium.Math.toDegrees(cartographic.latitude);
        callbacks.onPointerCoordinates?.(lon, lat);
      }
    }

    // 2. Pick feature pins on hover
    const pickedObject = scene.pick(movement.endPosition);
    if (Cesium.defined(pickedObject) && pickedObject.id?.properties?.feature) {
      container.style.cursor = 'pointer';
      const feature = pickedObject.id.properties.feature.getValue();
      const baseScale = pickedObject.id.properties.baseScale?.getValue() || 0.65;

      if (hoveredEntity !== pickedObject.id) {
        if (hoveredEntity) {
          const prevBase = hoveredEntity.properties.baseScale?.getValue() || 0.65;
          hoveredEntity.billboard.scale = prevBase;
        }
        hoveredEntity = pickedObject.id;
        hoveredEntity.billboard.scale = baseScale * 1.3;
      }

      callbacks.onFeatureHover?.(feature, movement.endPosition.x, movement.endPosition.y);
    } else {
      container.style.cursor = 'default';
      if (hoveredEntity) {
        const prevBase = hoveredEntity.properties.baseScale?.getValue() || 0.65;
        hoveredEntity.billboard.scale = prevBase;
        hoveredEntity = null;
      }
      callbacks.onFeatureHover?.(null, 0, 0);
    }
  }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

  // Track pointer down to avoid triggering pin drops during camera orbit drags
  handler.setInputAction((down) => {
    clickStartPosition = Cesium.Cartesian2.clone(down.position);
  }, Cesium.ScreenSpaceEventType.LEFT_DOWN);

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
      const cartesian = scene.globe.pick(ray, scene);
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

  /**
   * Layer visibility toggling for Cesium pin entities.
   */
  const setLayerVisibility = (layerId, isVisible) => {
    pinEntities.forEach((entity) => {
      const cat = entity.properties?.category?.getValue();
      if (cat === layerId) {
        entity.show = isVisible;
      }
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
      });
    } else if (removeRotationListener) {
      removeRotationListener();
      removeRotationListener = null;
    }
    return isAutoRotating;
  };

  // Lighting toggle
  let isLightingEnabled = false;
  const toggleLighting = () => {
    isLightingEnabled = !isLightingEnabled;
    scene.globe.enableLighting = isLightingEnabled;
    return isLightingEnabled;
  };

  // Destruction / cleanup
  const destroy = () => {
    if (removeRotationListener) {
      removeRotationListener();
      removeRotationListener = null;
    }
    if (customPinEntity) {
      viewer.entities.remove(customPinEntity);
      customPinEntity = null;
    }
    if (handler && !handler.isDestroyed()) {
      handler.destroy();
    }
    if (viewer && !viewer.isDestroyed()) {
      viewer.destroy();
    }
  };

  return {
    flyToCoordinate,
    flyToSouthPole,
    resetOverview,
    setLayerVisibility,
    zoomIn,
    zoomOut,
    toggleAutoRotate,
    toggleLighting,
    dropCustomPin,
    clearCustomPin,
    destroy,
  };
}
