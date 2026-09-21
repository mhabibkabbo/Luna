import React from 'react';
import { Compass, Rocket, Mountain, CircleDot, Navigation } from 'lucide-react';
import { formatLunarCoordinates } from '../../utils/coordinates.js';

/**
 * Autocomplete search results list dropdown.
 * 
 * @param {{
 *   results: Array<import('../../types/lunar.js').LunarFeature>,
 *   onSelect: (feature: import('../../types/lunar.js').LunarFeature) => void,
 *   activeIndex: number
 * }} props
 */
export default function SearchResults({ results, onSelect, activeIndex }) {
  if (!results || results.length === 0) return null;

  const getTypeIcon = (type) => {
    switch (type) {
      case 'landing-site':
      case 'mission-site':
        return <Rocket className="w-3.5 h-3.5 text-amber-400 shrink-0" />;
      case 'mountain':
        return <Mountain className="w-3.5 h-3.5 text-amber-500 shrink-0" />;
      case 'mare':
        return <Compass className="w-3.5 h-3.5 text-blue-400 shrink-0" />;
      case 'crater':
      default:
        return <CircleDot className="w-3.5 h-3.5 text-cyan-400 shrink-0" />;
    }
  };

  const getTypeBadge = (type) => {
    switch (type) {
      case 'landing-site':
        return 'Apollo Landing';
      case 'mission-site':
        return 'Robotic Lander';
      case 'mountain':
        return 'Lunar Mountain';
      case 'mare':
        return 'Basaltic Mare';
      case 'valley':
      case 'rille':
        return 'Rille / Valley';
      case 'crater':
      default:
        return 'Impact Crater';
    }
  };

  return (
    <ul
      id="search-results-dropdown"
      role="listbox"
      className="absolute top-full left-0 right-0 mt-1.5 bg-slate-900/95 backdrop-blur-xl border border-slate-800 rounded-xl shadow-2xl overflow-hidden divide-y divide-slate-800/60 max-h-80 overflow-y-auto custom-scrollbar z-50 pointer-events-auto"
    >
      {results.map((feature, idx) => {
        const isFocused = idx === activeIndex;
        const coords = formatLunarCoordinates(feature.longitude, feature.latitude, 1);
        const dimension = feature.diameterKm
          ? `${feature.diameterKm} km`
          : (feature.elevationM ? `${feature.elevationM} m elev.` : (feature.lengthKm ? `${feature.lengthKm} km len.` : (feature.date || '')));

        return (
          <li
            key={feature.id}
            role="option"
            aria-selected={isFocused}
            onClick={() => onSelect(feature)}
            className={`px-3.5 py-2.5 cursor-pointer flex items-center justify-between gap-3 transition-colors ${
              isFocused ? 'bg-slate-800 text-white' : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
            }`}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="p-1.5 bg-slate-800/80 rounded-lg">
                {getTypeIcon(feature.type)}
              </div>
              <div className="flex flex-col min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-slate-100 truncate">
                    {feature.name}
                  </span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700/60">
                    {getTypeBadge(feature.type)}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-[10px] text-slate-400 font-mono mt-0.5">
                  <span>{coords.combined}</span>
                  {dimension && (
                    <>
                      <span className="text-slate-600">•</span>
                      <span className="text-cyan-400">{dimension}</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            <Navigation className="w-3.5 h-3.5 text-slate-500 shrink-0" />
          </li>
        );
      })}
    </ul>
  );
}
