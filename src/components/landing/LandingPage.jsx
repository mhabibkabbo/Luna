import React, { useState } from 'react';
import { Rocket, ArrowRight, Menu, X, Sparkles, Compass } from 'lucide-react';
import LunaBrandLogo from '../common/LunaBrandLogo.jsx';
import RealisticMoon from './RealisticMoon.jsx';
import CompactClpsModal from './CompactClpsModal.jsx';
import CompactAboutModal from './CompactAboutModal.jsx';
import CompactMissionsModal from './CompactMissionsModal.jsx';

export default function LandingPage({ onLaunchExplorer }) {
  const [isClpsOpen, setIsClpsOpen] = useState(false);
  const [isAboutOpen, setIsAboutOpen] = useState(false);
  const [isMissionsOpen, setIsMissionsOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="relative min-h-screen w-full bg-[#020409] text-slate-100 font-sans selection:bg-cyan-500 selection:text-white overflow-x-hidden flex flex-col justify-between">
      {/* ========================================================================= */}
      {/* DEEP SPACE BACKGROUND: Sparse, realistic stars & gentle gradient */}
      {/* ========================================================================= */}
      <div className="absolute inset-0 pointer-events-none -z-20 overflow-hidden">
        {/* Soft radial depth glow behind Moon */}
        <div
          className="absolute top-1/2 right-1/4 -translate-y-1/2 w-[700px] h-[700px] rounded-full pointer-events-none opacity-25"
          style={{
            background: 'radial-gradient(circle, rgba(6, 182, 212, 0.12) 0%, rgba(15, 23, 42, 0.05) 50%, transparent 75%)',
          }}
        />

        {/* Sparse Astronomical Starfield (lightweight CSS points) */}
        <div
          className="absolute inset-0 opacity-40"
          style={{
            backgroundImage: `
              radial-gradient(1px 1px at 15% 25%, #ffffff 100%, transparent 0),
              radial-gradient(1.5px 1.5px at 35% 15%, #94a3b8 100%, transparent 0),
              radial-gradient(1px 1px at 65% 10%, #e2e8f0 100%, transparent 0),
              radial-gradient(1px 1px at 85% 30%, #64748b 100%, transparent 0),
              radial-gradient(1.2px 1.2px at 20% 70%, #94a3b8 100%, transparent 0),
              radial-gradient(1px 1px at 45% 85%, #ffffff 100%, transparent 0),
              radial-gradient(1.5px 1.5px at 75% 75%, #e2e8f0 100%, transparent 0),
              radial-gradient(1px 1px at 90% 90%, #64748b 100%, transparent 0),
              radial-gradient(1px 1px at 5% 55%, #cbd5e1 100%, transparent 0),
              radial-gradient(1.5px 1.5px at 52% 40%, #ffffff 100%, transparent 0),
              radial-gradient(1px 1px at 80% 50%, #94a3b8 100%, transparent 0)
            `,
            backgroundRepeat: 'repeat',
            backgroundSize: '400px 400px',
          }}
        />
      </div>

      {/* ========================================================================= */}
      {/* 1. SLIM, TRANSPARENT TOP NAVIGATION BAR */}
      {/* ========================================================================= */}
      <header className="relative z-30 w-full px-5 sm:px-8 py-3.5 sm:py-4 flex items-center justify-between border-b border-slate-800/40 bg-[#020409]/60 backdrop-blur-md">
        {/* Standardized Luna Logo on the left */}
        <LunaBrandLogo />

        {/* Minimal Navigation Links: About and Missions */}
        <nav className="hidden sm:flex items-center gap-7">
          <button
            type="button"
            onClick={() => setIsAboutOpen(true)}
            className="text-xs font-mono tracking-wider text-slate-400 hover:text-white transition-colors"
          >
            ABOUT
          </button>
          <button
            type="button"
            onClick={() => setIsMissionsOpen(true)}
            className="text-xs font-mono tracking-wider text-slate-400 hover:text-white transition-colors"
          >
            MISSIONS
          </button>
          <button
            type="button"
            onClick={() => setIsClpsOpen(true)}
            className="text-xs font-mono tracking-wider text-slate-400 hover:text-cyan-300 transition-colors"
          >
            WHAT IS CLPS?
          </button>
        </nav>

        {/* Right Action: Small 'Open Explorer' button */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onLaunchExplorer()}
            className="luna-btn-secondary hover:border-cyan-500/50"
          >
            <span>Open Explorer</span>
            <ArrowRight className="w-3 h-3 text-cyan-400" />
          </button>

          {/* Mobile Menu Toggle */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            className="sm:hidden p-1.5 rounded-lg text-slate-400 hover:text-white bg-slate-900/60 border border-slate-800"
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>
        </div>
      </header>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div className="sm:hidden relative z-40 bg-[#040712]/95 border-b border-slate-800/80 px-6 py-4 backdrop-blur-xl animate-in slide-in-from-top-2 duration-150">
          <div className="flex flex-col gap-3 font-mono text-xs">
            <button
              type="button"
              onClick={() => {
                setMobileMenuOpen(false);
                setIsAboutOpen(true);
              }}
              className="text-left py-1 text-slate-300 hover:text-white"
            >
              ABOUT
            </button>
            <button
              type="button"
              onClick={() => {
                setMobileMenuOpen(false);
                setIsMissionsOpen(true);
              }}
              className="text-left py-1 text-slate-300 hover:text-white"
            >
              MISSIONS
            </button>
            <button
              type="button"
              onClick={() => {
                setMobileMenuOpen(false);
                setIsClpsOpen(true);
              }}
              className="text-left py-1 text-cyan-400"
            >
              WHAT IS CLPS?
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2 & 3. FULL-VIEWPORT HERO SECTION: THE MOON OCCUPYING MOST OF THE SCREEN */}
      {/* ========================================================================= */}
      <main className="relative z-10 flex-1 max-w-7xl w-full mx-auto px-5 sm:px-8 py-6 sm:py-10 flex flex-col justify-center">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
          {/* Main Text Content: Beside or over the Moon */}
          <div className="lg:col-span-6 flex flex-col items-start text-left order-2 lg:order-1">
            {/* Small Eyebrow Text */}
            <div className="text-[11px] font-mono tracking-[0.22em] text-cyan-400/90 uppercase mb-4">
              LUNAR EXPLORATION PLATFORM
            </div>

            {/* Strong Headline */}
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-light text-white tracking-tight leading-[1.12] mb-6 font-sans">
              The Moon,{' '}
              <span className="font-semibold text-white">
                explored.
              </span>
            </h1>

            {/* One Concise Description */}
            <p className="text-sm sm:text-base text-slate-300 font-normal leading-relaxed max-w-lg mb-8">
              Discover NASA&apos;s Commercial Lunar Payload Services missions, landing sites, and
              scientific payloads through an interactive lunar map.
            </p>

            {/* Primary Action Button & Secondary Text Link */}
            <div className="flex items-center gap-6">
              <button
                type="button"
                onClick={() => onLaunchExplorer()}
                className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-slate-100 hover:bg-white text-slate-950 font-semibold text-sm tracking-wide shadow-lg shadow-black/60 transition-all hover:-translate-y-0.5 active:translate-y-0 active:scale-95"
              >
                <span>Start Exploring</span>
                <ArrowRight className="w-4 h-4 text-slate-950" />
              </button>

              <button
                type="button"
                onClick={() => setIsClpsOpen(true)}
                className="text-xs font-mono text-slate-400 hover:text-cyan-300 tracking-wider transition-colors underline-offset-4 hover:underline"
              >
                What is CLPS?
              </button>
            </div>
          </div>

          {/* Moon as the Visual Centerpiece */}
          <div className="lg:col-span-6 relative flex items-center justify-center order-1 lg:order-2">
            <RealisticMoon onLaunchExplorer={onLaunchExplorer} />
          </div>
        </div>
      </main>

      {/* ========================================================================= */}
      {/* 5. RESTRAINED INFORMATION STRIP AT BOTTOM */}
      {/* ========================================================================= */}
      <footer className="relative z-20 w-full px-5 sm:px-8 py-5 border-t border-slate-900/80 bg-[#020409]/60 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500 font-mono">
          <div className="flex items-center gap-3 sm:gap-6 flex-wrap justify-center">
            <span className="tracking-wider text-slate-400">Interactive lunar map</span>
            <span className="text-slate-700 hidden sm:inline">•</span>
            <span className="tracking-wider text-slate-400">CLPS mission browser</span>
            <span className="text-slate-700 hidden sm:inline">•</span>
            <span className="tracking-wider text-slate-400">Lunar landing sites</span>
          </div>

          <div className="text-[11px] text-slate-600 tracking-wider">
            NASA LRO · USGS Cartography · 1,737.4 km
          </div>
        </div>
      </footer>

      {/* ========================================================================= */}
      {/* COMPACT MODALS: What is CLPS?, About, and Missions */}
      {/* ========================================================================= */}
      <CompactClpsModal
        isOpen={isClpsOpen}
        onClose={() => setIsClpsOpen(false)}
        onLaunchExplorer={onLaunchExplorer}
      />

      <CompactAboutModal
        isOpen={isAboutOpen}
        onClose={() => setIsAboutOpen(false)}
        onLaunchExplorer={onLaunchExplorer}
      />

      <CompactMissionsModal
        isOpen={isMissionsOpen}
        onClose={() => setIsMissionsOpen(false)}
        onLaunchExplorer={onLaunchExplorer}
      />
    </div>
  );
}
