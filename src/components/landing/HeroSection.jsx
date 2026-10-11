import React, { useMemo } from 'react';
import { Rocket, Compass, ArrowDown, Sparkles, Orbit, MapPin, Layers } from 'lucide-react';
import HeroMoonCanvas from './HeroMoonCanvas.jsx';
import { calculateLunarPhase } from '../../utils/lunarPhase.js';

export default function HeroSection({ onLaunchExplorer }) {
  // Compute live lunar phase
  const moonPhase = useMemo(() => {
    try {
      return calculateLunarPhase(new Date());
    } catch {
      return { phaseName: 'Waxing Gibbous', illuminationPct: 82, ageDays: 10.4 };
    }
  }, []);

  const handleDiscoverClps = () => {
    const el = document.querySelector('#missions');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <section className="relative min-h-[92vh] flex items-center justify-center pt-20 pb-16 px-4 sm:px-6 lg:px-8 overflow-hidden bg-[#030611]">
      {/* Deep Space Background Grid & Stars */}
      <div className="absolute inset-0 pointer-events-none -z-20">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900/40 via-[#030611] to-[#010308]" />
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              'linear-gradient(to right, #ffffff 1px, transparent 1px), linear-gradient(to bottom, #ffffff 1px, transparent 1px)',
            backgroundSize: '40px 40px',
          }}
        />
      </div>

      <div className="max-w-7xl mx-auto w-full grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
        {/* Left Column: Headline, Description & Actions */}
        <div className="lg:col-span-7 flex flex-col items-start z-10 text-left">
          {/* Status Badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900/90 border border-cyan-500/30 mb-6 shadow-sm shadow-cyan-950/30">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500" />
            </span>
            <span className="text-[11px] font-mono tracking-wider text-cyan-300 uppercase">
              NASA CLPS EXPLORATION PLATFORM
            </span>
            <span className="hidden sm:inline text-slate-600">•</span>
            <span className="hidden sm:inline text-[11px] font-mono text-slate-400">
              {moonPhase.phaseName} ({Math.round(moonPhase.illuminationPct)}%)
            </span>
          </div>

          {/* Main Headline */}
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-white leading-[1.12] mb-6">
            Explore the Moon.{' '}
            <span className="bg-gradient-to-r from-cyan-300 via-blue-200 to-indigo-300 bg-clip-text text-transparent">
              Discover the Missions.
            </span>
          </h1>

          {/* Supporting Text */}
          <p className="text-base sm:text-lg text-slate-300 max-w-2xl leading-relaxed mb-8">
            Luna is an interactive lunar mission browser designed to explore NASA&apos;s Commercial
            Lunar Payload Services (CLPS) missions, landing sites, and scientific payloads.
          </p>

          {/* Primary Action Buttons */}
          <div className="flex flex-wrap items-center gap-3.5 mb-10 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => onLaunchExplorer()}
              className="flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-xl bg-gradient-to-r from-cyan-500 via-cyan-600 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-semibold text-sm tracking-wide shadow-lg shadow-cyan-950/60 transition-all hover:shadow-cyan-900/80 hover:-translate-y-0.5 active:translate-y-0 active:scale-95"
            >
              <Rocket className="w-4 h-4 text-cyan-200" />
              <span>Launch Lunar Explorer</span>
            </button>

            <button
              type="button"
              onClick={handleDiscoverClps}
              className="flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-slate-200 hover:text-white border border-slate-700/80 hover:border-cyan-500/40 text-sm font-medium transition-all hover:-translate-y-0.5 active:scale-95 shadow-sm"
            >
              <Compass className="w-4 h-4 text-slate-400" />
              <span>Discover CLPS</span>
            </button>
          </div>

          {/* Key Metric Highlights */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 w-full pt-6 border-t border-slate-800/80">
            <div className="flex flex-col">
              <span className="text-xs font-mono text-cyan-400 font-semibold tracking-wider">
                9 MISSIONS
              </span>
              <span className="text-xs text-slate-400">Awarded Task Orders</span>
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-mono text-cyan-400 font-semibold tracking-wider">
                45+ PAYLOADS
              </span>
              <span className="text-xs text-slate-400">Science & Tech Suites</span>
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-mono text-cyan-400 font-semibold tracking-wider">
                3D & 2D GIS
              </span>
              <span className="text-xs text-slate-400">Cesium & OpenLayers</span>
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-mono text-cyan-400 font-semibold tracking-wider">
                NASA LRO
              </span>
              <span className="text-xs text-slate-400">Orbital Basemaps</span>
            </div>
          </div>
        </div>

        {/* Right Column: 3D Moon Centerpiece */}
        <div className="lg:col-span-5 relative flex items-center justify-center h-[340px] sm:h-[440px] lg:h-[520px]">
          {/* 3D Realistic Lunar Orb */}
          <div className="relative w-full h-full max-w-md lg:max-w-none">
            <HeroMoonCanvas onLaunchExplorer={onLaunchExplorer} />

            {/* Orbit / Telemetry Label Floating Badge */}
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-950/80 backdrop-blur-md border border-slate-800 text-[11px] font-mono text-slate-300 shadow-md pointer-events-none">
              <Orbit className="w-3.5 h-3.5 text-cyan-400" />
              <span>3D Selenographic Projection</span>
              <span className="text-slate-600">•</span>
              <span className="text-cyan-400">Interactive</span>
            </div>
          </div>
        </div>
      </div>

      {/* Subtle Scroll Down Indicator */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 hidden md:flex flex-col items-center gap-1 text-slate-500 hover:text-slate-300 cursor-pointer transition-colors">
        <a href="#about" aria-label="Scroll to What is Luna section">
          <ArrowDown className="w-4 h-4 animate-bounce opacity-70" />
        </a>
      </div>
    </section>
  );
}
