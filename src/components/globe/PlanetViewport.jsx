import React, { useEffect, useRef, useState, useImperativeHandle, forwardRef } from 'react';
import { AlertTriangle, MapPin } from 'lucide-react';
import { LUNAR_FEATURES } from '../../data/lunarFeatures.js';
import { LANDING_SITES } from '../../data/landingSites.js';
import { createPlanetManager } from '../../cesium/planetManager.js';
import CesiumLoadingOverlay from '../common/CesiumLoadingOverlay.jsx';

const PlanetViewport = forwardRef(function PlanetViewport(
  {
    onPointerCoordinates,
    onFeatureSelect,
    onDropCustomPin,
    customPin = null,
    hasCustomPin = false,
    activePlanet = 'moon',
    onPlanetChange,
    onSwitchTo2D,
    isVisible = true,
    layers = [],
  },
  ref
) {
  const moonContainerRef = useRef(null);
  const earthContainerRef = useRef(null);
  const planetManagerRef = useRef(null);
  const communicationLinkRef = useRef(null);
  const planetSwitchSeqRef = useRef(0);
  const activePlanetRef = useRef(activePlanet || 'moon');
  const [initRetryKey, setInitRetryKey] = useState(0);
  const [currentPlanet, setCurrentPlanet] = useState(activePlanet || 'moon');
  const [initializedPlanets, setInitializedPlanets] = useState(() => [
    activePlanet === 'earth' ? 'earth' : 'moon',
  ]);

  const [isCesiumLoading, setIsCesiumLoading] = useState(true);
  const [loadingStage, setLoadingStage] = useState('Initializing 3D Planetary Studio...');
  const [pendingTiles, setPendingTiles] = useState(0);
  const [hoveredInfo, setHoveredInfo] = useState(null);
  const [webglError, setWebglError] = useState(null);

  const refreshInitializedPlanets = () => {
    const list = planetManagerRef.current?.getInitializedPlanets?.();
    if (Array.isArray(list)) {
      setInitializedPlanets((prev) =>
        prev.length === list.length && prev.every((id, idx) => id === list[idx])
          ? prev
          : list
      );
    }
  };

  const syncPlanetLayerVisibility = (planetId) => {
    const manager = planetManagerRef.current;
    if (!manager || !manager.hasPlanet?.(planetId)) return;
    const controller = manager.planet(planetId);
    for (const layer of layers) {
      const isEarthLayer = layer.id.startsWith('earth-');
      if (planetId === 'earth' && isEarthLayer) {
        controller.setLayerVisibility(layer.id, layer.visible, layer.opacity);
      } else if (planetId === 'moon' && !isEarthLayer) {
        controller.setLayerVisibility(layer.id, layer.visible, layer.opacity);
      }
    }
  };

  useEffect(() => {
    // Generous fallback safety timeout in case offline or network stall
    const safetyTimer = setTimeout(() => {
      setIsCesiumLoading((prev) => {
        if (prev) {
          console.info('[PlanetViewport] Fallback timer elapsed, revealing available terrain.');
          return false;
        }
        return false;
      });
    }, 8000);
    return () => clearTimeout(safetyTimer);
  }, []);

  const performGatedPlanetSwitch = (targetPlanet) => {
    const manager = planetManagerRef.current;
    if (!manager || !targetPlanet) return;
    if (manager.activeId === targetPlanet && currentPlanet === targetPlanet) return;

    const seq = ++planetSwitchSeqRef.current;
    activePlanetRef.current = targetPlanet;
    setCurrentPlanet(targetPlanet);
    setHoveredInfo(null);
    setIsCesiumLoading(true);
    setLoadingStage(
      targetPlanet === 'earth'
        ? 'Loading 3D Earth Surface & Deep Space Network...'
        : 'Loading 3D Lunar Surface & Topographic Basemap...'
    );

    requestAnimationFrame(() => {
      if (seq !== planetSwitchSeqRef.current || !planetManagerRef.current) return;
      try {
        manager.switchTo(targetPlanet);
        refreshInitializedPlanets();
        syncPlanetLayerVisibility(targetPlanet);
        const activeCtrl = manager.active;
        const readyPromise = activeCtrl?.waitUntilReady?.() || Promise.resolve();
        readyPromise.finally(() => {
          if (seq === planetSwitchSeqRef.current) {
            setIsCesiumLoading(false);
          }
        });
      } catch (err) {
        console.error('Failed to switch planet:', err);
        if (seq === planetSwitchSeqRef.current) {
          setIsCesiumLoading(false);
        }
      }
    });
  };

  useEffect(() => {
    if (planetManagerRef.current && activePlanet) {
      if (planetManagerRef.current.activeId !== activePlanet) {
        performGatedPlanetSwitch(activePlanet);
      }
    }
  }, [activePlanet]);

  // Pause every initialized planet viewer while this viewport is hidden
  useEffect(() => {
    planetManagerRef.current?.setVisible(isVisible);
  }, [isVisible]);

  useEffect(() => {
    const moonEl = moonContainerRef.current;
    const earthEl = earthContainerRef.current;
    if (!moonEl) {
      return;
    }

    const handleContextLost = (e) => {
      e.preventDefault();
      setWebglError('3D graphics context was lost due to GPU reset or browser resource limits.');
      setIsCesiumLoading(false);
    };
    const handleContextRestored = () => {
      setWebglError(null);
    };

    moonEl.addEventListener('webglcontextlost', handleContextLost, true);
    moonEl.addEventListener('webglcontextrestored', handleContextRestored, true);
    earthEl?.addEventListener('webglcontextlost', handleContextLost, true);
    earthEl?.addEventListener('webglcontextrestored', handleContextRestored, true);

    let planetManager = null;
    try {
      planetManager = createPlanetManager({
        containers: {
          moon: moonEl,
          earth: earthEl,
        },
        callbacks: {
          onPointerCoordinates,
          onFeatureSelect,
          onDropCustomPin,

          onLoadingStageChange: (stage) => {
            setLoadingStage(stage);
          },

          onTileLoadProgress: (queuedCount) => {
            setPendingTiles(queuedCount);
            if (queuedCount === 0) {
              setIsCesiumLoading(false);
            }
          },

          onInitialized: () => {
            setIsCesiumLoading(false);
          },

          onFeatureHover: (feature, x, y, sourcePlanet) => {
            if (sourcePlanet !== activePlanetRef.current) return;
            if (feature) {
              setHoveredInfo((prev) =>
                prev &&
                prev.feature?.id === feature.id &&
                Math.abs(prev.x - x) < 4 &&
                Math.abs(prev.y - y) < 4
                  ? prev
                  : { feature, x, y }
              );
            } else {
              setHoveredInfo((prev) => (prev === null ? prev : null));
            }
          },
        },
        initialPlanet: activePlanet || 'moon',
        isVisible,
      });

      planetManagerRef.current = planetManager;
      activePlanetRef.current = planetManager.activeId;
      setCurrentPlanet(planetManager.activeId);
      refreshInitializedPlanets();
      syncPlanetLayerVisibility(planetManager.activeId);
      setWebglError(null);

      const activeCtrl = planetManager.active;
      activeCtrl?.waitUntilReady?.().finally(() => {
        setIsCesiumLoading(false);
        if (customPin) {
          const isCustom = Boolean(
            customPin.isCustomPin ||
            customPin.type === 'custom_pin' ||
            (typeof customPin.id === 'string' && (customPin.id.startsWith('sp-probe-') || customPin.id.startsWith('custom-')))
          );
          if (isCustom) {
            const lon = customPin.longitude ?? customPin.lon;
            const lat = customPin.latitude ?? customPin.lat;
            const pinPlanet = customPin.body === 'earth' ? 'earth' : 'moon';
            if (Number.isFinite(lon) && Number.isFinite(lat) && planetManager.hasPlanet(pinPlanet)) {
              try {
                planetManager.planet(pinPlanet).extras.features.dropCustomPin(lon, lat, customPin.name);
                refreshInitializedPlanets();
              } catch {}
            }
          }
        }
      });
    } catch (err) {
      console.error('[PlanetViewport] WebGL initialization failed:', err);
      try {
        planetManager?.destroy?.();
      } catch {}
      planetManagerRef.current = null;
      setIsCesiumLoading(false);
      setWebglError(err?.message || 'Hardware or WebGL 3D rendering is unavailable in this browser.');
    }

    return () => {
      moonEl.removeEventListener('webglcontextlost', handleContextLost, true);
      moonEl.removeEventListener('webglcontextrestored', handleContextRestored, true);
      earthEl?.removeEventListener('webglcontextlost', handleContextLost, true);
      earthEl?.removeEventListener('webglcontextrestored', handleContextRestored, true);
      try {
        planetManagerRef.current?.destroy?.();
      } catch {}
      planetManagerRef.current = null;
    };
  }, [initRetryKey]);

  useEffect(() => {
    if (!customPin) {
      return;
    }
    const isCustom = Boolean(
      customPin.isCustomPin ||
      customPin.type === 'custom_pin' ||
      (typeof customPin.id === 'string' && (customPin.id.startsWith('sp-probe-') || customPin.id.startsWith('custom-')))
    );
    if (!isCustom) return;

    const lon = customPin.longitude ?? customPin.lon;
    const lat = customPin.latitude ?? customPin.lat;
    if (!Number.isFinite(lon) || !Number.isFinite(lat)) return;

    const pinPlanet = customPin.body === 'earth' ? 'earth' : 'moon';
    const manager = planetManagerRef.current;
    if (manager && manager.hasPlanet(pinPlanet)) {
      try {
        manager.planet(pinPlanet).extras.features.dropCustomPin(lon, lat, customPin.name);
        refreshInitializedPlanets();
      } catch (err) {
        console.warn('[PlanetViewport] Failed to drop custom pin on globe:', err);
      }
    }
  }, [customPin, currentPlanet]);

  useEffect(() => {
    if (planetManagerRef.current?.activeId === currentPlanet) {
      syncPlanetLayerVisibility(currentPlanet);
    }
  }, [currentPlanet, layers]);

  useImperativeHandle(ref, () => ({
    getViewer: () => planetManagerRef.current?.active?.getViewer(),
    hasPlanet: (planetId) => planetManagerRef.current?.hasPlanet?.(planetId) ?? false,
    getInitializedPlanets: () => planetManagerRef.current?.getInitializedPlanets?.() ?? [],
    getCelestialState: () =>
      planetManagerRef.current?.hasPlanet?.('moon')
        ? planetManagerRef.current?.planet('moon').extras.celestial.getState()
        : null,
    getLightingEnabled: () =>
      planetManagerRef.current?.active.getLightingEnabled?.() ?? false,

    switchPlanet: (planetName) => {
      performGatedPlanetSwitch(planetName);
    },

    getActivePlanet: () => {
      return planetManagerRef.current?.activeId || currentPlanet;
    },

    resetOverview: () => {
      planetManagerRef.current?.active.resetOverview();
    },

    zoomIn: () => {
      planetManagerRef.current?.active.zoomIn();
    },

    zoomOut: () => {
      planetManagerRef.current?.active.zoomOut();
    },

    flyTo: (lon, lat, heightOrZoom) => {
      const targetHeight =
        typeof heightOrZoom === 'number' && heightOrZoom > 100
          ? heightOrZoom
          : null;
      planetManagerRef.current?.active.flyTo(lon, lat, targetHeight);
    },

    dropCustomPin: (lon, lat, name, planetId = planetManagerRef.current?.activeId) => {
      const target = planetId || 'moon';
      const res = planetManagerRef.current?.planet(target).extras.features.dropCustomPin(lon, lat, name);
      refreshInitializedPlanets();
      return res;
    },

    clearCustomPin: (planetId = planetManagerRef.current?.activeId) => {
      if (!planetManagerRef.current?.hasPlanet?.(planetId)) return;
      planetManagerRef.current?.planet(planetId).extras.features.clearCustomPin();
    },

    toggleAutoRotate: () => {
      return planetManagerRef.current?.active.toggleAutoRotate() ?? false;
    },

    toggleLighting: (planetId) => {
      const controller =
        planetId && planetManagerRef.current?.hasPlanet?.(planetId)
          ? planetManagerRef.current?.planet(planetId)
          : planetManagerRef.current?.active;
      return controller?.toggleLighting() ?? false;
    },

    setLightingEnabled: (enabled, planetId) => {
      const controller =
        planetId && planetManagerRef.current?.hasPlanet?.(planetId)
          ? planetManagerRef.current?.planet(planetId)
          : planetManagerRef.current?.active;
      return controller?.setLightingEnabled(enabled) ?? false;
    },

    selectFeature: (featureId) => {
      performGatedPlanetSwitch('moon');
      const moon = planetManagerRef.current?.planet('moon');
      refreshInitializedPlanets();
      moon?.extras.features.selectFeaturePin(featureId);
      const feat =
        LUNAR_FEATURES.find((f) => f.id === featureId) ||
        LANDING_SITES.find((s) => s.id === featureId);

      if (feat) {
        moon?.flyTo(feat.longitude, feat.latitude);
      }
    },

    selectFeaturePin: (featureId, planetId = currentPlanet) => {
      if (!featureId && !planetManagerRef.current?.hasPlanet?.(planetId)) return;
      planetManagerRef.current?.planet(planetId).extras.features.selectFeaturePin(featureId);
      refreshInitializedPlanets();
    },

    setCommunicationLink: (link) => {
      const previousLink = communicationLinkRef.current;
      communicationLinkRef.current = link;
      if (!link && !previousLink) return;
      planetManagerRef.current?.setCommunicationLink?.(link);
    },

    setLayerVisibility: (layerId, visible, opacity) => {
      planetManagerRef.current?.active.setLayerVisibility(layerId, visible, opacity);
    },

    setCelestialVisible: (visible) => {
      if (!planetManagerRef.current?.hasPlanet?.('moon')) return;
      return planetManagerRef.current?.planet('moon').extras.celestial.setCelestialVisible(visible);
    },

    setCelestialVectorsVisible: (visible) => {
      if (!planetManagerRef.current?.hasPlanet?.('moon')) return;
      return planetManagerRef.current?.planet('moon').extras.celestial.setVectorsVisible(visible);
    },

    areCelestialVectorsVisible: () =>
      planetManagerRef.current?.hasPlanet?.('moon')
        ? planetManagerRef.current?.planet('moon').extras.celestial.areVectorsVisible() ?? false
        : false,

    flyToCelestialOverview: () =>
      planetManagerRef.current?.planet('moon').extras.celestial.flyToCelestialOverview(),
  }));

  return (
    <div
      role="region"
      aria-label="Interactive 3D planetary globe viewer"
      data-active-planet={currentPlanet}
      data-initialized-planets={initializedPlanets.join(',')}
      className="relative w-full h-full overflow-hidden select-none bg-[#050507]"
    >
      <div
        className="planet-starfield absolute inset-0 pointer-events-none opacity-40"
        style={{
          backgroundImage: `
            radial-gradient(1px 1px at 12% 18%, #F8FAFC 100%, transparent 0),
            radial-gradient(1px 1px at 24% 54%, #00D2C4 100%, transparent 0),
            radial-gradient(1px 1px at 42% 28%, #34D399 100%, transparent 0),
            radial-gradient(1px 1px at 64% 78%, #F8FAFC 100%, transparent 0),
            radial-gradient(1.2px 1.2px at 78% 32%, #22D3EE 100%, transparent 0),
            radial-gradient(1px 1px at 88% 82%, #94A3B8 100%, transparent 0)
          `,
          backgroundRepeat: 'repeat',
          backgroundSize: '360px 360px',
        }}
      />

      <div
        ref={moonContainerRef}
        className="absolute inset-0"
        style={{ display: currentPlanet === 'moon' ? 'block' : 'none' }}
      />
      <div
        ref={earthContainerRef}
        className="absolute inset-0"
        style={{ display: currentPlanet === 'earth' ? 'block' : 'none' }}
      />

      <CesiumLoadingOverlay
        isInitializing={isCesiumLoading && !webglError}
        stage={loadingStage}
        pendingTiles={pendingTiles}
        planet={currentPlanet}
      />

      {webglError && (
        <div
          role="alert"
          className="absolute inset-0 z-40 flex items-center justify-center p-6 bg-[#050507]/90 backdrop-blur-md"
        >
          <div className="max-w-md w-full rounded-2xl border border-amber-500/30 bg-[#0C0D12] p-6 text-center shadow-2xl space-y-4">
            <div className="w-11 h-11 mx-auto rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-300">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div className="space-y-1.5">
              <h2 className="text-base font-semibold text-white">3D WebGL Globe Unavailable</h2>
              <p className="text-xs text-[#94A3B8] leading-relaxed">{webglError}</p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setWebglError(null);
                  setIsCesiumLoading(true);
                  setLoadingStage('Retrying 3D Planetary Studio...');
                  setInitRetryKey((k) => k + 1);
                }}
                className="inline-flex items-center justify-center px-4 py-2 rounded-xl border border-white/20 bg-white/10 text-white text-xs font-semibold hover:bg-white/15 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70"
              >
                Retry 3D
              </button>
              {onSwitchTo2D && (
                <button
                  type="button"
                  onClick={onSwitchTo2D}
                  className="inline-flex items-center justify-center px-4 py-2 rounded-xl bg-white text-[#050507] text-xs font-semibold hover:bg-slate-200 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70"
                >
                  Switch to 2D South Pole Map
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {hoveredInfo?.feature && (() => {
        const vw = typeof window !== 'undefined' ? window.innerWidth : 1280;
        const clampedX = Math.max(116, Math.min(vw - 116, hoveredInfo.x));
        const flipBelow = hoveredInfo.y < 88;
        const clampedY = flipBelow ? hoveredInfo.y + 18 : hoveredInfo.y - 12;
        const hasCoords =
          Number.isFinite(hoveredInfo.feature.latitude) &&
          Number.isFinite(hoveredInfo.feature.longitude);
        return (
          <div
            className={`fixed z-50 pointer-events-none transform -translate-x-1/2 ${
              flipBelow ? '' : '-translate-y-full'
            } px-3.5 py-2 bg-[#050507]/95 backdrop-blur-xl border border-[#1E2028] rounded-xl shadow-2xl flex flex-col gap-0.5 animate-in fade-in zoom-in-95 duration-150`}
            style={{
              left: `${clampedX}px`,
              top: `${clampedY}px`,
            }}
          >
            <div className="flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-[#F8FAFC] shrink-0" />
              <span className="text-xs font-bold text-[#F8FAFC] tracking-wide">
                {hoveredInfo.feature.name}
              </span>
            </div>

            <div className="flex items-center gap-2 text-[10px] font-mono text-[#94A3B8] tabular-nums">
              <span className="capitalize text-[#34D399]">
                {String(hoveredInfo.feature.type || 'feature').replace('_', ' ')}
              </span>
              {hasCoords && (
                <>
                  <span>·</span>
                  <span>
                    {Math.abs(hoveredInfo.feature.latitude).toFixed(2)}°
                    {hoveredInfo.feature.latitude >= 0 ? 'N' : 'S'},{' '}
                    {Math.abs(hoveredInfo.feature.longitude).toFixed(2)}°
                    {hoveredInfo.feature.longitude >= 0 ? 'E' : 'W'}
                  </span>
                </>
              )}
            </div>
          </div>
        );
      })()}
    </div>
  );
});

export default PlanetViewport;
