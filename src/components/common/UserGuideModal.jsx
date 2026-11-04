import React from 'react';
import {
  HelpCircle,
  X,
  Compass,
  Globe,
  Map as MapIcon,
  Target,
  Sun,
  Radio,
  Ruler,
  Keyboard,
  MousePointer,
  GitCompare,
} from 'lucide-react';

/**
 * User Guide & Navigation Modal.
 * Provides clear instructions on controls, landing site analysis, and keyboard shortcuts.
 */
export default function UserGuideModal({ isOpen, onClose, onStartTour, onReplayGuide }) {
  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="user-guide-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-150"
    >
      <div className="bg-[#07090e] border border-slate-800 rounded-2xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden text-slate-100 animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800/80 bg-slate-950/60">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-cyan-950/70 border border-cyan-500/40 text-cyan-400">
              <HelpCircle className="w-4 h-4" />
            </div>
            <div>
              <h2 id="user-guide-title" className="text-sm font-bold tracking-tight text-white uppercase">
                Lunar Explorer Guide & Navigation
              </h2>
              <p className="text-[11px] text-slate-400">
                NASA Space Apps Challenge · Lunar Landing Site Navigator
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800/80 transition-all duration-150 active:scale-95"
            aria-label="Close guide"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-6 space-y-6 overflow-y-auto text-xs leading-relaxed">
          {/* Guided Tour Banner */}
          {onStartTour && (
            <div className="p-3.5 rounded-xl bg-gradient-to-r from-cyan-950/60 to-blue-950/60 border border-cyan-500/40 flex items-center justify-between gap-3">
              <div>
                <div className="font-bold text-white text-xs flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                  <span>First Time Here? Launch 60-Second Guided Tour</span>
                </div>
                <p className="text-[11px] text-slate-300 mt-0.5">
                  Experience the continuous 6-stage mission journey from spacecraft setup to landing site assessment.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onStartTour();
                }}
                className="px-3.5 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs tracking-wide shrink-0 transition-all shadow-md active:scale-95"
              >
                Start Tour
              </button>
            </div>
          )}

          {/* Section 1: Surface Interaction & Site Analysis */}
          <div>
            <h3 className="text-xs font-bold text-cyan-400 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
              <Target className="w-3.5 h-3.5" />
              <span>1. How to Analyze Any Landing Site</span>
            </h3>
            <div className="grid sm:grid-cols-2 gap-2.5">
              <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800/80">
                <div className="font-semibold text-white mb-1 flex items-center gap-1.5">
                  <MousePointer className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Click Anywhere on Moon</span>
                </div>
                <p className="text-slate-400 text-[11px]">
                  Click on the 3D Moon surface to drop a custom landing site pin. Luna immediately evaluates local terrain, horizon profile, and lighting conditions.
                </p>
              </div>

              <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800/80">
                <div className="font-semibold text-white mb-1 flex items-center gap-1.5">
                  <Sun className="w-3.5 h-3.5 text-amber-400" />
                  <span>Solar Illumination & DTE Link</span>
                </div>
                <p className="text-slate-400 text-[11px]">
                  The details panel computes solar elevation, time until sunset/sunrise, Direct-to-Earth (DTE) visibility to DSN stations, and power efficiency index.
                </p>
              </div>
            </div>
          </div>

          {/* Section 2: Landing Window Planner */}
          <div>
            <h3 className="text-xs font-bold text-cyan-400 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
              <Target className="w-3.5 h-3.5" />
              <span>2. Landing Window Planner</span>
            </h3>
            <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800/80">
              <p className="text-slate-300 text-[11px] mb-2">
                Answers: <em>"Where would be the most suitable place to land on the Moon at a particular date and time?"</em>
              </p>
              <ul className="space-y-1.5 text-[11px] text-slate-400 list-disc list-inside">
                <li>
                  <strong className="text-white">Full Flight Duration Analysis:</strong> Evaluates solar elevation, daylight hours, Earth line-of-sight, and thermal conditions across your entire mission duration (3, 7, 14, 28, or 90 days), not just at touchdown.
                </li>
                <li>
                  <strong className="text-white">Constraint Filtering:</strong> Filters candidates violating mandatory engineering limits (e.g. max terrain slope, continuous daylight hours, direct Earth comms).
                </li>
                <li>
                  <strong className="text-white">1-Click 3D Inspection:</strong> Select any recommended candidate to immediately animate the 3D Moon camera to its exact selenographic coordinates.
                </li>
              </ul>
            </div>
          </div>

          {/* Section 3: Landing Site Navigator & Comparison */}
          <div>
            <h3 className="text-xs font-bold text-cyan-400 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
              <GitCompare className="w-3.5 h-3.5" />
              <span>3. Lunar Landing Site Comparison</span>
            </h3>
            <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800/80">
              <p className="text-slate-300 text-[11px] mb-2">
                Click <strong>Site Comparison</strong> in the top navigation to run side-by-side trade-off evaluations:
              </p>
              <ul className="space-y-1.5 text-[11px] text-slate-400 list-disc list-inside">
                <li>
                  <strong className="text-white">Compare 2 Sites:</strong> Compare Artemis III candidate sites (e.g. Shackleton vs Malapert Mountain) for line-of-sight and illumination.
                </li>
                <li>
                  <strong className="text-white">Compare 2 Dates (Schedule Slip):</strong> See how a 14-day or 28-day launch slip impacts solar power and communication windows.
                </li>
                <li>
                  <strong className="text-white">Copy Full Briefing:</strong> Export a structured evaluation summary to your clipboard.
                </li>
              </ul>
            </div>
          </div>

          {/* Section 3: Navigation & Mouse Controls */}
          <div>
            <h3 className="text-xs font-bold text-cyan-400 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
              <Compass className="w-3.5 h-3.5" />
              <span>3. Mouse & Touch Controls</span>
            </h3>
            <div className="grid sm:grid-cols-2 gap-2 text-[11px]">
              <div className="p-2.5 rounded-lg bg-slate-900/40 border border-slate-800/60 flex items-center justify-between">
                <span className="text-slate-300">Rotate / Orbit Globe</span>
                <span className="font-mono text-cyan-300 bg-slate-800 px-1.5 py-0.5 rounded">Left Click + Drag</span>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-900/40 border border-slate-800/60 flex items-center justify-between">
                <span className="text-slate-300">Zoom In / Out</span>
                <span className="font-mono text-cyan-300 bg-slate-800 px-1.5 py-0.5 rounded">Scroll Wheel / Right Click</span>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-900/40 border border-slate-800/60 flex items-center justify-between">
                <span className="text-slate-300">Pitch & Horizon Tilt</span>
                <span className="font-mono text-cyan-300 bg-slate-800 px-1.5 py-0.5 rounded">Shift + Drag / Middle Click</span>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-900/40 border border-slate-800/60 flex items-center justify-between">
                <span className="text-slate-300">Select Site or Landmark</span>
                <span className="font-mono text-cyan-300 bg-slate-800 px-1.5 py-0.5 rounded">Click Pin / Marker</span>
              </div>
            </div>
          </div>

          {/* Section 4: Keyboard Shortcuts */}
          <div>
            <h3 className="text-xs font-bold text-cyan-400 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
              <Keyboard className="w-3.5 h-3.5" />
              <span>4. Keyboard Shortcuts</span>
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
              <div className="p-2 rounded-lg bg-slate-900/50 border border-slate-800/70 text-center">
                <kbd className="inline-block px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-cyan-300 font-mono font-bold mb-1">
                  1
                </kbd>
                <div className="text-slate-400 text-[10px]">3D Cesium View</div>
              </div>

              <div className="p-2 rounded-lg bg-slate-900/50 border border-slate-800/70 text-center">
                <kbd className="inline-block px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-cyan-300 font-mono font-bold mb-1">
                  2
                </kbd>
                <div className="text-slate-400 text-[10px]">2D Planar Map</div>
              </div>

              <div className="p-2 rounded-lg bg-slate-900/50 border border-slate-800/70 text-center">
                <kbd className="inline-block px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-cyan-300 font-mono font-bold mb-1">
                  S
                </kbd>
                <div className="text-slate-400 text-[10px]">South Pole Jump</div>
              </div>

              <div className="p-2 rounded-lg bg-slate-900/50 border border-slate-800/70 text-center">
                <kbd className="inline-block px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-cyan-300 font-mono font-bold mb-1">
                  L
                </kbd>
                <div className="text-slate-400 text-[10px]">Toggle Layers</div>
              </div>

              <div className="p-2 rounded-lg bg-slate-900/50 border border-slate-800/70 text-center">
                <kbd className="inline-block px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-cyan-300 font-mono font-bold mb-1">
                  E
                </kbd>
                <div className="text-slate-400 text-[10px]">Ephemeris Drawer</div>
              </div>

              <div className="p-2 rounded-lg bg-slate-900/50 border border-slate-800/70 text-center">
                <kbd className="inline-block px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-cyan-300 font-mono font-bold mb-1">
                  M
                </kbd>
                <div className="text-slate-400 text-[10px]">Distance Tool</div>
              </div>

              <div className="p-2 rounded-lg bg-slate-900/50 border border-slate-800/70 text-center">
                <kbd className="inline-block px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-cyan-300 font-mono font-bold mb-1">
                  O
                </kbd>
                <div className="text-slate-400 text-[10px]">Transfer Orbit</div>
              </div>

              <div className="p-2 rounded-lg bg-slate-900/50 border border-slate-800/70 text-center">
                <kbd className="inline-block px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-cyan-300 font-mono font-bold mb-1">
                  ? / H
                </kbd>
                <div className="text-slate-400 text-[10px]">Open Guide</div>
              </div>

              <div className="p-2 rounded-lg bg-slate-900/50 border border-slate-800/70 text-center">
                <kbd className="inline-block px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-cyan-300 font-mono font-bold mb-1">
                  Esc
                </kbd>
                <div className="text-slate-400 text-[10px]">Close / Deselect</div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-800/80 bg-slate-950/60 flex items-center justify-between text-[11px] text-slate-400">
          <span>Powered by NASA Moon Trek WMTS & LROC Planetary Datasets</span>
          <div className="flex items-center gap-2">
            {onReplayGuide && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onReplayGuide();
                }}
                className="px-3 py-1.5 rounded-lg bg-slate-900 border border-cyan-500/40 hover:bg-cyan-950/60 text-cyan-300 font-semibold transition-colors text-xs flex items-center gap-1.5"
              >
                <Compass className="w-3.5 h-3.5 text-cyan-400" />
                Replay Guide
              </button>
            )}
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-semibold transition-colors"
          >
            Got it
          </button>
          </div>
        </div>
      </div>
    </div>
  );
}
