import React from 'react';
import { Check, Mountain, CircleDot, Waves, Diamond, Rocket, Radio } from 'lucide-react';

export default function LayerToggle({ layer, onToggle, onChangeOpacity }) {
  const isRaster = layer.type === 'wmts';

  const getSymbolBadge = (id) => {
    switch (id) {
      case 'lunar-mountains':
        return { Icon: Mountain, color: 'text-[#CBD5E1] bg-white/[0.06] border-white/[0.14]' };
      case 'lunar-craters':
        return { Icon: CircleDot, color: 'text-[#CBD5E1] bg-white/[0.06] border-white/[0.14]' };
      case 'lunar-maria':
        return { Icon: Waves, color: 'text-[#CBD5E1] bg-white/[0.06] border-white/[0.14]' };
      case 'lunar-valleys':
        return { Icon: Diamond, color: 'text-[#CBD5E1] bg-white/[0.06] border-white/[0.14]' };
      case 'lunar-landing-sites':
      case 'apollo-landing-sites':
      case 'earth-launch-sites':
        return { Icon: Rocket, color: 'text-emerald-300 bg-emerald-500/10 border-emerald-400/30' };
      case 'robotic-landing-sites':
      case 'earth-communication-sites':
        return { Icon: Radio, color: 'text-emerald-300 bg-emerald-500/10 border-emerald-400/30' };
      default:
        return null;
    }
  };

  const symbolBadge = getSymbolBadge(layer.id);

  return (
    <div
      id={`layer-toggle-${layer.id}`}
      className={`flex flex-col py-2.5 px-2.5 rounded-xl transition-all border ${
        layer.visible
          ? 'bg-[#0C0D12]/90 border-white/[0.1] hover:border-white/[0.18]'
          : 'bg-transparent border-transparent hover:bg-white/[0.03] hover:border-white/[0.06]'
      }`}
    >
      <div className="flex items-start justify-between gap-2.5">
        <label
          htmlFor={`chk-${layer.id}`}
          className="flex items-start gap-2.5 cursor-pointer select-none grow"
        >
          <div className="relative flex items-center justify-center mt-0.5 shrink-0">
            <input
              id={`chk-${layer.id}`}
              type="checkbox"
              checked={layer.visible}
              onChange={(e) => onToggle(layer.id, e.target.checked)}
              className="peer sr-only"
            />
            <div
              aria-hidden="true"
              className={`w-4 h-4 rounded-md border transition-all flex items-center justify-center peer-focus-visible:ring-2 peer-focus-visible:ring-white/70 peer-focus-visible:ring-offset-1 peer-focus-visible:ring-offset-[#08090C] ${
                layer.visible
                  ? 'bg-white border-white text-[#050507] shadow-[0_0_10px_rgba(255,255,255,0.2)]'
                  : 'bg-[#050507] border-white/[0.18] hover:border-white/[0.35]'
              }`}
            >
              {layer.visible && <Check className="w-3 h-3 stroke-[3]" />}
            </div>
          </div>

          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-1.5">
              {symbolBadge && (
                <span
                  className={`w-4 h-4 rounded flex items-center justify-center border shrink-0 ${symbolBadge.color}`}
                >
                  <symbolBadge.Icon className="w-2.5 h-2.5" />
                </span>
              )}
              <span
                className={`text-xs font-medium leading-tight transition-colors ${
                  layer.visible ? 'text-white font-semibold' : 'text-[#8E95A5]'
                }`}
              >
                {layer.name}
              </span>
            </div>
            {layer.description && (
              <span className="text-[10.5px] text-[#8E95A5] leading-snug line-clamp-2 mt-1">
                {layer.description}
              </span>
            )}
          </div>
        </label>
      </div>

      {isRaster && layer.visible && onChangeOpacity && (
        <div className="mt-2.5 pl-7 flex items-center gap-2.5 text-[10px] text-[#8E95A5]">
          <span className="text-[#8E95A5] font-mono uppercase tracking-wider text-[9px] shrink-0">
            Opacity
          </span>
          <input
            id={`slider-opacity-${layer.id}`}
            type="range"
            min="0.1"
            max="1.0"
            step="0.05"
            value={layer.opacity}
            aria-label={`${layer.name} layer opacity`}
            onChange={(e) => onChangeOpacity(layer.id, parseFloat(e.target.value))}
            className="w-full h-1.5 bg-[#181A20] rounded-lg appearance-none cursor-pointer accent-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
            title={`Opacity: ${Math.round(layer.opacity * 100)}%`}
          />
          <span className="font-mono text-[10px] text-white tabular-nums w-8 text-right shrink-0">
            {Math.round(layer.opacity * 100)}%
          </span>
        </div>
      )}
    </div>
  );
}
