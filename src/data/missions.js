export const MISSION_OUTCOME_STATUS = {
  success: {
    id: 'success',
    label: 'Success',
    shortLabel: 'Success',
    badgeClass: 'bg-emerald-950/70 border-emerald-500/40 text-emerald-300',
    pillClass: 'border-emerald-400/30 bg-emerald-400/10 text-emerald-200',
    isAnomaly: false,
  },
  partial: {
    id: 'partial',
    label: 'Partial',
    shortLabel: 'Partial',
    badgeClass: 'bg-amber-950/70 border-amber-500/40 text-amber-300',
    pillClass: 'border-amber-400/30 bg-amber-400/10 text-amber-200',
    isAnomaly: true,
  },
  failure: {
    id: 'failure',
    label: 'Failure',
    shortLabel: 'Failure',
    badgeClass: 'bg-rose-950/70 border-rose-500/40 text-rose-300',
    pillClass: 'border-rose-400/30 bg-rose-400/10 text-rose-200',
    isAnomaly: true,
  },
  planned: {
    id: 'planned',
    label: 'Planned (NET)',
    shortLabel: 'Planned',
    badgeClass: 'bg-cyan-950/70 border-cyan-500/40 text-cyan-300',
    pillClass: 'border-cyan-300/30 bg-cyan-300/10 text-cyan-100',
    isAnomaly: false,
  },
};

export function normalizeMissionOutcome(mission) {
  if (!mission) return 'planned';
  const raw = String(mission.outcome || mission.missionStatus || '').toLowerCase();
  if (raw === 'success') return 'success';
  if (raw === 'partial') return 'partial';
  if (raw === 'failure' || raw === 'failed' || raw === 'cancelled' || raw === 'canceled') {
    return 'failure';
  }
  if (raw === 'completed') return 'success';
  return 'planned';
}

export function isMissionAnomaly(mission) {
  if (!mission) return false;
  if (mission.isAnomaly === true) return true;
  const normalized = normalizeMissionOutcome(mission);
  return normalized === 'partial' || normalized === 'failure';
}

export function getMissionOutcomeMeta(mission) {
  const key = normalizeMissionOutcome(mission);
  const base = MISSION_OUTCOME_STATUS[key] || MISSION_OUTCOME_STATUS.planned;
  return {
    ...base,
    reason: mission?.outcomeReason || null,
  };
}

export const MISSION_SCHEDULES = {
  'clps-im1-odysseus': {
    missionStatus: 'partial',
    outcome: 'partial',
    outcomeReason: 'Tipped ~30° at touchdown; operated 7 days with constrained attitude and RF geometry.',
    launchDate: '2024-02-15',
    landingDate: '2024-02-22',
    isPlanningEstimate: false,
    dateStatus: 'Confirmed Historical / Published',
  },
  'clps-im2-athena': {
    missionStatus: 'partial',
    outcome: 'partial',
    outcomeReason: 'Landed on side, curtailed operations (concluded Mar 7 inside Mons Mouton crater).',
    launchDate: '2025-02-27',
    landingDate: '2025-03-06',
    isPlanningEstimate: false,
    dateStatus: 'Confirmed Historical / Published',
  },
  'clps-firefly-bgm1': {
    missionStatus: 'completed',
    outcome: 'success',
    outcomeReason: 'Upright touchdown in Mare Crisium; completed full ~14-day lunar day surface mission.',
    launchDate: '2025-01-15',
    landingDate: '2025-03-02',
    isPlanningEstimate: false,
    dateStatus: 'Confirmed Historical / Published',
  },
  'clps-peregrine-pm1': {
    missionStatus: 'failed',
    outcome: 'failure',
    outcomeReason: 'Translunar propellant tank rupture aborted lunar landing (Earth re-entry Jan 18, 2024).',
    launchDate: '2024-01-08',
    landingDate: 'None (Controlled Earth Re-entry Jan 18, 2024)',
    isPlanningEstimate: false,
    dateStatus: 'Confirmed Historical / Published',
  },
  'clps-griffin-gm1': {
    missionStatus: 'planned',
    outcome: 'planned',
    outcomeReason: 'Scheduled NET January 2027 carrying Astrolab FLIP rover to Nobile / Mons Mouton.',
    launchDate: 'Planning Estimate (NET January 2027)',
    landingDate: 'Planning Estimate (NET Q1 2027 / TBD)',
    isPlanningEstimate: true,
    dateStatus: 'Planning Estimate (NET)',
  },
  'clps-im3-vertex': {
    missionStatus: 'planned',
    outcome: 'planned',
    outcomeReason: 'Scheduled NET Q1 2027 for Reiner Gamma magnetic swirl & JPL CADRE rovers.',
    launchDate: 'Planning Estimate (NET Q1 2027)',
    landingDate: 'Planning Estimate (NET H1 2027 / TBD)',
    isPlanningEstimate: true,
    dateStatus: 'Planning Estimate (NET)',
  },
  'clps-draper-cp12': {
    missionStatus: 'failed',
    outcome: 'failure',
    outcomeReason: 'Task order mutually terminated by NASA and Draper on July 9, 2026.',
    launchDate: 'Cancelled (Former NET 2026/2027)',
    landingDate: 'Cancelled (Terminated Jul 2026)',
    isPlanningEstimate: true,
    dateStatus: 'Planning Estimate (NET)',
  },
  'clps-blueorigin-cp22': {
    missionStatus: 'planned',
    outcome: 'planned',
    outcomeReason: 'Blue Moon MK1 Endurance uncrewed pathfinder targeting Shackleton Connecting Ridge.',
    launchDate: 'Planning Estimate (NET Spring 2027)',
    landingDate: 'Planning Estimate (NET 2027 / TBD)',
    isPlanningEstimate: true,
    dateStatus: 'Planning Estimate (NET)',
  },
  'clps-firefly-bgm2': {
    missionStatus: 'planned',
    outcome: 'planned',
    outcomeReason: 'Scheduled NET Late 2027 delivering LuSEE-Night to lunar farside with Elytra relay.',
    launchDate: 'Planning Estimate (NET Late 2027)',
    landingDate: 'Planning Estimate (NET Late 2027 / TBD)',
    isPlanningEstimate: true,
    dateStatus: 'Planning Estimate (NET)',
  },
  'clps-firefly-cp21': {
    missionStatus: 'planned',
    outcome: 'planned',
    outcomeReason: 'Scheduled NET 2028 to sample silicic volcanism at Gruithuisen Domes.',
    launchDate: 'Planning Estimate (NET 2028)',
    landingDate: 'Planning Estimate (NET 2028 / TBD)',
    isPlanningEstimate: true,
    dateStatus: 'Planning Estimate (NET)',
  },
  'artemis-iii': {
    missionStatus: 'planned',
    outcome: 'planned',
    outcomeReason: 'Re-scoped to Mid-2027 Earth-orbit HLS rendezvous & docking flight test.',
    launchDate: 'Planning Estimate (NET Mid-2027 LEO Test)',
    landingDate: 'Earth-Orbit Docking Test (Surface shifted to Artemis IV)',
    isPlanningEstimate: true,
    dateStatus: 'Planning Estimate (NET)',
  },
  'artemis-iv': {
    missionStatus: 'planned',
    outcome: 'planned',
    outcomeReason: 'Targeted NET 2028 for crewed South Pole surface landing.',
    launchDate: 'Planning Estimate (NET 2028)',
    landingDate: 'Planning Estimate (NET 2028 South Pole)',
    isPlanningEstimate: true,
    dateStatus: 'Planning Estimate (NET)',
  },
};

