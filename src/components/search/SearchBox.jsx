import React, { useState, useEffect, useRef } from 'react';
import { Search, X, Loader2 } from 'lucide-react';
import SearchResults from './SearchResults.jsx';
import { LUNAR_FEATURES } from '../../data/lunarFeatures.js';
import { LANDING_SITES } from '../../data/landingSites.js';
import { parseLunarCoordinates } from '../../utils/coordinates.js';

// Searchable catalog including craters, mountains, maria, valleys/rilles, and landing sites
const COMBINED_SEARCH_DATA = [...LUNAR_FEATURES, ...LANDING_SITES];

/**
 * Google Maps-style debounced lunar feature search box.
 * 
 * @param {{
 *   onSelectFeature: (feature: import('../../types/lunar.js').LunarFeature) => void,
 *   onCoordinateSearch?: (coord: [number, number]) => void
 * }} props
 */
export default function SearchBox({ onSelectFeature, onCoordinateSearch }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [isSearching, setIsSearching] = useState(false);

  const containerRef = useRef(null);
  const inputRef = useRef(null);

  // Debounced search logic (150ms delay)
  useEffect(() => {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) {
      setResults([]);
      setIsOpen(false);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    const handler = setTimeout(() => {
      // Check if user entered direct selenographic coordinates (e.g., "43.3S, 11.4W")
      const parsedCoord = parseLunarCoordinates(trimmed);
      if (parsedCoord) {
        setResults([
          {
            id: `coord-${parsedCoord[0]}-${parsedCoord[1]}`,
            name: `Coordinate Location: ${parsedCoord[1].toFixed(2)}°, ${parsedCoord[0].toFixed(2)}°`,
            type: 'crater',
            latitude: parsedCoord[1],
            longitude: parsedCoord[0],
            description: 'Direct selenographic coordinate target',
            source: 'User Selenographic Query',
          },
        ]);
        setIsOpen(true);
        setIsSearching(false);
        return;
      }

      // Feature name / type matching
      const matches = COMBINED_SEARCH_DATA.filter((item) => {
        const nameMatch = item.name.toLowerCase().includes(trimmed);
        const typeMatch = item.type.toLowerCase().includes(trimmed);
        const agencyMatch = item.agency ? item.agency.toLowerCase().includes(trimmed) : false;
        const periodMatch = item.period ? item.period.toLowerCase().includes(trimmed) : false;
        return nameMatch || typeMatch || agencyMatch || periodMatch;
      }).slice(0, 8); // Top 8 results

      setResults(matches);
      setIsOpen(matches.length > 0);
      setActiveIndex(-1);
      setIsSearching(false);
    }, 150);

    return () => clearTimeout(handler);
  }, [query]);

  // Click outside listener to close dropdown
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleKeyDown = (e) => {
    if (!isOpen || results.length === 0) return;

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
      setIsOpen(false);
      inputRef.current?.blur();
    }
  };

  const handleSelect = (feature) => {
    setIsOpen(false);
    setQuery(feature.name);
    onSelectFeature(feature);
  };

  const handleClear = () => {
    setQuery('');
    setResults([]);
    setIsOpen(false);
    inputRef.current?.focus();
  };

  return (
    <div
      ref={containerRef}
      id="lunar-search-container"
      className="relative w-full max-w-sm sm:max-w-md pointer-events-auto select-none"
    >
      <div className="relative flex items-center">
        <div className="absolute left-3.5 flex items-center pointer-events-none text-slate-400">
          {isSearching ? (
            <Loader2 className="w-4 h-4 text-cyan-400 animate-spin" />
          ) : (
            <Search className="w-4 h-4 text-slate-400" />
          )}
        </div>

        <input
          ref={inputRef}
          id="lunar-search-input"
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => {
            if (results.length > 0) setIsOpen(true);
          }}
          onKeyDown={handleKeyDown}
          placeholder="Search the Moon (e.g., Tycho, Apollo 11, Mare Imbrium)..."
          aria-label="Search lunar features, maria, craters, or landing sites"
          autoComplete="off"
          spellCheck="false"
          className="w-full h-11 pl-10 pr-9 bg-slate-900/90 backdrop-blur-xl border border-slate-800 focus:border-cyan-500/80 rounded-xl text-xs sm:text-sm text-slate-100 placeholder-slate-500 shadow-xl focus:outline-none focus:ring-1 focus:ring-cyan-500/50 transition-all font-sans"
        />

        {query && (
          <button
            id="btn-clear-search"
            type="button"
            onClick={handleClear}
            className="absolute right-3 p-1 text-slate-400 hover:text-slate-200 rounded-md hover:bg-slate-800 transition-colors"
            aria-label="Clear search input"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {isOpen && (
        <SearchResults
          results={results}
          onSelect={handleSelect}
          activeIndex={activeIndex}
        />
      )}
    </div>
  );
}
