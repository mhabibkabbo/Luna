/**
 * Scientific evaluation engine for the Landing Window Planner.
 * Evaluates candidate landing sites across a full mission duration (not just touchdown)
 * using real celestial ephemeris, LOLA DEM horizons, and Diviner thermal models.
 */

import { computeCelestialState, solarPosition } from './lunarEphemeris.js';
import { getLunarTemperature, classifySolarLightingState } from './lunarThermal.js';
import { evaluateEarthLink, DEFAULT_DTE_CONSTRAINTS } from './earthLink.js';
import {
  HORIZON_TABLE,
  horizonAt,
  sampleLunarTerrainMetrics,
  ensurePolarDemLoaded,
  subscribePolarDemReady,
} from './horizons.js';
import {
  computeTerrainSuitability,
  computeSolarSuitability,
  computeCommunicationSuitability,
  computeThermalSuitability,
  computeOverallSuitability,
  DEFAULT_STEP_HOURS,
} from './suitabilityScoring.js';

ensurePolarDemLoaded();

const MAX_PHYSICS_CACHE_ENTRIES = 256;
const WINDOW_PHYSICS_CACHE = new Map();
let demCacheGeneration = 0;
subscribePolarDemReady(() => {
  demCacheGeneration += 1;
  WINDOW_PHYSICS_CACHE.clear();
});

function setCachedWindowPhysics(key, value) {
  if (WINDOW_PHYSICS_CACHE.has(key)) {
    WINDOW_PHYSICS_CACHE.delete(key);
  } else if (WINDOW_PHYSICS_CACHE.size >= MAX_PHYSICS_CACHE_ENTRIES) {
    const oldestKey = WINDOW_PHYSICS_CACHE.keys().next().value;
    if (oldestKey !== undefined) {
      WINDOW_PHYSICS_CACHE.delete(oldestKey);
    }
  }
  WINDOW_PHYSICS_CACHE.set(key, value);
  return value;
}

export const DEFAULT_PLANNER_CONSTRAINTS = {
  minSunlitHours: 72, // At least 72 hours of continuous daylight
  minSunlitPct: 50, // Minimum solar availability percentage
  minDtePct: 35, // Minimum Direct-to-Earth visibility percentage (accounts for 27.2d polar libration cycle)
  maxSlopeDeg: 10.0, // Lander footpad tilt limit (standard 10°)
  requireDTE: true, // Mandatory Direct-to-Earth communication
  minTempC: -190, // Minimum operational mechanism temperature
  maxTempC: 125, // Maximum surface temperature limit
  minSolarElevAtTouchdown: 0.5, // Minimum approach solar clearance above local horizon
  weights: {
    sun: 0.35,
    dte: 0.30,
    slope: 0.20,
    thermal: 0.15,
  },
};

/**
 * Normalizes landing timestamp, duration, and constraint options for mission planning sweeps.
 * @internal Test & sweep arguments normalization helper export.
 */
export function normalizeMissionWindowArgs(
  landingMsOrOpts,
  durationDaysArg,
  constraintsArg = DEFAULT_PLANNER_CONSTRAINTS
) {
  let rawLanding = landingMsOrOpts;
  let rawDuration = durationDaysArg;
  let rawConstraints = constraintsArg;

  if (
    landingMsOrOpts &&
    typeof landingMsOrOpts === 'object' &&
    !(landingMsOrOpts instanceof Date)
  ) {
    rawLanding =
      landingMsOrOpts.landingTimeMs ??
      landingMsOrOpts.landingMs ??
      landingMsOrOpts.epochMs ??
      landingMsOrOpts.startMs;
    rawDuration =
      landingMsOrOpts.missionDurationDays ??
      landingMsOrOpts.durationDays ??
      durationDaysArg ??
      14;
    const baseConstraints =
      landingMsOrOpts.constraints && typeof landingMsOrOpts.constraints === 'object'
        ? landingMsOrOpts.constraints
        : landingMsOrOpts;
    rawConstraints = {
      ...DEFAULT_PLANNER_CONSTRAINTS,
      ...(constraintsArg && typeof constraintsArg === 'object' ? constraintsArg : {}),
      ...baseConstraints,
      weights: {
        ...DEFAULT_PLANNER_CONSTRAINTS.weights,
        ...(constraintsArg?.weights || {}),
        ...(baseConstraints?.weights || {}),
      },
    };
  } else {
    rawConstraints = {
      ...DEFAULT_PLANNER_CONSTRAINTS,
      ...(constraintsArg && typeof constraintsArg === 'object' ? constraintsArg : {}),
      weights: {
        ...DEFAULT_PLANNER_CONSTRAINTS.weights,
        ...(constraintsArg?.weights || {}),
      },
    };
  }

  let safeLandingMs = Date.now();
  if (typeof rawLanding === 'number' && Number.isFinite(rawLanding)) {
    safeLandingMs = rawLanding;
  } else if (rawLanding instanceof Date && Number.isFinite(rawLanding.getTime())) {
    safeLandingMs = rawLanding.getTime();
  } else if (typeof rawLanding === 'string' && rawLanding.trim() !== '') {
    const parsed = Date.parse(rawLanding);
    if (Number.isFinite(parsed)) {
      safeLandingMs = parsed;
    } else if (Number.isFinite(Number(rawLanding))) {
      safeLandingMs = Number(rawLanding);
    }
  }

  const parsedDuration = Number(rawDuration);
  const safeDurationDays =
    Number.isFinite(parsedDuration) && parsedDuration > 0 ? parsedDuration : 14;

  return {
    safeLandingMs,
    safeDurationDays,
    constraints: rawConstraints,
  };
}