export const DEFAULT_MISSION_EPOCH_ISO = '2027-03-15T12:00:00Z';
export const DEFAULT_MISSION_EPOCH_MS = Date.parse(DEFAULT_MISSION_EPOCH_ISO);

export const SYNCHRONIZED_MISSION_PRESETS = [
  {
    id: 'clps-q1-window',
    label: 'CLPS Q1 / Polar Window (Mar 15, 2027)',
    shortLabel: 'Mar 15, 2027 Window',
    iso: '2027-03-15T12:00:00Z',
    getMs: () => Date.parse('2027-03-15T12:00:00Z'),
  },
  {
    id: 'sp-summer-solstice',
    label: 'South Pole Summer (Dec 21, 2026)',
    shortLabel: 'Dec 21, 2026 Solstice',
    iso: '2026-12-21T12:00:00Z',
    getMs: () => Date.parse('2026-12-21T12:00:00Z'),
  },
  {
    id: 'sp-winter-solstice',
    label: 'South Pole Winter (Jun 21, 2027)',
    shortLabel: 'Jun 21, 2027 Solstice',
    iso: '2027-06-21T12:00:00Z',
    getMs: () => Date.parse('2027-06-21T12:00:00Z'),
  },
  {
    id: 'artemis-iv-window',
    label: 'Artemis IV Target Window (NET 2028)',
    shortLabel: 'Mar 15, 2028 (NET)',
    iso: '2028-03-15T12:00:00Z',
    getMs: () => Date.parse('2028-03-15T12:00:00Z'),
  },
];

export function buildMissionEpochPresets({ normalizeMs = (ms) => ms, includeShifts = false } = {}) {
  const presets = [
    ...SYNCHRONIZED_MISSION_PRESETS,
    {
      id: 'live-utc',
      label: 'Now (Live UTC)',
      shortLabel: 'Live UTC',
      iso: null,
      getMs: () => normalizeMs(Date.now()),
    },
  ];
  if (includeShifts) {
    presets.push(
      {
        id: 'shift-14d',
        label: '+14 Days (Half Lunation)',
        shortLabel: '+14d',
        iso: null,
        getMs: (base) => base + 14 * 86400000,
      },
      {
        id: 'shift-28d',
        label: '+28 Days (Full Lunation)',
        shortLabel: '+28d',
        iso: null,
        getMs: (base) => base + 28 * 86400000,
      }
    );
  }
  return presets;
}
