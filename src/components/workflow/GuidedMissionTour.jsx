/**
 * @file GuidedMissionTour.jsx
 * 60-Second Interactive Guided Onboarding Tour for LUNA.
 * Guides new operators through the continuous 6-stage mission workflow.
 */

import React from 'react';
import { Sparkles, ChevronRight, ChevronLeft, X, Rocket, Compass, Sun, Radio, Target, FileText } from 'lucide-react';

export const TOUR_STEPS = [
  {
    step: 1,
    title: 'Stage 01 — Mission Setup',
    subtitle: 'Spacecraft & Target Selection',
    description:
      'Configure your flight profile (e.g. Artemis III, IM-1 Nova-C, Griffin/VIPER), select a candidate landing region like the Lunar South Pole, and set the mission simulation epoch.',
    icon: Rocket,
    stage: 1,
    actionLabel: 'Target South Pole',
  },
  {
    step: 2,
    title: 'Stage 02 — 3D Earth & Moon Exploration',
    subtitle: 'Surface Waypoints & DSN Network',
    description:
      'The Moon is your primary interface. Orbit the 3D globe, inspect verified landing sites, drop custom waypoints with selenographic coordinates, or switch to Earth to see Deep Space Network ground complexes.',
    icon: Compass,
    stage: 2,
    actionLabel: 'Inspect Terrain',
  },
  {
    step: 3,
    title: 'Stage 03 — Landing Site Evaluation',
    subtitle: 'Terrain, Sun & Power Generation',
    description:
      'Inspect local LOLA DEM topographic horizons, solar elevation, Diviner thermal environment, and photovoltaic power potential calculated directly from lunar topography.',
    icon: Sun,
    stage: 3,
    actionLabel: 'Check Earth Link',
  },
  {
    step: 4,
    title: 'Stage 04 — Direct-to-Earth (DTE) Comms',
    subtitle: 'Line of Sight & Horizon Masking',
    description:
      'Analyze direct line of sight from your lunar landing site to Earth ground stations. The system evaluates crater rim blockage, antenna gimbal limits, and communication blackout windows.',
    icon: Radio,
    stage: 4,
    actionLabel: 'Plan Landing Window',
  },
  {
    step: 5,
    title: 'Stage 05 — Landing Window Planner',
    subtitle: 'Multi-Duration Candidate Optimization',
    description:
      'Specify your launch epoch, region, duration, and flight constraints. The system scans candidate sites, filters out engineering violations, and ranks the best locations to land.',
    icon: Target,
    stage: 5,
    actionLabel: 'View Mission Dossier',
  },
  {
    step: 6,
    title: 'Stage 06 — Mission Assessment & Dossier',
    subtitle: 'Evidence-Based Reporting & Briefing',
    description:
      'Synthesize all scientific metrics into an executive mission assessment. Review operational risk matrices (thermal, blackout, terrain slope) and export a copyable mission briefing.',
    icon: FileText,
    stage: 6,
    actionLabel: 'Finish Tour & Explore',
  },
];

export default function GuidedMissionTour({
  isActive = false,
  stepIndex = 0,
  onNext,
  onPrev,
  onEnd,
  onStageChange,
}) {
  if (!isActive) return null;

  const current = TOUR_STEPS[stepIndex] || TOUR_STEPS[0];
  const Icon = current.icon;
  const isFirst = stepIndex === 0;
  const isLast = stepIndex === TOUR_STEPS.length - 1;

  const handleNext = () => {
    if (isLast) {
      onEnd();
    } else {
      if (onStageChange && TOUR_STEPS[stepIndex + 1]) {
        onStageChange(TOUR_STEPS[stepIndex + 1].stage);
      }
      onNext();
    }
  };

  const handlePrev = () => {
    if (stepIndex > 0) {
      if (onStageChange && TOUR_STEPS[stepIndex - 1]) {
        onStageChange(TOUR_STEPS[stepIndex - 1].stage);
      }
      onPrev();
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="60-second guided mission tour"
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 w-[calc(100vw-24px)] max-w-lg bg-[#040711]/95 backdrop-blur-2xl border border-cyan-500/50 rounded-2xl shadow-2xl p-4 sm:p-5 text-slate-100 animate-in fade-in slide-in-from-bottom-2 duration-200"
    >
      {/* Header with Step Dots & Skip */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-800/80 mb-3">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-cyan-950 text-cyan-300 border border-cyan-500/40 flex items-center justify-center font-mono font-bold text-xs">
            {current.step}
          </div>
          <span className="text-[11px] font-mono uppercase tracking-wider text-cyan-300 font-semibold">
            60-Second Mission Tour ({current.step}/{TOUR_STEPS.length})
          </span>
        </div>

        <button
          type="button"
          onClick={onEnd}
          className="text-xs text-slate-400 hover:text-white flex items-center gap-1 transition-colors px-2 py-0.5 rounded hover:bg-slate-800"
        >
          <span>Skip Tour</span>
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Progress Line */}
      <div className="w-full h-1 bg-slate-800 rounded-full overflow-hidden mb-3.5">
        <div
          className="h-full bg-gradient-to-r from-cyan-400 to-blue-500 transition-all duration-300 rounded-full"
          style={{ width: `${((stepIndex + 1) / TOUR_STEPS.length) * 100}%` }}
        />
      </div>

      {/* Step Body */}
      <div className="flex gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-700/80 text-cyan-400 flex items-center justify-center shrink-0">
          <Icon className="w-5 h-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-bold text-white tracking-wide">
            {current.title}
          </h3>
          <div className="text-[11px] font-mono text-cyan-300 mb-1">
            {current.subtitle}
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">
            {current.description}
          </p>
        </div>
      </div>

      {/* Footer Navigation */}
      <div className="flex items-center justify-between pt-2">
        <button
          type="button"
          disabled={isFirst}
          onClick={handlePrev}
          className="px-3 py-1.5 text-xs rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/80 disabled:opacity-30 disabled:pointer-events-none transition-colors flex items-center gap-1"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
          <span>Back</span>
        </button>

        <button
          type="button"
          onClick={handleNext}
          className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 transition-all shadow-md active:scale-95 flex items-center gap-1.5"
        >
          <span>{isLast ? 'Complete & Start Free Exploration' : current.actionLabel}</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
