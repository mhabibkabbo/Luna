import React, { useState, useEffect, useRef } from 'react';
import {
  Search,
  X,
  MapPin,
  Rocket,
  Mountain,
  Compass,
  CircleDot,
  Navigation,
  AlertCircle,
} from 'lucide-react';
import { parseLunarCoordinates, formatLunarCoordinates, getLunarRegionInfo } from '../../utils/coordinates.js';
import { CLPS_MISSIONS } from '../../data/clpsMissions.js';
import { LUNAR_FEATURES } from '../../data/lunarFeatures.js';
import { LANDING_SITES } from '../../data/landingSites.js';
import { EARTH_COMMUNICATION_SITES } from '../../data/earthCommunicationSites.js';

// Deduplicate and combine all lunar features, landing sites, and CLPS missions
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
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [coordError, setCoordError] = useState('');

  const containerRef = useRef(null);
  const inputRef = useRef(null);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Global keyboard shortcut to open search (Ctrl+K or /)
  useEffect(() => {
    const handleGlobalKey = (e) => {
      const tag = e.target?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select' || e.target?.isContentEditable) {
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen(true);
      } else if (e.key === '/' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        setIsOpen(true);
      }
    };
    window.addEventListener('keydown', handleGlobalKey);
    return () => window.removeEventListener('keydown', handleGlobalKey);
  }, []);

  // Debounced multi-method search processor
  useEffect(() => {
    setResults([]);
    setCoordError('');
    const trimmed = query.trim().toLowerCase();

    if (!trimmed) {
      setResults([]);
      return;
    }

    const handler = setTimeout(() => {
      const parsedCoord = parseLunarCoordinates(trimmed);

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
            setCoordError('Latitude must be between -90° and +90°.');
          }
        }
      }

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

      setResults([...matchResults, ...topMatches]);
      setActiveIndex(-1);
    }, 80);

    return () => clearTimeout(handler);
  }, [query, activePlanet]);

  const handleSelect = (feature) => {
    setIsOpen(false);
    setQuery('');
    onSelectFeature({ ...feature, body: activePlanet });
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      setIsOpen(false);
      return;
    }

    if (results.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((prev) => (prev < results.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
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
    if (item.type === 'coordinate') return <MapPin className="w-3.5 h-3.5 text-[#00D2C4]" />;
    if (item.isClps || item.type === 'clps-mission' || item.category === 'Landing Site')
      return <Rocket className="w-3.5 h-3.5 text-[#34D399]" />;
    if (item.type === 'mountain') return <Mountain className="w-3.5 h-3.5 text-[#A78BFA]" />;
    if (item.type === 'mare') return <Compass className="w-3.5 h-3.5 text-[#38BDF8]" />;
    return <CircleDot className="w-3.5 h-3.5 text-[#00D2C4]" />;
  };

  return (
    <div
      ref={containerRef}
      id="navbar-lunar-search"
      data-guide="search"
      className={`relative select-none ${className}`}
    >
      {/* Resting / Trigger State: Integrated directly beside dropdown */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-label="Search lunar locations, missions, and coordinates"
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        className="h-8 px-2.5 sm:px-3 rounded-xl bg-[#080E18] hover:bg-[#0E1726] border border-[#16283C] hover:border-[#00D2C4]/50 text-slate-300 hover:text-white flex items-center gap-2 text-xs transition-all shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00D2C4]"
      >
        <Search className="w-3.5 h-3.5 text-[#00D2C4] shrink-0" />
        <span className="hidden md:inline text-[11px] font-mono text-slate-400">
          Search lunar targets...
        </span>
        <kbd className="hidden lg:inline-flex items-center px-1.5 py-0.2 rounded bg-[#0D1726] border border-[#16283C] text-[9.5px] font-mono text-[#00D2C4]">
          /
        </kbd>
      </button>

      {/* Expanded Search Dialog Popover */}
      {isOpen && (
        <div
          role="dialog"
          aria-label="Lunar Search"
          className="absolute left-0 top-full mt-2 w-72 sm:w-80 md:w-96 bg-[#080E18]/95 backdrop-blur-2xl border border-[#16283C] rounded-2xl shadow-[0_12px_40px_rgba(0,0,0,0.85)] p-2.5 z-50 animate-in fade-in zoom-in-95 duration-150 flex flex-col gap-2"
        >
          <div className="relative flex items-center">
            <Search className="w-3.5 h-3.5 absolute left-3 text-[#00D2C4] pointer-events-none" />

            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Search craters, maria, missions, or coordinates (e.g. 89.9°S, 0°E)..."
              aria-label="Search query"
              className="w-full h-8.5 pl-9 pr-7 bg-[#0A1220] border border-[#16283C] focus:border-[#00D2C4] rounded-xl text-xs text-[#F1F5F9] placeholder-slate-500 focus:outline-none transition-all font-sans"
            />

            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="absolute right-2 p-1 text-slate-400 hover:text-white rounded"
                aria-label="Clear search input"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {coordError && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-rose-950/60 border border-rose-500/30 text-rose-300 text-[10px] font-mono">
              <AlertCircle className="w-3 h-3 shrink-0" />
              <span>{coordError}</span>
            </div>
          )}

          {results.length > 0 ? (
            <div className="border-t border-[#16283C]/80 pt-1.5 max-h-64 overflow-y-auto custom-scrollbar space-y-1">
              {results.map((item, idx) => {
                const isFocused = idx === activeIndex;

                return (
                  <div
                    key={item.id || idx}
                    onClick={() => handleSelect(item)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSelect(item);
                    }}
                    className={`px-2.5 py-1.5 rounded-xl cursor-pointer flex items-center justify-between gap-2 transition-all ${
                      isFocused
                        ? 'bg-[#00D2C4]/15 border border-[#00D2C4]/50 text-white'
                        : 'bg-[#0A1220]/70 hover:bg-[#0E1A2C] border border-transparent text-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="p-1 rounded-lg bg-[#060B13] border border-[#16283C] text-[#00D2C4] shrink-0">
                        {getTypeIcon(item)}
                      </div>

                      <div className="flex flex-col min-w-0">
                        <span className="text-xs font-semibold text-white truncate">
                          {item.name}
                        </span>
                        <span className="text-[10px] font-mono text-slate-400 truncate">
                          {item.category || item.provider || 'Lunar Target'}
                        </span>
                      </div>
                    </div>

                    <Navigation className="w-3 h-3 text-[#00D2C4] shrink-0 opacity-70" />
                  </div>
                );
              })}
            </div>
          ) : query.trim() ? (
            <div className="p-3 text-center text-[11px] font-mono text-slate-400">
              No matching lunar target or coordinates found.
            </div>
          ) : (
            <div className="px-2 py-1 text-[10.5px] font-mono text-slate-400 flex items-center justify-between">
              <span>Quick: Shackleton, Mare Crisium, IM-1...</span>
              <kbd className="px-1.5 py-0.2 rounded bg-[#0A1220] border border-[#16283C] text-[9.5px] text-[#00D2C4]">
                ESC to close
              </kbd>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

