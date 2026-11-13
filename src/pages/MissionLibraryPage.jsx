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
  AlertTriangle,
} from 'lucide-react';
import { CLPS_MISSIONS, filterClpsMissions } from '../data/clpsMissions.js';
import {
  getMissionOutcomeMeta,
  isMissionAnomaly,
} from '../data/missions.js';
import { EARTH_COMMUNICATION_SITES } from '../data/earthCommunicationSites.js';
import { NASA_DATASETS_REGISTRY, PROVENANCE_BADGES } from '../data/nasaProvenance.js';
import { celestialTimeStore } from '../utils/celestialTime.js';
import { computeCelestialState } from '../utils/lunarEphemeris.js';
import { notifySuccess } from '../utils/feedbackStore.js';
import ExpandableText from '../components/common/ExpandableText.jsx';
import LolaValidationPanel from '../components/analysis/LolaValidationPanel.jsx';

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
    id: 'clps-firefly-bgm1',
    label: 'Firefly Blue Ghost 1 (Mar 02, 2025)',
    iso: '2025-03-02T08:34:00Z',
    site: {
      id: 'clps-firefly-bgm1',
      name: 'Blue Ghost Mission 1 (Mare Crisium)',
      latitude: 18.56,
      longitude: 61.81,
      type: 'clps-mission',
      body: 'moon',
    },
  },
];

const fmtLatLon = (lat, lon, digits = 4) =>
  `${Math.abs(lat).toFixed(digits)}°${lat >= 0 ? 'N' : 'S'}, ${Math.abs(lon).toFixed(digits)}°${lon >= 0 ? 'E' : 'W'}`;

function angularSeparationDeg(lat1Deg, lon1Deg, lat2Deg, lon2Deg) {
  const toRad = Math.PI / 180;
  const phi1 = lat1Deg * toRad;
  const phi2 = lat2Deg * toRad;
  const dPhi = (lat2Deg - lat1Deg) * toRad;
  const dLam = (lon2Deg - lon1Deg) * toRad;
  const a =
    Math.sin(dPhi / 2) ** 2 +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(dLam / 2) ** 2;
  return (2 * Math.atan2(Math.sqrt(a), Math.sqrt(Math.max(0, 1 - a))) * 180) / Math.PI;
}

/**
 * Authentic reference vectors retrieved from NASA JPL Horizons System
 * (Target: 301 Moon, Observer: 500@399 Geocentric, Quantities 14 & 15:
 * Sub-Observer & Sub-Solar Selenographic Lon/Lat in IAU_MOON frame, DE441/DE440).
 */
export const JPL_HORIZONS_REFERENCE_EPOCHS = [
  {
    epoch: '2024-02-22 23:24 UTC (IM-1 Touchdown)',
    iso: '2024-02-22T23:24:00Z',
    jplSun: { lat: -1.10817, lon: 19.725541 },
    jplEarth: { lat: -5.803335, lon: 2.95072 },
  },
  {
    epoch: "2024-06-01 22:23 UTC (Chang'e-6 Landing)",
    iso: '2024-06-01T22:23:00Z',
    jplSun: { lat: 1.31349, lon: -119.139591 }, // 240.860409°E wrapped to [-180°, +180°]
    jplEarth: { lat: 0.284852, lon: 0.091835 },
  },
  {
    epoch: '2025-03-02 08:34 UTC (Blue Ghost 1)',
    iso: '2025-03-02T08:34:00Z',
    jplSun: { lat: -0.442223, lon: 148.047293 },
    jplEarth: { lat: -1.911237, lon: 0.071942 },
  },
  {
    epoch: '2026-09-15 12:00 UTC (Equinox Validation Epoch)',
    iso: '2026-09-15T12:00:00Z',
    jplSun: { lat: -0.642674, lon: 131.667056 },
    jplEarth: { lat: 6.60331, lon: 4.432967 },
  },
];

export const JPL_HORIZONS_BENCHMARKS = JPL_HORIZONS_REFERENCE_EPOCHS.map((row) => {
  const st = computeCelestialState(Date.parse(row.iso));
  const sunErrDeg = angularSeparationDeg(
    row.jplSun.lat,
    row.jplSun.lon,
    st.sun.subLat,
    st.sun.subLon
  );
  const earthErrDeg = angularSeparationDeg(
    row.jplEarth.lat,
    row.jplEarth.lon,
    st.earth.subLat,
    st.earth.subLon
  );
  const meanErrDeg = (sunErrDeg + earthErrDeg) / 2;

  return {
    epoch: row.epoch,
    iso: row.iso,
    jplSubSolar: fmtLatLon(row.jplSun.lat, row.jplSun.lon, 4),
    lunaSubSolar: fmtLatLon(st.sun.subLat, st.sun.subLon, 4),
    jplSubEarth: fmtLatLon(row.jplEarth.lat, row.jplEarth.lon, 4),
    lunaSubEarth: fmtLatLon(st.earth.subLat, st.earth.subLon, 4),
    sunErrDeg,
    earthErrDeg,
    meanErrDeg,
    residual: `Δ☉ ${sunErrDeg.toFixed(4)}° · Δ⊕ ${earthErrDeg.toFixed(4)}°`,
  };
});

