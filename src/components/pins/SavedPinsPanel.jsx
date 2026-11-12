import React, { useState, useRef, useEffect } from 'react';
import {
  Bookmark,
  BookmarkCheck,
  Compass,
  Globe2,
  MapPin,
  Moon,
  Navigation,
  Search,
  Trash2,
  X,
  ExternalLink,
} from 'lucide-react';
import {
  useSavedPins,
  removeSavedPin,
  clearAllSavedPins,
} from '../../utils/savedPinsStore.js';

export default function SavedPinsPanel({ onSelectPin, activePinId }) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [confirmClearAll, setConfirmClearAll] = useState(false);
  const savedPins = useSavedPins();
  const panelRef = useRef(null);

  useEffect(() => {
    if (!isOpen) {
      setConfirmClearAll(false);
      return;
    }

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setIsOpen(false);
    };

    const handleClickOutside = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const filteredPins = savedPins.filter((pin) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      pin.name?.toLowerCase().includes(q) ||
      pin.region?.toLowerCase().includes(q) ||
      pin.body?.toLowerCase().includes(q)
    );
  });

  const count = savedPins.length;

  if (count === 0) {
    return null;
  }

  return (
    <div
      ref={panelRef}
      className="absolute top-3.5 left-3.5 sm:top-4 sm:left-4 z-30 select-none pointer-events-auto"
    >
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
        aria-label={`Saved Pins manager (${count} saved)`}
        title="Manage Saved Pins"
        className={`h-9 px-3 rounded-xl flex items-center gap-2 border text-xs font-sans font-medium transition-all shadow-lg backdrop-blur-xl ${
          isOpen
            ? 'bg-amber-500/20 border-amber-400/50 text-amber-300 shadow-amber-500/10 ring-2 ring-amber-400/20'
            : count > 0
            ? 'bg-[#08090C]/90 hover:bg-[#0E1017] border-white/[0.14] hover:border-amber-400/40 text-[#F8FAFC]'
            : 'bg-[#08090C]/85 hover:bg-[#0E1017] border-white/[0.10] hover:border-white/[0.20] text-[#94A3B8] hover:text-white'
        }`}
      >
        {count > 0 ? (
          <BookmarkCheck className="w-4 h-4 text-amber-400 shrink-0" />
        ) : (
          <Bookmark className="w-4 h-4 text-[#8E95A5] shrink-0" />
        )}
        <span>Saved Pins</span>
        {count > 0 && (
          <span className="px-1.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-400/20 text-amber-300 border border-amber-400/30">
            {count}
          </span>
        )}
      </button>

      {isOpen && (
        <div
          role="region"
          aria-label="Saved Pins Control Panel"
          className="absolute top-11 left-0 w-80 sm:w-96 max-w-[calc(100vw-2rem)] bg-[#08090C]/96 border border-white/[0.14] rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.85)] backdrop-blur-2xl overflow-hidden flex flex-col z-50 animate-in fade-in zoom-in-95 duration-150"
        >
          <div className="px-3.5 py-3 border-b border-white/[0.08] bg-[#0C0D12] flex items-center justify-between gap-2 shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-6 h-6 rounded-lg bg-amber-400/15 border border-amber-400/30 flex items-center justify-center text-amber-400 shrink-0">
                <Bookmark className="w-3.5 h-3.5" />
              </div>
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="text-xs font-bold text-white tracking-wide truncate">
                  Saved Pins
                </span>
                <span className="text-[10px] font-mono text-slate-400 tabular-nums">
                  ({count})
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              {count > 0 && !confirmClearAll && (
                <button
                  type="button"
                  onClick={() => setConfirmClearAll(true)}
                  title="Clear all saved pins"
                  className="px-2 py-1 rounded-md text-[10.5px] font-sans font-medium text-slate-400 hover:text-rose-300 hover:bg-rose-500/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400/70"
                >
                  Clear All
                </button>
              )}
              {count > 0 && confirmClearAll && (
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      clearAllSavedPins();
                      setConfirmClearAll(false);
                    }}
                    className="px-2 py-1 rounded-md text-[10.5px] font-sans font-semibold text-rose-200 bg-rose-500/20 border border-rose-400/40 hover:bg-rose-500/30 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400/70"
                  >
                    Confirm
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmClearAll(false)}
                    className="px-2 py-1 rounded-md text-[10.5px] font-sans font-medium text-slate-400 hover:text-white hover:bg-white/[0.06] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70"
                  >
                    Cancel
                  </button>
                </div>
              )}
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                title="Close panel [Esc]"
                aria-label="Close saved pins panel"
                className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-white/[0.08] transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {count >= 4 && (
            <div className="p-2 border-b border-white/[0.06] bg-[#050507]">
              <div className="relative flex items-center">
                <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filter saved locations..."
                  aria-label="Filter saved locations"
                  className="w-full h-7 pl-8 pr-3 bg-white/[0.04] border border-white/[0.08] focus:border-amber-400/50 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70 transition-colors"
                />
              </div>
            </div>
          )}

          <div className="max-h-80 overflow-y-auto custom-scrollbar p-2 space-y-1.5">
            {count === 0 ? (
              <div className="py-8 px-4 text-center space-y-2">
                <div className="w-10 h-10 rounded-full bg-white/[0.04] border border-white/[0.08] mx-auto flex items-center justify-center text-slate-500">
                  <Bookmark className="w-5 h-5" />
                </div>
                <div className="text-xs font-semibold text-slate-300">
                  No saved pins yet
                </div>
                <p className="text-[11px] text-slate-400 max-w-xs mx-auto leading-relaxed">
                  Open any crater, lander, or custom waypoint, then click{' '}
                  <span className="text-amber-300 font-medium">"Save Pin"</span>{' '}
                  in the feature panel to bookmark it here.
                </p>
              </div>
            ) : filteredPins.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-400">
                No pins match "{searchQuery}"
              </div>
            ) : (
              filteredPins.map((pin) => {
                const isSelected = activePinId === pin.id || activePinId === pin._key;
                const isMoon = pin.body !== 'earth';
                const latStr = `${Math.abs(pin.latitude).toFixed(3)}°${pin.latitude >= 0 ? 'N' : 'S'}`;
                const lonStr = `${Math.abs(pin.longitude).toFixed(3)}°${pin.longitude >= 0 ? 'E' : 'W'}`;

                return (
                  <div
                    key={pin.id || pin._key}
                    className={`group p-2 rounded-xl border transition-all flex items-center justify-between gap-2.5 ${
                      isSelected
                        ? 'bg-amber-500/10 border-amber-400/40 shadow-[0_0_15px_rgba(245,158,11,0.12)]'
                        : 'bg-[#0C0D12]/90 hover:bg-[#12141C] border-white/[0.06] hover:border-white/[0.14]'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        onSelectPin?.(pin);
                      }}
                      className="flex-1 min-w-0 text-left flex items-start gap-2.5 cursor-pointer rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70"
                      title={`Fly to ${pin.name}`}
                    >
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 border ${
                        pin.isCustomPin
                          ? 'bg-amber-500/15 border-amber-500/30 text-amber-400'
                          : isMoon
                          ? 'bg-cyan-500/15 border-cyan-500/30 text-cyan-300'
                          : 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
                      }`}>
                        {pin.isCustomPin ? (
                          <MapPin className="w-3.5 h-3.5" />
                        ) : isMoon ? (
                          <Moon className="w-3.5 h-3.5" />
                        ) : (
                          <Globe2 className="w-3.5 h-3.5" />
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-semibold text-white truncate group-hover:text-amber-200 transition-colors">
                            {pin.name}
                          </span>
                          <span className="text-[9px] font-mono text-slate-500 shrink-0 uppercase">
                            {pin.body || 'moon'}
                          </span>
                        </div>
                        <div className="text-[10.5px] font-mono text-slate-400 tabular-nums">
                          {latStr}, {lonStr}
                          {pin.elevationMeters != null && (
                            <span className="text-slate-500 ml-1">
                              · {pin.elevationMeters > 0 ? '+' : ''}{Math.round(pin.elevationMeters)}m
                            </span>
                          )}
                        </div>
                      </div>
                    </button>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => onSelectPin?.(pin, '3d')}
                        aria-label={`Open ${pin.name} in 3D view`}
                        title="Display and fly to this pin on 3D globe"
                        className="px-1.5 py-1 rounded-lg bg-white/[0.04] hover:bg-amber-400/20 text-slate-400 hover:text-amber-300 border border-white/[0.06] hover:border-amber-400/30 text-[10px] font-mono font-bold transition-colors flex items-center gap-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70"
                      >
                        <Globe2 className="w-3 h-3 text-amber-400/80" />
                        <span>3D</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => onSelectPin?.(pin)}
                        aria-label={`Fly camera to ${pin.name}`}
                        title="Fly camera to this pin"
                        className="p-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.10] text-slate-400 hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70"
                      >
                        <Navigation className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeSavedPin(pin.id || pin._key);
                        }}
                        aria-label={`Remove saved pin ${pin.name}`}
                        title="Remove pin"
                        className="p-1.5 rounded-lg bg-white/[0.04] hover:bg-rose-500/20 text-slate-400 hover:text-rose-300 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400/70"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
