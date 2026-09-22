import React from 'react';
import { formatLunarCoordinates } from '../../utils/coordinates.js';

/**
 * Floating selenographic coordinate readout in plain white text with no background.
 * Displays Latitude, Longitude, and Zoom cleanly on the canvas.
 * 
 * @param {{
 *   longitude: number,
 *   latitude: number,
 *   zoom?: number
 * }} props
 */
export default function CoordinateDisplay({ longitude, latitude, zoom = 2.5 }) {
  const { latStr, lonStr } = formatLunarCoordinates(longitude, latitude, 2);
  const zoomDisplay = typeof zoom === 'number' ? zoom.toFixed(1) : '2.5';

  return (
    <div
      id="coordinate-display-bar"
      className="flex items-center gap-2.5 text-xs sm:text-sm font-mono text-white select-none pointer-events-none drop-shadow-[0_1px_3px_rgba(0,0,0,0.95)]"
    >
      <span>
        LAT <span className="font-semibold text-white">{latStr}</span>
      </span>

      <span className="text-white/40 font-light">|</span>

      <span>
        LON <span className="font-semibold text-white">{lonStr}</span>
      </span>

      <span className="text-white/40 font-light">|</span>

      <span>
        ZOOM <span className="font-semibold text-white">{zoomDisplay}x</span>
      </span>
    </div>
  );
}
