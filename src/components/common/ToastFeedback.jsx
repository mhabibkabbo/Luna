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
    border: 'border-emerald-500/50',
    icon: 'text-emerald-400',
    badge: 'bg-emerald-950/60 text-emerald-300',
  },
  navigation: {
    border: 'border-cyan-500/50',
    icon: 'text-cyan-400',
    badge: 'bg-cyan-950/60 text-cyan-300',
  },
  warn: {
    border: 'border-amber-500/50',
    icon: 'text-amber-400',
    badge: 'bg-amber-950/60 text-amber-300',
  },
  info: {
    border: 'border-slate-700/80',
    icon: 'text-slate-300',
    badge: 'bg-slate-800 text-slate-300',
  },
};

/**
 * Toast feedback notification container.
 * Subscribes to feedbackStore and displays non-intrusive status updates to the user.
 */
export default function ToastFeedback() {
  const [items, setItems] = useState([]);

  useEffect(() => {
    return feedbackStore.subscribe(setItems);
  }, []);

  if (items.length === 0) return null;

  return (
    <aside
      aria-live="polite"
      aria-label="Application feedback notifications"
      className="fixed top-14 right-3 sm:right-6 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none"
    >
      {items.map((item) => {
        const IconComponent = ICON_MAP[item.type] || Info;
        const colors = COLOR_MAP[item.type] || COLOR_MAP.info;

        return (
          <div
            key={item.id}
            role="status"
            className={`pointer-events-auto flex items-start gap-3 p-3 bg-[#07090e]/95 backdrop-blur-xl border ${colors.border} rounded-xl shadow-2xl shadow-black/80 text-slate-100 transition-all duration-150 animate-in fade-in slide-in-from-top-2`}
          >
            <div className={`mt-0.5 shrink-0 ${colors.icon}`}>
              <IconComponent className="w-4 h-4" />
            </div>

            <div className="flex-1 min-w-0 pr-1">
              <div className="text-xs font-semibold text-slate-100 tracking-tight leading-snug">
                {item.title}
              </div>
              {item.description && (
                <div className="text-[11px] text-slate-400 font-sans leading-relaxed mt-0.5 break-words">
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
                  className="mt-1.5 text-[10px] font-semibold text-cyan-400 hover:text-cyan-300 underline underline-offset-2"
                >
                  {item.action.label}
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={() => dismissNotification(item.id)}
              className="shrink-0 p-1 text-slate-400 hover:text-white rounded-md hover:bg-slate-800/60 transition-colors"
              aria-label="Dismiss notification"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      })}
    </aside>
  );
}
