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
import { ensurePolarDemLoaded, subscribePolarDemReady } from '../utils/horizons.js';
import {
  celestialTimeStore,
  normalizeCelestialTimeMs,
} from '../utils/celestialTime.js';
import { notifySuccess, notifyInfo, notifyNavigation, notifyWarn } from '../utils/feedbackStore.js';
import { comparisonSelectionStore } from '../utils/comparisonEngine.js';
import {
  DEFAULT_MISSION_EPOCH_MS,
  buildMissionEpochPresets,
} from '../data/missions.js';
import { SCORE_PILLAR_METADATA, OVERALL_SCORE_METADATA } from '../data/nasaProvenance.js';
import LolaValidationPanel from '../components/analysis/LolaValidationPanel.jsx';

const LUNATION_PRESETS = buildMissionEpochPresets({
  normalizeMs: normalizeCelestialTimeMs,
  includeShifts: true,
});

export default function LandingPlannerPage({
  onNavigate,
  onSelectSite,
  onFlyToSite,
}) {
  const [landingMs, setLandingMs] = useState(() => DEFAULT_MISSION_EPOCH_MS);
  const [selectedRegion, setSelectedRegion] = useState('all'); // 'all' | 'south-pole' | 'equatorial-mare' | 'farside'
  const [durationDays, setDurationDays] = useState(14);

  const [constraints, setConstraints] = useState(DEFAULT_PLANNER_CONSTRAINTS);
  const [showConstraintsPanel, setShowConstraintsPanel] = useState(false);

  const [viewFilter, setViewFilter] = useState('compliant');
  const [demReadyTick, setDemReadyTick] = useState(0);

  React.useEffect(() => {
    ensurePolarDemLoaded()
      .then((g) => {
        if (g) setDemReadyTick((t) => t + 1);
      })
      .catch(() => {});
    return subscribePolarDemReady(() => setDemReadyTick((t) => t + 1));
  }, []);

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
      setLandingMs(celestialTimeStore.setTime(ms));
    }
  };

  const applyPreset = (preset) => {
    const nextMs = preset.getMs(landingMs);
    setLandingMs(celestialTimeStore.setTime(nextMs));
    notifyInfo(`Applied mission epoch: ${preset.label}`);
  };

  const candidatesInRegion = useMemo(() => {
    if (selectedRegion === 'all') return PLANNER_CANDIDATES;
    return PLANNER_CANDIDATES.filter((c) => c.region === selectedRegion);
  }, [selectedRegion]);

  const rankedEvaluations = useMemo(() => {
    return rankLandingCandidates(candidatesInRegion, landingMs, durationDays, constraints);
  }, [candidatesInRegion, landingMs, durationDays, constraints, demReadyTick]);

  const discoveredEvaluations = useMemo(() => {
    if (viewFilter !== 'discovered') return [];
    return discoverSouthPoleCandidates(landingMs, durationDays, constraints);
  }, [viewFilter, landingMs, durationDays, constraints, demReadyTick]);

  const fullyCompliantCount = rankedEvaluations.filter((e) => e.isFullyCompliant).length;
  const conditionalCount = rankedEvaluations.filter((e) => e.isConditionalCompliant).length;
  const compliantCount = rankedEvaluations.filter((e) => e.isCompliant).length;
  const disqualifiedCount = rankedEvaluations.length - compliantCount;
  const primaryCompliantCandidate =
    rankedEvaluations.find((e) => e.isFullyCompliant) ||
    rankedEvaluations.find((e) => e.isCompliant) ||
    null;
  const topCandidate = primaryCompliantCandidate || rankedEvaluations[0];

  const displayedEvaluations = useMemo(() => {
    if (viewFilter === 'discovered') return discoveredEvaluations;
    if (viewFilter === 'compliant') return rankedEvaluations.filter((e) => e.isCompliant);
    if (viewFilter === 'disqualified') return rankedEvaluations.filter((e) => !e.isCompliant);
    return rankedEvaluations;
  }, [rankedEvaluations, discoveredEvaluations, viewFilter]);

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
      `- Fully Compliant (4-Factor DEM): ${fullyCompliantCount}`,
      `- Conditional Compliant (Partial DEM): ${conditionalCount}`,
      `- Disqualified (Violations): ${disqualifiedCount}`,
      primaryCompliantCandidate
        ? `- Primary Recommended Target: ${primaryCompliantCandidate.candidate.name} (Suitability: ${primaryCompliantCandidate.overallScore}/100)`
        : `- Primary Recommended Target: None (0 compliant sites under active constraints${topCandidate ? `; highest disqualified potential: ${topCandidate.candidate.name} at ${topCandidate.overallScore}/100` : ''})`,
      ``,
      `## Candidate Evaluations:`,
    ];

    const listToExport =
      rankedEvaluations.filter((e) => e.isCompliant).length > 0
        ? rankedEvaluations.filter((e) => e.isCompliant).slice(0, 5)
        : rankedEvaluations.slice(0, 5);

    listToExport.forEach((evalItem) => {
      const c = evalItem.candidate;
      const elevStr =
        evalItem.elevationM !== null && Number.isFinite(evalItem.elevationM)
          ? `${evalItem.elevationM >= 0 ? '+' : ''}${evalItem.elevationM}m (Measured LOLA DEM)`
          : 'Not present in loaded dataset';
      const slopeStr =
        evalItem.slopeDeg !== null && Number.isFinite(evalItem.slopeDeg)
          ? `${evalItem.slopeDeg.toFixed(1)}° (Calculated Horn 3×3 on LOLA DEM)`
          : 'Not present in loaded dataset';
      const rankTag = evalItem.isCompliant && evalItem.rank ? `#${evalItem.rank}` : 'DISQUALIFIED';
      const sunLabel = evalItem.touchdown.lightingState?.label || (evalItem.touchdown.isSunlit ? 'Day' : 'Shadow');
      lines.push(`### ${rankTag} ${c.name} [${evalItem.tierLabel} - ${evalItem.isCompliant ? 'Suitability' : 'Raw Potential'}: ${evalItem.overallScore}/100]`);
      lines.push(`- Coordinates: ${c.lat.toFixed(2)}°, ${c.lon.toFixed(2)}° (Elevation: ${elevStr}, Slope: ${slopeStr})`);
      lines.push(`- Touchdown: Sun ${evalItem.touchdown.sunElevationDeg.toFixed(1)}° (${sunLabel}), Surface Temp: ${evalItem.touchdown.surfaceTempC}°C (Calculated), DTE: ${evalItem.touchdown.isDteLinked ? 'Clear LOS' : 'Blocked'}`);
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

    if (navigator.clipboard?.writeText) {
      navigator.clipboard
        .writeText(lines.join('\n'))
        .then(() => {
          notifySuccess('Mission Assessment copied to clipboard', 'Ready for flight review & site dossier.');
        })
        .catch(() => {
          notifyWarn('Clipboard Unavailable', 'Browser blocked clipboard access for Markdown export.');
        });
    } else {
      notifyWarn('Clipboard Unavailable', 'Clipboard API is unavailable in this browser context.');
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
            className="px-4 py-2 rounded-lg bg-[#0C0D12] hover:bg-[#14161D] text-[#F8FAFC] border border-white/[0.12] hover:border-white/[0.22] font-sans font-medium text-[12.5px] transition-all active:scale-95 flex items-center gap-2 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/70"
          >
            <Copy className="w-3.5 h-3.5 text-[#CBD5E1]" />
            <span>Copy Mission Assessment</span>
          </button>
        </div>
      </div>

      <div className="p-5 sm:p-6 rounded-2xl bg-[#0A0B0E] border border-white/[0.08] space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div className="space-y-1.5">
            <label
              htmlFor="planner-touchdown-epoch"
              className="text-[11px] font-sans font-semibold text-[#CBD5E1] uppercase tracking-[0.06em] flex items-center gap-1.5"
            >
              <Clock className="w-3.5 h-3.5 text-[#8E95A5]" />
              <span>1. Touchdown Date &amp; Time (UTC)</span>
            </label>
            <input
              id="planner-touchdown-epoch"
              type="datetime-local"
              value={dateInputVal}
              onChange={handleDateChange}
              style={{ colorScheme: 'dark' }}
              className="w-full h-10 px-3.5 rounded-xl bg-[#050507] border border-white/[0.1] text-white font-mono text-[12.5px] focus:outline-none focus:border-white/35 focus-visible:ring-2 focus-visible:ring-cyan-400/70 transition-colors"
            />
            <span className="text-[11px] font-sans text-[#7E8696] block pt-0.5">
              Epoch: <span className="font-mono text-[#94A3B8]">{new Date(landingMs).toUTCString()}</span>
            </span>
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="planner-region-select"
              className="text-[11px] font-sans font-semibold text-[#CBD5E1] uppercase tracking-[0.06em] flex items-center gap-1.5"
            >
              <Globe2 className="w-3.5 h-3.5 text-[#8E95A5]" />
              <span>2. Lunar Region of Interest</span>
            </label>
            <select
              id="planner-region-select"
              value={selectedRegion}
              onChange={(e) => setSelectedRegion(e.target.value)}
              className="w-full h-10 px-3.5 rounded-xl bg-[#050507] border border-white/[0.1] text-white font-sans font-medium text-[12.5px] focus:outline-none focus:border-white/35 focus-visible:ring-2 focus-visible:ring-cyan-400/70 transition-colors"
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
            aria-expanded={showConstraintsPanel}
            aria-controls="planner-constraints-panel"
            onClick={() => setShowConstraintsPanel((prev) => !prev)}
            className="ml-auto px-3.5 py-1.5 rounded-lg bg-white/[0.05] hover:bg-white/[0.09] text-[#F8FAFC] border border-white/[0.12] text-[12px] font-sans font-medium flex items-center gap-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/70"
          >
            <Sliders className="w-3.5 h-3.5 text-[#CBD5E1]" />
            <span>Configure Constraints ({constraints.requireDTE ? 'DTE Required' : 'Relay Allowed'})</span>
            {showConstraintsPanel ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>

        {showConstraintsPanel && (
          <div
            id="planner-constraints-panel"
            className="p-4 sm:p-5 rounded-xl bg-[#050507] border border-white/[0.1] space-y-4 animate-in fade-in duration-150 text-xs"
          >
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-2.5">
              <span className="font-sans font-semibold text-white uppercase tracking-[0.06em] text-[11px] flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-[#CBD5E1]" />
                <span>Mandatory Flight Constraints &amp; Filtering Thresholds</span>
              </span>
              <button
                type="button"
                onClick={() => setConstraints(DEFAULT_PLANNER_CONSTRAINTS)}
                className="text-[11.5px] font-sans font-medium text-[#CBD5E1] hover:text-white hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/70 rounded"
              >
                Reset Defaults
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              <div className="space-y-1.5">
                <label
                  htmlFor="constraint-min-sunlit"
                  className="text-[12px] font-sans text-[#CBD5E1] flex items-center justify-between"
                >
                  <span>Min Continuous Sunlit:</span>
                  <span className="font-mono font-semibold text-white">{constraints.minSunlitHours}h</span>
                </label>
                <input
                  id="constraint-min-sunlit"
                  type="range"
                  min="24"
                  max={Math.max(24, durationDays * 24)}
                  step="12"
                  value={Math.min(constraints.minSunlitHours, durationDays * 24)}
                  onChange={(e) =>
                    setConstraints((prev) => ({
                      ...prev,
                      minSunlitHours: Math.min(durationDays * 24, Number(e.target.value)),
                    }))
                  }
                  className="w-full accent-white"
                />
                {constraints.minSunlitHours > durationDays * 24 ? (
                  <div className="flex items-center justify-between gap-2 text-[11px] font-sans text-amber-300">
                    <span>Exceeds {durationDays * 24}h window</span>
                    <button
                      type="button"
                      onClick={() =>
                        setConstraints((prev) => ({ ...prev, minSunlitHours: durationDays * 24 }))
                      }
                      className="underline hover:text-white shrink-0"
                    >
                      Clamp to {durationDays * 24}h
                    </button>
                  </div>
                ) : (
                  <span className="text-[11px] font-sans text-[#7E8696] block">
                    Disqualifies sites with shorter daylight windows
                  </span>
                )}
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="constraint-max-slope"
                  className="text-[12px] font-sans text-[#CBD5E1] flex items-center justify-between"
                >
                  <span>Max Terrain Slope:</span>
                  <span className="font-mono font-semibold text-white">{constraints.maxSlopeDeg}°</span>
                </label>
                <input
                  id="constraint-max-slope"
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

              <div className="space-y-1.5">
                <label
                  htmlFor="constraint-min-temp"
                  className="text-[12px] font-sans text-[#CBD5E1] flex items-center justify-between"
                >
                  <span>Min Temperature:</span>
                  <span className="font-mono font-semibold text-white">{constraints.minTempC}°C</span>
                </label>
                <input
                  id="constraint-min-temp"
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

            <div className="pt-3.5 border-t border-white/[0.08] space-y-2.5">
              {(() => {
                const wObj = constraints.weights || { sun: 0.35, dte: 0.30, slope: 0.20, thermal: 0.15 };
                const totalW = (wObj.sun ?? 0.35) + (wObj.dte ?? 0.30) + (wObj.slope ?? 0.20) + (wObj.thermal ?? 0.15) || 1;
                return (
                  <>
                    <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-sans font-semibold text-[#CBD5E1] uppercase tracking-[0.06em]">
                      <span>Transparent Suitability Formula Weights (Normalized to 100%)</span>
                      <span className="font-mono text-[#94A3B8] normal-case">
                        Sum {Math.round(totalW * 100)}% → 100% effective
                      </span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-5">
                      {[
                        { key: 'sun', label: 'Solar Illumination Weight' },
                        { key: 'dte', label: 'Earth Visibility (DTE) Weight' },
                        { key: 'slope', label: 'Slope Safety Weight' },
                        { key: 'thermal', label: 'Thermal Stability Weight' },
                      ].map((item) => {
                        const rawW = wObj[item.key] ?? 0.25;
                        const normPct = Math.round((rawW / totalW) * 100);
                        return (
                          <div key={item.key} className="space-y-1.5">
                            <label
                              htmlFor={`constraint-weight-${item.key}`}
                              className="text-[12px] font-sans text-[#CBD5E1] flex items-center justify-between gap-1"
                            >
                              <span>{item.label}:</span>
                              <span className="font-mono font-semibold text-white shrink-0">
                                {normPct}%
                              </span>
                            </label>
                            <input
                              id={`constraint-weight-${item.key}`}
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
                  </>
                );
              })()}
            </div>
          </div>
        )}
      </div>

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
            Compliant Sites
          </span>
          <div className="text-2xl sm:text-[26px] font-mono font-semibold text-emerald-400 tabular-nums leading-none">
            {compliantCount}{' '}
            <span className="text-xs text-[#8E95A5] font-sans font-normal">
              {fullyCompliantCount > 0 && conditionalCount > 0
                ? `viable (${fullyCompliantCount} polar · ${conditionalCount} mare)`
                : 'viable in window'}
            </span>
          </div>
          <span className="text-[12px] font-sans text-emerald-400/80 mt-2 block">
            Zero constraint violations · Ranked #1–#{compliantCount}
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
            Violate slope, DTE, sun, or thermal limits
          </span>
        </div>

        <div className="p-5 rounded-2xl bg-[#0C0D12] border border-white/[0.16]">
          <span className="text-[11px] font-sans font-medium uppercase tracking-[0.06em] text-[#CBD5E1] block mb-1.5">
            Primary Target Recommendation
          </span>
          <div className="text-[15px] sm:text-[16px] font-display font-semibold text-white tracking-[-0.015em] truncate leading-snug">
            {primaryCompliantCandidate
              ? primaryCompliantCandidate.candidate.name
              : 'No Compliant Site in Window'}
          </div>
          <span className="text-[12px] font-sans text-[#94A3B8] mt-2 block">
            {primaryCompliantCandidate ? (
              <>
                Suitability Index:{' '}
                <strong className="font-mono font-semibold text-white">
                  {primaryCompliantCandidate.overallScore}/100 ({OVERALL_SCORE_METADATA.uncertainty})
                </strong>{' '}
                {primaryCompliantCandidate.isPartialScore ? '(Partial DEM)' : '(Full 4-Factor)'}
                <span className="block text-[10.5px] text-[#8E95A5] mt-0.5">
                  How computed: {OVERALL_SCORE_METADATA.shortHowComputed}
                </span>
              </>
            ) : (
              <span className="text-rose-400">
                All {rankedEvaluations.length} candidates violate ≥1 active constraint
              </span>
            )}
          </span>
        </div>
      </div>

      <LolaValidationPanel epochMs={landingMs} defaultExpanded={true} compact={true} />

      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div
            role="group"
            aria-label="Filter candidate landing sites"
            className="flex flex-wrap items-center gap-1.5 p-1 rounded-xl bg-[#0A0B0E] border border-white/[0.08] text-[12px] font-sans"
          >
            <button
              type="button"
              aria-pressed={viewFilter === 'compliant'}
              onClick={() => setViewFilter('compliant')}
              className={`px-3 py-1.5 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/70 ${
                viewFilter === 'compliant'
                  ? 'bg-emerald-950/80 text-emerald-300 font-semibold border border-emerald-500/40'
                  : 'text-[#8E95A5] hover:text-emerald-300 font-medium'
              }`}
            >
              Compliant Only ({compliantCount})
            </button>
            <button
              type="button"
              aria-pressed={viewFilter === 'all'}
              onClick={() => setViewFilter('all')}
              className={`px-3 py-1.5 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/70 ${
                viewFilter === 'all'
                  ? 'bg-white text-[#050507] font-semibold'
                  : 'text-[#8E95A5] hover:text-white font-medium'
              }`}
            >
              All Candidates ({rankedEvaluations.length})
            </button>
            <button
              type="button"
              aria-pressed={viewFilter === 'disqualified'}
              onClick={() => setViewFilter('disqualified')}
              className={`px-3 py-1.5 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400/70 ${
                viewFilter === 'disqualified'
                  ? 'bg-rose-950/80 text-rose-300 font-semibold border border-rose-500/40'
                  : 'text-[#8E95A5] hover:text-rose-300 font-medium'
              }`}
            >
              Disqualified ({disqualifiedCount})
            </button>
            <button
              type="button"
              aria-pressed={viewFilter === 'discovered'}
              onClick={() => setViewFilter('discovered')}
              className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/70 ${
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
            Operational ranking applies strictly to constraint-compliant sites
          </span>
        </div>

        {displayedEvaluations.length === 0 && (
          <div className="p-6 rounded-2xl bg-[#0A0B0E] border border-amber-500/30 space-y-3">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <h3 className="text-sm font-display font-semibold text-white">
                  {viewFilter === 'disqualified'
                    ? 'No Disqualified Candidates in Selected Window'
                    : viewFilter === 'discovered'
                    ? 'No Auto-Discovered Polar Grid Points Satisfy Current Constraints'
                    : 'No Fully Compliant Sites in Selected Window'}
                </h3>
                <p className="text-xs font-sans text-[#94A3B8] leading-relaxed">
                  {viewFilter === 'disqualified'
                    ? 'Every evaluated candidate in this region passed all active engineering constraints for the selected touchdown epoch and surface duration.'
                    : viewFilter === 'discovered'
                    ? 'No 80°S–90°S LOLA DEM grid sample meets the current lighting, slope, DTE, and thermal thresholds in this window.'
                    : `For this exact touchdown epoch and duration, every evaluated candidate triggers at least one active engineering constraint (e.g., lunar night/shadow, <${constraints.minDtePct}% DTE visibility, or cryogenic surface below ${constraints.minTempC}°C).`}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 pt-1">
              {viewFilter === 'disqualified' ? (
                <button
                  type="button"
                  onClick={() => setViewFilter('compliant')}
                  className="px-3 py-1.5 rounded-lg bg-emerald-950/70 hover:bg-emerald-900/80 border border-emerald-500/40 text-emerald-200 text-xs font-sans font-medium transition-colors"
                >
                  View Compliant Sites ({compliantCount})
                </button>
              ) : (
                <>
                  {LUNATION_PRESETS[0] && (
                    <button
                      type="button"
                      onClick={() => applyPreset(LUNATION_PRESETS[0])}
                      className="px-3 py-1.5 rounded-lg bg-emerald-950/70 hover:bg-emerald-900/80 border border-emerald-500/40 text-emerald-200 text-xs font-sans font-medium transition-colors"
                    >
                      Load Viable {LUNATION_PRESETS[0].label}
                    </button>
                  )}
                  {disqualifiedCount > 0 && viewFilter !== 'discovered' && (
                    <button
                      type="button"
                      onClick={() => setViewFilter('disqualified')}
                      className="px-3 py-1.5 rounded-lg bg-[#0C0D12] hover:bg-[#14161D] border border-white/[0.1] text-[#CBD5E1] text-xs font-sans font-medium transition-colors"
                    >
                      Inspect Disqualified Candidates ({disqualifiedCount})
                    </button>
                  )}
                  {viewFilter === 'discovered' && (
                    <button
                      type="button"
                      onClick={() => setViewFilter('compliant')}
                      className="px-3 py-1.5 rounded-lg bg-[#0C0D12] hover:bg-[#14161D] border border-white/[0.1] text-[#CBD5E1] text-xs font-sans font-medium transition-colors"
                    >
                      View Verified Catalog Sites ({compliantCount})
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setShowConstraintsPanel(true)}
                    className="px-3 py-1.5 rounded-lg bg-[#0C0D12] hover:bg-[#14161D] border border-white/[0.1] text-[#CBD5E1] text-xs font-sans font-medium transition-colors"
                  >
                    Relax Engineering Constraints
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        <div className="space-y-4">
          {displayedEvaluations.map((evalItem, idx) => {
            const c = evalItem.candidate;
            const rankNum = evalItem.isCompliant ? (evalItem.rank ?? idx + 1) : null;
            const isPrimary =
              primaryCompliantCandidate?.candidate?.id === c.id &&
              evalItem.isCompliant &&
              viewFilter !== 'disqualified';
            const tdLighting = evalItem.touchdown.lightingState;

            return (
              <div
                key={c.id}
                className={`p-5 sm:p-6 rounded-2xl border transition-all duration-200 ${
                  isPrimary
                    ? 'bg-[#0A0B0E] border-cyan-500/45 shadow-[0_12px_36px_rgba(0,0,0,0.65)]'
                    : evalItem.isFullyCompliant
                    ? 'bg-[#08090C] border-white/[0.1] hover:border-white/[0.18]'
                    : evalItem.isConditionalCompliant
                    ? 'bg-[#08090C] border-amber-500/20 hover:border-amber-500/35'
                    : 'bg-[#07080B] border-white/[0.06] hover:border-white/[0.1] opacity-90'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-4 border-b border-white/[0.08]">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      {rankNum !== null ? (
                        <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-950/70 text-emerald-200 border border-emerald-500/40 tabular-nums">
                          #{rankNum}
                        </span>
                      ) : (
                        <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded bg-rose-950/75 text-rose-300 border border-rose-500/45 uppercase tracking-wider">
                          DISQUALIFIED
                        </span>
                      )}

                      <span className={`text-[10.5px] font-sans font-semibold px-2.5 py-0.5 rounded-md uppercase tracking-[0.04em] border ${evalItem.tierColor}`}>
                        {evalItem.tierLabel}
                      </span>

                      {isPrimary && (
                        <span className="text-[10.5px] font-sans font-semibold px-2.5 py-0.5 rounded-md bg-cyan-950/90 text-cyan-200 border border-cyan-400/50 flex items-center gap-1">
                          <Sparkles className="w-3 h-3 text-cyan-300" />
                          <span>Primary Compliant Recommendation</span>
                        </span>
                      )}

                      <span className="text-[12px] font-mono text-[#8E95A5] tabular-nums">
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

                  <div className="flex flex-col sm:items-end justify-between shrink-0 bg-[#050507] px-3.5 py-2.5 rounded-xl border border-white/[0.07]">
                    <div className="flex items-center sm:flex-col sm:items-end justify-between w-full gap-2">
                      <span className="text-[10.5px] font-sans font-semibold uppercase tracking-[0.06em] text-[#8E95A5]">
                        {!evalItem.isCompliant
                          ? 'Raw Potential (Disqualified)'
                          : evalItem.isPartialScore
                          ? 'Partial Score (3-Factor)'
                          : `${evalItem.suitabilityOutcome || 'Composite'} Score`}
                      </span>
                      <div className="flex items-baseline gap-1 mt-0.5">
                        <span className={`text-2xl sm:text-3xl font-mono font-semibold tabular-nums ${
                          evalItem.isFullyCompliant
                            ? evalItem.overallScore >= 75
                              ? 'text-cyan-300'
                              : 'text-emerald-400'
                            : evalItem.isConditionalCompliant
                            ? 'text-amber-300'
                            : 'text-[#8E95A5]'
                        }`}>
                          {evalItem.overallScore}
                        </span>
                        <span className="text-xs text-[#636978] font-mono">/ 100</span>
                        <span className="text-[10.5px] font-mono text-amber-300/90 ml-1">
                          ({OVERALL_SCORE_METADATA.uncertainty})
                        </span>
                      </div>
                    </div>
                    <span className="text-[10px] font-sans text-[#8E95A5] mt-1 sm:text-right max-w-[230px] leading-tight">
                      How computed: {OVERALL_SCORE_METADATA.shortHowComputed}
                    </span>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <div className="p-3.5 rounded-xl bg-[#0C0D12] border border-white/[0.07]">
                    <span className="text-[11px] font-sans font-medium uppercase tracking-[0.05em] text-[#8E95A5] flex items-center gap-1.5">
                      <Sun className="w-3.5 h-3.5 text-amber-400" />
                      <span>Touchdown Sun</span>
                    </span>
                    <div className="text-[15px] font-mono font-semibold text-white tabular-nums mt-1.5">
                      {evalItem.touchdown.sunElevationDeg >= 0 ? '+' : ''}
                      {evalItem.touchdown.sunElevationDeg.toFixed(1)}°
                    </div>
                    <span
                      className={`text-[11.5px] font-sans mt-1 block ${
                        tdLighting?.isSunlit
                          ? 'text-emerald-400'
                          : tdLighting?.isTerrainShadowed
                          ? 'text-orange-300'
                          : tdLighting?.isPSR
                          ? 'text-purple-300'
                          : 'text-indigo-300'
                      }`}
                    >
                      {tdLighting
                        ? tdLighting.isSunlit
                          ? 'Day (+Clearance)'
                          : tdLighting.isTerrainShadowed
                          ? 'Terrain-Shadowed (Blocked)'
                          : tdLighting.isPSR
                          ? 'Permanent Shadow (PSR)'
                          : 'Night (Below Horizon)'
                        : evalItem.touchdown.isSunlit
                        ? 'Day (+Clearance)'
                        : 'Night (Below Horizon)'}
                    </span>
                  </div>

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

                  <div className="p-3.5 rounded-xl bg-[#0C0D12] border border-white/[0.07]">
                    <span className="text-[11px] font-sans font-medium uppercase tracking-[0.05em] text-[#8E95A5] flex items-center gap-1.5">
                      <Mountain className="w-3.5 h-3.5 text-[#CBD5E1]" />
                      <span>Terrain &amp; Thermal</span>
                    </span>
                    <div className="text-[14px] font-sans font-semibold text-white tabular-nums mt-1.5 leading-snug">
                      {c.slopeDeg !== null && Number.isFinite(c.slopeDeg)
                        ? `Slope ${c.slopeDeg.toFixed(1)}°`
                        : 'Slope: Outside 80°S DEM'}
                      {' · '}
                      {c.elevationM !== null && Number.isFinite(c.elevationM)
                        ? c.elevationM >= 0
                          ? `+${c.elevationM}m`
                          : `${c.elevationM}m`
                        : 'Elev: N/A'}
                    </div>
                    <span className="text-[11.5px] font-sans text-[#8E95A5] mt-1 block">
                      <span className="font-mono">{evalItem.durationOutlook.minSurfaceTempC}°C</span> to <span className="font-mono">{evalItem.durationOutlook.maxSurfaceTempC}°C</span> (Model)
                    </span>
                  </div>
                </div>

                {evalItem.violations.length > 0 && (
                  <div className="mt-3.5 p-3.5 rounded-xl bg-rose-950/25 border border-rose-500/30 space-y-1.5">
                    <div className="flex items-center gap-1.5 text-[11px] font-sans font-semibold text-rose-300 uppercase tracking-[0.06em]">
                      <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                      <span>Identified Constraint Violations ({evalItem.violations.length})</span>
                    </div>
                    {evalItem.violations.map((v, vIdx) => (
                      <p key={vIdx} className="text-[12.5px] font-sans text-rose-200/90 pl-5 leading-[1.55]">
                        • <strong className="font-semibold text-rose-100">{v.label}:</strong> {v.detail}
                      </p>
                    ))}
                  </div>
                )}

                <div className="mt-3.5 grid grid-cols-1 lg:grid-cols-2 gap-3">
                  {evalItem.formulaBreakdown && (
                    <details open={idx === 0} className="group rounded-xl bg-[#050507] border border-white/[0.08] px-3.5 py-2.5 text-xs">
                      <summary className="cursor-pointer list-none flex items-center justify-between gap-2 font-sans font-semibold text-[#CBD5E1] hover:text-white">
                        <span className="flex items-center gap-2">
                          <Sliders className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                          <span>Scoring Methodology &amp; Uncertainty Breakdown</span>
                        </span>
                        <ChevronDown className="w-3.5 h-3.5 text-[#8E95A5] transition-transform group-open:rotate-180" />
                      </summary>
                      <div className="mt-3 pt-2.5 border-t border-white/[0.08] space-y-2.5">
                        <div className="font-mono text-[11.5px] text-[#E2E8F0] bg-[#0C0D12] p-2.5 rounded-lg border border-white/[0.06] overflow-x-auto break-words">
                          {evalItem.formulaBreakdown.formulaString}
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                          {[
                            {
                              meta: SCORE_PILLAR_METADATA.solar,
                              value: `${evalItem.scoreBreakdown.sunlitScore}/100`,
                            },
                            {
                              meta: SCORE_PILLAR_METADATA.dte,
                              value: `${evalItem.scoreBreakdown.dteScore}/100`,
                            },
                            {
                              meta: SCORE_PILLAR_METADATA.slope,
                              value:
                                evalItem.scoreBreakdown.slopeScore !== null
                                  ? `${evalItem.scoreBreakdown.slopeScore}/100`
                                  : 'No DEM',
                            },
                            {
                              meta: SCORE_PILLAR_METADATA.thermal,
                              value: `${evalItem.scoreBreakdown.thermalScore}/100`,
                            },
                          ].map(({ meta, value }) => (
                            <div
                              key={meta.key}
                              className="p-2.5 rounded-lg bg-[#0C0D12] border border-white/[0.06] space-y-1"
                            >
                              <div className="flex items-center justify-between font-mono tabular-nums">
                                <span className="text-[#CBD5E1] font-sans font-semibold">{meta.title}</span>
                                <span className="text-white font-semibold">{value}</span>
                              </div>
                              <div className="text-[10px] font-mono text-amber-300/95">
                                Uncertainty: {meta.uncertainty}
                              </div>
                              <p className="text-[10.5px] font-sans text-[#8E95A5] leading-snug">
                                How computed: {meta.howComputed}
                              </p>
                            </div>
                          ))}
                        </div>
                        {evalItem.formulaBreakdown.partialScoreNote && (
                          <p className="text-[11px] font-sans text-amber-300/90 leading-relaxed">
                            Note: {evalItem.formulaBreakdown.partialScoreNote}
                          </p>
                        )}
                      </div>
                    </details>
                  )}

                  <details className="group rounded-xl bg-[#050507] border border-white/[0.08] px-3.5 py-2.5 text-xs">
                    <summary className="cursor-pointer list-none flex items-center justify-between gap-2 font-sans font-semibold text-[#CBD5E1] hover:text-white">
                      <span className="flex items-center gap-2">
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        <span>Dataset Provenance, Rationale &amp; Limitations</span>
                      </span>
                      <ChevronDown className="w-3.5 h-3.5 text-[#8E95A5] transition-transform group-open:rotate-180" />
                    </summary>
                    <div className="mt-3 pt-2.5 border-t border-white/[0.08] space-y-3 text-[12px] font-sans leading-relaxed">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <span className="text-[10.5px] font-semibold text-emerald-400 uppercase tracking-wider block mb-1">
                            Suitability Strengths
                          </span>
                          <ul className="space-y-1 text-[#CBD5E1]">
                            {evalItem.scientificRationale.reasonsWhy.length > 0 ? (
                              evalItem.scientificRationale.reasonsWhy.map((r, rIdx) => (
                                <li key={rIdx} className="flex items-start gap-1.5">
                                  <span className="text-emerald-400 shrink-0">•</span>
                                  <span>{r}</span>
                                </li>
                              ))
                            ) : (
                              <li className="text-[#8E95A5]">No exceptional window strengths identified.</li>
                            )}
                          </ul>
                        </div>
                        <div>
                          <span className="text-[10.5px] font-semibold text-amber-400 uppercase tracking-wider block mb-1">
                            Operational Risks &amp; Limitations
                          </span>
                          <ul className="space-y-1 text-[#CBD5E1]">
                            {evalItem.scientificRationale.operationalRisks.map((risk, riskIdx) => (
                              <li key={riskIdx} className="flex items-start gap-1.5">
                                <span className="text-amber-400 shrink-0">•</span>
                                <span>{risk}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                      {evalItem.formulaBreakdown?.provenance && (
                        <div className="pt-2 border-t border-white/[0.06] text-[11px] text-[#94A3B8] space-y-0.5">
                          <div><strong className="text-[#CBD5E1]">Topography &amp; Slope:</strong> {evalItem.formulaBreakdown.provenance.slope}</div>
                          <div><strong className="text-[#CBD5E1]">Horizon Mask:</strong> {evalItem.formulaBreakdown.provenance.horizon}</div>
                          <div><strong className="text-[#CBD5E1]">Ephemeris &amp; Thermal:</strong> {evalItem.formulaBreakdown.provenance.illumination} · {evalItem.formulaBreakdown.provenance.thermal}</div>
                        </div>
                      )}
                    </div>
                  </details>
                </div>

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
                      if (onSelectSite) onSelectSite(c, 'dossier');
                      if (onFlyToSite) onFlyToSite(c);
                      onNavigate('explorer');
                    }}
                    className="text-[#CBD5E1] hover:text-white font-sans font-medium flex items-center gap-1.5 hover:underline"
                  >
                    <span>View Site Dossier</span>
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
