import React, { useState } from 'react';
import { X, Rocket, MapPin, ArrowRight, CheckCircle2, Clock, AlertTriangle } from 'lucide-react';
import { CLPS_MISSIONS } from '../../data/clpsMissions.js';
import { formatLunarCoordinates } from '../../utils/coordinates.js';

export default function CompactMissionsModal({ isOpen, onClose, onLaunchExplorer }) {
  const [filter, setFilter] = useState('all');

  if (!isOpen) return null;

  const filteredMissions = CLPS_MISSIONS.filter((m) => {
    if (filter === 'completed') return m.missionStatus === 'completed';
    if (filter === 'planned') return m.missionStatus === 'planned';
    if (filter === 'south-pole') return m.targetRegion === 'South Pole';
    return true;
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col rounded-2xl bg-[#050813] border border-slate-800 text-left shadow-2xl shadow-cyan-950/20"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-6 pb-4 border-b border-slate-800 flex items-center justify-between">
          <div>
            <div className="text-[10px] font-mono tracking-widest text-cyan-400 uppercase mb-1">
              CLPS MISSION MANIFEST
            </div>
            <h2 className="text-xl font-bold text-white tracking-tight">
              Commercial Lunar Missions
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filter Pills */}
        <div className="px-6 py-3 border-b border-slate-800/80 bg-slate-900/40 flex items-center gap-2 overflow-x-auto">
          {['all', 'completed', 'planned', 'south-pole'].map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`px-3 py-1 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                filter === f
                  ? 'bg-cyan-600 text-white font-semibold'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              {f === 'all'
                ? `All (${CLPS_MISSIONS.length})`
                : f === 'completed'
                ? 'Completed'
                : f === 'planned'
                ? 'Planned'
                : 'South Pole'}
            </button>
          ))}
        </div>

        {/* Missions List */}
        <div className="p-6 overflow-y-auto space-y-3 flex-1">
          {filteredMissions.map((m) => {
            const coords = formatLunarCoordinates(m.longitude, m.latitude, 2).combined;
            return (
              <div
                key={m.id}
                onClick={() => {
                  onClose();
                  onLaunchExplorer({
                    selectedMission: m,
                    lon: m.longitude,
                    lat: m.latitude,
                    zoom: 5.2,
                  });
                }}
                className="p-3.5 rounded-xl bg-slate-900/60 hover:bg-slate-800/80 border border-slate-800/80 hover:border-cyan-500/40 transition-all cursor-pointer flex items-center justify-between group"
              >
                <div className="min-w-0 pr-3">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-bold text-white group-hover:text-cyan-300 transition-colors truncate">
                      {m.name}
                    </span>
                    <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-800 text-slate-300 border border-slate-700">
                      {m.provider}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-slate-400 font-mono">
                    <span className="truncate">{m.landingSiteName}</span>
                    <span>•</span>
                    <span className="text-cyan-400/80 shrink-0">{coords}</span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 text-xs text-slate-400 group-hover:text-cyan-300 font-medium shrink-0">
                  <span className="hidden sm:inline text-[11px]">View on map</span>
                  <ArrowRight className="w-4 h-4 text-cyan-400" />
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="p-4 px-6 border-t border-slate-800 bg-slate-950 flex items-center justify-between text-xs">
          <span className="text-slate-500">Select any mission to explore on the map</span>
          <button
            type="button"
            onClick={() => {
              onClose();
              onLaunchExplorer();
            }}
            className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-medium transition-colors"
          >
            Open Explorer
          </button>
        </div>
      </div>
    </div>
  );
}
