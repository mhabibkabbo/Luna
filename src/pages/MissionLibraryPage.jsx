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
  Sparkles,
  Info,
  Layers,
  Compass,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';
import { CLPS_MISSIONS } from '../data/clpsMissions.js';
import { EARTH_COMMUNICATION_SITES } from '../data/earthCommunicationSites.js';

export default function MissionLibraryPage({
  onSelectMission,
  onNavigate,
  onStartTour,
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

        {/* Guided Tour Launcher */}
        <button
          onClick={onStartTour}
          className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-cyan-950/60 transition active:scale-98"
        >
          <Sparkles className="w-4 h-4" />
          Launch 60s Guided Tour
        </button>
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
          onClick={() => setActiveTab('shortcuts')}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'shortcuts'
              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <Keyboard className="w-3.5 h-3.5" />
          Controls & Shortcuts
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
              <p className="text-xs text-slate-400 mt-1">{selectedMission.description}</p>
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
              <p className="text-xs text-slate-400">{st.description}</p>
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
              <span className="text-slate-400">Switch 3D Globe / 2D Map View</span>
              <kbd className="px-2 py-1 rounded bg-slate-800 text-slate-200 border border-slate-700">3 / 2</kbd>
            </div>
            <div className="py-2.5 flex justify-between items-center">
              <span className="text-slate-400">Switch Celestial Body (Moon / Earth)</span>
              <kbd className="px-2 py-1 rounded bg-slate-800 text-slate-200 border border-slate-700">M / E</kbd>
            </div>
            <div className="py-2.5 flex justify-between items-center">
              <span className="text-slate-400">Jump Camera to South Pole (90°S)</span>
              <kbd className="px-2 py-1 rounded bg-slate-800 text-slate-200 border border-slate-700">S</kbd>
            </div>
            <div className="py-2.5 flex justify-between items-center">
              <span className="text-slate-400">Open Keyboard Guide</span>
              <kbd className="px-2 py-1 rounded bg-slate-800 text-slate-200 border border-slate-700">?</kbd>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
