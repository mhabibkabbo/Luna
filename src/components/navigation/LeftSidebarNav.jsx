import React, { useEffect } from 'react';
import {
  Layers,
  Compass,
  RotateCcw,
  Lightbulb,
  Clock,
  RotateCw,
  RefreshCw,
  Ruler,
  Route,
  X,
} from 'lucide-react';
import NavTooltip from './NavTooltip.jsx';

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
  isRouteActive = false,
  onToggleRoute,
  onGoToSouthPole,
  onResetOverview,
  isMobileOpen = false,
  onCloseMobile,
}) {
  const isMoon = activePlanet === 'moon';
  const is2DMode = viewMode === '2d' || viewMode === 'sp-2d';

  useEffect(() => {
    if (!isMobileOpen) return undefined;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') onCloseMobile?.();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isMobileOpen, onCloseMobile]);

  const content = (
    <div className="flex flex-col items-center gap-1.5 w-full">
      <span className="hidden sr-only">Visualization Controls</span>

      <NavTooltip label="Reset View" shortcut="Esc">
        <button
          type="button"
          data-testid="reset-view-btn"
          onClick={onResetOverview}
          aria-label={`Reset ${isMoon ? 'Moon' : 'Earth'} view to global overview`}
          className="w-9 h-9 rounded-xl flex items-center justify-center text-[#8E95A5] hover:bg-white/[0.08] hover:text-white transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </NavTooltip>

      {isMoon && (
        <NavTooltip label={is2DMode ? 'Map Layers' : 'Basemap & Layers'} shortcut="L">
          <button
            type="button"
            data-guide="layers"
            onClick={onToggleLayers}
            aria-label={is2DMode ? 'Toggle map layers' : 'Toggle basemap and topographic layers'}
            aria-pressed={isLayersOpen}
            className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 ${isLayersOpen
                ? 'bg-white text-[#050507] font-semibold'
                : 'text-[#8E95A5] hover:text-white hover:bg-white/[0.06]'
              }`}
          >
            <Layers className="w-4 h-4" />
          </button>
        </NavTooltip>
      )}

      {isMoon && <div className="w-5 h-[1px] bg-white/[0.08] my-0.5" />}

      {isMoon && <div data-guide="view-mode" className="p-0.5 rounded-xl bg-[#0C0D12] border border-white/[0.08] flex flex-col gap-0.5">
        <NavTooltip label="3D Globe View" shortcut="1">
          <button
            type="button"
            onClick={() => onViewModeChange?.('3d')}
            aria-label="Switch to 3D Globe view"
            aria-pressed={viewMode === '3d'}
            className={`w-8 h-6 rounded-lg flex items-center justify-center text-[10px] font-mono font-bold transition-all focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/50 ${viewMode === '3d'
                ? 'bg-white text-[#050507]'
                : 'text-[#8E95A5] hover:text-white'
              }`}
          >
            3D
          </button>
        </NavTooltip>
        <NavTooltip label="2D South Pole Only (80°S–90°S, 180°W–180°E)" shortcut="2">
          <button
            type="button"
            onClick={() => onViewModeChange?.('2d')}
            aria-label="Switch to 2D South Pole only topographic map (80°S to 90°S, 180°W to 180°E)"
            aria-pressed={is2DMode}
            className={`w-8 h-6 rounded-lg flex items-center justify-center text-[10px] font-mono font-bold transition-all focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/50 ${is2DMode
                ? 'bg-white text-[#050507]'
                : 'text-[#8E95A5] hover:text-white'
              }`}
          >
            2D
          </button>
        </NavTooltip>
      </div>}

      {isMoon && !is2DMode && (
        <NavTooltip label="Target South Pole" shortcut="S">
          <button
            type="button"
            onClick={onGoToSouthPole}
            aria-label="Center camera on Lunar South Pole"
            className="w-9 h-9 rounded-xl flex items-center justify-center text-[#CBD5E1] hover:bg-white/[0.08] hover:text-white transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
          >
            <Compass className="w-4 h-4" />
          </button>
        </NavTooltip>
      )}

      <div className="w-5 h-[1px] bg-white/[0.08] my-0.5" />

      {!is2DMode && (
        <NavTooltip label="Solar Shading">
          <button
            type="button"
            onClick={onToggleLighting}
            aria-label="Toggle real-time solar terminator shading"
            aria-pressed={isSolarLighting}
            className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 ${isSolarLighting
                ? 'bg-white text-[#050507]'
                : 'text-[#8E95A5] hover:text-white hover:bg-white/[0.06]'
              }`}
          >
            <Lightbulb className="w-4 h-4" />
          </button>
        </NavTooltip>
      )}

      {!is2DMode && (
        <NavTooltip label="Celestial Ephemeris" shortcut="E">
          <button
            type="button"
            onClick={onToggleCelestial}
            aria-label="Toggle Celestial Ephemeris"
            aria-pressed={isCelestialOpen}
            className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 ${isCelestialOpen
                ? 'bg-white text-[#050507]'
                : 'text-[#8E95A5] hover:text-white hover:bg-white/[0.06]'
              }`}
          >
            <Clock className="w-4 h-4" />
          </button>
        </NavTooltip>
      )}

      {!is2DMode && (
        <NavTooltip label={isAutoRotating ? 'Pause Rotation' : 'Auto-Rotation'}>
          <button
            type="button"
            onClick={onToggleAutoRotate}
            aria-label={isAutoRotating ? 'Pause orbital auto-rotation' : 'Start orbital auto-rotation'}
            aria-pressed={isAutoRotating}
            className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 ${isAutoRotating
                ? 'bg-white text-[#050507]'
                : 'text-[#8E95A5] hover:text-white hover:bg-white/[0.06]'
              }`}
          >
            <RotateCw className={`w-4 h-4 ${isAutoRotating ? 'animate-spin' : ''}`} />
          </button>
        </NavTooltip>
      )}

      {isMoon && is2DMode && onToggleMeasure && (
        <NavTooltip label="Geodesic Ruler" shortcut="M">
          <button
            type="button"
            onClick={onToggleMeasure}
            aria-label="Toggle geodesic distance and bearing ruler"
            aria-pressed={isMeasureActive}
            className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 ${isMeasureActive
                ? 'bg-white text-[#050507]'
                : 'text-[#8E95A5] hover:text-white hover:bg-white/[0.06]'
              }`}
          >
            <Ruler className="w-4 h-4" />
          </button>
        </NavTooltip>
      )}

      {isMoon && is2DMode && onToggleRoute && (
        <NavTooltip label="Route Planner" shortcut="R">
          <button
            type="button"
            onClick={onToggleRoute}
            aria-label="Toggle slope-limited rover traverse route planner"
            aria-pressed={isRouteActive}
            className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 ${isRouteActive
                ? 'bg-cyan-400 text-[#050507] shadow-[0_0_12px_rgba(6,182,212,0.4)]'
                : 'text-[#8E95A5] hover:text-cyan-300 hover:bg-white/[0.06]'
              }`}
          >
            <Route className="w-4 h-4" />
          </button>
        </NavTooltip>
      )}
    </div>
  );

  return (
    <>
      <nav
        aria-label="Floating visualization toolbar"
        data-guide="toolbar"
        className="hidden lg:flex absolute left-3.5 sm:left-4 top-1/2 -translate-y-1/2 z-30 select-none overflow-visible flex-col items-center gap-1.5 p-1.5 rounded-2xl bg-[#08090C]/90 backdrop-blur-xl border border-white/[0.08] shadow-[0_16px_48px_rgba(0,0,0,0.8)] transition-all duration-200 pointer-events-auto"
      >
        {content}
      </nav>

      {isMobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-sm transition-opacity"
            onClick={onCloseMobile}
            aria-hidden="true"
          />
          <nav
            aria-label="Mobile visualization toolbar"
            data-guide="toolbar"
            className="relative w-20 bg-[#050507] border-r border-white/[0.08] h-full flex flex-col items-center justify-start pt-3 pb-6 z-50 overflow-y-auto custom-scrollbar animate-in slide-in-from-left duration-200 gap-2"
          >
            <button
              type="button"
              onClick={onCloseMobile}
              aria-label="Close visualization toolbar"
              className="w-8 h-8 rounded-lg flex items-center justify-center text-[#8E95A5] hover:text-white hover:bg-white/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
            >
              <X className="w-4 h-4" />
            </button>
            <span className="text-[9px] font-mono uppercase tracking-wider text-[#8E95A5]">Tools</span>
            {content}
          </nav>
        </div>
      )}
    </>
  );
}
