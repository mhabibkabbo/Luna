import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import { formatMissionDate } from '../src/utils/celestialTime.js';
import { formatMissionDate as formatMissionDateFromTransition, formatDuration } from '../src/utils/transitionTimes.js';
import { visibilityScoreToHex, COMMUNICATION_TIMELINE_COLORS } from '../src/utils/visibilityColors.js';
import { computeLinkMarginDelta, communicationStatus } from '../src/utils/communication.js';
import { computeLinkMarginDelta as computeLinkMarginDeltaAnalysis } from '../src/utils/communicationAnalysis.js';
import { feedbackStore, notify, clearFeedback, clearAllNotifications } from '../src/utils/feedbackStore.js';
import { pointerStore, resetPointerStore } from '../src/utils/pointerStore.js';
import { normalizeLongitude, clampLatitude, calculateLunarDistance } from '../src/utils/coordinates.js';
import {
  MOON_MEAN_RADIUS_KM,
  MOON_MEAN_RADIUS_M,
  calculateLunarDistanceKm,
  calculateLunarPolygonAreaKm2,
} from '../src/utils/distance.js';
import { earthSlewRates } from '../src/utils/earthLink.js';

describe('Codebase Audit (Unused / Internal Exports)', () => {
  describe('1. formatMissionDate', () => {
    it('formats UTC epoch timestamps into standardized mission date strings', () => {
      // 2026-03-15T12:00:00.000Z
      const epochMs = Date.UTC(2026, 2, 15, 12, 0, 0);
      assert.strictEqual(formatMissionDate(epochMs), '2026-03-15 12:00 UTC');
      assert.strictEqual(formatMissionDateFromTransition(epochMs), '2026-03-15 12:00 UTC');
    });

    it('formats Date instances and ISO strings', () => {
      const d = new Date(Date.UTC(2027, 6, 20, 8, 30, 0));
      assert.strictEqual(formatMissionDate(d), '2027-07-20 08:30 UTC');
      assert.strictEqual(formatMissionDate('2028-01-01T00:00:00Z'), '2028-01-01 00:00 UTC');
    });

    it('handles invalid dates gracefully', () => {
      assert.strictEqual(formatMissionDate(NaN), 'Invalid Date');
      assert.strictEqual(formatMissionDate('not-a-date'), 'Invalid Date');
    });
  });

  describe('2. visibilityScoreToHex', () => {
    it('maps continuous scores (0-1) to timeline hex colors', () => {
      assert.strictEqual(visibilityScoreToHex(1.0), COMMUNICATION_TIMELINE_COLORS.clear); // #1dffac
      assert.strictEqual(visibilityScoreToHex(0.85), COMMUNICATION_TIMELINE_COLORS.clear);
      assert.strictEqual(visibilityScoreToHex(0.65), COMMUNICATION_TIMELINE_COLORS.doubtful); // #facc15
      assert.strictEqual(visibilityScoreToHex(0.40), COMMUNICATION_TIMELINE_COLORS.doubtful);
      assert.strictEqual(visibilityScoreToHex(0.20), COMMUNICATION_TIMELINE_COLORS.blocked); // #f43f5e
      assert.strictEqual(visibilityScoreToHex(0.0), COMMUNICATION_TIMELINE_COLORS.blocked);
    });

    it('maps percentage scores (0-100) to timeline hex colors', () => {
      assert.strictEqual(visibilityScoreToHex(95), COMMUNICATION_TIMELINE_COLORS.clear);
      assert.strictEqual(visibilityScoreToHex(50), COMMUNICATION_TIMELINE_COLORS.doubtful);
      assert.strictEqual(visibilityScoreToHex(15), COMMUNICATION_TIMELINE_COLORS.blocked);
    });

    it('falls back to pending color on invalid or non-numeric input', () => {
      assert.strictEqual(visibilityScoreToHex(NaN), COMMUNICATION_TIMELINE_COLORS.pending);
      assert.strictEqual(visibilityScoreToHex(null), COMMUNICATION_TIMELINE_COLORS.pending);
      assert.strictEqual(visibilityScoreToHex('100'), COMMUNICATION_TIMELINE_COLORS.pending);
    });
  });

  describe('3. computeLinkMarginDelta', () => {
    it('computes delta relative to default 3.0 threshold', () => {
      assert.strictEqual(computeLinkMarginDelta(5.5), 2.5);
      assert.strictEqual(computeLinkMarginDelta(3.0), 0);
      assert.strictEqual(computeLinkMarginDelta(1.2), -1.8);
      assert.strictEqual(computeLinkMarginDeltaAnalysis(5.5), 2.5);
    });

    it('supports custom margin threshold requirements', () => {
      assert.strictEqual(computeLinkMarginDelta(6.0, 5.0), 1.0);
      assert.strictEqual(computeLinkMarginDelta(4.0, 5.0), -1.0);
    });

    it('handles NaN/invalid current margin by returning negative threshold', () => {
      assert.strictEqual(computeLinkMarginDelta(NaN, 3.0), -3.0);
      assert.strictEqual(computeLinkMarginDelta(undefined, 4.0), -4.0);
    });
  });

  describe('4. clearFeedback', () => {
    beforeEach(() => {
      clearAllNotifications();
    });

    it('clears active feedback notifications from feedbackStore', () => {
      notify({
        type: 'info',
        title: 'Mission Alert',
        description: 'Test notification',
        durationMs: 0,
      });
      assert.strictEqual(feedbackStore.get().length, 1);

      clearFeedback();
      assert.strictEqual(feedbackStore.get().length, 0);
    });

    it('clearAllNotifications also empties the store', () => {
      notify({
        type: 'success',
        title: 'Telemetry OK',
        durationMs: 0,
      });
      assert.strictEqual(feedbackStore.get().length, 1);

      clearAllNotifications();
      assert.strictEqual(feedbackStore.get().length, 0);
    });
  });

  describe('5. resetPointerStore', () => {
    it('resets pointerStore coordinates back to origin (0, 0)', () => {
      pointerStore.set({ lon: 45.2, lat: -89.5 });
      assert.deepStrictEqual(pointerStore.get(), { lon: 45.2, lat: -89.5 });

      resetPointerStore();
      assert.deepStrictEqual(pointerStore.get(), { lon: 0, lat: 0 });
    });
  });

  describe('6. Coordinate and Distance Internal Utilities', () => {
    it('normalizeLongitude wraps angles to [-180, 180]', () => {
      assert.strictEqual(normalizeLongitude(190), -170);
      assert.strictEqual(normalizeLongitude(-200), 160);
      assert.strictEqual(normalizeLongitude(0), 0);
    });

    it('clampLatitude limits latitude to [-90, 90]', () => {
      assert.strictEqual(clampLatitude(95), 90);
      assert.strictEqual(clampLatitude(-110), -90);
      assert.strictEqual(clampLatitude(-89.9), -89.9);
    });

    it('calculateLunarDistance calculates spherical arc distance', () => {
      const d = calculateLunarDistance(0, 0, 90, 0);
      // Quarter of Moon circumference = (PI/2) * 1737.4 km ≈ 2729.1 km
      assert.ok(Math.abs(d - 2729.1) < 1.0);
    });

    it('calculateLunarDistanceKm calculates Haversine distance with lunar radius', () => {
      assert.strictEqual(MOON_MEAN_RADIUS_KM, 1737.4);
      assert.strictEqual(MOON_MEAN_RADIUS_M, 1737400);

      const dKm = calculateLunarDistanceKm([0, 0], [90, 0]);
      assert.ok(Math.abs(dKm - 2729.1) < 1.0);
    });

    it('calculateLunarPolygonAreaKm2 calculates spherical area on Moon', () => {
      // Closed loop polygon: (0,0) -> (90,0) -> (0,90) -> (0,0)
      const triangle = [
        [0, 0],
        [90, 0],
        [0, 90],
        [0, 0],
      ];
      const area = calculateLunarPolygonAreaKm2(triangle);
      assert.ok(area > 0);
      assert.ok(Number.isFinite(area));
    });
  });

  describe('7. Communication & Earth Link Internal Utilities', () => {
    it('communicationStatus returns status string', () => {
      const res = communicationStatus({
        moonFeature: { latitude: 0, longitude: 0, elevationM: 0 },
        earthFeature: { latitude: 0, longitude: 0, height: 0 },
        when: Date.UTC(2026, 6, 1, 12, 0),
      });
      assert.ok(['clear', 'blocked'].includes(res));
    });

    it('earthSlewRates calculates azimuth and elevation slew rates in deg/hour', () => {
      const rates = earthSlewRates(
        { latitude: -89.9, longitude: 0, elevationM: 0 },
        Date.UTC(2026, 6, 1, 12, 0)
      );
      assert.strictEqual(Number.isFinite(rates.azimuthDegPerHour), true);
      assert.strictEqual(Number.isFinite(rates.elevationDegPerHour), true);
      assert.ok(rates.azimuthDegPerHour >= 0);
    });

    it('formatDuration formats milliseconds into human-readable strings', () => {
      assert.strictEqual(formatDuration(0), 'Now');
      assert.strictEqual(formatDuration(45 * 60 * 1000), '45m');
      assert.strictEqual(formatDuration((3 * 60 + 25) * 60 * 1000), '3h 25m');
      assert.strictEqual(formatDuration((2 * 24 * 60 + 5 * 60 + 10) * 60 * 1000), '2d 5h 10m');
    });
  });
});
