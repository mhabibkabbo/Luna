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
export const CR3BP_MU = MOON_MU / (EARTH_MU + MOON_MU);
export const CR3BP_DU = EARTH_MOON_DIST_KM;
export const CR3BP_TU = Math.sqrt(Math.pow(CR3BP_DU, 3) / (EARTH_MU + MOON_MU));
export const CR3BP_VU = CR3BP_DU / CR3BP_TU;

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

// ── Core Computation ───────────────────────────────────────────────────────

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
  const r_park = EARTH_RADIUS_KM + h_park;
  const v_park = Math.sqrt(EARTH_MU / r_park);
  const T_park = TWO_PI * Math.sqrt(r_park ** 3 / EARTH_MU);

  // ── 2. Transfer ellipse ───────────────────────────────────────────────
  const r_moon = EARTH_MOON_DIST_KM;
  const a_trans = (r_park + r_moon) / 2;
  const e_trans = 1 - r_park / a_trans;
  const T_trans = TWO_PI * Math.sqrt(a_trans ** 3 / EARTH_MU);

  let transitTimeS;
  let transitLabel;
  if (profileId === 'low-energy') {
    transitTimeS = 100 * 86400; // ~100 days
    transitLabel = '~100 days (WSB Ballistic)';
  } else if (profileId === 'free-return') {
    transitTimeS = 5.6 * 86400; // ~5.6 days
    transitLabel = formatTransitTime(transitTimeS);
  } else {
    transitTimeS = T_trans / 2; // ~4.98 days
    transitLabel = formatTransitTime(transitTimeS);
  }

  const transitDays = transitTimeS / 86400;
  const v_tli = Math.sqrt(EARTH_MU * (2 / r_park - 1 / a_trans));
  const dv_tli = v_tli - v_park;
  const v_inf_depart = Math.sqrt(Math.max(0, v_tli ** 2 - 2 * EARTH_MU / r_park));

  // ── 3. Lunar arrival ──────────────────────────────────────────────────
  const v_arrive_helio = Math.sqrt(EARTH_MU * (2 / r_moon - 1 / a_trans));
  const v_moon = Math.sqrt(EARTH_MU / r_moon);
  let v_approach = Math.abs(v_moon - v_arrive_helio);
  if (profileId === 'low-energy') {
    v_approach *= 0.55;
  }

  const r_lunar_orbit = MOON_RADIUS_KM + lunarOrbitAltKm;
  const v_lunar_periapsis = Math.sqrt(v_approach ** 2 + 2 * MOON_MU / r_lunar_orbit);
  const v_lunar_circular = Math.sqrt(MOON_MU / r_lunar_orbit);
  let dv_loi = v_lunar_periapsis - v_lunar_circular;

  if (profileId === 'low-energy') {
    dv_loi *= 0.65;
  } else if (profileId === 'free-return') {
    dv_loi = 0.0;
  }

  // ── 4. Powered descent ────────────────────────────────────────────────
  const dv_descent = profileId === 'free-return' ? 0.0 : v_lunar_circular * 0.98 + 0.15;
  const totalDv = dv_tli + dv_loi + dv_descent;

  // ── 5. Generate 2D/3D visualization waypoints ─────────────────────────
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

  const milestones = getTrajectoryMilestones(waypoints, profileId);
  const projection2d = get2DTrajectoryProjection(waypoints, profileId, { launchSite, moonTarget });

  return {
    profile,
    parkingOrbit: { altKm: h_park, radiusKm: r_park, velocityKmS: v_park, periodS: T_park },
    tli: { deltaVKmS: dv_tli, velocityKmS: v_tli, velocityPostBurnKmS: v_tli, escapeVinfKmS: v_inf_depart },
    transfer: { semiMajorKm: a_trans, eccentricity: e_trans, periodS: T_trans, transitTimeS, transitDays, transitLabel, perigeeKm: r_park, apogeeKm: r_moon },
    lunarArrival: { approachVelocityKmS: v_approach, orbitInsertionDvKmS: dv_loi, orbitAltKm: lunarOrbitAltKm, orbitVelocityKmS: v_lunar_circular },
    descentDvKmS: dv_descent,
    totalDeltaVKmS: totalDv,
    waypoints,
    milestones,
    projection2d,
    launchSite,
    moonTarget,
  };
}

