/**
 * @file PlanetViewport.jsx
 * React viewport that mounts and coordinates the Moon and Earth Cesium viewers.
 */

import React, { useEffect, useRef, useState, useImperativeHandle, forwardRef } from 'react';
import { RotateCw, Sun, Globe, Plus, Minus, Compass, Target, MapPin, Moon } from 'lucide-react';
import { LUNAR_FEATURES } from '../../data/lunarFeatures.js';
import { LANDING_SITES } from '../../data/landingSites.js';
import { createPlanetManager } from '../../cesium/planetManager.js';

/**
 * Hosts the interactive Cesium planet viewers and bridges their controls to React.
 */
const PlanetViewport = forwardRef(function PlanetViewport(
  {
    onPointerCoordinates,
    onFeatureSelect,
    onDropCustomPin,
    hasCustomPin = false,
    onClearCustomPin,
    activePlanet = 'moon',
    onPlanetChange,
    isVisible = true,
  },
  ref
) {
  const moonContainerRef = useRef(null);
  const earthContainerRef = useRef(null);
  const planetManagerRef = useRef(null);
  const communicationLinkRef = useRef(null);
  const [currentPlanet, setCurrentPlanet] = useState(activePlanet || 'moon');

  const [isAutoRotating, setIsAutoRotating] = useState(false);
  const [isSolarLighting, setIsSolarLighting] = useState(false);
  const [hoveredInfo, setHoveredInfo] = useState(null); // { feature, x, y }

  // Sync external activePlanet prop
  useEffect(() => {
    if (planetManagerRef.current && activePlanet) {
      if (planetManagerRef.current.activeId !== activePlanet) {
        planetManagerRef.current.switchTo(activePlanet);
        setCurrentPlanet(activePlanet);
      }
    }
  }, [activePlanet]);

  // Pause every initialized planet viewer while this viewport is hidden.
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

        onFeatureHover: (feature, x, y) => {
          if (feature) {
            setHoveredInfo((prev) =>
              prev && prev.feature?.id === feature.id && Math.abs(prev.x - x) < 4 && Math.abs(prev.y - y) < 4
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

    // Window test hooks
    window.testEarth = () => {
      planetManagerRef.current?.switchTo('earth');
    };

    window.testMoon = () => {
      planetManagerRef.current?.switchTo('moon');
    };

    window.testZoomIn = () => {
      planetManagerRef.current?.active.zoomIn();
    };

    window.testZoomOut = () => {
      planetManagerRef.current?.active.zoomOut();
    };

    window.testReset = () => {
      planetManagerRef.current?.active.resetOverview();
    };

    return () => {
      delete window.testEarth;
      delete window.testMoon;
      delete window.testZoomIn;
      delete window.testZoomOut;
      delete window.testReset;

      planetManager.destroy();
      planetManagerRef.current = null;
    };
  }, []);

  // Expose API via ref
  useImperativeHandle(ref, () => ({
    getViewer: () => planetManagerRef.current?.planet('moon').getViewer(),
    getCelestialState: () =>
      planetManagerRef.current?.planet('moon').extras.celestial.getState(),
    getLightingEnabled: () =>
      planetManagerRef.current?.active.getLightingEnabled?.() ?? false,

    switchPlanet: (planetName) => {
      planetManagerRef.current?.switchTo(planetName);
      setCurrentPlanet(planetName);
      onPlanetChange?.(planetName);
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

    flyTo: (lon, lat) => {
      planetManagerRef.current?.active.flyTo(lon, lat, 1400000);
    },

    dropCustomPin: (lon, lat, name) => {
      return planetManagerRef.current?.active.extras.features.dropCustomPin(lon, lat, name);
    },

    clearCustomPin: (planetId = planetManagerRef.current?.activeId) => {
      planetManagerRef.current?.planet(planetId).extras.features.clearCustomPin();
    },

    toggleAutoRotate: () => {
      const state = planetManagerRef.current?.active.toggleAutoRotate();

      if (state !== undefined) {
        setIsAutoRotating(state);
      }

      return state ?? false;
    },

    toggleLighting: () => {
      const state = planetManagerRef.current?.active.toggleLighting();

      if (state !== undefined) {
        setIsSolarLighting(state);
      }

      return state ?? false;
    },

    selectFeature: (featureId) => {
      planetManagerRef.current?.switchTo('moon');
      const moon = planetManagerRef.current?.planet('moon');
      moon?.extras.features.selectFeaturePin(featureId);
      const feat =
        LUNAR_FEATURES.find(
          (f) => f.id === featureId
        ) ||
        LANDING_SITES.find(
          (s) => s.id === featureId
        );

      if (feat) {
        moon?.flyTo(
          feat.longitude,
          feat.latitude,
          feat.type === 'mare' ? 2600000 : 900000
        );
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
        planetManagerRef.current?.planet(planetId).setCommunicationLink(link);
      }
    },

    setLayerVisibility: (layerId, isVisible) => {
      planetManagerRef.current?.active.setLayerVisibility(layerId, isVisible);
    },

    // Earth & Sun celestial animation
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
    <div className="relative w-full h-full overflow-hidden select-none bg-black">
      {/* Subtle Deep Space Starfield (soft, distant, non-distracting background) */}
      <div
        className="absolute inset-0 pointer-events-none opacity-35"
        style={{
          backgroundImage: `
            radial-gradient(1px 1px at 12% 18%, #ffffff 100%, transparent 0),
            radial-gradient(1px 1px at 24% 54%, #93c5fd 100%, transparent 0),
            radial-gradient(1px 1px at 42% 28%, #e2e8f0 100%, transparent 0),
            radial-gradient(1px 1px at 64% 78%, #ffffff 100%, transparent 0),
            radial-gradient(1.2px 1.2px at 78% 32%, #fef08a 100%, transparent 0),
            radial-gradient(1px 1px at 88% 82%, #cbd5e1 100%, transparent 0),
            radial-gradient(1px 1px at 94% 20%, #ffffff 100%, transparent 0),
            radial-gradient(1px 1px at 32% 86%, #94a3b8 100%, transparent 0),
            radial-gradient(1.2px 1.2px at 16% 72%, #67e8f9 100%, transparent 0),
            radial-gradient(1px 1px at 52% 48%, #ffffff 100%, transparent 0)
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
        style={{ display: "none" }}
      />

      {/* Floating Hover Feature Tooltip */}
      {hoveredInfo?.feature && (
        <div
          className="fixed z-50 pointer-events-none transform -translate-x-1/2 -translate-y-full mb-3 px-3 py-2 bg-slate-950/95 backdrop-blur-xl border border-slate-700/80 rounded-xl shadow-2xl shadow-black/80 flex flex-col gap-0.5 animate-in fade-in zoom-in-95 duration-150"
          style={{
            left: `${hoveredInfo.x}px`,
            top: `${hoveredInfo.y - 12}px`,
          }}
        >
          {/* Feature Name */}
          <div className="flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-rose-500 shrink-0" />

            <span className="text-xs font-bold text-white tracking-wide">
              {hoveredInfo.feature.name}
            </span>
          </div>

          {/* Feature Type + Coordinates */}
          <div className="flex items-center gap-2 text-[10px] font-mono text-slate-400">
            <span className="capitalize text-cyan-300">
              {String(
                hoveredInfo.feature.type || "feature"
              ).replace("_", " ")}
            </span>

            <span>•</span>

            <span>
              {Math.abs(hoveredInfo.feature.latitude).toFixed(2)}°
              {hoveredInfo.feature.latitude >= 0 ? "N" : "S"},{" "}
              {Math.abs(hoveredInfo.feature.longitude).toFixed(2)}°
              {hoveredInfo.feature.longitude >= 0 ? "E" : "W"}
            </span>
          </div>
        </div>
      )}
    </div>
  )
});


export default PlanetViewport;
