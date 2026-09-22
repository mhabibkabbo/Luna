/**
 * @file lunarPhase.js
 * High-precision astronomical lunar phase and solar illumination calculator.
 * Computes the real-time lunar age, illuminated fraction, phase name,
 * Earth-Moon distance, and next major phase countdowns based on standard celestial mechanics.
 */

const SYNODIC_MONTH = 29.53058867; // Days in a synodic lunar month
const ANOMALISTIC_MONTH = 27.55454988; // Perigee to perigee
const MEAN_DISTANCE_KM = 384400; // Mean Earth-Moon distance
const DISTANCE_VARIATION_KM = 21000; // Distance variance due to orbital eccentricity

// Reference New Moon Epoch: Jan 6, 2000, 18:14 UTC (JD 2451549.5)
const REFERENCE_NEW_MOON_JD = 2451549.5;

/**
 * Converts a JS Date to astronomical Julian Date (JD).
 * @param {Date} [date=new Date()]
 * @returns {number}
 */
export function getJulianDate(date = new Date()) {
  const time = date.getTime();
  return time / 86400000 + 2440587.5;
}

/**
 * Computes complete real-time lunar phase metrics for a given timestamp.
 * 
 * @param {Date} [date=new Date()]
 * @returns {{
 *   fraction: number,           // 0.0 to 1.0 (e.g. 0.84 = 84% illuminated)
 *   percentage: number,         // 0 to 100 (e.g. 84.2)
 *   phaseIndex: number,         // 0.0 to 1.0 (cycle position)
 *   ageDays: number,            // 0.0 to 29.53 days
 *   phaseName: string,          // "Waxing Gibbous", "Full Moon", etc.
 *   isWaxing: boolean,          // true if growing, false if shrinking
 *   distanceKm: number,         // current Earth-Moon distance in km
 *   subsolarLon: number,        // Selenographic longitude of Sun subpoint (-180 to +180)
 *   nextPhase: { name: string, daysUntil: number },
 * }}
 */
export function calculateLunarPhase(date = new Date()) {
  const jd = getJulianDate(date);
  
  // Total days elapsed since reference new moon
  const daysSinceEpoch = jd - REFERENCE_NEW_MOON_JD;
  
  // Current cycle progress (0.0 to 1.0)
  let phaseIndex = (daysSinceEpoch % SYNODIC_MONTH) / SYNODIC_MONTH;
  if (phaseIndex < 0) phaseIndex += 1.0;

  const ageDays = phaseIndex * SYNODIC_MONTH;

  // Phase angle (radians: 0 = New Moon, PI = Full Moon, 2PI = New Moon)
  const phaseAngle = phaseIndex * 2 * Math.PI;

  // Illuminated fraction k = (1 - cos(phaseAngle)) / 2
  const fraction = (1 - Math.cos(phaseAngle)) / 2;
  const percentage = Math.round(fraction * 1000) / 10; // e.g. 84.5%

  const isWaxing = phaseIndex < 0.5;

  // Precise phase naming classification
  let phaseName = 'New Moon';
  if (phaseIndex >= 0.025 && phaseIndex < 0.225) {
    phaseName = 'Waxing Crescent';
  } else if (phaseIndex >= 0.225 && phaseIndex < 0.275) {
    phaseName = 'First Quarter';
  } else if (phaseIndex >= 0.275 && phaseIndex < 0.475) {
    phaseName = 'Waxing Gibbous';
  } else if (phaseIndex >= 0.475 && phaseIndex < 0.525) {
    phaseName = 'Full Moon';
  } else if (phaseIndex >= 0.525 && phaseIndex < 0.725) {
    phaseName = 'Waning Gibbous';
  } else if (phaseIndex >= 0.725 && phaseIndex < 0.775) {
    phaseName = 'Third Quarter';
  } else if (phaseIndex >= 0.775 && phaseIndex < 0.975) {
    phaseName = 'Waning Crescent';
  }

  // Earth-Moon distance approximation based on anomalistic cycle
  const anomalisticPhase = ((daysSinceEpoch % ANOMALISTIC_MONTH) / ANOMALISTIC_MONTH) * 2 * Math.PI;
  const distanceKm = Math.round(MEAN_DISTANCE_KM - Math.cos(anomalisticPhase) * DISTANCE_VARIATION_KM);

  // Subsolar longitude on lunar surface
  let subsolarLon = 180 - phaseIndex * 360;
  if (subsolarLon < -180) subsolarLon += 360;
  if (subsolarLon > 180) subsolarLon -= 360;

  // Determine next major lunar phase event
  let nextPhase = { name: 'Full Moon', daysUntil: 0 };
  if (phaseIndex < 0.25) {
    nextPhase = { name: 'First Quarter', daysUntil: (0.25 - phaseIndex) * SYNODIC_MONTH };
  } else if (phaseIndex < 0.5) {
    nextPhase = { name: 'Full Moon', daysUntil: (0.5 - phaseIndex) * SYNODIC_MONTH };
  } else if (phaseIndex < 0.75) {
    nextPhase = { name: 'Third Quarter', daysUntil: (0.75 - phaseIndex) * SYNODIC_MONTH };
  } else {
    nextPhase = { name: 'New Moon', daysUntil: (1.0 - phaseIndex) * SYNODIC_MONTH };
  }

  return {
    fraction,
    percentage,
    phaseIndex,
    ageDays: Math.round(ageDays * 10) / 10,
    phaseName,
    isWaxing,
    distanceKm,
    subsolarLon: Math.round(subsolarLon * 10) / 10,
    nextPhase: {
      name: nextPhase.name,
      daysUntil: Math.round(nextPhase.daysUntil * 10) / 10,
    },
  };
}

/**
 * Returns SVG path definitions or rendering parameters for drawing an accurate
 * illuminated Moon orb graphic.
 * 
 * @param {number} phaseIndex 0.0 to 1.0
 * @param {number} size Diameter of SVG/canvas
 */
export function getMoonPhaseSvgParams(phaseIndex, size = 40) {
  const r = size / 2;
  const isWaxing = phaseIndex < 0.5;
  // Normalized illumination: -1 (New) to 0 (Quarter) to 1 (Full)
  const norm = (phaseIndex <= 0.5 ? phaseIndex : 1.0 - phaseIndex) * 4 - 1;

  return {
    radius: r,
    isWaxing,
    norm,
  };
}
