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
    resetOverview: () => {
      globeInstanceRef.current?.resetOverview();
    },
    zoomIn: () => {
      globeInstanceRef.current?.zoomIn();
    },
    zoomOut: () => {
      globeInstanceRef.current?.zoomOut();
    },
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
    toggleAutoRotate: () => {
      if (globeInstanceRef.current) {
        const state = globeInstanceRef.current.toggleAutoRotate();
        setIsAutoRotating(state);
        return state;
      }
      return false;
    },
    toggleLighting: () => {
      if (globeInstanceRef.current) {
        const state = globeInstanceRef.current.toggleLighting();
        setIsSolarLighting(state);
        return state;
      }
      return false;
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

  return (
    <div className="relative w-full h-full overflow-hidden select-none bg-[#050811]">
      {/* Cesium WebGL Canvas Container */}
      <div ref={globeContainerRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

      {/* 3D Cesium Moon HUD Indicator */}
      <div className="absolute top-4 right-4 z-10 pointer-events-none hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-950/80 backdrop-blur-md border border-cyan-500/30 text-[11px] text-cyan-300 shadow-lg">
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
