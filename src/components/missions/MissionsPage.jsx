import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  AlertTriangle,
  ArrowUpRight,
  CalendarDays,
  Camera,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock3,
  Compass,
  MapPin,
  Rocket,
  Sparkles,
  Telescope,
} from 'lucide-react';
import PublicPageHeader from '../common/PublicPageHeader.jsx';
import { CLPS_MISSIONS } from '../../data/clpsMissions.js';
import {
  getMissionOutcomeMeta,
  normalizeMissionOutcome,
} from '../../data/missions.js';
import {
  preloadImage,
  preloadAdjacentMissionImages,
  preloadEntireMissionCatalog,
} from '../../utils/missionImageCache.js';

const HISTORIC_MISSIONS = [
  {
    id: 'historic-change-6',
    name: "Chang'e 6",
    taskOrder: 'CNSA · 2024',
    provider: 'China National Space Administration',
    missionStatus: 'completed',
    latitude: -42,
    longitude: -154,
    landingSiteName: 'Apollo Basin (Farside)',
    launchDate: '2024-05-03',
    timelineOrder: 20240503,
    description: 'First sample-return mission from the lunar far side.',
    imageCredit: 'Wikipedia',
  },
  {
    id: 'historic-slim',
    name: 'SLIM',
    taskOrder: 'JAXA · 2023',
    provider: 'Japan Aerospace Exploration Agency',
    missionStatus: 'partial',
    outcome: 'partial',
    outcomeReason: 'Achieved 55 m pinpoint touchdown; rested inverted with intermittent solar power.',
    latitude: -13.315,
    longitude: 25.251,
    landingSiteName: 'Shioli Crater',
    launchDate: '2023-09-06',
    timelineOrder: 20230906,
    description: 'Japan demonstrated pinpoint lunar landing technology near Shioli crater.',
    imageCredit: 'Space.com',
  },
  {
    id: 'historic-chandrayaan-3',
    name: 'Chandrayaan-3',
    taskOrder: 'ISRO · 2023',
    provider: 'Indian Space Research Organisation',
    missionStatus: 'completed',
    latitude: -69.373,
    longitude: 32.319,
    landingSiteName: 'Shiv Shakti Point (South Pole region)',
    launchDate: '2023-07-14',
    timelineOrder: 20230714,
    description: 'India demonstrated lunar landing and rover operations near the south pole.',
    imageCredit: 'NASA / Chandrayaan-3',
  },
  {
    id: 'historic-apollo-17',
    name: 'Apollo 17',
    taskOrder: 'NASA · 1972',
    provider: 'NASA',
    missionStatus: 'completed',
    latitude: 20.191,
    longitude: 30.772,
    landingSiteName: 'Taurus-Littrow',
    launchDate: '1972-12-07',
    timelineOrder: 19721207,
    description: 'The final Apollo lunar landing explored the Taurus-Littrow valley.',
    imageCredit: 'NASA / Apollo 17 (Gene Cernan)',
  },
  {
    id: 'historic-apollo-16',
    name: 'Apollo 16',
    taskOrder: 'NASA · 1972',
    provider: 'NASA',
    missionStatus: 'completed',
    latitude: -8.973,
    longitude: 15.501,
    landingSiteName: 'Descartes Highlands',
    launchDate: '1972-04-16',
    timelineOrder: 19720416,
    description: 'A crewed exploration of the lunar highlands at Descartes.',
    imageCredit: 'NASA / Apollo 16 (Charles Duke)',
  },
  {
    id: 'historic-apollo-15',
    name: 'Apollo 15',
    taskOrder: 'NASA · 1971',
    provider: 'NASA',
    missionStatus: 'completed',
    latitude: 26.132,
    longitude: 3.633,
    landingSiteName: 'Hadley Rille',
    launchDate: '1971-07-26',
    timelineOrder: 19710726,
    description: 'The first lunar rover extended crewed field exploration at Hadley Rille.',
    imageCredit: 'NASA / Apollo 15 (James Irwin)',
  },
  {
    id: 'historic-apollo-14',
    name: 'Apollo 14',
    taskOrder: 'NASA · 1971',
    provider: 'NASA',
    missionStatus: 'completed',
    latitude: -3.646,
    longitude: -17.472,
    landingSiteName: 'Fra Mauro',
    launchDate: '1971-01-31',
    timelineOrder: 19710131,
    description: 'A crewed landing investigated the Fra Mauro formation.',
    imageCredit: 'NASA / Apollo 14 (Alan Shepard)',
  },
  {
    id: 'historic-apollo-12',
    name: 'Apollo 12',
    taskOrder: 'NASA · 1969',
    provider: 'NASA',
    missionStatus: 'completed',
    latitude: -3.013,
    longitude: -23.422,
    landingSiteName: 'Oceanus Procellarum',
    launchDate: '1969-11-14',
    timelineOrder: 19691114,
    description: 'A precision crewed landing in Oceanus Procellarum.',
    imageCredit: 'NASA / Apollo 12 (Alan Bean)',
  },
  {
    id: 'historic-apollo-11',
    name: 'Apollo 11',
    taskOrder: 'NASA · 1969',
    provider: 'NASA',
    missionStatus: 'completed',
    latitude: 0.674,
    longitude: 23.473,
    landingSiteName: 'Mare Tranquillitatis',
    launchDate: '1969-07-16',
    timelineOrder: 19690716,
    description: 'Humanity’s first crewed lunar landing.',
    imageCredit: 'Getty Images',
  },
];

