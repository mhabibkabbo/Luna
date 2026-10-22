import React from 'react';
import { Layers, X } from 'lucide-react';
import LayerToggle from './LayerToggle.jsx';

/**
 * Layer Management Drawer / Panel for the active planet's overlays.
 * 
 * @param {{
 *   isOpen: boolean,
 *   onClose: () => void,
 *   layers: Array<import('../../types/lunar.js').LunarLayer>,
 *   onToggleLayer: (layerId: string, visible: boolean) => void,
 *   onChangeOpacity: (layerId: string, opacity: number) => void
 * }} props
 */
export default function LayerPanel({
  isOpen,
  onClose,
  layers,
  onToggleLayer,
  onChangeOpacity,
  activePlanet = 'moon',
}) {
  if (!isOpen) return null;

  const earthLayers = layers.filter((l) => l.id === 'earth-communication-sites');
  const visibleLayers =
    activePlanet === 'earth' ? earthLayers : layers.filter((l) => l.id !== 'earth-communication-sites');
  const baseLayers = visibleLayers.filter((l) => l.category === 'BASE');
  const terrainLayers = visibleLayers.filter((l) => l.category === 'TERRAIN');
  const featureLayers = visibleLayers.filter((l) => l.category === 'FEATURES');
  const missionLayers = visibleLayers.filter((l) => l.category === 'MISSIONS');

  return (
    <div
      id={activePlanet === 'earth' ? 'earth-layer-panel' : 'lunar-layer-panel'}
      className="absolute top-14 right-3 sm:right-4 z-30 w-80 max-h-[calc(100vh-5rem)] flex flex-col bg-[#060b14]/96 backdrop-blur-2xl border border-slate-800 rounded-xl shadow-2xl overflow-hidden pointer-events-auto transition-all animate-in fade-in select-none"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 bg-slate-950/50">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-cyan-400" />
          <h2 className="text-sm font-semibold text-slate-100 tracking-wide">
            {activePlanet === 'earth' ? 'Earth Layers' : 'Lunar Map Layers'}
          </h2>
        </div>
        <button
          id="btn-close-layers"
          type="button"
          onClick={onClose}
          className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          aria-label="Close layer panel"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Layer groups scrollable content */}
      <div className="overflow-y-auto px-2 py-3 space-y-4 custom-scrollbar text-slate-200">
        {/* BASE MAP */}
        {baseLayers.length > 0 && (
          <div>
            <div className="px-2.5 mb-1 text-[10px] font-bold uppercase tracking-wider text-cyan-400/90 font-sans">
              Base Map
            </div>
            <div className="space-y-0.5">
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

        {/* TERRAIN */}
        {terrainLayers.length > 0 && (
          <div>
            <div className="px-2.5 mb-1 text-[10px] font-bold uppercase tracking-wider text-amber-400/90 font-sans">
              Terrain & Topography
            </div>
            <div className="space-y-0.5">
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

        {/* FEATURES */}
        {featureLayers.length > 0 && (
          <div>
            <div className="px-2.5 mb-1 text-[10px] font-bold uppercase tracking-wider text-emerald-400/90 font-sans">
              {activePlanet === 'earth' ? 'Communication Network' : 'Planetary Features'}
            </div>
            <div className="space-y-0.5">
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

        {/* MISSIONS */}
        {missionLayers.length > 0 && (
          <div>
            <div className="px-2.5 mb-1 text-[10px] font-bold uppercase tracking-wider text-purple-400/90 font-sans">
              Surface Exploration
            </div>
            <div className="space-y-0.5">
              {missionLayers.map((layer) => (
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

      {/* Footer info */}
      <div className="px-4 py-2 border-t border-slate-800/80 bg-slate-950/40 text-[10px] text-slate-500 flex items-center justify-between">
        {activePlanet === 'earth' ? (
          <>
            <span>Earth communication locations</span>
            <span className="font-mono">NASA / ESA / ISRO / JAXA</span>
          </>
        ) : (
          <>
            <span>NASA Moon Trek WMTS</span>
            <span className="font-mono">IAU 2000 Moon</span>
          </>
        )}
      </div>
    </div>
  );
}
