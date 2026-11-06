/**
 * @file PlanetViewport.jsx
 * React viewport that mounts and coordinates the Moon and Earth Cesium viewers,
 * enforcing a complete map readiness gate before revealing the switched planet.
 */

import React, { useEffect, useRef, useState, useImperativeHandle, forwardRef } from 'react';
import { MapPin } from 'lucide-react';
import { LUNAR_FEATURES } from '../../data/lunarFeatures.js';
import { LANDING_SITES } from '../../data/landingSites.js';
import { createPlanetManager } from '../../cesium/planetManager.js';
import CesiumLoadingOverlay from '../common/CesiumLoadingOverlay.jsx';

const PlanetViewport = forwardRef(function PlanetViewport(
  {
    onPointerCoordinates,
    onFeatureSelect,
    onDropCustomPin,
    activePlanet = 'moon',
    onPlanetChange,
    isVisible = true,
    layers = [],
  },
  ref
) {
  const moonContainerRef = useRef(null);
  const earthContainerRef = useRef(null);
  const planetManagerRef = useRef(null);
  const communicationLinkRef = useRef(null);
  const [currentPlanet, setCurrentPlanet] = useState(activePlanet || 'moon');

  const [isCesiumLoading, setIsCesiumLoading] = useState(true);
  const [loadingStage, setLoadingStage] = useState('Initializing 3D Planetary Studio...');
  const [pendingTiles, setPendingTiles] = useState(0);
  const [hoveredInfo, setHoveredInfo] = useState(null);

  const syncPlanetLayerVisibility = (planetId) => {
    const manager = planetManagerRef.current;
    if (!manager) return;
    const layerPrefix = planetId === 'earth' ? 'earth-' : 'lunar-';
    const controller = manager.planet(planetId);
    for (const layer of layers) {
      if (layer.id.startsWith(layerPrefix)) {
        controller.setLayerVisibility(layer.id, layer.visible);
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

  // Perform a gated planet switch that waits until the target planet's imagery & tiles are loaded
  const performGatedPlanetSwitch = (targetPlanet) => {
    const manager = planetManagerRef.current;
    if (!manager || !targetPlanet) return;
    if (manager.activeId === targetPlanet && currentPlanet === targetPlanet) return;

    setCurrentPlanet(targetPlanet);
    setIsCesiumLoading(true);
    setLoadingStage(
      targetPlanet === 'earth'
        ? 'Loading 3D Earth Surface & Deep Space Network...'
        : 'Loading 3D Lunar Surface & Topographic Basemap...'
    );

    // Allow loading overlay to paint before activating & waiting for target globe
    requestAnimationFrame(() => {
      try {
        manager.switchTo(targetPlanet);
        syncPlanetLayerVisibility(targetPlanet);
        const activeCtrl = manager.active;
        const readyPromise = activeCtrl?.waitUntilReady?.() || Promise.resolve();
        readyPromise.finally(() => {
          setIsCesiumLoading(false);
        });
      } catch (err) {
        console.error('Failed to switch planet:', err);
        setIsCesiumLoading(false);
      }
    });
  };

  // Sync external activePlanet prop with readiness gate
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
    if (!moonContainerRef.current) {
      return;
    }

    const planetManager = createPlanetManager({
      containers: {
        moon: moonContainerRef.current,
        earth: earthContainerRef.current,
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

        onFeatureHover: (feature, x, y) => {
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
    setCurrentPlanet(planetManager.activeId);
    syncPlanetLayerVisibility(planetManager.activeId);

    return () => {
      planetManager.destroy();
      planetManagerRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (planetManagerRef.current?.activeId === currentPlanet) {
      syncPlanetLayerVisibility(currentPlanet);
    }
  }, [currentPlanet, layers]);

  useImperativeHandle(ref, () => ({
    getViewer: () => planetManagerRef.current?.planet('moon').getViewer(),
    getCelestialState: () =>
      planetManagerRef.current?.planet('moon').extras.celestial.getState(),
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
      return planetManagerRef.current?.planet(target).extras.features.dropCustomPin(lon, lat, name);
    },

    clearCustomPin: (planetId = planetManagerRef.current?.activeId) => {
      planetManagerRef.current?.planet(planetId).extras.features.clearCustomPin();
    },

    toggleAutoRotate: () => {
      return planetManagerRef.current?.active.toggleAutoRotate() ?? false;
    },

    toggleLighting: (planetId) => {
      const controller = planetId
        ? planetManagerRef.current?.planet(planetId)
        : planetManagerRef.current?.active;
      return controller?.toggleLighting() ?? false;
    },

    setLightingEnabled: (enabled, planetId) => {
      const controller = planetId
        ? planetManagerRef.current?.planet(planetId)
        : planetManagerRef.current?.active;
      return controller?.setLightingEnabled(enabled) ?? false;
    },

    selectFeature: (featureId) => {
      performGatedPlanetSwitch('moon');
      const moon = planetManagerRef.current?.planet('moon');
      moon?.extras.features.selectFeaturePin(featureId);
      const feat =
        LUNAR_FEATURES.find((f) => f.id === featureId) ||
        LANDING_SITES.find((s) => s.id === featureId);

      if (feat) {
        moon?.flyTo(feat.longitude, feat.latitude);
      }
    },

    selectFeaturePin: (featureId, planetId = currentPlanet) => {
      planetManagerRef.current?.planet(planetId).extras.features.selectFeaturePin(featureId);
    },

    setCommunicationLink: (link) => {
      const previousLink = communicationLinkRef.current;
      communicationLinkRef.current = link;
      if (!link && !previousLink) return;
      for (const planetId of ['moon', 'earth']) {
        try {
          planetManagerRef.current?.planet(planetId).setCommunicationLink(link);
        } catch {}
      }
    },

    setLayerVisibility: (layerId, visible) => {
      planetManagerRef.current?.active.setLayerVisibility(layerId, visible);
    },

    setCelestialVisible: (visible) =>
      planetManagerRef.current?.planet('moon').extras.celestial.setCelestialVisible(visible),

    setCelestialVectorsVisible: (visible) =>
      planetManagerRef.current?.planet('moon').extras.celestial.setVectorsVisible(visible),

    areCelestialVectorsVisible: () =>
      planetManagerRef.current?.planet('moon').extras.celestial.areVectorsVisible() ?? false,

    flyToCelestialOverview: () =>
      planetManagerRef.current?.planet('moon').extras.celestial.flyToCelestialOverview(),
  }));

  return (
    <div
      role="region"
      aria-label="Interactive 3D planetary globe viewer"
      className="relative w-full h-full overflow-hidden select-none bg-[#050507]"
    >
      {/* Space Starfield Backdrop */}
      <div
        className="absolute inset-0 pointer-events-none opacity-40"
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

      {/* 3D WebGL Canvas Containers */}
      <div ref={moonContainerRef} className="absolute inset-0" />
      <div
        ref={earthContainerRef}
        className="absolute inset-0"
        style={{ display: 'none' }}
      />

      {/* Global Cesium Initialization & Planet Switch Readiness Gate Overlay */}
      <CesiumLoadingOverlay
        isInitializing={isCesiumLoading}
        stage={loadingStage}
        pendingTiles={pendingTiles}
        planet={currentPlanet}
      />

      {/* Floating Hover Feature Tooltip */}
      {hoveredInfo?.feature && (
        <div
          className="fixed z-50 pointer-events-none transform -translate-x-1/2 -translate-y-full mb-3 px-3.5 py-2 bg-[#050507]/95 backdrop-blur-xl border border-[#1E2028] rounded-xl shadow-2xl flex flex-col gap-0.5 animate-in fade-in zoom-in-95 duration-150"
          style={{
            left: `${hoveredInfo.x}px`,
            top: `${hoveredInfo.y - 12}px`,
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
            <span>·</span>
            <span>
              {Math.abs(hoveredInfo.feature.latitude).toFixed(2)}°
              {hoveredInfo.feature.latitude >= 0 ? 'N' : 'S'},{' '}
              {Math.abs(hoveredInfo.feature.longitude).toFixed(2)}°
              {hoveredInfo.feature.longitude >= 0 ? 'E' : 'W'}
            </span>
          </div>
        </div>
      )}
    </div>
  );
});

export default PlanetViewport;
