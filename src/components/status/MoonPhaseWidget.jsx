import React, { useState, useEffect } from 'react';
import { calculateLunarPhase } from '../../utils/lunarPhase.js';
import { Moon, Sparkles, Clock, Compass, Info, ChevronUp, ChevronDown } from 'lucide-react';

/**
 * Visual SVG renderer for accurate astronomical Moon phase illumination.
 */
function MoonPhaseGraphic({ phaseIndex, size = 32, className = '' }) {
  const r = size / 2;
  const cx = r;
  const cy = r;

  // Phase index 0 to 1
  // 0 = New, 0.25 = First Quarter, 0.5 = Full, 0.75 = Third Quarter
  const isWaxing = phaseIndex < 0.5;
  // Normalized value from -1 (New) to 0 (Quarter) to 1 (Full)
  const norm = isWaxing ? phaseIndex * 4 - 1 : (1 - phaseIndex) * 4 - 1;
  const rx = Math.abs(norm) * r;

  // Path generator for lunar terminator
  let pathD = '';
  if (norm === -1) {
    // New moon: no illuminated path
    pathD = '';
  } else if (norm === 1) {
    // Full moon: full circle
    pathD = `M ${cx},${cy - r} A ${r},${r} 0 1,1 ${cx},${cy + r} A ${r},${r} 0 1,1 ${cx},${cy - r}`;
  } else if (norm < 0) {
    // Crescent
    const sweep = isWaxing ? 1 : 0;
    pathD = `M ${cx},${cy - r} A ${r},${r} 0 0,${sweep} ${cx},${cy + r} A ${rx},${r} 0 0,${1 - sweep} ${cx},${cy - r}`;
  } else {
    // Gibbous
    const sweep = isWaxing ? 1 : 0;
    pathD = `M ${cx},${cy - r} A ${r},${r} 0 0,${sweep} ${cx},${cy + r} A ${rx},${r} 0 0,${sweep} ${cx},${cy - r}`;
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className={`shrink-0 drop-shadow-[0_0_8px_rgba(226,232,240,0.3)] ${className}`}
    >
      {/* Dark background side of the Moon */}
      <circle cx={cx} cy={cy} r={r - 1} fill="#1e293b" stroke="#334155" strokeWidth="1.2" />

      {/* Subtle crater texture spots on dark side */}
      <circle cx={cx - r * 0.3} cy={cy - r * 0.2} r={r * 0.18} fill="#0f172a" opacity="0.6" />
      <circle cx={cx + r * 0.2} cy={cy + r * 0.3} r={r * 0.22} fill="#0f172a" opacity="0.6" />
      <circle cx={cx - r * 0.1} cy={cy + r * 0.4} r={r * 0.14} fill="#0f172a" opacity="0.5" />

      {/* Sunlit illuminated fraction */}
      {pathD && (
        <path
          d={pathD}
          fill="url(#moonGlowGrad)"
          stroke="#f8fafc"
          strokeWidth="0.5"
        />
      )}

      {/* Outer subtle glow rim */}
      <circle cx={cx} cy={cy} r={r - 1} fill="none" stroke="#64748b" strokeWidth="1" opacity="0.6" />

      <defs>
        <radialGradient id="moonGlowGrad" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="85%" stopColor="#f1f5f9" />
          <stop offset="100%" stopColor="#cbd5e1" />
        </radialGradient>
      </defs>
    </svg>
  );
}

/**
 * Real-time astronomical Moon phase status widget with interactive detail card.
 */
