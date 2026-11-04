import React from 'react';
import {
  Home,
  Layers,
  Lightbulb,
  Moon,
  Globe2,
  Hand,
  Grab,
  RotateCw,
  Sliders,
  GitCompare,
  HelpCircle,
  Radio,
  Thermometer,
  Compass,
  Ruler,
  Rocket,
  BarChart3,
} from 'lucide-react';

/**
 * Compact left-side vertical floating toolbar for map manipulation and mission telemetry.
 * Houses Home button, Layers toggle, 3D/2D switch, DTE Calculator, Weather/Thermal,
 * Site Analysis, Geodesic Ruler, Mission Comparison, Slip Simulator, planet switch, and ephemeris controls.
 */
export default function UnifiedToolbar({
  onReturnHome,
  onToggleLayers,
  isLayersOpen = false,
  onGoToSouthPole,
  onOpenMissionExplorer,
  onOpenComparison,
  onOpenSlipSimulator,
  onOpenDte,
  isDteOpen = false,
  onOpenWeather,
  isWeatherOpen = false,
  onOpenSiteAnalysis,
  isSiteAnalysisOpen = false,
  onToggleMeasure,
  isMeasureActive = false,
  onPlanetChange,
  onToggleAutoRotate,
  isAutoRotating = false,
  onToggleLighting,
  isSolarLighting = false,
  onResetOverview,
  activePlanet = 'moon',
  viewMode = '3d',
  onViewModeChange,
  onOpenGuide,
  onToggleCelestial,
  isCelestialOpen = false,
  timelineVisible = false,
}) {
  return (
    <div
      className={`fixed left-3 sm:left-4 z-30 pointer-events-auto select-none top-14 sm:top-16 ${
        timelineVisible ? 'bottom-[96px]' : 'bottom-3 sm:bottom-4'
      } flex flex-col justify-start`}
    >
      <div className="flex flex-col items-center gap-1 p-1 rounded-xl bg-[#080E18]/95 border border-[#16283C] shadow-[0_12px_36px_rgba(0,0,0,0.9)] backdrop-blur-2xl max-h-full overflow-y-auto custom-scrollbar">
        {/* Home Button (Resets Camera View to Overview) */}
        <button
          id="btn-toolbar-home-reset"
          type="button"
          onClick={onResetOverview || onReturnHome}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-[#F1F5F9] bg-[#0D1726] hover:bg-[#00D2C4] hover:text-[#060B13] transition-all"
          title="Reset View to Overview"
          aria-label="Reset view to overview"
        >
          <Home className="w-3.5 h-3.5" />
        </button>

        {/* Map Layers Panel Toggle */}
        <button
          id="btn-toolbar-layers"
          type="button"
          onClick={onToggleLayers}
          className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${
            isLayersOpen
              ? 'bg-[#00D2C4] text-[#060B13] shadow-[0_0_12px_rgba(0,210,196,0.35)] font-semibold'
              : 'text-[#94A3B8] hover:text-white hover:bg-[#152336]'
          }`}
          title="Toggle Basemap & Topographic Layers [L]"
          aria-label="Toggle layers"
        >
          <Layers className="w-3.5 h-3.5" />
        </button>

        <div className="w-4 h-[1px] bg-[#16283C] my-0.5" />

        {/* 3D Globe / 2D South Pole Topo Segmented Switcher */}
        <div className="flex flex-col items-center p-0.5 rounded-lg bg-[#0A1220] border border-[#16283C] gap-0.5">
          <button
            id="btn-toolbar-3d"
            type="button"
            onClick={() => onViewModeChange?.('3d')}
            className={`w-7 h-5 rounded flex items-center justify-center text-[9px] font-mono font-bold transition-all ${
              viewMode === '3d'
                ? 'bg-[#00D2C4] text-[#060B13] shadow-[0_0_8px_rgba(0,210,196,0.4)]'
                : 'text-[#94A3B8] hover:text-white'
            }`}
            title="3D Globe View [1]"
          >
            3D
          </button>
          <button
            id="btn-toolbar-2d"
            type="button"
            onClick={() => onViewModeChange?.('2d')}
            className={`w-7 h-5 rounded flex items-center justify-center text-[9px] font-mono font-bold transition-all ${
              viewMode === '2d' || viewMode === 'sp-2d'
                ? 'bg-[#00D2C4] text-[#060B13] shadow-[0_0_8px_rgba(0,210,196,0.4)]'
                : 'text-[#94A3B8] hover:text-white'
            }`}
            title="2D South Pole Topographical Map (80°S-90°S) [2]"
          >
            2D
          </button>
        </div>

        {/* Center on Lunar South Pole */}
        <button
          id="btn-toolbar-south-pole"
          type="button"
          onClick={onGoToSouthPole}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-[#00D2C4] hover:bg-[#00D2C4]/20 hover:text-white transition-all"
          title="Target Lunar South Pole (90°S) [S]"
          aria-label="Target Lunar South Pole"
        >
          <Compass className="w-3.5 h-3.5" />
        </button>

        {/* Geodesic Distance Ruler (2D Topo) */}
        <button
          id="btn-toolbar-measure"
          type="button"
          onClick={onToggleMeasure}
          className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${
            isMeasureActive
              ? 'bg-[#00D2C4] text-[#060B13] shadow-[0_0_10px_rgba(0,210,196,0.4)]'
              : 'text-[#94A3B8] hover:text-white hover:bg-[#152336]'
          }`}
          title="Geodesic Distance & Bearing Ruler [M]"
          aria-label="Geodesic distance ruler"
        >
          <Ruler className="w-3.5 h-3.5" />
        </button>

        <div className="w-4 h-[1px] bg-[#16283C] my-0.5" />

        {/* Direct-to-Earth (DTE) Communication Link Calculator */}
        <button
          id="btn-toolbar-dte"
          type="button"
          onClick={onOpenDte}
          className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${
            isDteOpen
              ? 'bg-[#E59A6D] text-[#12110D] shadow-[0_0_10px_rgba(229,154,109,0.4)]'
              : 'text-[#E59A6D] hover:bg-[#E59A6D]/20 hover:text-white'
          }`}
          title="Direct-to-Earth (DTE) Link & DSN Calculator [D]"
          aria-label="Open DTE Communication Calculator"
        >
          <Radio className="w-3.5 h-3.5" />
        </button>

        {/* Lunar Surface Thermal & Space Weather Report */}
        <button
          id="btn-toolbar-weather"
          type="button"
          onClick={onOpenWeather}
          className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${
            isWeatherOpen
              ? 'bg-[#88B38A] text-[#12110D] shadow-[0_0_10px_rgba(136,179,138,0.4)]'
              : 'text-[#88B38A] hover:bg-[#88B38A]/20 hover:text-white'
          }`}
          title="Lunar Surface Thermal & Space Weather Report [W]"
          aria-label="Open Lunar Weather and Thermal Report"
        >
          <Thermometer className="w-3.5 h-3.5" />
        </button>

        {/* Comprehensive Site Analysis & 360° Horizon Modal */}
        <button
          id="btn-toolbar-analysis"
          type="button"
          onClick={onOpenSiteAnalysis}
          className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${
            isSiteAnalysisOpen
              ? 'bg-[#38BDF8] text-[#060B13] shadow-[0_0_10px_rgba(56,189,248,0.4)]'
              : 'text-[#38BDF8] hover:bg-[#38BDF8]/20 hover:text-white'
          }`}
          title="360° Horizon Mask & Full Site Analysis [A]"
          aria-label="Open Site Analysis"
        >
          <BarChart3 className="w-3.5 h-3.5" />
        </button>

        {/* Mission / Site Comparison Modal */}
        <button
          id="btn-toolbar-compare"
          type="button"
          onClick={onOpenComparison}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-[#38BDF8] hover:bg-[#38BDF8]/20 hover:text-white transition-all"
          title="Compare Landing Sites & Dates Side-by-Side [C]"
          aria-label="Compare landing sites"
        >
          <GitCompare className="w-3.5 h-3.5" />
        </button>

        {/* Launch Slip Simulator & Heatmap */}
        <button
          id="btn-toolbar-slip"
          type="button"
          onClick={onOpenSlipSimulator}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-[#22D3EE] hover:bg-[#22D3EE]/20 hover:text-white transition-all"
          title="Launch Slip Simulator & Window Heatmap"
          aria-label="Open Launch Slip Simulator"
        >
          <Sliders className="w-3.5 h-3.5" />
        </button>

        {/* CLPS Mission Explorer */}
        {onOpenMissionExplorer && (
          <button
            id="btn-toolbar-missions"
            type="button"
            onClick={onOpenMissionExplorer}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-[#FBBF24] hover:bg-[#FBBF24]/20 hover:text-white transition-all"
            title="NASA CLPS & Artemis Mission Catalog"
            aria-label="Open Mission Explorer"
          >
            <Rocket className="w-3.5 h-3.5" />
          </button>
        )}

        <div className="w-4 h-[1px] bg-[#16283C] my-0.5" />

        {/* Planet Switch: Moon */}
        <button
          id="btn-toolbar-moon"
          type="button"
          onClick={() => {
            if (viewMode !== '3d') onViewModeChange?.('3d');
            onPlanetChange?.('moon');
          }}
          className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${
            activePlanet === 'moon' && viewMode === '3d'
              ? 'bg-[#00D2C4] text-[#060B13] font-bold shadow-[0_0_10px_rgba(0,210,196,0.3)]'
              : 'text-[#94A3B8] hover:text-white hover:bg-[#152336]'
          }`}
          title="Switch to 3D Moon"
        >
          <Moon className="w-3.5 h-3.5" />
        </button>

        {/* Planet Switch: Earth */}
        <button
          id="btn-toolbar-earth"
          type="button"
          onClick={() => {
            if (viewMode !== '3d') onViewModeChange?.('3d');
            onPlanetChange?.('earth');
          }}
          className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${
            activePlanet === 'earth' && viewMode === '3d'
              ? 'bg-[#34D399] text-[#060B13] font-bold shadow-[0_0_10px_rgba(52,211,153,0.3)]'
              : 'text-[#94A3B8] hover:text-white hover:bg-[#152336]'
          }`}
          title="Switch to 3D Earth DSN"
        >
          <Globe2 className="w-3.5 h-3.5" />
        </button>

        <div className="w-4 h-[1px] bg-[#16283C] my-0.5" />

        {/* Hand Grab: Celestial Ephemeris & Time Engine */}
        <button
          id="btn-toolbar-ephemeris"
          type="button"
          onClick={onToggleCelestial}
          className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${
            isCelestialOpen
              ? 'bg-[#00D2C4] text-[#060B13] shadow-[0_0_12px_rgba(0,210,196,0.4)] font-semibold'
              : 'text-[#94A3B8] hover:text-white hover:bg-[#152336]'
          }`}
          title={isCelestialOpen ? 'Close Celestial Ephemeris [E]' : 'Open Celestial Ephemeris & Time Engine [E]'}
          aria-label="Toggle Celestial Ephemeris"
        >
          {isCelestialOpen ? <Grab className="w-3.5 h-3.5" /> : <Hand className="w-3.5 h-3.5" />}
        </button>

        {/* Orbit Auto-Rotation Toggle */}
        <button
          id="btn-toolbar-auto-rotate"
          type="button"
          onClick={onToggleAutoRotate}
          className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${
            isAutoRotating
              ? 'bg-[#00D2C4] text-[#060B13] shadow-[0_0_8px_rgba(0,210,196,0.3)]'
              : 'text-[#94A3B8] hover:text-white hover:bg-[#152336]'
          }`}
          title={isAutoRotating ? 'Pause Orbit Rotation' : 'Start Orbit Rotation'}
          aria-label="Toggle orbit rotation"
        >
          <RotateCw className={`w-3.5 h-3.5 ${isAutoRotating ? 'animate-spin' : ''}`} />
        </button>

        {/* Lighting Shading Toggle */}
        <button
          id="btn-toolbar-lighting"
          type="button"
          onClick={onToggleLighting}
          className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${
            isSolarLighting ? 'bg-[#00D2C4] text-[#060B13]' : 'text-[#94A3B8] hover:text-white hover:bg-[#152336]'
          }`}
          title="Toggle Solar Terminator Shading"
          aria-label="Toggle solar shading"
          aria-pressed={isSolarLighting}
        >
          <Lightbulb className="w-3.5 h-3.5" />
        </button>

        {/* User Guide & Help */}
        {onOpenGuide && (
          <button
            id="btn-toolbar-guide"
            type="button"
            onClick={onOpenGuide}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-[#94A3B8] hover:text-[#00D2C4] hover:bg-[#152336] transition-colors"
            title="User Guide & Keyboard Shortcuts [?]"
          >
            <HelpCircle className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}
