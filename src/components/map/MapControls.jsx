import React from 'react';
import {
  Plus,
  Minus,
  Globe2,
  Layers,
  Ruler,
  Compass,
  Target,
  RotateCw,
  Sun,
} from 'lucide-react';

/**
 * Floating action dock for 2D & 3D lunar exploration.
 */
export default function MapControls({
  viewMode = '3d',
  onZoomIn,
  onZoomOut,
  onResetOverview,
  onGoToSouthPole,
  onToggleLayers,
  isLayersOpen,
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
      className="flex flex-col gap-2 pointer-events-auto select-none"
    >
      {/* 3D Mode Specific Controls */}
      {viewMode === '3d' && (
        <div className="flex flex-col bg-slate-900/95 backdrop-blur-xl border border-slate-800 rounded-2xl shadow-2xl p-1 gap-1">
          {/* Auto-Rotate Toggle */}
          <button
            id="btn-toggle-auto-rotate"
            type="button"
            onClick={onToggleAutoRotate}
            title={isAutoRotating ? 'Pause auto-rotation' : 'Start slow lunar rotation'}
            className={`p-2.5 rounded-xl transition-all flex items-center justify-center ${
              isAutoRotating
                ? 'bg-cyan-500 text-white shadow-lg shadow-cyan-500/30'
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
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
            title={isSolarLighting ? 'Switch to full sunlit view' : 'Switch to solar shading'}
            className={`p-2.5 rounded-xl transition-all flex items-center justify-center ${
              isSolarLighting
                ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/30'
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
            aria-label="Toggle solar lighting"
          >
            <Sun className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Main Exploration Tool Actions */}
      <div className="flex flex-col bg-slate-900/95 backdrop-blur-xl border border-slate-800 rounded-2xl shadow-2xl p-1 gap-1">
        {/* Dedicated South Pole Button */}
        <button
          id="btn-go-to-south-pole"
          type="button"
          onClick={onGoToSouthPole}
          title="Fly to Lunar South Pole (90°S - Artemis & Shackleton)"
          className="p-2.5 rounded-xl bg-cyan-950/80 text-cyan-300 hover:text-white hover:bg-cyan-600 border border-cyan-500/40 transition-all flex items-center justify-center shadow-lg shadow-cyan-950/50 group"
          aria-label="Fly to lunar South Pole"
        >
          <Target className="w-4 h-4 group-hover:rotate-90 transition-transform duration-300 text-cyan-400 group-hover:text-white" />
        </button>

        {/* Layers Drawer Toggle */}
        <button
          id="btn-toggle-layers"
          type="button"
          onClick={onToggleLayers}
          title="Toggle Layers & NASA Datasets"
          className={`p-2.5 rounded-xl transition-all flex items-center justify-center ${
            isLayersOpen
              ? 'bg-cyan-500 text-white shadow-lg shadow-cyan-500/30'
              : 'text-slate-300 hover:text-white hover:bg-slate-800'
          }`}
          aria-label="Toggle map layers"
        >
          <Layers className="w-4 h-4" />
        </button>

        {/* Measure Tool (2D Mode) */}
        {viewMode === '2d' && (
          <button
            id="btn-toggle-measure"
            type="button"
            onClick={onToggleMeasure}
            title={isMeasureActive ? 'Cancel Measurement' : 'Measure Lunar Surface Distance'}
            className={`p-2.5 rounded-xl transition-all flex items-center justify-center ${
              isMeasureActive
                ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/30 animate-pulse'
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
            aria-label="Toggle distance measurement"
          >
            <Ruler className="w-4 h-4" />
          </button>
        )}

        {/* Moon Global Overview (Reset) */}
        <button
          id="btn-moon-overview"
          type="button"
          onClick={onResetOverview}
          title="Reset to Full Moon Overview"
          className="p-2.5 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800 transition-all flex items-center justify-center"
          aria-label="Reset to full Moon overview"
        >
          <Globe2 className="w-4 h-4" />
        </button>
      </div>

      {/* Zoom In / Out Controls */}
      <div className="flex flex-col bg-slate-900/95 backdrop-blur-xl border border-slate-800 rounded-2xl shadow-2xl p-1 gap-1">
        <button
          id="btn-zoom-in"
          type="button"
          onClick={onZoomIn}
          title="Zoom In"
          className="p-2.5 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800 transition-all flex items-center justify-center"
          aria-label="Zoom into map"
        >
          <Plus className="w-4 h-4" />
        </button>

        <div className="h-px bg-slate-800 mx-1" />

        <button
          id="btn-zoom-out"
          type="button"
          onClick={onZoomOut}
          title="Zoom Out"
          className="p-2.5 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800 transition-all flex items-center justify-center"
          aria-label="Zoom out of map"
        >
          <Minus className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
