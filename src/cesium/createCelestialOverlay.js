/**
 * @file createCelestialOverlay.js
 * Real-time Earth and Sun visualisation for the CesiumJS Moon viewer.
 *
 * The Moon stays at the origin of Cesium's world frame, which for a globe built on
 * Ellipsoid.MOON is the Moon's body-fixed frame. Directions to the Earth and Sun come from
 * the ephemeris in that same frame (see utils/lunarEphemeris.js), so they line up with
 * the surface texture, feature pins and terminator without any extra transform.
 *
 * SCALE: the real Earth is 384,000 km away and the Sun 150,000,000 km away, far beyond
 * Cesium's far plane and far too distant to see next to a 1,737 km Moon. The overlay is
 * therefore a schematic: DIRECTIONS are exact, while display distances and sizes are
 * compressed (see LAYOUT). Labels always report the true distance.
 *
 * Everything is built from mutable primitives (not entities) so that changing the time,
 * including fast time-lapse, updates matrices and positions in place with no geometry rebuilds.
 */

import * as Cesium from 'cesium';
import { computeCelestialState, MOON_RADIUS_KM } from '../utils/lunarEphemeris.js';
import { formatLunarCoordinates } from '../utils/coordinates.js';

const R_MOON = MOON_RADIUS_KM * 1000; // metres, equals Ellipsoid.MOON.maximumRadius

/** Schematic display layout, in metres from the Moon's centre. */
const LAYOUT = {
  earthDistance: 3.4 * R_MOON,
  earthRadius: 0.55 * R_MOON,
  sunDistance: 4.6 * R_MOON,
  sunSpriteSize: 3.4 * R_MOON, // sprite width; the bright disc is roughly a third of it
  surfaceLift: 6000, // keeps sub-point markers clear of the terrain
};

const COLORS = {
  earth: '#38bdf8',
  sun: '#fbbf24',
  earthFallback: '#2563eb',
};

// Same package and version the app already pulls its textures from.
const EARTH_TEXTURE_URLS = [
  'https://cdn.jsdelivr.net/npm/three-globe@2.31.0/example/img/earth-blue-marble.jpg',
  'https://unpkg.com/three-globe@2.31.0/example/img/earth-blue-marble.jpg',
];

const LABEL_FONT = '600 12px "Plus Jakarta Sans", system-ui, -apple-system, sans-serif';
const LABEL_FONT_SMALL = '600 11px "Plus Jakarta Sans", system-ui, -apple-system, sans-serif';

const { Cartesian3, Color } = Cesium;

const scaled = (dir, k) => new Cartesian3(dir[0] * k, dir[1] * k, dir[2] * k);
const dot3 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross3 = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const unit3 = (a) => {
  const n = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / n, a[1] / n, a[2] / n];
};

const formatInt = (n) => Math.round(n).toLocaleString('en-US');

