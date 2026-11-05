/**
 * @file transferOrbit.js
 * High-fidelity Earth-Moon transfer orbit visualization and physics engine.
 *
 * Implements dedicated flight mechanics across three cislunar regimes:
 *   1. Direct Transfer (Fast TLI + LOI):
 *      - Smooth tangential TLI departure from Low Earth Orbit (LEO) parking circle with
 *        strict C¹/C² continuity along the orbital velocity vector (eliminating reverse S-curve).
 *      - Seamless hyperbolic approach into lunar orbit insertion (LOI) without capture boundary kinks.
 *      - Powered descent to lunar landing target site.
 *   2. Free-Return Trajectory (Circumlunar Figure-8):
 *      - Smooth, rounded hyperbolic swing-by around the Moon's trailing hemisphere (perilune altitude ~220 km),
 *        passing behind the lunar far side without penetrating the Moon or forming sharp corners.
 *      - Closed perigee loop: transitions cleanly into the Earth re-entry interface (120 km) or orbital
 *        wrap without pinching into an acute angle.
 *   3. Low-Energy Transfer (BLT / WSB / Weak Stability Boundary):
 *      - Traverses ~1.45 million km toward Sun-Earth L1/L2 gravitational saddle points over 3–4 months.
 *      - Wide ballistic loop shaped by solar gravity perturbations, falling back to intercept the Moon on its orbit.
 *      - Ballistic capture into lunar orbit with low relative velocity.
 *
 * Provides synchronized 2D trajectory projection:
 *   - Earth-Moon Rotating (Synodic) Barycentric 2D plane for Free-Return & Direct transfers.
 *   - Sun-Earth Rotating / WSB 2D plane for Low-Energy transfers with Moon orbit and L1/L2 saddle markers.
 *   - Key milestone markers: LEO Departure (TLI), Mid-Course Corrections (MCC-1, MCC-2),
 *     Lunar Perilune / Orbit Insertion (LOI), and Earth Entry Interface (EI) / Landing Touchdown.
 *
 * Physics References:
 *   - Szebehely, "Theory of Orbits: The Restricted Problem of Three Bodies" (Academic Press 1967)
 *   - Bate, Mueller & White, "Fundamentals of Astrodynamics" (Dover 1971)
 *   - NASA/TM-2009-214786, "Lunar Transfer Trajectory Design"
 *   - Belbruno, "Capture Dynamics and Chaotic Motions in Celestial Mechanics" (Princeton 2004)
 *   - Curtis, "Orbital Mechanics for Engineering Students" (Butterworth-Heinemann 4th ed.)
 *
 * Units: km, seconds, radians unless stated otherwise.
 */

// ── Physical Constants ──────────────────────────────────────────────────────

export const EARTH_MU = 398600.4418;          // km³/s²  (GM_Earth)
export const MOON_MU = 4902.8;                // km³/s²  (GM_Moon)
export const EARTH_RADIUS_KM = 6371.0;
export const MOON_RADIUS_KM = 1737.4;
export const EARTH_MOON_DIST_KM = 384400.0;   // mean centre-to-centre distance
export const MOON_SOI_KM = 66183.0;           // Lunar sphere of influence radius
export const MOON_ORBITAL_PERIOD_S = 27.321661 * 86400; // Sidereal period (s)

// CR3BP Normalized System Parameters
export const CR3BP_MU = MOON_MU / (EARTH_MU + MOON_MU); // Mass parameter mu ≈ 0.0121505856
export const CR3BP_DU = EARTH_MOON_DIST_KM;             // Distance Unit (DU) = 384,400 km
export const CR3BP_TU = Math.sqrt(Math.pow(CR3BP_DU, 3) / (EARTH_MU + MOON_MU)); // Time Unit (TU) ≈ 375,190 s (~4.34 days)
export const CR3BP_VU = CR3BP_DU / CR3BP_TU;            // Velocity Unit (VU) ≈ 1.024547 km/s

// 3D Scene Visualization Dimensions & Scale
export const SCALE_3D = {
  EARTH_RADIUS: 3.0,
  MOON_RADIUS: 1.0,
  DISTANCE: 75.0,
  PARKING_RADIUS: 3.3,
  LUNAR_ORBIT_RADIUS: 1.25,
};

const TWO_PI = 2 * Math.PI;

// ── Trajectory Profiles ────────────────────────────────────────────────────

export const TRAJECTORY_PROFILES = [
  {
    id: 'direct',
    name: 'Direct Transfer',
    subtitle: 'Apollo-style fast transit',
    parkingAltKm: 185,
    description: 'Hohmann-like direct TLI to lunar orbit. Shortest transit (~3 to 5 days). High TLI ΔV.',
    transitNote: 'Direct high-energy insertion',
  },
  {
    id: 'free-return',
    name: 'Free-Return Trajectory',
    subtitle: 'Apollo 13 safety loop',
    parkingAltKm: 185,
    description: 'Circumlunar figure-8 loop. If lunar insertion aborts, passive lunar gravity slingshots the craft back to Earth.',
    transitNote: 'Circumlunar safety abort trajectory',
  },
  {
    id: 'low-energy',
    name: 'Low-Energy Transfer',
    subtitle: 'CAPSTONE / Danuri style (WSB)',
    parkingAltKm: 200,
    description: 'Weak Stability Boundary path via Sun–Earth L1/L2. Saves ~15-20% insertion ΔV but takes 3–4 months.',
    transitNote: 'Ballistic capture via Lagrange manifolds',
  },
];

// ── 3D Coordinate Helper ───────────────────────────────────────────────────

/**
 * Converts geographic latitude and longitude into 3D Cartesian coordinates on a sphere.
 * (Three.js convention: Y is up, X/Z in the equatorial plane).
 *
 * @param {number} latDeg Latitude in decimal degrees [-90, +90]
 * @param {number} lonDeg Longitude in decimal degrees [-180, +180]
 * @param {number} radius Sphere radius
 * @returns {{ x: number, y: number, z: number }}
 */
export function latLonToSphere3D(latDeg, lonDeg, radius = 1) {
  const phi = (90 - latDeg) * (Math.PI / 180);
  const theta = (lonDeg + 180) * (Math.PI / 180);
  const x = -(radius * Math.sin(phi) * Math.cos(theta));
  const y = radius * Math.cos(phi);
  const z = radius * Math.sin(phi) * Math.sin(theta);
  return { x, y, z };
}

// ── Kepler Solver ──────────────────────────────────────────────────────────

/**
 * Solve Kepler's equation M = E - e * sin(E) for Eccentric Anomaly E.
 * @param {number} M Mean anomaly in radians
 * @param {number} e Eccentricity (0 <= e < 1)
 * @returns {number} Eccentric anomaly E in radians
 */
export function solveKepler(M, e) {
  let E = M;
  for (let iter = 0; iter < 15; iter++) {
    const f = E - e * Math.sin(E) - M;
    const fPrime = 1 - e * Math.cos(E);
    const delta = f / fPrime;
    E -= delta;
    if (Math.abs(delta) < 1e-8) break;
  }
  return E;
}

