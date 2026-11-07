/**
 * @file LandingPlannerPage.jsx
 * Page 5: Dedicated Landing Window Planner Workspace.
 * Answers: "Where would be the most suitable place to land on the Moon at a particular date and time?"
 * Evaluates candidate landing sites across the entire mission duration, validates mandatory
 * engineering constraints, ranks candidates using transparent criteria, and provides
 * evidence-based scientific justifications.
 */

import React, { useState, useMemo } from 'react';
import {
  CalendarDays,
  Compass,
  Target,
  Sliders,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  ArrowRight,
  Sun,
  Radio,
  Mountain,
  Thermometer,
  Zap,
  Globe2,
  GitCompare,
  FileText,
  Clock,
  Sparkles,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  XCircle,
  Copy,
  ExternalLink,
} from 'lucide-react';
import { PLANNER_CANDIDATES } from '../data/plannerCandidates.js';
import {
  evaluateCandidateForMissionWindow,
  rankLandingCandidates,
  discoverSouthPoleCandidates,
  DEFAULT_PLANNER_CONSTRAINTS,
} from '../utils/plannerEngine.js';
import { ensurePolarDemLoaded } from '../utils/horizons.js';
import {
  celestialTimeStore,
  normalizeCelestialTimeMs,
} from '../utils/celestialTime.js';
import { notifySuccess, notifyInfo, notifyNavigation } from '../utils/feedbackStore.js';
import { comparisonSelectionStore } from '../utils/comparisonEngine.js';

// Preset flight windows
const LUNATION_PRESETS = [
  { label: 'Now (Live UTC)', getMs: () => normalizeCelestialTimeMs(Date.now()) },
  { label: 'Artemis III Window (Mar 15, 2027)', getMs: () => Date.parse('2027-03-15T12:00:00Z') },
  { label: 'South Pole Summer (Dec 21, 2026)', getMs: () => Date.parse('2026-12-21T12:00:00Z') },
  { label: 'South Pole Winter (Jun 21, 2027)', getMs: () => Date.parse('2027-06-21T12:00:00Z') },
  { label: '+14 Days (Half Lunation)', getMs: (base) => base + 14 * 86400000 },
  { label: '+28 Days (Full Lunation)', getMs: (base) => base + 28 * 86400000 },
];

