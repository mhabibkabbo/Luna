import React from 'react';
import { formatLunarDistance } from '../../utils/distance.js';

/**
 * Visual display card for active lunar distance measurement results.
 * 
 * @param {{
 *   measurement: import('../../types/lunar.js').LunarMeasurement
 * }} props
 */
export default function MeasurementResult({ measurement }) {
  if (!measurement || measurement.coordinates.length < 2) {
    return (
      <div className="flex items-center gap-2 text-xs text-amber-300/90 font-medium">
        <span>Click 2 or more points on the Moon to calculate surface distance.</span>
      </div>
    );
  }

  const formattedDistance = formatLunarDistance(measurement.totalDistanceKm);
  const pointCount = measurement.coordinates.length;
  const bearing = measurement.initialBearingDeg !== undefined ? Math.round(measurement.initialBearingDeg) : null;

  return (
    <div className="flex flex-col gap-1 text-xs">
      <div className="flex items-baseline justify-between gap-4">
        <span className="text-[11px] text-slate-400 font-sans">Geodesic Lunar Distance:</span>
        <span className="font-mono text-base font-bold text-amber-400">
          {formattedDistance}
        </span>
      </div>

      <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono">
        <span>{pointCount} measured {pointCount === 1 ? 'point' : 'points'}</span>
        {bearing !== null && <span>Initial Azimuth: {bearing}°</span>}
      </div>
    </div>
  );
}
