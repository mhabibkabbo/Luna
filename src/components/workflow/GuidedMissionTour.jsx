/**
 * @file GuidedMissionTour.jsx
 * Interactive Guided Onboarding Tour for LUNA.
 * Smoothly guides operators through the 6 core stages of the mission workflow,
 * dynamically driving 3D Cesium camera movements, 2D polar topographic GIS switching,
 * horizon analysis, and cross-body Earth link visualizations.
 */

import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  ChevronRight,
  ChevronLeft,
  X,
  Rocket,
  Compass,
  Sun,
  Radio,
  Target,
  ChevronDown,
  ChevronUp,
  MapPin,
} from 'lucide-react';

export const TOUR_STEPS = [
  {
    step: 1,
    title: 'Artemis III Target — Malapert Massif',
    subtitle: 'Lunar South Pole Summit · 85.90°S, 0.00°E',
    description:
      "We've targeted Malapert Massif at the Lunar South Pole. With over 90% annual solar illumination and continuous line of sight to Earth, this elevated ridge is NASA's primary Artemis III landing candidate.",
    icon: Rocket,
    stage: 1,
    actionLabel: 'Next: Switch to 2D Topo Map',
    badge: '3D Lunar Orbit View',
  },
  {
    step: 2,
    title: '2D Polar Topographic GIS Map',
    subtitle: 'High-Resolution NASA LOLA DEM (80°S–90°S)',
    description:
      'Switched to the high-resolution 2D Polar GIS map! Derived from NASA LOLA laser altimeter measurements, this planar GIS view provides 100m/200m elevation contours, slope steepness hazard zones, and traverse routes.',
    icon: Compass,
    stage: 2,
    actionLabel: 'Next: Inspect Horizon & Thermal',
    badge: '2D Polar GIS Active',
  },
  {
    step: 3,
    title: 'LOLA DEM Horizon & Diviner Thermal',
    subtitle: '360° Panoramic Obstruction & Solar Elevation',
    description:
      'At the lunar poles, deep crater rims cast perpetual shadows. This workspace models local 360° terrain horizons, calculating exact solar elevation and Diviner thermal swings (-190°C to +125°C).',
    icon: Sun,
    stage: 3,
    actionLabel: 'Next: Direct-to-Earth Link',
    badge: 'Site Analysis Workspace',
  },
  {
    step: 4,
    title: 'Direct-to-Earth Comms & DSN Tracking',
    subtitle: 'Line of Sight & Ground Station Geometry',
    description:
      'Direct line of sight to Earth is mandatory for crew safety. Luna evaluates real-time geometry to NASA Deep Space Network complexes (Goldstone, Canberra, Madrid), flagging crater rim blockage and libration.',
    icon: Radio,
    stage: 4,
    actionLabel: 'Next: Launch Slip Simulator',
    badge: 'DTE Calculation Active',
  },
  {
    step: 5,
    title: 'Launch Slip Simulator & Window Heatmaps',
    subtitle: 'Lunation Cycles & Probability Analysis',
    description:
      'What happens if the launch slips by days or weeks? The slip simulator sweeps entire lunation cycles, testing daylight duration, surface mechanism survival temperatures, and comms availability.',
    icon: Target,
    stage: 5,
    actionLabel: 'Finish Tour & Explore',
    badge: 'Slip Simulator Active',
  },
  {
    step: 6,
    title: 'Operational Command Ready',
    subtitle: 'Free Exploration Unlocked',
    description:
      'You are all set! Explore global 3D Moon and Earth environments, drop custom pins with selenographic coordinates, measure distances, switch basemaps, or press [?] anytime for keyboard shortcuts.',
    icon: Sparkles,
    stage: 6,
    actionLabel: 'Start Free Exploration',
    badge: 'Tour Complete',
  },
];

