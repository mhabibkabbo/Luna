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
    <div className={`flex items-center gap-2.5 shrink-0 ${className}`}>
      {/* Brand Icon Box: Transparent with fine border and lunar emblem */}
      <div className="w-7 h-7 rounded-lg bg-transparent border border-slate-700/60 flex items-center justify-center group-hover:border-cyan-500/50 transition-colors">
        <Moon className="w-3.5 h-3.5 text-slate-200 group-hover:text-cyan-300 transition-colors" />
      </div>

      {/* Brand Name & Identifier */}
      <div className="flex items-baseline gap-1.5">
        <span className="text-sm font-semibold tracking-wider text-white uppercase font-sans group-hover:text-cyan-200 transition-colors">
          LUNA
        </span>
        <span className="text-[10px] font-mono text-cyan-400/80 tracking-widest uppercase hidden sm:inline">
          CLPS BROWSER
        </span>
      </div>

      {/* Optional subtle back-to-landing indicator (for Explorer workspace) */}
      {showBackIndicator && (
        <span className="hidden sm:inline-flex items-center gap-1 ml-1 px-1.5 py-0.5 rounded text-[10px] font-mono text-slate-400 group-hover:text-white bg-slate-900/60 border border-slate-800 transition-colors">
          <ArrowLeft className="w-2.5 h-2.5 text-cyan-400" />
          <span>{backLabel}</span>
        </span>
      )}
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
