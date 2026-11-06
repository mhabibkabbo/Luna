import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  categorizeSolarWindSpeed,
  parseLatestPlasma,
  parseLatestMag,
  fetchSpaceWeather,
  clearSpaceWeatherCache,
  getCachedSpaceWeather,
  FALLBACK_SPACE_WEATHER,
} from '../src/services/spaceWeather.js';

test('categorizeSolarWindSpeed: assigns accurate operational classification', () => {
  assert.equal(categorizeSolarWindSpeed(320), 'Nominal / Slow');
  assert.equal(categorizeSolarWindSpeed(399.9), 'Nominal / Slow');
  assert.equal(categorizeSolarWindSpeed(400), 'Moderate');
  assert.equal(categorizeSolarWindSpeed(550), 'Moderate');
  assert.equal(categorizeSolarWindSpeed(600), 'Moderate');
  assert.equal(categorizeSolarWindSpeed(601), 'High Speed Stream');
  assert.equal(categorizeSolarWindSpeed(850), 'High Speed Stream');
  assert.equal(categorizeSolarWindSpeed(null), 'Moderate');
  assert.equal(categorizeSolarWindSpeed(NaN), 'Moderate');
});

test('parseLatestPlasma: parses modern 2D propagated tables with header row', () => {
  const table = [
    ['time_tag', 'speed', 'density', 'temperature', 'bx', 'by', 'bz', 'bt', 'vx', 'vy', 'vz'],
    ['2026-11-06T08:00:00Z', '310.2', '4.15', '75000', '1.0', '2.0', '-1.0', '4.0', '-300', '0', '0'],
    ['2026-11-06T09:00:00Z', '335.8', '2.95', '82000', '2.0', '1.0', '-2.0', '5.0', '-320', '0', '0'],
  ];
  const parsed = parseLatestPlasma(table);
  assert.ok(parsed);
  assert.equal(parsed.speed, 335.8);
  assert.equal(parsed.density, 2.95);
  assert.equal(parsed.temperature, 82000);
  assert.equal(parsed.timestamp, '2026-11-06T09:00:00Z');
});

test('parseLatestPlasma: parses legacy 2D tables without header row', () => {
  const legacyTable = [
    ['2026-11-06 08:00:00.000', '5.10', '420.4', '110000'],
  ];
  const parsed = parseLatestPlasma(legacyTable);
  assert.ok(parsed);
  assert.equal(parsed.speed, 420.4);
  assert.equal(parsed.density, 5.1);
  assert.equal(parsed.temperature, 110000);
});

test('parseLatestPlasma: parses RTSW and summary object arrays', () => {
  const rtswObjects = [
    {
      time_tag: '2026-11-05T09:30:00',
      proton_speed: 345.67,
      proton_density: 1.82,
      proton_temperature: 35000,
    },
  ];
  const parsedRtsw = parseLatestPlasma(rtswObjects);
  assert.ok(parsedRtsw);
  assert.equal(parsedRtsw.speed, 345.7);
  assert.equal(parsedRtsw.density, 1.82);
  assert.equal(parsedRtsw.temperature, 35000);

  const summary = [{ proton_speed: 400.1, time_tag: '2026-11-06T10:00:00Z' }];
  const parsedSummary = parseLatestPlasma(summary);
  assert.ok(parsedSummary);
  assert.equal(parsedSummary.speed, 400.1);
  assert.equal(parsedSummary.density, null);
});

test('parseLatestMag: parses modern 2D propagated tables and RTSW object arrays', () => {
  const table = [
    ['time_tag', 'speed', 'density', 'temperature', 'bx', 'by', 'bz', 'bt'],
    ['2026-11-06T09:00:00Z', '335.8', '2.95', '82000', '2.0', '1.0', '-3.45', '6.12'],
  ];
  const parsedTable = parseLatestMag(table);
  assert.ok(parsedTable);
  assert.equal(parsedTable.bz, -3.45);
  assert.equal(parsedTable.bt, 6.12);

  const rtswMag = [
    {
      time_tag: '2026-11-05T09:30:00',
      bz_gsm: -1.25,
      bt: 4.88,
    },
  ];
  const parsedMag = parseLatestMag(rtswMag);
  assert.ok(parsedMag);
  assert.equal(parsedMag.bz, -1.25);
  assert.equal(parsedMag.bt, 4.88);
});

test('parseLatestPlasma and parseLatestMag handle malformed or empty data gracefully', () => {
  assert.equal(parseLatestPlasma(null), null);
  assert.equal(parseLatestPlasma([]), null);
  assert.equal(parseLatestPlasma([['time_tag', 'speed'], [null, null]]), null);

  assert.equal(parseLatestMag(null), null);
  assert.equal(parseLatestMag([]), null);
  assert.equal(parseLatestMag([['time_tag', 'bz'], [null, null]]), null);
});

test('fetchSpaceWeather: retrieves live NOAA SWPC telemetry and manages cache', async () => {
  clearSpaceWeatherCache();
  assert.equal(getCachedSpaceWeather(), null);

  const data = await fetchSpaceWeather(true);
  assert.ok(data);

  // If online, live telemetry is populated
  if (!data.isUnavailable) {
    assert.equal(data.isFallback, false);
    assert.ok(typeof data.speed === 'number' && data.speed > 0);
    assert.ok(data.density === null || (typeof data.density === 'number' && data.density >= 0));
    assert.ok(typeof data.speedStatus === 'string');
    assert.ok(data.source.includes('NOAA SWPC'));

    // Second fetch should hit cache
    const cachedData = await fetchSpaceWeather(false);
    assert.equal(cachedData.cached, true);
    assert.equal(cachedData.speed, data.speed);
  } else {
    // Graceful offline fallback
    assert.equal(data.isFallback, true);
    assert.equal(data.speed, null);
  }

  clearSpaceWeatherCache();
  assert.equal(getCachedSpaceWeather(), null);
});

