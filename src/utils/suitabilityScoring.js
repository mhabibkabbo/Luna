/**
 * @file suitabilityScoring.js
 * Single source of truth for lunar landing suitability evaluation.
 * Unifies the 4-pillar multi-disciplinary decision metric across:
 * - comparisonEngine.js (multi-site trade-offs)
 * - plannerEngine.js (candidate ranking & slip simulation)
 * - FeaturePanel.jsx (mission window assessment)
 *
 * Scoring pillars:
 * 1. Solar Availability & Darkness Survival (35%)
 * 2. Communication / Direct-to-Earth (30%)
 * 3. Terrain Slope & Roughness Safety (20%)
 * 4. Thermal Stability & Cryogenic Survival (15%)
 */

export const DEFAULT_SUITABILITY_WEIGHTS = {
  solar: 0.35,
  communication: 0.30,
  terrain: 0.20,
  thermal: 0.15,
};

export const DEFAULT_PLANNER_WEIGHTS = {
  sun: 0.35,
  dte: 0.30,
  slope: 0.20,
  thermal: 0.15,
};

/**
 * Standard 2-hour time-step resolution for high-fidelity mission window integration.
 */
export const DEFAULT_STEP_HOURS = 2;

/**
 * Computes terrain suitability score [0, 100] based on lander slope safety margin
 * relative to the 15° tip-over limit, with an optional penalty for surface roughness > 10 m.
 * Returns null if slopeDeg is null or non-finite (e.g. outside LOLA DEM).
 *
 * @param {number|null} slopeDeg - Local slope in degrees
 * @param {number|null} [roughnessM=null] - Local roughness in meters
 * @returns {number|null} Terrain score [0, 100] or null if missing slope
 */
export function computeTerrainSuitability(slopeDeg, roughnessM = null) {
  if (slopeDeg === null || typeof slopeDeg !== 'number' || !Number.isFinite(slopeDeg)) {
    return null;
  }
  const baseSlopeScore = Math.max(0, Math.min(100, Math.round((1 - slopeDeg / 15) * 100)));
  const roughnessPenalty =
    roughnessM !== null && typeof roughnessM === 'number' && Number.isFinite(roughnessM) && roughnessM > 10
      ? Math.min(15, Math.round((roughnessM - 10) * 1.2))
      : 0;
  return Math.max(0, baseSlopeScore - roughnessPenalty);
}

/**
 * Computes solar-energy suitability score [0, 100].
 * Combines cumulative insolation percentage (75%) with normalized continuous darkness survival (25%).
 *
 * @param {number} solarIlluminationPct - Total illumination percentage [0, 100]
 * @param {number} [longestContinuousDarkHours=0] - Longest unbroken darkness period in hours
 * @param {number} [totalHours=0] - Total mission duration in hours
 * @returns {number} Solar suitability score [0, 100]
 */
export function computeSolarSuitability(solarIlluminationPct, longestContinuousDarkHours = 0, totalHours = 0) {
  const safeSunPct = Math.max(0, Math.min(100, Number(solarIlluminationPct) || 0));
  const safeDarkHours = Math.max(0, Number(longestContinuousDarkHours) || 0);
  const safeTotalHours = Math.max(0, Number(totalHours) || 0);

  const darkSurvivalScore = safeTotalHours > 0
    ? Math.max(0, Math.min(100, Math.round(100 - (safeDarkHours / safeTotalHours) * 100)))
    : safeSunPct;

  return Math.max(0, Math.min(100, Math.round(0.75 * safeSunPct + 0.25 * darkSurvivalScore)));
}

/**
 * Computes communication suitability score [0, 100].
 * Combines DTE line-of-sight availability percentage (80%) with blackout resistance (20%).
 * Strictly evaluates to 0 on the lunar far side without orbital relay.
 *
 * @param {number} earthVisibilityPct - Total Earth DTE visibility percentage [0, 100]
 * @param {number} [maxBlackoutHours=0] - Longest unbroken comm blackout in hours
 * @param {number} [totalHours=0] - Total mission duration in hours
 * @param {boolean} [isFarSide=false] - Whether site is on lunar far side
 * @returns {number} Comm suitability score [0, 100]
 */
export function computeCommunicationSuitability(earthVisibilityPct, maxBlackoutHours = 0, totalHours = 0, isFarSide = false) {
  if (isFarSide || earthVisibilityPct === 0) {
    return 0;
  }
  const safeDtePct = Math.max(0, Math.min(100, Number(earthVisibilityPct) || 0));
  const safeBlackoutHours = Math.max(0, Number(maxBlackoutHours) || 0);
  const safeTotalHours = Math.max(0, Number(totalHours) || 0);

  const blackoutSurvivalScore = safeTotalHours > 0
    ? Math.max(0, Math.min(100, Math.round(100 - (safeBlackoutHours / safeTotalHours) * 100)))
    : safeDtePct;

  return Math.max(0, Math.min(100, Math.round(0.80 * safeDtePct + 0.20 * blackoutSurvivalScore)));
}

/**
 * Computes thermal suitability score [0, 100].
 * Combines minimum cryogenic temperature survival (70%, 40 K PSR floor to 250 K benign regime)
 * with thermal swing stability (30%, penalized by temperature excursion / 3.2).
 *
 * @param {number} minTempK - Minimum temperature in Kelvin
 * @param {number|null} [tempVariationC=null] - Temperature swing in Celsius (T_max - T_min)
 * @returns {number} Thermal suitability score [0, 100]
 */
