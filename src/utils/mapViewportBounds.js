/**
 * Pure mathematical functions for Lunar South Pole 2D Topographic Map (IAU2015:30135)
 * viewport containment, zoom limits, pan boundary calculation, and drag clamping.
 */

export const LUNAR_RADIUS_M = 1737400;
export const HALF_EXTENT_M = 304000;
export const SP_RESOLUTIONS = [1280, 640, 320, 160, 80, 40, 20];

/**
 * Returns the resolution in meters/pixel for a given zoom level (0..6),
 * supporting both integer and fractional zoom levels.
 *
 * @param {number} zoom
 * @returns {number} Meters per pixel
 */
export function getResolutionForZoom(zoom) {
  const z = Number.isFinite(zoom) ? Math.max(0, Math.min(SP_RESOLUTIONS.length - 1, zoom)) : 1;
  const zFloor = Math.floor(z);
  const zCeil = Math.min(SP_RESOLUTIONS.length - 1, Math.ceil(z));
  if (zFloor === zCeil) {
    return SP_RESOLUTIONS[zFloor];
  }
  const frac = z - zFloor;
  const scaleFloor = 1 / SP_RESOLUTIONS[zFloor];
  const scaleCeil = 1 / SP_RESOLUTIONS[zCeil];
  const scale = scaleFloor * Math.pow(scaleCeil / scaleFloor, frac);
  return 1 / scale;
}

/**
 * Returns the Leaflet CRS scale (pixels per meter) for a given zoom level.
 *
 * @param {number} zoom
 * @returns {number} Pixels per meter
 */
export function getScaleForZoom(zoom) {
  return 1 / getResolutionForZoom(zoom);
}

/**
 * Computes sensible minimum, maximum, and optimal initial fit zoom levels
 * for the given viewport dimensions so zooming out never leaves excessive empty space.
 *
 * At zoom = 0 (1280 m/px), the 608 km × 608 km map is 475 × 475 px.
 * At zoom = 1 (640 m/px), the 608 km × 608 km map is 950 × 950 px.
 * On viewports >= 520 px in both dimensions, minZoom = 1 prevents shrinking the map
 * to a 475 px square surrounded by large empty areas.
 *
 * @param {number} viewportWidthPx
 * @param {number} viewportHeightPx
 * @returns {{ minZoom: number, maxZoom: number, optimalFitZoom: number }}
 */
export function computeViewportZoomLimits(viewportWidthPx, viewportHeightPx) {
  const w = Number.isFinite(viewportWidthPx) && viewportWidthPx > 0 ? viewportWidthPx : 1024;
  const h = Number.isFinite(viewportHeightPx) && viewportHeightPx > 0 ? viewportHeightPx : 768;

  const minZoom = w >= 520 && h >= 520 ? 1 : 0;
  const maxZoom = SP_RESOLUTIONS.length - 1; // 6 (20 m/px)
  const optimalFitZoom = minZoom;

  return {
    minZoom,
    maxZoom,
    optimalFitZoom,
  };
}

/**
 * Computes the valid horizontal and vertical stereographic center translation ranges
 * [ -maxAbsX_M, +maxAbsX_M ] and [ -maxAbsY_M, +maxAbsY_M ] independently based on
 * the rendered map dimensions and the current viewport dimensions.
 *
 * - Along any axis where the rendered map (2 * halfExtentM) is larger than the viewport span,
 *   the viewport center can pan up to (halfExtentM - halfViewSpanM) so the map edge aligns
 *   with the viewport edge without exposing empty space beyond the map.
 * - Along any axis where the rendered map is smaller than or equal to the viewport span,
 *   maxAbs_M is 0 so the map remains centered along that axis and cannot be dragged off-screen.
 *
 * @param {number} viewportWidthPx
 * @param {number} viewportHeightPx
 * @param {number} resolutionMPerPx
 * @param {number} [halfExtentM=HALF_EXTENT_M]
 * @returns {{
 *   maxAbsX_M: number,
 *   maxAbsY_M: number,
 *   mapWidthM: number,
 *   mapHeightM: number,
 *   viewSpanX_M: number,
 *   viewSpanY_M: number
 * }}
 */
