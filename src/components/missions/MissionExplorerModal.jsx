import React, { useState, useMemo } from 'react';
import {
  X,
  Search,
  Filter,
  ArrowUpDown,
  Rocket,
  Navigation,
  GitCompare,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ExternalLink,
  Target,
  Layers,
  MapPin,
} from 'lucide-react';
import { CLPS_MISSIONS } from '../../data/clpsMissions.js';

/**
 * Dedicated Mission Explorer dialog with search, filtering, and sort capabilities.
 */
export default function MissionExplorerModal({
  isOpen,
  onClose,
  onSelectMission,
  onCompareMission,
  currentSelectedId,
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [providerFilter, setProviderFilter] = useState('all');
  const [regionFilter, setRegionFilter] = useState('all');
  const [sortBy, setSortBy] = useState('taskOrder'); // 'taskOrder' | 'date' | 'name' | 'provider'

  // Unique lists for filter options
  const providers = useMemo(() => {
    return Array.from(new Set(CLPS_MISSIONS.map((m) => m.provider))).sort();
  }, []);

  const regions = useMemo(() => {
    return Array.from(new Set(CLPS_MISSIONS.map((m) => m.targetRegion))).sort();
  }, []);

  // Filtered and sorted missions list
  const filteredMissions = useMemo(() => {
    return CLPS_MISSIONS.filter((m) => {
      if (statusFilter !== 'all' && m.missionStatus !== statusFilter) return false;
      if (providerFilter !== 'all' && m.provider !== providerFilter) return false;
      if (regionFilter !== 'all' && m.targetRegion !== regionFilter) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const inName = m.name.toLowerCase().includes(q);
        const inTask = m.taskOrder.toLowerCase().includes(q);
        const inProv = m.provider.toLowerCase().includes(q);
        const inLander = m.lander.toLowerCase().includes(q);
        const inSite = m.landingSiteName.toLowerCase().includes(q);
        const inPayload = m.payloads.some(
          (p) =>
            p.name.toLowerCase().includes(q) ||
            p.fullName.toLowerCase().includes(q) ||
            p.purpose.toLowerCase().includes(q)
        );
        if (!inName && !inTask && !inProv && !inLander && !inSite && !inPayload) {
          return false;
        }
      }
      return true;
    }).sort((a, b) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      if (sortBy === 'provider') return a.provider.localeCompare(b.provider);
      if (sortBy === 'date') return (a.launchDate || '').localeCompare(b.launchDate || '');
      // Default: task order
      return a.taskOrder.localeCompare(b.taskOrder);
    });
  }, [searchQuery, statusFilter, providerFilter, regionFilter, sortBy]);

  if (!isOpen) return null;

  return (
    <div
      id="mission-explorer-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md animate-in fade-in duration-150 select-none pointer-events-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative w-full max-w-4xl max-h-[90vh] flex flex-col bg-[#050811] border border-slate-800 rounded-2xl shadow-2xl overflow-hidden text-slate-100">
        {/* Header */}
        <div className="flex items-center justify-between p-4 pb-3 border-b border-slate-800 bg-[#070d18]/80">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-cyan-950/80 border border-cyan-500/40 flex items-center justify-center text-cyan-300 shadow-md">
              <Rocket className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight">
                NASA CLPS Mission Explorer
              </h2>
              <p className="text-[11px] font-mono text-cyan-400/90">
                Commercial Lunar Payload Services · Manifest & Surface Targets
              </p>
            </div>
          </div>

          <button
            id="btn-close-mission-explorer"
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
            aria-label="Close mission explorer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filter & Search Bar */}
        <div className="p-3.5 border-b border-slate-800/80 bg-[#060b14] flex flex-col sm:flex-row gap-2.5">
          {/* Search field */}
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by mission, provider, task order, payload (e.g. TRIDENT, ROLSES)..."
              className="w-full h-9 pl-9 pr-8 bg-slate-900/90 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500/80 font-sans"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-white"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Quick Filters Cluster */}
          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-9 px-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-cyan-500/80 cursor-pointer"
            >
              <option value="all">All Statuses</option>
              <option value="completed">Completed Landing</option>
              <option value="planned">Planned Target</option>
              <option value="failed">Flight Anomaly</option>
            </select>

            {/* Provider Filter */}
            <select
              value={providerFilter}
              onChange={(e) => setProviderFilter(e.target.value)}
              className="h-9 px-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-cyan-500/80 cursor-pointer max-w-[140px] truncate"
            >
              <option value="all">All Providers</option>
              {providers.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>

            {/* Region Filter */}
            <select
              value={regionFilter}
              onChange={(e) => setRegionFilter(e.target.value)}
              className="h-9 px-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-cyan-500/80 cursor-pointer max-w-[130px] truncate"
            >
              <option value="all">All Regions</option>
              {regions.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>

            {/* Sort Selector */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="h-9 px-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-300 focus:outline-none focus:border-cyan-500/80 cursor-pointer"
              title="Sort order"
            >
              <option value="taskOrder">Task Order</option>
              <option value="date">Launch Date</option>
              <option value="name">Mission Name</option>
              <option value="provider">Provider</option>
            </select>
          </div>
        </div>

        {/* Results Count Banner */}
        <div className="px-4 py-1.5 bg-[#070c17] border-b border-slate-800/60 flex items-center justify-between text-[11px] font-mono text-slate-400">
          <span>
            Showing <strong className="text-cyan-400">{filteredMissions.length}</strong> of {CLPS_MISSIONS.length} NASA Task Orders
          </span>
          <span className="text-slate-500">Click any mission to explore on 2D/3D map</span>
        </div>

        {/* Mission Cards Grid */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
          {filteredMissions.length === 0 ? (
            <div className="p-12 text-center text-slate-400 space-y-2">
              <Rocket className="w-8 h-8 mx-auto text-slate-600" />
              <div className="text-sm font-semibold text-slate-300">No matching CLPS missions found</div>
              <p className="text-xs text-slate-500">
                Try clearing search terms or resetting status and provider filters.
              </p>
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setStatusFilter('all');
                  setProviderFilter('all');
                  setRegionFilter('all');
                }}
                className="mt-2 px-3 py-1 text-xs text-cyan-400 bg-cyan-950/60 border border-cyan-800/60 rounded-lg hover:bg-cyan-900/60"
              >
                Reset All Filters
              </button>
            </div>
          ) : (
            filteredMissions.map((mission) => {
              const isSelected = currentSelectedId === mission.id;
              return (
                <div
                  key={mission.id}
                  className={`p-3.5 rounded-xl border transition-all ${
                    isSelected
                      ? 'bg-slate-900/90 border-cyan-500/60 shadow-lg shadow-cyan-950/40'
                      : 'bg-[#060b14]/90 border-slate-800 hover:border-slate-700 hover:bg-slate-900/50'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 pb-2 border-b border-slate-800/80">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-cyan-950/80 text-cyan-300 border border-cyan-500/30">
                        {mission.taskOrder}
                      </span>
                      <h3 className="text-sm font-bold text-white truncate">
                        {mission.name}
                      </h3>
                      <span className="text-xs text-slate-400 hidden md:inline">
                        · {mission.provider}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {mission.missionStatus === 'completed' && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-950/80 text-emerald-300 border border-emerald-500/40">
                          <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                          Completed Soft Landing
                        </span>
                      )}
                      {mission.missionStatus === 'failed' && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-full bg-rose-950/80 text-rose-300 border border-rose-500/40">
                          <AlertTriangle className="w-3 h-3 text-rose-400" />
                          Flight Anomaly (Re-entry)
                        </span>
                      )}
                      {mission.missionStatus === 'planned' && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-950/80 text-cyan-300 border border-cyan-500/40">
                          <Clock className="w-3 h-3 text-cyan-400" />
                          Planned Target
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 py-2.5 text-xs text-slate-300">
                    <div>
                      <span className="text-[9.5px] font-mono uppercase text-slate-500 block">Lander Vehicle</span>
                      <span className="font-semibold text-slate-200">{mission.lander}</span>
                    </div>
                    <div>
                      <span className="text-[9.5px] font-mono uppercase text-slate-500 block">Target Site & Region</span>
                      <span className="font-semibold text-white truncate block">
                        {mission.landingSiteName}
                      </span>
                      <span className="text-[10px] font-mono text-cyan-400">
                        {mission.latitude.toFixed(2)}°, {mission.longitude.toFixed(2)}° ({mission.targetRegion})
                      </span>
                    </div>
                    <div>
                      <span className="text-[9.5px] font-mono uppercase text-slate-500 block">Launch Timeline</span>
                      <span className="font-mono text-slate-200">{mission.launchDate}</span>
                      {mission.landingDate && (
                        <span className="text-[10px] text-emerald-300 block font-mono">
                          Landed: {mission.landingDate}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Payloads tags */}
                  <div className="flex items-center gap-1.5 flex-wrap pt-2 border-t border-slate-800/80">
                    <span className="text-[10px] font-mono text-slate-500 uppercase mr-1">
                      Manifest ({mission.payloads.length}):
                    </span>
                    {mission.payloads.map((p) => (
                      <span
                        key={p.name}
                        title={`${p.fullName} (${p.agency}): ${p.purpose}`}
                        className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-300"
                      >
                        {p.name}
                      </span>
                    ))}
                  </div>

                  {/* Action buttons */}
                  <div className="flex items-center justify-between pt-2.5 mt-2.5 border-t border-slate-800/80">
                    <a
                      href={mission.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-cyan-300 font-mono transition-colors"
                    >
                      <span>Official NASA Doc</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>

                    <div className="flex items-center gap-2">
                      {onCompareMission && (
                        <button
                          type="button"
                          onClick={() => onCompareMission(mission)}
                          className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-300 hover:text-white bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg transition-colors"
                          title="Compare with another mission"
                        >
                          <GitCompare className="w-3 h-3 text-cyan-400" />
                          <span>Compare</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => {
                          onSelectMission(mission);
                          onClose();
                        }}
                        className="flex items-center gap-1.5 px-3 py-1 text-xs font-semibold text-white bg-gradient-to-r from-cyan-600 to-blue-600 hover:brightness-110 rounded-lg shadow-md transition-all"
                      >
                        <Navigation className="w-3 h-3" />
                        <span>Navigate To Map</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
