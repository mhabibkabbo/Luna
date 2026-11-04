/**
 * @file SiteComparisonPage.jsx
 * Page 5: Dedicated Site Comparison Workspace.
 * Comprehensive side-by-side trade-off analysis of candidate landing sites, launch windows,
 * solar illumination, terrain obstacle clearance, direct-to-Earth communication, and thermal environments.
 */

import React, { useState, useMemo, useEffect } from 'react';
import {
  GitCompare,
  Calendar,
  Lock,
  Unlock,
  Sun,
  Radio,
  Zap,
  Thermometer,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  ArrowRight,
  ExternalLink,
  ChevronRight,
  Sliders,
  Sparkles,
  Copy,
  Check,
  Compass,
  FileText,
  Clock,
  Layers,
} from 'lucide-react';
import { CLPS_MISSIONS } from '../data/clpsMissions.js';
import { LANDING_SITES } from '../data/landingSites.js';
import { computeCelestialState, solarPosition } from '../utils/lunarEphemeris.js';
import { evaluateEarthLink, DEFAULT_DTE_CONSTRAINTS } from '../utils/earthLink.js';
import {
  calculateSolarTransition,
  calculateEarthTransition,
  formatDuration,
} from '../utils/transitionTimes.js';
import {
  horizonAt,
  HORIZON_TABLE,
  getHorizonProfile,
  ensurePolarDemLoaded,
  sampleLunarTerrainMetrics,
} from '../utils/horizons.js';
import { getLunarTemperature } from '../utils/lunarThermal.js';
<<<<<<< Updated upstream
import { celestialTimeStore } from '../utils/celestialTime.js';
=======
import {
  evaluateCandidateForMissionWindow,
  DEFAULT_PLANNER_CONSTRAINTS,
} from '../utils/plannerEngine.js';
import {
  celestialTimeStore,
  normalizeCelestialTimeMs,
} from '../utils/celestialTime.js';
>>>>>>> Stashed changes
import { notifySuccess, notifyInfo } from '../utils/feedbackStore.js';

// Safe number formatter that never throws on undefined/null/NaN
const fmtNum = (val, digits = 2, fallback = '0.00') => {
  return Number.isFinite(val) ? Number(val).toFixed(digits) : fallback;
};

// Curated Landing Site options
const ALL_SITES = LANDING_SITES.map((s) => ({
  id: s.id,
  name: s.name,
  latitude: Number.isFinite(s.latitude) ? s.latitude : Number.isFinite(s.lat) ? s.lat : 0,
  longitude: Number.isFinite(s.longitude) ? s.longitude : Number.isFinite(s.lon) ? s.lon : 0,
  category: s.name.includes('Artemis')
    ? 'Artemis South Pole Candidates'
    : s.type === 'clps-mission'
    ? 'NASA CLPS Missions'
    : s.type === 'landing-site'
    ? 'Apollo Crewed Landings'
    : 'Robotic & International Probes',
  agency: s.agency,
  description: s.description,
  clpsData: s.clpsData || CLPS_MISSIONS.find((m) => m.id === s.id),
}));

// Quick presets
const PRESETS = [
  { label: 'Now (Live)', getMs: () => Date.now() },
  { label: 'Artemis III Target (Sep 2026)', getMs: () => new Date('2026-09-15T12:00:00Z').getTime() },
  { label: 'South Pole Summer (Dec Solstice)', getMs: () => new Date('2026-12-21T00:00:00Z').getTime() },
  { label: 'South Pole Winter (Jun Solstice)', getMs: () => new Date('2026-06-21T00:00:00Z').getTime() },
  { label: '+14 Days (Half Lunation)', getMs: (base) => base + 14 * 86400000 },
  { label: '+28 Days (Full Lunation)', getMs: (base) => base + 28 * 86400000 },
];

