import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  X,
  MapPin,
  Navigation,
  Copy,
  Check,
  Maximize2,
  Minimize2,
  Minus,
  ExternalLink,
  Share2,
  GitCompare,
  Compass,
  Thermometer,
  Sun,
  Radio,
  AlertTriangle,
  CheckCircle2,
  ShieldCheck,
  ShieldAlert,
  Wind,
  RefreshCw,
  Mountain,
  Globe2,
  Rocket,
  Database,
  ChevronDown,
  Trash2,
  Info,
} from 'lucide-react';
import { formatLunarCoordinates, getLunarRegionInfo } from '../../utils/coordinates.js';
import { getClpsMission } from '../../data/clpsMissions.js';
import { getLunarTemperature } from '../../utils/lunarThermal.js';
import { notifySuccess } from '../../utils/feedbackStore.js';
import { computeCelestialState, solarPosition } from '../../utils/lunarEphemeris.js';
import { celestialTimeStore } from '../../utils/celestialTime.js';
import {
  HORIZON_TABLE,
  horizonAt,
  ensurePolarDemLoaded,
  sampleLunarTerrainMetrics,
} from '../../utils/horizons.js';
import {
  DEFAULT_DTE_CONSTRAINTS,
  earthLookFromMoon,
  evaluateEarthLink,
} from '../../utils/earthLink.js';
import {
  calculateEarthPositionTransition,
  calculateSolarTransition,
} from '../../utils/transitionTimes.js';
import {
  COMMUNICATION_TIMELINE_COLORS,
  SUNLIGHT_TIMELINE_COLORS,
} from '../../utils/visibilityColors.js';
import { EARTH_COMMUNICATION_SITES } from '../../data/earthCommunicationSites.js';
import { fetchSpaceWeather, FALLBACK_SPACE_WEATHER } from '../../services/spaceWeather.js';
import HorizonViewChart from './HorizonViewChart.jsx';
import DteSignalChart from '../communication/DteSignalChart.jsx';

import { PROVENANCE_BADGES } from '../../data/nasaProvenance.js';
import {
  evaluateCandidateForMissionWindow,
  DEFAULT_PLANNER_CONSTRAINTS,
} from '../../utils/plannerEngine.js';
import { comparisonSelectionStore } from '../../utils/comparisonEngine.js';

const TABS = [
  { id: 'overview', label: 'Overview', icon: Compass },
  { id: 'terrain', label: 'Terrain', icon: Mountain },
  { id: 'lighting', label: 'Lighting', icon: Sun },
  { id: 'communication', label: 'Comms', icon: Radio },
  { id: 'dossier', label: 'Dossier', icon: ShieldCheck },
];

const SUN_STATUS = {
  sunlit: { label: 'Sunlit', color: SUNLIGHT_TIMELINE_COLORS.sunlit },
  blocked: { label: 'Terrain Masked', color: SUNLIGHT_TIMELINE_COLORS.blocked },
  night: { label: 'Lunar Night', color: SUNLIGHT_TIMELINE_COLORS.night },
};

const EARTH_STATUS = {
  clear: { label: 'Link Active', color: COMMUNICATION_TIMELINE_COLORS.clear },
  doubtful: { label: 'Marginal', color: COMMUNICATION_TIMELINE_COLORS.doubtful },
  blocked: { label: 'Terrain Blocked', color: COMMUNICATION_TIMELINE_COLORS.blocked },
  away: { label: 'Far Side', color: '#fb923c' },
};

