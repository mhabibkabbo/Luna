import React, { useState, useEffect } from 'react';
import { feedbackStore, dismissNotification } from '../../utils/feedbackStore.js';
import { CheckCircle2, Compass, AlertCircle, Info, X } from 'lucide-react';

const ICON_MAP = {
  success: CheckCircle2,
  navigation: Compass,
  warn: AlertCircle,
  info: Info,
};

const COLOR_MAP = {
  success: {
    border: 'border-emerald-500/40',
    icon: 'text-emerald-400',
    badge: 'bg-emerald-950/60 text-emerald-300',
  },
  navigation: {
    border: 'border-cyan-500/40',
    icon: 'text-cyan-400',
    badge: 'bg-cyan-950/60 text-cyan-300',
  },
  warn: {
    border: 'border-amber-500/40',
    icon: 'text-amber-400',
    badge: 'bg-amber-950/60 text-amber-300',
  },
  info: {
    border: 'border-slate-800/90',
    icon: 'text-slate-300',
    badge: 'bg-slate-800 text-slate-300',
  },
};

/**
 * Toast feedback notification container.
 * Subscribes to feedbackStore and displays non-intrusive status updates to the user.
 * Displays at most maxItems (defaults to 2) simultaneously in a compact, discrete footprint.
 */
export default function ToastFeedback({ maxItems = 2, className = '' }) {
  const [items, setItems] = useState([]);

  useEffect(() => {
    return feedbackStore.subscribe(setItems);
  }, []);

  const displayItems = items.slice(0, maxItems);

  if (displayItems.length === 0) return null;

  return (
    <aside
      aria-live="polite"
      aria-label="Application feedback notifications"
      className={`flex flex-col gap-1.5 pointer-events-none ${className}`}
    >
      {displayItems.map((item) => {
        const IconComponent = ICON_MAP[item.type] || Info;
        const colors = COLOR_MAP[item.type] || COLOR_MAP.info;

        return (
          <div
            key={item.id}
            role="status"
            className={`pointer-events-auto flex items-start gap-2 px-2.5 py-1.5 bg-[#060b14]/95 backdrop-blur-xl border ${colors.border} rounded-lg shadow-xl shadow-black/60 text-slate-100 max-w-[280px] sm:max-w-xs transition-all duration-150 animate-in fade-in slide-in-from-top-1 select-none`}
          >
            <div className={`mt-0.5 shrink-0 ${colors.icon}`}>
              <IconComponent className="w-3.5 h-3.5" />
            </div>

            <div className="flex-1 min-w-0 pr-0.5">
              <div className="text-[11px] font-semibold text-slate-200 tracking-tight leading-tight truncate">
                {item.title}
              </div>
              {item.description && (
                <div className="text-[10px] text-slate-400 font-sans leading-tight mt-0.5 line-clamp-2">
                  {item.description}
                </div>
              )}
              {item.action && (
                <button
                  type="button"
                  onClick={() => {
                    item.action.onClick?.();
                    dismissNotification(item.id);
                  }}
                  className="mt-1 text-[9px] font-semibold text-cyan-400 hover:text-cyan-300 underline underline-offset-2"
                >
                  {item.action.label}
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={() => dismissNotification(item.id)}
              className="shrink-0 p-0.5 -mr-0.5 text-slate-400 hover:text-white rounded hover:bg-slate-800/60 transition-colors"
              aria-label="Dismiss notification"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        );
      })}
    </aside>
  );
}
