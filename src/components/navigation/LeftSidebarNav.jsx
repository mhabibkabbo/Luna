import React from 'react';
import {
  Layers,
  Rocket,
  Compass,
  Home,
  Lightbulb,
  Orbit,
  RotateCw,
  Ruler,
} from 'lucide-react';
import NavTooltip from './NavTooltip.jsx';

/**
 * Compact left-side visualization toolbar.
 * Houses map manipulation, layer controls, and ephemeris actions.
 * Hovering any button displays an animated name pill emerging to the right.
 */
export default function LeftSidebarNav({
  viewMode = '3d',
  activePlanet = 'moon',
  onViewModeChange,
  isLayersOpen = false,
  onToggleLayers,
  isCelestialOpen = false,
  onToggleCelestial,
  isAutoRotating = false,
  onToggleAutoRotate,
  isSolarLighting = false,
  onToggleLighting,
  isMeasureActive = false,
  onToggleMeasure,
  onGoToSouthPole,
  onResetOverview,
  onOpenMissionExplorer,
  isMobileOpen = false,
  onCloseMobile,
}) {
  const isMoon = activePlanet === 'moon';
  const content = (
    <div className="flex flex-col items-center gap-1.5 w-full py-2.5 px-1.5">
      <span className="hidden sr-only">Visualization Controls</span>

      {/* Reset View */}
      <NavTooltip label="Reset View" shortcut="Esc">
        <button
          type="button"
          onClick={onResetOverview}
          aria-label={`Reset ${isMoon ? 'Moon' : 'Earth'} view to global overview`}
          className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-300 hover:bg-[#00D2C4] hover:text-[#060B13] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00D2C4]"
        >
          <Home className="w-4 h-4" />
        </button>
      </NavTooltip>

      {/* Orbit / Layer Controls */}
      {isMoon && <NavTooltip label="Basemap & Layers" shortcut="L">
        <button
          type="button"
          data-guide="layers"
          onClick={onToggleLayers}
          aria-label="Toggle basemap and topographic layers"
          aria-pressed={isLayersOpen}
          className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00D2C4] ${
            isLayersOpen
              ? 'bg-[#00D2C4] text-[#060B13] shadow-[0_0_12px_rgba(0,210,196,0.4)] font-bold'
              : 'text-slate-400 hover:text-white hover:bg-[#0E1A2C]'
          }`}
        >
          <Layers className="w-4 h-4" />
        </button>
      </NavTooltip>}

      {/* Rocket / Mission Controls */}
      {isMoon && onOpenMissionExplorer && (
        <NavTooltip label="Mission Manifest">
          <button
            type="button"
            onClick={onOpenMissionExplorer}
            aria-label="Open NASA CLPS mission explorer"
            className="w-9 h-9 rounded-xl flex items-center justify-center text-[#FBBF24] hover:bg-[#FBBF24]/20 hover:text-white transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00D2C4]"
          >
            <Rocket className="w-4 h-4" />
          </button>
        </NavTooltip>
      )}

      {/* Moon View / Display Mode (3D Globe vs 2D Topo) */}
      {isMoon && <div data-guide="view-mode" className="p-0.5 rounded-xl bg-[#0A1220] border border-[#16283C] flex flex-col gap-0.5">
        <NavTooltip label="3D Globe View" shortcut="1">
          <button
            type="button"
            onClick={() => onViewModeChange?.('3d')}
            aria-label="Switch to 3D Globe view"
            aria-pressed={viewMode === '3d'}
            className={`w-7 h-5 rounded-lg flex items-center justify-center text-[9px] font-mono font-bold transition-all focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#00D2C4] ${
              viewMode === '3d'
                ? 'bg-[#00D2C4] text-[#060B13] shadow-[0_0_8px_rgba(0,210,196,0.4)]'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            3D
          </button>
        </NavTooltip>
        <NavTooltip label="2D South Pole Topo" shortcut="2">
          <button
            type="button"
            onClick={() => onViewModeChange?.('2d')}
            aria-label="Switch to 2D South Pole topographic map"
            aria-pressed={viewMode === '2d' || viewMode === 'sp-2d'}
            className={`w-7 h-5 rounded-lg flex items-center justify-center text-[9px] font-mono font-bold transition-all focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#00D2C4] ${
              viewMode === '2d' || viewMode === 'sp-2d'
                ? 'bg-[#00D2C4] text-[#060B13] shadow-[0_0_8px_rgba(0,210,196,0.4)]'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            2D
          </button>
        </NavTooltip>
      </div>}

      {/* Pan / Navigation (Center on Lunar South Pole) */}
      {isMoon && <NavTooltip label="Target South Pole" shortcut="S">
        <button
          type="button"
          onClick={onGoToSouthPole}
          aria-label="Center camera on Lunar South Pole"
          className="w-9 h-9 rounded-xl flex items-center justify-center text-[#00D2C4] hover:bg-[#00D2C4]/20 hover:text-white transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00D2C4]"
        >
          <Compass className="w-4 h-4" />
        </button>
      </NavTooltip>}

      {/* Lighting / Display Settings */}
      <NavTooltip label="Solar Shading">
        <button
          type="button"
          onClick={onToggleLighting}
          aria-label="Toggle real-time solar terminator shading"
          aria-pressed={isSolarLighting}
          className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00D2C4] ${
            isSolarLighting
              ? 'bg-[#00D2C4] text-[#060B13] shadow-[0_0_10px_rgba(0,210,196,0.3)]'
              : 'text-slate-400 hover:text-white hover:bg-[#0E1A2C]'
          }`}
        >
          <Lightbulb className="w-4 h-4" />
        </button>
      </NavTooltip>

      {/* Ephemeris & Time Engine */}
      {isMoon && <NavTooltip label="Ephemeris Engine" shortcut="E">
        <button
          type="button"
          onClick={onToggleCelestial}
          aria-label="Toggle celestial ephemeris engine"
          aria-pressed={isCelestialOpen}
          className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00D2C4] ${
            isCelestialOpen
              ? 'bg-[#00D2C4] text-[#060B13] shadow-[0_0_12px_rgba(0,210,196,0.4)]'
              : 'text-slate-400 hover:text-white hover:bg-[#0E1A2C]'
          }`}
        >
          <Orbit className="w-4 h-4" />
        </button>
      </NavTooltip>}

      {/* Auto-Rotation */}
      <NavTooltip label={isAutoRotating ? 'Pause Rotation' : 'Auto-Rotation'}>
        <button
          type="button"
          onClick={onToggleAutoRotate}
          aria-label={isAutoRotating ? 'Pause orbital auto-rotation' : 'Start orbital auto-rotation'}
          aria-pressed={isAutoRotating}
          className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00D2C4] ${
            isAutoRotating
              ? 'bg-[#00D2C4] text-[#060B13] shadow-[0_0_8px_rgba(0,210,196,0.3)]'
              : 'text-slate-400 hover:text-white hover:bg-[#0E1A2C]'
          }`}
        >
          <RotateCw className={`w-4 h-4 ${isAutoRotating ? 'animate-spin' : ''}`} />
        </button>
      </NavTooltip>

      {/* Geodesic Ruler (when in 2D mode) */}
      {isMoon && (viewMode === '2d' || viewMode === 'sp-2d') && onToggleMeasure && (
        <NavTooltip label="Geodesic Ruler" shortcut="M">
          <button
            type="button"
            onClick={onToggleMeasure}
            aria-label="Toggle geodesic distance and bearing ruler"
            aria-pressed={isMeasureActive}
            className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00D2C4] ${
              isMeasureActive
                ? 'bg-[#00D2C4] text-[#060B13] shadow-[0_0_10px_rgba(0,210,196,0.4)]'
                : 'text-slate-400 hover:text-white hover:bg-[#0E1A2C]'
            }`}
          >
            <Ruler className="w-4 h-4" />
          </button>
        </NavTooltip>
      )}
    </div>
  );

  return (
    <>
      {/* Desktop Compact Sidebar (overflow-visible ensures emerging tooltips are not clipped) */}
      <nav
        aria-label="Visualization toolbar"
        data-guide="toolbar"
        className="hidden lg:flex w-14 shrink-0  h-full bg-[#060B13]/95 border-r border-[#16283C]/80 flex-col items-center justify-center z-30 select-none overflow-visible backdrop-blur-md"
      >
        {content}
      </nav>

      {/* Mobile / Tablet Slide-out Drawer */}
      {isMobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-sm transition-opacity"
            onClick={onCloseMobile}
            aria-hidden="true"
          />
          <nav
            aria-label="Mobile visualization toolbar"
            className="relative w-16 bg-[#060B13] border-r border-[#16283C] h-full flex flex-col items-center justify-start z-50 overflow-y-auto custom-scrollbar animate-in slide-in-from-left duration-200"
          >
            {content}
          </nav>
        </div>
      )}
    </>
  );
}