export default function GuidedMissionTour({
  isActive = false,
  stepIndex = 0,
  onNext,
  onPrev,
  onEnd,
}) {
  const [isMinimized, setIsMinimized] = useState(false);

  // Keyboard navigation for tour: ArrowRight / Enter -> Next, ArrowLeft -> Prev, Escape -> End
  useEffect(() => {
    if (!isActive) return;

    const handleKeyDown = (e) => {
      const tag = e.target?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select' || e.target?.isContentEditable) {
        return;
      }

      if (e.key === 'ArrowRight' || (e.key === 'Enter' && !e.shiftKey)) {
        e.preventDefault();
        onNext?.();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        onPrev?.();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isActive, onNext, onPrev]);

  if (!isActive) return null;

  const current = TOUR_STEPS[stepIndex] || TOUR_STEPS[0];
  const Icon = current.icon;
  const isFirst = stepIndex === 0;
  const isLast = stepIndex === TOUR_STEPS.length - 1;

  // Minimized Floating Pill
  if (isMinimized) {
    return (
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 pointer-events-auto select-none animate-in fade-in zoom-in-95 duration-150">
        <button
          type="button"
          onClick={() => setIsMinimized(false)}
          className="flex items-center gap-2.5 px-4 py-2 rounded-full bg-[#040711]/95 border border-cyan-500/60 shadow-[0_8px_32px_rgba(0,0,0,0.8)] backdrop-blur-2xl text-xs font-mono text-cyan-300 hover:text-white transition-all active:scale-95 group"
          title="Click to expand tour instructions"
        >
          <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
          <span className="font-semibold text-white">
            Tour ({current.step}/{TOUR_STEPS.length}):
          </span>
          <span className="text-cyan-300 truncate max-w-[180px] sm:max-w-xs">{current.title}</span>
          <ChevronUp className="w-3.5 h-3.5 text-slate-400 group-hover:text-cyan-300 transition-colors" />
        </button>
      </div>
    );
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Interactive guided mission tour"
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-[calc(100vw-24px)] max-w-lg bg-[#040711]/95 backdrop-blur-2xl border border-cyan-500/50 rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.9)] p-4 sm:p-5 text-slate-100 animate-in fade-in slide-in-from-bottom-2 duration-200 select-none"
    >
      {/* Top Header: Step Badge, Badge Pill, Minimize & Skip Buttons */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-800/80 mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-6 h-6 rounded-md bg-cyan-950 text-cyan-300 border border-cyan-500/40 flex items-center justify-center font-mono font-bold text-xs shrink-0 shadow-sm">
            {current.step}
          </div>
          <span className="text-[11px] font-mono uppercase tracking-wider text-cyan-300 font-semibold truncate">
            Guided Tour ({current.step}/{TOUR_STEPS.length})
          </span>
          {current.badge && (
            <span className="hidden sm:inline px-2 py-0.5 rounded-full text-[10px] font-mono bg-cyan-950/80 text-cyan-400 border border-cyan-800/60 shrink-0">
              {current.badge}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => setIsMinimized(true)}
            className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800/80 transition-colors"
            title="Minimize tour card"
            aria-label="Minimize tour card"
          >
            <ChevronDown className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={onEnd}
            className="text-xs text-slate-400 hover:text-white flex items-center gap-1 transition-colors px-2 py-0.5 rounded hover:bg-slate-800/80"
            title="Exit guided tour [Esc]"
          >
            <span>Skip</span>
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Visual Progress Bar */}
      <div className="w-full h-1 bg-slate-800/90 rounded-full overflow-hidden mb-3.5">
        <div
          className="h-full bg-gradient-to-r from-cyan-400 via-teal-400 to-emerald-400 transition-all duration-300 rounded-full"
          style={{ width: `${((stepIndex + 1) / TOUR_STEPS.length) * 100}%` }}
        />
      </div>

      {/* Step Content */}
      <div className="flex gap-3.5 mb-4">
        <div className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-700/80 text-cyan-400 flex items-center justify-center shrink-0 shadow-md">
          <Icon className="w-5 h-5 text-cyan-400" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-bold text-white tracking-wide">{current.title}</h3>
          <div className="text-[11px] font-mono text-cyan-300/90 mb-1 flex items-center gap-1">
            <MapPin className="w-3 h-3 text-cyan-400" />
            <span>{current.subtitle}</span>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">{current.description}</p>
        </div>
      </div>

      {/* Footer Controls: Back, Step Indicators, Action/Next Button */}
      <div className="flex items-center justify-between pt-2 border-t border-slate-800/60">
        <button
          type="button"
          disabled={isFirst}
          onClick={onPrev}
          className="px-3 py-1.5 text-xs rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/80 disabled:opacity-20 disabled:pointer-events-none transition-all flex items-center gap-1 active:scale-95"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
          <span>Back</span>
        </button>

        <div className="hidden sm:flex items-center gap-1">
          {TOUR_STEPS.map((s, idx) => (
            <span
              key={s.step}
              className={`w-1.5 h-1.5 rounded-full transition-all duration-200 ${
                idx === stepIndex
                  ? 'bg-cyan-400 w-4'
                  : idx < stepIndex
                  ? 'bg-cyan-600'
                  : 'bg-slate-700'
              }`}
            />
          ))}
        </div>

        <button
          type="button"
          onClick={onNext}
          className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-cyan-400 hover:bg-cyan-300 text-slate-950 transition-all shadow-[0_0_16px_rgba(0,210,196,0.35)] active:scale-95 flex items-center gap-1.5"
        >
          <span>{isLast ? 'Complete & Start Exploring' : current.actionLabel}</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
