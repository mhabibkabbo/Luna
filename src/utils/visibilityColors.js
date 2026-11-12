export const SUNLIGHT_TIMELINE_COLORS = {
  sunlit: "#19cc16",
  blocked: "#fa5215",
  night: "#475569",
  pending: "#1e293b",
  playhead: "#f8fafc",
};

export const COMMUNICATION_TIMELINE_COLORS = {
  clear: "#1dffac",
  doubtful: "#facc15",
  blocked: "#f43f5e",
  away: "#f43f5e",
  pending: "#1e293b",
};

/**
 * Maps a continuous or percentage visibility score (0 to 1 or 0 to 100) to a timeline hex color.
 * @internal Test & timeline rendering utility.
 * @param {number} score - Visibility score (0-1 or 0-100)
 * @returns {string} Hex color code
 */
export function visibilityScoreToHex(score) {
  if (typeof score !== 'number' || Number.isNaN(score)) {
    return COMMUNICATION_TIMELINE_COLORS.pending;
  }
  const normalized = score > 1 ? score / 100 : score;
  if (normalized >= 0.8) {
    return COMMUNICATION_TIMELINE_COLORS.clear;
  }
  if (normalized >= 0.4) {
    return COMMUNICATION_TIMELINE_COLORS.doubtful;
  }
  return COMMUNICATION_TIMELINE_COLORS.blocked;
}