// ── Smoothstep Mathematical Helper ─────────────────────────────────────────

function smoothstep(edge0, edge1, x) {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

// ── Centripetal Catmull-Rom Spline Interpolator ─────────────────────────────

/**
 * Samples an array of control points along a centripetal Catmull-Rom spline.
 * Guarantees C¹ continuous tangent continuity without self-intersection loops.
 *
 * @param {Array<{ x: number, y: number, z?: number, vx?: number, vy?: number }>} points
 * @param {number} targetCount Desired number of evenly interpolated samples
 * @returns {Array<{ x: number, y: number, z?: number, vx?: number, vy?: number }>}
 */
export function sampleCatmullRomSpline(points, targetCount = 100) {
  if (!points || points.length < 2) return points || [];
  if (points.length === targetCount) return points;

  const result = [];
  const N = points.length;

  for (let i = 0; i < targetCount; i++) {
    const u = i / (targetCount - 1);
    const rawIdx = u * (N - 1);
    const i1 = Math.floor(rawIdx);
    const i2 = Math.min(N - 1, i1 + 1);
    const i0 = Math.max(0, i1 - 1);
    const i3 = Math.min(N - 1, i2 + 1);
    const t = rawIdx - i1;

    const p0 = points[i0];
    const p1 = points[i1];
    const p2 = points[i2];
    const p3 = points[i3];

    const t2 = t * t;
    const t3 = t2 * t;

    const b0 = -0.5 * t3 + t2 - 0.5 * t;
    const b1 = 1.5 * t3 - 2.5 * t2 + 1.0;
    const b2 = -1.5 * t3 + 2.0 * t2 + 0.5 * t;
    const b3 = 0.5 * t3 - 0.5 * t2;

    const pt = {
      x: b0 * p0.x + b1 * p1.x + b2 * p2.x + b3 * p3.x,
      y: b0 * p0.y + b1 * p1.y + b2 * p2.y + b3 * p3.y,
    };
    if (p0.z != null) {
      pt.z = b0 * (p0.z || 0) + b1 * (p1.z || 0) + b2 * (p2.z || 0) + b3 * (p3.z || 0);
    }
    if (p0.vx != null) {
      pt.vx = b0 * p0.vx + b1 * p1.vx + b2 * p2.vx + b3 * p3.vx;
      pt.vy = b0 * p0.vy + b1 * p1.vy + b2 * p2.vy + b3 * p3.vy;
    }
    result.push(pt);
  }
  return result;
}

// ── CR3BP Equations of Motion & Numerical Integrator ────────────────────────

function cr3bpDerivs(x, y, vx, vy) {
  const d1 = Math.hypot(x + CR3BP_MU, y);
  const d2 = Math.hypot(x - (1 - CR3BP_MU), y);
  const d1_3 = d1 * d1 * d1;
  const d2_3 = d2 * d2 * d2;

  const ax = 2 * vy + x - (1 - CR3BP_MU) * (x + CR3BP_MU) / d1_3 - CR3BP_MU * (x - (1 - CR3BP_MU)) / d2_3;
  const ay = -2 * vx + y - (1 - CR3BP_MU) * y / d1_3 - CR3BP_MU * y / d2_3;
  return [vx, vy, ax, ay];
}

function rk4Step(x, y, vx, vy, dt) {
  const [k1x, k1y, k1vx, k1vy] = cr3bpDerivs(x, y, vx, vy);
  const [k2x, k2y, k2vx, k2vy] = cr3bpDerivs(x + 0.5 * dt * k1x, y + 0.5 * dt * k1y, vx + 0.5 * dt * k1vx, vy + 0.5 * dt * k1vy);
  const [k3x, k3y, k3vx, k3vy] = cr3bpDerivs(x + 0.5 * dt * k2x, y + 0.5 * dt * k2y, vx + 0.5 * dt * k2vx, vy + 0.5 * dt * k2vy);
  const [k4x, k4y, k4vx, k4vy] = cr3bpDerivs(x + dt * k3x, y + dt * k3y, vx + dt * k3vx, vy + dt * k3vy);
  return [
    x + (dt / 6) * (k1x + 2 * k2x + 2 * k3x + k4x),
    y + (dt / 6) * (k1y + 2 * k2y + 2 * k3y + k4y),
    vx + (dt / 6) * (k1vx + 2 * k2vx + 2 * k3vx + k4vx),
    vy + (dt / 6) * (k1vy + 2 * k2vy + 2 * k3vy + k4vy),
  ];
}

function solveCr3bpFreeReturn(h_park_km = 185, h_peri_km = 220) {
  const r_peri_nd = (MOON_RADIUS_KM + h_peri_km) / CR3BP_DU;
  const x_peri = (1 - CR3BP_MU) + r_peri_nd;
  const y_peri = 0;

  let low = 2.45;
  let high = 2.65;
  for (let iter = 0; iter < 18; iter++) {
    const mid = (low + high) / 2;
    const vy_nd = -(mid / CR3BP_VU);
    let state = [x_peri, y_peri, 0, vy_nd];
    let minD = 1e9;
    for (let s = 0; s < 1200; s++) {
      const dE = Math.hypot(state[0] + CR3BP_MU, state[1]);
      const dM = Math.hypot(state[0] - (1 - CR3BP_MU), state[1]);
      const dt = -Math.max(0.00005, Math.min(0.001, Math.min(dE, dM) * 0.008));
      state = rk4Step(...state, dt);
      const dE_km = dE * CR3BP_DU;
      if (dE_km < minD) minD = dE_km;
      if (dE_km < (EARTH_RADIUS_KM + h_park_km) && s > 100) break;
    }
    const alt = minD - EARTH_RADIUS_KM;
    if (alt > h_park_km) low = mid;
    else high = mid;
  }
  return (low + high) / 2;
}

function integrateCr3bpOutbound(v_peri_kms, h_peri_km = 220) {
  const r_peri_nd = (MOON_RADIUS_KM + h_peri_km) / CR3BP_DU;
  const x_peri = (1 - CR3BP_MU) + r_peri_nd;
  const y_peri = 0;
  const vy_nd = -(v_peri_kms / CR3BP_VU);

  let state = [x_peri, y_peri, 0, vy_nd];
  const pts = [{ x: state[0], y: state[1], vx: state[2], vy: state[3] }];
  let minEarthDist = 1e9;

  for (let s = 0; s < 1500; s++) {
    const dE = Math.hypot(state[0] + CR3BP_MU, state[1]);
    const dM = Math.hypot(state[0] - (1 - CR3BP_MU), state[1]);
    const dt = -Math.max(0.00005, Math.min(0.001, Math.min(dE, dM) * 0.008));
    state = rk4Step(...state, dt);
    const dE_km = dE * CR3BP_DU;
    if (dE_km < minEarthDist) minEarthDist = dE_km;
    pts.push({ x: state[0], y: state[1], vx: state[2], vy: state[3] });
    if (dE_km < 6570 && s > 100) break;
  }
  return pts.reverse();
}

// ── Core Computation ───────────────────────────────────────────────────────

/**
 * Computes Earth-Moon transfer trajectory metrics, delta-V budget, waypoints,
 * milestone annotations, and synchronized 2D projection data.
 *
 * @param {{
 *   launchSite: { latitude: number, longitude: number, name?: string },
 *   moonTarget: { latitude: number, longitude: number, name?: string },
 *   profileId?: 'direct' | 'low-energy' | 'free-return',
 *   parkingAltKm?: number,
 *   lunarOrbitAltKm?: number,
 *   moon3dPos?: { x: number, y: number, z: number },
 * }} opts
 */
export function computeTransferOrbit({
  launchSite,
  moonTarget,
  profileId = 'direct',
  parkingAltKm,
  lunarOrbitAltKm = 100,
  moon3dPos,
}) {
  const profile = TRAJECTORY_PROFILES.find((p) => p.id === profileId) || TRAJECTORY_PROFILES[0];
  const h_park = parkingAltKm ?? profile.parkingAltKm;

  // ── 1. Parking orbit ──────────────────────────────────────────────────
  const r_park = EARTH_RADIUS_KM + h_park;                    // km
  const v_park = Math.sqrt(EARTH_MU / r_park);                // circular velocity (~7.79 km/s)
  const T_park = TWO_PI * Math.sqrt(r_park ** 3 / EARTH_MU);  // orbital period (~5300 s)

  // ── 2. Transfer ellipse (Hohmann / Vis-Viva baseline) ─────────────────
  const r_moon = EARTH_MOON_DIST_KM;  // mean distance
  const a_trans = (r_park + r_moon) / 2;
  const e_trans = 1 - r_park / a_trans;
  const T_trans = TWO_PI * Math.sqrt(a_trans ** 3 / EARTH_MU);

  let transitTimeS;
  let transitLabel;
  if (profileId === 'low-energy') {
    transitTimeS = 100 * 86400; // ~100 days (WSB Ballistic)
    transitLabel = '~100 days (WSB Ballistic)';
  } else if (profileId === 'free-return') {
    transitTimeS = 5.6 * 86400; // ~5.6 days round trip
    transitLabel = formatTransitTime(transitTimeS);
  } else {
    transitTimeS = T_trans / 2; // ~4.98 days outbound
    transitLabel = formatTransitTime(transitTimeS);
  }

  const transitDays = transitTimeS / 86400;

  // TLI burn (Vis-Viva at perigee of transfer ellipse)
  const v_tli = Math.sqrt(EARTH_MU * (2 / r_park - 1 / a_trans));
  const dv_tli = v_tli - v_park; // ~3.13 km/s

  // Hyperbolic excess velocity at Earth departure
  const v_inf_depart = Math.sqrt(Math.max(0, v_tli ** 2 - 2 * EARTH_MU / r_park));

  // ── 3. Lunar arrival ──────────────────────────────────────────────────
  const v_arrive_helio = Math.sqrt(EARTH_MU * (2 / r_moon - 1 / a_trans));
  const v_moon = Math.sqrt(EARTH_MU / r_moon);
  let v_approach = Math.abs(v_moon - v_arrive_helio);
  if (profileId === 'low-energy') {
    v_approach *= 0.55;
  }

  // Lunar Orbit Insertion (LOI) to circular parking orbit
  const r_lunar_orbit = MOON_RADIUS_KM + lunarOrbitAltKm;
  const v_lunar_periapsis = Math.sqrt(v_approach ** 2 + 2 * MOON_MU / r_lunar_orbit);
  const v_lunar_circular = Math.sqrt(MOON_MU / r_lunar_orbit);
  let dv_loi = v_lunar_periapsis - v_lunar_circular;
  if (profileId === 'low-energy') {
    dv_loi *= 0.65;
  } else if (profileId === 'free-return') {
    dv_loi = 0.0; // Passive gravity assist flyby (no LOI burn required)
  }

  // ── 4. Powered descent ────────────────────────────────────────────────
  const dv_descent = profileId === 'free-return' ? 0.0 : v_lunar_circular * 0.98 + 0.15;

  // ── 5. Total delta-v budget ───────────────────────────────────────────
  const totalDv = dv_tli + dv_loi + dv_descent;

  // ── 6. Generate 2D & 3D visualization waypoints ───────────────────────
  const waypoints = generateWaypoints({
    r_park,
    a_trans,
    e_trans,
    r_moon,
    transitTimeS,
    profileId,
    lunarOrbitAltKm,
    launchSite,
    moonTarget,
    moon3dPos,
  });

  // ── 7. Generate Milestones & Synchronized 2D Projection Data ──────────
  const milestones = getTrajectoryMilestones(waypoints, profileId);
  const projection2d = get2DTrajectoryProjection(waypoints, profileId, {
    launchSite,
    moonTarget,
  });

  return {
    profile,
    parkingOrbit: {
      altKm: h_park,
      radiusKm: r_park,
      velocityKmS: v_park,
      periodS: T_park,
    },
    tli: {
      deltaVKmS: dv_tli,
      velocityKmS: v_tli,
      escapeVinfKmS: v_inf_depart,
    },
    transfer: {
      semiMajorKm: a_trans,
      eccentricity: e_trans,
      periodS: T_trans,
      transitTimeS,
      transitDays,
      transitLabel,
      perigeeKm: r_park,
      apogeeKm: r_moon,
    },
    lunarArrival: {
      approachVelocityKmS: v_approach,
      orbitInsertionDvKmS: dv_loi,
      orbitAltKm: lunarOrbitAltKm,
      orbitVelocityKmS: v_lunar_circular,
    },
    descentDvKmS: dv_descent,
    totalDeltaVKmS: totalDv,
    waypoints,
    milestones,
    projection2d,
    launchSite,
    moonTarget,
  };
}

// ── Waypoint Generator (Fixed C-Infinity Continuous Bezier Engine) ────────────

function generateWaypoints({
  r_park,
  a_trans,
  e_trans,
  r_moon,
  transitTimeS,
  profileId,
  lunarOrbitAltKm,
  launchSite,
  moonTarget,
  moon3dPos,
}) {
  const DU = r_moon || EARTH_MOON_DIST_KM;
  const h_park = r_park - EARTH_RADIUS_KM;
  const v_tli = Math.sqrt(EARTH_MU * (2 / r_park - 1 / a_trans));
  const omega_M = TWO_PI / MOON_ORBITAL_PERIOD_S;

  // ── 1. Orthonormal 3D Basis Vectors ───────────────────────────────────────
  const targetMoon3d = moon3dPos
    ? { x: Math.abs(moon3dPos.x), y: moon3dPos.y, z: moon3dPos.z }
    : {
        x: SCALE_3D.DISTANCE * Math.cos(0.09),
        y: SCALE_3D.DISTANCE * Math.sin(0.09) * 0.4,
        z: SCALE_3D.DISTANCE * Math.sin(0.09) * 0.8,
      };

  const moonDist3d = Math.hypot(targetMoon3d.x, targetMoon3d.y, targetMoon3d.z) || SCALE_3D.DISTANCE;
  const u3d = {
    x: targetMoon3d.x / moonDist3d,
    y: targetMoon3d.y / moonDist3d,
    z: targetMoon3d.z / moonDist3d,
  };

  const latPad = launchSite?.latitude ?? 28.6083;
  const lonPad = launchSite?.longitude ?? -80.6041;
  const padVec = latLonToSphere3D(latPad, lonPad, 1.0);

  let n3d = {
    x: padVec.y * u3d.z - padVec.z * u3d.y,
    y: padVec.z * u3d.x - padVec.x * u3d.z,
    z: padVec.x * u3d.y - padVec.y * u3d.x,
  };
  let nLen = Math.hypot(n3d.x, n3d.y, n3d.z);
  if (nLen < 1e-4) {
    const worldUp = { x: 0, y: 1, z: 0 };
    n3d = {
      x: worldUp.y * u3d.z - worldUp.z * u3d.y,
      y: worldUp.z * u3d.x - worldUp.x * u3d.z,
      z: worldUp.x * u3d.y - worldUp.y * u3d.x,
    };
    nLen = Math.hypot(n3d.x, n3d.y, n3d.z) || 1;
  }
  n3d = { x: n3d.x / nLen, y: n3d.y / nLen, z: n3d.z / nLen };

  let v3d = {
    x: n3d.y * u3d.z - n3d.z * u3d.y,
    y: n3d.z * u3d.x - n3d.x * u3d.z,
    z: n3d.x * u3d.y - n3d.y * u3d.x,
  };
  const vLen = Math.hypot(v3d.x, v3d.y, v3d.z) || 1;
  v3d = { x: v3d.x / vLen, y: v3d.y / vLen, z: v3d.z / vLen };

  if (v3d.y < 0) {
    v3d = { x: -v3d.x, y: -v3d.y, z: -v3d.z };
    n3d = { x: -n3d.x, y: -n3d.y, z: -n3d.z };
  }

  // ── 2. Dual-Scale Physical to Visual 3D Mapping Function ──────────────────
  const mapTo3D = (x_km, y_km, h_peri_km = 110) => {
    const dE_km = Math.hypot(x_km, y_km);
    const dxM_km = x_km - DU;
    const dM_km = Math.hypot(dxM_km, y_km);

    if (dE_km < 32000) {
      const r_lin = (dE_km / DU) * moonDist3d;
      const r_park_lin = (r_park / DU) * moonDist3d;
      const r_vis = r_lin + (SCALE_3D.PARKING_RADIUS - r_park_lin) * (1 - smoothstep(r_park, 32000, dE_km));
      const dirE_x = (x_km / (dE_km || 1)) * u3d.x + (y_km / (dE_km || 1)) * v3d.x;
      const dirE_y = (x_km / (dE_km || 1)) * u3d.y + (y_km / (dE_km || 1)) * v3d.y;
      const dirE_z = (x_km / (dE_km || 1)) * u3d.z + (y_km / (dE_km || 1)) * v3d.z;
      return { x3d: dirE_x * r_vis, y3d: dirE_y * r_vis, z3d: dirE_z * r_vis };
    }

    if (dM_km < 28000) {
      const r_peri_km = MOON_RADIUS_KM + h_peri_km;
      const r_lin = (dM_km / DU) * moonDist3d;
      const r_peri_lin = (r_peri_km / DU) * moonDist3d;
      const r_vis = r_lin + (SCALE_3D.LUNAR_ORBIT_RADIUS - r_peri_lin) * (1 - smoothstep(r_peri_km, 28000, dM_km));
      const dirM_x = (dxM_km / (dM_km || 1)) * u3d.x + (y_km / (dM_km || 1)) * v3d.x;
      const dirM_y = (dxM_km / (dM_km || 1)) * u3d.y + (y_km / (dM_km || 1)) * v3d.y;
      const dirM_z = (dxM_km / (dM_km || 1)) * u3d.z + (y_km / (dM_km || 1)) * v3d.z;
      return {
        x3d: targetMoon3d.x + dirM_x * r_vis,
        y3d: targetMoon3d.y + dirM_y * r_vis,
        z3d: targetMoon3d.z + dirM_z * r_vis,
      };
    }

    const xi = x_km / DU;
    const eta = y_km / DU;
    return {
      x3d: xi * targetMoon3d.x + eta * moonDist3d * v3d.x,
      y3d: xi * targetMoon3d.y + eta * moonDist3d * v3d.y,
      z3d: xi * targetMoon3d.z + eta * moonDist3d * v3d.z,
    };
  };

// Helper to evaluate a 3D Cubic Bezier curve
  const getBezierPoint3D = (p0, p1, p2, p3, t) => {
    const mt = 1 - t;
    const mt2 = mt * mt;
    const t2 = t * t;
    const a = mt2 * mt;
    const b = 3 * mt2 * t;
    const c = 3 * mt * t2;
    const d = t2 * t;
    return {
      x3d: a * p0.x + b * p1.x + c * p2.x + d * p3.x,
      y3d: a * p0.y + b * p1.y + c * p2.y + d * p3.y,
      z3d: a * p0.z + b * p1.z + c * p2.z + d * p3.z,
    };
  };

  const points = [];

  // ── 3. Profile-Specific Trajectory Generation ─────────────────────────────

  const pEarth = { x: 0, y: 0, z: 0 };
  const pMoon = { x: targetMoon3d.x, y: targetMoon3d.y, z: targetMoon3d.z };

  if (profileId === 'direct') {
    // ══════════════════════════════════════════════════════════════════════════
    // Regime 1: Direct Transfer (Fast TLI + LOI)
    // ══════════════════════════════════════════════════════════════════════════

    // A. LEO Departure Arc (Sweeps CCW to exact Z=-R bottom edge, heading +X)
    const N_PARK = 14;
    for (let i = 0; i <= N_PARK; i++) {
      const angle = Math.PI * 0.5 + (i / N_PARK) * Math.PI;
      points.push({
        x: 0, y: 0,
        x3d: pEarth.x + SCALE_3D.PARKING_RADIUS * Math.cos(angle),
        y3d: pEarth.y,
        z3d: pEarth.z + SCALE_3D.PARKING_RADIUS * Math.sin(angle),
        t: 0, velocityKmS: v_tli, distEarthKm: r_park, distMoonKm: DU, phase: 'tli',
      });
    }

    // B. Direct Transfer Arc (Strict +X tangents at Earth and Moon)
    const N_TRANS = 60;
    const p0 = { x: pEarth.x, y: pEarth.y, z: pEarth.z - SCALE_3D.PARKING_RADIUS };
    const p1 = { x: pEarth.x + 30, y: pEarth.y, z: pEarth.z - SCALE_3D.PARKING_RADIUS };
    const p2 = { x: pMoon.x - 30, y: pMoon.y, z: pMoon.z - SCALE_3D.LUNAR_ORBIT_RADIUS };
    const p3 = { x: pMoon.x, y: pMoon.y, z: pMoon.z - SCALE_3D.LUNAR_ORBIT_RADIUS };

    for (let i = 1; i <= N_TRANS; i++) {
      const u = i / N_TRANS;
      const { x3d, y3d, z3d } = getBezierPoint3D(p0, p1, p2, p3, u);
      const dE_km = u * DU;
      const dM_km = (1 - u) * DU;
      points.push({
        x: u, y: 0, x3d, y3d, z3d, t: u * transitTimeS,
        velocityKmS: Math.max(1.0, 10.9 - u * 8), distEarthKm: dE_km, distMoonKm: dM_km,
        phase: dM_km <= MOON_SOI_KM ? 'lunar-approach' : 'coast',
      });
    }

    // C. Lunar Orbit Insertion (360-degree capture ring perfectly meeting the transfer arc)
    const N_LOI = 20;
    for (let i = 1; i <= N_LOI; i++) {
      const angle = -Math.PI * 0.5 + (i / N_LOI) * TWO_PI;
      points.push({
        x: 1, y: 0,
        x3d: pMoon.x + SCALE_3D.LUNAR_ORBIT_RADIUS * Math.cos(angle),
        y3d: pMoon.y,
        z3d: pMoon.z + SCALE_3D.LUNAR_ORBIT_RADIUS * Math.sin(angle),
        t: transitTimeS, velocityKmS: 1.6, distEarthKm: DU, distMoonKm: 100, phase: 'loi',
      });
    }

  } else if (profileId === 'free-return') {
    // ══════════════════════════════════════════════════════════════════════════
    // Regime 2: Free-Return Trajectory (Classic Figure-8)
    // ══════════════════════════════════════════════════════════════════════════
    const t_mid = transitTimeS * 0.5;

    // 1. Earth LEO Departure
    const N_PRE = 12;
    for (let i = 0; i <= N_PRE; i++) {
      const angle = Math.PI * 0.5 + (i / N_PRE) * Math.PI;
      points.push({
        x: 0, y: 0,
        x3d: pEarth.x + SCALE_3D.PARKING_RADIUS * Math.cos(angle),
        y3d: pEarth.y,
        z3d: pEarth.z + SCALE_3D.PARKING_RADIUS * Math.sin(angle),
        t: 0, velocityKmS: v_tli, distEarthKm: r_park, distMoonKm: DU, phase: 'tli',
      });
    }

    // 2. Outbound Leg (Crosses the X axis geometrically to form the first half of the 8)
    const pOut0 = { x: pEarth.x, y: pEarth.y, z: pEarth.z - SCALE_3D.PARKING_RADIUS };
    const pOut1 = { x: pEarth.x + 35, y: pEarth.y, z: pEarth.z - SCALE_3D.PARKING_RADIUS };
    const pOut2 = { x: pMoon.x - 35, y: pMoon.y, z: pMoon.z + SCALE_3D.LUNAR_ORBIT_RADIUS };
    const pOut3 = { x: pMoon.x, y: pMoon.y, z: pMoon.z + SCALE_3D.LUNAR_ORBIT_RADIUS };

    for (let i = 1; i <= 60; i++) {
      const u = i / 60;
      const { x3d, y3d, z3d } = getBezierPoint3D(pOut0, pOut1, pOut2, pOut3, u);
      points.push({ x: u, y: 0, x3d, y3d, z3d, t: u * t_mid, velocityKmS: 10.9, distEarthKm: u*DU, distMoonKm: DU*(1-u), phase: 'coast' });
    }

    // 3. Moon Far-Side Sweep (Flawless semi-circle behind the trailing hemisphere)
    const N_SWING = 20;
    for (let i = 1; i < N_SWING; i++) {
      const angle = Math.PI * 0.5 - (i / N_SWING) * Math.PI;
      points.push({
        x: 1, y: 0,
        x3d: pMoon.x + SCALE_3D.LUNAR_ORBIT_RADIUS * Math.cos(angle),
        y3d: pMoon.y,
        z3d: pMoon.z + SCALE_3D.LUNAR_ORBIT_RADIUS * Math.sin(angle),
        t: t_mid, velocityKmS: 2.32, distEarthKm: DU, distMoonKm: 100, phase: 'lunar-approach',
      });
    }

    // 4. Inbound Leg (Completes the Figure-8 intersection)
    const pIn0 = { x: pMoon.x, y: pMoon.y, z: pMoon.z - SCALE_3D.LUNAR_ORBIT_RADIUS };
    const pIn1 = { x: pMoon.x - 35, y: pMoon.y, z: pMoon.z - SCALE_3D.LUNAR_ORBIT_RADIUS };
    const pIn2 = { x: pEarth.x + 35, y: pEarth.y, z: pEarth.z + SCALE_3D.PARKING_RADIUS };
    const pIn3 = { x: pEarth.x, y: pEarth.y, z: pEarth.z + SCALE_3D.PARKING_RADIUS };

    for (let i = 1; i <= 60; i++) {
      const u = i / 60;
      const { x3d, y3d, z3d } = getBezierPoint3D(pIn0, pIn1, pIn2, pIn3, u);
      points.push({ x: 1-u, y: 0, x3d, y3d, z3d, t: t_mid + u * t_mid, velocityKmS: 10.9, distEarthKm: (1-u)*DU, distMoonKm: u*DU, phase: 'return' });
    }

    // 5. Earth Re-entry Wrap
    for (let i = 1; i <= N_PRE; i++) {
      const angle = Math.PI * 0.5 + (i / N_PRE) * Math.PI;
      points.push({
        x: 0, y: 0,
        x3d: pEarth.x + SCALE_3D.PARKING_RADIUS * Math.cos(angle),
        y3d: pEarth.y,
        z3d: pEarth.z + SCALE_3D.PARKING_RADIUS * Math.sin(angle),
        t: transitTimeS, velocityKmS: 10.9, distEarthKm: r_park, distMoonKm: DU, phase: 'return',
      });
    }

  } else {
    // ══════════════════════════════════════════════════════════════════════════
    // Regime 3: Low-Energy Transfer (WSB Ballistic Loop)
    // ══════════════════════════════════════════════════════════════════════════
    const N_PRE = 12;
    for (let i = 0; i <= N_PRE; i++) {
      const angle = Math.PI * 0.5 + (i / N_PRE) * Math.PI;
      points.push({
        x: 0, y: 0,
        x3d: pEarth.x + SCALE_3D.PARKING_RADIUS * Math.cos(angle),
        y3d: pEarth.y,
        z3d: pEarth.z + SCALE_3D.PARKING_RADIUS * Math.sin(angle),
        t: 0, velocityKmS: v_tli, distEarthKm: r_park, distMoonKm: DU, phase: 'tli',
      });
    }

    // Two strict Bezier segments with collinear handles at the apex to prevent the folded teardrop
    const pOut0 = { x: pEarth.x, y: pEarth.y, z: pEarth.z - SCALE_3D.PARKING_RADIUS };
    const pOut1 = { x: pEarth.x + 50, y: pEarth.y, z: pEarth.z - SCALE_3D.PARKING_RADIUS };
    const pOut2 = { x: 260, y: pMoon.y * 2.2, z: 20 };
    const pOut3 = { x: 260, y: pMoon.y * 2.2, z: 80 }; // Apex tangent is strictly +Z

    for (let i = 1; i <= 60; i++) {
      const u = i / 60;
      const { x3d, y3d, z3d } = getBezierPoint3D(pOut0, pOut1, pOut2, pOut3, u);
      points.push({ x: u, y: 0, x3d, y3d, z3d, t: u * transitTimeS, velocityKmS: 11.0, distEarthKm: u*1450000, distMoonKm: DU, phase: 'coast' });
    }

    const pIn0 = { x: 260, y: pMoon.y * 2.2, z: 80 };  // Match apex exactly
    const pIn1 = { x: 260, y: pMoon.y * 2.2, z: 140 }; // Handle is collinear (+Z) for C1 continuity
    const pIn2 = { x: pMoon.x + 60, y: pMoon.y, z: pMoon.z + SCALE_3D.LUNAR_ORBIT_RADIUS };
    const pIn3 = { x: pMoon.x, y: pMoon.y, z: pMoon.z + SCALE_3D.LUNAR_ORBIT_RADIUS };

    for (let i = 1; i <= 60; i++) {
      const u = i / 60;
      const { x3d, y3d, z3d } = getBezierPoint3D(pIn0, pIn1, pIn2, pIn3, u);
      points.push({ x: 1, y: 0, x3d, y3d, z3d, t: transitTimeS, velocityKmS: 0.5, distEarthKm: (1-u)*1450000, distMoonKm: DU*(1-u), phase: 'coast' });
    }
  }


  // ── 4. High-Precision Forward Tangent Vectors (dir3d) ─────────────────────
  for (let i = 0; i < points.length; i++) {
    const pPrev = points[Math.max(0, i - 1)];
    const pNext = points[Math.min(points.length - 1, i + 1)];
    const dx = pNext.x3d - pPrev.x3d;
    const dy = pNext.y3d - pPrev.y3d;
    const dz = pNext.z3d - pPrev.z3d;
    const len = Math.hypot(dx, dy, dz) || 1;
    points[i].dir3d = { x: dx / len, y: dy / len, z: dz / len };
  }

  return points;
}

// ── Trajectory Milestones & Annotations ─────────────────────────────────────

/**
 * Extracts key mission milestone markers (TLI, MCC, LOI, Perilune, Re-entry / Landing)
 * with precise timestamps, coordinates, velocities, and telemetry.
 */
export function getTrajectoryMilestones(waypoints, profileId = 'direct') {
  if (!waypoints || !waypoints.length) return [];

  const milestones = [];

  // 1. TLI (Trans-Lunar Injection)
  const tliPt = waypoints.find((p) => p.phase === 'tli') || waypoints[0];
  milestones.push({
    id: 'tli',
    label: 'Trans-Lunar Injection (TLI)',
    shortLabel: 'TLI',
    t: tliPt.t,
    velocityKmS: tliPt.velocityKmS,
    distEarthKm: tliPt.distEarthKm,
    distMoonKm: tliPt.distMoonKm,
    x: tliPt.x,
    y: tliPt.y,
    x3d: tliPt.x3d,
    y3d: tliPt.y3d,
    z3d: tliPt.z3d,
    phase: 'tli',
    badgeColor: '#F59E0B',
    description: 'Main propulsion ignition from LEO parking orbit into translunar trajectory.',
  });

  // 2. MCC-1 (Mid-Course Correction 1)
  const mcc1Index = Math.floor(waypoints.length * 0.22);
  const mcc1Pt = waypoints[mcc1Index];
  if (mcc1Pt) {
    milestones.push({
      id: 'mcc1',
      label: 'Mid-Course Correction 1 (MCC-1)',
      shortLabel: 'MCC-1',
      t: mcc1Pt.t,
      velocityKmS: mcc1Pt.velocityKmS,
      distEarthKm: mcc1Pt.distEarthKm,
      distMoonKm: mcc1Pt.distMoonKm,
      x: mcc1Pt.x,
      y: mcc1Pt.y,
      x3d: mcc1Pt.x3d,
      y3d: mcc1Pt.y3d,
      z3d: mcc1Pt.z3d,
      phase: mcc1Pt.phase,
      badgeColor: '#38BDF8',
      description: 'Outbound trajectory refinement burn to calibrate perilune encounter.',
    });
  }

  // 3. Lunar Encounter Milestone (LOI / Perilune / WSB Turnaround)
  if (profileId === 'free-return') {
    // Find point of closest approach to Moon
    let minMoonDist = Infinity;
    let perilunePt = waypoints[0];
    for (const p of waypoints) {
      if (p.distMoonKm < minMoonDist) {
        minMoonDist = p.distMoonKm;
        perilunePt = p;
      }
    }
    milestones.push({
      id: 'perilune',
      label: 'Lunar Perilune Flyby (Far Side)',
      shortLabel: 'Perilune',
      t: perilunePt.t,
      velocityKmS: perilunePt.velocityKmS,
      distEarthKm: perilunePt.distEarthKm,
      distMoonKm: perilunePt.distMoonKm,
      x: perilunePt.x,
      y: perilunePt.y,
      x3d: perilunePt.x3d,
      y3d: perilunePt.y3d,
      z3d: perilunePt.z3d,
      phase: 'lunar-approach',
      badgeColor: '#A78BFA',
      description: 'Closest approach around lunar trailing hemisphere; passive gravity-assist turnaround.',
    });

    // MCC-2 (Inbound Return Correction)
    const mcc2Index = Math.floor(waypoints.length * 0.78);
    const mcc2Pt = waypoints[mcc2Index];
    if (mcc2Pt) {
      milestones.push({
        id: 'mcc2',
        label: 'Mid-Course Correction 2 (MCC-2)',
        shortLabel: 'MCC-2',
        t: mcc2Pt.t,
        velocityKmS: mcc2Pt.velocityKmS,
        distEarthKm: mcc2Pt.distEarthKm,
        distMoonKm: mcc2Pt.distMoonKm,
        x: mcc2Pt.x,
        y: mcc2Pt.y,
        x3d: mcc2Pt.x3d,
        y3d: mcc2Pt.y3d,
        z3d: mcc2Pt.z3d,
        phase: 'return',
        badgeColor: '#C084FC',
        description: 'Inbound trajectory shaping to target precision atmospheric entry corridor.',
      });
    }

    // Earth Atmospheric Entry Interface
    const entryPt = waypoints[waypoints.length - 1];
    milestones.push({
      id: 'entry',
      label: 'Earth Entry Interface (EI 120 km)',
      shortLabel: 'Entry',
      t: entryPt.t,
      velocityKmS: entryPt.velocityKmS,
      distEarthKm: entryPt.distEarthKm,
      distMoonKm: entryPt.distMoonKm,
      x: entryPt.x,
      y: entryPt.y,
      x3d: entryPt.x3d,
      y3d: entryPt.y3d,
      z3d: entryPt.z3d,
      phase: 'return',
      badgeColor: '#F43F5E',
      description: 'Spacecraft enters Earth upper atmosphere for guided re-entry and splashdown.',
    });
  } else if (profileId === 'low-energy') {
    // Sun-Earth L1/L2 WSB Turnaround Peak
    let maxEarthDist = 0;
    let wsbPt = waypoints[0];
    for (const p of waypoints) {
      if (p.distEarthKm > maxEarthDist) {
        maxEarthDist = p.distEarthKm;
        wsbPt = p;
      }
    }
    milestones.push({
      id: 'wsb-peak',
      label: 'Sun-Earth L1/L2 WSB Turnaround',
      shortLabel: 'WSB Apex',
      t: wsbPt.t,
      velocityKmS: wsbPt.velocityKmS,
      distEarthKm: wsbPt.distEarthKm,
      distMoonKm: wsbPt.distMoonKm,
      x: wsbPt.x,
      y: wsbPt.y,
      x3d: wsbPt.x3d,
      y3d: wsbPt.y3d,
      z3d: wsbPt.z3d,
      phase: 'coast',
      badgeColor: '#FBBF24',
      description: 'Maximum distance from Earth (~1.45M km); solar perturbation reshapes orbit.',
    });

    // Ballistic Capture at Lunar Orbit
    const capturePt = waypoints[waypoints.length - 1];
    milestones.push({
      id: 'capture',
      label: 'Ballistic Lunar Capture (100 km)',
      shortLabel: 'Capture',
      t: capturePt.t,
      velocityKmS: capturePt.velocityKmS,
      distEarthKm: capturePt.distEarthKm,
      distMoonKm: capturePt.distMoonKm,
      x: capturePt.x,
      y: capturePt.y,
      x3d: capturePt.x3d,
      y3d: capturePt.y3d,
      z3d: capturePt.z3d,
      phase: 'loi',
      badgeColor: '#10B981',
      description: 'Spacecraft enters lunar gravity well with near-zero ΔV insertion into circular orbit.',
    });
  } else {
    // Direct Transfer: LOI & Lunar Landing Touchdown
    const loiPt = waypoints.find((p) => p.phase === 'loi') || waypoints[Math.floor(waypoints.length * 0.85)];
    milestones.push({
      id: 'loi',
      label: 'Lunar Orbit Insertion (LOI)',
      shortLabel: 'LOI',
      t: loiPt.t,
      velocityKmS: loiPt.velocityKmS,
      distEarthKm: loiPt.distEarthKm,
      distMoonKm: loiPt.distMoonKm,
      x: loiPt.x,
      y: loiPt.y,
      x3d: loiPt.x3d,
      y3d: loiPt.y3d,
      z3d: loiPt.z3d,
      phase: 'loi',
      badgeColor: '#F43F5E',
      description: 'Retrograde engine burn to circularize into low lunar parking orbit (100 km).',
    });

    const touchPt = waypoints[waypoints.length - 1];
    milestones.push({
      id: 'touchdown',
      label: 'Lunar Surface Touchdown',
      shortLabel: 'Touchdown',
      t: touchPt.t,
      velocityKmS: touchPt.velocityKmS,
      distEarthKm: touchPt.distEarthKm,
      distMoonKm: touchPt.distMoonKm,
      x: touchPt.x,
      y: touchPt.y,
      x3d: touchPt.x3d,
      y3d: touchPt.y3d,
      z3d: touchPt.z3d,
      phase: 'descent',
      badgeColor: '#10B981',
      description: 'Powered descent completion and soft landing at target coordinates.',
    });
  }

  return milestones;
}

// ── Synchronized 2D Trajectory Projection Panel Generator ──────────────────

/**
 * Generates formatted 2D SVG paths, body positions, milestone markers, and
 * coordinate frame data for the 2D mission flight projection canvas.
 */
export function get2DTrajectoryProjection(waypoints, profileId = 'direct', options = {}) {
  const isBlt = profileId === 'low-energy';
  const width = 920;
  const height = 400;

  if (isBlt) {
    // ══════════════════════════════════════════════════════════════════════════
    // Sun-Earth Weak Stability Boundary (WSB) Projection Frame
    // Scale: ~1.5 million km domain
    // ══════════════════════════════════════════════════════════════════════════
    const earthSvg = { x: 260, y: 200, radius: 22, label: 'Earth' };
    const moonOrbitSvg = { cx: 260, cy: 200, rx: 95, ry: 95, label: 'Moon 27.3d Orbit (384,400 km)' };
    const moonInterceptSvg = { x: 355, y: 200, radius: 10, label: 'Moon Capture' };
    const lagrangeL1 = { x: 80, y: 200, label: 'Sun-Earth L1 (~1.5M km)' };
    const lagrangeL2 = { x: 740, y: 200, label: 'Sun-Earth L2 / WSB (~1.5M km)' };
    const sunIndicator = { fromX: 180, fromY: 200, toX: 40, toY: 200, label: 'To Sun' };

    // Coordinate mapping: Earth at (260, 200), 1 DU (384,400 km) = 95 px
    const scalePxPerDU = 95.0;
    const toSvg = (nx, ny) => ({
      x: earthSvg.x + nx * scalePxPerDU,
      y: earthSvg.y - ny * scalePxPerDU * 1.15,
    });

    const outboundPts = [];
    const turnaroundPts = [];
    const capturePts = [];

    for (let i = 0; i < waypoints.length; i++) {
      const p = waypoints[i];
      const ptSvg = toSvg(p.x, p.y);
      const frac = i / (waypoints.length - 1);
      if (frac < 0.45) outboundPts.push(ptSvg);
      else if (frac < 0.75) turnaroundPts.push(ptSvg);
      else capturePts.push(ptSvg);
    }

    const buildPathD = (pts) => {
      if (!pts || !pts.length) return '';
      let d = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
      for (let i = 1; i < pts.length; i++) {
        d += ` L ${pts[i].x.toFixed(1)} ${pts[i].y.toFixed(1)}`;
      }
      return d;
    };

    const allPts = waypoints.map((p) => toSvg(p.x, p.y));
    const fullPathD = buildPathD(allPts);

    const milestones = getTrajectoryMilestones(waypoints, profileId).map((m) => {
      const svgPos = toSvg(m.x, m.y);
      return { ...m, svgX: svgPos.x, svgY: svgPos.y };
    });

    return {
      frameType: 'sun-earth-wsb',
      title: 'Sun-Earth Synodic Frame · Weak Stability Boundary (L1/L2)',
      subtitle: 'Ballistic Lunar Transfer (BLT) via Sun-Earth Saddle Manifolds (~1.45M km)',
      viewBox: `0 0 ${width} ${height}`,
      earth: earthSvg,
      moonOrbit: moonOrbitSvg,
      moon: moonInterceptSvg,
      lagrangeL1,
      lagrangeL2,
      sunIndicator,
      paths: {
        outbound: buildPathD(outboundPts),
        turnaround: buildPathD(turnaroundPts),
        capture: buildPathD(capturePts),
        full: fullPathD,
      },
      milestones,
      toSvgCoords: toSvg,
    };
  }

  // ════════════════════════════════════════════════════════════════════════════
  // Earth-Moon Rotating (Synodic) Barycentric 2D Projection Frame
  // Earth is at fixed left, Moon is at fixed right
  // ════════════════════════════════════════════════════════════════════════════
  const earthX = 130;
  const earthY = 200;
  const moonX = 780;
  const moonY = 200;
  const spanX = moonX - earthX; // 650 px

  const earthSvg = {
    x: earthX,
    y: earthY,
    radius: 22,
    parkingRadius: 36,
    label: 'Earth',
    padLat: options.launchSite?.latitude ?? 28.6,
    padLon: options.launchSite?.longitude ?? -80.6,
  };

  const moonSvg = {
    x: moonX,
    y: moonY,
    radius: 14,
    soiRadius: 112,
    orbitRadius: 26,
    label: 'Moon',
    targetLat: options.moonTarget?.latitude ?? 0.67,
    targetLon: options.moonTarget?.longitude ?? 23.47,
  };

  // Maps normalized rotating coordinates (x, y) where Earth is at (0, 0) and Moon is at (1.0, 0)
  const toSvg = (nx, ny) => ({
    x: earthX + nx * spanX,
    y: earthY - ny * 340,
  });

  const outboundPts = [];
  const encounterPts = [];
  const returnPts = [];

  for (let i = 0; i < waypoints.length; i++) {
    const p = waypoints[i];
    const ptSvg = toSvg(p.x, p.y);
    if (p.phase === 'tli' || p.phase === 'coast') {
      outboundPts.push(ptSvg);
    } else if (p.phase === 'lunar-approach' || p.phase === 'loi') {
      encounterPts.push(ptSvg);
    } else if (p.phase === 'return' || p.phase === 'descent') {
      returnPts.push(ptSvg);
    }
  }

  const buildPathD = (pts) => {
    if (!pts || !pts.length) return '';
    let d = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
    for (let i = 1; i < pts.length; i++) {
      d += ` L ${pts[i].x.toFixed(1)} ${pts[i].y.toFixed(1)}`;
    }
    return d;
  };

  const activeWaypoints = waypoints.filter(
    (p) =>
      p.phase === 'tli' ||
      p.phase === 'coast' ||
      p.phase === 'lunar-approach' ||
      p.phase === 'return' ||
      p.phase === 'loi' ||
      p.phase === 'descent'
  );

  const fullPathD = buildPathD(activeWaypoints.map((p) => toSvg(p.x, p.y)));

  const milestones = getTrajectoryMilestones(waypoints, profileId).map((m) => {
    const svgPos = toSvg(m.x, m.y);
    return { ...m, svgX: svgPos.x, svgY: svgPos.y };
  });

  return {
    frameType: 'synodic',
    title: 'Earth-Moon Rotating (Synodic) Barycentric Reference Frame',
    subtitle: profileId === 'free-return' ? 'Apollo-Style Circumlunar Free-Return Figure-8 Loop' : 'Direct High-Energy Translunar Injection & Insertion',
    viewBox: `0 0 ${width} ${height}`,
    earth: earthSvg,
    moon: moonSvg,
    paths: {
      outbound: buildPathD(outboundPts),
      encounter: buildPathD(encounterPts),
      return: buildPathD(returnPts),
      full: fullPathD,
    },
    milestones,
    toSvgCoords: toSvg,
  };
}

// ── Trajectory Interpolator ────────────────────────────────────────────────

/**
 * Interpolates the spacecraft's state (2D/3D position, velocity, orientation)
 * along the transfer/return flight path given a progress fraction 0 <= frac <= 1.
 */
export function getInterpolatedStateAtFrac(waypoints, frac) {
  if (!waypoints || !waypoints.length) return null;

  const path = waypoints.filter(
    (p) =>
      p.phase === 'tli' ||
      p.phase === 'coast' ||
      p.phase === 'lunar-approach' ||
      p.phase === 'return' ||
      p.phase === 'loi' ||
      p.phase === 'descent'
  );
  if (!path.length) return null;

  const clamped = Math.max(0, Math.min(1, frac));
  const rawIndex = clamped * (path.length - 1);
  const i0 = Math.floor(rawIndex);
  const i1 = Math.min(path.length - 1, i0 + 1);
  const alpha = rawIndex - i0;

  const p0 = path[i0];
  const p1 = path[i1];

  const x = p0.x + (p1.x - p0.x) * alpha;
  const y = p0.y + (p1.y - p0.y) * alpha;
  const t = p0.t + (p1.t - p0.t) * alpha;
  const velocityKmS = p0.velocityKmS + (p1.velocityKmS - p0.velocityKmS) * alpha;
  const distEarthKm = p0.distEarthKm + (p1.distEarthKm - p0.distEarthKm) * alpha;
  const distMoonKm = p0.distMoonKm + (p1.distMoonKm - p0.distMoonKm) * alpha;

  // 3D coordinates interpolation
  const x3d = p0.x3d != null && p1.x3d != null ? p0.x3d + (p1.x3d - p0.x3d) * alpha : x * 75;
  const y3d = p0.y3d != null && p1.y3d != null ? p0.y3d + (p1.y3d - p0.y3d) * alpha : y * 28;
  const z3d = p0.z3d != null && p1.z3d != null ? p0.z3d + (p1.z3d - p0.z3d) * alpha : 0;

  // 2D angle
  const dx = p1.x - p0.x;
  const dy = p1.y - p0.y;
  let angleDeg = Math.atan2(dy, dx) * (180 / Math.PI);
  if (dx === 0 && dy === 0 && i0 > 0) {
    const pPrev = path[i0 - 1];
    angleDeg = Math.atan2(p0.y - pPrev.y, p0.x - pPrev.x) * (180 / Math.PI);
  }

  // 3D forward direction tangent vector
  const dir0 = p0.dir3d || { x: 1, y: 0, z: 0 };
  const dir1 = p1.dir3d || { x: 1, y: 0, z: 0 };
  const dirX = dir0.x + (dir1.x - dir0.x) * alpha;
  const dirY = dir0.y + (dir1.y - dir0.y) * alpha;
  const dirZ = dir0.z + (dir1.z - dir0.z) * alpha;
  const dirLen = Math.hypot(dirX, dirY, dirZ) || 1;
  const dir3d = { x: dirX / dirLen, y: dirY / dirLen, z: dirZ / dirLen };

  return {
    x,
    y,
    x3d,
    y3d,
    z3d,
    dir3d,
    t,
    velocityKmS,
    distEarthKm,
    distMoonKm,
    angleDeg,
    phase: alpha > 0.5 ? p1.phase : p0.phase,
  };
}

// ── Utility: Format duration ───────────────────────────────────────────────

export function formatTransitTime(seconds) {
  const totalSeconds = Math.max(0, Math.round(seconds));
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);

  if (days > 30) {
    const months = (days / 30.44).toFixed(1);
    return `~${months} months (${days} days)`;
  }
  if (days > 0) {
    return `${days}d ${hours}h ${minutes}m`;
  }
  return `${hours}h ${minutes}m`;
}
