/**
 * @file earth/index.js
 * Creates the Cesium Viewer used for the Earth.
 */

import * as Cesium from 'cesium';
import { createEarthGlobe } from './earthGlobe.js';
import { createEarthFeatures } from './earthFeatures.js';
import { celestialTimeStore } from '../../utils/celestialTime.js';

const EARTH_CAMERA_SETTINGS = {
    overviewHeight: 20_000_000,
    minimumZoomDistance: 5_000_000,
    maximumZoomDistance: 100_000_000,
    zoomFactor: 2.0,
    zoomInFactor: 0.52,
    zoomOutFactor: 1.65,
    desktopInertiaSpin: 0.88,
    mobileInertiaSpin: 0.82,
    desktopInertiaTranslate: 0.85,
    mobileInertiaTranslate: 0.80,
    desktopInertiaZoom: 0.80,
    mobileInertiaZoom: 0.76,
};

export function createEarth(container, callbacks = {}) {
    const isMobile = typeof window !== 'undefined' && (
        window.innerWidth < 768 ||
        navigator.maxTouchPoints > 1 ||
        /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
    );
    const ionToken = import.meta.env.VITE_CESIUM_ION_TOKEN?.trim();
    if (ionToken) {
        Cesium.Ion.defaultAccessToken = ionToken;
    }

    const { globe: earthGlobe, fallbackImageryLayer } = createEarthGlobe();

    const viewer = new Cesium.Viewer(container, {
        globe: earthGlobe,
        baseLayer: false,

        mapProjection:
            new Cesium.GeographicProjection(Cesium.Ellipsoid.WGS84),
        requestRenderMode: true,
        maximumRenderTimeChange: Infinity,

        skyAtmosphere: new Cesium.SkyAtmosphere(Cesium.Ellipsoid.WGS84),

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

    viewer.resolutionScale = Math.min(
        window.devicePixelRatio || 1.0,
        2.0
    );

    viewer.useBrowserRecommendedResolution = false;

    const scene = viewer.scene;

    scene.backgroundColor =
        Cesium.Color.fromCssColorString('#050811');

    scene.globe.depthTestAgainstTerrain = true;

    scene.highDynamicRange = true;
    scene.globe.enableLighting = true;
    scene.globe.dynamicAtmosphereLighting = true;
    scene.light = new Cesium.SunLight();

    viewer.clock.shouldAnimate = false;
    viewer.clock.currentTime = Cesium.JulianDate.fromDate(
        new Date(celestialTimeStore.get().ms)
    );

    let lightingEnabled = true;
    const toggleLighting = () => {
        lightingEnabled = !lightingEnabled;
        scene.globe.enableLighting = lightingEnabled;
        scene.requestRender();
        return lightingEnabled;
    };

    // THE MOON
    scene.moon = new Cesium.Moon({
        show: true,
        onlySunLighting: true,
    });

    // Configure the camera for Earth.
    const cameraController =
        scene.screenSpaceCameraController;

    cameraController._ellipsoid =
        Cesium.Ellipsoid.WGS84;

    viewer.camera._ellipsoid =
        Cesium.Ellipsoid.WGS84;

    cameraController.enableRotate = true;
    cameraController.enableTranslate = true;
    cameraController.enableZoom = true;
    cameraController.enableTilt = true;
    cameraController.enableLook = false;
    cameraController.enableCollisionDetection = false;
    cameraController.rotateEventTypes = [];

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
    cameraController.minimumZoomDistance =
        EARTH_CAMERA_SETTINGS.minimumZoomDistance;
    cameraController.maximumZoomDistance =
        EARTH_CAMERA_SETTINGS.maximumZoomDistance;

    // Lower screen-space error requests finer terrain only as the camera approaches the surface.
    const updateTerrainDetail = () => {
        const height = viewer.camera.positionCartographic.height;
        scene.globe.maximumScreenSpaceError =
            height < 1_000_000 ? 1.0 : height < 5_000_000 ? 1.5 : 2.0;
    };
    viewer.camera.changed.addEventListener(updateTerrainDetail);
    updateTerrainDetail();

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

    if (ionToken) {
        Cesium.IonImageryProvider.fromAssetId(2)
            .then((provider) => {
                if (isDestroyed || viewer.isDestroyed()) return;

                const layers = scene.globe.imageryLayers;
                layers.add(new Cesium.ImageryLayer(provider), 0);
                layers.remove(fallbackImageryLayer, true);
                scene.requestRender();
            })
            .catch((error) => {
                if (!isDestroyed) {
                    console.error(
                        'Cesium ion Earth imagery failed to load; keeping the local Earth texture.',
                        error
                    );
                }
            });

        Cesium.CesiumTerrainProvider.fromIonAssetId(1, {
            ellipsoid: Cesium.Ellipsoid.WGS84,
            requestVertexNormals: true,
        })
            .then((terrainProvider) => {
                if (isDestroyed || viewer.isDestroyed()) return;
                scene.globe.terrainProvider = terrainProvider;
                scene.globe.tileCacheSize = 256;
                updateTerrainDetail();
                scene.requestRender();
            })
            .catch((error) => {
                if (!isDestroyed) {
                    console.error(
                        'Cesium ion Earth terrain failed to load; keeping ellipsoid terrain.',
                        error
                    );
                }
            });
    }

    const features = createEarthFeatures({ viewer, container, callbacks });

    function resetOverview() {
        viewer.camera.flyTo({
            destination: Cesium.Cartesian3.fromDegrees(
                0,
                0,
                EARTH_CAMERA_SETTINGS.overviewHeight,
                Cesium.Ellipsoid.WGS84
            ),
            duration: 1.4,
            easingFunction: Cesium.EasingFunction.QUADRATIC_OUT,
        });
    }

    function zoomIn() {
        const cartographic = viewer.camera.positionCartographic;
        const currentHeight =
            cartographic?.height || EARTH_CAMERA_SETTINGS.overviewHeight;
        const targetHeight = Math.max(
            EARTH_CAMERA_SETTINGS.minimumZoomDistance,
            currentHeight * EARTH_CAMERA_SETTINGS.zoomInFactor
        );
        viewer.camera.flyTo({
            destination: Cesium.Cartesian3.fromDegrees(
                Cesium.Math.toDegrees(cartographic.longitude),
                Cesium.Math.toDegrees(cartographic.latitude),
                targetHeight,
                Cesium.Ellipsoid.WGS84
            ),
            duration: 0.45,
            easingFunction: Cesium.EasingFunction.QUADRATIC_OUT,
        });
    }

    function zoomOut() {
        const cartographic = viewer.camera.positionCartographic;
        const currentHeight =
            cartographic?.height || EARTH_CAMERA_SETTINGS.overviewHeight;
        const targetHeight = Math.min(
            EARTH_CAMERA_SETTINGS.maximumZoomDistance,
            currentHeight * EARTH_CAMERA_SETTINGS.zoomOutFactor
        );
        viewer.camera.flyTo({
            destination: Cesium.Cartesian3.fromDegrees(
                Cesium.Math.toDegrees(cartographic.longitude),
                Cesium.Math.toDegrees(cartographic.latitude),
                targetHeight,
                Cesium.Ellipsoid.WGS84
            ),
            duration: 0.45,
            easingFunction: Cesium.EasingFunction.QUADRATIC_OUT,
        });
    }

    function flyTo(longitude, latitude, height = 2_000_000) {
        viewer.camera.flyTo({
            destination: Cesium.Cartesian3.fromDegrees(
                longitude,
                latitude,
                height,
                Cesium.Ellipsoid.WGS84
            ),
            duration: 1.2,
        });
    }


    return {
        id: 'earth',
        viewer,
        globe: earthGlobe,
        getViewer: () => viewer,

        resetOverview,
        zoomIn,
        zoomOut,
        flyTo,
        setLayerVisibility: features.setLayerVisibility,
        toggleLighting,
        getLightingEnabled: () => lightingEnabled,
        setActive(active) {
            if (isDestroyed || viewer.isDestroyed()) return;
            isActive = Boolean(active);
            viewer.useDefaultRenderLoop = isActive;
            if (viewer.container) {
                viewer.container.style.display = isActive ? 'block' : 'none';
            }
            if (isActive) {
                const { ms } = celestialTimeStore.get();
                viewer.clock.currentTime = Cesium.JulianDate.fromDate(new Date(ms));
                viewer.resize?.();
                viewer.scene?.requestRender?.();
            }
        },

        destroy() {
            if (isDestroyed) return;
            isDestroyed = true;
            removeTimeListener();
            viewer.camera.changed.removeEventListener(updateTerrainDetail);
            features.destroy();
            if (viewer && !viewer.isDestroyed()) {
                viewer.destroy();
            }
        },
        extras: { features },
    };
}