import React, { useState, useEffect, useRef } from 'react';
import {
  ChevronDown,
  Moon,
  Globe2,
  Orbit,
  Target,
  GitCompare,
  Database,
  Menu,
  X,
  Compass,
  Clock,
  Sparkles,
  FileText,
  Home,
} from 'lucide-react';
import NavbarSearch from './NavbarSearch.jsx';
import { celestialTimeStore } from '../../utils/celestialTime.js';

export const WORKSPACE_PAGES = [
  { id: 'explorer', label: 'Lunar Map (3D / 2D)', icon: Compass, shortcut: '1/2' },
  { id: 'trajectory', label: 'Orbit Planner', icon: Orbit, shortcut: 'O' },
  { id: 'planner', label: 'Landing Recommendations', icon: Target, shortcut: 'P' },
  { id: 'comparison', label: 'Site Comparison', icon: GitCompare, shortcut: 'C' },
  { id: 'library', label: 'Data Sources & Library', icon: Database, shortcut: 'L' },
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
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [currentTimeMs, setCurrentTimeMs] = useState(() => celestialTimeStore.get().ms);
  const dropdownRef = useRef(null);

  // Subscribe to ephemeris time store
  useEffect(() => {
    return celestialTimeStore.subscribe(({ ms }) => {
      setCurrentTimeMs(ms);
    });
  }, []);

  // Click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Format UTC date/time for navbar indicator
  const dateObj = new Date(currentTimeMs);
  const formattedUtc = `${dateObj.getUTCFullYear()}-${String(dateObj.getUTCMonth() + 1).padStart(2, '0')}-${String(dateObj.getUTCDate()).padStart(2, '0')} ${String(dateObj.getUTCHours()).padStart(2, '0')}:${String(dateObj.getUTCMinutes()).padStart(2, '0')} UTC`;

  const activePageInfo =
    WORKSPACE_PAGES.find((p) => p.id === currentView) || WORKSPACE_PAGES[0];
  const ActiveIcon = activePageInfo.icon;

  const handleSelectWorkspace = (id) => {
    setIsDropdownOpen(false);
    if (id === 'explorer') {
      onNavigate?.('explorer');
    } else {
      onNavigate?.(id);
    }
  };

  return (
    <header
      role="banner"
      className="w-full h-14 min-h-[56px] bg-[#050507]/95 border-b border-white/[0.08] px-4 sm:px-6 flex items-center justify-between z-50 backdrop-blur-md select-none shrink-0 gap-3"
    >
      {/* ── LEFT: Back to Home Button + Workspace Switcher Dropdown + Search ── */}
      <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
        {/* Mobile menu hamburger toggle button */}
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

        {/* Back to Home Button (in place of Luna Studio logo) */}
        <button
          type="button"
          onClick={() => onNavigate?.('landing')}
          aria-label="Back to Home page"
          title="Back to Home page"
          className="h-8 px-3 rounded-lg bg-[#0C0D12] hover:bg-[#14161D] border border-white/[0.08] hover:border-white/[0.18] text-[12.5px] font-sans font-medium text-[#E2E8F0] hover:text-white flex items-center gap-1.5 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 shrink-0"
        >
          <Home className="w-3.5 h-3.5 text-white/75 shrink-0" />
          <span>Home</span>
        </button>

        {/* Subtle Vertical Divider */}
        <div className="hidden sm:block w-[1px] h-4 bg-white/[0.08] shrink-0" />

        {/* ── Dropdown: Workspace Switcher (Top-Left on Every Page) ───── */}
        <div ref={dropdownRef} className="relative shrink-0" data-guide="workspace-switcher">
          <button
            type="button"
            onClick={() => setIsDropdownOpen((prev) => !prev)}
            aria-label="Select mission workspace"
            aria-haspopup="listbox"
            aria-expanded={isDropdownOpen}
            className="h-8 px-3 rounded-lg bg-[#0C0D12] hover:bg-[#14161D] border border-white/[0.08] hover:border-white/[0.18] text-[12.5px] font-sans font-medium text-white flex items-center gap-2 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
          >
            <ActiveIcon className="w-3.5 h-3.5 text-white/75 shrink-0" />
            <span className="truncate max-w-[130px] sm:max-w-[180px] md:max-w-[210px] text-[12.5px] font-sans font-medium text-[#F8FAFC]">
              {activePageInfo.label}
            </span>
            <ChevronDown
              className={`w-3.5 h-3.5 text-[#8E95A5] transition-transform duration-200 ${
                isDropdownOpen ? 'rotate-180' : ''
              }`}
            />
          </button>

          {/* Dropdown Menu Popover aligned to left edge of button */}
          {isDropdownOpen && (
            <div
              role="listbox"
              aria-label="Mission Workspaces"
              className="absolute left-0 top-full mt-2 w-64 sm:w-72 bg-[#0A0B0E]/95 backdrop-blur-2xl border border-white/[0.1] rounded-xl shadow-[0_16px_48px_rgba(0,0,0,0.85)] p-1.5 z-50 animate-in fade-in zoom-in-95 duration-150 space-y-0.5"
            >
              <div className="px-3 py-1.5 text-[10px] font-mono font-medium uppercase tracking-[0.12em] text-[#8E95A5] border-b border-white/[0.06] mb-1">
                Mission Workspaces
              </div>
              {WORKSPACE_PAGES.map((page) => {
                const IconComp = page.icon;
                const isSelected = currentView === page.id;

                return (
                  <button
                    key={page.id}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => handleSelectWorkspace(page.id)}
                    className={`w-full px-3 py-2 rounded-lg flex items-center justify-between text-left transition-all ${
                      isSelected
                        ? 'bg-white/[0.08] border border-white/[0.14] text-white font-semibold'
                        : 'text-[#94A3B8] hover:text-white hover:bg-white/[0.04] border border-transparent font-medium'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <IconComp
                        className={`w-4 h-4 shrink-0 ${
                          isSelected ? 'text-white' : 'text-[#8E95A5]'
                        }`}
                      />
                      <span className="text-[12.5px] font-sans truncate">{page.label}</span>
                    </div>
                    {page.shortcut && (
                      <kbd className="px-1.5 py-0.5 rounded bg-[#050507] border border-white/[0.08] text-[10px] font-mono text-[#8E95A5]">
                        {page.shortcut}
                      </kbd>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {currentView === 'explorer' && (
          <>
            {/* Subtle Vertical Divider */}
            <div className="hidden md:block w-[1px] h-4 bg-white/[0.08] shrink-0" />

            {/* ── Search Bar (Explorer Only) ─────────────────────────── */}
            <NavbarSearch
              onSelectFeature={onSearchSelect}
              activePlanet={activePlanet}
            />
          </>
        )}
      </div>

      {/* ── RIGHT: (Explorer-only: Earth/Moon Switch) + Time + Guide Button ── */}
      <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
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
              className={`px-2.5 py-1 rounded-md flex items-center gap-1.5 text-[12px] font-sans transition-all focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/50 ${
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
              className={`px-2.5 py-1 rounded-md flex items-center gap-1.5 text-[12px] font-sans transition-all focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/50 ${
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

        {/* Live Ephemeris Time Badge */}
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
            className="h-8 px-3 rounded-lg bg-[#FACC15] hover:bg-[#FDE047] border border-[#EAB308]/60 text-[#050507] hover:text-black text-[12px] font-sans font-semibold flex items-center gap-1.5 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FACC15]/60 shrink-0"
          >
            <span>Guide</span>
          </button>
        )}
      </div>
    </header>
  );
}
