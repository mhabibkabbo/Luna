import test from 'node:test';
import assert from 'node:assert/strict';
import {
  preloadImage,
  isImageDecoded,
  preloadAdjacentMissionImages,
  preloadEntireMissionCatalog,
} from '../src/utils/missionImageCache.js';

test('Mission Image Cache: handles empty or invalid inputs gracefully', async () => {
  const emptyRes = await preloadImage('');
  assert.equal(emptyRes, '');

  const nullRes = await preloadImage(null);
  assert.equal(nullRes, '');

  assert.equal(isImageDecoded('non-existent.webp'), false);
});

test('Mission Image Cache: mock browser environment pre-decodes and caches images', async () => {
  let decodedCalled = false;
  let cacheAddCalled = false;

  class MockImage {
    constructor() {
      this._src = '';
      this.decoding = 'auto';
    }
    set src(val) {
      this._src = val;
      setTimeout(() => {
        if (this.onload) this.onload();
      }, 5);
    }
    get src() {
      return this._src;
    }
    decode() {
      decodedCalled = true;
      return Promise.resolve();
    }
  }

  const mockCaches = {
    open: async (name) => ({
      add: async (url) => {
        cacheAddCalled = true;
      },
    }),
  };

  globalThis.Image = MockImage;
  globalThis.window = { caches: mockCaches };

  const testUrl = '/images/missions/clps-im1-odysseus.webp';
  const result = await preloadImage(testUrl, 'high');

  assert.equal(result, testUrl);
  assert.equal(isImageDecoded(testUrl), true);
  assert.equal(decodedCalled, true);
  assert.equal(cacheAddCalled, true);

  const cachedResult = await preloadImage(testUrl);
  assert.equal(cachedResult, testUrl);

  delete globalThis.Image;
  delete globalThis.window;
});

test('Mission Image Cache: preloadAdjacentMissionImages preloads without errors', () => {
  const dummyMissions = [
    { id: 'mission-1' },
    { id: 'mission-2' },
    { id: 'mission-3' },
    { id: 'mission-4' },
  ];

  assert.doesNotThrow(() => {
    preloadAdjacentMissionImages(dummyMissions, 1);
    preloadAdjacentMissionImages([], 0);
    preloadAdjacentMissionImages(null, 0);
  });
});

test('Mission Image Cache: preloadEntireMissionCatalog schedules without errors', () => {
  const dummyMissions = [
    { id: 'mission-1' },
    { id: 'mission-2' },
    { id: 'mission-3' },
  ];

  assert.doesNotThrow(() => {
    const cancel = preloadEntireMissionCatalog(dummyMissions);
    if (typeof cancel === 'function') cancel();
  });
});
