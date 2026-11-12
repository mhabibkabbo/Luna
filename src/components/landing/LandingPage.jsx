import React, { useState, useMemo } from 'react';
import { ArrowUpRight } from 'lucide-react';
import PublicPageHeader from '../common/PublicPageHeader.jsx';
import RealisticMoon from './RealisticMoon.jsx';
import ExpandableText from '../common/ExpandableText.jsx';
import { CLPS_MISSIONS } from '../../data/clpsMissions.js';

const SHOW_HOME_OVERVIEW = true;

function HeroStarfield() {
  const stars = useMemo(() => {
    return Array.from({ length: 95 }, (_, i) => ({
      id: i,
      left: `${(i * 17.3 + (i % 7) * 11) % 100}%`,
      top: `${(i * 23.7 + (i % 5) * 19) % 100}%`,
      size: i % 4 === 0 ? 2.5 : i % 2 === 0 ? 1.8 : 1.2,
      opacity: 0.25 + ((i * 13) % 65) / 100,
      duration: `${2.4 + (i % 5) * 1.2}s`,
      delay: `${(i % 7) * 0.65}s`,
      color: i % 6 === 0 ? '#38BDF8' : i % 9 === 0 ? '#E2E8F0' : '#FFFFFF',
    }));
  }, []);

  return (
    <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none" aria-hidden="true">
      {stars.map((star) => (
        <span
          key={star.id}
          className="absolute rounded-full animate-star-twinkle"
          style={{
            left: star.left,
            top: star.top,
            width: `${star.size}px`,
            height: `${star.size}px`,
            backgroundColor: star.color,
            boxShadow: star.size > 2 ? `0 0 5px ${star.color}` : 'none',
            '--twinkle-duration': star.duration,
            '--twinkle-delay': star.delay,
          }}
        />
      ))}
      <span className="animate-meteor-1 absolute top-[18%] right-[22%] h-[1.5px] w-28 bg-gradient-to-r from-transparent via-cyan-200 to-white pointer-events-none opacity-0" />
      <span className="animate-meteor-2 absolute top-[35%] right-[12%] h-[1.5px] w-36 bg-gradient-to-r from-transparent via-cyan-100 to-white pointer-events-none opacity-0" />
    </div>
  );
}

