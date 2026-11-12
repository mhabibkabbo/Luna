import test from "node:test";
import assert from "node:assert/strict";
import { computeEarthCelestialState } from "../src/utils/earthEphemeris.js";

test("Earth ephemeris reports plausible Sun and Moon geometry in an Earth-fixed frame", () => {
  const state = computeEarthCelestialState(Date.parse("2026-11-08T12:34:56Z"));

  assert.equal(state.date.toISOString(), "2026-11-08T12:34:00.000Z");
  assert.ok(
    state.sun.distanceKm > 147_000_000 && state.sun.distanceKm < 152_000_000,
  );
  assert.ok(state.moon.distanceKm > 350_000 && state.moon.distanceKm < 410_000);
  assert.ok(
    state.sun.angularDiameterDeg > 0.5 && state.sun.angularDiameterDeg < 0.55,
  );
  assert.ok(
    state.moon.angularDiameterDeg > 0.45 && state.moon.angularDiameterDeg < 0.6,
  );
  assert.ok(
    state.moon.illuminatedFraction >= 0 && state.moon.illuminatedFraction <= 1,
  );

  for (const body of [state.sun, state.moon]) {
    assert.ok(Math.abs(Math.hypot(...body.dir) - 1) < 1e-12);
    assert.ok(body.subLat >= -90 && body.subLat <= 90);
    assert.ok(body.subLon >= -180 && body.subLon <= 180);
  }
  assert.ok(
    state.earth.siderealTimeHours >= 0 && state.earth.siderealTimeHours < 24,
  );
});
