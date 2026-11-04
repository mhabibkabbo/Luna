import React, { useState, useMemo, useEffect } from 'react';
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
import { computeCelestialState, solarPosition } from '../../utils/lunarEphemeris.js';
import { celestialTimeStore } from '../../utils/celestialTime.js';
import { evaluateEarthLink, DEFAULT_DTE_CONSTRAINTS } from '../../utils/earthLink.js';
import { horizonAt, HORIZON_TABLE, ensurePolarDemLoaded } from '../../utils/horizons.js';
import {
  simulateMissionTimelineTracks,
  compareWhatIfScenarios,
  DEFAULT_PLANNER_CONSTRAINTS,
} from '../../utils/plannerEngine.js';
import { notifySuccess } from '../../utils/feedbackStore.js';

const SITES_TO_ANALYZE = [
  { id: 'landing-artemis3-shackleton', name: 'Peak Near Shackleton (A3)', lat: -89.0066, lon: 132.0596, elevationM: 1251, slopeDeg: 9.2, roughnessM: 1.8 },
  { id: 'landing-artemis3-malapert', name: 'Malapert Massif', lat: -85.90, lon: 0.00, elevationM: 5020, slopeDeg: 5.4, roughnessM: 1.4 },
  { id: 'haworth-crater', name: 'Haworth Rim', lat: -87.40, lon: -5.10, elevationM: 1420, slopeDeg: 10.4, roughnessM: 2.1 },
  { id: 'de-gerlache-crater', name: 'De Gerlache Rim', lat: -88.50, lon: -87.10, elevationM: 1640, slopeDeg: 11.2, roughnessM: 2.2 },
  { id: 'amundsen-crater', name: 'Amundsen Plains', lat: -84.50, lon: 82.8, elevationM: -3628, slopeDeg: 6.4, roughnessM: 1.2 },
  { id: 'cabeus-crater', name: 'Cabeus Peak', lat: -84.90, lon: -35.50, elevationM: 1850, slopeDeg: 8.9, roughnessM: 1.7 },
];

const LANDER_PRESETS = [
  {
    id: 'polar-solar',
    name: 'Polar Solar Lander',
    subtitle: 'High Sun Priority (55% Sun / 35% DTE / 10% Slope)',
    weights: { sun: 0.55, dte: 0.35, slope: 0.10 },
  },
  {
    id: 'short-hopper',
    name: 'High-Bandwidth DTE Hopper',
    subtitle: 'Continuous Earth Comms (30% Sun / 55% DTE / 15% Slope)',
    weights: { sun: 0.30, dte: 0.55, slope: 0.15 },
  },
  {
    id: 'rtg-rover',
    name: 'RTG / Cryogenic PSR Rover',
    subtitle: 'Night-Tolerant ISRU (20% Sun / 50% DTE / 30% Slope)',
    weights: { sun: 0.20, dte: 0.50, slope: 0.30 },
  },
];

function evaluateSiteAtEpoch(site, epochMs, presetWeights) {
  const terrainFn = (az) => horizonAt(HORIZON_TABLE, site.id, az, site.lat, site.lon) ?? 0;

  let sunlitSamples = 0;
  let clearDteSamples = 0;
  let lastLink = null;
  const sampleCount = 4;

  for (let s = 0; s < sampleCount; s++) {
    const tMs = epochMs + s * 6 * 3600000;
    const state = computeCelestialState(tMs);
    const flatSun = solarPosition(state, site.lat, site.lon, 0);
    const hSun = terrainFn(flatSun.azimuthDeg);
    const sun = solarPosition(state, site.lat, site.lon, hSun);
    if (sun.status === 'sunlit') sunlitSamples++;

    const link = evaluateEarthLink({
      state,
      moonFeature: { id: site.id, latitude: site.lat, longitude: site.lon },
      earthFeature: null,
      constraints: DEFAULT_DTE_CONSTRAINTS,
      terrainFn,
    });
    if (link.status === 'clear') clearDteSamples++;
    if (s === 0) lastLink = link;
  }

  const sunlitScore = Math.round((sunlitSamples / sampleCount) * 100);
  const dteScore = Math.round((clearDteSamples / sampleCount) * 100);
  const slopeSafetyScore = Math.max(0, Math.min(100, Math.round((1 - (site.slopeDeg || 9) / 22) * 100)));

  const totalScore = Math.round(
    sunlitScore * presetWeights.sun +
    dteScore * presetWeights.dte +
    slopeSafetyScore * presetWeights.slope
  );

  return {
    sunlitScore,
    isSunlit: sunlitScore >= 50,
    linkStatus: lastLink?.status || (dteScore >= 50 ? 'clear' : 'blocked'),
    linkMargin: lastLink?.marginDeg ?? 0,
    dteScore,
    score: Math.min(100, Math.max(0, totalScore)),
  };
}

