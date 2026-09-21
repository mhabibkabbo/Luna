import React from 'react';
import { Check, Sliders } from 'lucide-react';

/**
 * Individual layer toggle row with checkbox, description, and opacity control.
 * 
 * @param {{
 *   layer: import('../../types/lunar.js').LunarLayer,
 *   onToggle: (layerId: string, visible: boolean) => void,
 *   onChangeOpacity?: (layerId: string, opacity: number) => void
 * }} props
 */
export default function LayerToggle({ layer, onToggle, onChangeOpacity }) {
  const isRaster = layer.type === 'wmts';

  // Corresponding symbol glyph
  const getSymbolGlyph = (id) => {
    switch (id) {
      case 'lunar-mountains':
        return { glyph: '▲', color: 'text-amber-400 bg-amber-950/40 border-amber-500/30' };
      case 'lunar-craters':
        return { glyph: '⭕', color: 'text-cyan-300 bg-cyan-950/40 border-cyan-500/30' };
      case 'lunar-maria':
        return { glyph: '🌊', color: 'text-sky-300 bg-sky-950/40 border-sky-500/30' };
      case 'lunar-valleys':
        return { glyph: '◆', color: 'text-purple-300 bg-purple-950/40 border-purple-500/30' };
      case 'apollo-landing-sites':
        return { glyph: '🚀', color: 'text-amber-300 bg-amber-950/40 border-amber-500/30' };
      case 'robotic-landing-sites':
        return { glyph: '🛰️', color: 'text-emerald-300 bg-emerald-950/40 border-emerald-500/30' };
      default:
        return null;
    }
  };

  const symbolBadge = getSymbolGlyph(layer.id);

  return (
    <div
      id={`layer-toggle-${layer.id}`}
      className="flex flex-col py-2 px-2.5 rounded-lg hover:bg-slate-800/50 transition-colors border border-transparent hover:border-slate-800"
    >
      <div className="flex items-start justify-between gap-2.5">
        <label
          htmlFor={`chk-${layer.id}`}
          className="flex items-start gap-2.5 cursor-pointer select-none grow"
        >
          <div className="relative flex items-center justify-center mt-0.5">
            <input
              id={`chk-${layer.id}`}
              type="checkbox"
              checked={layer.visible}
              onChange={(e) => onToggle(layer.id, e.target.checked)}
              className="sr-only"
            />
            <div
              className={`w-4 h-4 rounded border transition-all flex items-center justify-center ${
                layer.visible
                  ? 'bg-cyan-500 border-cyan-400 text-white'
                  : 'bg-slate-800 border-slate-700 hover:border-slate-600'
              }`}
            >
              {layer.visible && <Check className="w-3 h-3 stroke-[3]" />}
            </div>
          </div>

          <div className="flex flex-col">
            <div className="flex items-center gap-1.5">
              {symbolBadge && (
                <span
                  className={`w-4 h-4 rounded flex items-center justify-center text-[10px] border ${symbolBadge.color}`}
                >
                  {symbolBadge.glyph}
                </span>
              )}
              <span
                className={`text-xs font-medium leading-tight ${
                  layer.visible ? 'text-slate-100' : 'text-slate-400'
                }`}
              >
                {layer.name}
              </span>
            </div>
            {layer.description && (
              <span className="text-[10px] text-slate-500 leading-snug line-clamp-2 mt-0.5">
                {layer.description}
              </span>
            )}
          </div>
        </label>
      </div>

      {/* Opacity slider for visible raster imagery */}
      {isRaster && layer.visible && onChangeOpacity && (
        <div className="mt-2 pl-6.5 flex items-center gap-2 text-[10px] text-slate-400">
          <span className="text-slate-500 shrink-0">Opacity</span>
          <input
            id={`slider-opacity-${layer.id}`}
            type="range"
            min="0.1"
            max="1.0"
            step="0.05"
            value={layer.opacity}
            onChange={(e) => onChangeOpacity(layer.id, parseFloat(e.target.value))}
            className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-400"
            title={`Opacity: ${Math.round(layer.opacity * 100)}%`}
          />
          <span className="font-mono text-[9px] w-7 text-right">
            {Math.round(layer.opacity * 100)}%
          </span>
        </div>
      )}
    </div>
  );
}
