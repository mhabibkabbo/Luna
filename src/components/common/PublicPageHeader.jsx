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
    <header className="sticky top-0 z-50 h-16 px-4 sm:px-8 lg:px-12 pointer-events-none bg-[#050507]/90 border-b border-white/[0.06] backdrop-blur-md">
      <div className="mx-auto flex h-full max-w-[1360px] items-center justify-between gap-3">
        <div className="pointer-events-auto shrink-0">
          <LunaBrandLogo
            asButton
            onClick={() => onLaunchExplorer({ viewMode: '3d' })}
            title="Luna — Lunar Mission & Site Studio"
          />
        </div>

        <nav aria-label="Main page links" className="pointer-events-auto flex items-center gap-5 sm:gap-8 px-4 py-2 sm:px-6">
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
                className={`relative py-1.5 text-[11px] font-sans font-medium uppercase tracking-[0.14em] transition-colors sm:text-xs ${
                  isCurrent
                    ? 'text-white font-semibold after:absolute after:bottom-0 after:left-0 after:h-[1.5px] after:w-full after:bg-white'
                    : 'text-[#8E95A5] hover:text-white'
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
            className="inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-[10px] font-semibold text-[#050507] transition-colors hover:bg-[#E2E8F0] sm:px-5 sm:text-xs"
          >
            Explorer <ArrowUpRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </header>
  );
}