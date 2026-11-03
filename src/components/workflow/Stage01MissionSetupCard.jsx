/**
 * @file Stage01MissionSetupCard.jsx
 * Stage 01 Mission Setup & Configuration HUD.
 * Spacecraft selection, target landing regions, and epoch time configuration.
 */

import React, { useState } from 'react';
import { Rocket, Calendar, MapPin, Compass, CheckCircle2, X, ChevronRight, Sparkles } from 'lucide-react';
import { CLPS_MISSIONS } from '../../data/clpsMissions.js';
import { LANDING_SITES } from '../../data/landingSites.js';
import { celestialTimeStore } from '../../utils/celestialTime.js';

export const POPULAR_REGIONS = [
  {
    id: 'landing-artemis3-malapert',
    name: 'Malapert Massif (85.9°S)',
    description: 'Summit high plateau with 90%+ solar illumination and direct Earth line-of-sight.',
    lat: -85.90,
    lon: 0.00,
    badge: 'Artemis III Primary',
  },
  {
    id: 'landing-artemis3-shackleton',
    name: 'Shackleton Ridge (89.7°S)',
    description: 'Direct South Pole ridge adjacent to deep volatile cold traps.',
    lat: -89.70,
    lon: 120.00,
    badge: 'South Pole Peak',
  },
  {
    id: 'landing-artemis3-mouton',
    name: 'Mons Mouton (84.5°S)',
    description: 'Flat plateau target for Astrobotic Griffin & VIPER water-ice drill operations.',
    lat: -84.50,
    lon: 31.70,
    badge: 'Ice Prospecting',
  },
  {
    id: 'clps-im1-odysseus',
    name: 'Malapert A (80.1°S)',
    description: 'Intuitive Machines IM-1 Odysseus first commercial soft-landing site.',
    lat: -80.13,
    lon: 1.44,
    badge: 'CLPS Proven',
  },
  {
    id: 'landing-apollo-11',
    name: 'Mare Tranquillitatis (0.67°N)',
    description: 'Historic Apollo 11 equatorial basaltic plain with high solar elevation.',
    lat: 0.6741,
    lon: 23.4730,
    badge: 'Equatorial Heritage',
  },
];

export const EPOCH_PRESETS = [
  {
    id: 'now',
    label: 'Live Ephemeris (Now)',
    epochMs: () => Date.now(),
    description: 'Real-time solar terminator & planetary positions',
  },
  {
    id: 'artemis3-target',
    label: 'Artemis III Target (Sep 2026)',
    epochMs: () => Date.UTC(2026, 8, 15, 12, 0, 0),
    description: 'Planned crewed lunar landing window',
  },
  {
    id: 'summer-solstice',
    label: 'South Pole Summer (Dec 2026)',
    epochMs: () => Date.UTC(2026, 11, 21, 21, 50, 0),
    description: 'Maximum southern solar elevation & continuous light',
  },
  {
    id: 'winter-solstice',
    label: 'South Pole Winter (Jun 2026)',
    epochMs: () => Date.UTC(2026, 5, 21, 14, 24, 0),
    description: 'Low solar elevation and prolonged terrain shadowing',
  },
];

