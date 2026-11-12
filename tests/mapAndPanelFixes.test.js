import test from 'node:test';
import assert from 'node:assert/strict';
import {
  HALF_EXTENT_M,
  SP_RESOLUTIONS,
  getResolutionForZoom,
  getScaleForZoom,
  computeViewportZoomLimits,
  computeValidCenterRangeMeters,
  computeClampedStereographicCenter,
  computeClampedPixelOffset,
  computeDraggablePaneOffsetBounds,
  SOUTH_POLE_MAP_COVERAGE,
  WHITE_OUTLINE_MIN_ZOOM,
  evaluateWhiteOutlineLayerVisibility,
  evaluateGreenConnectionLayerVisibility,
} from '../src/utils/mapViewportBounds.js';
import {
  isEligibleSouthPoleRoutePoint,
  featureToRouteWaypoint,
  transitionSelectLocation,
  transitionToggleRoutePlanner,
  transitionCloseLocationPanel,
  transitionReopenLocationPanel,
} from '../src/utils/panelStateMachine.js';

test('Viewport Zoom Limits: Prevents over-zoom-out empty space on standard viewports', () => {
  // Desktop 1376x844 viewport -> minZoom = 1 (950x950 px map), maxZoom = 6
  const desktop = computeViewportZoomLimits(1376, 844);
  assert.equal(desktop.minZoom, 1);
  assert.equal(desktop.maxZoom, 6);
  assert.equal(desktop.optimalFitZoom, 1);

  // Small mobile viewport 375x667 -> minZoom = 0 (475x475 px map), maxZoom = 6
  const mobile = computeViewportZoomLimits(375, 667);
  assert.equal(mobile.minZoom, 0);
  assert.equal(mobile.maxZoom, 6);
  assert.equal(mobile.optimalFitZoom, 0);
});

test('Independent Horizontal & Vertical Pan Boundaries Across Zoom Levels', () => {
  // At zoom = 1 (640 m/px), map is 608,000 m (950 px) in both X and Y.
  // In a 1376 x 844 px viewport:
  // - Horizontally: viewSpanX = 1376 * 640 = 880,640 m > 608,000 m -> maxAbsX_M = 0 (locked at center X=0)
  // - Vertically: viewSpanY = 844 * 640 = 540,160 m < 608,000 m -> maxAbsY_M = 304,000 - 270,080 = 33,920 m (53 px)
  const z1Res = getResolutionForZoom(1);
  assert.equal(z1Res, 640);
  const z1Range = computeValidCenterRangeMeters(1376, 844, z1Res, HALF_EXTENT_M);
  assert.equal(z1Range.maxAbsX_M, 0);
  assert.equal(z1Range.maxAbsY_M, 33920);

  // At zoom = 2 (320 m/px), map is 1900 x 1900 px > 1376 x 844 px in both axes:
  // - maxAbsX_M = 304,000 - (1376 * 320)/2 = 304,000 - 220,160 = 83,840 m
  // - maxAbsY_M = 304,000 - (844 * 320)/2 = 304,000 - 135,040 = 168,960 m
  const z2Res = getResolutionForZoom(2);
  assert.equal(z2Res, 320);
  const z2Range = computeValidCenterRangeMeters(1376, 844, z2Res, HALF_EXTENT_M);
  assert.equal(z2Range.maxAbsX_M, 83840);
  assert.equal(z2Range.maxAbsY_M, 168960);

  // At zoom = 6 (20 m/px), map is 30,400 x 30,400 px:
  const z6Res = getResolutionForZoom(6);
  assert.equal(z6Res, 20);
  const z6Range = computeValidCenterRangeMeters(1376, 844, z6Res, HALF_EXTENT_M);
  assert.equal(z6Range.maxAbsX_M, 304000 - (1376 * 20) / 2);
  assert.equal(z6Range.maxAbsY_M, 304000 - (844 * 20) / 2);
});

