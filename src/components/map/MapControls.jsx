import React from 'react';
import {
  Plus,
  Minus,
  Globe2,
  Ruler,
  Target,
  RotateCw,
  Sun,
} from 'lucide-react';

/**
 * Single unified, compact control cluster for lunar navigation.
 * Designed with a minimalist NASA space aesthetic.
 */
export default function MapControls({
  viewMode = '3d',
  onZoomIn,
  onZoomOut,
  onResetOverview,
  onGoToSouthPole,
  onToggleMeasure,
  isMeasureActive,
  onToggleAutoRotate,
  isAutoRotating = false,
  onToggleLighting,
  isSolarLighting = false,
}) {
  return (
    <div
      id="map-floating-controls"
      className="flex flex-col bg-[#060b14]/90 backdrop-blur-xl border border-slate-800/80 rounded-xl shadow-2xl p-1 gap-1 pointer-events-auto select-none"
    >
      {/* Zoom In */}
      <button
        id="btn-zoom-in"
        type="button"
        onClick={onZoomIn}
        title="Zoom In"
        className="p-2 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors flex items-center justify-center"
        aria-label="Zoom in"
      >
        <Plus className="w-4 h-4" />
      </button>

      {/* Zoom Out */}
      <button
        id="btn-zoom-out"
        type="button"
        onClick={onZoomOut}
        title="Zoom Out"
        className="p-2 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors flex items-center justify-center"
        aria-label="Zoom out"
      >
        <Minus className="w-4 h-4" />
      </button>

      <div className="h-px bg-slate-800 mx-1 my-0.5" />

      {/* Global Overview (Reset) */}
      <button
        id="btn-moon-overview"
        type="button"
        onClick={onResetOverview}
        title="Full Moon Overview"
        className="p-2 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors flex items-center justify-center"
        aria-label="Reset overview"
      >
        <Globe2 className="w-4 h-4" />
      </button>

      {/* South Pole Quick Jump */}
      <button
        id="btn-controls-south-pole"
        type="button"
        onClick={onGoToSouthPole}
        title="Focus South Pole (90°S)"
        className="p-2 rounded-lg text-cyan-300 hover:text-white hover:bg-cyan-950/80 transition-colors flex items-center justify-center"
        aria-label="Fly to South Pole"
      >
        <Target className="w-4 h-4" />
      </button>

      {/* 3D Orbit / Auto-Rotation */}
      {viewMode === '3d' && (
        <>
          <button
            id="btn-toggle-auto-rotate"
            type="button"
            onClick={onToggleAutoRotate}
            title={isAutoRotating ? 'Pause auto-rotation' : 'Auto-orbit rotation'}
            className={`p-2 rounded-lg transition-colors flex items-center justify-center ${
              isAutoRotating
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
            aria-label="Toggle auto rotation"
          >
            <RotateCw className={`w-4 h-4 ${isAutoRotating ? 'animate-spin' : ''}`} />
          </button>

          {/* Solar Shading Toggle */}
          <button
            id="btn-toggle-solar-shading"
            type="button"
            onClick={onToggleLighting}
            title={isSolarLighting ? 'Switch to unshaded map' : 'Real-time solar terminator shading'}
            className={`p-2 rounded-lg transition-colors flex items-center justify-center ${
              isSolarLighting
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
            aria-label="Toggle solar lighting"
          >
            <Sun className="w-4 h-4" />
          </button>
        </>
      )}

      {/* 2D Geodesic Measurement Tool */}
      {viewMode === '2d' && (
        <button
          id="btn-toggle-measure"
          type="button"
          onClick={onToggleMeasure}
          title={isMeasureActive ? 'Exit measurement tool' : 'Measure geodesic surface distance'}
          className={`p-2 rounded-lg transition-colors flex items-center justify-center ${
            isMeasureActive
              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
          aria-label="Toggle measurement"
        >
          <Ruler className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}
