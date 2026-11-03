/**
 * @file GlobalHeader.jsx
 * Clean, unified top navigation bar with clear page hierarchy and minimal distraction.
 * Adheres strictly to the one-row, focused navigation contract.
 */

import React from 'react';
import {
  LayoutDashboard,
  Globe,
  Mountain,
  Radio,
  GitCompare,
  FileText,
  BookOpen,
  Sparkles,
  Target,
} from 'lucide-react';
import LunaBrandLogo from '../common/LunaBrandLogo.jsx';

export const NAV_PAGES = [
  { id: 'mission-control', label: 'Mission Control', icon: LayoutDashboard },
  { id: 'explorer', label: 'Celestial Explorer', icon: Globe },
  { id: 'site-analysis', label: 'Site Analysis', icon: Mountain },
  { id: 'communication', label: 'Comms & Ephemeris', icon: Radio },
  { id: 'planner', label: 'Landing Planner', icon: Target },
  { id: 'comparison', label: 'Site Comparison', icon: GitCompare },
  { id: 'briefing', label: 'Mission Briefing', icon: FileText },
  { id: 'library', label: 'Library & Guide', icon: BookOpen },
];

export default function GlobalHeader({
  activePage = 'mission-control',
  onNavigate,
  selectedFeature,
  onStartTour,
}) {
  const normalizedActive =
    activePage === 'comms'
      ? 'communication'
      : activePage === 'site-comparison'
      ? 'comparison'
      : activePage;

  return (
    <header className="relative z-40 w-full h-13 px-4 sm:px-6 flex items-center justify-between gap-4 bg-[#030712]/90 backdrop-blur-xl border-b border-slate-800/80 shrink-0 select-none">
      {/* Zone 1: Brand Wordmark */}
      <div className="flex items-center gap-3 shrink-0">
        <LunaBrandLogo
          asButton
          onClick={() => onNavigate('mission-control')}
          title="Return to Mission Control"
        />
        <span className="hidden xl:inline text-xs font-mono text-slate-500 border-l border-slate-800 pl-3">
          Lunar Mission Platform
        </span>
      </div>

      {/* Zone 2: Navigation Links (Clean, single-line text tabs) */}
      <nav
        aria-label="Primary Navigation"
        className="flex items-center gap-1 sm:gap-1.5 overflow-x-auto no-scrollbar py-1"
      >
        {NAV_PAGES.map((page) => {
          const Icon = page.icon;
          const isActive = normalizedActive === page.id;

          return (
            <button
              key={page.id}
              type="button"
              onClick={() => onNavigate(page.id)}
              className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all duration-150 active:scale-95 ${
                isActive
                  ? 'bg-cyan-950/80 text-cyan-300 border border-cyan-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60 border border-transparent'
              }`}
            >
              <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-cyan-400' : 'text-slate-400'}`} />
              <span>{page.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Zone 3: Active Target Site Indicator & Tour Launcher */}
      <div className="flex items-center gap-2.5 shrink-0">
        {selectedFeature && (
          <button
            type="button"
            onClick={() => onNavigate('site-analysis')}
            className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-900/80 hover:bg-slate-850 text-slate-300 hover:text-white border border-slate-800 text-[11px] font-mono transition-colors"
            title="Inspect currently selected lunar site"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
            <span className="text-slate-400">Target:</span>
            <span className="font-semibold text-slate-200 max-w-[120px] truncate">
              {selectedFeature.name}
            </span>
          </button>
        )}

        {onStartTour && (
          <button
            type="button"
            onClick={onStartTour}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-cyan-950/50 hover:bg-cyan-900/70 text-cyan-300 hover:text-white border border-cyan-700/50 text-xs font-mono font-medium transition-all duration-150 active:scale-95 shadow-sm"
            title="Start 60-second interactive guided mission tour"
          >
            <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
            <span className="hidden sm:inline">Tour</span>
          </button>
        )}
      </div>
    </header>
  );
}
