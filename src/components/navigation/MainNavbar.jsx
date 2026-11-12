import React, { useState, useEffect } from 'react';
import {
  Moon,
  Globe2,
  Orbit,
  Target,
  GitCompare,
  Database,
  Menu,
  X,
  ChevronDown,
  Compass,
  Clock,
  FileText,
} from 'lucide-react';
import NavbarSearch from './NavbarSearch.jsx';
import { celestialTimeStore } from '../../utils/celestialTime.js';
import { LunaStencilWordmark } from '../common/LunaBrandLogo.jsx';

export const WORKSPACE_PAGES = [
  { id: 'explorer', label: 'Lunar Map (3D / 2D)', shortLabel: 'Map', icon: Compass, shortcut: '1/2' },
  { id: 'trajectory', label: 'Orbit Planner', shortLabel: 'Orbit', icon: Orbit, shortcut: 'O' },
  { id: 'planner', label: 'Landing Recommendations', shortLabel: 'Planner', icon: Target, shortcut: 'P' },
  { id: 'comparison', label: 'Site Comparison', shortLabel: 'Compare', icon: GitCompare, shortcut: 'C' },
  { id: 'library', label: 'Data Sources & Library', shortLabel: 'Library', icon: Database, shortcut: 'L' },
];

export default function MainNavbar({
  currentView = 'explorer',
  viewMode = '3d',
  activePlanet = 'moon',
  onNavigate,
  onViewModeChange,
  onPlanetChange,
  onSearchSelect,
  onOpenGuide,
  isMobileMenuOpen = false,
  onToggleMobileMenu,
}) {
  const [currentTimeMs, setCurrentTimeMs] = useState(() => celestialTimeStore.get().ms);

  useEffect(() => {
    return celestialTimeStore.subscribe(({ ms }) => {
      setCurrentTimeMs(ms);
    });
  }, []);

  const dateObj = new Date(currentTimeMs);
  const formattedUtc = `${dateObj.getUTCFullYear()}-${String(dateObj.getUTCMonth() + 1).padStart(2, '0')}-${String(dateObj.getUTCDate()).padStart(2, '0')} ${String(dateObj.getUTCHours()).padStart(2, '0')}:${String(dateObj.getUTCMinutes()).padStart(2, '0')} UTC`;

  const handleSelectWorkspace = (id) => {
    if (id === 'explorer') {
      onNavigate?.('explorer');
    } else {
      onNavigate?.(id);
    }
  };

  return (
    <header
      role="banner"
      className="relative w-full h-14 min-h-[56px] bg-[#050507]/95 border-b border-white/[0.08] px-2.5 sm:px-6 flex items-center justify-between z-50 backdrop-blur-md select-none shrink-0 gap-1.5 sm:gap-3"
    >
      <div className="flex items-center gap-1.5 sm:gap-2.5 min-w-0">
        {currentView === 'explorer' && (
          <button
            type="button"
            onClick={onToggleMobileMenu}
            aria-label={isMobileMenuOpen ? 'Close visualization toolbar' : 'Open visualization toolbar'}
            className="lg:hidden p-2 rounded-lg text-[#8E95A5] hover:text-white bg-[#0C0D12] border border-white/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
          >
            {isMobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>
        )}

        <button
          type="button"
          onClick={() => onNavigate?.('landing')}
          aria-label="Luna Home — Return to Overview"
          title="Luna Home"
          className="h-8 px-2.5 rounded-lg bg-[#0C0D12] hover:bg-[#14161D] border border-white/[0.08] hover:border-white/[0.22] flex items-center justify-center transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 shrink-0 group shadow-sm active:scale-[0.98]"
        >
          <LunaStencilWordmark className="h-3.5 sm:h-4 w-auto fill-[#F8FAFC] group-hover:fill-white transition-colors" />
        </button>

        <div className="hidden sm:block w-[1px] h-4 bg-white/[0.08] shrink-0" />

        <nav
          aria-label="Mission Workspaces"
          data-guide="workspace-switcher"
          className="hidden lg:flex items-center p-0.5 rounded-lg bg-[#0C0D12] border border-white/[0.08] overflow-x-auto no-scrollbar max-w-full"
        >
          <div role="tablist" aria-label="Mission Workspaces" className="flex items-center gap-0.5">
            {WORKSPACE_PAGES.map((page) => {
              const IconComp = page.icon;
              const isSelected = currentView === page.id;

              return (
                <button
                  key={page.id}
                  type="button"
                  role="tab"
                  aria-selected={isSelected}
                  aria-current={isSelected ? 'page' : undefined}
                  onClick={() => handleSelectWorkspace(page.id)}
                  title={`${page.label}${page.shortcut ? ` (${page.shortcut})` : ''}`}
                  className={`h-7 sm:h-8 px-2.5 sm:px-3 rounded-md flex items-center gap-1.5 text-[11.5px] sm:text-[12px] font-sans transition-all focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/50 shrink-0 active:scale-[0.98] ${
                    isSelected
                      ? 'bg-white text-[#050507] font-semibold shadow-sm'
                      : 'text-[#94A3B8] hover:text-white hover:bg-white/[0.05] font-medium'
                  }`}
                >
                  <IconComp
                    className={`w-3.5 h-3.5 shrink-0 ${
                      isSelected ? 'text-[#050507]' : 'text-[#8E95A5]'
                    }`}
                  />
                  <span>{page.shortLabel}</span>
                </button>
              );
            })}
          </div>
        </nav>
        <label className="lg:hidden relative flex min-w-0 items-center rounded-lg border border-white/[0.08] bg-[#0C0D12]">
          <span className="sr-only">Mission workspace</span>
          <select
            aria-label="Mission workspace"
            value={currentView}
            onChange={(event) => handleSelectWorkspace(event.target.value)}
            className="h-[30px] w-[76px] appearance-none truncate bg-transparent pl-2 pr-6 text-[12px] font-medium text-white outline-none sm:w-[84px]"
          >
            {WORKSPACE_PAGES.map((page) => (
              <option key={page.id} value={page.id} className="bg-[#0C0D12]">
                {page.shortLabel}
              </option>
            ))}
          </select>
          <ChevronDown aria-hidden="true" className="pointer-events-none absolute right-1.5 h-3 w-3 text-[#8E95A5]" />
        </label>

        <div className="hidden sm:block w-[1px] h-4 bg-white/[0.08] shrink-0" />

        <NavbarSearch
          onSelectFeature={onSearchSelect}
          activePlanet={activePlanet}
        />
      </div>

      <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
        {currentView === 'explorer' && (
          <div
            className="flex items-center p-0.5 rounded-lg bg-[#0C0D12] border border-white/[0.08] text-xs font-sans"
            role="group"
            aria-label="Target Celestial Body"
          >
            <button
              type="button"
              onClick={() => {
                if (viewMode !== '3d') onViewModeChange?.('3d');
                onPlanetChange?.('moon');
              }}
              aria-label="Switch to Moon"
              aria-pressed={activePlanet === 'moon'}
              className={`px-1.5 sm:px-2.5 py-1 rounded-md flex items-center gap-1.5 text-[12px] font-sans transition-all focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/50 ${
                activePlanet === 'moon'
                  ? 'bg-white text-[#050507] font-semibold'
                  : 'text-[#8E95A5] hover:text-white font-medium'
              }`}
            >
              <Moon className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Moon</span>
            </button>

            <button
              type="button"
              onClick={() => {
                if (viewMode !== '3d') onViewModeChange?.('3d');
                onPlanetChange?.('earth');
              }}
              aria-label="Switch to Earth Deep Space Network"
              aria-pressed={activePlanet === 'earth'}
              className={`px-1.5 sm:px-2.5 py-1 rounded-md flex items-center gap-1.5 text-[12px] font-sans transition-all focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/50 ${
                activePlanet === 'earth'
                  ? 'bg-white text-[#050507] font-semibold'
                  : 'text-[#8E95A5] hover:text-white font-medium'
              }`}
            >
              <Globe2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Earth DSN</span>
            </button>
          </div>
        )}

        <div
          title="Current Mission Celestial Ephemeris UTC Timestamp"
          className={`${
            currentView === 'explorer' ? 'hidden xl:flex' : 'hidden sm:flex'
          } items-center h-8 gap-1.5 px-3 rounded-lg bg-[#0C0D12] border border-white/[0.08] text-[11px] font-mono font-medium text-[#CBD5E1]`}
        >
          <Clock className="w-3.5 h-3.5 text-[#8E95A5]" />
          <span className="tabular-nums">{formattedUtc}</span>
        </div>

        {currentView === 'explorer' && (
          <button
            type="button"
            onClick={onOpenGuide}
            aria-label="Open user guide"
            className="h-8 w-8 sm:w-auto px-2 sm:px-3 rounded-lg bg-[#FACC15] hover:bg-[#FDE047] border border-[#EAB308]/60 text-[#050507] hover:text-black text-[12px] font-sans font-semibold flex items-center justify-center gap-1.5 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FACC15]/60 shrink-0"
          >
            <FileText className="w-3.5 h-3.5" aria-hidden="true" />
            <span className="hidden sm:inline">Guide</span>
          </button>
        )}
      </div>
    </header>
  );
}
