/**
 * @file jplHorizons.js
 * NASA JPL Horizons System API integration & fallback ephemeris client.
 *
 * Fetches real-time or mission-date ephemerides (state vectors, range,
 * range-rate, light-time) directly from NASA's Jet Propulsion Laboratory:
 *   https://ssd.jpl.nasa.gov/api/horizons.api
 *
 * If offline or during network latency, seamlessly falls back to
 * local IAU/WGCCRE planetary ephemerides powered by `astronomy-engine`.
 */

import { computeCelestialState, EARTH_MEAN_RADIUS_KM, MOON_RADIUS_KM } from './lunarEphemeris.js';

// NASA JPL Horizons Web Service endpoint
export const JPL_HORIZONS_API_URL = 'https://ssd.jpl.nasa.gov/api/horizons.api';

// Curated lunar launch vehicles (with The Space Devs metadata & TLI capabilities)
export const LUNAR_ROCKETS = [
  {
    id: 'sls-block1',
    name: 'SLS Block 1',
    agency: 'NASA',
    family: 'Space Launch System',
    tliPayloadKg: 27000,
    liftoffThrustKn: 39144,
    stages: 2,
    propellant: 'LH2 / LOX (Core) + Solid Boosters',
    description: 'Current NASA Artemis launch vehicle powering Orion crew capsule to lunar orbit.',
  },
  {
    id: 'saturn-v',
    name: 'Saturn V',
    agency: 'NASA / Apollo',
    family: 'Saturn',
    tliPayloadKg: 45000,
    liftoffThrustKn: 34500,
    stages: 3,
    propellant: 'RP-1/LOX (S-IC) + LH2/LOX (S-II & S-IVB)',
    description: 'Historic Apollo rocket that sent 24 humans to the Moon and landed 12 on its surface.',
  },
  {
    id: 'starship',
    name: 'Starship / Super Heavy',
    agency: 'SpaceX',
    family: 'Starship',
    tliPayloadKg: 100000,
    liftoffThrustKn: 74500,
    stages: 2,
    propellant: 'LCH4 / LOX (Methalox)',
    description: 'Fully reusable heavy-lift system selected for NASA Artemis III and IV Human Landing System (HLS).',
  },
  {
    id: 'falcon-heavy',
    name: 'Falcon Heavy',
    agency: 'SpaceX',
    family: 'Falcon',
    tliPayloadKg: 15500,
    liftoffThrustKn: 22819,
    stages: 2,
    propellant: 'RP-1 / LOX (Keralox)',
    description: 'Selected for NASA Gateway Power & Propulsion Element (PPE) and HALO module launch.',
  },
  {
    id: 'vulcan-centaur',
    name: 'Vulcan Centaur',
    agency: 'United Launch Alliance',
    family: 'Vulcan',
    tliPayloadKg: 12100,
    liftoffThrustKn: 9790,
    stages: 2,
    propellant: 'LCH4 / LOX (Booster) + LH2 / LOX (Centaur V)',
    description: 'Launched Astrobotic Peregrine Mission One (CLPS TO2-AB).',
  },
  {
    id: 'ariane-64',
    name: 'Ariane 64',
    agency: 'ESA / Arianespace',
    family: 'Ariane',
    tliPayloadKg: 8500,
    liftoffThrustKn: 15000,
    stages: 2,
    propellant: 'LH2 / LOX (Vulcain 2.1) + Solid Boosters',
    description: "Europe's heavy launcher capable of lunar transfer injection for robotic landers.",
  },
];

/**
 * Fetch Moon state vectors from NASA JPL Horizons API.
 *
 * @param {Date|string|number} [targetDate] Date of ephemeris
 * @param {number} [timeoutMs=6000] Request timeout in milliseconds
 * @returns {Promise<{
 *   xKm: number,
 *   yKm: number,
 *   zKm: number,
 *   vxKmS: number,
 *   vyKmS: number,
 *   vzKmS: number,
 *   rangeKm: number,
 *   rangeRateKmS: number,
 *   lightTimeSec: number,
 *   dateStr: string,
 *   isLive: boolean,
 *   source: string,
 * }>}
 */
