import React, { useState } from 'react';
import { ArrowUpRight, ArrowLeft } from 'lucide-react';
import CompactClpsModal from '../landing/CompactClpsModal.jsx';
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

export default function MissionsPage({ onNavigateToLanding, onLaunchExplorer }) {
  const [activeMission, setActiveMission] = useState(null);

  return (
    <div className="min-h-screen w-full bg-[#12110D] text-[#F4EFE6] font-sans selection:bg-[#E59A6D]/30 selection:text-[#F4EFE6] overflow-x-hidden flex flex-col justify-between">
      {/* ===================================================================== */}
      {/* HEADER: Matching Theme Header with Centered Missions & About          */}
      {/* ===================================================================== */}
      <header className="fixed top-0 left-0 right-0 z-50 px-6 sm:px-12 h-20 flex items-center justify-between pointer-events-none bg-gradient-to-b from-black/80 to-transparent backdrop-blur-[4px]">
        {/* Left: Home Navigation */}
        <div className="pointer-events-auto">
          <button
            type="button"
            onClick={onNavigateToLanding}
            className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-[#A8A193] hover:text-[#F4EFE6] transition-colors"
          >
            <ArrowLeft className="w-4 h-4 text-[#E59A6D]" />
            <span>Home</span>
          </button>
        </div>

        {/* Center Navigation Container */}
        <nav className="pointer-events-auto flex items-center gap-6 bg-[#181711]/80 px-6 py-2 rounded-full border border-white/[0.08] backdrop-blur-md shadow-xl">
          <button
            type="button"
            className="text-xs font-mono uppercase tracking-[0.18em] text-[#E59A6D] relative py-1 font-semibold"
          >
            <span>Missions</span>
            <span className="absolute bottom-0 left-0 right-0 h-[1.5px] bg-[#E59A6D]" />
          </button>

          <button
            type="button"
            className="text-xs font-mono uppercase tracking-[0.18em] text-[#A8A193]/50 cursor-default py-1"
          >
            <span>About</span>
          </button>
        </nav>

        {/* Right CTA Button */}
        <div className="pointer-events-auto">
          <button
            type="button"
            onClick={() => onLaunchExplorer({ viewMode: '3d' })}
            className="flex items-center gap-2 h-10 px-5 rounded-full bg-[#F4EFE6] hover:bg-[#E59A6D] text-[#12110D] font-bold text-xs tracking-wide transition-all shadow-lg active:scale-95"
          >
            <span>Open Explorer</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </header>

      {/* ===================================================================== */}
      {/* DEDICATED MISSIONS OVERVIEW PAGE CONTENT                              */}
      {/* ===================================================================== */}
      <main className="pt-28 pb-20 px-6 sm:px-10 lg:px-16 max-w-[1400px] w-full mx-auto space-y-10">
        {/* Page Title */}
        <div className="space-y-2 border-b border-[#2D2A22] pb-6">
          <span className="text-xs font-mono uppercase tracking-[0.22em] text-[#E59A6D] font-semibold">
            LUNAR SURFACE EXPEDITIONS
          </span>
          <h1 className="font-serif text-4xl sm:text-5xl text-[#F4EFE6] font-normal">
            Missions
          </h1>
        </div>

        {/* Minimal Mission Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {CLPS_MISSIONS.map((mission) => {
            const photoUrl = getMissionImage(mission);
            const agencyLabel = getMissionAgency(mission);

            return (
              <div
                key={mission.id}
                onClick={() => setActiveMission(mission)}
                className="group relative rounded-3xl border border-[#2D2A22] hover:border-[#E59A6D]/80 bg-[#14130F] overflow-hidden cursor-pointer transition-all duration-300 hover:shadow-2xl hover:shadow-[#E59A6D]/10 flex flex-col"
              >
                {/* 1. Mission Photograph */}
                <div className="relative aspect-[16/10] w-full overflow-hidden bg-black">
                  <img
                    src={photoUrl}
                    alt={mission.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 opacity-85 group-hover:opacity-100"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#14130F] via-transparent to-black/30" />

                  {/* 4. Subtle visual indicator that card is clickable */}
                  <div className="absolute top-4 right-4 w-9 h-9 rounded-full bg-black/60 group-hover:bg-[#E59A6D] text-[#A8A193] group-hover:text-[#12110D] backdrop-blur-md flex items-center justify-center transition-all duration-300 shadow-lg">
                    <ArrowUpRight className="w-4 h-4" />
                  </div>
                </div>

                {/* Card Header Content: Agency & Mission Name ONLY */}
                <div className="p-6 flex-1 flex flex-col justify-between space-y-2">
                  <div>
                    {/* 3. Agency or Organization */}
                    <span className="text-xs font-mono uppercase tracking-widest text-[#A8A193] group-hover:text-[#E59A6D] transition-colors block mb-1">
                      {agencyLabel}
                    </span>

                    {/* 2. Mission Name */}
                    <h2 className="font-serif text-xl sm:text-2xl text-[#F4EFE6] font-normal leading-snug group-hover:text-[#F4EFE6]">
                      {mission.name}
                    </h2>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </main>

      {/* Footer */}
      <footer className="py-8 px-6 sm:px-12 border-t border-[#2D2A22] flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-mono text-[#A8A193]">
        <div>
          <span>Luna Studio · Missions Catalog</span>
        </div>
        <div>
          <span>Click any mission card to inspect detailed manifests &amp; landing sites.</span>
        </div>
      </footer>

      {/* Detailed Mission View Modal */}
      <CompactClpsModal
        isOpen={Boolean(activeMission)}
        mission={activeMission}
        onClose={() => setActiveMission(null)}
        onFlyTo={(m) => {
          setActiveMission(null);
          onLaunchExplorer({ selectedMission: m, missionId: m.id });
        }}
      />
    </div>
  );
}
