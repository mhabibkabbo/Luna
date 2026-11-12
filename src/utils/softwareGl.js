export const isSoftwareGl = (() => {
  if (typeof document === 'undefined') return false;
  try {
    const canvas = document.createElement('canvas');
    const gl =
      canvas.getContext('webgl2') ||
      canvas.getContext('webgl') ||
      canvas.getContext('experimental-webgl');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param) || '');
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return true;
  }
})();

/**
 * Waits for all queued WebGL commands on `gl` to complete on the GPU/CPU rasterizer,
 * then pauses 80ms before invoking `cb` so the main thread and browser compositor stay responsive.
 *
 * @param {WebGLRenderingContext | WebGL2RenderingContext | null | undefined} gl
 * @param {() => void} cb
 * @returns {() => void} Cancel function
 */
export function afterDraw(gl, cb) {
  let timerId = 0;
  let cancelled = false;
  let sync = null;

  const cancel = () => {
    cancelled = true;
    if (timerId) {
      clearTimeout(timerId);
      timerId = 0;
    }
    if (sync && gl && typeof gl.deleteSync === 'function') {
      try {
        gl.deleteSync(sync);
      } catch {}
      sync = null;
    }
  };

  if (!gl || typeof gl.fenceSync !== 'function') {
    timerId = setTimeout(() => {
      if (!cancelled) cb();
    }, 80);
    return cancel;
  }

  try {
    sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    if (typeof gl.clientWaitSync === 'function' && sync) {
      gl.clientWaitSync(sync, gl.SYNC_FLUSH_COMMANDS_BIT, 0);
    }
    gl.flush();
  } catch {
    timerId = setTimeout(() => {
      if (!cancelled) cb();
    }, 60);
    return cancel;
  }

  let polls = 0;
  const MAX_SYNC_POLLS = 12;

  const poll = () => {
    if (cancelled) return;
    let state = gl.SIGNALED;
    try {
      state = sync ? gl.getSyncParameter(sync, gl.SYNC_STATUS) : gl.SIGNALED;
    } catch {
      state = gl.SIGNALED;
    }
    if (state === gl.UNSIGNALED && polls < MAX_SYNC_POLLS) {
      polls++;
      timerId = setTimeout(poll, 5);
    } else {
      if (sync) {
        try {
          gl.deleteSync(sync);
        } catch {}
        sync = null;
      }
      timerId = setTimeout(() => {
        if (!cancelled) cb();
      }, 60);
    }
  };

  timerId = setTimeout(poll, 5);
  return cancel;
}

/**
 * Attaches an on-demand, fence-paced render loop to a Cesium Viewer when running on software WebGL.
 * On hardware GPUs (`!isSoftwareGl`), delegates directly to Cesium's native `useDefaultRenderLoop`.
 *
 * @param {import('cesium').Viewer} viewer
 */
export function setupCesiumRenderLoop(viewer) {
  const scene = viewer.scene;
  if (!isSoftwareGl) {
    return {
      setActive(active) {
        if (viewer.isDestroyed()) return;
        viewer.useDefaultRenderLoop = Boolean(active);
        if (active) {
          viewer.resize?.();
          scene?.requestRender?.();
        }
      },
      destroy() {},
    };
  }

  // Software WebGL path: disable Cesium's unpaced 60Hz rAF loop and drive renders on demand with afterDraw
  viewer.useDefaultRenderLoop = false;
  if (scene.globe?._surface) {
    scene.globe._surface._loadQueueTimeSlice = 250;
  }

  let active = true;
  let destroyed = false;
  let renderBusy = false;
  let renderDirty = true;
  let rafId = 0;
  let pollTimerId = 0;
  let cancelAfterDraw = null;
  let tileSettleFrames = 0;
  let idlePolls = 0;
  const MAX_TILE_SETTLE_FRAMES = 10;
  const MAX_IDLE_POLLS = 25;

  const scheduleRender = () => {
    if (destroyed || !active || viewer.isDestroyed()) return;
    if (pollTimerId) {
      clearTimeout(pollTimerId);
      pollTimerId = 0;
    }
    if (renderBusy) {
      renderDirty = true;
      return;
    }
    renderBusy = true;
    rafId = requestAnimationFrame(() => {
      rafId = 0;
      if (destroyed || !active || viewer.isDestroyed()) {
        renderBusy = false;
        return;
      }
      renderDirty = false;
      try {
        viewer.resize?.();
        scene._renderRequested = true;
        viewer.render();
      } catch {}

      const gl = scene?.context?._gl;
      cancelAfterDraw = afterDraw(gl, () => {
        cancelAfterDraw = null;
        renderBusy = false;
        if (destroyed || !active || viewer.isDestroyed()) return;
        checkNeedsRender();
      });
    });
  };

  const checkNeedsRender = () => {
    if (destroyed || !active || viewer.isDestroyed()) return;
    const isFlying = viewer.camera._currentFlight !== undefined;
    const hasAfterRender = (scene.frameState?.afterRender?.length ?? 0) > 0;
    const rootTilesReady =
      Array.isArray(scene.globe?._surface?._levelZeroTiles) &&
      scene.globe._surface._levelZeroTiles.length > 0 &&
      scene.globe._surface._levelZeroTiles.every((t) => t.renderable);
    const tilesLoading =
      (!scene.globe?.tilesLoaded || !rootTilesReady) &&
      tileSettleFrames < MAX_TILE_SETTLE_FRAMES;

    if (renderDirty || scene._renderRequested || hasAfterRender || isFlying) {
      idlePolls = 0;
      scheduleRender();
    } else if (tilesLoading) {
      tileSettleFrames++;
      scheduleRender();
    } else if (idlePolls < MAX_IDLE_POLLS) {
      idlePolls++;
      pollTimerId = setTimeout(() => {
        pollTimerId = 0;
        const pendingAfterRender = (scene.frameState?.afterRender?.length ?? 0) > 0;
        if (pendingAfterRender || !scene.globe?.tilesLoaded || !rootTilesReady) {
          scheduleRender();
        } else {
          checkNeedsRender();
        }
      }, 120);
    }
  };

  const origRequestRender = scene.requestRender.bind(scene);
  scene.requestRender = function () {
    origRequestRender();
    renderDirty = true;
    idlePolls = 0;
    scheduleRender();
  };

  const removeCameraListener = viewer.camera.changed.addEventListener(() => {
    tileSettleFrames = 0;
    idlePolls = 0;
    renderDirty = true;
    scheduleRender();
  });

  scheduleRender();

  return {
    setActive(nextActive) {
      if (destroyed || viewer.isDestroyed()) return;
      active = Boolean(nextActive);
      viewer.useDefaultRenderLoop = false;
      if (active) {
        tileSettleFrames = 0;
        idlePolls = 0;
        renderDirty = true;
        scheduleRender();
      } else {
        if (rafId) {
          cancelAnimationFrame(rafId);
          rafId = 0;
        }
        if (pollTimerId) {
          clearTimeout(pollTimerId);
          pollTimerId = 0;
        }
        if (cancelAfterDraw) {
          cancelAfterDraw();
          cancelAfterDraw = null;
        }
        renderBusy = false;
      }
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      active = false;
      try {
        removeCameraListener?.();
      } catch {}
      if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = 0;
      }
      if (pollTimerId) {
        clearTimeout(pollTimerId);
        pollTimerId = 0;
      }
      if (cancelAfterDraw) {
        cancelAfterDraw();
        cancelAfterDraw = null;
      }
      renderBusy = false;
    },
  };
}
