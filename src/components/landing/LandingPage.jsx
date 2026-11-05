import React, { useState } from 'react';
import { ArrowUpRight } from 'lucide-react';
import RealisticMoon from './RealisticMoon.jsx';
import LunaBrandLogo from '../common/LunaBrandLogo.jsx';
import ExpandableText from '../common/ExpandableText.jsx';
import { CLPS_MISSIONS } from '../../data/clpsMissions.js';

// Set to false to remove the optional post-hero overview without touching the hero or catalog.
const SHOW_HOME_OVERVIEW = true;

export default function LandingPage({ onLaunchExplorer }) {
  const [selectedMissionIndex, setSelectedMissionIndex] = useState(0);

  return (
    <div className="h-screen w-full overflow-x-hidden overflow-y-auto bg-[#060B13] text-[#F1F5F9] font-sans selection:bg-[#00D2C4]/30 selection:text-[#F1F5F9] flex flex-col justify-between">
      {/* ===================================================================== */}
      {/* HEADER: Luna Logo in Corner, Center Navigation, Open Explorer on Right */}
      {/* ===================================================================== */}
      <header
        role="banner"
        className="fixed top-0 left-0 right-0 z-50 px-4 sm:px-8 lg:px-12 h-16 flex items-center justify-between pointer-events-none bg-gradient-to-b from-black/80 to-transparent backdrop-blur-[2px]"
      >
        {/* Left: Luna Branding Logo */}
        <div className="pointer-events-auto">
          <LunaBrandLogo
            asButton
            onClick={() => onLaunchExplorer({ viewMode: '3d' })}
            title="Luna — Lunar Mission & Site Studio"
          />
        </div>

        {/* Center Navigation Container */}
        <nav
          aria-label="Main page links"
          className="pointer-events-auto flex items-center gap-6 bg-[#0A1220]/80 px-6 py-2 rounded-full border border-white/[0.08] backdrop-blur-md shadow-xl mx-auto sm:mx-0"
        >
          <a
            href="#missions"
            className="text-xs font-mono uppercase tracking-[0.18em] text-[#94A3B8] hover:text-[#00D2C4] transition-colors relative py-1 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00D2C4] rounded"
          >
            <span>Missions</span>
            <span className="absolute bottom-0 left-0 w-0 h-[1.5px] bg-[#00D2C4] group-hover:w-full transition-all duration-300" />
          </a>

          <a
            href="#about"
            className="text-xs font-mono uppercase tracking-[0.18em] text-[#94A3B8] hover:text-[#00D2C4] transition-colors py-1 relative group cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00D2C4] rounded"
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
            aria-label="Launch interactive 3D and 2D Lunar Explorer"
            className="flex items-center gap-2 h-9 px-4 sm:px-5 rounded-full bg-[#00D2C4] hover:bg-[#22E7D9] text-[#060B13] font-bold text-xs tracking-wide transition-all shadow-[0_0_20px_rgba(0,210,196,0.35)] active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00D2C4]"
          >
            <span>Open Explorer</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </header>

      {/* ===================================================================== */}
      {/* CLEAN CINEMATIC HERO SECTION                                          */}
      {/* ===================================================================== */}
      <section
        aria-label="Lunar Surface Hero Overview"
        className="relative my-auto w-full min-h-screen flex items-center pt-20 pb-12 px-6 sm:px-10 lg:px-16 overflow-hidden"
      >
        {/* Deep Space Atmospheric Gradient Backdrop */}
        <div
          className="absolute inset-0 pointer-events-none -z-20"
          style={{
            background:
              'radial-gradient(circle at 65% 45%, rgba(0, 210, 196, 0.18) 0%, rgba(14, 116, 144, 0.10) 38%, rgba(6, 11, 19, 0.98) 78%)',
          }}
        />

        <div className="my-auto grid grid-cols-1 lg:grid-cols-12 gap-8 items-center max-w-[1400px] w-full mx-auto">
          {/* Left Text Block */}
          <div className="lg:col-span-6 space-y-6 z-10">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#00D2C4]/10 border border-[#00D2C4]/30 text-[#00D2C4] text-[11px] font-mono uppercase tracking-wider">
              <span>NASA CLPS &amp; Artemis GIS Platform</span>
            </div>

            <h1 className="text-4xl font-semibold sm:text-5xl xl:text-[4.2rem] leading-[1.02] tracking-[-0.02em] text-[#F1F5F9]">
              The <span className="italic text-[#00D2C4]">lunar</span> surface
              <br />
              in high <span className="italic text-[#34D399]">definition.</span>
            </h1>

            <p className="text-base sm:text-[17px] text-[#94A3B8] max-w-lg leading-relaxed font-normal">
              Explore lunar topography, commercial landers, and polar expedition targets in interactive 3D and 2D.{' '}
              <strong className="text-[#F1F5F9] font-medium">
                Analyze solar illumination, ephemeris vectors, and direct-to-Earth links.
              </strong>
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => onLaunchExplorer({ viewMode: '3d' })}
                aria-label="Launch 3D Lunar Surface Explorer"
                className="flex items-center gap-2 h-11 px-6 rounded-full bg-[#00D2C4] hover:bg-[#22E7D9] text-[#060B13] font-bold text-xs tracking-wide transition-all shadow-[0_0_20px_rgba(0,210,196,0.35)] active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00D2C4]"
              >
                <span>Launch Lunar Map</span>
                <ArrowUpRight className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => onLaunchExplorer({ viewMode: '2d' })}
                aria-label="Open 2D South Pole Topographical GIS Map"
                className="flex items-center gap-2 h-11 px-5 rounded-full bg-[#0A1220] hover:bg-[#121F33] text-[#F1F5F9] border border-[#16283C] hover:border-[#00D2C4]/60 font-semibold text-xs tracking-wide transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00D2C4]"
              >
                <span>South Pole 2D Topo</span>
              </button>
            </div>
          </div>

          {/* Right Column: 3D Orbital Moon */}
          <div className="lg:col-span-6 relative h-[380px] sm:h-[460px] flex items-center justify-center">
            <RealisticMoon
              selectedMissionIndex={selectedMissionIndex}
              onSelectMissionIndex={setSelectedMissionIndex}
              onLaunchExplorer={onLaunchExplorer}
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

      {SHOW_HOME_OVERVIEW && (
        <section
          aria-label="Luna platform overview"
          className="relative border-t border-white/[0.08] bg-[#07111D] px-6 py-16 sm:px-10 sm:py-20 lg:px-16"
        >
          <div className="mx-auto max-w-[1400px]">
            <div className="max-w-2xl">
              <span className="text-xs font-mono uppercase tracking-[0.22em] text-[#00D2C4]">
                Built for discovery
              </span>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight text-[#F1F5F9] sm:text-4xl">
                Move from a place on the Moon to the context around it.
              </h2>
              <p className="mt-4 text-sm leading-relaxed text-[#94A3B8] sm:text-base">
                Luna connects the questions behind a landing site: what the terrain is like, when
                it is illuminated, and how a mission fits into the wider lunar program.
              </p>
            </div>

            <div className="mt-9 grid gap-4 md:grid-cols-3">
              {[
                ['Explore terrain', 'Switch between the global lunar globe and a focused South Pole topographic map.'],
                ['Understand conditions', 'Inspect illumination, local relief, and direct-to-Earth visibility at a selected location.'],
                ['Follow missions', 'Connect landing regions to CLPS missions, landers, launch dates, and payloads.'],
              ].map(([title, description], index) => (
                <article key={title} className="rounded-2xl border border-white/[0.1] bg-[#0A1220] p-5 sm:p-6">
                  <span className="text-[10px] font-mono uppercase tracking-[0.18em] text-[#34D399]">
                    0{index + 1}
                  </span>
                  <h3 className="mt-3 text-lg font-semibold text-[#F1F5F9]">{title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-[#94A3B8]">{description}</p>
                </article>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ===================================================================== */}
      {/* MISSION CATALOG SECTION WITH EXPANDABLE DESCRIPTIONS                   */}
      {/* ===================================================================== */}
      <section
        aria-label="Commercial Lunar Missions Manifest"
        className="relative px-6 sm:px-10 lg:px-16 py-16 sm:py-24 border-t border-white/[0.08] bg-[#080F19]"
      >
        <div className="max-w-[1400px] mx-auto">
          <div className="max-w-2xl mb-10 sm:mb-14">
            <span className="text-xs font-mono uppercase tracking-[0.22em] text-[#00D2C4]">
              Mission catalog
            </span>
            <h2 className="text-3xl font-semibold tracking-tight sm:text-5xl mt-3 text-[#F1F5F9]">
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
                className="flex flex-col rounded-2xl border border-white/[0.1] bg-[#0A1220] p-5 sm:p-6 transition-all hover:border-[#00D2C4]/40"
              >
                <span className="text-[10px] font-mono uppercase tracking-widest text-[#34D399]">
                  {mission.provider} · {mission.taskOrder}
                </span>
                <h3 className="text-xl font-semibold text-[#F1F5F9] mt-3">{mission.name}</h3>

                {/* Accessible Expandable Description */}
                <ExpandableText
                  text={mission.description}
                  maxLines={3}
                  charThreshold={140}
                  className="text-sm text-[#94A3B8] leading-relaxed mt-3 flex-1"
                />

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
                  aria-label={`Explore mission ${mission.name} on lunar map`}
                  className="inline-flex items-center gap-2 mt-5 text-xs font-mono uppercase tracking-wider text-[#00D2C4] hover:text-[#34D399] transition-colors self-start focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#00D2C4] rounded"
                >
                  <span>Explore mission</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </button>
              </article>
            ))}
          </div>

          <div className="flex flex-wrap gap-3 mt-9">
            <a
              href="#missions"
              className="inline-flex items-center gap-2 px-5 py-3 rounded-full bg-[#00D2C4] text-[#060B13] font-bold text-xs hover:bg-[#22E7D9] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00D2C4]"
            >
              <span>View all missions</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </a>
            <a
              href="#about"
              className="inline-flex items-center gap-2 px-5 py-3 rounded-full border border-white/15 text-[#F1F5F9] font-semibold text-xs hover:border-[#00D2C4]/60 hover:text-[#00D2C4] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00D2C4]"
            >
              <span>About the challenge</span>
            </a>
          </div>
        </div>
      </section>

      <footer className="px-6 sm:px-12 py-6 border-t border-white/[0.08] text-[10px] font-mono text-[#64748B] flex flex-wrap justify-between gap-3">
        <span>Luna · Lunar Landing Site Navigator</span>
        <a href="#about" className="hover:text-[#00D2C4] transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#00D2C4] rounded">
          About this project
        </a>
      </footer>
    </div>
  );
}
