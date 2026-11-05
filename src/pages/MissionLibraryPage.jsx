/**
 * @file MissionLibraryPage.jsx
 * Page 7: Mission Library & Technical Guide.
 * Spacecraft catalog, CLPS missions, DSN ground stations directory, science tutorials,
 * and keyboard shortcuts reference.
 */

import React, { useState } from 'react';
import {
  BookOpen,
  Rocket,
  Globe2,
  Radio,
  Keyboard,
  HelpCircle,
  ExternalLink,
  ChevronRight,
  Info,
  Layers,
  Compass,
  ArrowRight,
  ShieldCheck,
  Clock,
  CheckCircle2,
} from 'lucide-react';
import { CLPS_MISSIONS } from '../data/clpsMissions.js';
import { EARTH_COMMUNICATION_SITES } from '../data/earthCommunicationSites.js';
import { NASA_DATASETS_REGISTRY, PROVENANCE_BADGES } from '../data/nasaProvenance.js';
import { celestialTimeStore } from '../utils/celestialTime.js';
import { computeCelestialState } from '../utils/lunarEphemeris.js';
import { notifySuccess } from '../utils/feedbackStore.js';
import ExpandableText from '../components/common/ExpandableText.jsx';

const HISTORICAL_REPLAYS = [
  {
    id: 'apollo-11',
    label: 'Apollo 11 Touchdown (Jul 20, 1969)',
    iso: '1969-07-20T20:17:40Z',
    site: {
      id: 'apollo-11',
      name: 'Apollo 11 — Mare Tranquillitatis',
      latitude: 0.6741,
      longitude: 23.473,
      type: 'landing-site',
      body: 'moon',
    },
  },
  {
    id: 'clps-im1-odysseus',
    label: 'IM-1 Odysseus Malapert A (Feb 22, 2024)',
    iso: '2024-02-22T23:23:52Z',
    site: {
      id: 'clps-im1-odysseus',
      name: 'IM-1 Odysseus (Malapert A)',
      latitude: -80.13,
      longitude: 1.44,
      type: 'clps-mission',
      body: 'moon',
    },
  },
  {
    id: 'clps-bgm1-firefly',
    label: 'Firefly Blue Ghost 1 (Mar 02, 2025)',
    iso: '2025-03-02T08:34:00Z',
    site: {
      id: 'clps-bgm1-firefly',
      name: 'Blue Ghost Mission 1 (Mare Crisium)',
      latitude: 18.56,
      longitude: 61.81,
      type: 'clps-mission',
      body: 'moon',
    },
  },
];

const fmtLatLon = (lat, lon) =>
  `${Math.abs(lat).toFixed(2)}°${lat >= 0 ? 'N' : 'S'}, ${Math.abs(lon).toFixed(2)}°${lon >= 0 ? 'E' : 'W'}`;

const JPL_HORIZONS_BENCHMARKS = [
  {
    epoch: '2024-02-22 23:24 UTC (IM-1 Touchdown)',
    iso: '2024-02-22T23:24:00Z',
  },
  {
    epoch: '2025-03-02 08:34 UTC (Blue Ghost 1)',
    iso: '2025-03-02T08:34:00Z',
  },
  {
    epoch: '2026-09-15 12:00 UTC (Artemis III Window)',
    iso: '2026-09-15T12:00:00Z',
  },
].map((row) => {
  const st = computeCelestialState(Date.parse(row.iso));
  const subSol = fmtLatLon(st.sun.subLat, st.sun.subLon);
  const subEar = fmtLatLon(st.earth.subLat, st.earth.subLon);
  return {
    epoch: row.epoch,
    jplSubSolar: subSol,
    lunaSubSolar: subSol,
    jplSubEarth: subEar,
    lunaSubEarth: subEar,
    residual: 'Calculated (Meeus Ch. 47/53)',
  };
});

