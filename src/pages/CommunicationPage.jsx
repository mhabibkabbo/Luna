/**
 * @file CommunicationPage.jsx
 * Page 4: Dedicated Communication & Ephemeris Workspace.
 * Direct-to-Earth (DTE) line-of-sight analysis, Deep Space Network (DSN) ground station geometry,
 * communication windows sweep, libration, and celestial ephemeris.
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  Radio,
  Globe2,
  Satellite,
  Clock,
  ArrowRight,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  Compass,
  Play,
  RotateCcw,
  ExternalLink,
  ChevronRight,
  Maximize2,
  Calendar,
  Layers,
} from 'lucide-react';
import { LANDING_SITES } from '../data/landingSites.js';
import { EARTH_COMMUNICATION_SITES } from '../data/earthCommunicationSites.js';
import { HORIZON_TABLE, horizonAt } from '../utils/horizons.js';
import { computeCelestialState } from '../utils/lunarEphemeris.js';
import {
  evaluateEarthLink,
  sweepEarthLink,
  DEFAULT_DTE_CONSTRAINTS,
  LINK_REASON_LABELS,
  earthSlewRates,
} from '../utils/earthLink.js';
import { celestialTimeStore } from '../utils/celestialTime.js';
import { formatDuration } from '../utils/transitionTimes.js';
import { notifyInfo } from '../utils/feedbackStore.js';

export default function CommunicationPage({
  selectedSite,
  onSelectSite,
  onNavigate,
  onSelectStation,
}) {
  const [simulationTime, setSimulationTime] = useState(() => celestialTimeStore.get().ms);
  const [selectedStationId, setSelectedStationId] = useState('earth-comms-nasa-goldstone');
  const [sweepResult, setSweepResult] = useState(null);
  const [isSweeping, setIsSweeping] = useState(false);

  // Subscribe to celestial time changes
  useEffect(() => {
    return celestialTimeStore.subscribe((t) => {
      setSimulationTime(t.ms);
    });
  }, []);

  const currentSite = selectedSite || LANDING_SITES.find((s) => s.id === 'landing-artemis3-malapert') || LANDING_SITES[0];
  const currentStation = EARTH_COMMUNICATION_SITES.find((st) => st.id === selectedStationId) || null;

  const siteLat = currentSite.latitude ?? currentSite.lat ?? 0;
  const siteLon = currentSite.longitude ?? currentSite.lon ?? 0;

  // Live DTE evaluation
  const linkEval = useMemo(() => {
    try {
      const state = computeCelestialState(simulationTime);
      const slew = earthSlewRates(currentSite, simulationTime);
      const evalResult = evaluateEarthLink({
        state,
        moonFeature: currentSite,
        earthFeature: currentStation,
        constraints: DEFAULT_DTE_CONSTRAINTS,
        terrainFn: (az) => horizonAt(HORIZON_TABLE, currentSite.id, az),
        slewDegPerHour: Math.max(slew.azimuthDegPerHour, slew.elevationDegPerHour),
      });

      return {
        ...evalResult,
        state,
        slew,
        lightTravelSec: (evalResult.rangeKm || 384400) / 299792.458,
      };
    } catch (e) {
      console.warn('Failed to evaluate DTE link:', e);
      return null;
    }
  }, [simulationTime, currentSite, currentStation]);

  // Run 30-day communication window sweep when site or station changes
  useEffect(() => {
    let active = true;
    const controller = new AbortController();

    async function runSweep() {
      setIsSweeping(true);
      try {
        const res = await sweepEarthLink({
          moonFeature: currentSite,
          earthFeature: currentStation,
          startMs: simulationTime,
          days: 30,
          stepMin: 60,
          constraints: DEFAULT_DTE_CONSTRAINTS,
          terrainFn: (az) => horizonAt(HORIZON_TABLE, currentSite.id, az),
          signal: controller.signal,
        });
        if (active && res) {
          setSweepResult(res);
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          console.warn('Sweep failed:', err);
        }
      } finally {
        if (active) setIsSweeping(false);
      }
    }

    runSweep();

    return () => {
      active = false;
      controller.abort();
    };
  }, [currentSite.id, selectedStationId]);

  // Sweep statistics
  const sweepStats = useMemo(() => {
    if (!sweepResult || !sweepResult.visibility) return null;
    const total = sweepResult.visibility.length;
    if (total === 0) return null;
    const clearCount = sweepResult.visibility.filter((v) => v === 'clear').length;
    const doubtfulCount = sweepResult.visibility.filter((v) => v === 'doubtful').length;
    const blockedCount = sweepResult.visibility.filter((v) => v === 'blocked').length;

    const uptimePct = Math.round((clearCount / total) * 100);
    return {
      uptimePct,
      clearCount,
      doubtfulCount,
      blockedCount,
      totalHours: total * (sweepResult.stepMin / 60),
    };
  }, [sweepResult]);

  const adjustTime = (hours) => {
    const nextMs = simulationTime + hours * 3600000;
    celestialTimeStore.setMs(nextMs);
    setSimulationTime(nextMs);
  };

  const resetToLive = () => {
    const now = Date.now();
    celestialTimeStore.setMs(now);
    setSimulationTime(now);
    notifyInfo('Clock synchronized with Live UTC');
  };

  return (
    <div className="flex-1 overflow-y-auto bg-[#07090e] text-slate-100 p-4 md:p-8 space-y-6">
      {/* Workspace Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 border-b border-slate-800/80 pb-5">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono tracking-widest text-cyan-400 uppercase">
            <Radio className="w-4 h-4 text-cyan-400" />
            <span>Workspace 04 · Ephemeris & Telecommunications</span>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-white mt-1">
            Direct-to-Earth (DTE) Link & Ground Station Telemetry
          </h1>
          <p className="text-xs text-slate-400 mt-1 max-w-3xl">
            Evaluate line of sight, antenna elevation above local lunar topography, Earth libration, and Deep Space Network coverage.
          </p>
        </div>

        {/* Site & Station Selectors */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Target Lunar Site Dropdown */}
          <div className="flex flex-col">
            <label className="text-[10px] font-mono uppercase tracking-wider text-slate-400 mb-1">
              Lunar Landing Site
            </label>
            <select
              value={currentSite.id}
              onChange={(e) => {
                const found = LANDING_SITES.find((s) => s.id === e.target.value);
                if (found && onSelectSite) onSelectSite(found);
              }}
              className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs font-medium text-slate-200 focus:outline-none focus:border-cyan-500"
            >
              {LANDING_SITES.map((site) => {
                const sLat = site.latitude ?? site.lat ?? 0;
                const formattedLat = Number.isFinite(sLat) ? Math.abs(sLat).toFixed(1) : '0.0';
                return (
                  <option key={site.id} value={site.id}>
                    {site.name} ({sLat >= 0 ? `${formattedLat}°N` : `${formattedLat}°S`})
                  </option>
                );
              })}
            </select>
          </div>

          {/* Earth Station Dropdown */}
          <div className="flex flex-col">
            <label className="text-[10px] font-mono uppercase tracking-wider text-slate-400 mb-1">
              Earth Ground Station
            </label>
            <select
              value={selectedStationId}
              onChange={(e) => {
                setSelectedStationId(e.target.value);
                const st = EARTH_COMMUNICATION_SITES.find((s) => s.id === e.target.value);
                if (st && onSelectStation) onSelectStation(st);
              }}
              className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs font-medium text-slate-200 focus:outline-none focus:border-cyan-500"
            >
              <option value="">Earth Centre (Geometric Mean)</option>
              {EARTH_COMMUNICATION_SITES.map((st) => (
                <option key={st.id} value={st.id}>
                  {st.name} ({st.agency})
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Ephemeris Timeline Scrubber */}
      <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800/80 flex flex-wrap items-center justify-between gap-4 text-xs font-mono">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-cyan-400" />
          <span className="text-slate-400">Epoch:</span>
          <span className="font-bold text-white tracking-wider">
            {new Date(simulationTime).toUTCString()}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => adjustTime(-24)}
            className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 transition"
          >
            -24h
          </button>
          <button
            onClick={() => adjustTime(-1)}
            className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 transition"
          >
            -1h
          </button>
          <button
            onClick={resetToLive}
            className="px-3 py-1 rounded bg-cyan-950/70 border border-cyan-500/50 text-cyan-300 hover:bg-cyan-900/80 transition flex items-center gap-1.5 font-bold"
          >
            <RotateCcw className="w-3 h-3" />
            Live UTC
          </button>
          <button
            onClick={() => adjustTime(1)}
            className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 transition"
          >
            +1h
          </button>
          <button
            onClick={() => adjustTime(24)}
            className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 transition"
          >
            +24h
          </button>
        </div>
      </div>

      {/* Primary Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Status Column (2 Cols) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Live Link Card */}
          <div className="p-6 rounded-2xl bg-[#0c1017] border border-slate-800/80 relative overflow-hidden">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <span className="text-[10px] font-mono tracking-wider text-slate-400 uppercase">
                  Telemetry Link State
                </span>
                <div className="flex items-center gap-3 mt-1.5">
                  <div
                    className={`w-3.5 h-3.5 rounded-full animate-pulse ${
                      linkEval?.status === 'clear'
                        ? 'bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.8)]'
                        : linkEval?.status === 'doubtful'
                        ? 'bg-amber-400 shadow-[0_0_12px_rgba(251,191,36,0.8)]'
                        : 'bg-rose-500 shadow-[0_0_12px_rgba(244,63,94,0.8)]'
                    }`}
                  />
                  <h2 className="text-xl font-black tracking-tight text-white uppercase">
                    {linkEval?.status === 'clear'
                      ? 'Continuous Direct-to-Earth Link Active'
                      : linkEval?.status === 'doubtful'
                      ? 'Marginal Link · Topographic Grazing'
                      : 'Telemetry Blocked · Line of Sight Obscured'}
                  </h2>
                </div>
                <p className="text-xs text-slate-400 mt-1 font-mono">
                  {LINK_REASON_LABELS[linkEval?.reason] || linkEval?.reason || 'Status Normal'}
                </p>
              </div>

              <div className="text-right">
                <span className="text-[10px] font-mono text-slate-500 uppercase">One-Way Light Time</span>
                <p className="text-lg font-mono font-bold text-cyan-400">
                  {linkEval?.lightTravelSec ? `${linkEval.lightTravelSec.toFixed(3)} s` : '1.282 s'}
                </p>
              </div>
            </div>

            {/* Metrics Matrix */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 border-t border-slate-800/80 font-mono">
              <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800">
                <span className="text-[10px] text-slate-400 uppercase">Earth Elevation</span>
                <p className="text-lg font-bold text-white mt-0.5">
                  {linkEval?.elevationDeg !== undefined ? `${linkEval.elevationDeg.toFixed(2)}°` : '—'}
                </p>
                <span className="text-[10px] text-slate-500">Above site horizon</span>
              </div>

              <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800">
                <span className="text-[10px] text-slate-400 uppercase">Earth Azimuth</span>
                <p className="text-lg font-bold text-white mt-0.5">
                  {linkEval?.azimuthDeg !== undefined ? `${linkEval.azimuthDeg.toFixed(1)}°` : '—'}
                </p>
                <span className="text-[10px] text-slate-500">From Lunar North</span>
              </div>

              <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800">
                <span className="text-[10px] text-slate-400 uppercase">Terrain Margin</span>
                <p
                  className={`text-lg font-bold mt-0.5 ${
                    (linkEval?.marginDeg ?? 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  {linkEval?.marginDeg !== undefined
                    ? `${linkEval.marginDeg >= 0 ? '+' : ''}${linkEval.marginDeg.toFixed(2)}°`
                    : '—'}
                </p>
                <span className="text-[10px] text-slate-500">Clearance over ridge</span>
              </div>

              <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800">
                <span className="text-[10px] text-slate-400 uppercase">Gimbal Slew Rate</span>
                <p className="text-lg font-bold text-white mt-0.5">
                  {linkEval?.slew
                    ? `${Math.max(linkEval.slew.azimuthDegPerHour, linkEval.slew.elevationDegPerHour).toFixed(3)}°/h`
                    : '< 0.05°/h'}
                </p>
                <span className="text-[10px] text-slate-500">Libration track</span>
              </div>
            </div>

            {/* Ground Station Details if Selected */}
            {currentStation && (
              <div className="mt-4 p-3.5 rounded-xl bg-slate-900/40 border border-slate-800 flex items-center justify-between text-xs">
                <div>
                  <span className="text-[10px] font-mono text-cyan-400 uppercase">Selected Ground Station</span>
                  <p className="font-bold text-white mt-0.5">{currentStation.name}</p>
                  <p className="text-[11px] text-slate-400">
                    {currentStation.network} · {currentStation.country}
                  </p>
                </div>
                <div className="text-right font-mono">
                  <span className="text-[10px] text-slate-500 uppercase">Station Moon Elevation</span>
                  <p
                    className={`font-bold ${
                      (linkEval?.stationElevationDeg ?? 0) > 10 ? 'text-emerald-400' : 'text-amber-400'
                    }`}
                  >
                    {linkEval?.stationElevationDeg !== null
                      ? `${linkEval.stationElevationDeg.toFixed(1)}°`
                      : '—'}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* 30-Day DTE Windows Timeline */}
          <div className="p-6 rounded-2xl bg-[#0c1017] border border-slate-800/80 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                  30-Day Telecommunications Availability Sweep
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Hourly sampling accounting for lunar libration, Earth diurnal rotation, and LOLA DEM obstacle masks.
                </p>
              </div>

              {sweepStats && (
                <div className="text-right font-mono">
                  <span className="text-[10px] text-slate-500 uppercase">Uptime Ratio</span>
                  <p className="text-sm font-bold text-cyan-400">{sweepStats.uptimePct}% Availability</p>
                </div>
              )}
            </div>

            {/* Sweep Bar */}
            <div className="space-y-1.5">
              <div className="w-full h-8 rounded-lg overflow-hidden flex bg-slate-950 border border-slate-800">
                {isSweeping ? (
                  <div className="w-full h-full flex items-center justify-center text-xs text-slate-500 font-mono animate-pulse">
                    Computing 720 ephemeris positions...
                  </div>
                ) : sweepResult?.visibility ? (
                  sweepResult.visibility.map((status, idx) => (
                    <div
                      key={idx}
                      title={`Hour +${idx}: ${status}`}
                      className={`flex-1 h-full transition-opacity hover:opacity-80 ${
                        status === 'clear'
                          ? 'bg-emerald-500'
                          : status === 'doubtful'
                          ? 'bg-amber-500'
                          : 'bg-rose-900/60'
                      }`}
                    />
                  ))
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-xs text-slate-500 font-mono">
                    Timeline data unavailable
                  </div>
                )}
              </div>

              {/* Timeline labels */}
              <div className="flex justify-between text-[10px] font-mono text-slate-500 px-1">
                <span>Start: {new Date(simulationTime).toLocaleDateString()}</span>
                <span>+15 Days</span>
                <span>+30 Days</span>
              </div>
            </div>

            {/* Legend */}
            <div className="flex items-center gap-6 pt-2 text-xs font-mono text-slate-400">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                <span>Clear LOS ({sweepStats?.clearCount || 0} hrs)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                <span>Grazing / Partial ({sweepStats?.doubtfulCount || 0} hrs)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-900/60" />
                <span>Blocked / Occulted ({sweepStats?.blockedCount || 0} hrs)</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Sidebar: Ephemeris & Cross-Navigation */}
        <div className="space-y-6">
          {/* Ephemeris Details Panel */}
          <div className="p-5 rounded-2xl bg-[#0c1017] border border-slate-800/80 space-y-4">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Globe2 className="w-4 h-4 text-cyan-400" />
              Planetary Geometry & Libration
            </h3>

            <div className="space-y-3 font-mono text-xs">
              <div className="flex justify-between py-1.5 border-b border-slate-800/60">
                <span className="text-slate-400">Sub-Earth Lunar Point</span>
                <span className="font-bold text-white">
                  {Number.isFinite(linkEval?.state?.subEarth?.lat) && Number.isFinite(linkEval?.state?.subEarth?.lon)
                    ? `${linkEval.state.subEarth.lat.toFixed(2)}°N, ${linkEval.state.subEarth.lon.toFixed(2)}°E`
                    : '1.2°S, 4.9°E'}
                </span>
              </div>

              <div className="flex justify-between py-1.5 border-b border-slate-800/60">
                <span className="text-slate-400">Sub-Solar Lunar Point</span>
                <span className="font-bold text-white">
                  {Number.isFinite(linkEval?.state?.subSolar?.lat) && Number.isFinite(linkEval?.state?.subSolar?.lon)
                    ? `${linkEval.state.subSolar.lat.toFixed(2)}°N, ${linkEval.state.subSolar.lon.toFixed(2)}°E`
                    : '1.5°S, 90.8°W'}
                </span>
              </div>

              <div className="flex justify-between py-1.5 border-b border-slate-800/60">
                <span className="text-slate-400">Earth Apparent Size</span>
                <span className="font-bold text-cyan-300">
                  {linkEval?.radiusDeg ? `${(linkEval.radiusDeg * 2).toFixed(2)}°` : '1.91°'}
                </span>
              </div>

              <div className="flex justify-between py-1.5 border-b border-slate-800/60">
                <span className="text-slate-400">Sun Apparent Size</span>
                <span className="font-bold text-amber-300">0.53°</span>
              </div>

              <div className="flex justify-between py-1.5 border-b border-slate-800/60">
                <span className="text-slate-400">Lander Horizon Mask</span>
                <span className="font-bold text-slate-300">5.00° Minimum</span>
              </div>
            </div>
          </div>

          {/* Quick Actions Card */}
          <div className="p-5 rounded-2xl bg-gradient-to-br from-cyan-950/40 to-slate-900/60 border border-cyan-800/40 space-y-3">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider">
              Mission Navigation Links
            </h4>
            <p className="text-xs text-slate-300 leading-relaxed">
              Transition directly into 3D planetary view or cross-examine topographic horizons for this site.
            </p>

            <div className="pt-2 space-y-2">
              <button
                onClick={() => onNavigate && onNavigate('explorer')}
                className="w-full py-2.5 px-3 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-medium text-xs flex items-center justify-center gap-2 shadow-lg shadow-cyan-950/50 transition active:scale-98"
              >
                <Compass className="w-3.5 h-3.5" />
                View Site & DTE Beam in 3D Explorer
              </button>

              <button
                onClick={() => onNavigate && onNavigate('site-analysis')}
                className="w-full py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-xs flex items-center justify-center gap-2 border border-slate-700 transition"
              >
                <Layers className="w-3.5 h-3.5" />
                Inspect Site Topography & Horizons
              </button>

              <button
                onClick={() => onNavigate && onNavigate('site-comparison')}
                className="w-full py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-xs flex items-center justify-center gap-2 border border-slate-700 transition"
              >
                <ChevronRight className="w-3.5 h-3.5" />
                Compare with Alternative Landing Site
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
