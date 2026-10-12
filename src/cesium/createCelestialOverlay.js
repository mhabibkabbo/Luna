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
  earthDistance: 384400*1000,
  // earthDistance: 1441*100000,  // dont worry val for testing
  // earthRadius: 0.55 * R_MOON,
  earthRadius: 6371 * 1000,
  sunDistance:  4.6 * R_MOON, // 150*1000*1000*1000
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
  // Local asset (served by Vite from public/ at /assets/...)
  "/assets/earth-blue-marble.jpg",

  // CDN fallbacks
  "https://cdn.jsdelivr.net/npm/three-globe@2.31.0/example/img/earth-blue-marble.jpg",
  "https://unpkg.com/three-globe@2.31.0/example/img/earth-blue-marble.jpg",
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

function makeLabel(labels, { fill, offsetY, small = false, scaleByDistance = new Cesium.NearFarScalar(1.0e6, 1.0, 1.0e8, 0.8) }) {
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
    scaleByDistance,
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
  let destroyed = false;
  const { initialDate = new Date(), syncLighting = true, showVectors = false } = options;
  const scene = viewer.scene;

  const group = new Cesium.PrimitiveCollection();
  scene.primitives.add(group);

  // --- Earth ---------------------------------------------------------------

  const earthAppearance = new Cesium.MaterialAppearance({
    material: Cesium.Material.fromType('Color', {
      color: Color.fromCssColorString(COLORS.earthFallback),
    }),
    translucent: false,
    closed: true,
  });

  const earthSphere = new Cesium.Primitive({
    geometryInstances: new Cesium.GeometryInstance({
      geometry: new Cesium.EllipsoidGeometry({
        radii: new Cesium.Cartesian3(
          LAYOUT.earthRadius,
          LAYOUT.earthRadius,
          LAYOUT.earthRadius
        ),
        vertexFormat: earthAppearance.vertexFormat,
      }),
    }),

    appearance: earthAppearance,

    cull: false,
    asynchronous: false,
  });

  group.add(earthSphere);

  firstLoadableImage(EARTH_TEXTURE_URLS).then((url) => {
    if (!url || destroyed || scene.isDestroyed?.() || viewer.isDestroyed?.()) {
      return;
    }

    try {
      if (earthAppearance && !earthSphere.isDestroyed?.()) {
        earthAppearance.material =
          Cesium.Material.fromType('Image', {
            image: url,
          });
      }

      if (!scene.isDestroyed?.() && !viewer.isDestroyed?.()) {
        scene.requestRender?.();
      }
    } catch {
      // Scene or primitives may have been destroyed during async load
    }
  });

  
  // --- Direction vectors (Default: OFF, user can toggle on demand) ---------
  const polylines = new Cesium.PolylineCollection();
  polylines.show = showVectors;
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
  points.show = showVectors;
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
  subEarthLabel.show = showVectors;
  subSolarLabel.show = showVectors;
  // Sub-point labels only matter once the Moon is reasonably large on screen
  [subEarthLabel, subSolarLabel].forEach((l) => {
    l.distanceDisplayCondition = new Cesium.DistanceDisplayCondition(0, 2.2e7);
    l.eyeOffset = new Cartesian3(0, 0, -20);
  });
  earthLabel.eyeOffset = new Cartesian3(0, 0, -LAYOUT.earthRadius * 1.4);
  sunLabel.eyeOffset = new Cartesian3(0, 0, -LAYOUT.sunSpriteSize * 0.3);

  // --- Lighting & Cesium's built-in Sun synchronization -------------------
  if (!scene.sun) {
    scene.sun = new Cesium.Sun();
  }
  scene.sun.show = true;
  scene.sunBloom = true;
  scene.light = new Cesium.SunLight();

  const previousLight = scene.light;

  // Track active Sun positions in Moon's body-fixed coordinate frame
  let currentSunPosWC = new Cesium.Cartesian3();
  let currentSunDirWC = new Cesium.Cartesian3();

  // Hook uniformState.update directly: setSunAndMoonDirections runs inside update(),
  // so intercepting update() ensures Cesium's built-in Sun and lighting ALWAYS use
  // the exact Moon body-fixed solar position and direction without being overwritten.
  const uniformState = scene.context?.uniformState;
  const originalUniformStateUpdate = uniformState?.update;

  if (uniformState && originalUniformStateUpdate) {
    uniformState.update = function (frameState) {
      originalUniformStateUpdate.call(this, frameState);
      if (currentSunPosWC && currentSunDirWC && !Cesium.Cartesian3.equals(currentSunPosWC, Cesium.Cartesian3.ZERO)) {
        Cesium.Cartesian3.clone(currentSunPosWC, this._sunPositionWC);
        Cesium.Cartesian3.clone(currentSunDirWC, this._sunDirectionWC);
        if (frameState.camera?.viewMatrix) {
          Cesium.Matrix4.multiplyByPointAsVector(
            frameState.camera.viewMatrix,
            currentSunDirWC,
            this._sunDirectionEC
          );
          Cesium.Cartesian3.normalize(this._sunDirectionEC, this._sunDirectionEC);
        }
        Cesium.Cartesian3.clone(this._sunDirectionWC, this._lightDirectionWC);
        if (this._sunDirectionEC) {
          Cesium.Cartesian3.clone(this._sunDirectionEC, this._lightDirectionEC);
        }
      }
    };
  }

  // --- State -------------------------------------------------------------------
  let lastState = null;
  const rotation = new Cesium.Matrix3();

  const setText = (label, text) => {
    if (label.text !== text) label.text = text;
  };

  /**
   * Recomputes and applies the Earth/Sun geometry synchronized with Cesium's built-in Sun.
   * Uses high-precision IAU 2009/2015 lunar ephemeris and synchronizes Cesium's built-in Sun.
   * @param {Date|number} when - UTC
   * @returns {Object}
   */
  function setTime(when) {
    if (destroyed || scene.isDestroyed?.() || viewer.isDestroyed?.()) return null;

    const date = when instanceof Date ? when : new Date(when);
    const julianDate = Cesium.JulianDate.fromDate(date);

    // Synchronize Cesium's internal clock so Cesium time stays synchronized
    if (viewer.clock) {
      viewer.clock.currentTime = julianDate;
    }

    // High precision lunar ephemeris in Moon body-fixed selenographic frame
    const state = computeCelestialState(date);
    if (!state) return null;

    // Vectors in Moon's body-fixed frame (Cesium's world frame for Ellipsoid.MOON)
    const sunDirWC = new Cesium.Cartesian3(state.sun.dir[0], state.sun.dir[1], state.sun.dir[2]);
    const earthDirWC = new Cesium.Cartesian3(state.earth.dir[0], state.earth.dir[1], state.earth.dir[2]);

    const sunDistanceM = state.sun.distanceKm * 1000;
    const earthDistanceM = LAYOUT.earthDistance; // 384,400 km display distance
    const sunDistKm = state.sun.distanceKm;
    const earthDistKm = state.earth.distanceKm;

    // Synchronize Cesium's built-in Sun uniform position (1 AU away along sunDirWC)
    currentSunDirWC = sunDirWC;
    currentSunPosWC = Cesium.Cartesian3.multiplyByScalar(sunDirWC, sunDistanceM, new Cesium.Cartesian3());

    // 1. Position Sun Label and Direction Vector to match Cesium's built-in Sun exactly
    // Position the Sun label far along the solar ray (80,000 km) to eliminate parallax with Cesium's built-in Sun
    const sunLabelDist = 80000000;
    const sunLabelPos = Cesium.Cartesian3.multiplyByScalar(sunDirWC, sunLabelDist, new Cesium.Cartesian3());
    sunVector.positions = [
      Cesium.Cartesian3.multiplyByScalar(sunDirWC, R_MOON + LAYOUT.surfaceLift, new Cesium.Cartesian3()),
      Cesium.Cartesian3.multiplyByScalar(sunDirWC, sunLabelDist * 0.92, new Cesium.Cartesian3()),
    ];
    sunLabel.position = sunLabelPos;
    setText(
      sunLabel,
      `Sun\n${(sunDistKm / 1e6).toFixed(1)} million km · ${state.sun.distanceAU.toFixed(3)} AU`
    );

    // Subsolar point on lunar surface
    const subSolarPos = Cesium.Cartesian3.multiplyByScalar(sunDirWC, R_MOON + LAYOUT.surfaceLift, new Cesium.Cartesian3());
    subSolarPoint.position = subSolarPos;
    subSolarLabel.position = subSolarPos;
    const sCoord = formatLunarCoordinates(state.sun.subLon, state.sun.subLat, 1);
    setText(subSolarLabel, `Subsolar point\n${sCoord.latStr}, ${sCoord.lonStr}`);

    // 2. Position Earth Sphere, Label and Direction Vector in orbit around Moon
    const earthPos = Cesium.Cartesian3.multiplyByScalar(earthDirWC, earthDistanceM, new Cesium.Cartesian3());
    
    // Accurately orient the Earth model using Earth's diurnal rotation matrix (GAST)
    if (state.earth.toMoonFixed && state.earth.toMoonFixed.length === 3) {
      const m = state.earth.toMoonFixed;
      Cesium.Matrix3.setRow(rotation, 0, new Cesium.Cartesian3(m[0][0], m[0][1], m[0][2]), rotation);
      Cesium.Matrix3.setRow(rotation, 1, new Cesium.Cartesian3(m[1][0], m[1][1], m[1][2]), rotation);
      Cesium.Matrix3.setRow(rotation, 2, new Cesium.Cartesian3(m[2][0], m[2][1], m[2][2]), rotation);
    } else {
      Cesium.Transforms.rotationMatrixFromPositionVelocity(earthPos, earthDirWC, Cesium.Ellipsoid.WGS84, rotation);
    }
    Cesium.Matrix4.fromRotationTranslation(rotation, earthPos, earthSphere.modelMatrix);

    earthVector.positions = [
      Cesium.Cartesian3.multiplyByScalar(earthDirWC, R_MOON + LAYOUT.surfaceLift, new Cesium.Cartesian3()),
      Cesium.Cartesian3.multiplyByScalar(earthDirWC, earthDistanceM - LAYOUT.earthRadius * 1.02, new Cesium.Cartesian3()),
    ];
    earthLabel.position = earthPos;
    setText(earthLabel, `Earth\n${formatInt(earthDistKm)} km`);

    // Sub-Earth point on lunar surface
    const subEarthPos = Cesium.Cartesian3.multiplyByScalar(earthDirWC, R_MOON + LAYOUT.surfaceLift, new Cesium.Cartesian3());
    subEarthPoint.position = subEarthPos;
    subEarthLabel.position = subEarthPos;
    const eCoord = formatLunarCoordinates(state.earth.subLon, state.earth.subLat, 1);
    setText(subEarthLabel, `Sub-Earth point\n${eCoord.latStr}, ${eCoord.lonStr}`);

    lastState = state;

    try {
      if (!scene.isDestroyed?.() && !viewer.isDestroyed?.()) {
        scene.requestRender?.();
      }
    } catch {}
    return state;
  }

  /**
   * Flies to an oblique view that frames the Moon, Earth and Sun together.
   * The camera looks at the Moon from the side of the Earth-Moon line, raised above the
   * orbital plane, on the side facing the Sun so the lit hemisphere is visible.
   */
  function flyToOverview({ duration = 2.0 } = {}) {
    if (destroyed || scene.isDestroyed?.() || viewer.isDestroyed?.() || !lastState) return;
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
    
    // Allow the camera to reach the Earth at its real display distance.
    distance *= 1.08;

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
    if (destroyed || scene.isDestroyed?.() || viewer.isDestroyed?.()) return;
    group.show = !!visible;
    try {
      if (!scene.isDestroyed?.() && !viewer.isDestroyed?.()) {
        scene.requestRender?.();
      }
    } catch {}
  }

  function setVectorsVisible(visible) {
    if (destroyed || scene.isDestroyed?.() || viewer.isDestroyed?.()) return;
    const show = !!visible;
    polylines.show = show;
    points.show = show;
    subEarthLabel.show = show;
    subSolarLabel.show = show;
    try {
      if (!scene.isDestroyed?.() && !viewer.isDestroyed?.()) {
        scene.requestRender?.();
      }
    } catch {}
  }

  function areVectorsVisible() {
    return polylines.show;
  }

  function destroy() {
    if (destroyed) return;
    destroyed = true;
    try {
      if (uniformState && originalUniformStateUpdate) {
        uniformState.update = originalUniformStateUpdate;
      }
      if (!scene.isDestroyed?.() && previousLight) {
        scene.light = previousLight;
      }
      if (!scene.isDestroyed?.()) {
        scene.primitives.remove(group);
      }
    } catch {}
  }

  setTime(initialDate);

  return {
    setTime,
    setCelestialTime: setTime,
    setCelestialVisible: setVisible,
    setVectorsVisible,
    areVectorsVisible,
    setCelestialVectorsVisible: setVectorsVisible,
    flyToCelestialOverview: flyToOverview,
    getState: () => lastState,
    setVisible,
    isVisible: () => group.show,
    flyToOverview,
    destroy,
  };
}