export default function LandingPlannerPage({
  onNavigate,
  onSelectSite,
  onFlyToSite,
}) {
  // 1. Mission Window Parameters
  const [landingMs, setLandingMs] = useState(() =>
    normalizeCelestialTimeMs(Date.now())
  );
  const [selectedRegion, setSelectedRegion] = useState('all'); // 'all' | 'south-pole' | 'equatorial-mare' | 'farside'
  const [durationDays, setDurationDays] = useState(14); // 3, 7, 14, 28, 90

  // 2. Mission Requirements & Engineering Constraints
  const [constraints, setConstraints] = useState(DEFAULT_PLANNER_CONSTRAINTS);
  const [showConstraintsPanel, setShowConstraintsPanel] = useState(false);

  // 3. Filter tab for view ('all' | 'compliant' | 'disqualified' | 'discovered')
  const [viewFilter, setViewFilter] = useState('all');
  const [demReadyTick, setDemReadyTick] = useState(0);

  React.useEffect(() => {
    ensurePolarDemLoaded()
      .then((g) => {
        if (g) setDemReadyTick((t) => t + 1);
      })
      .catch(() => {});
  }, []);

  // Format date for datetime-local input
  const dateInputVal = useMemo(() => {
    try {
      return new Date(landingMs).toISOString().slice(0, 16);
    } catch {
      return new Date().toISOString().slice(0, 16);
    }
  }, [landingMs]);

  const handleDateChange = (e) => {
    const val = e.target.value;
    const ms = Date.parse(`${val}:00Z`);
    if (!Number.isNaN(ms)) {
      celestialTimeStore.setMs(ms);
      setLandingMs(celestialTimeStore.setTime(ms));

    }
  };

  const applyPreset = (preset) => {
    const nextMs = preset.getMs(landingMs);
    celestialTimeStore.setMs(nextMs);
    setLandingMs(celestialTimeStore.setTime(nextMs));
    notifyInfo(`Applied mission epoch: ${preset.label}`);
  };

  // Filter candidates by region of interest
  const candidatesInRegion = useMemo(() => {
    if (selectedRegion === 'all') return PLANNER_CANDIDATES;
    return PLANNER_CANDIDATES.filter((c) => c.region === selectedRegion);
  }, [selectedRegion]);

  // Evaluate and rank all candidates for the specified window & duration
  const rankedEvaluations = useMemo(() => {
    return rankLandingCandidates(candidatesInRegion, landingMs, durationDays, constraints);
  }, [candidatesInRegion, landingMs, durationDays, constraints, demReadyTick]);

  // Automatic South Pole Candidate Discovery (Section 9)
  const discoveredEvaluations = useMemo(() => {
    if (viewFilter !== 'discovered') return [];
    return discoverSouthPoleCandidates(landingMs, durationDays, constraints);
  }, [viewFilter, landingMs, durationDays, constraints, demReadyTick]);

  // Statistics
  const compliantCount = rankedEvaluations.filter((e) => e.isCompliant).length;
  const disqualifiedCount = rankedEvaluations.length - compliantCount;
  const topCandidate = rankedEvaluations[0];

  // Displayed evaluations based on viewFilter
  const displayedEvaluations = useMemo(() => {
    if (viewFilter === 'discovered') return discoveredEvaluations;
    if (viewFilter === 'compliant') return rankedEvaluations.filter((e) => e.isCompliant);
    if (viewFilter === 'disqualified') return rankedEvaluations.filter((e) => !e.isCompliant);
    return rankedEvaluations;
  }, [rankedEvaluations, discoveredEvaluations, viewFilter]);

  // Copy full structured mission assessment
  const handleCopyAssessment = () => {
    const lines = [
      `# LUNA · Optimal Landing Window & Candidate Selection Assessment`,
      `Generated: ${new Date().toUTCString()}`,
      `Mission Touchdown Epoch: ${new Date(landingMs).toUTCString()} (UTC)`,
      `Mission Duration: ${durationDays} Earth Days (${durationDays * 24} hours)`,
      `Target Region: ${selectedRegion.toUpperCase()}`,
      ``,
      `## Configured Mission Constraints:`,
      `- Minimum Continuous Daylight: ${constraints.minSunlitHours} hours`,
      `- Maximum Allowable Terrain Slope: ${constraints.maxSlopeDeg}°`,
      `- Direct-to-Earth Link: ${constraints.requireDTE ? 'Mandatory' : 'Relay Acceptable'}`,
      `- Minimum Surface Temperature: ${constraints.minTempC}°C`,
      `- Approach Solar Elevation: ≥ ${constraints.minSolarElevAtTouchdown}°`,
      ``,
      `## Summary Findings:`,
      `- Total Candidates Evaluated: ${rankedEvaluations.length}`,
      `- Fully Compliant Sites: ${compliantCount}`,
      `- Disqualified (Violations): ${disqualifiedCount}`,
      `- Primary Recommended Target: ${topCandidate?.candidate.name || 'None'} (Score: ${topCandidate?.overallScore || 0}/100)`,
      ``,
      `## Top Recommended Sites:`,
    ];

    rankedEvaluations.slice(0, 5).forEach((evalItem, idx) => {
      const c = evalItem.candidate;
      const elevStr =
        c.elevationM !== null && Number.isFinite(c.elevationM)
          ? `${c.elevationM >= 0 ? '+' : ''}${c.elevationM}m (Measured LOLA DEM)`
          : 'Not present in loaded dataset';
      const slopeStr =
        c.slopeDeg !== null && Number.isFinite(c.slopeDeg)
          ? `${c.slopeDeg.toFixed(1)}° (Calculated Horn 3×3 on LOLA DEM)`
          : 'Not present in loaded dataset';
      lines.push(`### ${idx + 1}. ${c.name} [${evalItem.tierLabel} - Score: ${evalItem.overallScore}/100]`);
      lines.push(`- Coordinates: ${c.lat.toFixed(2)}°, ${c.lon.toFixed(2)}° (Elevation: ${elevStr}, Slope: ${slopeStr})`);
      lines.push(`- Touchdown: Sun ${evalItem.touchdown.sunElevationDeg.toFixed(1)}° (${evalItem.touchdown.isSunlit ? 'Sunlit' : 'Shadow'}), Surface Temp: ${evalItem.touchdown.surfaceTempC}°C (Calculated), DTE: ${evalItem.touchdown.isDteLinked ? 'Clear LOS' : 'Blocked'}`);
      lines.push(`- Duration Outlook: ${evalItem.durationOutlook.sunlitRatio}% daylight (${evalItem.durationOutlook.longestSunlitHours}h continuous), DTE Uptime: ${evalItem.durationOutlook.dteUptimeRatio}%, Temp Range: ${evalItem.durationOutlook.minSurfaceTempC}°C to ${evalItem.durationOutlook.maxSurfaceTempC}°C (Calculated)`);
      if (evalItem.scientificRationale.reasonsWhy.length > 0) {
        lines.push(`- Key Strengths: ${evalItem.scientificRationale.reasonsWhy.join('; ')}`);
      }
      if (evalItem.scientificRationale.operationalRisks.length > 0) {
        lines.push(`- Operational Risks: ${evalItem.scientificRationale.operationalRisks.join('; ')}`);
      }
      if (evalItem.violations.length > 0) {
        lines.push(`- Constraints Violated: ${evalItem.violations.map((v) => v.detail).join(' | ')}`);
      }
      lines.push(``);
    });

    if (navigator.clipboard) {
      navigator.clipboard.writeText(lines.join('\n'));
      notifySuccess('Mission Assessment copied to clipboard', 'Ready for flight review & briefing dossier.');
    }
  };

  const handleInspect3D = (site) => {
    if (onSelectSite) onSelectSite(site);
    if (onFlyToSite) {
      onFlyToSite(site);
    } else {
      notifyNavigation(`Flying 3D Viewport to ${site.name}`, `${site.lat}°, ${site.lon}°`);
      onNavigate('explorer');
    }
  };

  const handleCompareSite = (site) => {
    comparisonSelectionStore.addLocationFromMap(site);
    if (onSelectSite) onSelectSite(site);
    onNavigate('comparison');
  };

  return (
    <div className="flex-1 overflow-y-auto px-5 sm:px-8 lg:px-10 py-7 max-w-[1380px] mx-auto w-full space-y-6 animate-in fade-in duration-200">
      {/* 1. Header & Executive Overview */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 border-b border-[#1E2028] pb-5">
        <div>
          <div className="flex items-center gap-2 text-[11px] font-sans font-semibold tracking-[0.14em] text-[#8E95A5] uppercase">
            <Target className="w-3.5 h-3.5 text-[#F8FAFC]" />
            <span>Workspace 03 · Landing Window &amp; Candidate Planner</span>
          </div>
          <h1 className="text-2xl sm:text-[26px] font-display font-semibold tracking-tight text-white mt-1.5">
            Optimal Lunar Landing Site Planner
          </h1>
          <p className="text-[13.5px] font-sans text-[#8E95A5] mt-1 max-w-3xl leading-relaxed">
            Where would be the most suitable place to land on the Moon at a particular date and time?
            Evaluates candidate locations throughout your mission duration against terrain slope, solar illumination continuity, Direct-to-Earth line-of-sight, and thermal survivability.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={handleCopyAssessment}
            className="px-4 py-2 rounded-lg bg-[#0C0D12] hover:bg-[#14161D] text-[#F8FAFC] border border-white/[0.12] hover:border-white/[0.22] font-sans font-medium text-[12.5px] transition-all active:scale-95 flex items-center gap-2 shadow-sm"
          >
            <Copy className="w-3.5 h-3.5 text-[#CBD5E1]" />
            <span>Copy Mission Assessment</span>
          </button>
        </div>
      </div>

      {/* 2. Primary Mission Configuration Console */}
      <div className="p-5 sm:p-6 rounded-2xl bg-[#0A0B0E] border border-white/[0.08] space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Column A: Landing Date & Time */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-sans font-semibold text-[#CBD5E1] uppercase tracking-[0.06em] flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-[#8E95A5]" />
              <span>1. Touchdown Date &amp; Time (UTC)</span>
            </label>
            <input
              type="datetime-local"
              value={dateInputVal}
              onChange={handleDateChange}
              className="w-full h-10 px-3.5 rounded-xl bg-[#050507] border border-white/[0.1] text-white font-mono text-[12.5px] focus:outline-none focus:border-white/35 transition-colors"
            />
            <span className="text-[11px] font-sans text-[#7E8696] block pt-0.5">
              Epoch: <span className="font-mono text-[#94A3B8]">{new Date(landingMs).toUTCString()}</span>
            </span>
          </div>

          {/* Column B: Lunar Region of Interest */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-sans font-semibold text-[#CBD5E1] uppercase tracking-[0.06em] flex items-center gap-1.5">
              <Globe2 className="w-3.5 h-3.5 text-[#8E95A5]" />
              <span>2. Lunar Region of Interest</span>
            </label>
            <select
              value={selectedRegion}
              onChange={(e) => setSelectedRegion(e.target.value)}
              className="w-full h-10 px-3.5 rounded-xl bg-[#050507] border border-white/[0.1] text-white font-sans font-medium text-[12.5px] focus:outline-none focus:border-white/35 transition-colors"
            >
              <option value="all">All Lunar Candidate Regions (Global)</option>
              <option value="south-pole">Lunar South Pole (Artemis Zone, 80°S-90°S)</option>
              <option value="equatorial-mare">Nearside Equatorial &amp; Mare Basins (0°-45°N/S)</option>
              <option value="farside">Lunar Farside (SPA Basin &amp; Deep Basins)</option>
            </select>
            <span className="text-[11px] font-sans text-[#7E8696] block pt-0.5">
              Filtering {candidatesInRegion.length} verified candidate landing sites
            </span>
          </div>

          {/* Column C: Mission Duration */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-sans font-semibold text-[#CBD5E1] uppercase tracking-[0.06em] flex items-center gap-1.5">
              <CalendarDays className="w-3.5 h-3.5 text-[#8E95A5]" />
              <span>3. Planned Surface Duration</span>
            </label>
            <div className="grid grid-cols-4 gap-2">
              {[3, 7, 14, 28].map((days) => (
                <button
                  key={days}
                  type="button"
                  onClick={() => setDurationDays(days)}
                  className={`h-10 rounded-xl text-[12.5px] font-sans transition-all ${
                    durationDays === days
                      ? 'bg-white text-[#050507] font-semibold shadow-sm'
                      : 'bg-[#050507] hover:bg-[#14161D] text-[#94A3B8] hover:text-white border border-white/[0.08] font-medium'
                  }`}
                >
                  {days}d
                </button>
              ))}
            </div>
            <span className="text-[11px] font-sans text-[#7E8696] block pt-0.5">
              Evaluated across {durationDays * 24} hours of continuous lunar operations
            </span>
          </div>
        </div>

        {/* Quick Epoch Presets Strip */}
        <div className="pt-3.5 border-t border-white/[0.08] flex flex-wrap items-center gap-2 text-xs">
          <span className="text-[11px] font-sans font-medium uppercase tracking-[0.06em] text-[#7E8696] mr-1">
            Epoch Presets:
          </span>
          {LUNATION_PRESETS.map((preset, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => applyPreset(preset)}
              className="px-3 py-1.5 rounded-lg bg-[#050507] hover:bg-[#14161D] text-[#CBD5E1] hover:text-white border border-white/[0.08] text-[12px] font-sans font-medium transition-colors"
            >
              {preset.label}
            </button>
          ))}

          <button
            type="button"
            onClick={() => setShowConstraintsPanel((prev) => !prev)}
            className="ml-auto px-3.5 py-1.5 rounded-lg bg-white/[0.05] hover:bg-white/[0.09] text-[#F8FAFC] border border-white/[0.12] text-[12px] font-sans font-medium flex items-center gap-1.5 transition-colors"
          >
            <Sliders className="w-3.5 h-3.5 text-[#CBD5E1]" />
            <span>Configure Constraints ({constraints.requireDTE ? 'DTE Required' : 'Relay Allowed'})</span>
            {showConstraintsPanel ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>

        {/* Expandable Engineering Constraints & Thresholds Configurator */}
        {showConstraintsPanel && (
          <div className="p-4 sm:p-5 rounded-xl bg-[#050507] border border-white/[0.1] space-y-4 animate-in fade-in duration-150 text-xs">
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-2.5">
              <span className="font-sans font-semibold text-white uppercase tracking-[0.06em] text-[11px] flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-[#CBD5E1]" />
                <span>Mandatory Flight Constraints &amp; Filtering Thresholds</span>
              </span>
              <button
                type="button"
                onClick={() => setConstraints(DEFAULT_PLANNER_CONSTRAINTS)}
                className="text-[11.5px] font-sans font-medium text-[#CBD5E1] hover:text-white hover:underline"
              >
                Reset Defaults
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {/* Constraint 1: Min Continuous Daylight */}
              <div className="space-y-1.5">
                <label className="text-[12px] font-sans text-[#CBD5E1] flex items-center justify-between">
                  <span>Min Continuous Sunlit:</span>
                  <span className="font-mono font-semibold text-white">{constraints.minSunlitHours}h</span>
                </label>
                <input
                  type="range"
                  min="24"
                  max="336"
                  step="12"
                  value={constraints.minSunlitHours}
                  onChange={(e) =>
                    setConstraints((prev) => ({ ...prev, minSunlitHours: Number(e.target.value) }))
                  }
                  className="w-full accent-white"
                />
                <span className="text-[11px] font-sans text-[#7E8696] block">Disqualifies sites with shorter daylight windows</span>
              </div>

              {/* Constraint 2: Max Allowable Slope */}
              <div className="space-y-1.5">
                <label className="text-[12px] font-sans text-[#CBD5E1] flex items-center justify-between">
                  <span>Max Terrain Slope:</span>
                  <span className="font-mono font-semibold text-white">{constraints.maxSlopeDeg}°</span>
                </label>
                <input
                  type="range"
                  min="3"
                  max="15"
                  step="1"
                  value={constraints.maxSlopeDeg}
                  onChange={(e) =>
                    setConstraints((prev) => ({ ...prev, maxSlopeDeg: Number(e.target.value) }))
                  }
                  className="w-full accent-white"
                />
                <span className="text-[11px] font-sans text-[#7E8696] block">Lander stability &amp; rollover limit</span>
              </div>

              {/* Constraint 3: Communication Requirement */}
              <div className="space-y-1.5">
                <span className="text-[12px] font-sans text-[#CBD5E1] block mb-1">
                  Telecommunications:
                </span>
                <label className="flex items-center gap-2 text-[#E2E8F0] font-sans cursor-pointer">
                  <input
                    type="checkbox"
                    checked={constraints.requireDTE}
                    onChange={(e) =>
                      setConstraints((prev) => ({ ...prev, requireDTE: e.target.checked }))
                    }
                    className="rounded accent-white w-4 h-4"
                  />
                  <span>Mandatory Direct-to-Earth</span>
                </label>
                <span className="text-[11px] font-sans text-[#7E8696] block">
                  {constraints.requireDTE
                    ? 'Disqualifies farside and occulted polar valleys'
                    : 'Permits farside missions using relay satellites'}
                </span>
              </div>

              {/* Constraint 4: Min Surface Temp */}
              <div className="space-y-1.5">
                <label className="text-[12px] font-sans text-[#CBD5E1] flex items-center justify-between">
                  <span>Min Temperature:</span>
                  <span className="font-mono font-semibold text-white">{constraints.minTempC}°C</span>
                </label>
                <input
                  type="range"
                  min="-240"
                  max="-80"
                  step="10"
                  value={constraints.minTempC}
                  onChange={(e) =>
                    setConstraints((prev) => ({ ...prev, minTempC: Number(e.target.value) }))
                  }
                  className="w-full accent-white"
                />
                <span className="text-[11px] font-sans text-[#7E8696] block">Avionics freeze &amp; mechanism cold-welding</span>
              </div>
            </div>

            {/* Multi-Criteria Suitability Weight Sliders (Section 8 & 10) */}
            <div className="pt-3.5 border-t border-white/[0.08] space-y-2.5">
              <div className="text-[11px] font-sans font-semibold text-[#CBD5E1] uppercase tracking-[0.06em]">
                Transparent Suitability Formula Weights (Normalized to 100%)
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-5">
                {[
                  { key: 'sun', label: 'Solar Illumination Weight' },
                  { key: 'dte', label: 'Earth Visibility (DTE) Weight' },
                  { key: 'slope', label: 'Slope Safety Weight' },
                  { key: 'thermal', label: 'Thermal Stability Weight' },
                ].map((item) => {
                  const rawW = constraints.weights?.[item.key] ?? 0.25;
                  return (
                    <div key={item.key} className="space-y-1.5">
                      <label className="text-[12px] font-sans text-[#CBD5E1] flex items-center justify-between">
                        <span>{item.label}:</span>
                        <span className="font-mono font-semibold text-white">{Math.round(rawW * 100)}%</span>
                      </label>
                      <input
                        type="range"
                        min="0.05"
                        max="0.70"
                        step="0.05"
                        value={rawW}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          setConstraints((prev) => ({
                            ...prev,
                            weights: {
                              ...(prev.weights || { sun: 0.35, dte: 0.30, slope: 0.20, thermal: 0.15 }),
                              [item.key]: val,
                            },
                          }));
                        }}
                        className="w-full accent-white"
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 3. Executive Telemetry KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="p-5 rounded-2xl bg-[#0A0B0E] border border-white/[0.08]">
          <span className="text-[11px] font-sans font-medium uppercase tracking-[0.06em] text-[#8E95A5] block mb-1.5">
            Candidates Evaluated
          </span>
          <div className="text-2xl sm:text-[26px] font-mono font-semibold text-white tabular-nums leading-none">
            {rankedEvaluations.length}{' '}
            <span className="text-xs text-[#8E95A5] font-sans font-normal">sites</span>
          </div>
          <span className="text-[12px] font-sans text-[#8E95A5] mt-2 block">
            Across {durationDays}d mission window
          </span>
        </div>

        <div className="p-5 rounded-2xl bg-[#0A0B0E] border border-white/[0.08]">
          <span className="text-[11px] font-sans font-medium uppercase tracking-[0.06em] text-[#8E95A5] block mb-1.5">
            Fully Compliant Sites
          </span>
          <div className="text-2xl sm:text-[26px] font-mono font-semibold text-emerald-400 tabular-nums leading-none">
            {compliantCount}{' '}
            <span className="text-xs text-[#8E95A5] font-sans font-normal">viable</span>
          </div>
          <span className="text-[12px] font-sans text-emerald-400/80 mt-2 block">
            Satisfy all mission constraints
          </span>
        </div>

        <div className="p-5 rounded-2xl bg-[#0A0B0E] border border-white/[0.08]">
          <span className="text-[11px] font-sans font-medium uppercase tracking-[0.06em] text-[#8E95A5] block mb-1.5">
            Filtered Out / Disqualified
          </span>
          <div className="text-2xl sm:text-[26px] font-mono font-semibold text-amber-400 tabular-nums leading-none">
            {disqualifiedCount}{' '}
            <span className="text-xs text-[#8E95A5] font-sans font-normal">sites</span>
          </div>
          <span className="text-[12px] font-sans text-amber-400/80 mt-2 block">
            Violate slope, comms, or sun thresholds
          </span>
        </div>

        <div className="p-5 rounded-2xl bg-[#0C0D12] border border-white/[0.16]">
          <span className="text-[11px] font-sans font-medium uppercase tracking-[0.06em] text-[#CBD5E1] block mb-1.5">
            Primary Target Recommendation
          </span>
          <div className="text-[15px] sm:text-[16px] font-display font-semibold text-white tracking-[-0.015em] truncate leading-snug">
            {topCandidate?.candidate.name || 'None'}
          </div>
          <span className="text-[12px] font-sans text-[#94A3B8] mt-2 block">
            Suitability Index: <strong className="font-mono font-semibold text-white">{topCandidate?.overallScore || 0}/100</strong>
          </span>
        </div>
      </div>

      {/* 4. Filter Tabs & Candidate List */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5 p-1 rounded-xl bg-[#0A0B0E] border border-white/[0.08] text-[12px] font-sans">
            <button
              type="button"
              onClick={() => setViewFilter('all')}
              className={`px-3 py-1.5 rounded-lg transition-colors ${
                viewFilter === 'all'
                  ? 'bg-white text-[#050507] font-semibold'
                  : 'text-[#8E95A5] hover:text-white font-medium'
              }`}
            >
              All Ranked ({rankedEvaluations.length})
            </button>
            <button
              type="button"
              onClick={() => setViewFilter('compliant')}
              className={`px-3 py-1.5 rounded-lg transition-colors ${
                viewFilter === 'compliant'
                  ? 'bg-emerald-950/80 text-emerald-300 font-semibold border border-emerald-500/40'
                  : 'text-[#8E95A5] hover:text-emerald-300 font-medium'
              }`}
            >
              Compliant Only ({compliantCount})
            </button>
            <button
              type="button"
              onClick={() => setViewFilter('disqualified')}
              className={`px-3 py-1.5 rounded-lg transition-colors ${
                viewFilter === 'disqualified'
                  ? 'bg-rose-950/80 text-rose-300 font-semibold border border-rose-500/40'
                  : 'text-[#8E95A5] hover:text-rose-300 font-medium'
              }`}
            >
              Disqualified ({disqualifiedCount})
            </button>
            <button
              type="button"
              onClick={() => setViewFilter('discovered')}
              className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
                viewFilter === 'discovered'
                  ? 'bg-white/[0.12] text-white font-semibold border border-white/[0.22]'
                  : 'text-[#CBD5E1] hover:text-white font-medium'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Auto-Discover South Pole Grid (LOLA DEM)</span>
            </button>
          </div>

          <span className="text-[12px] text-[#8E95A5] font-sans">
            Ranked by transparent multi-factor suitability formula
          </span>
        </div>

        {/* Candidate Evaluation Cards */}
        <div className="space-y-4">
          {displayedEvaluations.map((evalItem, idx) => {
            const c = evalItem.candidate;
            const isPrimary = evalItem.isCompliant && idx === 0 && viewFilter !== 'disqualified';

            return (
              <div
                key={c.id}
                className={`p-5 sm:p-6 rounded-2xl border transition-all duration-200 ${
                  isPrimary
                    ? 'bg-[#0A0B0E] border-white/[0.22] shadow-[0_12px_36px_rgba(0,0,0,0.65)]'
                    : evalItem.isCompliant
                    ? 'bg-[#08090C] border-white/[0.08] hover:border-white/[0.14]'
                    : 'bg-[#07080B] border-white/[0.06] hover:border-white/[0.1] opacity-90'
                }`}
              >
                {/* Header row: Badge, Title, Score */}
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-4 border-b border-white/[0.08]">
                  <div>
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <span className={`text-[10.5px] font-sans font-semibold px-2.5 py-0.5 rounded-md uppercase tracking-[0.04em] border ${evalItem.tierColor}`}>
                        {evalItem.tierLabel}
                      </span>

                      {isPrimary && (
                        <span className="text-[10.5px] font-sans font-semibold px-2.5 py-0.5 rounded-md bg-white/[0.08] text-white border border-white/[0.18] flex items-center gap-1">
                          <Sparkles className="w-3 h-3 text-white" />
                          <span>Top Recommendation</span>
                        </span>
                      )}

                      <span className="text-[12px] font-sans font-medium text-[#8E95A5]">
                        {c.regionLabel}
                      </span>
                    </div>

                    <h2 className="text-lg sm:text-[20px] font-display font-semibold text-white tracking-[-0.02em] flex items-center gap-2">
                      <span>{c.name}</span>
                    </h2>

                    <p className="text-[13px] sm:text-[13.5px] font-sans text-[#94A3B8] mt-1.5 max-w-3xl leading-[1.6]">
                      {c.geology} {c.scienceTarget}
                    </p>
                  </div>

                  {/* Suitability Score & Classification Box */}
                  <div className="flex items-center sm:flex-col sm:items-end justify-between shrink-0">
                    <span className="text-[11px] font-sans font-medium uppercase tracking-[0.06em] text-[#8E95A5]">
                      {evalItem.suitabilityOutcome || 'Conditional'}
                    </span>
                    <div className="flex items-baseline gap-1 mt-0.5">
                      <span className={`text-2xl sm:text-3xl font-mono font-semibold tabular-nums ${
                        evalItem.isCompliant
                          ? evalItem.overallScore >= 80
                            ? 'text-white'
                            : 'text-emerald-400'
                          : 'text-[#8E95A5]'
                      }`}>
                        {evalItem.overallScore}
                      </span>
                      <span className="text-xs text-[#636978] font-mono">/ 100</span>
                    </div>
                  </div>
                </div>

                {/* Explicit Suitability Formula Breakdown Strip (Section 8) */}
                {evalItem.formulaBreakdown && (
                  <div className="mt-3.5 px-3.5 py-2 rounded-xl bg-[#050507] border border-white/[0.07] flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 text-[11.5px]">
                    <span className="font-mono font-normal text-[#CBD5E1]">
                      Formula: {evalItem.formulaBreakdown.formulaString}
                    </span>
                    <span className="text-[11px] font-sans text-[#7E8696]">
                      LOLA DEM (400 m/px, 0.5 m scale) + Meeus Ephemeris
                    </span>
                  </div>
                )}

                {/* Violations Warning Banner (if any) */}
                {evalItem.violations.length > 0 && (
                  <div className="mt-3.5 p-4 rounded-xl bg-rose-950/25 border border-rose-500/30 space-y-1.5">
                    <div className="flex items-center gap-1.5 text-[11px] font-sans font-semibold text-rose-300 uppercase tracking-[0.06em]">
                      <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                      <span>Identified Constraint Violations ({evalItem.violations.length})</span>
                    </div>
                    {evalItem.violations.map((v, vIdx) => (
                      <p key={vIdx} className="text-[12.5px] font-sans text-rose-200/90 pl-5 leading-[1.6]">
                        • <strong className="font-semibold text-rose-100">{v.label}:</strong> {v.detail}
                      </p>
                    ))}
                  </div>
                )}

                {/* Telemetry Matrix Grid */}
                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {/* Metric 1: Touchdown Illumination */}
                  <div className="p-3.5 rounded-xl bg-[#0C0D12] border border-white/[0.07]">
                    <span className="text-[11px] font-sans font-medium uppercase tracking-[0.05em] text-[#8E95A5] flex items-center gap-1.5">
                      <Sun className="w-3.5 h-3.5 text-amber-400" />
                      <span>Touchdown Sun</span>
                    </span>
                    <div className="text-[15px] font-mono font-semibold text-white tabular-nums mt-1.5">
                      {evalItem.touchdown.sunElevationDeg.toFixed(1)}°
                    </div>
                    <span className={`text-[11.5px] font-sans mt-1 block ${
                      evalItem.touchdown.isSunlit ? 'text-emerald-400' : 'text-[#8E95A5]'
                    }`}>
                      {evalItem.touchdown.isSunlit ? 'Sunlit (+Clearance)' : 'Shadow / Night'}
                    </span>
                  </div>

                  {/* Metric 2: Mission Daylight Continuity */}
                  <div className="p-3.5 rounded-xl bg-[#0C0D12] border border-white/[0.07]">
                    <span className="text-[11px] font-sans font-medium uppercase tracking-[0.05em] text-[#8E95A5] flex items-center gap-1.5">
                      <Zap className="w-3.5 h-3.5 text-yellow-400" />
                      <span>Daylight Window</span>
                    </span>
                    <div className="text-[15px] font-mono font-semibold text-white tabular-nums mt-1.5">
                      {evalItem.durationOutlook.sunlitRatio}% ({evalItem.durationOutlook.longestSunlitHours}h)
                    </div>
                    <span className="text-[11.5px] font-sans text-[#8E95A5] mt-1 block">
                      Max dark: <span className="font-mono">{evalItem.durationOutlook.longestDarkHours}h</span>
                    </span>
                  </div>

                  {/* Metric 3: Earth Telemetry */}
                  <div className="p-3.5 rounded-xl bg-[#0C0D12] border border-white/[0.07]">
                    <span className="text-[11px] font-sans font-medium uppercase tracking-[0.05em] text-[#8E95A5] flex items-center gap-1.5">
                      <Radio className="w-3.5 h-3.5 text-sky-400" />
                      <span>Direct-to-Earth Link</span>
                    </span>
                    <div className="text-[15px] font-sans font-semibold text-white tabular-nums mt-1.5">
                      <span className="font-mono">{evalItem.durationOutlook.dteUptimeRatio}%</span> Uptime
                    </div>
                    <span className={`text-[11.5px] font-sans mt-1 block ${
                      evalItem.touchdown.isDteLinked ? 'text-emerald-400' : 'text-rose-400'
                    }`}>
                      {evalItem.candidate.isFarSide
                        ? 'Farside (Relay Req.)'
                        : evalItem.touchdown.isDteLinked
                        ? `LOS Clear (+${evalItem.touchdown.earthMarginDeg.toFixed(1)}°)`
                        : 'Blocked at Touchdown'}
                    </span>
                  </div>

                  {/* Metric 4: Terrain & Temperature */}
                  <div className="p-3.5 rounded-xl bg-[#0C0D12] border border-white/[0.07]">
                    <span className="text-[11px] font-sans font-medium uppercase tracking-[0.05em] text-[#8E95A5] flex items-center gap-1.5">
                      <Mountain className="w-3.5 h-3.5 text-[#CBD5E1]" />
                      <span>Terrain &amp; Thermal</span>
                    </span>
                    <div className="text-[14px] font-sans font-semibold text-white tabular-nums mt-1.5 leading-snug">
                      {c.slopeDeg !== null && Number.isFinite(c.slopeDeg)
                        ? `Slope ${c.slopeDeg.toFixed(1)}°`
                        : 'Slope: Not present'}
                      {' · '}
                      {c.elevationM !== null && Number.isFinite(c.elevationM)
                        ? c.elevationM >= 0
                          ? `+${c.elevationM}m`
                          : `${c.elevationM}m`
                        : 'Elev: Not present'}
                    </div>
                    <span className="text-[11.5px] font-sans text-[#8E95A5] mt-1 block">
                      <span className="font-mono">{evalItem.durationOutlook.minSurfaceTempC}°C</span> to <span className="font-mono">{evalItem.durationOutlook.maxSurfaceTempC}°C</span> (Calculated)
                    </span>
                  </div>
                </div>

                {/* Evidence-based Scientific Rationale */}
                <div className="mt-4 pt-4 border-t border-white/[0.08] grid grid-cols-1 md:grid-cols-2 gap-5 text-[13px] font-sans leading-[1.6]">
                  <div>
                    <span className="text-[11px] font-sans font-semibold text-emerald-400 uppercase tracking-[0.06em] mb-2 flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Suitability Rationale for this Flight Window:</span>
                    </span>
                    <ul className="space-y-1.5 text-[#CBD5E1]">
                      {evalItem.scientificRationale.reasonsWhy.map((r, rIdx) => (
                        <li key={rIdx} className="flex items-start gap-2">
                          <span className="text-emerald-400 shrink-0">•</span>
                          <span>{r}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div>
                    <span className="text-[11px] font-sans font-semibold text-amber-400 uppercase tracking-[0.06em] mb-2 flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                      <span>Trade-offs &amp; Operational Risks:</span>
                    </span>
                    <ul className="space-y-1.5 text-[#CBD5E1]">
                      {evalItem.scientificRationale.operationalRisks.map((risk, riskIdx) => (
                        <li key={riskIdx} className="flex items-start gap-2">
                          <span className="text-amber-400 shrink-0">•</span>
                          <span>{risk}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Quick Actions Bar */}
                <div className="mt-4 pt-3.5 border-t border-white/[0.08] flex flex-wrap items-center justify-between gap-3 text-[12px] font-sans">
                  <div className="flex items-center gap-2.5">
                    <button
                      type="button"
                      onClick={() => handleInspect3D(c)}
                      className="px-3.5 py-1.5 rounded-lg bg-white hover:bg-[#E2E8F0] text-[#050507] font-semibold flex items-center gap-1.5 transition active:scale-95"
                    >
                      <Globe2 className="w-3.5 h-3.5" />
                      <span>View on 3D Moon</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleCompareSite(c)}
                      className="px-3.5 py-1.5 rounded-lg bg-[#0C0D12] hover:bg-[#14161D] text-[#E2E8F0] border border-white/[0.1] font-medium flex items-center gap-1.5 transition"
                    >
                      <GitCompare className="w-3.5 h-3.5 text-[#CBD5E1]" />
                      <span>Compare Candidate</span>
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      if (onSelectSite) onSelectSite(c);
                      onNavigate('briefing');
                    }}
                    className="text-[#CBD5E1] hover:text-white font-sans font-medium flex items-center gap-1.5 hover:underline"
                  >
                    <span>Push to Mission Briefing</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