export function computeValidCenterRangeMeters(
  viewportWidthPx,
  viewportHeightPx,
  resolutionMPerPx,
  halfExtentM = HALF_EXTENT_M
) {
  const w = Math.max(1, Number.isFinite(viewportWidthPx) ? viewportWidthPx : 1024);
  const h = Math.max(1, Number.isFinite(viewportHeightPx) ? viewportHeightPx : 768);
  const res = Number.isFinite(resolutionMPerPx) && resolutionMPerPx > 0 ? resolutionMPerPx : 640;

  const mapWidthM = 2 * halfExtentM;
  const mapHeightM = 2 * halfExtentM;
  const viewSpanX_M = w * res;
  const viewSpanY_M = h * res;

  const halfViewX_M = viewSpanX_M / 2;
  const halfViewY_M = viewSpanY_M / 2;

  const maxAbsX_M = Math.max(0, halfExtentM - halfViewX_M);
  const maxAbsY_M = Math.max(0, halfExtentM - halfViewY_M);

  return {
    maxAbsX_M,
    maxAbsY_M,
    mapWidthM,
    mapHeightM,
    viewSpanX_M,
    viewSpanY_M,
  };
}

/**
 * Clamps a candidate stereographic center (xM, yM) in meters to the valid horizontal
 * and vertical viewport boundaries for the given viewport dimensions and resolution.
 *
 * @param {number} xM - Candidate stereographic X coordinate in meters
 * @param {number} yM - Candidate stereographic Y coordinate in meters
 * @param {number} viewportWidthPx - Viewport width in pixels
 * @param {number} viewportHeightPx - Viewport height in pixels
 * @param {number} resolutionMPerPx - Current resolution in meters/pixel
 * @param {number} [halfExtentM=HALF_EXTENT_M]
 * @returns {{
 *   x: number,
 *   y: number,
 *   maxAbsX_M: number,
 *   maxAbsY_M: number,
 *   wasClampedX: boolean,
 *   wasClampedY: boolean,
 *   wasClamped: boolean
 * }}
 */
export function computeClampedStereographicCenter(
  xM,
  yM,
  viewportWidthPx,
  viewportHeightPx,
  resolutionMPerPx,
  halfExtentM = HALF_EXTENT_M
) {
  const { maxAbsX_M, maxAbsY_M } = computeValidCenterRangeMeters(
    viewportWidthPx,
    viewportHeightPx,
    resolutionMPerPx,
    halfExtentM
  );

  const safeX = Number.isFinite(xM) ? xM : 0;
  const safeY = Number.isFinite(yM) ? yM : 0;

  let clampedX = Math.min(maxAbsX_M, Math.max(-maxAbsX_M, safeX));
  let clampedY = Math.min(maxAbsY_M, Math.max(-maxAbsY_M, safeY));

  if (clampedX === 0) clampedX = 0;
  if (clampedY === 0) clampedY = 0;

  const wasClampedX = Math.abs(clampedX - safeX) > 1e-3;
  const wasClampedY = Math.abs(clampedY - safeY) > 1e-3;

  return {
    x: clampedX,
    y: clampedY,
    maxAbsX_M,
    maxAbsY_M,
    wasClampedX,
    wasClampedY,
    wasClamped: wasClampedX || wasClampedY,
  };
}

/**
 * Clamps a candidate pixel drag offset (offsetPx) so the resulting viewport center
 * in Leaflet projected pixel space remains strictly within the valid horizontal and
 * vertical translation ranges at the given zoom level.
 *
 * @param {{ x: number, y: number }} offsetPx - Candidate drag offset in pixels
 * @param {{ x: number, y: number }} curCenterPx - Current viewport center in projected pixels
 * @param {{ x: number, y: number }} viewportSizePx - Viewport dimensions { x: width, y: height }
 * @param {number} zoom - Current map zoom level
 * @param {number} [halfExtentM=HALF_EXTENT_M]
 * @returns {{ x: number, y: number }} Clamped pixel offset
 */
