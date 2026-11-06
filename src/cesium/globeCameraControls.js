/**
 * @file globeCameraControls.js
 * Google Earth style camera controls for a Cesium globe (Moon or Earth).
 *
 * Replaces Cesium's default ScreenSpaceCameraController, which keeps the camera's
 * up-axis locked to the pole (constrainedAxis). That lock is what made the globe
 * spin around the poles while zooming and made it impossible to drag across them.
 *
 * Behaviour:
 *  - Drag (left mouse / one finger): "grab the globe". The surface point under the
 *    cursor stays under the cursor, everywhere, including over the poles.
 *  - Wheel / trackpad pinch / two-finger pinch: zoom toward the point under the cursor
 *    (or fingers) with smoothing. The view direction is never rotated by zooming.
 *  - Right / middle / Ctrl+left drag: orbit around the screen centre
 *    (horizontal = heading, vertical = tilt).
 *  - Releasing a drag retains realistic inertia and preserves user-rotated orientation
 *    without unwanted auto-alignment or camera clipping.
 */

import * as Cesium from 'cesium';

const {
  Cartesian2,
  Cartesian3,
  Matrix3,
  Matrix4,
  Quaternion,
  Ray,
  Transforms,
  IntersectionTests,
} = Cesium;

const WHEEL_ZOOM_RATE = 0.0018; // log-height change per wheel delta unit
const TRACKPAD_PINCH_BOOST = 6; // ctrl+wheel (trackpad pinch) sends tiny deltas
const ZOOM_SMOOTH_MS = 120;
const MAX_ZOOM_STEP = 4; // max height ratio per single wheel event
const ORBIT_RAD_PER_PIXEL = 0.005;
const MAX_TILT = Cesium.Math.toRadians(75);
const MIN_PAN_VELOCITY = 2e-5; // rad / ms
const MAX_PAN_VELOCITY = 0.01; // rad / ms

const scratch = {
  ray: new Ray(),
  q: new Quaternion(),
  m3: new Matrix3(),
  m4: new Matrix4(),
  v: new Cartesian3(),
  v2: new Cartesian3(),
  surface: new Cartesian3(),
  axis: new Cartesian3(),
  right: new Cartesian3(),
};

/**
 * @param {Cesium.Viewer} viewer
 * @param {Object} options
 * @param {Cesium.Ellipsoid} options.ellipsoid
 * @param {number} options.minHeight  Closest allowed camera height (m).
 * @param {number} options.maxHeight  Farthest allowed camera height (m).
 * @param {boolean} [options.isMobile]
 */
