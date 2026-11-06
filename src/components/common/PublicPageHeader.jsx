import React from 'react';
import { ArrowUpRight } from 'lucide-react';
import LunaBrandLogo from './LunaBrandLogo.jsx';

const navigationLinks = [
  { href: '#landing', label: 'Home', pageId: 'landing' },
  { href: '#missions', label: 'Missions', pageId: 'missions' },
  { href: '#about', label: 'About', pageId: 'about' },
];

export default function PublicPageHeader({ currentPage, onLaunchExplorer, onNavigate }) {
  return (
    <header className="sticky top-0 z-50 h-16 px-4 sm:px-8 lg:px-12 pointer-events-none bg-gradient-to-b from-black/80 to-[#060B13]/85 backdrop-blur-[2px]">
      <div className="mx-auto flex h-full max-w-[1400px] items-center justify-between gap-3">
        <div className="pointer-events-auto shrink-0">
          <LunaBrandLogo
            asButton
            onClick={() => onLaunchExplorer({ viewMode: '3d' })}
            title="Luna — Lunar Mission & Site Studio"
          />
        </div>

        <nav aria-label="Main page links" className="pointer-events-auto flex items-center gap-4 sm:gap-6 rounded-full border border-white/[0.08] bg-[#0A1220]/80 px-4 py-2 sm:px-6 backdrop-blur-md shadow-xl">
          {navigationLinks.map(({ href, label, pageId }) => {
            const isCurrent = currentPage === pageId || currentPage === label.toLowerCase();
            return (
              <a
                key={href}
                href={href}
                onClick={(e) => {
                  if (onNavigate) {
                    e.preventDefault();
                    onNavigate(pageId);
                  }
                }}
                aria-current={isCurrent ? 'page' : undefined}
                className={`relative py-1 text-[10px] font-mono uppercase tracking-[0.12em] transition-colors sm:text-xs sm:tracking-[0.18em] ${
                  isCurrent
                    ? 'text-[#00D2C4] after:absolute after:bottom-0 after:left-0 after:h-[1.5px] after:w-full after:bg-[#00D2C4]'
                    : 'text-[#94A3B8] hover:text-[#F1F5F9]'
                }`}
              >
                {label}
              </a>
            );
          })}
        </nav>

        <div className="pointer-events-auto flex shrink-0 items-center gap-2">
          <label htmlFor="public-workspace-nav" className="sr-only">
            Go to workspace
          </label>
          <button
            type="button"
            onClick={() => onLaunchExplorer({ viewMode: '3d' })}
            className="inline-flex items-center gap-1.5 rounded-full bg-[#00D2C4] px-3 py-2 text-[10px] font-bold text-[#060B13] transition-colors hover:bg-[#22E7D9] sm:px-4 sm:text-xs"
          >
            Explorer <ArrowUpRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </header>
  );
}