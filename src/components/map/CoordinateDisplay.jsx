import React from 'react';
import { formatLunarCoordinates } from '../../utils/coordinates.js';

/**
 * Bottom status bar coordinate display showing selenographic latitude and longitude.
 * 
 * @param {{
 *   longitude: number,
 *   latitude: number,
 *   zoom?: number,
 *   datum?: string
 * }} props
 */
export default function CoordinateDisplay({ longitude, latitude, zoom = 2.5, datum = '1737.4 km' }) {
  const { latStr, lonStr } = formatLunarCoordinates(longitude, latitude, 2);

  return (
    <div
      id="coordinate-display-bar"
      className="inline-flex items-center gap-4 bg-slate-900/90 backdrop-blur-md border border-slate-800/80 px-3.5 py-1.5 rounded-lg text-xs font-mono text-slate-300 shadow-lg pointer-events-auto select-none"
    >
      <div className="flex items-center gap-1.5">
        <span className="text-slate-500 font-sans uppercase tracking-wider text-[10px]">Lat</span>
        <span className="text-slate-100 font-semibold">{latStr}</span>
      </div>

      <div className="h-3 w-px bg-slate-700/60" />

      <div className="flex items-center gap-1.5">
        <span className="text-slate-500 font-sans uppercase tracking-wider text-[10px]">Lon</span>
        <span className="text-slate-100 font-semibold">{lonStr}</span>
      </div>

      <div className="hidden sm:block h-3 w-px bg-slate-700/60" />

      <div className="hidden sm:flex items-center gap-1.5 text-slate-400">
        <span className="text-slate-500 font-sans uppercase tracking-wider text-[10px]">Zoom</span>
        <span>{typeof zoom === 'number' ? zoom.toFixed(1) : '2.5'}x</span>
      </div>

      <div className="hidden md:block h-3 w-px bg-slate-700/60" />

      <div className="hidden md:flex items-center gap-1 text-[11px] text-slate-400">
        <span className="text-slate-500 font-sans uppercase tracking-wider text-[10px]">Datum</span>
        <span>{datum}</span>
      </div>
    </div>
  );
}