test('Strict Clamping in All 4 Directions (Left, Right, Up, Down) & Zero Zoom Drift', () => {
  const w = 1376;
  const h = 844;
  const resZ2 = getResolutionForZoom(2);

  const farLeft = computeClampedStereographicCenter(-500000, 0, w, h, resZ2);
  assert.equal(farLeft.x, -83840);
  assert.equal(farLeft.y, 0);
  assert.equal(farLeft.wasClampedX, true);
  assert.equal(farLeft.wasClampedY, false);

  const farRight = computeClampedStereographicCenter(500000, 0, w, h, resZ2);
  assert.equal(farRight.x, 83840);
  assert.equal(farRight.y, 0);
  assert.equal(farRight.wasClampedX, true);

  const farUp = computeClampedStereographicCenter(0, 500000, w, h, resZ2);
  assert.equal(farUp.x, 0);
  assert.equal(farUp.y, 168960);
  assert.equal(farUp.wasClampedY, true);

  const farDown = computeClampedStereographicCenter(0, -500000, w, h, resZ2);
  assert.equal(farDown.x, 0);
  assert.equal(farDown.y, -168960);
  assert.equal(farDown.wasClampedY, true);

  // Repeated zoom-in (1 -> 6) and zoom-out (6 -> 1) cycles must accumulate zero positioning drift
  let cx = 42000;
  let cy = -28000;
  for (let cycle = 0; cycle < 50; cycle++) {
    for (let z = 2; z <= 6; z++) {
      const clamped = computeClampedStereographicCenter(cx, cy, w, h, getResolutionForZoom(z));
      cx = clamped.x;
      cy = clamped.y;
    }
    for (let z = 6; z >= 2; z--) {
      const clamped = computeClampedStereographicCenter(cx, cy, w, h, getResolutionForZoom(z));
      cx = clamped.x;
      cy = clamped.y;
    }
  }
  assert.equal(cx, 42000);
  assert.equal(cy, -28000);

  // Zooming out to zoom = 1 smoothly clamps X to 0 and Y within [-33920, +33920]
  const atZ1 = computeClampedStereographicCenter(cx, cy, w, h, getResolutionForZoom(1));
  assert.equal(atZ1.x, 0);
  assert.equal(atZ1.y, -28000);
});

test('Draggable Pane Offset Bounds & Pixel Offset Clamping (Fixes Polar Stereographic Y-Inversion)', () => {
  const viewportSize = { x: 1376, y: 844 };

  const curCenterZ1 = { x: 475, y: 475 };
  const paneBoundsZ1 = computeDraggablePaneOffsetBounds(curCenterZ1, viewportSize, 1);
  // Horizontally 950 < 1376 -> locked (0..0)
  assert.equal(paneBoundsZ1.min.x, 0);
  assert.equal(paneBoundsZ1.max.x, 0);
  // Vertically 950 > 844 -> ±53 px
  assert.equal(paneBoundsZ1.min.y, -53);
  assert.equal(paneBoundsZ1.max.y, 53);

  // Pixel offset clamping at zoom = 1:
  const clampedOffsetZ1 = computeClampedPixelOffset(
    { x: 400, y: -400 },
    curCenterZ1,
    viewportSize,
    1
  );
  assert.equal(clampedOffsetZ1.x, 0);
  assert.equal(clampedOffsetZ1.y, -53);

  const curCenterZ2 = { x: 950, y: 950 };
  const paneBoundsZ2 = computeDraggablePaneOffsetBounds(curCenterZ2, viewportSize, 2);
  assert.equal(paneBoundsZ2.min.x, -262);
  assert.equal(paneBoundsZ2.max.x, 262);
  assert.equal(paneBoundsZ2.min.y, -528);
  assert.equal(paneBoundsZ2.max.y, 528);
});

test('Panel State Machine: Mutual Exclusivity & Persistent Selected Location Across Transitions', () => {
  let state = {
    selectedFeature: null,
    isFeaturePanelOpen: false,
    isRouteActive: false,
    routeStartPoint: null,
    routeGoalPoint: null,
  };

  const locationA = {
    id: 'shackleton-rim',
    name: 'Shackleton Crater Rim',
    latitude: -89.67,
    longitude: 129.78,
    elevationMeters: 1250,
  };
  state = { ...state, ...transitionSelectLocation(state, locationA) };
  assert.equal(state.isFeaturePanelOpen, true);
  assert.equal(state.isRouteActive, false);
  assert.equal(state.selectedFeature.name, 'Shackleton Crater Rim');
  assert.equal(state.selectedFeature.latitude, -89.67);
  assert.equal(state.selectedFeature.longitude, 129.78);

  state = { ...state, ...transitionToggleRoutePlanner(state) };
  assert.equal(state.isRouteActive, true);
  assert.equal(state.isFeaturePanelOpen, false, 'FeaturePanel must close when Route Planner opens');
  assert.ok(state.selectedFeature, 'selectedFeature must be preserved when Route Planner opens');
  assert.equal(state.selectedFeature.name, 'Shackleton Crater Rim');
  assert.ok(state.routeStartPoint, 'routeStartPoint must be populated from preserved polar location');
  assert.equal(state.routeStartPoint.lat, -89.67);
  assert.equal(state.routeStartPoint.lon, 129.78);

  state = { ...state, ...transitionToggleRoutePlanner(state) };
  assert.equal(state.isRouteActive, false);
  assert.equal(state.isFeaturePanelOpen, false);
  assert.ok(state.selectedFeature, 'Closing Route Planner must not erase selectedFeature');
  assert.equal(state.selectedFeature.name, 'Shackleton Crater Rim');

  state = { ...state, ...transitionReopenLocationPanel(state) };
  assert.equal(state.isFeaturePanelOpen, true);
  assert.equal(state.isRouteActive, false);
  assert.equal(state.selectedFeature.name, 'Shackleton Crater Rim');

  const locationB = {
    id: 'malapert-massif',
    name: 'Malapert Massif',
    latitude: -86.02,
    longitude: 2.7,
    elevationMeters: 5113,
  };
  state = { ...state, ...transitionSelectLocation(state, locationB) };
  assert.equal(state.isFeaturePanelOpen, true);
  assert.equal(state.selectedFeature.name, 'Malapert Massif');
  assert.equal(state.selectedFeature.latitude, -86.02);
  assert.equal(state.selectedFeature.longitude, 2.7);

  state = { ...state, ...transitionCloseLocationPanel(state) };
  assert.equal(state.isFeaturePanelOpen, false);
  assert.equal(state.selectedFeature.name, 'Malapert Massif');
});

