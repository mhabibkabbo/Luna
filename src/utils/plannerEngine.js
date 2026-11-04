/**
 * @file plannerEngine.js
 * Scientific evaluation engine for the Landing Window Planner.
 * Evaluates candidate landing sites across a full mission duration (not just touchdown)
 * using real celestial ephemeris, LOLA DEM horizons, and Diviner thermal models.
 */

import { computeCelestialState, solarPosition } from './lunarEphemeris.js';
import { getLunarTemperature } from './lunarThermal.js';
import { evaluateEarthLink, DEFAULT_DTE_CONSTRAINTS } from './earthLink.js';
import {
  HORIZON_TABLE,
  horizonAt,
  sampleLunarTerrainMetrics,
  ensurePolarDemLoaded,
} from './horizons.js';

ensurePolarDemLoaded();

export const DEFAULT_PLANNER_CONSTRAINTS = {
  minSunlitHours: 72, // At least 72 hours of continuous daylight
  minSunlitPct: 50, // Minimum solar availability percentage
  minDtePct: 60, // Minimum Direct-to-Earth visibility percentage
  maxSlopeDeg: 10.0, // Lander footpad tilt limit (standard 10°)
  requireDTE: true, // Mandatory Direct-to-Earth communication
  minTempC: -190, // Minimum operational mechanism temperature
  maxTempC: 125, // Maximum surface temperature limit
  minSolarElevAtTouchdown: 1.0, // Minimum approach solar elevation
  weights: {
    sun: 0.35,
    dte: 0.30,
    slope: 0.20,
    thermal: 0.15,
  },
};

