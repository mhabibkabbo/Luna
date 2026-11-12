import { createStore } from '../utils/pointerStore.js';
import { GUIDE_VERSION, GUIDE_STEPS_BY_VIEW } from './guideSteps.js';

const STORAGE_KEY = 'luna_guide_seen';

/**
 * Storage schema:
 * {
 *   seenVersion: number,
 *   completed: string[], // ids of completed steps
 *   dismissedViews: string[], // views that the user dismissed or completed
 * }
 */
export function getGuideProgress() {
  if (typeof window === 'undefined' || !window.localStorage) {
    return { seenVersion: 0, completed: [], dismissedViews: [] };
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { seenVersion: 0, completed: [], dismissedViews: [] };
    const parsed = JSON.parse(raw);
    return {
      seenVersion: typeof parsed.seenVersion === 'number' ? parsed.seenVersion : 0,
      completed: Array.isArray(parsed.completed) ? parsed.completed : [],
      dismissedViews: Array.isArray(parsed.dismissedViews) ? parsed.dismissedViews : [],
    };
  } catch {
    return { seenVersion: 0, completed: [], dismissedViews: [] };
  }
}

export function saveGuideProgress(progress) {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  } catch (err) {
    console.error('Failed to save guide progress:', err);
  }
}

const initialProgress = getGuideProgress();

export const guideStore = createStore({
  isActive: false,
  isPromptOpen: false, // first-visit prompt "Take the tour / Skip"
  activeView: 'explorer',
  activeStepIndex: 0,
  steps: [],
  mode: 'full', // 'full' | 'whats-new'
  seenVersion: initialProgress.seenVersion,
  completed: initialProgress.completed,
  dismissedViews: initialProgress.dismissedViews,
});

export function getNewStepsForView(view) {
  const progress = getGuideProgress();
  const allViewSteps = GUIDE_STEPS_BY_VIEW[view] || [];
  return allViewSteps.filter(
    (s) => s.since > progress.seenVersion && !progress.completed.includes(s.id)
  );
}

/**
 * Check if the user has never seen any guide for this view or at all.
 */
export function isFirstVisit(view = 'explorer') {
  if (typeof window === 'undefined' || !window.localStorage) return false;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return true;
  const progress = getGuideProgress();
  if (progress.dismissedViews?.includes(view)) return false;
  return progress.seenVersion === 0 && progress.completed.length === 0;
}

/**
 * Start the tour for a specific view.
 * @param {string} view - The view name (default: 'explorer')
 * @param {Object} options - { mode: 'full' | 'whats-new', filterSteps: Array }
 */
export function startGuide(view = 'explorer', options = {}) {
  const allSteps = GUIDE_STEPS_BY_VIEW[view] || [];
  const steps = options.filterSteps || (options.mode === 'whats-new' ? getNewStepsForView(view) : allSteps);

  if (!steps.length) return;

  guideStore.set({
    ...guideStore.get(),
    isActive: true,
    isPromptOpen: false,
    activeView: view,
    activeStepIndex: 0,
    steps,
    mode: options.mode || 'full',
  });
}

export function showFirstVisitPrompt(view = 'explorer') {
  guideStore.set({
    ...guideStore.get(),
    isPromptOpen: true,
    activeView: view,
  });
}

export function dismissPrompt(view = 'explorer') {
  const current = guideStore.get();
  const nextDismissed = Array.from(new Set([...current.dismissedViews, view]));
  const progress = {
    seenVersion: GUIDE_VERSION,
    completed: current.completed,
    dismissedViews: nextDismissed,
  };
  saveGuideProgress(progress);

  guideStore.set({
    ...current,
    isPromptOpen: false,
    isActive: false,
    seenVersion: GUIDE_VERSION,
    dismissedViews: nextDismissed,
  });
}

export function nextGuideStep() {
  const state = guideStore.get();
  const currentStep = state.steps[state.activeStepIndex];
  const nextCompleted = currentStep
    ? Array.from(new Set([...state.completed, currentStep.id]))
    : state.completed;

  if (state.activeStepIndex < state.steps.length - 1) {
    guideStore.set({
      ...state,
      activeStepIndex: state.activeStepIndex + 1,
      completed: nextCompleted,
    });
  } else {
    finishGuide(nextCompleted);
  }
}

export function prevGuideStep() {
  const state = guideStore.get();
  if (state.activeStepIndex > 0) {
    guideStore.set({
      ...state,
      activeStepIndex: state.activeStepIndex - 1,
    });
  }
}

export function skipGuide() {
  const state = guideStore.get();
  finishGuide(state.completed);
}

export function finishGuide(completedList) {
  const state = guideStore.get();
  const completed = completedList || state.completed;
  const nextDismissed = Array.from(new Set([...state.dismissedViews, state.activeView]));
  const progress = {
    seenVersion: GUIDE_VERSION,
    completed,
    dismissedViews: nextDismissed,
  };
  saveGuideProgress(progress);

  guideStore.set({
    ...state,
    isActive: false,
    isPromptOpen: false,
    seenVersion: GUIDE_VERSION,
    completed,
    dismissedViews: nextDismissed,
  });
}

export function replayGuide(view = 'explorer') {
  const steps = GUIDE_STEPS_BY_VIEW[view] || [];
  if (!steps.length) return;

  guideStore.set({
    ...guideStore.get(),
    isActive: true,
    isPromptOpen: false,
    activeView: view,
    activeStepIndex: 0,
    steps,
    mode: 'full',
  });
}
