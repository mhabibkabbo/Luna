/**
 * @file topo.test.js
 * Unit tests for the Lunar Orienteering / Paper Topographic Map system:
 * - Zoom-adaptive contour interval selection
 * - Polar stereographic rectilinear grid spacing selection
 * - Index contour identification (every 5th line)
 * - Slope gradient computation (degrees [0, 90])
 * - 15° hazard threshold identification
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  TOPO_STYLE,
  getContourIntervalForZoom,
  getGridSpacingForZoom,
  isIndexContour,
  computeSlopeDeg,
} from '../src/constants/topoStyle.js';

test('TOPO_STYLE Design System Constants Integrity', () => {
  assert.equal(TOPO_STYLE.svs5127.id, '5127');
  assert.equal(TOPO_STYLE.svs5127.sourceUrl, 'https://svs.gsfc.nasa.gov/5127/');
  assert.equal(TOPO_STYLE.canvas.backgroundColor, '#070A10');
  assert.equal(TOPO_STYLE.metadata.datum, 'Lunar Reference Sphere (R = 1,737,400.0 m)');
  assert.equal(TOPO_STYLE.metadata.slopeHazardThresholdDeg, 15.0);
});

test('Contour Interval Selection by Zoom Level', () => {
  // Zoom 0-1: 500m interval, 2500m index
  const z0 = getContourIntervalForZoom(0);
  assert.equal(z0.intervalM, 500);
  assert.equal(z0.indexIntervalM, 2500);

  const z1 = getContourIntervalForZoom(1);
  assert.equal(z1.intervalM, 500);
  assert.equal(z1.indexIntervalM, 2500);

  // Zoom 2: 200m interval, 1000m index
  const z2 = getContourIntervalForZoom(2);
  assert.equal(z2.intervalM, 200);
  assert.equal(z2.indexIntervalM, 1000);

  // Zoom 3: 100m interval, 500m index
  const z3 = getContourIntervalForZoom(3);
  assert.equal(z3.intervalM, 100);
  assert.equal(z3.indexIntervalM, 500);

  // Zoom 4: 50m interval, 250m index
  const z4 = getContourIntervalForZoom(4);
  assert.equal(z4.intervalM, 50);
  assert.equal(z4.indexIntervalM, 250);

  // Zoom 5-6: 20m interval, 100m index
  const z5 = getContourIntervalForZoom(5);
  assert.equal(z5.intervalM, 20);
  assert.equal(z5.indexIntervalM, 100);

  const z6 = getContourIntervalForZoom(6);
  assert.equal(z6.intervalM, 20);
  assert.equal(z6.indexIntervalM, 100);
});

test('Rectilinear Easting/Northing Grid Spacing by Zoom Level', () => {
  const g1 = getGridSpacingForZoom(1);
  assert.equal(g1.spacingM, 50000); // 50 km

  const g2 = getGridSpacingForZoom(2);
  assert.equal(g2.spacingM, 20000); // 20 km

  const g3 = getGridSpacingForZoom(3);
  assert.equal(g3.spacingM, 20000); // 20 km

  const g4 = getGridSpacingForZoom(4);
  assert.equal(g4.spacingM, 10000); // 10 km

  const g5 = getGridSpacingForZoom(5);
  assert.equal(g5.spacingM, 5000);  // 5 km
});

test('Index Contour Identification (Every 5th line)', () => {
  // At 500m interval, index is every 2500m
  assert.equal(isIndexContour(0, 500), true);
  assert.equal(isIndexContour(2500, 500), true);
  assert.equal(isIndexContour(-2500, 500), true);
  assert.equal(isIndexContour(5000, 500), true);
  assert.equal(isIndexContour(-5000, 500), true);
  assert.equal(isIndexContour(500, 500), false);
  assert.equal(isIndexContour(1000, 500), false);
  assert.equal(isIndexContour(1500, 500), false);
  assert.equal(isIndexContour(2000, 500), false);

  // At 200m interval, index is every 1000m
  assert.equal(isIndexContour(0, 200), true);
  assert.equal(isIndexContour(1000, 200), true);
  assert.equal(isIndexContour(-1000, 200), true);
  assert.equal(isIndexContour(200, 200), false);
  assert.equal(isIndexContour(400, 200), false);
  assert.equal(isIndexContour(600, 200), false);
  assert.equal(isIndexContour(800, 200), false);

  // At 100m interval, index is every 500m
  assert.equal(isIndexContour(0, 100), true);
  assert.equal(isIndexContour(500, 100), true);
  assert.equal(isIndexContour(-500, 100), true);
  assert.equal(isIndexContour(100, 100), false);
  assert.equal(isIndexContour(200, 100), false);
  assert.equal(isIndexContour(300, 100), false);
  assert.equal(isIndexContour(400, 100), false);
});

test('Slope Gradient Computation (Horn / Central Difference)', () => {
  // Flat horizontal terrain
  const flat = computeSlopeDeg(0, 0);
  assert.equal(flat, 0);

  // 1:1 slope in X direction (dz/dx = 1.0) -> exactly 45.0 degrees
  const slope45 = computeSlopeDeg(1.0, 0.0);
  assert.ok(Math.abs(slope45 - 45.0) < 1e-6);

  // 1:1 slope in Y direction (dz/dy = 1.0) -> exactly 45.0 degrees
  const slope45Y = computeSlopeDeg(0.0, 1.0);
  assert.ok(Math.abs(slope45Y - 45.0) < 1e-6);

  // Symmetric diagonal slope (dz/dx = 1, dz/dy = 1) -> atan(sqrt(2)) ≈ 54.7356°
  const slopeDiag = computeSlopeDeg(1.0, 1.0);
  const expectedDiag = (Math.atan(Math.SQRT2) * 180) / Math.PI;
  assert.ok(Math.abs(slopeDiag - expectedDiag) < 1e-6);

  // 15 degree slope hazard threshold check
  const dz15 = Math.tan((15.0 * Math.PI) / 180);
  const slope15 = computeSlopeDeg(dz15, 0);
  assert.ok(Math.abs(slope15 - 15.0) < 1e-5);

  // Below hazard threshold
  assert.ok(computeSlopeDeg(dz15 * 0.9, 0) < 15.0);

  // Above hazard threshold
  assert.ok(computeSlopeDeg(dz15 * 1.1, 0) > 15.0);
});
