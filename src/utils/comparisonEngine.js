import { LANDING_SITES } from '../data/landingSites.js';
import { CLPS_MISSIONS } from '../data/clpsMissions.js';
import { computeCelestialState, solarPosition } from './lunarEphemeris.js';
import { evaluateEarthLink, DEFAULT_DTE_CONSTRAINTS } from './earthLink.js';
import { getLunarTemperature } from './lunarThermal.js';
import {
  HORIZON_TABLE,
  horizonAt,
  hasHorizon,
  sampleLunarTerrainMetrics,
  ensurePolarDemLoaded,
} from './horizons.js';
import { determineLunarGeologicalRegion } from './coordinates.js';
import { NASA_DATASETS_REGISTRY } from '../data/nasaProvenance.js';
import {
  computeTerrainSuitability,
  computeSolarSuitability,
  computeCommunicationSuitability,
  computeThermalSuitability,
  computeOverallSuitability,
  DEFAULT_SUITABILITY_WEIGHTS,
} from './suitabilityScoring.js';

ensurePolarDemLoaded();

export const COMPARISON_SITE_PALETTE = [
  { index: 1, hex: '#00D2C4', label: 'Cyan', badgeClass: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50', dotClass: 'bg-cyan-400' },
  { index: 2, hex: '#A855F7', label: 'Purple', badgeClass: 'bg-purple-500/20 text-purple-300 border-purple-500/50', dotClass: 'bg-purple-400' },
  { index: 3, hex: '#38BDF8', label: 'Sky', badgeClass: 'bg-sky-500/20 text-sky-300 border-sky-500/50', dotClass: 'bg-sky-400' },
  { index: 4, hex: '#F59E0B', label: 'Amber', badgeClass: 'bg-amber-500/20 text-amber-300 border-amber-500/50', dotClass: 'bg-amber-400' },
  { index: 5, hex: '#10B981', label: 'Emerald', badgeClass: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50', dotClass: 'bg-emerald-400' },
  { index: 6, hex: '#F43F5E', label: 'Rose', badgeClass: 'bg-rose-500/20 text-rose-300 border-rose-500/50', dotClass: 'bg-rose-400' },
  { index: 7, hex: '#6366F1', label: 'Indigo', badgeClass: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/50', dotClass: 'bg-indigo-400' },
  { index: 8, hex: '#EC4899', label: 'Pink', badgeClass: 'bg-pink-500/20 text-pink-300 border-pink-500/50', dotClass: 'bg-pink-400' },
];

export const MISSION_DURATIONS = [
  { days: 7, label: '7 Days', hours: 168, description: 'Short-duration surface sortie (~0.25 lunation)' },
  { days: 14, label: '14 Days', hours: 336, description: 'Standard lunar daylight window (~0.5 lunation)' },
  { days: 28, label: '28 Days', hours: 672, description: 'Full synodic lunar cycle (~1.0 lunation)' },
];

export const SUITABILITY_WEIGHTS = Object.freeze({
  solar: 0.35,
  communication: 0.30,
  terrain: 0.20,
  thermal: 0.15,
});

export const PREDEFINED_COMPARISON_SITES = LANDING_SITES.map((s) => {
  const lat = Number.isFinite(s.latitude) ? s.latitude : Number.isFinite(s.lat) ? s.lat : 0;
  const lon = Number.isFinite(s.longitude) ? s.longitude : Number.isFinite(s.lon) ? s.lon : 0;
  return {
    id: s.id,
    name: s.name,
    latitude: lat,
    longitude: lon,
    elevationMeters: Number.isFinite(s.elevationMeters)
      ? s.elevationMeters
      : Number.isFinite(s.elevationM)
      ? s.elevationM
      : null,
    slopeDeg: Number.isFinite(s.slopeDeg) ? s.slopeDeg : null,
    isCustom: false,
    category: s.name.includes('Artemis') || lat <= -80
      ? 'South Pole & Artemis Candidates'
      : s.type === 'clps-mission'
      ? 'NASA CLPS Missions'
      : s.type === 'landing-site'
      ? 'Historical Apollo & Luna Landings'
      : 'International & Robotic Landers',
    agency: s.agency || 'NASA',
    description: s.description || '',
    source: s.source || 'NASA Landing Site Catalog',
    clpsData: s.clpsData || CLPS_MISSIONS.find((m) => m.id === s.id) || null,
  };
}).sort((a, b) => {
  const aPolar = a.latitude <= -80 ? 0 : 1;
  const bPolar = b.latitude <= -80 ? 0 : 1;
  if (aPolar !== bPolar) return aPolar - bPolar;
  return a.name.localeCompare(b.name);
});

/**
 * Validates arbitrary lunar coordinates without silently clamping or modifying them.
 * Selenographic latitude must be in [-90, 90] and longitude in [-180, 180].
 */
export function validateLunarCoordinates(rawLat, rawLon) {
  if (rawLat === '' || rawLat === null || rawLat === undefined) {
    return { isValid: false, error: 'Latitude is required.', lat: null, lon: null };
  }
  if (rawLon === '' || rawLon === null || rawLon === undefined) {
    return { isValid: false, error: 'Longitude is required.', lat: null, lon: null };
  }

  const lat = typeof rawLat === 'number' ? rawLat : Number(String(rawLat).trim());
  const lon = typeof rawLon === 'number' ? rawLon : Number(String(rawLon).trim());

  if (!Number.isFinite(lat)) {
    return { isValid: false, error: 'Latitude must be a valid finite number.', lat: null, lon: null };
  }
  if (!Number.isFinite(lon)) {
    return { isValid: false, error: 'Longitude must be a valid finite number.', lat: null, lon: null };
  }
  if (lat < -90 || lat > 90) {
    return {
      isValid: false,
      error: `Latitude ${lat}° is out of range. Valid lunar latitude is -90° to +90°.`,
      lat: null,
      lon: null,
    };
  }
  if (lon < -180 || lon > 180) {
    return {
      isValid: false,
      error: `Longitude ${lon}° is out of range. Valid lunar longitude is -180° to +180°.`,
      lat: null,
      lon: null,
    };
  }

  return {
    isValid: true,
    error: null,
    lat: Math.round(lat * 10000) / 10000,
    lon: Math.round(lon * 10000) / 10000,
  };
}

/**
 * Formats selenographic coordinates consistently (e.g., "85.90°S, 0.00°E").
 */
export function formatSelenographicCoords(lat, lon, digits = 2) {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return 'Data Not Available';
  const latStr = `${Math.abs(lat).toFixed(digits)}°${lat >= 0 ? 'N' : 'S'}`;
  const lonStr = `${Math.abs(lon).toFixed(digits)}°${lon >= 0 ? 'E' : 'W'}`;
  return `${latStr}, ${lonStr}`;
}

/**
 * Parameter metadata & provenance registry for every comparison matrix column.
 */
export const COMPARISON_PARAMETER_DEFINITIONS = [
  {
    id: 'coordinates',
    label: 'Coordinates',
    shortLabel: 'Coordinates',
    category: 'Identity',
    unit: 'deg (ME)',
    inStandardView: true,
    sortable: false,
    higherIsBetter: null,
    provenance: {
      datasetName: 'IAU Moon 2000 Mean Earth / Polar Axis (ME) Selenographic Frame',
      organization: 'IAU / NASA Goddard Space Flight Center',
      version: 'IAU 2000 / LRO LOLA Control Network',
      spatialResolution: '0.0001° angular precision (~3 m surface arc)',
      temporalResolution: 'Static selenographic reference frame',
      method: 'Direct selenographic coordinate assignment (user-defined or NASA catalog)',
      derivationType: 'Measured / Reference Coordinate',
    },
  },
  {
    id: 'solarIlluminationPct',
    label: 'Solar Illumination',
    shortLabel: 'Solar Illum.',
    category: 'Solar & Energy',
    unit: '%',
    inStandardView: true,
    sortable: true,
    higherIsBetter: true,
    provenance: {
      datasetName: 'NASA JPL DE421/Meeus Lunar Ephemeris + LRO LOLA 360° Horizon Mask',
      organization: 'NASA GSFC / JPL Solar System Dynamics',
      version: 'Meeus Analytical Series + LDEM_80S_400M',
      spatialResolution: '400 m/px horizon ray-marching (80°S–90°S); geometric horizon outside 80°S',
      temporalResolution: '2-hour time-step integration across full mission duration',
      method: 'Fraction of mission time-steps where apparent solar elevation exceeds local terrain horizon angle (el_sun > h_terrain).',
      derivationType: 'Model-Derived & DEM-Masked',
    },
  },
  {
    id: 'solarElevationDeg',
    label: 'Solar Elevation (Touchdown / Range)',
    shortLabel: 'Solar Elev.',
    category: 'Solar & Energy',
    unit: '°',
    inStandardView: false,
    sortable: true,
    higherIsBetter: true,
    provenance: {
      datasetName: 'NASA JPL DE421 / Meeus Subsolar Ephemeris',
      organization: 'NASA / IAU',
      version: 'J2000 Analytical Ephemeris',
      spatialResolution: 'Exact point topocentric evaluation',
      temporalResolution: '2-hour time-step sweep',
      method: 'Topocentric solar altitude above local tangent plane: asin(sin φ sin δ_s + cos φ cos δ_s cos(λ - λ_s)).',
      derivationType: 'Model-Derived',
    },
  },
  {
    id: 'totalSunlightHours',
    label: 'Total Sunlight Hours',
    shortLabel: 'Sunlight Hrs',
    category: 'Solar & Energy',
    unit: 'h',
    inStandardView: false,
    sortable: true,
    higherIsBetter: true,
    provenance: {
      datasetName: 'Meeus Solar Ephemeris + LRO LOLA Horizon Profile',
      organization: 'NASA GSFC / MIT LOLA Science Team',
      version: 'LDEM_80S_400M + Analytical Ephemeris',
      spatialResolution: '400 m/px (80°S–90°S)',
      temporalResolution: '2-hour integration step over 7 / 14 / 28 days',
      method: 'Cumulative duration where solar disc clears local topographic horizon mask.',
      derivationType: 'Model-Derived & DEM-Masked',
    },
  },
  {
    id: 'totalDarknessHours',
    label: 'Total Darkness Hours',
    shortLabel: 'Darkness Hrs',
    category: 'Solar & Energy',
    unit: 'h',
    inStandardView: false,
    sortable: true,
    higherIsBetter: false,
    provenance: {
      datasetName: 'Meeus Solar Ephemeris + LRO LOLA Horizon Profile',
      organization: 'NASA GSFC / MIT LOLA Science Team',
      version: 'LDEM_80S_400M + Analytical Ephemeris',
      spatialResolution: '400 m/px (80°S–90°S)',
      temporalResolution: '2-hour integration step over 7 / 14 / 28 days',
      method: 'Cumulative duration where Sun is below local tangent horizon or occluded by terrain ridges.',
      derivationType: 'Model-Derived & DEM-Masked',
    },
  },
  {
    id: 'longestContinuousDarkHours',
    label: 'Longest Continuous Darkness',
    shortLabel: 'Max Dark Streak',
    category: 'Solar & Energy',
    unit: 'h',
    inStandardView: false,
    sortable: true,
    higherIsBetter: false,
    provenance: {
      datasetName: 'Meeus Solar Ephemeris + LRO LOLA Horizon Profile',
      organization: 'NASA GSFC',
      version: 'LDEM_80S_400M',
      spatialResolution: '400 m/px (80°S–90°S)',
      temporalResolution: '2-hour contiguous streak analysis',
      method: 'Maximum uninterrupted shadow/night interval during the configured mission duration.',
      derivationType: 'Model-Derived & DEM-Masked',
    },
  },
  {
    id: 'solarPowerPotential',
    label: 'Solar Power Potential',
    shortLabel: 'Solar Power',
    category: 'Solar & Energy',
    unit: '%',
    inStandardView: true,
    sortable: true,
    higherIsBetter: true,
    provenance: {
      datasetName: 'Solar Incidence Flux Model (1,361 W/m² AM0 Solar Constant)',
      organization: 'NASA LRO / Analytical Photovoltaics Model',
      version: 'Normalized Vertical/Sun-Tracking mast flux factor',
      spatialResolution: 'Point evaluation with 400 m/px terrain shadow gating',
      temporalResolution: '2-hour time-step integration',
      method: 'Mean normalized solar flux availability across mission duration assuming unobstructed sun-tracking vertical polar mast when sunlit (0% when shadowed). Absolute kWh output requires spacecraft array area & conversion efficiency.',
      derivationType: 'Model-Derived (Normalized Flux Factor)',
    },
  },
  {
    id: 'illuminationStability',
    label: 'Illumination Stability',
    shortLabel: 'Illum. Stability',
    category: 'Solar & Energy',
    unit: 'regime',
    inStandardView: false,
    sortable: false,
    higherIsBetter: null,
    provenance: {
      datasetName: 'Time-Series Horizon Transition Analysis',
      organization: 'Luna Scientific Engine',
      version: 'v1.0',
      spatialResolution: '400 m/px DEM horizon mask (80°S–90°S)',
      temporalResolution: '2-hour step transition counter',
      method: 'Counts sunrise/sunset and ridge occultation transitions across the mission window.',
      derivationType: 'Model-Derived',
    },
  },
  {
    id: 'powerOpportunities',
    label: 'Power-Generation Opportunities',
    shortLabel: 'Charging Windows',
    category: 'Solar & Energy',
    unit: 'windows',
    inStandardView: false,
    sortable: true,
    higherIsBetter: true,
    provenance: {
      datasetName: 'Time-Series Solar Charging Window Integrator',
      organization: 'Luna Scientific Engine',
      version: 'v1.0',
      spatialResolution: '400 m/px DEM horizon mask (80°S–90°S)',
      temporalResolution: '2-hour step clustering',
      method: 'Identifies distinct sunlit charging windows and mean insolation flux.',
      derivationType: 'Model-Derived',
    },
  },
  {
    id: 'earthVisibilityPct',
    label: 'Earth Visibility (DTE LOS)',
    shortLabel: 'Earth Visibility',
    category: 'Communication & Visibility',
    unit: '%',
    inStandardView: true,
    sortable: true,
    higherIsBetter: true,
    provenance: {
      datasetName: 'Topocentric Selenographic Libration Ephemeris + LOLA Horizon Mask',
      organization: 'NASA JPL / GSFC',
      version: 'DE421 Libration Series + LDEM_80S_400M',
      spatialResolution: '400 m/px terrain horizon mask (80°S–90°S)',
      temporalResolution: '2-hour step integration over 7 / 14 / 28 days',
      method: 'Percentage of mission duration where apparent Earth disc clears local lunar horizon and terrain obstacles. Note: Geometric visibility does not guarantee RF link closure without spacecraft transponder & DSN scheduling.',
      derivationType: 'Model-Derived & DEM-Masked',
    },
  },
  {
    id: 'earthElevationDeg',
    label: 'Earth Elevation Angle',
    shortLabel: 'Earth Elev.',
    category: 'Communication & Visibility',
    unit: '°',
    inStandardView: false,
    sortable: true,
    higherIsBetter: true,
    provenance: {
      datasetName: 'Topocentric Lunar Libration Ephemeris',
      organization: 'NASA JPL NAIF',
      version: 'Moon Mean Earth (ME) Libration Model',
      spatialResolution: 'Point evaluation with 0.25° topocentric parallax',
      temporalResolution: '2-hour step sweep',
      method: 'Topocentric elevation of Earth center above local lunar tangent plane.',
      derivationType: 'Model-Derived',
    },
  },
  {
    id: 'commWindowsCount',
    label: 'Expected Communication Windows',
    shortLabel: 'Comm Windows',
    category: 'Communication & Visibility',
    unit: 'windows',
    inStandardView: false,
    sortable: true,
    higherIsBetter: true,
    provenance: {
      datasetName: 'Topocentric DTE Line-of-Sight Window Clustering',
      organization: 'Luna Scientific Engine',
      version: 'v1.0',
      spatialResolution: '400 m/px terrain mask (80°S–90°S)',
      temporalResolution: '2-hour step sweep',
      method: 'Contiguous intervals where Earth disc clears local terrain horizon.',
      derivationType: 'Model-Derived',
    },
  },
  {
    id: 'totalCommHours',
    label: 'Total Communication Availability',
    shortLabel: 'Total Comm Hrs',
    category: 'Communication & Visibility',
    unit: 'h',
    inStandardView: false,
    sortable: true,
    higherIsBetter: true,
    provenance: {
      datasetName: 'Topocentric DTE Line-of-Sight Integrator',
      organization: 'Luna Scientific Engine',
      version: 'v1.0',
      spatialResolution: '400 m/px terrain mask (80°S–90°S)',
      temporalResolution: '2-hour step sweep',
      method: 'Total hours with unobstructed geometric line-of-sight toward Earth.',
      derivationType: 'Model-Derived',
    },
  },
  {
    id: 'maxBlackoutHours',
    label: 'Communication Blackout Duration',
    shortLabel: 'Max Blackout',
    category: 'Communication & Visibility',
    unit: 'h',
    inStandardView: false,
    sortable: true,
    higherIsBetter: false,
    provenance: {
      datasetName: 'Topocentric DTE Occultation Analysis',
      organization: 'Luna Scientific Engine',
      version: 'v1.0',
      spatialResolution: '400 m/px terrain mask (80°S–90°S)',
      temporalResolution: '2-hour step sweep',
      method: 'Longest continuous interval where Earth is below the horizon or blocked by local lunar terrain.',
      derivationType: 'Model-Derived',
    },
  },
  {
    id: 'elevationM',
    label: 'Surface Elevation',
    shortLabel: 'Elevation',
    category: 'Terrain',
    unit: 'm',
    inStandardView: false,
    sortable: true,
    higherIsBetter: null,
    provenance: {
      datasetName: 'LRO LOLA South Pole Digital Elevation Model (LDEM_80S_400M)',
      organization: 'NASA GSFC / MIT LOLA Science Team',
      version: 'PDS Level 3 GDR (SVS-5127, 0.5 m vertical scale)',
      spatialResolution: '400 m/px (80°S–90°S) or Published NASA Site Catalog',
      temporalResolution: 'Static geodetic topography (rel. to R₀ = 1,737,400 m)',
      method: 'Bilinear interpolation on 1520×1520 Int16 LOLA polar grid (or published site datum). Unavailable for custom sites north of 80°S.',
      derivationType: 'Measured Dataset (LRO LOLA)',
    },
  },
  {
    id: 'slopeDeg',
    label: 'Terrain Slope',
    shortLabel: 'Terrain Slope',
    category: 'Terrain',
    unit: '°',
    inStandardView: true,
    sortable: true,
    higherIsBetter: false,
    provenance: {
      datasetName: 'LRO LOLA South Pole Digital Elevation Model (LDEM_80S_400M)',
      organization: 'NASA GSFC / MIT LOLA Science Team',
      version: 'PDS Level 3 GDR',
      spatialResolution: '400 m/px (1.2 km 3×3 Horn stencil)',
      temporalResolution: 'Static geodetic topography',
      method: 'Horn (1981) 3×3 finite-difference surface gradient atan(hypot(dz/dx, dz/dy)) on LOLA DEM. Unavailable north of 80°S unless published in mission catalog.',
      derivationType: 'Dataset-Derived (LRO LOLA Horn 3×3)',
    },
  },
  {
    id: 'roughnessM',
    label: 'Surface Roughness',
    shortLabel: 'Roughness',
    category: 'Terrain',
    unit: 'm RMS',
    inStandardView: true,
    sortable: true,
    higherIsBetter: false,
    provenance: {
      datasetName: 'LRO LOLA South Pole Digital Elevation Model (LDEM_80S_400M)',
      organization: 'NASA GSFC / MIT LOLA Science Team',
      version: 'PDS Level 3 GDR',
      spatialResolution: '400 m/px sampled over 2.0 km circular neighborhood',
      temporalResolution: 'Static geodetic topography',
      method: 'Root-mean-square (RMS) vertical elevation dispersion within 2 km radius on LOLA DEM. Unavailable north of 80°S.',
      derivationType: 'Dataset-Derived (LRO LOLA RMS)',
    },
  },
  {
    id: 'localReliefM',
    label: 'Local Topographical Variation',
    shortLabel: 'Local Relief',
    category: 'Terrain',
    unit: 'm',
    inStandardView: false,
    sortable: true,
    higherIsBetter: false,
    provenance: {
      datasetName: 'LRO LOLA South Pole Digital Elevation Model (LDEM_80S_400M)',
      organization: 'NASA GSFC',
      version: 'PDS Level 3 GDR',
      spatialResolution: '400 m/px within 2.0 km radius',
      temporalResolution: 'Static geodetic topography',
      method: 'Peak-to-trough vertical elevation span (z_max - z_min) within 2.0 km radius. Unavailable north of 80°S.',
      derivationType: 'Dataset-Derived (LRO LOLA)',
    },
  },
  {
    id: 'terrainClassification',
    label: 'Terrain Classification',
    shortLabel: 'Terrain Class',
    category: 'Terrain',
    unit: 'type',
    inStandardView: false,
    sortable: false,
    higherIsBetter: null,
    provenance: {
      datasetName: 'USGS / IAU Selenographic Geologic Province Boundaries & LOLA Hypsometry',
      organization: 'USGS Astrogeology / IAU',
      version: ' Unified Geologic Map of the Moon',
      spatialResolution: 'Regional selenographic province + 400 m/px polar classification',
      temporalResolution: 'Static',
      method: 'Selenographic basin/highland/polar morphological classification.',
      derivationType: 'Dataset-Derived',
    },
  },
  {
    id: 'landingHazards',
    label: 'Potential Landing Hazards',
    shortLabel: 'Landing Hazards',
    category: 'Terrain',
    unit: 'flags',
    inStandardView: false,
    sortable: false,
    higherIsBetter: null,
    provenance: {
      datasetName: 'LRO LOLA Slope/Roughness Hazard Thresholds & Ephemeris Shadowing',
      organization: 'NASA Artemis / CLPS Flight Safety Criteria',
      version: '10° caution / 15° tip-over limit; 15 m RMS roughness limit',
      spatialResolution: '400 m/px (80°S–90°S)',
      temporalResolution: 'Mission window evaluation',
      method: 'Evaluates slope ≥ 10°, RMS roughness ≥ 15 m, deep basin shadow traps, and farside occultation.',
      derivationType: 'Model & Dataset-Derived',
    },
  },
  {
    id: 'surfaceTempRange',
    label: 'Surface Temperature (Min / Max)',
    shortLabel: 'Surface Temp',
    category: 'Thermal',
    unit: '°C (K)',
    inStandardView: true,
    sortable: true,
    higherIsBetter: true,
    provenance: {
      datasetName: 'Analytical Lunar Surface Radiative Balance Model (Vasavada et al. 2012 / Paige et al. 2010)',
      organization: 'Parameterized from NASA LRO Diviner Lunar Radiometer Literature',
      version: 'Stefan-Boltzmann Radiative Equilibrium + PSR Floor Model',
      spatialResolution: 'Point evaluation coupled to 400 m/px LOLA horizon shadow mask',
      temporalResolution: '2-hour time-step sweep across 7 / 14 / 28 days',
      method: 'Model-derived radiative balance: T_day = 100 + 290·(cos θ)^0.25 K when sunlit; 70–85 K in transient polar shadow; 40 K (-233°C) in deep polar cold traps; 100 K (-173°C) in equatorial night. Note: Gridded Diviner GDR rasters are not loaded locally.',
      derivationType: 'Model-Derived (Analytical Radiative Balance)',
    },
  },
  {
    id: 'touchdownTempC',
    label: 'Touchdown Surface Temperature',
    shortLabel: 'Touchdown Temp',
    category: 'Thermal',
    unit: '°C',
    inStandardView: false,
    sortable: true,
    higherIsBetter: true,
    provenance: {
      datasetName: 'Analytical Lunar Surface Radiative Balance Model',
      organization: 'Parameterized from LRO Diviner Literature',
      version: 'v1.0',
      spatialResolution: 'Point evaluation',
      temporalResolution: 'Instantaneous at reference epoch t₀',
      method: 'Radiative equilibrium temperature at touchdown epoch t₀.',
      derivationType: 'Model-Derived',
    },
  },
  {
    id: 'tempVariationC',
    label: 'Temperature Variation (ΔT)',
    shortLabel: 'Temp Swing ΔT',
    category: 'Thermal',
    unit: '°C',
    inStandardView: false,
    sortable: true,
    higherIsBetter: false,
    provenance: {
      datasetName: 'Analytical Lunar Surface Radiative Balance Model',
      organization: 'Luna Scientific Engine',
      version: 'v1.0',
      spatialResolution: 'Point evaluation',
      temporalResolution: '2-hour step sweep over mission duration',
      method: 'Peak-to-trough thermal excursion (T_max - T_min) across the selected 7-, 14-, or 28-day mission window.',
      derivationType: 'Model-Derived',
    },
  },
  {
    id: 'thermalExposure',
    label: 'Expected Thermal Exposure',
    shortLabel: 'Thermal Exposure',
    category: 'Thermal',
    unit: 'hours',
    inStandardView: false,
    sortable: false,
    higherIsBetter: null,
    provenance: {
      datasetName: 'Time-Integrated Thermal Regimen Classifier',
      organization: 'Luna Scientific Engine',
      version: 'v1.0',
      spatialResolution: 'Point evaluation',
      temporalResolution: '2-hour step sweep over mission duration',
      method: 'Integrates hours spent in benign sunlit regime (> -100°C) vs. cryogenic night/shadow regime (≤ -150°C).',
      derivationType: 'Model-Derived',
    },
  },
  {
    id: 'terrainSuitability',
    label: 'Terrain Suitability',
    shortLabel: 'Terrain Score',
    category: 'Suitability',
    unit: '/ 100',
    inStandardView: false,
    sortable: true,
    higherIsBetter: true,
    provenance: {
      datasetName: 'LOLA Slope & Roughness Safety Margin Index',
      organization: 'Luna Scientific Engine',
      version: 'v1.0',
      spatialResolution: '400 m/px (80°S–90°S)',
      temporalResolution: 'Static',
      method: 'S_terrain = max(0, round((1 - slopeDeg / 15) * 100)) penalized by up to 15 pts if RMS roughness ≥ 15 m. Returns Data Not Available if slopeDeg is unavailable.',
      derivationType: 'Model-Derived from LOLA DEM',
    },
  },
  {
    id: 'solarSuitability',
    label: 'Solar-Energy Suitability',
    shortLabel: 'Solar Score',
    category: 'Suitability',
    unit: '/ 100',
    inStandardView: false,
    sortable: true,
    higherIsBetter: true,
    provenance: {
      datasetName: 'Mission Window Solar Availability & Darkness Survival Index',
      organization: 'Luna Scientific Engine',
      version: 'v1.0',
      spatialResolution: '400 m/px DEM horizon mask (80°S–90°S)',
      temporalResolution: '7 / 14 / 28-day window',
      method: 'S_solar = round(0.75 * sunlitPct + 0.25 * max(0, min(100, round(100 - (longestDarkHours / totalHours) * 100)))). Reflects both cumulative insolation and continuous darkness survival relative to mission window.',
      derivationType: 'Model-Derived',
    },
  },
  {
    id: 'commSuitability',
    label: 'Communication Suitability',
    shortLabel: 'Comm Score',
    category: 'Suitability',
    unit: '/ 100',
    inStandardView: false,
    sortable: true,
    higherIsBetter: true,
    provenance: {
      datasetName: 'Direct-to-Earth Line-of-Sight & Blackout Index',
      organization: 'Luna Scientific Engine',
      version: 'v1.0',
      spatialResolution: '400 m/px DEM horizon mask (80°S–90°S)',
      temporalResolution: '7 / 14 / 28-day window',
      method: 'S_comm = earthVisibilityPct === 0 ? 0 : round(0.80 * dteAvailabilityPct + 0.20 * max(0, min(100, round(100 - (maxBlackoutHours / totalHours) * 100)))). Zero on lunar farside without orbital relay.',
      derivationType: 'Model-Derived',
    },
  },
  {
    id: 'thermalSuitability',
    label: 'Thermal Suitability',
    shortLabel: 'Thermal Score',
    category: 'Suitability',
    unit: '/ 100',
    inStandardView: false,
    sortable: true,
    higherIsBetter: true,
    provenance: {
      datasetName: 'Cryogenic Survival & Thermal Excursion Index',
      organization: 'Luna Scientific Engine',
      version: 'v1.0',
      spatialResolution: 'Point evaluation',
      temporalResolution: '7 / 14 / 28-day window',
      method: 'S_thermal = round(0.70 * max(0, min(100, round(((minTempK - 40) / 210) * 100))) + 0.30 * max(0, min(100, round(100 - tempVariationC / 3.2)))). Reflects cryogenic floor survival and thermal swing stability.',
      derivationType: 'Model-Derived',
    },
  },
  {
    id: 'overallSuitability',
    label: 'Overall Mission Suitability',
    shortLabel: 'Suitability',
    category: 'Suitability',
    unit: '/ 100',
    inStandardView: true,
    sortable: true,
    higherIsBetter: true,
    provenance: {
      datasetName: 'Weighted Multi-Disciplinary Mission Suitability Index',
      organization: 'Luna Decision Support System',
      version: 'v2.0 (Strict Completeness Guard)',
      spatialResolution: '400 m/px LOLA DEM + Analytical Ephemeris',
      temporalResolution: 'Evaluated over full 7 / 14 / 28-day mission duration',
      method: 'Overall = 35%·Solar + 30%·Comm + 20%·Terrain + 15%·Thermal. Calculated ONLY when all four component scores (including measured/catalog terrain slope) are available. Otherwise reported as Insufficient Data for Scoring.',
      derivationType: 'Composite Decision Metric',
    },
  },
];

export function evaluateComparisonLocation(location, startMs, durationDays = 14) {
  const coordCheck = validateLunarCoordinates(
    location?.latitude ?? location?.lat,
    location?.longitude ?? location?.lon
  );

  if (!coordCheck.isValid) {
    return {
      id: location?.id || 'invalid-site',
      name: location?.name || 'Invalid Location',
      isCustom: Boolean(location?.isCustom),
      isValid: false,
      validationError: coordCheck.error,
      completenessStatus: 'Insufficient Data',
      completenessReason: coordCheck.error,
    };
  }

  const lat = coordCheck.lat;
  const lon = coordCheck.lon;
  const safeStartMs =
    typeof startMs === 'number' && Number.isFinite(startMs) ? startMs : Date.now();
  const safeDurationDays = [7, 14, 28].includes(Number(durationDays))
    ? Number(durationDays)
    : Math.max(1, Number(durationDays) || 14);

  const siteId = location?.id || `custom-${lat.toFixed(4)}-${lon.toFixed(4)}`;
  const isCustom = Boolean(location?.isCustom);
  const inSouthPoleDem = lat <= -80.0;

  // Sample terrain metrics from LOLA South Pole DEM (when lat <= -80°S) or catalog
  const terrainMetrics = sampleLunarTerrainMetrics(lat, lon, {
    ...location,
    id: siteId,
    latitude: lat,
    longitude: lon,
    isCustomPin: isCustom,
  });

  const elevationM =
    typeof terrainMetrics?.elevationM === 'number' && Number.isFinite(terrainMetrics.elevationM)
      ? terrainMetrics.elevationM
      : null;
  const slopeDeg =
    typeof terrainMetrics?.slopeDeg === 'number' && Number.isFinite(terrainMetrics.slopeDeg)
      ? terrainMetrics.slopeDeg
      : null;
  const roughnessM =
    typeof terrainMetrics?.roughnessM === 'number' && Number.isFinite(terrainMetrics.roughnessM)
      ? terrainMetrics.roughnessM
      : null;
  const localReliefM =
    typeof terrainMetrics?.reliefM === 'number' && Number.isFinite(terrainMetrics.reliefM)
      ? terrainMetrics.reliefM
      : null;

  const isHorizonAvailable = hasHorizon(HORIZON_TABLE, siteId, lat, lon);
  const isFarSide = Math.abs(lon) > 95;

  const stepHours = 2;
  const totalHours = safeDurationDays * 24;
  const totalSteps = Math.round(totalHours / stepHours);
  const stepMs = stepHours * 3600000;

  let sunlitSteps = 0;
  let currentSunlitStreak = 0;
  let maxSunlitStreak = 0;
  let currentDarkStreak = 0;
  let maxDarkStreak = 0;
  let sunlitWindowsCount = 0;
  let solarTransitionsCount = 0;
  let prevSunlit = null;

  let minSunElevDeg = Infinity;
  let maxSunElevDeg = -Infinity;
  let sumSunElevDeg = 0;
  let sumArrayFluxPct = 0;

  let dteClearSteps = 0;
  let currentDteStreak = 0;
  let maxDteStreak = 0;
  let currentBlackoutStreak = 0;
  let maxBlackoutStreak = 0;
  let commWindowsCount = 0;
  let prevDteLinked = null;

  let minEarthElevDeg = Infinity;
  let maxEarthElevDeg = -Infinity;

  let minTempC = Infinity;
  let maxTempC = -Infinity;
  let minTempK = Infinity;
  let maxTempK = -Infinity;
  let cryogenicSteps = 0;
  let benignThermalSteps = 0;

  let touchdownSnapshot = null;

  const moonFeatureForDte = {
    id: siteId,
    name: location?.name || 'Candidate Site',
    latitude: lat,
    longitude: lon,
    elevationM: elevationM ?? 0,
  };

  for (let i = 0; i <= totalSteps; i++) {
    const tMs = safeStartMs + i * stepMs;
    const state = computeCelestialState(tMs);

    const flatSun = solarPosition(state, lat, lon, 0);
    const rawSunHorizon = horizonAt(HORIZON_TABLE, siteId, flatSun.azimuthDeg, lat, lon);
    const sunHorizonDeg =
      rawSunHorizon !== null && Number.isFinite(rawSunHorizon) ? rawSunHorizon : 0.0;
    const sun = solarPosition(state, lat, lon, sunHorizonDeg);
    const isSunlit = sun.status === 'sunlit';

    if (sun.elevationDeg < minSunElevDeg) minSunElevDeg = sun.elevationDeg;
    if (sun.elevationDeg > maxSunElevDeg) maxSunElevDeg = sun.elevationDeg;

    // Normalized solar incidence factor on a vertical polar / sun-tracking collector
    // When sunlit, low polar sun angles strike a vertical panel with cos(el), whereas high equatorial angles strike horizontal panels with sin(el).
    // For consistent cross-lunar physical comparison, use direct normal incidence gated by atmospheric-free horizon clearance, attenuated only in grazing (<2°) limb conditions:
    const stepFluxPct = isSunlit
      ? Math.round(
          Math.min(
            100,
            Math.max(
              15,
              Math.abs(lat) >= 75
                ? Math.cos((Math.max(0, sun.elevationDeg) * Math.PI) / 180) * 100
                : Math.sin((Math.max(5, sun.elevationDeg) * Math.PI) / 180) * 100
            )
          )
        )
      : 0;

    const dte = evaluateEarthLink({
      state,
      moonFeature: moonFeatureForDte,
      earthFeature: null,
      constraints: DEFAULT_DTE_CONSTRAINTS,
      terrainFn: (az) => horizonAt(HORIZON_TABLE, siteId, az, lat, lon),
    });
    const isDteLinked = Boolean(dte.status === 'clear' || dte.status === 'doubtful');

    if (dte.elevationDeg < minEarthElevDeg) minEarthElevDeg = dte.elevationDeg;
    if (dte.elevationDeg > maxEarthElevDeg) maxEarthElevDeg = dte.elevationDeg;

    const thermal = getLunarTemperature(lat, lon, new Date(tMs), {
      terrainHorizonDeg: sunHorizonDeg,
      elevationM,
    });

    if (thermal.tempC < minTempC) minTempC = thermal.tempC;
    if (thermal.tempC > maxTempC) maxTempC = thermal.tempC;
    if (thermal.tempK < minTempK) minTempK = thermal.tempK;
    if (thermal.tempK > maxTempK) maxTempK = thermal.tempK;

    if (i === 0) {
      touchdownSnapshot = {
        timeMs: tMs,
        sunElevationDeg: Math.round(sun.elevationDeg * 100) / 100,
        sunAzimuthDeg: Math.round(sun.azimuthDeg * 10) / 10,
        sunHorizonDeg: isHorizonAvailable ? Math.round(sunHorizonDeg * 100) / 100 : null,
        clearanceDeg: Math.round((sun.elevationDeg - sunHorizonDeg) * 100) / 100,
        isSunlit,
        earthElevationDeg: Math.round(dte.elevationDeg * 100) / 100,
        earthMarginDeg: Math.round(dte.marginDeg * 100) / 100,
        earthStatus: dte.status,
        isDteLinked,
        tempC: thermal.tempC,
        tempK: thermal.tempK,
        subsurfaceTempC: thermal.subsurfaceTempC,
        isPSR: Boolean(thermal.isPSR),
      };
    }

    if (i < totalSteps) {
      sumSunElevDeg += sun.elevationDeg;
      sumArrayFluxPct += stepFluxPct;

      if (isSunlit) {
        sunlitSteps++;
        currentSunlitStreak++;
        currentDarkStreak = 0;
        if (currentSunlitStreak > maxSunlitStreak) maxSunlitStreak = currentSunlitStreak;
        if (prevSunlit !== true) sunlitWindowsCount++;
      } else {
        currentDarkStreak++;
        currentSunlitStreak = 0;
        if (currentDarkStreak > maxDarkStreak) maxDarkStreak = currentDarkStreak;
      }
      if (prevSunlit !== null && prevSunlit !== isSunlit) {
        solarTransitionsCount++;
      }
      prevSunlit = isSunlit;

      if (isDteLinked) {
        dteClearSteps++;
        currentDteStreak++;
        currentBlackoutStreak = 0;
        if (currentDteStreak > maxDteStreak) maxDteStreak = currentDteStreak;
        if (prevDteLinked !== true) commWindowsCount++;
      } else {
        currentBlackoutStreak++;
        currentDteStreak = 0;
        if (currentBlackoutStreak > maxBlackoutStreak) {
          maxBlackoutStreak = currentBlackoutStreak;
        }
      }
      prevDteLinked = isDteLinked;

      if (thermal.tempC <= -150) cryogenicSteps++;
      else benignThermalSteps++;
    }
  }

  const solarIlluminationPct = Math.round((sunlitSteps / totalSteps) * 1000) / 10;
  const totalSunlightHours = sunlitSteps * stepHours;
  const totalDarknessHours = (totalSteps - sunlitSteps) * stepHours;
  const longestContinuousDarkHours = maxDarkStreak * stepHours;
  const longestContinuousSunlitHours = maxSunlitStreak * stepHours;
  const meanSunElevationDeg = Math.round((sumSunElevDeg / totalSteps) * 100) / 100;
  const solarPowerPotentialPct = Math.round((sumArrayFluxPct / totalSteps) * 10) / 10;

  let illuminationStability = 'Diurnal Day/Night Cycle';
  if (solarIlluminationPct >= 95) {
    illuminationStability = 'Continuous Polar Illumination';
  } else if (solarIlluminationPct <= 5) {
    illuminationStability = 'Prolonged Shadow / Night';
  } else if (solarTransitionsCount >= 3) {
    illuminationStability = `Multi-Ridge Occultation (${solarTransitionsCount} transitions)`;
  } else if (solarTransitionsCount === 0) {
    illuminationStability = solarIlluminationPct > 50 ? 'Uninterrupted Daylight' : 'Uninterrupted Darkness';
  } else {
    illuminationStability = `${solarTransitionsCount} Transition${solarTransitionsCount > 1 ? 's' : ''} (${sunlitWindowsCount} lit window${sunlitWindowsCount !== 1 ? 's' : ''})`;
  }

  const earthVisibilityPct = Math.round((dteClearSteps / totalSteps) * 1000) / 10;
  const totalCommHours = dteClearSteps * stepHours;
  const totalBlackoutHours = (totalSteps - dteClearSteps) * stepHours;
  const maxBlackoutHours = maxBlackoutStreak * stepHours;

  let earthVisibilityLabel = 'Clear DTE Line-of-Sight';
  if (earthVisibilityPct === 0) {
    earthVisibilityLabel = isFarSide ? 'Far-Side Occulted (0%)' : 'Terrain / Horizon Blocked (0%)';
  } else if (earthVisibilityPct < 100) {
    earthVisibilityLabel = `Periodic LOS (${earthVisibilityPct}%)`;
  } else if (touchdownSnapshot.earthElevationDeg < 5) {
    earthVisibilityLabel = `Grazing Polar LOS (${earthVisibilityPct}%)`;
  }

  const tempVariationC = Math.round(maxTempC - minTempC);
  const cryogenicHours = cryogenicSteps * stepHours;
  const benignThermalHours = benignThermalSteps * stepHours;

  const hazardFlags = [];
  if (slopeDeg !== null && slopeDeg >= 15.0) {
    hazardFlags.push(`Critical Slope (${slopeDeg.toFixed(1)}° ≥ 15° tip-over limit)`);
  } else if (slopeDeg !== null && slopeDeg >= 10.0) {
    hazardFlags.push(`Moderate Slope (${slopeDeg.toFixed(1)}° ≥ 10° caution)`);
  }
  if (roughnessM !== null && roughnessM >= 15.0) {
    hazardFlags.push(`High Roughness (${roughnessM.toFixed(1)} m RMS)`);
  }
  if (longestContinuousDarkHours >= 48) {
    hazardFlags.push(`Prolonged Darkness (${longestContinuousDarkHours}h continuous shadow)`);
  }
  if (earthVisibilityPct === 0) {
    hazardFlags.push(isFarSide ? 'Far-Side DTE Blackout (Relay Required)' : 'Full DTE Terrain Masking');
  } else if (maxBlackoutHours >= 24) {
    hazardFlags.push(`DTE Blackout (${maxBlackoutHours}h max loss of signal)`);
  }
  if (minTempC <= -200) {
    hazardFlags.push(`Extreme Cryogenic Floor (${minTempC}°C / ${minTempK} K)`);
  }
  if (slopeDeg === null) {
    hazardFlags.push('Local DEM Slope Unmodeled (North of 80°S)');
  }

  const terrainSuitability = computeTerrainSuitability(slopeDeg, roughnessM);
  const solarSuitability = computeSolarSuitability(
    solarIlluminationPct,
    longestContinuousDarkHours,
    totalHours
  );
  const commSuitability = computeCommunicationSuitability(
    earthVisibilityPct,
    maxBlackoutHours,
    totalHours,
    isFarSide
  );
  const thermalSuitability = computeThermalSuitability(minTempK, tempVariationC);

  const overall = computeOverallSuitability({
    solarSuitability,
    commSuitability,
    terrainSuitability,
    thermalSuitability,
    weights: SUITABILITY_WEIGHTS,
    slopeDeg,
  });

  const hasCompleteScoringInputs = overall.hasCompleteScoringInputs;
  const rawOverallSuitability = overall.overallSuitability;
  const overallSuitability = overall.overallSuitability;
  const suitabilityLabel = overall.suitabilityLabel;

  const missingDatasets = [];
  if (elevationM === null) {
    missingDatasets.push('Surface Elevation (Outside 80°S–90°S LOLA DEM)');
  }
  if (slopeDeg === null) {
    missingDatasets.push('Terrain Slope (Outside 80°S–90°S LOLA DEM)');
  }
  if (roughnessM === null) {
    missingDatasets.push('Surface Roughness & Local Relief (Outside 80°S–90°S LOLA DEM)');
  }
  if (!isHorizonAvailable) {
    missingDatasets.push('360° Topographic Horizon Profile (Geometric 0° horizon used)');
  }
  const hasAllCoreTerrainAndEphemeris =
    elevationM !== null && slopeDeg !== null && roughnessM !== null && isHorizonAvailable;

  const completenessStatus = hasAllCoreTerrainAndEphemeris
    ? 'Complete'
    : elevationM !== null || slopeDeg !== null || isHorizonAvailable
    ? 'Partially Available'
    : 'Partially Available';

  const completenessDetail = hasAllCoreTerrainAndEphemeris
    ? 'All core LOLA 400 m/px polar DEM terrain, 360° horizon, ephemeris, and radiative thermal models available.'
    : `Ephemeris & thermal models active; ${missingDatasets.slice(0, 2).join('; ')}.`;

  const geoRegion = determineLunarGeologicalRegion(lat, lon);

  return {
    id: siteId,
    name: location?.name || `Location (${formatSelenographicCoords(lat, lon)})`,
    isCustom,
    isValid: true,
    latitude: lat,
    longitude: lon,
    formattedCoords: formatSelenographicCoords(lat, lon, 2),
    agency: location?.agency || (isCustom ? 'User-Defined' : 'NASA'),
    category: location?.category || (inSouthPoleDem ? 'South Pole Region (80°S–90°S)' : geoRegion.province),
    durationDays: safeDurationDays,
    durationHours: totalHours,
    referenceEpochMs: safeStartMs,
    referenceEpochUtc: new Date(safeStartMs).toUTCString(),
    inSouthPoleDem,
    isHorizonAvailable,
    isFarSide,
    completenessStatus,
    completenessDetail,
    missingDatasets,
    touchdown: touchdownSnapshot,

    solar: {
      solarIlluminationPct,
      touchdownElevationDeg: touchdownSnapshot.sunElevationDeg,
      minElevationDeg: Math.round(minSunElevDeg * 100) / 100,
      maxElevationDeg: Math.round(maxSunElevDeg * 100) / 100,
      meanElevationDeg: meanSunElevationDeg,
      totalSunlightHours,
      totalDarknessHours,
      longestContinuousDarkHours,
      longestContinuousSunlitHours,
      solarPowerPotentialPct,
      illuminationStability,
      sunlitWindowsCount,
      solarTransitionsCount,
      powerOpportunitiesLabel:
        sunlitWindowsCount > 0
          ? `${sunlitWindowsCount} window${sunlitWindowsCount > 1 ? 's' : ''} (${totalSunlightHours}h lit · ${solarPowerPotentialPct}% mean flux)`
          : '0 windows (0h lit — Continuous Shadow/Night)',
    },

    communication: {
      earthVisibilityPct,
      earthVisibilityLabel,
      touchdownElevationDeg: touchdownSnapshot.earthElevationDeg,
      minElevationDeg: Math.round(minEarthElevDeg * 100) / 100,
      maxElevationDeg: Math.round(maxEarthElevDeg * 100) / 100,
      touchdownMarginDeg: touchdownSnapshot.earthMarginDeg,
      commWindowsCount,
      totalCommHours,
      totalBlackoutHours,
      maxBlackoutHours,
      infrastructureNote:
        'Geometric line-of-sight only; operational link closure depends on lander RF EIRP, antenna gimbal mask, and Earth DSN station visibility.',
    },

    terrain: {
      elevationM,
      elevationSource: terrainMetrics?.elevationSource || null,
      slopeDeg,
      slopeSource: terrainMetrics?.slopeSource || null,
      roughnessM,
      localReliefM,
      terrainClassification: terrainMetrics?.terrainClassification || geoRegion.province,
      geologicalProvince: geoRegion.province,
      nearestLandmark: terrainMetrics?.nearestLandmark || null,
      hazardFlags,
      hazardSummary:
        hazardFlags.length > 0 ? hazardFlags.join(' · ') : 'Nominal (<10° slope, clear LOS)',
    },

    thermal: {
      touchdownTempC: touchdownSnapshot.tempC,
      touchdownTempK: touchdownSnapshot.tempK,
      minTempC: Math.round(minTempC),
      maxTempC: Math.round(maxTempC),
      minTempK: Math.round(minTempK),
      maxTempK: Math.round(maxTempK),
      subsurfaceTempC: touchdownSnapshot.subsurfaceTempC,
      tempVariationC,
      cryogenicHours,
      benignThermalHours,
      isPSR: touchdownSnapshot.isPSR,
      exposureSummary: `${benignThermalHours}h benign / ${cryogenicHours}h cryogenic (≤ -150°C)`,
      derivationNote:
        'Model-Derived (Analytical Stefan-Boltzmann Radiative Equilibrium; gridded LRO Diviner GDR not loaded locally)',
    },

    suitability: {
      terrainSuitability,
      solarSuitability,
      commSuitability,
      thermalSuitability,
      overallSuitability,
      rawOverallSuitability,
      hasCompleteScoringInputs,
      suitabilityLabel,
      weights: SUITABILITY_WEIGHTS,
      formulaExplanation: hasCompleteScoringInputs
        ? `0.35×Solar(${solarSuitability}) + 0.30×Comm(${commSuitability}) + 0.20×Terrain(${terrainSuitability}) + 0.15×Thermal(${thermalSuitability}) = ${overallSuitability}/100`
        : 'Insufficient Data for Scoring — Terrain slope is unavailable outside the 80°S–90°S LOLA DEM coverage (and not present in catalog).',
    },
  };
}

/**
 * Generates an evidence-based multi-site trade-off analysis and recommendation
 * from 2 to 8 evaluated locations over the selected mission duration.
 * Never fabricates a winner when essential scoring data is missing or tied.
 */
export function computeMultiSiteTradeOffAnalysis(evaluations, durationDays = 14) {
  const validEvals = (evaluations || []).filter((e) => e && e.isValid);
  if (validEvals.length < 2) {
    const singleLoc = validEvals[0];
    return {
      status: 'Insufficient Locations',
      hasDefensibleWinner: false,
      recommendationTitle: singleLoc
        ? `1 Location Selected (${singleLoc.name}) — Add a 2nd Location to Compare`
        : 'No Defensible Recommendation — Select at Least 2 Locations',
      recommendationRationale: singleLoc
        ? `Currently evaluating ${singleLoc.name} (${formatSelenographicCoords(singleLoc.latitude, singleLoc.longitude)}). Select a second landing site to generate comparative trade-off rankings, illumination contrasts, and operational recommendations.`
        : null,
      bestCandidate: null,
      keyDifferences: [],
      advantagesBySite: [],
      criticalRisks: singleLoc?.risks || [],
      missingInformation: singleLoc?.dataLimitations || [],
      parametersRequiringInvestigation: [],
    };
  }

  const bySolar = [...validEvals].sort(
    (a, b) => b.solar.solarIlluminationPct - a.solar.solarIlluminationPct
  );
  const byDarkness = [...validEvals].sort(
    (a, b) => a.solar.longestContinuousDarkHours - b.solar.longestContinuousDarkHours
  );
  const byComm = [...validEvals].sort(
    (a, b) => b.communication.earthVisibilityPct - a.communication.earthVisibilityPct
  );
  const withSlope = validEvals.filter((e) => e.terrain.slopeDeg !== null);
  const bySlope = [...withSlope].sort((a, b) => a.terrain.slopeDeg - b.terrain.slopeDeg);
  const byThermalMin = [...validEvals].sort((a, b) => b.thermal.minTempC - a.thermal.minTempC);

  const keyDifferences = [];

  const topSolar = bySolar[0];
  const lowSolar = bySolar[bySolar.length - 1];
  if (topSolar.solar.solarIlluminationPct !== lowSolar.solar.solarIlluminationPct) {
    keyDifferences.push(
      `${topSolar.name} achieves the highest solar illumination (${topSolar.solar.solarIlluminationPct}% · ${topSolar.solar.totalSunlightHours}h lit over ${durationDays}d), compared to ${lowSolar.solar.solarIlluminationPct}% (${lowSolar.solar.totalSunlightHours}h) at ${lowSolar.name}.`
    );
  } else {
    keyDifferences.push(
      `All evaluated sites share identical solar illumination (${topSolar.solar.solarIlluminationPct}% · ${topSolar.solar.totalSunlightHours}h) over the ${durationDays}-day window.`
    );
  }

  const bestDark = byDarkness[0];
  const worstDark = byDarkness[byDarkness.length - 1];
  if (worstDark.solar.longestContinuousDarkHours > bestDark.solar.longestContinuousDarkHours) {
    keyDifferences.push(
      `${bestDark.name} minimizes continuous darkness exposure (${bestDark.solar.longestContinuousDarkHours}h max shadow), whereas ${worstDark.name} experiences up to ${worstDark.solar.longestContinuousDarkHours}h of uninterrupted darkness.`
    );
  }

  if (bySlope.length >= 2) {
    const flattest = bySlope[0];
    const steepest = bySlope[bySlope.length - 1];
    if (flattest.terrain.slopeDeg !== steepest.terrain.slopeDeg) {
      keyDifferences.push(
        `${flattest.name} has the gentlest available terrain slope (${flattest.terrain.slopeDeg.toFixed(1)}°), while ${steepest.name} exhibits a ${steepest.terrain.slopeDeg.toFixed(1)}° gradient.`
      );
    }
  } else if (bySlope.length === 1) {
    keyDifferences.push(
      `Only ${bySlope[0].name} has measured/catalog terrain slope data (${bySlope[0].terrain.slopeDeg.toFixed(1)}°); other selected locations lack local DEM slope coverage.`
    );
  } else {
    keyDifferences.push(
      'None of the selected locations have local LOLA DEM slope coverage in loaded memory (all are custom coordinates north of 80°S).'
    );
  }

  const topComm = byComm[0];
  const lowComm = byComm[byComm.length - 1];
  if (topComm.communication.earthVisibilityPct !== lowComm.communication.earthVisibilityPct) {
    keyDifferences.push(
      `${topComm.name} provides ${topComm.communication.earthVisibilityPct}% Direct-to-Earth line-of-sight (${topComm.communication.totalCommHours}h), compared to ${lowComm.communication.earthVisibilityPct}% (${lowComm.communication.totalCommHours}h) at ${lowComm.name}.`
    );
  }

  const warmestMin = byThermalMin[0];
  const coldestMin = byThermalMin[byThermalMin.length - 1];
  if (warmestMin.thermal.minTempC !== coldestMin.thermal.minTempC) {
    keyDifferences.push(
      `Minimum surface temperature ranges from ${warmestMin.thermal.minTempC}°C (${warmestMin.thermal.minTempK} K) at ${warmestMin.name} down to ${coldestMin.thermal.minTempC}°C (${coldestMin.thermal.minTempK} K) at ${coldestMin.name}.`
    );
  }

  const fullyScoredEvals = validEvals.filter(
    (e) => e.suitability.overallSuitability !== null
  );
  const unscoredEvals = validEvals.filter(
    (e) => e.suitability.overallSuitability === null
  );
  const safeScoredEvals = fullyScoredEvals
    .filter((e) => (e.terrain.slopeDeg ?? 0) < 15.0)
    .sort((a, b) => {
      const diffRaw =
        (b.suitability.rawOverallSuitability ?? b.suitability.overallSuitability) -
        (a.suitability.rawOverallSuitability ?? a.suitability.overallSuitability);
      if (Math.abs(diffRaw) > 0.01) return diffRaw;
      const diffSolar = b.solar.solarIlluminationPct - a.solar.solarIlluminationPct;
      if (Math.abs(diffSolar) > 0.01) return diffSolar;
      return (a.terrain.slopeDeg ?? 90) - (b.terrain.slopeDeg ?? 90);
    });

  let hasDefensibleWinner = false;
  let recommendationTitle = 'No Defensible Recommendation — Insufficient Data';
  let recommendationRationale = '';
  let bestCandidate = null;

  if (fullyScoredEvals.length < 2) {
    hasDefensibleWinner = false;
    recommendationTitle = 'No Defensible Recommendation — Insufficient Data';
    recommendationRationale = `Complete suitability scoring requires terrain slope, solar illumination, Earth visibility, and thermal metrics for at least two candidates. ${unscoredEvals.map((u) => u.name).join(', ')} lack local LOLA DEM slope/roughness coverage (north of 80°S).`;
  } else if (safeScoredEvals.length === 0) {
    hasDefensibleWinner = false;
    recommendationTitle = 'No Defensible Recommendation — Critical Safety Constraint Violations';
    recommendationRationale =
      'All fully scored candidates exceed the 15.0° lander tip-over slope threshold.';
  } else if (
    safeScoredEvals.length >= 2 &&
    safeScoredEvals[0].suitability.rawOverallSuitability ===
      safeScoredEvals[1].suitability.rawOverallSuitability &&
    safeScoredEvals[0].solar.solarIlluminationPct ===
      safeScoredEvals[1].solar.solarIlluminationPct &&
    safeScoredEvals[0].terrain.slopeDeg === safeScoredEvals[1].terrain.slopeDeg
  ) {
    hasDefensibleWinner = false;
    recommendationTitle = `Tied Overall Suitability (${safeScoredEvals[0].suitability.overallSuitability}/100) — Mission-Specific Trade-Off Required`;
    recommendationRationale = `${safeScoredEvals[0].name} and ${safeScoredEvals[1].name} achieve identical composite suitability (${safeScoredEvals[0].suitability.overallSuitability}/100) over the ${durationDays}-day window. Selection depends on subsystem priority (solar margin vs. terrain gradient).`;
  } else {
    bestCandidate = safeScoredEvals[0];
    hasDefensibleWinner = true;
    const partialWarning =
      unscoredEvals.length > 0
        ? ` (Note: ${unscoredEvals.map((u) => u.name).join(', ')} excluded from composite ranking due to missing DEM slope data)`
        : '';
    recommendationTitle = `Best-Supported Candidate: ${bestCandidate.name} (${bestCandidate.suitability.overallSuitability}/100 over ${durationDays} Days)`;
    recommendationRationale = `${bestCandidate.name} (${bestCandidate.formattedCoords}) leads with ${bestCandidate.solar.solarIlluminationPct}% solar illumination (${bestCandidate.solar.totalSunlightHours}h lit), ${bestCandidate.communication.earthVisibilityPct}% Direct-to-Earth visibility, and a ${bestCandidate.terrain.slopeDeg.toFixed(1)}° local slope${partialWarning}.`;
  }

  const siteSummaries = validEvals.map((ev) => {
    const advantages = [];
    const disadvantages = [];

    if (ev.solar.solarIlluminationPct >= 80) {
      advantages.push(`High solar illumination (${ev.solar.solarIlluminationPct}% · ${ev.solar.totalSunlightHours}h)`);
    } else if (ev.solar.solarIlluminationPct <= 35) {
      disadvantages.push(`Low solar illumination (${ev.solar.solarIlluminationPct}% · ${ev.solar.totalDarknessHours}h darkness)`);
    }

    if (ev.solar.longestContinuousDarkHours <= 12) {
      advantages.push(`Minimal continuous shadow (${ev.solar.longestContinuousDarkHours}h max darkness)`);
    } else if (ev.solar.longestContinuousDarkHours >= 48) {
      disadvantages.push(`Prolonged continuous darkness (${ev.solar.longestContinuousDarkHours}h streak)`);
    }

    if (ev.communication.earthVisibilityPct >= 95) {
      advantages.push(`Continuous Direct-to-Earth LOS (${ev.communication.earthVisibilityPct}%)`);
    } else if (ev.communication.earthVisibilityPct === 0) {
      disadvantages.push('0% Direct-to-Earth visibility (requires lunar relay satellite)');
    } else {
      disadvantages.push(`Periodic DTE blackouts (${ev.communication.maxBlackoutHours}h max blackout)`);
    }

    if (ev.terrain.slopeDeg !== null) {
      if (ev.terrain.slopeDeg <= 5.0) {
        advantages.push(`Low terrain slope (${ev.terrain.slopeDeg.toFixed(1)}° gradient)`);
      } else if (ev.terrain.slopeDeg >= 10.0) {
        disadvantages.push(`Elevated terrain slope (${ev.terrain.slopeDeg.toFixed(1)}° gradient)`);
      }
    } else {
      disadvantages.push('Missing local DEM terrain slope & roughness data');
    }

    if (ev.thermal.minTempC <= -180) {
      disadvantages.push(`Deep cryogenic minimum temperature (${ev.thermal.minTempC}°C / ${ev.thermal.minTempK} K)`);
    } else if (ev.thermal.minTempC >= -120) {
      advantages.push(`Moderate minimum thermal floor (${ev.thermal.minTempC}°C)`);
    }

    return {
      id: ev.id,
      name: ev.name,
      advantages,
      disadvantages,
    };
  });

  const criticalRisks = [];
  const missingInformation = [];

  validEvals.forEach((ev) => {
    if (ev.terrain.slopeDeg !== null && ev.terrain.slopeDeg >= 15.0) {
      criticalRisks.push(
        `${ev.name}: Terrain slope (${ev.terrain.slopeDeg.toFixed(1)}°) exceeds 15° lander tip-over limit.`
      );
    }
    if (ev.solar.longestContinuousDarkHours >= 72) {
      criticalRisks.push(
        `${ev.name}: ${ev.solar.longestContinuousDarkHours}h continuous darkness during ${durationDays}-day mission requires radioisotope heating or high-capacity cryogenic batteries.`
      );
    }
    if (ev.communication.earthVisibilityPct === 0) {
      criticalRisks.push(
        `${ev.name}: Zero direct Earth line-of-sight; mission cannot operate without a dedicated lunar relay orbiter.`
      );
    }
    if (ev.terrain.slopeDeg === null || ev.terrain.roughnessM === null) {
      missingInformation.push(
        `${ev.name} (${ev.formattedCoords}): Local LOLA DEM slope, RMS roughness, and 360° horizon profile are unavailable (coordinate is north of the 80°S–90°S polar DEM).`
      );
    }
  });

  missingInformation.push(
    'All Sites: Local crater spatial density catalog (craters per 100 km²) and LRO Diviner gridded bolometric brightness temperature rasters are not loaded in local memory.'
  );

  const parametersRequiringInvestigation = [
    'LROC NAC meter-scale (0.5–2 m/px) boulder abundance and sub-pixel crater rim hazards within the 100 m terminal landing ellipse.',
    'Spacecraft-specific solar array geometry (vertical cylinder vs. tracking wing) and battery depth-of-discharge margins across shadow intervals.',
    'Earth DSN station horizon masks and X/Ka-band link margin under grazing (<3°) polar Earth elevation angles.',
  ];

  return {
    status: hasDefensibleWinner ? 'Recommendation Available' : 'Conditional / Incomplete',
    hasDefensibleWinner,
    recommendationTitle,
    recommendationRationale,
    bestCandidate,
    keyDifferences,
    siteSummaries,
    criticalRisks,
    missingInformation,
    parametersRequiringInvestigation,
  };
}

/**
 * Formats a parameter value and status for a given evaluated site and column definition.
 * Never fabricates missing values; returns 'Data Not Available' when null.
 */
export function getMatrixCellDisplay(ev, paramId) {
  if (!ev || !ev.isValid) {
    return {
      text: 'Data Not Available',
      subtext: null,
      numericValue: null,
      isUnavailable: true,
      status: 'unavailable',
    };
  }

  switch (paramId) {
    case 'coordinates':
      return {
        text: ev.formattedCoords,
        subtext: ev.isCustom ? 'User-defined' : ev.agency || 'NASA Catalog',
        numericValue: ev.latitude,
        isUnavailable: false,
        status: 'neutral',
      };

    case 'solarIlluminationPct':
      return {
        text: `${ev.solar.solarIlluminationPct.toFixed(1)}%`,
        subtext: `${ev.solar.totalSunlightHours}h / ${ev.durationHours}h`,
        numericValue: ev.solar.solarIlluminationPct,
        isUnavailable: false,
        status:
          ev.solar.solarIlluminationPct >= 75
            ? 'favorable'
            : ev.solar.solarIlluminationPct >= 40
            ? 'conditional'
            : 'unfavorable',
      };

    case 'solarElevationDeg':
      return {
        text: `${ev.solar.touchdownElevationDeg.toFixed(2)}°`,
        subtext: `Range: ${ev.solar.minElevationDeg.toFixed(1)}° to ${ev.solar.maxElevationDeg.toFixed(1)}°`,
        numericValue: ev.solar.touchdownElevationDeg,
        isUnavailable: false,
        status: ev.solar.touchdownElevationDeg > 0 ? 'favorable' : 'unfavorable',
      };

    case 'totalSunlightHours':
      return {
        text: `${ev.solar.totalSunlightHours} h`,
        subtext: `of ${ev.durationHours} h (${ev.durationDays}d)`,
        numericValue: ev.solar.totalSunlightHours,
        isUnavailable: false,
        status:
          ev.solar.totalSunlightHours >= ev.durationHours * 0.7
            ? 'favorable'
            : ev.solar.totalSunlightHours >= ev.durationHours * 0.4
            ? 'conditional'
            : 'unfavorable',
      };

    case 'totalDarknessHours':
      return {
        text: `${ev.solar.totalDarknessHours} h`,
        subtext: `${(100 - ev.solar.solarIlluminationPct).toFixed(1)}% of mission`,
        numericValue: ev.solar.totalDarknessHours,
        isUnavailable: false,
        status:
          ev.solar.totalDarknessHours <= 24
            ? 'favorable'
            : ev.solar.totalDarknessHours <= 96
            ? 'conditional'
            : 'unfavorable',
      };

    case 'longestContinuousDarkHours':
      return {
        text: `${ev.solar.longestContinuousDarkHours} h`,
        subtext:
          ev.solar.longestContinuousDarkHours === 0
            ? 'Zero shadow intervals'
            : 'Max uninterrupted dark',
        numericValue: ev.solar.longestContinuousDarkHours,
        isUnavailable: false,
        status:
          ev.solar.longestContinuousDarkHours <= 12
            ? 'favorable'
            : ev.solar.longestContinuousDarkHours <= 48
            ? 'conditional'
            : 'unfavorable',
      };

    case 'solarPowerPotential':
      return {
        text: `${ev.solar.solarPowerPotentialPct.toFixed(1)}%`,
        subtext: 'Mean array flux factor (Model)',
        numericValue: ev.solar.solarPowerPotentialPct,
        isUnavailable: false,
        status:
          ev.solar.solarPowerPotentialPct >= 65
            ? 'favorable'
            : ev.solar.solarPowerPotentialPct >= 35
            ? 'conditional'
            : 'unfavorable',
      };

    case 'illuminationStability':
      return {
        text: ev.solar.illuminationStability,
        subtext: `${ev.solar.solarTransitionsCount} horizon transition(s)`,
        numericValue: -ev.solar.solarTransitionsCount,
        isUnavailable: false,
        status:
          ev.solar.solarIlluminationPct >= 85
            ? 'favorable'
            : ev.solar.solarIlluminationPct >= 40
            ? 'conditional'
            : 'unfavorable',
      };

    case 'powerOpportunities':
      return {
        text: `${ev.solar.sunlitWindowsCount} window${ev.solar.sunlitWindowsCount !== 1 ? 's' : ''}`,
        subtext: `${ev.solar.totalSunlightHours}h cumulative charging`,
        numericValue: ev.solar.totalSunlightHours,
        isUnavailable: false,
        status: ev.solar.totalSunlightHours > 0 ? 'favorable' : 'unfavorable',
      };

    case 'earthVisibilityPct':
      return {
        text: `${ev.communication.earthVisibilityPct.toFixed(1)}%`,
        subtext: `${ev.communication.totalCommHours}h LOS (${ev.communication.touchdownElevationDeg.toFixed(1)}° el)`,
        numericValue: ev.communication.earthVisibilityPct,
        isUnavailable: false,
        status:
          ev.communication.earthVisibilityPct >= 85
            ? 'favorable'
            : ev.communication.earthVisibilityPct >= 40
            ? 'conditional'
            : 'unfavorable',
      };

    case 'earthElevationDeg':
      return {
        text: `${ev.communication.touchdownElevationDeg.toFixed(2)}°`,
        subtext: `Range: ${ev.communication.minElevationDeg.toFixed(1)}° to ${ev.communication.maxElevationDeg.toFixed(1)}°`,
        numericValue: ev.communication.touchdownElevationDeg,
        isUnavailable: false,
        status:
          ev.communication.touchdownElevationDeg >= 5
            ? 'favorable'
            : ev.communication.touchdownElevationDeg > 0
            ? 'conditional'
            : 'unfavorable',
      };

    case 'commWindowsCount':
      return {
        text: `${ev.communication.commWindowsCount} window${ev.communication.commWindowsCount !== 1 ? 's' : ''}`,
        subtext:
          ev.communication.earthVisibilityPct === 100
            ? 'Continuous geometric LOS'
            : ev.communication.earthVisibilityPct === 0
            ? 'No direct Earth LOS'
            : 'Periodic libration windows',
        numericValue: ev.communication.totalCommHours,
        isUnavailable: false,
        status: ev.communication.totalCommHours > 0 ? 'favorable' : 'unfavorable',
      };

    case 'totalCommHours':
      return {
        text: `${ev.communication.totalCommHours} h`,
        subtext: `of ${ev.durationHours} h (${ev.communication.earthVisibilityPct.toFixed(0)}%)`,
        numericValue: ev.communication.totalCommHours,
        isUnavailable: false,
        status:
          ev.communication.earthVisibilityPct >= 80
            ? 'favorable'
            : ev.communication.earthVisibilityPct >= 40
            ? 'conditional'
            : 'unfavorable',
      };

    case 'maxBlackoutHours':
      return {
        text: `${ev.communication.maxBlackoutHours} h`,
        subtext:
          ev.communication.maxBlackoutHours === 0
            ? '0h blackout'
            : `${ev.communication.totalBlackoutHours}h total occluded`,
        numericValue: ev.communication.maxBlackoutHours,
        isUnavailable: false,
        status:
          ev.communication.maxBlackoutHours === 0
            ? 'favorable'
            : ev.communication.maxBlackoutHours <= 24
            ? 'conditional'
            : 'unfavorable',
      };

    case 'elevationM':
      if (ev.terrain.elevationM === null) {
        return {
          text: 'Data Not Available',
          subtext: 'Outside 80°S–90°S LOLA DEM',
          numericValue: null,
          isUnavailable: true,
          status: 'unavailable',
        };
      }
      return {
        text: `${ev.terrain.elevationM >= 0 ? '+' : ''}${ev.terrain.elevationM.toLocaleString()} m`,
        subtext: ev.inSouthPoleDem ? 'LOLA 400 m/px DEM' : 'NASA Site Catalog',
        numericValue: ev.terrain.elevationM,
        isUnavailable: false,
        status: 'neutral',
      };

    case 'slopeDeg':
      if (ev.terrain.slopeDeg === null) {
        return {
          text: 'Data Not Available',
          subtext: 'Outside 80°S–90°S LOLA DEM',
          numericValue: null,
          isUnavailable: true,
          status: 'unavailable',
        };
      }
      return {
        text: `${ev.terrain.slopeDeg.toFixed(1)}°`,
        subtext:
          ev.terrain.slopeDeg < 5
            ? 'Safe (<5°)'
            : ev.terrain.slopeDeg < 10
            ? 'Moderate (<10°)'
            : ev.terrain.slopeDeg < 15
            ? 'Caution (10°–15°)'
            : 'Hazard (≥15° Limit)',
        numericValue: ev.terrain.slopeDeg,
        isUnavailable: false,
        status:
          ev.terrain.slopeDeg < 8
            ? 'favorable'
            : ev.terrain.slopeDeg < 15
            ? 'conditional'
            : 'unfavorable',
      };

    case 'roughnessM':
      if (ev.terrain.roughnessM === null) {
        return {
          text: 'Data Not Available',
          subtext: 'Outside 80°S–90°S LOLA DEM',
          numericValue: null,
          isUnavailable: true,
          status: 'unavailable',
        };
      }
      return {
        text: `${ev.terrain.roughnessM.toFixed(1)} m RMS`,
        subtext: '2.0 km LOLA neighborhood',
        numericValue: ev.terrain.roughnessM,
        isUnavailable: false,
        status:
          ev.terrain.roughnessM < 8
            ? 'favorable'
            : ev.terrain.roughnessM < 15
            ? 'conditional'
            : 'unfavorable',
      };

    case 'localReliefM':
      if (ev.terrain.localReliefM === null) {
        return {
          text: 'Data Not Available',
          subtext: 'Outside 80°S–90°S LOLA DEM',
          numericValue: null,
          isUnavailable: true,
          status: 'unavailable',
        };
      }
      return {
        text: `${ev.terrain.localReliefM.toFixed(0)} m`,
        subtext: 'Max–min span (2 km radius)',
        numericValue: ev.terrain.localReliefM,
        isUnavailable: false,
        status:
          ev.terrain.localReliefM < 150
            ? 'favorable'
            : ev.terrain.localReliefM < 400
            ? 'conditional'
            : 'unfavorable',
      };

    case 'terrainClassification':
      return {
        text: ev.terrain.terrainClassification,
        subtext: ev.terrain.geologicalProvince,
        numericValue: null,
        isUnavailable: false,
        status: 'neutral',
      };

    case 'landingHazards':
      return {
        text:
          ev.terrain.hazardFlags.length === 0
            ? 'None Identified'
            : `${ev.terrain.hazardFlags.length} Flag(s)`,
        subtext: ev.terrain.hazardSummary,
        numericValue: -ev.terrain.hazardFlags.length,
        isUnavailable: false,
        status:
          ev.terrain.hazardFlags.length === 0
            ? 'favorable'
            : ev.terrain.slopeDeg !== null && ev.terrain.slopeDeg >= 15
            ? 'unfavorable'
            : 'conditional',
      };

    case 'surfaceTempRange':
      return {
        text: `${ev.thermal.minTempC}°C to ${ev.thermal.maxTempC > 0 ? '+' : ''}${ev.thermal.maxTempC}°C`,
        subtext: `${ev.thermal.minTempK}–${ev.thermal.maxTempK} K (Model-Derived)`,
        numericValue: ev.thermal.minTempC,
        isUnavailable: false,
        status:
          ev.thermal.minTempC > -150
            ? 'favorable'
            : ev.thermal.minTempC > -195
            ? 'conditional'
            : 'unfavorable',
      };

    case 'touchdownTempC':
      return {
        text: `${ev.thermal.touchdownTempC}°C (${ev.thermal.touchdownTempK} K)`,
        subtext: 'Model-Derived at t₀',
        numericValue: ev.thermal.touchdownTempC,
        isUnavailable: false,
        status:
          ev.thermal.touchdownTempC > -140
            ? 'favorable'
            : ev.thermal.touchdownTempC > -190
            ? 'conditional'
            : 'unfavorable',
      };

    case 'tempVariationC':
      return {
        text: `Δ${ev.thermal.tempVariationC}°C`,
        subtext: `Over ${ev.durationDays}-day mission`,
        numericValue: ev.thermal.tempVariationC,
        isUnavailable: false,
        status:
          ev.thermal.tempVariationC <= 40
            ? 'favorable'
            : ev.thermal.tempVariationC <= 180
            ? 'conditional'
            : 'unfavorable',
      };

    case 'thermalExposure':
      return {
        text: `${ev.thermal.cryogenicHours}h cryo / ${ev.thermal.benignThermalHours}h benign`,
        subtext: 'Threshold: -150°C (123 K)',
        numericValue: -ev.thermal.cryogenicHours,
        isUnavailable: false,
        status:
          ev.thermal.cryogenicHours === 0
            ? 'favorable'
            : ev.thermal.cryogenicHours <= ev.durationHours * 0.3
            ? 'conditional'
            : 'unfavorable',
      };

    case 'terrainSuitability':
      if (ev.suitability.terrainSuitability === null) {
        return {
          text: 'Data Not Available',
          subtext: 'Slope data required',
          numericValue: null,
          isUnavailable: true,
          status: 'unavailable',
        };
      }
      return {
        text: `${ev.suitability.terrainSuitability} / 100`,
        subtext: `±1.2° · Horn 3×3 LOLA slope (${ev.terrain.slopeDeg.toFixed(1)}°)`,
        numericValue: ev.suitability.terrainSuitability,
        isUnavailable: false,
        status:
          ev.suitability.terrainSuitability >= 75
            ? 'favorable'
            : ev.suitability.terrainSuitability >= 50
            ? 'conditional'
            : 'unfavorable',
      };

    case 'solarSuitability':
      return {
        text: `${ev.suitability.solarSuitability} / 100`,
        subtext: `±3–6% · 360° LOLA horizon + Meeus (${ev.solar.solarIlluminationPct.toFixed(0)}% lit, ${ev.durationDays}d)`,
        numericValue: ev.suitability.solarSuitability,
        isUnavailable: false,
        status:
          ev.suitability.solarSuitability >= 75
            ? 'favorable'
            : ev.suitability.solarSuitability >= 50
            ? 'conditional'
            : 'unfavorable',
      };

    case 'commSuitability':
      return {
        text: `${ev.suitability.commSuitability} / 100`,
        subtext: `±3–5% · DE440 libration + horizon (${ev.communication.earthVisibilityPct.toFixed(0)}% DTE LOS)`,
        numericValue: ev.suitability.commSuitability,
        isUnavailable: false,
        status:
          ev.suitability.commSuitability >= 75
            ? 'favorable'
            : ev.suitability.commSuitability >= 50
            ? 'conditional'
            : 'unfavorable',
      };

    case 'thermalSuitability':
      return {
        text: `${ev.suitability.thermalSuitability} / 100`,
        subtext: `±10–15 K · Diviner radiative model (Min ${ev.thermal.minTempC}°C)`,
        numericValue: ev.suitability.thermalSuitability,
        isUnavailable: false,
        status:
          ev.suitability.thermalSuitability >= 75
            ? 'favorable'
            : ev.suitability.thermalSuitability >= 50
            ? 'conditional'
            : 'unfavorable',
      };

    case 'overallSuitability':
      if (ev.suitability.overallSuitability === null) {
        return {
          text: 'Insufficient Data for Scoring',
          subtext: 'Missing DEM terrain slope',
          numericValue: null,
          isUnavailable: true,
          status: 'unavailable',
        };
      }
      return {
        text: `${ev.suitability.overallSuitability} / 100`,
        subtext: `${
          ev.suitability.overallSuitability >= 75
            ? 'Favorable'
            : ev.suitability.overallSuitability >= 50
            ? 'Conditional'
            : 'Challenging'
        } (±4 pts · 35% Sun + 30% Comm + 20% Slope + 15% Thermal)`,
        numericValue: ev.suitability.overallSuitability,
        isUnavailable: false,
        status:
          ev.suitability.overallSuitability >= 75
            ? 'favorable'
            : ev.suitability.overallSuitability >= 50
            ? 'conditional'
            : 'unfavorable',
      };

    default:
      return {
        text: 'Data Not Available',
        subtext: null,
        numericValue: null,
        isUnavailable: true,
        status: 'unavailable',
      };
  }
}

export const MAX_COMPARISON_LOCATIONS = 8;
export const MIN_COMPARISON_LOCATIONS = 2;

/**
 * Returns initial comparison locations (starts empty so no sites are unexpectedly preselected).
 * @internal Test & comparison store initialization export.
 */
export function getDefaultComparisonLocations() {
  return [];
}

/**
 * Normalizes any feature selected on the 3D Lunar Globe or 2D Map
 * (predefined landing site, CLPS mission, crater, mare, or Custom Dropped Pin)
 * into a comparison location entry.
 * @internal Test & location normalization utility export.
 */
export function normalizeFeatureToComparisonLocation(feature, existingCount = 0) {
  if (!feature) return null;

  const isCustomPin = Boolean(
    feature.isCustom ||
      feature.isCustomPin ||
      feature.type === 'custom_pin' ||
      String(feature.id || '').startsWith('custom')
  );

  if (!isCustomPin && feature.id) {
    const matched = PREDEFINED_COMPARISON_SITES.find(
      (s) => s.id === feature.id || s.id === feature.landingSiteId
    );
    if (matched) {
      return { ...matched };
    }
  }

  const rawLat =
    feature.verifiedCoordinates?.latitude ??
    feature.latitude ??
    feature.lat;
  const rawLon =
    feature.verifiedCoordinates?.longitude ??
    feature.longitude ??
    feature.lon;

  const check = validateLunarCoordinates(rawLat, rawLon);
  if (!check.isValid) return null;

  const coordLabel = formatSelenographicCoords(check.lat, check.lon, 2);
  const rawName = (feature.name || feature.missionName || '').trim();
  const isGenericCustomName =
    !rawName ||
    rawName.toLowerCase() === 'custom dropped pin' ||
    rawName.toLowerCase() === 'dropped pin' ||
    rawName.toLowerCase() === 'custom pin';

  const resolvedName = isGenericCustomName
    ? `Custom Pin (${coordLabel})`
    : rawName;

  const resolvedId = isCustomPin
    ? `custom-pin-${check.lat.toFixed(4)}-${check.lon.toFixed(4)}`
    : feature.id || `map-loc-${check.lat.toFixed(4)}-${check.lon.toFixed(4)}`;

  return {
    id: resolvedId,
    name: resolvedName,
    latitude: check.lat,
    longitude: check.lon,
    elevationMeters: Number.isFinite(feature.elevationMeters)
      ? feature.elevationMeters
      : Number.isFinite(feature.elevationM)
      ? feature.elevationM
      : null,
    slopeDeg: Number.isFinite(feature.slopeDeg) ? feature.slopeDeg : null,
    isCustom: isCustomPin || !PREDEFINED_COMPARISON_SITES.some((s) => s.id === feature.id),
    agency: feature.agency || (isCustomPin ? 'User-Defined (3D Map Pin)' : 'NASA / IAU'),
    category:
      feature.category ||
      (check.lat <= -80
        ? 'South Pole Region (80°S–90°S)'
        : `Lunar ${feature.type ? String(feature.type).replace(/[-_]/g, ' ') : 'Surface Location'}`),
  };
}

function createComparisonSelectionStore() {
  let state = {
    locations: getDefaultComparisonLocations(),
    isMapSelectionMode: false,
  };
  const listeners = new Set();

  const notify = () => {
    const snapshot = {
      locations: state.locations,
      isMapSelectionMode: state.isMapSelectionMode,
      maxLocations: MAX_COMPARISON_LOCATIONS,
      minLocations: MIN_COMPARISON_LOCATIONS,
    };
    listeners.forEach((fn) => {
      try {
        fn(snapshot);
      } catch {}
    });
  };

  const isFeatureInComparison = (feature) => {
    if (!feature || feature.body === 'earth') return false;
    const norm = normalizeFeatureToComparisonLocation(feature, state.locations.length);
    if (!norm) return false;
    return state.locations.some(
      (loc) =>
        loc.id === norm.id ||
        (Math.abs(loc.latitude - norm.latitude) < 0.0005 &&
          Math.abs(loc.longitude - norm.longitude) < 0.0005)
    );
  };

  return {
    get() {
      return {
        locations: state.locations,
        isMapSelectionMode: state.isMapSelectionMode,
        maxLocations: MAX_COMPARISON_LOCATIONS,
        minLocations: MIN_COMPARISON_LOCATIONS,
      };
    },
    getSnapshot() {
      return this.get();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    setLocations(nextOrUpdater) {
      const next =
        typeof nextOrUpdater === 'function'
          ? nextOrUpdater(state.locations)
          : nextOrUpdater;
      if (Array.isArray(next)) {
        state = {
          ...state,
          locations: next.slice(0, MAX_COMPARISON_LOCATIONS),
        };
        notify();
      }
    },
    setMapSelectionMode(active) {
      const nextMode = Boolean(active);
      if (state.isMapSelectionMode !== nextMode) {
        state = { ...state, isMapSelectionMode: nextMode };
        notify();
      }
    },
    enterMapSelectionMode() {
      this.setMapSelectionMode(true);
    },
    exitMapSelectionMode() {
      this.setMapSelectionMode(false);
    },
    isFeatureInComparison,
    addLocationFromMap(feature) {
      if (!feature) {
        return {
          ok: false,
          reason: 'INVALID_FEATURE',
          message: 'No lunar location selected.',
          count: state.locations.length,
          max: MAX_COMPARISON_LOCATIONS,
        };
      }
      if (feature.body === 'earth') {
        return {
          ok: false,
          reason: 'INVALID_BODY',
          message: 'Only lunar surface locations can be added to Lunar Site Comparison.',
          count: state.locations.length,
          max: MAX_COMPARISON_LOCATIONS,
        };
      }

      const normalized = normalizeFeatureToComparisonLocation(feature, state.locations.length);
      if (!normalized) {
        return {
          ok: false,
          reason: 'INVALID_COORDS',
          message: 'Selected feature does not have valid lunar coordinates.',
          count: state.locations.length,
          max: MAX_COMPARISON_LOCATIONS,
        };
      }

      const existing = state.locations.find(
        (loc) =>
          loc.id === normalized.id ||
          (Math.abs(loc.latitude - normalized.latitude) < 0.0005 &&
            Math.abs(loc.longitude - normalized.longitude) < 0.0005)
      );
      if (existing) {
        state = { ...state, isMapSelectionMode: true };
        notify();
        return {
          ok: false,
          reason: 'DUPLICATE',
          location: existing,
          count: state.locations.length,
          max: MAX_COMPARISON_LOCATIONS,
          message: `${existing.name} (${formatSelenographicCoords(existing.latitude, existing.longitude)}) is already in Site Comparison (${state.locations.length} / ${MAX_COMPARISON_LOCATIONS}).`,
        };
      }

      if (state.locations.length >= MAX_COMPARISON_LOCATIONS) {
        state = { ...state, isMapSelectionMode: true };
        notify();
        return {
          ok: false,
          reason: 'LIMIT_REACHED',
          count: state.locations.length,
          max: MAX_COMPARISON_LOCATIONS,
          message: `Cannot add location: Maximum limit of ${MAX_COMPARISON_LOCATIONS} comparison locations (${MAX_COMPARISON_LOCATIONS} / ${MAX_COMPARISON_LOCATIONS}) reached. Remove a location first.`,
        };
      }

      const nextLocations = [...state.locations, normalized];
      state = {
        ...state,
        locations: nextLocations,
        isMapSelectionMode: true,
      };
      notify();

      return {
        ok: true,
        action: 'added',
        reason: 'ADDED',
        location: normalized,
        count: nextLocations.length,
        max: MAX_COMPARISON_LOCATIONS,
        message: `${normalized.name} added to comparison (${nextLocations.length} / ${MAX_COMPARISON_LOCATIONS} selected).`,
      };
    },
    removeLocationFromMap(feature) {
      const normalized = normalizeFeatureToComparisonLocation(feature, state.locations.length);
      if (!normalized) {
        return {
          ok: false,
          reason: 'INVALID_COORDS',
          count: state.locations.length,
          max: MAX_COMPARISON_LOCATIONS,
          message: 'Selected feature does not have valid lunar coordinates.',
        };
      }
      const existing = state.locations.find(
        (loc) =>
          loc.id === normalized.id ||
          (Math.abs(loc.latitude - normalized.latitude) < 0.0005 &&
            Math.abs(loc.longitude - normalized.longitude) < 0.0005)
      );
      if (!existing) {
        return {
          ok: false,
          reason: 'NOT_FOUND',
          count: state.locations.length,
          max: MAX_COMPARISON_LOCATIONS,
          message: 'Location is not currently selected for comparison.',
        };
      }
      const nextLocations = state.locations.filter((loc) => loc.id !== existing.id);
      state = {
        ...state,
        locations: nextLocations,
      };
      notify();
      return {
        ok: true,
        action: 'removed',
        reason: 'REMOVED',
        location: existing,
        count: nextLocations.length,
        max: MAX_COMPARISON_LOCATIONS,
        message: `${existing.name} removed from comparison (${nextLocations.length} / ${MAX_COMPARISON_LOCATIONS} selected).`,
      };
    },
    toggleLocationFromMap(feature) {
      if (isFeatureInComparison(feature)) {
        return this.removeLocationFromMap(feature);
      }
      return this.addLocationFromMap(feature);
    },
    removeLocation(id) {
      const nextLocations = state.locations.filter((l) => l.id !== id);
      state = { ...state, locations: nextLocations };
      notify();
      return {
        ok: true,
        count: nextLocations.length,
        max: MAX_COMPARISON_LOCATIONS,
      };
    },
    clearLocations() {
      state = {
        ...state,
        locations: [],
        isMapSelectionMode: false,
      };
      notify();
      return state.locations;
    },
    resetLocations() {
      state = {
        ...state,
        locations: getDefaultComparisonLocations(),
        isMapSelectionMode: false,
      };
      notify();
      return state.locations;
    },
  };
}

export const comparisonSelectionStore = createComparisonSelectionStore();

export { NASA_DATASETS_REGISTRY };
