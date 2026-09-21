import React from 'react';
import { formatLunarCoordinates } from '../../utils/coordinates.js';

/**
 * Lightweight tooltip / popup component for lunar map features.
 * 
 * @param {{
 *   feature: import('../../types/lunar.js').LunarFeature,
 *   onOpenPanel: () => void
 * }} props
 */
export default function FeaturePopup({ feature, onOpenPanel }) {
  if (!feature) return null;
  const { combined } = formatLunarCoordinates(feature.longitude, feature.latitude, 1);

  return (
    <div
      id="feature-hover-popup"
      className="bg-slate-900/95 border border-slate-700/80 rounded-xl px-3 py-2 text-xs shadow-2xl backdrop-blur-md pointer-events-auto"
    >
      <div className="font-bold text-white leading-tight">{feature.name}</div>
      <div className="text-[10px] text-cyan-400 font-medium capitalize mt-0.5">
        {feature.type} {feature.diameterKm ? `• ${feature.diameterKm} km` : ''}
      </div>
      <div className="text-[10px] text-slate-400 font-mono mt-0.5">{combined}</div>
    </div>
  );
}
