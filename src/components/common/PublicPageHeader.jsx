import React, { useState, useEffect, useRef } from 'react';
import { ArrowUpRight } from 'lucide-react';
import { preloadEntireMissionCatalog } from '../../utils/missionImageCache.js';

const navigationLinks = [
  { href: '#landing', label: 'Home', pageId: 'landing' },
  { href: '#missions', label: 'Missions', pageId: 'missions' },
  { href: '#about', label: 'About', pageId: 'about' },
];

export default function PublicPageHeader({
  currentPage,
  onLaunchExplorer,
  onNavigate,
  showLogo = false,
}) {
  const [isMinimized, setIsMinimized] = useState(false);
  const lastScrollYRef = useRef(0);

  useEffect(() => {
    const handleScroll = (e) => {
      const target = e.target;
      let scrollTop = 0;
      if (target === document || target === window) {
        scrollTop = window.scrollY || document.documentElement.scrollTop || 0;
      } else if (target && typeof target.scrollTop === 'number') {
        scrollTop = target.scrollTop;
      } else {
        scrollTop = window.scrollY || document.documentElement.scrollTop || 0;
      }

      const delta = scrollTop - lastScrollYRef.current;

      if (scrollTop <= 50) {
        setIsMinimized(false);
      } else if (delta > 6) {
        setIsMinimized(true);
      } else if (delta < -6) {
        setIsMinimized(false);
      }

      lastScrollYRef.current = scrollTop;
    };

    window.addEventListener('scroll', handleScroll, { capture: true, passive: true });
    return () => window.removeEventListener('scroll', handleScroll, { capture: true });
  }, []);

  return (
    <header className="fixed top-3.5 sm:top-5 inset-x-0 z-50 px-3 sm:px-10 lg:px-14 pointer-events-none transition-all duration-300 animate-in fade-in slide-in-from-top-2">
      <div className="relative mx-auto flex w-full max-w-[1520px] items-center justify-between sm:justify-center gap-2 sm:gap-4">
        {showLogo && (
          <a
            href="#landing"
            onClick={(e) => {
              if (onNavigate) {
                e.preventDefault();
                onNavigate('landing');
              }
            }}
            className="pointer-events-auto sm:absolute sm:left-0 text-xs font-display font-semibold tracking-wider uppercase text-white/90 hover:text-white rounded-md px-1.5 py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
          >
            Luna
          </a>
        )}

        <nav
          aria-label="Main page navigation"
          className={`pointer-events-auto flex items-center justify-center rounded-full border border-white/[0.12] bg-[#0A0B0E]/85 backdrop-blur-2xl shadow-2xl shadow-black/80 hover:border-white/25 transition-all duration-300 ease-out transform-gpu ${
            isMinimized
              ? 'px-2.5 sm:px-3 py-1 gap-2 sm:gap-3 bg-[#0A0B0E]/95 border-white/20 shadow-xl'
              : 'px-3 sm:px-4 py-1 sm:py-1.5 gap-2.5 sm:gap-5'
          }`}
        >
          {navigationLinks.map(({ href, label, pageId }) => {
            const isCurrent = currentPage === pageId || currentPage === label.toLowerCase();

            return (
              <a
                key={href}
                href={href}
                onMouseEnter={() => {
                  if (pageId === 'missions') {
                    preloadEntireMissionCatalog();
                  }
                }}
                onClick={(e) => {
                  if (isMinimized) {
                    setIsMinimized(false);
                  }
                  if (onNavigate) {
                    e.preventDefault();
                    onNavigate(pageId);
                  }
                }}
                aria-current={isCurrent ? 'page' : undefined}
                className={`group relative py-0.5 font-sans font-medium uppercase tracking-[0.12em] sm:tracking-[0.14em] transition-all duration-300 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 ${
                  isMinimized ? 'text-[10.5px] sm:text-[11px]' : 'text-[11px] sm:text-xs'
                } ${
                  isCurrent
                    ? 'text-white font-semibold'
                    : isMinimized
                    ? 'text-[#8E95A5]/85 hover:text-white'
                    : 'text-[#8E95A5] hover:text-white'
                }`}
              >
                <span className="flex items-center gap-1.5">
                  {isCurrent && isMinimized && (
                    <span className="w-1.5 h-1.5 rounded-full bg-white shadow-[0_0_8px_rgba(255,255,255,0.85)] animate-pulse" />
                  )}
                  {label}
                </span>

                {!isMinimized && (
                  <span
                    className={`absolute -bottom-0.5 left-0 h-[1.5px] rounded-full transition-all duration-300 ${
                      isCurrent
                        ? 'w-full bg-gradient-to-r from-white/70 via-white to-white/70 shadow-[0_0_12px_rgba(255,255,255,0.5)]'
                        : 'w-0 bg-white/60 group-hover:w-full'
                    }`}
                  />
                )}
              </a>
            );
          })}
        </nav>

        <button
          type="button"
          onClick={() => onLaunchExplorer({ viewMode: '3d' })}
          className="pointer-events-auto group sm:absolute sm:right-0 inline-flex items-center gap-1.5 sm:gap-2 rounded-full bg-white font-semibold text-[#050507] transition-all duration-300 ease-out transform-gpu hover:bg-[#E2E8F0] active:scale-95 shadow-2xl shadow-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 px-3 sm:px-5 py-1.5 sm:py-2 text-[11px] sm:text-xs sm:hover:scale-105 shrink-0"
        >
          <span>Explorer</span>
          <ArrowUpRight
            className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
          />
        </button>
      </div>
    </header>
  );
}
