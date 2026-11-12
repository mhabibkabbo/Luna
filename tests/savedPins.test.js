import test from 'node:test';
import assert from 'node:assert/strict';
import {
  savedPinsStore,
  savePin,
  removeSavedPin,
  isPinSaved,
  clearAllSavedPins,
  getPinKey,
} from '../src/utils/savedPinsStore.js';

test('Saved Pins Store & Persistence Engine', async (t) => {
  clearAllSavedPins();

  await t.test('getPinKey generates consistent unique keys', () => {
    assert.equal(getPinKey({ id: 'site-shackleton' }), 'site-shackleton');
    assert.equal(
      getPinKey({ latitude: -89.9, longitude: 0.0, body: 'moon' }),
      'moon:-89.9000:0.0000'
    );
    assert.equal(
      getPinKey({ latitude: 35.42, longitude: -116.89, body: 'earth' }),
      'earth:35.4200:-116.8900'
    );
  });

  await t.test('saves a lunar landing site pin and notifies subscriber', () => {
    const testPin = {
      id: 'crater-shackleton',
      name: 'Shackleton Crater',
      latitude: -89.9,
      longitude: 0.0,
      body: 'moon',
      elevationMeters: -2768,
      region: 'South Pole',
    };

    savePin(testPin);

    assert.equal(savedPinsStore.get().length, 1);
    assert.equal(isPinSaved(testPin), true);
    assert.equal(isPinSaved({ id: 'crater-shackleton' }), true);
    assert.equal(savedPinsStore.get()[0].name, 'Shackleton Crater');
    assert.equal(savedPinsStore.get()[0].elevationMeters, -2768);
  });

  await t.test('deduplicates duplicate save attempts for the same pin', () => {
    const duplicatePin = {
      id: 'crater-shackleton',
      name: 'Shackleton Crater (Duplicate)',
      latitude: -89.9,
      longitude: 0.0,
      body: 'moon',
    };

    savePin(duplicatePin);
    // Length must remain 1
    assert.equal(savedPinsStore.get().length, 1);
  });

  await t.test('saves custom dropped waypoint pins with coordinate key fallback', () => {
    const customPin = {
      name: 'Custom Dropped Pin',
      latitude: -85.1234,
      longitude: 45.6789,
      body: 'moon',
      isCustomPin: true,
      elevationMeters: 1420,
    };

    savePin(customPin);

    assert.equal(savedPinsStore.get().length, 2);
    assert.equal(isPinSaved(customPin), true);
  });

  await t.test('saves earth communication ground station pins', () => {
    const earthPin = {
      id: 'earth-dsn-goldstone',
      name: 'NASA Goldstone DSN',
      latitude: 35.4267,
      longitude: -116.8899,
      body: 'earth',
    };

    savePin(earthPin);

    assert.equal(savedPinsStore.get().length, 3);
    assert.equal(isPinSaved(earthPin), true);
    assert.equal(isPinSaved({ id: 'non-existent-pin' }), false);
  });

  await t.test('removes specific pin by ID or object', () => {
    removeSavedPin('crater-shackleton');

    assert.equal(savedPinsStore.get().length, 2);
    assert.equal(isPinSaved({ id: 'crater-shackleton' }), false);
  });

  await t.test('clears all saved pins', () => {
    clearAllSavedPins();

    assert.equal(savedPinsStore.get().length, 0);
    assert.equal(isPinSaved({ id: 'earth-dsn-goldstone' }), false);
  });
});
