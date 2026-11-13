import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  validateLunarCoordinates,
  evaluateComparisonLocation,
  computeMultiSiteTradeOffAnalysis,
  getMatrixCellDisplay,
  PREDEFINED_COMPARISON_SITES,
  COMPARISON_PARAMETER_DEFINITIONS,
  comparisonSelectionStore,
} from '../src/utils/comparisonEngine.js';
import { createCustomPinId } from '../src/utils/customPinId.js';

describe('Lunar Landing Site Comparison & Mission Evaluation Engine', () => {
  describe('Coordinate Validation (Section 13.7)', () => {
    it('accepts valid lunar coordinates including polar (-90°) and antimeridian (±180°)', () => {
      const southPole = validateLunarCoordinates(-90, 0);
      assert.equal(southPole.isValid, true);
      assert.equal(southPole.lat, -90);
      assert.equal(southPole.lon, 0);

      const malapert = validateLunarCoordinates('-85.9', '0.0');
      assert.equal(malapert.isValid, true);
      assert.equal(malapert.lat, -85.9);
      assert.equal(malapert.lon, 0);

      const farSide = validateLunarCoordinates(15.25, -179.95);
      assert.equal(farSide.isValid, true);
      assert.equal(farSide.lat, 15.25);
      assert.equal(farSide.lon, -179.95);
    });

    it('does not treat Earth features as members of lunar site comparison', () => {
      const previousLocations = comparisonSelectionStore.get().locations;
      const lunarLocation = {
        id: 'lunar-comparison-test',
        name: 'Lunar comparison test',
        latitude: 38.9,
        longitude: -77.0,
      };

      try {
        comparisonSelectionStore.setLocations([lunarLocation]);
        assert.equal(
          comparisonSelectionStore.isFeatureInComparison({
            id: 'earth-marker-test',
            body: 'earth',
            name: 'Earth marker test',
            latitude: lunarLocation.latitude,
            longitude: lunarLocation.longitude,
          }),
          false
        );
        assert.equal(comparisonSelectionStore.isFeatureInComparison(lunarLocation), true);
      } finally {
        comparisonSelectionStore.setLocations(previousLocations);
      }
    });

    it('creates distinct custom pin IDs for separate pins at the same coordinates', () => {
      const pinIds = [
        createCustomPinId('custom-user-pin', -85, 10),
        createCustomPinId('custom-user-pin', -85, 10),
      ];
      assert.notEqual(pinIds[0], pinIds[1]);
    });

    it('rejects out-of-range or invalid coordinates without silently clamping', () => {
      const badLatLow = validateLunarCoordinates(-92.5, 10);
      assert.equal(badLatLow.isValid, false);
      assert.equal(badLatLow.lat, null);
      assert.match(badLatLow.error, /Latitude/i);

      const badLatHigh = validateLunarCoordinates(95, 0);
      assert.equal(badLatHigh.isValid, false);

      const badLon = validateLunarCoordinates(-85, 195);
      assert.equal(badLon.isValid, false);
      assert.equal(badLon.lon, null);
      assert.match(badLon.error, /Longitude/i);

      const emptyInput = validateLunarCoordinates('', '12.3');
      assert.equal(emptyInput.isValid, false);

      const nanInput = validateLunarCoordinates('abc', '0');
      assert.equal(nanInput.isValid, false);
    });
  });

  describe('Mission Duration Configuration & Time-Dependent Integration (Section 4 & 13.4)', () => {
    const epochMs = new Date('2026-11-06T00:00:00Z').getTime();
    const shackletonSite =
      PREDEFINED_COMPARISON_SITES.find((s) => s.id === 'shackleton-rim') ||
      PREDEFINED_COMPARISON_SITES[0];

    it('recalculates time-dependent solar, communication, and thermal metrics across 7, 14, and 28 days', () => {
      const eval7 = evaluateComparisonLocation(shackletonSite, epochMs, 7);
      const eval14 = evaluateComparisonLocation(shackletonSite, epochMs, 14);
      const eval28 = evaluateComparisonLocation(shackletonSite, epochMs, 28);

      assert.equal(eval7.durationDays, 7);
      assert.equal(eval14.durationDays, 14);
      assert.equal(eval28.durationDays, 28);

      assert.equal(eval7.durationHours, 168);
      assert.equal(eval14.durationHours, 336);
      assert.equal(eval28.durationHours, 672);

      // Total hours (sunlight + darkness) must equal mission duration hours
      assert.equal(
        Math.round(eval7.solar.totalSunlightHours + eval7.solar.totalDarknessHours),
        168
      );
      assert.equal(
        Math.round(eval14.solar.totalSunlightHours + eval14.solar.totalDarknessHours),
        336
      );
      assert.equal(
        Math.round(eval28.solar.totalSunlightHours + eval28.solar.totalDarknessHours),
        672
      );

      assert.ok(eval28.communication.totalCommHours >= eval14.communication.totalCommHours);
      assert.ok(eval14.communication.totalCommHours >= eval7.communication.totalCommHours);
    });
  });

  describe('Scientific Data Integrity & Missing Data Handling (Section 5 & 13.5)', () => {
    const epochMs = new Date('2026-11-06T00:00:00Z').getTime();

    it('computes complete LOLA DEM terrain and suitability metrics for custom South Pole coordinates (80°S–90°S)', () => {
      const customPolarSite = {
        id: 'custom-polar-1',
        name: 'Custom South Pole Peak',
        latitude: -85.5,
        longitude: 31.2,
        isCustom: true,
      };

      const res = evaluateComparisonLocation(customPolarSite, epochMs, 14);

      assert.equal(res.inSouthPoleDem, true);
      assert.ok(Number.isFinite(res.terrain.elevationM), 'Elevation should be measured from LOLA DEM');
      assert.ok(Number.isFinite(res.terrain.slopeDeg), 'Slope should be derived via Horn 3x3 on LOLA DEM');
      assert.ok(Number.isFinite(res.terrain.roughnessM), 'Roughness should be derived from LOLA DEM');
      assert.equal(res.suitability.hasCompleteScoringInputs, true);
      assert.ok(Number.isFinite(res.suitability.overallSuitability));
    });

    it('reports Data Not Available and withholds overall suitability score for custom equatorial coordinates lacking local DEM slope', () => {
      const customEquatorialSite = {
        id: 'custom-eq-1',
        name: 'Custom Mare Insularum Point',
        latitude: 12.4,
        longitude: -28.7,
        isCustom: true,
      };

      const res = evaluateComparisonLocation(customEquatorialSite, epochMs, 14);

      // Terrain DEM metrics must be null (never 0 or random)
      assert.equal(res.terrain.elevationM, null);
      assert.equal(res.terrain.slopeDeg, null);
      assert.equal(res.terrain.roughnessM, null);
      assert.equal(res.suitability.terrainSuitability, null);

      // Matrix cell display must explicitly report 'Data Not Available'
      const slopeCell = getMatrixCellDisplay(res, 'slopeDeg');
      assert.equal(slopeCell.isUnavailable, true);
      assert.equal(slopeCell.text, 'Data Not Available');

      // Overall suitability must not fabricate a score or substitute 0 for missing terrain
      assert.equal(res.suitability.overallSuitability, null);
      assert.equal(res.suitability.hasCompleteScoringInputs, false);
      assert.equal(res.suitability.suitabilityLabel, 'Insufficient Data for Scoring');

      const overallCell = getMatrixCellDisplay(res, 'overallSuitability');
      assert.equal(overallCell.isUnavailable, true);
      assert.equal(overallCell.text, 'Insufficient Data for Scoring');
    });

    it('ensures every comparison parameter definition includes complete NASA/scientific provenance metadata', () => {
      assert.ok(COMPARISON_PARAMETER_DEFINITIONS.length >= 20);
      for (const param of COMPARISON_PARAMETER_DEFINITIONS) {
        assert.ok(param.id, 'Parameter must have id');
        assert.ok(param.label, 'Parameter must have label');
        assert.ok(param.provenance, `Parameter ${param.id} must have provenance`);
        assert.ok(param.provenance.datasetName, `Parameter ${param.id} must have datasetName`);
        assert.ok(param.provenance.organization, `Parameter ${param.id} must have organization`);
        assert.ok(param.provenance.method, `Parameter ${param.id} must have calculation method`);
      }
    });
  });

  describe('Multi-Site Trade-Off Analysis & Recommendation (2 to 8 Sites, Section 7)', () => {
    const epochMs = new Date('2026-11-06T00:00:00Z').getTime();

    it('evaluates up to 8 sites simultaneously and produces evidence-based trade-off analysis', () => {
      const selectedSites = PREDEFINED_COMPARISON_SITES.slice(0, 8);
      assert.equal(selectedSites.length, 8);

      const evaluations = selectedSites.map((s) =>
        evaluateComparisonLocation(s, epochMs, 14)
      );

      const tradeOff = computeMultiSiteTradeOffAnalysis(evaluations, 14);
      assert.ok(tradeOff);
      assert.equal(tradeOff.hasDefensibleWinner, true);
      assert.ok(tradeOff.bestCandidate);
      assert.ok(tradeOff.keyDifferences.length >= 3);
      assert.equal(tradeOff.siteSummaries.length, 8);
    });

    it('declares No Defensible Recommendation when all candidate sites lack required terrain data', () => {
      const customA = evaluateComparisonLocation(
        { id: 'c1', name: 'Custom North A', latitude: 24.0, longitude: 15.0, isCustom: true },
        epochMs,
        14
      );
      const customB = evaluateComparisonLocation(
        { id: 'c2', name: 'Custom North B', latitude: -12.0, longitude: -40.0, isCustom: true },
        epochMs,
        14
      );

      const tradeOff = computeMultiSiteTradeOffAnalysis([customA, customB], 14);
      assert.equal(tradeOff.hasDefensibleWinner, false);
      assert.match(tradeOff.recommendationTitle, /No Defensible Recommendation/i);
    });
  });

  describe('3D Lunar Map Compare Site Selection Store & 8-Site Limit Enforcement', () => {
    it('adds Custom Dropped Pins from the 3D Lunar Map, prevents duplicates, and blocks exceeding 8 locations', () => {
      comparisonSelectionStore.resetLocations();
      assert.equal(comparisonSelectionStore.get().locations.length, 0);

      const pinResult = comparisonSelectionStore.addLocationFromMap({
        id: 'custom-user-pin',
        name: 'Custom Dropped Pin',
        isCustomPin: true,
        latitude: -1.7662,
        longitude: -6.1277,
        body: 'moon',
      });
      assert.equal(pinResult.ok, true);
      assert.equal(pinResult.count, 1);
      assert.match(pinResult.location.name, /Custom Pin \(1\.77°S, 6\.13°W\)/);

      const dupResult = comparisonSelectionStore.addLocationFromMap({
        id: 'custom-user-pin',
        name: 'Custom Dropped Pin',
        isCustomPin: true,
        latitude: -1.7662,
        longitude: -6.1277,
        body: 'moon',
      });
      assert.equal(dupResult.ok, false);
      assert.equal(dupResult.reason, 'DUPLICATE');
      assert.equal(dupResult.count, 1);

      // Fill up to 8 locations (1 already added + 7 more = 8 total)
      for (let i = 0; i < 7; i++) {
        const res = comparisonSelectionStore.addLocationFromMap({
          id: `custom-pin-extra-${i}`,
          name: 'Custom Dropped Pin',
          isCustomPin: true,
          latitude: -85.0 - i * 0.5,
          longitude: 10.0 + i * 5.0,
          body: 'moon',
        });
        assert.equal(res.ok, true);
      }
      assert.equal(comparisonSelectionStore.get().locations.length, 8);

      // Attempt to add a 9th location -> must be blocked with LIMIT_REACHED
      const overLimitResult = comparisonSelectionStore.addLocationFromMap({
        id: 'custom-pin-9th',
        name: 'Custom Dropped Pin',
        isCustomPin: true,
        latitude: -82.3,
        longitude: 45.0,
        body: 'moon',
      });
      assert.equal(overLimitResult.ok, false);
      assert.equal(overLimitResult.reason, 'LIMIT_REACHED');
      assert.equal(overLimitResult.count, 8);
      assert.match(overLimitResult.message, /Cannot add location: Maximum limit of 8/i);

      comparisonSelectionStore.resetLocations();
      assert.equal(comparisonSelectionStore.get().locations.length, 0);
    });

    it('toggles site selection on and off via toggleLocationFromMap without exceeding 8 sites', () => {
      comparisonSelectionStore.resetLocations();
      const site = PREDEFINED_COMPARISON_SITES[0];

      const firstClick = comparisonSelectionStore.toggleLocationFromMap(site);
      assert.equal(firstClick.ok, true);
      assert.equal(firstClick.action, 'added');
      assert.equal(firstClick.count, 1);
      assert.equal(comparisonSelectionStore.isFeatureInComparison(site), true);

      const secondClick = comparisonSelectionStore.toggleLocationFromMap(site);
      assert.equal(secondClick.ok, true);
      assert.equal(secondClick.action, 'removed');
      assert.equal(secondClick.count, 0);
      assert.equal(comparisonSelectionStore.isFeatureInComparison(site), false);

      comparisonSelectionStore.resetLocations();
    });
  });
});
