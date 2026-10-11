import React, { useState, useEffect } from 'react';
import { Moon, Rocket, Menu, X, Globe, ChevronRight } from 'lucide-react';

export default function LandingNav({ onLaunchExplorer }) {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navLinks = [
    { label: 'About', href: '#about' },
    { label: 'Explore', href: '#explore' },
    { label: 'Missions', href: '#missions' },
    { label: 'Data Sources', href: '#datasources' },
  ];

  const handleScrollTo = (e, href) => {
    e.preventDefault();
    setMobileMenuOpen(false);
    const target = document.querySelector(href);
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        isScrolled
          ? 'bg-transparent py-2.5 border-b border-transparent'
          : 'bg-transparent py-4 border-b border-transparent'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between">
        {/* Brand Logo & Name */}
        <a
          href="#"
          className="flex items-center gap-2.5 group focus:outline-none"
          onClick={(e) => {
            e.preventDefault();
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
        >
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500/20 to-blue-600/30 border border-cyan-400/30 flex items-center justify-center shadow-md shadow-cyan-950/40 group-hover:border-cyan-400/60 transition-colors">
            <Moon className="w-4 h-4 text-cyan-300" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-base font-bold tracking-tight text-white group-hover:text-cyan-200 transition-colors">
              LUNA
            </span>
            <span className="text-[10px] font-mono text-cyan-400/90 tracking-wider uppercase px-1.5 py-0.5 rounded bg-cyan-950/60 border border-cyan-500/25 hidden sm:inline-block">
              CLPS BROWSER
            </span>
          </div>
        </a>

        {/* Desktop Navigation Links */}
        <nav className="hidden md:flex items-center gap-7">
          {navLinks.map((link) => (
            <a
              key={link.label}
              href={link.href}
              onClick={(e) => handleScrollTo(e, link.href)}
              className="text-xs font-medium tracking-wide text-slate-300 hover:text-cyan-300 transition-colors"
            >
              {link.label}
            </a>
          ))}
        </nav>

        {/* Right Action: Launch Lunar Explorer */}
        <div className="hidden md:flex items-center gap-3">
          <button
            type="button"
            onClick={onLaunchExplorer}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white text-xs font-semibold tracking-wide shadow-md shadow-cyan-950/60 transition-all hover:shadow-cyan-900/80 active:scale-95"
          >
            <Rocket className="w-3.5 h-3.5" />
            <span>Launch Explorer</span>
          </button>
        </div>

        {/* Mobile Hamburger Button */}
        <div className="flex md:hidden items-center gap-2">
          <button
            type="button"
            onClick={onLaunchExplorer}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-cyan-600 to-blue-600 text-white text-xs font-medium"
          >
            <Rocket className="w-3.5 h-3.5" />
            <span>Launch</span>
          </button>
          <button
            type="button"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800/80 border border-slate-800 transition-colors"
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-[#070b16]/95 border-b border-slate-800 px-4 py-3 backdrop-blur-xl animate-in slide-in-from-top duration-200">
          <div className="flex flex-col gap-2">
            {navLinks.map((link) => (
              <a
                key={link.label}
                href={link.href}
                onClick={(e) => handleScrollTo(e, link.href)}
                className="px-3 py-2 rounded-md text-sm font-medium text-slate-200 hover:bg-slate-800/80 hover:text-cyan-300 transition-colors flex items-center justify-between"
              >
                <span>{link.label}</span>
                <ChevronRight className="w-4 h-4 text-slate-500" />
              </a>
            ))}
            <div className="pt-2 border-t border-slate-800/80 mt-1">
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  onLaunchExplorer();
                }}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 text-white text-sm font-semibold shadow-md"
              >
                <Rocket className="w-4 h-4" />
                <span>Launch Lunar Explorer</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