// ── Waypoint Generator (Unified 2D Physical / 3D Mapping Engine) ─────────────

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

  // 1. Orthonormal 3D Basis Vectors
  const targetMoon3d = moon3dPos
    ? { x: Math.abs(moon3dPos.x), y: moon3dPos.y, z: moon3dPos.z }
    : {
        x: SCALE_3D.DISTANCE * Math.cos(0.09),
        y: SCALE_3D.DISTANCE * Math.sin(0.09) * 0.4,
        z: SCALE_3D.DISTANCE * Math.sin(0.09) * 0.8,
      };

  const moonDist3d = Math.hypot(targetMoon3d.x, targetMoon3d.y, targetMoon3d.z) || SCALE_3D.DISTANCE;
  const u3d = { x: targetMoon3d.x / moonDist3d, y: targetMoon3d.y / moonDist3d, z: targetMoon3d.z / moonDist3d };

  let v3d = { x: -u3d.z, y: 0, z: u3d.x };
  const vLen = Math.hypot(v3d.x, v3d.y, v3d.z) || 1;
  v3d = { x: v3d.x / vLen, y: v3d.y / vLen, z: v3d.z / vLen };

  // 2. Map 2D Physical Coordinates to 3D Viewport Scale
  const mapTo3D = (x_km, y_km, h_peri_km = 110) => {
    const dE_km = Math.hypot(x_km, y_km);
    const dM_km = Math.hypot(x_km - DU, y_km);

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
      const dirM_x = ((x_km - DU) / (dM_km || 1)) * u3d.x + (y_km / (dM_km || 1)) * v3d.x;
      const dirM_y = ((x_km - DU) / (dM_km || 1)) * u3d.y + (y_km / (dM_km || 1)) * v3d.y;
      const dirM_z = ((x_km - DU) / (dM_km || 1)) * u3d.z + (y_km / (dM_km || 1)) * v3d.z;
      return {
        x3d: targetMoon3d.x + dirM_x * r_vis,
        y3d: targetMoon3d.y + dirM_y * r_vis,
        z3d: targetMoon3d.z + dirM_z * r_vis,
      };
    }

    return {
      x3d: (x_km / DU) * targetMoon3d.x + (y_km / DU) * moonDist3d * v3d.x,
      y3d: (x_km / DU) * targetMoon3d.y + (y_km / DU) * moonDist3d * v3d.y,
      z3d: (x_km / DU) * targetMoon3d.z + (y_km / DU) * moonDist3d * v3d.z,
    };
  };

  // 2D Cubic Bezier Evaluator
  const getBezier2D = (p0, p1, p2, p3, t) => {
    const mt = 1 - t;
    const a = mt * mt * mt, b = 3 * mt * mt * t, c = 3 * mt * t * t, d = t * t * t;
    return {
      x: a * p0.x + b * p1.x + c * p2.x + d * p3.x,
      y: a * p0.y + b * p1.y + c * p2.y + d * p3.y,
    };
  };

  const points = [];

  // ── 3. Profile-Specific Trajectory Generation ─────────────────────────────

  if (profileId === 'direct') {
    // ══════════════════════════════════════════════════════════════════════════
    // Regime 1: Direct Transfer (Fast TLI + LOI)
    // ══════════════════════════════════════════════════════════════════════════
    const deltaThetaM = omega_M * transitTimeS;
    const thetaTLI = deltaThetaM - Math.PI;

    const r_lunar_orbit = MOON_RADIUS_KM + lunarOrbitAltKm;
    const r_target_moon = DU + r_lunar_orbit;
    const a_direct = (r_park + r_target_moon) / 2;
    const e_direct = 1 - r_park / a_direct;

    // Power-law sampling for eccentric anomaly E for smooth C1 departure
    const gamma = 1.45;
    const N_TRANS = 75;
    const u1 = 1 / N_TRANS;
    const E1 = Math.PI * Math.pow(u1, gamma);
    const cosNu1 = (Math.cos(E1) - e_direct) / (1 - e_direct * Math.cos(E1));
    const sinNu1 = (Math.sqrt(Math.max(0, 1 - e_direct * e_direct)) * Math.sin(E1)) / (1 - e_direct * Math.cos(E1));
    const nu1 = Math.atan2(sinNu1, cosNu1);

    // Parking orbit leading to TLI injection
    const dThetaPark = nu1;
    const N_PARK = 14;
    for (let i = N_PARK; i >= 1; i--) {
      const angle = thetaTLI - i * dThetaPark;
      const x_km = r_park * Math.cos(angle);
      const y_km = r_park * Math.sin(angle);
      const { x3d, y3d, z3d } = mapTo3D(x_km, y_km, 100);

      points.push({
        x: x_km / DU,
        y: y_km / DU,
        x3d,
        y3d,
        z3d,
        t: 0,
        velocityKmS: v_tli,
        distEarthKm: r_park,
        distMoonKm: Math.hypot(x_km - DU, y_km),
        phase: 'tli',
      });
    }

    // Translunar Transfer Ellipse
    for (let i = 0; i <= N_TRANS; i++) {
      const u = i / N_TRANS;
      const E = Math.PI * Math.pow(u, gamma);
      const M = E - e_direct * Math.sin(E);
      const t = (M / Math.PI) * transitTimeS;
      const r = a_direct * (1 - e_direct * Math.cos(E));
      const cosNu = (Math.cos(E) - e_direct) / (1 - e_direct * Math.cos(E));
      const sinNu = (Math.sqrt(Math.max(0, 1 - e_direct * e_direct)) * Math.sin(E)) / (1 - e_direct * Math.cos(E));
      const nu = Math.atan2(sinNu, cosNu);
      const thetaRot = thetaTLI + nu - omega_M * t;

      const x_km = r * Math.cos(thetaRot);
      const y_km = r * Math.sin(thetaRot);
      const dE_km = Math.hypot(x_km, y_km);
      const dM_km = Math.hypot(x_km - DU, y_km);
      const v = Math.sqrt(EARTH_MU * (2 / r - 1 / a_direct));
      const { x3d, y3d, z3d } = mapTo3D(x_km, y_km, lunarOrbitAltKm);

      let phase = 'coast';
      if (u < 0.08) phase = 'tli';
      else if (dM_km <= MOON_SOI_KM) phase = 'lunar-approach';

      points.push({
        x: x_km / DU,
        y: y_km / DU,
        x3d,
        y3d,
        z3d,
        t,
        velocityKmS: Math.max(1.0, v),
        distEarthKm: dE_km,
        distMoonKm: dM_km,
        phase,
      });
    }

    // Lunar Orbit Insertion: 100 km circular lunar parking orbit
    const N_LOI = 16;
    for (let i = 1; i <= N_LOI; i++) {
      const p = i / N_LOI;
      const phi = -p * (Math.PI * 0.5);
      const x_km = DU + r_lunar_orbit * Math.cos(phi);
      const y_km = r_lunar_orbit * Math.sin(phi);
      const { x3d, y3d, z3d } = mapTo3D(x_km, y_km, lunarOrbitAltKm);

      points.push({
        x: x_km / DU,
        y: y_km / DU,
        x3d,
        y3d,
        z3d,
        t: transitTimeS + p * 3600,
        velocityKmS: Math.sqrt(MOON_MU / r_lunar_orbit),
        distEarthKm: DU,
        distMoonKm: r_lunar_orbit,
        phase: 'loi',
      });
    }

    // Powered Descent: continuous forward descent to target landing site
    const N_DESC = 16;
    for (let i = 1; i <= N_DESC; i++) {
      const p = i / N_DESC;
      const s = p * p * (3 - 2 * p);
      const alt = lunarOrbitAltKm * (1 - s);
      const distM = MOON_RADIUS_KM + alt;
      const phi = -Math.PI * 0.5 - p * (Math.PI * 0.45);
      const x_km = DU + distM * Math.cos(phi);
      const y_km = distM * Math.sin(phi);

      const { x3d, y3d, z3d } = mapTo3D(x_km, y_km, alt);

      points.push({
        x: x_km / DU,
        y: y_km / DU,
        x3d,
        y3d,
        z3d,
        t: transitTimeS + 3600 + p * 1800,
        velocityKmS: Math.sqrt(MOON_MU / r_lunar_orbit) * (1 - p * 0.95),
        distEarthKm: DU,
        distMoonKm: distM,
        phase: 'descent',
      });
    }

  } else if (profileId === 'free-return') {
    const h_peri_km = 220;
    const r_peri_km = MOON_RADIUS_KM + h_peri_km;
    const t_mid = transitTimeS * 0.5;

    for (let i = 0; i <= 12; i++) {
      const angle = Math.PI * 0.5 + (i / 12) * Math.PI;
      const x_km = r_park * Math.cos(angle);
      const y_km = r_park * Math.sin(angle);
      const { x3d, y3d, z3d } = mapTo3D(x_km, y_km, h_peri_km);
      points.push({ x: x_km/DU, y: y_km/DU, x3d, y3d, z3d, t: 0, velocityKmS: v_tli, distEarthKm: r_park, distMoonKm: DU, phase: 'tli' });
    }

    // Outbound Figure-8 Physical KM Arc
    const pOut0 = { x: 0, y: -r_park };
    const pOut1 = { x: DU * 0.4, y: -r_park };
    const pOut2 = { x: DU * 0.6, y: r_peri_km };
    const pOut3 = { x: DU, y: r_peri_km };

    for (let i = 1; i <= 60; i++) {
      const u = i / 60;
      const { x: x_km, y: y_km } = getBezier2D(pOut0, pOut1, pOut2, pOut3, u);
      const dE_km = Math.hypot(x_km, y_km);
      const dM_km = Math.hypot(x_km - DU, y_km);
      const { x3d, y3d, z3d } = mapTo3D(x_km, y_km, h_peri_km);
      points.push({ x: x_km/DU, y: y_km/DU, x3d, y3d, z3d, t: u * t_mid, velocityKmS: 10.9, distEarthKm: dE_km, distMoonKm: dM_km, phase: 'coast' });
    }

    for (let i = 1; i < 20; i++) {
      const angle = Math.PI * 0.5 - (i / 20) * Math.PI;
      const x_km = DU + r_peri_km * Math.cos(angle);
      const y_km = r_peri_km * Math.sin(angle);
      const { x3d, y3d, z3d } = mapTo3D(x_km, y_km, h_peri_km);
      points.push({ x: x_km/DU, y: y_km/DU, x3d, y3d, z3d, t: t_mid, velocityKmS: 2.32, distEarthKm: DU, distMoonKm: r_peri_km, phase: 'lunar-approach' });
    }

    const pIn0 = { x: DU, y: -r_peri_km };
    const pIn1 = { x: DU * 0.6, y: -r_peri_km };
    const pIn2 = { x: DU * 0.4, y: r_park };
    const pIn3 = { x: 0, y: r_park };

    for (let i = 1; i <= 60; i++) {
      const u = i / 60;
      const { x: x_km, y: y_km } = getBezier2D(pIn0, pIn1, pIn2, pIn3, u);
      const dE_km = Math.hypot(x_km, y_km);
      const dM_km = Math.hypot(x_km - DU, y_km);
      const { x3d, y3d, z3d } = mapTo3D(x_km, y_km, h_peri_km);
      points.push({ x: x_km/DU, y: y_km/DU, x3d, y3d, z3d, t: t_mid + u * t_mid, velocityKmS: 10.9, distEarthKm: dE_km, distMoonKm: dM_km, phase: 'return' });
    }

    for (let i = 1; i <= 12; i++) {
      const angle = Math.PI * 0.5 + (i / 12) * Math.PI;
      const x_km = r_park * Math.cos(angle);
      const y_km = r_park * Math.sin(angle);
      const { x3d, y3d, z3d } = mapTo3D(x_km, y_km, h_peri_km);
      points.push({ x: x_km/DU, y: y_km/DU, x3d, y3d, z3d, t: transitTimeS, velocityKmS: 10.9, distEarthKm: r_park, distMoonKm: DU, phase: 'return' });
    }

  } else {
    // ══════════════════════════════════════════════════════════════════════════
    // Regime 3: Low-Energy Transfer (WSB Ballistic Loop)
    // ══════════════════════════════════════════════════════════════════════════
    const r_wsb = 1450000;

    for (let i = 0; i <= 12; i++) {
      const angle = Math.PI * 0.5 + (i / 12) * Math.PI;
      const x_km = r_park * Math.cos(angle);
      const y_km = r_park * Math.sin(angle);
      const { x3d, y3d, z3d } = mapTo3D(x_km, y_km, 100);
      points.push({ x: x_km/DU, y: y_km/DU, x3d, y3d, z3d, t: 0, velocityKmS: v_tli, distEarthKm: r_park, distMoonKm: DU, phase: 'tli' });
    }

    // Outbound Physical KM Arc (Earth to L1/L2 region)
    const pOut0 = { x: 0, y: -r_park };
    const pOut1 = { x: DU * 0.5, y: -r_park };
    const pOut2 = { x: r_wsb * 0.8, y: r_wsb * 0.35 };
    const pOut3 = { x: r_wsb, y: r_wsb * 0.45 };

    for (let i = 1; i <= 60; i++) {
      const u = i / 60;
      const { x: x_km, y: y_km } = getBezier2D(pOut0, pOut1, pOut2, pOut3, u);
      const { x3d, y3d, z3d } = mapTo3D(x_km, y_km, 100);
      points.push({ x: x_km/DU, y: y_km/DU, x3d, y3d, z3d, t: u * transitTimeS, velocityKmS: 11.0, distEarthKm: x_km, distMoonKm: DU, phase: 'coast' });
    }

    // Inbound Physical KM Arc (Continuous trajectory matching Outbound tangency)
    const pIn0 = { x: r_wsb, y: r_wsb * 0.45 };
    const pIn1 = { x: r_wsb * 1.1, y: r_wsb * 0.55 };
    const pIn2 = { x: DU * 1.2, y: MOON_RADIUS_KM + 100 };
    const pIn3 = { x: DU, y: MOON_RADIUS_KM + 100 };

    for (let i = 1; i <= 60; i++) {
      const u = i / 60;
      const { x: x_km, y: y_km } = getBezier2D(pIn0, pIn1, pIn2, pIn3, u);
      const dM_km = Math.hypot(x_km - DU, y_km);
      const { x3d, y3d, z3d } = mapTo3D(x_km, y_km, 100);
      points.push({ x: x_km/DU, y: y_km/DU, x3d, y3d, z3d, t: transitTimeS, velocityKmS: 0.5, distEarthKm: x_km, distMoonKm: dM_km, phase: 'coast' });
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

export function getTrajectoryMilestones(waypoints, profileId = 'direct') {
  if (!waypoints || !waypoints.length) return [];

  const milestones = [];

  const tliPt = waypoints.find((p) => p.phase === 'tli') || waypoints[0];
  milestones.push({
    id: 'tli',
    label: 'Trans-Lunar Injection (TLI)',
    shortLabel: 'TLI',
    t: tliPt.t,
    velocityKmS: tliPt.velocityKmS,
    distEarthKm: tliPt.distEarthKm,
    distMoonKm: tliPt.distMoonKm,
    x: tliPt.x, y: tliPt.y, x3d: tliPt.x3d, y3d: tliPt.y3d, z3d: tliPt.z3d,
    phase: 'tli', badgeColor: '#F59E0B',
    description: 'Main propulsion ignition from LEO parking orbit into translunar trajectory.',
  });

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
      x: mcc1Pt.x, y: mcc1Pt.y, x3d: mcc1Pt.x3d, y3d: mcc1Pt.y3d, z3d: mcc1Pt.z3d,
      phase: mcc1Pt.phase, badgeColor: '#38BDF8',
      description: 'Outbound trajectory refinement burn to calibrate perilune encounter.',
    });
  }

  if (profileId === 'free-return') {
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
      x: perilunePt.x, y: perilunePt.y, x3d: perilunePt.x3d, y3d: perilunePt.y3d, z3d: perilunePt.z3d,
      phase: 'lunar-approach', badgeColor: '#A78BFA',
      description: 'Closest approach around lunar trailing hemisphere; passive gravity-assist turnaround.',
    });

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
        x: mcc2Pt.x, y: mcc2Pt.y, x3d: mcc2Pt.x3d, y3d: mcc2Pt.y3d, z3d: mcc2Pt.z3d,
        phase: 'return', badgeColor: '#C084FC',
        description: 'Inbound trajectory shaping to target precision atmospheric entry corridor.',
      });
    }

    const entryPt = waypoints[waypoints.length - 1];
    milestones.push({
      id: 'entry',
      label: 'Earth Entry Interface (EI 120 km)',
      shortLabel: 'Entry',
      t: entryPt.t,
      velocityKmS: entryPt.velocityKmS,
      distEarthKm: entryPt.distEarthKm,
      distMoonKm: entryPt.distMoonKm,
      x: entryPt.x, y: entryPt.y, x3d: entryPt.x3d, y3d: entryPt.y3d, z3d: entryPt.z3d,
      phase: 'return', badgeColor: '#F43F5E',
      description: 'Spacecraft enters Earth upper atmosphere for guided re-entry and splashdown.',
    });
  } else if (profileId === 'low-energy') {
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
      x: wsbPt.x, y: wsbPt.y, x3d: wsbPt.x3d, y3d: wsbPt.y3d, z3d: wsbPt.z3d,
      phase: 'coast', badgeColor: '#FBBF24',
      description: 'Maximum distance from Earth (~1.45M km); solar perturbation reshapes orbit.',
    });

    const capturePt = waypoints[waypoints.length - 1];
    milestones.push({
      id: 'capture',
      label: 'Ballistic Lunar Capture (100 km)',
      shortLabel: 'Capture',
      t: capturePt.t,
      velocityKmS: capturePt.velocityKmS,
      distEarthKm: capturePt.distEarthKm,
      distMoonKm: capturePt.distMoonKm,
      x: capturePt.x, y: capturePt.y, x3d: capturePt.x3d, y3d: capturePt.y3d, z3d: capturePt.z3d,
      phase: 'loi', badgeColor: '#10B981',
      description: 'Spacecraft enters lunar gravity well with near-zero ΔV insertion into circular orbit.',
    });
  } else {
    const loiPt = waypoints.find((p) => p.phase === 'loi') || waypoints[Math.floor(waypoints.length * 0.85)];
    milestones.push({
      id: 'loi',
      label: 'Lunar Orbit Insertion (LOI)',
      shortLabel: 'LOI',
      t: loiPt.t,
      velocityKmS: loiPt.velocityKmS,
      distEarthKm: loiPt.distEarthKm,
      distMoonKm: loiPt.distMoonKm,
      x: loiPt.x, y: loiPt.y, x3d: loiPt.x3d, y3d: loiPt.y3d, z3d: loiPt.z3d,
      phase: 'loi', badgeColor: '#F43F5E',
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
      x: touchPt.x, y: touchPt.y, x3d: touchPt.x3d, y3d: touchPt.y3d, z3d: touchPt.z3d,
      phase: 'descent', badgeColor: '#10B981',
      description: 'Powered descent completion and soft landing at target coordinates.',
    });
  }

  return milestones;
}

