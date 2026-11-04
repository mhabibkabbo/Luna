import React, { useState } from 'react';
import {
  X,
  Rocket,
  ExternalLink,
  ArrowRight,
  Compass,
  Calendar,
  Layers,
  FileText,
  MapPin,
  CheckCircle2,
  AlertCircle,
  Clock,
  Sparkles,
} from 'lucide-react';
import { CLPS_MISSIONS } from '../../data/clpsMissions.js';

function getMissionImage(mission) {
  if (!mission) return '/pictures/odysseus-malapert-landing.jpg';
  const id = mission.id || '';
  if (id.includes('im1') || id.includes('odysseus')) return '/pictures/odysseus-malapert-landing.jpg';
  if (id.includes('bgm1') || id.includes('crisium')) return '/pictures/blue-ghost-mare-crisium.jpg';
  if (id.includes('earth') || id.includes('marble')) return '/pictures/earth-blue-marble.jpg';
  if (id.includes('im2') || id.includes('griffin') || id.includes('blueorigin')) return '/pictures/shackleton-polar-ridge.jpg';
  return '/pictures/lunar-south-pole-horizon.jpg';
}

function getMissionAgency(mission) {
  if (!mission?.provider) return 'NASA';
  const prov = mission.provider.toLowerCase();
  if (prov.includes('intuitive')) return 'NASA / Intuitive Machines';
  if (prov.includes('firefly')) return 'NASA / Firefly Aerospace';
  if (prov.includes('astrobotic')) return 'NASA / Astrobotic';
  if (prov.includes('draper')) return 'NASA / Draper';
  if (prov.includes('blue origin')) return 'NASA / Blue Origin';
  return `NASA / ${mission.provider}`;
}