export default function LandingPage({ onLaunchExplorer, onNavigate }) {
  const [selectedMissionIndex, setSelectedMissionIndex] = useState(0);

  return (
    <div className="h-dvh w-full overflow-x-hidden overflow-y-auto bg-[#050507] text-[#F8FAFC] font-sans selection:bg-white/20 selection:text-white flex flex-col justify-between">
      <PublicPageHeader
        currentPage="landing"
        onLaunchExplorer={onLaunchExplorer}
        onNavigate={onNavigate}
        showLogo={false}
      />

      <section
        aria-label="Lunar Surface Hero Overview"
        className="relative isolate my-auto flex-none w-full min-h-dvh flex items-center pt-20 pb-8 sm:pb-20 px-6 sm:px-10 lg:px-16 overflow-hidden"
      >
        <div
          className="absolute inset-0 bg-cover bg-center pointer-events-none z-0 opacity-30 transform scale-105"
          style={{
            backgroundImage: 'url("/pictures/lunar-south-pole-horizon.jpg")',
            backgroundPosition: 'center 45%',
          }}
        />

        <div
          className="absolute inset-0 pointer-events-none z-0"
          style={{
            background:
              'radial-gradient(ellipse 75% 65% at 68% 45%, rgba(56, 189, 248, 0.12) 0%, rgba(255, 255, 255, 0.05) 35%, rgba(5, 5, 7, 0.88) 75%), radial-gradient(circle at 20% 75%, rgba(14, 165, 233, 0.05) 0%, transparent 60%)',
          }}
        />

        <HeroStarfield />

        <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-[#050507] via-[#050507]/80 to-transparent pointer-events-none z-10" />
        <div className="absolute inset-x-0 bottom-0 h-36 bg-gradient-to-t from-[#050507] via-[#050507]/85 to-transparent pointer-events-none z-10" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#050507]/90 via-[#050507]/55 to-transparent pointer-events-none z-10" />

        <div className="relative z-20 my-auto grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-10 lg:gap-12 items-center max-w-[1480px] w-full mx-auto">
          <div className="lg:col-span-6 space-y-5 sm:space-y-6 z-10">
            <h1 className="text-3xl font-display font-semibold sm:text-5xl xl:text-[4.15rem] leading-[1.06] tracking-[-0.032em] text-white animate-in fade-in slide-in-from-bottom-4 duration-800 delay-150">
              The <span className="text-transparent bg-clip-text bg-gradient-to-r from-white via-slate-100 to-slate-300">lunar</span> surface
              <br />
              in high <span className="text-[#CBD5E1]">definition.</span>
            </h1>

            <p className="text-sm sm:text-[17px] text-[#8E95A5] max-w-lg leading-[1.65] font-sans font-normal animate-in fade-in slide-in-from-bottom-3 duration-800 delay-300">
              Explore lunar topography, commercial landers, and polar expedition targets in interactive 3D and 2D.{' '}
              <strong className="text-[#E2E8F0] font-medium">
                Analyze solar illumination, ephemeris vectors, and direct-to-Earth links.
              </strong>
            </p>

            <div className="flex flex-wrap items-center gap-3.5 pt-1 animate-in fade-in slide-in-from-bottom-2 duration-800 delay-450">
              <button
                type="button"
                onClick={() => onLaunchExplorer({ viewMode: '3d' })}
                aria-label="Launch 3D Lunar Surface Explorer"
                className="flex items-center gap-2.5 h-10 px-4 sm:h-11 sm:px-6 rounded-full bg-white hover:bg-[#E2E8F0] text-[#050507] font-semibold text-xs tracking-wide transition-all duration-300 hover:scale-105 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 shadow-lg shadow-white/10"
              >
                <span>Launch Lunar Map</span>
                <ArrowUpRight className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => onLaunchExplorer({ viewMode: '2d' })}
                aria-label="Open 2D South Pole Topographical GIS Map"
                className="flex items-center gap-2 h-10 px-4 sm:h-11 sm:px-5 rounded-full bg-white/[0.04] hover:bg-white/[0.08] text-[#F8FAFC] border border-white/[0.12] hover:border-white/[0.25] font-medium text-xs tracking-wide transition-all duration-300 hover:scale-105 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 backdrop-blur-md"
              >
                <span>South Pole 2D Topo</span>
              </button>
            </div>
          </div>

          <div className="lg:col-span-6 relative isolate mx-auto h-[min(80vw,300px)] w-[min(80vw,300px)] sm:mx-0 sm:h-[540px] sm:w-full md:h-[580px] lg:h-[620px] xl:h-[660px] lg:-mt-10 xl:-mt-12 flex items-center justify-center animate-in fade-in zoom-in-80 duration-1000 delay-200">
            <div className="absolute inset-0 rounded-full blur-3xl bg-cyan-500/10 scale-95 animate-pulse-glow pointer-events-none z-0" />
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
          <div className="mx-auto max-w-[1480px]">
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
                <article
                  key={title}
                  className="group rounded-2xl border border-white/[0.08] bg-[#0C0D12] p-6 sm:p-7 transition-all duration-300 hover:-translate-y-1.5 hover:border-white/[0.22] hover:bg-[#11131A] hover:shadow-xl hover:shadow-cyan-950/20"
                >
                  <span className="inline-block rounded-full border border-white/[0.1] bg-white/[0.03] px-2.5 py-0.5 text-[11px] font-mono tabular-nums text-[#94A3B8] transition-colors group-hover:border-cyan-400/40 group-hover:text-cyan-200">
                    0{index + 1}
                  </span>
                  <h3 className="mt-4 text-lg font-display font-semibold tracking-[-0.015em] text-white transition-colors group-hover:text-cyan-100">{title}</h3>
                  <p className="mt-2.5 text-sm font-sans leading-relaxed text-[#8E95A5]">{description}</p>
                </article>
              ))}
            </div>
          </div>
        </section>
      )}

      <section
        aria-label="Commercial Lunar Missions Manifest"
        className="relative px-6 sm:px-10 lg:px-16 py-20 sm:py-28 border-t border-white/[0.08] bg-[#050507]"
      >
        <div className="max-w-[1480px] mx-auto">
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
                className="group flex flex-col rounded-2xl border border-white/[0.08] bg-[#0C0D12] p-6 sm:p-7 transition-all duration-300 hover:-translate-y-1.5 hover:border-white/[0.22] hover:bg-[#11131A] hover:shadow-xl hover:shadow-black/60"
              >
                <span className="text-[11px] font-sans font-semibold uppercase tracking-[0.12em] text-[#8E95A5] transition-colors group-hover:text-cyan-300">
                  {mission.provider} · {mission.taskOrder}
                </span>
                <h3 className="text-xl font-display font-semibold tracking-[-0.015em] text-white mt-3 group-hover:text-slate-100">{mission.name}</h3>

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
                  className="inline-flex items-center gap-1.5 mt-6 text-xs font-sans font-semibold text-[#E2E8F0] hover:text-white transition-all group-hover:translate-x-1 self-start focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/50 rounded"
                >
                  <span>Explore mission</span>
                  <ArrowUpRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </button>
              </article>
            ))}
          </div>

          <div className="mt-10 flex flex-wrap justify-center gap-3.5">
            <a
              href="#missions"
              onClick={(e) => {
                if (onNavigate) {
                  e.preventDefault();
                  onNavigate('missions');
                }
              }}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-white text-[#050507] font-semibold text-xs hover:bg-[#E2E8F0] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
            >
              <span>View all missions</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </a>
            <a
              href="#about"
              onClick={(e) => {
                if (onNavigate) {
                  e.preventDefault();
                  onNavigate('about');
                }
              }}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-full border border-white/[0.12] bg-white/[0.02] text-[#F8FAFC] font-medium text-xs hover:border-white/[0.25] hover:bg-white/[0.06] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
            >
              <span>About the challenge</span>
            </a>
          </div>
        </div>
      </section>

      <footer className="px-6 sm:px-12 py-8 border-t border-white/[0.08] bg-[#050507] text-xs font-sans text-[#64748B] flex flex-wrap justify-between gap-3">
        <span>Luna · Lunar Landing Site Navigator</span>
        <a
          href="#about"
          onClick={(e) => {
            if (onNavigate) {
              e.preventDefault();
              onNavigate('about');
            }
          }}
          className="hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/40 rounded"
        >
          About this project
        </a>
      </footer>
    </div>
  );
}
