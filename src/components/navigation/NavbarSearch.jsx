import React, { useState, useEffect, useRef } from 'react';
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

  // Click outside to close results dropdown
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Global keyboard shortcut to focus search input (Ctrl+K or /)
  useEffect(() => {
    const handleGlobalKey = (e) => {
      const tag = e.target?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select' || e.target?.isContentEditable) {
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      } else if (e.key === '/' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
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
      setIsOpen(false);
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

      const allMatches = [...matchResults, ...topMatches];
      setResults(allMatches);
      setActiveIndex(-1);
      if (allMatches.length > 0 || coordError) {
        setIsOpen(true);
      }
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
      inputRef.current?.blur();
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
      {/* Direct Interactive Search Input Field in the Navbar */}
      <div className="relative flex items-center">
        <Search className="w-3.5 h-3.5 absolute left-2.5 text-[#8E95A5] pointer-events-none" />

        <input
          ref={inputRef}
          type="text"
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
          placeholder="Search craters, maria, missions..."
          aria-label="Search lunar locations, missions, and coordinates"
          aria-autocomplete="list"
          aria-expanded={isOpen && (results.length > 0 || !!coordError)}
          className="h-8 w-36 sm:w-52 md:w-64 lg:w-72 pl-8 pr-7 bg-[#0C0D12] hover:bg-[#11131A] focus:bg-[#11131A] border border-white/[0.08] hover:border-white/[0.16] focus:border-white/[0.3] rounded-lg text-xs text-white placeholder-[#8E95A5] focus:outline-none transition-all font-sans"
        />

        {query ? (
          <button
            type="button"
            onClick={() => {
              setQuery('');
              setIsOpen(false);
              inputRef.current?.focus();
            }}
            className="absolute right-2 p-0.5 text-[#8E95A5] hover:text-white rounded"
            aria-label="Clear search input"
          >
            <X className="w-3 h-3" />
          </button>
        ) : (
          <kbd className="hidden lg:inline-flex items-center absolute right-2 px-1.5 py-0.5 rounded bg-[#050507] border border-white/[0.08] text-[9.5px] font-mono text-[#8E95A5] pointer-events-none">
            /
          </kbd>
        )}
      </div>

      {/* Autocomplete Suggestions Popover */}
      {isOpen && (results.length > 0 || coordError) && (
        <div
          role="listbox"
          aria-label="Search suggestions"
          className="absolute left-0 top-full mt-1.5 w-72 sm:w-80 md:w-96 bg-[#0A0B0E]/95 backdrop-blur-2xl border border-white/[0.1] rounded-xl shadow-[0_16px_48px_rgba(0,0,0,0.85)] p-2 z-50 animate-in fade-in zoom-in-95 duration-150 flex flex-col gap-1 max-h-80 overflow-y-auto custom-scrollbar"
        >
          {coordError && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-rose-950/60 border border-rose-500/30 text-rose-300 text-[10px] font-mono">
              <AlertCircle className="w-3 h-3 shrink-0" />
              <span>{coordError}</span>
            </div>
          )}

          {results.map((item, idx) => {
            const isFocused = idx === activeIndex;

            return (
              <div
                key={item.id || idx}
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
    </div>
  );
}