export function evaluateCandidateForMissionWindow(
  candidate,
  landingMsOrOpts,
  durationDaysArg,
  constraintsArg = DEFAULT_PLANNER_CONSTRAINTS
) {
  let landingMs = landingMsOrOpts;
  let durationDays = durationDaysArg;
  let constraints = constraintsArg;

  if (landingMsOrOpts && typeof landingMsOrOpts === 'object' && ! (landingMsOrOpts instanceof Date)) {
    landingMs =
      landingMsOrOpts.landingTimeMs ??
      landingMsOrOpts.landingMs ??
      Date.now();
    durationDays =
      landingMsOrOpts.missionDurationDays ??
      landingMsOrOpts.durationDays ??
      14;
    constraints = { ...DEFAULT_PLANNER_CONSTRAINTS, ...landingMsOrOpts };
  }

  const safeLandingMs =
    typeof landingMs === 'number' && Number.isFinite(landingMs)
      ? landingMs
      : landingMs instanceof Date
      ? landingMs.getTime()
      : Date.now();
  const safeDurationDays = Math.max(1, Number(durationDays) || 14);
  const durationMs = safeDurationDays * 86400000;
  const numSteps = Math.max(16, Math.min(56, Math.round(safeDurationDays * 4)));
  const stepMs = durationMs / numSteps;

  const lat = candidate.lat ?? candidate.latitude ?? -85.9;
  const lon = candidate.lon ?? candidate.longitude ?? 0.0;
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

  // 1. Touchdown Evaluation (t0) — never invent a fallback horizon angle when DEM is unmodeled
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

  const moonFeatureObj = {
    id: siteId,
    name: candidate.name || 'Candidate Site',
    latitude: lat,
    longitude: lon,
    elevationM: elevationM ?? 0,
  };

  const dte0 = candidate.isFarSide
    ? { isLinked: false, status: 'away', elevationDeg: -90, marginDeg: -90, reason: 'farside' }
    : evaluateEarthLink({
        state: state0,
        moonFeature: moonFeatureObj,
        earthFeature: null,
        constraints: DEFAULT_DTE_CONSTRAINTS,
        terrainFn: (az) => horizonAt(HORIZON_TABLE, siteId, az, lat, lon),
      });

  const isDteLinked0 = candidate.isFarSide
    ? false
    : Boolean(dte0.isLinked || dte0.status === 'clear' || dte0.status === 'doubtful');

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
    const t = safeLandingMs + k * stepMs;
    const stateK = computeCelestialState(t);
    const solFlatK = solarPosition(stateK, lat, lon);
    const rawHorizK = horizonAt(HORIZON_TABLE, siteId, solFlatK.azimuthDeg, lat, lon);
    const thHoriz = rawHorizK !== null && Number.isFinite(rawHorizK) ? rawHorizK : 0.0;
    const solK = solarPosition(stateK, lat, lon, thHoriz);
    const thermK = getLunarTemperature(lat, lon, new Date(t), {
      terrainHorizonDeg: thHoriz,
      elevationM,
    });

    minTemp = Math.min(minTemp, thermK.tempC);
    maxTemp = Math.max(maxTemp, thermK.tempC);

    const isSunlitK = solK.isSunlit && solK.elevationDeg - thHoriz > 0;
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
        moonFeature: moonFeatureObj,
        earthFeature: null,
        constraints: DEFAULT_DTE_CONSTRAINTS,
        terrainFn: (az) => horizonAt(HORIZON_TABLE, siteId, az, lat, lon),
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
  }

  const hoursPerStep = (safeDurationDays * 24) / numSteps;
  const sunlitRatio = Math.round((sunlitSteps / (numSteps + 1)) * 100);
  const dteUptimeRatio = candidate.isFarSide ? 0 : Math.round((dteSteps / (numSteps + 1)) * 100);
  const longestSunlitHours = Math.round(maxSunlitStreak * hoursPerStep);
  const longestDarkHours = Math.round(maxDarkStreak * hoursPerStep);
  const longestBlackoutHours = Math.round(maxBlackoutStreak * hoursPerStep);

  // 3. Constraints Validation
  const violations = [];
  const minDteTarget = constraints.minDtePct ?? 5;
  const minSunPctTarget = constraints.minSunlitPct ?? 0;

  if (constraints.requireDTE && dteUptimeRatio < Math.max(5, minDteTarget)) {
    violations.push({
      type: 'dte_blocked',
      severity: dteUptimeRatio < 10 ? 'critical' : 'warning',
      label: 'Direct-to-Earth Telemetry Below Threshold',
      detail: candidate.isFarSide
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

  if (sol0.elevationDeg < constraints.minSolarElevAtTouchdown) {
    violations.push({
      type: 'touchdown_shadow',
      severity: 'warning',
      label: 'Sub-Optimal Solar Elevation at Touchdown',
      detail: `Sun elevation at touchdown is ${sol0.elevationDeg.toFixed(1)}° (below the ${constraints.minSolarElevAtTouchdown}° approach visibility requirement).`,
    });
  }

  // 4. Explainable Weighted Scoring (0 to 100) — Strictly Data-Driven (No Fabricated Values)
  const rawWeights = constraints.weights || DEFAULT_PLANNER_CONSTRAINTS.weights;
  const wSum =
    (rawWeights.sun ?? 0.35) +
    (rawWeights.dte ?? 0.3) +
    (rawWeights.slope ?? 0.2) +
    (rawWeights.thermal ?? 0.15) || 1;
  const wSun = (rawWeights.sun ?? 0.35) / wSum;
  const wDte = (rawWeights.dte ?? 0.3) / wSum;
  const wSlope = (rawWeights.slope ?? 0.2) / wSum;
  const wThermal = (rawWeights.thermal ?? 0.15) / wSum;

  const isCompliant = violations.filter((v) => v.severity === 'critical').length === 0;

  // Component scores are exact physical [0, 100] percentages:
  // - sunlitScore: exact % of window sunlit
  // - dteScore: exact % of window with DTE line-of-sight (0% on farside)
  // - slopeScore: linear safety margin relative to 15° tip-over limit, or null if outside 80°S–90°S LOLA DEM
  // - thermalScore: Calculated minimum temperature stability relative to [40 K PSR floor, 250 K benign regime]
  const sunlitScore = Math.max(0, Math.min(100, sunlitRatio));
  const dteScore = candidate.isFarSide ? 0 : Math.max(0, Math.min(100, dteUptimeRatio));
  const slopeScore = hasSlopeData
    ? Math.max(0, Math.min(100, Math.round((1 - slopeDeg / 15) * 100)))
    : null;
  const minTempK = minTemp + 273.15;
  const thermalScore = Math.max(0, Math.min(100, Math.round(((minTempK - 40) / (250 - 40)) * 100)));

  let overallScore = 0;
  let formulaString = '';
  const isPartialScore = !hasSlopeData;

  if (hasSlopeData) {
    overallScore = Math.round(
      sunlitScore * wSun +
        dteScore * wDte +
        slopeScore * wSlope +
        thermalScore * wThermal
    );
    formulaString = `Score = ${(wSun * 100).toFixed(0)}%·Sun(${sunlitScore}) + ${(wDte * 100).toFixed(0)}%·DTE(${dteScore}) + ${(wSlope * 100).toFixed(0)}%·Slope(${slopeScore}) + ${(wThermal * 100).toFixed(0)}%·Thermal(${thermalScore})`;
  } else {
    // Slope data is not present in loaded dataset (outside 80°S–90°S LOLA DEM).
    // Never invent a slope score; normalize only over the available calculated dimensions.
    const activeWeightSum = wSun + wDte + wThermal || 1;
    const nwSun = wSun / activeWeightSum;
    const nwDte = wDte / activeWeightSum;
    const nwThermal = wThermal / activeWeightSum;
    overallScore = Math.round(
      sunlitScore * nwSun + dteScore * nwDte + thermalScore * nwThermal
    );
    formulaString = `Score (Partial — Slope Not Present) = ${(nwSun * 100).toFixed(0)}%·Sun(${sunlitScore}) + ${(nwDte * 100).toFixed(0)}%·DTE(${dteScore}) + ${(nwThermal * 100).toFixed(0)}%·Thermal(${thermalScore}) [Slope: Not present outside 80°S–90°S DEM]`;
  }

  // Specification Section 8 Descriptive Feasibility Outcomes:
  // Favorable | Conditional | Challenging | Insufficient Data
  const hasHighResCoverage = Math.abs(lat) >= 80 || Boolean(HORIZON_TABLE?.[siteId]);
  let suitabilityOutcome = 'Challenging';
  let tier = 'Disqualified';
  let tierLabel = 'Challenging (Constraint Violation)';
  let tierColor = 'text-rose-400 bg-rose-950/60 border-rose-800/80';

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    suitabilityOutcome = 'Insufficient Data';
    tierLabel = 'Insufficient Data';
    tierColor = 'text-slate-300 bg-slate-900 border-slate-700';
  } else if (isCompliant) {
    if (overallScore >= 75 && violations.length === 0) {
      suitabilityOutcome = 'Favorable';
      tier = 'tier-1';
      tierLabel = isPartialScore
        ? 'Favorable · Partial (No DEM Slope)'
        : 'Favorable · Primary Target';
      tierColor = 'text-cyan-300 bg-cyan-950/80 border-cyan-500/80';
    } else if (overallScore >= 50) {
      suitabilityOutcome = 'Conditional';
      tier = 'tier-2';
      tierLabel = isPartialScore
        ? 'Conditional · Partial (No DEM Slope)'
        : 'Conditional · Viable Window';
      tierColor = 'text-emerald-300 bg-emerald-950/80 border-emerald-500/80';
    } else {
      suitabilityOutcome = 'Challenging';
      tier = 'tier-3';
      tierLabel = 'Challenging · Marginal Window';
      tierColor = 'text-amber-300 bg-amber-950/80 border-amber-500/80';
    }
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

  // 5. Evidence-based scientific rationale
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
  } else if (dteUptimeRatio > 0 && !candidate.isFarSide) {
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

  if (candidate.isFarSide) {
    operationalRisks.push(
      `Far-side hemisphere: 0% direct Earth visibility; requires relay satellite architecture.`
    );
  } else if (dte0.elevationDeg < 4.0) {
    operationalRisks.push(
      `Low grazing Earth elevation (${dte0.elevationDeg.toFixed(1)}°); RF link sensitive to local crater rim diffraction.`
    );
  }

  return {
    id: siteId,
    slopeDeg,
    elevationM,
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
      slopeDeg,
      elevationM,
    },
    isCompliant,
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
<<<<<<< Updated upstream
      isSunlit: sol0.isSunlit && sol0.elevationDeg - terrainHorizon0 > 0,
=======
      isHorizonModeled,
      isSunlit: sol0.status === 'sunlit',
>>>>>>> Stashed changes
      surfaceTempC: thermal0.tempC,
      surfaceTempK: thermal0.tempK,
      isDteLinked: isDteLinked0,
      earthElevationDeg: dte0.elevationDeg,
      earthMarginDeg: dte0.marginDeg,
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
  };
}

export function rankLandingCandidates(
  candidates,
  landingMsOrOpts,
  durationDays,
  constraints = DEFAULT_PLANNER_CONSTRAINTS
) {
  const evaluations = candidates.map((cand) =>
    evaluateCandidateForMissionWindow(cand, landingMsOrOpts, durationDays, constraints)
  );

  evaluations.sort((a, b) => {
    if (a.isCompliant && !b.isCompliant) return -1;
    if (!a.isCompliant && b.isCompliant) return 1;
    return b.overallScore - a.overallScore;
  });

  return evaluations;
}

/**
 * Specification Section 6: 4-Track Synchronized Mission Timeline Simulator
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

    // Track 1: Solar Availability ('sunlit' | 'blocked' | 'night')
    const solarStatus = sun.status;
    if (solarStatus === 'sunlit') sunlitCount++;

    // Track 2: Earth Visibility ('clear' | 'doubtful' | 'blocked' | 'away')
    const earthStatus = dte.status;
    if (earthStatus === 'clear' || earthStatus === 'doubtful') dteClearCount++;

    // Track 3: Terrain Obstruction ('unobstructed' | 'grazing' | 'masked')
    let obstructionStatus = 'unobstructed';
    if (isTerrainBlockingSun || isTerrainBlockingEarth) {
      obstructionStatus = 'masked';
      obstructedCount++;
    } else if (maxHorizonMaskDeg >= 3.5) {
      obstructionStatus = 'grazing';
    }

    // Track 4: Operational Risk ('favorable' | 'conditional' | 'challenging')
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
 * Specification Section 7: What-If Scenario Comparator
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

  // Identify newly introduced constraint violations in Scenario B
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
 * Specification Section 10: Automatic Candidate Site Discovery
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
      isFarSide: Math.abs(point.lon) > 95,
    };
  });

  return rankLandingCandidates(enriched, landingMs, durationDays, constraints);
}

