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

  // Enable high-DPI native resolution scale for razor-sharp rendering on Retina/4K screens
  viewer.resolutionScale = Math.min(window.devicePixelRatio || 1.0, 2.0);
  viewer.useBrowserRecommendedResolution = false;

  // Optimize scene for Moon visualization
  const scene = viewer.scene;
  scene.backgroundColor = Cesium.Color.fromCssColorString('#050811');
  scene.globe.baseColor = Cesium.Color.fromCssColorString('#1e293b');
  scene.globe.enableLighting = false; // Default clean full surface illumination
  scene.globe.depthTestAgainstTerrain = true; // Occlude markers on the far side of the Moon
  scene.highDynamicRange = true;
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
  cameraController.minimumZoomDistance = 20000.0; // 20 km minimum altitude
  cameraController.maximumZoomDistance = 30000000.0; // 30,000 km overview

  // 3. Populate Lunar Feature Pin Entities using Categorized Vector Billboards
  const pinEntities = [];

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

    // LOD Distance display conditions
    let maxBillboardDist = 7.0e6;
    let maxLabelDist = 3.2e6;
    let baseScale = 0.22;
    let labelFont = '600 12px "Plus Jakarta Sans", system-ui, -apple-system, sans-serif';
    let labelOffset = -18;

    if (tier === 1) {
      maxBillboardDist = 3.5e7;
      maxLabelDist = 2.4e7;
      baseScale = 0.28;
      labelFont = '700 13px "Plus Jakarta Sans", system-ui, -apple-system, sans-serif';
      labelOffset = -22;
    } else if (tier === 2) {
      maxBillboardDist = 1.5e7;
      maxLabelDist = 8.5e6;
      baseScale = 0.25;
      labelFont = '600 12px "Plus Jakarta Sans", system-ui, -apple-system, sans-serif';
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
        fillColor: Cesium.Color.WHITE,
        outlineColor: Cesium.Color.fromCssColorString('#020617'),
        outlineWidth: 2,
        showBackground: true,
        backgroundColor: Cesium.Color.fromCssColorString('rgba(8, 13, 27, 0.92)'),
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
      },
    });

    pinEntities.push(entity);
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

  // B. Landing Sites (Apollo, Luna, Chang\'e, Chandrayaan, SLIM, Odysseus)
  LANDING_SITES.forEach((site) => {
    const isApollo11 = site.id === 'landing-apollo-11';
    const isCrewedApollo = site.id.includes('apollo');
    const isMajorRobotic = ['landing-change-4', 'landing-change-5', 'landing-change-6', 'landing-chandrayaan-3', 'landing-slim', 'landing-surveyor-3'].includes(site.id);

    if (isApollo11) {
      addFeaturePin(site, 'lunar-landing-sites', 'landing_apollo', 1);
    } else if (isCrewedApollo) {
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

      callbacks.onFeatureHover?.(feature, movement.endPosition.x, movement.endPosition.y);
    } else {
      container.style.cursor = 'default';
      if (hoveredEntity) {
        const prevBase = hoveredEntity.properties.baseScale?.getValue() || 0.55;
        const prevType = hoveredEntity.properties.markerType?.getValue() || 'crater_minor';
        hoveredEntity.billboard.scale = prevBase;
        hoveredEntity.billboard.image = getLunarMarkerDataUrl(prevType, false);
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