export function computeClampedPixelOffset(
  offsetPx,
  curCenterPx,
  viewportSizePx,
  zoom,
  halfExtentM = HALF_EXTENT_M
) {
  const scale = getScaleForZoom(zoom);
  const mapSizePx = 2 * halfExtentM * scale;
  const mapCenterPx = mapSizePx / 2;

  const viewW = Math.max(1, viewportSizePx?.x || 1024);
  const viewH = Math.max(1, viewportSizePx?.y || 768);

  const maxOffsetPxX = Math.max(0, (mapSizePx - viewW) / 2);
  const maxOffsetPxY = Math.max(0, (mapSizePx - viewH) / 2);

  const minCenterPxX = mapCenterPx - maxOffsetPxX;
  const maxCenterPxX = mapCenterPx + maxOffsetPxX;
  const minCenterPxY = mapCenterPx - maxOffsetPxY;
  const maxCenterPxY = mapCenterPx + maxOffsetPxY;

  const candCenterX = curCenterPx.x + (offsetPx?.x || 0);
  const candCenterY = curCenterPx.y + (offsetPx?.y || 0);

  const clampedCenterX = Math.min(maxCenterPxX, Math.max(minCenterPxX, candCenterX));
  const clampedCenterY = Math.min(maxCenterPxY, Math.max(minCenterPxY, candCenterY));

  const dx = clampedCenterX - curCenterPx.x;
  const dy = clampedCenterY - curCenterPx.y;

  return {
    x: dx === 0 ? 0 : dx,
    y: dy === 0 ? 0 : dy,
  };
}

/**
 * Computes the allowed Leaflet Draggable pane offset bounds { min: { x, y }, max: { x, y } }
 * for `map.dragging._offsetLimit` when a drag gesture starts.
 *
 * Because moving the map pane by `+paneOffset` shifts the viewport center in world pixels
 * by `-paneOffset` (`newCenterPx = curCenterPx - paneOffset`), the valid pane offset range is:
 *   minPaneOffset = curCenterPx - maxCenterPx
 *   maxPaneOffset = curCenterPx - minCenterPx
 *
 * This avoids Leaflet's built-in `bounds.getNorthWest()` / `bounds.getSouthEast()` assumption,
 * which breaks in South Polar Stereographic where all 4 corners share the same latitude (-75.9°S)
 * and Y is determined by longitude rather than latitude.
 *
 * @param {{ x: number, y: number }} curCenterPx - Current viewport center in projected world pixels
 * @param {{ x: number, y: number }} viewportSizePx - Viewport dimensions { x: width, y: height }
 * @param {number} zoom - Current map zoom level
 * @param {number} [halfExtentM=HALF_EXTENT_M]
 * @returns {{ min: { x: number, y: number }, max: { x: number, y: number } }}
 */
export function computeDraggablePaneOffsetBounds(
  curCenterPx,
  viewportSizePx,
  zoom,
  halfExtentM = HALF_EXTENT_M
) {
  const scale = getScaleForZoom(zoom);
  const mapSizePx = 2 * halfExtentM * scale;
  const mapCenterPx = mapSizePx / 2;

  const viewW = Math.max(1, viewportSizePx?.x || 1024);
  const viewH = Math.max(1, viewportSizePx?.y || 768);

  const maxOffsetPxX = Math.max(0, (mapSizePx - viewW) / 2);
  const maxOffsetPxY = Math.max(0, (mapSizePx - viewH) / 2);

  const minCenterPxX = mapCenterPx - maxOffsetPxX;
  const maxCenterPxX = mapCenterPx + maxOffsetPxX;
  const minCenterPxY = mapCenterPx - maxOffsetPxY;
  const maxCenterPxY = mapCenterPx + maxOffsetPxY;

  const minX = curCenterPx.x - maxCenterPxX;
  const maxX = curCenterPx.x - minCenterPxX;
  const minY = curCenterPx.y - maxCenterPxY;
  const maxY = curCenterPx.y - minCenterPxY;

  return {
    min: {
      x: minX === 0 ? 0 : minX,
      y: minY === 0 ? 0 : minY,
    },
    max: {
      x: maxX === 0 ? 0 : maxX,
      y: maxY === 0 ? 0 : maxY,
    },
  };
}

/**
 * Canonical geographic coverage and coordinate boundaries for the 2D Lunar South Pole
 * Topographic Map (NASA LRO LOLA Polar Stereographic DEM, IAU2015:30135).
 */
