import React, { useState, useEffect, useRef, useId, useCallback } from 'react';
import {
  Search,
  X,
  MapPin,
  Rocket,
  Mountain,
  Compass,
  CircleDot,
  AlertCircle,
} from 'lucide-react';
import { useDialogA11y } from '../../hooks/useDialogA11y.js';
import { parseLunarCoordinates, formatLunarCoordinates, getLunarRegionInfo } from '../../utils/coordinates.js';
import { CLPS_MISSIONS } from '../../data/clpsMissions.js';
import { LUNAR_FEATURES } from '../../data/lunarFeatures.js';
import { LANDING_SITES } from '../../data/landingSites.js';
import { EARTH_COMMUNICATION_SITES } from '../../data/earthCommunicationSites.js';

const rawLunarCatalog = [...LUNAR_FEATURES, ...LANDING_SITES, ...CLPS_MISSIONS];
const seenIds = new Set();
const COMBINED_LUNAR_CATALOG = [];

for (const item of rawLunarCatalog) {
  if (!item || !item.id) continue;
  if (seenIds.has(item.id)) continue;
  seenIds.add(item.id);

  let category = 'Surface Feature';
  if (item.isClps || item.type === 'clps-mission') category = 'CLPS Mission';
  else if (item.type === 'landing-site' || item.type === 'mission-site') category = 'Landing Site';
  else if (item.type === 'crater') category = 'Impact Crater';
  else if (item.type === 'mare') category = 'Basaltic Mare';
  else if (item.type === 'mountain') category = 'Lunar Mountain';
  else if (item.type === 'valley' || item.type === 'rille') category = 'Valley / Rille';

  COMBINED_LUNAR_CATALOG.push({
    ...item,
    category,
  });
}

const ALIAS_MAP = {
  tranquility: 'mare tranquillitatis',
  'sea of tranquility': 'mare tranquillitatis',
  showers: 'mare imbrium',
  'sea of showers': 'mare imbrium',
  serenity: 'mare serenitatis',
  'sea of serenity': 'mare serenitatis',
  storms: 'oceanus procellarum',
  'ocean of storms': 'oceanus procellarum',
  crises: 'mare crisium',
  'sea of crises': 'mare crisium',
  cold: 'mare frigoris',
  'sea of cold': 'mare frigoris',
  fertility: 'mare fecunditatis',
  'sea of fertility': 'mare fecunditatis',
  nectar: 'mare nectaris',
  'sea of nectar': 'mare nectaris',
  clouds: 'mare nubium',
  'sea of clouds': 'mare nubium',
  moisture: 'mare humorum',
  'sea of moisture': 'mare humorum',
  'south pole': 'shackleton',
  'north pole': 'plato',
};

