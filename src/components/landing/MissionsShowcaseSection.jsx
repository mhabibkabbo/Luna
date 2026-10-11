import React, { useState } from 'react';
import {
  Rocket,
  MapPin,
  ExternalLink,
  Layers,
  Calendar,
  Compass,
  ArrowRight,
  Shield,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Info,
} from 'lucide-react';
import { CLPS_MISSIONS } from '../../data/clpsMissions.js';
import { formatLunarCoordinates } from '../../utils/coordinates.js';

export default function MissionsShowcaseSection({ onLaunchExplorer }) {
  const [filter, setFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  const statusConfig = {
    completed: {
      label: 'Completed Soft Landing',
      bg: 'bg-emerald-950/60 text-emerald-300 border-emerald-500/30',
      icon: CheckCircle2,
    },
    planned: {
      label: 'Planned Target',
      bg: 'bg-cyan-950/60 text-cyan-300 border-cyan-500/30',
      icon: Clock,
    },
    'in-progress': {
      label: 'In Progress',
      bg: 'bg-blue-950/60 text-blue-300 border-blue-500/30',
      icon: Clock,
    },
    failed: {
      label: 'Flight Anomaly',
      bg: 'bg-rose-950/60 text-rose-300 border-rose-500/30',
      icon: AlertTriangle,
    },
    postponed: {
      label: 'Postponed',
      bg: 'bg-amber-950/60 text-amber-300 border-amber-500/30',
      icon: Clock,
    },
  };

  const filteredMissions = CLPS_MISSIONS.filter((m) => {
    if (filter === 'completed' && m.missionStatus !== 'completed') return false;
    if (filter === 'planned' && m.missionStatus !== 'planned') return false;
    if (filter === 'south-pole' && m.targetRegion !== 'South Pole') return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = m.name.toLowerCase().includes(q);
      const matchProvider = m.provider.toLowerCase().includes(q);
      const matchSite = m.landingSiteName.toLowerCase().includes(q);
      const matchPayload = m.payloads?.some(
        (p) => p.name.toLowerCase().includes(q) || p.fullName.toLowerCase().includes(q)
      );
      if (!matchName && !matchProvider && !matchSite && !matchPayload) return false;
    }
    return true;
  });

  return (
    <section id="missions" className="py-24 px-4 sm:px-6 lg:px-8 bg-[#040814] border-t border-slate-900">
      <div className="max-w-7xl mx-auto">
        {/* Section Header */}
        <div className="max-w-3xl mx-auto text-center mb-12">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-900 border border-slate-800 text-[11px] font-mono tracking-wider text-cyan-400 uppercase mb-4">
            <Rocket className="w-3.5 h-3.5 text-cyan-400" />
            <span>COMMERCIAL LUNAR PAYLOAD SERVICES</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight mb-5">
            NASA CLPS Missions Portfolio
          </h2>
          <p className="text-base sm:text-lg text-slate-300 leading-relaxed">
            NASA contracts private aerospace companies to land science and technology payloads on
            the lunar surface. Browse verified mission trajectories, landing zones, and payloads.
          </p>
        </div>

        {/* Filter Controls & Search */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-8">
          {/* Status Filters */}
          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-900/90 border border-slate-800 w-full sm:w-auto overflow-x-auto no-scrollbar">
            <button
              type="button"
              onClick={() => setFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                filter === 'all'
                  ? 'bg-cyan-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              All Missions ({CLPS_MISSIONS.length})
            </button>
            <button
              type="button"
              onClick={() => setFilter('completed')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                filter === 'completed'
                  ? 'bg-cyan-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Completed
            </button>
            <button
              type="button"
              onClick={() => setFilter('planned')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                filter === 'planned'
                  ? 'bg-cyan-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Planned
            </button>
            <button
              type="button"
              onClick={() => setFilter('south-pole')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                filter === 'south-pole'
                  ? 'bg-cyan-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              South Pole Region
            </button>
          </div>

          {/* Quick Search */}
          <div className="w-full sm:w-64">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter by name, provider, payload..."
              className="w-full px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/60"
            />
          </div>
        </div>

        {/* Missions Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredMissions.map((mission) => {
            const statusInfo = statusConfig[mission.missionStatus] || statusConfig.planned;
            const StatusIcon = statusInfo.icon;
            const coordsFormatted = formatLunarCoordinates(mission.longitude, mission.latitude, 2).combined;

            return (
              <div
                key={mission.id}
                className="group flex flex-col justify-between p-6 rounded-2xl bg-slate-900/60 border border-slate-800/90 hover:border-cyan-500/50 transition-all duration-300 hover:bg-slate-900/90 hover:shadow-xl hover:shadow-cyan-950/20"
              >
                <div>
                  {/* Header Row: Provider & Status Pill */}
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <span className="text-[11px] font-mono text-cyan-400 font-semibold tracking-wider uppercase">
                      {mission.provider}
                    </span>
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-medium border ${statusInfo.bg}`}
                    >
                      <StatusIcon className="w-3 h-3" />
                      <span>{statusInfo.label}</span>
                    </span>
                  </div>

                  {/* Mission Title */}
                  <h3 className="text-lg font-bold text-white mb-1 group-hover:text-cyan-200 transition-colors">
                    {mission.name}
                  </h3>

                  {/* Lander & Task Order */}
                  <div className="flex items-center gap-2 text-xs text-slate-400 mb-4 font-mono">
                    <span>{mission.lander}</span>
                    <span>•</span>
                    <span className="text-slate-500">{mission.taskOrder}</span>
                  </div>

                  {/* Target Site & Coordinates */}
                  <div className="p-3 rounded-xl bg-[#030611] border border-slate-800/90 mb-4 text-xs space-y-1.5">
                    <div className="flex items-start gap-2 text-slate-300">
                      <MapPin className="w-3.5 h-3.5 text-cyan-400 shrink-0 mt-0.5" />
                      <span className="font-medium text-white">{mission.landingSiteName}</span>
                    </div>
                    <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 pt-1 border-t border-slate-800/60">
                      <span>{coordsFormatted}</span>
                      <span className="text-cyan-400/80">{mission.targetRegion}</span>
                    </div>
                  </div>

                  {/* Mission Objectives Snippet */}
                  <p className="text-xs text-slate-400 leading-relaxed line-clamp-3 mb-4">
                    {mission.objectives}
                  </p>

                  {/* Key Payloads Highlights */}
                  {mission.payloads && mission.payloads.length > 0 && (
                    <div className="mb-4">
                      <div className="text-[10px] font-mono text-slate-500 uppercase tracking-wider mb-1.5">
                        Scientific Payloads ({mission.payloads.length})
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {mission.payloads.slice(0, 4).map((p) => (
                          <span
                            key={p.name}
                            className="px-2 py-0.5 rounded bg-slate-800/80 text-[10px] font-mono text-slate-300 border border-slate-700/60"
                            title={`${p.fullName} (${p.agency})`}
                          >
                            {p.name}
                          </span>
                        ))}
                        {mission.payloads.length > 4 && (
                          <span className="px-1.5 py-0.5 rounded bg-slate-800/50 text-[10px] font-mono text-slate-400">
                            +{mission.payloads.length - 4} more
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Footer Action: Fly to Location in Explorer */}
                <div className="pt-4 border-t border-slate-800/80 mt-2 flex items-center justify-between">
                  <span className="text-[11px] font-mono text-slate-500">
                    {mission.launchVehicle}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      onLaunchExplorer({
                        missionId: mission.id,
                        selectedMission: mission,
                        lon: mission.longitude,
                        lat: mission.latitude,
                        zoom: 5.2,
                      })
                    }
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-950/80 hover:bg-cyan-900/90 text-cyan-300 hover:text-white border border-cyan-500/40 text-xs font-semibold tracking-wide transition-all active:scale-95 shadow-sm"
                  >
                    <span>View on Lunar Map</span>
                    <ArrowRight className="w-3 h-3 text-cyan-400" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
