import React, { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import LunaBrandLogo from '../common/LunaBrandLogo.jsx';
import RealisticMoon from './RealisticMoon.jsx';
import CompactClpsModal from './CompactClpsModal.jsx';

export default function LandingPage({ onLaunchExplorer }) {
  const [isClpsOpen, setIsClpsOpen] = useState(false);

  return (
    <div className="relative min-h-screen w-full bg-black text-slate-100 font-sans selection:bg-cyan-500 selection:text-white overflow-x-hidden flex flex-col justify-between select-none">
      {/* ========================================================================= */}
      {/* DEEP SPACE BACKGROUND: Sparse, realistic stars & gentle gradient */}
      {/* ========================================================================= */}
      <div className="absolute inset-0 pointer-events-none -z-20 overflow-hidden">
        {/* Soft radial depth glow behind Moon */}
        <div
          className="absolute top-1/2 right-1/4 -translate-y-1/2 w-[700px] h-[700px] rounded-full pointer-events-none opacity-20"
          style={{
            background:
              'radial-gradient(circle, rgba(6, 182, 212, 0.10) 0%, rgba(15, 23, 42, 0.04) 50%, transparent 75%)',
          }}
        />

        {/* Sparse Astronomical Starfield (lightweight CSS points) */}
        <div
          className="absolute inset-0 opacity-35"
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
              radial-gradient(1px 1px at 5% 55%, #cbd5e1 100%, transparent 0)
            `,
            backgroundRepeat: 'repeat',
            backgroundSize: '400px 400px',
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
            <div className="text-[11px] font-mono tracking-[0.22em] text-cyan-400/90 uppercase mb-4">
              LUNAR EXPLORATION PLATFORM
            </div>

            {/* Preserved Strong Headline */}
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-light text-white tracking-tight leading-[1.12] mb-6 font-sans">
              The Moon,{' '}
              <span className="font-semibold text-white">
                explored.
              </span>
            </h1>

            {/* Preserved Concise Description */}
            <p className="text-sm sm:text-base text-slate-300 font-normal leading-relaxed max-w-lg mb-8">
              Discover NASA&apos;s Commercial Lunar Payload Services missions, landing sites, and
              scientific payloads through an interactive lunar map.
            </p>

            {/* Action Buttons */}
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
