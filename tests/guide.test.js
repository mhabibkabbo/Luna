/**
 * @file guide.test.js
 * Comprehensive unit test suite for the spotlight coachmark guide system:
 * - Versioning, steps schema, and step count
 * - Store actions: start, next, prev, skip, finish, replay
 * - Incremental 'What's new' step filtering
 * - First-visit determination and localStorage persistence
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { GUIDE_VERSION, GUIDE_STEPS, GUIDE_STEPS_BY_VIEW } from '../src/guide/guideSteps.js';
import {
  guideStore,
  getGuideProgress,
  saveGuideProgress,
  isFirstVisit,
  getNewStepsForView,
  startGuide,
  nextGuideStep,
  prevGuideStep,
  skipGuide,
  finishGuide,
  replayGuide,
} from '../src/guide/guideStore.js';

// Setup mock window and localStorage for Node test runner
const storageMap = new Map();
globalThis.window = {
  localStorage: {
    getItem: (key) => storageMap.get(key) || null,
    setItem: (key, val) => storageMap.set(key, String(val)),
    removeItem: (key) => storageMap.delete(key),
    clear: () => storageMap.clear(),
  },
};

test('Guide Steps Configuration & Schema', () => {
  assert.ok(GUIDE_VERSION >= 1, 'GUIDE_VERSION should be a positive number');
  assert.ok(Array.isArray(GUIDE_STEPS), 'GUIDE_STEPS should be an array');
  assert.ok(GUIDE_STEPS.length >= 8, 'Should include at least the 8 suggested explorer steps');

  // Validate explorer steps
  const explorerSteps = GUIDE_STEPS_BY_VIEW.explorer;
  assert.ok(explorerSteps && explorerSteps.length >= 8, 'Explorer should have 8 steps');

  const expectedIds = [
    'toolbar',
    'search',
    'view-mode',
    'layers',
    'click-drop-pin',
    'feature-panel',
    'timeline',
    'workspace-switcher',
  ];

  expectedIds.forEach((id) => {
    const found = explorerSteps.find((s) => s.id === id);
    assert.ok(found, `Expected explorer step '${id}' to exist in GUIDE_STEPS`);
    assert.equal(typeof found.title, 'string');
    assert.equal(typeof found.body, 'string');
    assert.ok(found.since >= 1);
  });
});

test('Guide Store: First-visit detection and persistence', () => {
  storageMap.clear();

  // Fresh user: first visit
  assert.equal(isFirstVisit('explorer'), true);

  // Start guide
  startGuide('explorer');
  assert.equal(guideStore.get().isActive, true);
  assert.equal(guideStore.get().activeStepIndex, 0);

  // Next step
  nextGuideStep();
  assert.equal(guideStore.get().activeStepIndex, 1);

  // Prev step
  prevGuideStep();
  assert.equal(guideStore.get().activeStepIndex, 0);

  // Finish guide
  finishGuide(['toolbar', 'search']);
  assert.equal(guideStore.get().isActive, false);

  // Stored progress check
  const saved = getGuideProgress();
  assert.equal(saved.seenVersion, GUIDE_VERSION);
  assert.ok(saved.dismissedViews.includes('explorer'));

  // User is no longer first visit
  assert.equal(isFirstVisit('explorer'), false);
});

test('Guide Store: Replay guide resets index to 0', () => {
  replayGuide('explorer');
  const state = guideStore.get();
  assert.equal(state.isActive, true);
  assert.equal(state.activeStepIndex, 0);
  assert.equal(state.activeView, 'explorer');
  skipGuide();
  assert.equal(guideStore.get().isActive, false);
});

test("Guide Store: Incremental 'What's New' step computation", () => {
  // If user saw version 0, all steps since 1 are new
  storageMap.clear();
  saveGuideProgress({ seenVersion: 0, completed: [], dismissedViews: ['explorer'] });
  const newSteps = getNewStepsForView('explorer');
  assert.equal(newSteps.length, GUIDE_STEPS_BY_VIEW.explorer.length);

  // If user saw current GUIDE_VERSION, 0 steps are new
  saveGuideProgress({ seenVersion: GUIDE_VERSION, completed: ['toolbar'], dismissedViews: ['explorer'] });
  const afterVersionBump = getNewStepsForView('explorer');
  assert.equal(afterVersionBump.length, 0);
});