/** Radial-gradient sprite: bright disc with a soft corona. */
function createSunSprite() {
  const size = 256;
  const c = size / 2;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const g = ctx.createRadialGradient(c, c, 0, c, c, c);
  g.addColorStop(0, 'rgba(255, 251, 235, 1)');
  g.addColorStop(0.2, 'rgba(254, 240, 138, 1)');
  g.addColorStop(0.3, 'rgba(251, 191, 36, 1)');
  g.addColorStop(0.36, 'rgba(251, 191, 36, 0.55)');
  g.addColorStop(0.6, 'rgba(245, 158, 11, 0.16)');
  g.addColorStop(1, 'rgba(245, 158, 11, 0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return canvas;
}

/** Resolves with the first URL that loads as an image, or null. */
function firstLoadableImage(urls) {
  return new Promise((resolve) => {
    let i = 0;
    const next = () => {
      if (i >= urls.length) {
        resolve(null);
        return;
      }
      const url = urls[i++];
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(url);
      img.onerror = next;
      img.src = url;
    };
    next();
  });
}

function makeLabel(labels, { fill, offsetY, small = false }) {
  return labels.add({
    text: '',
    font: small ? LABEL_FONT_SMALL : LABEL_FONT,
    style: Cesium.LabelStyle.FILL_AND_OUTLINE,
    fillColor: Color.fromCssColorString(fill),
    outlineColor: Color.fromCssColorString('#020617'),
    outlineWidth: 2,
    showBackground: true,
    backgroundColor: Color.fromCssColorString('rgba(8, 13, 27, 0.9)'),
    backgroundPadding: new Cesium.Cartesian2(6, 3),
    verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
    horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
    pixelOffset: new Cesium.Cartesian2(0, offsetY),
    scaleByDistance: new Cesium.NearFarScalar(1.0e6, 1.0, 4.0e7, 0.8),
  });
}

/**
 * @param {Cesium.Viewer} viewer
 * @param {Object} [options]
 * @param {Date|number} [options.initialDate] - defaults to now
 * @param {boolean} [options.syncLighting=true] - drive scene.light from the ephemeris so the
 *   day/night terminator (and the Earth's phase) match the Sun marker. Cesium's default
 *   light computes the Sun for Earth's rotating frame, which is wrong for the Moon.
 */
export function createCelestialOverlay(viewer, options = {}) {
  const { initialDate = new Date(), syncLighting = true } = options;
  const scene = viewer.scene;

  const group = new Cesium.PrimitiveCollection();
  scene.primitives.add(group);

  // --- Earth ---------------------------------------------------------------
  const earthSphere = new Cesium.EllipsoidPrimitive({
    radii: new Cartesian3(LAYOUT.earthRadius, LAYOUT.earthRadius, LAYOUT.earthRadius),
    material: Cesium.Material.fromType('Color', {
      color: Color.fromCssColorString(COLORS.earthFallback),
    }),
  });
  group.add(earthSphere);

  let destroyed = false;
  firstLoadableImage(EARTH_TEXTURE_URLS).then((url) => {
    // Keep the solid-blue sphere if no mirror is reachable
    if (!url || destroyed) return;
    earthSphere.material = Cesium.Material.fromType('Image', { image: url });
    scene.requestRender?.();
  });

  // --- Sun -----------------------------------------------------------------
  const billboards = new Cesium.BillboardCollection();
  group.add(billboards);
  const sunSprite = billboards.add({
    image: createSunSprite(),
    sizeInMeters: true,
    width: LAYOUT.sunSpriteSize,
    height: LAYOUT.sunSpriteSize,
    position: Cartesian3.ZERO,
  });

  // --- Direction vectors ---------------------------------------------------
  const polylines = new Cesium.PolylineCollection();
  group.add(polylines);
  const earthVector = polylines.add({
    positions: [Cartesian3.ZERO, Cartesian3.UNIT_X],
    width: 9,
    material: Cesium.Material.fromType('PolylineArrow', {
      color: Color.fromCssColorString(COLORS.earth),
    }),
  });
  const sunVector = polylines.add({
    positions: [Cartesian3.ZERO, Cartesian3.UNIT_X],
    width: 9,
    material: Cesium.Material.fromType('PolylineArrow', {
      color: Color.fromCssColorString(COLORS.sun),
    }),
  });

  // --- Sub-point markers on the Moon's surface ------------------------------
  const points = new Cesium.PointPrimitiveCollection();
  group.add(points);
  const subEarthPoint = points.add({
    pixelSize: 11,
    color: Color.fromCssColorString(COLORS.earth),
    outlineColor: Color.WHITE,
    outlineWidth: 2,
    position: Cartesian3.ZERO,
  });
  const subSolarPoint = points.add({
    pixelSize: 11,
    color: Color.fromCssColorString(COLORS.sun),
    outlineColor: Color.WHITE,
    outlineWidth: 2,
    position: Cartesian3.ZERO,
  });

  // --- Labels ----------------------------------------------------------------
  const labels = new Cesium.LabelCollection();
  group.add(labels);
  const earthLabel = makeLabel(labels, { fill: '#e0f2fe', offsetY: -26 });
  const sunLabel = makeLabel(labels, { fill: '#fef3c7', offsetY: -30 });
  const subEarthLabel = makeLabel(labels, { fill: '#e0f2fe', offsetY: -16, small: true });
  const subSolarLabel = makeLabel(labels, { fill: '#fef3c7', offsetY: -16, small: true });
  // Sub-point labels only matter once the Moon is reasonably large on screen
  [subEarthLabel, subSolarLabel].forEach((l) => {
    l.distanceDisplayCondition = new Cesium.DistanceDisplayCondition(0, 2.2e7);
    l.eyeOffset = new Cartesian3(0, 0, -20);
  });
  earthLabel.eyeOffset = new Cartesian3(0, 0, -LAYOUT.earthRadius * 1.4);
  sunLabel.eyeOffset = new Cartesian3(0, 0, -LAYOUT.sunSpriteSize * 0.3);

  // --- Lighting, Cesium's Earth-centric Sun/Moon sprites -----------------------
  const previousLight = scene.light;
  let moonLight = null;
  if (syncLighting) {
    moonLight = new Cesium.DirectionalLight({
      direction: new Cartesian3(-1, 0, 0),
      color: previousLight?.color,
      intensity: previousLight?.intensity ?? 2.0,
    });
    scene.light = moonLight;
  }
  // Cesium draws its own Sun and Earth's Moon at Earth-based positions, which would
  // contradict the accurate markers. Hide them while the overlay is active.
  const previousSunShow = scene.sun?.show;
  const previousMoonShow = scene.moon?.show;
  if (scene.sun) scene.sun.show = false;
  if (scene.moon) scene.moon.show = false;

  // --- State -------------------------------------------------------------------
  let lastState = null;
  const rotation = new Cesium.Matrix3();

  const setText = (label, text) => {
    if (label.text !== text) label.text = text;
  };

  /**
   * Recomputes and applies the Earth/Sun geometry for a moment in time.
   * @param {Date|number} when - UTC
   * @returns {ReturnType<typeof computeCelestialState>}
   */
  function setTime(when) {
    const state = computeCelestialState(when);
    lastState = state;
    const { earth, sun } = state;

    // Earth: position, orientation (Earth-fixed -> Moon-fixed) and vector
    const earthPos = scaled(earth.dir, LAYOUT.earthDistance);
    const m = earth.toMoonFixed;
    Cesium.Matrix3.fromRowMajorArray(
      [m[0][0], m[0][1], m[0][2], m[1][0], m[1][1], m[1][2], m[2][0], m[2][1], m[2][2]],
      rotation
    );
    Cesium.Matrix4.fromRotationTranslation(rotation, earthPos, earthSphere.modelMatrix);
    earthVector.positions = [
      scaled(earth.dir, R_MOON + LAYOUT.surfaceLift),
      scaled(earth.dir, LAYOUT.earthDistance - LAYOUT.earthRadius * 1.02),
    ];
    earthLabel.position = earthPos;
    setText(earthLabel, `Earth\n${formatInt(earth.distanceKm)} km`);

    // Sun: position, sprite and vector
    const sunPos = scaled(sun.dir, LAYOUT.sunDistance);
    sunSprite.position = sunPos;
    sunVector.positions = [
      scaled(sun.dir, R_MOON + LAYOUT.surfaceLift),
      scaled(sun.dir, LAYOUT.sunDistance - LAYOUT.sunSpriteSize * 0.2),
    ];
    sunLabel.position = sunPos;
    setText(
      sunLabel,
      `Sun\n${(sun.distanceKm / 1e6).toFixed(1)} million km · ${sun.distanceAU.toFixed(3)} AU`
    );

    // Sub-point markers where each vector meets the surface
    subEarthPoint.position = scaled(earth.dir, R_MOON + LAYOUT.surfaceLift);
    subSolarPoint.position = scaled(sun.dir, R_MOON + LAYOUT.surfaceLift);
    subEarthLabel.position = subEarthPoint.position;
    subSolarLabel.position = subSolarPoint.position;
    const eCoord = formatLunarCoordinates(earth.subLon, earth.subLat, 1);
    const sCoord = formatLunarCoordinates(sun.subLon, sun.subLat, 1);
    setText(subEarthLabel, `Sub-Earth point\n${eCoord.latStr}, ${eCoord.lonStr}`);
    setText(subSolarLabel, `Subsolar point\n${sCoord.latStr}, ${sCoord.lonStr}`);

    // Light travels from the Sun toward the Moon
    if (moonLight) {
      Cartesian3.negate(new Cartesian3(sun.dir[0], sun.dir[1], sun.dir[2]), moonLight.direction);
    }

    scene.requestRender?.();
    return state;
  }

  /**
   * Flies to an oblique view that frames the Moon, Earth and Sun together.
   * The camera looks at the Moon from the side of the Earth-Moon line, raised above the
   * orbital plane, on the side facing the Sun so the lit hemisphere is visible.
   */
  function flyToOverview({ duration = 2.0 } = {}) {
    if (!lastState) return;
    const e = lastState.earth.dir;
    const s = lastState.sun.dir;
    const pole = [0, 0, 1];

    const n = unit3([
      pole[0] - e[0] * dot3(pole, e),
      pole[1] - e[1] * dot3(pole, e),
      pole[2] - e[2] * dot3(pole, e),
    ]);
    let p = unit3(cross3(n, e));
    if (dot3(p, s) < 0) p = [-p[0], -p[1], -p[2]];

    const elevation = (32 * Math.PI) / 180;
    const c = unit3([
      n[0] * Math.sin(elevation) + p[0] * Math.cos(elevation),
      n[1] * Math.sin(elevation) + p[1] * Math.cos(elevation),
      n[2] * Math.sin(elevation) + p[2] * Math.cos(elevation),
    ]); // unit vector from the Moon's centre toward the camera
    const up = unit3([
      pole[0] - c[0] * dot3(pole, c),
      pole[1] - c[1] * dot3(pole, c),
      pole[2] - c[2] * dot3(pole, c),
    ]);
    const right = cross3([-c[0], -c[1], -c[2]], up);

    // Pick a distance at which both bodies (plus their sprites/labels) are inside the frame
    const frustum = viewer.camera.frustum;
    const aspect = frustum.aspectRatio || 1.6;
    const t = Math.tan((frustum.fov || Math.PI / 3) / 2);
    const tanH = aspect >= 1 ? t : t * aspect;
    const tanV = aspect >= 1 ? t / aspect : t;

    const bodies = [
      { pos: [e[0] * LAYOUT.earthDistance, e[1] * LAYOUT.earthDistance, e[2] * LAYOUT.earthDistance], margin: LAYOUT.earthRadius * 1.6 },
      { pos: [s[0] * LAYOUT.sunDistance, s[1] * LAYOUT.sunDistance, s[2] * LAYOUT.sunDistance], margin: LAYOUT.sunSpriteSize * 0.55 },
    ];
    let distance = (R_MOON * 2.5) / Math.min(tanH, tanV);
    for (const b of bodies) {
      const towardCamera = dot3(b.pos, c);
      distance = Math.max(
        distance,
        (Math.abs(dot3(b.pos, right)) + b.margin) / tanH + towardCamera,
        (Math.abs(dot3(b.pos, up)) + b.margin) / tanV + towardCamera
      );
    }
    // Stay inside the viewer's maximum zoom (30,000 km above the surface)
    distance = Math.min(distance * 1.08, R_MOON + 2.95e7);

    viewer.camera.flyTo({
      destination: new Cartesian3(c[0] * distance, c[1] * distance, c[2] * distance),
      orientation: {
        direction: new Cartesian3(-c[0], -c[1], -c[2]),
        up: new Cartesian3(up[0], up[1], up[2]),
      },
      duration,
      easingFunction: Cesium.EasingFunction.QUADRATIC_OUT,
    });
  }

  function setVisible(visible) {
    group.show = !!visible;
    scene.requestRender?.();
  }

  function destroy() {
    if (destroyed) return;
    destroyed = true;
    if (moonLight && scene.light === moonLight) scene.light = previousLight;
    if (scene.sun && previousSunShow !== undefined) scene.sun.show = previousSunShow;
    if (scene.moon && previousMoonShow !== undefined) scene.moon.show = previousMoonShow;
    if (!scene.isDestroyed?.()) scene.primitives.remove(group);
  }

  setTime(initialDate);

  return {
    setTime,
    getState: () => lastState,
    setVisible,
    isVisible: () => group.show,
    flyToOverview,
    destroy,
  };
}