function getTimelineOrder(mission) {
  if (mission.timelineOrder) return mission.timelineOrder;
  const numericDate = mission.launchDate?.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (numericDate) return Number(numericDate.slice(1).join(''));
  const year = mission.launchDate?.match(/(20\d{2})/)?.[1];
  return year ? Number(`${year}0000`) : 0;
}

function getTimelineDescription(mission) {
  return mission.timelineSummary || mission.description || mission.objectives || 'Lunar surface exploration mission.';
}

function getMissionStatus(mission) {
  const meta = getMissionOutcomeMeta(mission);
  if (meta.id === 'success') {
    return {
      label: 'Success',
      className: meta.pillClass,
      icon: CheckCircle2,
    };
  }
  if (meta.id === 'partial' || meta.id === 'failure') {
    return {
      label: meta.label,
      className: meta.pillClass,
      icon: AlertTriangle,
    };
  }
  return {
    label: meta.shortLabel || 'Planned',
    className: meta.pillClass,
    icon: Clock3,
  };
}

function formatCoordinates(value, positive, negative) {
  if (value === undefined || value === null) return '—';
  return `${Math.abs(value).toFixed(2)}°${value >= 0 ? positive : negative}`;
}

export default function MissionsPage({ onLaunchExplorer, onNavigate }) {
  const catalogMissions = useMemo(
    () =>
      [...CLPS_MISSIONS, ...HISTORIC_MISSIONS].sort(
        (a, b) => getTimelineOrder(a) - getTimelineOrder(b)
      ),
    []
  );
  const completedCount = useMemo(
    () =>
      catalogMissions.filter((m) => {
        const o = normalizeMissionOutcome(m);
        return o === 'success' || o === 'partial';
      }).length,
    [catalogMissions]
  );

  const [activeSlide, setActiveSlide] = useState(0);
  const scrollContainerRef = useRef(null);
  const slideRefs = useRef([]);

  const [currentBg, setCurrentBg] = useState('/images/missions/home.webp');
  const [prevBg, setPrevBg] = useState(null);
  const [isCrossfading, setIsCrossfading] = useState(false);

  useEffect(() => {
    const cancelSchedule = preloadEntireMissionCatalog(catalogMissions);
    return () => {
      if (cancelSchedule) cancelSchedule();
    };
  }, [catalogMissions]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const index = Number(entry.target.getAttribute('data-index') || 0);
            setActiveSlide(index);
          }
        });
      },
      {
        root: scrollContainerRef.current,
        threshold: 0.55,
      }
    );

    const elements = slideRefs.current.filter(Boolean);
    elements.forEach((el) => observer.observe(el));

    return () => observer.disconnect();
  }, [catalogMissions.length]);

  useEffect(() => {
    preloadAdjacentMissionImages(catalogMissions, activeSlide - 1);

    const nextBg =
      activeSlide > 0
        ? `/images/missions/${catalogMissions[activeSlide - 1]?.id}.webp`
        : '/images/missions/home.webp';

    preloadImage(nextBg, 'high');

    if (nextBg !== currentBg) {
      setPrevBg(currentBg);
      setCurrentBg(nextBg);
      setIsCrossfading(true);
      const timer = setTimeout(() => {
        setIsCrossfading(false);
        setPrevBg(null);
      }, 750);
      return () => clearTimeout(timer);
    }
  }, [activeSlide, catalogMissions, currentBg]);

  const scrollToSlide = (index) => {
    const targetEl = slideRefs.current[index];
    if (targetEl) {
      targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const isLeftSlide = activeSlide > 0 && (activeSlide - 1) % 2 === 0;
  const isRightSlide = activeSlide > 0 && (activeSlide - 1) % 2 !== 0;

  return (
    <div className="relative flex h-full min-h-0 w-full flex-col overflow-hidden bg-[#050507] font-sans text-[#F8FAFC] selection:bg-white/20">
      <PublicPageHeader
        currentPage="missions"
        onLaunchExplorer={onLaunchExplorer}
        onNavigate={onNavigate}
        showLogo={false}
      />

      <div className="pointer-events-none fixed inset-0 z-0 hidden overflow-hidden bg-[#050507] sm:block">
        {prevBg && (
          <div
            className="absolute inset-0 bg-cover bg-center transition-opacity duration-700 ease-out transform-gpu"
            style={{
              backgroundImage: `url("${prevBg}")`,
              opacity: isCrossfading ? 0 : 1,
            }}
          />
        )}

        <div
          key={currentBg}
          className="animate-morph-bg absolute inset-0 bg-cover bg-center transform-gpu"
          style={{
            backgroundImage: `url("${currentBg}")`,
          }}
        />

        <div className="absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-[#050507] via-[#050507]/60 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-[#050507] via-[#050507]/60 to-transparent" />
      </div>

      <div
        className={`pointer-events-none fixed inset-y-0 left-0 w-full md:w-[46%] backdrop-blur-2xl bg-gradient-to-r from-black/90 via-black/65 to-transparent mask-feather-right transition-opacity duration-700 ease-out z-[5] ${
          isLeftSlide ? 'opacity-100' : 'opacity-0'
        } hidden sm:block`}
        aria-hidden="true"
      />
      <div
        className={`pointer-events-none fixed inset-y-0 right-0 w-full md:w-[46%] backdrop-blur-2xl bg-gradient-to-l from-black/90 via-black/65 to-transparent mask-feather-left transition-opacity duration-700 ease-out z-[5] ${
          isRightSlide ? 'opacity-100' : 'opacity-0'
        } hidden sm:block`}
        aria-hidden="true"
      />

      <div
        ref={scrollContainerRef}
        className="relative z-10 flex-1 overflow-y-auto snap-y snap-proximity sm:snap-mandatory scroll-smooth overscroll-y-contain"
      >
        <section
          ref={(el) => (slideRefs.current[0] = el)}
          data-index="0"
          className="relative flex h-dvh min-h-0 w-full snap-start [scroll-snap-stop:always] flex-col items-center justify-center px-6 pt-20 pb-24 text-center select-none sm:min-h-[580px] sm:py-0"
        >
          <div
            className="pointer-events-none absolute inset-x-0 top-0 h-[44dvh] bg-cover bg-center sm:hidden"
            style={{ backgroundImage: 'url("/images/missions/home.webp")' }}
            aria-hidden="true"
          >
            <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/30 to-[#050507]" />
          </div>
          <div className="max-w-3xl space-y-5">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-slate-300 backdrop-blur-md">
              <Telescope className="h-3.5 w-3.5 text-white/80" /> Mission Catalog
            </span>
            <h1 className="text-4xl sm:text-6xl lg:text-7xl font-display font-semibold tracking-tight text-white drop-shadow-[0_4px_18px_rgba(0,0,0,0.95)]">
              Lunar missions
            </h1>
            <p className="mx-auto max-w-2xl text-base sm:text-lg font-sans leading-relaxed text-[#94A3B8]">
              A living timeline of NASA CLPS expeditions. Choose any mission to move directly to its landing region in the lunar explorer.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3 pt-2 text-xs font-medium">
              <span className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-slate-200 backdrop-blur-md">
                <strong className="font-mono tabular-nums text-white">{catalogMissions.length}</strong> missions cataloged
              </span>
              <span className="rounded-full border border-emerald-400/20 bg-emerald-400/[0.08] px-4 py-2 text-emerald-200 backdrop-blur-md">
                <strong className="font-mono tabular-nums">{completedCount}</strong> surface touchdowns reached
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => scrollToSlide(1)}
            className="group absolute bottom-10 flex flex-col items-center gap-2 text-xs font-medium uppercase tracking-[0.16em] text-[#8E95A5] transition-colors hover:text-white focus-visible:outline-none"
            aria-label="Scroll down to continue"
          >
            <span>Scroll down to continue</span>
            <div className="flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-white/5 backdrop-blur-md transition-transform duration-300 group-hover:translate-y-1 group-hover:border-white/40">
              <ChevronDown className="h-4 w-4 animate-bounce text-white/80" />
            </div>
          </button>

          <div className="absolute bottom-8 left-8 sm:left-14 md:left-20 z-10 hidden sm:flex pointer-events-auto">
            <div className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-black/40 px-3 py-1 text-[11px] font-sans text-slate-400 backdrop-blur-md">
              <Camera className="h-3 w-3 text-slate-400" />
              <span>Photo: WIRED</span>
            </div>
          </div>
        </section>

        {catalogMissions.map((mission, index) => {
          const isLeft = index % 2 === 0;
          const slideNumber = index + 1;
          const isActive = activeSlide === slideNumber;
          const status = getMissionStatus(mission);
          const StatusIcon = status.icon;

          return (
            <section
              key={mission.id}
              ref={(el) => (slideRefs.current[slideNumber] = el)}
              data-index={slideNumber}
              className="relative flex h-dvh min-h-0 w-full snap-start [scroll-snap-stop:always] flex-col items-stretch justify-start overflow-hidden select-none sm:min-h-[580px] sm:items-center sm:justify-center sm:overflow-visible"
            >
              <div
                className="pointer-events-none absolute inset-x-0 top-0 h-[60dvh] bg-cover bg-center sm:hidden"
                style={{ backgroundImage: `url("/images/missions/${mission.id}.webp")` }}
                aria-hidden="true"
              >
                <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-[#050507]" />
              </div>
              <div
                className={`relative z-10 mx-auto flex h-full w-full max-w-[1320px] items-end px-4 pb-14 sm:items-center sm:px-14 sm:pb-0 md:px-20 lg:px-24 ${
                  isLeft ? 'justify-start' : 'justify-start sm:justify-end'
                }`}
              >
                <div
                  className={`relative z-10 max-h-[62dvh] w-full overflow-y-auto rounded-2xl border border-white/10 bg-[#050507]/95 px-4 py-3 shadow-2xl backdrop-blur-xl sm:max-h-none sm:w-auto sm:max-w-[380px] sm:overflow-visible sm:rounded-2xl sm:border-white/15 sm:bg-[#050507]/80 sm:px-5 sm:py-4 lg:max-w-[400px] transition-all duration-700 ease-out transform-gpu ${
                    isLeft ? 'text-left' : 'text-left sm:text-right'
                  } ${
                    isActive
                      ? 'opacity-100 translate-y-0 scale-100'
                      : 'opacity-20 translate-y-6 scale-[0.98]'
                  }`}
                >
                  <div
                    className={`flex items-center gap-2 border-b border-white/10 pb-1.5 ${
                      isLeft ? 'justify-between' : 'justify-between sm:flex-row-reverse'
                    }`}
                  >
                    <span className="font-mono text-[11px] font-semibold tracking-wider text-slate-400">
                      MISSION {String(slideNumber).padStart(2, '0')} / {String(catalogMissions.length).padStart(2, '0')}
                    </span>
                    <span
                      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-sans font-semibold uppercase tracking-wider ${status.className}`}
                    >
                      <StatusIcon className="h-3 w-3" /> {status.label}
                    </span>
                  </div>

                  <div className="mt-2">
                    <p className="text-[11px] font-sans font-semibold uppercase tracking-[0.14em] text-slate-400">
                      {mission.taskOrder} · {mission.provider}
                    </p>
                    <h2 className="mt-0.5 text-2xl sm:text-3xl lg:text-4xl font-display font-semibold tracking-tight text-white">
                      {mission.name}
                    </h2>
                  </div>

                  <p className="mt-2 text-xs sm:text-sm font-sans leading-relaxed text-[#CBD5E1]">
                    {getTimelineDescription(mission)}
                  </p>
                  {mission.outcomeReason && (
                    <p className={`mt-1.5 text-[11px] sm:text-xs font-sans ${status.label === 'Partial' || status.label === 'Failure' ? 'text-amber-300' : 'text-emerald-300/90'}`}>
                      Outcome: {mission.outcomeReason}
                    </p>
                  )}

                  <div className="mt-2.5 space-y-1 border-t border-white/10 pt-2 text-xs sm:text-sm">
                    <div className={`flex items-center gap-1.5 text-slate-300 ${isLeft ? 'justify-start' : 'justify-start sm:justify-end'}`}>
                      {isLeft && <CalendarDays className="h-3.5 w-3.5 shrink-0 text-slate-400" />}
                      <span className="text-slate-400 shrink-0">Launch:</span>
                      <span className="font-medium text-white">{mission.launchDate || 'TBD'}</span>
                      {!isLeft && <CalendarDays className="h-3.5 w-3.5 shrink-0 text-slate-400" />}
                    </div>
                    <div className={`flex items-center gap-1.5 text-slate-300 ${isLeft ? 'justify-start' : 'justify-start sm:justify-end'}`}>
                      {isLeft && <MapPin className="h-3.5 w-3.5 shrink-0 text-slate-400" />}
                      <span className="text-slate-400 shrink-0">Site:</span>
                      <span className="font-medium text-white">{mission.landingSiteName || 'Lunar Surface'}</span>
                      {!isLeft && <MapPin className="h-3.5 w-3.5 shrink-0 text-slate-400" />}
                    </div>
                    <div className={`flex items-center gap-1.5 font-mono text-[11px] sm:text-xs text-slate-300 ${isLeft ? 'justify-start' : 'justify-start sm:justify-end'}`}>
                      {isLeft && <Compass className="h-3.5 w-3.5 shrink-0 text-slate-400" />}
                      <span className="text-slate-400 font-sans shrink-0">Coordinates:</span>
                      <span className="text-white">
                        {formatCoordinates(mission.latitude, 'N', 'S')}, {formatCoordinates(mission.longitude, 'E', 'W')}
                      </span>
                      {!isLeft && <Compass className="h-3.5 w-3.5 shrink-0 text-slate-400" />}
                    </div>
                    <div className={`flex items-center gap-1.5 text-slate-300 ${isLeft ? 'justify-start' : 'justify-start sm:justify-end'}`}>
                      {isLeft && <Camera className="h-3.5 w-3.5 shrink-0 text-slate-400" />}
                      <span className="text-slate-400 shrink-0">Credit:</span>
                      <span className="font-medium text-white/90">{mission.imageCredit || 'NASA'}</span>
                      {!isLeft && <Camera className="h-3.5 w-3.5 shrink-0 text-slate-400" />}
                    </div>
                  </div>

                  <div className={`mt-3 flex ${isLeft ? 'justify-start' : 'justify-start sm:justify-end'}`}>
                    <button
                      type="button"
                      onClick={() =>
                        onLaunchExplorer({
                          selectedMission: mission,
                          missionId: mission.id,
                          viewMode: '3d',
                        })
                      }
                      className="group inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-xs font-medium text-[#050507] transition-all hover:bg-slate-200 active:scale-95 shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/80"
                    >
                      <span>Explore in 3D</span>
                      <ArrowUpRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                    </button>
                  </div>
                </div>
              </div>

              <div
                className={`absolute bottom-8 z-10 hidden sm:flex pointer-events-auto ${
                  isLeft ? 'right-8 sm:right-14 md:right-20' : 'left-8 sm:left-14 md:left-20'
                }`}
              >
                <div className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-black/40 px-3 py-1 text-[11px] font-sans text-slate-400 backdrop-blur-md">
                  <Camera className="h-3 w-3 text-slate-400" />
                  <span>Photo: {mission.imageCredit || 'NASA'}</span>
                </div>
              </div>
              <div className="pointer-events-none absolute left-4 top-[calc(60dvh-2.25rem)] z-10 sm:hidden">
                <div className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-black/55 px-3 py-1 text-[10px] font-sans text-slate-200 backdrop-blur-md">
                  <Camera className="h-3 w-3" />
                  <span>Photo: {mission.imageCredit || 'NASA'}</span>
                </div>
              </div>
            </section>
          );
        })}
      </div>

      <nav
        aria-label="Mission slide navigator"
        className="pointer-events-auto fixed right-4 sm:right-6 top-1/2 z-20 hidden -translate-y-1/2 flex-col items-center gap-1 rounded-full border border-white/10 bg-black/40 p-1.5 backdrop-blur-md md:flex"
      >
        <button
          type="button"
          onClick={() => scrollToSlide(Math.max(0, activeSlide - 1))}
          disabled={activeSlide === 0}
          aria-label="Previous slide"
          className="rounded-full p-1 text-slate-400 transition-colors hover:text-white disabled:opacity-30 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80"
        >
          <ChevronUp className="h-3.5 w-3.5" />
        </button>

        <div className="flex flex-col items-center py-0.5">
          <button
            type="button"
            onClick={() => scrollToSlide(0)}
            aria-label="Overview"
            aria-current={activeSlide === 0 ? 'true' : undefined}
            className="flex h-4 w-5 items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80"
          >
            <span
              className={`block transition-all rounded-full ${
                activeSlide === 0
                  ? 'h-3.5 w-1.5 bg-white'
                  : 'h-1.5 w-1.5 bg-white/35 hover:bg-white/70'
              }`}
            />
          </button>
          {catalogMissions.map((m, idx) => {
            const slideNum = idx + 1;
            const isCurrent = activeSlide === slideNum;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => scrollToSlide(slideNum)}
                aria-label={`Jump to ${m.name}`}
                aria-current={isCurrent ? 'true' : undefined}
                title={m.name}
                className="flex h-4 w-5 items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80"
              >
                <span
                  className={`block transition-all rounded-full ${
                    isCurrent
                      ? 'h-3.5 w-1.5 bg-white'
                      : 'h-1.5 w-1.5 bg-white/35 hover:bg-white/70'
                  }`}
                />
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => scrollToSlide(Math.min(catalogMissions.length, activeSlide + 1))}
          disabled={activeSlide === catalogMissions.length}
          aria-label="Next slide"
          className="rounded-full p-1 text-slate-400 transition-colors hover:text-white disabled:opacity-30 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80"
        >
          <ChevronDown className="h-3.5 w-3.5" />
        </button>
      </nav>

      <div className="pointer-events-auto fixed bottom-3 left-1/2 -translate-x-1/2 z-20 flex md:hidden items-center gap-2 rounded-full border border-white/15 bg-black/75 px-3 py-1 backdrop-blur-md text-[11px] font-mono text-slate-200 shadow-lg">
        <button
          type="button"
          onClick={() => scrollToSlide(Math.max(0, activeSlide - 1))}
          disabled={activeSlide === 0}
          aria-label="Previous mission slide"
          className="p-1 text-slate-300 hover:text-white disabled:opacity-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80 rounded-full"
        >
          <ChevronUp className="h-3.5 w-3.5" />
        </button>
        <span className="tabular-nums">
          {activeSlide === 0 ? 'Overview' : `${activeSlide} / ${catalogMissions.length}`}
        </span>
        <button
          type="button"
          onClick={() => scrollToSlide(Math.min(catalogMissions.length, activeSlide + 1))}
          disabled={activeSlide === catalogMissions.length}
          aria-label="Next mission slide"
          className="p-1 text-slate-300 hover:text-white disabled:opacity-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80 rounded-full"
        >
          <ChevronDown className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
