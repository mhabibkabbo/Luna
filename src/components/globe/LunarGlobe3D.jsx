/* 
  File: LunarGlobe3D.js
*/

import React, { useEffect, useRef, useState, useImperativeHandle, forwardRef } from 'react';
import { createCesiumMoon } from '../../cesium/createCesiumMoon.js';
import { RotateCw, Sun, Globe, Plus, Minus, Compass, Target, MapPin, Moon } from 'lucide-react';
import { LUNAR_FEATURES } from '../../data/lunarFeatures.js';
import { LANDING_SITES } from '../../data/landingSites.js';
// Import Earth and planet manager
import { createEarthViewer } from '../../cesium/createEarthViewer.js';
import { createPlanetManager } from '../../cesium/createPlanetManager.js';

/**
 * 3D Interactive Cesium Moon component using CesiumJS and Cesium.Ellipsoid.MOON.
 * Features realistic NASA Moon Trek WMTS streaming tiles, spherical camera flight,
 * buttery-smooth zoom scaling, and persistent, depth-tested feature markers.
 */
const LunarGlobe3D = forwardRef(function LunarGlobe3D(
  {
    onPointerCoordinates,
    onFeatureSelect,
    onDropCustomPin,
    hasCustomPin = false,
    onClearCustomPin,
  },
  ref
) {
  const globeContainerRef = useRef(null);
  const globeInstanceRef = useRef(null);
  const moonContainerRef = useRef(null);
  const earthContainerRef = useRef(null);
  const planetManagerRef = useRef(null);
  const [activePlanet, setActivePlanet] = useState('moon');

  const [isAutoRotating, setIsAutoRotating] = useState(false);
  const [isSolarLighting, setIsSolarLighting] = useState(false);
  const [hoveredInfo, setHoveredInfo] = useState(null); // { feature, x, y }

    useEffect(() => {
    if (
      !moonContainerRef.current ||
      !earthContainerRef.current
    ) {
      return;
    }

    const moonController =
      createCesiumMoon(
        moonContainerRef.current,
        {
          onPointerCoordinates,
          onFeatureSelect,
          onDropCustomPin,

          onFeatureHover: (feature, x, y) => {
            if (feature) {
              setHoveredInfo({
                feature,
                x,
                y,
              });
            } else {
              setHoveredInfo(null);
            }
          },
        }
      );

    const earthController =
      createEarthViewer(
        earthContainerRef.current
      );

    const planetManager =
      createPlanetManager({
        moonController,
        earthController,
      });

    planetManagerRef.current =
      planetManager;

    setActivePlanet(
      planetManager.getActivePlanet()
    );

    // TESTING ONLY 
    window.testEarth = () => {
      planetManagerRef.current?.switchTo('earth');
    };

    window.testMoon = () => {
      planetManagerRef.current?.switchTo('moon');
    };

    window.testZoomIn = () => {
      planetManagerRef.current?.zoomIn();
    };

    window.testZoomOut = () => {
      planetManagerRef.current?.zoomOut();
    };

    window.testReset = () => {
      planetManagerRef.current?.resetOverview();
    };

    // RETURN (cleanup basically)
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
    switchPlanet: (planetName) => {
      planetManagerRef.current?.switchTo(planetName);
      setActivePlanet(planetName);
    },

    getActivePlanet: () => {
      return planetManagerRef.current?.getActivePlanet();
    },

    resetOverview: () => {
      planetManagerRef.current?.resetOverview();
    },

    zoomIn: () => {
      planetManagerRef.current?.zoomIn();
    },

    zoomOut: () => {
      planetManagerRef.current?.zoomOut();
    },

    flyTo: (lon, lat) => {
      planetManagerRef.current?.flyToCoordinate(
        lon,
        lat,
        1400000
      );
    },

    dropCustomPin: (lon, lat, name) => {
      return planetManagerRef.current?.dropCustomPin(
        lon,
        lat,
        name
      );
    },

    clearCustomPin: () => {
      planetManagerRef.current?.clearCustomPin();
    },

    toggleAutoRotate: () => {
      const state =
        planetManagerRef.current?.toggleAutoRotate();

      if (state !== undefined) {
        setIsAutoRotating(state);
      }

      return state ?? false;
    },

    toggleLighting: () => {
      const state =
        planetManagerRef.current?.toggleLighting();

      if (state !== undefined) {
        setIsSolarLighting(state);
      }

      return state ?? false;
    },

    selectFeature: (featureId) => {
      const feat =
        LUNAR_FEATURES.find(
          (f) => f.id === featureId
        ) ||
        LANDING_SITES.find(
          (s) => s.id === featureId
        );

      if (feat) {
        planetManagerRef.current?.flyToCoordinate(
          feat.longitude,
          feat.latitude,
          feat.type === 'mare'
            ? 2600000
            : 900000
        );
      }
    },

    setLayerVisibility: (layerId, isVisible) => {
      planetManagerRef.current?.setLayerVisibility(
        layerId,
        isVisible
      );
    },

    // Earth & Sun celestial animation
    setCelestialTime: (date) =>
      planetManagerRef.current?.setCelestialTime(date),

    setCelestialVisible: (visible) =>
      planetManagerRef.current?.setCelestialVisible(visible),

    flyToCelestialOverview: () =>
      planetManagerRef.current?.flyToCelestialOverview(),
  }));

  return (
    <div className="relative w-full h-full overflow-hidden select-none bg-[#050811]">
      {/* 3D WebGL Canvas Containers */}
      <div ref={moonContainerRef} className="absolute inset-0" />

      <div
        ref={earthContainerRef}
        className="absolute inset-0"
        style={{ display: "none" }}
      />

      {/* PLANET SWITCHER BUTTON */}
      <button
        type="button"
        onClick={() => {
          const nextPlanet = activePlanet === "moon" ? "earth" : "moon";

          planetManagerRef.current?.switchTo(nextPlanet);
          setActivePlanet(nextPlanet);
        }}
        className="absolute top-14 left-4 z-20 pointer-events-auto flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium text-slate-200 bg-slate-900/90 border border-slate-700/80 hover:bg-slate-800 hover:text-white transition-all shadow-xl backdrop-blur-md"
        title={`Switch to ${activePlanet === "moon" ? "Earth" : "Moon"}`}
      >
        {activePlanet === "moon" ? (
          <Globe className="h-4 w-4 text-cyan-400" />
        ) : (
          <Moon className="h-4 w-4 text-amber-300" />
        )}

        <span>
          Switch to {activePlanet === "moon" ? "Earth" : "Moon"}
        </span>
      </button>

      {/* 3D Cesium HUD Indicator */}
      <div className="absolute top-4 right-4 z-10 pointer-events-none hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-950/80 backdrop-blur-md border border-cyan-500/30 text-[11px] text-cyan-300 shadow-lg">
        <Globe className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />

        <span className="font-mono">
          {activePlanet === "moon" ? "CesiumJS Moon" : "CesiumJS Earth"}
        </span>
      </div>

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


export default LunarGlobe3D;