export default function Stage01MissionSetupCard({
  isOpen = true,
  onClose,
  activeMission,
  onSelectMission,
  onSelectTargetRegion,
  onAdvanceToNextStage,
}) {
  const [selectedRegionId, setSelectedRegionId] = useState(POPULAR_REGIONS[0].id);
  const [selectedEpochPreset, setSelectedEpochPreset] = useState('artemis3-target');

  if (!isOpen) return null;

  const handleApplySetup = () => {
    const region =
      POPULAR_REGIONS.find((r) => r.id === selectedRegionId) ||
      LANDING_SITES.find((s) => s.id === selectedRegionId) ||
      POPULAR_REGIONS[0];

    const preset = EPOCH_PRESETS.find((p) => p.id === selectedEpochPreset);
    if (preset) {
      celestialTimeStore.setMs(preset.epochMs(), 'preset');
    }

    if (onSelectTargetRegion) {
      onSelectTargetRegion(region);
    }
    if (onAdvanceToNextStage) {
      onAdvanceToNextStage();
    }
  };

  return (
    <div className="absolute left-3 sm:left-[304px] top-14 z-20 w-[calc(100vw-24px)] sm:w-[460px] max-h-[calc(100vh-80px)] overflow-y-auto bg-[#040711]/95 backdrop-blur-2xl border border-slate-800/90 rounded-2xl shadow-2xl p-4 sm:p-5 text-slate-100 animate-in fade-in zoom-in-95 duration-150">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-800/80 mb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-cyan-950/80 border border-cyan-500/40 text-cyan-300 flex items-center justify-center font-mono font-bold text-xs">
            01
          </div>
          <div>
            <h2 className="text-sm font-bold text-white tracking-wide flex items-center gap-2">
              Mission Setup & Parameters
            </h2>
            <p className="text-[11px] text-slate-400">
              Configure spacecraft profile, landing region, and mission epoch.
            </p>
          </div>
        </div>

        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/80 transition-colors"
            title="Minimize Setup HUD"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Section 1: Spacecraft & Mission Profile */}
      <div className="mb-4">
        <label className="text-[11px] font-mono uppercase tracking-wider text-slate-400 flex items-center gap-1.5 mb-2 font-semibold">
          <Rocket className="w-3.5 h-3.5 text-cyan-400" />
          1. Spacecraft / Flight Profile
        </label>
        <select
          value={activeMission?.id || ''}
          onChange={(e) => {
            const chosen = CLPS_MISSIONS.find((m) => m.id === e.target.value);
            if (chosen && onSelectMission) onSelectMission(chosen);
          }}
          className="w-full h-9 px-3 text-xs bg-slate-900/90 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-cyan-500/60 transition-colors"
        >
          {CLPS_MISSIONS.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name} ({m.provider}) — {m.lander}
            </option>
          ))}
        </select>
        {activeMission && (
          <p className="mt-1.5 text-[11px] text-slate-400 leading-relaxed">
            {activeMission.description}
          </p>
        )}
      </div>

      {/* Section 2: Target Landing Region */}
      <div className="mb-4">
        <label className="text-[11px] font-mono uppercase tracking-wider text-slate-400 flex items-center gap-1.5 mb-2 font-semibold">
          <MapPin className="w-3.5 h-3.5 text-cyan-400" />
          2. Candidate Landing Region
        </label>
        <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
          {POPULAR_REGIONS.map((region) => {
            const isSelected = selectedRegionId === region.id;
            return (
              <button
                key={region.id}
                type="button"
                onClick={() => setSelectedRegionId(region.id)}
                className={`w-full p-2.5 rounded-xl text-left border transition-all ${
                  isSelected
                    ? 'bg-cyan-950/70 border-cyan-500/50 text-white shadow-sm'
                    : 'bg-slate-900/60 border-slate-800/80 text-slate-300 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-slate-200">
                    {region.name}
                  </span>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800/80 border border-slate-700/60 text-cyan-300">
                    {region.badge}
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 mt-1 line-clamp-1">
                  {region.description}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Section 3: Mission Date & Ephemeris Epoch */}
      <div className="mb-5">
        <label className="text-[11px] font-mono uppercase tracking-wider text-slate-400 flex items-center gap-1.5 mb-2 font-semibold">
          <Calendar className="w-3.5 h-3.5 text-amber-400" />
          3. Mission Simulation Epoch
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
          {EPOCH_PRESETS.map((preset) => {
            const isSelected = selectedEpochPreset === preset.id;
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => setSelectedEpochPreset(preset.id)}
                className={`p-2 rounded-xl text-left border transition-all ${
                  isSelected
                    ? 'bg-amber-950/60 border-amber-500/50 text-amber-200 shadow-sm'
                    : 'bg-slate-900/60 border-slate-800/80 text-slate-400 hover:text-slate-200'
                }`}
              >
                <div className="text-[11px] font-semibold truncate">
                  {preset.label}
                </div>
                <div className="text-[10px] text-slate-400 truncate mt-0.5">
                  {preset.description}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Submit Button */}
      <button
        type="button"
        onClick={handleApplySetup}
        className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold text-xs tracking-wider uppercase transition-all shadow-lg active:scale-95 flex items-center justify-center gap-2"
      >
        <span>Lock Setup & Fly to Candidate Region</span>
        <ChevronRight className="w-4 h-4 text-slate-950" />
      </button>
    </div>
  );
}