const MEAN_BENCHMARK_RESIDUAL_DEG =
  JPL_HORIZONS_BENCHMARKS.reduce((acc, r) => acc + r.meanErrDeg, 0) /
  JPL_HORIZONS_BENCHMARKS.length;

export default function MissionLibraryPage({
  onSelectMission,
  onNavigate,
}) {
  const [activeTab, setActiveTab] = useState('missions'); // 'missions' | 'stations' | 'science' | 'datasets' | 'shortcuts'
  const [selectedMission, setSelectedMission] = useState(CLPS_MISSIONS[0]);
  const [missionSearch, setMissionSearch] = useState('');
  const [missionStatusFilter, setMissionStatusFilter] = useState('all'); // 'all' | 'success' | 'partial' | 'failure' | 'anomaly' | 'planned'
  const [stationSearch, setStationSearch] = useState('');

  const filteredMissions = filterClpsMissions({
    status: missionStatusFilter,
    query: missionSearch,
  });

  const displayedMission =
    filteredMissions.find((m) => m.id === selectedMission?.id) ||
    filteredMissions[0] ||
    null;

  const filteredStations = EARTH_COMMUNICATION_SITES.filter((st) => {
    if (!stationSearch.trim()) return true;
    const q = stationSearch.toLowerCase();
    return (
      st.name?.toLowerCase().includes(q) ||
      st.agency?.toLowerCase().includes(q) ||
      st.country?.toLowerCase().includes(q)
    );
  });

  const getStatusBadge = (missionOrStatus) => {
    const target =
      typeof missionOrStatus === 'string'
        ? { missionStatus: missionOrStatus }
        : missionOrStatus;
    return getMissionOutcomeMeta(target);
  };

  return (
    <div className="flex-1 overflow-y-auto bg-[#050507] text-slate-100 px-5 sm:px-8 lg:px-10 pt-8 pb-10 max-w-[1440px] mx-auto w-full space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 border-b border-[#1E2028] pb-5">
        <div>
          <div className="flex items-center gap-2 text-[11px] font-sans font-semibold tracking-[0.14em] text-[#8E95A5] uppercase">
            <BookOpen className="w-3.5 h-3.5 text-[#F8FAFC]" />
            <span>Workspace 06 · Mission Library &amp; Technical Reference</span>
          </div>
          <h1 className="text-2xl sm:text-[26px] font-display font-semibold tracking-tight text-white mt-1.5">
            Lunar Missions, Ground Stations &amp; Planetary Science Guide
          </h1>
          <p className="text-[13.5px] font-sans text-[#8E95A5] mt-1 max-w-3xl leading-relaxed">
            Curated archive of NASA Commercial Lunar Payload Services (CLPS) missions, Deep Space Network stations, and lunar cartographic methodology.
          </p>
        </div>
      </div>

      <div
        data-guide="library-replays"
        className="p-5 rounded-xl bg-[#0C0D12] border border-[#1E2028] flex flex-col sm:flex-row sm:items-center justify-between gap-4"
      >
        <div className="flex items-center gap-3">
          <Clock className="w-4 h-4 text-amber-400 shrink-0" />
          <div>
            <div className="text-[13px] font-sans font-semibold text-white">Historical Mission Touchdown Replay</div>
            <div className="text-xs font-sans text-[#8E95A5] mt-0.5">
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
              className="px-3 py-1.5 rounded-lg bg-[#050507] hover:bg-[#14161D] border border-[#1E2028] hover:border-white/30 text-xs font-sans font-medium text-slate-200 hover:text-white transition"
            >
              {rep.label}
            </button>
          ))}
        </div>
      </div>

      <div
        role="tablist"
        aria-label="Mission Library sections"
        data-guide="library-sections"
        className="flex items-center gap-2 border-b border-[#1E2028] pb-3 overflow-x-auto"
      >
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'missions'}
          onClick={() => setActiveTab('missions')}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-sans transition flex items-center gap-2 whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/70 ${
            activeTab === 'missions'
              ? 'bg-white text-[#050507] font-semibold shadow-sm'
              : 'text-[#8E95A5] font-medium hover:text-white hover:bg-[#14161D]'
          }`}
        >
          <Rocket className="w-3.5 h-3.5" />
          CLPS &amp; Artemis Missions ({CLPS_MISSIONS.length})
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'stations'}
          onClick={() => setActiveTab('stations')}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-sans transition flex items-center gap-2 whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/70 ${
            activeTab === 'stations'
              ? 'bg-white text-[#050507] font-semibold shadow-sm'
              : 'text-[#8E95A5] font-medium hover:text-white hover:bg-[#14161D]'
          }`}
        >
          <Radio className="w-3.5 h-3.5" />
          Earth Ground Stations ({EARTH_COMMUNICATION_SITES.length})
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'science'}
          onClick={() => setActiveTab('science')}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-sans transition flex items-center gap-2 whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/70 ${
            activeTab === 'science'
              ? 'bg-white text-[#050507] font-semibold shadow-sm'
              : 'text-[#8E95A5] font-medium hover:text-white hover:bg-[#14161D]'
          }`}
        >
          <Info className="w-3.5 h-3.5" />
          Planetary Science &amp; Math
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'datasets'}
          onClick={() => setActiveTab('datasets')}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-sans transition flex items-center gap-2 whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/70 ${
            activeTab === 'datasets'
              ? 'bg-white text-[#050507] font-semibold shadow-sm'
              : 'text-[#8E95A5] font-medium hover:text-white hover:bg-[#14161D]'
          }`}
        >
          <ShieldCheck className="w-3.5 h-3.5" />
          NASA Data Sources &amp; Provenance ({NASA_DATASETS_REGISTRY.length})
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'shortcuts'}
          onClick={() => setActiveTab('shortcuts')}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-sans transition flex items-center gap-2 whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/70 ${
            activeTab === 'shortcuts'
              ? 'bg-white text-[#050507] font-semibold shadow-sm'
              : 'text-[#8E95A5] font-medium hover:text-white hover:bg-[#14161D]'
          }`}
        >
          <Keyboard className="w-3.5 h-3.5" />
          Controls &amp; Shortcuts
        </button>
      </div>

      {activeTab === 'missions' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="space-y-3 lg:col-span-1">
            <div className="p-3 rounded-xl bg-[#0C0D12] border border-[#1E2028] space-y-2.5">
              <div className="relative">
                <input
                  type="text"
                  value={missionSearch}
                  onChange={(e) => setMissionSearch(e.target.value)}
                  placeholder="Search mission, lander, provider, or site..."
                  aria-label="Search missions"
                  className="w-full px-3 py-1.5 pr-8 rounded-lg bg-[#050507] border border-[#1E2028] text-xs font-sans text-white placeholder-[#7E8696] focus:outline-none focus:border-white/35 focus-visible:ring-2 focus-visible:ring-cyan-400/70"
                />
                {missionSearch && (
                  <button
                    type="button"
                    onClick={() => setMissionSearch('')}
                    aria-label="Clear mission search"
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-[11px] font-mono text-[#94A3B8] hover:text-white px-1 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/70"
                  >
                    ✕
                  </button>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-sans">
                {[
                  { id: 'all', label: `All (${CLPS_MISSIONS.length})` },
                  { id: 'success', label: 'Success' },
                  { id: 'partial', label: 'Partial' },
                  { id: 'failure', label: 'Failure' },
                  {
                    id: 'anomaly',
                    label: `Anomaly (${CLPS_MISSIONS.filter((m) => isMissionAnomaly(m)).length})`,
                  },
                  { id: 'planned', label: 'Planned' },
                ].map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    aria-pressed={missionStatusFilter === f.id}
                    onClick={() => setMissionStatusFilter(f.id)}
                    className={`px-2.5 py-1 rounded-md transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/70 ${
                      missionStatusFilter === f.id
                        ? 'bg-white text-[#050507] font-semibold'
                        : 'bg-[#050507] text-[#8E95A5] hover:text-white border border-[#1E2028]'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2.5 max-h-[580px] overflow-y-auto pr-1">
              {filteredMissions.length === 0 ? (
                <div className="p-6 rounded-xl bg-[#0C0D12] border border-[#1E2028] text-center space-y-2.5">
                  <p className="text-xs font-sans text-[#94A3B8]">
                    No CLPS missions match this filter or search query.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setMissionStatusFilter('all');
                      setMissionSearch('');
                    }}
                    className="px-3 py-1.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] border border-white/15 text-[11px] font-sans font-semibold text-white transition"
                  >
                    Reset filters
                  </button>
                </div>
              ) : (
                filteredMissions.map((m) => {
                  const badge = getStatusBadge(m);
                  return (
                    <button
                      key={m.id}
                      onClick={() => setSelectedMission(m)}
                      className={`w-full text-left p-4 rounded-xl border transition ${
                        displayedMission?.id === m.id
                          ? 'bg-[#14161D] border-white/35 shadow-lg'
                          : 'bg-[#0C0D12] border-[#1E2028] hover:border-white/20'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10.5px] font-sans font-semibold tracking-wider text-cyan-400 uppercase truncate">
                          {m.provider}
                        </span>
                        <span className={`text-[10px] font-sans font-semibold px-2 py-0.5 rounded border shrink-0 ${badge.badgeClass}`}>
                          {badge.shortLabel || badge.label}
                        </span>
                      </div>
                      <h3 className="text-sm font-display font-semibold text-white mt-1.5">{m.name}</h3>
                      <p className="text-xs font-sans text-[#94A3B8] mt-1 line-clamp-1">
                        {m.landingSiteName} · {m.targetRegion}
                      </p>
                      {m.outcomeReason && (
                        <p className={`text-[11px] font-sans mt-1 line-clamp-1 ${badge.isAnomaly ? 'text-amber-300/90' : 'text-[#8E95A5]'}`}>
                          {m.outcomeReason}
                        </p>
                      )}
                      <div className="mt-1.5 text-[11px] font-mono text-[#7E8696] flex items-center justify-between">
                        <span>Task Order {m.taskOrder}</span>
                        <span>{m.landingDate}</span>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          <div className="lg:col-span-2 p-6 rounded-2xl bg-[#0C0D12] border border-[#1E2028] space-y-6">
            {displayedMission ? (
              <>
            {(() => {
              const selectedBadge = getStatusBadge(displayedMission);
              return (
                <>
                  <div className="border-b border-[#1E2028] pb-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-[11px] font-sans font-semibold text-[#8E95A5] uppercase tracking-[0.12em]">
                        Mission Profile Detail · Task Order {displayedMission.taskOrder}
                      </span>
                      <span className={`text-[11px] font-sans font-semibold px-2.5 py-0.5 rounded border ${selectedBadge.badgeClass}`}>
                        {selectedBadge.label} ({displayedMission.dateStatus})
                      </span>
                    </div>
                    <h2 className="text-2xl font-display font-semibold text-white mt-1.5">{displayedMission.name}</h2>
                    {displayedMission.outcomeReason && (
                      <div className={`mt-2.5 px-3 py-2 rounded-lg border text-xs font-sans flex items-start gap-2 ${
                        selectedBadge.isAnomaly
                          ? 'bg-amber-950/30 border-amber-500/30 text-amber-200'
                          : 'bg-[#050507] border-[#1E2028] text-[#CBD5E1]'
                      }`}>
                        {selectedBadge.isAnomaly && (
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                        )}
                        <span>
                          <strong className="font-semibold">Mission Outcome ({selectedBadge.label}):</strong>{' '}
                          {displayedMission.outcomeReason}
                        </span>
                      </div>
                    )}
                    <ExpandableText
                      text={displayedMission.description}
                      maxLines={3}
                      charThreshold={180}
                      className="text-[13px] font-sans text-[#CBD5E1] mt-2 leading-relaxed"
                    />
                  </div>
                </>
              );
            })()}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
              <div className="p-4 rounded-xl bg-[#050507] border border-[#1E2028]">
                <span className="text-[10.5px] font-sans font-semibold text-[#8E95A5] uppercase tracking-wider">Provider &amp; Task Order</span>
                <p className="font-sans font-semibold text-white mt-1">
                  {displayedMission.provider} (CLPS {displayedMission.taskOrder})
                </p>
              </div>

              <div className="p-4 rounded-xl bg-[#050507] border border-[#1E2028]">
                <span className="text-[10.5px] font-sans font-semibold text-[#8E95A5] uppercase tracking-wider">Lander Vehicle</span>
                <p className="font-sans font-semibold text-white mt-1">{displayedMission.lander || 'Robotic Lunar Lander'}</p>
              </div>

              <div className="p-4 rounded-xl bg-[#050507] border border-[#1E2028]">
                <span className="text-[10.5px] font-sans font-semibold text-[#8E95A5] uppercase tracking-wider">Launch &amp; Touchdown Window</span>
                <p className="font-mono font-semibold text-white mt-1">
                  {displayedMission.launchDate} → {displayedMission.landingDate}
                </p>
              </div>

              <div className="p-4 rounded-xl bg-[#050507] border border-[#1E2028]">
                <span className="text-[10.5px] font-sans font-semibold text-[#8E95A5] uppercase tracking-wider">Target Coordinates</span>
                <p className="font-mono tabular-nums font-semibold text-cyan-300 mt-1">
                  {displayedMission.locationType === 'placeholder'
                    ? 'Coordinates Withheld (Unannounced Far-Side Target)'
                    : Number.isFinite(displayedMission.latitude) && Number.isFinite(displayedMission.longitude)
                    ? `${displayedMission.latitude.toFixed(2)}°, ${displayedMission.longitude.toFixed(2)}° (${displayedMission.locationType})`
                    : 'South Polar Region'}
                </p>
              </div>

              <div className="p-4 rounded-xl bg-[#050507] border border-[#1E2028]">
                <span className="text-[10.5px] font-sans font-semibold text-[#8E95A5] uppercase tracking-wider">Landing Site &amp; Region</span>
                <p className="font-sans font-semibold text-white mt-1">
                  {displayedMission.landingSiteName} · {displayedMission.targetRegion}
                </p>
              </div>

              <div className="p-4 rounded-xl bg-[#050507] border border-[#1E2028]">
                <span className="text-[10.5px] font-sans font-semibold text-[#8E95A5] uppercase tracking-wider">Data Source &amp; Precision</span>
                <p className="font-sans font-semibold text-slate-300 mt-1">
                  NASA CLPS / LROC ({displayedMission.locationType || 'catalog'})
                </p>
              </div>
            </div>

            {displayedMission.payloads && (
              <div className="space-y-2.5">
                <h4 className="text-[11px] font-sans font-semibold uppercase text-[#8E95A5] tracking-[0.08em]">
                  Carried Scientific Payloads ({Array.isArray(displayedMission.payloads) ? displayedMission.payloads.length : 1})
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs font-sans">
                  {Array.isArray(displayedMission.payloads) ? (
                    displayedMission.payloads.map((p, i) => (
                      <div key={i} className="p-3 rounded-xl bg-[#050507] border border-[#1E2028] space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold text-white">
                            {typeof p === 'string' ? p : p.name}
                          </span>
                          {typeof p === 'object' && p.agency && (
                            <span className="text-[10px] font-mono text-cyan-400 px-1.5 py-0.5 rounded bg-cyan-950/40 border border-cyan-500/30">
                              {p.agency}
                            </span>
                          )}
                        </div>
                        {typeof p === 'object' && p.fullName && (
                          <div className="text-[11px] text-[#CBD5E1] font-medium">{p.fullName}</div>
                        )}
                        {typeof p === 'object' && p.purpose && (
                          <div className="text-[11px] text-[#8E95A5]">{p.purpose}</div>
                        )}
                      </div>
                    ))
                  ) : (
                    <p className="text-slate-400">{JSON.stringify(displayedMission.payloads)}</p>
                  )}
                </div>
              </div>
            )}

            <div className="pt-2 flex flex-wrap items-center gap-3">
              <button
                onClick={() => {
                  if (onSelectMission) onSelectMission(displayedMission);
                  if (onNavigate) onNavigate('explorer');
                }}
                disabled={displayedMission.locationType === 'placeholder'}
                className="px-4 py-2 rounded-lg bg-white hover:bg-[#E2E8F0] disabled:opacity-40 text-[#050507] font-sans font-semibold text-xs flex items-center gap-2 transition"
              >
                <Compass className="w-4 h-4" />
                <span>
                  {displayedMission.locationType === 'placeholder'
                    ? '3D Pin Suppressed (Target Coordinates Unannounced)'
                    : 'Inspect Target Site in 3D Explorer'}
                </span>
              </button>
              {displayedMission.referenceUrl && (
                <a
                  href={displayedMission.referenceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3.5 py-2 rounded-lg bg-[#050507] hover:bg-[#14161D] border border-[#1E2028] text-xs font-sans font-medium text-slate-200 inline-flex items-center gap-1.5"
                >
                  <span>Official NASA Mission Reference</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
            </div>
              </>
            ) : (
              <div className="py-20 text-center space-y-2">
                <p className="text-sm font-display font-medium text-white">No Mission Selected</p>
                <p className="text-xs font-sans text-[#94A3B8]">
                  Adjust or clear the search and status filters to inspect mission profiles.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'stations' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-xl bg-[#0C0D12] border border-[#1E2028]">
            <div className="relative w-full sm:w-96">
              <input
                type="text"
                value={stationSearch}
                onChange={(e) => setStationSearch(e.target.value)}
                placeholder="Filter ground stations by name, agency (NASA DSN, ESA, JAXA...), or country..."
                aria-label="Filter ground stations"
                className="w-full px-3 py-1.5 pr-8 rounded-lg bg-[#050507] border border-[#1E2028] text-xs font-sans text-white placeholder-[#7E8696] focus:outline-none focus:border-white/35 focus-visible:ring-2 focus-visible:ring-cyan-400/70"
              />
              {stationSearch && (
                <button
                  type="button"
                  onClick={() => setStationSearch('')}
                  aria-label="Clear station search"
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-[11px] font-mono text-[#94A3B8] hover:text-white px-1 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/70"
                >
                  ✕
                </button>
              )}
            </div>
            <span className="text-xs font-mono text-[#8E95A5]">
              Showing {filteredStations.length} of {EARTH_COMMUNICATION_SITES.length} tracking stations
            </span>
          </div>
          {filteredStations.length === 0 ? (
            <div className="p-8 rounded-xl bg-[#0C0D12] border border-[#1E2028] text-center space-y-3">
              <p className="text-xs font-sans text-[#94A3B8]">
                No ground stations match &ldquo;{stationSearch}&rdquo;.
              </p>
              <button
                type="button"
                onClick={() => setStationSearch('')}
                className="px-3.5 py-1.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] border border-white/15 text-xs font-sans font-semibold text-white transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/70"
              >
                Reset station search
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredStations.map((st) => (
                <div key={st.id} className="p-5 rounded-xl bg-[#0C0D12] border border-[#1E2028] space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-sans font-semibold text-cyan-400 uppercase tracking-wider">
                      {st.agency}
                    </span>
                    <span className="text-[10.5px] font-sans font-medium text-emerald-400 bg-emerald-950/60 border border-emerald-800/60 px-2 py-0.5 rounded">
                      {st.status}
                    </span>
                  </div>
                  <h3 className="text-[15px] font-display font-semibold text-white">{st.name}</h3>
                  <ExpandableText
                    text={st.description}
                    maxLines={2}
                    charThreshold={100}
                    className="text-xs font-sans text-[#8E95A5] leading-relaxed"
                  />
                  <div className="pt-2.5 border-t border-[#1E2028] text-xs font-sans text-[#8E95A5] flex justify-between items-center">
                    <span>{st.country}</span>
                    <span className="font-mono tabular-nums text-[#E2E8F0]">
                      {Number.isFinite(st.latitude) ? st.latitude.toFixed(2) : '0.00'}°, {Number.isFinite(st.longitude) ? st.longitude.toFixed(2) : '0.00'}°
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'science' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="p-6 rounded-xl bg-[#0C0D12] border border-[#1E2028] space-y-2.5">
            <h3 className="text-[15px] font-display font-semibold text-white">
              1. Selenographic Coordinate Systems (ME Frame)
            </h3>
            <p className="text-[13px] font-sans text-[#CBD5E1] leading-relaxed">
              Coordinates on the Moon are expressed in the Mean Earth/Polar Axis (ME) reference frame.
              The prime meridian (0° longitude) points toward the mean direction of Earth. Positive latitudes
              are North, negative latitudes are South. High South Pole candidates (like Shackleton at -89.7° and Malapert at -85.9°)
              experience unique low-grazing solar illumination angles.
            </p>
          </div>

          <div className="p-6 rounded-xl bg-[#0C0D12] border border-[#1E2028] space-y-2.5">
            <h3 className="text-[15px] font-display font-semibold text-white">
              2. LOLA DEM Topographic Horizons
            </h3>
            <p className="text-[13px] font-sans text-[#CBD5E1] leading-relaxed">
              At the lunar poles, the Sun never rises more than ~1.5° above the astronomical horizon. Local mountain ridges,
              crater rims, and massifs determine whether sunlight can reach solar arrays. LUNA models true 360° terrain
              horizons sampled from Lunar Reconnaissance Orbiter (LRO) Laser Altimeter elevation models.
            </p>
          </div>

          <div className="p-6 rounded-xl bg-[#0C0D12] border border-[#1E2028] space-y-2.5">
            <h3 className="text-[15px] font-display font-semibold text-white">
              3. Diviner Thermal Radiometer Physics
            </h3>
            <p className="text-[13px] font-sans text-[#CBD5E1] leading-relaxed">
              Without an atmosphere, lunar surface temperatures range from 390 K (+117°C) at lunar noon in equatorial zones
              down to below 40 K (-233°C) inside Permanently Shadowed Regions (PSRs). High thermal inertia subsurface layers
              maintain a steady equilibrium around -30°C to -60°C.
            </p>
          </div>

          <div className="p-6 rounded-xl bg-[#0C0D12] border border-[#1E2028] space-y-2.5">
            <h3 className="text-[15px] font-display font-semibold text-white">
              4. Direct-to-Earth (DTE) Links &amp; Libration
            </h3>
            <p className="text-[13px] font-sans text-[#CBD5E1] leading-relaxed">
              Due to lunar libration (~7° in latitude and ~8° in longitude), Earth wobbles in the lunar sky in an elliptical
              cycle over 27.3 days. Landing sites near the lunar limb can experience periodic Earth occultation below the local
              horizon. Continuous tracking requires motorized high-gain gimbal antennas.
            </p>
          </div>

          <div className="md:col-span-2 p-6 rounded-xl bg-[#0C0D12] border border-[#1E2028] space-y-3.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-[15px] font-display font-semibold text-white flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>5. NASA JPL Horizons (DE440/IAU_MOON) Ephemeris Validation Benchmark</span>
              </h3>
              <span className="text-xs font-mono tabular-nums text-emerald-400">
                Mean Angular Residual: {MEAN_BENCHMARK_RESIDUAL_DEG.toFixed(4)}° ({(MEAN_BENCHMARK_RESIDUAL_DEG * 3600).toFixed(1)}″)
              </span>
            </div>
            <p className="text-xs font-sans text-[#8E95A5]">
              Independent validation of LUNA Studio&apos;s local selenographic sub-solar and sub-Earth libration solver (Astronomy Engine + IAU WGCCRE 2009 Archinal et al. rotation series) against authentic NASA JPL Horizons observer tables (<code className="text-slate-300">COMMAND=&apos;301&apos;, CENTER=&apos;500@399&apos;, QUANTITIES=&apos;14,15&apos;</code>).
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse font-mono tabular-nums text-xs">
                <thead>
                  <tr className="border-b border-[#1E2028] font-sans font-medium text-[#8E95A5]">
                    <th className="py-2.5 px-3">Reference Epoch (UTC)</th>
                    <th className="py-2.5 px-3">JPL Sub-Solar</th>
                    <th className="py-2.5 px-3">LUNA Sub-Solar</th>
                    <th className="py-2.5 px-3">JPL Sub-Earth</th>
                    <th className="py-2.5 px-3">LUNA Sub-Earth</th>
                    <th className="py-2.5 px-3 text-right">Angular Residual (Δ☉ · Δ⊕)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1E2028] text-slate-200">
                  {JPL_HORIZONS_BENCHMARKS.map((row) => (
                    <tr key={row.epoch}>
                      <td className="py-2.5 px-3 font-sans font-medium text-white">{row.epoch}</td>
                      <td className="py-2.5 px-3 text-amber-300">{row.jplSubSolar}</td>
                      <td className="py-2.5 px-3 text-amber-200">{row.lunaSubSolar}</td>
                      <td className="py-2.5 px-3 text-cyan-300">{row.jplSubEarth}</td>
                      <td className="py-2.5 px-3 text-cyan-200">{row.lunaSubEarth}</td>
                      <td className="py-2.5 px-3 text-right font-mono text-emerald-400 font-semibold">{row.residual}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="md:col-span-2">
            <LolaValidationPanel compact={false} defaultExpanded={true} />
          </div>
        </div>
      )}

      {activeTab === 'shortcuts' && (
        <div className="max-w-2xl p-6 rounded-xl bg-[#0C0D12] border border-[#1E2028] space-y-4">
          <h3 className="text-[15px] font-display font-semibold text-white flex items-center gap-2">
            <Keyboard className="w-4 h-4 text-[#F8FAFC]" />
            Mission Control Keyboard Shortcuts
          </h3>
          <div className="divide-y divide-[#1E2028] text-xs font-sans">
            <div className="py-3 flex justify-between items-center">
              <span className="text-[#CBD5E1]">Toggle Ephemeris Simulation Play / Pause</span>
              <kbd className="px-2.5 py-1 rounded bg-[#050507] font-mono text-slate-200 border border-[#1E2028]">P</kbd>
            </div>
            <div className="py-3 flex justify-between items-center">
              <span className="text-[#CBD5E1]">Switch 3D Globe / 2D South Pole Map View</span>
              <kbd className="px-2.5 py-1 rounded bg-[#050507] font-mono text-slate-200 border border-[#1E2028]">1 / 2</kbd>
            </div>
            <div className="py-3 flex justify-between items-center">
              <span className="text-[#CBD5E1]">Jump Camera to South Pole (90°S)</span>
              <kbd className="px-2.5 py-1 rounded bg-[#050507] font-mono text-slate-200 border border-[#1E2028]">S</kbd>
            </div>
            <div className="py-3 flex justify-between items-center">
              <span className="text-[#CBD5E1]">Toggle Map Layers / Earth-Moon Ephemeris Panel</span>
              <kbd className="px-2.5 py-1 rounded bg-[#050507] font-mono text-slate-200 border border-[#1E2028]">L / E</kbd>
            </div>
            <div className="py-3 flex justify-between items-center">
              <span className="text-[#CBD5E1]">Open DTE Comms / Lunar Weather / Site Analysis / Compare</span>
              <kbd className="px-2.5 py-1 rounded bg-[#050507] font-mono text-slate-200 border border-[#1E2028]">D / W / A / C</kbd>
            </div>
            <div className="py-3 flex justify-between items-center">
              <span className="text-[#CBD5E1]">Toggle Distance Ruler / Route Planner / Orbit Planner</span>
              <kbd className="px-2.5 py-1 rounded bg-[#050507] font-mono text-slate-200 border border-[#1E2028]">M / R / O</kbd>
            </div>
            <div className="py-3 flex justify-between items-center">
              <span className="text-[#CBD5E1]">Open Keyboard Guide / Close Active Panel</span>
              <kbd className="px-2.5 py-1 rounded bg-[#050507] font-mono text-slate-200 border border-[#1E2028]">? or h / Esc</kbd>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'datasets' && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            {Object.values(PROVENANCE_BADGES).map((badge) => (
              <div
                key={badge.id}
                className="p-4 rounded-xl bg-[#0C0D12] border border-[#1E2028] space-y-2"
              >
                <span className={`inline-block text-[10.5px] font-sans px-2 py-0.5 rounded border font-semibold ${badge.badgeClass}`}>
                  {badge.label}
                </span>
                <p className="text-xs font-sans text-[#CBD5E1] leading-relaxed">{badge.description}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {NASA_DATASETS_REGISTRY.map((ds) => {
              const prov = PROVENANCE_BADGES[ds.provenanceType] || PROVENANCE_BADGES.NASA_MEASURED;
              return (
                <div
                  key={ds.id}
                  className="p-5 rounded-xl bg-[#0C0D12] border border-[#1E2028] space-y-3.5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-[11px] font-sans font-semibold text-cyan-400 uppercase tracking-wider">
                        {ds.instrument} · {ds.processingLevel}
                      </span>
                      <h3 className="text-[15px] font-display font-semibold text-white mt-0.5">{ds.datasetName}</h3>
                    </div>
                    <span className={`text-[10.5px] font-sans font-semibold px-2 py-0.5 rounded border shrink-0 ${prov.badgeClass}`}>
                      {prov.shortLabel}
                    </span>
                  </div>

                  <p className="text-xs font-sans text-[#CBD5E1] leading-relaxed">{ds.description}</p>

                  <div className="grid grid-cols-2 gap-3 pt-2.5 border-t border-[#1E2028] text-xs font-sans">
                    <div>
                      <span className="text-[#8E95A5] block text-[10.5px] uppercase tracking-wider font-medium">Product ID</span>
                      <span className="font-mono text-[#E2E8F0] mt-0.5 block">{ds.productId}</span>
                    </div>
                    <div>
                      <span className="text-[#8E95A5] block text-[10.5px] uppercase tracking-wider font-medium">Spatial Resolution</span>
                      <span className="font-mono text-cyan-300 mt-0.5 block">{ds.spatialResolution}</span>
                    </div>
                    <div>
                      <span className="text-[#8E95A5] block text-[10.5px] uppercase tracking-wider font-medium">Coverage Area</span>
                      <span className="text-[#E2E8F0] mt-0.5 block">{ds.coverageArea}</span>
                    </div>
                    <div>
                      <span className="text-[#8E95A5] block text-[10.5px] uppercase tracking-wider font-medium">Verification Status</span>
                      <span className="font-mono text-emerald-400 mt-0.5 block">{ds.verificationStatus || 'VERIFIED'}</span>
                    </div>
                  </div>

                  {ds.knownLimitations && (
                    <div className="pt-2 border-t border-[#1E2028] text-[11.5px] font-sans text-[#94A3B8]">
                      <strong className="text-[#CBD5E1]">Known Limitations:</strong> {ds.knownLimitations}
                    </div>
                  )}

                  <div className="pt-2.5 border-t border-[#1E2028] flex items-center justify-between text-xs font-sans">
                    <span className="text-amber-300 font-medium">Uncertainty: {ds.uncertainty}</span>
                    <a
                      href={ds.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-white hover:underline inline-flex items-center gap-1 font-medium"
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