export default function FeaturePanel({
  feature,
  timelineVisible = false,
  communicationEarthFeature = null,
  onClose,
  onZoomHere,
  onClearCustomPin,
  onCompareMission,
  onReturnToComparison,
  onSelectOtherBody,
}) {
  const [activeTab, setActiveTab] = useState('overview');
  const [isExpanded, setIsExpanded] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [copied, setCopied] = useState(false);
  const [shared, setShared] = useState(false);
  const [demLoadedTick, setDemLoadedTick] = useState(0);
  const [roughnessRadiusM, setRoughnessRadiusM] = useState(2000);
  const [isDataSourcesOpen, setIsDataSourcesOpen] = useState(false);
  const [isContextExpanded, setIsContextExpanded] = useState(false);
  const [comparisonSnap, setComparisonSnap] = useState(() => comparisonSelectionStore.get());
  const [comparisonFeedbackMsg, setComparisonFeedbackMsg] = useState(null);

  useEffect(() => {
    return comparisonSelectionStore.subscribe((snap) => {
      setComparisonSnap(snap);
    });
  }, []);

  useEffect(() => {
    setComparisonFeedbackMsg(null);
  }, [feature?.id, feature?.latitude, feature?.longitude]);

  // Weather state
  const [spaceWeather, setSpaceWeather] = useState(FALLBACK_SPACE_WEATHER);
  const [isWeatherLoading, setIsWeatherLoading] = useState(false);

  // Dossier mission window state
  const [missionWindowDays, setMissionWindowDays] = useState(14);

  // DTE station selection state
  const [selectedStationId, setSelectedStationId] = useState(
    () => communicationEarthFeature?.id || 'all'
  );

  // Live ephemeris clock subscription
  const [timeMs, setTimeMs] = useState(() => celestialTimeStore.get().ms);
  const [trackStartMs, setTrackStartMs] = useState(() => celestialTimeStore.get().ms);

  useEffect(() => {
    ensurePolarDemLoaded()
      .then((grid) => {
        if (grid) setDemLoadedTick((t) => t + 1);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    return celestialTimeStore.subscribe(({ ms }) => {
      setTimeMs(ms);
    });
  }, []);

  useEffect(() => {
    if (communicationEarthFeature?.id) {
      setSelectedStationId(communicationEarthFeature.id);
    }
  }, [communicationEarthFeature]);

  // Reset tab to overview and sync track start time when selecting a new location
  useEffect(() => {
    if (feature) {
      setActiveTab('overview');
      setTrackStartMs(celestialTimeStore.get().ms);
      setIsContextExpanded(false);
      setIsMinimized(false);
    }
  }, [feature?.id, feature?.latitude, feature?.longitude, feature?.lat, feature?.lon]);

  const loadWeather = useCallback(async (force = false) => {
    setIsWeatherLoading(true);
    try {
      const data = await fetchSpaceWeather(force);
      setSpaceWeather(data);
    } catch {
      // Fallback handled in service
    } finally {
      setIsWeatherLoading(false);
    }
  }, []);

  // Space weather fetch effect (triggered on overview and dossier tabs or when forced)
  useEffect(() => {
    if (activeTab === 'overview' || activeTab === 'dossier') {
      loadWeather(false);
      const interval = setInterval(() => loadWeather(false), 5 * 60 * 1000);
      return () => clearInterval(interval);
    }
  }, [activeTab, loadWeather]);

  // Safe extraction of feature coordinates & metadata
  const safeFeature = feature || {};
  const isEarthFeature = safeFeature.body === 'earth';
  const isCustomPin = Boolean(
    safeFeature.isCustomPin || safeFeature.type === 'custom_pin'
  );

  const featLat =
    typeof safeFeature.latitude === 'number'
      ? safeFeature.latitude
      : typeof safeFeature.lat === 'number'
      ? safeFeature.lat
      : -85.9;
  const featLon =
    typeof safeFeature.longitude === 'number'
      ? safeFeature.longitude
      : typeof safeFeature.lon === 'number'
      ? safeFeature.lon
      : 0.0;
  const siteId = safeFeature.id || 'custom-dropped-pin';

  useEffect(() => {
    setIsContextExpanded(false);
  }, [siteId]);

  const clpsData = useMemo(() => {
    if (!feature || isEarthFeature) return null;
    return (
      feature.clpsData ||
      getClpsMission(feature.id) ||
      (feature.id === 'landing-odysseus'
        ? getClpsMission('clps-im1-odysseus')
        : null)
    );
  }, [feature, isEarthFeature]);

  const isClps = Boolean(
    clpsData || safeFeature.isClps || safeFeature.type === 'clps-mission'
  );

  const regionInfo = useMemo(() => {
    if (!feature || isEarthFeature) return null;
    return feature.regionInfo || getLunarRegionInfo(featLon, featLat);
  }, [feature, isEarthFeature, featLon, featLat]);

  // Terrain metrics from NASA LRO LOLA DEM or selenographic model
  const terrainMetrics = useMemo(() => {
    if (!feature || isEarthFeature) return null;
    return sampleLunarTerrainMetrics(featLat, featLon, feature, {
      roughnessRadiusM,
    });
  }, [feature, isEarthFeature, featLat, featLon, demLoadedTick, roughnessRadiusM]);

  // Ephemeris, Sun position, Earth visibility, and transition countdowns
  const state = useMemo(() => computeCelestialState(timeMs), [timeMs]);

  const terrainFn = useMemo(
    () => (azimuthDeg) =>
      horizonAt(HORIZON_TABLE, siteId, azimuthDeg, featLat, featLon) ?? 0,
    [siteId, featLat, featLon, demLoadedTick]
  );

  const moonPoint = useMemo(
    () => ({
      id: siteId,
      name: isCustomPin ? 'Custom Dropped Pin' : clpsData?.name || safeFeature.name || 'Lunar Site',
      latitude: featLat,
      longitude: featLon,
    }),
    [siteId, isCustomPin, clpsData, safeFeature.name, featLat, featLon]
  );

  const flatSun = useMemo(
    () => solarPosition(state, featLat, featLon),
    [state, featLat, featLon]
  );
  const sunTerrainHorizon = terrainFn(flatSun.azimuthDeg) ?? 0;
  const sun = useMemo(
    () => solarPosition(state, featLat, featLon, sunTerrainHorizon),
    [state, featLat, featLon, sunTerrainHorizon]
  );

  const localThermal = useMemo(() => {
    if (!feature || isEarthFeature) return null;
    return getLunarTemperature(featLat, featLon, new Date(timeMs), {
      terrainHorizonDeg: sunTerrainHorizon,
      elevationM: terrainMetrics?.elevationM ?? null,
    });
  }, [feature, isEarthFeature, featLat, featLon, timeMs, sunTerrainHorizon, terrainMetrics?.elevationM]);

  const earthLook = useMemo(
    () => earthLookFromMoon(state, moonPoint),
    [state, moonPoint]
  );
  const earthTerrainHorizon = terrainFn(earthLook.azimuthDeg) ?? 0;

  const activeStation = useMemo(() => {
    if (!selectedStationId || selectedStationId === 'all') return null;
    return (
      EARTH_COMMUNICATION_SITES.find((s) => s.id === selectedStationId) ||
      (communicationEarthFeature?.id === selectedStationId
        ? communicationEarthFeature
        : null)
    );
  }, [selectedStationId, communicationEarthFeature]);

  const generalLink = useMemo(
    () =>
      evaluateEarthLink({
        state,
        moonFeature: moonPoint,
        earthFeature: activeStation,
        constraints: DEFAULT_DTE_CONSTRAINTS,
        terrainFn,
      }),
    [state, moonPoint, activeStation, terrainFn]
  );

  const solarDiscPct = useMemo(() => {
    const r = (state?.sun?.angularDiameterDeg || 0.533) / 2;
    const upperLimb = flatSun.elevationDeg + r;
    const lowerLimb = flatSun.elevationDeg - r;
    if (upperLimb <= sunTerrainHorizon) return 0;
    if (lowerLimb >= sunTerrainHorizon) return 100;
    return Math.round(((upperLimb - sunTerrainHorizon) / (2 * r)) * 100);
  }, [flatSun.elevationDeg, sunTerrainHorizon, state]);

  const currentSun = useMemo(
    () => ({
      azimuthDeg: sun.azimuthDeg,
      elevationDeg: sun.elevationDeg,
      radius: state.sun.angularDiameterDeg / 2,
      status: sun.status,
      discPct: solarDiscPct,
      terrainHorizonDeg: sunTerrainHorizon,
    }),
    [sun, state, solarDiscPct, sunTerrainHorizon]
  );

  const currentEarth = useMemo(
    () => ({
      azimuthDeg: earthLook.azimuthDeg,
      elevationDeg: earthLook.elevationDeg,
      radius: earthLook.radiusDeg,
      status: generalLink.status,
      terrainHorizonDeg: earthTerrainHorizon,
    }),
    [earthLook, generalLink.status, earthTerrainHorizon]
  );

  const solarTransition = useMemo(
    () => calculateSolarTransition(timeMs, featLat, featLon, siteId),
    [timeMs, featLat, featLon, siteId]
  );

  const earthTransition = useMemo(
    () => calculateEarthPositionTransition(timeMs, moonPoint),
    [timeMs, moonPoint]
  );

  // All DSN stations status for DTE & Dossier tabs
  const dsnSitesCalculations = useMemo(() => {
    if (isEarthFeature) return [];
    return EARTH_COMMUNICATION_SITES.map((station) => {
      const evaluation = evaluateEarthLink({
        state,
        moonFeature: moonPoint,
        earthFeature: station,
        constraints: DEFAULT_DTE_CONSTRAINTS,
        terrainFn,
      });
      return {
        ...station,
        evaluation,
      };
    });
  }, [isEarthFeature, state, moonPoint, terrainFn]);

  // Multi-day mission window assessment for Dossier tab
  const missionWindowAssessment = useMemo(() => {
    if (!feature || isEarthFeature || activeTab !== 'dossier') return null;

    const numSamples = missionWindowDays * 4;
    const isFarside = regionInfo?.face === 'Farside';
    const dsnStations = EARTH_COMMUNICATION_SITES.filter(
      (s) => s.id.includes('nasa') || s.network?.includes('DSN')
    );

    let sunlitSteps = 0;
    let dsnSteps = 0;
    let currentSunStreak = 0;
    let maxSunStreak = 0;
    let minTemp = 1000;
    let maxTemp = -1000;

    const dailyScores = Array.from({ length: missionWindowDays }, (_, dayIdx) => {
      let daySunSteps = 0;
      let dayDsnSteps = 0;
      const dayStartMs = timeMs + dayIdx * 86400000;

      for (let s = 0; s < 4; s++) {
        const t = dayStartMs + s * 6 * 3600000;
        const stepState = computeCelestialState(t);
        const localSun = solarPosition(stepState, featLat, featLon);
        const thElev = terrainFn(localSun.azimuthDeg);
        const therm = getLunarTemperature(featLat, featLon, new Date(t), {
          terrainHorizonDeg: thElev,
          elevationM: terrainMetrics?.elevationM ?? null,
        });
        minTemp = Math.min(minTemp, therm.tempC);
        maxTemp = Math.max(maxTemp, therm.tempC);

        const isSunlit = localSun.elevationDeg > thElev && !therm.isPSR;
        if (isSunlit) {
          sunlitSteps++;
          daySunSteps++;
          currentSunStreak++;
          if (currentSunStreak > maxSunStreak) maxSunStreak = currentSunStreak;
        } else {
          currentSunStreak = 0;
        }

        if (!isFarside) {
          const anyDsnActive = dsnStations.some((station) => {
            const lk = evaluateEarthLink({
              state: stepState,
              moonFeature: moonPoint,
              earthFeature: station,
              constraints: DEFAULT_DTE_CONSTRAINTS,
              terrainFn,
            });
            return lk.isLinked;
          });
          if (anyDsnActive) {
            dsnSteps++;
            dayDsnSteps++;
          }
        }
      }

      const daySunPct = Math.round((daySunSteps / 4) * 100);
      const dayDsnPct = isFarside ? 0 : Math.round((dayDsnSteps / 4) * 100);
      const dayScore = Math.round(daySunPct * 0.5 + dayDsnPct * 0.5);

      return {
        day: dayIdx + 1,
        score: dayScore,
        sunlitPct: daySunPct,
        dsnPct: dayDsnPct,
      };
    });

    const unifiedEval = evaluateCandidateForMissionWindow(
      {
        id: siteId,
        name: moonPoint.name,
        latitude: featLat,
        longitude: featLon,
        slopeDeg: terrainMetrics?.slopeDeg ?? null,
        elevationM: terrainMetrics?.elevationM ?? null,
        roughnessM: terrainMetrics?.roughnessM ?? null,
      },
      {
        ...DEFAULT_PLANNER_CONSTRAINTS,
        landingTimeMs: timeMs,
        missionDurationDays: missionWindowDays,
      }
    );

    const sunlitRatio = unifiedEval?.sunlitRatio ?? Math.round((sunlitSteps / numSamples) * 100);
    const dsnRatio = unifiedEval?.dteUptimeRatio ?? (isFarside ? 0 : Math.round((dsnSteps / numSamples) * 100));
    const longestSunlitHours = Math.round(maxSunStreak * 6);
    const windowScore = unifiedEval?.overallScore ?? 50;

    return {
      windowScore,
      sunlitRatio,
      dsnRatio,
      longestSunlitHours,
      minTemp: Math.round(minTemp),
      maxTemp: Math.round(maxTemp),
      dailyScores,
      formulaString: unifiedEval?.formulaString,
      isPartialScore: unifiedEval?.isPartialScore,
    };
  }, [
    feature,
    isEarthFeature,
    activeTab,
    missionWindowDays,
    timeMs,
    siteId,
    featLat,
    featLon,
    regionInfo,
    terrainFn,
    moonPoint,
    localThermal,
    terrainMetrics,
  ]);

  // Combined important warnings for Overview
  const overviewWarnings = useMemo(() => {
    if (!feature || isEarthFeature) return [];
    const list = [];

    if (terrainMetrics?.slopeDeg != null && terrainMetrics.slopeDeg >= 15) {
      list.push({
        id: 'warn-slope',
        tone: 'critical',
        text: `Slope Hazard: ${terrainMetrics.slopeDeg.toFixed(1)}° exceeds 15° lander tip-over limit`,
      });
    } else if (terrainMetrics?.slopeDeg != null && terrainMetrics.slopeDeg >= 10) {
      list.push({
        id: 'warn-slope-mod',
        tone: 'warning',
        text: `Moderate Slope (${terrainMetrics.slopeDeg.toFixed(1)}°) — precision landing sensors required`,
      });
    }

    if (localThermal?.isPSR) {
      list.push({
        id: 'warn-psr',
        tone: 'critical',
        text: `Permanent Shadow (PSR): Cryogenic surface (${localThermal.tempC}°C / ${localThermal.tempK} K)`,
      });
    } else if (sun.status === 'blocked') {
      list.push({
        id: 'warn-sun-masked',
        tone: 'warning',
        text: `Solar disc masked by local terrain ridge (${(sunTerrainHorizon ?? 0).toFixed(1)}° horizon)`,
      });
    } else if (sun.status === 'night') {
      list.push({
        id: 'warn-night',
        tone: 'warning',
        text: `Lunar Night Active (${localThermal?.tempC ?? -160}°C) — battery survival regime`,
      });
    }

    if (generalLink.status === 'away') {
      list.push({
        id: 'warn-farside',
        tone: 'critical',
        text: 'Lunar Far Side: Direct-to-Earth RF occulted (orbital relay required)',
      });
    } else if (generalLink.status === 'blocked') {
      list.push({
        id: 'warn-dte-blocked',
        tone: 'warning',
        text: `DTE Line-of-Sight blocked by local terrain (${(earthTerrainHorizon ?? 0).toFixed(1)}° horizon mask)`,
      });
    }

    return list;
  }, [
    feature,
    isEarthFeature,
    terrainMetrics,
    localThermal,
    sun.status,
    sunTerrainHorizon,
    generalLink.status,
    earthTerrainHorizon,
  ]);

  if (!feature) return null;

  const { latStr, lonStr, fullStr } = isEarthFeature
    ? {
        latStr: `${Math.abs(featLat).toFixed(4)}° ${featLat >= 0 ? 'N' : 'S'}`,
        lonStr: `${Math.abs(featLon).toFixed(4)}° ${featLon >= 0 ? 'E' : 'W'}`,
        fullStr: `${Math.abs(featLat).toFixed(4)}° ${featLat >= 0 ? 'N' : 'S'}, ${Math.abs(featLon).toFixed(4)}° ${featLon >= 0 ? 'E' : 'W'}`,
      }
    : formatLunarCoordinates(featLon, featLat, 4);

  const siteContextDescription =
    clpsData?.description ||
    clpsData?.objectives ||
    safeFeature.description ||
    `Lunar surface coordinate (${latStr}, ${lonStr}) in the ${
      regionInfo?.province || 'Southern Polar Region'
    }. Evaluated using NASA LRO LOLA digital elevation models and DE421/440 analytical ephemerides.`;

  const handleCopyCoords = () => {
    navigator.clipboard.writeText(fullStr);
    setCopied(true);
    notifySuccess('Coordinates Copied', `${fullStr} copied to clipboard.`);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShareLocation = () => {
    const url = new URL(window.location.href);
    url.hash = '#explorer';
    url.searchParams.set('planet', isEarthFeature ? 'earth' : 'moon');
    url.searchParams.set('lat', String(Number(featLat.toFixed(4))));
    url.searchParams.set('lon', String(Number(featLon.toFixed(4))));
    if (feature.id) url.searchParams.set('site', feature.id);
    navigator.clipboard.writeText(url.toString());
    setShared(true);
    notifySuccess('Permalink Copied', 'Shareable location link copied to clipboard.');
    setTimeout(() => setShared(false), 2200);
  };

  const handleTabSelect = (tabId) => {
    setActiveTab(tabId);
  };

  const sunStatusMeta = SUN_STATUS[sun?.status] || { label: 'Sunlit', color: '#fde68a' };
  const earthStatusMeta = EARTH_STATUS[generalLink?.status] || {
    label: 'Link Active',
    color: '#60a5fa',
  };
  const lightTravelSec = (state.earth.distanceKm / 299792.458).toFixed(2);

  const panelTitle = isCustomPin
    ? 'Custom Dropped Pin'
    : clpsData?.name || feature.name || 'Custom Dropped Pin';

  const payloadsList = clpsData?.payloads || (Array.isArray(feature.payloads) ? feature.payloads : []);
  // The panel's existing expand action also reveals every value inside its information cards.
  const showFullCardData = isExpanded;

  if (isMinimized) {
    return (
      <aside
        aria-label="Minimized Lunar Site Information"
        data-guide="feature-panel-minimized"
        className="fixed z-35 right-3 sm:right-4 top-15 sm:top-16 bg-[#060b14]/95 backdrop-blur-xl border border-slate-800/90 rounded-2xl shadow-[0_12px_35px_rgba(0,0,0,0.85)] flex items-center justify-between gap-3 px-3 py-2 pointer-events-auto select-none transition-all duration-200 animate-in fade-in slide-in-from-top-2"
      >
        <button
          type="button"
          onClick={() => setIsMinimized(false)}
          className="flex items-center gap-2.5 min-w-0 text-left hover:opacity-90 transition-opacity"
          title="Restore full site details"
        >
          <div className="w-7 h-7 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0 shadow-[0_0_12px_rgba(245,158,11,0.25)]">
            <MapPin className="w-3.5 h-3.5" />
          </div>
          <div className="min-w-0">
            <div className="text-[9px] font-mono uppercase tracking-wider text-amber-400 font-semibold truncate leading-none mb-0.5">
              {isCustomPin
                ? 'Custom Waypoint'
                : isClps
                ? `NASA CLPS · ${clpsData?.taskOrder || 'Mission'}`
                : feature.body === 'earth'
                ? 'Earth Station'
                : regionInfo?.face || 'Lunar Site'}
            </div>
            <h2 className="text-xs sm:text-sm font-bold text-white tracking-tight truncate leading-tight max-w-[130px] sm:max-w-[190px]">
              {panelTitle}
            </h2>
          </div>
          {localThermal && (
            <span className="ml-1 hidden sm:inline-flex items-center px-1.5 py-0.5 rounded text-[9.5px] font-mono font-semibold bg-[#0A1220] border border-slate-800 text-slate-300">
              {localThermal.tempC > 0 ? `+${localThermal.tempC}` : localThermal.tempC}°C
            </span>
          )}
        </button>

        <div className="flex items-center gap-1 shrink-0 ml-1">
          <button
            type="button"
            onClick={() => setIsMinimized(false)}
            aria-label="Restore full panel"
            title="Restore full panel"
            className="p-1.5 rounded-lg bg-[#0A1220] hover:bg-[#121E30] text-slate-300 hover:text-cyan-300 border border-[#16283C] transition-colors"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close panel"
            title="Close panel [Esc]"
            className="p-1.5 rounded-lg bg-[#0A1220] hover:bg-[#121E30] text-slate-400 hover:text-white border border-[#16283C] transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </aside>
    );
  }

  if (isMinimized) {
    return (
      <aside
        aria-label="Minimized Lunar Site Information"
        data-guide="feature-panel-minimized"
        className="fixed z-35 right-3 sm:right-4 top-15 sm:top-16 bg-[#060b14]/95 backdrop-blur-xl border border-slate-800/90 rounded-2xl shadow-[0_12px_35px_rgba(0,0,0,0.85)] flex items-center justify-between gap-3 px-3 py-2 pointer-events-auto select-none transition-all duration-200 animate-in fade-in slide-in-from-top-2"
      >
        <button
          type="button"
          onClick={() => setIsMinimized(false)}
          className="flex items-center gap-2.5 min-w-0 text-left hover:opacity-90 transition-opacity"
          title="Restore full site details"
        >
          <div className="w-7 h-7 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0 shadow-[0_0_12px_rgba(245,158,11,0.25)]">
            <MapPin className="w-3.5 h-3.5" />
          </div>
          <div className="min-w-0">
            <div className="text-[9px] font-mono uppercase tracking-wider text-amber-400 font-semibold truncate leading-none mb-0.5">
              {isCustomPin
                ? 'Custom Waypoint'
                : isClps
                ? `NASA CLPS · ${clpsData?.taskOrder || 'Mission'}`
                : feature.body === 'earth'
                ? 'Earth Station'
                : regionInfo?.face || 'Lunar Site'}
            </div>
            <h2 className="text-xs sm:text-sm font-bold text-white tracking-tight truncate leading-tight max-w-[130px] sm:max-w-[190px]">
              {panelTitle}
            </h2>
          </div>
          {localThermal && (
            <span className="ml-1 hidden sm:inline-flex items-center px-1.5 py-0.5 rounded text-[9.5px] font-mono font-semibold bg-[#0A1220] border border-slate-800 text-slate-300">
              {localThermal.tempC > 0 ? `+${localThermal.tempC}` : localThermal.tempC}°C
            </span>
          )}
        </button>

        <div className="flex items-center gap-1 shrink-0 ml-1">
          <button
            type="button"
            onClick={() => setIsMinimized(false)}
            aria-label="Restore full panel"
            title="Restore full panel"
            className="p-1.5 rounded-lg bg-[#0A1220] hover:bg-[#121E30] text-slate-300 hover:text-cyan-300 border border-[#16283C] transition-colors"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close panel"
            title="Close panel [Esc]"
            className="p-1.5 rounded-lg bg-[#0A1220] hover:bg-[#121E30] text-slate-400 hover:text-white border border-[#16283C] transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </aside>
    );
  }

  return (
    <aside
      aria-label="Lunar Site Information Panel"
      data-guide="feature-panel"
      className={`fixed z-35 right-3 sm:right-4 top-15 sm:top-16 ${
        timelineVisible
          ? 'bottom-[96px] max-h-[calc(100vh-10rem)]'
          : 'bottom-3 sm:bottom-4 max-h-[calc(100vh-5rem)]'
      } ${
        isExpanded
          ? 'w-[calc(100vw-1.5rem)] sm:w-[36rem]'
          : 'w-[calc(100vw-1.5rem)] sm:w-[29.5rem]'
      } bg-[#060b14]/95 backdrop-blur-xl border border-slate-800/90 rounded-2xl flex flex-col shadow-[0_20px_50px_rgba(0,0,0,0.85)] overflow-hidden transition-all duration-200 ease-out pointer-events-auto select-none`}
    >
      {/* =================================================================== */}
      {/* 1. COMPACT HEADER: Pin Icon + Title + Expand/Collapse + Close       */}
      {/* =================================================================== */}
      <div className="px-3.5 py-2.5 border-b border-[#16283C]/80 flex items-center justify-between gap-2 bg-[#080F1D] shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0 shadow-[0_0_12px_rgba(245,158,11,0.25)]">
            <MapPin className="w-3.5 h-3.5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 leading-none mb-0.5">
              <span className="text-[9.5px] font-mono uppercase tracking-wider text-amber-400 font-semibold truncate">
                {isCustomPin
                  ? 'Custom Waypoint'
                  : isClps
                  ? `NASA CLPS · ${clpsData?.taskOrder || 'Mission'}`
                  : feature.body === 'earth'
                  ? 'Earth Station'
                  : regionInfo?.face || 'Lunar Site'}
              </span>
            </div>
            <h2 className="text-sm font-bold text-white tracking-tight truncate leading-tight">
              {panelTitle}
            </h2>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => setIsMinimized(true)}
            aria-label="Minimize panel"
            title="Minimize to compact bar"
            className="p-1.5 rounded-lg bg-[#0A1220] hover:bg-[#121E30] text-slate-300 hover:text-cyan-300 border border-[#16283C] transition-colors"
          >
            <Minus className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setIsExpanded((prev) => !prev)}
            aria-expanded={isExpanded}
            aria-label={isExpanded ? 'Collapse width to standard' : 'Expand full workspace width'}
            title={isExpanded ? 'Collapse width to standard' : 'Expand full workspace width'}
            className="p-1.5 rounded-lg bg-[#0A1220] hover:bg-[#121E30] text-slate-300 hover:text-cyan-300 border border-[#16283C] transition-colors"
          >
            {isExpanded ? (
              <Minimize2 className="w-3.5 h-3.5" />
            ) : (
              <Maximize2 className="w-3.5 h-3.5" />
            )}
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close panel"
            title="Close panel [Esc]"
            className="p-1.5 rounded-lg bg-[#0A1220] hover:bg-[#121E30] text-slate-400 hover:text-white border border-[#16283C] transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* =================================================================== */}
      {/* 2. TAB NAVIGATION BAR (5 Scientific Tabs)                           */}
      {/* =================================================================== */}
      {!isEarthFeature && (
        <div
          role="tablist"
          aria-label="Lunar site analysis tabs"
          className="grid grid-cols-5 border-b border-[#16283C]/80 bg-[#070D19] p-1 gap-1 shrink-0"
        >
          {TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                role="tab"
                type="button"
                aria-selected={isActive}
                onClick={() => handleTabSelect(tab.id)}
                className={`py-1.5 px-1 rounded-lg text-[10.5px] font-mono flex items-center justify-center gap-1 transition-all whitespace-nowrap ${
                  isActive
                    ? 'bg-[#00D2C4]/15 border border-[#00D2C4]/40 text-[#00D2C4] font-bold shadow-[0_0_10px_rgba(0,210,196,0.2)]'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-[#0A1220] border border-transparent'
                }`}
              >
                {Icon && <Icon className="w-3 h-3 shrink-0" />}
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* =================================================================== */}
      {/* 3. TAB CONTENT AREA                                                 */}
      {/* =================================================================== */}
      <div
        className="px-3.5 py-3 space-y-2.5 overflow-y-auto custom-scrollbar flex-1 min-h-0"
      >
        {/* EARTH FEATURE FALLBACK VIEW */}
        {isEarthFeature && (
          <div className="space-y-2.5">
            <div className="p-2.5 rounded-xl bg-[#0A121E] border border-slate-800/90 flex items-center justify-between">
              <div className="text-[11px] font-mono text-slate-300">
                {latStr} · {lonStr}
              </div>
              <button
                type="button"
                onClick={handleCopyCoords}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-900 hover:bg-slate-800 text-[10px] font-mono text-cyan-400 border border-slate-800"
              >
                {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
            {feature.description && (
              <p className="text-xs text-slate-300 leading-relaxed">{feature.description}</p>
            )}
            {onSelectOtherBody && (
              <button
                type="button"
                onClick={() => onSelectOtherBody('moon')}
                className="w-full py-2 px-3 rounded-xl bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/30 text-xs font-mono text-cyan-300 transition-colors"
              >
                Switch to Moon View
              </button>
            )}
          </div>
        )}

        {/* ================================================================= */}
        {/* TAB 1: OVERVIEW                                                   */}
        {/* ================================================================= */}
        {!isEarthFeature && activeTab === 'overview' && (
          <div className="space-y-2.5">
            {(safeFeature.horizonEligible === false ||
              safeFeature.positionTrust === 'illustrative' ||
              clpsData?.horizonEligible === false ||
              clpsData?.positionTrust === 'illustrative') && (
              <div className="px-2.5 py-1.5 rounded-xl bg-amber-950/40 border border-amber-500/40 flex items-center gap-2 text-[11px] font-mono text-amber-200">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span>Exact landing coordinates not published by NASA (Display placeholder only)</span>
              </div>
            )}

            {/* Compact Coordinates & Surface Elevation Strip */}
            <div className="px-2.5 py-2 rounded-xl bg-[#0A121E] border border-slate-800/80 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
                  Coordinates · {regionInfo?.face || 'Nearside'}
                </div>
                <div className="font-mono text-xs font-semibold text-white tabular-nums whitespace-nowrap">
                  {Math.abs(featLat).toFixed(3)}°{featLat >= 0 ? 'N' : 'S'},{' '}
                  {Math.abs(featLon).toFixed(3)}°{featLon >= 0 ? 'E' : 'W'}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {terrainMetrics && (
                  <div className="text-right font-mono">
                    <span className="text-[10px] text-slate-400 block">Elev / Slope</span>
                    <span className="text-xs font-semibold text-cyan-300 tabular-nums whitespace-nowrap">
                      {terrainMetrics.elevationM != null && terrainMetrics.slopeDeg != null ? (
                        <>
                          {terrainMetrics.elevationM > 0 ? '+' : ''}
                          {Math.round(terrainMetrics.elevationM).toLocaleString()}m ·{' '}
                          {terrainMetrics.slopeDeg.toFixed(1)}°
                        </>
                      ) : (
                        <span className="text-slate-400 text-[11px]">Not present in loaded dataset</span>
                      )}
                    </span>
                  </div>
                )}
                <button
                  type="button"
                  onClick={handleCopyCoords}
                  title="Copy coordinates"
                  className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-cyan-300 border border-slate-800 transition-colors"
                >
                  {copied ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
            </div>

            {/* NASA Provenance & Coverage Confidence Strip */}
            {terrainMetrics?.uncertainty && (
              <div className="px-2.5 py-1.5 rounded-xl bg-[#080f1c] border border-slate-800/80 flex items-center justify-between gap-2 text-[10px] font-mono">
                <span
                  className={`px-1.5 py-0.5 rounded border ${
                    PROVENANCE_BADGES[terrainMetrics.uncertainty.provenanceType]?.badgeClass ||
                    PROVENANCE_BADGES.NASA_MEASURED.badgeClass
                  }`}
                >
                  {PROVENANCE_BADGES[terrainMetrics.uncertainty.provenanceType]?.shortLabel ||
                    'NASA MEASURED'}
                </span>
                <span className={`text-slate-300 ${showFullCardData ? 'whitespace-normal break-words' : 'truncate'}`}>
                  {terrainMetrics.dataSource} · {terrainMetrics.uncertainty.verticalAccuracy}
                </span>
              </div>
            )}

            {/* Primary Dual Telemetry Grid: Sun Position & Earth Visibility */}
            <div className="grid grid-cols-2 gap-2 font-mono">
              {/* Sun Position Card */}
              <div className="p-2.5 rounded-xl bg-[#0A121E] border border-slate-800/80 space-y-1">
                <div className="flex items-center justify-between text-[10px]">
                  <span className="flex items-center gap-1 text-slate-300 font-semibold">
                    <Sun className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <span>Sun Position</span>
                  </span>
                  <span
                    className={`px-1.5 py-0.5 rounded text-[9px] font-bold whitespace-nowrap border ${
                      sunStatusMeta.label === 'Sunlit'
                        ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                        : sunStatusMeta.label === 'Terrain Masked'
                        ? 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                        : 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30'
                    }`}
                  >
                    {solarDiscPct > 0 && solarDiscPct < 100
                      ? `${solarDiscPct}% Disc`
                      : sunStatusMeta.label}
                  </span>
                </div>
                <div className="flex items-baseline justify-between tabular-nums pt-0.5">
                  <span className="text-sm font-bold text-white">
                    {sun?.elevationDeg != null ? `${sun.elevationDeg.toFixed(1)}°` : '—'}
                    <span className="text-[10px] font-normal text-slate-400 ml-1">el</span>
                  </span>
                  <span className="text-[11px] text-slate-300">
                    Az {sun?.azimuthDeg != null ? `${sun.azimuthDeg.toFixed(0)}°` : '—'}
                  </span>
                </div>
                <div className="text-[10px] text-slate-400 leading-snug break-words">
                  {solarTransition.timeUntilMs === null
                    ? solarTransition.isCurrentlySunlit
                      ? 'Continuous Sunlight'
                      : 'Continuous Shadow'
                    : `${solarTransition.nextEvent === 'sunset' ? 'Sunset' : 'Sunrise'} in ${solarTransition.formattedDuration}`}
                </div>
              </div>

              {/* Earth Visibility Card */}
              <div className="p-2.5 rounded-xl bg-[#0A121E] border border-slate-800/80 space-y-1">
                <div className="flex items-center justify-between text-[10px]">
                  <span className="flex items-center gap-1 text-slate-300 font-semibold">
                    <Radio className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>Earth Direct</span>
                  </span>
                  <span
                    className={`px-1.5 py-0.5 rounded text-[9px] font-bold whitespace-nowrap border ${
                      earthStatusMeta.label === 'Link Active'
                        ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                        : earthStatusMeta.label === 'Marginal'
                        ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                        : 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                    }`}
                  >
                    {earthStatusMeta.label}
                  </span>
                </div>
                <div className="flex items-baseline justify-between tabular-nums pt-0.5">
                  <span className="text-sm font-bold text-white">
                    {earthLook?.elevationDeg != null
                      ? `${earthLook.elevationDeg.toFixed(1)}°`
                      : '—'}
                    <span className="text-[10px] font-normal text-slate-400 ml-1">el</span>
                  </span>
                  <span className="text-[11px] text-slate-300">
                    Az {earthLook?.azimuthDeg != null ? `${earthLook.azimuthDeg.toFixed(0)}°` : '—'}
                  </span>
                </div>
                <div className="text-[10px] text-slate-400 leading-snug break-words">
                  {earthTransition.timeUntilMs === null
                    ? earthTransition.isAboveHorizon
                      ? 'Continuous Visibility'
                      : 'No Earthrise (35d+)'
                    : `Earth${earthTransition.nextEvent === 'earthset' ? 'set' : 'rise'} in ${earthTransition.formattedDuration}`}
                </div>
              </div>
            </div>

            {/* Lunar Surface & Space Weather Telemetry Card */}
            <div className="p-2.5 rounded-xl bg-[#0A121E] border border-slate-800/80 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-white flex items-center gap-1.5">
                  <Thermometer className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                  <span>Lunar Weather &amp; Environment</span>
                </span>
                <div className="flex items-center gap-1.5">
                  <span
                    className={`px-1.5 py-0.5 rounded text-[9.5px] font-mono font-semibold border ${
                      localThermal?.isPSR
                        ? 'bg-purple-950/40 text-purple-300 border-purple-500/40'
                        : localThermal?.isDaylight
                        ? 'bg-amber-950/40 text-amber-300 border-amber-500/40'
                        : 'bg-blue-950/40 text-blue-300 border-blue-500/40'
                    }`}
                  >
                    {localThermal?.isPSR
                      ? 'Permanent Shadow'
                      : localThermal?.isDaylight
                      ? 'Daylight Insolation'
                      : 'Lunar Night'}
                  </span>
                  <button
                    type="button"
                    onClick={() => loadWeather(true)}
                    disabled={isWeatherLoading}
                    title="Refresh live NOAA SWPC telemetry"
                    className="p-1 rounded-md bg-[#060b14] hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 transition-colors"
                  >
                    <RefreshCw className={`w-3 h-3 ${isWeatherLoading ? 'animate-spin' : ''}`} />
                  </button>
                </div>
              </div>

              {/* 4-Metric Grid: Surface Temperature, Solar Wind, Proton Density, IMF */}
              <div className="grid grid-cols-2 gap-1.5 font-mono text-xs">
                {/* 1. Surface Temperature */}
                <div className="p-2 rounded-lg bg-[#060b14] border border-slate-800/70 space-y-0.5">
                  <div className="flex items-center justify-between text-[9.5px] text-slate-400">
                    <span>Surface Temp</span>
                    <span className="text-[9px] text-slate-500">Regolith {localThermal?.subsurfaceTempC ?? -45}°C</span>
                  </div>
                  <div className="flex items-baseline gap-1.5">
                    <span
                      className={`text-sm font-bold tabular-nums ${
                        localThermal?.isPSR
                          ? 'text-purple-400'
                          : !localThermal?.isDaylight
                          ? 'text-sky-300'
                          : localThermal?.tempC > 80
                          ? 'text-amber-300'
                          : 'text-white'
                      }`}
                    >
                      {localThermal
                        ? `${localThermal.tempC > 0 ? '+' : ''}${localThermal.tempC}°C`
                        : '—'}
                    </span>
                    <span className="text-[10px] text-slate-400 tabular-nums">
                      ({localThermal?.tempK ?? '—'} K)
                    </span>
                  </div>
                </div>

                {/* 2. Solar Wind Speed */}
                <div className="p-2 rounded-lg bg-[#060b14] border border-slate-800/70 space-y-0.5">
                  <div className="flex items-center justify-between text-[9.5px]">
                    <span className="text-slate-400">Solar Wind</span>
                    <span
                      className={`text-[9px] font-semibold truncate ${
                        spaceWeather?.speedStatus === 'High Speed Stream'
                          ? 'text-rose-400'
                          : spaceWeather?.speedStatus === 'Moderate'
                          ? 'text-amber-300'
                          : 'text-emerald-400'
                      }`}
                    >
                      {spaceWeather?.speedStatus || 'Nominal'}
                    </span>
                  </div>
                  <div className="text-sm font-bold text-white tabular-nums">
                    {spaceWeather?.speed != null ? (
                      <>
                        {spaceWeather.speed}{' '}
                        <span className="text-[10px] font-normal text-slate-400">km/s</span>
                      </>
                    ) : (
                      <span className="text-slate-500 font-normal text-xs">Standby</span>
                    )}
                  </div>
                </div>

                {/* 3. Proton Density */}
                <div className="p-2 rounded-lg bg-[#060b14] border border-slate-800/70 space-y-0.5">
                  <div className="text-[9.5px] text-slate-400">Proton Density</div>
                  <div className="text-xs font-bold text-cyan-300 tabular-nums">
                    {spaceWeather?.density != null ? (
                      <>
                        {spaceWeather.density}{' '}
                        <span className="text-[9.5px] font-normal text-slate-400">p/cm³</span>
                      </>
                    ) : (
                      <span className="text-slate-500 font-normal text-xs">Simulated</span>
                    )}
                  </div>
                  <div className="text-[9px] text-slate-500">Solar wind plasma</div>
                </div>

                {/* 4. IMF Bz / Bt */}
                <div className="p-2 rounded-lg bg-[#060b14] border border-slate-800/70 space-y-0.5">
                  <div className="flex items-center justify-between text-[9.5px] text-slate-400">
                    <span>IMF Bz / Bt</span>
                    <span className="text-[9px] text-slate-500">
                      Bt: {spaceWeather?.bt != null ? `${spaceWeather.bt} nT` : 'N/A'}
                    </span>
                  </div>
                  <div className="text-xs font-bold tabular-nums">
                    <span
                      className={
                        spaceWeather?.bz < -5
                          ? 'text-rose-400'
                          : spaceWeather?.bz < 0
                          ? 'text-amber-300'
                          : 'text-cyan-300'
                      }
                    >
                      {spaceWeather?.bz != null ? `${spaceWeather.bz > 0 ? '+' : ''}${spaceWeather.bz} nT` : '—'}
                    </span>
                  </div>
                  <div className="text-[9px] text-slate-500">Interplanetary B-field</div>
                </div>
              </div>

              {/* Source attribution & stream status */}
              <div className="text-[9.5px] font-mono text-slate-400 flex items-center justify-between border-t border-slate-800/60 pt-1">
                <span className="truncate max-w-[220px]">
                  {spaceWeather?.source || 'NOAA Space Weather Prediction Center'}
                </span>
                <span className="px-1.5 py-0.2 rounded bg-[#060b14] border border-slate-800 text-slate-300 text-[9px]">
                  {spaceWeather?.isFallback ? 'Simulated Model' : 'Live NOAA SWPC'}
                </span>
              </div>
            </div>

            {/* Important Warnings Strip */}
            {overviewWarnings.length > 0 ? (
              <div className="space-y-1.5">
                {overviewWarnings.map((w) => (
                  <div
                    key={w.id}
                    className={`px-2.5 py-1.5 rounded-xl border flex items-center gap-2 text-[11px] font-mono ${
                      w.tone === 'critical'
                        ? 'bg-rose-950/35 border-rose-500/40 text-rose-200'
                        : 'bg-amber-950/30 border-amber-500/35 text-amber-200'
                    }`}
                  >
                    <AlertTriangle
                      className={`w-3.5 h-3.5 shrink-0 ${
                        w.tone === 'critical' ? 'text-rose-400' : 'text-amber-400'
                      }`}
                    />
                    <span className="leading-tight">{w.text}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="px-2.5 py-1.5 rounded-xl bg-emerald-950/25 border border-emerald-500/30 flex items-center justify-between text-[11px] font-mono text-emerald-300">
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>Nominal Surface &amp; Link Conditions</span>
                </span>
                <span className="text-slate-400 tabular-nums">
                  {localThermal ? `${localThermal.tempC > 0 ? '+' : ''}${localThermal.tempC}°C` : ''}
                </span>
              </div>
            )}

            {/* Expanded Overview Workspace Additions */}
            {isExpanded && (
              <div className="space-y-2.5 pt-1 border-t border-slate-800/80">
                <div className="grid grid-cols-3 gap-2 font-mono text-xs">
                  <div className="p-2.5 rounded-xl bg-[#0A121E] border border-slate-800/80">
                    <span className="text-[10px] text-slate-400 block">Plasma Temp</span>
                    <span className="text-sm font-bold text-white tabular-nums">
                      {spaceWeather?.temperature != null
                        ? `${spaceWeather.temperature.toLocaleString()} K`
                        : '100,000 K'}
                    </span>
                    <span className="text-[10px] text-slate-400 block">Ion Temperature</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-[#0A121E] border border-slate-800/80">
                    <span className="text-[10px] text-slate-400 block">Horizon Mask</span>
                    <span className="text-sm font-bold text-cyan-300 tabular-nums">
                      {sunTerrainHorizon != null ? `${sunTerrainHorizon.toFixed(1)}°` : '—'}
                    </span>
                    <span className="text-[10px] text-slate-400 block">Solar Azimuth</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-[#0A121E] border border-slate-800/80">
                    <span className="text-[10px] text-slate-400 block">1-Way RF Delay</span>
                    <span className="text-sm font-bold text-emerald-300 tabular-nums">
                      {lightTravelSec} s
                    </span>
                    <span className="text-[10px] text-slate-400 block tabular-nums">
                      {Math.round(state.earth.distanceKm).toLocaleString()} km
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ================================================================= */}
        {/* TAB 2: TERRAIN                                                    */}
        {/* ================================================================= */}
        {!isEarthFeature && activeTab === 'terrain' && (
          terrainMetrics ? (
            <div className="space-y-2.5">
              {/* Terrain Classification Banner */}
              <div className="p-2.5 rounded-xl bg-[#0A121E] border border-slate-800/80 flex items-center justify-between gap-2">
                <div>
                  <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 block">
                    Terrain Classification
                  </span>
                  <span className="text-xs font-semibold text-cyan-300">
                    {terrainMetrics.terrainClassification}
                  </span>
                </div>
                <span
                  className={`text-[10px] font-mono font-semibold px-2 py-0.5 rounded border ${
                    terrainMetrics.slopeDeg === null
                      ? 'bg-slate-900/60 text-slate-400 border-slate-700/50'
                      : terrainMetrics.isSlopeHazard
                      ? 'bg-rose-950/50 text-rose-300 border-rose-500/40'
                      : 'bg-emerald-950/40 text-emerald-300 border-emerald-500/30'
                  }`}
                >
                  {terrainMetrics.slopeDeg === null
                    ? 'DEM UNMODELED'
                    : terrainMetrics.isSlopeHazard
                    ? '✖ SLOPE HAZARD'
                    : '● LANDER SAFE'}
                </span>
              </div>

              {/* Equatorial / Mid-Latitude Dem Coverage Notice */}
              {!terrainMetrics.inSouthPoleCap && (
                <div className="p-2.5 rounded-xl bg-cyan-950/20 border border-cyan-500/30 flex items-start gap-2 text-[11px] font-mono text-cyan-200">
                  <Info className="w-3.5 h-3.5 text-cyan-400 shrink-0 mt-0.5" />
                  <div className="space-y-0.5 leading-tight">
                    <span className="font-semibold text-white">Equatorial / Mid-Latitude Region</span>
                    <p className="text-[10.5px] text-slate-300">
                      High-resolution Horn slope &amp; surface roughness models cover the South Polar Cap (80.0°S–90.0°S). Regional selenography and published catalog data are displayed below.
                    </p>
                  </div>
                </div>
              )}

            {/* Configurable Radius Selector for Roughness & Local Relief */}
            <div className="p-2 rounded-xl bg-[#0A121E] border border-slate-800/80 flex items-center justify-between gap-1 text-[10px] font-mono">
              <span className="text-slate-400">Analysis Radius:</span>
              <div className="flex items-center gap-1">
                {[500, 1000, 2000, 5000, 10000].map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRoughnessRadiusM(r)}
                    className={`px-2 py-0.5 rounded text-[10px] font-medium transition-all ${
                      roughnessRadiusM === r
                        ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/50 font-bold'
                        : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                    }`}
                  >
                    {r >= 1000 ? `${r / 1000}km` : `${r}m`}
                  </button>
                ))}
              </div>
            </div>

            {/* 4-Card Quantitative Terrain Grid */}
            <div className="grid grid-cols-2 gap-2 font-mono">
              {/* Card 1: Elevation */}
              <div className="p-2.5 rounded-xl bg-[#0A121E] border border-slate-800/80">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-slate-400 block">Surface Elevation</span>
                  {terrainMetrics.elevationM !== null && (
                    <span className="text-[9px] font-mono text-cyan-400/80">
                      {terrainMetrics.isDemAvailable ? 'LOLA DEM' : 'CATALOG'}
                    </span>
                  )}
                </div>
                <div className="text-base font-bold text-white tabular-nums mt-0.5">
                  {terrainMetrics.elevationM !== null ? (
                    <>
                      {terrainMetrics.elevationM > 0 ? '+' : ''}
                      {terrainMetrics.elevationM.toLocaleString()}
                      <span className="text-xs font-normal text-slate-400 ml-1">m</span>
                    </>
                  ) : (
                    <span className="text-xs font-normal text-slate-400">Not present in loaded dataset</span>
                  )}
                </div>
                <span className={`text-[10px] text-slate-400 block ${showFullCardData ? 'whitespace-normal break-words' : 'truncate'}`}>
                  {terrainMetrics.elevationSource ||
                    (terrainMetrics.inSouthPoleCap
                      ? 'Rel. to R₀ = 1,737.4 km'
                      : 'Outside 80°S–90°S LOLA DEM')}
                </span>
              </div>

              {/* Card 2: Slope Angle */}
              <div className="p-2.5 rounded-xl bg-[#0A121E] border border-slate-800/80">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-slate-400 block">Local Slope Angle</span>
                  {terrainMetrics.slopeDeg !== null && (
                    <span className="text-[9px] font-mono text-emerald-400/80">
                      Horn 3×3
                    </span>
                  )}
                </div>
                <div
                  className={`text-base font-bold tabular-nums mt-0.5 ${
                    terrainMetrics.slopeDeg === null
                      ? 'text-slate-400 text-xs font-normal'
                      : terrainMetrics.slopeDeg >= 15
                      ? 'text-rose-400'
                      : terrainMetrics.slopeDeg >= 10
                      ? 'text-amber-400'
                      : 'text-emerald-400'
                  }`}
                >
                  {terrainMetrics.slopeDeg !== null
                    ? `${terrainMetrics.slopeDeg.toFixed(1)}°`
                    : 'Not present in loaded dataset'}
                </div>
                <span className={`text-[10px] text-slate-400 block ${showFullCardData ? 'whitespace-normal break-words' : 'truncate'}`}>
                  {terrainMetrics.slopeSource ||
                    (terrainMetrics.slopeDeg !== null
                      ? '15.0° max lander limit'
                      : 'Requires LOLA DEM')}
                </span>
              </div>

              {/* Card 3: Surface Roughness (RMS) */}
              <div className="p-2.5 rounded-xl bg-[#0A121E] border border-slate-800/80">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-slate-400 block">Surface Roughness</span>
                  <span className="text-[9px] font-mono text-slate-400">
                    R={(roughnessRadiusM / 1000).toFixed(1)}km
                  </span>
                </div>
                <div className="text-base font-bold text-white tabular-nums mt-0.5">
                  {terrainMetrics.roughnessM !== null ? (
                    <>
                      {terrainMetrics.roughnessM.toFixed(1)}
                      <span className="text-xs font-normal text-slate-400 ml-1">m RMS</span>
                    </>
                  ) : (
                    <span className="text-xs font-normal text-slate-400">Not present in loaded dataset</span>
                  )}
                </div>
                <span className={`text-[10px] text-slate-400 block ${showFullCardData ? 'whitespace-normal break-words' : 'truncate'}`}>
                  {terrainMetrics.roughnessM !== null
                    ? `Dispersion in ${(roughnessRadiusM / 1000).toFixed(1)} km radius`
                    : 'Requires LOLA DEM'}
                </span>
              </div>

              {/* Card 4: Local Relief within configurable radius */}
              <div className="p-2.5 rounded-xl bg-[#0A121E] border border-slate-800/80">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-slate-400 block">Local Relief (Δz)</span>
                  <span className="text-[9px] font-mono text-slate-400">
                    R={(roughnessRadiusM / 1000).toFixed(1)}km
                  </span>
                </div>
                <div className="text-base font-bold text-cyan-300 tabular-nums mt-0.5">
                  {terrainMetrics.reliefM !== null ? (
                    <>
                      {terrainMetrics.reliefM.toLocaleString()}
                      <span className="text-xs font-normal text-slate-400 ml-1">m</span>
                    </>
                  ) : (
                    <span className="text-xs font-normal text-slate-400">Not present in loaded dataset</span>
                  )}
                </div>
                <span className={`text-[10px] text-slate-400 block ${showFullCardData ? 'whitespace-normal break-words' : 'truncate'}`}>
                  {terrainMetrics.reliefM !== null
                    ? `Max - min in ${(roughnessRadiusM / 1000).toFixed(1)} km radius`
                    : 'Requires LOLA DEM'}
                </span>
              </div>
            </div>

            {/* Selenographic Region, Nearest Landmark & Uncertainty */}
            <div className="p-2.5 rounded-xl bg-[#0A121E] border border-slate-800/80 space-y-1.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono text-slate-400">Geologic Region</span>
                <span className="font-mono text-slate-200 text-right">
                  {terrainMetrics.geologicalRegion?.province || regionInfo?.province || 'Feldspathic Highlands'}
                </span>
              </div>
              <div className="flex items-center justify-between border-t border-slate-800/70 pt-1.5">
                <span className="text-[10px] font-mono text-slate-400">Crustal Terrane</span>
                <span className="font-mono text-slate-300 text-right text-[11px]">
                  {terrainMetrics.geologicalRegion?.terrane || regionInfo?.terrane || 'Feldspathic Highlands Terrane (FHT)'}
                </span>
              </div>
              {terrainMetrics.nearestLandmark && (
                <div className="flex items-center justify-between border-t border-slate-800/70 pt-1.5">
                  <span className="text-[10px] font-mono text-slate-400">Nearest Landmark</span>
                  <span className="font-mono text-cyan-300 text-[11px] text-right">
                    {terrainMetrics.nearestLandmark.name}
                    <span className="text-slate-400 text-[10px] block">
                      {terrainMetrics.nearestLandmark.distanceKm} km · {terrainMetrics.nearestLandmark.bearingDeg}° az ({terrainMetrics.nearestLandmark.type})
                    </span>
                  </span>
                </div>
              )}
              <div className="flex items-center justify-between border-t border-slate-800/70 pt-1.5">
                <span className="text-[10px] font-mono text-slate-400">Altimetry Uncertainty</span>
                <span className="text-[10px] font-mono text-slate-300 text-right">
                  {terrainMetrics.uncertainty?.isAvailable ? (
                    <>
                      {terrainMetrics.uncertainty.verticalAccuracy} vert · {terrainMetrics.uncertainty.horizontalAccuracy} horiz
                    </>
                  ) : (
                    <span className="text-slate-400">Not present in loaded dataset (outside 80°S DEM)</span>
                  )}
                </span>
              </div>
            </div>

            {/* Radial Elevation Profile (-10 km to +10 km N-S & W-E Cross-Section) */}
            {terrainMetrics.radialProfile ? (
              <div className="p-2.5 rounded-xl bg-[#0A121E] border border-slate-800/80 space-y-1.5">
                <div className="flex items-center justify-between text-[10px] font-mono">
                  <span className="text-slate-200 font-semibold">
                    Radial Elevation Profile (±10 km Cross-Section)
                  </span>
                  <span className="text-cyan-300">
                    Relief: {Math.round(terrainMetrics.radialProfile.reliefM).toLocaleString()} m
                  </span>
                </div>
                {(() => {
                  const prof = terrainMetrics.radialProfile;
                  const ns = prof.northSouth || [];
                  const we = prof.westEast || [];
                  const minE = prof.minElevM - 100;
                  const maxE = Math.max(minE + 200, prof.maxElevM + 100);
                  const w = 320;
                  const h = 84;
                  const toPath = (pts) =>
                    pts
                      .map((p, idx) => {
                        const x = ((p.offsetKm + 10) / 20) * (w - 24) + 12;
                        const y = h - 14 - ((p.elevationM - minE) / (maxE - minE)) * (h - 24);
                        return `${idx === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
                      })
                      .join(' ');
                  const centerElev = terrainMetrics.elevationM ?? (minE + maxE) / 2;
                  const centerY =
                    h - 14 - ((centerElev - minE) / (maxE - minE)) * (h - 24);
                  return (
                    <svg
                      viewBox={`0 0 ${w} ${h}`}
                      className="w-full h-20 bg-[#060b14] rounded-lg border border-slate-800/80"
                    >
                      <line
                        x1={w / 2}
                        y1={6}
                        x2={w / 2}
                        y2={h - 12}
                        stroke="rgba(148,163,184,0.28)"
                        strokeDasharray="2,2"
                      />
                      <path
                        d={toPath(we)}
                        fill="none"
                        stroke="#38BDF8"
                        strokeWidth="1.5"
                        opacity="0.75"
                      />
                      <path d={toPath(ns)} fill="none" stroke="#F59E0B" strokeWidth="1.8" />
                      <circle
                        cx={w / 2}
                        cy={Math.max(8, Math.min(h - 14, centerY))}
                        r="3"
                        fill="#EF4444"
                        stroke="#FFFFFF"
                        strokeWidth="1"
                      />
                      <text x="10" y={h - 3} fill="#94A3B8" fontSize="8" fontFamily="Space Mono, monospace">
                        -10km
                      </text>
                      <text
                        x={w / 2}
                        y={h - 3}
                        fill="#E2E8F0"
                        fontSize="8"
                        textAnchor="middle"
                        fontFamily="Space Mono, monospace"
                      >
                        0km (Pin)
                      </text>
                      <text
                        x={w - 10}
                        y={h - 3}
                        fill="#94A3B8"
                        fontSize="8"
                        textAnchor="end"
                        fontFamily="Space Mono, monospace"
                      >
                        +10km
                      </text>
                    </svg>
                  );
                })()}
                <div className="flex items-center justify-between text-[9.5px] font-mono text-slate-400">
                  <span className="flex items-center gap-2">
                    <span className="text-amber-400">━ N–S Transect</span>
                    <span className="text-sky-400">━ W–E Transect</span>
                  </span>
                  <span>
                    {Math.round(terrainMetrics.radialProfile.minElevM)}m to{' '}
                    {terrainMetrics.radialProfile.maxElevM > 0 ? '+' : ''}
                    {Math.round(terrainMetrics.radialProfile.maxElevM)}m
                  </span>
                </div>
              </div>
            ) : (
              <div className="p-2.5 rounded-xl bg-[#0A121E] border border-slate-800/80 text-xs font-mono text-slate-400 space-y-1">
                <div className="flex items-center gap-1.5 text-slate-300 font-semibold">
                  <Mountain className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Radial Elevation Profile: Not present in loaded dataset</span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Cross-sectional transect generation samples the NASA LOLA South Polar DEM (80.0°S to 90.0°S).
                  Selected location ({featLat.toFixed(2)}°, {featLon.toFixed(2)}°) is outside local DEM coverage.
                </p>
              </div>
            )}

            {/* Terrain Warnings */}
            <div className="space-y-1.5">
              <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 block">
                Terrain Engineering Advisories
              </span>
              {terrainMetrics.slopeDeg === null ? (
                <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800/80 text-[11px] font-mono text-slate-400">
                  Slope data is unavailable outside the LOLA South Pole DEM. Terrain tilt advisories require local high-resolution topography.
                </div>
              ) : terrainMetrics.warnings.length > 0 ? (
                terrainMetrics.warnings.map((warn) => (
                  <div
                    key={warn.id}
                    className={`p-2.5 rounded-xl border space-y-0.5 ${
                      warn.severity === 'critical'
                        ? 'bg-rose-950/35 border-rose-500/40'
                        : 'bg-amber-950/30 border-amber-500/35'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 text-xs font-mono font-semibold text-white">
                      <AlertTriangle
                        className={`w-3.5 h-3.5 shrink-0 ${
                          warn.severity === 'critical' ? 'text-rose-400' : 'text-amber-400'
                        }`}
                      />
                      <span>{warn.title}</span>
                    </div>
                    <p className="text-[11px] text-slate-300 leading-relaxed pl-5">
                      {warn.detail}
                    </p>
                  </div>
                ))
              ) : (
                <div className="p-2.5 rounded-xl bg-emerald-950/25 border border-emerald-500/30 flex items-center gap-2 text-xs font-mono text-emerald-300">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>
                    Slope ({terrainMetrics.slopeDeg != null ? `${terrainMetrics.slopeDeg.toFixed(1)}°` : 'nominal'}) and roughness (
                    {terrainMetrics.roughnessM !== null ? `${terrainMetrics.roughnessM.toFixed(1)} m` : 'nominal'}) are within safe landing limits.
                  </span>
                </div>
              )}
            </div>

            {/* Collapsible Data Sources Section (Requirement 10) */}
            <div className="rounded-xl bg-[#0A121E] border border-slate-800/80 overflow-hidden">
              <button
                type="button"
                onClick={() => setIsDataSourcesOpen(!isDataSourcesOpen)}
                className="w-full p-2.5 flex items-center justify-between text-left hover:bg-slate-800/30 transition-colors"
              >
                <div className="flex items-center gap-1.5 text-xs font-mono font-semibold text-slate-200">
                  <Database className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Data Sources &amp; Topographic Provenance</span>
                </div>
                <div className="flex items-center gap-1 text-[10px] font-mono text-cyan-400">
                  <span>{isDataSourcesOpen ? 'Hide' : 'View'}</span>
                  <ChevronDown
                    className={`w-3.5 h-3.5 transition-transform duration-200 ${
                      isDataSourcesOpen ? 'rotate-180' : ''
                    }`}
                  />
                </div>
              </button>
              {isDataSourcesOpen && (
                <div className="p-3 pt-0 border-t border-slate-800/60 space-y-2 text-[11px] font-mono text-slate-300">
                  <div className="grid grid-cols-3 gap-1 py-1 border-b border-slate-800/50">
                    <span className="text-slate-400 col-span-1">Dataset Name</span>
                    <span className="text-white col-span-2">
                      NASA PDS LRO-L-LOLA-4-GDR-V1.0
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-1 py-1 border-b border-slate-800/50">
                    <span className="text-slate-400 col-span-1">Instrument</span>
                    <span className="text-slate-200 col-span-2">
                      Lunar Orbiter Laser Altimeter (LOLA) / LRO
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-1 py-1 border-b border-slate-800/50">
                    <span className="text-slate-400 col-span-1">Spatial Resolution</span>
                    <span className="text-slate-200 col-span-2">
                      400 m/pixel Polar Stereographic Grid (20 m/px base track profiles)
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-1 py-1 border-b border-slate-800/50">
                    <span className="text-slate-400 col-span-1">Elevation Units</span>
                    <span className="text-slate-200 col-span-2">
                      Meters relative to IAU Lunar Sphere (R₀ = 1,737,400.0 m)
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-1 py-1 border-b border-slate-800/50">
                    <span className="text-slate-400 col-span-1">Uncertainty</span>
                    <span className="text-slate-200 col-span-2">
                      ±1.0 m absolute vertical · ±0.1–0.3 m inter-track · ±20 m horizontal
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-1 py-1 border-b border-slate-800/50">
                    <span className="text-slate-400 col-span-1">Coverage Area</span>
                    <span className="text-slate-200 col-span-2">
                      80.0°S to 90.0°S (Lunar South Polar Cap, ±304 km bounds)
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-1 py-1">
                    <span className="text-slate-400 col-span-1">Derivation Method</span>
                    <span className="text-slate-200 col-span-2">
                      Horn 3×3 weighted gradient stencil for slope; local window RMS height dispersion for roughness; Great-Circle geodesic distance for landmarks.
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="p-6 rounded-xl bg-[#0A121E] border border-slate-800/80 text-xs font-mono text-slate-400 space-y-2.5 text-center my-4">
            <Mountain className="w-8 h-8 text-cyan-400 mx-auto opacity-70" />
            <div className="text-slate-200 font-semibold text-sm">Terrain Telemetry Unavailable</div>
            <p className="text-[11px] text-slate-400 max-w-xs mx-auto leading-relaxed">
              LOLA digital elevation model telemetry is not present for this coordinate ({latStr}, {lonStr}).
            </p>
          </div>
        ))}

        {/* ================================================================= */}
        {/* TAB 3: LIGHTING                                                   */}
        {/* ================================================================= */}
        {!isEarthFeature && activeTab === 'lighting' && (
          <div className="space-y-2.5">
            {/* Illumination & Shadow Summary Grid */}
            <div className="grid grid-cols-2 gap-2 font-mono">
              <div className="p-2.5 rounded-xl bg-[#0A121E] border border-slate-800/80 space-y-1">
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-slate-400">Sun Elevation / Az</span>
                  <span
                    className={`px-1.5 py-0.5 rounded text-[9px] font-bold whitespace-nowrap border ${
                      sunStatusMeta.label === 'Sunlit'
                        ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                        : sunStatusMeta.label === 'Terrain Masked'
                        ? 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                        : 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30'
                    }`}
                  >
                    {sunStatusMeta.label}
                  </span>
                </div>
                <div className="text-sm font-bold text-white tabular-nums">
                  {sun?.elevationDeg != null ? `${sun.elevationDeg.toFixed(2)}° el` : '—'} · {sun?.azimuthDeg != null ? `${sun.azimuthDeg.toFixed(1)}° az` : '—'}
                </div>
                <div className="text-[10px] text-slate-400">
                  Solar Disc Visible: <strong className="text-amber-300">{solarDiscPct}%</strong>
                </div>
              </div>

              <div className="p-2.5 rounded-xl bg-[#0A121E] border border-slate-800/80 space-y-1">
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-slate-400">Shadow / Masking</span>
                  <span className="text-cyan-300 font-bold">
                    {localThermal?.isPSR ? 'PSR Trap' : `${(sunTerrainHorizon ?? 0).toFixed(1)}° Ridge`}
                  </span>
                </div>
                <div className="text-sm font-bold text-white tabular-nums">
                  {sun?.elevationDeg != null
                    ? `${sun.elevationDeg - (sunTerrainHorizon ?? 0) >= 0 ? '+' : ''}${(sun.elevationDeg - (sunTerrainHorizon ?? 0)).toFixed(2)}° clearance`
                    : '—'}
                </div>
                <div className="text-[10px] text-slate-400 leading-snug break-words">
                  {solarTransition.timeUntilMs === null
                    ? solarTransition.isCurrentlySunlit
                      ? 'Continuous Polar Day'
                      : 'Extended Shadow Window'
                    : `Next ${solarTransition.nextEvent}: ${solarTransition.formattedDuration}`}
                </div>
              </div>
            </div>

            {/* Earth Visibility & Observation Conditions */}
            <div className="p-2.5 rounded-xl bg-[#0A121E] border border-slate-800/80 grid grid-cols-3 gap-2 font-mono text-xs">
              <div>
                <span className="text-[10px] text-slate-400 block">Earth Elevation</span>
                <span className="font-bold text-white tabular-nums">
                  {earthLook?.elevationDeg != null ? `${earthLook.elevationDeg.toFixed(1)}°` : '—'}
                </span>
                <span className="text-[10px] text-slate-400 block">
                  Az {earthLook?.azimuthDeg != null ? `${earthLook.azimuthDeg.toFixed(0)}°` : '—'}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block">Earth Horizon</span>
                <span className="font-bold text-cyan-300 tabular-nums">
                  {(earthTerrainHorizon ?? 0).toFixed(1)}°
                </span>
                <span className="text-[10px] text-slate-400 block">
                  {earthLook?.elevationDeg != null && (earthLook.elevationDeg - (earthTerrainHorizon ?? 0) >= 0) ? 'Unobstructed' : 'Occluded'}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block">Optical Regime</span>
                <span className="font-bold text-emerald-300">
                  {solarDiscPct > 0
                    ? sun?.elevationDeg != null && sun.elevationDeg < 5
                      ? 'Low-Angle Glint'
                      : 'Daylight Ops'
                    : 'Earthshine / IR'}
                </span>
                <span className="text-[10px] text-slate-400 block">Lidar Nominal</span>
              </div>
            </div>

            {/* Surface Radiative Thermal Regime (Calculated — Analytical Radiative Balance Model) */}
            {localThermal && (
              <div className="p-2.5 rounded-xl bg-[#0A121E] border border-slate-800/80 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-white flex items-center gap-1.5">
                    <Thermometer className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Surface Radiative Temperature (Calculated — Analytical Model)</span>
                  </span>
                  <span
                    className={`text-[10px] font-mono font-semibold px-2 py-0.5 rounded border ${
                      localThermal.isPSR
                        ? 'bg-purple-950/50 text-purple-300 border-purple-500/40'
                        : localThermal.isDaylight
                        ? 'bg-amber-950/40 text-amber-300 border-amber-500/40'
                        : 'bg-blue-950/50 text-blue-300 border-blue-500/40'
                    }`}
                  >
                    {localThermal.isPSR
                      ? 'PSR Cold Trap'
                      : localThermal.isDaylight
                      ? 'Daylight Insolation'
                      : 'Lunar Night'}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 font-mono text-xs">
                  <div className="p-2 rounded-lg bg-[#060b14] border border-slate-800/70">
                    <span className="text-[10px] text-slate-400 block">Bolometric Temp</span>
                    <span className="text-sm font-bold text-white tabular-nums">
                      {localThermal.tempC > 0 ? `+${localThermal.tempC}` : localThermal.tempC}°C
                    </span>
                    <span className="text-[10px] text-slate-400 block tabular-nums">
                      {localThermal.tempK} K
                    </span>
                  </div>
                  <div className="p-2 rounded-lg bg-[#060b14] border border-slate-800/70">
                    <span className="text-[10px] text-slate-400 block">Subsurface (0.5m)</span>
                    <span className="text-sm font-bold text-cyan-300 tabular-nums">
                      {localThermal.subsurfaceTempC ?? -45}°C
                    </span>
                    <span className="text-[10px] text-slate-400 block">Regolith Equilibrium</span>
                  </div>
                  <div className="p-2 rounded-lg bg-[#060b14] border border-slate-800/70">
                    <span className="text-[10px] text-slate-400 block">Thermal Regime</span>
                    <span className="text-[11px] font-bold text-amber-300 block mt-0.5">
                      {localThermal.isPSR
                        ? '< 40 K Trap'
                        : localThermal.tempK < 110
                        ? 'Cryogenic'
                        : 'Nominal'}
                    </span>
                    <span className="text-[10px] text-slate-400 block">Calculated (Equilibrium)</span>
                  </div>
                </div>
              </div>
            )}

            {/* 360° Interactive Horizon Chart */}
            <div className="p-2.5 rounded-xl bg-[#0A121E] border border-slate-800/80 space-y-2">
              <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
                <span className="text-white font-semibold">
                  360° Horizon Mask, Sun Track &amp; Libration Zone
                </span>
                <span>LOLA Altimetry</span>
              </div>
              <HorizonViewChart
                siteId={siteId}
                latitude={featLat}
                longitude={featLon}
                moonFeature={moonPoint}
                startMs={trackStartMs}
                currentSun={currentSun}
                currentEarth={currentEarth}
              />
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* TAB 4: COMMUNICATION (Direct-to-Earth Link Analyzer)               */}
        {/* ================================================================= */}
        {!isEarthFeature && activeTab === 'communication' && (
          <div className="space-y-2.5">
            {/* Geometric Line-of-Sight vs. Operational RF Link Disclosure */}
            <div className="px-2.5 py-1.5 rounded-xl bg-cyan-950/25 border border-cyan-500/30 text-[10px] font-mono text-cyan-200 leading-snug">
              <strong className="text-cyan-300">Geometric LOS vs. RF Link:</strong> Evaluates topographic horizon clearance and sub-Earth libration geometry. Operational RF link closure additionally depends on antenna gain, frequency band (S/X/Ka), and lander attitude.
            </div>
            {/* Core DTE Metrics Grid */}
            <div className="grid grid-cols-4 gap-1.5 font-mono">
              <div className="p-2 rounded-xl bg-[#0A121E] border border-slate-800/80">
                <span className="text-[9.5px] text-slate-400 block">Earth Elev</span>
                <span className="text-xs font-bold text-white tabular-nums">
                  {earthLook?.elevationDeg != null ? `${earthLook.elevationDeg.toFixed(1)}°` : '—'}
                </span>
              </div>
              <div className="p-2 rounded-xl bg-[#0A121E] border border-slate-800/80">
                <span className="text-[9.5px] text-slate-400 block">Earth Az</span>
                <span className="text-xs font-bold text-white tabular-nums">
                  {earthLook?.azimuthDeg != null ? `${earthLook.azimuthDeg.toFixed(1)}°` : '—'}
                </span>
              </div>
              <div className="p-2 rounded-xl bg-[#0A121E] border border-slate-800/80">
                <span className="text-[9.5px] text-slate-400 block">Link Margin</span>
                <span
                  className={`text-xs font-bold tabular-nums ${
                    generalLink?.status === 'clear' ? 'text-emerald-400' : 'text-amber-400'
                  }`}
                >
                  {generalLink?.marginDeg != null ? (
                    <>
                      {generalLink.marginDeg >= 0 ? '+' : ''}
                      {generalLink.marginDeg.toFixed(1)}°
                    </>
                  ) : '—'}
                </span>
              </div>
              <div className="p-2 rounded-xl bg-[#0A121E] border border-slate-800/80">
                <span className="text-[9.5px] text-slate-400 block">1-Way Delay</span>
                <span className="text-xs font-bold text-cyan-300 tabular-nums">
                  {lightTravelSec} s
                </span>
              </div>
            </div>

            {/* Interactive NASA Direct-to-Earth Communication Availability Timeline */}
            <DteSignalChart
              moonFeature={moonPoint}
              initialStationId={selectedStationId}
              onStationSelect={setSelectedStationId}
            />

            {/* Deep Space Network Ground Stations Status List */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
                <span className="flex items-center gap-1 text-slate-200 font-semibold">
                  <Globe2 className="w-3 h-3 text-emerald-400" />
                  <span>NASA Deep Space Network Complexes</span>
                </span>
                <span>Click station to filter</span>
              </div>
              <div className="space-y-1">
                {dsnSitesCalculations.map((station) => {
                  const isSelected = selectedStationId === station.id;
                  const isLinked = station.evaluation.status === 'clear';
                  return (
                    <div
                      key={station.id}
                      onClick={() =>
                        setSelectedStationId((prev) =>
                          prev === station.id ? 'all' : station.id
                        )
                      }
                      className={`px-2.5 py-1.5 rounded-xl border transition-colors cursor-pointer flex items-center justify-between gap-2 text-xs ${
                        isSelected
                          ? 'bg-cyan-950/30 border-cyan-500/50'
                          : 'bg-[#0A121E] border-slate-800/80 hover:border-slate-700'
                      }`}
                    >
                      <div className="min-w-0">
                        <div className={`font-medium text-white ${showFullCardData ? 'whitespace-normal break-words' : 'truncate'}`}>
                          {station.name}{' '}
                          <span className="text-[10px] font-mono text-slate-400">
                            ({station.country})
                          </span>
                        </div>
                        <div className="text-[10px] font-mono text-slate-400 tabular-nums">
                          Moon el:{' '}
                          {station.evaluation.stationElevationDeg != null
                            ? `${station.evaluation.stationElevationDeg.toFixed(1)}°`
                            : '—'}
                        </div>
                      </div>
                      <span
                        className={`text-[10px] font-mono font-bold whitespace-nowrap ${
                          isLinked ? 'text-emerald-400' : 'text-slate-400'
                        }`}
                      >
                        {isLinked ? '● LINK ACTIVE' : '▲ BELOW MASK'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* TAB 5: DOSSIER                                                    */}
        {/* ================================================================= */}
        {!isEarthFeature && activeTab === 'dossier' && (
          <div className="space-y-2.5">
            {/* Multi-Day Landing Window Suitability Verdict */}
            <div className="p-2.5 rounded-xl bg-[#0A121E] border border-slate-800/80 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-white flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span>Landing Feasibility Verdict</span>
                </span>
                <div className="flex items-center gap-1 bg-[#060b14] p-0.5 rounded-lg border border-slate-800">
                  {[7, 14, 28].map((days) => (
                    <button
                      key={days}
                      type="button"
                      onClick={() => setMissionWindowDays(days)}
                      className={`px-2 py-0.5 rounded text-[10px] font-mono transition-colors ${
                        missionWindowDays === days
                          ? 'bg-cyan-400 text-slate-950 font-bold'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      {days}d
                    </button>
                  ))}
                </div>
              </div>

              {missionWindowAssessment && (
                <>
                  <div className="flex items-center justify-between gap-3 p-2.5 rounded-lg bg-[#060b14] border border-slate-800/80 font-mono">
                    <div className="flex items-center gap-2.5">
                      <div className="w-12 h-12 rounded-xl border border-cyan-400/60 bg-cyan-950/30 flex flex-col items-center justify-center shrink-0">
                        <span className="text-lg font-bold text-cyan-300 leading-none tabular-nums">
                          {missionWindowAssessment.windowScore}
                        </span>
                        <span className="text-[9px] text-slate-400 mt-0.5">
                          {missionWindowDays}d Score
                        </span>
                      </div>
                      <div>
                        <span
                          className={`text-[11px] font-bold block ${
                            missionWindowAssessment.windowScore >= 80
                              ? 'text-emerald-400'
                              : missionWindowAssessment.windowScore >= 55
                              ? 'text-cyan-300'
                              : 'text-rose-400'
                          }`}
                        >
                          {missionWindowAssessment.windowScore >= 80
                            ? 'FAVORABLE SUITABILITY'
                            : missionWindowAssessment.windowScore >= 55
                            ? 'CONDITIONAL SUITABILITY'
                            : 'CHALLENGING / CONSTRAINED'}
                        </span>
                        <span className="text-[10px] text-slate-400 block tabular-nums">
                          Max Sun Streak: {missionWindowAssessment.longestSunlitHours}h · DSN:{' '}
                          {missionWindowAssessment.dsnRatio}%
                        </span>
                      </div>
                    </div>
                    <div className="text-right text-[10px] tabular-nums">
                      <span className="text-slate-400 block">Sunlight</span>
                      <span className="text-white font-bold">
                        {missionWindowAssessment.sunlitRatio}%
                      </span>
                      <span className="text-slate-400 block mt-0.5">
                        {missionWindowAssessment.minTemp}° to {missionWindowAssessment.maxTemp}°C
                      </span>
                    </div>
                  </div>

                  {/* Daily Suitability Strip */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
                      <span>Daily Suitability ({missionWindowDays}d Window)</span>
                      <span>Sun + DSN Composite</span>
                    </div>
                    <div className="grid grid-cols-7 gap-1">
                      {missionWindowAssessment.dailyScores.map((d) => (
                        <div
                          key={d.day}
                          title={`Day +${d.day}: Score ${d.score}%, Sun ${d.sunlitPct}%, DSN ${d.dsnPct}%`}
                          className={`h-6 rounded flex items-center justify-center font-mono text-[9px] font-bold tabular-nums ${
                            d.score >= 80
                              ? 'bg-emerald-500/80 text-slate-950'
                              : d.score >= 50
                              ? 'bg-cyan-500/80 text-slate-950'
                              : 'bg-rose-500/60 text-white'
                          }`}
                        >
                          d{d.day}
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* CLPS Flight Architecture & Payloads if available */}
            {isClps && clpsData && (
              <div className="p-2.5 rounded-xl bg-[#0A121E] border border-slate-800/80 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-white flex items-center gap-1.5">
                    <Rocket className="w-3.5 h-3.5 text-cyan-400" />
                    <span>{clpsData.taskOrder || 'CLPS Mission Architecture'}</span>
                  </span>
                  <span className="text-[10px] font-mono text-emerald-400">
                    {clpsData.provider} · {clpsData.lander}
                  </span>
                </div>
                {payloadsList.length > 0 && (
                  <div className="space-y-1 pt-1 border-t border-slate-800/70">
                    <span className="text-[10px] font-mono text-slate-400 block">
                      Payloads Manifest ({payloadsList.length})
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {payloadsList.map((p, idx) => {
                        const pName = typeof p === 'string' ? p : p.name;
                        return (
                          <span
                            key={idx}
                            className="text-[10px] font-mono text-cyan-300 bg-[#060b14] px-2 py-0.5 rounded border border-slate-800"
                          >
                            {pName}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Scientific Context & Physical Description */}
            <div className="p-2.5 rounded-xl bg-[#0A121E] border border-slate-800/80 space-y-1.5">
              <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 block">
                Site Context &amp; Provenance
              </span>
              <p
                className="text-xs text-slate-300 leading-relaxed"
                style={
                  isContextExpanded
                    ? undefined
                    : {
                        display: '-webkit-box',
                        WebkitBoxOrient: 'vertical',
                        WebkitLineClamp: 3,
                        overflow: 'hidden',
                      }
                }
              >
                {siteContextDescription}
              </p>
              {siteContextDescription.length > 120 && (
                <button
                  type="button"
                  aria-expanded={isContextExpanded}
                  onClick={() => setIsContextExpanded((expanded) => !expanded)}
                  className="text-[10px] font-mono text-cyan-400 hover:text-cyan-300 transition-colors"
                >
                  {isContextExpanded ? 'Show less' : 'Read full description'}
                </button>
              )}
              <div className="pt-1 flex items-center justify-between text-[10px] font-mono text-slate-400 border-t border-slate-800/70">
                <span>Datum: IAU Moon 2000 (R₀ = 1,737.4 km)</span>
                <a
                  href={
                    clpsData?.referenceLinks?.[0]?.url ||
                    'https://lunar.gsfc.nasa.gov/'
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-cyan-400 hover:text-cyan-300"
                >
                  <span>NASA LRO / PDS</span>
                  <ExternalLink className="w-2.5 h-2.5" />
                </a>
              </div>
              <div className="text-[9.5px] font-mono text-slate-400 pt-1 border-t border-slate-800/70">
                Suitability scores are decision-support approximations computed from LOLA DEM altimetry and DE440 ephemerides—not official NASA flight certification.
              </div>
            </div>

            {/* NOAA SWPC Space Weather Telemetry */}
            <div className="p-2.5 rounded-xl bg-[#0A121E] border border-slate-800/80 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-white flex items-center gap-1.5">
                  <Wind className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Space Weather Telemetry (NOAA SWPC)</span>
                </span>
                <button
                  type="button"
                  onClick={() => loadWeather(true)}
                  disabled={isWeatherLoading}
                  title="Refresh space weather feeds"
                  className="p-1 rounded-md bg-[#060b14] hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 transition-colors"
                >
                  <RefreshCw className={`w-3 h-3 ${isWeatherLoading ? 'animate-spin' : ''}`} />
                </button>
              </div>
              <div className="grid grid-cols-3 gap-1.5 font-mono text-xs">
                <div className="p-2 rounded-lg bg-[#060b14] border border-slate-800/70">
                  <span className="text-[9.5px] text-slate-400 block">Solar Wind</span>
                  <div className="text-xs font-bold text-white tabular-nums mt-0.5">
                    {spaceWeather.speed != null ? `${spaceWeather.speed} km/s` : 'Standby'}
                  </div>
                  <span className="text-[9px] text-cyan-400 block truncate">
                    {spaceWeather.speedStatus}
                  </span>
                </div>
                <div className="p-2 rounded-lg bg-[#060b14] border border-slate-800/70">
                  <span className="text-[9.5px] text-slate-400 block">Proton Density</span>
                  <div className="text-xs font-bold text-white tabular-nums mt-0.5">
                    {spaceWeather.density != null ? `${spaceWeather.density} p/cm³` : '—'}
                  </div>
                  <span className="text-[9px] text-slate-400 block">Plasma stream</span>
                </div>
                <div className="p-2 rounded-lg bg-[#060b14] border border-slate-800/70">
                  <span className="text-[9.5px] text-slate-400 block">IMF Bz / Bt</span>
                  <div className="text-xs font-bold text-amber-300 tabular-nums mt-0.5">
                    {spaceWeather.bz != null ? `${spaceWeather.bz} nT` : '—'}
                  </div>
                  <span className="text-[9px] text-slate-400 block truncate">
                    Bt: {spaceWeather.bt != null ? `${spaceWeather.bt} nT` : 'N/A'}
                  </span>
                </div>
              </div>
              <div className="text-[9px] font-mono text-slate-400 flex items-center justify-between border-t border-slate-800/60 pt-1">
                <span className="truncate max-w-[240px]">{spaceWeather.source}</span>
                <span>{spaceWeather.isFallback ? 'Simulated' : 'Live NOAA'}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* =================================================================== */}
      {/* 4. PERSISTENT ACTION CONTROLS FOOTER (3 Compact Buttons)            */}
      {/* =================================================================== */}
      {(() => {
        const targetFeature = clpsData || feature;
        const isAlreadyAdded =
          !isEarthFeature && comparisonSelectionStore.isFeatureInComparison(targetFeature);
        const isAtLimit =
          !isAlreadyAdded &&
          comparisonSnap.locations.length >= comparisonSnap.maxLocations;
        const showComparisonBar =
          !isEarthFeature &&
          (isAlreadyAdded || comparisonFeedbackMsg?.type === 'error');

        return (
          <>
            {showComparisonBar && (
              <div className="px-3 py-1.5 border-t border-slate-800/90 bg-[#060B13] flex items-center justify-between gap-2 shrink-0 animate-in fade-in duration-150">
                <div className="min-w-0 flex items-center gap-1.5">
                  <span
                    className={`text-[10px] font-mono font-semibold truncate ${
                      comparisonFeedbackMsg?.type === 'error'
                        ? 'text-amber-300'
                        : 'text-[#00D2C4]'
                    }`}
                  >
                    {comparisonFeedbackMsg?.type === 'error'
                      ? comparisonFeedbackMsg.text
                      : `Comparison: ${comparisonSnap.locations.length} / ${comparisonSnap.maxLocations} Selected`}
                  </span>
                </div>
                {onReturnToComparison && (
                  <button
                    type="button"
                    onClick={onReturnToComparison}
                    className="px-2 py-1 rounded bg-[#00D2C4]/15 hover:bg-[#00D2C4]/25 border border-[#00D2C4]/40 text-[10px] font-mono font-semibold text-[#00D2C4] whitespace-nowrap transition-colors"
                  >
                    Back to Comparison ({comparisonSnap.locations.length}/{comparisonSnap.maxLocations}) →
                  </button>
                )}
              </div>
            )}

            <div className={`px-3 py-2 border-t border-slate-800/90 bg-[#080f1d] grid ${isCustomPin ? 'grid-cols-4' : 'grid-cols-3'} gap-1.5 shrink-0`}>
              <button
                type="button"
                onClick={() => onZoomHere?.(featLon, featLat)}
                title="Center map view on this pin"
                className="h-8 px-1.5 rounded-lg bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-300 border border-cyan-500/30 font-mono text-[10.5px] font-semibold flex items-center justify-center gap-1 transition-colors whitespace-nowrap"
              >
                <Navigation className="w-3 h-3 shrink-0" />
                <span>{isCustomPin ? 'Center' : 'Center View'}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  if (isAlreadyAdded) {
                    setComparisonFeedbackMsg(null);
                    onCompareMission?.(targetFeature);
                  } else if (isAtLimit) {
                    setComparisonFeedbackMsg({
                      type: 'error',
                      text: `Cannot add: Limit (${comparisonSnap.maxLocations}/${comparisonSnap.maxLocations}) reached`,
                    });
                    onCompareMission?.(targetFeature);
                  } else {
                    setComparisonFeedbackMsg(null);
                    onCompareMission?.(targetFeature);
                  }
                }}
                title={
                  isAlreadyAdded
                    ? 'Click to deselect and remove this location from Site Comparison'
                    : isAtLimit
                    ? `Cannot add: Maximum of ${comparisonSnap.maxLocations} locations reached`
                    : 'Add this location to Site Comparison'
                }
                className={`h-8 px-1.5 rounded-lg font-mono text-[10.5px] font-medium flex items-center justify-center gap-1 transition-colors whitespace-nowrap border ${
                  isAlreadyAdded
                    ? 'bg-emerald-950/40 hover:bg-rose-950/50 text-emerald-300 hover:text-rose-200 border-emerald-500/40 hover:border-rose-500/40'
                    : isAtLimit
                    ? 'bg-amber-950/40 hover:bg-amber-950/60 text-amber-300 border-amber-500/40'
                    : 'bg-slate-900 hover:bg-slate-800 text-slate-200 border-slate-800'
                }`}
              >
                {isAlreadyAdded ? (
                  <>
                    <X className="w-3 h-3 text-rose-400 shrink-0" />
                    <span>{isCustomPin ? 'Deselect' : `Deselect (${comparisonSnap.locations.length}/${comparisonSnap.maxLocations})`}</span>
                  </>
                ) : isAtLimit ? (
                  <>
                    <AlertTriangle className="w-3 h-3 text-amber-400 shrink-0" />
                    <span>{isCustomPin ? 'Limit' : `Limit (${comparisonSnap.locations.length}/${comparisonSnap.maxLocations})`}</span>
                  </>
                ) : (
                  <>
                    <GitCompare className="w-3 h-3 text-emerald-400 shrink-0" />
                    <span>{isCustomPin ? 'Compare' : 'Compare Site'}</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleShareLocation}
                title="Copy shareable permalink"
                className="h-8 px-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-800 font-mono text-[10.5px] font-medium flex items-center justify-center gap-1 transition-colors whitespace-nowrap"
              >
                {shared ? (
                  <>
                    <Check className="w-3 h-3 text-emerald-400 shrink-0" />
                    <span className="text-emerald-300">Copied</span>
                  </>
                ) : (
                  <>
                    <Share2 className="w-3 h-3 text-cyan-400 shrink-0" />
                    <span>Share</span>
                  </>
                )}
              </button>

              {isCustomPin && onClearCustomPin && (
                <button
                  type="button"
                  onClick={() => onClearCustomPin(isEarthFeature ? 'earth' : 'moon')}
                  title="Remove custom pin from lunar surface"
                  className="h-8 px-1.5 rounded-lg bg-rose-950/30 hover:bg-rose-900/50 text-rose-300 border border-rose-500/30 font-mono text-[10.5px] font-medium flex items-center justify-center gap-1 transition-colors whitespace-nowrap"
                >
                  <Trash2 className="w-3 h-3 text-rose-400 shrink-0" />
                  <span>Clear Pin</span>
                </button>
              )}
            </div>
          </>
        );
      })()}
    </aside>
  );
}
