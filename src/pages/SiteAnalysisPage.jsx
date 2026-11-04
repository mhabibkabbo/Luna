/**
 * @file SiteAnalysisPage.jsx
 * Page 3: Dedicated Landing-Site Inspection Workspace.
 * Comprehensive inspection of terrain elevation, LOLA DEM topographic horizons, solar elevation,
 * Diviner thermal physics, sunlight duration, and power generation potential.
 */

import React, { useState, useMemo, useEffect } from 'react';
import {
  Mountain,
  Sun,
  Thermometer,
  Zap,
  Globe2,
  GitCompare,
  FileText,
  Radio,
  ArrowRight,
  MapPin,
  Clock,
  ShieldAlert,
  Sliders,
  Target,
} from 'lucide-react';
import { LANDING_SITES } from '../data/landingSites.js';
import {
  HORIZON_TABLE,
  horizonAt,
  getHorizonProfile,
  ensurePolarDemLoaded,
  sampleLunarTerrainMetrics,
} from '../utils/horizons.js';
import { computeCelestialState, solarPosition } from '../utils/lunarEphemeris.js';
import { getLunarTemperature } from '../utils/lunarThermal.js';
import { calculateSolarTransition } from '../utils/transitionTimes.js';
import { celestialTimeStore } from '../utils/celestialTime.js';
import HorizonProfileChart from '../components/features/HorizonProfileChart.jsx';

