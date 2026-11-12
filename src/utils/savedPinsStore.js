import { useSyncExternalStore } from 'react';
import { createStore } from './pointerStore.js';
import { notifySuccess, notifyInfo } from './feedbackStore.js';

const STORAGE_KEY = 'luna_saved_pins_session_v1';

function getStorage() {
  if (typeof window === 'undefined') return null;
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

function cleanupLegacyLocalStorage() {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage?.removeItem('luna_saved_pins_v1');
  } catch {
    // Ignore storage restriction errors
  }
}

function loadInitialSavedPins() {
  cleanupLegacyLocalStorage();
  const storage = getStorage();
  if (!storage) return [];
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.warn('Failed to load saved pins from sessionStorage:', err);
    return [];
  }
}

function persistSavedPins(pins) {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(pins));
  } catch (err) {
    console.warn('Failed to persist saved pins to sessionStorage:', err);
  }
}

export const savedPinsStore = createStore(loadInitialSavedPins());

// Sync store updates to sessionStorage
savedPinsStore.subscribe((pins) => {
  persistSavedPins(pins);
});

export function useSavedPins() {
  return useSyncExternalStore(
    savedPinsStore.subscribe,
    savedPinsStore.get,
    () => []
  );
}

export function getPinKey(pin) {
  if (!pin) return '';
  if (pin.id && !String(pin.id).startsWith('probe-') && !String(pin.id).startsWith('share-')) {
    return String(pin.id);
  }
  const lat = Number(pin.latitude ?? pin.lat ?? 0).toFixed(4);
  const lon = Number(pin.longitude ?? pin.lon ?? 0).toFixed(4);
  const body = pin.body || 'moon';
  return `${body}:${lat}:${lon}`;
}

export function isPinSaved(pin) {
  if (!pin) return false;
  const key = getPinKey(pin);
  const current = savedPinsStore.get();
  return current.some((p) => p._key === key || (pin.id && p.id === pin.id));
}

export function savePin(feature) {
  if (!feature) return;
  const key = getPinKey(feature);
  const current = savedPinsStore.get();
  if (current.some((p) => p._key === key || (feature.id && p.id === feature.id))) {
    return;
  }

  const lat = Number(feature.latitude ?? feature.lat ?? 0);
  const lon = Number(feature.longitude ?? feature.lon ?? 0);
  const body = feature.body === 'earth' ? 'earth' : 'moon';
  const name =
    feature.name ||
    feature.siteName ||
    (feature.isCustomPin ? 'Custom Waypoint' : 'Lunar Location');

  const newPin = {
    _key: key,
    id: feature.id || key,
    name,
    latitude: lat,
    longitude: lon,
    lat,
    lon,
    body,
    type: feature.type || (feature.isCustomPin ? 'custom_pin' : 'location'),
    isCustomPin: Boolean(feature.isCustomPin),
    elevationMeters: feature.elevationMeters ?? feature.elevationM ?? null,
    region: feature.region || '',
    savedAt: Date.now(),
  };

  const next = [newPin, ...current];
  savedPinsStore.set(next);
  notifySuccess('Pin Saved', `Added "${name}" to saved pins.`);
}

export function removeSavedPin(pinOrId) {
  const current = savedPinsStore.get();
  let removedName = '';
  let next;
  if (typeof pinOrId === 'string') {
    const target = current.find((p) => p.id === pinOrId || p._key === pinOrId);
    if (target) removedName = target.name;
    next = current.filter((p) => p.id !== pinOrId && p._key !== pinOrId);
  } else {
    const key = getPinKey(pinOrId);
    const target = current.find((p) => p._key === key || (pinOrId.id && p.id === pinOrId.id));
    if (target) removedName = target.name;
    next = current.filter((p) => p._key !== key && (!pinOrId.id || p.id !== pinOrId.id));
  }
  savedPinsStore.set(next);
  notifyInfo('Pin Removed', removedName ? `Removed "${removedName}" from saved pins.` : 'Location removed from saved pins.');
}

export function clearAllSavedPins() {
  savedPinsStore.set([]);
  notifyInfo('Saved Pins Cleared', 'All saved locations were removed.');
}
