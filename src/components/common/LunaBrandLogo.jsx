import React from 'react';
import { Moon, ArrowLeft } from 'lucide-react';

/**
 * Standardized Luna Brand Emblem and Wordmark component.
 * Ensures 100% shared visual identity across the Landing Page, Explorer Workspace,
 * and dialog headers.
 */
export default function LunaBrandLogo({
  asButton = false,
  onClick,
  showBackIndicator = false,
  backLabel = 'Home',
  className = '',
  title = 'Luna — CLPS Lunar Mission Browser',
}) {
  const content = (
  <div className={`flex items-center gap-2.5 shrink-0 group ${className}`}>
    {/* Brand Icon Box: Transparent with fine border & CLPS Lunar Orbit Emblem */}
    <div className="w-7 h-7 rounded-lg bg-slate-950/40 border border-slate-700/60 flex items-center justify-center group-hover:border-cyan-500/50 group-hover:bg-cyan-950/20 transition-all duration-300">
      <svg
        viewBox="0 0 24 24"
        className="w-4 h-4"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="orbit-grad" x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#38bdf8" />
          </linearGradient>
        </defs>

        {/* Crescent Moon Base */}
        <path
          d="M 12 3 A 9 9 0 1 0 18.5 18 A 8 8 0 1 1 12 3 Z"
          className="fill-slate-200 group-hover:fill-cyan-100 transition-colors duration-300"
        />

        {/* Surface Cratering Accents */}
        <circle cx="8" cy="11.5" r="0.85" className="fill-slate-400 group-hover:fill-cyan-300/80 transition-colors" />
        <circle cx="10" cy="15" r="0.6" className="fill-slate-400 group-hover:fill-cyan-300/80 transition-colors" />

        {/* CLPS Orbital Trajectory Arc */}
        <path
          d="M 3.5 19 C 5 11, 14 7, 19.5 9"
          stroke="url(#orbit-grad)"
          strokeWidth="1.25"
          strokeLinecap="round"
        />

        {/* Payload / Lander Target Reticle */}
        <circle cx="19.5" cy="9" r="1" className="fill-white" />
        <circle
          cx="19.5"
          cy="9"
          r="1.8"
          className="stroke-cyan-400 group-hover:stroke-cyan-300 transition-colors"
          strokeWidth="0.6"
        />
      </svg>
    </div>

    {/* Brand Name & Identifier */}
    <div className="flex items-baseline gap-1.5">
      <span className="text-[1.2rem] font-semibold tracking-wider text-white uppercase font-orbitron group-hover:text-cyan-200 transition-colors">
        LUNA
      </span>
      {!showBackIndicator &&
<span className="text-[8px] font-mono text-cyan-400/80 tracking-widest uppercase hidden sm:inline">
        CLPS BROWSER
      </span>
      }

    </div>

  </div>
);

  if (asButton) {
    return (
      <button
        type="button"
        onClick={onClick}
        title={title}
        className="group flex items-center focus:outline-none focus-visible:ring-1 focus-visible:ring-cyan-400 rounded-lg p-0.5 transition-opacity hover:opacity-90 active:scale-[0.98]"
      >
        {content}
      </button>
    );
  }

  return content;
}
