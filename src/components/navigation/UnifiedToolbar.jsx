import React from 'react';
import {
  Home,
  Layers,
  Moon,
  Globe2,
  Play,
  Pause,
  Hand,
  Sliders,
  GitCompare,
} from 'lucide-react';

/**
 * Compact left-side vertical floating toolbar for map manipulation.
 * Houses Home button, Layers toggle, 3D/2D switch, planet switch, mission tools, and orbit controls.
 */
export default function UnifiedToolbar({
  onReturnHome,
  onToggleLayers,
  isLayersOpen = false,
  onGoToSouthPole,
  onOpenMissionExplorer,
  onOpenComparison,
  onOpenSlipSimulator,
  onPlanetChange,
  onToggleAutoRotate,
  isAutoRotating = false,
  onToggleLighting,
  isSolarLighting = false,
  onResetOverview,
  activePlanet = 'moon',
  viewMode = '3d',
  onViewModeChange,
}) {
  return (
    <div className="fixed top-1/2 left-3 -translate-y-1/2 z-30 pointer-events-auto select-none">
      <div className="flex flex-col items-center gap-1 p-1 rounded-xl bg-[#080E18]/95 border border-[#16283C] shadow-[0_12px_36px_rgba(0,0,0,0.9)] backdrop-blur-2xl">
        {/* Home Button (Returns to Landing Page) */}
        <button
          type="button"
          onClick={onReturnHome}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-[#F1F5F9] bg-[#0D1726] hover:bg-[#00D2C4] hover:text-[#060B13] transition-all"
          title="Return to Studio Home"
        >
          <Home className="w-3.5 h-3.5" />
        </button>

        {/* Map Layers Panel Toggle */}
        <button
          type="button"
          onClick={onToggleLayers}
          className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${
            isLayersOpen
              ? 'bg-[#00D2C4] text-[#060B13] shadow-[0_0_12px_rgba(0,210,196,0.35)] font-semibold'
              : 'text-[#94A3B8] hover:text-white hover:bg-[#152336]'
          }`}
          title="Toggle Basemap & Topographic Layers"
        >
          <Layers className="w-3.5 h-3.5" />
        </button>

        <div className="w-4 h-[1px] bg-[#16283C] my-0.5" />

        {/* 3D Globe / 2D South Pole Topo Segmented Switcher */}
        <div className="flex flex-col items-center p-0.5 rounded-lg bg-[#0A1220] border border-[#16283C] gap-0.5">
          <button
            type="button"
            onClick={() => onViewModeChange?.('3d')}
            className={`w-7 h-5 rounded flex items-center justify-center text-[9px] font-mono font-bold transition-all ${
              viewMode === '3d'
                ? 'bg-[#00D2C4] text-[#060B13] shadow-[0_0_8px_rgba(0,210,196,0.4)]'
                : 'text-[#94A3B8] hover:text-white'
            }`}
            title="3D Globe View"
          >
            3D
          </button>
          <button
            type="button"
            onClick={() => onViewModeChange?.('2d')}
            className={`w-7 h-5 rounded flex items-center justify-center text-[9px] font-mono font-bold transition-all ${
              viewMode === '2d' || viewMode === 'sp-2d'
                ? 'bg-[#00D2C4] text-[#060B13] shadow-[0_0_8px_rgba(0,210,196,0.4)]'
                : 'text-[#94A3B8] hover:text-white'
            }`}
            title="2D South Pole Topographical Map (80°S-90°S)"
          >
            2D
          </button>
        </div>

        <div className="w-4 h-[1px] bg-[#16283C] my-0.5" />

        {/* Mission / Site Comparison Modal */}
        <button
          type="button"
          onClick={onOpenComparison}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-[#38BDF8] hover:bg-[#38BDF8]/20 hover:text-white transition-all"
          title="Compare Landing Sites Side-by-Side"
        >
          <GitCompare className="w-3.5 h-3.5" />
        </button>

        {/* Launch Slip Simulator & Heatmap */}
        <button
          type="button"
          onClick={onOpenSlipSimulator}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-[#22D3EE] hover:bg-[#22D3EE]/20 hover:text-white transition-all"
          title="Launch Slip Simulator & Window Heatmap"
        >
          <Sliders className="w-3.5 h-3.5" />
        </button>

        <div className="w-4 h-[1px] bg-[#16283C] my-0.5" />

        {/* Planet Switch: Moon */}
        <button
          type="button"
          onClick={() => {
            if (viewMode !== '3d') onViewModeChange?.('3d');
            onPlanetChange?.('moon');
          }}
          className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${
            activePlanet === 'moon'
              ? 'bg-[#00D2C4] text-[#060B13] font-bold shadow-[0_0_10px_rgba(0,210,196,0.3)]'
              : 'text-[#94A3B8] hover:text-white hover:bg-[#152336]'
          }`}
          title="Switch to 3D Moon"
        >
          <Moon className="w-3.5 h-3.5" />
        </button>

        {/* Planet Switch: Earth */}
        <button
          type="button"
          onClick={() => {
            if (viewMode !== '3d') onViewModeChange?.('3d');
            onPlanetChange?.('earth');
          }}
          className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${
            activePlanet === 'earth'
              ? 'bg-[#34D399] text-[#060B13] font-bold shadow-[0_0_10px_rgba(52,211,153,0.3)]'
              : 'text-[#94A3B8] hover:text-white hover:bg-[#152336]'
          }`}
          title="Switch to 3D Earth DSN"
        >
          <Globe2 className="w-3.5 h-3.5" />
        </button>

        <div className="w-4 h-[1px] bg-[#16283C] my-0.5" />

        {/* Orbital Auto-Rotate */}
        <button
          type="button"
          onClick={onToggleAutoRotate}
          className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${
            isAutoRotating
              ? 'bg-[#00D2C4] text-[#060B13] shadow-[0_0_8px_rgba(0,210,196,0.3)]'
              : 'bg-[#0D1726] text-white hover:bg-[#152336]'
          }`}
          title={isAutoRotating ? 'Pause Orbit Rotation' : 'Start Orbit Rotation'}
        >
          {isAutoRotating ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
        </button>

        {/* Reset Overview */}
        <button
          type="button"
          onClick={onResetOverview}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-[#94A3B8] hover:text-white hover:bg-[#152336] transition-colors"
          title="Reset Global Overview"
        >
          <Hand className="w-3.5 h-3.5" />
        </button>

        {/* South Pole Quick Jump */}
        <button
          type="button"
          onClick={onGoToSouthPole}
          className="w-8 h-8 rounded-lg flex items-center justify-center font-mono text-[9px] font-bold text-[#F1F5F9] hover:bg-[#152336] hover:text-[#00D2C4] transition-colors"
          title="Center on Lunar South Pole (90°S)"
        >
          90°S
        </button>

        {/* Lighting Shading Toggle */}
        <button
          type="button"
          onClick={onToggleLighting}
          className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${
            isSolarLighting ? 'bg-[#00D2C4] text-[#060B13]' : 'text-[#94A3B8] hover:text-white hover:bg-[#152336]'
          }`}
          title="Toggle Solar Terminator"
        >
          <Moon className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
