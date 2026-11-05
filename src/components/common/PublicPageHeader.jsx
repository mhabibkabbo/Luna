import React from 'react';
import { ArrowUpRight } from 'lucide-react';

const navigationLinks = [
  { href: '#landing', label: 'Home' },
  { href: '#missions', label: 'Missions' },
  { href: '#about', label: 'About' },
];

const workspaces = [
  ['landing', 'Home'],
  ['missions', 'Mission Catalog'],
  ['about', 'About Luna'],
  ['explorer', 'Lunar Map (3D / 2D)'],
  ['mission-control', 'Mission Overview'],
  ['site-analysis', 'Site Analysis'],
  ['communication', 'DTE Communications'],
  ['planner', 'Landing Recommendations'],
  ['comparison', 'Site Comparison'],
  ['library', 'Data Sources & Library'],
];

export default function PublicPageHeader({ currentPage, onLaunchExplorer }) {
  return (
    <header className="sticky top-0 z-50 border-b border-white/[0.08] bg-[#060B13]/95 px-4 sm:px-8 lg:px-12 backdrop-blur-xl">
      <div className="mx-auto flex min-h-16 max-w-[1400px] items-center justify-between gap-3">
        <a
          href="#landing"
          className="shrink-0 font-serif text-lg text-[#F1F5F9] transition-colors hover:text-[#00D2C4]"
        >
          Luna
        </a>

        <nav aria-label="Main navigation" className="flex items-center gap-3 sm:gap-7">
          {navigationLinks.map(({ href, label }) => {
            const isCurrent = currentPage === label.toLowerCase();
            return (
              <a
                key={href}
                href={href}
                aria-current={isCurrent ? 'page' : undefined}
                className={`py-2 text-[10px] font-mono uppercase tracking-[0.12em] transition-colors sm:text-xs sm:tracking-[0.18em] ${
                  isCurrent
                    ? 'text-[#00D2C4]'
                    : 'text-[#94A3B8] hover:text-[#F1F5F9]'
                }`}
              >
                {label}
              </a>
            );
          })}
        </nav>

        <div className="flex shrink-0 items-center gap-2">
          <label htmlFor="public-workspace-nav" className="sr-only">
            Go to workspace
          </label>
          <select
            id="public-workspace-nav"
            aria-label="Go to workspace"
            value={currentPage}
            onChange={(event) => {
              window.location.hash = `#${event.target.value}`;
            }}
            className="h-9 max-w-28 rounded-lg border border-[#16283C] bg-[#0A1220] px-2 text-[10px] text-[#CBD5E1] outline-none focus:border-[#00D2C4] sm:max-w-44 sm:px-3 sm:text-xs"
          >
            {workspaces.map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => onLaunchExplorer({ viewMode: '3d' })}
            className="hidden items-center gap-1.5 rounded-full bg-[#00D2C4] px-3 py-2 text-[10px] font-bold text-[#060B13] transition-colors hover:bg-[#22E7D9] sm:inline-flex sm:px-4 sm:text-xs"
          >
            Explorer <ArrowUpRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </header>
  );
}