export function createGlobeCameraControls(viewer, options) {
  const { ellipsoid, minHeight, maxHeight, isMobile = false } = options;
  const scene = viewer.scene;
  const camera = scene.camera;
  const canvas = scene.canvas;

  // Turn the stock controller off; we drive the camera ourselves.
  const stock = scene.screenSpaceCameraController;
  stock.enableRotate = false;
  stock.enableTranslate = false;
  stock.enableZoom = false;
  stock.enableTilt = false;
  stock.enableLook = false;

  const previousTouchAction = canvas.style.touchAction;
  canvas.style.touchAction = 'none';

  const inertiaTauMs = isMobile ? 280 : 360;

  // ---- state --------------------------------------------------------------
  const pointers = new Map(); // pointerId -> {x, y}
  let mode = null; // 'pan' | 'orbit' | 'pinch' | null
  let grab = null; // world point kept under the cursor while panning / pinching
  let lastPointer = null;
  let pendingPan = null; // latest pointer position, applied once per frame
  let offGlobe = false; // pointer is outside the globe during a pan
  let pinchDistance = 0;
  let orbitCenter = null;

  const pan = { axis: new Cartesian3(), velocity: 0, lastMoveTime: 0 }; // inertia
  let zoom = null; // { target, anchorWorld, anchorScreen }
  let lastTick = performance.now();
  let destroyed = false;

  // ---- geometry helpers ---------------------------------------------------
  function ensureWorldFrame() {
    if (!Matrix4.equals(camera.transform, Matrix4.IDENTITY)) {
      camera.lookAtTransform(Matrix4.IDENTITY);
    }
  }

  function surfaceRadiusAlong(position) {
    const s = ellipsoid.scaleToGeocentricSurface(position, scratch.surface);
    return s ? Cartesian3.magnitude(s) : ellipsoid.maximumRadius;
  }

  function getHeight() {
    return Cartesian3.magnitude(camera.position) - surfaceRadiusAlong(camera.position);
  }

  /** Moves the camera straight toward/away from the globe centre. Orientation is untouched. */
  function setHeight(height) {
    const h = Cesium.Math.clamp(height, minHeight, maxHeight);
    const pos = camera.position;
    const r = Cartesian3.magnitude(pos);
    if (r === 0) return;
    Cartesian3.multiplyByScalar(pos, (surfaceRadiusAlong(pos) + h) / r, pos);
  }

  /** Strictly prevents the camera from clipping into the globe or exceeding maxHeight. */
  function clampHeight() {
    const currentH = getHeight();
    if (currentH < minHeight) {
      setHeight(minHeight);
    } else if (currentH > maxHeight) {
      setHeight(maxHeight);
    }
  }

  /** Exact surface hit under a screen position, or undefined. */
  function pickSurface(screen, result) {
    const ray = camera.getPickRay(screen, scratch.ray);
    if (!ray) return undefined;
    const hit = IntersectionTests.rayEllipsoid(ray, ellipsoid);
    if (!hit || hit.stop <= 0) return undefined;
    return Ray.getPoint(ray, hit.start > 0 ? hit.start : hit.stop, result);
  }

  /**
   * Surface hit, or (when the cursor is off the globe) the point of the limb closest to the
   * pointer ray. Gives a continuous grab target so dragging past the edge stays smooth.
   */
  function pickSurfaceOrLimb(screen, result) {
    const hit = pickSurface(screen, result);
    if (hit) return hit;
    const ray = camera.getPickRay(screen, scratch.ray);
    if (!ray) return undefined;
    const t = -Cartesian3.dot(ray.origin, ray.direction);
    if (t <= 0) return undefined;
    const closest = Cartesian3.add(
      ray.origin,
      Cartesian3.multiplyByScalar(ray.direction, t, scratch.v),
      scratch.v2
    );
    return ellipsoid.scaleToGeocentricSurface(closest, result);
  }

  function orthonormalize() {
    Cartesian3.normalize(camera.direction, camera.direction);
    Cartesian3.normalize(Cartesian3.cross(camera.direction, camera.up, camera.right), camera.right);
    Cartesian3.cross(camera.right, camera.direction, camera.up);
  }

  /** Rigidly rotates the camera about an axis through `point` (default: globe centre). */
  function rotateCamera(axis, angle, point) {
    Quaternion.fromAxisAngle(axis, angle, scratch.q);
    const m = Matrix3.fromQuaternion(scratch.q, scratch.m3);
    if (point) {
      Cartesian3.subtract(camera.position, point, scratch.v);
      Matrix3.multiplyByVector(m, scratch.v, scratch.v);
      Cartesian3.add(scratch.v, point, camera.position);
      clampHeight();
    } else {
      Matrix3.multiplyByVector(m, camera.position, camera.position);
    }
    Matrix3.multiplyByVector(m, camera.direction, camera.direction);
    Matrix3.multiplyByVector(m, camera.up, camera.up);
    orthonormalize();
  }

  /**
   * Rotates the camera about the globe centre so that surface point `from`
   * (currently under the cursor) ends up where `to` currently is.
   * Returns the rotation angle, and writes the rotation axis to `pan.axis`.
   */
  function rotateSurfacePoint(from, to) {
    const axis = Cartesian3.cross(from, to, scratch.axis);
    const sin = Cartesian3.magnitude(axis);
    if (sin < 1e-12) return 0;
    Cartesian3.divideByScalar(axis, sin, axis);
    const angle = Math.atan2(sin, Cartesian3.dot(from, to));
    rotateCamera(axis, angle);
    Cartesian3.clone(axis, pan.axis);
    return angle;
  }

  /** Keeps `world` under `screen` after a height change. */
  function reanchor(world, screen) {
    if (!world) return;
    const now = pickSurfaceOrLimb(screen, new Cartesian3());
    if (now) rotateSurfacePoint(now, world);
  }

  function screenCentre() {
    return new Cartesian2(canvas.clientWidth / 2, canvas.clientHeight / 2);
  }

  function eventPosition(e) {
    const rect = canvas.getBoundingClientRect();
    return new Cartesian2(e.clientX - rect.left, e.clientY - rect.top);
  }

  function stopMotion() {
    pan.velocity = 0;
    zoom = null;
  }

  // ---- gesture start / end ------------------------------------------------
  function beginPan(screen) {
    grab = pickSurface(screen, new Cartesian3()) || null;
    offGlobe = !grab;
    lastPointer = screen;
    pendingPan = null;
    pan.velocity = 0;
    pan.lastMoveTime = 0;
    mode = 'pan';
  }

  /**
   * Pans by screen movement (used while the pointer is off the globe, where there is no
   * surface point to grab). Rotates the globe as if the surface under the screen centre
   * were dragged by the same number of pixels. Returns the rotation angle.
   */
  function panByDelta(dx, dy) {
    const centre = pickSurfaceOrLimb(screenCentre(), scratch.surface);
    if (!centre || (!dx && !dy)) return 0;
    const distance = Cartesian3.distance(camera.position, centre);
    const fovy = camera.frustum.fovy || Cesium.Math.PI_OVER_THREE;
    const metersPerPixel = (2 * distance * Math.tan(fovy / 2)) / Math.max(1, canvas.clientHeight);

    const v = Cartesian3.multiplyByScalar(camera.right, dx * metersPerPixel, new Cartesian3());
    Cartesian3.subtract(
      v,
      Cartesian3.multiplyByScalar(camera.up, dy * metersPerPixel, scratch.v),
      v
    );
    const axis = Cartesian3.cross(v, centre, scratch.axis);
    const sin = Cartesian3.magnitude(axis);
    if (sin < 1e-9) return 0;
    Cartesian3.divideByScalar(axis, sin, axis);
    const angle = Cartesian3.magnitude(v) / Cartesian3.magnitude(centre);
    rotateCamera(axis, angle);
    Cartesian3.clone(axis, pan.axis);
    return angle;
  }

  function applyPan(screen, dt) {
    const target = pickSurface(screen, new Cartesian3());
    let angle = 0;
    if (target) {
      if (offGlobe || !grab) {
        // Pointer came back onto the globe: grab whatever is under it now.
        grab = target;
        offGlobe = false;
      } else {
        angle = rotateSurfacePoint(target, grab);
      }
    } else {
      offGlobe = true;
      angle = panByDelta(screen.x - lastPointer.x, screen.y - lastPointer.y);
    }
    lastPointer = screen;

    const instant = Math.min(MAX_PAN_VELOCITY, angle / dt);
    pan.velocity = pan.velocity * 0.5 + instant * 0.5;
    pan.lastMoveTime = performance.now();
  }

  function beginPinch() {
    const [a, b] = [...pointers.values()];
    pinchDistance = Math.max(1, Math.hypot(a.x - b.x, a.y - b.y));
    const mid = new Cartesian2((a.x + b.x) / 2, (a.y + b.y) / 2);
    grab = pickSurfaceOrLimb(mid, new Cartesian3()) || null;
    mode = grab ? 'pinch' : null;
  }

  function beginOrbit(screen) {
    orbitCenter = pickSurface(screenCentre(), new Cartesian3()) || null;
    lastPointer = screen;
    mode = orbitCenter ? 'orbit' : null;
  }

  function onPointerDown(e) {
    if (destroyed) return;
    if (e.pointerType === 'mouse' && e.button > 2) return;
    ensureWorldFrame();
    camera.cancelFlight();
    stopMotion();

    const screen = eventPosition(e);
    pointers.set(e.pointerId, { x: screen.x, y: screen.y });
    try {
      canvas.setPointerCapture?.(e.pointerId);
    } catch {
      /* pointer already gone */
    }

    if (pointers.size >= 2) {
      beginPinch();
      return;
    }
    const wantsOrbit =
      e.pointerType === 'mouse' && (e.button === 1 || e.button === 2 || e.ctrlKey || e.metaKey);
    if (wantsOrbit) beginOrbit(screen);
    else beginPan(screen);
  }

  function onPointerMove(e) {
    if (destroyed || !pointers.has(e.pointerId)) return;
    const screen = eventPosition(e);
    pointers.set(e.pointerId, { x: screen.x, y: screen.y });
    if (!mode) return;

    if (mode === 'pan') {
      // Applied once per frame in tick(), so a fast mouse can't queue up extra work.
      pendingPan = screen;
    } else if (mode === 'pinch' && pointers.size >= 2) {
      const [a, b] = [...pointers.values()];
      const distance = Math.max(1, Math.hypot(a.x - b.x, a.y - b.y));
      const mid = new Cartesian2((a.x + b.x) / 2, (a.y + b.y) / 2);
      setHeight(getHeight() * (pinchDistance / distance));
      reanchor(grab, mid);
      pinchDistance = distance;
    } else if (mode === 'orbit' && orbitCenter && lastPointer) {
      orbit(screen.x - lastPointer.x, screen.y - lastPointer.y);
      lastPointer = screen;
    }
    scene.requestRender();
  }

  function onPointerUp(e) {
    if (!pointers.has(e.pointerId)) return;
    pointers.delete(e.pointerId);
    try {
      canvas.releasePointerCapture?.(e.pointerId);
    } catch {
      /* already released */
    }

    if (pointers.size === 1 && mode === 'pinch') {
      // Lifting one finger of a pinch continues as a one-finger drag.
      const [remaining] = pointers.values();
      beginPan(new Cartesian2(remaining.x, remaining.y));
      pan.velocity = 0;
      return;
    }
    if (pointers.size > 0) return;

    const wasPan = mode === 'pan';
    if (wasPan && pendingPan && lastPointer) applyPan(pendingPan, 16);
    pendingPan = null;
    offGlobe = false;
    mode = null;
    grab = null;
    orbitCenter = null;
    lastPointer = null;

    if (wasPan && performance.now() - pan.lastMoveTime < 60 && pan.velocity > MIN_PAN_VELOCITY) {
      scene.requestRender();
    } else {
      pan.velocity = 0;
    }
    scene.requestRender();
  }

  function onWheel(e) {
    if (destroyed) return;
    e.preventDefault();
    ensureWorldFrame();
    camera.cancelFlight();
    pan.velocity = 0;

    let delta = e.deltaY;
    if (e.deltaMode === 1) delta *= 16;
    else if (e.deltaMode === 2) delta *= 400;
    if (e.ctrlKey) delta *= TRACKPAD_PINCH_BOOST;
    if (!delta) return;

    const ratio = Cesium.Math.clamp(
      Math.exp(delta * WHEEL_ZOOM_RATE),
      1 / MAX_ZOOM_STEP,
      MAX_ZOOM_STEP
    );
    const screen = eventPosition(e);
    const base = zoom ? zoom.target : getHeight();
    zoom = {
      target: Cesium.Math.clamp(base * ratio, minHeight, maxHeight),
      anchorScreen: screen,
      anchorWorld: pickSurface(screen, new Cartesian3()) || null,
    };
    scene.requestRender();
  }

  function onContextMenu(e) {
    e.preventDefault();
  }

  // ---- orbit (heading + tilt about the screen centre) ---------------------
  function orbit(dx, dy) {
    const normal = ellipsoid.geodeticSurfaceNormal(orbitCenter, scratch.axis);
    if (dx) {
      rotateCamera(normal, dx * ORBIT_RAD_PER_PIXEL, orbitCenter);
    }
    if (dy) {
      const currentTilt = Math.acos(
        Cesium.Math.clamp(-Cartesian3.dot(camera.direction, normal), -1, 1)
      );
      const wanted = currentTilt - dy * ORBIT_RAD_PER_PIXEL;
      const delta = Cesium.Math.clamp(wanted, 0, MAX_TILT) - currentTilt;
      if (delta) {
        Cartesian3.clone(camera.right, scratch.right);
        rotateCamera(scratch.right, delta, orbitCenter);
      }
    }
    clampHeight();
  }

  // ---- per-frame update: zoom smoothing, inertia --------------------------
  function tick() {
    if (destroyed) return;
    const now = performance.now();
    const dt = Math.min(50, Math.max(1, now - lastTick));
    lastTick = now;

    // Flights (flyTo / reset) set their own orientation
    if (camera._currentFlight !== undefined) {
      return;
    }

    let busy = false;

    if (mode === 'pan' && pendingPan && lastPointer) {
      applyPan(pendingPan, dt);
      pendingPan = null;
      busy = true;
    }

    if (zoom) {
      busy = true;
      const logHeight = Math.log(getHeight());
      const diff = Math.log(zoom.target) - logHeight;
      if (Math.abs(diff) < 0.002) {
        setHeight(zoom.target);
        reanchor(zoom.anchorWorld, zoom.anchorScreen);
        zoom = null;
      } else {
        setHeight(Math.exp(logHeight + diff * (1 - Math.exp(-dt / ZOOM_SMOOTH_MS))));
        reanchor(zoom.anchorWorld, zoom.anchorScreen);
      }
    }

    // A held-still pointer must not keep stale velocity for the release.
    if (mode === 'pan' && now - pan.lastMoveTime > 60) pan.velocity = 0;

    if (mode !== 'pan' && pan.velocity > MIN_PAN_VELOCITY) {
      busy = true;
      rotateCamera(pan.axis, pan.velocity * dt);
      pan.velocity *= Math.exp(-dt / inertiaTauMs);
      if (pan.velocity <= MIN_PAN_VELOCITY) {
        pan.velocity = 0;
      }
    }

    // Safety guard: ensure camera altitude never dips below minHeight
    if (getHeight() < minHeight) {
      clampHeight();
      busy = true;
    }

    if (busy) scene.requestRender();
  }

  // ---- wiring -------------------------------------------------------------
  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointercancel', onPointerUp);
  canvas.addEventListener('wheel', onWheel, { passive: false });
  canvas.addEventListener('contextmenu', onContextMenu);
  const removePreUpdate = scene.preUpdate.addEventListener(tick);

  return {
    destroy() {
      if (destroyed) return;
      destroyed = true;
      removePreUpdate();
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('pointercancel', onPointerUp);
      canvas.removeEventListener('wheel', onWheel);
      canvas.removeEventListener('contextmenu', onContextMenu);
      canvas.style.touchAction = previousTouchAction;
    },
  };
}
