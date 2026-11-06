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
  { id: 'briefing', label: 'Mission Briefing', icon: FileText, shortcut: 'B' },
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
      className="w-full h-13 min-h-[52px] bg-[#060B13]/95 border-b border-[#16283C]/80 px-3 sm:px-4 flex items-center justify-between z-40 backdrop-blur-md select-none shrink-0 gap-3"
    >
      {/* ── LEFT: Back to Home Button + Workspace Switcher Dropdown + Search ── */}
      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
        {/* Mobile menu hamburger toggle button */}
        {currentView === 'explorer' && (
          <button
            type="button"
            onClick={onToggleMobileMenu}
            aria-label={isMobileMenuOpen ? 'Close visualization toolbar' : 'Open visualization toolbar'}
            className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-white bg-[#0A1220] border border-[#16283C] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00D2C4]"
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
          className="h-8 px-2.5 sm:px-3 rounded-xl bg-[#080E18] hover:bg-[#0E1726] border border-[#16283C] hover:border-[#00D2C4]/50 text-xs font-mono font-medium text-slate-200 hover:text-white flex items-center gap-1.5 shadow-md transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00D2C4] shrink-0"
        >
          <Home className="w-3.5 h-3.5 text-[#00D2C4] shrink-0" />
          <span>Home</span>
        </button>

        {/* Subtle Vertical Divider */}
        <div className="hidden sm:block w-[1px] h-6 bg-[#16283C]/80 shrink-0" />

        {/* ── Dropdown: Workspace Switcher (Top-Left on Every Page) ───── */}
        <div ref={dropdownRef} className="relative shrink-0" data-guide="workspace-switcher">
          <button
            type="button"
            onClick={() => setIsDropdownOpen((prev) => !prev)}
            aria-label="Select mission workspace"
            aria-haspopup="listbox"
            aria-expanded={isDropdownOpen}
            className="h-8 px-2.5 sm:px-3 rounded-xl bg-[#080E18] hover:bg-[#0E1726] border border-[#16283C] hover:border-[#00D2C4]/50 text-xs font-medium text-[#F1F5F9] flex items-center gap-2 shadow-md transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00D2C4]"
          >
            <ActiveIcon className="w-3.5 h-3.5 text-[#00D2C4] shrink-0" />
            <span className="truncate max-w-[120px] sm:max-w-[170px] md:max-w-[200px] text-xs font-mono text-cyan-300">
              {activePageInfo.label}
            </span>
            <ChevronDown
              className={`w-3 h-3 text-slate-400 transition-transform duration-200 ${
                isDropdownOpen ? 'rotate-180' : ''
              }`}
            />
          </button>

          {/* Dropdown Menu Popover aligned to left edge of button */}
          {isDropdownOpen && (
            <div
              role="listbox"
              aria-label="Mission Workspaces"
              className="absolute left-0 top-full mt-2 w-64 sm:w-72 bg-[#080E18]/95 backdrop-blur-2xl border border-[#16283C] rounded-2xl shadow-[0_12px_40px_rgba(0,0,0,0.9)] p-1.5 z-50 animate-in fade-in zoom-in-95 duration-150 space-y-0.5"
            >
              <div className="px-2.5 py-1 text-[10px] font-mono uppercase tracking-wider text-slate-500 border-b border-[#16283C]/60 mb-1">
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
                    className={`w-full px-2.5 py-2 rounded-xl flex items-center justify-between text-left transition-all ${
                      isSelected
                        ? 'bg-[#00D2C4]/15 border border-[#00D2C4]/40 text-[#00D2C4] font-semibold'
                        : 'text-slate-300 hover:text-white hover:bg-[#0E1A2C] border border-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <IconComp
                        className={`w-4 h-4 shrink-0 ${
                          isSelected ? 'text-[#00D2C4]' : 'text-slate-400'
                        }`}
                      />
                      <span className="text-xs font-mono truncate">{page.label}</span>
                    </div>
                    {page.shortcut && (
                      <kbd className="px-1.5 py-0.2 rounded bg-[#060B13] border border-[#16283C] text-[9.5px] font-mono text-slate-400">
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
            <div className="hidden md:block w-[1px] h-6 bg-[#16283C]/80 shrink-0" />

            {/* ── Search Bar (Explorer Only) ─────────────────────────── */}
            <NavbarSearch
              onSelectFeature={onSearchSelect}
              activePlanet={activePlanet}
            />
          </>
        )}
      </div>

      {/* ── RIGHT: Time + (Explorer-only: Earth/Moon Switch + Guide Button) ── */}
      <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
        {/* Live Ephemeris Time Badge */}
        <div
          title="Current Mission Celestial Ephemeris UTC Timestamp"
          className={`${
            currentView === 'explorer' ? 'hidden xl:flex' : 'hidden sm:flex'
          } items-center gap-1.5 px-2.5 py-1 rounded-xl bg-[#080E18] border border-[#16283C] text-[10.5px] font-mono text-slate-300`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <Clock className="w-3 h-3 text-[#00D2C4]" />
          <span className="tabular-nums">{formattedUtc}</span>
        </div>

        {currentView === 'explorer' && (
          <>
            {/* Earth / Moon Toggle Switch */}
            <div
              className="flex items-center p-0.5 rounded-xl bg-[#080E18] border border-[#16283C] text-xs font-mono"
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
                className={`px-2 py-1 rounded-lg flex items-center gap-1.5 text-xs transition-all focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#00D2C4] ${
                  activePlanet === 'moon'
                    ? 'bg-[#00D2C4] text-[#060B13] font-bold shadow-[0_0_8px_rgba(0,210,196,0.4)]'
                    : 'text-slate-400 hover:text-white'
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
                className={`px-2 py-1 rounded-lg flex items-center gap-1.5 text-xs transition-all focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#00D2C4] ${
                  activePlanet === 'earth'
                    ? 'bg-[#34D399] text-[#060B13] font-bold shadow-[0_0_8px_rgba(52,211,153,0.3)]'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Globe2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Earth DSN</span>
              </button>
            </div>

            {/* ── Guide Button (in distinct amber color, Explorer Only) ────── */}
            <button
              type="button"
              onClick={onOpenGuide}
              aria-label="Open user guide"
              className="h-9 px-2 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 hover:border-amber-400 text-amber-300 hover:text-amber-200 text-xs font-mono font-semibold flex items-center gap-1.5 transition-all shadow-[0_0_12px_rgba(245,158,11,0.25)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 shrink-0"
            >
              <span>Guide</span>
            </button>
          </>
        )}
      </div>
    </header>
  );
}
