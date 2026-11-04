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

test('LOLA DEM 360° Horizon Ray-Marching & Alias Resolution', async () => {
  const {
    HORIZON_TABLE,
    registerPolarDemGrid,
    computeDemHorizonProfile,
    horizonAt,
    getHorizonProfile,
  } = await import('../src/utils/horizons.js');

  // Verify precomputed alias resolution for 2D/3D South Pole landmarks
  const shackletonProfile = getHorizonProfile(HORIZON_TABLE, 'shackleton-crater');
  assert.ok(shackletonProfile, 'Shackleton alias should resolve to precomputed horizon');
  assert.equal(shackletonProfile.horizon.length, 360);

  // Verify horizonAt wrap-around at 0° and 360°
  const h0 = horizonAt(HORIZON_TABLE, 'shackleton-crater', 0);
  const h360 = horizonAt(HORIZON_TABLE, 'shackleton-crater', 360);
  assert.ok(Math.abs(h0 - h360) < 1e-6, 'Azimuth 0° and 360° must match seamlessly');

  // Register a synthetic 64x64 polar DEM with a central ridge and test ray-marching
  const size = 64;
  const grid = new Int16Array(size * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      // Elevate northern half (+Y / lower row index) by +1500m
      grid[y * size + x] = y < size / 2 ? 1500 : 0;
    }
  }
  registerPolarDemGrid(grid, size);

  const rayMarched = computeDemHorizonProfile(-89.5, 0);
  assert.ok(rayMarched, 'Ray-marched profile should be computed for -89.5°S');
  assert.equal(rayMarched.isRayMarched, true);
  assert.equal(rayMarched.horizon.length, 360);

  // Outside 80°S-90°S should return null so caller knows DEM is unmodeled there
  const outsidePolar = computeDemHorizonProfile(-45.0, 10.0);
  assert.equal(outsidePolar, null);
});

test('Lunar Terrain Metrics & Slope Hazard Warnings (Custom Dropped Pin Terrain Tab)', async () => {
  const { sampleLunarTerrainMetrics } = await import('../src/utils/horizons.js');

  // Safe polar highland ridge point
  const safeMetrics = sampleLunarTerrainMetrics(-86.0, 0.0, {
    elevationMeters: 2150,
    slopeDeg: 6.4,
  });
  assert.equal(safeMetrics.elevationM, 2150);
  assert.equal(safeMetrics.slopeDeg, 6.4);
  assert.equal(safeMetrics.isSlopeHazard, false);
  assert.equal(safeMetrics.terrainClassification, 'Polar Illuminated Massif / Ridge');
  assert.ok(safeMetrics.roughnessM > 0);
  assert.ok(safeMetrics.craterDensityPer100Km2 > 0);

  // Steep slope hazard (>= 15°)
  const steepMetrics = sampleLunarTerrainMetrics(-88.5, 45.0, {
    elevationMeters: -1200,
    slopeDeg: 18.2,
  });
  assert.equal(steepMetrics.isSlopeHazard, true);
  assert.equal(steepMetrics.terrainClassification, 'Steep Scarp / Crater Wall');
  assert.ok(
    steepMetrics.warnings.some((w) => w.id === 'slope-hazard' && w.severity === 'critical'),
    'Slope >= 15° should emit a critical slope-hazard warning'
  );
  assert.ok(safeMetrics.nearestLandmark, 'Should resolve nearest South Pole landmark with distance and bearing');
  assert.ok(safeMetrics.radialProfile, 'Should compute radial elevation cross-section');
  assert.equal(safeMetrics.radialProfile.northSouth.length, 13);
  assert.equal(safeMetrics.radialProfile.westEast.length, 13);
  assert.ok(['NASA_MEASURED', 'NASA_DERIVED'].includes(safeMetrics.uncertainty.provenanceType));
});

test('Project LUNA Phases 1-4: Provenance Registry, 4-Track Timeline, What-If Comparator & Discovery', async () => {
  const { NASA_DATASETS_REGISTRY, SOUTH_POLE_SCIENTIFIC_LAYERS } = await import(
    '../src/data/nasaProvenance.js'
  );
  assert.equal(NASA_DATASETS_REGISTRY.length, 4, 'Should register all 4 core NASA datasets');
  assert.equal(SOUTH_POLE_SCIENTIFIC_LAYERS.length, 9, 'Should define all 9 scientific map layers');

  const {
    simulateMissionTimelineTracks,
    compareWhatIfScenarios,
    discoverSouthPoleCandidates,
    DEFAULT_PLANNER_CONSTRAINTS,
  } = await import('../src/utils/plannerEngine.js');

  const testSiteA = {
    id: 'landing-artemis3-shackleton',
    name: 'Shackleton Rim',
    lat: -89.67,
    lon: 129.78,
    elevationM: 1251,
    slopeDeg: 9.2,
    roughnessM: 1.8,
  };
  const testSiteB = {
    id: 'landing-artemis3-malapert',
    name: 'Malapert Massif',
    lat: -86.02,
    lon: 2.7,
    elevationM: 5113,
    slopeDeg: 8.6,
    roughnessM: 1.6,
  };

  const epochMs = Date.parse('2026-09-20T12:00:00Z');
  const tracks = simulateMissionTimelineTracks(testSiteA, epochMs, 7, 6);
  assert.equal(tracks.steps.length, 28, '7 days at 6h cadence yields 28 steps');
  assert.ok(['sunlit', 'blocked', 'night'].includes(tracks.steps[0].solarStatus));
  assert.ok(['clear', 'doubtful', 'blocked', 'away'].includes(tracks.steps[0].earthStatus));
  assert.ok(['unobstructed', 'grazing', 'masked'].includes(tracks.steps[0].obstructionStatus));
  assert.ok(['favorable', 'conditional', 'challenging'].includes(tracks.steps[0].riskStatus));

  const whatIf = compareWhatIfScenarios(
    { site: testSiteA, landingMs: epochMs, durationDays: 7 },
    { site: testSiteB, landingMs: epochMs + 7 * 86400000, durationDays: 7 },
    DEFAULT_PLANNER_CONSTRAINTS
  );
  assert.ok(whatIf.evalA.formulaBreakdown.formulaString.includes('Score ='));
  assert.ok(Array.isArray(whatIf.improved));
  assert.ok(Array.isArray(whatIf.deteriorated));

  const discovered = discoverSouthPoleCandidates(epochMs, 7, DEFAULT_PLANNER_CONSTRAINTS);
  assert.ok(discovered.length >= 6, 'Should discover and rank South Pole LOLA DEM candidate sites');
  assert.ok(discovered[0].overallScore >= discovered[discovered.length - 1].overallScore);
});



