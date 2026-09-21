import React from 'react';
import { Plus, Minus, Globe2, Layers, Ruler, Compass, Target } from 'lucide-react';

/**
 * Floating Google Maps-style map action controls.
 * 
 * @param {{
 *   onZoomIn: () => void,
 *   onZoomOut: () => void,
 *   onResetOverview: () => void,
 *   onGoToSouthPole: () => void,
 *   onToggleLayers: () => void,
 *   isLayersOpen: boolean,
 *   onToggleMeasure: () => void,
 *   isMeasureActive: boolean
 * }} props
 */
export default function MapControls({
  onZoomIn,
  onZoomOut,
  onResetOverview,
  onGoToSouthPole,
  onToggleLayers,
  isLayersOpen,
  onToggleMeasure,
  isMeasureActive,
}) {
  return (
    <div
      id="map-floating-controls"
      className="flex flex-col gap-2 pointer-events-auto select-none"
    >
      {/* Tool actions card */}
      <div className="flex flex-col bg-slate-900/90 backdrop-blur-md border border-slate-800/80 rounded-xl shadow-xl overflow-hidden p-1 gap-1">
        {/* Dedicated South Pole Button */}
        <button
          id="btn-go-to-south-pole"
          type="button"
          onClick={onGoToSouthPole}
          title="Fly to Lunar South Pole (90°S - Shackleton, Malapert, Artemis III)"
          className="p-2.5 rounded-lg bg-cyan-950/80 text-cyan-300 hover:text-white hover:bg-cyan-600/80 border border-cyan-500/40 hover:border-cyan-400 transition-all flex items-center justify-center shadow-lg shadow-cyan-950/50 group relative"
          aria-label="Fly to lunar South Pole"
        >
          <Target className="w-5 h-5 group-hover:scale-110 transition-transform text-cyan-400 group-hover:text-white" />
        </button>

        <button
          id="btn-toggle-layers"
          type="button"
          onClick={onToggleLayers}
          title="Toggle Layers & NASA Moon Trek Datasets"
          className={`p-2.5 rounded-lg transition-colors flex items-center justify-center ${
            isLayersOpen
              ? 'bg-cyan-500 text-white shadow-md'
              : 'text-slate-300 hover:text-white hover:bg-slate-800/80'
          }`}
          aria-label="Toggle map layers"
        >
          <Layers className="w-5 h-5" />
        </button>

        <button
          id="btn-toggle-measure"
          type="button"
          onClick={onToggleMeasure}
          title={isMeasureActive ? 'Cancel Measurement' : 'Measure Lunar Distance'}
          className={`p-2.5 rounded-lg transition-colors flex items-center justify-center ${
            isMeasureActive
              ? 'bg-amber-500 text-white shadow-md animate-pulse'
              : 'text-slate-300 hover:text-white hover:bg-slate-800/80'
          }`}
          aria-label="Toggle distance measurement"
        >
          <Ruler className="w-5 h-5" />
        </button>

        <button
          id="btn-moon-overview"
          type="button"
          onClick={onResetOverview}
          title="Moon Overview (Reset Extent)"
          className="p-2.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800/80 transition-colors flex items-center justify-center"
          aria-label="Reset to full Moon overview"
        >
          <Globe2 className="w-5 h-5" />
        </button>
      </div>

      {/* Zoom In / Out card */}
      <div className="flex flex-col bg-slate-900/90 backdrop-blur-md border border-slate-800/80 rounded-xl shadow-xl overflow-hidden p-1 gap-1">
        <button
          id="btn-zoom-in"
          type="button"
          onClick={onZoomIn}
          title="Zoom In"
          className="p-2.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800/80 transition-colors flex items-center justify-center"
          aria-label="Zoom into map"
        >
          <Plus className="w-5 h-5" />
        </button>

        <div className="h-px bg-slate-800 mx-1" />

        <button
          id="btn-zoom-out"
          type="button"
          onClick={onZoomOut}
          title="Zoom Out"
          className="p-2.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800/80 transition-colors flex items-center justify-center"
          aria-label="Zoom out of map"
        >
          <Minus className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
