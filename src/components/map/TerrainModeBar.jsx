import React, { useState } from 'react';
import {
  Mountain,
  CircleDot,
  Waves,
  Diamond,
  Rocket,
  Radio,
  Eye,
  EyeOff,
  Info,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Navigation,
  Target,
  Compass,
  Layers,
  MapPin
} from 'lucide-react';

/**
 * Floating On-Map Symbol & Feature Quick-Toggle Toolbar with Lunar South Pole focus.
 * 
 * @param {{
 *   layers: Array<import('../../types/lunar.js').LunarLayer>,
 *   onToggleLayer: (layerId: string, visible: boolean) => void,
 *   onToggleAllSymbols: (visible: boolean) => void,
 *   onQuickJump: (lon: number, lat: number, zoom: number) => void,
 *   onGoToSouthPole?: () => void
 * }} props
 */
export default function TerrainModeBar({
  layers,
  onToggleLayer,
  onToggleAllSymbols,
  onQuickJump,
  onGoToSouthPole,
}) {
  const [isLegendOpen, setIsLegendOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('south-pole'); // 'south-pole' | 'global'

  // Status for each symbol layer
  const isMountainsVisible = layers.find((l) => l.id === 'lunar-mountains')?.visible ?? true;
  const isCratersVisible = layers.find((l) => l.id === 'lunar-craters')?.visible ?? true;
  const isMariaVisible = layers.find((l) => l.id === 'lunar-maria')?.visible ?? true;
  const isValleysVisible = layers.find((l) => l.id === 'lunar-valleys')?.visible ?? true;
  const isApolloVisible = layers.find((l) => l.id === 'apollo-landing-sites')?.visible ?? true;
  const isRoboticVisible = layers.find((l) => l.id === 'robotic-landing-sites')?.visible ?? true;

  const anySymbolVisible =
    isMountainsVisible ||
    isCratersVisible ||
    isMariaVisible ||
    isValleysVisible ||
    isApolloVisible ||
    isRoboticVisible;
  const allSymbolsVisible =
    isMountainsVisible &&
    isCratersVisible &&
    isMariaVisible &&
    isValleysVisible &&
    isApolloVisible &&
    isRoboticVisible;

  const symbolToggles = [
    {
      id: 'lunar-mountains',
      name: 'Mountains',
      glyph: '▲',
      icon: Mountain,
      visible: isMountainsVisible,
      color: 'amber',
      accentClass: 'text-amber-400 border-amber-500/50 bg-amber-950/40 shadow-amber-500/10',
      description: 'Mountain massifs & polar peaks (Mons Malapert, Mons Mouton, Montes Leibnitz)',
    },
    {
      id: 'lunar-craters',
      name: 'Craters',
      glyph: '⭕',
      icon: CircleDot,
      visible: isCratersVisible,
      color: 'cyan',
      accentClass: 'text-cyan-300 border-cyan-500/50 bg-cyan-950/40 shadow-cyan-500/10',
      description: 'Impact craters & water-ice traps (Shackleton, Cabeus, Faustini, Shoemaker, Nobile)',
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
    {
      id: 'apollo-landing-sites',
      name: 'Apollo Sites',
      glyph: '🚀',
      icon: Rocket,
      visible: isApolloVisible,
      color: 'amber',
      accentClass: 'text-amber-300 border-amber-500/50 bg-amber-950/40 shadow-amber-500/10',
      description: 'All 6 historic NASA crewed lunar landing locations (Apollo 11–17)',
    },
    {
      id: 'robotic-landing-sites',
      name: 'Robotic & Polar',
      glyph: '🛰️',
      icon: Radio,
      visible: isRoboticVisible,
      color: 'emerald',
      accentClass: 'text-emerald-300 border-emerald-500/50 bg-emerald-950/40 shadow-emerald-500/10',
      description: 'Polar landers & Artemis zones (Chandrayaan-3, IM-1 Odysseus, LCROSS, Artemis III)',
    },
  ];

  // Specific South Pole Landmarks
  const southPoleLandmarks = [
    {
      label: 'Shackleton Crater (89.7°S)',
      type: 'crater',
      lon: 129.78,
      lat: -89.67,
      zoom: 5.5,
      tag: 'Water Ice & Peaks of Light',
    },
    {
      label: 'Malapert Massif (85.9°S)',
      type: 'mountain',
      lon: 0.0,
      lat: -85.9,
      zoom: 5.2,
      tag: '5 km Peak / Artemis Candidate',
    },
    {
      label: 'Chandrayaan-3 (Shiv Shakti)',
      type: 'mission',
      lon: 32.35,
      lat: -69.37,
      zoom: 5.0,
      tag: 'ISRO South Pole Landing',
    },
    {
      label: 'IM-1 Odysseus Lander',
      type: 'mission',
      lon: 1.44,
      lat: -80.13,
      zoom: 5.2,
      tag: 'CLPS Malapert A',
    },
    {
      label: 'Cabeus Crater (LCROSS)',
      type: 'crater',
      lon: -35.5,
      lat: -84.9,
      zoom: 4.8,
      tag: 'Water Ice Discovery Site',
    },
    {
      label: 'Mons Mouton (6 km)',
      type: 'mountain',
      lon: 31.7,
      lat: -84.5,
      zoom: 5.0,
      tag: 'VIPER Rover Exploration',
    },
    {
      label: 'Nobile Crater (85.2°S)',
      type: 'crater',
      lon: 53.5,
      lat: -85.2,
      zoom: 4.8,
      tag: 'Cold Trap Volatiles',
    },
    {
      label: 'Faustini Ultra-Cold PSR',
      type: 'crater',
      lon: 77.0,
      lat: -87.3,
      zoom: 5.0,
      tag: '35 Kelvin Ice Reservoir',
    },
  ];

  const globalLandmarks = [
    { label: 'Mons Huygens (5.5 km)', type: 'mountain', lon: -2.9, lat: 20.0, zoom: 4.8 },
    { label: 'Montes Apenninus', type: 'mountain', lon: 0.0, lat: 19.9, zoom: 3.5 },
    { label: 'Tycho Crater', type: 'crater', lon: -11.36, lat: -43.31, zoom: 4.5 },
    { label: 'Copernicus Crater', type: 'crater', lon: -20.08, lat: 9.62, zoom: 4.5 },
    { label: 'Mare Tranquillitatis', type: 'mare', lon: 31.4, lat: 8.5, zoom: 2.8 },
    { label: 'Apollo 11 Base', type: 'apollo', lon: 23.473, lat: 0.674, zoom: 5.2 },
    { label: 'Vallis Schröteri', type: 'valley', lon: -51.6, lat: 26.2, zoom: 4.8 },
  ];

  const activeLandmarks = activeTab === 'south-pole' ? southPoleLandmarks : globalLandmarks;

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
            } else {
              onQuickJump(0.0, -88.5, 4.8);
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

        {/* Individual Symbol Quick Toggles */}
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

        {/* Legend / Guide Drawer Toggle */}
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
            title="Open Symbol Key & Lunar Landmark Guide"
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

      {/* Target Quick Jump Bar with South Pole First */}
      <div className="flex items-center gap-1.5 flex-wrap px-1">
        <div className="flex items-center gap-1 p-0.5 bg-slate-950/80 backdrop-blur-md rounded-lg border border-slate-800/80 text-[10px]">
          <button
            type="button"
            onClick={() => setActiveTab('south-pole')}
            className={`px-2 py-0.5 rounded font-semibold transition-all ${
              activeTab === 'south-pole'
                ? 'bg-cyan-500 text-slate-950 font-bold'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            ❄️ South Pole Targets
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('global')}
            className={`px-2 py-0.5 rounded transition-all ${
              activeTab === 'global'
                ? 'bg-slate-800 text-white font-semibold'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            🌕 Global Landmarks
          </button>
        </div>

        {activeLandmarks.map((lm) => (
          <button
            key={lm.label}
            type="button"
            onClick={() => onQuickJump(lm.lon, lm.lat, lm.zoom)}
            className="px-2 py-1 text-[11px] text-slate-200 hover:text-white bg-slate-950/85 hover:bg-slate-900 rounded-lg border border-slate-800/90 hover:border-cyan-500/50 transition-all shadow-sm flex items-center gap-1.5"
            title={`${lm.label} (${lm.lat}°, ${lm.lon}°) - ${lm.tag || ''}`}
          >
            <span>
              {lm.type === 'mountain'
                ? '▲'
                : lm.type === 'crater'
                ? '⭕'
                : lm.type === 'mare'
                ? '🌊'
                : lm.type === 'mission' || lm.type === 'apollo'
                ? '🚀'
                : '◆'}
            </span>
            <span className="font-medium">{lm.label}</span>
          </button>
        ))}
      </div>

      {/* Expandable Symbol Legend & Guide Panel */}
      {isLegendOpen && (
        <div
          id="symbol-legend-panel"
          className="mt-1 p-3.5 bg-slate-950/95 backdrop-blur-2xl border border-slate-800 rounded-2xl shadow-2xl max-w-xl animate-fade-in"
        >
          <div className="flex items-center justify-between pb-2 mb-2.5 border-b border-slate-800/80">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-cyan-400" />
              <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                NASA Moon Trek Symbology & South Pole Data
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
            {symbolToggles.map((sym) => (
              <div
                key={sym.id}
                className="flex items-start gap-2 p-2 rounded-xl bg-slate-900/60 border border-slate-800/60"
              >
                <div className="w-6 h-6 rounded-lg bg-slate-800/80 flex items-center justify-center shrink-0 text-sm">
                  {sym.glyph}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-200">{sym.name}</span>
                    <span className="text-[9px] font-mono px-1 rounded bg-slate-800 text-slate-400">
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
              <span>NASA Solar System Treks WMTS Active</span>
            </div>
            <span className="font-mono text-[10px] text-cyan-400/80">trek.nasa.gov/tiles/Moon/EQ/</span>
          </div>
        </div>
      )}
    </div>
  );
}