export default function SlipSimulatorModal({ isOpen, onClose, onSelectSiteAndDate }) {
  const [activeMode, setActiveMode] = useState('timeline'); // 'timeline' | 'whatif' | 'heatmap'
  const [baseTimeMs, setBaseTimeMs] = useState(() => celestialTimeStore.get().ms);
  const [slipDays, setSlipDays] = useState(0); // -15 to +45 days
  const [selectedSiteId, setSelectedSiteId] = useState(SITES_TO_ANALYZE[0].id);
  const [altSiteId, setAltSiteId] = useState(SITES_TO_ANALYZE[1].id);
  const [altSlipDays, setAltSlipDays] = useState(7);
  const [windowDurationDays, setWindowDurationDays] = useState(14); // 7, 14, or 30 days
  const [stepHours, setStepHours] = useState(6); // 1, 6, 12, 24 hours
  const [presetId, setPresetId] = useState(LANDER_PRESETS[0].id);
  const [savedScenarios, setSavedScenarios] = useState([]);
  const [demReadyTick, setDemReadyTick] = useState(0);

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
    return baseTimeMs + slipDays * 24 * 60 * 60 * 1000;
  }, [baseTimeMs, slipDays]);

  // 4-Track Synchronized Mission Timeline (Section 6)
  const timelineTracks = useMemo(() => {
    if (!isOpen) return [];
    return simulateMissionTimelineTracks(
      selectedSite,
      simulatedTimeMs,
      windowDurationDays,
      stepHours
    );
  }, [isOpen, selectedSite, simulatedTimeMs, windowDurationDays, stepHours, demReadyTick]);

  // What-If Scenario Comparator (Section 7)
  const whatIfDiff = useMemo(() => {
    if (!isOpen) return null;
    const altTimeMs = baseTimeMs + altSlipDays * 24 * 60 * 60 * 1000;
    return compareWhatIfScenarios(
      { site: selectedSite, landingMs: simulatedTimeMs, durationDays: windowDurationDays },
      { site: altSite, landingMs: altTimeMs, durationDays: windowDurationDays },
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
    altSlipDays,
    windowDurationDays,
    activePreset,
    demReadyTick,
  ]);

  const siteEvaluations = useMemo(() => {
    return SITES_TO_ANALYZE.map((site) => {
      const ev = evaluateSiteAtEpoch(site, simulatedTimeMs, activePreset.weights);
      return {
        ...site,
        ...ev,
      };
    });
  }, [simulatedTimeMs, activePreset, demReadyTick]);

  const heatmapMatrix = useMemo(() => {
    const daysArray = Array.from({ length: windowDurationDays }, (_, i) => i);
    return SITES_TO_ANALYZE.map((site) => {
      const dayScores = daysArray.map((dayOffset) => {
        const testMs = baseTimeMs + (slipDays + dayOffset) * 24 * 60 * 60 * 1000;
        const ev = evaluateSiteAtEpoch(site, testMs, activePreset.weights);
        return {
          dayOffset,
          score: ev.score,
          sunlit: ev.sunlitScore,
          linkClear: ev.linkStatus === 'clear',
        };
      });
      return { ...site, dayScores };
    });
  }, [baseTimeMs, slipDays, windowDurationDays, activePreset, demReadyTick]);

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
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-md animate-in fade-in duration-150 select-none pointer-events-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative w-full max-w-5xl max-h-[90vh] bg-[#0A111C] border border-[#16283C] rounded-3xl shadow-2xl overflow-hidden flex flex-col text-[#F8FAFC] font-sans">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 border-b border-[#16283C] bg-[#060B13]">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-[#00D2C4]/15 border border-[#00D2C4]/30 text-[#00D2C4]">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[10px] font-mono uppercase tracking-wider text-[#00D2C4]">
                Time-Based Mission Simulator &amp; What-If Analysis
              </div>
              <h2 className="font-serif text-xl font-medium text-[#F8FAFC]">
                4-Track Synchronized Timeline, What-If Comparator &amp; Window Heatmap
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSaveScenario}
              className="px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-cyan-300 font-mono text-xs flex items-center gap-1.5 transition-colors"
            >
              <Bookmark className="w-3.5 h-3.5" />
              <span>Save Scenario</span>
            </button>
            {bestPlanB && (
              <button
                type="button"
                onClick={() => handleSelectCell(bestPlanB.site, bestPlanB.dayOffset)}
                className="px-3 py-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/50 text-emerald-300 font-mono text-xs font-semibold flex items-center gap-1.5 transition-colors"
                title={`Jump to best backup window: ${bestPlanB.site.name}`}
              >
                <Zap className="w-3.5 h-3.5" />
                <span>
                  Plan B: {bestPlanB.site.name} (+{slipDays + bestPlanB.dayOffset}d · {bestPlanB.score}%)
                </span>
              </button>
            )}
            <button
              type="button"
              onClick={handleApplyToGlobalClock}
              className="px-3.5 py-2 rounded-xl bg-[#00D2C4] hover:bg-[#00e6d6] text-[#060B13] font-mono text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-lg"
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Sync Global Clock</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-full text-[#94A3B8] hover:text-white hover:bg-[#16283C] transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Mode Sub-Navigation Bar */}
        <div className="px-6 py-2.5 bg-[#070d17] border-b border-[#16283C] flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
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
                  type="button"
                  onClick={() => setActiveMode(tab.id)}
                  className={`px-3.5 py-1.5 rounded-xl font-mono text-xs flex items-center gap-1.5 border transition-colors ${
                    isAct
                      ? 'bg-[#00D2C4]/20 border-[#00D2C4] text-[#00D2C4] font-bold'
                      : 'bg-[#0A111C] border-[#16283C] text-slate-400 hover:text-white'
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

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Shared Top Controls: Site, Slip Slider, Window Duration & Step Size */}
          <div className="p-4 rounded-2xl bg-[#060B13] border border-[#16283C] space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div>
                <label className="text-[10px] font-mono uppercase text-slate-400 block mb-1">
                  Primary Candidate Site (Scenario A)
                </label>
                <select
                  value={selectedSiteId}
                  onChange={(e) => setSelectedSiteId(e.target.value)}
                  className="w-full h-9 px-2.5 rounded-xl bg-[#0A111C] border border-[#16283C] text-xs font-mono text-white"
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
                  className="w-full accent-[#00D2C4] cursor-pointer mt-2"
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
                          ? 'bg-[#00D2C4] text-[#060B13] border-[#00D2C4] font-bold'
                          : 'bg-[#0A111C] text-slate-400 border-[#16283C]'
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
                          : 'bg-[#0A111C] text-slate-400 border-[#16283C]'
                      }`}
                    >
                      {h}h
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 pt-1 border-t border-[#16283C]">
              <span>Simulated Touchdown Epoch: <strong className="text-[#00D2C4]">{formattedSimDate}</strong></span>
              <span>Samples: {timelineTracks?.steps?.length ?? 0} steps ({stepHours}h cadence)</span>
            </div>
          </div>

          {/* ================================================================= */}
          {/* VIEW 1: 4-TRACK SYNCHRONIZED MISSION TIMELINE (Section 6)         */}
          {/* ================================================================= */}
          {activeMode === 'timeline' && timelineTracks?.steps && (
            <div className="p-5 rounded-2xl bg-[#060B13] border border-[#16283C] space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-mono uppercase tracking-wider text-white font-bold">
                    4-Track Synchronized Mission Timeline — {selectedSite.name}
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Sunlit: {timelineTracks.summary.sunlitPct}% · Clear DTE: {timelineTracks.summary.dteClearPct}% · Click any time slice to sync global clock.
                  </p>
                </div>
                <div className="flex items-center gap-3 text-[10px] font-mono">
                  <span className="text-emerald-400">■ Nominal / Clear</span>
                  <span className="text-amber-400">■ Marginal / Grazing</span>
                  <span className="text-rose-400">■ Blocked / Challenging</span>
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
              ].map((track) => (
                <div key={track.id} className="space-y-1">
                  <div className="flex items-center justify-between text-[11px] font-mono text-slate-300">
                    <span>{track.label}</span>
                    <span className="text-[10px] text-slate-400">
                      0h → +{windowDurationDays * 24}h
                    </span>
                  </div>
                  <div className="flex items-center gap-[1px] h-6 rounded-lg overflow-hidden bg-[#0A111C] p-0.5 border border-[#16283C]">
                    {timelineTracks.steps.slice(0, 120).map((pt) => (
                      <button
                        key={pt.index}
                        type="button"
                        onClick={() => {
                          celestialTimeStore.setTime(pt.timeMs, 'timeline-track');
                          notifySuccess(
                            'Clock Synchronized',
                            `Set to ${new Date(pt.timeMs).toUTCString()}`
                          );
                        }}
                        title={track.getTitle(pt)}
                        className={`flex-1 h-full ${track.getColor(pt)} hover:opacity-80 transition-opacity`}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ================================================================= */}
          {/* VIEW 2: WHAT-IF SCENARIO COMPARATOR (Section 7)                   */}
          {/* ================================================================= */}
          {activeMode === 'whatif' && whatIfDiff && (
            <div className="p-5 rounded-2xl bg-[#060B13] border border-[#16283C] space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-3 border-b border-[#16283C]">
                <div className="p-3.5 rounded-xl bg-[#0A111C] border border-cyan-500/40">
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

                <div className="p-3.5 rounded-xl bg-[#0A111C] border border-purple-500/40 space-y-2">
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
                      value={altSiteId}
                      onChange={(e) => setAltSiteId(e.target.value)}
                      className="h-8 px-2 rounded bg-[#060B13] border border-slate-700 text-xs font-mono text-white"
                    >
                      {SITES_TO_ANALYZE.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                    <div className="flex items-center gap-1.5 text-xs font-mono">
                      <span className="text-slate-400">Slip:</span>
                      <input
                        type="number"
                        min="-15"
                        max="60"
                        value={altSlipDays}
                        onChange={(e) => setAltSlipDays(Number(e.target.value) || 0)}
                        className="w-16 h-8 px-2 rounded bg-[#060B13] border border-slate-700 text-white"
                      />
                      <span className="text-slate-400">days</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* 4-Column What-If Delta Breakdown */}
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

          {/* ================================================================= */}
          {/* VIEW 3: MULTI-SITE LAUNCH WINDOW HEATMAP                          */}
          {/* ================================================================= */}
          {activeMode === 'heatmap' && (
            <div className="p-5 rounded-2xl bg-[#060B13] border border-[#16283C] space-y-4">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse font-mono text-xs">
                  <thead>
                    <tr className="border-b border-[#16283C] text-[#94A3B8]">
                      <th className="py-2.5 px-3 font-normal">Landing Site</th>
                      {Array.from({ length: windowDurationDays }, (_, i) => (
                        <th key={i} className="py-2.5 px-1.5 text-center font-normal">
                          +{slipDays + i}d
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#16283C]/50">
                    {heatmapMatrix.map((siteRow) => (
                      <tr key={siteRow.id} className="hover:bg-[#0F1C2E] transition-colors">
                        <td className="py-2.5 px-3 font-serif font-medium text-[#F8FAFC] whitespace-nowrap">
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
                              ? 'bg-[#00D2C4]/25 text-[#00D2C4] border-[#00D2C4]/40'
                              : 'bg-rose-500/20 text-rose-400 border-rose-500/30';
                          return (
                            <td key={cell.dayOffset} className="py-2 px-1 text-center">
                              <button
                                type="button"
                                onClick={() => handleSelectCell(siteRow, cell.dayOffset)}
                                title={`${siteRow.name} (Day +${slipDays + cell.dayOffset}): Score ${cell.score}%`}
                                className={`w-9 h-8 rounded-lg border flex items-center justify-center font-bold text-[11px] transition-transform hover:scale-110 ${bgClass} ${
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

          {/* Site Viability Comparison Grid at Current Slip */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {siteEvaluations.slice(0, 3).map((site) => (
              <div
                key={site.id}
                onClick={() => setSelectedSiteId(site.id)}
                className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-2 ${
                  selectedSiteId === site.id
                    ? 'bg-[#0F1C2E] border-[#00D2C4]'
                    : 'bg-[#060B13] border-[#16283C] hover:border-[#22D3EE]/40'
                }`}
              >
                <div>
                  <div className="text-xs font-serif font-medium text-[#F8FAFC]">{site.name}</div>
                  <div className="text-[10px] font-mono text-[#94A3B8]">
                    Sun {site.sunlitScore}% · DTE {site.linkStatus === 'clear' ? 'Clear' : 'Blocked'}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSelectCell(site, 0);
                  }}
                  className="px-2.5 py-1 rounded-lg bg-[#00D2C4]/15 text-[#00D2C4] border border-[#00D2C4]/30 font-mono text-[11px] font-bold flex items-center gap-1"
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

