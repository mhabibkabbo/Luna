import React, { useState, useMemo, useEffect } from 'react';
import {
  X,
  GitCompare,
  Navigation,
  ExternalLink,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Sun,
  Radio,
  Zap,
  Calendar,
  Lock,
  Unlock,
  ChevronRight,
  Layers,
  MapPin,
  TrendingUp,
  Sliders,
  Sparkles,
  Copy,
  Check,
} from 'lucide-react';
import { CLPS_MISSIONS } from '../../data/clpsMissions.js';
import { LANDING_SITES } from '../../data/landingSites.js';
import { computeCelestialState, solarPosition } from '../../utils/lunarEphemeris.js';
import { evaluateEarthLink, DEFAULT_DTE_CONSTRAINTS } from '../../utils/earthLink.js';
import {
  calculateSolarTransition,
  calculateEarthTransition,
  formatDuration,
} from '../../utils/transitionTimes.js';
import { horizonAt, HORIZON_TABLE, getHorizonProfile } from '../../utils/horizons.js';
import { sweepIllumination } from '../../utils/illumination.js';
import { sweepEarthLink } from '../../utils/earthLink.js';
import { celestialTimeStore } from '../../utils/celestialTime.js';
import { notifySuccess, notifyInfo } from '../../utils/feedbackStore.js';

// Curated Landing Site options with categorized grouping
const ALL_SITES = [
  ...LANDING_SITES.map((s) => ({
    id: s.id,
    name: s.name,
    latitude: s.latitude,
    longitude: s.longitude,
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
  })),
];

// Quick date/time scenario presets
const DATE_PRESETS = [
  { label: 'Now (Live)', getMs: () => Date.now() },
  { label: 'Artemis III Target (Sep 2026)', getMs: () => Date.parse('2026-09-20T12:00:00Z') },
  { label: 'South Pole Summer (Dec Solstice)', getMs: () => Date.parse('2026-12-21T12:00:00Z') },
  { label: 'South Pole Winter (Jun Solstice)', getMs: () => Date.parse('2026-06-21T12:00:00Z') },
  { label: '+14 Days (Half Lunation)', getMs: (base) => base + 14 * 86400000 },
  { label: '+28 Days (Full Lunation)', getMs: (base) => base + 28 * 86400000 },
];

const toInputValue = (ms) => new Date(ms).toISOString().slice(0, 16);
const fromInputValue = (value) => {
  const ms = Date.parse(`${value}:00Z`);
  return Number.isNaN(ms) ? null : ms;
};

