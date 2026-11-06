import React, { useState, useMemo } from 'react';
import {
  X,
  Compass,
  Navigation,
  GitCompare,
  Radio,
  Rocket,
  Trash2,
  ShieldCheck,
  AlertTriangle,
  Thermometer,
  Sun,
  CheckCircle2,
} from 'lucide-react';
import { formatLunarCoordinates, getLunarRegionInfo } from '../../utils/coordinates.js';
import { getClpsMission } from '../../data/clpsMissions.js';
import { getLunarTemperature } from '../../utils/lunarThermal.js';
import { EARTH_COMMUNICATION_SITES } from '../../data/earthCommunicationSites.js';
import {
  DEFAULT_DTE_CONSTRAINTS,
  evaluateEarthLink,
  earthLookFromMoon,
} from '../../utils/earthLink.js';
import { computeCelestialState, solarPosition } from '../../utils/lunarEphemeris.js';
import { celestialTimeStore } from '../../utils/celestialTime.js';
import { horizonAt, HORIZON_TABLE, ensurePolarDemLoaded, sampleLunarTerrainMetrics } from '../../utils/horizons.js';
import {
  evaluateCandidateForMissionWindow,
  DEFAULT_PLANNER_CONSTRAINTS,
} from '../../utils/plannerEngine.js';
import HorizonViewCard from '../features/HorizonViewCard.jsx';

