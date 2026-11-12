import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  computeSurfaceRoute,
  profileRouteIllumination,
  stereoMetersToGrid,
  gridToStereoMeters,
  stereoMetersToLatLonDeg,
  DEFAULT_ROVER_CONFIG,
} from '../src/utils/routePlanner.js';
import { latLonToStereoMeters } from '../src/utils/horizons.js';

describe('Surface Route Planner & Rover Traverse Engine', () => {
  test('Coordinate projection and grid mapping roundtrips correctly', () => {
    const lat = -89.5;
    const lon = 45.0;
    const stereo = latLonToStereoMeters(lat, lon);
    const grid = stereoMetersToGrid(stereo.x, stereo.y);

    assert.ok(grid.gx >= 0 && grid.gx < 1520, 'gx within DEM width');
    assert.ok(grid.gy >= 0 && grid.gy < 1520, 'gy within DEM height');

    const stereoBack = gridToStereoMeters(grid.gx, grid.gy);
    const latLonBack = stereoMetersToLatLonDeg(stereoBack.x, stereoBack.y);

    assert.ok(Math.abs(latLonBack.lat - lat) < 0.05, 'latitude recovers within tolerance');
    assert.ok(Math.abs(latLonBack.lon - lon) < 1.0, 'longitude recovers within tolerance');
  });

  test('Rejects route targets outside South Pole DEM coverage (> 80°S)', async () => {
    const start = { lat: -78.0, lon: 0 };
    const goal = { lat: -89.0, lon: 0 };
    const res = await computeSurfaceRoute(start, goal);

    assert.equal(res.success, false);
    assert.match(res.reason, /coverage/i);
    assert.equal(res.waypoints.length, 0);
  });

  test('Identical start and goal returns zero distance single waypoint', async () => {
    const pt = { lat: -89.5, lon: 0 };
    const res = await computeSurfaceRoute(pt, pt);

    assert.equal(res.success, true);
    assert.equal(res.totalDistanceKm, 0);
    assert.equal(res.waypoints.length, 1);
    assert.equal(res.waypoints[0].lat, pt.lat);
    assert.equal(res.waypoints[0].lon, pt.lon);
  });

  test('Computes slope-limited route adhering to maxSlope constraint', async () => {
    const start = { lat: -89.56, lon: -140 };
    const goal = { lat: -89.12, lon: -87.1 };
    const maxSlopeDeg = 15.0;

    const res = await computeSurfaceRoute(start, goal, { maxSlopeDeg });

    assert.equal(res.success, true, 'Pathfinding succeeds');
    assert.ok(res.waypoints.length > 5, 'Generates multiple waypoints');
    assert.ok(res.totalDistanceKm > 10, 'Computes multi-kilometer traverse');
    assert.ok(res.maxSlopeDeg <= maxSlopeDeg + 0.1, `Observed slope ${res.maxSlopeDeg}° respects ${maxSlopeDeg}° limit`);
    assert.ok(Number.isFinite(res.elevationChangeM), 'Calculates total elevation change');
  });

  test('Profiles solar illumination along computed traverse', async () => {
    const start = { lat: -89.56, lon: -140 };
    const goal = { lat: -89.12, lon: -87.1 };
    const res = await computeSurfaceRoute(start, goal, { maxSlopeDeg: 15 });

    assert.equal(res.success, true);

    const profiled = profileRouteIllumination(res.waypoints, {
      startEpochMs: Date.parse('2027-03-15T12:00:00Z'), // Artemis III window
      roverSpeedKmh: 0.15,
    });

    assert.equal(profiled.length, res.waypoints.length);
    for (const wp of profiled) {
      assert.ok(['sunlit', 'blocked', 'night'].includes(wp.sunStatus), 'Valid solar classification');
      assert.ok(Number.isFinite(wp.sunElevationDeg), 'Sun elevation is finite');
      assert.ok(Number.isFinite(wp.terrainHorizonDeg), 'Horizon profile angle is finite');
      assert.ok(Number.isFinite(wp.timeOffsetHours), 'Transit schedule offset is finite');
    }
  });

  test('Fails gracefully when terrain is blocked by slope constraints that are too restrictive', async () => {
    // Setting an impossibly low slope limit across high relief
    const start = { lat: -89.9, lon: 0 };
    const goal = { lat: -88.5, lon: 90 };
    const res = await computeSurfaceRoute(start, goal, { maxSlopeDeg: 0.1 });

    assert.equal(res.success, false);
    assert.match(res.reason, /slope constraint/i);
  });
});
