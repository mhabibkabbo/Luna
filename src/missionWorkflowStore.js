/**
 * @file missionWorkflowStore.js
 * State management for the 6-stage continuous lunar mission journey and onboarding tour.
 */

import { LANDING_SITES } from '../data/landingSites.js';
import { CLPS_MISSIONS } from '../data/clpsMissions.js';

// Default initial candidate sites
const DEFAULT_CANDIDATE_A =
  LANDING_SITES.find((s) => s.id === 'landing-artemis3-malapert') ||
  LANDING_SITES.find((s) => s.id === 'landing-artemis3-shackleton') ||
  LANDING_SITES[0];

const DEFAULT_CANDIDATE_B =
  LANDING_SITES.find((s) => s.id === 'landing-artemis3-shackleton') ||
  LANDING_SITES.find((s) => s.id === 'landing-artemis3-mouton') ||
  LANDING_SITES[1];

const DEFAULT_MISSION =
  CLPS_MISSIONS.find((m) => m.id === 'clps-im1-odysseus') ||
  CLPS_MISSIONS[0];

let state = {
  currentStage: 1, // 1: Setup, 2: Explore, 3: Evaluate, 4: DTE Comms, 5: Compare, 6: Dossier
  activeMission: DEFAULT_MISSION,
  candidateA: DEFAULT_CANDIDATE_A,
  candidateB: DEFAULT_CANDIDATE_B,
  isRailCollapsed: false,
  isDossierOpen: false,
  tourActive: false,
  tourStep: 0,
};

const listeners = new Set();

function emitChange() {
  for (const listener of listeners) {
    listener(state);
  }
}

export const missionWorkflowStore = {
  get() {
    return state;
  },

  subscribe(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },

  setStage(stage) {
    const clamped = Math.max(1, Math.min(6, stage));
    state = {
      ...state,
      currentStage: clamped,
      isDossierOpen: clamped === 6,
    };
    emitChange();
  },

  setActiveMission(mission) {
    state = { ...state, activeMission: mission };
    emitChange();
  },

  setCandidateA(site) {
    if (!site) return;
    state = { ...state, candidateA: site };
    emitChange();
  },

  setCandidateB(site) {
    if (!site) return;
    state = { ...state, candidateB: site };
    emitChange();
  },

  toggleRail() {
    state = { ...state, isRailCollapsed: !state.isRailCollapsed };
    emitChange();
  },

  setRailCollapsed(collapsed) {
    state = { ...state, isRailCollapsed: Boolean(collapsed) };
    emitChange();
  },

  openDossier() {
    state = { ...state, isDossierOpen: true, currentStage: 6 };
    emitChange();
  },

  closeDossier() {
    state = { ...state, isDossierOpen: false };
    emitChange();
  },

  startTour() {
    state = { ...state, tourActive: true, tourStep: 0, currentStage: 1 };
    emitChange();
  },

  nextTourStep() {
    if (state.tourStep >= 4) {
      missionWorkflowStore.endTour();
    } else {
      const nextStep = state.tourStep + 1;
      const stageMap = [1, 2, 3, 4, 6];
      state = {
        ...state,
        tourStep: nextStep,
        currentStage: stageMap[nextStep] || 1,
        isDossierOpen: nextStep === 4,
      };
      emitChange();
    }
  },

  prevTourStep() {
    if (state.tourStep > 0) {
      const prevStep = state.tourStep - 1;
      const stageMap = [1, 2, 3, 4, 6];
      state = {
        ...state,
        tourStep: prevStep,
        currentStage: stageMap[prevStep] || 1,
        isDossierOpen: prevStep === 4,
      };
      emitChange();
    }
  },

  endTour() {
    state = { ...state, tourActive: false, tourStep: 0 };
    try {
      localStorage.setItem('luna_tour_seen', 'true');
    } catch {
      // localStorage may fail in restricted iframes
    }
    emitChange();
  },
};
