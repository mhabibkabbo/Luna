/**
 * @file WhatsNewToast.jsx
 * Small banner toast shown when returning users have new guide steps available.
 */

import React from 'react';
import { Sparkles, ChevronRight, X } from 'lucide-react';
import { startGuide, dismissPrompt } from './guideStore.js';

export default function WhatsNewToast({ view = 'explorer', newSteps = [], onDismiss }) {
  if (!newSteps || newSteps.length === 0) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-4 right-4 z-40 max-w-sm w-full bg-[#070b14]/95 backdrop-blur-md border border-cyan-500/50 rounded-xl p-3 shadow-[0_12px_36px_rgba(0,0,0,0.85)] flex items-center justify-between gap-3 text-white animate-in slide-in-from-bottom-3 duration-300 pointer-events-auto"
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="w-7 h-7 rounded-lg bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400 shrink-0">
          <Sparkles className="w-3.5 h-3.5 animate-pulse" />
        </div>
        <div className="min-w-0">
          <div className="text-xs font-bold text-white flex items-center gap-1.5">
            <span>What's new</span>
            <span className="px-1.5 py-0.2 rounded-full bg-cyan-500/20 text-cyan-300 text-[10px] font-mono font-semibold">
              +{newSteps.length}
            </span>
          </div>
          <p className="text-[11px] text-slate-400 truncate">
            New features and controls added to {view}.
          </p>
        </div>
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        <button
          type="button"
          onClick={() => {
            startGuide(view, { mode: 'whats-new', filterSteps: newSteps });
            onDismiss?.();
          }}
          className="px-2.5 py-1 rounded-md text-[11px] font-semibold bg-cyan-600 hover:bg-cyan-500 text-white transition-all shadow-[0_0_8px_rgba(6,182,212,0.3)] flex items-center gap-1"
        >
          See what's new
          <ChevronRight className="w-3 h-3" />
        </button>
        <button
          type="button"
          onClick={() => {
            dismissPrompt(view);
            onDismiss?.();
          }}
          className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          title="Dismiss"
          aria-label="Dismiss what's new notification"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
