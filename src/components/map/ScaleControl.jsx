import React from 'react';
import { MOON_MEAN_RADIUS_KM } from '../../utils/distance.js';

/**
 * Custom Lunar Scale Indicator.
 * Accurately translates pixel distances into kilometers on the lunar surface
 * based on the Moon's equatorial circumference (10,921 km / 360° ≈ 30.323 km/deg).
 * 
 * @param {{ resolution: number }} props - Map resolution in degrees per pixel
 */
export default function ScaleControl({ resolution = 0.703125 }) {
  // 1 degree at the lunar equator = (2 * PI * 1737.4 km) / 360 ≈ 30.323 km
  const kmPerDegree = (2 * Math.PI * MOON_MEAN_RADIUS_KM) / 360;
  const kmPerPixel = resolution * kmPerDegree;

  // Choose a nice target scale length in pixels (around 80 to 120 px)
  const targetPx = 90;
  const rawKm = targetPx * kmPerPixel;

  // Round rawKm to standard scale intervals
  const intervals = [
    1, 2, 5, 10, 25, 50, 100, 200, 300, 500, 1000, 2000, 3000, 5000
  ];

  let chosenKm = intervals[0];
  for (const iv of intervals) {
    if (iv <= rawKm) {
      chosenKm = iv;
    } else {
      break;
    }
  }

  // Calculate actual pixel width for chosenKm
  const barWidthPx = Math.max(30, Math.min(180, Math.round(chosenKm / kmPerPixel)));

  return (
    <div
      id="lunar-scale-control"
      className="inline-flex flex-col items-center bg-slate-900/90 backdrop-blur-md border border-slate-800/80 px-2.5 py-1.5 rounded-lg text-xs font-mono text-slate-300 shadow-lg pointer-events-auto select-none"
    >
      <div className="text-[10px] text-slate-300 font-semibold mb-1">
        {chosenKm >= 1000 ? `${(chosenKm / 1000).toFixed(0)},000 km` : `${chosenKm} km`}
      </div>
      <div className="relative flex items-center justify-center">
        {/* Left notch */}
        <div className="h-2 w-0.5 bg-slate-300" />
        {/* Scale bar */}
        <div
          className="h-0.5 bg-slate-300"
          style={{ width: `${barWidthPx}px` }}
        />
        {/* Right notch */}
        <div className="h-2 w-0.5 bg-slate-300" />
      </div>
      <div className="text-[8px] text-slate-500 uppercase tracking-widest mt-0.5 font-sans">
        Lunar Scale
      </div>
    </div>
  );
}
