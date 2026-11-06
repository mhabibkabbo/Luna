import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeTransferOrbit,
  formatTransitTime,
  getInterpolatedStateAtFrac,
  solveKepler,
  latLonToSphere3D,
  sampleCatmullRomSpline,
  SCALE_3D,
  TRAJECTORY_PROFILES,
  EARTH_MU,
  MOON_MU,
  EARTH_RADIUS_KM,
  MOON_RADIUS_KM,
  EARTH_MOON_DIST_KM,
  MOON_SOI_KM,
  CR3BP_MU,
  CR3BP_DU,
} from '../src/utils/transferOrbit.js';
import { fetchJplMoonEphemeris, LUNAR_ROCKETS } from '../src/utils/jplHorizons.js';

test('solveKepler solves Kepler equation accurately', () => {
  const e = 0.5;
  const M = 1.0;
  const E = solveKepler(M, e);
  const calculatedM = E - e * Math.sin(E);
  assert.ok(Math.abs(calculatedM - M) < 1e-6, `Expected error < 1e-6, got ${Math.abs(calculatedM - M)}`);
});

test('computeTransferOrbit returns valid Direct Hohmann trajectory', () => {
  const launchSite = { name: 'Kennedy Space Center LC-39A', latitude: 28.6083, longitude: -80.6041 };
  const moonTarget = { name: 'Apollo 11 (Tranquility Base)', latitude: 0.6741, longitude: 23.4730 };

  const orbit = computeTransferOrbit({
    launchSite,
    moonTarget,
    profileId: 'direct',
  });

  assert.ok(orbit, 'Orbit plan should be defined');
  assert.equal(orbit.profile.id, 'direct');
  assert.equal(orbit.parkingOrbit.altKm, 185);
  // Circular velocity at 185 km ~ 7.79 km/s
  assert.ok(orbit.parkingOrbit.velocityKmS > 7.7 && orbit.parkingOrbit.velocityKmS < 7.9);
  // TLI delta-v ~ 3.13 km/s
  assert.ok(orbit.tli.deltaVKmS > 3.0 && orbit.tli.deltaVKmS < 3.3);
  // Transit time ~ 4.98 days
  assert.ok(orbit.transfer.transitDays > 4.5 && orbit.transfer.transitDays < 5.5);
  // Total delta-v budget ~ 5.5 to 6.0 km/s
  assert.ok(orbit.totalDeltaVKmS > 5.0 && orbit.totalDeltaVKmS < 6.5);
  // Waypoints exist and are populated
  assert.ok(orbit.waypoints.length > 50);
});

test('computeTransferOrbit handles Free-Return trajectory profile', () => {
  const launchSite = { name: 'Starbase Boca Chica', latitude: 25.997, longitude: -97.157 };
  const moonTarget = { name: 'Shackleton Crater Rim', latitude: -89.9, longitude: 0.0 };

  const orbit = computeTransferOrbit({
    launchSite,
    moonTarget,
    profileId: 'free-return',
  });

  assert.equal(orbit.profile.id, 'free-return');
  const returnWaypoints = orbit.waypoints.filter((p) => p.phase === 'return');
  assert.ok(returnWaypoints.length > 0, 'Free return must have return phase waypoints');
});

test('computeTransferOrbit handles Low-Energy WSB trajectory profile', () => {
  const launchSite = { name: 'Guiana Space Centre', latitude: 5.239, longitude: -52.768 };
  const moonTarget = { name: 'Mons Malapert', latitude: -85.97, longitude: 0.0 };

  const orbit = computeTransferOrbit({
    launchSite,
    moonTarget,
    profileId: 'low-energy',
  });

  assert.equal(orbit.profile.id, 'low-energy');
  // WSB transit is ~100 days
  assert.ok(orbit.transfer.transitDays >= 90);
});

test('getInterpolatedStateAtFrac interpolates coordinates and heading along flight path', () => {
  const orbit = computeTransferOrbit({
    launchSite: { latitude: 28.6, longitude: -80.6 },
    moonTarget: { latitude: 0, longitude: 0 },
    profileId: 'direct',
  });

  const startState = getInterpolatedStateAtFrac(orbit.waypoints, 0.0);
  assert.ok(startState);
  assert.ok(startState.distEarthKm < 10000, 'Start state should be near Earth');
  assert.ok(startState.velocityKmS > 10.0, 'TLI departure velocity should exceed 10 km/s');

  const midState = getInterpolatedStateAtFrac(orbit.waypoints, 0.5);
  assert.ok(midState);
  assert.ok(midState.distEarthKm > 100000, 'Mid-course should be over 100,000 km from Earth');

  const endState = getInterpolatedStateAtFrac(orbit.waypoints, 1.0);
  assert.ok(endState);
  assert.ok(endState.distMoonKm < 10000, 'End state should be near Moon');
});