export default function NavbarSearch({
  onSelectFeature,
  activePlanet = 'moon',
  className = '',
}) {
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [coordError, setCoordError] = useState('');

  const containerRef = useRef(null);
  const panelRef = useRef(null);
  const inputRef = useRef(null);
  const optionRefs = useRef([]);
  const listboxId = useId();
  const handleCloseSearch = useCallback(() => {
    setIsSearchOpen(false);
    setIsOpen(false);
  }, []);

  useDialogA11y({
    isOpen: isSearchOpen,
    onClose: handleCloseSearch,
    containerRef: panelRef,
  });

  useEffect(() => {
    if (isSearchOpen) {
      const timer = setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 50);
      return () => clearTimeout(timer);
    } else {
      setQuery('');
      setResults([]);
      setCoordError('');
      setActiveIndex(-1);
      setIsOpen(false);
    }
  }, [isSearchOpen]);

  useEffect(() => {
    if (activeIndex >= 0 && optionRefs.current[activeIndex]) {
      optionRefs.current[activeIndex].scrollIntoView({ block: 'nearest' });
    }
  }, [activeIndex]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (
        isSearchOpen &&
        containerRef.current &&
        !containerRef.current.contains(e.target) &&
        panelRef.current &&
        !panelRef.current.contains(e.target)
      ) {
        setIsSearchOpen(false);
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isSearchOpen]);

  useEffect(() => {
    const handleGlobalKey = (e) => {
      const tag = e.target?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select' || e.target?.isContentEditable) {
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsSearchOpen(true);
      } else if (e.key === '/' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        setIsSearchOpen(true);
      }
    };
    window.addEventListener('keydown', handleGlobalKey);
    return () => window.removeEventListener('keydown', handleGlobalKey);
  }, []);

  useEffect(() => {
    setResults([]);
    setCoordError('');
    const trimmed = query.trim().toLowerCase();

    if (!trimmed) {
      setResults([]);
      setIsOpen(false);
      return;
    }

    const handler = setTimeout(() => {
      const parsedCoord = parseLunarCoordinates(trimmed);
      let nextCoordError = '';

      if (
        /\d+/.test(trimmed) &&
        (trimmed.includes('n') ||
          trimmed.includes('s') ||
          trimmed.includes('e') ||
          trimmed.includes('w') ||
          trimmed.includes(','))
      ) {
        const numbers = trimmed.match(/[-+]?\d*\.?\d+/g);
        if (numbers && numbers.length >= 1) {
          const latCandidate = Math.abs(parseFloat(numbers[0]));
          if (latCandidate > 90) {
            nextCoordError = 'Latitude must be between -90° and +90°.';
          }
        }
      }
      setCoordError(nextCoordError);

      const matchResults = [];

      if (parsedCoord) {
        const [lon, lat] = parsedCoord;
        const region = getLunarRegionInfo(lon, lat);
        const formatted = formatLunarCoordinates(lon, lat, 2);

        matchResults.push({
          id: `coord-${lon.toFixed(2)}-${lat.toFixed(2)}`,
          name: `${formatted.latStr}, ${formatted.lonStr}`,
          type: 'coordinate',
          category: 'Coordinates',
          latitude: lat,
          longitude: lon,
          body: activePlanet,
          description: `Target location in ${region.regionDescription}.`,
          source: 'Calculated Coordinates',
        });
      }

      const expandedQuery = ALIAS_MAP[trimmed] || trimmed;
      const searchCatalog =
        activePlanet === 'earth' ? EARTH_COMMUNICATION_SITES : COMBINED_LUNAR_CATALOG;

      const scored = [];

      for (const item of searchCatalog) {
        const nameLower = (item.name || '').toLowerCase();
        const siteLower = (item.landingSiteName || '').toLowerCase();
        const provLower = (item.provider || item.agency || '').toLowerCase();
        const descLower = (item.description || '').toLowerCase();
        const taskLower = (item.taskOrder || '').toLowerCase();

        let score = 0;

        if (nameLower === trimmed || nameLower === expandedQuery) score += 100;
        else if (nameLower.startsWith(trimmed) || nameLower.startsWith(expandedQuery)) score += 80;
        else if (nameLower.includes(trimmed) || nameLower.includes(expandedQuery)) score += 60;

        if (siteLower.includes(trimmed) || siteLower.includes(expandedQuery)) score += 40;
        if (provLower.includes(trimmed) || provLower.includes(expandedQuery)) score += 30;
        if (taskLower.includes(trimmed)) score += 30;
        if (descLower.includes(trimmed) || descLower.includes(expandedQuery)) score += 20;

        if (score > 0) {
          scored.push({ item, score });
        }
      }

      scored.sort((a, b) => b.score - a.score);
      const topMatches = scored.map((s) => s.item).slice(0, 8);

      const allMatches = [...matchResults, ...topMatches];
      setResults(allMatches);
      setActiveIndex(-1);
      setIsOpen(true);
    }, 80);

    return () => clearTimeout(handler);
  }, [query, activePlanet]);

  const handleSelect = (feature) => {
    setIsSearchOpen(false);
    setIsOpen(false);
    setQuery('');
    setResults([]);
    onSelectFeature({ ...feature, body: activePlanet });
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      setIsSearchOpen(false);
      setIsOpen(false);
      return;
    }

    if (results.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setIsOpen(true);
      setActiveIndex((prev) => (prev < results.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setIsOpen(true);
      setActiveIndex((prev) => (prev > 0 ? prev - 1 : results.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (activeIndex >= 0 && activeIndex < results.length) {
        handleSelect(results[activeIndex]);
      } else if (results.length > 0) {
        handleSelect(results[0]);
      }
    }
  };

  const getTypeIcon = (item) => {
    if (item.type === 'coordinate') return <MapPin className="w-3.5 h-3.5 text-white/80" />;
    if (item.isClps || item.type === 'clps-mission' || item.category === 'Landing Site')
      return <Rocket className="w-3.5 h-3.5 text-[#CBD5E1]" />;
    if (item.type === 'mountain') return <Mountain className="w-3.5 h-3.5 text-[#94A3B8]" />;
    if (item.type === 'mare') return <Compass className="w-3.5 h-3.5 text-[#CBD5E1]" />;
    return <CircleDot className="w-3.5 h-3.5 text-white/80" />;
  };

  return (
    <div
      ref={containerRef}
      id="navbar-lunar-search"
      data-guide="search"
      className={`relative select-none ${className}`}
    >
      <button
        type="button"
        onClick={() => setIsSearchOpen((prev) => !prev)}
        aria-label={isSearchOpen ? 'Close search' : 'Search craters, maria, missions, or coordinates (/ or Ctrl+K)'}
        aria-expanded={isSearchOpen}
        title="Search craters, maria, missions, or coordinates (/ or Ctrl+K)"
        className={`group h-8 w-8 rounded-lg flex items-center justify-center transition-all focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/50 shrink-0 active:scale-95 ${
          isSearchOpen
            ? 'bg-white text-[#050507] shadow-sm'
            : 'bg-[#0C0D12] hover:bg-[#14161D] text-[#8E95A5] hover:text-white border border-white/[0.08] hover:border-white/[0.22]'
        }`}
      >
        <Search
          className={`w-3.5 h-3.5 transition-transform duration-200 ${
            isSearchOpen ? 'text-[#050507] scale-105 rotate-90' : 'text-[#8E95A5] group-hover:scale-110'
          }`}
        />
      </button>

      {isSearchOpen && (
        <div
          ref={panelRef}
          tabIndex={-1}
          role="dialog"
          aria-label="Lunar Search"
          className="fixed left-1/2 top-[3.25rem] z-50 w-[calc(100vw-32px)] max-w-[min(440px,calc(100vw-2rem))] -translate-x-1/2 sm:absolute sm:left-0 sm:top-full sm:mt-2 sm:w-[min(440px,calc(100vw-2rem))] sm:translate-x-0 focus:outline-none"
        >
          <div className="relative flex flex-col gap-2 rounded-2xl border border-white/[0.12] bg-[#0A0B0E]/95 p-2.5 shadow-[0_24px_60px_rgba(0,0,0,0.85)] backdrop-blur-2xl animate-search-emerge">
            <div className="absolute -top-1.5 left-[calc(50%-6px)] w-3 h-3 bg-[#0A0B0E] border-t border-l border-white/[0.12] animate-caret-fade pointer-events-none sm:left-2.5" />

            <div className="relative flex items-center animate-search-field">
            <Search className="w-3.5 h-3.5 absolute left-3 text-[#8E95A5] pointer-events-none" />

            <input
              ref={inputRef}
              type="text"
              role="combobox"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                if (!isOpen) setIsOpen(true);
              }}
              onFocus={() => {
                if (query.trim() && (results.length > 0 || coordError)) {
                  setIsOpen(true);
                }
              }}
              onKeyDown={handleKeyDown}
              placeholder="Search craters, maria, missions, or coords..."
              aria-label="Search lunar locations, missions, and coordinates"
              aria-autocomplete="list"
              aria-controls={listboxId}
              aria-activedescendant={
                activeIndex >= 0 ? `${listboxId}-opt-${activeIndex}` : undefined
              }
              aria-expanded={isOpen && (results.length > 0 || !!coordError || !!query.trim())}
              className="h-9 w-full pl-9 pr-20 bg-[#11131A] hover:bg-[#141722] focus:bg-[#141722] border border-white/[0.1] focus:border-white/[0.25] rounded-xl text-xs sm:text-[13px] text-white placeholder-[#8E95A5] focus:outline-none transition-all font-sans"
            />

            <div className="absolute right-2 flex items-center gap-1.5">
              {query ? (
                <button
                  type="button"
                  onClick={() => {
                    setQuery('');
                    setResults([]);
                    setCoordError('');
                    setIsOpen(false);
                    inputRef.current?.focus();
                  }}
                  className="px-1.5 py-0.5 text-[10px] font-mono text-[#8E95A5] hover:text-white rounded hover:bg-white/[0.08] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/60 transition-colors"
                  aria-label="Clear search input"
                >
                  Clear
                </button>
              ) : (
                <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 rounded bg-[#050507] border border-white/[0.1] text-[9.5px] font-mono text-[#8E95A5]">
                  ESC
                </kbd>
              )}
              <button
                type="button"
                onClick={handleCloseSearch}
                className="p-1 rounded text-[#8E95A5] hover:text-white hover:bg-white/[0.08] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/60 transition-colors"
                aria-label="Close search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
              </div>
          </div>

          {coordError && (
            <div role="alert" className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-950/60 border border-rose-500/30 text-rose-300 text-xs font-mono">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>{coordError}</span>
            </div>
          )}

          {isOpen && results.length > 0 && (
            <div
              id={listboxId}
              role="listbox"
              aria-label="Search suggestions"
              className="w-full bg-[#050507]/90 border border-white/[0.08] rounded-xl p-1.5 flex flex-col gap-1 max-h-72 overflow-y-auto custom-scrollbar"
            >
                {results.map((item, idx) => {
                  const isFocused = idx === activeIndex;

                  return (
                    <div
                      key={item.id || idx}
                      id={`${listboxId}-opt-${idx}`}
                      ref={(el) => {
                        optionRefs.current[idx] = el;
                      }}
                      role="option"
                      aria-selected={isFocused}
                      onClick={() => handleSelect(item)}
                      className={`p-2 rounded-lg cursor-pointer transition-colors flex items-start gap-2.5 ${
                        isFocused
                          ? 'bg-white/[0.08] border border-white/[0.16] text-white'
                          : 'hover:bg-white/[0.04] border border-transparent text-[#CBD5E1]'
                      }`}
                    >
                      <div className="mt-0.5 p-1 rounded-md bg-[#050507] border border-white/[0.08] shrink-0">
                        {getTypeIcon(item)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-xs font-medium text-white truncate font-sans">
                            {item.name}
                          </span>
                          <span className="text-[9.5px] font-mono text-[#8E95A5] shrink-0 uppercase">
                            {item.category || item.type}
                          </span>
                        </div>
                        {item.description && (
                          <p className="text-[10px] text-[#8E95A5] truncate mt-0.5 font-sans">
                            {item.description}
                          </p>
                        )}
                        {Number.isFinite(item.latitude) && Number.isFinite(item.longitude) && (
                          <span className="text-[9px] font-mono text-[#64748B] block mt-0.5">
                            {item.latitude.toFixed(2)}°, {item.longitude.toFixed(2)}°
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {isOpen && query.trim() && results.length === 0 && !coordError && (
              <div className="w-full px-3 py-3 rounded-xl bg-[#050507]/85 border border-white/[0.08] text-center text-xs text-[#8E95A5] font-sans">
                No matching lunar locations, missions, or coordinates found for &ldquo;{query.trim()}&rdquo;.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
