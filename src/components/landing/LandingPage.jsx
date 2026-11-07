import React, { useState } from 'react';
import { ArrowUpRight } from 'lucide-react';
import RealisticMoon from './RealisticMoon.jsx';
import ExpandableText from '../common/ExpandableText.jsx';
import { CLPS_MISSIONS } from '../../data/clpsMissions.js';

// Set to false to remove the optional post-hero overview without touching the hero or catalog.
const SHOW_HOME_OVERVIEW = true;

export default function LandingPage({ onLaunchExplorer }) {
  const [selectedMissionIndex, setSelectedMissionIndex] = useState(0);

  return (
    <div className="h-screen w-full overflow-x-hidden overflow-y-auto bg-[#050507] text-[#F8FAFC] font-sans selection:bg-white/20 selection:text-white flex flex-col justify-between">
      {/* ===================================================================== */}
      {/* HEADER: Center Nav (Home, Missions, About), Right CTA                 */}
      {/* ===================================================================== */}
      <header
        role="banner"
        className="fixed top-0 left-0 right-0 z-50 px-4 sm:px-8 lg:px-12 h-16 grid grid-cols-2 sm:grid-cols-3 items-center pointer-events-none bg-gradient-to-b from-[#050507]/90 via-[#050507]/60 to-transparent backdrop-blur-md border-b border-white/[0.06]"
      >
        {/* Left spacer for balanced centered nav on desktop */}
        <div className="hidden sm:block" aria-hidden="true" />

        {/* Center Navigation Container */}
        <nav
          aria-label="Main page links"
          className="pointer-events-auto justify-self-start sm:justify-self-center flex items-center gap-5 sm:gap-8 px-4 sm:px-6 py-2"
        >
          <a
            href="#landing"
            aria-current="page"
            className="text-[11px] sm:text-xs font-sans font-semibold uppercase tracking-[0.14em] text-white transition-colors relative py-1.5 after:absolute after:bottom-0 after:left-0 after:w-full after:h-[1.5px] after:bg-white focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/50 rounded-sm"
          >
            <span>Home</span>
          </a>

          <a
            href="#missions"
            className="text-[11px] sm:text-xs font-sans font-medium uppercase tracking-[0.14em] text-[#8E95A5] hover:text-white transition-colors relative py-1.5 group focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/50 rounded-sm"
          >
            <span>Missions</span>
            <span className="absolute bottom-0 left-0 w-0 h-[1.5px] bg-white/70 group-hover:w-full transition-all duration-300" />
          </a>

          <a
            href="#about"
            className="text-[11px] sm:text-xs font-sans font-medium uppercase tracking-[0.14em] text-[#8E95A5] hover:text-white transition-colors py-1.5 relative group cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/50 rounded-sm"
          >
            <span>About</span>
            <span className="absolute bottom-0 left-0 w-0 h-[1.5px] bg-white/70 group-hover:w-full transition-all duration-300" />
          </a>
        </nav>

        {/* Right CTA Button */}
        <div className="pointer-events-auto justify-self-end">
          <button
            type="button"
            onClick={() => onLaunchExplorer({ viewMode: '3d' })}
            aria-label="Launch interactive 3D and 2D Lunar Explorer"
            className="flex items-center gap-2 h-9 px-4 sm:px-5 rounded-full bg-white hover:bg-[#E2E8F0] text-[#050507] font-semibold text-xs tracking-tight transition-all active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
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
        className="relative my-auto w-full min-h-screen flex items-center pt-24 pb-16 px-6 sm:px-10 lg:px-16 overflow-hidden"
      >
        {/* Subtle Deep Space Atmospheric Backdrop */}
        <div
          className="absolute inset-0 pointer-events-none -z-20"
          style={{
            background:
              'radial-gradient(circle at 68% 48%, rgba(148, 163, 184, 0.08) 0%, rgba(30, 41, 59, 0.05) 42%, rgba(5, 5, 7, 1) 80%)',
          }}
        />

        <div className="my-auto grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center max-w-[1360px] w-full mx-auto">
          {/* Left Text Block */}
          <div className="lg:col-span-6 space-y-7 z-10">

            <h1 className="text-4xl font-display font-semibold sm:text-5xl xl:text-[4.15rem] leading-[1.06] tracking-[-0.032em] text-white">
              The <span>lunar</span> surface
              <br />
              in high <span className="text-[#CBD5E1]">definition.</span>
            </h1>

            <p className="text-base sm:text-[17px] text-[#8E95A5] max-w-lg leading-[1.65] font-sans font-normal">
              Explore lunar topography, commercial landers, and polar expedition targets in interactive 3D and 2D.{' '}
              <strong className="text-[#E2E8F0] font-medium">
                Analyze solar illumination, ephemeris vectors, and direct-to-Earth links.
              </strong>
            </p>

            <div className="flex flex-wrap items-center gap-3.5 pt-2">
              <button
                type="button"
                onClick={() => onLaunchExplorer({ viewMode: '3d' })}
                aria-label="Launch 3D Lunar Surface Explorer"
                className="flex items-center gap-2.5 h-11 px-6 rounded-full bg-white hover:bg-[#E2E8F0] text-[#050507] font-semibold text-xs tracking-wide transition-all active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
              >
                <span>Launch Lunar Map</span>
                <ArrowUpRight className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => onLaunchExplorer({ viewMode: '2d' })}
                aria-label="Open 2D South Pole Topographical GIS Map"
                className="flex items-center gap-2 h-11 px-5 rounded-full bg-white/[0.03] hover:bg-white/[0.08] text-[#F8FAFC] border border-white/[0.12] hover:border-white/[0.25] font-medium text-xs tracking-wide transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
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
                const matched = CLPS_MISSIONS.find((m) => m.id === missionObj?.id);
                if (matched) {
                  onLaunchExplorer({
                    selectedMission: matched,
                    missionId: matched.id,
                    lon: matched.longitude,
                    lat: matched.latitude,
                    zoom: 5.2,
                  });
                } else if (typeof missionObj?.lon === 'number' && typeof missionObj?.lat === 'number') {
                  onLaunchExplorer({
                    lon: missionObj.lon,
                    lat: missionObj.lat,
                    zoom: missionObj.isApollo ? 4.5 : 5.0,
                  });
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
          className="relative border-t border-white/[0.08] bg-[#08090C] px-6 py-20 sm:px-10 sm:py-24 lg:px-16"
        >
          <div className="mx-auto max-w-[1360px]">
            <div className="max-w-2xl">
              <span className="inline-block rounded-full border border-white/[0.12] bg-white/[0.03] px-3.5 py-1 text-[11px] font-sans font-semibold uppercase tracking-[0.14em] text-[#CBD5E1]">
                Built for discovery
              </span>
              <h2 className="mt-4 text-3xl font-display font-semibold tracking-[-0.025em] text-white sm:text-4xl">
                Move from a place on the Moon to the context around it.
              </h2>
              <p className="mt-4 text-sm font-sans leading-relaxed text-[#8E95A5] sm:text-base">
                Luna connects the questions behind a landing site: what the terrain is like, when
                it is illuminated, and how a mission fits into the wider lunar program.
              </p>
            </div>

            <div className="mt-12 grid gap-5 md:grid-cols-3">
              {[
                ['Explore terrain', 'Switch between the global lunar globe and a focused South Pole topographic map.'],
                ['Understand conditions', 'Inspect illumination, local relief, and direct-to-Earth visibility at a selected location.'],
                ['Follow missions', 'Connect landing regions to CLPS missions, landers, launch dates, and payloads.'],
              ].map(([title, description], index) => (
                <article key={title} className="rounded-2xl border border-white/[0.08] bg-[#0C0D12] p-6 sm:p-7 transition-colors hover:border-white/[0.16]">
                  <span className="inline-block rounded-full border border-white/[0.1] bg-white/[0.03] px-2.5 py-0.5 text-[11px] font-mono tabular-nums text-[#94A3B8]">
                    0{index + 1}
                  </span>
                  <h3 className="mt-4 text-lg font-display font-semibold tracking-[-0.015em] text-white">{title}</h3>
                  <p className="mt-2.5 text-sm font-sans leading-relaxed text-[#8E95A5]">{description}</p>
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
        className="relative px-6 sm:px-10 lg:px-16 py-20 sm:py-28 border-t border-white/[0.08] bg-[#050507]"
      >
        <div className="max-w-[1360px] mx-auto">
          <div className="max-w-2xl mb-12 sm:mb-16">
            <span className="inline-block rounded-full border border-white/[0.12] bg-white/[0.03] px-3.5 py-1 text-[11px] font-sans font-semibold uppercase tracking-[0.14em] text-[#CBD5E1]">
              Mission catalog
            </span>
            <h2 className="text-3xl font-display font-semibold tracking-[-0.025em] sm:text-5xl mt-4 text-white">
              A clearer view of lunar exploration.
            </h2>
            <p className="text-sm sm:text-base font-sans text-[#8E95A5] leading-relaxed mt-4">
              Browse commercial lunar missions, their target regions, and the science they bring
              to the Moon.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {CLPS_MISSIONS.slice(0, 3).map((mission) => (
              <article
                key={mission.id}
                className="flex flex-col rounded-2xl border border-white/[0.08] bg-[#0C0D12] p-6 sm:p-7 transition-all hover:border-white/[0.2]"
              >
                <span className="text-[11px] font-sans font-semibold uppercase tracking-[0.12em] text-[#8E95A5]">
                  {mission.provider} · {mission.taskOrder}
                </span>
                <h3 className="text-xl font-display font-semibold tracking-[-0.015em] text-white mt-3">{mission.name}</h3>

                {/* Accessible Expandable Description */}
                <ExpandableText
                  text={mission.description}
                  maxLines={3}
                  charThreshold={140}
                  className="text-sm font-sans text-[#8E95A5] leading-relaxed mt-3 flex-1"
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
                  className="inline-flex items-center gap-1.5 mt-6 text-xs font-sans font-semibold text-[#E2E8F0] hover:text-white transition-colors self-start focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/50 rounded"
                >
                  <span>Explore mission</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </button>
              </article>
            ))}
          </div>

          <div className="flex flex-wrap gap-3.5 mt-10">
            <a
              href="#missions"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-white text-[#050507] font-semibold text-xs hover:bg-[#E2E8F0] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
            >
              <span>View all missions</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </a>
            <a
              href="#about"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-full border border-white/[0.12] bg-white/[0.02] text-[#F8FAFC] font-medium text-xs hover:border-white/[0.25] hover:bg-white/[0.06] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
            >
              <span>About the challenge</span>
            </a>
          </div>
        </div>
      </section>

      <footer className="px-6 sm:px-12 py-8 border-t border-white/[0.08] bg-[#050507] text-xs font-sans text-[#64748B] flex flex-wrap justify-between gap-3">
        <span>Luna · Lunar Landing Site Navigator</span>
        <a href="#about" className="hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/40 rounded">
          About this project
        </a>
      </footer>
    </div>
  );
}