test('formatTransitTime handles various durations correctly', () => {
  assert.equal(formatTransitTime(3600 + 120), '1h 2m');
  assert.equal(formatTransitTime(86400 * 3 + 3600 * 4 + 60 * 15), '3d 4h 15m');
  assert.ok(formatTransitTime(86400 * 100).includes('months'));
});

test('latLonToSphere3D converts coordinates to 3D Cartesian vectors', () => {
  const northPole = latLonToSphere3D(90, 0, 10);
  assert.ok(Math.abs(northPole.y - 10) < 1e-4, 'North pole Y should be +10');
  assert.ok(Math.abs(northPole.x) < 1e-4);
  assert.ok(Math.abs(northPole.z) < 1e-4);

  const southPole = latLonToSphere3D(-90, 0, 10);
  assert.ok(Math.abs(southPole.y - (-10)) < 1e-4, 'South pole Y should be -10');

  const equator = latLonToSphere3D(0, 0, 5);
  assert.ok(Math.abs(equator.y) < 1e-4, 'Equator Y should be 0');
  assert.ok(Math.abs(Math.hypot(equator.x, equator.z) - 5) < 1e-4, 'Radius should be 5');
});

test('computeTransferOrbit populates 3D waypoints for 3D viewport', () => {
  const orbit = computeTransferOrbit({
    launchSite: { latitude: 28.6, longitude: -80.6 },
    moonTarget: { latitude: -85.9, longitude: 0 },
    profileId: 'direct',
  });

  const p = orbit.waypoints[0];
  assert.ok(typeof p.x3d === 'number', 'x3d must be a number');
  assert.ok(typeof p.y3d === 'number', 'y3d must be a number');
  assert.ok(typeof p.z3d === 'number', 'z3d must be a number');

  const interpolated = getInterpolatedStateAtFrac(orbit.waypoints, 0.4);
  assert.ok(typeof interpolated.x3d === 'number');
  assert.ok(interpolated.dir3d && typeof interpolated.dir3d.x === 'number');
});

test('fetchJplMoonEphemeris retrieves ephemerides or falls back gracefully', async () => {
  const ephem = await fetchJplMoonEphemeris(new Date());
  assert.ok(ephem, 'Ephemeris result must be defined');
  assert.ok(ephem.rangeKm > 350000 && ephem.rangeKm < 410000, `Range should be ~384400 km, got ${ephem.rangeKm}`);
  assert.ok(ephem.source.length > 0);
  assert.ok(typeof ephem.lightTimeSec === 'number' && ephem.lightTimeSec > 1.0);
  assert.ok(LUNAR_ROCKETS.length >= 5, 'Should have curated lunar rockets');
});

test('Trajectory guarantees non-penetration of Earth and Moon in km and 3D space', () => {
  const profiles = ['direct', 'free-return', 'low-energy'];

  for (const profileId of profiles) {
    const orbit = computeTransferOrbit({
      launchSite: { latitude: 28.6083, longitude: -80.6041 },
      moonTarget: { latitude: 0.6741, longitude: 23.4730 },
      profileId,
      parkingAltKm: 185,
    });

    for (let i = 0; i < orbit.waypoints.length; i++) {
      const p = orbit.waypoints[i];

      // Physical Earth distance must exceed Earth's radius (6,371 km)
      assert.ok(
        p.distEarthKm >= EARTH_RADIUS_KM - 1.0,
        `${profileId} pt ${i} penetrates Earth! distEarthKm=${p.distEarthKm} < ${EARTH_RADIUS_KM}`
      );

      // Visual 3D distance from Earth center (0, 0, 0) must stay above atmosphere (Earth 3D radius = 3.0)
      const dEarth3D = Math.hypot(p.x3d, p.y3d, p.z3d);
      assert.ok(
        dEarth3D >= SCALE_3D.EARTH_RADIUS - 0.05,
        `${profileId} pt ${i} penetrates Earth 3D sphere! dEarth3D=${dEarth3D} < ${SCALE_3D.EARTH_RADIUS}`
      );

      // Physical Moon distance must not penetrate lunar surface (1,737.4 km)
      assert.ok(
        p.distMoonKm >= MOON_RADIUS_KM - 1.0,
        `${profileId} pt ${i} penetrates Moon! distMoonKm=${p.distMoonKm} < ${MOON_RADIUS_KM}`
      );

      // Visual 3D distance from Moon center
      const targetMoon3d = {
        x: SCALE_3D.DISTANCE * Math.cos(0.09),
        y: SCALE_3D.DISTANCE * Math.sin(0.09) * 0.4,
        z: SCALE_3D.DISTANCE * Math.sin(0.09) * 0.8,
      };
      const dMoon3D = Math.hypot(p.x3d - targetMoon3d.x, p.y3d - targetMoon3d.y, p.z3d - targetMoon3d.z);
      assert.ok(
        dMoon3D >= SCALE_3D.MOON_RADIUS - 0.05,
        `${profileId} pt ${i} penetrates Moon 3D sphere! dMoon3D=${dMoon3D} < ${SCALE_3D.MOON_RADIUS}`
      );
    }
  }
});