export default function SiteAnalysisModal({
  isOpen,
  onClose,
  feature,
  onZoomHere,
  onCompareMission,
  onClearCustomPin,
  communicationEarthFeature = null,
}) {
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'horizon' | 'payloads'
  const [missionWindowDays, setMissionWindowDays] = useState(14); // 7, 14, 28 days

  // DTE Earth selection state: '' = Combined Global DSN (default), or specific station ID
  const [selectedStationId, setSelectedStationId] = useState(() => communicationEarthFeature?.id || '');

  // Safe feature properties extraction
  const safeFeature = feature || {};
  const featLat =
    typeof safeFeature.latitude === 'number'
      ? safeFeature.latitude
      : typeof safeFeature.lat === 'number'
      ? safeFeature.lat
      : 0;

  const featLon =
    typeof safeFeature.longitude === 'number'
      ? safeFeature.longitude
      : typeof safeFeature.lon === 'number'
      ? safeFeature.lon
      : 0;

  const featureId = safeFeature.id || 'default-site';
  const isEarthBody = safeFeature.body === 'earth';

  const clpsData = useMemo(() => {
    if (!feature) return null;
    return (
      feature.clpsData ||
      getClpsMission(feature.id) ||
      (feature.id === 'landing-odysseus' ? getClpsMission('clps-im1-odysseus') : null)
    );
  }, [feature]);

  const isCustomPin = Boolean(safeFeature.isCustomPin || safeFeature.type === 'custom_pin');
  const isClps = Boolean(clpsData || safeFeature.isClps || safeFeature.type === 'clps-mission');

  const regionInfo = useMemo(() => {
    if (!feature || isEarthBody) return null;
    return feature.regionInfo || getLunarRegionInfo(featLon, featLat);
  }, [feature, isEarthBody, featLon, featLat]);

  const payloadsList = useMemo(() => {
    if (clpsData?.payloads) return clpsData.payloads;
    if (Array.isArray(safeFeature.payloads)) return safeFeature.payloads;
    return [];
  }, [clpsData, safeFeature.payloads]);

  // Compute Ephemeris state
  const [timeMs, setTimeMs] = useState(() => celestialTimeStore.get().ms);
  const [demTick, setDemTick] = useState(0);
  React.useEffect(() => {
    ensurePolarDemLoaded()
      .then((grid) => {
        if (grid) setDemTick((t) => t + 1);
      })
      .catch(() => {});
    const unsubscribe = celestialTimeStore.subscribe(({ ms }) => {
      setTimeMs(ms);
    });
    return unsubscribe;
  }, []);

  const terrainMetrics = useMemo(() => {
    if (!feature || isEarthBody) return null;
    return sampleLunarTerrainMetrics(featLat, featLon, feature);
  }, [feature, isEarthBody, featLat, featLon, demTick]);

  const state = useMemo(() => computeCelestialState(timeMs), [timeMs]);
  const terrainFn = useMemo(
    () => (azimuthDeg) => horizonAt(HORIZON_TABLE, featureId, azimuthDeg, featLat, featLon) ?? 0,
    [featureId, featLat, featLon, demTick]
  );
  const earthLook = useMemo(
    () => earthLookFromMoon(state, { latitude: featLat, longitude: featLon }),
    [state, featLat, featLon]
  );

  const localThermal = useMemo(() => {
    if (!feature || isEarthBody) return null;
    const flatSun = solarPosition(state, featLat, featLon);
    const sunHoriz = terrainFn(flatSun.azimuthDeg) ?? 0;
    return getLunarTemperature(featLat, featLon, new Date(timeMs), {
      terrainHorizonDeg: sunHoriz,
      elevationM: terrainMetrics?.elevationM ?? null,
    });
  }, [feature, isEarthBody, featLat, featLon, timeMs, state, terrainFn, terrainMetrics?.elevationM]);

  // Primary NASA DSN ground stations
  const dsnStations = useMemo(() => {
    return EARTH_COMMUNICATION_SITES.filter(
      (s) => s.id.includes('nasa') || s.network?.includes('DSN')
    );
  }, []);

  // Currently active Earth station (null if Combined DSN selected)
  const activeStation = useMemo(() => {
    if (!selectedStationId) return null;
    return (
      EARTH_COMMUNICATION_SITES.find((s) => s.id === selectedStationId) || null
    );
  }, [selectedStationId]);

  // Instantaneous DTE evaluations
  const dsnLinksInstant = useMemo(() => {
    if (regionInfo?.face === 'Farside') {
      return { isAnyLinked: false, stations: [], bestMarginDeg: -90 };
    }
    const evaluations = dsnStations.map((station) => {
      const link = evaluateEarthLink({
        state,
        moonFeature: { id: featureId, latitude: featLat, longitude: featLon },
        earthFeature: station,
        constraints: DEFAULT_DTE_CONSTRAINTS,
        terrainFn,
      });
      return {
        id: station.id,
        name: station.name,
        country: station.country,
        link,
        isLinked: link.status === 'clear',
      };
    });

    const isAnyLinked = evaluations.some((e) => e.isLinked);
    const bestMargin = evaluations.reduce((max, e) => Math.max(max, e.link.marginDeg), -90);

    return {
      isAnyLinked,
      stations: evaluations,
      bestMarginDeg: bestMargin,
    };
  }, [state, featureId, featLat, featLon, dsnStations, terrainFn, regionInfo]);

  // Specific link evaluation if user chose a single station
  const stationLink = useMemo(() => {
    if (!activeStation) {
      return {
        status: dsnLinksInstant.isAnyLinked ? 'clear' : 'blocked',
        statusLabel: dsnLinksInstant.isAnyLinked ? 'DSN Tri-Station Active' : 'Masked / Facing Away',
        marginDeg: dsnLinksInstant.bestMarginDeg,
      };
    }
    return evaluateEarthLink({
      state,
      moonFeature: { id: featureId, latitude: featLat, longitude: featLon },
      earthFeature: activeStation,
      constraints: DEFAULT_DTE_CONSTRAINTS,
      terrainFn,
    });
  }, [activeStation, state, featureId, featLat, featLon, terrainFn, dsnLinksInstant]);

  // Scientific Multi-Day Mission Window Evaluation (Evaluates over missionWindowDays)
  const missionWindowAssessment = useMemo(() => {
    if (isEarthBody) return null;

    const numSamples = missionWindowDays * 4; // 4 samples per day (every 6 hours)
    const stepMs = (missionWindowDays * 86400000) / numSamples;
    const isFarside = regionInfo?.face === 'Farside';

    let sunlitSteps = 0;
    let dsnSteps = 0;
    let currentSunStreak = 0;
    let maxSunStreak = 0;
    let minTemp = 1000;
    let maxTemp = -1000;

    // Daily score breakdowns for the mini-strip
    const dailyScores = Array.from({ length: missionWindowDays }, (_, dayIdx) => {
      let daySunSteps = 0;
      let dayDsnSteps = 0;
      const dayStartMs = timeMs + dayIdx * 86400000;

      for (let s = 0; s < 4; s++) {
        const t = dayStartMs + s * 6 * 3600000;
        const stepState = computeCelestialState(t);
        const therm = getLunarTemperature(featLat, featLon, new Date(t));
        minTemp = Math.min(minTemp, therm.tempC);
        maxTemp = Math.max(maxTemp, therm.tempC);

        // Sun — use solarPosition() which returns { elevationDeg, azimuthDeg, status }
        const flatSun = solarPosition(stepState, featLat, featLon, 0);
        const thElev = terrainFn(flatSun.azimuthDeg);
        const solWithHorizon = solarPosition(stepState, featLat, featLon, thElev);
        const isSunlit = solWithHorizon.status === 'sunlit';
        if (isSunlit) {
          sunlitSteps++;
          daySunSteps++;
          currentSunStreak++;
          if (currentSunStreak > maxSunStreak) maxSunStreak = currentSunStreak;
        } else {
          currentSunStreak = 0;
        }

        // DSN Link
        if (!isFarside) {
          const anyDsnActive = dsnStations.some((station) => {
            const lk = evaluateEarthLink({
              state: stepState,
              moonFeature: { id: featureId, latitude: featLat, longitude: featLon },
              earthFeature: station,
              constraints: DEFAULT_DTE_CONSTRAINTS,
              terrainFn,
            });
            return lk.status === 'clear';
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
        id: featureId,
        name: clpsData?.name || safeFeature.name || 'Lunar Site',
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
    const finalWindowScore = unifiedEval?.overallScore ?? 50;

    return {
      windowScore: finalWindowScore,
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
    missionWindowDays,
    timeMs,
    featLat,
    featLon,
    featureId,
    clpsData,
    safeFeature.name,
    regionInfo,
    terrainFn,
    dsnStations,
    localThermal,
    terrainMetrics,
    isEarthBody,
  ]);

  // Comprehensive Landing Site Assessment & Verdict calculation
  const landingVerdict = useMemo(() => {
    let instantScore = 100;
    const keyFactors = [];

    // Instant DTE Line of Sight evaluation
    if (activeStation) {
      if (stationLink.status === 'clear') {
        keyFactors.push({ text: `Direct LOS to ${activeStation.name} active (+${stationLink.marginDeg.toFixed(1)}° margin)`, positive: true });
      } else {
        instantScore -= 30;
        keyFactors.push({ text: `${activeStation.name} masked by terrain or Earth horizon`, positive: false });
      }
    } else {
      if (dsnLinksInstant.isAnyLinked) {
        keyFactors.push({ text: `Combined DSN network link active (+${dsnLinksInstant.bestMarginDeg.toFixed(1)}° best margin)`, positive: true });
      } else {
        instantScore -= 30;
        keyFactors.push({ text: 'All Earth DSN ground complexes masked or Moon facing away', positive: false });
      }
    }

    // Farside vs Nearside
    if (regionInfo?.face === 'Farside') {
      instantScore -= 35;
      keyFactors.push({ text: 'Farside location requires dedicated orbital relay satellite (e.g. Queqiao / Gateway)', positive: false });
    } else {
      keyFactors.push({ text: 'Nearside location with direct optical/RF Earth visibility', positive: true });
    }

    // Thermal / Illumination
    if (localThermal?.isPSR) {
      instantScore -= 20;
      keyFactors.push({ text: 'Permanently Shadowed Region (PSR) - cryogenic thermal environment (~-240°C)', positive: false });
    } else if (localThermal?.isDaylight) {
      keyFactors.push({ text: `Active solar illumination (+${localThermal.tempC}°C surface temp)`, positive: true });
    } else {
      instantScore -= 10;
      keyFactors.push({ text: `Lunar night currently in progress (${localThermal?.tempC ?? -160}°C)`, positive: false });
    }

    // Mission window continuity factor
    if (missionWindowAssessment) {
      if (missionWindowAssessment.longestSunlitHours >= 120) {
        keyFactors.push({ text: `${missionWindowAssessment.longestSunlitHours}h continuous sunlight window in next ${missionWindowDays} days`, positive: true });
      } else if (missionWindowAssessment.longestSunlitHours < 48) {
        keyFactors.push({ text: `Limited continuous sunlight (${missionWindowAssessment.longestSunlitHours}h max streak in window)`, positive: false });
      }
    }

    const finalInstantScore = Math.max(10, Math.min(100, instantScore));
    const compositeScore = missionWindowAssessment
      ? Math.round(missionWindowAssessment.windowScore * 0.7 + finalInstantScore * 0.3)
      : finalInstantScore;

    let statusLabel = 'OPTIMAL LANDING SITE';
    let badgeClass = 'bg-[#34D399]/20 text-[#34D399] border-[#34D399]/40';
    let summaryText = `Site provides strong multi-day solar power and DSN communication availability for touchdown and surface operations.`;

    if (compositeScore < 50) {
      statusLabel = 'HIGH RISK / CONSTRAINED';
      badgeClass = 'bg-rose-950/40 text-rose-300 border-rose-500/40';
      summaryText = `Site has severe communication or thermal constraints (e.g. Farside or deep PSR). Requires dedicated orbital relay satellite and cryogenic lander survival systems.`;
    } else if (compositeScore < 80) {
      statusLabel = 'VIABLE WITH OPERATIONAL WINDOWS';
      badgeClass = 'bg-white/[0.08] text-[#F8FAFC] border-white/25';
      summaryText = `Site is viable during targeted illumination windows. Mission architecture must schedule landing to align with the peak sunlit cycle.`;
    }

    return {
      instantScore: finalInstantScore,
      windowScore: missionWindowAssessment?.windowScore ?? finalInstantScore,
      compositeScore,
      statusLabel,
      badgeClass,
      summaryText,
      keyFactors,
    };
  }, [activeStation, stationLink, dsnLinksInstant, regionInfo, localThermal, missionWindowAssessment, missionWindowDays]);

  if (!isOpen || !feature) return null;

  const { latStr, lonStr } = formatLunarCoordinates(featLon, featLat, 4);
  const lightTravelSec = (state.earth.distanceKm / 299792.458).toFixed(2);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-md animate-in fade-in duration-150 select-none pointer-events-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative w-full max-w-2xl max-h-[92vh] bg-[#0C0D12] border border-[#1E2028] rounded-3xl shadow-2xl overflow-hidden flex flex-col text-[#F8FAFC] font-sans">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#1E2028] bg-[#050507] shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white/[0.08] border border-white/25 flex items-center justify-center text-[#F8FAFC]">
              <Compass className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono uppercase tracking-wider text-[#F8FAFC]">
                  {isCustomPin
                    ? 'CUSTOM WAYPOINT'
                    : isClps
                    ? `NASA CLPS · ${clpsData?.taskOrder || 'MISSION'}`
                    : feature.body === 'earth'
                    ? 'EARTH DSN STATION'
                    : 'LUNAR GEOGRAPHIC SITE'}
                </span>
                {isClps && clpsData && (
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#34D399]/20 text-[#34D399] border border-[#34D399]/40">
                    {clpsData.missionStatus === 'completed'
                      ? 'SOFT LANDING VERIFIED'
                      : 'PLANNED FLIGHT'}
                  </span>
                )}
              </div>
              <h2 className="font-serif text-2xl text-[#F8FAFC] leading-snug">
                {clpsData?.name || feature.name}
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full bg-[#14161D] hover:bg-[#1E2028] text-[#94A3B8] hover:text-[#F8FAFC] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Navigation (Overview + Terrain Horizon & Sun + Payloads if applicable) */}
        <div className="px-6 py-2.5 border-b border-[#1E2028] bg-[#050507] flex items-center gap-2 overflow-x-auto custom-scrollbar shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('overview')}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-colors whitespace-nowrap ${
              activeTab === 'overview'
                ? 'bg-[#14161D] text-[#F8FAFC] font-semibold border border-white/25'
                : 'text-[#94A3B8] hover:text-[#F8FAFC]'
            }`}
          >
            Site Overview &amp; Window Verdict
          </button>

          {feature.body !== 'earth' && (
            <button
              type="button"
              onClick={() => setActiveTab('horizon')}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-colors whitespace-nowrap ${
                activeTab === 'horizon'
                  ? 'bg-[#14161D] text-[#F8FAFC] font-semibold border border-white/25'
                  : 'text-[#94A3B8] hover:text-[#F8FAFC]'
              }`}
            >
              Terrain Horizon &amp; Sun System
            </button>
          )}

          {payloadsList.length > 0 && (
            <button
              type="button"
              onClick={() => setActiveTab('payloads')}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-colors whitespace-nowrap ${
                activeTab === 'payloads'
                  ? 'bg-[#14161D] text-[#F8FAFC] font-semibold border border-white/25'
                  : 'text-[#94A3B8] hover:text-[#F8FAFC]'
              }`}
            >
              Payloads Manifest ({payloadsList.length})
            </button>
          )}
        </div>

        {/* Body Content */}
        <div className="p-6 space-y-5 flex-1 overflow-y-auto custom-scrollbar">
          {activeTab === 'overview' && (
            <div className="space-y-5">
              {/* 1. Scientific Landing Site Assessment & Multi-Day Window Verdict Card */}
              {feature.body !== 'earth' && (
                <div className="p-4 rounded-2xl bg-[#050507] border border-[#1E2028] space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#1E2028] pb-3">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="w-5 h-5 text-[#34D399]" />
                      <div>
                        <span className="text-[10px] font-mono uppercase tracking-wider text-[#94A3B8] block">
                          Mission Feasibility Evaluation
                        </span>
                        <h3 className="text-sm font-bold text-[#F8FAFC]">
                          Landing Window Suitability Verdict
                        </h3>
                      </div>
                    </div>

                    {/* Window Duration Selector */}
                    <div className="flex items-center gap-1.5 bg-[#0C0D12] p-1 rounded-xl border border-[#1E2028]">
                      <span className="text-[10px] font-mono text-[#94A3B8] pl-1.5 pr-1">Window:</span>
                      {[7, 14, 28].map((days) => (
                        <button
                          key={days}
                          type="button"
                          onClick={() => setMissionWindowDays(days)}
                          className={`px-2 py-0.5 rounded-lg text-[11px] font-mono transition-colors ${
                            missionWindowDays === days
                              ? 'bg-white text-[#050507] font-bold'
                              : 'text-[#94A3B8] hover:text-white'
                          }`}
                        >
                          {days}d
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Dual Score Presentation: Mission Window vs Current Instant */}
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-[#0C0D12] p-3.5 rounded-xl border border-[#1E2028]">
                    <div className="flex items-center gap-3">
                      {/* Mission Window Primary Score */}
                      <div className="w-16 h-16 rounded-2xl border-2 border-white/25 bg-[#050507] flex flex-col items-center justify-center font-mono shrink-0 shadow-sm">
                        <span className="text-2xl font-black text-[#F8FAFC] leading-none">
                          {landingVerdict.windowScore}
                        </span>
                        <span className="text-[9px] font-mono text-[#94A3B8] mt-0.5">{missionWindowDays}d Window</span>
                      </div>

                      <div>
                        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-mono font-bold border ${landingVerdict.badgeClass} mb-1`}>
                          {landingVerdict.statusLabel}
                        </span>
                        <div className="text-xs text-[#94A3B8]">
                          Current Instant Moment Score:{' '}
                          <span className="font-mono font-bold text-white">
                            {landingVerdict.instantScore}%
                          </span>
                        </div>
                      </div>
                    </div>

                    {missionWindowAssessment && (
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs font-mono sm:border-l sm:border-[#1E2028] sm:pl-4">
                        <div>
                          <span className="text-[10px] text-[#94A3B8] block">Max Sunlit Streak</span>
                          <span className="text-[#34D399] font-bold">{missionWindowAssessment.longestSunlitHours} hrs</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-[#94A3B8] block">DSN Network Up</span>
                          <span className="text-[#F8FAFC] font-bold">{missionWindowAssessment.dsnRatio}%</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-[#94A3B8] block">Window Sunlight</span>
                          <span className="text-white font-bold">{missionWindowAssessment.sunlitRatio}%</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-[#94A3B8] block">Thermal Span</span>
                          <span className="text-white font-bold">{missionWindowAssessment.minTemp}° to {missionWindowAssessment.maxTemp}°C</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Daily Suitability Timeline Strip */}
                  {missionWindowAssessment?.dailyScores && (
                    <div className="space-y-1.5 pt-1">
                      <div className="flex items-center justify-between text-[10px] font-mono text-[#94A3B8]">
                        <span>Daily Landing Suitability Strip ({missionWindowDays} Days Ahead)</span>
                        <span>Click any day to inspect</span>
                      </div>
                      <div className="grid grid-cols-7 sm:grid-cols-14 gap-1">
                        {missionWindowAssessment.dailyScores.map((day) => {
                          const barBg =
                            day.score >= 80
                              ? 'bg-[#34D399] text-[#050507]'
                              : day.score >= 50
                              ? 'bg-white text-[#050507]'
                              : 'bg-rose-500/70 text-white';
                          return (
                            <div
                              key={day.day}
                              title={`Day +${day.day}: Score ${day.score}%, Sun ${day.sunlitPct}%, DSN ${day.dsnPct}%`}
                              className={`h-7 rounded flex flex-col items-center justify-center font-mono text-[9px] font-bold cursor-default transition-transform hover:scale-110 ${barBg}`}
                            >
                              d{day.day}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <p className="text-xs text-[#F8FAFC]/90 leading-relaxed font-normal">
                    {landingVerdict.summaryText}
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                    {landingVerdict.keyFactors.map((factor, idx) => (
                      <div
                        key={idx}
                        className="p-2.5 rounded-xl bg-[#0C0D12] border border-[#1E2028] flex items-center gap-2 text-[11px]"
                      >
                        {factor.positive ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-[#34D399] shrink-0" />
                        ) : (
                          <AlertTriangle className="w-3.5 h-3.5 text-[#F8FAFC] shrink-0" />
                        )}
                        <span className={factor.positive ? 'text-[#F8FAFC]' : 'text-[#F8FAFC]'}>
                          {factor.text}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 2. Integrated Weather & DTE Quick Summaries Grid */}
              {feature.body !== 'earth' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Weather / Thermal Card */}
                  <div className="p-4 rounded-2xl bg-[#050507] border border-[#1E2028] space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-[#F8FAFC] flex items-center gap-2">
                        <Thermometer className="w-4 h-4 text-[#F8FAFC]" />
                        <span>Surface Weather &amp; Thermal</span>
                      </span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#14161D] text-[#34D399]">
                        {localThermal?.isDaylight ? 'Sunlit' : localThermal?.isPSR ? 'PSR' : 'Lunar Night'}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs font-mono pt-1">
                      <div>
                        <span className="text-[10px] text-[#94A3B8] block">Temperature</span>
                        <span className="font-bold text-[#F8FAFC] text-sm">
                          {localThermal ? `${localThermal.tempC > 0 ? '+' : ''}${localThermal.tempC}°C` : 'N/A'}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-[#94A3B8] block">Solar Exposure</span>
                        <span className="font-bold text-[#F8FAFC]">
                          {localThermal?.isPSR ? '0% (Shadowed)' : localThermal?.isDaylight ? '100% (Daylight)' : '0% (Night)'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* DTE Communication Summary Card with Combined DSN as Default */}
                  <div className="p-4 rounded-2xl bg-[#050507] border border-[#1E2028] space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-[#F8FAFC] flex items-center gap-2">
                        <Radio className="w-4 h-4 text-[#34D399]" />
                        <span>Direct-To-Earth (DTE)</span>
                      </span>
                      <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold ${
                        (activeStation ? stationLink.status === 'clear' : dsnLinksInstant.isAnyLinked)
                          ? 'bg-[#34D399]/20 text-[#34D399] border border-[#34D399]/40'
                          : 'bg-rose-950/40 text-rose-300 border border-rose-500/40'
                      }`}>
                        {(activeStation ? stationLink.status === 'clear' : dsnLinksInstant.isAnyLinked) ? 'ACTIVE DTE LINK' : 'OCCULTED'}
                      </span>
                    </div>

                    {/* Earth Target Station Dropdown Selector */}
                    <div>
                      <label className="text-[10px] font-mono text-[#94A3B8] block mb-1">
                        Earth Ground Target
                      </label>
                      <select
                        value={selectedStationId}
                        onChange={(e) => setSelectedStationId(e.target.value)}
                        className="w-full h-8 px-2.5 bg-[#0C0D12] border border-[#1E2028] focus:border-white/40 rounded-xl text-xs font-mono text-white focus:outline-none"
                      >
                        <option value="">Combined NASA DSN Network (Goldstone + Madrid + Canberra)</option>
                        {EARTH_COMMUNICATION_SITES.map((st) => (
                          <option key={st.id} value={st.id}>
                            {st.name} ({st.country})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs font-mono pt-1">
                      <div>
                        <span className="text-[10px] text-[#94A3B8] block">Network Mode</span>
                        <span className="font-bold text-[#F8FAFC] truncate block">
                          {activeStation ? activeStation.name : 'Combined Global DSN'}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-[#94A3B8] block">RF Elevation Margin</span>
                        <span className="font-bold text-[#F8FAFC]">
                          {activeStation
                            ? `${stationLink.marginDeg >= 0 ? '+' : ''}${stationLink.marginDeg.toFixed(1)}°`
                            : `${dsnLinksInstant.bestMarginDeg >= 0 ? '+' : ''}${dsnLinksInstant.bestMarginDeg.toFixed(1)}°`}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* 3. Terrain Horizon & Sun System Analysis */}
              {feature.body !== 'earth' && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#F8FAFC] flex items-center gap-2">
                      <Sun className="w-4 h-4 text-[#F8FAFC]" />
                      <span>360° Terrain Horizon &amp; Sun Ephemeris</span>
                    </span>
                    <span className="text-[10px] font-mono text-[#94A3B8]">
                      NASA LOLA Altimetry Dataset
                    </span>
                  </div>
                  <HorizonViewCard
                    siteId={featureId}
                    latitude={featLat}
                    longitude={featLon}
                    moonFeature={{ id: featureId, latitude: featLat, longitude: featLon }}
                    earthFeature={activeStation}
                  />
                </div>
              )}

              {/* 4. Coordinates & Region Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3.5 rounded-2xl bg-[#050507] border border-[#1E2028] space-y-0.5">
                  <span className="text-[10px] font-mono text-[#94A3B8] block">Latitude</span>
                  <div className="font-mono text-base font-bold text-[#F8FAFC]">
                    {featLat >= 0 ? `${featLat.toFixed(4)}°N` : `${Math.abs(featLat).toFixed(4)}°S`}
                  </div>
                  <span className="text-[9.5px] font-mono text-[#F8FAFC]">{latStr}</span>
                </div>

                <div className="p-3.5 rounded-2xl bg-[#050507] border border-[#1E2028] space-y-0.5">
                  <span className="text-[10px] font-mono text-[#94A3B8] block">Longitude</span>
                  <div className="font-mono text-base font-bold text-[#F8FAFC]">
                    {featLon >= 0 ? `${featLon.toFixed(4)}°E` : `${Math.abs(featLon).toFixed(4)}°W`}
                  </div>
                  <span className="text-[9.5px] font-mono text-[#34D399]">{lonStr}</span>
                </div>

                <div className="p-3.5 rounded-2xl bg-[#050507] border border-[#1E2028] space-y-0.5">
                  <span className="text-[10px] font-mono text-[#94A3B8] block">Hemisphere / Face</span>
                  <div className="text-xs font-medium text-[#F8FAFC] truncate">
                    {regionInfo?.face || 'Nearside'}
                  </div>
                  <span className="text-[9.5px] text-[#94A3B8] truncate block">
                    {regionInfo?.quadrant || 'Southern Rim'}
                  </span>
                </div>

                <div className="p-3.5 rounded-2xl bg-[#050507] border border-[#1E2028] space-y-0.5">
                  <span className="text-[10px] font-mono text-[#94A3B8] block">1-Way Light Delay</span>
                  <div className="font-mono text-base font-bold text-[#34D399]">
                    {lightTravelSec} s
                  </div>
                  <span className="text-[9.5px] font-mono text-[#94A3B8]">
                    {Math.round(state.earth.distanceKm).toLocaleString()} km
                  </span>
                </div>
              </div>

              {/* Nearest cataloged lunar landmark */}
              {feature.nearestFeature && (
                <div className="p-3.5 rounded-2xl bg-[#050507] border border-[#1E2028] flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <Compass className="w-4 h-4 text-[#F8FAFC]" />
                    <span className="text-[#94A3B8]">
                      Nearest Landmark:{' '}
                      <strong className="text-[#F8FAFC]">{feature.nearestFeature}</strong>
                    </span>
                  </div>
                  {feature.nearestFeatureDistanceKm != null && (
                    <span className="font-mono text-[#34D399]">
                      {feature.nearestFeatureDistanceKm} km away
                    </span>
                  )}
                </div>
              )}

              {/* Mission Details (If CLPS / Apollo) */}
              {isClps && clpsData && (
                <div className="p-4 rounded-2xl bg-[#050507] border border-[#1E2028] space-y-3">
                  <span className="text-xs font-semibold text-[#F8FAFC] flex items-center gap-2">
                    <Rocket className="w-3.5 h-3.5 text-[#F8FAFC]" />
                    <span>Flight Architecture &amp; Provider</span>
                  </span>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div>
                      <span className="text-[10px] text-[#94A3B8] block font-mono">Provider</span>
                      <span className="font-medium text-[#F8FAFC]">{clpsData.provider}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-[#94A3B8] block font-mono">Lander Vehicle</span>
                      <span className="font-medium text-[#F8FAFC]">{clpsData.lander}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-[#94A3B8] block font-mono">Launch Date</span>
                      <span className="font-mono text-[#F8FAFC]">{clpsData.launchDate}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-[#94A3B8] block font-mono">Launch Vehicle</span>
                      <span className="font-medium text-[#34D399]">{clpsData.launchVehicle || 'Falcon 9'}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Description & Science Objectives */}
              {(clpsData?.objectives || feature.description) && (
                <div className="p-4 rounded-2xl bg-[#050507] border border-[#1E2028] space-y-1.5">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-[#94A3B8]">
                    Scientific Context &amp; Objectives
                  </span>
                  <p className="text-xs text-[#94A3B8] leading-relaxed">
                    {clpsData?.objectives || feature.description}
                  </p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'horizon' && feature.body !== 'earth' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-[#050507] border border-[#1E2028] space-y-1.5">
                <h3 className="text-sm font-bold text-[#F8FAFC] flex items-center gap-2">
                  <Sun className="w-4 h-4 text-[#F8FAFC]" />
                  <span>360° Local Terrain Horizon Profile &amp; Solar Ephemeris</span>
                </h3>
                <p className="text-xs text-[#94A3B8] leading-relaxed">
                  Calculated from high-resolution NASA LOLA laser altimetry digital elevation models. Displays 360° horizon elevation angles, Sun and Earth positions, terrain masking thresholds, and sunrise/sunset transition countdowns.
                </p>
              </div>

              <HorizonViewCard
                siteId={featureId}
                latitude={featLat}
                longitude={featLon}
                moonFeature={{ id: featureId, latitude: featLat, longitude: featLon }}
                earthFeature={activeStation}
              />
            </div>
          )}

          {activeTab === 'payloads' && (
            <div className="space-y-3">
              {payloadsList.map((payload, idx) => {
                const pName = typeof payload === 'string' ? payload : payload.name;
                const pFull = typeof payload === 'object' ? payload.fullName : '';
                const pAgency = typeof payload === 'object' ? payload.agency : '';
                const pPurpose = typeof payload === 'object' ? payload.purpose : '';

                return (
                  <div key={idx} className="p-4 rounded-2xl bg-[#050507] border border-[#1E2028] space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold text-sm text-[#F8FAFC]">{pName}</span>
                      {pAgency && (
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#14161D] text-[#94A3B8]">
                          {pAgency}
                        </span>
                      )}
                    </div>
                    {pFull && <div className="text-xs font-semibold text-[#F8FAFC]">{pFull}</div>}
                    {pPurpose && <p className="text-xs text-[#94A3B8] leading-relaxed">{pPurpose}</p>}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Action Buttons Footer */}
        <div className="px-6 py-4 border-t border-[#1E2028] bg-[#050507] flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                onClose();
                onZoomHere(featLon, featLat);
              }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white text-[#050507] font-bold text-xs hover:bg-[#E2E8F0] transition-colors shadow-lg active:scale-95"
            >
              <Navigation className="w-3.5 h-3.5" />
              <span>Center on Map</span>
            </button>

            {onCompareMission && feature.body !== 'earth' && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onCompareMission(clpsData || feature);
                }}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#14161D] hover:bg-[#1E2028] text-[#F8FAFC] font-medium text-xs border border-[#1E2028] transition-colors"
              >
                <GitCompare className="w-3.5 h-3.5 text-[#34D399]" />
                <span>Compare Sites</span>
              </button>
            )}
          </div>

          {isCustomPin && onClearCustomPin && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onClearCustomPin(feature.body === 'earth' ? 'earth' : 'moon');
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-rose-950/40 text-rose-300 hover:bg-rose-900/60 text-xs font-medium border border-rose-500/30 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete Pin</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
