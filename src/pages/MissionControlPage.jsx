/**
 * @file MissionControlPage.jsx
 * Page 1: Mission Control Overview.
 * Displays active flight profile, planetary ephemeris overview, recommended landing sites, and quick workflows.
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  Rocket,
  Globe2,
  Mountain,
  Radio,
  GitCompare,
  FileText,
  Compass,
  ArrowRight,
  Sun,
  Thermometer,
  ShieldCheck,
  Target,
} from 'lucide-react';
import { CLPS_MISSIONS } from '../data/clpsMissions.js';
import { LANDING_SITES } from '../data/landingSites.js';
import { computeCelestialState } from '../utils/lunarEphemeris.js';
import { getLunarTemperature } from '../utils/lunarThermal.js';
import { celestialTimeStore } from '../utils/celestialTime.js';
import ExpandableText from '../components/common/ExpandableText.jsx';

export const RECOMMENDED_CANDIDATES = [
  {
    id: 'landing-artemis3-malapert',
    name: 'Malapert Massif',
    region: 'South Pole Peak (85.90°S, 0.00°E)',
    description: 'Summit plateau with 90%+ annual solar illumination and direct Earth line of sight. Primary Artemis III candidate.',
    tag: 'Artemis III Primary',
    lat: -85.90,
    lon: 0.00,
    latitude: -85.90,
    longitude: 0.00,
  },
  {
    id: 'landing-artemis3-shackleton',
    name: 'Peak Near Shackleton',
    region: 'South Pole Ridge (89.0066°S, 132.0596°E)',
    description: 'Illuminated ridge outside Shackleton crater (Peak Near Shackleton region). Long sunlit periods adjacent to permanently shadowed volatile-bearing ground.',
    tag: 'High Polar Volatiles',
    lat: -89.0066,
    lon: 132.0596,
    latitude: -89.0066,
    longitude: 132.0596,
  },
  {
    id: 'landing-artemis3-mouton',
    name: 'Mons Mouton',
    region: 'South Pole Highland (84.50°S, 31.70°E)',
    description: 'Flat elevated plateau selected for Astrobotic Griffin heavy lander and VIPER subsurface drill prospecting.',
    tag: 'Drill Prospecting',
    lat: -84.50,
    lon: 31.70,
    latitude: -84.50,
    longitude: 31.70,
  },
  {
    id: 'clps-im1-odysseus',
    name: 'Malapert A (Odysseus)',
    region: 'South Pole Approach (80.13°S, 1.44°E)',
    description: 'First commercial spacecraft soft landing on the lunar surface (Intuitive Machines IM-1 Nova-C).',
    tag: 'CLPS Heritage',
    lat: -80.13,
    lon: 1.44,
    latitude: -80.13,
    longitude: 1.44,
  },
];

function fmtNum(val, digits = 2, fallback = '0.00') {
  return Number.isFinite(val) ? Number(val).toFixed(digits) : fallback;
}

export default function MissionControlPage({
  onNavigate,
  activeMission,
  onSelectMission,
  selectedFeature,
  onSelectFeature,
}) {
  const [simulationTime, setSimulationTime] = useState(() => celestialTimeStore.get().ms);

  useEffect(() => {
    return celestialTimeStore.subscribe(({ ms }) => {
      setSimulationTime(ms);
    });
  }, []);

  const celestial = useMemo(() => {
    try {
      const state = computeCelestialState(simulationTime);
      const southPoleThermal = getLunarTemperature(-89.7, 0, new Date(simulationTime));
      return { state, southPoleThermal };
    } catch {
      return null;
    }
  }, [simulationTime]);

  return (
    <div className="flex-1 overflow-y-auto px-4 sm:px-8 py-6 max-w-7xl mx-auto w-full space-y-8 animate-in fade-in duration-200">
      {/* 1. Mission Control Header & Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-800/80">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-cyan-400 mb-1.5">
            <span>Operational Console</span>
            <span className="text-slate-600">/</span>
            <span className="text-slate-300">NASA CLPS & Artemis Flight Planning</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
            Lunar Mission Control
          </h1>
          <p className="text-sm text-slate-400 mt-1 max-w-2xl leading-relaxed">
            High-precision mission analysis platform for evaluating candidate landing zones, solar illumination longevity, Direct-to-Earth communication links, and surface operational risks.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => onNavigate('explorer')}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold text-xs tracking-wide transition-all shadow-lg active:scale-95 flex items-center gap-2"
          >
            <span>Open 3D Explorer</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 2. Key Live Astronomical Status Matrix */}
      {celestial && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="p-4 rounded-2xl bg-[#050813] border border-slate-800/90 shadow-sm">
            <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500 block mb-1">
              Earth-Moon Distance
            </span>
            <div className="text-xl sm:text-2xl font-bold font-mono tabular-nums text-white">
              {Number.isFinite(celestial.state?.earth?.distanceKm)
                ? Math.round(celestial.state.earth.distanceKm).toLocaleString()
                : '384,400'}{' '}
              <span className="text-xs text-slate-400 font-sans font-normal">km</span>
            </div>
            <span className="text-[11px] text-cyan-400/90 font-mono mt-1 block">
              Sub-Earth: {fmtNum(celestial.state?.earth?.subLat, 1, '1.2')}°N, {fmtNum(celestial.state?.earth?.subLon, 1, '4.9')}°E
            </span>
          </div>

          <div className="p-4 rounded-2xl bg-[#050813] border border-slate-800/90 shadow-sm">
            <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500 block mb-1">
              Sun Distance (AU)
            </span>
            <div className="text-xl sm:text-2xl font-bold font-mono tabular-nums text-white">
              {fmtNum(celestial.state?.sun?.distanceAU ?? celestial.state?.sun?.distanceAu, 4, '0.9921')}{' '}
              <span className="text-xs text-slate-400 font-sans font-normal">AU</span>
            </div>
            <span className="text-[11px] text-amber-400/90 font-mono mt-1 block">
              Subsolar: {fmtNum(celestial.state?.sun?.subLat, 1, '1.5')}°N, {fmtNum(celestial.state?.sun?.subLon, 1, '90.8')}°E
            </span>
          </div>

          <div className="p-4 rounded-2xl bg-[#050813] border border-slate-800/90 shadow-sm">
            <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500 block mb-1">
              South Pole Environment
            </span>
            <div className="text-xl sm:text-2xl font-bold font-mono tabular-nums text-white">
              {fmtNum(celestial.southPoleThermal?.tempK, 0, '220')}{' '}
              <span className="text-xs text-slate-400 font-sans font-normal">K</span>
            </div>
            <span className="text-[11px] text-slate-400 font-mono mt-1 block">
              {fmtNum(celestial.southPoleThermal?.tempC, 0, '-53')}°C ({fmtNum(celestial.southPoleThermal?.solarElevationDeg, 1, '1.5')}° Sun)
            </span>
          </div>

          <div className="p-4 rounded-2xl bg-[#050813] border border-slate-800/90 shadow-sm">
            <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500 block mb-1">
              Active Evaluation Site
            </span>
            <div className="text-base sm:text-lg font-bold text-white truncate">
              {selectedFeature?.name || 'Malapert Massif'}
            </div>
            <button
              type="button"
              onClick={() => onNavigate('site-analysis')}
              className="text-[11px] text-cyan-400 hover:underline font-mono mt-1 flex items-center gap-1"
            >
              <span>Inspect Site Analysis</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </div>
      )}

      {/* 3. Primary Workspace Launchpad */}
      <div>
        <h2 className="text-sm font-bold text-white uppercase tracking-wider font-mono mb-3 flex items-center gap-2">
          <Compass className="w-4 h-4 text-cyan-400" />
          <span>Mission Workspaces</span>
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {/* Card 1: Celestial Explorer */}
          <button
            type="button"
            onClick={() => onNavigate('explorer')}
            className="p-5 rounded-2xl bg-[#050813] hover:bg-[#080d1a] border border-slate-800/90 hover:border-cyan-500/50 text-left transition-all duration-150 group shadow-sm flex flex-col justify-between"
          >
            <div>
              <div className="w-10 h-10 rounded-xl bg-cyan-950/70 border border-cyan-500/40 text-cyan-400 flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
                <Globe2 className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-white group-hover:text-cyan-300 transition-colors">
                Celestial Explorer
              </h3>
              <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                Spacious 3D Moon and Earth environment. Explore lunar topography, drop custom coordinates, and switch between NASA WMTS GIS layers.
              </p>
            </div>
            <div className="mt-4 flex items-center gap-1 text-xs font-mono font-semibold text-cyan-400">
              <span>Open 3D Viewport</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
            </div>
          </button>

          {/* Card 2: Landing Window Planner */}
          <button
            type="button"
            onClick={() => onNavigate('planner')}
            className="p-5 rounded-2xl bg-[#050813] hover:bg-[#080d1a] border border-cyan-500/40 hover:border-cyan-400 text-left transition-all duration-150 group shadow-sm flex flex-col justify-between ring-1 ring-cyan-500/20"
          >
            <div>
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-950/90 to-blue-950/90 border border-cyan-400/60 text-cyan-300 flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
                <Target className="w-5 h-5" />
              </div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white group-hover:text-cyan-300 transition-colors">
                  Landing Window Planner
                </h3>
              </div>
              <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                "Where is the best place to land at a given date/time?" Evaluates candidates across your flight duration against slope, sunlit hours, and DTE links.
              </p>
            </div>
            <div className="mt-4 flex items-center gap-1 text-xs font-mono font-semibold text-cyan-400">
              <span>Plan Landing Window</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
            </div>
          </button>

          {/* Card 3: Site Analysis */}
          <button
            type="button"
            onClick={() => onNavigate('site-analysis')}
            className="p-5 rounded-2xl bg-[#050813] hover:bg-[#080d1a] border border-slate-800/90 hover:border-amber-500/50 text-left transition-all duration-150 group shadow-sm flex flex-col justify-between"
          >
            <div>
              <div className="w-10 h-10 rounded-xl bg-amber-950/70 border border-amber-500/40 text-amber-400 flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
                <Mountain className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-white group-hover:text-amber-300 transition-colors">
                Landing Site Analysis
              </h3>
              <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                Dedicated terrain evaluation. Inspect local LOLA DEM topographic horizons, solar elevation, Diviner thermal profiles, and power potential.
              </p>
            </div>
            <div className="mt-4 flex items-center gap-1 text-xs font-mono font-semibold text-amber-400">
              <span>Evaluate Site</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
            </div>
          </button>

          {/* Card 4: Comms & Ephemeris */}
          <button
            type="button"
            onClick={() => onNavigate('communication')}
            className="p-5 rounded-2xl bg-[#050813] hover:bg-[#080d1a] border border-slate-800/90 hover:border-blue-500/50 text-left transition-all duration-150 group shadow-sm flex flex-col justify-between"
          >
            <div>
              <div className="w-10 h-10 rounded-xl bg-blue-950/70 border border-blue-500/40 text-blue-400 flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
                <Radio className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-white group-hover:text-blue-300 transition-colors">
                Comms & Ephemeris
              </h3>
              <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                Direct-to-Earth line-of-sight tracking. Analyze Deep Space Network coverage, local crater rim masking, and 30-day communication blackout windows.
              </p>
            </div>
            <div className="mt-4 flex items-center gap-1 text-xs font-mono font-semibold text-blue-400">
              <span>Analyze Comms</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
            </div>
          </button>
        </div>
      </div>

      {/* 4. Recommended Candidate Landing Sites */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider font-mono flex items-center gap-2">
            <Target className="w-4 h-4 text-cyan-400" />
            <span>Recommended Candidate Landing Sites</span>
          </h2>
          <button
            type="button"
            onClick={() => onNavigate('comparison')}
            className="text-xs font-mono text-cyan-400 hover:underline flex items-center gap-1"
          >
            <span>Compare Candidates</span>
            <ArrowRight className="w-3 h-3" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {RECOMMENDED_CANDIDATES.map((site) => {
            const isSelected = selectedFeature?.id === site.id;

            return (
              <div
                key={site.id}
                className={`p-4 rounded-2xl border transition-all flex flex-col justify-between ${
                  isSelected
                    ? 'bg-cyan-950/60 border-cyan-500/60 shadow-md'
                    : 'bg-[#050813] border-slate-800/90 hover:border-slate-700'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-1 mb-2">
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-cyan-300">
                      {site.tag}
                    </span>
                  </div>
                  <h3 className="text-sm font-bold text-white mb-1">
                    {site.name}
                  </h3>
                  <div className="text-[11px] font-mono text-slate-400 mb-2">
                    {site.region}
                  </div>
                  <ExpandableText
                    text={site.description}
                    maxLines={3}
                    charThreshold={120}
                    className="text-xs text-slate-400 leading-relaxed"
                  />
                </div>

                <div className="pt-3 mt-3 border-t border-slate-800/80 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => {
                      const fullSite = LANDING_SITES.find((s) => s.id === site.id) || site;
                      onSelectFeature(fullSite);
                      onNavigate('site-analysis');
                    }}
                    className="text-xs font-semibold text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
                  >
                    <span>Analyze Site</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const fullSite = LANDING_SITES.find((s) => s.id === site.id) || site;
                      onSelectFeature(fullSite);
                      onNavigate('explorer');
                    }}
                    className="text-xs text-slate-400 hover:text-white"
                    title="View in 3D"
                  >
                    3D View
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
