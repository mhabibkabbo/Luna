import * as Cesium from 'cesium';
import {
  configureEarthImageryLayer,
  createEarthGlobe,
} from './earthGlobe.js';
import { createEarthFeatures } from './earthFeatures.js';
import { createGlobeCameraControls } from '../globeCameraControls.js';
import { celestialTimeStore } from '../../utils/celestialTime.js';
import { isSoftwareGl, setupCesiumRenderLoop } from '../../utils/softwareGl.js';

const EARTH_CAMERA_SETTINGS = {
  overviewHeight: 20_000_000,
  minimumZoomDistance: 50_000,
  maximumZoomDistance: 100_000_000,
  zoomFactor: 2.2,
  zoomInFactor: 0.8,
  zoomOutFactor: 1.25,
  desktopInertiaSpin: 0.88,
  mobileInertiaSpin: 0.82,
  desktopInertiaTranslate: 0.85,
  mobileInertiaTranslate: 0.80,
  desktopInertiaZoom: 0.70,
  mobileInertiaZoom: 0.65,
};

export function createEarth(container, callbacks = {}) {
  const isMobile =
    typeof window !== 'undefined' &&
    (window.innerWidth < 768 ||
      navigator.maxTouchPoints > 1 ||
      /Android|iPhone|iPad|iPod/i.test(navigator.userAgent));

  if ('default' in Cesium.Ellipsoid) {
    Cesium.Ellipsoid.default = Cesium.Ellipsoid.WGS84;
  }

  callbacks.onLoadingStageChange?.('Loading Earth Blue Marble Imagery & Deep Space Network...');
  const { globe: earthGlobe, fallbackImageryLayer } = createEarthGlobe();

  const viewer = new Cesium.Viewer(container, {
    globe: earthGlobe,
    baseLayer: false,
    mapProjection: new Cesium.GeographicProjection(Cesium.Ellipsoid.WGS84),
    useDefaultRenderLoop: !isSoftwareGl,
    requestRenderMode: true,
    maximumRenderTimeChange: Infinity,
    skyBox: isSoftwareGl ? false : undefined,
    skyAtmosphere: isSoftwareGl ? false : new Cesium.SkyAtmosphere(Cesium.Ellipsoid.WGS84),
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
        antialias: !isSoftwareGl,
        powerPreference: 'high-performance',
      },
    },
  });

  // Disable Cesium Viewer's default LEFT_CLICK / LEFT_DOUBLE_CLICK entity
  // selection & camera tracking (`viewer.trackedEntity`), so repeated clicks on
  // stations or custom pins never lock the camera into EntityView.
  viewer.screenSpaceEventHandler.removeInputAction(
    Cesium.ScreenSpaceEventType.LEFT_CLICK
  );
  viewer.screenSpaceEventHandler.removeInputAction(
    Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK
  );
  viewer.trackedEntity = undefined;
  viewer.selectedEntity = undefined;

  viewer.resolutionScale = isSoftwareGl ? 0.65 : Math.min(window.devicePixelRatio || 1.0, 1.25);
  viewer.useBrowserRecommendedResolution = false;

  const scene = viewer.scene;
  scene.backgroundColor = Cesium.Color.fromCssColorString('#060B13');
  scene.globe.depthTestAgainstTerrain = false;
  scene.highDynamicRange = false;
  scene.msaaSamples = isSoftwareGl || isMobile ? 1 : 2;
  scene.globe.enableLighting = true;
  scene.globe.dynamicAtmosphereLighting = !isSoftwareGl;
  scene.light = new Cesium.SunLight();
  if (scene.sun) {
    scene.sun.show = !isSoftwareGl;
  }

  const dpr = (typeof window !== 'undefined' && window.devicePixelRatio) || 1;
  const isHighDpi = dpr >= 2.0;
  scene.globe.maximumScreenSpaceError = isSoftwareGl ? 4.0 : (isMobile ? 2.8 : (isHighDpi ? 2.5 : 1.9));
  scene.globe.tileCacheSize = isMobile ? 120 : (isHighDpi ? 180 : 250);

  viewer.clock.shouldAnimate = false;
  viewer.clock.currentTime = Cesium.JulianDate.fromDate(
    new Date(celestialTimeStore.get().ms)
  );

  let lightingEnabled = true;
  const setLightingEnabled = (enabled) => {
    lightingEnabled = Boolean(enabled);
    scene.globe.enableLighting = lightingEnabled;
    scene.globe.dynamicAtmosphereLighting = lightingEnabled;
    scene.requestRender();
    return lightingEnabled;
  };
  const toggleLighting = () => setLightingEnabled(!lightingEnabled);

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

  scene.moon = new Cesium.Moon({
    show: !isSoftwareGl,
    onlySunLighting: true,
  });

  const cameraController = scene.screenSpaceCameraController;
  cameraController._ellipsoid = Cesium.Ellipsoid.WGS84;
  viewer.camera._ellipsoid = Cesium.Ellipsoid.WGS84;

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

  cameraController.inertiaSpin = isMobile
    ? EARTH_CAMERA_SETTINGS.mobileInertiaSpin
    : EARTH_CAMERA_SETTINGS.desktopInertiaSpin;
  cameraController.inertiaTranslate = isMobile
    ? EARTH_CAMERA_SETTINGS.mobileInertiaTranslate
    : EARTH_CAMERA_SETTINGS.desktopInertiaTranslate;
  cameraController.inertiaZoom = isMobile
    ? EARTH_CAMERA_SETTINGS.mobileInertiaZoom
    : EARTH_CAMERA_SETTINGS.desktopInertiaZoom;
  cameraController.zoomFactor = EARTH_CAMERA_SETTINGS.zoomFactor;
  cameraController.minimumZoomDistance = EARTH_CAMERA_SETTINGS.minimumZoomDistance;
  cameraController.maximumZoomDistance = EARTH_CAMERA_SETTINGS.maximumZoomDistance;

  const globeControls = createGlobeCameraControls(viewer, {
    ellipsoid: Cesium.Ellipsoid.WGS84,
    minHeight: EARTH_CAMERA_SETTINGS.minimumZoomDistance,
    maxHeight: EARTH_CAMERA_SETTINGS.maximumZoomDistance,
    isMobile,
  });

  viewer.camera.setView({
    destination: Cesium.Cartesian3.fromDegrees(
      15,
      20,
      EARTH_CAMERA_SETTINGS.overviewHeight,
      Cesium.Ellipsoid.WGS84
    ),
  });

  let isActive = false;
  let isDestroyed = false;
  const removeTimeListener = celestialTimeStore.subscribe(({ ms }) => {
    if (isDestroyed || viewer.isDestroyed()) return;
    viewer.clock.currentTime = Cesium.JulianDate.fromDate(new Date(ms));
    if (isActive) {
      scene.requestRender();
    }
  });