export default function SiteAnalysisPage({
  selectedSite,
  onSelectSite,
  onNavigate,
}) {
  const [simulationTime, setSimulationTime] = useState(() => celestialTimeStore.get().ms);
  const [demLoadedTick, setDemLoadedTick] = useState(0);

  useEffect(() => {
    ensurePolarDemLoaded()
      .then((grid) => {
        if (grid) setDemLoadedTick((t) => t + 1);
      })
      .catch(() => {});
    return celestialTimeStore.subscribe(({ ms }) => {
      setSimulationTime(ms);
    });
  }, []);

  const currentSite = selectedSite || LANDING_SITES.find((s) => s.id === 'landing-artemis3-malapert') || LANDING_SITES[0];

  const siteLat = currentSite.latitude ?? currentSite.lat ?? 0;
  const siteLon = currentSite.longitude ?? currentSite.lon ?? 0;

  // Compute live scientific indicators for current site
  const analysis = useMemo(() => {
    try {
      const state = computeCelestialState(simulationTime);
      const terrainMetrics = sampleLunarTerrainMetrics(siteLat, siteLon, currentSite);
      const horizonProfile = getHorizonProfile(HORIZON_TABLE, currentSite.id, siteLat, siteLon);

      const flat = solarPosition(state, siteLat, siteLon);
      const terrainHorizonDeg = horizonAt(HORIZON_TABLE, currentSite.id, flat.azimuthDeg, siteLat, siteLon) ?? 0;
      const sun = solarPosition(state, siteLat, siteLon, terrainHorizonDeg);

      const thermal = getLunarTemperature(siteLat, siteLon, new Date(simulationTime), {
        terrainHorizonDeg,
        elevationM: terrainMetrics?.elevationM ?? null,
      });

      const solarTransition = calculateSolarTransition(simulationTime, siteLat, siteLon, currentSite.id);

      const clearance = sun.elevationDeg - terrainHorizonDeg;
      const isSunlit = sun.elevationDeg > 0 && clearance > 0 && !thermal.isPSR;
      const powerPotential = isSunlit
        ? solarTransition?.powerEfficiencyPct ?? Math.round(Math.max(0, Math.sin((sun.elevationDeg * Math.PI) / 180)) * 100)
        : 0;

      return {
        state,
        thermal,
        terrainMetrics,
        horizonProfile,
        terrainHorizonDeg,
        sun,
        solarTransition,
        clearance,
        isSunlit,
        powerPotential,
      };
    } catch (err) {
      console.error('Error calculating site analysis:', err);
      return null;
    }
  }, [currentSite, siteLat, siteLon, simulationTime, demLoadedTick]);

  const latFormatted = `${Math.abs(siteLat).toFixed(3)}° ${siteLat >= 0 ? 'N' : 'S'}`;
  const lonFormatted = `${Math.abs(siteLon).toFixed(3)}° ${siteLon >= 0 ? 'E' : 'W'}`;

  return (
    <div className="flex-1 overflow-y-auto px-4 sm:px-8 py-6 max-w-7xl mx-auto w-full space-y-6 animate-in fade-in duration-200">
      {/* 1. Page Header & Site Selector */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800/80">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-amber-400 mb-1.5">
            <span>Workspace 03</span>
            <span className="text-slate-600">/</span>
            <span className="text-slate-300">Surface Terrain & Solar Insolation</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <span>Site Analysis: {currentSite.name}</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            LOLA DEM topographic horizon profiling, subsolar insolation, surface thermal state, and power potential.
          </p>
        </div>

        {/* Site Switcher Dropdown */}
        <div className="flex items-center gap-2 shrink-0">
          <label htmlFor="site-selector" className="text-xs font-mono text-slate-400">
            Target Site:
          </label>
          <select
            id="site-selector"
            value={currentSite.id || ''}
            onChange={(e) => {
              const site = LANDING_SITES.find((s) => s.id === e.target.value);
              if (site && onSelectSite) onSelectSite(site);
            }}
            className="h-9 px-3 text-xs bg-slate-900 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-cyan-500 max-w-[220px]"
          >
            {LANDING_SITES.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* 2. Key Telemetry Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="p-4 rounded-2xl bg-[#050813] border border-slate-800/90 shadow-sm">
          <div className="flex items-center gap-1.5 text-[10px] font-mono text-slate-500 uppercase tracking-wider mb-1">
            <MapPin className="w-3.5 h-3.5 text-cyan-400" />
            <span>Selenographic Location</span>
          </div>
          <div className="text-lg font-bold font-mono text-white">
            {latFormatted}
          </div>
          <div className="text-xs font-mono text-slate-400 mt-0.5">
            {lonFormatted} {currentSite.elevationM ? `· +${currentSite.elevationM}m` : ''}
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-[#050813] border border-slate-800/90 shadow-sm">
          <div className="flex items-center gap-1.5 text-[10px] font-mono text-slate-500 uppercase tracking-wider mb-1">
            <Sun className="w-3.5 h-3.5 text-amber-400" />
            <span>Solar Elevation</span>
          </div>
          <div className="text-2xl font-bold font-mono text-white tabular-nums">
            {analysis ? `${analysis.thermal.solarElevationDeg}°` : '...'}
          </div>
          <div className="text-xs font-mono text-slate-400 mt-0.5">
            Horizon: {analysis?.terrainHorizonDeg ? `${analysis.terrainHorizonDeg.toFixed(1)}°` : '0.0°'}
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-[#050813] border border-slate-800/90 shadow-sm">
          <div className="flex items-center gap-1.5 text-[10px] font-mono text-slate-500 uppercase tracking-wider mb-1">
            <Zap className="w-3.5 h-3.5 text-yellow-400" />
            <span>Power Generation</span>
          </div>
          <div className="text-2xl font-bold font-mono text-white tabular-nums">
            {analysis ? `${analysis.powerPotential}%` : '...'}
          </div>
          <div className="text-xs font-mono text-slate-400 mt-0.5">
            {analysis?.isSunlit ? 'Actively Illuminated' : 'Shadow / Dark'}
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-[#050813] border border-slate-800/90 shadow-sm">
          <div className="flex items-center gap-1.5 text-[10px] font-mono text-slate-500 uppercase tracking-wider mb-1">
            <Thermometer className="w-3.5 h-3.5 text-blue-400" />
            <span>Thermal Environment</span>
          </div>
          <div className="text-2xl font-bold font-mono text-white tabular-nums">
            {analysis ? `${analysis.thermal.tempK} K` : '...'}
          </div>
          <div className="text-xs font-mono text-slate-400 mt-0.5">
            {analysis ? `${analysis.thermal.tempC}°C` : ''} {analysis?.thermal.isPSR ? '(PSR Trap)' : ''}
          </div>
        </div>
      </div>

      {/* 3. Main Detailed Analysis Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column (7 cols): Topographic Horizon Profile & Terrain Obstructions */}
        <div className="lg:col-span-7 space-y-6">
          <div className="p-5 rounded-2xl bg-[#050813] border border-slate-800/90 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-white uppercase tracking-wider font-mono flex items-center gap-2">
                  <Mountain className="w-4 h-4 text-cyan-400" />
                  <span>Local LOLA DEM Topographic Horizon</span>
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  360° terrain elevation profile derived from Lunar Orbiter Laser Altimeter data.
                </p>
              </div>

              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-400">
                400 m/px LOLA DEM
              </span>
            </div>

            {/* Render Topographic Horizon Chart */}
            <div className="pt-2">
              <HorizonProfileChart
                siteId={currentSite.id}
                latitude={siteLat}
                longitude={siteLon}
                currentSun={analysis?.sun}
                startMs={simulationTime}
              />
            </div>

            <div className="p-3 rounded-xl bg-slate-900/50 border border-slate-800 text-xs text-slate-300 leading-relaxed">
              <strong className="text-slate-200">Topographic Clearance Analysis:</strong> Surrounding crater rims and massifs determine when low-elevation solar rays and Earth radio signals are blocked. At high polar latitudes, crater rims regularly mask bodies standing under 2°–4° elevation.
            </div>
          </div>

          {/* Geological Description & Payload Objectives */}
          <div className="p-5 rounded-2xl bg-[#050813] border border-slate-800/90 space-y-3">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider font-mono">
              Scientific Context & Objectives
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              {currentSite.description}
            </p>
            {currentSite.objectives && (
              <div className="pt-2 border-t border-slate-800/80">
                <span className="text-[11px] font-mono text-cyan-400 uppercase tracking-wider block mb-1">
                  Primary Mission Target
                </span>
                <p className="text-xs text-slate-400 leading-relaxed">
                  {currentSite.objectives}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Right Column (5 cols): Solar Insolation & Day/Night Transition */}
        <div className="lg:col-span-5 space-y-6">
          <div className="p-5 rounded-2xl bg-[#050813] border border-slate-800/90 space-y-4">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider font-mono flex items-center gap-2">
              <Sun className="w-4 h-4 text-amber-400" />
              <span>Solar Illumination & Day/Night Transition</span>
            </h2>

            {analysis && (
              <div className="space-y-3">
                <div className="p-3.5 rounded-xl bg-slate-900/50 border border-slate-800 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-mono text-slate-400 uppercase block">
                      Illumination State
                    </span>
                    <span className={`text-sm font-bold uppercase ${
                      analysis.isSunlit ? 'text-emerald-400' : 'text-slate-400'
                    }`}>
                      {analysis.isSunlit ? 'Direct Solar Insolation' : 'Shadowed / Lunar Night'}
                    </span>
                  </div>
                  <span className={`text-[11px] font-mono px-2 py-0.5 rounded font-bold uppercase ${
                    analysis.isSunlit
                      ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-800/50'
                      : 'bg-slate-800 text-slate-300'
                  }`}>
                    {analysis.isSunlit ? 'SUNLIT' : 'SHADOW'}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-3 rounded-xl bg-slate-900/40 border border-slate-800">
                    <span className="text-[10px] font-mono text-slate-400 block mb-1">Sun Azimuth</span>
                    <span className="text-base font-bold font-mono text-white">
                      {analysis.sun.azimuthDeg.toFixed(1)}°
                    </span>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-900/40 border border-slate-800">
                    <span className="text-[10px] font-mono text-slate-400 block mb-1">Horizon Clearance</span>
                    <span className="text-base font-bold font-mono text-white">
                      {analysis.clearance >= 0 ? `+${analysis.clearance.toFixed(1)}°` : `${analysis.clearance.toFixed(1)}°`}
                    </span>
                  </div>
                </div>

                {analysis.solarTransition && (
                  <div className="p-3.5 rounded-xl bg-slate-900/50 border border-slate-800 space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400">Next Solar Event:</span>
                      <strong className="text-amber-300 capitalize">
                        {analysis.solarTransition.nextEvent}
                      </strong>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400">Time Remaining:</span>
                      <span className="font-mono text-white font-bold">
                        {analysis.solarTransition.formattedDuration}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Quick Actions to other workspaces */}
            <div className="pt-3 border-t border-slate-800 space-y-2">
              <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500 block">
                Next Operational Steps
              </span>

              <button
                type="button"
                onClick={() => onNavigate('communication')}
                className="w-full p-2.5 rounded-xl bg-slate-900 hover:bg-slate-850 border border-slate-800 hover:border-blue-500/40 text-left text-xs font-semibold text-slate-200 hover:text-white transition-all flex items-center justify-between group"
              >
                <div className="flex items-center gap-2">
                  <Radio className="w-3.5 h-3.5 text-blue-400" />
                  <span>Analyze Direct-to-Earth Comms</span>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-slate-500 group-hover:translate-x-1 transition-transform" />
              </button>

              <button
                type="button"
                onClick={() => onNavigate('planner')}
                className="w-full p-2.5 rounded-xl bg-slate-900 hover:bg-slate-850 border border-slate-800 hover:border-cyan-500/40 text-left text-xs font-semibold text-slate-200 hover:text-white transition-all flex items-center justify-between group"
              >
                <div className="flex items-center gap-2">
                  <Target className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Evaluate in Landing Window Planner</span>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-slate-500 group-hover:translate-x-1 transition-transform" />
              </button>

              <button
                type="button"
                onClick={() => onNavigate('comparison')}
                className="w-full p-2.5 rounded-xl bg-slate-900 hover:bg-slate-850 border border-slate-800 hover:border-cyan-500/40 text-left text-xs font-semibold text-slate-200 hover:text-white transition-all flex items-center justify-between group"
              >
                <div className="flex items-center gap-2">
                  <GitCompare className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Compare with Another Site</span>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-slate-500 group-hover:translate-x-1 transition-transform" />
              </button>

              <button
                type="button"
                onClick={() => onNavigate('briefing')}
                className="w-full p-2.5 rounded-xl bg-slate-900 hover:bg-slate-850 border border-slate-800 hover:border-emerald-500/40 text-left text-xs font-semibold text-slate-200 hover:text-white transition-all flex items-center justify-between group"
              >
                <div className="flex items-center gap-2">
                  <FileText className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Generate Mission Briefing Dossier</span>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-slate-500 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