export default function CompactClpsModal({ isOpen, mission, onClose, onFlyTo, onLaunchExplorer }) {
  const [activeTab, setActiveTab] = useState('overview');

  if (!isOpen) return null;

  // Fallback to first mission if mission is not passed
  const activeMission = mission || CLPS_MISSIONS[0];
  const photoUrl = getMissionImage(activeMission);
  const agencyLabel = getMissionAgency(activeMission);

  const handleNavigateToMap = () => {
    onClose();
    if (onFlyTo) {
      onFlyTo(activeMission);
    } else if (onLaunchExplorer) {
      onLaunchExplorer({ selectedMission: activeMission, missionId: activeMission.id });
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'completed':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-950/80 border border-emerald-500/30 text-emerald-400 text-xs font-mono">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Landed &amp; Operating</span>
          </span>
        );
      case 'failed':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-950/80 border border-rose-500/30 text-rose-400 text-xs font-mono">
            <AlertCircle className="w-3.5 h-3.5" />
            <span>Cislunar Anomaly / Re-entry</span>
          </span>
        );
      case 'planned':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-950/80 border border-amber-500/30 text-amber-300 text-xs font-mono">
            <Clock className="w-3.5 h-3.5" />
            <span>Manifested Target</span>
          </span>
        );
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-lg animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-3xl max-h-[90vh] flex flex-col rounded-3xl bg-[#0A111C] border border-[#16283C] text-left shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header / Banner Photo */}
        <div className="relative h-48 sm:h-60 w-full shrink-0 overflow-hidden bg-black">
          <img
            src={photoUrl}
            alt={activeMission.name}
            className="w-full h-full object-cover opacity-80"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0A111C] via-[#0A111C]/40 to-black/60" />

          {/* Close Button */}
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-full bg-black/60 hover:bg-black text-[#94A3B8] hover:text-[#F8FAFC] backdrop-blur-md transition-colors"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Banner Text Overlay */}
          <div className="absolute bottom-4 left-6 right-6 flex flex-col sm:flex-row sm:items-end justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="px-2 py-0.5 rounded bg-[#00D2C4]/20 border border-[#00D2C4]/40 text-[#00D2C4] text-[10px] font-mono uppercase tracking-widest font-semibold">
                  {activeMission.taskOrder}
                </span>
                <span className="text-xs font-mono text-[#94A3B8] uppercase">{agencyLabel}</span>
              </div>
              <h2 className="font-serif text-2xl sm:text-3xl text-[#F8FAFC] font-normal leading-tight">
                {activeMission.name}
              </h2>
            </div>
            <div>{getStatusBadge(activeMission.missionStatus)}</div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1 px-6 pt-3 border-b border-[#16283C] bg-[#060B13] shrink-0 text-xs font-medium">
          <button
            type="button"
            onClick={() => setActiveTab('overview')}
            className={`px-4 py-2.5 border-b-2 transition-all flex items-center gap-2 ${
              activeTab === 'overview'
                ? 'border-[#00D2C4] text-[#00D2C4]'
                : 'border-transparent text-[#94A3B8] hover:text-[#F8FAFC]'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Overview &amp; Objectives</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('payloads')}
            className={`px-4 py-2.5 border-b-2 transition-all flex items-center gap-2 ${
              activeTab === 'payloads'
                ? 'border-[#00D2C4] text-[#00D2C4]'
                : 'border-transparent text-[#94A3B8] hover:text-[#F8FAFC]'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Payloads ({activeMission.payloads?.length || 0})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('location')}
            className={`px-4 py-2.5 border-b-2 transition-all flex items-center gap-2 ${
              activeTab === 'location'
                ? 'border-[#00D2C4] text-[#00D2C4]'
                : 'border-transparent text-[#94A3B8] hover:text-[#F8FAFC]'
            }`}
          >
            <MapPin className="w-3.5 h-3.5" />
            <span>Landing Site &amp; Vehicle</span>
          </button>
        </div>

        {/* Modal Scrollable Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 text-sm text-[#94A3B8] leading-relaxed">
          {activeTab === 'overview' && (
            <div className="space-y-5">
              <div>
                <h4 className="text-xs font-mono uppercase tracking-widest text-[#00D2C4] mb-2 font-semibold">
                  Mission Summary
                </h4>
                <p className="text-base text-[#F8FAFC] font-normal leading-relaxed">
                  {activeMission.description}
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-[#060B13] border border-[#16283C] space-y-2">
                <h4 className="text-xs font-mono uppercase tracking-widest text-[#34D399] font-semibold">
                  Primary Scientific Objective
                </h4>
                <p className="text-sm text-[#E2E8F0]">{activeMission.objectives}</p>
              </div>

              {/* Data & Catalog Attribution */}
              <div className="pt-2 border-t border-[#16283C]/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-[#94A3B8]">
                <div>
                  <span className="font-mono text-[#00D2C4]">Dataset Source:</span>{' '}
                  {activeMission.source}
                </div>
                {activeMission.sourceUrl && (
                  <a
                    href={activeMission.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-[#00D2C4] hover:underline"
                  >
                    <span>Official NASA Catalog Reference</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
            </div>
          )}

          {activeTab === 'payloads' && (
            <div className="space-y-4">
              <div className="text-xs font-mono uppercase tracking-widest text-[#00D2C4] font-semibold">
                Manifested Payloads &amp; Science Instruments
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {activeMission.payloads?.map((p, idx) => (
                  <div
                    key={p.name || idx}
                    className="p-3.5 rounded-2xl bg-[#060B13] border border-[#16283C] hover:border-[#00D2C4]/40 transition-colors space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-bold text-[#F8FAFC] bg-[#16283C] px-2 py-0.5 rounded">
                        {p.name}
                      </span>
                      <span className="text-[10px] font-mono text-[#34D399]">{p.agency}</span>
                    </div>
                    <div className="text-xs font-semibold text-[#F8FAFC]">{p.fullName}</div>
                    <p className="text-[11px] text-[#94A3B8] leading-normal">{p.purpose}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'location' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 rounded-2xl bg-[#060B13] border border-[#16283C] space-y-2">
                  <span className="text-[10px] font-mono uppercase tracking-widest text-[#00D2C4]">
                    Geographical Target
                  </span>
                  <div className="text-lg font-serif text-[#F8FAFC]">
                    {activeMission.landingSiteName}
                  </div>
                  <div className="text-xs text-[#94A3B8]">Region: {activeMission.targetRegion}</div>
                  <div className="font-mono text-xs text-[#34D399] pt-1">
                    {Math.abs(activeMission.latitude).toFixed(2)}°
                    {activeMission.latitude >= 0 ? 'N' : 'S'},{' '}
                    {Math.abs(activeMission.longitude).toFixed(2)}°
                    {activeMission.longitude >= 0 ? 'E' : 'W'}
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-[#060B13] border border-[#16283C] space-y-2">
                  <span className="text-[10px] font-mono uppercase tracking-widest text-[#00D2C4]">
                    Spacecraft &amp; Launch
                  </span>
                  <div className="text-base font-semibold text-[#F8FAFC]">
                    Lander: {activeMission.lander}
                  </div>
                  <div className="text-xs text-[#94A3B8]">
                    Booster: {activeMission.launchVehicle}
                  </div>
                  <div className="text-xs text-[#94A3B8]">
                    Launch Window: {activeMission.launchDate}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer Controls */}
        <div className="px-6 py-4 border-t border-[#16283C] bg-[#060B13] shrink-0 flex items-center justify-between">
          <div className="text-xs font-mono text-[#94A3B8]">
            Target: <span className="text-[#F8FAFC]">{activeMission.landingSiteName}</span>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-full border border-[#16283C] hover:border-[#94A3B8] text-xs font-semibold text-[#94A3B8] hover:text-[#F8FAFC] transition-colors"
            >
              Close
            </button>

            <button
              type="button"
              onClick={handleNavigateToMap}
              className="flex items-center gap-2 px-5 py-2 rounded-full bg-[#00D2C4] hover:bg-[#00e6d6] text-[#060B13] font-bold text-xs shadow-lg transition-all active:scale-95"
            >
              <Rocket className="w-3.5 h-3.5" />
              <span>Fly to Mission on 3D Map</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

