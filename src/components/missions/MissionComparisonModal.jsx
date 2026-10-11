import React, { useState } from 'react';
import {
  X,
  GitCompare,
  Navigation,
  ExternalLink,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Layers,
  Rocket,
  Target,
  Globe2,
} from 'lucide-react';
import { CLPS_MISSIONS } from '../../data/clpsMissions.js';

/**
 * Side-by-side comparison modal for two NASA CLPS missions.
 */
export default function MissionComparisonModal({
  isOpen,
  onClose,
  initialMissionA,
  onSelectMission,
}) {
  const [missionAId, setMissionAId] = useState(
    initialMissionA?.id || 'clps-im1-odysseus'
  );
  const [missionBId, setMissionBId] = useState(() => {
    // Pick another mission different from mission A
    const other = CLPS_MISSIONS.find((m) => m.id !== initialMissionA?.id);
    return other?.id || 'clps-im2-athena';
  });

  const missionA = CLPS_MISSIONS.find((m) => m.id === missionAId) || CLPS_MISSIONS[0];
  const missionB = CLPS_MISSIONS.find((m) => m.id === missionBId) || CLPS_MISSIONS[1];

  if (!isOpen) return null;

  const renderStatus = (m) => {
    switch (m.missionStatus) {
      case 'completed':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-950/80 text-emerald-300 border border-emerald-500/40">
            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
            Completed Soft Landing
          </span>
        );
      case 'failed':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-full bg-rose-950/80 text-rose-300 border border-rose-500/40">
            <AlertTriangle className="w-3 h-3 text-rose-400" />
            Flight Anomaly (Re-entry)
          </span>
        );
      case 'in-progress':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-950/80 text-amber-300 border border-amber-500/40 animate-pulse">
            <Clock className="w-3 h-3 text-amber-400" />
            Mission Active
          </span>
        );
      case 'planned':
      default:
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-950/80 text-cyan-300 border border-cyan-500/40">
            <Clock className="w-3 h-3 text-cyan-400" />
            Planned Mission Target
          </span>
        );
    }
  };

  return (
    <div
      id="mission-comparison-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-md animate-in fade-in duration-150 select-none pointer-events-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative w-full max-w-5xl max-h-[92vh] flex flex-col bg-[#050811] border border-slate-800 rounded-2xl shadow-2xl overflow-hidden text-slate-100">
        {/* Header */}
        <div className="flex items-center justify-between p-4 pb-3 border-b border-slate-800 bg-[#070d18]/90">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-cyan-950/80 border border-cyan-500/40 flex items-center justify-center text-cyan-300 shadow-md">
              <GitCompare className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight">
                NASA CLPS Mission Comparison Matrix
              </h2>
              <p className="text-[11px] font-mono text-cyan-400/90">
                Side-by-Side Comparison of Commercial Payloads, Providers & Surface Targets
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
            aria-label="Close comparison"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Comparison Selectors */}
        <div className="grid grid-cols-2 divide-x divide-slate-800 border-b border-slate-800 bg-[#060b14]">
          {/* Mission A Selector */}
          <div className="p-3">
            <label className="text-[10px] font-mono uppercase text-slate-400 block mb-1">
              Select Mission A
            </label>
            <select
              value={missionAId}
              onChange={(e) => setMissionAId(e.target.value)}
              className="w-full h-9 px-3 bg-slate-900 border border-slate-800 rounded-xl text-xs font-semibold text-white focus:outline-none focus:border-cyan-500/80 cursor-pointer"
            >
              {CLPS_MISSIONS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.taskOrder} · {m.name} ({m.provider})
                </option>
              ))}
            </select>
          </div>

          {/* Mission B Selector */}
          <div className="p-3">
            <label className="text-[10px] font-mono uppercase text-slate-400 block mb-1">
              Select Mission B
            </label>
            <select
              value={missionBId}
              onChange={(e) => setMissionBId(e.target.value)}
              className="w-full h-9 px-3 bg-slate-900 border border-slate-800 rounded-xl text-xs font-semibold text-white focus:outline-none focus:border-cyan-500/80 cursor-pointer"
            >
              {CLPS_MISSIONS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.taskOrder} · {m.name} ({m.provider})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Matrix Table */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar text-xs">
          {/* Top Mission Titles & Navigation Actions */}
          <div className="grid grid-cols-2 gap-4 pb-3 border-b border-slate-800">
            <div className="space-y-1.5 p-3 rounded-xl bg-slate-900/60 border border-slate-800">
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-cyan-950/80 text-cyan-300 border border-cyan-500/30">
                {missionA.taskOrder}
              </span>
              <h3 className="text-sm font-bold text-white mt-1">{missionA.name}</h3>
              <div>{renderStatus(missionA)}</div>
              <button
                type="button"
                onClick={() => {
                  onSelectMission(missionA);
                  onClose();
                }}
                className="mt-2 flex items-center gap-1.5 px-3 py-1 text-xs font-semibold text-white bg-gradient-to-r from-cyan-600 to-blue-600 rounded-lg hover:brightness-110"
              >
                <Navigation className="w-3 h-3" />
                <span>Fly To {missionA.taskOrder} Location</span>
              </button>
            </div>

            <div className="space-y-1.5 p-3 rounded-xl bg-slate-900/60 border border-slate-800">
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-cyan-950/80 text-cyan-300 border border-cyan-500/30">
                {missionB.taskOrder}
              </span>
              <h3 className="text-sm font-bold text-white mt-1">{missionB.name}</h3>
              <div>{renderStatus(missionB)}</div>
              <button
                type="button"
                onClick={() => {
                  onSelectMission(missionB);
                  onClose();
                }}
                className="mt-2 flex items-center gap-1.5 px-3 py-1 text-xs font-semibold text-white bg-gradient-to-r from-cyan-600 to-blue-600 rounded-lg hover:brightness-110"
              >
                <Navigation className="w-3 h-3" />
                <span>Fly To {missionB.taskOrder} Location</span>
              </button>
            </div>
          </div>

          {/* Specs Rows */}
          <div className="space-y-2">
            <div className="text-[11px] font-mono uppercase text-slate-500 tracking-wider">
              Spacecraft & Provider Attributes
            </div>

            {/* Provider Row */}
            <div className="grid grid-cols-2 gap-4 p-2.5 rounded-lg bg-slate-900/40 border border-slate-800/80">
              <div>
                <span className="text-[9.5px] font-mono text-slate-500 block">Commercial Provider</span>
                <span className="font-semibold text-white text-xs">{missionA.provider}</span>
              </div>
              <div>
                <span className="text-[9.5px] font-mono text-slate-500 block">Commercial Provider</span>
                <span className="font-semibold text-white text-xs">{missionB.provider}</span>
              </div>
            </div>

            {/* Lander Vehicle Row */}
            <div className="grid grid-cols-2 gap-4 p-2.5 rounded-lg bg-slate-900/40 border border-slate-800/80">
              <div>
                <span className="text-[9.5px] font-mono text-slate-500 block">Lander Vehicle</span>
                <span className="font-semibold text-cyan-300 text-xs">{missionA.lander}</span>
              </div>
              <div>
                <span className="text-[9.5px] font-mono text-slate-500 block">Lander Vehicle</span>
                <span className="font-semibold text-cyan-300 text-xs">{missionB.lander}</span>
              </div>
            </div>

            {/* Target Location Row */}
            <div className="grid grid-cols-2 gap-4 p-2.5 rounded-lg bg-slate-900/40 border border-slate-800/80">
              <div>
                <span className="text-[9.5px] font-mono text-slate-500 block">Landing Location</span>
                <span className="font-semibold text-white text-xs block">{missionA.landingSiteName}</span>
                <span className="font-mono text-cyan-400 text-[11px]">
                  {missionA.latitude.toFixed(2)}°, {missionA.longitude.toFixed(2)}° ({missionA.targetRegion})
                </span>
              </div>
              <div>
                <span className="text-[9.5px] font-mono text-slate-500 block">Landing Location</span>
                <span className="font-semibold text-white text-xs block">{missionB.landingSiteName}</span>
                <span className="font-mono text-cyan-400 text-[11px]">
                  {missionB.latitude.toFixed(2)}°, {missionB.longitude.toFixed(2)}° ({missionB.targetRegion})
                </span>
              </div>
            </div>

            {/* Timeline Row */}
            <div className="grid grid-cols-2 gap-4 p-2.5 rounded-lg bg-slate-900/40 border border-slate-800/80">
              <div>
                <span className="text-[9.5px] font-mono text-slate-500 block">Launch & Landing</span>
                <span className="font-mono text-slate-200 block">Launch: {missionA.launchDate}</span>
                {missionA.landingDate && (
                  <span className="font-mono text-emerald-300 text-[11px]">Landing: {missionA.landingDate}</span>
                )}
              </div>
              <div>
                <span className="text-[9.5px] font-mono text-slate-500 block">Launch & Landing</span>
                <span className="font-mono text-slate-200 block">Launch: {missionB.launchDate}</span>
                {missionB.landingDate && (
                  <span className="font-mono text-emerald-300 text-[11px]">Landing: {missionB.landingDate}</span>
                )}
              </div>
            </div>

            {/* Launch Vehicle Row */}
            <div className="grid grid-cols-2 gap-4 p-2.5 rounded-lg bg-slate-900/40 border border-slate-800/80">
              <div>
                <span className="text-[9.5px] font-mono text-slate-500 block">Launch Vehicle</span>
                <span className="text-slate-200 text-xs">{missionA.launchVehicle}</span>
              </div>
              <div>
                <span className="text-[9.5px] font-mono text-slate-500 block">Launch Vehicle</span>
                <span className="text-slate-200 text-xs">{missionB.launchVehicle}</span>
              </div>
            </div>
          </div>

          {/* Payloads Comparison */}
          <div className="space-y-2 pt-2">
            <div className="text-[11px] font-mono uppercase text-slate-500 tracking-wider">
              Manifested NASA Scientific Payloads
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 rounded-xl bg-slate-900/50 border border-slate-800 space-y-2">
                <div className="text-xs font-semibold text-cyan-300">
                  {missionA.name} ({missionA.payloads.length} Instruments)
                </div>
                <div className="space-y-1.5">
                  {missionA.payloads.map((p) => (
                    <div key={p.name} className="p-2 rounded bg-black/40 border border-slate-800/80">
                      <div className="flex items-center justify-between font-mono text-[11px]">
                        <span className="font-bold text-cyan-300">{p.name}</span>
                        <span className="text-[9px] px-1.5 rounded bg-slate-800 text-slate-400">
                          {p.agency}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-300 mt-0.5">{p.fullName}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-900/50 border border-slate-800 space-y-2">
                <div className="text-xs font-semibold text-cyan-300">
                  {missionB.name} ({missionB.payloads.length} Instruments)
                </div>
                <div className="space-y-1.5">
                  {missionB.payloads.map((p) => (
                    <div key={p.name} className="p-2 rounded bg-black/40 border border-slate-800/80">
                      <div className="flex items-center justify-between font-mono text-[11px]">
                        <span className="font-bold text-cyan-300">{p.name}</span>
                        <span className="text-[9px] px-1.5 rounded bg-slate-800 text-slate-400">
                          {p.agency}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-300 mt-0.5">{p.fullName}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Objectives Comparison */}
          <div className="space-y-2 pt-2">
            <div className="text-[11px] font-mono uppercase text-slate-500 tracking-wider">
              Scientific Objectives
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 rounded-xl bg-slate-900/30 border border-slate-800/70 text-[11px] text-slate-300 leading-relaxed">
                {missionA.objectives}
              </div>
              <div className="p-3 rounded-xl bg-slate-900/30 border border-slate-800/70 text-[11px] text-slate-300 leading-relaxed">
                {missionB.objectives}
              </div>
            </div>
          </div>

          {/* Official Documentation Links */}
          <div className="grid grid-cols-2 gap-4 pt-2 border-t border-slate-800">
            <a
              href={missionA.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-[11px] text-cyan-400 hover:text-cyan-300 font-mono"
            >
              <span>{missionA.taskOrder} NASA Documentation</span>
              <ExternalLink className="w-3 h-3" />
            </a>

            <a
              href={missionB.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-cyan-400 hover:text-cyan-300 font-mono"
            >
              <span>{missionB.taskOrder} NASA Documentation</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
