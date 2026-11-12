/**
 * Selects the nearest 2D landmark within `maxRadiusPx` of `pointerPt`.
 * Replaces first-match `.find()` iteration so array ordering (e.g. south-pole at index 0)
 * never overrides an exact click on another site marker.
 *
 * @template T
 * @param {{ x: number, y: number }} pointerPt
 * @param {Array<{ item: T, pt: { x: number, y: number }, priority?: number }>} entries
 * @param {number} [maxRadiusPx=14]
 * @returns {T | null}
 */
export function findNearestScreenMarker(pointerPt, entries, maxRadiusPx = 14) {
  if (!pointerPt || !Array.isArray(entries) || entries.length === 0) return null;

  let bestItem = null;
  let bestDist = maxRadiusPx;
  let bestPriority = Infinity;

  for (const entry of entries) {
    if (!entry || !entry.pt) continue;
    const dist = Math.hypot(entry.pt.x - pointerPt.x, entry.pt.y - pointerPt.y);
    if (dist > maxRadiusPx) continue;

    const prio = typeof entry.priority === 'number' ? entry.priority : 99;
    // Prefer strictly closer markers; break exact distance ties by visual marker priority
    if (dist < bestDist - 0.5 || (Math.abs(dist - bestDist) <= 0.5 && prio < bestPriority)) {
      bestDist = dist;
      bestPriority = prio;
      bestItem = entry.item;
    }
  }

  return bestItem;
}

/**
 * Resolves ambiguous overlapping Cesium `drillPick` hits (`billboard` / `label`) by scoring
 * exact pointer-to-billboard-center screen distance and ignoring distant label-only overhang.
 *
 * @param {{ x: number, y: number }} pointerPt
 * @param {Array<{ entity: any, feature: any, centerPt: { x: number, y: number } | null, hitType?: 'billboard' | 'label' | 'other', maxHitRadiusPx?: number, isSelected?: boolean }>} candidates
 * @returns {any | null} Winning entity
 */
export function selectBestPickedMarker(pointerPt, candidates) {
  if (!pointerPt || !Array.isArray(candidates) || candidates.length === 0) return null;

  let best = null;
  let bestScore = Infinity;

  for (const cand of candidates) {
    if (!cand || !cand.feature) continue;

    const hitType = cand.hitType || 'other';
    const maxRadius = typeof cand.maxHitRadiusPx === 'number' ? cand.maxHitRadiusPx : 26;

    let dist = Infinity;
    if (cand.centerPt && Number.isFinite(cand.centerPt.x) && Number.isFinite(cand.centerPt.y)) {
      dist = Math.hypot(cand.centerPt.x - pointerPt.x, cand.centerPt.y - pointerPt.y);
    }

    // Reject accidental clicks on the far edge of a neighboring label bounding box,
    // while never discarding direct WebGL billboard pixel hits.
    if (hitType === 'label' && dist > maxRadius * 1.35) {
      continue;
    }
    if (hitType !== 'billboard' && Number.isFinite(dist) && dist > maxRadius * 1.75) {
      continue;
    }

    const typePenalty = hitType === 'billboard' ? 0 : hitType === 'label' ? 12 : 8;
    const score = (Number.isFinite(dist) ? dist : maxRadius) + typePenalty;

    if (score < bestScore) {
      bestScore = score;
      best = cand.entity;
    }
  }

  return best;
}