export async function fetchJplMoonEphemeris(targetDate = new Date(), timeoutMs = 6000) {
  const dateObj = targetDate instanceof Date ? targetDate : new Date(targetDate);
  const dateStr = dateObj.toISOString().split('T')[0];
  const nextDateObj = new Date(dateObj.getTime() + 86400000);
  const nextDateStr = nextDateObj.toISOString().split('T')[0];

  // Parameters for Moon (301) relative to Earth center (500@399) in ICRF/J2000 frame
  const params = new URLSearchParams({
    format: 'json',
    COMMAND: "'301'",
    EPHEM_TYPE: "'VECTORS'",
    CENTER: "'500@399'",
    START_TIME: `'${dateStr}'`,
    STOP_TIME: `'${nextDateStr}'`,
    STEP_SIZE: "'1d'",
  });

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const response = await fetch(`${JPL_HORIZONS_API_URL}?${params.toString()}`, {
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`JPL Horizons HTTP error ${response.status}`);
    }

    const data = await response.json();
    const text = data.result || '';

    // Extract vectors between $$SOE and $$EOE markers
    const soe = text.indexOf('$$SOE');
    const eoe = text.indexOf('$$EOE');

    if (soe !== -1 && eoe !== -1) {
      const block = text.slice(soe + 5, eoe).trim();
      const xMatch = block.match(/X\s*=\s*([-+]?\d*\.?\d+(?:[eE][-+]?\d+)?)/);
      const yMatch = block.match(/Y\s*=\s*([-+]?\d*\.?\d+(?:[eE][-+]?\d+)?)/);
      const zMatch = block.match(/Z\s*=\s*([-+]?\d*\.?\d+(?:[eE][-+]?\d+)?)/);
      const vxMatch = block.match(/VX\s*=\s*([-+]?\d*\.?\d+(?:[eE][-+]?\d+)?)/);
      const vyMatch = block.match(/VY\s*=\s*([-+]?\d*\.?\d+(?:[eE][-+]?\d+)?)/);
      const vzMatch = block.match(/VZ\s*=\s*([-+]?\d*\.?\d+(?:[eE][-+]?\d+)?)/);
      const rgMatch = block.match(/RG\s*=\s*([-+]?\d*\.?\d+(?:[eE][-+]?\d+)?)/);
      const rrMatch = block.match(/RR\s*=\s*([-+]?\d*\.?\d+(?:[eE][-+]?\d+)?)/);
      const ltMatch = block.match(/LT\s*=\s*([-+]?\d*\.?\d+(?:[eE][-+]?\d+)?)/);

      if (xMatch && yMatch && zMatch && rgMatch) {
        return {
          xKm: parseFloat(xMatch[1]),
          yKm: parseFloat(yMatch[1]),
          zKm: parseFloat(zMatch[1]),
          vxKmS: vxMatch ? parseFloat(vxMatch[1]) : 0,
          vyKmS: vyMatch ? parseFloat(vyMatch[1]) : 0,
          vzKmS: vzMatch ? parseFloat(vzMatch[1]) : 0,
          rangeKm: parseFloat(rgMatch[1]),
          rangeRateKmS: rrMatch ? parseFloat(rrMatch[1]) : 0,
          lightTimeSec: ltMatch ? parseFloat(ltMatch[1]) : parseFloat(rgMatch[1]) / 299792.458,
          dateStr,
          isLive: true,
          source: 'NASA JPL Horizons System (DE441/DE440 Ephemeris)',
        };
      }
    }
  } catch (err) {
    // Graceful fallback to local high-precision astronomy-engine
  }

  // Fallback using local Meeus analytical ephemeris with central-difference velocity
  const tMs = dateObj.getTime();
  const dtSec = 60;
  const state0 = computeCelestialState(tMs);
  const stateMinus = computeCelestialState(tMs - dtSec * 1000);
  const statePlus = computeCelestialState(tMs + dtSec * 1000);

  const toGeocentricEclipticKm = (st) => {
    const r = st.earth?.distanceKm || 384400;
    // Direction from Moon to Earth is (subLat, subLon); Earth to Moon is opposite
    const latRad = -((st.earth?.subLat || 0) * Math.PI) / 180;
    const lonRad = (((st.earth?.subLon || 0) + 180) * Math.PI) / 180;
    return {
      x: r * Math.cos(latRad) * Math.cos(lonRad),
      y: r * Math.cos(latRad) * Math.sin(lonRad),
      z: r * Math.sin(latRad),
      r,
    };
  };

  const p0 = toGeocentricEclipticKm(state0);
  const pMinus = toGeocentricEclipticKm(stateMinus);
  const pPlus = toGeocentricEclipticKm(statePlus);

  const vxKmS = Number(((pPlus.x - pMinus.x) / (2 * dtSec)).toFixed(4));
  const vyKmS = Number(((pPlus.y - pMinus.y) / (2 * dtSec)).toFixed(4));
  const vzKmS = Number(((pPlus.z - pMinus.z) / (2 * dtSec)).toFixed(4));
  const rangeRateKmS = Number(((pPlus.r - pMinus.r) / (2 * dtSec)).toFixed(4));

  return {
    xKm: Number(p0.x.toFixed(2)),
    yKm: Number(p0.y.toFixed(2)),
    zKm: Number(p0.z.toFixed(2)),
    vxKmS,
    vyKmS,
    vzKmS,
    rangeKm: Number(p0.r.toFixed(2)),
    rangeRateKmS,
    lightTimeSec: Number((p0.r / 299792.458).toFixed(4)),
    dateStr,
    isLive: false,
    source: 'Calculated (Meeus Analytical Ephemeris — Central Difference)',
  };
}


