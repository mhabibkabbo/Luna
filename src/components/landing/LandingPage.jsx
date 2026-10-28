import React, { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import LunaBrandLogo from '../common/LunaBrandLogo.jsx';
import RealisticMoon from './RealisticMoon.jsx';
import CompactClpsModal from './CompactClpsModal.jsx';

export default function LandingPage({ onLaunchExplorer }) {
  const [isClpsOpen, setIsClpsOpen] = useState(false);

  return (
    <div className="relative min-h-screen w-full bg-black text-slate-100 font-sans selection:bg-cyan-500 selection:text-white overflow-x-hidden flex flex-col justify-between select-none isolate">
      {/* ========================================================================= */}
      {/* DEEP SPACE BACKGROUND: Rich multi-layered starfield & nebula glow */}
      {/* ========================================================================= */}
      <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
        {/* Soft cosmic nebula depth behind Moon */}
        <div
          className="absolute top-1/2 right-1/4 -translate-y-1/2 w-[850px] h-[850px] rounded-full pointer-events-none opacity-25"
          style={{
            background:
              'radial-gradient(circle, rgba(6, 182, 212, 0.16) 0%, rgba(30, 58, 138, 0.08) 45%, transparent 72%)',
          }}
        />

        {/* Micro-stars layer (dense, tiny 1px celestial dust & distant stars) */}
        <div
          className="absolute inset-0 opacity-75"
          style={{
            backgroundImage: `
              radial-gradient(1px 1px at 8% 12%, #ffffff 100%, transparent 0),
              radial-gradient(1px 1px at 18% 45%, #93c5fd 100%, transparent 0),
              radial-gradient(1px 1px at 28% 82%, #cbd5e1 100%, transparent 0),
              radial-gradient(1px 1px at 38% 22%, #ffffff 100%, transparent 0),
              radial-gradient(1px 1px at 48% 68%, #e2e8f0 100%, transparent 0),
              radial-gradient(1px 1px at 58% 15%, #93c5fd 100%, transparent 0),
              radial-gradient(1px 1px at 68% 52%, #ffffff 100%, transparent 0),
              radial-gradient(1px 1px at 78% 88%, #fef08a 100%, transparent 0),
              radial-gradient(1px 1px at 88% 34%, #e2e8f0 100%, transparent 0),
              radial-gradient(1px 1px at 95% 72%, #ffffff 100%, transparent 0),
              radial-gradient(1px 1px at 12% 92%, #60a5fa 100%, transparent 0),
              radial-gradient(1px 1px at 84% 18%, #cbd5e1 100%, transparent 0)
            `,
            backgroundRepeat: 'repeat',
            backgroundSize: '240px 240px',
          }}
        />

        {/* Medium brighter stars (1.5px - 2px with spectral tint) */}
        <div
          className="absolute inset-0 opacity-85"
          style={{
            backgroundImage: `
              radial-gradient(1.5px 1.5px at 14% 30%, #ffffff 100%, transparent 0),
              radial-gradient(2px 2px at 42% 12%, #bae6fd 100%, transparent 0),
              radial-gradient(1.5px 1.5px at 70% 65%, #ffffff 100%, transparent 0),
              radial-gradient(1.8px 1.8px at 86% 40%, #fef3c7 100%, transparent 0),
              radial-gradient(1.5px 1.5px at 25% 75%, #e2e8f0 100%, transparent 0),
              radial-gradient(2px 2px at 62% 90%, #67e8f9 100%, transparent 0),
              radial-gradient(1.4px 1.4px at 92% 16%, #ffffff 100%, transparent 0)
            `,
            backgroundRepeat: 'repeat',
            backgroundSize: '380px 380px',
          }}
        />
      </div>

      {/* ========================================================================= */}
      {/* 1. SEAMLESS TOP BAR (TRANSPARENT, NO BACKGROUND COLOR) */}
      {/* ========================================================================= */}
      <header className="relative z-30 w-full px-5 sm:px-8 pt-4 pb-2 flex items-center justify-between bg-transparent shrink-0">
        {/* Standardized Luna Logo */}
        <LunaBrandLogo />

        {/* Right Action: Open Explorer button */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onLaunchExplorer()}
            className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-transparent hover:bg-white/5 text-slate-200 hover:text-white border border-slate-700/60 hover:border-cyan-500/50 text-xs font-medium tracking-wide transition-all active:scale-95"
          >
            <span>Open Explorer</span>
            <ArrowRight className="w-3 h-3 text-cyan-400" />
          </button>
        </div>
      </header>

      {/* ========================================================================= */}
      {/* 2. FULL-VIEWPORT HERO SECTION: TIGHT COMPACT VERTICAL SPACING */}
      {/* ========================================================================= */}
      <main className="relative z-10 flex-1 max-w-7xl w-full mx-auto px-5 sm:px-8 pt-2 sm:pt-4 pb-6 sm:pb-8 flex flex-col justify-start lg:justify-center">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center w-full">
          {/* Main Text Content: Headline, Description & CTAs */}
          <div className="lg:col-span-6 flex flex-col items-start text-left order-2 lg:order-1">
            {/* Small Eyebrow Text */}
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-cyan-950/70 border border-cyan-500/30 text-[10px] font-mono tracking-[0.18em] text-cyan-300 uppercase mb-4">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
              <span>NASA Space Apps 2026 · Lunar Landing Site Navigator</span>
            </div>

            {/* Preserved Strong Headline */}
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-light text-white tracking-tight leading-[1.12] mb-5 font-sans">
              The Moon,{' '}
              <span className="font-semibold text-white">
                explored.
              </span>
            </h1>

            {/* Preserved & Expanded Description */}
            <p className="text-sm sm:text-base text-slate-300 font-normal leading-relaxed max-w-lg mb-7">
              Rapidly evaluate candidate lunar landing sites and dates. Visualize Sun and Earth positions
              relative to topographic horizons, assess solar power generation windows, and determine direct-to-Earth communication links for NASA CLPS and Artemis missions.
            </p>

            {/* Action Buttons */}
            <div className="flex items-center gap-3.5 flex-wrap">
              <button
                type="button"
                onClick={() => onLaunchExplorer()}
                className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-slate-100 hover:bg-white text-slate-950 font-semibold text-sm tracking-wide shadow-lg shadow-black/60 transition-all hover:-translate-y-0.5 active:translate-y-0 active:scale-95"
              >
                <span>3D Moon Explorer</span>
                <ArrowRight className="w-4 h-4 text-slate-950" />
              </button>

              <button
                type="button"
                onClick={() => onLaunchExplorer({ openComparison: true })}
                className="inline-flex items-center justify-center gap-1.5 px-4 py-3 rounded-xl bg-cyan-950/80 hover:bg-cyan-900 text-cyan-300 border border-cyan-500/40 font-semibold text-sm tracking-wide shadow-md transition-all hover:-translate-y-0.5 active:translate-y-0 active:scale-95"
              >
                <span>Site &amp; Date Navigator</span>
              </button>

              <button
                type="button"
                onClick={() => setIsClpsOpen(true)}
                className="text-xs font-mono text-slate-400 hover:text-cyan-300 tracking-wider transition-colors underline-offset-4 hover:underline px-2 py-1"
              >
                What is CLPS?
              </button>
            </div>
          </div>

          {/* Right Column: Realistic 3D Moon as the Visual Centerpiece (Unobstructed) */}
          <div className="lg:col-span-6 relative flex items-center justify-center order-1 lg:order-2">
            <RealisticMoon onLaunchExplorer={onLaunchExplorer} />
          </div>
        </div>
      </main>

      {/* ========================================================================= */}
      {/* 3. RESTRAINED INFORMATION STRIP AT BOTTOM */}
      {/* ========================================================================= */}
      <footer className="relative z-20 w-full px-5 sm:px-8 py-4 border-t border-slate-900/80 bg-[#020409]/60 backdrop-blur-sm shrink-0">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2.5 text-xs text-slate-500 font-mono">
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
      {/* 4. COMPACT MODAL: What is CLPS? */}
      {/* ========================================================================= */}
      <CompactClpsModal
        isOpen={isClpsOpen}
        onClose={() => setIsClpsOpen(false)}
        onLaunchExplorer={onLaunchExplorer}
      />
    </div>
  );
}