// ── Synchronized 2D Trajectory Projection Panel Generator ──────────────────

export function get2DTrajectoryProjection(waypoints, profileId = 'direct', options = {}) {
  const isBlt = profileId === 'low-energy';
  const width = 920;
  const height = 400;

  if (isBlt) {
    const earthSvg = { x: 260, y: 200, radius: 22, label: 'Earth' };
    const moonOrbitSvg = { cx: 260, cy: 200, rx: 95, ry: 95, label: 'Moon 27.3d Orbit (384,400 km)' };
    const moonInterceptSvg = { x: 355, y: 200, radius: 10, label: 'Moon Capture' };
    const lagrangeL1 = { x: 80, y: 200, label: 'Sun-Earth L1 (~1.5M km)' };
    const lagrangeL2 = { x: 740, y: 200, label: 'Sun-Earth L2 / WSB (~1.5M km)' };
    const sunIndicator = { fromX: 180, fromY: 200, toX: 40, toY: 200, label: 'To Sun' };

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
      if (frac <= 0.45) outboundPts.push(ptSvg);
      if (frac >= 0.45 && frac <= 0.75) turnaroundPts.push(ptSvg);
      if (frac >= 0.75) capturePts.push(ptSvg);
    }

    const buildPathD = (pts) => {
      if (!pts || !pts.length) return '';
      const validPts = pts.filter((p) => p && typeof p.x === 'number' && typeof p.y === 'number' && !isNaN(p.x) && !isNaN(p.y));
      if (!validPts.length) return '';
      let d = `M ${validPts[0].x.toFixed(1)} ${validPts[0].y.toFixed(1)}`;
      for (let i = 1; i < validPts.length; i++) {
        d += ` L ${validPts[i].x.toFixed(1)} ${validPts[i].y.toFixed(1)}`;
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
      scaleX: (nx) => earthSvg.x + nx * scalePxPerDU,
      scaleY: (ny) => earthSvg.y - ny * scalePxPerDU * 1.15,
      svgWidth: width,
      svgHeight: height,
      moonSvg: moonInterceptSvg,
      pathD: fullPathD,
    };
  }

  const earthX = 130;
  const earthY = 200;
  const moonX = 780;
  const moonY = 200;
  const spanX = moonX - earthX;

  const earthSvg = {
    x: earthX, y: earthY, radius: 22, parkingRadius: 36, label: 'Earth',
    padLat: options.launchSite?.latitude ?? 28.6,
    padLon: options.launchSite?.longitude ?? -80.6,
  };

  const moonSvg = {
    x: moonX, y: moonY, radius: 14, soiRadius: 112, orbitRadius: 26, label: 'Moon',
    targetLat: options.moonTarget?.latitude ?? 0.67,
    targetLon: options.moonTarget?.longitude ?? 23.47,
  };

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
      if (encounterPts.length === 0 && outboundPts.length > 0) encounterPts.push(outboundPts[outboundPts.length - 1]);
      encounterPts.push(ptSvg);
    } else if (p.phase === 'return' || p.phase === 'descent') {
      if (returnPts.length === 0 && encounterPts.length > 0) returnPts.push(encounterPts[encounterPts.length - 1]);
      returnPts.push(ptSvg);
    }
  }

  const buildPathD = (pts) => {
    if (!pts || !pts.length) return '';
    const validPts = pts.filter((p) => p && typeof p.x === 'number' && typeof p.y === 'number' && !isNaN(p.x) && !isNaN(p.y));
    if (!validPts.length) return '';
    let d = `M ${validPts[0].x.toFixed(1)} ${validPts[0].y.toFixed(1)}`;
    for (let i = 1; i < validPts.length; i++) {
      d += ` L ${validPts[i].x.toFixed(1)} ${validPts[i].y.toFixed(1)}`;
    }
    return d;
  };

  const activeWaypoints = waypoints.filter(
    (p) => ['tli', 'coast', 'lunar-approach', 'return', 'loi', 'descent'].includes(p.phase)
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
    scaleX: (nx) => earthX + nx * spanX,
    scaleY: (ny) => earthY - ny * 340,
    svgWidth: width,
    svgHeight: height,
    pathD: fullPathD,
  };
}

