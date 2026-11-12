import React, { useState, useMemo, useEffect, useDeferredValue, useRef } from 'react';
import {
  X,
  Sun,
  Radio,
  Sliders,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Clock,
  Zap,
  GitCompare,
  Bookmark,
  Activity,
} from 'lucide-react';
import { celestialTimeStore } from '../../utils/celestialTime.js';
import { ensurePolarDemLoaded } from '../../utils/horizons.js';
import {
  simulateMissionTimelineTracks,
  compareWhatIfScenarios,
  evaluateCandidateForMissionWindow,
  DEFAULT_PLANNER_CONSTRAINTS,
} from '../../utils/plannerEngine.js';
import { SITES_TO_ANALYZE } from '../../data/slipSites.js';
import { notifySuccess } from '../../utils/feedbackStore.js';
import { useDialogA11y } from '../../hooks/useDialogA11y.js';

export { SITES_TO_ANALYZE };

const LANDER_PRESETS = [
  {
    id: 'polar-solar',
    name: 'Polar Solar Lander',
    subtitle: 'High Sun Priority (55% Sun / 35% DTE / 10% Slope)',
    weights: { sun: 0.55, dte: 0.35, slope: 0.10, thermal: 0.0 },
  },
  {
    id: 'short-hopper',
    name: 'High-Bandwidth DTE Hopper',
    subtitle: 'Continuous Earth Comms (30% Sun / 55% DTE / 15% Slope)',
    weights: { sun: 0.30, dte: 0.55, slope: 0.15, thermal: 0.0 },
  },
  {
    id: 'rtg-rover',
    name: 'RTG / Cryogenic PSR Rover',
    subtitle: 'Night-Tolerant ISRU (20% Sun / 50% DTE / 30% Slope)',
    weights: { sun: 0.20, dte: 0.50, slope: 0.30, thermal: 0.0 },
  },
];

function evaluateSiteAtEpoch(site, epochMs, presetWeights, durationDays = 1) {
  const ev = evaluateCandidateForMissionWindow(site, epochMs, durationDays, {
    ...DEFAULT_PLANNER_CONSTRAINTS,
    weights: { ...presetWeights, thermal: presetWeights.thermal ?? 0.0 },
  });

  const sunlitScore = ev.durationOutlook.sunlitRatio;
  const dteScore = ev.durationOutlook.dteUptimeRatio;

  return {
    sunlitScore,
    isSunlit: sunlitScore >= 50,
    linkStatus:
      ev.touchdown?.dteStatus ||
      ev.instant?.dteStatus ||
      (dteScore >= 50 ? 'clear' : 'blocked'),
    linkMargin: ev.touchdown?.earthMarginDeg ?? ev.instant?.dteMarginDeg ?? 0,
    dteScore,
    score: ev.overallScore,
    elevationM: ev.elevationM ?? ev.terrain?.elevationM ?? null,
    slopeDeg: ev.slopeDeg ?? ev.terrain?.slopeDeg ?? null,
    roughnessM: ev.roughnessM ?? ev.terrain?.roughnessM ?? null,
  };
}

