/**
 * @file MissionWorkflowRail.jsx
 * Collapsible mission timeline rail for the continuous 6-stage mission journey.
 */

import React from 'react';
import {
  Rocket,
  Globe2,
  Mountain,
  Radio,
  GitCompare,
  FileCheck2,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Compass,
} from 'lucide-react';

export const STAGES = [
  {
    id: 1,
    number: '01',
    name: 'Mission Setup',
    shortName: 'Setup',
    subtitle: 'Spacecraft & Target Epoch',
    icon: Rocket,
  },
  {
    id: 2,
    number: '02',
    name: 'Earth & Moon Exploration',
    shortName: 'Explore',
    subtitle: '3D Bodies & Surface Waypoints',
    icon: Globe2,
  },
  {
    id: 3,
    number: '03',
    name: 'Landing Site Evaluation',
    shortName: 'Evaluate',
    subtitle: 'Terrain, Sun & Power',
    icon: Mountain,
  },
  {
    id: 4,
    number: '04',
    name: 'Direct-to-Earth Comms',
    shortName: 'Comms',
    subtitle: 'LOS & DSN Tracking Link',
    icon: Radio,
  },
  {
    id: 5,
    number: '05',
    name: 'Candidate Comparison',
    shortName: 'Compare',
    subtitle: 'Dual-Site Trade Studies',
    icon: GitCompare,
  },
  {
    id: 6,
    number: '06',
    name: 'Mission Assessment',
    shortName: 'Dossier',
    subtitle: 'Briefing & Risk Matrix',
    icon: FileCheck2,
  },
];

export default function MissionWorkflowRail({
  currentStage = 1,
  onSelectStage,
  isCollapsed = false,
  onToggleCollapse,
  activeMission,
  selectedFeature,
  onStartTour,
}) {
  const activeStageInfo = STAGES.find((s) => s.id === currentStage) || STAGES[0];

  return (
    <nav
      aria-label="Mission Workflow Rail"
      className={`absolute left-3 sm:left-4 top-14 z-20 flex flex-col transition-all duration-200 select-none ${
        isCollapsed ? 'w-11 sm:w-12' : 'w-64 sm:w-72'
      }`}
    >
      <div className="bg-[#040711]/92 backdrop-blur-xl border border-slate-800/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Rail Header */}
        <div className="h-10 px-2.5 sm:px-3 flex items-center justify-between border-b border-slate-800/60 bg-slate-900/40">
          {!isCollapsed && (
            <div className="flex items-center gap-2 overflow-hidden">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
              <span className="text-[11px] font-semibold tracking-wider text-slate-300 uppercase font-mono truncate">
                Mission Workflow
              </span>
              <span className="text-[10px] text-cyan-400 font-mono font-medium">
                {currentStage}/6
              </span>
            </div>
          )}

          <div className={`flex items-center gap-1 ${isCollapsed ? 'mx-auto' : ''}`}>
            {!isCollapsed && onStartTour && (
              <button
                type="button"
                onClick={onStartTour}
                className="px-2 py-0.5 text-[10px] font-mono text-cyan-300 hover:text-white bg-cyan-950/50 hover:bg-cyan-900/60 border border-cyan-800/40 rounded transition-colors"
                title="Start 60-second guided onboarding"
              >
                Tour
              </button>
            )}

            <button
              type="button"
              onClick={onToggleCollapse}
              className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800/80 transition-colors"
              title={isCollapsed ? 'Expand Mission Workflow Rail' : 'Collapse Rail'}
              aria-label={isCollapsed ? 'Expand Mission Workflow Rail' : 'Collapse Rail'}
            >
              {isCollapsed ? (
                <ChevronRight className="w-4 h-4 text-cyan-400" />
              ) : (
                <ChevronLeft className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>

        {/* Stage List */}
        <div className="p-1.5 sm:p-2 space-y-1">
          {STAGES.map((stage) => {
            const Icon = stage.icon;
            const isActive = stage.id === currentStage;
            const isCompleted = stage.id < currentStage;

            return (
              <button
                key={stage.id}
                type="button"
                onClick={() => onSelectStage(stage.id)}
                className={`w-full flex items-center gap-2.5 rounded-xl transition-all duration-150 text-left ${
                  isCollapsed
                    ? 'p-2 justify-center'
                    : 'px-2.5 py-2'
                } ${
                  isActive
                    ? 'bg-cyan-950/70 border border-cyan-500/40 text-cyan-200 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60 border border-transparent'
                }`}
                title={`${stage.number}. ${stage.name} — ${stage.subtitle}`}
              >
                <div
                  className={`w-7 h-7 shrink-0 rounded-lg flex items-center justify-center font-mono text-xs font-semibold transition-colors ${
                    isActive
                      ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-400/40'
                      : isCompleted
                      ? 'bg-slate-800/80 text-cyan-400 border border-slate-700/60'
                      : 'bg-slate-900/80 text-slate-500 border border-slate-800'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                </div>

                {!isCollapsed && (
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-[10px] font-mono font-medium text-slate-500">
                        STAGE {stage.number}
                      </span>
                      {isActive && (
                        <span className="text-[9px] font-mono uppercase tracking-wider text-cyan-300 font-semibold px-1 py-0.2 rounded bg-cyan-950/80 border border-cyan-500/30">
                          Active
                        </span>
                      )}
                    </div>
                    <div className="text-xs font-semibold text-slate-200 truncate">
                      {stage.name}
                    </div>
                    <div className="text-[10px] text-slate-400 truncate">
                      {stage.subtitle}
                    </div>
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Rail Footer Controls */}
        {!isCollapsed && (
          <div className="p-2 border-t border-slate-800/60 bg-slate-900/30 flex items-center justify-between gap-1.5">
            <button
              type="button"
              disabled={currentStage <= 1}
              onClick={() => onSelectStage(currentStage - 1)}
              className="flex-1 py-1.5 px-2 text-[11px] font-medium rounded-lg bg-slate-900/80 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 disabled:opacity-40 disabled:pointer-events-none transition-colors text-center"
            >
              ← Back
            </button>
            <button
              type="button"
              disabled={currentStage >= 6}
              onClick={() => onSelectStage(currentStage + 1)}
              className="flex-1 py-1.5 px-2 text-[11px] font-medium rounded-lg bg-cyan-950/60 hover:bg-cyan-900/80 text-cyan-200 hover:text-white border border-cyan-800/50 disabled:opacity-40 disabled:pointer-events-none transition-colors text-center"
            >
              Next Stage →
            </button>
          </div>
        )}
      </div>
    </nav>
  );
}
