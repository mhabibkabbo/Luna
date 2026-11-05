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
        <button type="button" onClick={() => onLaunchExplorer({ selectedMission: mission, missionId: mission.id })} className="group w-full rounded-2xl border border-[#20344B] bg-[#0A1220]/95 p-4 text-left shadow-[0_12px_35px_rgba(0,0,0,0.16)] transition-all hover:-translate-y-1 hover:border-[#00D2C4]/70 hover:bg-[#0C1728] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00D2C4] sm:p-5" aria-label={`Open ${mission.name} in the lunar explorer`}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[9px] font-mono uppercase tracking-[0.18em] text-[#34D399] sm:text-[10px]">{mission.taskOrder} · {mission.provider}</p>
              <h2 className="mt-1.5 text-base font-semibold leading-tight text-[#F1F5F9] sm:text-xl">{mission.name}</h2>
            </div>
            <ArrowUpRight className="mt-0.5 h-4 w-4 shrink-0 text-[#00D2C4] transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </div>
          <p className="mt-3 hidden text-xs leading-relaxed text-[#94A3B8] sm:block" style={{ display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: 2, overflow: 'hidden' }}>{getTimelineDescription(mission)}</p>
          <div className="mt-3 grid gap-2 border-t border-[#1B3047] pt-3 text-[10px] text-[#A5B4C7] sm:grid-cols-2 sm:text-[11px]">
            <span className="flex min-w-0 items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5 shrink-0 text-[#00D2C4]" /><span className="truncate">{mission.launchDate}</span></span>
            <span className="flex min-w-0 items-center gap-1.5"><MapPin className="h-3.5 w-3.5 shrink-0 text-[#00D2C4]" /><span className="truncate">{mission.landingSiteName}</span></span>
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[9px] font-mono uppercase tracking-wide ${status.className}`}><StatusIcon className="h-3 w-3" /> {status.label}</span>
            <span className="font-mono text-[9px] text-[#64748B]">{formatCoordinates(mission.latitude, 'N', 'S')} · {formatCoordinates(mission.longitude, 'E', 'W')}</span>
          </div>
        </button>
      </div>
      <div className="col-start-2 row-start-1 flex flex-col items-center" aria-hidden="true">
        <span className="mt-5 flex h-8 w-8 items-center justify-center rounded-full border-2 border-sky-300 bg-[#111B29] text-[10px] font-mono font-bold text-sky-300 shadow-[0_0_0_5px_#060B13] sm:h-10 sm:w-10">{String(index + 1).padStart(2, '0')}</span>
      </div>
    </li>
  );
}

export default function MissionsPage({ onLaunchExplorer }) {
  const catalogMissions = [...CLPS_MISSIONS, ...HISTORIC_MISSIONS].sort((a, b) => getTimelineOrder(b) - getTimelineOrder(a));
  const completedCount = catalogMissions.filter((mission) => mission.missionStatus === 'completed').length;
  return (
    <div className="flex h-full min-h-0 w-full flex-col overflow-hidden bg-[#060B13] font-sans text-[#F1F5F9] selection:bg-[#00D2C4]/30">
      <PublicPageHeader currentPage="missions" onLaunchExplorer={onLaunchExplorer} />
      <main className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-[1280px] px-5 py-9 sm:px-8 sm:py-12 lg:px-12">
          <section className="relative overflow-hidden rounded-3xl border border-[#294056] bg-[#0A1220] px-6 py-9 sm:px-10 sm:py-12">
            <div className="absolute -right-20 -top-24 h-64 w-64 rounded-full border border-sky-300/15" /><div className="absolute -right-8 -top-12 h-40 w-40 rounded-full border border-[#00D2C4]/10" />
            <div className="relative max-w-3xl">
              <span className="text-xs font-mono font-semibold uppercase tracking-[0.24em] text-[#00D2C4]">Mission catalog</span>
              <h1 className="mt-3 text-4xl font-semibold tracking-tight text-sky-300 sm:text-6xl">Lunar missions</h1>
              <p className="mt-4 max-w-2xl text-sm leading-relaxed text-[#A5B4C7] sm:text-base">A living timeline of NASA CLPS expeditions. Choose any mission to move directly to its landing region in the lunar explorer.</p>
              <div className="mt-6 flex flex-wrap gap-3 text-[10px] font-mono uppercase tracking-wide sm:text-xs"><span className="rounded-full border border-sky-400/30 bg-sky-400/10 px-3 py-1.5 text-sky-200">{catalogMissions.length} missions cataloged</span><span className="rounded-full border border-emerald-400/25 bg-emerald-400/10 px-3 py-1.5 text-emerald-200">{completedCount} successful landings</span></div>
            </div>
          </section>
          <div className="mt-9 flex items-center justify-center gap-2 text-center text-[10px] font-mono uppercase tracking-[0.18em] text-[#64748B]"><Telescope className="h-3.5 w-3.5 text-[#00D2C4]" /> Select a mission to explore its site</div>
          <ol className="relative mx-auto mt-7 max-w-6xl space-y-5 before:absolute before:bottom-0 before:left-1/2 before:top-0 before:w-px before:-translate-x-1/2 before:bg-gradient-to-b before:from-sky-400/20 before:via-sky-400 before:to-[#00D2C4]/20">
            {catalogMissions.map((mission, index) => <MissionEntry key={mission.id} mission={mission} index={index} onLaunchExplorer={onLaunchExplorer} />)}
          </ol>
          <div className="mx-auto mt-8 flex max-w-2xl items-center justify-center gap-2 rounded-xl border border-[#1B3047] bg-[#08111E] px-4 py-3 text-center text-xs text-[#94A3B8]"><Rocket className="h-4 w-4 shrink-0 text-sky-300" />Every timeline card opens its mission pin, terrain, and analysis tools in the explorer.</div>
        </div>
      </main>
    </div>
  );
}
