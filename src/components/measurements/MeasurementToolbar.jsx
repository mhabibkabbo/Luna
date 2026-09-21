import React from 'react';
import { Ruler, Trash2, X, Info } from 'lucide-react';
import MeasurementResult from './MeasurementResult.jsx';

/**
 * Floating toolbar for geodesic distance measurement on the Moon.
 * 
 * @param {{
 *   isActive: boolean,
 *   measurement: import('../../types/lunar.js').LunarMeasurement,
 *   onToggleActive: () => void,
 *   onClear: () => void,
 * }} props
 */
export default function MeasurementToolbar({
  isActive,
  measurement,
  onToggleActive,
  onClear,
}) {
  if (!isActive) return null;

  return (
    <div
      id="measurement-floating-toolbar"
      className="absolute top-16 left-1/2 -translate-x-1/2 z-30 w-11/12 max-w-md bg-slate-900/95 backdrop-blur-xl border border-amber-500/50 rounded-2xl shadow-2xl p-3.5 pointer-events-auto transition-all animate-fade-in text-slate-100"
    >
      {/* Top action row */}
      <div className="flex items-center justify-between gap-3 pb-2.5 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <div className="p-1 bg-amber-500/20 text-amber-400 rounded-lg">
            <Ruler className="w-4 h-4" />
          </div>
          <span className="text-xs font-bold text-slate-100 uppercase tracking-wide font-sans">
            Lunar Distance Tool
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            id="btn-clear-measurement"
            type="button"
            onClick={onClear}
            className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700/80 rounded-lg transition-colors"
            title="Clear measurement points"
          >
            <Trash2 className="w-3 h-3" />
            Clear
          </button>

          <button
            id="btn-exit-measurement"
            type="button"
            onClick={onToggleActive}
            className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
            aria-label="Exit measurement mode"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Measurement readout */}
      <div className="pt-2.5">
        <MeasurementResult measurement={measurement} />
      </div>

      {/* Scientific note */}
      <div className="mt-2.5 pt-2 border-t border-slate-800/80 flex items-center gap-1.5 text-[9px] text-slate-500">
        <Info className="w-3 h-3 shrink-0 text-slate-600" />
        <span>Great-circle geodesic metric evaluated on IAU Moon datum (R = 1,737.4 km).</span>
      </div>
    </div>
  );
}
