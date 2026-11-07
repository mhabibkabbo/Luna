import test from 'node:test';
import assert from 'node:assert/strict';
import { CLPS_MISSIONS } from '../src/data/clpsMissions.js';
import { LANDING_SITES } from '../src/data/landingSites.js';
import { EARTH_COMMUNICATION_SITES, STATION_ELEVATION_STATUS, getStationElevation } from '../src/data/earthCommunicationSites.js';

test('Source Verification: Unverifiable Dates & Planning Estimates', async (t) => {
  await t.test('Future CLPS missions mark launch/landing dates as Planning Estimates (NET)', () => {
    const futureMissions = [
      'clps-griffin-gm1',
      'clps-blueorigin-cp22',
      'clps-firefly-bgm2',
      'clps-draper-cp12',
      'clps-im3-vertex',
      'clps-firefly-cp21',
    ];

    futureMissions.forEach((id) => {
      const mission = CLPS_MISSIONS.find((m) => m.id === id);
      assert.ok(mission, `Mission ${id} must exist in CLPS_MISSIONS`);
      assert.equal(
        mission.isPlanningEstimate,
        true,
        `${id} must have isPlanningEstimate === true`
      );
      assert.equal(
        mission.dateStatus,
        'Planning Estimate (NET)',
        `${id} must have dateStatus === "Planning Estimate (NET)"`
      );
      assert.match(
        mission.launchDate,
        /Planning Estimate|NET/i,
        `${id} launchDate must explicitly indicate Planning Estimate or NET`
      );
    });
  });

  await t.test('Completed CLPS missions retain confirmed historical dates', () => {
    const historicalMissions = [
      'clps-im1-odysseus',
      'clps-im2-athena',
      'clps-firefly-bgm1',
      'clps-peregrine-pm1',
    ];

    historicalMissions.forEach((id) => {
      const mission = CLPS_MISSIONS.find((m) => m.id === id);
      assert.ok(mission, `Mission ${id} must exist in CLPS_MISSIONS`);
      assert.equal(
        mission.isPlanningEstimate,
        false,
        `${id} historical mission must not be flagged as planning estimate`
      );
      assert.equal(
        mission.dateStatus,
        'Confirmed Historical / Published',
        `${id} dateStatus must be "Confirmed Historical / Published"`
      );
    });
  });

  await t.test('Artemis III candidate landing sites designate dates as Planning Estimates', () => {
    const artemisCandidateIds = [
      'landing-artemis3-malapert',
      'landing-artemis3-shackleton',
      'landing-artemis3-faustini-rim-a',
      'landing-artemis3-nobile-rim-2',
      'landing-artemis3-amundsen-rim',
      'landing-artemis3-de-gerlache-rim-2',
      'landing-artemis3-connecting-ridge',
    ];

    artemisCandidateIds.forEach((id) => {
      const site = LANDING_SITES.find((s) => s.id === id);
      assert.ok(site, `Artemis candidate site ${id} must exist`);
      assert.equal(site.isPlanningEstimate, true, `${id} must have isPlanningEstimate === true`);
      assert.equal(site.dateStatus, 'Planning Estimate (NET)', `${id} must have dateStatus === "Planning Estimate (NET)"`);
      assert.match(site.date, /Planning Estimate|NET|Candidate/i, `${id} date must indicate Planning Estimate / NET`);
    });
  });

  await t.test('Earth communication sites report station elevationM as Unable to Verify / Data Not Available', () => {
    assert.equal(STATION_ELEVATION_STATUS, 'Unable to Verify / Data Not Available');
    assert.ok(EARTH_COMMUNICATION_SITES.length > 0);

    EARTH_COMMUNICATION_SITES.forEach((station) => {
      assert.equal(
        station.elevationM,
        null,
        `${station.name} elevationM must be null (Data Not Available)`
      );
      assert.equal(
        station.elevationStatus,
        'Unable to Verify / Data Not Available',
        `${station.name} elevationStatus must be "Unable to Verify / Data Not Available"`
      );

      const info = getStationElevation(station);
      assert.equal(info.elevationM, null);
      assert.equal(info.status, 'Unable to Verify / Data Not Available');
    });
  });
});
