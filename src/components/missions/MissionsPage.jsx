import React from 'react';
import { ArrowUpRight, CalendarDays, CheckCircle2, Clock3, MapPin, Rocket, Telescope } from 'lucide-react';
import PublicPageHeader from '../common/PublicPageHeader.jsx';
import { CLPS_MISSIONS } from '../../data/clpsMissions.js';

const HISTORIC_MISSIONS = [
  { id: 'historic-change-6', name: "Chang'e 6", taskOrder: 'CNSA · 2024', provider: 'China National Space Administration', missionStatus: 'completed', latitude: -42, longitude: -154, landingSiteName: 'Apollo Basin (Farside)', launchDate: '2024-05-03', timelineOrder: 20240503, description: 'First sample-return mission from the lunar far side.' },
  { id: 'historic-slim', name: 'SLIM', taskOrder: 'JAXA · 2023', provider: 'Japan Aerospace Exploration Agency', missionStatus: 'completed', latitude: -13.315, longitude: 25.251, landingSiteName: 'Shioli Crater', launchDate: '2023-09-06', timelineOrder: 20230906, description: 'Japan demonstrated pinpoint lunar landing technology near Shioli crater.' },
  { id: 'historic-chandrayaan-3', name: 'Chandrayaan-3', taskOrder: 'ISRO · 2023', provider: 'Indian Space Research Organisation', missionStatus: 'completed', latitude: -69.373, longitude: 32.319, landingSiteName: 'Shiv Shakti Point (South Pole region)', launchDate: '2023-07-14', timelineOrder: 20230714, description: 'India demonstrated lunar landing and rover operations near the south pole.' },
  { id: 'historic-apollo-17', name: 'Apollo 17', taskOrder: 'NASA · 1972', provider: 'NASA', missionStatus: 'completed', latitude: 20.191, longitude: 30.772, landingSiteName: 'Taurus-Littrow', launchDate: '1972-12-07', timelineOrder: 19721207, description: 'The final Apollo lunar landing explored the Taurus-Littrow valley.' },
  { id: 'historic-apollo-16', name: 'Apollo 16', taskOrder: 'NASA · 1972', provider: 'NASA', missionStatus: 'completed', latitude: -8.973, longitude: 15.501, landingSiteName: 'Descartes Highlands', launchDate: '1972-04-16', timelineOrder: 19720416, description: 'A crewed exploration of the lunar highlands at Descartes.' },
  { id: 'historic-apollo-15', name: 'Apollo 15', taskOrder: 'NASA · 1971', provider: 'NASA', missionStatus: 'completed', latitude: 26.132, longitude: 3.633, landingSiteName: 'Hadley Rille', launchDate: '1971-07-26', timelineOrder: 19710726, description: 'The first lunar rover extended crewed field exploration at Hadley Rille.' },
  { id: 'historic-apollo-14', name: 'Apollo 14', taskOrder: 'NASA · 1971', provider: 'NASA', missionStatus: 'completed', latitude: -3.646, longitude: -17.472, landingSiteName: 'Fra Mauro', launchDate: '1971-01-31', timelineOrder: 19710131, description: 'A crewed landing investigated the Fra Mauro formation.' },
  { id: 'historic-apollo-12', name: 'Apollo 12', taskOrder: 'NASA · 1969', provider: 'NASA', missionStatus: 'completed', latitude: -3.013, longitude: -23.422, landingSiteName: 'Oceanus Procellarum', launchDate: '1969-11-14', timelineOrder: 19691114, description: 'A precision crewed landing in Oceanus Procellarum.' },
  { id: 'historic-apollo-11', name: 'Apollo 11', taskOrder: 'NASA · 1969', provider: 'NASA', missionStatus: 'completed', latitude: 0.674, longitude: 23.473, landingSiteName: 'Mare Tranquillitatis', launchDate: '1969-07-16', timelineOrder: 19690716, description: 'Humanity’s first crewed lunar landing.' },
];

function getTimelineOrder(mission) {
  if (mission.timelineOrder) return mission.timelineOrder;
  const numericDate = mission.launchDate?.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (numericDate) return Number(numericDate.slice(1).join(''));
  const year = mission.launchDate?.match(/(20\d{2})/)?.[1];
  return year ? Number(`${year}0000`) : 0;
}

function getTimelineDescription(mission) {
  return mission.timelineSummary || mission.description?.split(/(?<=\.)\s/)[0] || 'Lunar surface exploration mission.';
}

function getMissionStatus(mission) {
  if (mission.missionStatus === 'completed') return { label: 'Landed', className: 'border-emerald-400/30 bg-emerald-400/10 text-emerald-200', icon: CheckCircle2 };
  if (mission.missionStatus === 'failed') return { label: 'Flight anomaly', className: 'border-rose-400/30 bg-rose-400/10 text-rose-200', icon: Clock3 };
  return { label: 'Planned', className: 'border-amber-300/30 bg-amber-300/10 text-amber-100', icon: Clock3 };
}

function formatCoordinates(value, positive, negative) {
  return `${Math.abs(value).toFixed(2)}°${value >= 0 ? positive : negative}`;
}