export default function SiteComparisonPage({
  siteA,
  siteB,
  onSelectSiteA,
  onSelectSiteB,
  onNavigate,
  onSelectSiteForView,
}) {
  const [activeTab, setActiveTab] = useState('sites'); // 'sites' | 'quad' | 'dates'
  const [copied, setCopied] = useState(false);
  const [siteCId, setSiteCId] = useState(() => ALL_SITES[2]?.id || ALL_SITES[0]?.id);
  const [siteDId, setSiteDId] = useState(() => ALL_SITES[3]?.id || ALL_SITES[1]?.id);

  // Helper to safely resolve candidate to a Moon landing site with valid coordinates
  const resolveSite = (candidate, fallbackIndex) => {
    const fallback = ALL_SITES[fallbackIndex] || ALL_SITES[0];
    if (!candidate) return fallback;
    const found = ALL_SITES.find(
      (s) => s.id === candidate.id || s.id === candidate.landingSiteId
    );
    if (found) return found;
    const lat = candidate.latitude ?? candidate.lat ?? candidate.landingSite?.lat;
    const lon = candidate.longitude ?? candidate.lon ?? candidate.landingSite?.lon;
    if (Number.isFinite(lat) && Number.isFinite(lon)) {
      return {
        id: candidate.id || `custom-site-${fallbackIndex}`,
        name: candidate.name || candidate.missionName || `Site ${fallbackIndex === 0 ? 'A' : 'B'}`,
        latitude: lat,
        longitude: lon,
        elevationM: candidate.elevationM ?? 0,
        agency: candidate.agency || 'NASA',
        category: 'Custom Candidate',
      };
    }
    return fallback;
  };

  // Candidate A & B selections
  const currentSiteA = useMemo(() => resolveSite(siteA, 0), [siteA]);
  const currentSiteB = useMemo(() => resolveSite(siteB, 1), [siteB]);

  // Dates
  const [timeA, setTimeA] = useState(() => celestialTimeStore.get().ms);
  const [timeB, setTimeB] = useState(() => celestialTimeStore.get().ms);
  const [datesLocked, setDatesLocked] = useState(true);

  // Sync dates when locked
  const handleTimeAChange = (newMs) => {
    setTimeA(newMs);
    if (datesLocked) setTimeB(newMs);
  };

  const applyPreset = (preset) => {
    const nextMs = preset.getMs(timeA);
    setTimeA(nextMs);
    if (datesLocked || activeTab === 'sites') {
      setTimeB(nextMs);
    }
    notifyInfo(`Applied epoch preset: ${preset.label}`);
  };

  const [demLoadedTick, setDemLoadedTick] = useState(0);
  useEffect(() => {
    ensurePolarDemLoaded()
      .then((grid) => {
        if (grid) setDemLoadedTick((t) => t + 1);
      })
      .catch(() => {});
  }, []);

  // Evaluate candidate site metrics
  const evaluateCandidate = (site, timeMs) => {
    if (!site) return null;
    try {
      const lat = site.latitude ?? site.lat ?? 0;
      const lon = site.longitude ?? site.lon ?? 0;
      const terrainMetrics = sampleLunarTerrainMetrics(lat, lon, site);
      const normalizedSite = {
        ...site,
        latitude: lat,
        longitude: lon,
        slopeDeg: terrainMetrics?.slopeDeg ?? null,
        elevationM: terrainMetrics?.elevationM ?? null,
        roughnessM: terrainMetrics?.roughnessM ?? null,
      };

      const state = computeCelestialState(timeMs);

      const flat = solarPosition(state, lat, lon);
      const terrainHorizonDeg = horizonAt(HORIZON_TABLE, site.id, flat.azimuthDeg, lat, lon) ?? 0;
      const sun = solarPosition(state, lat, lon, terrainHorizonDeg);

      const solarTransition = calculateSolarTransition(timeMs, lat, lon, site.id);
      const earthTransition = calculateEarthTransition(timeMs, normalizedSite);

      const dte = evaluateEarthLink({
        state,
        moonFeature: normalizedSite,
        constraints: DEFAULT_DTE_CONSTRAINTS,
        terrainFn: (az) => horizonAt(HORIZON_TABLE, site.id, az, lat, lon) ?? 0,
      });

      const thermal = getLunarTemperature(lat, lon, new Date(timeMs), {
        terrainHorizonDeg,
        elevationM: terrainMetrics?.elevationM ?? null,
      });

      const clearance = sun.elevationDeg - terrainHorizonDeg;
      const isSunlit = sun.elevationDeg > 0 && clearance > 0 && !thermal.isPSR;
      const powerPotential = isSunlit
        ? solarTransition?.powerEfficiencyPct ?? Math.round(Math.max(0, Math.sin((sun.elevationDeg * Math.PI) / 180)) * 100)
        : 0;

      // Unified deterministic operational suitability score (0 - 100)
      const unifiedEval = evaluateCandidateForMissionWindow(normalizedSite, {
        ...DEFAULT_PLANNER_CONSTRAINTS,
        landingTimeMs: timeMs,
        missionDurationDays: 14,
      });
      const score = unifiedEval?.overallScore ?? 50;

      return {
        site: normalizedSite,
        timeMs,
        sun,
        terrainHorizonDeg,
        clearance,
        isSunlit,
        powerPotential,
        solarTransition,
        earthTransition,
        dte,
        thermal,
        terrainMetrics,
        score,
        formulaString: unifiedEval?.formulaString,
        isPartialScore: unifiedEval?.isPartialScore,
      };
    } catch (err) {
      console.error('Failed to evaluate candidate:', err);
      return null;
    }
  };

  const currentSiteC = useMemo(
    () => ALL_SITES.find((s) => s.id === siteCId) || ALL_SITES[2] || ALL_SITES[0],
    [siteCId]
  );
  const currentSiteD = useMemo(
    () => ALL_SITES.find((s) => s.id === siteDId) || ALL_SITES[3] || ALL_SITES[1],
    [siteDId]
  );

  const evalA = useMemo(() => evaluateCandidate(currentSiteA, timeA), [currentSiteA, timeA, demLoadedTick]);
  const evalB = useMemo(
    () => evaluateCandidate(activeTab === 'dates' ? currentSiteA : currentSiteB, timeB),
    [activeTab, currentSiteA, currentSiteB, timeB, demLoadedTick]
  );
  const evalC = useMemo(() => evaluateCandidate(currentSiteC, timeA), [currentSiteC, timeA, demLoadedTick]);
  const evalD = useMemo(() => evaluateCandidate(currentSiteD, timeA), [currentSiteD, timeA, demLoadedTick]);

  // Automated scientific trade-off verdict
  const verdict = useMemo(() => {
    if (!evalA || !evalB) return null;
    if (evalA.score > evalB.score + 10) {
      return {
        winner: 'A',
        title: `${evalA.site.name} displays superior operational conditions`,
        rationale: `Better solar illumination angle (+${Math.max(0, evalA.powerPotential - evalB.powerPotential)}% power) and more robust direct line of sight to Earth.`,
      };
    } else if (evalB.score > evalA.score + 10) {
      return {
        winner: 'B',
        title: `${evalB.site.name} presents lower operational risk`,
        rationale: `Clearer DTE communications link (+${(evalB.dte?.marginDeg ?? 0) - (evalA.dte?.marginDeg ?? 0)}° margin) and preferable thermal range.`,
      };
    }
    return {
      winner: 'tie',
      title: 'Balanced Trade-off Between Candidates',
      rationale: 'Both sites demonstrate comparable operational viability with differing science opportunities and terrain constraints.',
    };
  }, [evalA, evalB]);

  const copyBriefing = () => {
    if (!evalA || !evalB) return;
    const text = `LUNA MISSION TRADE STUDY REPORT
==============================
Date Generated: ${new Date().toUTCString()}
Evaluation Preset: ${new Date(timeA).toISOString()}

SCENARIO A: ${evalA.site?.name || 'Site A'} (${fmtNum(evalA.site?.latitude, 2)}°, ${fmtNum(evalA.site?.longitude, 2)}°)
- Sun Elevation: ${fmtNum(evalA.sun?.elevationDeg, 2)}° (Clearance: ${fmtNum(evalA.clearance, 2)}°)
- Illumination State: ${evalA.isSunlit ? 'SUNLIT' : 'OCCULTED / SHADOWED'} (Power: ${evalA.powerPotential ?? 0}%)
- DTE Link: ${(evalA.dte?.status ?? 'N/A').toUpperCase()} (Elevation: ${fmtNum(evalA.dte?.elevationDeg, 2)}°, Margin: ${fmtNum(evalA.dte?.marginDeg, 2)}°)
- Surface Temp: ${fmtNum(evalA.thermal?.surfaceTempC, 0)}°C
- Suitability Score: ${evalA.score ?? 50}/100

SCENARIO B: ${evalB.site?.name || 'Site B'} (${fmtNum(evalB.site?.latitude, 2)}°, ${fmtNum(evalB.site?.longitude, 2)}°)
- Sun Elevation: ${fmtNum(evalB.sun?.elevationDeg, 2)}° (Clearance: ${fmtNum(evalB.clearance, 2)}°)
- Illumination State: ${evalB.isSunlit ? 'SUNLIT' : 'OCCULTED / SHADOWED'} (Power: ${evalB.powerPotential ?? 0}%)
- DTE Link: ${(evalB.dte?.status ?? 'N/A').toUpperCase()} (Elevation: ${fmtNum(evalB.dte?.elevationDeg, 2)}°, Margin: ${fmtNum(evalB.dte?.marginDeg, 2)}°)
- Surface Temp: ${fmtNum(evalB.thermal?.surfaceTempC, 0)}°C
- Suitability Score: ${evalB.score ?? 50}/100

VERDICT: ${verdict?.title || 'Evaluated'}
${verdict?.rationale || ''}
`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    notifySuccess('Mission trade study report copied to clipboard');
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="flex-1 overflow-y-auto bg-[#07090e] text-slate-100 p-4 md:p-8 space-y-6">
      {/* Workspace Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 border-b border-slate-800/80 pb-5">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono tracking-widest text-cyan-400 uppercase">
            <GitCompare className="w-4 h-4 text-cyan-400" />
            <span>Workspace 05 · Landing Site & Trajectory Comparison</span>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-white mt-1">
            Candidate Trade-Off Matrix & Schedule Shift Analysis
          </h1>
          <p className="text-xs text-slate-400 mt-1 max-w-3xl">
            Simultaneously evaluate two landing zones or compare one target across schedule slip dates to optimize solar power, line of sight, and mission safety.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-3">
          <button
            onClick={copyBriefing}
            className="px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-700 hover:border-slate-600 text-xs font-medium text-slate-200 flex items-center gap-2 transition"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-slate-400" />}
            {copied ? 'Copied Report' : 'Copy Trade Study'}
          </button>

          <button
            onClick={() => onNavigate && onNavigate('briefing')}
            className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-xs font-bold text-white flex items-center gap-2 shadow-lg shadow-cyan-950/60 transition active:scale-98"
          >
            <FileText className="w-4 h-4" />
            Generate Briefing Dossier
          </button>
        </div>
      </div>

      {/* Mode Switcher & Presets */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-xl bg-slate-900/60 border border-slate-800/80">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('sites')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-2 ${
              activeTab === 'sites'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Compass className="w-3.5 h-3.5" />
            Compare 2 Landing Sites
          </button>
          <button
            onClick={() => setActiveTab('quad')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-2 ${
              activeTab === 'quad'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            Compare 4 Candidate Sites
          </button>
          <button
            onClick={() => {
              setActiveTab('dates');
              setDatesLocked(false);
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-2 ${
              activeTab === 'dates'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            Compare 2 Dates (Schedule Shift)
          </button>
        </div>

        {/* Quick Presets */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0">
          <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500 whitespace-nowrap">
            Presets:
          </span>
          {PRESETS.map((p) => (
            <button
              key={p.label}
              onClick={() => applyPreset(p)}
              className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 text-[11px] font-mono text-slate-300 whitespace-nowrap transition"
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Automated Verdict Banner */}
      {verdict && (
        <div className="p-4 rounded-xl bg-gradient-to-r from-cyan-950/40 via-slate-900/60 to-purple-950/40 border border-cyan-800/40 flex items-start gap-3">
          <div className="p-2 rounded-lg bg-cyan-900/40 text-cyan-400 border border-cyan-700/50 mt-0.5">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <span className="text-[10px] font-mono uppercase tracking-wider text-cyan-400">
              Automated Mission Trade Verdict
            </span>
            <h3 className="text-sm font-bold text-white mt-0.5">{verdict.title}</h3>
            <p className="text-xs text-slate-300 mt-1">{verdict.rationale}</p>
          </div>
        </div>
      )}

      {/* Side-by-Side Comparison Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Candidate A Card */}
        <div className="p-6 rounded-2xl bg-[#0c1017] border border-cyan-500/30 space-y-6 relative overflow-hidden">
          <div className="flex items-start justify-between gap-4 border-b border-slate-800 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-cyan-400" />
                <span className="text-[10px] font-mono uppercase tracking-wider text-cyan-400 font-bold">
                  Candidate Scenario A
                </span>
              </div>
              <h2 className="text-xl font-bold text-white mt-1">{currentSiteA.name}</h2>
              <p className="text-xs font-mono text-slate-400 mt-0.5">
                {(currentSiteA?.latitude ?? 0) >= 0 ? `${fmtNum(currentSiteA?.latitude, 2)}°N` : `${fmtNum(Math.abs(currentSiteA?.latitude ?? 0), 2)}°S`},{' '}
                {(currentSiteA?.longitude ?? 0) >= 0 ? `${fmtNum(currentSiteA?.longitude, 2)}°E` : `${fmtNum(Math.abs(currentSiteA?.longitude ?? 0), 2)}°W`}
              </p>
            </div>

            {/* Site A Selector */}
            <select
              value={currentSiteA.id}
              onChange={(e) => {
                const s = ALL_SITES.find((item) => item.id === e.target.value);
                if (s && onSelectSiteA) onSelectSiteA(s);
              }}
              className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs font-medium text-slate-200 focus:outline-none focus:border-cyan-500 max-w-[200px]"
            >
              {ALL_SITES.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          {/* Time Setting A */}
          <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between text-xs font-mono">
            <span className="text-slate-400 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-cyan-400" />
              Epoch:
            </span>
            <span className="text-white font-bold">{new Date(timeA).toUTCString()}</span>
          </div>

          {/* Primary Metrics Grid */}
          <div className="grid grid-cols-2 gap-3 font-mono">
            {/* Illumination & Power */}
            <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-800 space-y-1">
              <span className="text-[10px] text-slate-400 uppercase flex items-center gap-1.5">
                <Sun className="w-3.5 h-3.5 text-amber-400" />
                Solar Power
              </span>
              <p className="text-xl font-black text-amber-300">{evalA?.powerPotential ?? 0}%</p>
              <p className="text-[11px] text-slate-400">
                El: {fmtNum(evalA?.sun?.elevationDeg, 2)}° · Clr: {fmtNum(evalA?.clearance, 2)}°
              </p>
            </div>

            {/* DTE Link */}
            <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-800 space-y-1">
              <span className="text-[10px] text-slate-400 uppercase flex items-center gap-1.5">
                <Radio className="w-3.5 h-3.5 text-cyan-400" />
                DTE Link
              </span>
              <p
                className={`text-xl font-black uppercase ${
                  evalA?.dte?.status === 'clear'
                    ? 'text-emerald-400'
                    : evalA?.dte?.status === 'doubtful'
                    ? 'text-amber-400'
                    : 'text-rose-400'
                }`}
              >
                {evalA?.dte?.status ?? 'N/A'}
              </p>
              <p className="text-[11px] text-slate-400">
                El: {fmtNum(evalA?.dte?.elevationDeg, 1)}° · Mgn: {fmtNum(evalA?.dte?.marginDeg, 1)}°
              </p>
            </div>

            {/* Thermal State */}
            <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-800 space-y-1">
              <span className="text-[10px] text-slate-400 uppercase flex items-center gap-1.5">
                <Thermometer className="w-3.5 h-3.5 text-rose-400" />
                Diviner Temp
              </span>
              <p className="text-xl font-black text-white">{fmtNum(evalA?.thermal?.surfaceTempC, 0)}°C</p>
              <p className="text-[11px] text-slate-400">
                Subsurface: {fmtNum(evalA?.thermal?.subsurfaceTempC, 0)}°C
              </p>
            </div>

            {/* Suitability Score */}
            <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-800 space-y-1">
              <span className="text-[10px] text-slate-400 uppercase flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                Viability Index
              </span>
              <p className="text-xl font-black text-cyan-300">{evalA?.score ?? 50}/100</p>
              <p className="text-[11px] text-slate-400">
                {evalA?.score > 70 ? 'Optimal Window' : evalA?.score > 40 ? 'Feasible' : 'Severe Constraints'}
              </p>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex items-center gap-2 pt-2">
            <button
              onClick={() => {
                if (onSelectSiteForView) onSelectSiteForView(currentSiteA);
                if (onNavigate) onNavigate('explorer');
              }}
              className="flex-1 py-2 px-3 rounded-lg bg-cyan-950/60 border border-cyan-600/50 hover:bg-cyan-900/60 text-cyan-300 text-xs font-semibold flex items-center justify-center gap-1.5 transition"
            >
              <Compass className="w-3.5 h-3.5" />
              Fly to Site A
            </button>
            <button
              onClick={() => {
                if (onSelectSiteForView) onSelectSiteForView(currentSiteA);
                if (onNavigate) onNavigate('site-analysis');
              }}
              className="flex-1 py-2 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold flex items-center justify-center gap-1.5 transition"
            >
              <Layers className="w-3.5 h-3.5" />
              Site Analysis
            </button>
          </div>
        </div>

        {/* Candidate B Card */}
        <div className="p-6 rounded-2xl bg-[#0c1017] border border-slate-800 space-y-6 relative overflow-hidden">
          <div className="flex items-start justify-between gap-4 border-b border-slate-800 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-purple-400" />
                <span className="text-[10px] font-mono uppercase tracking-wider text-purple-400 font-bold">
                  {activeTab === 'dates' ? 'Scenario A (Offset Date)' : 'Candidate Scenario B'}
                </span>
              </div>
              <h2 className="text-xl font-bold text-white mt-1">
                {activeTab === 'dates' ? currentSiteA?.name : currentSiteB?.name}
              </h2>
              <p className="text-xs font-mono text-slate-400 mt-0.5">
                {activeTab === 'dates'
                  ? `${fmtNum(currentSiteA?.latitude, 2)}°, ${fmtNum(currentSiteA?.longitude, 2)}°`
                  : `${fmtNum(currentSiteB?.latitude, 2)}°, ${fmtNum(currentSiteB?.longitude, 2)}°`}
              </p>
            </div>

            {/* Site B Selector (only in 'sites' mode) */}
            {activeTab === 'sites' ? (
              <select
                value={currentSiteB?.id || ''}
                onChange={(e) => {
                  const s = ALL_SITES.find((item) => item.id === e.target.value);
                  if (s && onSelectSiteB) onSelectSiteB(s);
                }}
                className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs font-medium text-slate-200 focus:outline-none focus:border-purple-500 max-w-[200px]"
              >
                {ALL_SITES.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            ) : (
              <span className="text-[11px] font-mono text-purple-400 bg-purple-950/50 border border-purple-800/60 px-2.5 py-1 rounded-md">
                Schedule Slip Mode
              </span>
            )}
          </div>

          {/* Time Setting B */}
          <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between text-xs font-mono">
            <span className="text-slate-400 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-purple-400" />
              Epoch:
            </span>
            <div className="flex items-center gap-2">
              <span className="text-white font-bold">{new Date(timeB).toUTCString()}</span>
              {activeTab === 'dates' && (
                <button
                  onClick={() => setTimeB(timeB + 14 * 86400000)}
                  className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 text-[10px] text-purple-300"
                >
                  +14d
                </button>
              )}
            </div>
          </div>

          {/* Primary Metrics Grid */}
          <div className="grid grid-cols-2 gap-3 font-mono">
            {/* Illumination & Power */}
            <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-800 space-y-1">
              <span className="text-[10px] text-slate-400 uppercase flex items-center gap-1.5">
                <Sun className="w-3.5 h-3.5 text-amber-400" />
                Solar Power
              </span>
              <p className="text-xl font-black text-amber-300">{evalB?.powerPotential ?? 0}%</p>
              <p className="text-[11px] text-slate-400">
                El: {fmtNum(evalB?.sun?.elevationDeg, 2)}° · Clr: {fmtNum(evalB?.clearance, 2)}°
              </p>
            </div>

            {/* DTE Link */}
            <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-800 space-y-1">
              <span className="text-[10px] text-slate-400 uppercase flex items-center gap-1.5">
                <Radio className="w-3.5 h-3.5 text-purple-400" />
                DTE Link
              </span>
              <p
                className={`text-xl font-black uppercase ${
                  evalB?.dte?.status === 'clear'
                    ? 'text-emerald-400'
                    : evalB?.dte?.status === 'doubtful'
                    ? 'text-amber-400'
                    : 'text-rose-400'
                }`}
              >
                {evalB?.dte?.status ?? 'N/A'}
              </p>
              <p className="text-[11px] text-slate-400">
                El: {fmtNum(evalB?.dte?.elevationDeg, 1)}° · Mgn: {fmtNum(evalB?.dte?.marginDeg, 1)}°
              </p>
            </div>

            {/* Thermal State */}
            <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-800 space-y-1">
              <span className="text-[10px] text-slate-400 uppercase flex items-center gap-1.5">
                <Thermometer className="w-3.5 h-3.5 text-rose-400" />
                Diviner Temp
              </span>
              <p className="text-xl font-black text-white">{fmtNum(evalB?.thermal?.surfaceTempC, 0)}°C</p>
              <p className="text-[11px] text-slate-400">
                Subsurface: {fmtNum(evalB?.thermal?.subsurfaceTempC, 0)}°C
              </p>
            </div>

            {/* Suitability Score */}
            <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-800 space-y-1">
              <span className="text-[10px] text-slate-400 uppercase flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                Viability Index
              </span>
              <p className="text-xl font-black text-purple-300">{evalB?.score ?? 50}/100</p>
              <p className="text-[11px] text-slate-400">
                {evalB?.score > 70 ? 'Optimal Window' : evalB?.score > 40 ? 'Feasible' : 'Severe Constraints'}
              </p>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex items-center gap-2 pt-2">
            <button
              onClick={() => {
                const target = activeTab === 'dates' ? currentSiteA : currentSiteB;
                if (onSelectSiteForView) onSelectSiteForView(target);
                if (onNavigate) onNavigate('explorer');
              }}
              className="flex-1 py-2 px-3 rounded-lg bg-purple-950/60 border border-purple-600/50 hover:bg-purple-900/60 text-purple-300 text-xs font-semibold flex items-center justify-center gap-1.5 transition"
            >
              <Compass className="w-3.5 h-3.5" />
              Fly to Site B
            </button>
            <button
              onClick={() => {
                const target = activeTab === 'dates' ? currentSiteA : currentSiteB;
                if (onSelectSiteForView) onSelectSiteForView(target);
                if (onNavigate) onNavigate('site-analysis');
              }}
              className="flex-1 py-2 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold flex items-center justify-center gap-1.5 transition"
            >
              <Layers className="w-3.5 h-3.5" />
              Site Analysis
            </button>
          </div>
        </div>
      </div>

      {/* 4-Site Multi-Candidate Trade Matrix (Section 9) */}
      {activeTab === 'quad' && (
        <div className="p-6 rounded-2xl bg-[#0c1017] border border-slate-800 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
            <div>
              <h3 className="text-base font-bold text-white">
                4-Candidate Side-by-Side Comparison Matrix
              </h3>
              <p className="text-xs text-slate-400">
                Simultaneous evaluation of Sites A, B, C, and D across topography, illumination, Earth visibility, and suitability.
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs font-mono">
              <span className="text-slate-400">Site C:</span>
              <select
                value={siteCId}
                onChange={(e) => setSiteCId(e.target.value)}
                className="px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white"
              >
                {ALL_SITES.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
              <span className="text-slate-400 ml-2">Site D:</span>
              <select
                value={siteDId}
                onChange={(e) => setSiteDId(e.target.value)}
                className="px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white"
              >
                {ALL_SITES.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse font-mono text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400">
                  <th className="py-2.5 px-3">Parameter</th>
                  {[
                    { label: 'Site A', ev: evalA },
                    { label: 'Site B', ev: evalB },
                    { label: 'Site C', ev: evalC },
                    { label: 'Site D', ev: evalD },
                  ].map((col) => (
                    <th key={col.label} className="py-2.5 px-3 text-white font-bold">
                      {col.label}: {col.ev?.site?.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-200">
                <tr>
                  <td className="py-2.5 px-3 text-slate-400">Coordinates</td>
                  {[evalA, evalB, evalC, evalD].map((ev, idx) => (
                    <td key={idx} className="py-2.5 px-3">
                      {fmtNum(ev?.site?.latitude, 2)}°, {fmtNum(ev?.site?.longitude, 2)}°
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="py-2.5 px-3 text-slate-400">Solar Elevation / Clearance</td>
                  {[evalA, evalB, evalC, evalD].map((ev, idx) => (
                    <td key={idx} className="py-2.5 px-3 text-amber-300">
                      {fmtNum(ev?.sun?.elevationDeg, 2)}° (Clr {fmtNum(ev?.clearance, 2)}°)
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="py-2.5 px-3 text-slate-400">Solar Power Potential</td>
                  {[evalA, evalB, evalC, evalD].map((ev, idx) => (
                    <td key={idx} className="py-2.5 px-3 font-bold">
                      {ev?.powerPotential ?? 0}% ({ev?.isSunlit ? 'Sunlit' : 'Shadowed'})
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="py-2.5 px-3 text-slate-400">Earth Visibility (DTE)</td>
                  {[evalA, evalB, evalC, evalD].map((ev, idx) => (
                    <td
                      key={idx}
                      className={`py-2.5 px-3 font-bold uppercase ${
                        ev?.dte?.status === 'clear' ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {ev?.dte?.status ?? 'N/A'} ({fmtNum(ev?.dte?.elevationDeg, 1)}° el)
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="py-2.5 px-3 text-slate-400">Diviner Surface Temp</td>
                  {[evalA, evalB, evalC, evalD].map((ev, idx) => (
                    <td key={idx} className="py-2.5 px-3">
                      {fmtNum(ev?.thermal?.surfaceTempC, 0)}°C
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="py-2.5 px-3 text-slate-400">Suitability Classification</td>
                  {[evalA, evalB, evalC, evalD].map((ev, idx) => (
                    <td key={idx} className="py-2.5 px-3 font-bold text-cyan-300">
                      {ev?.score ?? 50}/100 ({ev?.score >= 75 ? 'Favorable' : ev?.score >= 50 ? 'Conditional' : 'Challenging'})
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
