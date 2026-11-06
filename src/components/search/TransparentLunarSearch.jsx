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

// Common aliases mapping for natural language search
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

export default function TransparentLunarSearch({
  onSelectFeature,
  activePlanet = 'moon',
  className = '',
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [coordError, setCoordError] = useState('');

  const containerRef = useRef(null);
  const inputRef = useRef(null);

  // Focus input when expanded
  useEffect(() => {
    if (isExpanded) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isExpanded]);

  // Click outside to collapse search bar into search icon
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsExpanded(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
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
      // 1. Coordinates Search (e.g. "89.9° N, 45.0° E", "-80.13, 1.44", "18.56N, 61.81E")
      const parsedCoord = parseLunarCoordinates(trimmed);

      // Check for coordinate format attempt with out-of-bound errors
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
            setCoordError('Lat must be between -90° and +90°.');
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

      // 2. Expand Query with Aliases
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

      // Sort by match relevance score
      scored.sort((a, b) => b.score - a.score);
      const topMatches = scored.map((s) => s.item).slice(0, 8);

      setResults([...matchResults, ...topMatches]);
      setActiveIndex(-1);
    }, 80);

    return () => clearTimeout(handler);
  }, [query, activePlanet]);

  // When user selects a result: notify map and shrink back to icon immediately!
  const handleSelect = (feature) => {
    setIsExpanded(false);
    onSelectFeature({ ...feature, body: activePlanet });
  };

  const handleKeyDown = (e) => {
    if (results.length === 0) {
      if (e.key === 'Escape') {
        setIsExpanded(false);
      }
      return;
    }

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
    } else if (e.key === 'Escape') {
      setIsExpanded(false);
      inputRef.current?.blur();
    }
  };

  const getTypeIcon = (item) => {
    if (item.type === 'coordinate') return <MapPin className="w-3.5 h-3.5 text-[#F8FAFC]" />;
    if (item.isClps || item.type === 'clps-mission' || item.category === 'Landing Site')
      return <Rocket className="w-3.5 h-3.5 text-[#F8FAFC]" />;
    if (item.type === 'mountain') return <Mountain className="w-3.5 h-3.5 text-[#88B38A]" />;
    if (item.type === 'mare') return <Compass className="w-3.5 h-3.5 text-[#88B38A]" />;
    return <CircleDot className="w-3.5 h-3.5 text-[#F8FAFC]" />;
  };

  return (
    <div
      ref={containerRef}
      id="transparent-lunar-search"
      data-guide="search"
      className={`z-40 pointer-events-auto select-none transition-all duration-300 ${
        className || 'fixed top-3 left-[206px] sm:top-4 sm:left-[220px]'
      }`}
    >
      {!isExpanded ? (
        /* Collapsed Icon Only - Left Side */
        <button
          type="button"
          onClick={() => setIsExpanded(true)}
          className="w-9 h-9 rounded-full bg-[#050507]/85 hover:bg-[#0C0D12] border border-white/15 hover:border-white/30 text-[#F8FAFC] flex items-center justify-center shadow-2xl backdrop-blur-md transition-all active:scale-90"
          title="Search lunar places, craters, maria, missions & coordinates"
          aria-label="Search lunar features"
        >
          <Search className="w-4 h-4" />
        </button>
      ) : (
        /* Expanded Compact Translucent Search Bar */
        <div className="w-64 sm:w-72 bg-[#050507]/95 backdrop-blur-2xl border border-white/15 rounded-2xl shadow-2xl p-2 flex flex-col gap-1.5 transition-all animate-in fade-in zoom-in-95 duration-150">
          <div className="relative flex items-center">
            <Search className="w-3.5 h-3.5 absolute left-2.5 text-[#F8FAFC] pointer-events-none" />

            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Search place, mission, coordinates..."
              className="w-full h-8 pl-8 pr-6 bg-[#0C0D12]/90 border border-[#1E2028] focus:border-white/40 rounded-xl text-xs text-[#F8FAFC] placeholder-[#A8A193]/60 focus:outline-none transition-all font-sans"
            />

            <div className="absolute right-2 flex items-center">
              <button
                type="button"
                onClick={() => setIsExpanded(false)}
                className="p-1 text-[#8E95A5] hover:text-white rounded hover:bg-white/10"
                aria-label="Close search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Coordinate Error Hint */}
          {coordError && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-rose-950/60 border border-rose-500/30 text-rose-300 text-[10px] font-mono">
              <AlertCircle className="w-3 h-3 shrink-0" />
              <span>{coordError}</span>
            </div>
          )}

          {/* Autocomplete Results Dropdown */}
          {results.length > 0 ? (
            <div className="mt-0.5 border-t border-[#1E2028] pt-1.5 max-h-64 overflow-y-auto custom-scrollbar space-y-1">
              {results.map((item, idx) => {
                const isFocused = idx === activeIndex;

                return (
                  <div
                    key={item.id || idx}
                    onClick={() => handleSelect(item)}
                    className={`px-2.5 py-1.5 rounded-lg cursor-pointer flex items-center justify-between gap-2 transition-all ${
                      isFocused
                        ? 'bg-white/[0.08] border border-white/25 text-[#F8FAFC]'
                        : 'bg-[#0C0D12]/60 hover:bg-[#14161D] border border-transparent text-[#8E95A5]'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="p-1 rounded bg-[#14161D] text-[#F8FAFC] shrink-0">
                        {getTypeIcon(item)}
                      </div>

                      <div className="flex flex-col min-w-0">
                        <span className="text-[11px] font-semibold text-[#F8FAFC] truncate">
                          {item.name}
                        </span>
                        <span className="text-[9.5px] font-mono text-[#8E95A5] truncate">
                          {item.category || item.provider || 'Lunar Location'}
                        </span>
                      </div>
                    </div>

                    <Navigation className="w-3 h-3 text-[#8E95A5] shrink-0" />
                  </div>
                );
              })}
            </div>
          ) : (
            query.trim() && (
              <div className="p-2 text-center text-[11px] font-mono text-[#8E95A5]">
                No matching lunar feature or coordinates found.
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
}