function simulateCandidateWindowPhysics({
  siteId,
  name,
  lat,
  lon,
  slopeDeg,
  elevationM,
  roughnessM,
  isFarSideSite,
  safeLandingMs,
  safeDurationDays,
  stepHours,
}) {
  const cacheKey = `${demCacheGeneration}|${siteId}|${lat.toFixed(5)}|${lon.toFixed(5)}|${
    isFarSideSite ? 1 : 0
  }|${slopeDeg ?? 'n'}|${elevationM ?? 'n'}|${safeLandingMs}|${safeDurationDays}|${stepHours}`;
  const cached = WINDOW_PHYSICS_CACHE.get(cacheKey);
  if (cached) {
    return cached;
  }

  const durationMs = safeDurationDays * 86400000;
  const numSteps = Math.max(16, Math.round((safeDurationDays * 24) / stepHours));
  const stepMs = durationMs / numSteps;

  const state0 = computeCelestialState(safeLandingMs);
  const solFlat0 = solarPosition(state0, lat, lon);
  const rawHorizon0 = horizonAt(HORIZON_TABLE, siteId, solFlat0.azimuthDeg, lat, lon);
  const isHorizonModeled = rawHorizon0 !== null && Number.isFinite(rawHorizon0);
  const terrainHorizon0 = isHorizonModeled ? rawHorizon0 : 0.0;
  const sol0 = solarPosition(state0, lat, lon, terrainHorizon0);
  const thermal0 = getLunarTemperature(lat, lon, new Date(safeLandingMs), {
    terrainHorizonDeg: terrainHorizon0,
    elevationM,
  });
  const lightingState0 = classifySolarLightingState({
    sunStatus: sol0.status,
    solarElevationDeg: sol0.elevationDeg,
    terrainHorizonDeg: terrainHorizon0,
    isDaylight: thermal0.isDaylight,
    isTerrainShadowed: thermal0.isTerrainShadowed,
    isPSR: thermal0.isPSR,
  });

  const moonFeatureObj = {
    id: siteId,
    name: name || 'Candidate Site',
    latitude: lat,
    longitude: lon,
    elevationM: elevationM ?? 0,
  };

  const terrainFn = (az) => horizonAt(HORIZON_TABLE, siteId, az, lat, lon);

  const dte0 = isFarSideSite
    ? { isLinked: false, status: 'away', elevationDeg: -90, marginDeg: -90, reason: 'farside' }
    : evaluateEarthLink({
        state: state0,
        moonFeature: moonFeatureObj,
        earthFeature: null,
        constraints: DEFAULT_DTE_CONSTRAINTS,
        terrainFn,
      });

  const isDteLinked0 = isFarSideSite
    ? false
    : Boolean(dte0.isLinked || dte0.status === 'clear' || dte0.status === 'doubtful');

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

  const wholeDays = Math.min(60, Math.max(1, Math.round(safeDurationDays)));
  const dailyBuckets =
    safeDurationDays <= 60
      ? Array.from({ length: wholeDays }, () => ({
          steps: 0,
          sunSteps: 0,
          dteSteps: 0,
          minTemp: Infinity,
          maxTemp: -Infinity,
        }))
      : null;

  for (let k = 0; k <= numSteps; k++) {
    const t = safeLandingMs + k * stepMs;
    const stateK = computeCelestialState(t);
    const solFlatK = solarPosition(stateK, lat, lon);
    const rawHorizK = terrainFn(solFlatK.azimuthDeg);
    const thHoriz = rawHorizK !== null && Number.isFinite(rawHorizK) ? rawHorizK : 0.0;
    const solK = solarPosition(stateK, lat, lon, thHoriz);
    const thermK = getLunarTemperature(lat, lon, new Date(t), {
      terrainHorizonDeg: thHoriz,
      elevationM,
    });

    minTemp = Math.min(minTemp, thermK.tempC);
    maxTemp = Math.max(maxTemp, thermK.tempC);

    const isSunlitK = solK.status === 'sunlit';
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
    if (!isFarSideSite) {
      const dteK = evaluateEarthLink({
        state: stateK,
        moonFeature: moonFeatureObj,
        earthFeature: null,
        constraints: DEFAULT_DTE_CONSTRAINTS,
        terrainFn,
      });
      isLinkedK = Boolean(dteK.isLinked || dteK.status === 'clear' || dteK.status === 'doubtful');
    }

    if (isLinkedK) {
      dteSteps++;
      currentBlackoutStreak = 0;
    } else {
      currentBlackoutStreak++;
      if (currentBlackoutStreak > maxBlackoutStreak) maxBlackoutStreak = currentBlackoutStreak;
    }

    if (dailyBuckets && k < numSteps) {
      const dayIdx = Math.min(wholeDays - 1, Math.floor((k * stepMs) / 86400000));
      const b = dailyBuckets[dayIdx];
      b.steps += 1;
      if (isSunlitK) b.sunSteps += 1;
      if (isLinkedK) b.dteSteps += 1;
      if (thermK.tempC < b.minTemp) b.minTemp = thermK.tempC;
      if (thermK.tempC > b.maxTemp) b.maxTemp = thermK.tempC;
    }
  }

  const hoursPerStep = (safeDurationDays * 24) / numSteps;
  const sunlitRatio = Math.round((sunlitSteps / (numSteps + 1)) * 100);
  const dteUptimeRatio = isFarSideSite ? 0 : Math.round((dteSteps / (numSteps + 1)) * 100);
  const longestSunlitHours = Math.round(maxSunlitStreak * hoursPerStep);
  const longestDarkHours = Math.round(maxDarkStreak * hoursPerStep);
  const longestBlackoutHours = Math.round(maxBlackoutStreak * hoursPerStep);

  const terrainScore = computeTerrainSuitability(slopeDeg, roughnessM);
  const dailyScores = dailyBuckets
    ? dailyBuckets.map((b, dayIdx) => {
        const denom = Math.max(1, b.steps);
        const daySunPct = Math.round((b.sunSteps / denom) * 100);
        const dayDsnPct = isFarSideSite ? 0 : Math.round((b.dteSteps / denom) * 100);
        const dMinT = Number.isFinite(b.minTemp) ? b.minTemp : thermal0.tempC;
        const dMaxT = Number.isFinite(b.maxTemp) ? b.maxTemp : thermal0.tempC;
        const daySolar = computeSolarSuitability(
          daySunPct,
          Math.max(0, 24 * (1 - b.sunSteps / denom)),
          24
        );
        const dayComm = computeCommunicationSuitability(
          dayDsnPct,
          Math.max(0, 24 * (1 - b.dteSteps / denom)),
          24,
          isFarSideSite
        );
        const dayThermal = computeThermalSuitability(dMinT + 273.15, Math.max(0, dMaxT - dMinT));
        const dayOverall = computeOverallSuitability({
          solarSuitability: daySolar,
          commSuitability: dayComm,
          terrainSuitability: terrainScore,
          thermalSuitability: dayThermal,
          slopeDeg,
        });
        const dayScore =
          dayOverall.overallScore !== null
            ? dayOverall.overallScore
            : dayOverall.partialScore ?? Math.round(daySolar * 0.45 + dayComm * 0.35 + dayThermal * 0.2);
        return {
          day: dayIdx + 1,
          score: dayScore,
          sunlitPct: daySunPct,
          dsnPct: dayDsnPct,
        };
      })
    : null;

  return setCachedWindowPhysics(cacheKey, {
    sol0,
    thermal0,
    terrainHorizon0,
    isHorizonModeled,
    lightingState0,
    dte0,
    isDteLinked0,
    minTemp,
    maxTemp,
    sunlitRatio,
    dteUptimeRatio,
    longestSunlitHours,
    longestDarkHours,
    longestBlackoutHours,
    dailyScores,
  });
}

