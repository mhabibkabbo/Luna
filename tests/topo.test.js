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
  const z0 = getContourIntervalForZoom(0);
  assert.equal(z0.intervalM, 500);
  assert.equal(z0.indexIntervalM, 2500);

  const z1 = getContourIntervalForZoom(1);
  assert.equal(z1.intervalM, 500);
  assert.equal(z1.indexIntervalM, 2500);

  const z2 = getContourIntervalForZoom(2);
  assert.equal(z2.intervalM, 200);
  assert.equal(z2.indexIntervalM, 1000);

  const z3 = getContourIntervalForZoom(3);
  assert.equal(z3.intervalM, 100);
  assert.equal(z3.indexIntervalM, 500);

  const z4 = getContourIntervalForZoom(4);
  assert.equal(z4.intervalM, 50);
  assert.equal(z4.indexIntervalM, 250);

  const z5 = getContourIntervalForZoom(5);
  assert.equal(z5.intervalM, 20);
  assert.equal(z5.indexIntervalM, 100);

  const z6 = getContourIntervalForZoom(6);
  assert.equal(z6.intervalM, 20);
  assert.equal(z6.indexIntervalM, 100);
});

test('Rectilinear Easting/Northing Grid Spacing by Zoom Level', () => {
  const g1 = getGridSpacingForZoom(1);
  assert.equal(g1.spacingM, 50000);

  const g2 = getGridSpacingForZoom(2);
  assert.equal(g2.spacingM, 20000);

  const g3 = getGridSpacingForZoom(3);
  assert.equal(g3.spacingM, 20000);

  const g4 = getGridSpacingForZoom(4);
  assert.equal(g4.spacingM, 10000);

  const g5 = getGridSpacingForZoom(5);
  assert.equal(g5.spacingM, 5000);
});

test('Index Contour Identification (Every 5th line)', () => {
  assert.equal(isIndexContour(0, 500), true);
  assert.equal(isIndexContour(2500, 500), true);
  assert.equal(isIndexContour(-2500, 500), true);
  assert.equal(isIndexContour(5000, 500), true);
  assert.equal(isIndexContour(-5000, 500), true);
  assert.equal(isIndexContour(500, 500), false);
  assert.equal(isIndexContour(1000, 500), false);
  assert.equal(isIndexContour(1500, 500), false);
  assert.equal(isIndexContour(2000, 500), false);

  assert.equal(isIndexContour(0, 200), true);
  assert.equal(isIndexContour(1000, 200), true);
  assert.equal(isIndexContour(-1000, 200), true);
  assert.equal(isIndexContour(200, 200), false);
  assert.equal(isIndexContour(400, 200), false);
  assert.equal(isIndexContour(600, 200), false);
  assert.equal(isIndexContour(800, 200), false);

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

  assert.ok(computeSlopeDeg(dz15 * 0.9, 0) < 15.0);

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

  const shackletonProfile = getHorizonProfile(HORIZON_TABLE, 'shackleton-crater');
  assert.ok(shackletonProfile, 'Shackleton alias should resolve to precomputed horizon');
  assert.equal(shackletonProfile.horizon.length, 360);

  // Verify horizonAt wrap-around at 0° and 360°
  const h0 = horizonAt(HORIZON_TABLE, 'shackleton-crater', 0);
  const h360 = horizonAt(HORIZON_TABLE, 'shackleton-crater', 360);
  assert.ok(Math.abs(h0 - h360) < 1e-6, 'Azimuth 0° and 360° must match seamlessly');

  const size = 64;
  const grid = new Int16Array(size * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      grid[y * size + x] = y < size / 2 ? 1500 : 0;
    }
  }
  registerPolarDemGrid(grid, size);

  const rayMarched = computeDemHorizonProfile(-89.5, 0);
  assert.ok(rayMarched, 'Ray-marched profile should be computed for -89.5°S');
  assert.equal(rayMarched.isRayMarched, true);
  assert.equal(rayMarched.horizon.length, 360);

  // Verify negative horizon dips on elevated peaks are not clamped to 0°
  // Create an elevated peak (e.g. +3000m at center) with lower surrounding terrain (-2000m)
  const peakGrid = new Int16Array(size * size);
  peakGrid.fill(-2000);
  const mid = Math.floor(size / 2);
  peakGrid[mid * size + mid] = 3000;
  peakGrid[mid * size + (mid - 1)] = 3000;
  peakGrid[(mid - 1) * size + mid] = 3000;
  peakGrid[(mid - 1) * size + (mid - 1)] = 3000;
  registerPolarDemGrid(peakGrid, size);

  const peakProfile = computeDemHorizonProfile(-90.0, 0.0);
  assert.ok(peakProfile, 'Peak profile computed');
  // Check that horizon angles dip below 0° (unclamped negative horizon)
  const hasNegativeDips = peakProfile.horizon.some((angle) => angle < 0);
  assert.ok(hasNegativeDips, 'Elevated peak overlooking low terrain must register negative horizon dips (< 0°)');

  // Outside 80°S-90°S should return null so caller knows DEM is unmodeled there
  const outsidePolar = computeDemHorizonProfile(-45.0, 10.0);
  assert.equal(outsidePolar, null);
});