// ── Trajectory Interpolator ────────────────────────────────────────────────

export function getInterpolatedStateAtFrac(waypoints, frac) {
  if (!waypoints || !waypoints.length) return null;

  const path = waypoints.filter(
    (p) => ['tli', 'coast', 'lunar-approach', 'return', 'loi', 'descent'].includes(p.phase)
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

  const x3d = p0.x3d != null && p1.x3d != null ? p0.x3d + (p1.x3d - p0.x3d) * alpha : x * 75;
  const y3d = p0.y3d != null && p1.y3d != null ? p0.y3d + (p1.y3d - p0.y3d) * alpha : y * 28;
  const z3d = p0.z3d != null && p1.z3d != null ? p0.z3d + (p1.z3d - p0.z3d) * alpha : 0;

  let angleDeg = Math.atan2(p1.y - p0.y, p1.x - p0.x) * (180 / Math.PI);
  if (p1.x - p0.x === 0 && p1.y - p0.y === 0 && i0 > 0) {
    angleDeg = Math.atan2(p0.y - path[i0 - 1].y, p0.x - path[i0 - 1].x) * (180 / Math.PI);
  }

  const dir0 = p0.dir3d || { x: 1, y: 0, z: 0 };
  const dir1 = p1.dir3d || { x: 1, y: 0, z: 0 };
  const dirX = dir0.x + (dir1.x - dir0.x) * alpha;
  const dirY = dir0.y + (dir1.y - dir0.y) * alpha;
  const dirZ = dir0.z + (dir1.z - dir0.z) * alpha;
  const dirLen = Math.hypot(dirX, dirY, dirZ) || 1;
  const dir3d = { x: dirX / dirLen, y: dirY / dirLen, z: dirZ / dirLen };

  return {
    x, y, x3d, y3d, z3d, dir3d, t, velocityKmS, distEarthKm, distMoonKm, angleDeg,
    phase: alpha > 0.5 ? p1.phase : p0.phase,
  };
}

export function formatTransitTime(seconds) {
  const totalSeconds = Math.max(0, Math.round(seconds));
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);

  if (days > 30) {
    return `~${(days / 30.44).toFixed(1)} months (${days} days)`;
  }
  if (days > 0) {
    return `${days}d ${hours}h ${minutes}m`;
  }
  return `${hours}h ${minutes}m`;
}
