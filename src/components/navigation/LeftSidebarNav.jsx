import React from 'react';
import {
  Compass,
  Orbit,
  BarChart3,
  Target,
  GitCompare,
  Database,
  Rocket,
  FileText,
  Layers,
  Moon,
  Globe2,
  Home,
  Lightbulb,
  Hand,
  Grab,
  RotateCw,
  Ruler,
  HelpCircle,
} from 'lucide-react';
import NavTooltip from './NavTooltip.jsx';

/**
 * Compact, unified left-side navigation panel.
 * Houses two distinct semantic groupings:
 * 1. Application Navigation (Workspaces)
 * 2. Visualization Controls (Map manipulation & ephemeris)
 */
export default function LeftSidebarNav({
  currentView = 'explorer',
  onNavigate,
  viewMode = '3d',
  onViewModeChange,
  activePlanet = 'moon',
  onPlanetChange,
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
  onOpenGuide,
  isMobileOpen = false,
  onCloseMobile,
}) {
  const navigationItems = [
    { id: 'explorer', label: 'Lunar Map', icon: Compass, shortcut: '1/2' },
    { id: 'trajectory', label: 'Orbit Planner', icon: Orbit, shortcut: 'O' },
    { id: 'mission-control', label: 'Mission Overview', icon: Rocket, shortcut: 'M' },
    { id: 'site-analysis', label: 'Site Analysis', icon: BarChart3, shortcut: 'A' },
    { id: 'planner', label: 'Landing Recommendations', icon: Target, shortcut: 'P' },
    { id: 'comparison', label: 'Site Comparison', icon: GitCompare, shortcut: 'C' },
    { id: 'library', label: 'Data Sources & Library', icon: Database, shortcut: 'L' },
    { id: 'missions', label: 'Mission Catalog', icon: FileText, shortcut: 'K' },
  ];

  const content = (
    <div className="flex flex-col items-center gap-1.5 w-full py-2">
      {/* ── GROUP 1: NAVIGATION ────────────────────────────────────────────── */}
      <div className="flex flex-col items-center gap-1 w-full px-1.5">
        <span className="hidden sr-only">Main Navigation</span>
        {navigationItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentView === item.id;

          return (
            <NavTooltip
              key={item.id}
              label={item.label}
              shortcut={item.shortcut}
              side="right"
            >
              <button
                type="button"
                onClick={() => {
                  onNavigate?.(item.id);
                  onCloseMobile?.();
                }}
                aria-label={`Open ${item.label}`}
                aria-current={isActive ? 'page' : undefined}
                className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00D2C4] ${
                  isActive
                    ? 'bg-[#00D2C4] text-[#060B13] font-bold shadow-[0_0_14px_rgba(0,210,196,0.45)]'
                    : 'text-slate-400 hover:text-white hover:bg-[#0E1A2C]'
                }`}
              >
                <Icon className="w-4 h-4" />
              </button>
            </NavTooltip>
          );
        })}
      </div>

      {/* ── DIVIDER ────────────────────────────────────────────────────────── */}
      <div className="w-6 h-[1px] bg-[#16283C] my-1" />

      {/* ── GROUP 2: VISUALIZATION CONTROLS ───────────────────────────────── */}
      <div className="flex flex-col items-center gap-1 w-full px-1.5">
        <span className="hidden sr-only">Visualization Controls</span>

        {/* Orbit / Layer Controls */}
        <NavTooltip label="Basemap & Topo Layers" shortcut="L" side="right">
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
        </NavTooltip>

        {/* Rocket / Mission Controls */}
        {onOpenMissionExplorer && (
          <NavTooltip label="NASA CLPS Mission Manifest" side="right">
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
        <div data-guide="view-mode" className="p-0.5 rounded-xl bg-[#0A1220] border border-[#16283C] flex flex-col gap-0.5">
          <NavTooltip label="3D Globe View" shortcut="1" side="right">
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
          <NavTooltip label="2D South Pole Topo Map (80°S–90°S)" shortcut="2" side="right">
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
        </div>

        {/* Globe / Coordinate Controls (Moon vs Earth DSN) */}
        <NavTooltip
          label={activePlanet === 'moon' ? 'Switch to Earth DSN' : 'Switch to Moon'}
          side="right"
        >
          <button
            type="button"
            onClick={() => {
              if (viewMode !== '3d') onViewModeChange?.('3d');
              onPlanetChange?.(activePlanet === 'moon' ? 'earth' : 'moon');
            }}
            aria-label={`Switch planet to ${activePlanet === 'moon' ? 'Earth Deep Space Network' : 'Moon'}`}
            className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00D2C4] ${
              activePlanet === 'earth'
                ? 'bg-[#34D399] text-[#060B13] font-bold shadow-[0_0_10px_rgba(52,211,153,0.3)]'
                : 'text-slate-400 hover:text-white hover:bg-[#0E1A2C]'
            }`}
          >
            {activePlanet === 'moon' ? <Moon className="w-4 h-4" /> : <Globe2 className="w-4 h-4" />}
          </button>
        </NavTooltip>

        {/* Pan / Navigation (Center on Lunar South Pole) */}
        <NavTooltip label="Center on Lunar South Pole (90°S)" shortcut="S" side="right">
          <button
            type="button"
            onClick={onGoToSouthPole}
            aria-label="Center camera on Lunar South Pole"
            className="w-9 h-9 rounded-xl flex items-center justify-center text-[#00D2C4] hover:bg-[#00D2C4]/20 hover:text-white transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00D2C4]"
          >
            <Compass className="w-4 h-4" />
          </button>
        </NavTooltip>

        {/* Reset View */}
        <NavTooltip label="Reset Moon View to Overview" shortcut="Esc" side="right">
          <button
            type="button"
            onClick={onResetOverview}
            aria-label="Reset Moon view to global overview"
            className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-300 hover:bg-[#00D2C4] hover:text-[#060B13] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00D2C4]"
          >
            <Home className="w-4 h-4" />
          </button>
        </NavTooltip>

        {/* Lighting / Display Settings */}
        <NavTooltip label="Toggle Solar Terminator Shading" side="right">
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
        <NavTooltip label="Celestial Ephemeris Engine" shortcut="E" side="right">
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
            {isCelestialOpen ? <Grab className="w-4 h-4" /> : <Hand className="w-4 h-4" />}
          </button>
        </NavTooltip>

        {/* Auto-Rotation */}
        <NavTooltip label={isAutoRotating ? 'Pause Orbit Rotation' : 'Start Orbit Rotation'} side="right">
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
        {(viewMode === '2d' || viewMode === 'sp-2d') && onToggleMeasure && (
          <NavTooltip label="Geodesic Distance Ruler" shortcut="M" side="right">
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

        {/* Help */}
        {onOpenGuide && (
          <NavTooltip label="User Guide & Keyboard Shortcuts" shortcut="?" side="right">
            <button
              type="button"
              onClick={onOpenGuide}
              aria-label="Open user guide and keyboard shortcuts"
              className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-400 hover:text-[#00D2C4] hover:bg-[#0E1A2C] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00D2C4]"
            >
              <HelpCircle className="w-4 h-4" />
            </button>
          </NavTooltip>
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Compact Sidebar */}
      <nav
        aria-label="Main application sidebar"
        data-guide="toolbar"
        className="hidden lg:flex w-14 shrink-0 h-full bg-[#060B13]/95 border-r border-[#16283C]/80 flex-col items-center justify-start z-30 select-none overflow-y-auto custom-scrollbar backdrop-blur-md"
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
            aria-label="Mobile navigation drawer"
            className="relative w-16 bg-[#060B13] border-r border-[#16283C] h-full flex flex-col items-center justify-start z-50 overflow-y-auto custom-scrollbar animate-in slide-in-from-left duration-200"
          >
            {content}
          </nav>
        </div>
      )}
    </>
  );
}

