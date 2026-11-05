import React, { useState, useEffect, useRef } from 'react';
import {
  ChevronDown,
  Moon,
  Orbit,
  BarChart3,
  Target,
  GitCompare,
  Database,
  Rocket,
  Radio,
  HelpCircle,
  Menu,
  X,
  Compass,
  Clock,
  Sparkles,
} from 'lucide-react';
import LunaBrandLogo from '../common/LunaBrandLogo.jsx';
import NavbarSearch from './NavbarSearch.jsx';
import NavTooltip from './NavTooltip.jsx';
import { celestialTimeStore } from '../../utils/celestialTime.js';

export const WORKSPACE_PAGES = [
  { id: 'explorer', label: 'Lunar Map (3D / 2D)', icon: Compass, shortcut: '1/2' },
  { id: 'trajectory', label: 'Orbit Planner', icon: Orbit, shortcut: 'O' },
  { id: 'mission-control', label: 'Mission Overview', icon: Rocket, shortcut: 'M' },
  { id: 'site-analysis', label: 'Site Analysis', icon: BarChart3, shortcut: 'A' },
  { id: 'communication', label: 'DTE Communications', icon: Radio, shortcut: 'D' },
  { id: 'planner', label: 'Landing Recommendations', icon: Target, shortcut: 'P' },
  { id: 'comparison', label: 'Site Comparison', icon: GitCompare, shortcut: 'C' },
  { id: 'library', label: 'Data Sources & Library', icon: Database, shortcut: 'L' },
  { id: 'missions', label: 'Mission Catalog', icon: Rocket, shortcut: 'K' },
  { id: 'about', label: 'About Luna', icon: HelpCircle, shortcut: '?' },
];

export default function MainNavbar({
  currentView = 'explorer',
  viewMode = '3d',
  activePlanet = 'moon',
  onNavigate,
  onViewModeChange,
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
      className="w-full h-13 min-h-[52px] bg-[#060B13]/95 border-b border-[#16283C]/80 px-3 sm:px-4 flex items-center justify-between z-40 backdrop-blur-md select-none shrink-0"
    >
      {/* ── LEFT: Logo + Workspace Dropdown + Search ─────────────────────────── */}
      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
        {/* Mobile menu hamburger toggle button */}
        <button
          type="button"
          onClick={onToggleMobileMenu}
          aria-label={isMobileMenuOpen ? 'Close navigation sidebar' : 'Open navigation sidebar'}
          className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-white bg-[#0A1220] border border-[#16283C] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00D2C4]"
        >
          {isMobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
        </button>

        {/* Luna Branding Logo */}
        <button
          type="button"
          onClick={() => onNavigate?.('explorer')}
          aria-label="Luna Home — Return to Lunar Map"
          className="flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00D2C4] rounded-lg p-0.5 group"
        >
          <LunaBrandLogo transparent={false} />
        </button>

        {/* Subtle Vertical Divider */}
        <div className="hidden sm:block w-[1px] h-6 bg-[#16283C]/80" />

        {/* Application Identity Subtitle */}
        <div className="hidden xl:flex flex-col leading-none">
          <span className="text-[10px] font-mono tracking-wider uppercase text-[#00D2C4] font-semibold">
            Mission Control
          </span>
          <span className="text-[9px] font-mono text-slate-500">
            NASA CLPS &amp; Artemis GIS
          </span>
        </div>

        {/* ── Dropdown: Compact Workspace Switcher ─────────────────────────── */}
        <div ref={dropdownRef} className="relative" data-guide="workspace-switcher">
          <button
            type="button"
            onClick={() => setIsDropdownOpen((prev) => !prev)}
            aria-label="Select mission workspace"
            aria-haspopup="listbox"
            aria-expanded={isDropdownOpen}
            className="h-8 px-2.5 sm:px-3 rounded-xl bg-[#080E18] hover:bg-[#0E1726] border border-[#16283C] hover:border-[#00D2C4]/50 text-xs font-medium text-[#F1F5F9] flex items-center gap-2 shadow-md transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00D2C4]"
          >
            <ActiveIcon className="w-3.5 h-3.5 text-[#00D2C4] shrink-0" />
            <span className="truncate max-w-[120px] sm:max-w-[180px] text-xs font-mono text-cyan-300">
              {activePageInfo.label}
            </span>
            <ChevronDown
              className={`w-3 h-3 text-slate-400 transition-transform duration-200 ${
                isDropdownOpen ? 'rotate-180' : ''
              }`}
            />
          </button>

          {/* Dropdown Menu Popover */}
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

        {/* ── Search: Positioned immediately beside dropdown ───────────────── */}
        <NavbarSearch
          onSelectFeature={onSearchSelect}
          activePlanet={activePlanet}
        />
      </div>

      {/* ── RIGHT: Ephemeris Clock + Global Actions ─────────────────────────── */}
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        {/* Live Ephemeris Time Badge */}
        <div
          title="Current Mission Celestial Ephemeris UTC Timestamp"
          className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-[#080E18] border border-[#16283C] text-[10.5px] font-mono text-slate-300"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <Clock className="w-3 h-3 text-[#00D2C4]" />
          <span className="tabular-nums">{formattedUtc}</span>
        </div>

        {/* Active Planet Badge (when in 3D view) */}
        <div className="hidden sm:flex items-center gap-1 px-2 py-1 rounded-lg bg-[#0A1220] border border-[#16283C] text-[10px] font-mono">
          <span className="text-slate-400">Target:</span>
          <span className="text-[#00D2C4] font-bold uppercase">
            {activePlanet === 'earth' ? 'Earth DSN' : 'Moon'}
          </span>
        </div>

        {/* Help & User Guide Icon */}
        <NavTooltip label="User Guide & Shortcuts" shortcut="?" side="bottom">
          <button
            type="button"
            onClick={onOpenGuide}
            aria-label="Open user guide and keyboard shortcuts"
            className="w-8 h-8 rounded-xl bg-[#080E18] hover:bg-[#0E1726] border border-[#16283C] hover:border-[#00D2C4]/50 text-slate-300 hover:text-[#00D2C4] flex items-center justify-center transition-colors shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00D2C4]"
          >
            <HelpCircle className="w-4 h-4" />
          </button>
        </NavTooltip>
      </div>
    </header>
  );
}

