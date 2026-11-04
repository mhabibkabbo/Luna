/**
 * @file CommunicationPage.jsx
 * Page 4: Scientifically Grounded NASA-Based Lunar Communication Availability Analysis System.
 *
 * Implements interactive Direct-to-Earth (DTE) communication availability analysis
 * utilizing NASA LRO LOLA polar DEM elevation data, NAIF SPICE planetary ephemeris,
 * and NASA Deep Space Network (DSN) complexes.
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  Radio,
  Globe2,
  Satellite,
  Clock,
  Compass,
  RotateCcw,
  Layers,
  ChevronRight,
  Calendar,
  ShieldCheck,
  ShieldAlert,
  Mountain,
  MapPin,
  CheckCircle2,
  AlertTriangle,
  Info,
} from 'lucide-react';
import { LANDING_SITES } from '../data/landingSites.js';
import { EARTH_COMMUNICATION_SITES } from '../data/earthCommunicationSites.js';
import { celestialTimeStore } from '../utils/celestialTime.js';
import { notifyInfo } from '../utils/feedbackStore.js';
import {
  COMMUNICATION_DATA_SOURCES,
  getSurfaceElevationM,
  getTerrainHorizonAngleDeg,
  evaluateDteInstantaneous,
  LUNAR_RELAYS,
} from '../utils/communicationAnalysis.js';
import DteSignalChart from '../components/communication/DteSignalChart.jsx';

// Prominent lunar South Pole candidate locations for quick comparison
const SOUTH_POLE_CANDIDATES = [
  { id: 'malapert-peak', name: 'Mons Malapert Peak', lat: -85.97, lon: 0.0, desc: 'High-altitude ridge crest with near-continuous Earth visibility' },
  { id: 'shackleton-connecting-ridge', name: 'Shackleton Connecting Ridge', lat: -89.44, lon: 135.2, desc: 'Narrow ridge bordering Shackleton PSR with periodic DTE windows' },
  { id: 'de-gerlache-rim', name: 'de Gerlache Crater Rim', lat: -88.48, lon: -88.3, desc: 'Elevated crater rim offering elevated DTE line-of-sight elevation' },
  { id: 'haworth-crater-floor', name: 'Haworth Crater Floor (PSR)', lat: -87.4, lon: -5.1, desc: 'Deep cryogenic depression with severe terrain horizon obstruction' },
  { id: 'nobile-rim-1', name: 'Nobile Rim 1', lat: -85.2, lon: 35.8, desc: 'Artemis candidate plateau with moderate topographic clearance' },
];

export default function CommunicationPage({
  selectedSite,
  onSelectSite,
  onNavigate,
  onSelectStation,
}) {
  const [simulationTime, setSimulationTime] = useState(() => celestialTimeStore.get().ms);
  const [selectedStationId, setSelectedStationId] = useState('all');
  const [customLat, setCustomLat] = useState('-85.97');
  const [customLon, setCustomLon] = useState('0.00');
  const [isCustomMode, setIsCustomMode] = useState(false);

  const [demLoadedTick, setDemLoadedTick] = useState(0);

  // Subscribe to celestial time changes and ensure LOLA polar DEM is loaded
  useEffect(() => {
    import('../utils/horizons.js')
      .then(({ ensurePolarDemLoaded }) => ensurePolarDemLoaded())
      .then((grid) => {
        if (grid) setDemLoadedTick((t) => t + 1);
      })
      .catch(() => {});
    return celestialTimeStore.subscribe((t) => {
      setSimulationTime(t.ms);
    });
  }, []);

  const defaultSite = LANDING_SITES.find((s) => s.id === 'landing-artemis3-malapert') || LANDING_SITES[0];
  const activePreset = selectedSite || defaultSite;

  const parsedCustomLat = parseFloat(customLat);
  const parsedCustomLon = parseFloat(customLon);

  const currentLat = isCustomMode
    ? (Number.isFinite(parsedCustomLat) ? Math.max(-90, Math.min(90, parsedCustomLat)) : -85.97)
    : (activePreset.latitude ?? activePreset.lat ?? -85.97);

  const currentLon = isCustomMode
    ? (Number.isFinite(parsedCustomLon) ? ((((parsedCustomLon + 180) % 360) + 360) % 360 - 180) : 0.0)
    : (activePreset.longitude ?? activePreset.lon ?? 0.0);

  // Retrieve actual elevation from NASA LOLA DEM
  const demElevationM = useMemo(() => {
    return getSurfaceElevationM(currentLat, currentLon);
  }, [currentLat, currentLon, demLoadedTick]);

  const currentSiteObject = useMemo(() => {
    return {
      id: isCustomMode ? `custom-${currentLat.toFixed(2)}-${currentLon.toFixed(2)}` : activePreset.id,
      name: isCustomMode
        ? `Custom Coordinates (${Math.abs(currentLat).toFixed(2)}°${currentLat >= 0 ? 'N' : 'S'}, ${Math.abs(currentLon).toFixed(2)}°${currentLon >= 0 ? 'E' : 'W'})`
        : activePreset.name,
      latitude: currentLat,
      longitude: currentLon,
      elevationM: demElevationM,
    };
  }, [isCustomMode, activePreset, currentLat, currentLon, demElevationM]);

  const currentStation = EARTH_COMMUNICATION_SITES.find((st) => st.id === selectedStationId) || null;

  // Live Instantaneous DTE Evaluation
  const instantaneousDte = useMemo(() => {
    return evaluateDteInstantaneous({
      lat: currentLat,
      lon: currentLon,
      elevationM: demElevationM,
      timeMs: simulationTime,
      earthStation: currentStation,
      relayType: 'none',
      siteId: currentSiteObject.id,
    });
  }, [currentLat, currentLon, demElevationM, simulationTime, currentStation, currentSiteObject.id, demLoadedTick]);

  const adjustTime = (hours) => {
    const nextMs = simulationTime + hours * 3600000;
    setSimulationTime(celestialTimeStore.setMs(nextMs));
  };

  const setExactDate = (dateString) => {
    const d = new Date(dateString);
    if (!isNaN(d.getTime())) {
      const minuteMs = celestialTimeStore.setMs(d.getTime());
      setSimulationTime(minuteMs);
      notifyInfo(`Analysis date set to ${new Date(minuteMs).toUTCString().slice(0, 16)}`);
    }
  };

  const resetToLive = () => {
    const now = Date.now();
    setSimulationTime(celestialTimeStore.setMs(now));
    notifyInfo('Clock synchronized with Live UTC');
  };

  const handleSelectPreset = (site) => {
    setIsCustomMode(false);
    setCustomLat(String(site.lat ?? site.latitude));
    setCustomLon(String(site.lon ?? site.longitude));
    if (onSelectSite) onSelectSite(site);
  };

  const handleSelectCandidate = (cand) => {
    setIsCustomMode(true);
    setCustomLat(String(cand.lat));
    setCustomLon(String(cand.lon));
    notifyInfo(`Selected ${cand.name}`);
  };

  return (
    <div className="flex-1 overflow-y-auto bg-[#07090e] text-slate-100 p-4 md:p-8 space-y-6">
      {/* Workspace Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 border-b border-slate-800/80 pb-5">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono tracking-widest text-emerald-400 uppercase">
            <Radio className="w-4 h-4 text-emerald-400" />
            <span>NASA Planetary Telecommunications & Topographic Visibility System</span>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-white mt-1">
            Direct-to-Earth (DTE) Communication Availability Analysis
          </h1>
          <p className="text-xs text-slate-400 mt-1 max-w-3xl">
            Calculates line-of-sight visibility, lunar terrain obstacle masking, and planetary occultation using NASA LOLA DEM elevations, NAIF SPICE planetary ephemeris, and Deep Space Network specifications.
          </p>
        </div>

        {/* Quick Cross-Navigation Links */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => onNavigate && onNavigate('explorer')}
            className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-mono text-cyan-300 transition flex items-center gap-1.5"
          >
            <Compass className="w-3.5 h-3.5" />
            <span>3D Moon Globe</span>
          </button>
          <button
            onClick={() => onNavigate && onNavigate('site-analysis')}
            className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-mono text-slate-300 transition flex items-center gap-1.5"
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Terrain Analysis</span>
          </button>
        </div>
      </div>

      {/* Coordinate Search & Target Location Panel */}
      <div className="p-4 rounded-2xl bg-[#090D15] border border-slate-800/80 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-cyan-400" />
            <h2 className="text-xs font-mono font-bold uppercase text-white tracking-wider">
              1. Lunar Target Coordinate Selection
            </h2>
          </div>

          {/* Mode Switcher */}
          <div className="flex items-center gap-1 bg-slate-900/90 p-1 rounded-xl border border-slate-800 text-xs font-mono">
            <button
              onClick={() => setIsCustomMode(false)}
              className={`px-2.5 py-1 rounded-lg transition ${
                !isCustomMode
                  ? 'bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/40'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Cataloged Sites
            </button>
            <button
              onClick={() => setIsCustomMode(true)}
              className={`px-2.5 py-1 rounded-lg transition ${
                isCustomMode
                  ? 'bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/40'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Custom Coordinates
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Site Selector or Coordinate Inputs */}
          {!isCustomMode ? (
            <div className="md:col-span-2 space-y-1">
              <label className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
                Select Mission Landing Site
              </label>
              <select
                value={activePreset.id}
                onChange={(e) => {
                  const found = LANDING_SITES.find((s) => s.id === e.target.value);
                  if (found) handleSelectPreset(found);
                }}
                className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs font-medium text-slate-200 focus:outline-none focus:border-cyan-500"
              >
                {LANDING_SITES.map((site) => {
                  const sLat = site.latitude ?? site.lat ?? 0;
                  const sLon = site.longitude ?? site.lon ?? 0;
                  return (
                    <option key={site.id} value={site.id}>
                      {site.name} ({Math.abs(sLat).toFixed(1)}°{sLat >= 0 ? 'N' : 'S'}, {Math.abs(sLon).toFixed(1)}°{sLon >= 0 ? 'E' : 'W'})
                    </option>
                  );
                })}
              </select>
            </div>
          ) : (
            <div className="md:col-span-2 grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
                  Latitude (-90.0° to -80.0° for South Pole DEM)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="-90"
                  max="90"
                  value={customLat}
                  onChange={(e) => setCustomLat(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs font-mono text-slate-200 focus:outline-none focus:border-cyan-500"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
                  Longitude (-180.0° to +180.0°)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="-180"
                  max="180"
                  value={customLon}
                  onChange={(e) => setCustomLon(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs font-mono text-slate-200 focus:outline-none focus:border-cyan-500"
                />
              </div>
            </div>
          )}

          {/* Elevation from NASA LOLA DEM */}
          <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 space-y-1">
            <span className="text-[10px] font-mono text-slate-400 uppercase block">
              NASA LOLA Surface Elevation
            </span>
            <div className="text-sm font-mono font-bold text-white tabular-nums">
              {demElevationM !== null ? (
                <>
                  {demElevationM > 0 ? '+' : ''}
                  {Math.round(demElevationM).toLocaleString()} m
                  <span className="text-[10px] font-normal text-slate-400 ml-1.5">rel. R₀</span>
                </>
              ) : (
                <span className="text-slate-400 font-normal text-xs">
                  Data unavailable (outside 80°S–90°S DEM)
                </span>
              )}
            </div>
            <span className="text-[9.5px] font-mono text-slate-500 block truncate">
              {demElevationM !== null
                ? 'Sampled from 400m/pixel LOLA GDR polar grid'
                : 'Selected point is north of 80°S DEM extent'}
            </span>
          </div>
        </div>

        {/* Quick South Pole Candidates Pills */}
        <div className="pt-2 border-t border-slate-800/60 flex flex-wrap items-center gap-1.5 text-[11px] font-mono">
          <span className="text-slate-500 text-[10px] uppercase mr-1">South Pole Presets:</span>
          {SOUTH_POLE_CANDIDATES.map((cand) => (
            <button
              key={cand.id}
              onClick={() => handleSelectCandidate(cand)}
              className="px-2 py-0.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-cyan-300 transition"
              title={cand.desc}
            >
              {cand.name}
            </button>
          ))}
        </div>
      </div>

      {/* Epoch & Time Selection Bar */}
      <div className="p-3.5 rounded-2xl bg-[#090D15] border border-slate-800/80 flex flex-wrap items-center justify-between gap-4 text-xs font-mono">
        <div className="flex items-center gap-3">
          <Clock className="w-4 h-4 text-cyan-400" />
          <div>
            <span className="text-slate-400 text-[10px] uppercase block">Analysis Epoch (UTC)</span>
            <span className="font-bold text-white tracking-wider">
              {new Date(simulationTime).toUTCString()}
            </span>
          </div>
        </div>

        {/* Date Picker Input */}
        <div className="flex items-center gap-2">
          <Calendar className="w-3.5 h-3.5 text-slate-400" />
          <input
            type="date"
            value={new Date(simulationTime).toISOString().slice(0, 10)}
            onChange={(e) => setExactDate(e.target.value)}
            className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-700 text-slate-200 text-xs font-mono focus:outline-none focus:border-cyan-500"
          />
        </div>

        {/* Time Stepper Buttons */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => adjustTime(-24)}
            className="px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 transition"
          >
            -24h
          </button>
          <button
            onClick={() => adjustTime(-1)}
            className="px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 transition"
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
            className="px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 transition"
          >
            +1h
          </button>
          <button
            onClick={() => adjustTime(24)}
            className="px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 transition"
          >
            +24h
          </button>
        </div>
      </div>

      {/* Instantaneous Geometric Telemetry Matrix */}
      <div className="p-5 rounded-2xl bg-[#0c1017] border border-slate-800/80 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <span className="text-[10px] font-mono tracking-wider text-slate-400 uppercase">
              Current Instantaneous Line-of-Sight Geometry
            </span>
            <div className="flex items-center gap-2.5 mt-1">
              <div
                className={`w-3 h-3 rounded-full ${
                  instantaneousDte.status === 'clear'
                    ? 'bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.8)]'
                    : instantaneousDte.status === 'doubtful'
                    ? 'bg-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.8)]'
                    : 'bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.8)]'
                }`}
              />
              <h3 className="text-base font-bold text-white uppercase tracking-tight">
                {instantaneousDte.status === 'clear'
                  ? 'Direct-to-Earth Line of Sight Active'
                  : instantaneousDte.status === 'doubtful'
                  ? 'Marginal Contact · Disc Grazing Obstacle'
                  : 'Line of Sight Obstructed'}
              </h3>
            </div>
            <p className="text-xs font-mono text-slate-400 mt-0.5">
              {instantaneousDte.reason}
            </p>
          </div>

          <div className="text-right font-mono">
            <span className="text-[10px] text-slate-500 uppercase">One-Way RF Light Time</span>
            <p className="text-base font-bold text-cyan-400">
              {instantaneousDte.oneWayLightTimeSec.toFixed(3)} s
            </p>
          </div>
        </div>

        {/* 4-Column Physics Matrix */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-2 border-t border-slate-800/80 font-mono text-xs">
          <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800">
            <span className="text-[10px] text-slate-400 uppercase block">Topocentric Earth Elevation</span>
            <p className="text-base font-bold text-white mt-0.5 tabular-nums">
              {instantaneousDte.elevationDeg.toFixed(2)}°
            </p>
            <span className="text-[9.5px] text-slate-500 block">Relative to local tangent</span>
          </div>

          <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800">
            <span className="text-[10px] text-slate-400 uppercase block">Topocentric Earth Azimuth</span>
            <p className="text-base font-bold text-white mt-0.5 tabular-nums">
              {instantaneousDte.azimuthDeg.toFixed(1)}°
            </p>
            <span className="text-[9.5px] text-slate-500 block">Clockwise from Lunar North</span>
          </div>

          <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800">
            <span className="text-[10px] text-slate-400 uppercase block">Local Terrain Mask Angle</span>
            <p className="text-base font-bold text-cyan-300 mt-0.5 tabular-nums">
              {instantaneousDte.terrainMaskDeg.toFixed(2)}°
            </p>
            <span className="text-[9.5px] text-slate-500 block">Horizon obstacle toward Earth</span>
          </div>

          <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800">
            <span className="text-[10px] text-slate-400 uppercase block">Topographic Margin</span>
            <p
              className={`text-base font-bold mt-0.5 tabular-nums ${
                instantaneousDte.marginDeg >= 0 ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {instantaneousDte.marginDeg >= 0 ? '+' : ''}
              {instantaneousDte.marginDeg.toFixed(2)}°
            </p>
            <span className="text-[9.5px] text-slate-500 block">Clearance over terrain</span>
          </div>
        </div>
      </div>

      {/* Primary Section 3: Interactive Communication Availability Timeline & Statistics */}
      <DteSignalChart
        moonFeature={currentSiteObject}
        initialStationId={selectedStationId}
        onStationSelect={setSelectedStationId}
      />
    </div>
  );
}