test('Lunar Terrain Metrics & Slope Hazard Warnings (Custom Dropped Pin Terrain Tab)', async () => {
  const { sampleLunarTerrainMetrics } = await import('../src/utils/horizons.js');

  const safeMetrics = sampleLunarTerrainMetrics(-86.0, 0.0, {
    elevationMeters: 2150,
    slopeDeg: 6.4,
  });
  assert.equal(safeMetrics.elevationM, 2150);
  assert.equal(safeMetrics.slopeDeg, 6.4);
  assert.equal(safeMetrics.isSlopeHazard, false);
  assert.equal(safeMetrics.terrainClassification, 'Polar Illuminated Massif / Ridge');
  assert.ok(safeMetrics.roughnessM > 0);
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

test('Scientific Terrain Analysis: Authenticity, Horn Gradient, Configurable Radius, Geologic Boundaries, and Data Unavailable Guards', async () => {
  const {
    sampleLunarTerrainMetrics,
    computeRoughnessAndRelief,
    sampleRadialElevationProfile,
    ensurePolarDemLoaded,
  } = await import('../src/utils/horizons.js');

  const {
    determineLunarGeologicalRegion,
    findNearestLunarLandmark,
    getLunarRegionInfo,
  } = await import('../src/utils/coordinates.js');

  await ensurePolarDemLoaded(true);

  const crisiumGeo = determineLunarGeologicalRegion(17.0, 59.1);
  assert.equal(crisiumGeo.province, 'Mare Crisium Basin');
  assert.equal(crisiumGeo.isSouthPole, false);
  assert.notEqual(crisiumGeo.province, 'South Polar Highlands');

  const procellarumGeo = determineLunarGeologicalRegion(15.0, -50.0);
  assert.equal(procellarumGeo.province, 'Oceanus Procellarum');
  assert.equal(procellarumGeo.terrane, 'Procellarum KREEP Terrane (PKT)');
  assert.equal(procellarumGeo.isSouthPole, false);

  const spaGeo = determineLunarGeologicalRegion(-50.0, 160.0);
  assert.equal(spaGeo.province, 'South Pole-Aitken (SPA) Basin');
  assert.equal(spaGeo.isSouthPole, false);

  const southPoleGeo = determineLunarGeologicalRegion(-89.9, 0.0);
  assert.equal(southPoleGeo.province, 'South Polar Highlands');
  assert.equal(southPoleGeo.isSouthPole, true);

  const nearCrisium = findNearestLunarLandmark(17.0, 59.0);
  assert.ok(nearCrisium, 'Should find landmark near Mare Crisium');
  assert.ok(nearCrisium.name.includes('Crisium') || nearCrisium.name.includes('Luna'));
  assert.ok(nearCrisium.distanceKm < 150);

  const nearApollo11 = findNearestLunarLandmark(0.7, 23.5);
  assert.ok(nearApollo11, 'Should find landmark near Apollo 11');
  assert.ok(nearApollo11.name.includes('Apollo 11') || nearApollo11.name.includes('Tranquil'));

  const r1k = computeRoughnessAndRelief(0, 0, 1000);
  const r5k = computeRoughnessAndRelief(0, 0, 5000);
  assert.ok(r1k !== null);
  assert.ok(r5k !== null);
  assert.ok(r5k.sampleCount > r1k.sampleCount);
  assert.ok(r5k.reliefM >= r1k.reliefM, '5km relief should be >= 1km relief');

  const outsidePinMetrics = sampleLunarTerrainMetrics(20.0, -30.0, {
    isCustomPin: true,
  });
  assert.equal(outsidePinMetrics.elevationM, null, 'Arbitrary pin outside DEM should have null elevation');
  assert.equal(outsidePinMetrics.slopeDeg, null, 'Arbitrary pin outside DEM should have null slope');
  assert.equal(outsidePinMetrics.roughnessM, null, 'Arbitrary pin outside DEM should have null roughness');
  assert.equal(outsidePinMetrics.reliefM, null, 'Arbitrary pin outside DEM should have null relief');
  assert.equal(outsidePinMetrics.radialProfile, null, 'Arbitrary pin outside DEM should have null radial profile');
  assert.equal(outsidePinMetrics.uncertainty.isAvailable, false);
  assert.equal(outsidePinMetrics.uncertainty.verticalAccuracy, 'Data unavailable');
  assert.notEqual(outsidePinMetrics.geologicalRegion.province, 'South Polar Highlands');

  const polarMetrics = sampleLunarTerrainMetrics(-89.9, 0.0, {
    isCustomPin: true,
  });
  assert.ok(polarMetrics.elevationM !== null);
  assert.ok(polarMetrics.slopeDeg !== null);
  assert.ok(polarMetrics.roughnessM !== null);
  assert.ok(polarMetrics.reliefM !== null);
  assert.ok(polarMetrics.radialProfile !== null);
  assert.equal(polarMetrics.radialProfile.northSouth.length, 13);
  assert.equal(polarMetrics.radialProfile.westEast.length, 13);
  assert.equal(polarMetrics.uncertainty.isAvailable, true);
  assert.equal(polarMetrics.uncertainty.verticalAccuracy, '±1.0 m (absolute)');
});

test('Audit Verification: LOLA Worker 0.5 m Vertical Scaling & Unified Planner Engine Non-Fabrication', async () => {
  const {
    initWorkerDemBuffer,
    sampleElevation,
    sampleElevationAtMeters,
    computeSlopeAtMeters,
  } = await import('../src/workers/lolaTileWorker.js');
  const {
    rankLandingCandidates,
    evaluateCandidateForMissionWindow,
    DEFAULT_PLANNER_CONSTRAINTS,
  } = await import('../src/utils/plannerEngine.js');
  const { PLANNER_CANDIDATES } = await import('../src/data/plannerCandidates.js');
  const { ensurePolarDemLoaded } = await import('../src/utils/horizons.js');

  await ensurePolarDemLoaded(true);

  // Verify lolaTileWorker applies 0.5 m/DN scaling and returns null out of bounds
  const dummyGrid = new Int16Array(1520 * 1520);
  dummyGrid.fill(2000);
  initWorkerDemBuffer(dummyGrid);
  assert.equal(sampleElevation(760, 760), 1000);
  assert.equal(sampleElevationAtMeters(0, 0), 1000);
  const flatSlope = computeSlopeAtMeters(0, 0);
  assert.equal(flatSlope.elevationM, 1000);
  assert.equal(flatSlope.slopeDeg, 0);

  const outOfBoundsSlope = computeSlopeAtMeters(500000, 500000);
  assert.equal(outOfBoundsSlope.elevationM, null);
  assert.equal(outOfBoundsSlope.slopeDeg, null);

  // Verify rankLandingCandidates runs all 19 candidates without crashing on null slope/elevation
  const testEpochMs = Date.parse('2026-09-20T12:00:00Z');
  const ranked = rankLandingCandidates(PLANNER_CANDIDATES, {
    ...DEFAULT_PLANNER_CONSTRAINTS,
    landingTimeMs: testEpochMs,
    missionDurationDays: 14,
  });
  assert.equal(ranked.length, PLANNER_CANDIDATES.length);

  // Nearside polar sites must have > 0% DTE uptime
  const malapert = ranked.find((r) => r.id === 'landing-artemis3-malapert');
  assert.ok(malapert, 'Malapert candidate should exist');
  assert.ok(malapert.dteUptimeRatio > 0, `Nearside polar site DTE uptime must be > 0%, got ${malapert.dteUptimeRatio}%`);
  assert.ok(malapert.slopeDeg !== null, 'Polar site slopeDeg must be sampled from LOLA DEM');
  assert.ok(malapert.elevationM !== null, 'Polar site elevationM must be sampled from LOLA DEM');

  const malapertSite = PLANNER_CANDIDATES.find((c) => c.id === 'landing-artemis3-malapert');
  const evalPositional = evaluateCandidateForMissionWindow(
    malapertSite,
    testEpochMs,
    14,
    DEFAULT_PLANNER_CONSTRAINTS
  );
  const evalOptions = evaluateCandidateForMissionWindow(malapertSite, {
    ...DEFAULT_PLANNER_CONSTRAINTS,
    landingTimeMs: testEpochMs,
    missionDurationDays: 14,
  });
  assert.equal(evalPositional.overallScore, evalOptions.overallScore);
  assert.equal(evalPositional.sunlitRatio, evalOptions.sunlitRatio);
  assert.equal(evalPositional.dteUptimeRatio, evalOptions.dteUptimeRatio);
  assert.ok(evalPositional.touchdown && typeof evalPositional.touchdown.dteStatus === 'string');
  assert.ok(evalPositional.instant && typeof evalPositional.instant.dteStatus === 'string');
  assert.ok(evalPositional.terrain && evalPositional.terrain.elevationM !== undefined);

  // Non-polar sites outside 80°S-90°S must have slopeDeg === null and slopeScore === null (never coerced to 100)
  const crisium = ranked.find((r) => r.id === 'landing-clps-firefly-crisium');
  assert.ok(crisium, 'Mare Crisium candidate should exist');
  assert.equal(crisium.slopeDeg, null, 'Non-polar site outside 80°S-90°S DEM must have slopeDeg === null');
  assert.equal(crisium.elevationM, null, 'Non-polar site outside 80°S-90°S DEM must have elevationM === null');
  assert.equal(crisium.slopeScore, null, 'Non-polar site slopeScore must be null, not coerced to 100');
  assert.equal(crisium.isPartialScore, true, 'Non-polar site must be flagged as partial 3-criterion score');
});

test('Horn (1981) 8-Neighbor Gradient Stencil Consistency Across Worker & Horizons', async () => {
  const { computeSlopeAtMeters, initWorkerDemBuffer } = await import(
    '../src/workers/lolaTileWorker.js'
  );
  const { computeHornSlopeAtMeters, registerPolarDemGrid } = await import(
    '../src/utils/horizons.js'
  );

  const size = 32;
  const grid = new Int16Array(size * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      // Elevation in raw DN (scale 0.5 m)
      grid[y * size + x] = Math.round((Math.sin(x * 0.3) * 500 + Math.cos(y * 0.3) * 400 + (x * y) * 2) * 2);
    }
  }

  initWorkerDemBuffer(grid, size, 0.5);
  registerPolarDemGrid(grid, size, 0.5);

  // Probe at stereographic coordinates (e.g. 1000m, -2000m)
  const workerProbe = computeSlopeAtMeters(1000, -2000, 400);
  const horizonsProbe = computeHornSlopeAtMeters(1000, -2000, 400);

  assert.ok(workerProbe.slopeDeg !== null, 'Worker probe should return valid slope');
  assert.ok(horizonsProbe.slopeDeg !== null, 'Horizons probe should return valid slope');
  assert.ok(
    Math.abs(workerProbe.slopeDeg - horizonsProbe.slopeDeg) < 1e-4,
    `Worker slope (${workerProbe.slopeDeg}°) must match horizons Horn slope (${horizonsProbe.slopeDeg}°)`
  );
  assert.ok(
    Math.abs(workerProbe.elevationM - horizonsProbe.elevationM) < 1e-4,
    `Worker elevation (${workerProbe.elevationM}m) must match horizons elevation (${horizonsProbe.elevationM}m)`
  );
  assert.ok(
    Math.abs(workerProbe.dzdx - horizonsProbe.dzdx) < 1e-6,
    'Worker dzdx must match horizons dzdx'
  );
  assert.ok(
    Math.abs(workerProbe.dzdy - horizonsProbe.dzdy) < 1e-6,
    'Worker dzdy must match horizons dzdy'
  );
});

test('South Polar Stereographic Pan Bounds: Symmetric 4-Quadrant Coverage Including Top Half (Y > 0)', async () => {
  const proj4 = (await import('proj4')).default;
  const SP_PROJ4_DEF =
    '+proj=stere +lat_0=-90 +lon_0=0 +k=1 +a=1737400 +b=1737400 +units=m +no_defs';
  const LUNAR_LONLAT_DEF = '+proj=longlat +a=1737400 +b=1737400 +no_defs';

  const extentM = 600000;
  const [swLon, swLat] = proj4(SP_PROJ4_DEF, LUNAR_LONLAT_DEF, [-extentM, -extentM]);
  const [neLon, neLat] = proj4(SP_PROJ4_DEF, LUNAR_LONLAT_DEF, [extentM, extentM]);

  const minLat = Math.min(swLat, neLat);
  const maxLat = Math.max(swLat, neLat);
  const minLon = Math.min(swLon, neLon);
  const maxLon = Math.max(swLon, neLon);

  const [projSwX, projSwY] = proj4(LUNAR_LONLAT_DEF, SP_PROJ4_DEF, [minLon, minLat]);
  const [projNeX, projNeY] = proj4(LUNAR_LONLAT_DEF, SP_PROJ4_DEF, [maxLon, maxLat]);

  assert.ok(Math.abs(projSwX - -extentM) < 1, 'Projected SW X must be -600 km');
  assert.ok(Math.abs(projSwY - -extentM) < 1, 'Projected SW Y must be -600 km');
  assert.ok(Math.abs(projNeX - extentM) < 1, 'Projected NE X must be +600 km');
  assert.ok(Math.abs(projNeY - extentM) < 1, 'Projected NE Y must be +600 km (top half accessible)');

  // Verify top-half landmarks (e.g. Malapert A at 80.13°S, 1.44°E and Malapert Massif at 86.02°S, 2.7°E) lie well within projected pan bounds
  const [malapertAX, malapertAY] = proj4(LUNAR_LONLAT_DEF, SP_PROJ4_DEF, [1.44, -80.13]);
  assert.ok(malapertAY > 0, 'Malapert A lies in the top half (Y > 0)');
  assert.ok(malapertAX >= projSwX && malapertAX <= projNeX);
  assert.ok(malapertAY >= projSwY && malapertAY <= projNeY);
});

test('South Pole GeoJSON Integrity: Stereographic Crater Rims, Connecting Ridge Azimuths & Geodesic Traverse Metrics', async () => {
  const fs = await import('node:fs');
  const ridgesData = JSON.parse(fs.readFileSync('public/data/topo/ridges_and_rims.geojson', 'utf8'));
  const traversesData = JSON.parse(fs.readFileSync('public/data/topo/planned_traverses.geojson', 'utf8'));

  const R0 = 1737400;
  const latLonToStereo = (lat, lon) => {
    const colat = ((90 + lat) * Math.PI) / 180;
    const r = 2 * R0 * Math.tan(colat / 2);
    const lonRad = (lon * Math.PI) / 180;
    return { x: r * Math.sin(lonRad), y: r * Math.cos(lonRad) };
  };
  const geodesicDistKm = ([lon1, lat1], [lon2, lat2]) => {
    const toRad = Math.PI / 180;
    const p1 = lat1 * toRad;
    const p2 = lat2 * toRad;
    const dp = (lat2 - lat1) * toRad;
    const dl = (lon2 - lon1) * toRad;
    const a = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
    return (2 * Math.atan2(Math.sqrt(a), Math.sqrt(Math.max(0, 1 - a))) * R0) / 1000;
  };

  // 1. Shackleton Crater Rim must be a true stereographic circle of ~10.5 km radius encircling 90°S
  const shackleton = ridgesData.features.find((f) => f.properties.name === 'Shackleton Crater Rim');
  assert.ok(shackleton, 'Shackleton Crater Rim feature must exist');
  const shCenter = latLonToStereo(shackleton.properties.centerLat, shackleton.properties.centerLon);
  const shCoords = shackleton.geometry.coordinates;
  let hasPosLon = false;
  let hasNegLon = false;
  for (const [lon, lat] of shCoords) {
    if (lon > 100) hasPosLon = true;
    if (lon < -100) hasNegLon = true;
    const pt = latLonToStereo(lat, lon);
    const distM = Math.hypot(pt.x - shCenter.x, pt.y - shCenter.y);
    assert.ok(Math.abs(distM - 10500) < 5, `Shackleton rim radius must be 10.5 km in stereographic space, got ${distM}`);
  }
  assert.ok(hasPosLon && hasNegLon, 'Shackleton rim must encircle 90°S and span positive and negative longitudes');

  const connectingRidge = ridgesData.features.find((f) => f.properties.name === 'Connecting Ridge Crest');
  assert.ok(connectingRidge);
  for (const [lon] of connectingRidge.geometry.coordinates) {
    assert.ok(lon <= -85 && lon >= -145, `Connecting Ridge longitude ${lon}° must stay in the -145°W to -85°W (215°E–275°E) sector`);
  }

  for (const feat of traversesData.features) {
    const coords = feat.geometry.coordinates;
    let sumKm = 0;
    for (let i = 1; i < coords.length; i++) {
      sumKm += geodesicDistKm(coords[i - 1], coords[i]);
    }
    assert.ok(
      Math.abs(feat.properties.lengthKm - sumKm) <= 0.15,
      `Traverse ${feat.properties.id} lengthKm (${feat.properties.lengthKm}) must match geodesic length (${sumKm.toFixed(2)})`
    );
  }
});

test('Multi-Azimuth LOLA DEM Horizon PSR Mask & DEM-Derived PSR Footprints (CRITICAL-04)', async () => {
  const fs = await import('node:fs');
  const {
    initWorkerDemBuffer,
    computePsrClearanceAtMeters,
  } = await import('../src/workers/lolaTileWorker.js');

  const flatDeepGrid = new Int16Array(1520 * 1520);
  flatDeepGrid.fill(-5000);
  initWorkerDemBuffer(flatDeepGrid);
  const flatClearance = computePsrClearanceAtMeters(0, 0);
  assert.ok(
    flatClearance > 1.0,
    `Flat terrain at -2500m must have positive solar clearance (> 1.0°), got ${flatClearance}°`
  );

  const rawBuf = fs.readFileSync('public/data/lola_sp_80s_int16.bin');
  const realDemInt16 = new Int16Array(rawBuf.buffer, rawBuf.byteOffset, rawBuf.byteLength / 2);
  initWorkerDemBuffer(realDemInt16, 1520, 0.5);

  const shackletonFloorClearance = computePsrClearanceAtMeters(7921, -6600);
  const southPoleRimClearance = computePsrClearanceAtMeters(0, 0);
  assert.ok(
    shackletonFloorClearance < 0,
    `Shackleton Crater floor must be permanently shadowed across all 16 solar azimuths (< 0°), got ${shackletonFloorClearance}°`
  );
  assert.ok(
    southPoleRimClearance > 0,
    `South Pole rim crest (0, 0) must receive summer sunlight (> 0°), got ${southPoleRimClearance}°`
  );

  const psrGeoJson = JSON.parse(fs.readFileSync('public/data/topo/psr_footprints.geojson', 'utf8'));
  assert.ok(psrGeoJson.features.length >= 50, `Expected >= 50 DEM-derived PSR polygons, found ${psrGeoJson.features.length}`);
  const shackletonPoly = psrGeoJson.features.find((f) => f.properties.id === 'psr-shackleton');
  assert.ok(shackletonPoly, 'DEM-derived Shackleton PSR polygon must be present');
  assert.ok(shackletonPoly.geometry.coordinates.length >= 15, 'Shackleton PSR polygon must have detailed contour vertices');
});

test('Planar Sub-Solar/Sub-Earth Directional DEM Horizon Ray-Marching (CRITICAL-05)', async () => {
  const fs = await import('node:fs');
  const {
    initWorkerDemBuffer,
    sampleElevationAtMeters,
    computeDirectionalHorizonDeg,
  } = await import('../src/workers/lolaTileWorker.js');

  const rawBuf = fs.readFileSync('public/data/lola_sp_80s_int16.bin');
  const realDemInt16 = new Int16Array(rawBuf.buffer, rawBuf.byteOffset, rawBuf.byteLength / 2);
  initWorkerDemBuffer(realDemInt16, 1520, 0.5);

  const halfExtent = 304000;

  const floorZ = sampleElevationAtMeters(7921, -6600);
  const floorHorizonTowardEarthDeg = computeDirectionalHorizonDeg(7921, -6600, floorZ, 0, 1, halfExtent);
  assert.ok(
    floorHorizonTowardEarthDeg > 10.0,
    `Shackleton floor looking toward 0°E must be occluded by steep crater wall (> 10°), got ${floorHorizonTowardEarthDeg.toFixed(2)}°`
  );

  const rimZ = sampleElevationAtMeters(0, 0);
  const rimHorizonTowardEarthDeg = computeDirectionalHorizonDeg(0, 0, rimZ, 0, 1, halfExtent);
  assert.ok(
    rimHorizonTowardEarthDeg < 2.0,
    `South Pole rim crest looking toward 0°E must have an unobstructed low horizon (< 2°), got ${rimHorizonTowardEarthDeg.toFixed(2)}°`
  );
  assert.ok(
    floorHorizonTowardEarthDeg > rimHorizonTowardEarthDeg + 10.0,
    'Crater floor horizon obstruction must exceed rim horizon by > 10°'
  );
});
