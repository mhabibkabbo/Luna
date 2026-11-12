import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Layers, X } from 'lucide-react';
import LayerToggle from './LayerToggle.jsx';

export default function LayerPanel({
  isOpen,
  onClose,
  layers,
  onToggleLayer,
  onChangeOpacity,
  onToggleAllSymbols,
  activePlanet = 'moon',
}) {
  const [isExpanded, setIsExpanded] = useState(true);
  if (!isOpen) return null;

  const earthLayers = layers.filter((l) => l.id.startsWith('earth-'));
  const visibleLayers =
    activePlanet === 'earth' ? earthLayers : layers.filter((l) => !l.id.startsWith('earth-'));
  const baseLayers = visibleLayers.filter((l) => l.category === 'BASE');
  const terrainLayers = visibleLayers.filter((l) => l.category === 'TERRAIN');
  const featureLayers = visibleLayers.filter((l) => l.category === 'FEATURES');
  const allFeaturesVisible =
    featureLayers.length > 0 && featureLayers.every((l) => Boolean(l.visible));

  return (
    <div
      id={activePlanet === 'earth' ? 'earth-layer-panel' : 'lunar-layer-panel'}
      data-testid="lunar-layer-panel"
      className={`fixed left-1/2 z-[60] flex max-h-[calc(100dvh-6rem)] w-[min(21rem,calc(100vw-1.5rem))] -translate-x-1/2 flex-col overflow-hidden rounded-2xl border border-white/[0.08] bg-[#08090C]/95 shadow-[0_20px_50px_rgba(0,0,0,0.88)] backdrop-blur-2xl pointer-events-auto transition-all select-none lg:left-[4.5rem] lg:translate-x-0 ${
        isExpanded
          ? 'top-[calc(50%+1.75rem)] -translate-y-1/2'
          : 'top-auto bottom-[116px] translate-y-0'
      }`}
    >
      <div className="flex items-center justify-between gap-2 border-b border-white/[0.08] bg-[#0C0D12]/90 px-3.5 py-3">
        <div className="flex items-center gap-2.5">
          <div className="w-6 h-6 rounded-lg bg-white/[0.06] border border-white/[0.1] flex items-center justify-center text-white">
            <Layers className="w-3.5 h-3.5" />
          </div>
          <h2 className="text-sm font-semibold text-white tracking-tight">
            {activePlanet === 'earth' ? 'Earth Layers' : 'Lunar Map Layers'}
          </h2>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => setIsExpanded((expanded) => !expanded)}
            className="rounded-lg p-1.5 text-[#8E95A5] transition-all duration-150 hover:bg-white/[0.08] hover:text-white active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
            aria-label={isExpanded ? 'Collapse layer panel' : 'Expand layer panel'}
            aria-expanded={isExpanded}
          >
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          <button
            id="btn-close-layers"
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-[#8E95A5] transition-all duration-150 hover:bg-white/[0.08] hover:text-white active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
            aria-label="Close layer panel"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {isExpanded && (
        <>
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-2.5 py-3 custom-scrollbar text-[#F8FAFC]">
            {baseLayers.length > 0 && (
              <div>
                <div className="px-2.5 mb-1.5 flex items-center justify-between">
                  <span className="text-[10px] font-mono font-semibold uppercase tracking-[0.12em] text-[#8E95A5]">
                    Base Map
                  </span>
                  <span className="text-[9px] font-mono text-[#636978]">WMTS</span>
                </div>
                <div className="space-y-1">
                  {baseLayers.map((layer) => (
                    <LayerToggle
                      key={layer.id}
                      layer={layer}
                      onToggle={onToggleLayer}
                      onChangeOpacity={onChangeOpacity}
                    />
                  ))}
                </div>
              </div>
            )}

            {terrainLayers.length > 0 && (
              <div className="pt-2 border-t border-white/[0.06]">
                <div className="px-2.5 mb-1.5 flex items-center justify-between">
                  <span className="text-[10px] font-mono font-semibold uppercase tracking-[0.12em] text-[#8E95A5]">
                    Terrain &amp; Topography
                  </span>
                  <span className="text-[9px] font-mono text-[#636978]">LOLA / LRO</span>
                </div>
                <div className="space-y-1">
                  {terrainLayers.map((layer) => (
                    <LayerToggle
                      key={layer.id}
                      layer={layer}
                      onToggle={onToggleLayer}
                      onChangeOpacity={onChangeOpacity}
                    />
                  ))}
                </div>
              </div>
            )}

            {featureLayers.length > 0 && (
              <div className="pt-2 border-t border-white/[0.06]">
                <div className="px-2.5 mb-1.5 flex items-center justify-between">
                  <span className="text-[10px] font-mono font-semibold uppercase tracking-[0.12em] text-[#8E95A5]">
                    {activePlanet === 'earth' ? 'Communication Network' : 'Planetary Features'}
                  </span>
                  {onToggleAllSymbols && (
                    <button
                      type="button"
                      onClick={() => onToggleAllSymbols(!allFeaturesVisible)}
                      className="text-[9.5px] font-mono font-medium text-[#CBD5E1] hover:text-white px-1.5 py-0.5 rounded bg-white/[0.04] hover:bg-white/[0.1] border border-white/[0.08] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
                    >
                      {allFeaturesVisible ? 'Hide All' : 'Show All'}
                    </button>
                  )}
                </div>
                <div className="space-y-1">
                  {featureLayers.map((layer) => (
                    <LayerToggle
                      key={layer.id}
                      layer={layer}
                      onToggle={onToggleLayer}
                      onChangeOpacity={onChangeOpacity}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between gap-2 border-t border-white/[0.08] bg-[#0C0D12]/90 px-4 py-2.5 text-[10px] text-[#8E95A5]">
            {activePlanet === 'earth' ? (
              <>
                <span>Earth Ground Network</span>
                <span className="font-mono text-[#CBD5E1]">NASA / ESA / ISRO / JAXA</span>
              </>
            ) : (
              <>
                <span>NASA Moon Trek WMTS</span>
                <span className="font-mono text-[#CBD5E1]">IAU 2000 Moon</span>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
