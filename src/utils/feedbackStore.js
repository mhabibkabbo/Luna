/**
 * @file feedbackStore.js
 * Lightweight pub/sub store for user feedback notifications (toasts / guidance alerts).
 */

import { createStore } from './pointerStore.js';

let nextId = 1;

/**
 * @typedef {{
 *   id: string,
 *   type: 'info' | 'success' | 'warn' | 'navigation',
 *   title: string,
 *   description?: string,
 *   durationMs?: number,
 *   timestamp: number,
 *   action?: { label: string, onClick: () => void },
 * }} FeedbackItem
 */

export const feedbackStore = createStore(/** @type {FeedbackItem[]} */ ([]));

/**
 * Dispatches a feedback notification to the user.
 * @param {Omit<FeedbackItem, 'id' | 'timestamp'>} item
 * @returns {string} The notification ID
 */
export function notify({
  type = 'info',
  title,
  description,
  durationMs = 4000,
  action,
}) {
  const id = `toast-${nextId++}-${Date.now()}`;
  const newItem = {
    id,
    type,
    title,
    description,
    durationMs,
    timestamp: Date.now(),
    action,
  };

  // Keep at most 1 notification on screen, newest replaces previous
  feedbackStore.set([newItem]);

  if (durationMs > 0) {
    setTimeout(() => {
      dismissNotification(id);
    }, durationMs);
  }

  return id;
}

/**
 * Dismiss a specific notification by ID.
 * @param {string} id
 */
export function dismissNotification(id) {
  const current = feedbackStore.get();
  if (current.some((item) => item.id === id)) {
    feedbackStore.set(current.filter((item) => item.id !== id));
  }
}

/**
 * Clear all notifications.
 * @internal Test & store cleanup utility.
 */
export function clearAllNotifications() {
  feedbackStore.set([]);
}

/**
 * Resets/clears feedback notifications. Alias for clearAllNotifications.
 * @internal Test & feedback reset utility export.
 */
export function clearFeedback() {
  clearAllNotifications();
}


/**
 * Helper shortcuts for common feedback events
 */
export const notifySuccess = (title, description, durationMs = 3500) =>
  notify({ type: 'success', title, description, durationMs });

export const notifyInfo = (title, description, durationMs = 3500) =>
  notify({ type: 'info', title, description, durationMs });

export const notifyWarn = (title, description, durationMs = 4500) =>
  notify({ type: 'warn', title, description, durationMs });

export const notifyNavigation = (title, description, durationMs = 3000) =>
  notify({ type: 'navigation', title, description, durationMs });
