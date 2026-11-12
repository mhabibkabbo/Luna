import React from 'react';
import { Sparkles, ChevronRight, X } from 'lucide-react';
import { startGuide, dismissPrompt } from './guideStore.js';

export default function WhatsNewToast({
  view = 'explorer',
  newSteps = [],
  timelineVisible = false,
  onDismiss,
}) {
  if (!newSteps || newSteps.length === 0) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed ${
        timelineVisible ? 'bottom-[116px]' : 'bottom-4'
      } inset-x-3 sm:inset-x-auto sm:right-4 z-40 sm:w-full max-w-sm bg-[#0A0B0E]/95 backdrop-blur-md border border-white/[0.14] rounded-xl p-3.5 shadow-[0_12px_36px_rgba(0,0,0,0.85)] flex items-center justify-between gap-3 text-white animate-in slide-in-from-bottom-3 duration-300 pointer-events-auto`}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="w-7 h-7 rounded-lg bg-white/[0.06] border border-white/[0.14] flex items-center justify-center text-[#F8FAFC] shrink-0">
          <Sparkles className="w-3.5 h-3.5" />
        </div>
        <div className="min-w-0">
          <div className="text-xs font-semibold text-white flex items-center gap-1.5">
            <span>What's new</span>
            <span className="px-1.5 py-0.5 rounded bg-white/[0.08] text-[#F8FAFC] text-[10px] font-mono font-semibold">
              +{newSteps.length}
            </span>
          </div>
          <p className="text-[11px] text-[#8E95A5] truncate">
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
          className="px-2.5 py-1 rounded-md text-[11px] font-semibold bg-white hover:bg-[#E2E8F0] text-[#050507] transition-all flex items-center gap-1"
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
          className="p-1 rounded text-[#8E95A5] hover:text-white hover:bg-white/[0.06] transition-colors"
          title="Dismiss"
          aria-label="Dismiss what's new notification"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
