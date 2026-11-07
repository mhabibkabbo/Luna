import React from 'react';
import {
  Layers,
  Compass,
  Home,
  Lightbulb,
  Clock,
  RotateCw,
  Ruler,
} from 'lucide-react';
import NavTooltip from './NavTooltip.jsx';

/**
 * Compact left-side visualization toolbar.
 * Houses map manipulation, layer controls, and time controls.
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
  isMobileOpen = false,
  onCloseMobile,
}) {
  const isMoon = activePlanet === 'moon';
  const is2DMode = viewMode === '2d' || viewMode === 'sp-2d';
  const content = (
    <div className="flex flex-col items-center gap-1.5 w-full">
      <span className="hidden sr-only">Visualization Controls</span>

      {/* Reset View */}
      <NavTooltip label="Reset View" shortcut="Esc">
        <button
          type="button"
          onClick={onResetOverview}
          aria-label={`Reset ${isMoon ? 'Moon' : 'Earth'} view to global overview`}
          className="w-9 h-9 rounded-xl flex items-center justify-center text-[#8E95A5] hover:bg-white/[0.08] hover:text-white transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
        >
          <Home className="w-4 h-4" />
        </button>
      </NavTooltip>

      {/* Map & Layer Controls (3D Globe & 2D Topo Map) */}
      {isMoon && (
        <NavTooltip label={is2DMode ? 'Map Layers' : 'Basemap & Layers'} shortcut="L">
          <button
            type="button"
            data-guide="layers"
            onClick={onToggleLayers}
            aria-label={is2DMode ? 'Toggle map layers' : 'Toggle basemap and topographic layers'}
            aria-pressed={isLayersOpen}
            className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 ${
              isLayersOpen
                ? 'bg-white text-[#050507] font-semibold'
                : 'text-[#8E95A5] hover:text-white hover:bg-white/[0.06]'
            }`}
          >
            <Layers className="w-4 h-4" />
          </button>
        </NavTooltip>
      )}

      {/* Subtle Divider */}
      {isMoon && <div className="w-5 h-[1px] bg-white/[0.08] my-0.5" />}

      {/* Moon View / Display Mode (3D Globe vs 2D Topo) */}
      {isMoon && <div data-guide="view-mode" className="p-0.5 rounded-xl bg-[#0C0D12] border border-white/[0.08] flex flex-col gap-0.5">
        <NavTooltip label="3D Globe View" shortcut="1">
          <button
            type="button"
            onClick={() => onViewModeChange?.('3d')}
            aria-label="Switch to 3D Globe view"
            aria-pressed={viewMode === '3d'}
            className={`w-7 h-5 rounded-lg flex items-center justify-center text-[9px] font-mono font-bold transition-all focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/50 ${
              viewMode === '3d'
                ? 'bg-white text-[#050507]'
                : 'text-[#8E95A5] hover:text-white'
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
            aria-pressed={is2DMode}
            className={`w-7 h-5 rounded-lg flex items-center justify-center text-[9px] font-mono font-bold transition-all focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/50 ${
              is2DMode
                ? 'bg-white text-[#050507]'
                : 'text-[#8E95A5] hover:text-white'
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
          className="w-9 h-9 rounded-xl flex items-center justify-center text-[#CBD5E1] hover:bg-white/[0.08] hover:text-white transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
        >
          <Compass className="w-4 h-4" />
        </button>
      </NavTooltip>}

      {/* Subtle Divider */}
      <div className="w-5 h-[1px] bg-white/[0.08] my-0.5" />

      {/* Lighting / Display Settings (3D Globe only) */}
      {!is2DMode && (
        <NavTooltip label="Solar Shading">
          <button
            type="button"
            onClick={onToggleLighting}
            aria-label="Toggle real-time solar terminator shading"
            aria-pressed={isSolarLighting}
            className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 ${
              isSolarLighting
                ? 'bg-white text-[#050507]'
                : 'text-[#8E95A5] hover:text-white hover:bg-white/[0.06]'
            }`}
          >
            <Lightbulb className="w-4 h-4" />
          </button>
        </NavTooltip>
      )}

      {/* Time controls (3D Globe only) */}
      {isMoon && !is2DMode && (
        <NavTooltip label="Celestial Ephemeris" shortcut="E">
          <button
            type="button"
            onClick={onToggleCelestial}
            aria-label="Toggle Time Machine"
            aria-pressed={isCelestialOpen}
            className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 ${
              isCelestialOpen
                ? 'bg-white text-[#050507]'
                : 'text-[#8E95A5] hover:text-white hover:bg-white/[0.06]'
            }`}
          >
            <Clock className="w-4 h-4" />
          </button>
        </NavTooltip>
      )}

      {/* Auto-Rotation (3D Globe only) */}
      {!is2DMode && (
        <NavTooltip label={isAutoRotating ? 'Pause Rotation' : 'Auto-Rotation'}>
          <button
            type="button"
            onClick={onToggleAutoRotate}
            aria-label={isAutoRotating ? 'Pause orbital auto-rotation' : 'Start orbital auto-rotation'}
            aria-pressed={isAutoRotating}
            className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 ${
              isAutoRotating
                ? 'bg-white text-[#050507]'
                : 'text-[#8E95A5] hover:text-white hover:bg-white/[0.06]'
            }`}
          >
            <RotateCw className={`w-4 h-4 ${isAutoRotating ? 'animate-spin' : ''}`} />
          </button>
        </NavTooltip>
      )}

      {/* Geodesic Ruler (when in 2D mode) */}
      {isMoon && is2DMode && onToggleMeasure && (
        <NavTooltip label="Geodesic Ruler" shortcut="M">
          <button
            type="button"
            onClick={onToggleMeasure}
            aria-label="Toggle geodesic distance and bearing ruler"
            aria-pressed={isMeasureActive}
            className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 ${
              isMeasureActive
                ? 'bg-white text-[#050507]'
                : 'text-[#8E95A5] hover:text-white hover:bg-white/[0.06]'
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
      {/* Desktop Floating Visualization Dock */}
      <nav
        aria-label="Floating visualization toolbar"
        data-guide="toolbar"
        className="hidden lg:flex absolute left-3.5 sm:left-4 top-1/2 -translate-y-1/2 z-30 select-none overflow-visible flex-col items-center gap-1.5 p-1.5 rounded-2xl bg-[#08090C]/90 backdrop-blur-xl border border-white/[0.08] shadow-[0_16px_48px_rgba(0,0,0,0.8)] transition-all duration-200 pointer-events-auto"
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
            className="relative w-16 bg-[#050507] border-r border-white/[0.08] h-full flex flex-col items-center justify-start z-50 overflow-y-auto custom-scrollbar animate-in slide-in-from-left duration-200"
          >
            {content}
          </nav>
        </div>
      )}
    </>
  );
}
