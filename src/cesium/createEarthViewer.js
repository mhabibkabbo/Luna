/**
 * @file createEarthViewer.js
 * Creates the Cesium Viewer used for the Earth.
 */

import * as Cesium from 'cesium';
import { createEarthGlobe } from './createEarthGlobe.js';

export function createEarthViewer(container) {
    const earthGlobe = createEarthGlobe();

    const viewer = new Cesium.Viewer(container, {
        globe: earthGlobe,

        mapProjection:
            new Cesium.GeographicProjection(Cesium.Ellipsoid.WGS84),

        skyAtmosphere: new Cesium.SkyAtmosphere(
            Cesium.Ellipsoid.WGS84
        ),

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

    cameraController.inertiaSpin = 1.88;
    cameraController.inertiaTranslate = 0.85;
    cameraController.inertiaZoom = 0.80;

    cameraController.zoomFactor = 2.0;

    cameraController.minimumZoomDistance = 100.0;
    cameraController.maximumZoomDistance = 500*1000*1000.0;

    viewer.camera.setView({
    destination: Cesium.Cartesian3.fromDegrees(
        15,
        20,
        18_000_000
    ),
    });


    function resetOverview() {
        viewer.camera.flyHome(1.5);
    }

    function zoomIn() {
        viewer.camera.zoomIn(
            viewer.camera.positionCartographic.height * 0.35
        );
    }

    function zoomOut() {
        viewer.camera.zoomOut(
            viewer.camera.positionCartographic.height * 0.35
        );
    }

    function flyToCoordinate(longitude, latitude, height = 2_000_000) {
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
        viewer,
        globe: earthGlobe,

        resetOverview,
        zoomIn,
        zoomOut,
        flyToCoordinate,

        destroy() {
            viewer.destroy();
        },
    };
}