import React, { useState } from 'react';
import {
  Mountain,
  Waves,
  Diamond,
  Eye,
  EyeOff,
  Info,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Target
} from 'lucide-react';

/**
 * Floating On-Map Symbol & Feature Quick-Toggle Toolbar.
 * Contains only: South Pole (90°S), Mountains, Maria (Seas), and Valleys & Rilles.
 * 
 * @param {{
 *   layers: Array<import('../../types/lunar.js').LunarLayer>,
 *   onToggleLayer: (layerId: string, visible: boolean) => void,
 *   onToggleAllSymbols: (visible: boolean) => void,
 *   onGoToSouthPole?: () => void
 * }} props
 */
export default function TerrainModeBar({
  layers,
  onToggleLayer,
  onToggleAllSymbols,
  onGoToSouthPole,
}) {
  const [isLegendOpen, setIsLegendOpen] = useState(false);

  // Status for kept symbol layers
  const isMountainsVisible = layers.find((l) => l.id === 'lunar-mountains')?.visible ?? true;
  const isMariaVisible = layers.find((l) => l.id === 'lunar-maria')?.visible ?? true;
  const isValleysVisible = layers.find((l) => l.id === 'lunar-valleys')?.visible ?? true;

  const anySymbolVisible = isMountainsVisible || isMariaVisible || isValleysVisible;
  const allSymbolsVisible = isMountainsVisible && isMariaVisible && isValleysVisible;

  const symbolToggles = [
    {
      id: 'lunar-mountains',
      name: 'Mountains',
      glyph: '▲',
      icon: Mountain,
      visible: isMountainsVisible,
      color: 'amber',
      accentClass: 'text-amber-400 border-amber-500/50 bg-amber-950/40 shadow-amber-500/10',
      description: 'Mountain massifs & polar peaks (Mons Malapert, Mons Mouton, Montes Leibnitz, Montes Apenninus)',
    },
    {
      id: 'lunar-maria',
      name: 'Maria (Seas)',
      glyph: '🌊',
      icon: Waves,
      visible: isMariaVisible,
      color: 'sky',
      accentClass: 'text-sky-300 border-sky-500/50 bg-sky-950/40 shadow-sky-500/10',
      description: 'Vast ancient basalt plains and South Pole-Aitken (SPA) basin rim',
    },
    {
      id: 'lunar-valleys',
      name: 'Valleys & Rilles',
      glyph: '◆',
      icon: Diamond,
      visible: isValleysVisible,
      color: 'purple',
      accentClass: 'text-purple-300 border-purple-500/50 bg-purple-950/40 shadow-purple-500/10',
      description: 'Sinuous volcanic lava tubes, polar graben & tectonic fault valleys',
    },
  ];

  return (
    <div
      id="lunar-symbol-toolbar"
      className="absolute top-16 left-3 sm:left-4 z-20 flex flex-col gap-2 pointer-events-auto max-w-[calc(100vw-24px)]"
    >
      {/* Top Main Toolbar */}
      <div className="flex items-center gap-1.5 p-1 bg-slate-950/90 backdrop-blur-xl border border-slate-800/90 rounded-2xl shadow-2xl overflow-x-auto custom-scrollbar">
        {/* Prominent South Pole Button */}
        <button
          type="button"
          id="btn-toolbar-south-pole"
          onClick={() => {
            if (onGoToSouthPole) {
              onGoToSouthPole();
            }
          }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-lg shadow-cyan-500/25 border border-cyan-400/50 hover:brightness-110 active:scale-95 transition-all select-none group shrink-0"
          title="Fly immediately to the Lunar South Pole (90°S - Shackleton, Malapert, Artemis III Candidates)"
        >
          <Target className="w-4 h-4 text-cyan-200 group-hover:rotate-90 transition-transform duration-300" />
          <span className="tracking-wide">South Pole (90°S)</span>
          <span className="text-[10px] px-1.5 py-0.2 rounded bg-cyan-900/60 border border-cyan-300/30 text-cyan-200 font-mono">
            Focus
          </span>
        </button>

        <div className="h-5 w-px bg-slate-800 shrink-0" />

        {/* Master Symbol Toggle */}
        <div className="flex items-center gap-1 pl-0.5 pr-1 py-0.5 shrink-0">
          <button
            type="button"
            id="btn-toggle-all-symbols"
            onClick={() => onToggleAllSymbols(!allSymbolsVisible)}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              allSymbolsVisible
                ? 'bg-cyan-500 text-white shadow-md shadow-cyan-500/20'
                : anySymbolVisible
                ? 'bg-slate-800 text-cyan-300 hover:text-white'
                : 'bg-slate-900 text-slate-400 hover:text-white'
            }`}
            title={allSymbolsVisible ? 'Hide all map symbols' : 'Show all map symbols'}
          >
            {allSymbolsVisible ? (
              <Eye className="w-3.5 h-3.5 text-white" />
            ) : (
              <EyeOff className="w-3.5 h-3.5 text-slate-400" />
            )}
            <span className="hidden sm:inline">Symbols</span>
          </button>
        </div>

        {/* Individual Symbol Quick Toggles (Mountains, Maria, Valleys & Rilles) */}
        <div className="flex items-center gap-1 shrink-0">
          {symbolToggles.map((sym) => (
            <button
              key={sym.id}
              type="button"
              id={`btn-symbol-${sym.id}`}
              onClick={() => onToggleLayer(sym.id, !sym.visible)}
              title={`Toggle ${sym.name} on map (${sym.visible ? 'Visible - click to hide' : 'Hidden - click to show'})`}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap border transition-all ${
                sym.visible
                  ? `${sym.accentClass} shadow-sm font-semibold`
                  : 'bg-slate-900/60 text-slate-500 border-slate-800/80 hover:bg-slate-800/80 hover:text-slate-300'
              }`}
            >
              <span className="text-[11px] leading-none select-none">{sym.glyph}</span>
              <span>{sym.name}</span>
              <span
                className={`w-1.5 h-1.5 rounded-full transition-all ${
                  sym.visible ? 'bg-current shadow-sm' : 'bg-slate-600'
                }`}
              />
            </button>
          ))}
        </div>

        {/* Key & Info Drawer Toggle */}
        <div className="flex items-center pl-1 border-l border-slate-800/80 shrink-0">
          <button
            type="button"
            id="btn-symbol-legend"
            onClick={() => setIsLegendOpen((prev) => !prev)}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-medium transition-all ${
              isLegendOpen
                ? 'bg-slate-800 text-white ring-1 ring-slate-700'
                : 'text-slate-300 hover:text-white hover:bg-slate-800/70'
            }`}
            title="Open Key & Info"
          >
            <Info className="w-3.5 h-3.5 text-cyan-400" />
            <span className="hidden md:inline">Key & Info</span>
            {isLegendOpen ? (
              <ChevronUp className="w-3 h-3 text-slate-400" />
            ) : (
              <ChevronDown className="w-3 h-3 text-slate-400" />
            )}
          </button>
        </div>
      </div>

      {/* Key & Info Panel */}
      {isLegendOpen && (
        <div
          id="symbol-legend-panel"
          className="mt-1 p-3.5 bg-slate-950/95 backdrop-blur-2xl border border-slate-800 rounded-2xl shadow-2xl max-w-lg animate-fade-in"
        >
          <div className="flex items-center justify-between pb-2 mb-2.5 border-b border-slate-800/80">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-cyan-400" />
              <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                Key & Info — Feature Symbology
              </h3>
            </div>
            <button
              type="button"
              onClick={() => setIsLegendOpen(false)}
              className="text-slate-400 hover:text-white text-[11px] px-2 py-0.5 rounded bg-slate-900 border border-slate-800"
            >
              Close
            </button>
          </div>

          <div className="flex flex-col gap-2 text-[11px]">
            {symbolToggles.map((sym) => (
              <div
                key={sym.id}
                className="flex items-start gap-2.5 p-2 rounded-xl bg-slate-900/60 border border-slate-800/60"
              >
                <div className="w-6 h-6 rounded-lg bg-slate-800/80 flex items-center justify-center shrink-0 text-sm">
                  {sym.glyph}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-200">{sym.name}</span>
                    <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">
                      {sym.visible ? 'ON' : 'OFF'}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400 leading-tight mt-0.5">
                    {sym.description}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* NASA WMTS Connection note */}
          <div className="mt-3 p-2.5 rounded-xl bg-cyan-950/30 border border-cyan-500/20 flex items-center justify-between text-[11px] text-cyan-300">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              <span>NASA Moon Trek Active</span>
            </div>
            <span className="font-mono text-[10px] text-cyan-400/80">trek.nasa.gov/tiles/Moon/EQ/</span>
          </div>
        </div>
      )}
    </div>
  );
}
