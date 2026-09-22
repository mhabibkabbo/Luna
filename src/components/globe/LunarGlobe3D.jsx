import React, { useEffect, useRef, useState, useImperativeHandle, forwardRef } from 'react';
import { createCesiumMoon } from '../../cesium/createCesiumMoon.js';
import { RotateCw, Sun, Globe, Plus, Minus, Compass, Target, MapPin } from 'lucide-react';
import { LUNAR_FEATURES } from '../../data/lunarFeatures.js';
import { LANDING_SITES } from '../../data/landingSites.js';

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

  const [isAutoRotating, setIsAutoRotating] = useState(false);
  const [isSolarLighting, setIsSolarLighting] = useState(false);
  const [hoveredInfo, setHoveredInfo] = useState(null); // { feature, x, y }

  useEffect(() => {
    if (!globeContainerRef.current) return;

    const globe = createCesiumMoon(globeContainerRef.current, {
      onPointerCoordinates,
      onFeatureSelect,
      onDropCustomPin,
      onFeatureHover: (feature, x, y) => {
        if (feature) {
          setHoveredInfo({ feature, x, y });
        } else {
          setHoveredInfo(null);
        }
      },
    });

    globeInstanceRef.current = globe;

    return () => {
      globe.destroy();
      globeInstanceRef.current = null;
    };
  }, []);

  // Expose API via ref
  useImperativeHandle(ref, () => ({
    // Renamed from "resetView" to match the method name App.jsx actually calls
    // on the active controller (getActiveController()?.resetOverview()).
    resetOverview: () => {
      globeInstanceRef.current?.resetOverview();
    },
    zoomIn: () => {
      globeInstanceRef.current?.zoomIn();
    },
    zoomOut: () => {
      globeInstanceRef.current?.zoomOut();
    },
    // Renamed from "flyToSouthPole" to match App.jsx's
    // getActiveController()?.goToSouthPole(4.8) call. The zoom arg isn't
    // meaningful for a 3D camera altitude, so it's accepted but unused here.
    goToSouthPole: () => {
      globeInstanceRef.current?.flyToSouthPole();
    },
    flyTo: (lon, lat) => {
      globeInstanceRef.current?.flyToCoordinate(lon, lat, 1400000);
    },
    dropCustomPin: (lon, lat, name) => {
      return globeInstanceRef.current?.dropCustomPin(lon, lat, name);
    },
    clearCustomPin: () => {
      globeInstanceRef.current?.clearCustomPin();
    },
    selectFeature: (featureId) => {
      const feat =
        LUNAR_FEATURES.find((f) => f.id === featureId) ||
        LANDING_SITES.find((s) => s.id === featureId);
      if (feat) {
        globeInstanceRef.current?.flyToCoordinate(
          feat.longitude,
          feat.latitude,
          feat.type === 'mare' ? 2600000 : 900000
        );
      }
    },
    setLayerVisibility: (layerId, isVisible) => {
      globeInstanceRef.current?.setLayerVisibility(layerId, isVisible);
    },
  }));

  const handleToggleAutoRotate = () => {
    if (globeInstanceRef.current) {
      const state = globeInstanceRef.current.toggleAutoRotate();
      setIsAutoRotating(state);
    }
  };

  const handleToggleSolarLighting = () => {
    if (globeInstanceRef.current) {
      const state = globeInstanceRef.current.toggleLighting();
      setIsSolarLighting(state);
    }
  };

  const handleZoomIn = () => {
    globeInstanceRef.current?.zoomIn();
  };

  const handleZoomOut = () => {
    globeInstanceRef.current?.zoomOut();
  };

  const handleResetOverview = () => {
    globeInstanceRef.current?.resetOverview();
  };

  const handleFlySouthPole = () => {
    globeInstanceRef.current?.flyToSouthPole();
  };

  return (
    <div className="relative w-full h-full overflow-hidden select-none bg-[#050811]">
      {/* Cesium WebGL Canvas Container */}
      <div ref={globeContainerRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

      {/* Floating 3D Cesium Controls Bar */}
      <div className="absolute bottom-6 left-4 z-20 flex flex-wrap items-center gap-2 bg-slate-950/90 backdrop-blur-xl p-1.5 rounded-2xl border border-slate-800 shadow-2xl">
        <button
          type="button"
          onClick={handleToggleAutoRotate}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
            isAutoRotating
              ? 'bg-cyan-500 text-white border-cyan-400 shadow-md shadow-cyan-500/20'
              : 'bg-slate-900 text-slate-300 hover:text-white hover:bg-slate-800 border-slate-800'
          }`}
          title="Toggle Cesium Moon slow axial rotation"
        >
          <RotateCw className={`w-3.5 h-3.5 ${isAutoRotating ? 'animate-spin' : ''}`} />
          <span>{isAutoRotating ? 'Rotating' : 'Auto-Rotate'}</span>
        </button>

        <button
          type="button"
          onClick={handleToggleSolarLighting}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
            isSolarLighting
              ? 'bg-amber-500 text-white border-amber-400 shadow-md shadow-amber-500/20'
              : 'bg-slate-900 text-slate-300 hover:text-white hover:bg-slate-800 border-slate-800'
          }`}
          title="Toggle astronomical solar lighting vs full terrain illumination"
        >
          <Sun className="w-3.5 h-3.5" />
          <span>{isSolarLighting ? 'Solar Shading' : 'Full Sunlit'}</span>
        </button>

        <div className="w-[1px] h-4 bg-slate-800 mx-0.5" />

        {/* Quick Fly to South Pole */}
        <button
          type="button"
          onClick={handleFlySouthPole}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-slate-900 text-cyan-300 hover:text-cyan-100 hover:bg-slate-800 border border-slate-800 transition-all"
          title="Fly camera to Lunar South Pole (90°S) Artemis Landing Zone"
        >
          <Target className="w-3.5 h-3.5 text-cyan-400" />
          <span className="hidden sm:inline">South Pole</span>
        </button>

        {/* Reset Overview */}
        <button
          type="button"
          onClick={handleResetOverview}
          className="p-1.5 rounded-xl text-xs font-semibold bg-slate-900 text-slate-300 hover:text-white hover:bg-slate-800 border border-slate-800 transition-all"
          title="Reset to Full Moon Nearside Overview"
        >
          <Compass className="w-4 h-4 text-slate-400 hover:text-white" />
        </button>

        {/* Zoom In & Out */}
        <div className="flex items-center gap-1 bg-slate-900/80 p-0.5 rounded-xl border border-slate-800">
          <button
            type="button"
            onClick={handleZoomIn}
            className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-all"
            title="Smooth Zoom In (+)"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={handleZoomOut}
            className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-all"
            title="Smooth Zoom Out (-)"
          >
            <Minus className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* 3D Cesium Moon HUD Indicator */}
      <div className="absolute top-4 right-4 z-20 pointer-events-none hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-950/80 backdrop-blur-md border border-cyan-500/30 text-[11px] text-cyan-300 shadow-lg">
        <Globe className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
        <span className="font-mono">CesiumJS Moon (R = 1,737.4 km)</span>
      </div>

      {/* Floating Hover Feature Tooltip */}
      {hoveredInfo && hoveredInfo.feature && (
        <div
          className="fixed z-50 pointer-events-none transform -translate-x-1/2 -translate-y-full mb-3 px-3 py-2 bg-slate-950/95 backdrop-blur-xl border border-slate-700/80 rounded-xl shadow-2xl shadow-black/80 flex flex-col gap-0.5 animate-in fade-in zoom-in-95 duration-150"
          style={{
            left: `${hoveredInfo.x}px`,
            top: `${hoveredInfo.y - 12}px`,
          }}
        >
          <div className="flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-rose-500 shrink-0" />
            <span className="text-xs font-bold text-white tracking-wide">
              {hoveredInfo.feature.name}
            </span>
          </div>
          <div className="flex items-center gap-2 text-[10px] font-mono text-slate-400">
            <span className="capitalize text-cyan-300">{String(hoveredInfo.feature.type || 'feature').replace('_', ' ')}</span>
            <span>•</span>
            <span>
              {Math.abs(hoveredInfo.feature.latitude).toFixed(2)}°{hoveredInfo.feature.latitude >= 0 ? 'N' : 'S'},{' '}
              {Math.abs(hoveredInfo.feature.longitude).toFixed(2)}°{hoveredInfo.feature.longitude >= 0 ? 'E' : 'W'}
            </span>
          </div>
        </div>
      )}
    </div>
  );
});

export default LunarGlobe3D;
