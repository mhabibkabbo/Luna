import React, { useState } from 'react';
import { ArrowUpRight } from 'lucide-react';
import RealisticMoon from './RealisticMoon.jsx';
import { CLPS_MISSIONS } from '../../data/clpsMissions.js';

export default function LandingPage({ onLaunchExplorer }) {
  const [selectedMissionIndex, setSelectedMissionIndex] = useState(0);

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
          <a
            href="#missions"
            className="text-xs font-mono uppercase tracking-[0.18em] text-[#94A3B8] hover:text-[#00D2C4] transition-colors relative py-1 group"
          >
            <span>Missions</span>
            <span className="absolute bottom-0 left-0 w-0 h-[1.5px] bg-[#00D2C4] group-hover:w-full transition-all duration-300" />
          </a>

          <a
            href="#about"
            className="text-xs font-mono uppercase tracking-[0.18em] text-[#94A3B8] hover:text-[#00D2C4] transition-colors py-1 relative group cursor-pointer"
          >
            <span>About</span>
            <span className="absolute bottom-0 left-0 w-0 h-[1.5px] bg-[#00D2C4] group-hover:w-full transition-all duration-300" />
          </a>
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

      <section className="relative px-6 sm:px-10 lg:px-16 py-20 sm:py-28 border-t border-white/[0.08] bg-[#080F19]">
        <div className="max-w-[1400px] mx-auto">
          <div className="max-w-2xl mb-10 sm:mb-14">
            <span className="text-xs font-mono uppercase tracking-[0.22em] text-[#00D2C4]">
              Mission catalog
            </span>
            <h2 className="font-serif text-3xl sm:text-5xl mt-3 text-[#F1F5F9]">
              A clearer view of lunar exploration.
            </h2>
            <p className="text-sm sm:text-base text-[#94A3B8] leading-relaxed mt-4">
              Browse commercial lunar missions, their target regions, and the science they bring
              to the Moon.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {CLPS_MISSIONS.slice(0, 3).map((mission) => (
              <article
                key={mission.id}
                className="flex flex-col rounded-2xl border border-white/[0.1] bg-[#0A1220] p-5 sm:p-6"
              >
                <span className="text-[10px] font-mono uppercase tracking-widest text-[#34D399]">
                  {mission.provider} · {mission.taskOrder}
                </span>
                <h3 className="font-serif text-xl text-[#F1F5F9] mt-3">{mission.name}</h3>
                <p className="text-sm text-[#94A3B8] leading-relaxed mt-3 flex-1">
                  {mission.description}
                </p>
                <button
                  type="button"
                  onClick={() =>
                    onLaunchExplorer({
                      selectedMission: mission,
                      missionId: mission.id,
                      lon: mission.longitude,
                      lat: mission.latitude,
                    })
                  }
                  className="inline-flex items-center gap-2 mt-5 text-xs font-mono uppercase tracking-wider text-[#00D2C4] hover:text-[#34D399] transition-colors self-start"
                >
                  Explore mission <ArrowUpRight className="w-3.5 h-3.5" />
                </button>
              </article>
            ))}
          </div>

          <div className="flex flex-wrap gap-3 mt-9">
            <a
              href="#missions"
              className="inline-flex items-center gap-2 px-5 py-3 rounded-full bg-[#00D2C4] text-[#060B13] font-bold text-xs hover:bg-[#22E7D9] transition-colors"
            >
              View all missions <ArrowUpRight className="w-3.5 h-3.5" />
            </a>
            <a
              href="#about"
              className="inline-flex items-center gap-2 px-5 py-3 rounded-full border border-white/15 text-[#F1F5F9] font-semibold text-xs hover:border-[#00D2C4]/60 hover:text-[#00D2C4] transition-colors"
            >
              About the challenge
            </a>
          </div>
        </div>
      </section>

      <footer className="px-6 sm:px-12 py-6 border-t border-white/[0.08] text-[10px] font-mono text-[#64748B] flex flex-wrap justify-between gap-3">
        <span>Luna Studio · Lunar Landing Site Navigator</span>
        <a href="#about" className="hover:text-[#00D2C4] transition-colors">
          About this project
        </a>
      </footer>
    </div>
  );
}
