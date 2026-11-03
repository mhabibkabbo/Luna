import React, { useState, useEffect } from 'react';
import { Layers, Mountain, Eye, Palette, Info, ChevronUp, ChevronDown } from 'lucide-react';
import { pointerStore } from '../../utils/pointerStore.js';

/**
 * TopographicalControlBar
 * Floating HUD element for the Topographical Lunar Map view.
 * Features NASA LOLA hypsometric color bar legend (-9,000m to +10,700m elevation),
 * live elevation readout under cursor, and quick basemap mode switcher.
 */
export default function TopographicalControlBar({
  currentMode = 'topo',
  onChangeMode,
  selectedFeature,
}) {
  const [pointer, setPointer] = useState(pointerStore.get());
  const [isExpanded, setIsExpanded] = useState(true);

  useEffect(() => {
    return pointerStore.subscribe((state) => {
      setPointer(state);
    });
  }, []);

  // Altimetry value strictly from sampled or selected NASA LOLA data (no synthetic heuristics)
  const getElevationEstimate = () => {
    if (selectedFeature && typeof selectedFeature.elevationMeters === 'number') {
      return selectedFeature.elevationMeters;
    }
    return null;
  };

  const estimatedElev = getElevationEstimate();

  return (
    <div className="absolute top-4 left-4 z-20 pointer-events-auto select-none max-w-sm sm:max-w-md">
      <div className="bg-[#12110D]/95 border border-[#2D2A22] rounded-xl shadow-[0_12px_36px_rgba(0,0,0,0.85)] backdrop-blur-xl p-3 text-[#F4EFE6] transition-all">
        {/* Header Header Bar */}
        <div className="flex items-center justify-between pb-2 border-b border-[#2D2A22]/80 gap-3">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-[#221F18] border border-[#3A3528] flex items-center justify-center text-[#E59A6D]">
              <Mountain className="w-3.5 h-3.5" />
            </div>
            <div>
              <div className="text-[11px] font-mono tracking-widest text-[#E59A6D] uppercase font-bold flex items-center gap-1.5">
                Topographical Map
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              </div>
              <div className="text-[10px] text-[#A8A193] font-mono">
                NASA LRO LOLA Hypsometric DEM (128 ppd)
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1 rounded-md text-[#A8A193] hover:text-white hover:bg-[#221F18] transition-colors"
            title={isExpanded ? 'Collapse Topo Legend' : 'Expand Topo Legend'}
          >
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>

        {isExpanded && (
          <div className="mt-3 space-y-3 animate-in fade-in duration-200">
            {/* Mode Selector Segmented Tabs */}
            <div className="grid grid-cols-4 gap-1 p-1 bg-[#181711] border border-[#232018] rounded-lg text-[10px] font-mono font-medium">
              <button
                type="button"
                onClick={() => onChangeMode?.('topo')}
                className={`py-1.5 rounded text-center transition-all ${
                  currentMode === 'topo' || currentMode === 'elevation'
                    ? 'bg-[#E59A6D] text-[#12110D] font-bold shadow-sm'
                    : 'text-[#A8A193] hover:text-white hover:bg-[#221F18]'
                }`}
              >
                Topo DEM
              </button>
              <button
                type="button"
                onClick={() => onChangeMode?.('terrain')}
                className={`py-1.5 rounded text-center transition-all ${
                  currentMode === 'terrain'
                    ? 'bg-[#E59A6D] text-[#12110D] font-bold shadow-sm'
                    : 'text-[#A8A193] hover:text-white hover:bg-[#221F18]'
                }`}
              >
                Relief
              </button>
              <button
                type="button"
                onClick={() => onChangeMode?.('photographic')}
                className={`py-1.5 rounded text-center transition-all ${
                  currentMode === 'photographic'
                    ? 'bg-[#E59A6D] text-[#12110D] font-bold shadow-sm'
                    : 'text-[#A8A193] hover:text-white hover:bg-[#221F18]'
                }`}
              >
                Photo
              </button>
              <button
                type="button"
                onClick={() => onChangeMode?.('blended')}
                className={`py-1.5 rounded text-center transition-all ${
                  currentMode === 'blended'
                    ? 'bg-[#E59A6D] text-[#12110D] font-bold shadow-sm'
                    : 'text-[#A8A193] hover:text-white hover:bg-[#221F18]'
                }`}
              >
                Blended
              </button>
            </div>

            {/* Hypsometric Elevation Ramp Bar */}
            <div className="space-y-1.5 pt-1">
              <div className="flex items-center justify-between text-[10px] font-mono text-[#A8A193]">
                <span className="flex items-center gap-1">
                  <Palette className="w-3 h-3 text-[#E59A6D]" /> Elevation Spectrum
                </span>
                {estimatedElev !== null && (
                  <span className="text-[#F4EFE6] font-bold">
                    Cursor:{' '}
                    <span className={estimatedElev < 0 ? 'text-cyan-400' : 'text-amber-400'}>
                      {estimatedElev > 0 ? `+${estimatedElev.toLocaleString()}` : estimatedElev.toLocaleString()} m
                    </span>
                  </span>
                )}
              </div>

              {/* Hypsometric Gradient Bar */}
              <div className="relative h-3.5 w-full rounded-md overflow-hidden border border-[#3A3528] bg-gradient-to-r from-[#200052] via-[#0055A5] via-[#00A86B] via-[#E8D000] via-[#D85800] to-[#E52020]">
                {/* Tick Indicators */}
                <div className="absolute inset-0 flex justify-between px-1 items-center pointer-events-none">
                  <div className="w-0.5 h-full bg-white/30" />
                  <div className="w-0.5 h-full bg-white/30" />
                  <div className="w-0.5 h-full bg-white/40" />
                  <div className="w-0.5 h-full bg-white/30" />
                  <div className="w-0.5 h-full bg-white/30" />
                </div>
              </div>

              {/* Scale Labels */}
              <div className="flex justify-between text-[9px] font-mono text-[#8C857B]">
                <span>-9,000 m</span>
                <span>-4,000 m</span>
                <span className="text-[#F4EFE6] font-semibold">0 m (Datum)</span>
                <span>+5,000 m</span>
                <span>+10,700 m</span>
              </div>
            </div>

            {/* Feature Elevation Summary if selected */}
            {selectedFeature && (
              <div className="pt-2 border-t border-[#2D2A22]/80 flex items-center justify-between text-[11px] font-mono">
                <span className="text-[#A8A193] truncate max-w-[160px]">{selectedFeature.name || 'Selected Site'}</span>
                <span className="text-[#E59A6D] font-bold">
                  {typeof selectedFeature.elevationMeters === 'number'
                    ? `${selectedFeature.elevationMeters > 0 ? '+' : ''}${selectedFeature.elevationMeters.toLocaleString()} m`
                    : 'Terrain Measured'}
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
