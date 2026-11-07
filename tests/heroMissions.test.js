import test from 'node:test';
import assert from 'node:assert/strict';
import { HERO_ORBITAL_MISSIONS } from '../src/data/heroMissions.js';
import { CLPS_MISSIONS } from '../src/data/clpsMissions.js';

test('Hero Orbital Missions Canonical ID & Coordinate Integrity', async (t) => {
  await t.test('contains exactly 5 orbital hero missions with verified canonical IDs', () => {
    assert.equal(HERO_ORBITAL_MISSIONS.length, 5);

    const ids = HERO_ORBITAL_MISSIONS.map((m) => m.id);
    assert.deepEqual(ids, [
      'clps-im1-odysseus',
      'clps-firefly-bgm1',
      'clps-im2-athena',
      'apollo-11',
      'clps-griffin-gm1',
    ]);

    // Ensure stale/non-canonical IDs are eradicated
    assert.ok(!ids.includes('clps-firefly-blueghost1'));
    assert.ok(!ids.includes('clps-im2-prime1'));
    assert.ok(!ids.includes('clps-astrobotic-griffin1'));
  });

  await t.test('CLPS missions in HERO_ORBITAL_MISSIONS resolve against CLPS_MISSIONS catalog', () => {
    for (const heroMission of HERO_ORBITAL_MISSIONS) {
      if (heroMission.isApollo) continue;

      const matched = CLPS_MISSIONS.find((m) => m.id === heroMission.id);
      assert.ok(
        matched,
        `Mission ID ${heroMission.id} must exist in authoritative CLPS_MISSIONS dataset`
      );

      // Verify coordinate synchronization
      assert.equal(
        heroMission.lat,
        matched.latitude,
        `Latitude for ${heroMission.id} must match CLPS_MISSIONS`
      );
      assert.equal(
        heroMission.lon,
        matched.longitude,
        `Longitude for ${heroMission.id} must match CLPS_MISSIONS`
      );
    }
  });

  await t.test('IM-2 Athena coordinates match Mons Mouton landing site, not Shackleton', () => {
    const im2 = HERO_ORBITAL_MISSIONS.find((m) => m.id === 'clps-im2-athena');
    assert.ok(im2);
    assert.equal(im2.lat, -84.7906);
    assert.equal(im2.lon, 29.1958);
  });
});