export default function MoonPhaseWidget({ className = '' }) {
  const [phaseData, setPhaseData] = useState(() => calculateLunarPhase(new Date()));
  const [isOpen, setIsOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState(() => new Date());

  useEffect(() => {
    // Update every 30 seconds to keep live astronomical accuracy
    const timer = setInterval(() => {
      const now = new Date();
      setCurrentTime(now);
      setPhaseData(calculateLunarPhase(now));
    }, 30000);

    return () => clearInterval(timer);
  }, []);

  return (
    <div className={`relative pointer-events-auto select-none ${className}`}>
      {/* Compact Status Button / Pill */}
      <button
        type="button"
        id="btn-moon-phase-widget"
        onClick={() => setIsOpen((prev) => !prev)}
        className={`group flex items-center gap-2.5 px-3 py-1.5 rounded-xl border backdrop-blur-xl transition-all shadow-lg ${
          isOpen
            ? 'bg-slate-900 text-white border-cyan-500/60 shadow-cyan-950/50'
            : 'bg-slate-900/90 hover:bg-slate-850 text-slate-200 border-slate-800 hover:border-slate-700'
        }`}
        title="View Real-Time Astronomical Lunar Illumination and Phase Details"
      >
        {/* Visual Real-time SVG Moon */}
        <MoonPhaseGraphic phaseIndex={phaseData.phaseIndex} size={22} />

        <div className="flex flex-col text-left">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-bold text-slate-100 tracking-tight leading-none group-hover:text-cyan-300 transition-colors">
              {phaseData.phaseName}
            </span>
            <span className="text-[10px] font-mono font-semibold px-1.5 py-0.2 rounded-md bg-cyan-950/80 text-cyan-300 border border-cyan-500/30">
              {phaseData.percentage}%
            </span>
          </div>
          <span className="text-[9.5px] font-mono text-slate-400 leading-tight">
            Age {phaseData.ageDays}d • {phaseData.isWaxing ? 'Waxing' : 'Waning'}
          </span>
        </div>

        <div className="text-slate-400 group-hover:text-white transition-colors ml-0.5">
          {isOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
        </div>
      </button>

      {/* Expanded Astronomical Details Popover */}
      {isOpen && (
        <div
          id="moon-phase-details-popover"
          className="absolute bottom-full right-0 mb-3 w-80 bg-slate-950/95 backdrop-blur-2xl border border-slate-800 rounded-2xl p-4 shadow-2xl shadow-black/80 z-50 flex flex-col gap-3.5 animate-in fade-in slide-in-from-bottom-2 duration-150"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
            <div className="flex items-center gap-2">
              <div className="p-1 rounded-lg bg-cyan-950/80 border border-cyan-500/30 text-cyan-400">
                <Moon className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-100">Live Lunar Phase</h4>
                <p className="text-[10px] font-mono text-slate-400">Celestial Mechanics Ephemeris</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="text-xs text-slate-400 hover:text-white px-2 py-1 rounded-lg hover:bg-slate-900 transition-colors"
            >
              ✕
            </button>
          </div>

          {/* Hero Visual Display */}
          <div className="flex items-center justify-between gap-4 p-3.5 rounded-xl bg-slate-900/80 border border-slate-800/90 shadow-inner">
            <MoonPhaseGraphic phaseIndex={phaseData.phaseIndex} size={64} />
            <div className="flex-1 flex flex-col gap-1">
              <span className="text-base font-bold text-white tracking-tight">
                {phaseData.phaseName}
              </span>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-2 rounded-full bg-slate-800 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-cyan-400 to-amber-300 rounded-full transition-all duration-500"
                    style={{ width: `${Math.max(3, phaseData.percentage)}%` }}
                  />
                </div>
                <span className="text-xs font-mono font-bold text-cyan-300">
                  {phaseData.percentage}%
                </span>
              </div>
              <span className="text-[10px] text-slate-400 font-mono">
                {phaseData.percentage.toFixed(1)}% of lunar disc illuminated by the Sun
              </span>
            </div>
          </div>

          {/* Scientific Metrics Grid */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="flex flex-col gap-0.5 p-2.5 rounded-xl bg-slate-900/60 border border-slate-800/80">
              <span className="text-[10px] font-mono uppercase text-slate-500">Lunar Cycle Age</span>
              <span className="font-semibold text-slate-200 font-mono">
                {phaseData.ageDays} <span className="text-slate-500 text-[10px]">/ 29.53 d</span>
              </span>
            </div>

            <div className="flex flex-col gap-0.5 p-2.5 rounded-xl bg-slate-900/60 border border-slate-800/80">
              <span className="text-[10px] font-mono uppercase text-slate-500">Earth Distance</span>
              <span className="font-semibold text-slate-200 font-mono">
                {phaseData.distanceKm.toLocaleString()}{' '}
                <span className="text-slate-500 text-[10px]">km</span>
              </span>
            </div>

            <div className="flex flex-col gap-0.5 p-2.5 rounded-xl bg-slate-900/60 border border-slate-800/80">
              <span className="text-[10px] font-mono uppercase text-slate-500">Subsolar Longitude</span>
              <span className="font-semibold text-cyan-300 font-mono">
                {Math.abs(phaseData.subsolarLon)}°{phaseData.subsolarLon >= 0 ? 'E' : 'W'}
              </span>
            </div>

            <div className="flex flex-col gap-0.5 p-2.5 rounded-xl bg-slate-900/60 border border-slate-800/80">
              <span className="text-[10px] font-mono uppercase text-slate-500">Next Major Event</span>
              <span className="font-semibold text-amber-300 font-mono text-[11px] truncate">
                {phaseData.nextPhase.name}
              </span>
              <span className="text-[9.5px] font-mono text-slate-400">
                in {phaseData.nextPhase.daysUntil} days
              </span>
            </div>
          </div>

          {/* Footer timestamp */}
          <div className="flex items-center justify-between text-[9.5px] font-mono text-slate-500 border-t border-slate-800/80 pt-2">
            <div className="flex items-center gap-1.5">
              <Clock className="w-3 h-3 text-slate-400" />
              <span>{currentTime.toUTCString().replace('GMT', 'UTC')}</span>
            </div>
            <span className="text-emerald-400 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Live Sync
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