test('Free-Return circumlunar trajectory executes smooth far-side hyperbolic flyby and rounded perigee loop', () => {
  const orbit = computeTransferOrbit({
    launchSite: { latitude: 28.6083, longitude: -80.6041 },
    moonTarget: { latitude: 0.6741, longitude: 23.4730 },
    profileId: 'free-return',
    parkingAltKm: 185,
  });

  // Verify perilune is on Moon's far side (x > 1.0 in normalized coordinates)
  const farSidePoints = orbit.waypoints.filter((p) => p.x > 1.0 && p.phase === 'lunar-approach');
  assert.ok(farSidePoints.length > 0, 'Must have far-side hyperbolic flyby points with x > 1.0');

  // Verify return leg points exist and head back toward Earth
  const returnPoints = orbit.waypoints.filter((p) => p.phase === 'return');
  assert.ok(returnPoints.length > 20, 'Free-return must contain return leg points');

  // Verify smooth curvature: no sharp V-cusps (consecutive tangent angle change < 45 degrees)
  for (let i = 1; i < orbit.waypoints.length; i++) {
    const pPrev = orbit.waypoints[i - 1];
    const pCurr = orbit.waypoints[i];
    if (pPrev.dir3d && pCurr.dir3d) {
      const dot = pPrev.dir3d.x * pCurr.dir3d.x + pPrev.dir3d.y * pCurr.dir3d.y + pPrev.dir3d.z * pCurr.dir3d.z;
      // Clamped dot product
      const angleDeg = Math.acos(Math.max(-1, Math.min(1, dot))) * (180 / Math.PI);
      assert.ok(
        angleDeg < 45,
        `Angular kink detected between waypoints ${i - 1} and ${i}: ${angleDeg.toFixed(1)}°`
      );
    }
  }
});

test('sampleCatmullRomSpline generates smooth interpolated points', () => {
  const control = [
    { x: 0, y: 0, z: 0, vx: 1, vy: 0 },
    { x: 10, y: 5, z: 2, vx: 0.8, vy: 0.2 },
    { x: 20, y: 0, z: -1, vx: 0.7, vy: -0.3 },
    { x: 30, y: -5, z: 0, vx: 0.6, vy: -0.1 },
  ];

  const sampled = sampleCatmullRomSpline(control, 50);
  assert.equal(sampled.length, 50);
  assert.ok(Math.abs(sampled[0].x - control[0].x) < 1e-3);
  assert.ok(Math.abs(sampled[sampled.length - 1].x - control[control.length - 1].x) < 1e-3);
});

test('Direct Transfer TLI departure has strict C1 tangency and seamless perilune insertion', () => {
  const orbit = computeTransferOrbit({
    launchSite: { latitude: 28.6083, longitude: -80.6041 },
    moonTarget: { latitude: 0.6741, longitude: 23.4730 },
    profileId: 'direct',
    parkingAltKm: 185,
    lunarOrbitAltKm: 100,
  });

  // 1. Verify no sharp kinks in Direct Transfer
  for (let i = 1; i < orbit.waypoints.length; i++) {
    const pPrev = orbit.waypoints[i - 1];
    const pCurr = orbit.waypoints[i];
    if (pPrev.dir3d && pCurr.dir3d) {
      const dot = pPrev.dir3d.x * pCurr.dir3d.x + pPrev.dir3d.y * pCurr.dir3d.y + pPrev.dir3d.z * pCurr.dir3d.z;
      const angleDeg = Math.acos(Math.max(-1, Math.min(1, dot))) * (180 / Math.PI);
      assert.ok(
        angleDeg < 35,
        `Direct transfer angular kink between waypoints ${i - 1} and ${i}: ${angleDeg.toFixed(1)}°`
      );
    }
  }

  // 2. Check LOI arrival distance matches lunar circular orbit radius (1,737.4 + 100 = 1,837.4 km)
  const loiWaypoints = orbit.waypoints.filter((p) => p.phase === 'loi');
  assert.ok(loiWaypoints.length > 0, 'Must have LOI phase waypoints');
  for (const p of loiWaypoints) {
    assert.ok(
      Math.abs(p.distMoonKm - 1837.4) < 1.0,
      `LOI waypoints must circularize at 100 km orbit (~1837.4 km), got ${p.distMoonKm}`
    );
  }

  // 3. Check powered descent reaches target site without penetrating lunar surface
  const descentWaypoints = orbit.waypoints.filter((p) => p.phase === 'descent');
  assert.ok(descentWaypoints.length > 0, 'Must have descent phase waypoints');
  const touchdown = descentWaypoints[descentWaypoints.length - 1];
  assert.ok(touchdown.distMoonKm >= MOON_RADIUS_KM - 0.5, 'Descent must end on lunar surface');
});