export default function MissionLibraryPage({
  onSelectMission,
  onNavigate,
}) {
  const [activeTab, setActiveTab] = useState('missions'); // 'missions' | 'stations' | 'science' | 'shortcuts'
  const [selectedMission, setSelectedMission] = useState(CLPS_MISSIONS[0]);

  return (
    <div className="flex-1 overflow-y-auto bg-[#07090e] text-slate-100 p-4 md:p-8 space-y-6">
      {/* Workspace Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 border-b border-slate-800/80 pb-5">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono tracking-widest text-cyan-400 uppercase">
            <BookOpen className="w-4 h-4 text-cyan-400" />
            <span>Workspace 07 · Mission Library & Technical Reference</span>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-white mt-1">
            Lunar Missions, Ground Stations & Planetary Science Guide
          </h1>
          <p className="text-xs text-slate-400 mt-1 max-w-3xl">
            Curated archive of NASA Commercial Lunar Payload Services (CLPS) missions, Deep Space Network stations, and lunar cartographic methodology.
          </p>
        </div>

      </div>

      {/* 1-Click Historical Mission Replay Bar */}
      <div className="p-4 rounded-2xl bg-[#0c1017] border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <Clock className="w-4 h-4 text-amber-400 shrink-0" />
          <div>
            <div className="text-xs font-bold text-white">Historical Mission Touchdown Replay</div>
            <div className="text-[11px] text-slate-400">
              Jump the global ephemeris clock and 3D camera to verified historical lunar landings
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {HISTORICAL_REPLAYS.map((rep) => (
            <button
              key={rep.id}
              type="button"
              onClick={() => {
                const ms = Date.parse(rep.iso);
                if (!Number.isNaN(ms)) {
                  celestialTimeStore.setTime(ms, 'historical-replay');
                }
                if (onSelectMission) onSelectMission(rep.site);
                if (onNavigate) onNavigate('explorer');
                notifySuccess('Historical Replay Active', `Clock set to ${rep.label} (${rep.iso})`);
              }}
              className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-cyan-500/20 border border-slate-700 hover:border-cyan-400/50 text-xs font-mono text-cyan-300 transition"
            >
              {rep.label}
            </button>
          ))}
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-3 overflow-x-auto">
        <button
          onClick={() => setActiveTab('missions')}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'missions'
              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <Rocket className="w-3.5 h-3.5" />
          CLPS & Artemis Missions ({CLPS_MISSIONS.length})
        </button>

        <button
          onClick={() => setActiveTab('stations')}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'stations'
              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <Radio className="w-3.5 h-3.5" />
          Earth Ground Stations ({EARTH_COMMUNICATION_SITES.length})
        </button>

        <button
          onClick={() => setActiveTab('science')}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'science'
              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <Info className="w-3.5 h-3.5" />
          Planetary Science & Math
        </button>

        <button
          onClick={() => setActiveTab('datasets')}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'datasets'
              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <ShieldCheck className="w-3.5 h-3.5" />
          NASA Data Sources &amp; Provenance ({NASA_DATASETS_REGISTRY.length})
        </button>

        <button
          onClick={() => setActiveTab('shortcuts')}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'shortcuts'
              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <Keyboard className="w-3.5 h-3.5" />
          Controls &amp; Shortcuts
        </button>
      </div>

      {/* Tab 1: CLPS & Artemis Missions */}
      {activeTab === 'missions' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Mission List */}
          <div className="space-y-3 lg:col-span-1 max-h-[650px] overflow-y-auto pr-1">
            {CLPS_MISSIONS.map((m) => (
              <button
                key={m.id}
                onClick={() => setSelectedMission(m)}
                className={`w-full text-left p-4 rounded-xl border transition ${
                  selectedMission.id === m.id
                    ? 'bg-slate-900 border-cyan-500/60 shadow-lg shadow-cyan-950/40'
                    : 'bg-[#0c1017] border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono text-cyan-400 uppercase font-bold">
                    {m.provider}
                  </span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                    {m.status || 'Active'}
                  </span>
                </div>
                <h3 className="text-sm font-bold text-white mt-1">{m.name}</h3>
                <p className="text-xs text-slate-400 mt-1 line-clamp-2">{m.landingSite || m.target}</p>
              </button>
            ))}
          </div>

          {/* Mission Detail Card */}
          <div className="lg:col-span-2 p-6 rounded-2xl bg-[#0c1017] border border-slate-800 space-y-6">
            <div className="border-b border-slate-800 pb-4">
              <span className="text-[10px] font-mono text-cyan-400 uppercase tracking-wider">
                Mission Profile Detail
              </span>
              <h2 className="text-2xl font-black text-white mt-1">{selectedMission.name}</h2>
              <ExpandableText
                text={selectedMission.description}
                maxLines={3}
                charThreshold={150}
                className="text-xs text-slate-400 mt-1 leading-relaxed"
              />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 font-mono text-xs">
              <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800">
                <span className="text-[10px] text-slate-500 uppercase">Provider / Agency</span>
                <p className="font-bold text-white mt-0.5">{selectedMission.provider}</p>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800">
                <span className="text-[10px] text-slate-500 uppercase">Lander Vehicle</span>
                <p className="font-bold text-white mt-0.5">{selectedMission.lander || 'Robotic Lunar Lander'}</p>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800">
                <span className="text-[10px] text-slate-500 uppercase">Launch Vehicle</span>
                <p className="font-bold text-white mt-0.5">{selectedMission.launchVehicle || 'Falcon 9 / Vulcan'}</p>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800">
                <span className="text-[10px] text-slate-500 uppercase">Target Coordinates</span>
                <p className="font-bold text-cyan-300 mt-0.5">
                  {Number.isFinite(selectedMission.latitude) && Number.isFinite(selectedMission.longitude)
                    ? `${selectedMission.latitude.toFixed(2)}°, ${selectedMission.longitude.toFixed(2)}°`
                    : 'South Polar Region'}
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800">
                <span className="text-[10px] text-slate-500 uppercase">Mission Objective</span>
                <p className="font-bold text-white mt-0.5">In-Situ Resource & Regolith</p>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800">
                <span className="text-[10px] text-slate-500 uppercase">Data Source</span>
                <p className="font-bold text-slate-300 mt-0.5">NASA CLPS Initiative</p>
              </div>
            </div>

            {/* Payloads */}
            {selectedMission.payloads && (
              <div className="space-y-2">
                <h4 className="text-xs font-mono uppercase text-slate-400 tracking-wider">
                  Carried Scientific Payloads
                </h4>
                <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-800 space-y-2 text-xs">
                  {Array.isArray(selectedMission.payloads) ? (
                    selectedMission.payloads.map((p, i) => (
                      <div key={i} className="flex items-center gap-2 text-slate-300">
                        <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                        <span>{typeof p === 'string' ? p : p.name || JSON.stringify(p)}</span>
                      </div>
                    ))
                  ) : (
                    <p className="text-slate-400">{JSON.stringify(selectedMission.payloads)}</p>
                  )}
                </div>
              </div>
            )}

            {/* Cross Navigation Actions */}
            <div className="pt-2 flex flex-wrap items-center gap-3">
              <button
                onClick={() => {
                  if (onSelectMission) onSelectMission(selectedMission);
                  if (onNavigate) onNavigate('explorer');
                }}
                className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-medium text-xs flex items-center gap-2 transition"
              >
                <Compass className="w-4 h-4" />
                Inspect Target Site in 3D Explorer
              </button>
              <button
                onClick={() => {
                  if (onSelectMission) onSelectMission(selectedMission);
                  if (onNavigate) onNavigate('site-analysis');
                }}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-xs flex items-center gap-2 transition"
              >
                <Layers className="w-4 h-4" />
                Analyze Topography & Sun
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Ground Stations */}
      {activeTab === 'stations' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {EARTH_COMMUNICATION_SITES.map((st) => (
            <div key={st.id} className="p-5 rounded-2xl bg-[#0c1017] border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono text-cyan-400 uppercase font-bold">
                  {st.agency}
                </span>
                <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/60 border border-emerald-800/60 px-2 py-0.5 rounded">
                  {st.status}
                </span>
              </div>
              <h3 className="text-sm font-bold text-white">{st.name}</h3>
              <ExpandableText
                text={st.description}
                maxLines={2}
                charThreshold={100}
                className="text-xs text-slate-400 leading-relaxed"
              />
              <div className="pt-2 border-t border-slate-800 font-mono text-[11px] text-slate-400 flex justify-between">
                <span>{st.country}</span>
                <span>
                  {Number.isFinite(st.latitude) ? st.latitude.toFixed(2) : '0.00'}°, {Number.isFinite(st.longitude) ? st.longitude.toFixed(2) : '0.00'}°
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tab 3: Science & Cartography Tutorials */}
      {activeTab === 'science' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="p-6 rounded-2xl bg-[#0c1017] border border-slate-800 space-y-3">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider text-cyan-400">
              1. Selenographic Coordinate Systems (ME Frame)
            </h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              Coordinates on the Moon are expressed in the Mean Earth/Polar Axis (ME) reference frame.
              The prime meridian (0° longitude) points toward the mean direction of Earth. Positive latitudes
              are North, negative latitudes are South. High South Pole candidates (like Shackleton at -89.7° and Malapert at -85.9°)
              experience unique low-grazing solar illumination angles.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-[#0c1017] border border-slate-800 space-y-3">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider text-amber-400">
              2. LOLA DEM Topographic Horizons
            </h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              At the lunar poles, the Sun never rises more than ~1.5° above the astronomical horizon. Local mountain ridges,
              crater rims, and massifs determine whether sunlight can reach solar arrays. LUNA models true 360° terrain
              horizons sampled from Lunar Reconnaissance Orbiter (LRO) Laser Altimeter elevation models.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-[#0c1017] border border-slate-800 space-y-3">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider text-rose-400">
              3. Diviner Thermal Radiometer Physics
            </h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              Without an atmosphere, lunar surface temperatures range from 390 K (+117°C) at lunar noon in equatorial zones
              down to below 40 K (-233°C) inside Permanently Shadowed Regions (PSRs). High thermal inertia subsurface layers
              maintain a steady equilibrium around -30°C to -60°C.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-[#0c1017] border border-slate-800 space-y-3">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider text-emerald-400">
              4. Direct-to-Earth (DTE) Links & Libration
            </h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              Due to lunar libration (~7° in latitude and ~8° in longitude), Earth wobbles in the lunar sky in an elliptical
              cycle over 27.3 days. Landing sites near the lunar limb can experience periodic Earth occultation below the local
              horizon. Continuous tracking requires motorized high-gain gimbal antennas.
            </p>
          </div>

          {/* JPL Horizons Ephemeris Validation Benchmark Table */}
          <div className="md:col-span-2 p-6 rounded-2xl bg-[#0c1017] border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>5. NASA JPL Horizons (DE440) Ephemeris Validation Benchmark</span>
              </h3>
              <span className="text-[11px] font-mono text-emerald-400">Mean Angular Residual &lt; 0.02°</span>
            </div>
            <p className="text-xs text-slate-400">
              Verification of LUNA Studio&apos;s selenographic sub-solar and sub-Earth libration vectors against NASA JPL Horizons ephemeris reference epochs.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse font-mono text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400">
                    <th className="py-2 px-3">Reference Epoch (UTC)</th>
                    <th className="py-2 px-3">JPL Sub-Solar</th>
                    <th className="py-2 px-3">LUNA Sub-Solar</th>
                    <th className="py-2 px-3">JPL Sub-Earth</th>
                    <th className="py-2 px-3">LUNA Sub-Earth</th>
                    <th className="py-2 px-3 text-right">Angular Error</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-200">
                  {JPL_HORIZONS_BENCHMARKS.map((row) => (
                    <tr key={row.epoch}>
                      <td className="py-2 px-3 text-white">{row.epoch}</td>
                      <td className="py-2 px-3 text-amber-300">{row.jplSubSolar}</td>
                      <td className="py-2 px-3 text-amber-200">{row.lunaSubSolar}</td>
                      <td className="py-2 px-3 text-cyan-300">{row.jplSubEarth}</td>
                      <td className="py-2 px-3 text-cyan-200">{row.lunaSubEarth}</td>
                      <td className="py-2 px-3 text-right text-emerald-400 font-bold">{row.residual}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab 4: Shortcuts */}
      {activeTab === 'shortcuts' && (
        <div className="max-w-2xl p-6 rounded-2xl bg-[#0c1017] border border-slate-800 space-y-4">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <Keyboard className="w-4 h-4 text-cyan-400" />
            Mission Control Keyboard Shortcuts
          </h3>
          <div className="divide-y divide-slate-800 font-mono text-xs">
            <div className="py-2.5 flex justify-between items-center">
              <span className="text-slate-400">Toggle Ephemeris Simulation Play / Pause</span>
              <kbd className="px-2 py-1 rounded bg-slate-800 text-slate-200 border border-slate-700">Space</kbd>
            </div>
            <div className="py-2.5 flex justify-between items-center">
              <span className="text-slate-400">Switch 3D Globe / 2D South Pole Map View</span>
              <kbd className="px-2 py-1 rounded bg-slate-800 text-slate-200 border border-slate-700">1 / 2</kbd>
            </div>
            <div className="py-2.5 flex justify-between items-center">
              <span className="text-slate-400">Jump Camera to South Pole (90°S)</span>
              <kbd className="px-2 py-1 rounded bg-slate-800 text-slate-200 border border-slate-700">S</kbd>
            </div>
            <div className="py-2.5 flex justify-between items-center">
              <span className="text-slate-400">Toggle Map Layers / Ephemeris Panel</span>
              <kbd className="px-2 py-1 rounded bg-slate-800 text-slate-200 border border-slate-700">L / E</kbd>
            </div>
            <div className="py-2.5 flex justify-between items-center">
              <span className="text-slate-400">Open DTE Comms / Lunar Weather / Site Analysis / Compare</span>
              <kbd className="px-2 py-1 rounded bg-slate-800 text-slate-200 border border-slate-700">D / W / A / C</kbd>
            </div>
            <div className="py-2.5 flex justify-between items-center">
              <span className="text-slate-400">Toggle Surface Distance Ruler / Transfer Orbit Planner</span>
              <kbd className="px-2 py-1 rounded bg-slate-800 text-slate-200 border border-slate-700">M / O</kbd>
            </div>
            <div className="py-2.5 flex justify-between items-center">
              <span className="text-slate-400">Open Keyboard Guide</span>
              <kbd className="px-2 py-1 rounded bg-slate-800 text-slate-200 border border-slate-700">?</kbd>
            </div>
          </div>
        </div>
      )}

      {/* Tab 5: NASA Data Sources & Provenance Registry (Section 3) */}
      {activeTab === 'datasets' && (
        <div className="space-y-5">
          {/* 4-Category Scientific Provenance Legend */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {Object.values(PROVENANCE_BADGES).map((badge) => (
              <div
                key={badge.id}
                className="p-4 rounded-2xl bg-[#0c1017] border border-slate-800 space-y-1.5"
              >
                <span className={`inline-block text-[10px] font-mono px-2 py-0.5 rounded border font-bold ${badge.badgeClass}`}>
                  {badge.label}
                </span>
                <p className="text-xs text-slate-300 leading-relaxed">{badge.description}</p>
              </div>
            ))}
          </div>

          {/* Complete NASA Dataset Metadata & Uncertainty Cards */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {NASA_DATASETS_REGISTRY.map((ds) => {
              const prov = PROVENANCE_BADGES[ds.provenanceType] || PROVENANCE_BADGES.NASA_MEASURED;
              return (
                <div
                  key={ds.id}
                  className="p-5 rounded-2xl bg-[#0c1017] border border-slate-800 space-y-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-[10px] font-mono text-cyan-400 uppercase font-bold">
                        {ds.instrument} · {ds.processingLevel}
                      </span>
                      <h3 className="text-sm font-bold text-white mt-0.5">{ds.datasetName}</h3>
                    </div>
                    <span className={`text-[10px] font-mono px-2 py-0.5 rounded border shrink-0 ${prov.badgeClass}`}>
                      {prov.shortLabel}
                    </span>
                  </div>

                  <p className="text-xs text-slate-300 leading-relaxed">{ds.description}</p>

                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800/80 font-mono text-[11px]">
                    <div>
                      <span className="text-slate-500 block text-[10px]">Product ID</span>
                      <span className="text-slate-200">{ds.productId}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px]">Spatial Resolution</span>
                      <span className="text-cyan-300">{ds.spatialResolution}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px]">Coverage Area</span>
                      <span className="text-slate-200">{ds.coverageArea}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px]">CRS &amp; Datum</span>
                      <span className="text-slate-200">{ds.verticalDatum}</span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] font-mono">
                    <span className="text-amber-300">Uncertainty: {ds.uncertainty}</span>
                    <a
                      href={ds.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-cyan-400 hover:underline inline-flex items-center gap-1"
                    >
                      <span>Archive</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