export function evaluateCandidateForMissionWindow(
  candidate,
  landingMsOrOpts,
  durationDaysArg,
  constraintsArg = DEFAULT_PLANNER_CONSTRAINTS
) {
  const { safeLandingMs, safeDurationDays, constraints } = normalizeMissionWindowArgs(
    landingMsOrOpts,
    durationDaysArg,
    constraintsArg
  );
  const stepHours = constraints.stepHours ?? DEFAULT_STEP_HOURS;

  const lat = candidate.lat ?? candidate.latitude ?? -85.9;
  const lon = candidate.lon ?? candidate.longitude ?? 0.0;
  const wrappedLon = ((((lon + 180) % 360) + 360) % 360) - 180;
  const isFarSideSite =
    typeof candidate.isFarSide === 'boolean'
      ? candidate.isFarSide
      : Math.abs(wrappedLon) > 90 && Math.abs(lat) < 75;
  const siteId = candidate.id || `cand-${lat.toFixed(2)}-${lon.toFixed(2)}`;
  const sampledMetrics = sampleLunarTerrainMetrics(lat, lon, candidate);

  const rawSlope =
    typeof candidate.slopeDeg === 'number' && Number.isFinite(candidate.slopeDeg)
      ? candidate.slopeDeg
      : sampledMetrics.slopeDeg;
  const slopeDeg = typeof rawSlope === 'number' && Number.isFinite(rawSlope) ? rawSlope : null;
  const hasSlopeData = slopeDeg !== null;

  const rawElevation =
    typeof candidate.elevationM === 'number' && Number.isFinite(candidate.elevationM)
      ? candidate.elevationM
      : typeof candidate.elevationMeters === 'number' && Number.isFinite(candidate.elevationMeters)
      ? candidate.elevationMeters
      : sampledMetrics.elevationM;
  const elevationM =
    typeof rawElevation === 'number' && Number.isFinite(rawElevation) ? rawElevation : null;
  const hasElevationData = elevationM !== null;

  const rawRoughness =
    typeof candidate.roughnessM === 'number' && Number.isFinite(candidate.roughnessM)
      ? candidate.roughnessM
      : sampledMetrics.roughnessM;
  const roughnessM =
    typeof rawRoughness === 'number' && Number.isFinite(rawRoughness) ? rawRoughness : null;

  const {
    sol0,
    thermal0,
    terrainHorizon0,
    isHorizonModeled,
    lightingState0,
    dte0,
    isDteLinked0,
    minTemp,
    maxTemp,
    sunlitRatio,
    dteUptimeRatio,
    longestSunlitHours,
    longestDarkHours,
    longestBlackoutHours,
    dailyScores,
  } = simulateCandidateWindowPhysics({
    siteId,
    name: candidate.name,
    lat,
    lon,
    slopeDeg,
    elevationM,
    roughnessM,
    isFarSideSite,
    safeLandingMs,
    safeDurationDays,
    stepHours,
  });

  const violations = [];
  const minDteTarget = constraints.minDtePct ?? 5;
  const minSunPctTarget = constraints.minSunlitPct ?? 0;

  if (constraints.requireDTE && dteUptimeRatio < Math.max(5, minDteTarget)) {
    violations.push({
      type: 'dte_blocked',
      severity: dteUptimeRatio < 10 ? 'critical' : 'warning',
      label: 'Direct-to-Earth Telemetry Below Threshold',
      detail: isFarSideSite
        ? 'Located on lunar farside with 0% line-of-sight to Earth. Requires dedicated orbital relay satellite (e.g. Queqiao / Lunar Gateway).'
        : `Earth line-of-sight availability (${dteUptimeRatio}%) is below configured ${Math.max(5, minDteTarget)}% requirement.`,
    });
  }

  if (hasSlopeData && slopeDeg > constraints.maxSlopeDeg) {
    violations.push({
      type: 'slope_excessive',
      severity: 'critical',
      label: 'Terrain Slope Exceeds Lander Footpad Limit',
      detail: `Local LOLA DEM slope of ${slopeDeg.toFixed(1)}° exceeds maximum limit of ${constraints.maxSlopeDeg}°. Rollover hazard during touchdown.`,
    });
  }

  if (longestSunlitHours < constraints.minSunlitHours || sunlitRatio < minSunPctTarget) {
    violations.push({
      type: 'insolation_insufficient',
      severity: 'warning',
      label: 'Solar Illumination Below Power Threshold',
      detail: `Continuous sunlit window (${longestSunlitHours}h, ${sunlitRatio}%) is below required threshold (${constraints.minSunlitHours}h / ${minSunPctTarget}%).`,
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

  const effectiveTouchdownSolarElev = sol0.elevationDeg - Math.min(0, terrainHorizon0);
  if (effectiveTouchdownSolarElev < constraints.minSolarElevAtTouchdown) {
    const isTerrainBlockedPos = lightingState0.isTerrainShadowed;
    violations.push({
      type: 'touchdown_shadow',
      severity: 'warning',
      label: isTerrainBlockedPos
        ? 'Terrain-Shadowed Touchdown'
        : 'Sub-Optimal Solar Elevation at Touchdown',
      detail: isTerrainBlockedPos
        ? `Sun is +${sol0.elevationDeg.toFixed(1)}° above astronomical horizon, blocked by ${terrainHorizon0.toFixed(1)}° local topography (below ${constraints.minSolarElevAtTouchdown}° clearance threshold).`
        : `Sun elevation at touchdown is ${sol0.elevationDeg.toFixed(1)}° (below astronomical / ${constraints.minSolarElevAtTouchdown}° approach visibility requirement).`,
    });
  } else if (sol0.status === 'blocked' || lightingState0.isTerrainShadowed) {
    violations.push({
      type: 'touchdown_shadow',
      severity: 'warning',
      label: 'Terrain-Shadowed Touchdown (Rim Occultation)',
      detail: `Sun is ${sol0.elevationDeg >= 0 ? '+' : ''}${sol0.elevationDeg.toFixed(1)}° above astronomical horizon but occluded by ${terrainHorizon0.toFixed(1)}° local topography.`,
    });
  }

  const rawWeights = constraints.weights || DEFAULT_PLANNER_CONSTRAINTS.weights;
  const wSum =
    (rawWeights.sun ?? rawWeights.solar ?? 0.35) +
    (rawWeights.dte ?? rawWeights.communication ?? 0.30) +
    (rawWeights.slope ?? rawWeights.terrain ?? 0.20) +
    (rawWeights.thermal ?? 0.15) || 1;
  const wSun = (rawWeights.sun ?? rawWeights.solar ?? 0.35) / wSum;
  const wDte = (rawWeights.dte ?? rawWeights.communication ?? 0.30) / wSum;
  const wSlope = (rawWeights.slope ?? rawWeights.terrain ?? 0.20) / wSum;
  const wThermal = (rawWeights.thermal ?? 0.15) / wSum;

  const criticalViolationCount = violations.filter((v) => v.severity === 'critical').length;
  const isCompliant = violations.length === 0;

  const totalHours = safeDurationDays * 24;
  const tempVariationC = maxTemp - minTemp;

  const slopeScore = computeTerrainSuitability(
    slopeDeg,
    candidate.roughnessM ?? sampledMetrics.roughnessM ?? null
  );
  const sunlitScore = computeSolarSuitability(
    sunlitRatio,
    longestDarkHours,
    totalHours
  );
  const dteScore = computeCommunicationSuitability(
    dteUptimeRatio,
    longestBlackoutHours,
    totalHours,
    isFarSideSite
  );
  const thermalScore = computeThermalSuitability(
    minTemp + 273.15,
    tempVariationC
  );

  const overall = computeOverallSuitability({
    solarSuitability: sunlitScore,
    commSuitability: dteScore,
    terrainSuitability: slopeScore,
    thermalSuitability: thermalScore,
    weights: rawWeights,
    slopeDeg,
  });

  const isPartialScore = overall.isPartialScore;
  const overallScore = overall.overallScore !== null ? overall.overallScore : overall.partialScore;
  const formulaString = overall.formulaString;
  const isFullyCompliant = isCompliant && !isPartialScore;
  const isConditionalCompliant = isCompliant && isPartialScore;

  const hasHighResCoverage = Math.abs(lat) >= 80 || Boolean(HORIZON_TABLE?.[siteId]);
  let suitabilityOutcome = 'Challenging';
  let tier = 'Disqualified';
  let tierLabel = 'Constraint Violation / Disqualified';
  let tierColor = 'text-rose-400 bg-rose-950/60 border-rose-800/80';

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    suitabilityOutcome = 'Insufficient Data';
    tierLabel = 'Insufficient Data';
    tierColor = 'text-slate-300 bg-slate-900 border-slate-700';
  } else if (isFullyCompliant) {
    if (overallScore >= 75) {
      suitabilityOutcome = 'Favorable';
      tier = 'tier-1';
      tierLabel = 'Fully Compliant · Primary Target';
      tierColor = 'text-cyan-300 bg-cyan-950/80 border-cyan-500/80';
    } else if (overallScore >= 50) {
      suitabilityOutcome = 'Conditional';
      tier = 'tier-2';
      tierLabel = 'Fully Compliant · Viable Window';
      tierColor = 'text-emerald-300 bg-emerald-950/80 border-emerald-500/80';
    } else {
      suitabilityOutcome = 'Challenging';
      tier = 'tier-3';
      tierLabel = 'Fully Compliant · Marginal Score';
      tierColor = 'text-amber-300 bg-amber-950/80 border-amber-500/80';
    }
  } else if (isConditionalCompliant) {
    suitabilityOutcome = 'Conditional';
    tier = 'tier-2';
    tierLabel = 'Partial Coverage (No DEM Slope)';
    tierColor = 'text-amber-300 bg-amber-950/80 border-amber-500/80';
  }

  const formulaBreakdown = {
    formulaString,
    weights: { wSun, wDte, wSlope, wThermal },
    hasHighResCoverage,
    hasSlopeData,
    isPartialScore,
    partialScoreNote: isPartialScore
      ? 'Terrain elevation & slope not present in loaded dataset (outside 80°S–90°S LOLA DEM). Score calculated from Solar, DTE, and Thermal dimensions only.'
      : null,
    suitabilityOutcome,
    provenance: {
      elevation: hasElevationData ? 'Measured Dataset (NASA LRO LOLA 400 m/px)' : 'Not present in loaded dataset',
      slope: hasSlopeData ? 'Calculated (Horn 3×3 Gradient on LOLA 400 m/px DEM)' : 'Not present in loaded dataset',
      horizon: isHorizonModeled
        ? 'Measured Dataset (LOLA DEM 360° Horizon Profile)'
        : 'Not present outside 80°S–90°S DEM (Geometric 0° horizon used)',
      illumination: 'Calculated (Meeus Ephemeris + Horizon Mask)',
      dte: 'Calculated (Topocentric Selenographic Libration + Horizon Mask)',
      thermal: 'Calculated (Analytical Radiative Balance Model — Diviner dataset not present)',
    },
    disclaimer:
      'Preliminary scientific trade-study indicator derived from LRO LOLA (400 m/px, 0.5 m vertical scale) & Meeus/IAU analytical ephemerides. Not a flight-certification guarantee.',
  };

  const reasonsWhy = [];
  const operationalRisks = [];

  if (sunlitRatio >= 75) {
    reasonsWhy.push(
      `High solar insolation: Sunlit for ${sunlitRatio}% (${longestSunlitHours}h continuous) of the ${safeDurationDays}-day window.`
    );
  } else if (sunlitRatio >= 45) {
    reasonsWhy.push(
      `Moderate daylight window (${longestSunlitHours}h continuous) supporting primary surface operations.`
    );
  }

  if (dteUptimeRatio >= 90) {
    reasonsWhy.push(
      `Continuous Direct-to-Earth visibility (${dteUptimeRatio}% uptime) with zero prolonged telemetry blackout.`
    );
  } else if (dteUptimeRatio > 0 && !isFarSideSite) {
    reasonsWhy.push(
      `Periodic Direct-to-Earth coverage (${dteUptimeRatio}% uptime) modulated by lunar libration.`
    );
  }

  if (hasSlopeData && slopeDeg <= 6.0) {
    reasonsWhy.push(
      `Gentle local topography: ${slopeDeg.toFixed(1)}° LOLA slope minimizes touchdown rollover hazard.`
    );
  }

  if (hasElevationData && elevationM > 2000) {
    reasonsWhy.push(
      `Elevated polar massif/ridge (+${elevationM.toLocaleString()} m) rises above surrounding horizon masks.`
    );
  }

  if (!hasSlopeData) {
    operationalRisks.push(
      'Local terrain slope & elevation not present in loaded dataset (site is north of 80°S LOLA South Pole DEM coverage).'
    );
  }

  if (longestDarkHours > 48) {
    operationalRisks.push(
      `Extended shadow interval (${longestDarkHours}h) requires cryogenic battery survival or RPS heating.`
    );
  }

  if (minTemp < -150) {
    operationalRisks.push(
      `Cryogenic surface regime reaches ${minTemp}°C (Calculated); actuator and seal thermal protection required.`
    );
  }

  if (hasSlopeData && slopeDeg > 8.0) {
    operationalRisks.push(
      `Local terrain gradient (${slopeDeg.toFixed(1)}°) requires terminal LiDAR hazard detection.`
    );
  }

  if (isFarSideSite) {
    operationalRisks.push(
      `Far-side hemisphere: 0% direct Earth visibility; requires relay satellite architecture.`
    );
  } else if (dte0.elevationDeg < 4.0) {
    operationalRisks.push(
      `Low grazing Earth elevation (${dte0.elevationDeg.toFixed(1)}°); RF link sensitive to local crater rim diffraction.`
    );
  }

  const dteStatus0 = isFarSideSite ? 'away' : dte0.status;

  return {
    id: siteId,
    slopeDeg,
    elevationM,
    roughnessM,
    sunlitRatio,
    dteUptimeRatio,
    slopeScore,
    formulaString: formulaBreakdown.formulaString,
    candidate: {
      ...candidate,
      id: siteId,
      lat,
      lon,
      latitude: lat,
      longitude: lon,
      isFarSide: isFarSideSite,
      slopeDeg,
      elevationM,
      roughnessM,
    },
    isCompliant,
    isFullyCompliant,
    isConditionalCompliant,
    criticalViolationCount,
    isPartialScore,
    overallScore,
    suitabilityOutcome,
    tier,
    tierLabel,
    tierColor,
    violations,
    formulaBreakdown,
    scoreBreakdown: {
      sunlitScore,
      dteScore,
      slopeScore,
      thermalScore,
    },
    touchdown: {
      dateString: new Date(safeLandingMs).toUTCString(),
      sunElevationDeg: sol0.elevationDeg,
      sunAzimuthDeg: sol0.azimuthDeg,
      terrainHorizonDeg: terrainHorizon0,
      isHorizonModeled,
      isSunlit: sol0.status === 'sunlit',
      solarStatus: sol0.status,
      lightingState: lightingState0,
      isTerrainShadowed: lightingState0.isTerrainShadowed,
      isPSR: lightingState0.isPSR,
      surfaceTempC: thermal0.tempC,
      surfaceTempK: thermal0.tempK,
      isDteLinked: isDteLinked0,
      dteStatus: dteStatus0,
      earthElevationDeg: dte0.elevationDeg,
      earthMarginDeg: dte0.marginDeg ?? 0,
    },
    instant: {
      isSunlit: sol0.status === 'sunlit',
      solarStatus: sol0.status,
      lightingState: lightingState0,
      isTerrainShadowed: lightingState0.isTerrainShadowed,
      isPSR: lightingState0.isPSR,
      sunElevationDeg: sol0.elevationDeg,
      sunAzimuthDeg: sol0.azimuthDeg,
      terrainHorizonDeg: terrainHorizon0,
      isDteLinked: isDteLinked0,
      dteStatus: dteStatus0,
      dteElevationDeg: dte0.elevationDeg,
      dteMarginDeg: dte0.marginDeg ?? 0,
      surfaceTempC: thermal0.tempC,
      surfaceTempK: thermal0.tempK,
    },
    terrain: {
      elevationM,
      slopeDeg,
      roughnessM,
      isHorizonModeled,
    },
    durationOutlook: {
      durationDays: safeDurationDays,
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
    ...(constraints.includeDailyBreakdown && dailyScores ? { dailyScores } : {}),
  };
}

export function rankLandingCandidates(
  candidates,
  landingMsOrOpts,
  durationDays,
  constraints = DEFAULT_PLANNER_CONSTRAINTS
) {
  const {
    safeLandingMs,
    safeDurationDays,
    constraints: normalizedConstraints,
  } = normalizeMissionWindowArgs(landingMsOrOpts, durationDays, constraints);

  const evaluations = candidates.map((cand) =>
    evaluateCandidateForMissionWindow(
      cand,
      safeLandingMs,
      safeDurationDays,
      normalizedConstraints
    )
  );

  evaluations.sort((a, b) => {
    if (a.isFullyCompliant !== b.isFullyCompliant) {
      return a.isFullyCompliant ? -1 : 1;
    }
    if (a.isCompliant !== b.isCompliant) {
      return a.isCompliant ? -1 : 1;
    }
    if (!a.isCompliant && !b.isCompliant && a.violations.length !== b.violations.length) {
      return a.violations.length - b.violations.length;
    }
    return (b.overallScore ?? -1) - (a.overallScore ?? -1);
  });

  let compliantRankCounter = 0;
  return evaluations.map((ev) => {
    const compliantRank = ev.isCompliant ? ++compliantRankCounter : null;
    return {
      ...ev,
      rank: compliantRank,
      compliantRank,
      potentialScore: ev.overallScore,
    };
  });
}

/**
 * 4-Track Synchronized Mission Timeline Simulator
 * Computes Solar Availability, Earth Visibility, Terrain Obstruction, and Operational Risk tracks.
 */
export function simulateMissionTimelineTracks(
  site,
  startMs,
  durationDays = 14,
  stepHours = 6
) {
  const lat = site?.lat ?? site?.latitude ?? -85.9;
  const lon = site?.lon ?? site?.longitude ?? 0.0;
  const siteId = site?.id || 'custom-sim-site';
  const metrics = sampleLunarTerrainMetrics(lat, lon, site);
  const slopeDeg =
    typeof site?.slopeDeg === 'number' && Number.isFinite(site.slopeDeg)
      ? site.slopeDeg
      : metrics.slopeDeg;
  const hasSlopeData = slopeDeg !== null && Number.isFinite(slopeDeg);

  const totalHours = Math.max(24, durationDays * 24);
  const safeStepHours = Math.max(1, stepHours);
  const numSteps = Math.max(8, Math.min(120, Math.round(totalHours / safeStepHours)));
  const stepMs = (totalHours * 3600000) / numSteps;

  const steps = [];
  let sunlitCount = 0;
  let dteClearCount = 0;
  let obstructedCount = 0;
  let highRiskCount = 0;

  for (let i = 0; i < numSteps; i++) {
    const tMs = startMs + i * stepMs;
    const state = computeCelestialState(tMs);
    const flatSun = solarPosition(state, lat, lon, 0);
    const rawSunHorizon = horizonAt(HORIZON_TABLE, siteId, flatSun.azimuthDeg, lat, lon);
    const sunHorizon = rawSunHorizon !== null && Number.isFinite(rawSunHorizon) ? rawSunHorizon : 0.0;
    const sun = solarPosition(state, lat, lon, sunHorizon);

    const dte = evaluateEarthLink({
      state,
      moonFeature: { id: siteId, latitude: lat, longitude: lon },
      earthFeature: null,
      constraints: DEFAULT_DTE_CONSTRAINTS,
      terrainFn: (az) => horizonAt(HORIZON_TABLE, siteId, az, lat, lon) ?? 0,
    });

    const isTerrainBlockingSun = flatSun.elevationDeg > 0 && flatSun.elevationDeg <= sunHorizon;
    const isTerrainBlockingEarth = dte.status === 'blocked' && dte.reason === 'terrain';
    const maxHorizonMaskDeg = Math.max(sunHorizon, dte.terrainHorizonDeg ?? 0);

    const solarStatus = sun.status;
    if (solarStatus === 'sunlit') sunlitCount++;

    const earthStatus = dte.status;
    if (earthStatus === 'clear' || earthStatus === 'doubtful') dteClearCount++;

    let obstructionStatus = 'unobstructed';
    if (isTerrainBlockingSun || isTerrainBlockingEarth) {
      obstructionStatus = 'masked';
      obstructedCount++;
    } else if (maxHorizonMaskDeg >= 3.5) {
      obstructionStatus = 'grazing';
    }

    let riskStatus = 'favorable';
    if (
      (hasSlopeData && slopeDeg >= 15) ||
      (solarStatus !== 'sunlit' && earthStatus !== 'clear') ||
      earthStatus === 'away'
    ) {
      riskStatus = 'challenging';
      highRiskCount++;
    } else if (
      (hasSlopeData && slopeDeg >= 10) ||
      solarStatus !== 'sunlit' ||
      earthStatus !== 'clear'
    ) {
      riskStatus = 'conditional';
    }

    steps.push({
      index: i,
      timeMs: tMs,
      solarStatus,
      sunElevationDeg: sun.elevationDeg,
      sunHorizonDeg: sunHorizon,
      earthStatus,
      earthElevationDeg: dte.elevationDeg,
      earthMarginDeg: dte.marginDeg,
      obstructionStatus,
      maxHorizonMaskDeg,
      riskStatus,
    });
  }

  return {
    steps,
    summary: {
      sunlitPct: Math.round((sunlitCount / numSteps) * 100),
      dteClearPct: Math.round((dteClearCount / numSteps) * 100),
      obstructedPct: Math.round((obstructedCount / numSteps) * 100),
      highRiskPct: Math.round((highRiskCount / numSteps) * 100),
      slopeDeg,
      elevationM: metrics.elevationM,
    },
  };
}

/**
 * What-If Scenario Comparator
 * Compares Original Scenario A against Alternative Scenario B (different landing date, duration, or site).
 */
export function compareWhatIfScenarios(
  scenarioA,
  scenarioB,
  constraints = DEFAULT_PLANNER_CONSTRAINTS
) {
  const evalA = evaluateCandidateForMissionWindow(
    scenarioA.site,
    scenarioA.landingMs,
    scenarioA.durationDays,
    constraints
  );
  const evalB = evaluateCandidateForMissionWindow(
    scenarioB.site,
    scenarioB.landingMs,
    scenarioB.durationDays,
    constraints
  );

  const improved = [];
  const deteriorated = [];
  const unchanged = [];
  const newRisks = [];

  const sunDelta = evalB.durationOutlook.sunlitRatio - evalA.durationOutlook.sunlitRatio;
  if (sunDelta >= 3) {
    improved.push(`Solar illumination increased by +${sunDelta}% (${evalA.durationOutlook.sunlitRatio}% → ${evalB.durationOutlook.sunlitRatio}%).`);
  } else if (sunDelta <= -3) {
    deteriorated.push(`Solar illumination decreased by ${sunDelta}% (${evalA.durationOutlook.sunlitRatio}% → ${evalB.durationOutlook.sunlitRatio}%).`);
  } else {
    unchanged.push(`Solar illumination remained steady (~${evalB.durationOutlook.sunlitRatio}%).`);
  }

  const dteDelta = evalB.durationOutlook.dteUptimeRatio - evalA.durationOutlook.dteUptimeRatio;
  if (dteDelta >= 3) {
    improved.push(`Direct-to-Earth link uptime improved by +${dteDelta}% (${evalA.durationOutlook.dteUptimeRatio}% → ${evalB.durationOutlook.dteUptimeRatio}%).`);
  } else if (dteDelta <= -3) {
    deteriorated.push(`Direct-to-Earth link uptime dropped by ${dteDelta}% (${evalA.durationOutlook.dteUptimeRatio}% → ${evalB.durationOutlook.dteUptimeRatio}%).`);
  } else {
    unchanged.push(`Direct-to-Earth link uptime unchanged (${evalB.durationOutlook.dteUptimeRatio}%).`);
  }

  const slopeA = evalA.candidate.slopeDeg;
  const slopeB = evalB.candidate.slopeDeg;
  if (slopeA !== null && slopeB !== null && Number.isFinite(slopeA) && Number.isFinite(slopeB)) {
    const slopeDelta = Number((slopeB - slopeA).toFixed(1));
    if (slopeDelta <= -0.5) {
      improved.push(`Local terrain slope reduced by ${slopeDelta}° (${slopeA.toFixed(1)}° → ${slopeB.toFixed(1)}°).`);
    } else if (slopeDelta >= 0.5) {
      deteriorated.push(`Local terrain slope steepened by +${slopeDelta}° (${slopeA.toFixed(1)}° → ${slopeB.toFixed(1)}°).`);
    } else {
      unchanged.push(`Terrain slope consistent (${slopeB.toFixed(1)}°).`);
    }
  } else {
    unchanged.push('Terrain slope comparison unavailable (outside 80°S–90°S LOLA DEM coverage).');
  }

  const darkDelta = evalB.durationOutlook.longestDarkHours - evalA.durationOutlook.longestDarkHours;
  if (darkDelta <= -6) {
    improved.push(`Longest continuous shadow reduced by ${Math.abs(darkDelta)}h (${evalA.durationOutlook.longestDarkHours}h → ${evalB.durationOutlook.longestDarkHours}h).`);
  } else if (darkDelta >= 6) {
    deteriorated.push(`Longest shadow exposure increased by +${darkDelta}h (${evalA.durationOutlook.longestDarkHours}h → ${evalB.durationOutlook.longestDarkHours}h).`);
  }

  const typesA = new Set(evalA.violations.map((v) => v.type));
  for (const v of evalB.violations) {
    if (!typesA.has(v.type)) {
      newRisks.push(`${v.label}: ${v.detail}`);
    }
  }
  if (!evalB.touchdown.isSunlit && evalA.touchdown.isSunlit) {
    newRisks.push('Touchdown occurs in local terrain shadow under Alternative Scenario.');
  }

  return {
    evalA,
    evalB,
    scoreDelta: evalB.overallScore - evalA.overallScore,
    improved,
    deteriorated,
    unchanged,
    newRisks,
  };
}

/**
 * Automatic Candidate Site Discovery
 * Scans a curated polar stereographic grid of NASA LOLA South Pole peaks, rims, and plateaus
 * (80°S–90°S) and returns top-ranked candidate regions for the target mission window.
 */
const POLAR_DISCOVERY_GRID = [
  {
    id: 'disc-connecting-ridge-alpha',
    name: 'Connecting Ridge Alpha Crest',
    region: 'south-pole',
    regionLabel: 'South Pole · 89.45°S, 137.20°W',
    lat: -89.45,
    lon: -137.2,
    geology: 'Elevated ridge crest linking Shackleton and De Gerlache rims.',
    scienceTarget: 'Near-continuous grazing illumination & cold-trap proximity.',
    isAutoDiscovered: true,
  },
  {
    id: 'disc-malapert-summit-north',
    name: 'Malapert North Telemetry Bench',
    region: 'south-pole',
    regionLabel: 'South Pole · 85.88°S, 1.15°E',
    lat: -85.88,
    lon: 1.15,
    geology: 'Flat highland bench on the Earth-facing flank of Mons Malapert.',
    scienceTarget: 'Unobstructed 0°E meridian Direct-to-Earth line-of-sight.',
    isAutoDiscovered: true,
  },
  {
    id: 'disc-leibnitz-beta-plateau',
    name: 'Mons Mouton (Leibnitz Beta) West Plateau',
    region: 'south-pole',
    regionLabel: 'South Pole · 84.62°S, 31.40°E',
    lat: -84.62,
    lon: 31.4,
    geology: 'Broad low-slope summit plateau (+5,400 m) with minimal horizon blockage.',
    scienceTarget: 'VIPER / Artemis highland regolith & solar power station.',
    isAutoDiscovered: true,
  },
  {
    id: 'disc-shackleton-rim-east',
    name: 'Shackleton Eastern Illumination Spur',
    region: 'south-pole',
    regionLabel: 'South Pole · 89.78°S, 118.50°E',
    lat: -89.78,
    lon: 118.5,
    geology: 'High polar crater rim spur adjacent to Shackleton cold trap.',
    scienceTarget: 'Direct rim access to permanently shadowed volatile floor.',
    isAutoDiscovered: true,
  },
  {
    id: 'disc-nobile-west-terrace',
    name: 'Nobile Western Sunlit Terrace',
    region: 'south-pole',
    regionLabel: 'South Pole · 85.15°S, 51.80°E',
    lat: -85.15,
    lon: 51.8,
    geology: 'Gentle highland terrace overlooking Nobile impact basin.',
    scienceTarget: 'Shallow subsurface water-ice prospecting & DTE visibility.',
    isAutoDiscovered: true,
  },
  {
    id: 'disc-amundsen-central-bench',
    name: 'Amundsen North Rim Terrace',
    region: 'south-pole',
    regionLabel: 'South Pole · 83.85°S, 81.90°E',
    lat: -83.85,
    lon: 81.9,
    geology: 'Low-gradient basin terrace with favorable approach corridor.',
    scienceTarget: 'Nectarian basin stratigraphy & volatile trap access.',
    isAutoDiscovered: true,
  },
];

export function discoverSouthPoleCandidates(
  landingMs,
  durationDays = 14,
  constraints = DEFAULT_PLANNER_CONSTRAINTS
) {
  const enriched = POLAR_DISCOVERY_GRID.map((point) => {
    const metrics = sampleLunarTerrainMetrics(point.lat, point.lon, point);
    return {
      ...point,
      elevationM: metrics.elevationM,
      slopeDeg: metrics.slopeDeg,
      roughnessM: metrics.roughnessM,
      isFarSide: Math.abs(point.lon) > 90 && Math.abs(point.lat) < 75,
    };
  });

  return rankLandingCandidates(enriched, landingMs, durationDays, constraints);
}

