import React, { useState } from 'react';
import {
  ArrowUpRight,
  CalendarDays,
  CheckCircle2,
  Clock3,
  ExternalLink,
  MapPin,
  Rocket,
} from 'lucide-react';
import CompactClpsModal from '../landing/CompactClpsModal.jsx';
import PublicPageHeader from '../common/PublicPageHeader.jsx';
import { CLPS_MISSIONS } from '../../data/clpsMissions.js';

function getMissionImage(mission) {
  const id = mission.id || '';
  if (id.includes('im1') || id.includes('odysseus')) return '/pictures/odysseus-malapert-landing.jpg';
  if (id.includes('bgm1') || id.includes('crisium')) return '/pictures/blue-ghost-mare-crisium.jpg';
  if (id.includes('earth') || id.includes('marble')) return '/pictures/earth-blue-marble.jpg';
  if (id.includes('im2') || id.includes('griffin') || id.includes('blueorigin')) return '/pictures/shackleton-polar-ridge.jpg';
  return '/pictures/lunar-south-pole-horizon.jpg';
}

function getMissionStatus(mission) {
  if (mission.missionStatus === 'completed') {
    return { label: 'Landed', className: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300' };
  }
  if (mission.missionStatus === 'failed') {
    return { label: 'Flight anomaly', className: 'border-rose-500/30 bg-rose-500/10 text-rose-300' };
  }
  return { label: 'Planned', className: 'border-amber-500/30 bg-amber-500/10 text-amber-200' };
}

function formatCoordinates(value, positive, negative) {
  return `${Math.abs(value).toFixed(2)}°${value >= 0 ? positive : negative}`;
}

export default function MissionsPage({ onLaunchExplorer }) {
  const [activeMission, setActiveMission] = useState(null);
  const [expandedMissionId, setExpandedMissionId] = useState(null);

  return (
    <div className="flex h-full min-h-0 w-full flex-col overflow-hidden bg-[#060B13] font-sans text-[#F1F5F9] selection:bg-[#00D2C4]/30">
      <PublicPageHeader currentPage="missions" onLaunchExplorer={onLaunchExplorer} />

      <main className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-[1400px] space-y-8 px-5 py-9 sm:px-8 sm:py-12 lg:px-12">
          <div className="space-y-3 border-b border-[#16283C] pb-7">
            <span className="text-xs font-mono font-semibold uppercase tracking-[0.22em] text-[#00D2C4]">
              Lunar surface expeditions
            </span>
            <h1 className="font-serif text-4xl font-normal text-[#F1F5F9] sm:text-5xl">
              Missions
            </h1>
            <p className="max-w-3xl text-sm leading-relaxed text-[#94A3B8] sm:text-base">
              Explore NASA Commercial Lunar Payload Services missions, their target regions,
              spacecraft, timelines, and science payloads.
            </p>
            <p className="text-xs font-mono text-[#64748B]">
              {CLPS_MISSIONS.length} mission records · Select a card for full mission details
            </p>
          </div>

          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
            {CLPS_MISSIONS.map((mission) => {
              const status = getMissionStatus(mission);
              return (
                <article
                  key={mission.id}
                  className="group flex min-w-0 flex-col overflow-hidden rounded-2xl border border-[#16283C] bg-[#0A1220] transition-all hover:border-[#00D2C4]/50 hover:shadow-xl hover:shadow-cyan-950/20"
                >
                  <button
                    type="button"
                    onClick={() => setActiveMission(mission)}
                    aria-label={`View details for ${mission.name}`}
                    className="relative block aspect-[16/9] w-full overflow-hidden bg-[#070D17] text-left"
                  >
                    <img
                      src={getMissionImage(mission)}
                      alt={`${mission.name} lunar mission`}
                      className="h-full w-full object-cover opacity-80 transition duration-500 group-hover:scale-105 group-hover:opacity-100"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#0A1220] via-transparent to-black/20" />
                    <span className={`absolute left-4 top-4 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-mono uppercase tracking-wide ${status.className}`}>
                      {mission.missionStatus === 'completed' ? (
                        <CheckCircle2 className="h-3 w-3" />
                      ) : (
                        <Clock3 className="h-3 w-3" />
                      )}
                      {status.label}
                    </span>
                    <span className="absolute bottom-4 left-4 rounded-md border border-white/15 bg-[#060B13]/80 px-2 py-1 text-[10px] font-mono text-[#00D2C4] backdrop-blur">
                      {mission.taskOrder}
                    </span>
                    <span className="absolute bottom-4 right-4 flex h-8 w-8 items-center justify-center rounded-full bg-[#00D2C4] text-[#060B13] shadow-lg">
                      <ArrowUpRight className="h-4 w-4" />
                    </span>
                  </button>

                  <div className="flex flex-1 flex-col p-5">
                    <p className="text-[10px] font-mono uppercase tracking-[0.16em] text-[#34D399]">
                      NASA · {mission.provider}
                    </p>
                    <h2 className="mt-2 font-serif text-xl leading-snug text-[#F1F5F9] sm:text-2xl">
                      {mission.name}
                    </h2>
                    <p
                      className="mt-3 text-xs leading-relaxed text-[#94A3B8]"
                      style={
                        expandedMissionId === mission.id
                          ? undefined
                          : {
                              display: '-webkit-box',
                              WebkitBoxOrient: 'vertical',
                              WebkitLineClamp: 3,
                              overflow: 'hidden',
                            }
                      }
                    >
                      {mission.description}
                    </p>
                    {mission.description.length > 180 && (
                      <button
                        type="button"
                        aria-expanded={expandedMissionId === mission.id}
                        onClick={() =>
                          setExpandedMissionId((id) => (id === mission.id ? null : mission.id))
                        }
                        className="mt-1 self-start text-[10px] font-mono text-[#00D2C4] hover:text-[#34D399]"
                      >
                        {expandedMissionId === mission.id ? 'Show less' : 'Read full description'}
                      </button>
                    )}

                    <dl className="mt-4 grid grid-cols-2 gap-x-3 gap-y-3 border-t border-[#16283C] pt-4 text-xs">
                      <div className="min-w-0">
                        <dt className="flex items-center gap-1 text-[9px] font-mono uppercase tracking-wide text-[#64748B]">
                          <MapPin className="h-3 w-3 text-[#00D2C4]" /> Target site
                        </dt>
                        <dd className="mt-1 truncate font-medium text-[#CBD5E1]" title={mission.landingSiteName}>
                          {mission.landingSiteName}
                        </dd>
                        <dd className="mt-0.5 font-mono text-[10px] text-[#94A3B8]">
                          {formatCoordinates(mission.latitude, 'N', 'S')},{' '}
                          {formatCoordinates(mission.longitude, 'E', 'W')}
                        </dd>
                      </div>
                      <div className="min-w-0">
                        <dt className="flex items-center gap-1 text-[9px] font-mono uppercase tracking-wide text-[#64748B]">
                          <CalendarDays className="h-3 w-3 text-[#00D2C4]" /> Launch
                        </dt>
                        <dd className="mt-1 font-mono text-[11px] text-[#CBD5E1]">
                          {mission.launchDate}
                        </dd>
                        {mission.landingDate && (
                          <dd className="mt-0.5 text-[10px] text-emerald-300">
                            Landed {mission.landingDate}
                          </dd>
                        )}
                      </div>
                      <div className="col-span-2 min-w-0">
                        <dt className="flex items-center gap-1 text-[9px] font-mono uppercase tracking-wide text-[#64748B]">
                          <Rocket className="h-3 w-3 text-[#00D2C4]" /> Lander &amp; launch vehicle
                        </dt>
                        <dd className="mt-1 text-[11px] text-[#CBD5E1]">
                          {mission.lander} · {mission.launchVehicle}
                        </dd>
                      </div>
                    </dl>

                    <div className="mt-4 border-t border-[#16283C] pt-3">
                      <p className="text-[9px] font-mono uppercase tracking-wide text-[#64748B]">
                        Payloads · {mission.payloads.length}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {mission.payloads.slice(0, 4).map((payload) => (
                          <span
                            key={payload.name}
                            title={`${payload.fullName}: ${payload.purpose}`}
                            className="rounded-md border border-[#16283C] bg-[#060B13] px-2 py-1 text-[9px] font-mono text-[#A5B4C7]"
                          >
                            {payload.name}
                          </span>
                        ))}
                        {mission.payloads.length > 4 && (
                          <span className="rounded-md border border-[#16283C] bg-[#060B13] px-2 py-1 text-[9px] font-mono text-[#64748B]">
                            +{mission.payloads.length - 4} more
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="mt-auto flex items-center justify-between gap-3 pt-5">
                      <a
                        href={mission.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(event) => event.stopPropagation()}
                        className="inline-flex items-center gap-1 text-[10px] font-mono text-[#94A3B8] transition-colors hover:text-[#00D2C4]"
                      >
                        NASA source <ExternalLink className="h-3 w-3" />
                      </a>
                      <button
                        type="button"
                        onClick={() => setActiveMission(mission)}
                        className="text-[10px] font-mono font-semibold uppercase tracking-wide text-[#00D2C4] hover:text-[#34D399]"
                      >
                        Full details
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </main>

      <CompactClpsModal
        isOpen={Boolean(activeMission)}
        mission={activeMission}
        onClose={() => setActiveMission(null)}
        onFlyTo={(mission) => {
          setActiveMission(null);
          onLaunchExplorer({ selectedMission: mission, missionId: mission.id });
        }}
      />
    </div>
  );
}