export function computeThermalSuitability(minTempK, tempVariationC = null) {
  const safeTempK = typeof minTempK === 'number' && Number.isFinite(minTempK) ? minTempK : 200;
  const minTempNorm = Math.max(0, Math.min(100, Math.round(((safeTempK - 40) / (250 - 40)) * 100)));

  if (tempVariationC !== null && typeof tempVariationC === 'number' && Number.isFinite(tempVariationC)) {
    const swingNorm = Math.max(0, Math.min(100, Math.round(100 - tempVariationC / 3.2)));
    return Math.max(0, Math.min(100, Math.round(0.70 * minTempNorm + 0.30 * swingNorm)));
  }

  return minTempNorm;
}

/**
 * Computes overall multi-disciplinary suitability score [0, 100].
 * MANDATORY SCIENTIFIC GUARD: Returns null if terrainSuitability is null (never substitute 0 or fabricate a score).
 * Also returns `partialScore` normalized over available dimensions (for partial ranking displays).
 *
 * @param {Object} params
 * @param {number} params.solarSuitability - Solar score [0, 100]
 * @param {number} params.commSuitability - Comm score [0, 100]
 * @param {number|null} params.terrainSuitability - Terrain slope score [0, 100] or null
 * @param {number} params.thermalSuitability - Thermal score [0, 100]
 * @param {Object} [params.weights=DEFAULT_SUITABILITY_WEIGHTS] - Custom pillar weights
 * @param {number|null} [params.slopeDeg=null] - Measured slope in degrees
 * @returns {Object} Composite suitability result
 */
export function computeOverallSuitability({
  solarSuitability,
  commSuitability,
  terrainSuitability,
  thermalSuitability,
  weights = DEFAULT_SUITABILITY_WEIGHTS,
  slopeDeg = null,
}) {
  const hasCompleteScoringInputs =
    terrainSuitability !== null &&
    Number.isFinite(terrainSuitability) &&
    solarSuitability !== null &&
    Number.isFinite(solarSuitability) &&
    commSuitability !== null &&
    Number.isFinite(commSuitability) &&
    thermalSuitability !== null &&
    Number.isFinite(thermalSuitability);

  const wSolar = weights.solar ?? weights.sun ?? 0.35;
  const wComm = weights.communication ?? weights.dte ?? 0.30;
  const wTerrain = weights.terrain ?? weights.slope ?? 0.20;
  const wThermal = weights.thermal ?? 0.15;

  if (!hasCompleteScoringInputs) {
    const activeWeightSum = wSolar + wComm + wThermal || 1;
    const nwSolar = wSolar / activeWeightSum;
    const nwComm = wComm / activeWeightSum;
    const nwThermal = wThermal / activeWeightSum;

    const rawPartial =
      nwSolar * (solarSuitability ?? 0) +
      nwComm * (commSuitability ?? 0) +
      nwThermal * (thermalSuitability ?? 0);
    const partialScore = Math.max(0, Math.min(100, Math.round(rawPartial)));

    const formulaString = `Score (Partial — Slope Not Present) = ${(nwSolar * 100).toFixed(0)}%·Sun(${solarSuitability ?? 0}) + ${(nwComm * 100).toFixed(0)}%·DTE(${commSuitability ?? 0}) + ${(nwThermal * 100).toFixed(0)}%·Thermal(${thermalSuitability ?? 0}) [Slope: Not present outside 80°S–90°S DEM]`;

    return {
      overallScore: null,
      overallSuitability: null,
      partialScore,
      hasCompleteScoringInputs: false,
      isPartialScore: true,
      suitabilityLabel: 'Insufficient Data for Scoring',
      formulaString,
    };
  }

  const wSum = wSolar + wComm + wTerrain + wThermal || 1;
  const normWSolar = wSolar / wSum;
  const normWComm = wComm / wSum;
  const normWTerrain = wTerrain / wSum;
  const normWThermal = wThermal / wSum;

  const rawScore =
    normWSolar * solarSuitability +
    normWComm * commSuitability +
    normWTerrain * terrainSuitability +
    normWThermal * thermalSuitability;

  const overallSuitability = Math.max(0, Math.min(100, Math.round(rawScore)));

  let suitabilityLabel = 'Insufficient Data for Scoring';
  if (slopeDeg !== null && slopeDeg >= 15.0) {
    suitabilityLabel = `${overallSuitability}/100 (Disqualified: Slope ≥ 15°)`;
  } else if (overallSuitability >= 75) {
    suitabilityLabel = `${overallSuitability}/100 (Favorable)`;
  } else if (overallSuitability >= 50) {
    suitabilityLabel = `${overallSuitability}/100 (Conditional)`;
  } else {
    suitabilityLabel = `${overallSuitability}/100 (Challenging)`;
  }

  const formulaString = `Score = ${(normWSolar * 100).toFixed(0)}%·Sun(${solarSuitability}) + ${(normWComm * 100).toFixed(0)}%·DTE(${commSuitability}) + ${(normWTerrain * 100).toFixed(0)}%·Slope(${terrainSuitability}) + ${(normWThermal * 100).toFixed(0)}%·Thermal(${thermalSuitability})`;

  return {
    overallScore: overallSuitability,
    overallSuitability,
    partialScore: overallSuitability,
    hasCompleteScoringInputs: true,
    isPartialScore: false,
    suitabilityLabel,
    formulaString,
  };
}
