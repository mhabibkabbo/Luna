import React, { useState } from 'react';
import { ArrowUpRight } from 'lucide-react';
import RealisticMoon from './RealisticMoon.jsx';
import CompactAboutModal from './CompactAboutModal.jsx';
import { CLPS_MISSIONS } from '../../data/clpsMissions.js';

export default function LandingPage({ onNavigateToMissions, onLaunchExplorer }) {
  const [selectedMissionIndex, setSelectedMissionIndex] = useState(0);
  const [isAboutOpen, setIsAboutOpen] = useState(false);

  return (
    <div className="min-h-screen w-full bg-[#060B13] text-[#F1F5F9] font-sans selection:bg-[#00D2C4]/30 selection:text-[#F1F5F9] overflow-x-hidden flex flex-col justify-between">
      {/* ===================================================================== */}
      {/* HEADER: Centered Missions & About, Open Explorer on Right             */}
      {/* ===================================================================== */}
      <header className="fixed top-0 left-0 right-0 z-50 px-6 sm:px-12 h-20 flex items-center justify-between pointer-events-none bg-gradient-to-b from-black/80 to-transparent backdrop-blur-[2px]">
        {/* Left empty spacer for perfect center alignment */}
        <div className="w-20 hidden sm:block" />

        {/* Center Navigation Container */}
        <nav className="pointer-events-auto flex items-center gap-6 bg-[#0A1220]/80 px-6 py-2 rounded-full border border-white/[0.08] backdrop-blur-md shadow-xl mx-auto sm:mx-0">
          <button
            type="button"
            onClick={onNavigateToMissions}
            className="text-xs font-mono uppercase tracking-[0.18em] text-[#94A3B8] hover:text-[#00D2C4] transition-colors relative py-1 group"
          >
            <span>Missions</span>
            <span className="absolute bottom-0 left-0 w-0 h-[1.5px] bg-[#00D2C4] group-hover:w-full transition-all duration-300" />
          </button>

          <button
            type="button"
            onClick={() => setIsAboutOpen(true)}
            className="text-xs font-mono uppercase tracking-[0.18em] text-[#94A3B8] hover:text-[#00D2C4] transition-colors py-1 relative group cursor-pointer"
          >
            <span>About</span>
            <span className="absolute bottom-0 left-0 w-0 h-[1.5px] bg-[#00D2C4] group-hover:w-full transition-all duration-300" />
          </button>
        </nav>

        {/* Right CTA Button */}
        <div className="pointer-events-auto">
          <button
            type="button"
            onClick={() => onLaunchExplorer({ viewMode: '3d' })}
            className="flex items-center gap-2 h-10 px-5 rounded-full bg-[#00D2C4] hover:bg-[#22E7D9] text-[#060B13] font-bold text-xs tracking-wide transition-all shadow-[0_0_20px_rgba(0,210,196,0.35)] active:scale-95"
          >
            <span>Open Explorer</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </header>

      {/* ===================================================================== */}
      {/* CLEAN CINEMATIC HERO SECTION                                          */}
      {/* ===================================================================== */}
      <section className="relative my-auto w-full min-h-screen flex items-center pt-20 pb-12 px-6 sm:px-10 lg:px-16 overflow-hidden">
        {/* Luminous Greenish-Blue / Deep Space Atmospheric Gradient Backdrop */}
        <div
          className="absolute inset-0 pointer-events-none -z-20"
          style={{
            background:
              'radial-gradient(circle at 65% 45%, rgba(0, 210, 196, 0.22) 0%, rgba(14, 116, 144, 0.12) 38%, rgba(6, 11, 19, 0.98) 78%)',
          }}
        />

        <div className="my-auto grid grid-cols-1 lg:grid-cols-12 gap-8 items-center max-w-[1400px] w-full mx-auto">
          {/* Left Text Block */}
          <div className="lg:col-span-5 space-y-6 z-10">
            <h1 className="font-serif text-5xl sm:text-6xl xl:text-[4.5rem] leading-[0.98] tracking-[-0.02em] text-[#F1F5F9] font-normal">
              The <span className="italic text-[#00D2C4]">lunar</span> surface
              <br />
              in high <span className="italic text-[#34D399]">definition.</span>
            </h1>

            <p className="text-base sm:text-[17px] text-[#94A3B8] max-w-md leading-relaxed font-normal">
              Explore lunar topography, commercial landers, and polar expedition targets in interactive 3D and 2D.{' '}
              <strong className="text-[#F1F5F9] font-medium">
                Analyze solar illumination, ephemeris vectors, and direct-to-Earth links.
              </strong>
            </p>
          </div>

          {/* Right Column: 3D Orbital Moon */}
          <div className="lg:col-span-7 relative h-[420px] sm:h-[520px] flex items-center justify-center">
            <RealisticMoon
              selectedMissionIndex={selectedMissionIndex}
              onSelectMissionIndex={setSelectedMissionIndex}
              onOpenMission={(missionObj) => {
                const matched = CLPS_MISSIONS.find((m) => m.id === missionObj.id);
                if (matched) {
                  onLaunchExplorer({ selectedMission: matched, missionId: matched.id });
                } else {
                  onLaunchExplorer({ target: 'south-pole' });
                }
              }}
            />
          </div>
        </div>
      </section>

      {/* About Modal */}
      <CompactAboutModal
        isOpen={isAboutOpen}
        onClose={() => setIsAboutOpen(false)}
        onLaunchExplorer={onLaunchExplorer}
      />
    </div>
  );
}