function MissionEntry({ mission, index, onLaunchExplorer }) {
  const status = getMissionStatus(mission);
  const StatusIcon = status.icon;
  const isLeft = index % 2 === 0;

  return (
    <li className="relative grid grid-cols-[1fr_2.75rem_1fr] gap-x-3 sm:gap-x-6">
      <div className={isLeft ? 'col-start-1' : 'col-start-3'}>
        <button type="button" onClick={() => onLaunchExplorer({ selectedMission: mission, missionId: mission.id })} className="group w-full rounded-2xl border border-white/[0.08] bg-[#0C0D12] p-4 text-left transition-all hover:-translate-y-0.5 hover:border-white/[0.22] hover:bg-[#11131A] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50 sm:p-6" aria-label={`Open ${mission.name} in the lunar explorer`}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10.5px] font-sans font-semibold uppercase tracking-[0.12em] text-[#8E95A5] sm:text-[11px]">{mission.taskOrder} · {mission.provider}</p>
              <h2 className="mt-1.5 text-base font-display font-semibold tracking-[-0.015em] leading-tight text-white sm:text-xl">{mission.name}</h2>
            </div>
            <ArrowUpRight className="mt-0.5 h-4 w-4 shrink-0 text-[#8E95A5] transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-white" />
          </div>
          <p className="mt-3 hidden text-xs font-sans leading-relaxed text-[#8E95A5] sm:block" style={{ display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: 2, overflow: 'hidden' }}>{getTimelineDescription(mission)}</p>
          <div className="mt-3.5 grid gap-2 border-t border-white/[0.08] pt-3 text-[11px] font-sans text-[#94A3B8] sm:grid-cols-2 sm:text-xs">
            <span className="flex min-w-0 items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5 shrink-0 text-[#8E95A5]" /><span className="truncate">{mission.launchDate}</span></span>
            <span className="flex min-w-0 items-center gap-1.5"><MapPin className="h-3.5 w-3.5 shrink-0 text-[#8E95A5]" /><span className="truncate">{mission.landingSiteName}</span></span>
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-sans font-semibold uppercase tracking-wide ${status.className}`}><StatusIcon className="h-3 w-3" /> {status.label}</span>
            <span className="font-mono tabular-nums text-[10.5px] text-[#64748B]">{formatCoordinates(mission.latitude, 'N', 'S')} · {formatCoordinates(mission.longitude, 'E', 'W')}</span>
          </div>
        </button>
      </div>
      <div className="col-start-2 row-start-1 flex flex-col items-center" aria-hidden="true">
        <span className="mt-5 flex h-8 w-8 items-center justify-center rounded-full border border-white/[0.2] bg-[#0C0D12] text-[10.5px] font-mono tabular-nums font-medium text-white shadow-[0_0_0_5px_#050507] sm:h-10 sm:w-10">{String(index + 1).padStart(2, '0')}</span>
      </div>
    </li>
  );
}

export default function MissionsPage({ onLaunchExplorer, onNavigate }) {
  const catalogMissions = [...CLPS_MISSIONS, ...HISTORIC_MISSIONS].sort((a, b) => getTimelineOrder(a) - getTimelineOrder(b));
  const completedCount = catalogMissions.filter((mission) => mission.missionStatus === 'completed').length;
  return (
    <div className="flex h-full min-h-0 w-full flex-col overflow-hidden bg-[#050507] font-sans text-[#F8FAFC] selection:bg-white/20">
      <PublicPageHeader currentPage="missions" onLaunchExplorer={onLaunchExplorer} onNavigate={onNavigate} />
      <main className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-[1280px] px-5 py-10 sm:px-8 sm:py-14 lg:px-12">
          <section className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0C0D12] px-6 py-10 sm:px-10 sm:py-14">
            <div className="relative max-w-3xl">
              <span className="inline-block rounded-full border border-white/[0.12] bg-white/[0.03] px-3.5 py-1 text-[11px] font-sans font-semibold uppercase tracking-[0.14em] text-[#CBD5E1]">Mission catalog</span>
              <h1 className="mt-4 text-4xl font-display font-semibold tracking-[-0.03em] text-white sm:text-6xl">Lunar missions</h1>
              <p className="mt-4 max-w-2xl text-sm font-sans leading-relaxed text-[#8E95A5] sm:text-base">A living timeline of NASA CLPS expeditions. Choose any mission to move directly to its landing region in the lunar explorer.</p>
              <div className="mt-6 flex flex-wrap gap-3 text-xs font-sans font-medium"><span className="rounded-full border border-white/[0.12] bg-white/[0.03] px-3.5 py-1.5 text-[#E2E8F0]"><strong className="font-mono tabular-nums">{catalogMissions.length}</strong> missions cataloged</span><span className="rounded-full border border-emerald-400/20 bg-emerald-400/[0.06] px-3.5 py-1.5 text-emerald-200"><strong className="font-mono tabular-nums">{completedCount}</strong> successful landings</span></div>
            </div>
          </section>
          <div className="mt-10 flex items-center justify-center gap-2 text-center text-[11px] font-sans font-semibold uppercase tracking-[0.14em] text-[#8E95A5]"><Telescope className="h-3.5 w-3.5 text-white/70" /> Select a mission to explore its site</div>
          <ol className="relative mx-auto mt-8 max-w-6xl space-y-6 before:absolute before:bottom-0 before:left-1/2 before:top-0 before:w-px before:-translate-x-1/2 before:bg-white/[0.1]">
            {catalogMissions.map((mission, index) => <MissionEntry key={mission.id} mission={mission} index={index} onLaunchExplorer={onLaunchExplorer} />)}
          </ol>
          <div className="mx-auto mt-10 flex max-w-2xl items-center justify-center gap-2 rounded-xl border border-white/[0.08] bg-[#0C0D12] px-4 py-3 text-center text-xs font-sans text-[#8E95A5]"><Rocket className="h-4 w-4 shrink-0 text-white/70" />Every timeline card opens its mission pin, terrain, and analysis tools in the explorer.</div>
        </div>
      </main>
    </div>
  );
}