export default function SlipSimulatorModal({ isOpen, onClose, onSelectSiteAndDate }) {
  const dialogRef = useRef(null);
  const { titleId } = useDialogA11y({ isOpen, onClose, containerRef: dialogRef });
  const [activeMode, setActiveMode] = useState('timeline'); // 'timeline' | 'whatif' | 'heatmap'
  const [baseTimeMs, setBaseTimeMs] = useState(() => celestialTimeStore.get().ms);
  const [slipDays, setSlipDays] = useState(0);
  const [selectedSiteId, setSelectedSiteId] = useState(SITES_TO_ANALYZE[0].id);
  const [altSiteId, setAltSiteId] = useState(SITES_TO_ANALYZE[1].id);
  const [altSlipDays, setAltSlipDays] = useState(7);
  const [altSlipDraft, setAltSlipDraft] = useState('7');
  const [windowDurationDays, setWindowDurationDays] = useState(14);

  useEffect(() => {
    setAltSlipDraft(String(altSlipDays));
  }, [altSlipDays]);
  const [stepHours, setStepHours] = useState(6);
  const [presetId, setPresetId] = useState(LANDER_PRESETS[0].id);
  const [savedScenarios, setSavedScenarios] = useState([]);
  const [demReadyTick, setDemReadyTick] = useState(0);

  const deferredSlipDays = useDeferredValue(slipDays);
  const deferredAltSlipDays = useDeferredValue(altSlipDays);
  const deferredWindowDurationDays = useDeferredValue(windowDurationDays);

  const activePreset = useMemo(
    () => LANDER_PRESETS.find((p) => p.id === presetId) || LANDER_PRESETS[0],
    [presetId]
  );

  const selectedSite = useMemo(
    () => SITES_TO_ANALYZE.find((s) => s.id === selectedSiteId) || SITES_TO_ANALYZE[0],
    [selectedSiteId]
  );

  const altSite = useMemo(
    () => SITES_TO_ANALYZE.find((s) => s.id === altSiteId) || SITES_TO_ANALYZE[1],
    [altSiteId]
  );

  useEffect(() => {
    ensurePolarDemLoaded()
      .then((g) => {
        if (g) setDemReadyTick((t) => t + 1);
      })
      .catch(() => {});
    const unsubscribe = celestialTimeStore.subscribe(({ ms }) => {
      setBaseTimeMs(ms);
    });
    return unsubscribe;
  }, []);

  const simulatedTimeMs = useMemo(() => {
    return baseTimeMs + deferredSlipDays * 24 * 60 * 60 * 1000;
  }, [baseTimeMs, deferredSlipDays]);

  const timelineTracks = useMemo(() => {
    if (!isOpen) return [];
    return simulateMissionTimelineTracks(
      selectedSite,
      simulatedTimeMs,
      deferredWindowDurationDays,
      stepHours
    );
  }, [isOpen, selectedSite, simulatedTimeMs, deferredWindowDurationDays, stepHours, demReadyTick]);

  const whatIfDiff = useMemo(() => {
    if (!isOpen) return null;
    const altTimeMs = baseTimeMs + deferredAltSlipDays * 24 * 60 * 60 * 1000;
    return compareWhatIfScenarios(
      { site: selectedSite, landingMs: simulatedTimeMs, durationDays: deferredWindowDurationDays },
      { site: altSite, landingMs: altTimeMs, durationDays: deferredWindowDurationDays },
      {
        ...DEFAULT_PLANNER_CONSTRAINTS,
        weights: { ...activePreset.weights, thermal: 0.0 },
      }
    );
  }, [
    isOpen,
    selectedSite,
    altSite,
    simulatedTimeMs,
    baseTimeMs,
    deferredAltSlipDays,
    deferredWindowDurationDays,
    activePreset,
    demReadyTick,
  ]);

  const siteEvaluations = useMemo(() => {
    if (!isOpen) return [];
    return SITES_TO_ANALYZE.map((site) => {
      const ev = evaluateSiteAtEpoch(site, simulatedTimeMs, activePreset.weights, deferredWindowDurationDays);
      return {
        ...site,
        ...ev,
      };
    });
  }, [isOpen, simulatedTimeMs, activePreset, deferredWindowDurationDays, demReadyTick]);

  const heatmapMatrix = useMemo(() => {
    if (!isOpen) return [];
    const daysArray = Array.from({ length: deferredWindowDurationDays }, (_, i) => i);
    return SITES_TO_ANALYZE.map((site) => {
      const dayScores = daysArray.map((dayOffset) => {
        const testMs = baseTimeMs + (deferredSlipDays + dayOffset) * 24 * 60 * 60 * 1000;
        const ev = evaluateSiteAtEpoch(site, testMs, activePreset.weights, 1);
        return {
          dayOffset,
          score: ev.score,
          sunlit: ev.sunlitScore,
          linkClear: ev.linkStatus === 'clear',
        };
      });
      return { ...site, dayScores };
    });
  }, [isOpen, baseTimeMs, deferredSlipDays, deferredWindowDurationDays, activePreset, demReadyTick]);

  const bestPlanB = useMemo(() => {
    let best = null;
    for (const row of heatmapMatrix) {
      for (const cell of row.dayScores) {
        if (!best || cell.score > best.score) {
          best = {
            site: row,
            dayOffset: cell.dayOffset,
            score: cell.score,
            sunlit: cell.sunlit,
            linkClear: cell.linkClear,
          };
        }
      }
    }
    return best;
  }, [heatmapMatrix]);

  if (!isOpen) return null;

  const handleApplyToGlobalClock = () => {
    celestialTimeStore.setTime(simulatedTimeMs, 'slip-simulator');
    notifySuccess(
      'Celestial Clock Synced',
      `Global time advanced by ${slipDays >= 0 ? `+${slipDays}` : slipDays} days.`
    );
  };

  const handleSelectCell = (site, dayOffset) => {
    const targetMs = baseTimeMs + (slipDays + dayOffset) * 24 * 60 * 60 * 1000;
    celestialTimeStore.setTime(targetMs, 'slip-heatmap');
    if (onSelectSiteAndDate) {
      onSelectSiteAndDate(
        { id: site.id, latitude: site.lat, longitude: site.lon, name: site.name },
        targetMs
      );
    }
    notifySuccess(
      'Launched to Date & Site',
      `Synchronized to ${site.name} at day +${slipDays + dayOffset}.`
    );
    onClose();
  };

  const handleSaveScenario = () => {
    const label = `${selectedSite.name} (${slipDays >= 0 ? `+${slipDays}` : slipDays}d · ${windowDurationDays}d window)`;
    setSavedScenarios((prev) => [
      {
        id: `${Date.now()}`,
        label,
        siteId: selectedSite.id,
        slipDays,
        durationDays: windowDurationDays,
        score: whatIfDiff?.evalA?.overallScore ?? 75,
      },
      ...prev.slice(0, 4),
    ]);
    notifySuccess('Scenario Saved', `${label} added to session comparison tray.`);
  };

  const formattedSimDate = new Date(simulatedTimeMs).toUTCString().replace('GMT', 'UTC');

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-md animate-in fade-in duration-150 pointer-events-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="relative w-full max-w-5xl max-h-[92dvh] bg-[#0C0D12] border border-[#1E2028] rounded-3xl shadow-2xl overflow-hidden flex flex-col text-[#F8FAFC] font-sans focus:outline-none"
      >
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 border-b border-[#1E2028] bg-[#050507] shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-white/[0.08] border border-white/25 text-[#F8FAFC]">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[10px] font-mono uppercase tracking-wider text-[#F8FAFC]">
                Time-Based Mission Simulator &amp; What-If Analysis
              </div>
              <h2 id={titleId} className="font-serif text-xl font-medium text-[#F8FAFC]">
                4-Track Synchronized Timeline, What-If Comparator &amp; Window Heatmap
              </h2>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleSaveScenario}
              className="px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-cyan-300 font-mono text-xs flex items-center gap-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
            >
              <Bookmark className="w-3.5 h-3.5" />
              <span>Save Scenario</span>
            </button>
            {bestPlanB && (
              <button
                type="button"
                onClick={() => handleSelectCell(bestPlanB.site, bestPlanB.dayOffset)}
                className="max-w-[260px] px-3 py-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/50 text-emerald-300 font-mono text-xs font-semibold flex items-center gap-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/50"
                title={`Jump to best backup window: ${bestPlanB.site.name}`}
              >
                <Zap className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">
                  Plan B: {bestPlanB.site.name} (+{slipDays + bestPlanB.dayOffset}d · {bestPlanB.score}%)
                </span>
              </button>
            )}
            <button
              type="button"
              onClick={handleApplyToGlobalClock}
              className="px-3.5 py-2 rounded-xl bg-white hover:bg-[#E2E8F0] text-[#050507] font-mono text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Sync Global Clock</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close slip simulator dialog"
              className="p-2 rounded-full text-[#94A3B8] hover:text-white hover:bg-[#1E2028] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="px-6 py-2.5 bg-[#050507] border-b border-[#1E2028] flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div role="tablist" aria-label="Slip simulator views" className="flex flex-wrap items-center gap-2">
            {[
              { id: 'timeline', label: '1. 4-Track Mission Timeline', icon: Activity },
              { id: 'whatif', label: '2. What-If Scenario Comparator', icon: GitCompare },
              { id: 'heatmap', label: '3. Multi-Site Window Heatmap', icon: Sliders },
            ].map((tab) => {
              const Icon = tab.icon;
              const isAct = activeMode === tab.id;
              return (
                <button
                  key={tab.id}
                  id={`slip-sim-tab-${tab.id}`}
                  role="tab"
                  type="button"
                  aria-selected={isAct}
                  onClick={() => setActiveMode(tab.id)}
                  className={`px-3.5 py-1.5 rounded-xl font-mono text-xs flex items-center gap-1.5 border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 ${
                    isAct
                      ? 'bg-white/[0.08] border-white/25 text-[#F8FAFC] font-bold'
                      : 'bg-[#0C0D12] border-[#1E2028] text-slate-400 hover:text-white'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {savedScenarios.length > 0 && (
            <div className="flex items-center gap-1.5 text-[10px] font-mono text-cyan-300">
              <span>Saved ({savedScenarios.length}):</span>
              {savedScenarios.map((sc) => (
                <button
                  key={sc.id}
                  type="button"
                  onClick={() => {
                    setSelectedSiteId(sc.siteId);
                    setSlipDays(sc.slipDays);
                    setWindowDurationDays(sc.durationDays);
                  }}
                  className="px-2 py-0.5 rounded bg-slate-900 border border-slate-700 hover:border-cyan-400 truncate max-w-[140px]"
                >
                  {sc.label}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          <div className="p-4 rounded-2xl bg-[#050507] border border-[#1E2028] space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div>
                <label className="text-[10px] font-mono uppercase text-slate-400 block mb-1">
                  Primary Candidate Site (Scenario A)
                </label>
                <select
                  value={selectedSiteId}
                  onChange={(e) => setSelectedSiteId(e.target.value)}
                  className="w-full h-9 px-2.5 rounded-xl bg-[#0C0D12] border border-[#1E2028] text-xs font-mono text-white"
                >
                  {SITES_TO_ANALYZE.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({Math.abs(s.lat).toFixed(2)}°S)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] font-mono uppercase text-slate-400 block mb-1">
                  Launch Slip Offset ({slipDays >= 0 ? `+${slipDays}` : slipDays} Days)
                </label>
                <input
                  type="range"
                  min="-15"
                  max="45"
                  step="1"
                  value={slipDays}
                  onChange={(e) => setSlipDays(parseInt(e.target.value, 10))}
                  className="w-full accent-white cursor-pointer mt-2"
                />
              </div>

              <div>
                <label className="text-[10px] font-mono uppercase text-slate-400 block mb-1">
                  Mission Duration
                </label>
                <div className="grid grid-cols-3 gap-1">
                  {[7, 14, 30].map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setWindowDurationDays(d)}
                      className={`h-9 rounded-xl font-mono text-xs border ${
                        windowDurationDays === d
                          ? 'bg-white text-[#050507] border-white/25 font-bold'
                          : 'bg-[#0C0D12] text-slate-400 border-[#1E2028]'
                      }`}
                    >
                      {d}d
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-[10px] font-mono uppercase text-slate-400 block mb-1">
                  Simulation Step Size
                </label>
                <div className="grid grid-cols-4 gap-1">
                  {[1, 6, 12, 24].map((h) => (
                    <button
                      key={h}
                      type="button"
                      onClick={() => setStepHours(h)}
                      className={`h-9 rounded-xl font-mono text-xs border ${
                        stepHours === h
                          ? 'bg-cyan-500/25 text-cyan-300 border-cyan-400 font-bold'
                          : 'bg-[#0C0D12] text-slate-400 border-[#1E2028]'
                      }`}
                    >
                      {h}h
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 pt-1 border-t border-[#1E2028]">
              <span>Simulated Touchdown Epoch: <strong className="text-[#F8FAFC]">{formattedSimDate}</strong></span>
              <span>Samples: {timelineTracks?.steps?.length ?? 0} steps ({stepHours}h cadence)</span>
            </div>
          </div>

          {activeMode === 'timeline' && timelineTracks?.steps && (
            <div className="p-5 rounded-2xl bg-[#050507] border border-[#1E2028] space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-mono uppercase tracking-wider text-white font-bold">
                    4-Track Synchronized Mission Timeline — {selectedSite.name}
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Sunlit: {timelineTracks.summary.sunlitPct}% · Clear DTE: {timelineTracks.summary.dteClearPct}% · Click any time slice to sync global clock.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] font-mono">
                  <span className="text-amber-400">■ Sunlit / Ridge</span>
                  <span className="text-emerald-400">■ Nominal / Clear</span>
                  <span className="text-cyan-400">■ Unobstructed</span>
                  <span className="text-rose-400">■ Blocked / Challenged</span>
                </div>
              </div>

              {[
                {
                  id: 'solar',
                  label: '1. Solar Availability',
                  getColor: (pt) =>
                    pt.solarStatus === 'sunlit'
                      ? 'bg-amber-400'
                      : pt.solarStatus === 'blocked'
                      ? 'bg-amber-600/70'
                      : 'bg-slate-800',
                  getTitle: (pt) =>
                    `Step #${pt.index + 1}: Solar ${pt.solarStatus.toUpperCase()} (${pt.sunElevationDeg.toFixed(1)}° el vs ${pt.sunHorizonDeg.toFixed(1)}° mask)`,
                },
                {
                  id: 'earth',
                  label: '2. Earth Visibility (DTE)',
                  getColor: (pt) =>
                    pt.earthStatus === 'clear'
                      ? 'bg-emerald-400'
                      : pt.earthStatus === 'doubtful'
                      ? 'bg-amber-400'
                      : 'bg-rose-500/80',
                  getTitle: (pt) =>
                    `Step #${pt.index + 1}: Earth ${pt.earthStatus.toUpperCase()} (Margin ${pt.earthMarginDeg.toFixed(1)}°)`,
                },
                {
                  id: 'obstruction',
                  label: '3. Terrain Obstruction',
                  getColor: (pt) =>
                    pt.obstructionStatus === 'unobstructed'
                      ? 'bg-cyan-400'
                      : pt.obstructionStatus === 'grazing'
                      ? 'bg-amber-400'
                      : 'bg-rose-500/80',
                  getTitle: (pt) =>
                    `Step #${pt.index + 1}: Terrain ${pt.obstructionStatus.toUpperCase()}`,
                },
                {
                  id: 'risk',
                  label: '4. Operational Risk',
                  getColor: (pt) =>
                    pt.riskStatus === 'favorable'
                      ? 'bg-emerald-400'
                      : pt.riskStatus === 'conditional'
                      ? 'bg-amber-400'
                      : 'bg-rose-500',
                  getTitle: (pt) =>
                    `Step #${pt.index + 1}: Risk ${pt.riskStatus.toUpperCase()}`,
                },
              ].map((track) => {
                const rawSteps = timelineTracks.steps;
                const maxCells = 96;
                const displaySteps =
                  rawSteps.length <= maxCells
                    ? rawSteps
                    : Array.from({ length: maxCells }, (_, i) => {
                        const start = Math.floor((i * rawSteps.length) / maxCells);
                        const end = Math.min(rawSteps.length, Math.floor(((i + 1) * rawSteps.length) / maxCells));
                        const mid = Math.floor((start + Math.max(start, end - 1)) / 2);
                        return rawSteps[mid];
                      });

                return (
                  <div key={track.id} className="space-y-1">
                    <div className="flex items-center justify-between text-[11px] font-mono text-slate-300">
                      <span>{track.label}</span>
                      <span className="text-[10px] text-slate-400">
                        0h → +{windowDurationDays * 24}h
                      </span>
                    </div>
                    <div className="flex items-center gap-[1px] h-6 rounded-lg overflow-hidden bg-[#0C0D12] p-0.5 border border-[#1E2028]">
                      {displaySteps.map((pt) => (
                        <button
                          key={pt.index}
                          type="button"
                          aria-label={track.getTitle(pt)}
                          onClick={() => {
                            celestialTimeStore.setTime(pt.timeMs, 'timeline-track');
                            notifySuccess(
                              'Clock Synchronized',
                              `Set to ${new Date(pt.timeMs).toUTCString()}`
                            );
                          }}
                          title={track.getTitle(pt)}
                          className={`flex-1 h-full ${track.getColor(pt)} hover:opacity-80 transition-opacity focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white`}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {activeMode === 'whatif' && whatIfDiff && (
            <div className="p-5 rounded-2xl bg-[#050507] border border-[#1E2028] space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-3 border-b border-[#1E2028]">
                <div className="p-3.5 rounded-xl bg-[#0C0D12] border border-cyan-500/40">
                  <div className="text-[10px] font-mono uppercase text-cyan-400">
                    Original Scenario A (Baseline)
                  </div>
                  <div className="text-sm font-bold text-white mt-0.5">
                    {selectedSite.name} · Slip {slipDays >= 0 ? `+${slipDays}d` : `${slipDays}d`}
                  </div>
                  <div className="text-xs font-mono text-slate-300 mt-1">
                    Suitability: <strong className="text-cyan-300">{whatIfDiff.evalA.overallScore}/100 ({whatIfDiff.evalA.suitabilityOutcome})</strong> · Sun {whatIfDiff.evalA.durationOutlook.sunlitRatio}% · DTE {whatIfDiff.evalA.durationOutlook.dteUptimeRatio}%
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-[#0C0D12] border border-purple-500/40 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono uppercase text-purple-300">
                      Alternative Scenario B (What-If Target)
                    </span>
                    <span className="text-xs font-mono font-bold text-purple-300">
                      Score: {whatIfDiff.evalB.overallScore}/100 ({whatIfDiff.scoreDelta >= 0 ? `+${whatIfDiff.scoreDelta}` : whatIfDiff.scoreDelta})
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <select
                      aria-label="Alternative What-If landing site"
                      value={altSiteId}
                      onChange={(e) => setAltSiteId(e.target.value)}
                      className="h-8 px-2 rounded bg-[#050507] border border-slate-700 text-xs font-mono text-white focus:outline-none focus:border-white/40"
                    >
                      {SITES_TO_ANALYZE.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                    <div className="flex items-center gap-1.5 text-xs font-mono">
                      <label htmlFor="whatif-alt-slip-days" className="text-slate-400">Slip:</label>
                      <input
                        id="whatif-alt-slip-days"
                        type="number"
                        min="-15"
                        max="60"
                        value={altSlipDraft}
                        onChange={(e) => {
                          const raw = e.target.value;
                          setAltSlipDraft(raw);
                          const parsed = Number(raw);
                          if (raw !== '' && raw !== '-' && Number.isFinite(parsed)) {
                            setAltSlipDays(Math.max(-15, Math.min(60, Math.round(parsed))));
                          }
                        }}
                        onBlur={() => setAltSlipDraft(String(altSlipDays))}
                        className="w-16 h-8 px-2 rounded bg-[#050507] border border-slate-700 text-white focus:outline-none focus:border-white/40"
                      />
                      <span className="text-slate-400">days</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs font-mono">
                <div className="p-3.5 rounded-xl bg-emerald-950/20 border border-emerald-500/30 space-y-1.5">
                  <div className="font-bold text-emerald-300 uppercase flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>What Improved ({whatIfDiff.improved.length})</span>
                  </div>
                  {whatIfDiff.improved.length > 0 ? (
                    whatIfDiff.improved.map((item, i) => (
                      <div key={i} className="text-slate-200">• {item}</div>
                    ))
                  ) : (
                    <div className="text-slate-400">No metrics improved over Scenario A.</div>
                  )}
                </div>

                <div className="p-3.5 rounded-xl bg-amber-950/20 border border-amber-500/30 space-y-1.5">
                  <div className="font-bold text-amber-300 uppercase flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>What Deteriorated ({whatIfDiff.deteriorated.length})</span>
                  </div>
                  {whatIfDiff.deteriorated.length > 0 ? (
                    whatIfDiff.deteriorated.map((item, i) => (
                      <div key={i} className="text-slate-200">• {item}</div>
                    ))
                  ) : (
                    <div className="text-slate-400">No metrics deteriorated compared to Scenario A.</div>
                  )}
                </div>

                <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-1.5">
                  <div className="font-bold text-slate-300 uppercase">
                    What Remained Unchanged ({whatIfDiff.unchanged.length})
                  </div>
                  {whatIfDiff.unchanged.length > 0 ? (
                    whatIfDiff.unchanged.map((item, i) => (
                      <div key={i} className="text-slate-400">• {item}</div>
                    ))
                  ) : (
                    <div className="text-slate-500">All primary metrics shifted between scenarios.</div>
                  )}
                </div>

                <div className="p-3.5 rounded-xl bg-rose-950/25 border border-rose-500/40 space-y-1.5">
                  <div className="font-bold text-rose-300 uppercase">
                    Newly Introduced Risks ({whatIfDiff.newRisks.length})
                  </div>
                  {whatIfDiff.newRisks.length > 0 ? (
                    whatIfDiff.newRisks.map((item, i) => (
                      <div key={i} className="text-rose-200">• {item}</div>
                    ))
                  ) : (
                    <div className="text-emerald-300">No new engineering constraint violations introduced.</div>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeMode === 'heatmap' && (
            <div className="p-5 rounded-2xl bg-[#050507] border border-[#1E2028] space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 text-[10.5px] font-mono text-[#94A3B8]">
                <span className="text-slate-300 font-semibold">Touchdown Window Score Matrix</span>
                <div className="flex flex-wrap items-center gap-3">
                  <span className="flex items-center gap-1.5 text-[#34D399]">
                    <span className="w-2.5 h-2.5 rounded bg-[#34D399]/25 border border-[#34D399]/40" />
                    <span>≥80% Optimal</span>
                  </span>
                  <span className="flex items-center gap-1.5 text-[#F8FAFC]">
                    <span className="w-2.5 h-2.5 rounded bg-white/[0.08] border border-white/25" />
                    <span>60–79% Conditional</span>
                  </span>
                  <span className="flex items-center gap-1.5 text-rose-400">
                    <span className="w-2.5 h-2.5 rounded bg-rose-500/20 border border-rose-500/30" />
                    <span>&lt;60% Challenged</span>
                  </span>
                  <span className="flex items-center gap-1.5 text-emerald-300">
                    <span className="w-2.5 h-2.5 rounded ring-2 ring-emerald-400" />
                    <span>Best Plan B</span>
                  </span>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse font-mono text-xs">
                  <thead>
                    <tr className="border-b border-[#1E2028] text-[#94A3B8]">
                      <th className="sticky left-0 z-20 bg-[#050507] py-2.5 px-3 font-normal border-r border-[#1E2028]/70">
                        Landing Site
                      </th>
                      {Array.from({ length: windowDurationDays }, (_, i) => (
                        <th key={i} className="py-2.5 px-1.5 text-center font-normal">
                          +{slipDays + i}d
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#16283C]/50">
                    {heatmapMatrix.map((siteRow) => (
                      <tr key={siteRow.id} className="group hover:bg-[#14161D] transition-colors">
                        <td className="sticky left-0 z-10 bg-[#050507] group-hover:bg-[#14161D] transition-colors py-2.5 px-3 font-serif font-medium text-[#F8FAFC] whitespace-nowrap border-r border-[#1E2028]/70">
                          {siteRow.name}
                        </td>
                        {siteRow.dayScores.map((cell) => {
                          const isBestPlanB =
                            bestPlanB &&
                            bestPlanB.site.id === siteRow.id &&
                            bestPlanB.dayOffset === cell.dayOffset;
                          const bgClass =
                            cell.score >= 80
                              ? 'bg-[#34D399]/25 text-[#34D399] border-[#34D399]/40'
                              : cell.score >= 60
                              ? 'bg-white/[0.08] text-[#F8FAFC] border-white/25'
                              : 'bg-rose-500/20 text-rose-400 border-rose-500/30';
                          return (
                            <td key={cell.dayOffset} className="py-2 px-1 text-center">
                              <button
                                type="button"
                                onClick={() => handleSelectCell(siteRow, cell.dayOffset)}
                                aria-label={`${siteRow.name}, Day +${slipDays + cell.dayOffset}: Score ${cell.score}%`}
                                title={`${siteRow.name} (Day +${slipDays + cell.dayOffset}): Score ${cell.score}%`}
                                className={`w-9 h-8 rounded-lg border flex items-center justify-center font-bold text-[11px] transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 ${bgClass} ${
                                  isBestPlanB ? 'ring-2 ring-emerald-400' : ''
                                }`}
                              >
                                {cell.score}
                              </button>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {siteEvaluations.slice(0, 3).map((site) => (
              <div
                key={site.id}
                className={`p-3.5 rounded-2xl border transition-all flex items-center justify-between gap-2 ${
                  selectedSiteId === site.id
                    ? 'bg-[#14161D] border-white/25'
                    : 'bg-[#050507] border-[#1E2028] hover:border-white/30'
                }`}
              >
                <button
                  type="button"
                  aria-pressed={selectedSiteId === site.id}
                  onClick={() => setSelectedSiteId(site.id)}
                  className="flex-1 text-left min-w-0 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
                >
                  <div className="text-xs font-serif font-medium text-[#F8FAFC] truncate">{site.name}</div>
                  <div className="text-[10px] font-mono text-[#94A3B8]">
                    Sun {site.sunlitScore}% · DTE {site.linkStatus === 'clear' ? 'Clear' : 'Blocked'}
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => handleSelectCell(site, 0)}
                  aria-label={`Apply ${site.name} at ${slipDays >= 0 ? `+${slipDays}` : slipDays} days (${site.score}%)`}
                  className="shrink-0 px-2.5 py-1 rounded-lg bg-white/[0.08] hover:bg-white/[0.16] text-[#F8FAFC] border border-white/25 font-mono text-[11px] font-bold flex items-center gap-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
                >
                  <span>{site.score}%</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