export default function MissionComparisonModal({
  isOpen,
  onClose,
  initialMissionA,
  onSelectMission,
}) {
  // Mode: 'sites' (Compare 2 sites on same date) vs 'dates' (Compare 1 site on 2 alternative dates) vs 'manifest' (Payload specs)
  const [comparisonMode, setComparisonMode] = useState('sites');

  // Site Selection
  const [siteAId, setSiteAId] = useState(() => initialMissionA?.id || 'landing-artemis3-shackleton');
  const [siteBId, setSiteBId] = useState('landing-artemis3-malapert');

  // Custom coordinates state
  const [customLatA, setCustomLatA] = useState('-89.70');
  const [customLonA, setCustomLonA] = useState('120.00');
  const [customLatB, setCustomLatB] = useState('-85.90');
  const [customLonB, setCustomLonB] = useState('0.00');

  // Time / Date Selection for Scenario A and B
  const [dateAMs, setDateAMs] = useState(() => celestialTimeStore.get().ms);
  const [dateBMs, setDateBMs] = useState(() => celestialTimeStore.get().ms + 14 * 86400000);
  const [syncDates, setSyncDates] = useState(true);

  // 30-day forecast outlook caches
  const [outlookA, setOutlookA] = useState(null);
  const [outlookB, setOutlookB] = useState(null);

  useEffect(() => {
    if (initialMissionA?.id) {
      setSiteAId(initialMissionA.id);
    }
  }, [initialMissionA]);

  // Handle Date Sync
  const handleDateAChange = (ms) => {
    setDateAMs(ms);
    if (syncDates && comparisonMode === 'sites') {
      setDateBMs(ms);
    }
  };

  const handleDateBChange = (ms) => {
    setDateBMs(ms);
    if (syncDates && comparisonMode === 'sites') {
      setSyncDates(false);
    }
  };

  // Resolve Site A object
  const siteA = useMemo(() => {
    if (siteAId === 'custom') {
      const lat = parseFloat(customLatA) || 0;
      const lon = parseFloat(customLonA) || 0;
      return {
        id: 'custom-a',
        name: `Custom Target A (${lat.toFixed(2)}°, ${lon.toFixed(2)}°)`,
        latitude: lat,
        longitude: lon,
        category: 'Custom Coordinates',
        agency: 'User Waypoint',
        description: 'User specified selenographic landing target.',
      };
    }
    return ALL_SITES.find((s) => s.id === siteAId) || ALL_SITES[0];
  }, [siteAId, customLatA, customLonA]);

  // Resolve Site B object
  const siteB = useMemo(() => {
    if (comparisonMode === 'dates') {
      // In date comparison mode, Site B is identical to Site A
      return siteA;
    }
    if (siteBId === 'custom') {
      const lat = parseFloat(customLatB) || 0;
      const lon = parseFloat(customLonB) || 0;
      return {
        id: 'custom-b',
        name: `Custom Target B (${lat.toFixed(2)}°, ${lon.toFixed(2)}°)`,
        latitude: lat,
        longitude: lon,
        category: 'Custom Coordinates',
        agency: 'User Waypoint',
        description: 'User specified selenographic landing target.',
      };
    }
    return ALL_SITES.find((s) => s.id === siteBId) || ALL_SITES[1];
  }, [comparisonMode, siteA, siteBId, customLatB, customLonB]);

  // Compute live ephemeris metrics for Scenario A
  const metricsA = useMemo(() => {
    const lat = siteA.latitude;
    const lon = siteA.longitude;
    const id = siteA.id;
    const solar = calculateSolarTransition(dateAMs, lat, lon, id);
    const earth = calculateEarthTransition(dateAMs, siteA, null, DEFAULT_DTE_CONSTRAINTS);
    const profile = getHorizonProfile(HORIZON_TABLE, id);

    return { solar, earth, profile };
  }, [siteA, dateAMs]);

  // Compute live ephemeris metrics for Scenario B
  const metricsB = useMemo(() => {
    const targetMs = comparisonMode === 'sites' && syncDates ? dateAMs : dateBMs;
    const lat = siteB.latitude;
    const lon = siteB.longitude;
    const id = siteB.id;
    const solar = calculateSolarTransition(targetMs, lat, lon, id);
    const earth = calculateEarthTransition(targetMs, siteB, null, DEFAULT_DTE_CONSTRAINTS);
    const profile = getHorizonProfile(HORIZON_TABLE, id);

    return { solar, earth, profile };
  }, [siteB, comparisonMode, syncDates, dateAMs, dateBMs]);

  // 30-day outlook calculation for Site A
  useEffect(() => {
    const controller = new AbortController();
    const terrainFn = (az) => horizonAt(HORIZON_TABLE, siteA.id, az);

    Promise.all([
      sweepIllumination({
        key: siteA.id,
        lat: siteA.latitude,
        lon: siteA.longitude,
        horizonFn: (az) => terrainFn(az) ?? 0,
        startMs: dateAMs,
        days: 30,
        stepMin: 60,
        signal: controller.signal,
      }),
      sweepEarthLink({
        moonFeature: siteA,
        earthFeature: null,
        startMs: dateAMs,
        days: 30,
        stepMin: 60,
        constraints: DEFAULT_DTE_CONSTRAINTS,
        terrainFn,
        signal: controller.signal,
      }),
    ])
      .then(([illum, dte]) => {
        if (!illum || !dte) return;
        setOutlookA({
          sunlitPct: illum.sunlitPct,
          longestDarkHours: illum.longestDarkHours,
          dteLinkPct: (dte.visibility.filter((s) => s === 'clear').length / dte.visibility.length) * 100,
        });
      })
      .catch(() => {});

    return () => controller.abort();
  }, [siteA, dateAMs]);

  // 30-day outlook calculation for Site B
  useEffect(() => {
    const targetMs = comparisonMode === 'sites' && syncDates ? dateAMs : dateBMs;
    const controller = new AbortController();
    const terrainFn = (az) => horizonAt(HORIZON_TABLE, siteB.id, az);

    Promise.all([
      sweepIllumination({
        key: siteB.id,
        lat: siteB.latitude,
        lon: siteB.longitude,
        horizonFn: (az) => terrainFn(az) ?? 0,
        startMs: targetMs,
        days: 30,
        stepMin: 60,
        signal: controller.signal,
      }),
      sweepEarthLink({
        moonFeature: siteB,
        earthFeature: null,
        startMs: targetMs,
        days: 30,
        stepMin: 60,
        constraints: DEFAULT_DTE_CONSTRAINTS,
        terrainFn,
        signal: controller.signal,
      }),
    ])
      .then(([illum, dte]) => {
        if (!illum || !dte) return;
        setOutlookB({
          sunlitPct: illum.sunlitPct,
          longestDarkHours: illum.longestDarkHours,
          dteLinkPct: (dte.visibility.filter((s) => s === 'clear').length / dte.visibility.length) * 100,
        });
      })
      .catch(() => {});

    return () => controller.abort();
  }, [siteB, comparisonMode, syncDates, dateAMs, dateBMs]);

  if (!isOpen) return null;

  const dateBEffectiveMs = comparisonMode === 'sites' && syncDates ? dateAMs : dateBMs;

  const handleCopyBriefing = () => {
    const briefingText = [
      `# NASA Space Apps Challenge · Lunar Landing Site Navigator Briefing`,
      `Evaluation Mode: ${comparisonMode === 'sites' ? 'Dual Site Comparison' : 'Schedule Shift Analysis'}`,
      ``,
      `## Scenario A: ${siteA.name}`,
      `- Coordinates: ${siteA.latitude.toFixed(4)}°, ${siteA.longitude.toFixed(4)}°`,
      `- Evaluated Date: ${new Date(dateAMs).toISOString()}`,
      `- Solar Status: ${metricsA.solar.isCurrentlySunlit ? 'Illuminated' : 'Dark/Shadow'} (Elevation: ${metricsA.solar.solarElevationDeg.toFixed(2)}°, Power Potential: ${metricsA.solar.powerEfficiencyPct}%)`,
      `- Next Solar Event: ${metricsA.solar.nextEvent === 'sunset' ? 'Sunset' : 'Sunrise'} in ${metricsA.solar.formattedDuration}`,
      `- Direct Earth Link: ${metricsA.earth.isLinked ? 'Available' : 'Blocked'} (Elevation: ${metricsA.earth.earthElevationDeg.toFixed(1)}°, Link Margin: ${metricsA.earth.linkMarginDeg.toFixed(1)}°)`,
      ``,
      `## Scenario B: ${siteB.name}`,
      `- Coordinates: ${siteB.latitude.toFixed(4)}°, ${siteB.longitude.toFixed(4)}°`,
      `- Evaluated Date: ${new Date(dateBEffectiveMs).toISOString()}`,
      `- Solar Status: ${metricsB.solar.isCurrentlySunlit ? 'Illuminated' : 'Dark/Shadow'} (Elevation: ${metricsB.solar.solarElevationDeg.toFixed(2)}°, Power Potential: ${metricsB.solar.powerEfficiencyPct}%)`,
      `- Next Solar Event: ${metricsB.solar.nextEvent === 'sunset' ? 'Sunset' : 'Sunrise'} in ${metricsB.solar.formattedDuration}`,
      `- Direct Earth Link: ${metricsB.earth.isLinked ? 'Available' : 'Blocked'} (Elevation: ${metricsB.earth.earthElevationDeg.toFixed(1)}°, Link Margin: ${metricsB.earth.linkMarginDeg.toFixed(1)}°)`,
      ``,
      `## Mission Planning Trade-off Verdict`,
      `- Solar: ${metricsA.solar.isCurrentlySunlit && metricsB.solar.isCurrentlySunlit ? `Both scenarios illuminated. Scenario ${metricsA.solar.solarElevationDeg > metricsB.solar.solarElevationDeg ? 'A' : 'B'} provides +${Math.abs(metricsA.solar.solarElevationDeg - metricsB.solar.solarElevationDeg).toFixed(2)}° higher solar elevation above terrain.` : metricsA.solar.isCurrentlySunlit ? 'Scenario A illuminated, Scenario B in shadow.' : metricsB.solar.isCurrentlySunlit ? 'Scenario B illuminated, Scenario A in shadow.' : 'Both scenarios currently unlit.'}`,
      `- Direct Earth Link: ${metricsA.earth.isLinked && metricsB.earth.isLinked ? `Both support direct DTE line-of-sight.` : metricsA.earth.isLinked ? 'Scenario A maintains direct DTE; Scenario B blocked.' : metricsB.earth.isLinked ? 'Scenario B maintains direct DTE; Scenario A blocked.' : 'Direct Earth communication blocked at both sites.'}`,
    ].join('\n');

    if (navigator.clipboard) {
      navigator.clipboard.writeText(briefingText).then(() => {
        notifySuccess('Briefing Copied to Clipboard', 'Full mission comparison analysis copied in Markdown format.');
      });
    }
  };

  const handleApplyPreset = (preset) => {
    handleDateAChange(preset.getMs(dateAMs));
    notifyInfo('Scenario Preset Applied', `Loaded date: ${preset.label}`);
  };

  return (
    <div
      id="mission-comparison-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-150 select-none pointer-events-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative w-full max-w-5xl max-h-[94vh] flex flex-col bg-[#050811] border border-slate-800 rounded-2xl shadow-2xl overflow-hidden text-slate-100 font-sans">
        {/* Header */}
        <div className="flex items-center justify-between p-3.5 sm:p-4 border-b border-slate-800 bg-[#070d18]/90">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-cyan-950/80 border border-cyan-500/40 flex items-center justify-center text-cyan-300 shadow-md">
              <GitCompare className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white tracking-tight">
                  Lunar Landing Site Navigator
                </h2>
                <span className="hidden sm:inline text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-500/30">
                  NASA Space Apps Challenge
                </span>
              </div>
              <p className="text-[11px] font-mono text-cyan-400/90">
                Rapid Scenario Evaluation · Sun & Earth Positions Relative to Horizon · Power & Direct-to-Earth Link
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopyBriefing}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-200 hover:text-white border border-slate-700 text-xs font-semibold transition-colors shadow-sm"
              title="Copy full comparison briefing report to clipboard"
            >
              <Copy className="w-3.5 h-3.5 text-cyan-400" />
              <span>Copy Briefing</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
              aria-label="Close navigator"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Mode Selector Tabs */}
        <div className="px-4 py-2 border-b border-slate-800/80 bg-[#060b14] flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center p-1 rounded-xl bg-slate-900 border border-slate-800">
            <button
              type="button"
              onClick={() => {
                setComparisonMode('sites');
                notifyInfo('Mode: Compare 2 Sites', 'Evaluate two candidate lunar landing locations simultaneously.');
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                comparisonMode === 'sites'
                  ? 'bg-cyan-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <MapPin className="w-3.5 h-3.5" />
              <span>Compare 2 Landing Sites</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setComparisonMode('dates');
                setSyncDates(false);
                notifyInfo('Mode: Schedule Shift Analysis', 'Compare one site across two alternative launch dates.');
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                comparisonMode === 'dates'
                  ? 'bg-cyan-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>Compare 2 Dates (Schedule Shift)</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setComparisonMode('manifest');
                notifyInfo('Mode: Spacecraft Manifest', 'Inspect payloads and scientific instrumentation specifications.');
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                comparisonMode === 'manifest'
                  ? 'bg-cyan-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Spacecraft & Manifests</span>
            </button>
          </div>

          {/* Quick Date Presets */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] font-mono text-slate-500 uppercase">Presets:</span>
            {DATE_PRESETS.map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={() => handleApplyPreset(p)}
                className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-cyan-300 border border-slate-800 transition-colors"
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Side-by-Side Target Selectors & Date Controllers */}
        <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-slate-800 border-b border-slate-800 bg-[#060b14]">
          {/* Scenario A: Site & Date */}
          <div className="p-3.5 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-cyan-400" />
                Scenario A · Target Site
              </span>
              <span className="text-[10px] font-mono text-slate-400">
                {siteA.latitude.toFixed(2)}°, {siteA.longitude.toFixed(2)}°
              </span>
            </div>

            <select
              value={siteAId}
              onChange={(e) => setSiteAId(e.target.value)}
              className="w-full h-9 px-3 bg-slate-900 border border-slate-800 rounded-xl text-xs font-semibold text-white focus:outline-none focus:border-cyan-500/80 cursor-pointer"
            >
              <optgroup label="Artemis South Pole Candidates">
                {ALL_SITES.filter((s) => s.category === 'Artemis South Pole Candidates').map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.latitude.toFixed(1)}°S)
                  </option>
                ))}
              </optgroup>
              <optgroup label="NASA CLPS Missions">
                {ALL_SITES.filter((s) => s.category === 'NASA CLPS Missions').map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Apollo Crewed Sites">
                {ALL_SITES.filter((s) => s.category === 'Apollo Crewed Landings').map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Robotic & International Probes">
                {ALL_SITES.filter((s) => s.category === 'Robotic & International Probes').map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </optgroup>
              <option value="custom">📍 Custom Lunar Coordinates...</option>
            </select>

            {siteAId === 'custom' && (
              <div className="grid grid-cols-2 gap-2 p-2 rounded-lg bg-slate-950 border border-slate-800">
                <div>
                  <label className="text-[9.5px] text-slate-400 block mb-0.5">Latitude (-90° to 90°)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={customLatA}
                    onChange={(e) => setCustomLatA(e.target.value)}
                    className="w-full h-7 px-2 bg-slate-900 border border-slate-800 rounded text-xs text-white"
                  />
                </div>
                <div>
                  <label className="text-[9.5px] text-slate-400 block mb-0.5">Longitude (-180° to 180°)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={customLonA}
                    onChange={(e) => setCustomLonA(e.target.value)}
                    className="w-full h-7 px-2 bg-slate-900 border border-slate-800 rounded text-xs text-white"
                  />
                </div>
              </div>
            )}

            {/* Date Picker A */}
            <div className="flex items-center gap-2 pt-1">
              <Clock className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
              <input
                type="datetime-local"
                value={toInputValue(dateAMs)}
                onChange={(e) => {
                  const ms = fromInputValue(e.target.value);
                  if (ms) handleDateAChange(ms);
                }}
                className="flex-1 h-8 px-2 bg-slate-900 border border-slate-800 rounded-lg text-xs font-mono text-white focus:outline-none focus:border-cyan-500"
                style={{ colorScheme: 'dark' }}
              />
              <span className="text-[10px] font-mono text-slate-400">UTC</span>
            </div>
          </div>

          {/* Scenario B: Site & Date */}
          <div className="p-3.5 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-blue-400 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-blue-400" />
                {comparisonMode === 'dates' ? 'Scenario B · Alternative Date (Same Site)' : 'Scenario B · Target Site'}
              </span>
              <div className="flex items-center gap-2">
                {comparisonMode === 'sites' && (
                  <button
                    type="button"
                    onClick={() => {
                      setSyncDates(!syncDates);
                      if (!syncDates) setDateBMs(dateAMs);
                    }}
                    className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono transition-colors ${
                      syncDates
                        ? 'bg-cyan-950 text-cyan-300 border border-cyan-500/40'
                        : 'bg-slate-900 text-slate-400 border border-slate-800 hover:text-white'
                    }`}
                    title="Lock both scenarios to the exact same date"
                  >
                    {syncDates ? <Lock className="w-2.5 h-2.5" /> : <Unlock className="w-2.5 h-2.5" />}
                    <span>{syncDates ? 'Dates Locked' : 'Independent Dates'}</span>
                  </button>
                )}
                <span className="text-[10px] font-mono text-slate-400">
                  {siteB.latitude.toFixed(2)}°, {siteB.longitude.toFixed(2)}°
                </span>
              </div>
            </div>

            {comparisonMode === 'dates' ? (
              <div className="h-9 px-3 flex items-center justify-between bg-slate-900/60 border border-slate-800 rounded-xl text-xs font-semibold text-slate-300">
                <span>{siteA.name}</span>
                <span className="text-[10px] font-mono text-cyan-400">Evaluating Date Shift</span>
              </div>
            ) : (
              <select
                value={siteBId}
                onChange={(e) => setSiteBId(e.target.value)}
                className="w-full h-9 px-3 bg-slate-900 border border-slate-800 rounded-xl text-xs font-semibold text-white focus:outline-none focus:border-cyan-500/80 cursor-pointer"
              >
                <optgroup label="Artemis South Pole Candidates">
                  {ALL_SITES.filter((s) => s.category === 'Artemis South Pole Candidates').map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.latitude.toFixed(1)}°S)
                    </option>
                  ))}
                </optgroup>
                <optgroup label="NASA CLPS Missions">
                  {ALL_SITES.filter((s) => s.category === 'NASA CLPS Missions').map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Apollo Crewed Sites">
                  {ALL_SITES.filter((s) => s.category === 'Apollo Crewed Landings').map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Robotic & International Probes">
                  {ALL_SITES.filter((s) => s.category === 'Robotic & International Probes').map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </optgroup>
                <option value="custom">📍 Custom Lunar Coordinates...</option>
              </select>
            )}

            {comparisonMode !== 'dates' && siteBId === 'custom' && (
              <div className="grid grid-cols-2 gap-2 p-2 rounded-lg bg-slate-950 border border-slate-800">
                <div>
                  <label className="text-[9.5px] text-slate-400 block mb-0.5">Latitude (-90° to 90°)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={customLatB}
                    onChange={(e) => setCustomLatB(e.target.value)}
                    className="w-full h-7 px-2 bg-slate-900 border border-slate-800 rounded text-xs text-white"
                  />
                </div>
                <div>
                  <label className="text-[9.5px] text-slate-400 block mb-0.5">Longitude (-180° to 180°)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={customLonB}
                    onChange={(e) => setCustomLonB(e.target.value)}
                    className="w-full h-7 px-2 bg-slate-900 border border-slate-800 rounded text-xs text-white"
                  />
                </div>
              </div>
            )}

            {/* Date Picker B */}
            <div className="flex items-center gap-2 pt-1">
              <Clock className="w-3.5 h-3.5 text-blue-400 shrink-0" />
              <input
                type="datetime-local"
                value={toInputValue(dateBEffectiveMs)}
                disabled={comparisonMode === 'sites' && syncDates}
                onChange={(e) => {
                  const ms = fromInputValue(e.target.value);
                  if (ms) handleDateBChange(ms);
                }}
                className="flex-1 h-8 px-2 bg-slate-900 border border-slate-800 rounded-lg text-xs font-mono text-white focus:outline-none focus:border-cyan-500 disabled:opacity-50"
                style={{ colorScheme: 'dark' }}
              />
              <span className="text-[10px] font-mono text-slate-400">UTC</span>
            </div>
          </div>
        </div>

        {/* Matrix Content Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar text-xs">
          {/* Top Quick Action Buttons: Fly To Map buttons */}
          <div className="grid grid-cols-2 gap-4 pb-2 border-b border-slate-800/80">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white truncate">{siteA.name}</h3>
                <span className="text-[10px] text-slate-400">{siteA.category}</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  onSelectMission(siteA);
                  onClose();
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-gradient-to-r from-cyan-600 to-blue-600 rounded-lg hover:brightness-110 shadow-sm"
              >
                <Navigation className="w-3 h-3" />
                <span>Fly to Site A</span>
              </button>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white truncate">{siteB.name}</h3>
                <span className="text-[10px] text-slate-400">
                  {comparisonMode === 'dates' ? 'Alternative Date Window' : siteB.category}
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  onSelectMission(siteB);
                  onClose();
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-gradient-to-r from-blue-600 to-indigo-600 rounded-lg hover:brightness-110 shadow-sm"
              >
                <Navigation className="w-3 h-3" />
                <span>Fly to Site B</span>
              </button>
            </div>
          </div>

          {/* Section 1: Solar Illumination & Power Generation Potential */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-wider text-amber-400 font-bold">
                <Sun className="w-3.5 h-3.5 text-amber-400" />
                <span>1. Solar Illumination &amp; Power Generation</span>
              </div>
              <span className="text-[10px] text-slate-500 font-mono">LOLA DEM Topographic Horizons</span>
            </div>

            {/* Side-by-side Solar Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Solar A */}
              <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${
                    metricsA.solar.isCurrentlySunlit
                      ? 'bg-emerald-950/80 text-emerald-300 border-emerald-500/40'
                      : 'bg-rose-950/80 text-rose-300 border-rose-500/40'
                  }`}>
                    {metricsA.solar.isCurrentlySunlit ? 'Sunlit' : (metricsA.solar.currentStatus === 'blocked' ? 'Blocked by Terrain' : 'Night')}
                  </span>
                  <span className="text-[10px] font-mono text-amber-300 font-bold">
                    Power Potential: {metricsA.solar.powerEfficiencyPct}%
                  </span>
                </div>

                {/* Sunset / Sunrise Countdown Banner */}
                <div className="p-2 rounded-lg bg-black/50 border border-slate-800 font-mono">
                  <div className="text-[9.5px] uppercase text-slate-400 font-sans">
                    {metricsA.solar.nextEvent === 'sunset' ? 'Time Remaining Until Sunset' : 'Time Remaining Until Sunrise'}
                  </div>
                  <div className="text-base font-bold text-white mt-0.5">
                    {metricsA.solar.formattedDuration}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 font-mono text-[11px] pt-1">
                  <div>
                    <span className="text-[9px] text-slate-500 block font-sans">Sun Elevation</span>
                    <span className="font-bold text-white">{metricsA.solar.solarElevationDeg.toFixed(2)}°</span>
                  </div>
                  <div>
                    <span className="text-[9px] text-slate-500 block font-sans">Sun Azimuth</span>
                    <span className="font-bold text-white">{metricsA.solar.solarAzimuthDeg.toFixed(1)}°</span>
                  </div>
                  <div>
                    <span className="text-[9px] text-slate-500 block font-sans">Terrain Horizon</span>
                    <span className="font-bold text-white">
                      {metricsA.solar.terrainHorizonDeg !== null ? `${metricsA.solar.terrainHorizonDeg.toFixed(1)}°` : '0.0°'}
                    </span>
                  </div>
                </div>

                {outlookA && (
                  <div className="pt-2 border-t border-slate-800/80 text-[10px] font-mono text-slate-400 flex items-center justify-between">
                    <span>30-Day Sunlight: <strong className="text-amber-300">{outlookA.sunlitPct.toFixed(0)}%</strong></span>
                    <span>Max Dark: <strong className="text-slate-200">{outlookA.longestDarkHours.toFixed(1)} h</strong></span>
                  </div>
                )}
              </div>

              {/* Solar B */}
              <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${
                    metricsB.solar.isCurrentlySunlit
                      ? 'bg-emerald-950/80 text-emerald-300 border-emerald-500/40'
                      : 'bg-rose-950/80 text-rose-300 border-rose-500/40'
                  }`}>
                    {metricsB.solar.isCurrentlySunlit ? 'Sunlit' : (metricsB.solar.currentStatus === 'blocked' ? 'Blocked by Terrain' : 'Night')}
                  </span>
                  <span className="text-[10px] font-mono text-amber-300 font-bold">
                    Power Potential: {metricsB.solar.powerEfficiencyPct}%
                  </span>
                </div>

                {/* Sunset / Sunrise Countdown Banner */}
                <div className="p-2 rounded-lg bg-black/50 border border-slate-800 font-mono">
                  <div className="text-[9.5px] uppercase text-slate-400 font-sans">
                    {metricsB.solar.nextEvent === 'sunset' ? 'Time Remaining Until Sunset' : 'Time Remaining Until Sunrise'}
                  </div>
                  <div className="text-base font-bold text-white mt-0.5">
                    {metricsB.solar.formattedDuration}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 font-mono text-[11px] pt-1">
                  <div>
                    <span className="text-[9px] text-slate-500 block font-sans">Sun Elevation</span>
                    <span className="font-bold text-white">{metricsB.solar.solarElevationDeg.toFixed(2)}°</span>
                  </div>
                  <div>
                    <span className="text-[9px] text-slate-500 block font-sans">Sun Azimuth</span>
                    <span className="font-bold text-white">{metricsB.solar.solarAzimuthDeg.toFixed(1)}°</span>
                  </div>
                  <div>
                    <span className="text-[9px] text-slate-500 block font-sans">Terrain Horizon</span>
                    <span className="font-bold text-white">
                      {metricsB.solar.terrainHorizonDeg !== null ? `${metricsB.solar.terrainHorizonDeg.toFixed(1)}°` : '0.0°'}
                    </span>
                  </div>
                </div>

                {outlookB && (
                  <div className="pt-2 border-t border-slate-800/80 text-[10px] font-mono text-slate-400 flex items-center justify-between">
                    <span>30-Day Sunlight: <strong className="text-amber-300">{outlookB.sunlitPct.toFixed(0)}%</strong></span>
                    <span>Max Dark: <strong className="text-slate-200">{outlookB.longestDarkHours.toFixed(1)} h</strong></span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Section 2: Direct-to-Earth (DTE) Communication Windows */}
          <div className="space-y-2 pt-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-wider text-sky-400 font-bold">
                <Radio className="w-3.5 h-3.5 text-sky-400" />
                <span>2. Direct-to-Earth (DTE) Communication Link</span>
              </div>
              <span className="text-[10px] text-slate-500 font-mono">DSN &amp; Ground Station Constraints</span>
            </div>

            {/* Side-by-side Earth Link Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Earth Link A */}
              <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${
                    metricsA.earth.isLinked
                      ? 'bg-emerald-950/80 text-emerald-300 border-emerald-500/40'
                      : 'bg-rose-950/80 text-rose-300 border-rose-500/40'
                  }`}>
                    {metricsA.earth.isLinked ? 'Link Available' : 'Link Blocked'}
                  </span>
                  <span className="text-[10px] font-mono text-sky-300 font-bold">
                    Link Margin: {metricsA.earth.linkMarginDeg > 0 ? `+${metricsA.earth.linkMarginDeg.toFixed(1)}°` : `${metricsA.earth.linkMarginDeg.toFixed(1)}°`}
                  </span>
                </div>

                {/* Earthset / Earthrise Countdown Banner */}
                <div className="p-2 rounded-lg bg-black/50 border border-slate-800 font-mono">
                  <div className="text-[9.5px] uppercase text-slate-400 font-sans">
                    {metricsA.earth.status === 'perpetual_los'
                      ? 'Continuity'
                      : metricsA.earth.status === 'farside'
                      ? 'Farside Relay Need'
                      : metricsA.earth.nextEvent === 'earthset'
                      ? 'Time Until Earthset (Loss of Signal)'
                      : 'Time Until Earthrise (Acquisition of Signal)'}
                  </div>
                  <div className="text-base font-bold text-white mt-0.5 truncate">
                    {metricsA.earth.formattedDuration}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 font-mono text-[11px] pt-1">
                  <div>
                    <span className="text-[9px] text-slate-500 block font-sans">Earth Elevation</span>
                    <span className="font-bold text-white">{metricsA.earth.earthElevationDeg.toFixed(1)}°</span>
                  </div>
                  <div>
                    <span className="text-[9px] text-slate-500 block font-sans">Earth Azimuth</span>
                    <span className="font-bold text-white">{metricsA.earth.earthAzimuthDeg.toFixed(0)}°</span>
                  </div>
                  <div>
                    <span className="text-[9px] text-slate-500 block font-sans">Terrain Horizon</span>
                    <span className="font-bold text-white">
                      {metricsA.earth.terrainHorizonDeg !== null ? `${metricsA.earth.terrainHorizonDeg.toFixed(1)}°` : '0.0°'}
                    </span>
                  </div>
                </div>

                {outlookA && (
                  <div className="pt-2 border-t border-slate-800/80 text-[10px] font-mono text-slate-400 flex items-center justify-between">
                    <span>30-Day DTE Link: <strong className="text-sky-300">{outlookA.dteLinkPct.toFixed(0)}%</strong></span>
                    <span className="text-slate-500">Antenna Mask: 5.0°</span>
                  </div>
                )}
              </div>

              {/* Earth Link B */}
              <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${
                    metricsB.earth.isLinked
                      ? 'bg-emerald-950/80 text-emerald-300 border-emerald-500/40'
                      : 'bg-rose-950/80 text-rose-300 border-rose-500/40'
                  }`}>
                    {metricsB.earth.isLinked ? 'Link Available' : 'Link Blocked'}
                  </span>
                  <span className="text-[10px] font-mono text-sky-300 font-bold">
                    Link Margin: {metricsB.earth.linkMarginDeg > 0 ? `+${metricsB.earth.linkMarginDeg.toFixed(1)}°` : `${metricsB.earth.linkMarginDeg.toFixed(1)}°`}
                  </span>
                </div>

                {/* Earthset / Earthrise Countdown Banner */}
                <div className="p-2 rounded-lg bg-black/50 border border-slate-800 font-mono">
                  <div className="text-[9.5px] uppercase text-slate-400 font-sans">
                    {metricsB.earth.status === 'perpetual_los'
                      ? 'Continuity'
                      : metricsB.earth.status === 'farside'
                      ? 'Farside Relay Need'
                      : metricsB.earth.nextEvent === 'earthset'
                      ? 'Time Until Earthset (Loss of Signal)'
                      : 'Time Until Earthrise (Acquisition of Signal)'}
                  </div>
                  <div className="text-base font-bold text-white mt-0.5 truncate">
                    {metricsB.earth.formattedDuration}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 font-mono text-[11px] pt-1">
                  <div>
                    <span className="text-[9px] text-slate-500 block font-sans">Earth Elevation</span>
                    <span className="font-bold text-white">{metricsB.earth.earthElevationDeg.toFixed(1)}°</span>
                  </div>
                  <div>
                    <span className="text-[9px] text-slate-500 block font-sans">Earth Azimuth</span>
                    <span className="font-bold text-white">{metricsB.earth.earthAzimuthDeg.toFixed(0)}°</span>
                  </div>
                  <div>
                    <span className="text-[9px] text-slate-500 block font-sans">Terrain Horizon</span>
                    <span className="font-bold text-white">
                      {metricsB.earth.terrainHorizonDeg !== null ? `${metricsB.earth.terrainHorizonDeg.toFixed(1)}°` : '0.0°'}
                    </span>
                  </div>
                </div>

                {outlookB && (
                  <div className="pt-2 border-t border-slate-800/80 text-[10px] font-mono text-slate-400 flex items-center justify-between">
                    <span>30-Day DTE Link: <strong className="text-sky-300">{outlookB.dteLinkPct.toFixed(0)}%</strong></span>
                    <span className="text-slate-500">Antenna Mask: 5.0°</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Section 3: Automated Mission Trade-off Verdict */}
          <div className="p-3.5 rounded-xl bg-gradient-to-r from-cyan-950/40 via-slate-900/60 to-blue-950/40 border border-cyan-500/30 space-y-2">
            <div className="flex items-center gap-2 text-cyan-300 font-bold text-xs uppercase tracking-wider">
              <Sparkles className="w-4 h-4 text-cyan-400" />
              <span>Mission Planning Trade-off Verdict</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[11px] text-slate-300 leading-relaxed">
              <div>
                <span className="text-cyan-400 font-semibold block mb-0.5">Power Generation Assessment:</span>
                {metricsA.solar.isCurrentlySunlit && !metricsB.solar.isCurrentlySunlit ? (
                  <p>
                    <strong>Scenario A</strong> is actively illuminated with {metricsA.solar.powerEfficiencyPct}% power potential, whereas <strong>Scenario B</strong> is currently in shadow.
                  </p>
                ) : !metricsA.solar.isCurrentlySunlit && metricsB.solar.isCurrentlySunlit ? (
                  <p>
                    <strong>Scenario B</strong> is actively illuminated with {metricsB.solar.powerEfficiencyPct}% power potential, whereas <strong>Scenario A</strong> is currently in shadow.
                  </p>
                ) : metricsA.solar.isCurrentlySunlit && metricsB.solar.isCurrentlySunlit ? (
                  <p>
                    Both sites/dates are illuminated. Scenario {metricsA.solar.solarElevationDeg > metricsB.solar.solarElevationDeg ? 'A' : 'B'} provides +{Math.abs(metricsA.solar.solarElevationDeg - metricsB.solar.solarElevationDeg).toFixed(2)}° higher solar elevation above terrain.
                  </p>
                ) : (
                  <p>Both scenarios are currently unlit (lunar night or crater shadow). Solar array operations require battery or radiothermal backup.</p>
                )}
              </div>

              <div>
                <span className="text-sky-400 font-semibold block mb-0.5">Communication Window Assessment:</span>
                {metricsA.earth.isLinked && !metricsB.earth.isLinked ? (
                  <p>
                    <strong>Scenario A</strong> maintains direct DTE line-of-sight (+{metricsA.earth.linkMarginDeg.toFixed(1)}° margin). <strong>Scenario B</strong> is blocked by terrain or limb and requires relay.
                  </p>
                ) : !metricsA.earth.isLinked && metricsB.earth.isLinked ? (
                  <p>
                    <strong>Scenario B</strong> maintains direct DTE line-of-sight (+{metricsB.earth.linkMarginDeg.toFixed(1)}° margin). <strong>Scenario A</strong> is blocked by terrain or limb and requires relay.
                  </p>
                ) : metricsA.earth.isLinked && metricsB.earth.isLinked ? (
                  <p>
                    Both scenarios support direct Earth links. Scenario {metricsA.earth.earthElevationDeg > metricsB.earth.earthElevationDeg ? 'A' : 'B'} offers higher Earth elevation ({Math.max(metricsA.earth.earthElevationDeg, metricsB.earth.earthElevationDeg).toFixed(1)}° vs {Math.min(metricsA.earth.earthElevationDeg, metricsB.earth.earthElevationDeg).toFixed(1)}°).
                  </p>
                ) : (
                  <p>Direct communication is blocked at both sites/dates. Orbital relay satellite required for telemetry and commanding.</p>
                )}
              </div>
            </div>
          </div>

          {/* Section 4: Manifest & Specs (when manifest tab is active or for CLPS sites) */}
          {(comparisonMode === 'manifest' || siteA.clpsData || siteB.clpsData) && (
            <div className="space-y-2 pt-2 border-t border-slate-800">
              <div className="text-[11px] font-mono uppercase tracking-wider text-slate-400 font-bold">
                3. Spacecraft &amp; Scientific Payload Manifest
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-3 rounded-xl bg-slate-900/40 border border-slate-800 space-y-1.5">
                  <div className="font-semibold text-white text-xs">{siteA.name}</div>
                  <div className="text-[10px] text-slate-400">Agency / Provider: <strong className="text-slate-200">{siteA.agency}</strong></div>
                  <p className="text-[11px] text-slate-300 leading-relaxed">{siteA.description}</p>
                </div>

                <div className="p-3 rounded-xl bg-slate-900/40 border border-slate-800 space-y-1.5">
                  <div className="font-semibold text-white text-xs">{siteB.name}</div>
                  <div className="text-[10px] text-slate-400">Agency / Provider: <strong className="text-slate-200">{siteB.agency}</strong></div>
                  <p className="text-[11px] text-slate-300 leading-relaxed">{siteB.description}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