test('2D South Pole Map Coverage Metadata & Explicit Coordinate Ranges', () => {
  assert.ok(SOUTH_POLE_MAP_COVERAGE.regionTitle.includes('South Pole Only'));
  assert.equal(SOUTH_POLE_MAP_COVERAGE.latMinDeg, -90.0);
  assert.equal(SOUTH_POLE_MAP_COVERAGE.latMaxDeg, -80.0);
  assert.equal(SOUTH_POLE_MAP_COVERAGE.lonMinDeg, -180.0);
  assert.equal(SOUTH_POLE_MAP_COVERAGE.lonMaxDeg, 180.0);
  assert.ok(SOUTH_POLE_MAP_COVERAGE.latitudeRangeText.includes('80.0°S to 90.0°S'));
  assert.ok(SOUTH_POLE_MAP_COVERAGE.longitudeRangeText.includes('180.0°W to 180.0°E'));
});

test('Independent White Outline Layer & Green Connection Line Layer Visibility Conditions', () => {
  assert.equal(WHITE_OUTLINE_MIN_ZOOM, 2);

  const whiteAtZoom0 = evaluateWhiteOutlineLayerVisibility({
    zoomLevel: 0,
    showContours: true,
    showRidges: true,
  });
  assert.equal(whiteAtZoom0.meetsZoomThreshold, false);
  assert.equal(whiteAtZoom0.isVisible, false);
  assert.equal(whiteAtZoom0.contoursVisible, false);
  assert.equal(whiteAtZoom0.ridgesVisible, false);
  assert.equal(whiteAtZoom0.neatlineVisible, false);

  const whiteAtZoom1 = evaluateWhiteOutlineLayerVisibility({
    zoomLevel: 1,
    showContours: true,
    showRidges: true,
  });
  assert.equal(whiteAtZoom1.meetsZoomThreshold, false);
  assert.equal(whiteAtZoom1.isVisible, false);
  assert.equal(whiteAtZoom1.contoursVisible, false);
  assert.equal(whiteAtZoom1.ridgesVisible, false);
  assert.equal(whiteAtZoom1.neatlineVisible, false);

  for (const z of [2, 3, 4, 5, 6]) {
    const whiteZoomedIn = evaluateWhiteOutlineLayerVisibility({
      zoomLevel: z,
      showContours: true,
      showRidges: true,
    });
    assert.equal(whiteZoomedIn.meetsZoomThreshold, true);
    assert.equal(whiteZoomedIn.isVisible, true);
    assert.equal(whiteZoomedIn.contoursVisible, true);
    assert.equal(whiteZoomedIn.ridgesVisible, true);
    assert.equal(whiteZoomedIn.neatlineVisible, true);
  }

  for (const z of [0, 1, 2, 3, 4, 5, 6]) {
    const greenWithDsn = evaluateGreenConnectionLayerVisibility({
      showDsnLink: true,
      subEarthLonDeg: -4.2,
      routeResult: null,
      // Passing zoom/contour props has zero effect on the green connection evaluator
      zoomLevel: z,
      showContours: false,
      minZoom: 99,
    });
    assert.equal(
      greenWithDsn.isVisible,
      true,
      `Green connection line must remain visible at zoom ${z} regardless of white outline threshold`
    );
    assert.equal(greenWithDsn.dsnConnectionVisible, true);
    assert.equal(greenWithDsn.routeConnectionVisible, false);
  }

  const greenWithRoute = evaluateGreenConnectionLayerVisibility({
    showDsnLink: false,
    subEarthLonDeg: 0,
    routeResult: {
      success: true,
      waypoints: [
        { lat: -89.67, lon: 129.78, sunStatus: 'sunlit' },
        { lat: -89.5, lon: 125.0, sunStatus: 'sunlit' },
      ],
    },
  });
  assert.equal(greenWithRoute.isVisible, true);
  assert.equal(greenWithRoute.dsnConnectionVisible, false);
  assert.equal(greenWithRoute.routeConnectionVisible, true);
});