export const SOUTH_POLE_MAP_COVERAGE = Object.freeze({
  regionTitle: '2D Topographic Map — Lunar South Pole Only',
  latMinDeg: -90.0,
  latMaxDeg: -80.0,
  lonMinDeg: -180.0,
  lonMaxDeg: 180.0,
  latitudeRangeText: '80.0°S to 90.0°S (-80° to -90°)',
  longitudeRangeText: '180.0°W to 180.0°E (-180° to +180°)',
  stereographicRangeText: 'X: -304 km to +304 km, Y: -304 km to +304 km',
  crsCode: 'IAU2015:30135',
});

export const WHITE_OUTLINE_MIN_ZOOM = 2;

/**
 * Independently evaluates visibility for the White Outline Rendering Layer on the 2D South Pole Map.
 * Depends strictly on zoom level meeting `minZoom` (`WHITE_OUTLINE_MIN_ZOOM`) and the contour/ridge layer toggles.
 * Never inspects or affects the scientific green connection line state.
 *
 * @param {object} params
 * @param {number} params.zoomLevel - Current Leaflet zoom level
 * @param {boolean} [params.showContours=true] - User toggle for elevation contours
 * @param {boolean} [params.showRidges=true] - User toggle for crater rims and ridge outlines
 * @param {number} [params.minZoom=WHITE_OUTLINE_MIN_ZOOM] - Minimum zoom threshold for white outlines
 * @returns {{
 *   isVisible: boolean,
 *   meetsZoomThreshold: boolean,
 *   minZoom: number,
 *   zoomLevel: number,
 *   contoursVisible: boolean,
 *   ridgesVisible: boolean,
 *   neatlineVisible: boolean
 * }}
 */
export function evaluateWhiteOutlineLayerVisibility({
  zoomLevel,
  showContours = true,
  showRidges = true,
  minZoom = WHITE_OUTLINE_MIN_ZOOM,
} = {}) {
  const safeZoom = Number.isFinite(zoomLevel) ? zoomLevel : 0;
  const threshold = Number.isFinite(minZoom) ? minZoom : WHITE_OUTLINE_MIN_ZOOM;
  const meetsZoomThreshold = safeZoom >= threshold;
  const contoursVisible = Boolean(showContours && meetsZoomThreshold);
  const ridgesVisible = Boolean(showRidges && meetsZoomThreshold);
  const neatlineVisible = Boolean(meetsZoomThreshold);

  return {
    isVisible: contoursVisible || ridgesVisible,
    meetsZoomThreshold,
    minZoom: threshold,
    zoomLevel: safeZoom,
    contoursVisible,
    ridgesVisible,
    neatlineVisible,
  };
}

/**
 * Independently evaluates visibility for the Scientific Green Connection Line Layer
 * (Direct-to-Earth DSN Line-of-Sight corridor vector and sunlit rover traverse connection segments).
 *
 * Strictly decoupled from `zoomLevel`, `WHITE_OUTLINE_MIN_ZOOM`, `showContours`, and `showRidges`
 * so any future changes to zoom thresholds or white outline behavior can never affect
 * the scientific connection logic.
 *
 * @param {object} params
 * @param {boolean} [params.showDsnLink=true] - User toggle for the green Earth DSN LOS connection vector
 * @param {number} [params.subEarthLonDeg=0] - Instantaneous Sub-Earth selenographic longitude in degrees
 * @param {object|null} [params.routeResult=null] - Active surface rover traverse route result
 * @returns {{
 *   isVisible: boolean,
 *   dsnConnectionVisible: boolean,
 *   routeConnectionVisible: boolean
 * }}
 */
export function evaluateGreenConnectionLayerVisibility({
  showDsnLink = true,
  subEarthLonDeg = 0,
  routeResult = null,
} = {}) {
  const dsnConnectionVisible = Boolean(showDsnLink && Number.isFinite(subEarthLonDeg));
  const routeConnectionVisible = Boolean(
    routeResult?.success &&
      Array.isArray(routeResult?.waypoints) &&
      routeResult.waypoints.length > 0
  );

  return {
    isVisible: dsnConnectionVisible || routeConnectionVisible,
    dsnConnectionVisible,
    routeConnectionVisible,
  };
}