// High-resolution multi-LOD global satellite imagery (on hardware GPUs; software WebGL uses local Blue Marble base layer)
  let tiledImageryLayer = null;
  const loadHighResEarthTiles = async () => {
    if (isSoftwareGl) return;
    try {
      const arcGisProvider = await Cesium.ArcGisMapServerImageryProvider.fromUrl(
        'https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer',
        { enablePickFeatures: false }
      );
      if (isDestroyed || viewer.isDestroyed()) return;
      tiledImageryLayer = configureEarthImageryLayer(
        new Cesium.ImageryLayer(arcGisProvider)
      );
      scene.globe.imageryLayers.add(tiledImageryLayer);
      scene.requestRender();
    } catch {
      try {
        const urlProvider = new Cesium.UrlTemplateImageryProvider({
          url: 'https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
          maximumLevel: 19,
          hasAlphaChannel: false,
          credit: 'Esri, Maxar, Earthstar Geographics, USDA, USGS, AeroGRID, IGN, and the GIS User Community',
        });
        if (isDestroyed || viewer.isDestroyed()) return;
        tiledImageryLayer = configureEarthImageryLayer(
          new Cesium.ImageryLayer(urlProvider)
        );
        scene.globe.imageryLayers.add(tiledImageryLayer);
        scene.requestRender();
      } catch (e) {
        console.warn('Tiled satellite imagery unavailable, using Blue Marble texture.', e?.message || e);
      }
    }
  };
  loadHighResEarthTiles();

  const features = createEarthFeatures({ viewer, container, callbacks });
  const removeTileLoadListener = scene.globe.tileLoadProgressEvent.addEventListener(
    (queuedCount) => {
      callbacks.onTileLoadProgress?.(isSoftwareGl ? 0 : queuedCount);
    }
  );

  const renderLoop = setupCesiumRenderLoop(viewer);

  const textureReadyPromise = new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve();
    img.onerror = () => resolve();
    img.src = '/assets/earth-blue-marble.jpg';
  });

  const waitUntilReady = () => {
    if (isDestroyed || viewer.isDestroyed()) return Promise.resolve();
    return textureReadyPromise.then(
      () =>
        new Promise((resolve) => {
          let settled = false;
          let renderedFrames = 0;
          const finish = () => {
            if (settled) return;
            settled = true;
            removeCheck?.();
            clearTimeout(safetyId);
            resolve();
          };
          const safetyId = setTimeout(finish, 1800);
          const removeCheck = scene.postRender.addEventListener(() => {
            renderedFrames += 1;
            if (scene.globe.tilesLoaded && renderedFrames >= 2) {
              finish();
            } else {
              scene.requestRender();
            }
          });
          viewer.resize?.();
          scene.requestRender();
        })
    );
  };

  let communicationEntity = null;
  let communicationPositions = null;
  let latestCommunicationLink = null;

  const updateRenderedMoonEndpoint = () => {
    const moonModelMatrix = scene.moon?._ellipsoidPrimitive?.modelMatrix;
    if (!communicationEntity || !latestCommunicationLink || !moonModelMatrix) {
      return;
    }

    const moonSitePosition = Cesium.Matrix4.multiplyByPoint(
      moonModelMatrix,
      Cesium.Cartesian3.fromArray(latestCommunicationLink.moonPositionMoonFixedMeters),
      new Cesium.Cartesian3()
    );
    if (
      communicationPositions &&
      Cesium.Cartesian3.distance(communicationPositions[1], moonSitePosition) < 0.1
    ) {
      return;
    }

    communicationPositions = [communicationPositions[0], moonSitePosition];
    updateCommunicationTube();
    scene.requestRender();
  };
  const removePostRenderListener = scene.postRender.addEventListener(
    updateRenderedMoonEndpoint
  );

  function getCommunicationOrientation(start, end) {
    const direction = Cesium.Cartesian3.subtract(
      end,
      start,
      new Cesium.Cartesian3()
    );
    Cesium.Cartesian3.normalize(direction, direction);

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
        : Cesium.Quaternion.fromAxisAngle(Cesium.Cartesian3.UNIT_X, Math.PI);
    }

    Cesium.Cartesian3.normalize(axis, axis);
    const angle = Math.acos(Cesium.Math.clamp(dot, -1, 1));
    return Cesium.Quaternion.fromAxisAngle(axis, angle);
  }

  function getCommunicationTubeRadius() {
    const cameraHeight = viewer.camera.positionCartographic.height;
    return Cesium.Math.clamp(cameraHeight * 0.001, 100, 10_000);
  }

  function updateCommunicationTube() {
    if (!communicationEntity || !communicationPositions) {
      return;
    }

    const [start, end] = communicationPositions;
    const length = Cesium.Cartesian3.distance(start, end);
    const radius = getCommunicationTubeRadius();

    communicationEntity.cylinder.topRadius = radius;
    communicationEntity.cylinder.bottomRadius = radius;
    communicationEntity.position = Cesium.Cartesian3.midpoint(
      start,
      end,
      new Cesium.Cartesian3()
    );
    communicationEntity.orientation = getCommunicationOrientation(start, end);
    communicationEntity.cylinder.length = length;
  }

  const updateCommunicationTubeOnCameraChange = () => {
    updateCommunicationTube();
  };

  viewer.camera.changed.addEventListener(updateCommunicationTubeOnCameraChange);

  function setCommunicationLink(link) {
    latestCommunicationLink = link;
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
      clear: '#34D399',
      doubtful: '#F59E0B',
      blocked: '#F43F5E',
      away: '#64748B',
    }[link.status];
    if (!statusColor) {
      throw new TypeError(`Unknown communication-link status: ${link.status}`);
    }

    communicationPositions = [
      Cesium.Cartesian3.fromArray(link.earthPositionEarthFixedMeters),
      Cesium.Cartesian3.fromArray(link.moonPositionEarthFixedMeters),
    ];
    const color = Cesium.Color.fromCssColorString(statusColor).withAlpha(0.65);

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
          topRadius: 10_000,
          bottomRadius: 10_000,
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
  }

  function resetOverview() {
    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(
        0,
        15,
        EARTH_CAMERA_SETTINGS.overviewHeight,
        Cesium.Ellipsoid.WGS84
      ),
      orientation: {
        heading: 0,
        pitch: -Cesium.Math.PI_OVER_TWO,
        roll: 0,
      },
      duration: isSoftwareGl ? 0 : 1.2,
      easingFunction: Cesium.EasingFunction.QUADRATIC_OUT,
    });
  }

  function zoomIn() {
    if (!viewer || viewer.isDestroyed()) return;
    if (viewer.trackedEntity) viewer.trackedEntity = undefined;
    const cartographic = viewer.camera.positionCartographic;
    if (
      !cartographic ||
      !Number.isFinite(cartographic.longitude) ||
      !Number.isFinite(cartographic.latitude)
    ) {
      return;
    }
    const rawHeight = cartographic.height;
    const currentHeight =
      Number.isFinite(rawHeight) && rawHeight > 0
        ? rawHeight
        : EARTH_CAMERA_SETTINGS.overviewHeight;
    const targetHeight = Math.max(
      EARTH_CAMERA_SETTINGS.minimumZoomDistance,
      currentHeight * EARTH_CAMERA_SETTINGS.zoomInFactor
    );
    viewer.camera.cancelFlight?.();
    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(
        Cesium.Math.toDegrees(cartographic.longitude),
        Cesium.Math.toDegrees(cartographic.latitude),
        targetHeight,
        Cesium.Ellipsoid.WGS84
      ),
      duration: isSoftwareGl ? 0 : 0.45,
      easingFunction: Cesium.EasingFunction.QUADRATIC_OUT,
    });
    scene.requestRender();
  }

  function zoomOut() {
    if (!viewer || viewer.isDestroyed()) return;
    if (viewer.trackedEntity) viewer.trackedEntity = undefined;
    const cartographic = viewer.camera.positionCartographic;
    if (
      !cartographic ||
      !Number.isFinite(cartographic.longitude) ||
      !Number.isFinite(cartographic.latitude)
    ) {
      return;
    }
    const rawHeight = cartographic.height;
    const currentHeight =
      Number.isFinite(rawHeight) && rawHeight > 0
        ? rawHeight
        : EARTH_CAMERA_SETTINGS.overviewHeight;
    const targetHeight = Math.min(
      EARTH_CAMERA_SETTINGS.maximumZoomDistance,
      currentHeight * EARTH_CAMERA_SETTINGS.zoomOutFactor
    );
    viewer.camera.cancelFlight?.();
    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(
        Cesium.Math.toDegrees(cartographic.longitude),
        Cesium.Math.toDegrees(cartographic.latitude),
        targetHeight,
        Cesium.Ellipsoid.WGS84
      ),
      duration: isSoftwareGl ? 0 : 0.45,
      easingFunction: Cesium.EasingFunction.QUADRATIC_OUT,
    });
    scene.requestRender();
  }

  function flyTo(longitude, latitude, height = null) {
    if (!viewer || viewer.isDestroyed()) return;
    if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) return;
    if (viewer.trackedEntity) viewer.trackedEntity = undefined;
    const rawHeight = viewer.camera.positionCartographic?.height;
    const currentHeight =
      Number.isFinite(rawHeight) && rawHeight > 0 ? rawHeight : 4_500_000;
    const targetHeight =
      typeof height === 'number' && Number.isFinite(height) && height > 100
        ? height
        : currentHeight;
    viewer.camera.cancelFlight?.();
    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(
        longitude,
        latitude,
        Math.max(targetHeight, EARTH_CAMERA_SETTINGS.minimumZoomDistance),
        Cesium.Ellipsoid.WGS84
      ),
      duration: isSoftwareGl ? 0 : 1.1,
    });
    scene.requestRender();
  }

  return {
    id: 'earth',
    viewer,
    globe: earthGlobe,
    getViewer: () => viewer,
    waitUntilReady,
    resetOverview,
    zoomIn,
    zoomOut,
    flyTo,
    setCommunicationLink,
    setLayerVisibility: features.setLayerVisibility,
    toggleLighting,
    setLightingEnabled,
    toggleAutoRotate,
    getLightingEnabled: () => lightingEnabled,
    setActive(active) {
      if (isDestroyed || viewer.isDestroyed()) return;
      isActive = Boolean(active);
      if (isActive && 'default' in Cesium.Ellipsoid) {
        Cesium.Ellipsoid.default = Cesium.Ellipsoid.WGS84;
      }
      if (viewer.container) {
        viewer.container.style.display = isActive ? 'block' : 'none';
      }
      if (isActive) {
        fallbackImageryLayer.show = true;
        const { ms } = celestialTimeStore.get();
        viewer.clock.currentTime = Cesium.JulianDate.fromDate(new Date(ms));
      }
      renderLoop.setActive(isActive);
    },
    destroy() {
      if (isDestroyed) return;
      isDestroyed = true;
      renderLoop.destroy();
      globeControls.destroy();
      removeTimeListener();
      removePostRenderListener();
      if (removeRotationListener) {
        removeRotationListener();
        removeRotationListener = null;
      }
      viewer.camera.changed.removeEventListener(updateCommunicationTubeOnCameraChange);
      if (removeTileLoadListener) {
        removeTileLoadListener();
      }
      features.destroy();
      if (communicationEntity) {
        viewer.entities.remove(communicationEntity);
        communicationEntity = null;
      }
      communicationPositions = null;
      latestCommunicationLink = null;
      if (viewer && !viewer.isDestroyed()) {
        viewer.destroy();
      }
    },
    extras: { features },
  };
}
