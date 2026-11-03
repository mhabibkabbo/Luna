/**
 * @file plannerEngine.js
 * Scientific evaluation engine for the Landing Window Planner.
 * Evaluates candidate landing sites across a full mission duration (not just touchdown)
 * using real celestial ephemeris, LOLA DEM horizons, and Diviner thermal models.
 */

import { computeCelestialState, solarPosition } from './lunarEphemeris.js';
import { getLunarTemperature } from './lunarThermal.js';
import { evaluateEarthLink, DEFAULT_DTE_CONSTRAINTS } from './earthLink.js';
import { HORIZON_TABLE, horizonAt } from './horizons.js';

export const DEFAULT_PLANNER_CONSTRAINTS = {
  minSunlitHours: 72, // At least 72 hours of continuous daylight
  maxSlopeDeg: 10.0, // Lander footpad tilt limit (standard 10°)
  requireDTE: true, // Mandatory Direct-to-Earth communication
  minTempC: -190, // Minimum operational mechanism temperature
  maxTempC: 125, // Maximum surface temperature limit
  minSolarElevAtTouchdown: 1.0, // Minimum approach solar elevation
};

export function evaluateCandidateForMissionWindow(candidate, landingMs, durationDays, constraints = DEFAULT_PLANNER_CONSTRAINTS) {
  const durationMs = durationDays * 86400000;
  const numSteps = Math.max(16, Math.min(48, Math.round(durationDays * 3))); // 3 samples per day
  const stepMs = durationMs / numSteps;

  // 1. Touchdown Evaluation (t0)
  const state0 = computeCelestialState(landingMs);
  const solFlat0 = solarPosition(state0, candidate.lat, candidate.lon);
  const terrainHorizon0 = horizonAt(HORIZON_TABLE, candidate.id, solFlat0.azimuthDeg) ?? (Math.abs(candidate.lat) > 80 ? 2.5 : 0.0);
  const sol0 = solarPosition(state0, candidate.lat, candidate.lon, terrainHorizon0);
  const thermal0 = getLunarTemperature(candidate.lat, candidate.lon, new Date(landingMs));

  const dte0 = candidate.isFarSide
    ? { isLinked: false, elevationDeg: -90, marginDeg: -90, reason: 'farside' }
    : evaluateEarthLink({
        state: state0,
        moonFeature: candidate,
        earthFeature: null,
        constraints: DEFAULT_DTE_CONSTRAINTS,
        terrainFn: (az) => horizonAt(HORIZON_TABLE, candidate.id, az),
      });

  const isDteLinked0 = candidate.isFarSide ? false : dte0.isLinked;

  // 2. Mission Duration Sweep (t0 -> t0 + duration)
  let sunlitSteps = 0;
  let dteSteps = 0;
  let currentSunlitStreak = 0;
  let maxSunlitStreak = 0;
  let currentDarkStreak = 0;
  let maxDarkStreak = 0;
  let currentBlackoutStreak = 0;
  let maxBlackoutStreak = 0;

  let minTemp = thermal0.tempC;
  let maxTemp = thermal0.tempC;

  for (let k = 0; k <= numSteps; k++) {
    const t = landingMs + k * stepMs;
    const stateK = computeCelestialState(t);
    const solFlatK = solarPosition(stateK, candidate.lat, candidate.lon);
    const thHoriz = horizonAt(HORIZON_TABLE, candidate.id, solFlatK.azimuthDeg) ?? (Math.abs(candidate.lat) > 80 ? 2.5 : 0.0);
    const solK = solarPosition(stateK, candidate.lat, candidate.lon, thHoriz);
    const thermK = getLunarTemperature(candidate.lat, candidate.lon, new Date(t));

    minTemp = Math.min(minTemp, thermK.tempC);
    maxTemp = Math.max(maxTemp, thermK.tempC);

    const isSunlitK = solK.isSunlit && (solK.elevationDeg - thHoriz) > 0;
    if (isSunlitK) {
      sunlitSteps++;
      currentSunlitStreak++;
      currentDarkStreak = 0;
      if (currentSunlitStreak > maxSunlitStreak) maxSunlitStreak = currentSunlitStreak;
    } else {
      currentDarkStreak++;
      currentSunlitStreak = 0;
      if (currentDarkStreak > maxDarkStreak) maxDarkStreak = currentDarkStreak;
    }

    let isLinkedK = false;
    if (!candidate.isFarSide) {
      const dteK = evaluateEarthLink({
        state: stateK,
        moonFeature: candidate,
        earthFeature: null,
        constraints: DEFAULT_DTE_CONSTRAINTS,
        terrainFn: (az) => horizonAt(HORIZON_TABLE, candidate.id, az),
      });
      isLinkedK = dteK.isLinked;
    }

    if (isLinkedK) {
      dteSteps++;
      currentBlackoutStreak = 0;
    } else {
      currentBlackoutStreak++;
      if (currentBlackoutStreak > maxBlackoutStreak) maxBlackoutStreak = currentBlackoutStreak;
    }
  }

  const hoursPerStep = (durationDays * 24) / numSteps;
  const sunlitRatio = Math.round((sunlitSteps / (numSteps + 1)) * 100);
  const dteUptimeRatio = candidate.isFarSide ? 0 : Math.round((dteSteps / (numSteps + 1)) * 100);
  const longestSunlitHours = Math.round(maxSunlitStreak * hoursPerStep);
  const longestDarkHours = Math.round(maxDarkStreak * hoursPerStep);
  const longestBlackoutHours = Math.round(maxBlackoutStreak * hoursPerStep);

  // 3. Constraints Validation
  const violations = [];

  if (constraints.requireDTE && dteUptimeRatio < 5) {
    violations.push({
      type: 'dte_blocked',
      severity: 'critical',
      label: 'Direct-to-Earth Telemetry Unavailable',
      detail: candidate.isFarSide
        ? 'Located on lunar farside with 0% line-of-sight to Earth. Requires dedicated orbital relay satellite (e.g. Queqiao / Lunar Gateway).'
        : `Earth line-of-sight obstructed by topography (availability only ${dteUptimeRatio}%).`,
    });
  }

  if (candidate.slopeDeg > constraints.maxSlopeDeg) {
    violations.push({
      type: 'slope_excessive',
      severity: 'critical',
      label: 'Terrain Slope Exceeds Lander Footpad Limit',
      detail: `Local LOLA DEM slope of ${candidate.slopeDeg}° exceeds maximum limit of ${constraints.maxSlopeDeg}°. Rollover hazard during touchdown.`,
    });
  }

  if (longestSunlitHours < constraints.minSunlitHours) {
    violations.push({
      type: 'insolation_insufficient',
      severity: 'warning',
      label: 'Continuous Sunlight Below Power Threshold',
      detail: `Longest continuous sunlit window (${longestSunlitHours}h) is below required ${constraints.minSunlitHours}h mission duration threshold.`,
    });
  }

  if (minTemp < constraints.minTempC) {
    violations.push({
      type: 'thermal_cryogenic',
      severity: 'critical',
      label: 'Extreme Cryogenic Night Exceeds Thermal Limit',
      detail: `Minimum surface temperature reaches ${minTemp}°C, breaching the lander survival threshold of ${constraints.minTempC}°C.`,
    });
  }

  if (sol0.elevationDeg < constraints.minSolarElevAtTouchdown) {
    violations.push({
      type: 'touchdown_shadow',
      severity: 'warning',
      label: 'Sub-Optimal Solar Elevation at Touchdown',
      detail: `Sun elevation at touchdown is ${sol0.elevationDeg.toFixed(1)}° (below the ${constraints.minSolarElevAtTouchdown}° approach visibility requirement).`,
    });
  }

  // 4. Scoring (0 to 100)
  const isCompliant = violations.filter((v) => v.severity === 'critical').length === 0;

  const sunlitScore = Math.min(100, Math.round((sunlitRatio / 85) * 100));
  const dteScore = candidate.isFarSide ? (constraints.requireDTE ? 0 : 50) : dteUptimeRatio;
  const slopeScore = Math.max(0, Math.round(100 - (candidate.slopeDeg / 15) * 100));
  const thermalSpan = Math.abs(maxTemp - minTemp);
  const thermalScore = Math.max(10, Math.round(100 - (thermalSpan / 300) * 90));

  let overallScore = 0;
  if (isCompliant) {
    overallScore = Math.round(
      sunlitScore * 0.35 +
      dteScore * 0.30 +
      slopeScore * 0.20 +
      thermalScore * 0.15
    );
    // Slight penalty if any warning-level violation exists
    if (violations.length > 0) overallScore = Math.max(20, overallScore - 12);
  } else {
    overallScore = Math.max(5, Math.round((slopeScore + thermalScore) * 0.15));
  }

  let tier = 'Disqualified';
  let tierLabel = 'Constraint Violation';
  let tierColor = 'text-rose-400 bg-rose-950/60 border-rose-800/80';

  if (isCompliant) {
    if (overallScore >= 80) {
      tier = 'tier-1';
      tierLabel = 'Primary Target Recommendation';
      tierColor = 'text-cyan-300 bg-cyan-950/80 border-cyan-500/80';
    } else if (overallScore >= 60) {
      tier = 'tier-2';
      tierLabel = 'Viable Candidate';
      tierColor = 'text-emerald-300 bg-emerald-950/80 border-emerald-500/80';
    } else {
      tier = 'tier-3';
      tierLabel = 'Marginal / Contingency';
      tierColor = 'text-amber-300 bg-amber-950/80 border-amber-500/80';
    }
  }

  // 5. Evidence-based scientific rationale
  const reasonsWhy = [];
  const operationalRisks = [];

  if (sunlitRatio >= 75) {
    reasonsWhy.push(`Excellent solar insolation: Sunlit for ${sunlitRatio}% (${longestSunlitHours}h continuous) of the ${durationDays}-day flight window.`);
  } else if (sunlitRatio >= 45) {
    reasonsWhy.push(`Adequate daylight window (${longestSunlitHours}h) sufficient for primary surface exploration objectives.`);
  }

  if (dteUptimeRatio >= 90) {
    reasonsWhy.push(`Continuous Direct-to-Earth communication link (${dteUptimeRatio}% uptime) with zero prolonged blackout.`);
  } else if (dteUptimeRatio > 0 && !candidate.isFarSide) {
    reasonsWhy.push(`Intermittent Direct-to-Earth coverage (${dteUptimeRatio}% uptime) synchronized with lunar libration cycles.`);
  }

  if (candidate.slopeDeg <= 5.0) {
    reasonsWhy.push(`Gentle topography: Average slope of ${candidate.slopeDeg}° minimizes touchdown tipping hazard for landing pads.`);
  }

  if (candidate.elevationM > 3000) {
    reasonsWhy.push(`Elevated ridge/plateau (+${candidate.elevationM.toLocaleString()}m LOLA elevation) rises above surrounding topographic horizons.`);
  }

  // Risks
  if (longestDarkHours > 48) {
    operationalRisks.push(`Extended lunar night/shadow interval of ${longestDarkHours}h requires substantial battery reserve or radioisotope power.`);
  }

  if (minTemp < -150) {
    operationalRisks.push(`Cryogenic environment drops to ${minTemp}°C; cold-welding and mechanism grease freeze hazards.`);
  }

  if (candidate.slopeDeg > 7.0) {
    operationalRisks.push(`Locally steep terrain (${candidate.slopeDeg}° slope) requires hazard-detection LiDAR for autonomous terminal guidance.`);
  }

  if (candidate.isFarSide) {
    operationalRisks.push(`Requires active relay satellite (e.g. Queqiao / Gateway). No direct ground telemetry.`);
  } else if (dte0.elevationDeg < 4.0 && !candidate.isFarSide) {
    operationalRisks.push(`Earth is low on the local horizon (${dte0.elevationDeg.toFixed(1)}°); grazing radio signal vulnerable to crater rim diffraction.`);
  }

  return {
    candidate,
    isCompliant,
    overallScore,
    tier,
    tierLabel,
    tierColor,
    violations,
    scoreBreakdown: {
      sunlitScore,
      dteScore,
      slopeScore,
      thermalScore,
    },
    touchdown: {
      dateString: new Date(landingMs).toUTCString(),
      sunElevationDeg: sol0.elevationDeg,
      sunAzimuthDeg: sol0.azimuthDeg,
      terrainHorizonDeg: terrainHorizon0,
      isSunlit: sol0.isSunlit && (sol0.elevationDeg - terrainHorizon0) > 0,
      surfaceTempC: thermal0.tempC,
      surfaceTempK: thermal0.tempK,
      isDteLinked: isDteLinked0,
      earthElevationDeg: dte0.elevationDeg,
      earthMarginDeg: dte0.marginDeg,
    },
    durationOutlook: {
      durationDays,
      sunlitRatio,
      longestSunlitHours,
      longestDarkHours,
      dteUptimeRatio,
      longestBlackoutHours,
      minSurfaceTempC: minTemp,
      maxSurfaceTempC: maxTemp,
    },
    scientificRationale: {
      reasonsWhy,
      operationalRisks,
    },
  };
}

export function rankLandingCandidates(candidates, landingMs, durationDays, constraints = DEFAULT_PLANNER_CONSTRAINTS) {
  const evaluations = candidates.map((cand) =>
    evaluateCandidateForMissionWindow(cand, landingMs, durationDays, constraints)
  );

  // Sort compliant first (by overallScore desc), then non-compliant (by overallScore desc)
  evaluations.sort((a, b) => {
    if (a.isCompliant && !b.isCompliant) return -1;
    if (!a.isCompliant && b.isCompliant) return 1;
    return b.overallScore - a.overallScore;
  });

  return evaluations;
}