test('Trajectory milestones cover all key events across flight regimes', () => {
  const profiles = ['direct', 'free-return', 'low-energy'];

  for (const profileId of profiles) {
    const orbit = computeTransferOrbit({
      launchSite: { latitude: 28.6083, longitude: -80.6041 },
      moonTarget: { latitude: 0.6741, longitude: 23.4730 },
      profileId,
    });

    assert.ok(orbit.milestones && orbit.milestones.length >= 4, `${profileId} must have at least 4 milestones`);
    const milestoneIds = orbit.milestones.map((m) => m.id);
    assert.ok(milestoneIds.includes('tli'), `${profileId} must include TLI`);
    assert.ok(milestoneIds.includes('mcc1'), `${profileId} must include MCC-1`);

    if (profileId === 'direct') {
      assert.ok(milestoneIds.includes('loi'), 'Direct must include LOI');
      assert.ok(milestoneIds.includes('touchdown'), 'Direct must include Touchdown');
    } else if (profileId === 'free-return') {
      assert.ok(milestoneIds.includes('perilune'), 'Free-return must include Perilune');
      assert.ok(milestoneIds.includes('entry'), 'Free-return must include Entry Interface');
    } else if (profileId === 'low-energy') {
      assert.ok(milestoneIds.includes('wsb-peak'), 'Low-energy must include WSB peak');
      assert.ok(milestoneIds.includes('capture'), 'Low-energy must include Ballistic Capture');
    }

    // Every milestone must have valid telemetry
    for (const m of orbit.milestones) {
      assert.ok(typeof m.t === 'number', `${m.id} must have numeric t`);
      assert.ok(typeof m.velocityKmS === 'number' && m.velocityKmS > 0, `${m.id} must have positive velocity`);
      assert.ok(typeof m.distEarthKm === 'number' && m.distEarthKm >= 6371, `${m.id} distEarth >= 6371`);
      assert.ok(typeof m.distMoonKm === 'number' && m.distMoonKm >= 1737, `${m.id} distMoon >= 1737`);
      assert.ok(typeof m.x === 'number' && typeof m.y === 'number', `${m.id} must have normalized coordinates`);
      assert.ok(typeof m.x3d === 'number' && typeof m.y3d === 'number' && typeof m.z3d === 'number', `${m.id} must have 3d coordinates`);
    }
  }
});

test('2D trajectory projection outputs synchronized data for synodic and sun-earth-wsb frames', () => {
  // Test Synodic Frame (Direct & Free-Return)
  const synodicOrbit = computeTransferOrbit({
    launchSite: { latitude: 28.6083, longitude: -80.6041 },
    moonTarget: { latitude: 0.6741, longitude: 23.4730 },
    profileId: 'free-return',
  });
  const projSyn = synodicOrbit.projection2d;
  assert.equal(projSyn.frameType, 'synodic');
  assert.ok(projSyn.paths.outbound.startsWith('M'));
  assert.ok(projSyn.paths.encounter.startsWith('M'));
  assert.ok(projSyn.paths.return.startsWith('M'));
  assert.ok(projSyn.earth.radius > 0);
  assert.ok(projSyn.moon.radius > 0);
  assert.ok(projSyn.milestones.length >= 4);

  // Test Sun-Earth WSB Frame (Low-Energy)
  const bltOrbit = computeTransferOrbit({
    launchSite: { latitude: 28.6083, longitude: -80.6041 },
    moonTarget: { latitude: 0.6741, longitude: 23.4730 },
    profileId: 'low-energy',
  });
  const projBlt = bltOrbit.projection2d;
  assert.equal(projBlt.frameType, 'sun-earth-wsb');
  assert.ok(projBlt.paths.outbound.startsWith('M'));
  assert.ok(projBlt.paths.turnaround.startsWith('M'));
  assert.ok(projBlt.paths.capture.startsWith('M'));
  assert.ok(projBlt.moonOrbit && projBlt.moonOrbit.rx > 0);
  assert.ok(projBlt.lagrangeL1 && projBlt.lagrangeL1.x > 0);
  assert.ok(projBlt.lagrangeL2 && projBlt.lagrangeL2.x > 0);
  assert.ok(projBlt.sunIndicator && projBlt.sunIndicator.label === 'To Sun');
  assert.ok(projBlt.milestones.length >= 4);
});



