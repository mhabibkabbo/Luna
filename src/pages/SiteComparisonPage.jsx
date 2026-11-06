/**
 * @file SiteComparisonPage.jsx
 * Lunar Landing Site Comparison & Mission Decision Support System.
 *
 * Enables multi-site trade-off evaluation (2 to 8 predefined or custom lunar coordinates)
 * across 7-, 14-, and 28-day mission durations using verified NASA LRO LOLA polar DEM data,
 * topocentric ephemerides, analytical radiative thermal balance, and strict data-completeness guards.
 */

import React, { useState, useMemo, useEffect } from 'react';
import {
  GitCompare,
  FileDown,
  RotateCcw,
  MapPin,
  Plus,
  Trash2,
  Edit3,
  Check,
  X,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Info,
  ChevronDown,
  ChevronRight,
  SlidersHorizontal,
  Download,
  Compass,
  MoveLeft,
  MoveRight,
  AlertTriangle,
  CheckCircle2,
  Clock,
} from 'lucide-react';
import {
  COMPARISON_SITE_PALETTE,
  MISSION_DURATIONS,
  PREDEFINED_COMPARISON_SITES,
  COMPARISON_PARAMETER_DEFINITIONS,
  SUITABILITY_WEIGHTS,
  validateLunarCoordinates,
  formatSelenographicCoords,
  evaluateComparisonLocation,
  computeMultiSiteTradeOffAnalysis,
  getMatrixCellDisplay,
  NASA_DATASETS_REGISTRY,
  comparisonSelectionStore,
  MAX_COMPARISON_LOCATIONS,
  MIN_COMPARISON_LOCATIONS,
} from '../utils/comparisonEngine.js';
import { exportComparisonDossierPdf } from '../utils/comparisonPdfExport.js';
import { ensurePolarDemLoaded, subscribePolarDemReady } from '../utils/horizons.js';
import { celestialTimeStore, normalizeCelestialTimeMs } from '../utils/celestialTime.js';
import { notifySuccess, notifyInfo, notifyWarn } from '../utils/feedbackStore.js';

const EPOCH_PRESETS = [
  { label: 'Live UTC', getMs: () => normalizeCelestialTimeMs(Date.now()) },
  { label: 'Artemis III Window (Sep 2026)', getMs: () => new Date('2026-09-15T12:00:00Z').getTime() },
  { label: 'South Pole Summer (Dec Solstice)', getMs: () => new Date('2026-12-21T00:00:00Z').getTime() },
  { label: 'South Pole Winter (Jun Solstice)', getMs: () => new Date('2026-06-21T00:00:00Z').getTime() },
];

const PARAMETER_CATEGORIES = [
  'All',
  'Solar & Energy',
  'Communication & Visibility',
  'Terrain',
  'Thermal',
  'Suitability',
];

function resolveInitialLocation(candidate, fallbackIndex) {
  const defaultIds = [
    'landing-artemis3-malapert',
    'clps-im2-athena',
    'landing-apollo11',
    'landing-apollo14',
  ];
  const fallbackSite =
    PREDEFINED_COMPARISON_SITES.find((s) => s.id === defaultIds[fallbackIndex]) ||
    PREDEFINED_COMPARISON_SITES[fallbackIndex] ||
    PREDEFINED_COMPARISON_SITES[0];

  if (!candidate) return { ...fallbackSite };
  const matched = PREDEFINED_COMPARISON_SITES.find(
    (s) => s.id === candidate.id || s.id === candidate.landingSiteId
  );
  if (matched) return { ...matched };

  const lat = candidate.latitude ?? candidate.lat;
  const lon = candidate.longitude ?? candidate.lon;
  const check = validateLunarCoordinates(lat, lon);
  if (check.isValid) {
    return {
      id: candidate.id || `site-init-${fallbackIndex}-${Date.now()}`,
      name: candidate.name || candidate.missionName || `Candidate Site ${fallbackIndex + 1}`,
      latitude: check.lat,
      longitude: check.lon,
      elevationMeters: candidate.elevationMeters ?? candidate.elevationM ?? null,
      slopeDeg: candidate.slopeDeg ?? null,
      isCustom: Boolean(candidate.isCustom ?? candidate.isCustomPin),
      agency: candidate.agency || 'User-Defined',
      category: candidate.category || 'Selected Candidate',
    };
  }
  return { ...fallbackSite };
}

function toDatetimeLocalUtc(ms) {
  const d = new Date(ms);
  if (isNaN(d.getTime())) return '2026-11-06T00:00';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(
    d.getUTCHours()
  )}:${pad(d.getUTCMinutes())}`;
}

export default function SiteComparisonPage({
  siteA,
  siteB,
  onSelectSiteA,
  onSelectSiteB,
  onNavigate,
  onSelectSiteForView,
  onSelectFrom3DMap,
}) {
  // ── 1. Selected Locations State (2 to 8 locations via shared store) ────────
  const [selectedLocations, setSelectedLocationsState] = useState(
    () => comparisonSelectionStore.get().locations
  );

  useEffect(() => {
    return comparisonSelectionStore.subscribe((snap) => {
      setSelectedLocationsState(snap.locations);
    });
  }, []);

  // If siteA is passed and store has no locations, ensure siteA is added as the initial location
  useEffect(() => {
    if (siteA && comparisonSelectionStore.get().locations.length === 0) {
      comparisonSelectionStore.addLocationFromMap(siteA);
    }
  }, [siteA]);

  const setSelectedLocations = (nextOrUpdater) => {
    comparisonSelectionStore.setLocations(nextOrUpdater);
  };

  // ── 2. Mission Duration & Reference Epoch State ───────────────────────────
  const [durationDays, setDurationDays] = useState(14); // 7 | 14 | 28
  const [referenceEpochMs, setReferenceEpochMs] = useState(() =>
    normalizeCelestialTimeMs(celestialTimeStore.get().ms)
  );

  // ── 3. Polar DEM Readiness Subscription ───────────────────────────────────
  const [demReadyTick, setDemReadyTick] = useState(0);
  useEffect(() => {
    ensurePolarDemLoaded()
      .then((grid) => {
        if (grid) setDemReadyTick((t) => t + 1);
      })
      .catch(() => {});
    return subscribePolarDemReady(() => setDemReadyTick((t) => t + 1));
  }, []);

  // ── 4. Selection UI Controls (Manual Input, Inline Edit) ──────────────────
  const [isManualFormOpen, setIsManualFormOpen] = useState(false);
  const [manualName, setManualName] = useState('');
  const [manualLat, setManualLat] = useState('');
  const [manualLon, setManualLon] = useState('');
  const [manualError, setManualError] = useState(null);
  const [predefinedPickerId, setPredefinedPickerId] = useState('');

  // Inline location editing state
  const [editingLocationId, setEditingLocationId] = useState(null);
  const [editName, setEditName] = useState('');
  const [editLat, setEditLat] = useState('');
  const [editLon, setEditLon] = useState('');
  const [editError, setEditError] = useState(null);

  // ── 5. Matrix Controls State ──────────────────────────────────────────────
  const [matrixMode, setMatrixMode] = useState('standard'); // 'standard' | 'detailed'
  const [activeCategoryFilter, setActiveCategoryFilter] = useState('All');
  const [hiddenParamIds, setHiddenParamIds] = useState(() => new Set());
  const [isParamFilterOpen, setIsParamFilterOpen] = useState(false);
  const [highlightExtrema, setHighlightExtrema] = useState(true);
  const [sortConfig, setSortConfig] = useState({ paramId: null, direction: 'desc' });
  const [activeProvenanceParamId, setActiveProvenanceParamId] = useState(null);

  // ── 6. Expandable Detailed Sections State ─────────────────────────────────
  const [openSections, setOpenSections] = useState({
    solar: false,
    comm: false,
    terrain: false,
    thermal: false,
    suitability: false,
    methodology: false,
  });

  // ── 7. PDF Export Progress State ──────────────────────────────────────────
  const [isExportingPdf, setIsExportingPdf] = useState(false);

  // ── 8. Scientific Evaluation of All Selected Locations ────────────────────
  const evaluations = useMemo(() => {
    // demReadyTick dependency guarantees immediate refresh once binary LOLA DEM loads
    void demReadyTick;
    return selectedLocations.map((loc) =>
      evaluateComparisonLocation(loc, referenceEpochMs, durationDays)
    );
  }, [selectedLocations, referenceEpochMs, durationDays, demReadyTick]);

  // ── 9. Evidence-Based Multi-Site Trade-Off Analysis ───────────────────────
  const tradeOff = useMemo(() => {
    return computeMultiSiteTradeOffAnalysis(evaluations, durationDays);
  }, [evaluations, durationDays]);

  // ── Location Management Handlers ──────────────────────────────────────────
  const handleSelectLocationsFrom3DMap = () => {
    if (selectedLocations.length >= MAX_COMPARISON_LOCATIONS) {
      notifyWarn(
        'Cannot Add More Locations (8 / 8 Limit)',
        'You have already selected the maximum of 8 locations. Remove a location first to add a new one from the 3D map.'
      );
    } else {
      notifyInfo(
        'Select Locations on 3D Lunar Map',
        `Click any site or drop a pin on the 3D Moon globe, then click "Compare Site" in the side panel (${selectedLocations.length} / ${MAX_COMPARISON_LOCATIONS} selected).`
      );
    }
    comparisonSelectionStore.setMapSelectionMode(true);
    if (onSelectFrom3DMap) {
      onSelectFrom3DMap();
    } else if (onNavigate) {
      onNavigate('explorer');
    }
  };

  const handleAddLocation = (newLoc) => {
    if (selectedLocations.length >= MAX_COMPARISON_LOCATIONS) {
      notifyWarn('Comparison Capacity Reached', 'Maximum of 8 landing locations can be compared simultaneously.');
      return false;
    }
    const res = comparisonSelectionStore.addLocationFromMap(newLoc);
    if (!res.ok) {
      notifyWarn('Cannot Add Location', res.message);
      return false;
    }
    const next = comparisonSelectionStore.get().locations;
    if (next[0] && onSelectSiteA) onSelectSiteA(next[0]);
    if (next[1] && onSelectSiteB) onSelectSiteB(next[1]);
    notifyInfo(
      'Location Added',
      `${res.location.name} (${formatSelenographicCoords(res.location.latitude, res.location.longitude)}) added (${res.count} / ${res.max}).`
    );
    return true;
  };

  const handleAddPredefinedSite = (siteId) => {
    if (!siteId) return;
    if (selectedLocations.length >= MAX_COMPARISON_LOCATIONS) {
      notifyWarn('Maximum 8 Locations', 'Cannot select more than 8 locations. Remove a location before adding another.');
      return;
    }
    const found = PREDEFINED_COMPARISON_SITES.find((s) => s.id === siteId);
    if (found) {
      handleAddLocation(found);
      setPredefinedPickerId('');
    }
  };

  const handleManualSubmit = (e) => {
    e.preventDefault();
    if (selectedLocations.length >= 8) {
      setManualError('Maximum capacity (8 / 8 locations) reached.');
      return;
    }
    const check = validateLunarCoordinates(manualLat, manualLon);
    if (!check.isValid) {
      setManualError(check.error);
      return;
    }
    const label =
      manualName.trim() ||
      `Custom Site ${selectedLocations.length + 1} (${formatSelenographicCoords(check.lat, check.lon, 2)})`;

    handleAddLocation({
      id: `custom-${Date.now()}-${Math.round(check.lat * 100)}-${Math.round(check.lon * 100)}`,
      name: label,
      latitude: check.lat,
      longitude: check.lon,
      isCustom: true,
      agency: 'User-Defined',
      category: check.lat <= -80 ? 'South Pole Custom Coordinate' : 'Global Custom Coordinate',
    });

    setManualName('');
    setManualLat('');
    setManualLon('');
    setManualError(null);
    setIsManualFormOpen(false);
  };

  const handleRemoveLocation = (id) => {
    comparisonSelectionStore.removeLocation(id);
  };

  const handleReorderLocation = (index, direction) => {
    const targetIdx = index + direction;
    if (targetIdx < 0 || targetIdx >= selectedLocations.length) return;
    setSelectedLocations((prev) => {
      const copy = [...prev];
      const temp = copy[index];
      copy[index] = copy[targetIdx];
      copy[targetIdx] = temp;
      return copy;
    });
  };

  const handleStartEditLocation = (loc) => {
    setEditingLocationId(loc.id);
    setEditName(loc.name);
    setEditLat(String(loc.latitude));
    setEditLon(String(loc.longitude));
    setEditError(null);
  };

  const handleSaveEditLocation = (id) => {
    const check = validateLunarCoordinates(editLat, editLon);
    if (!check.isValid) {
      setEditError(check.error);
      return;
    }
    setSelectedLocations((prev) =>
      prev.map((loc) => {
        if (loc.id !== id) return loc;
        const coordsChanged =
          Math.abs(loc.latitude - check.lat) > 1e-5 ||
          Math.abs(loc.longitude - check.lon) > 1e-5;
        return {
          ...loc,
          name: editName.trim() || loc.name,
          latitude: check.lat,
          longitude: check.lon,
          isCustom: coordsChanged ? true : loc.isCustom,
          elevationMeters: coordsChanged ? null : loc.elevationMeters,
          slopeDeg: coordsChanged ? null : loc.slopeDeg,
        };
      })
    );
    setEditingLocationId(null);
    setEditError(null);
  };

  const handleResetComparison = () => {
    comparisonSelectionStore.resetLocations();
    setDurationDays(14);
    setSortConfig({ paramId: null, direction: 'desc' });
    setActiveCategoryFilter('All');
    setHiddenParamIds(new Set());
    notifyInfo('Comparison Cleared', 'All locations cleared from comparison.');
  };

  // ── Visible Columns & Row Sorting ─────────────────────────────────────────
  const visibleColumns = useMemo(() => {
    return COMPARISON_PARAMETER_DEFINITIONS.filter((col) => {
      if (hiddenParamIds.has(col.id)) return false;
      if (activeCategoryFilter !== 'All' && col.category !== activeCategoryFilter && col.id !== 'coordinates') {
        return false;
      }
      if (matrixMode === 'standard' && activeCategoryFilter === 'All') {
        return col.inStandardView;
      }
      return true;
    });
  }, [matrixMode, activeCategoryFilter, hiddenParamIds]);

  const sortedEvaluationsWithIndex = useMemo(() => {
    const indexed = evaluations.map((ev, originalIndex) => ({
      ev,
      originalIndex,
      palette: COMPARISON_SITE_PALETTE[originalIndex % COMPARISON_SITE_PALETTE.length],
    }));

    if (!sortConfig.paramId) return indexed;

    return [...indexed].sort((a, b) => {
      const cellA = getMatrixCellDisplay(a.ev, sortConfig.paramId);
      const cellB = getMatrixCellDisplay(b.ev, sortConfig.paramId);

      // Strict rule: Never rank locations based on incomplete information.
      // Missing / unavailable values are always placed at the bottom regardless of sort direction.
      const validA = !cellA.isUnavailable && Number.isFinite(cellA.numericValue);
      const validB = !cellB.isUnavailable && Number.isFinite(cellB.numericValue);
      if (validA && !validB) return -1;
      if (!validA && validB) return 1;
      if (!validA && !validB) return a.originalIndex - b.originalIndex;

      return sortConfig.direction === 'asc'
        ? cellA.numericValue - cellB.numericValue
        : cellB.numericValue - cellA.numericValue;
    });
  }, [evaluations, sortConfig]);

  // Compute Best / Worst available values per column for non-color-only highlighting
  const columnExtrema = useMemo(() => {
    const map = {};
    COMPARISON_PARAMETER_DEFINITIONS.forEach((col) => {
      if (col.higherIsBetter === null || !col.sortable) return;
      const validValues = evaluations
        .map((ev) => getMatrixCellDisplay(ev, col.id))
        .filter((c) => !c.isUnavailable && Number.isFinite(c.numericValue))
        .map((c) => c.numericValue);

      if (validValues.length < 2) return;
      const minVal = Math.min(...validValues);
      const maxVal = Math.max(...validValues);
      if (minVal === maxVal) return;

      map[col.id] = {
        bestVal: col.higherIsBetter ? maxVal : minVal,
        worstVal: col.higherIsBetter ? minVal : maxVal,
      };
    });
    return map;
  }, [evaluations]);

  const handleSortColumn = (col) => {
    if (!col.sortable) return;
    setSortConfig((prev) => {
      if (prev.paramId !== col.id) {
        return { paramId: col.id, direction: col.higherIsBetter === false ? 'asc' : 'desc' };
      }
      if (prev.direction === 'desc') return { paramId: col.id, direction: 'asc' };
      return { paramId: null, direction: 'desc' };
    });
  };

  // ── Export Matrix CSV ─────────────────────────────────────────────────────
  const handleExportMatrixCsv = () => {
    const headers = ['Site #', 'Landing Site', 'Data Completeness', ...visibleColumns.map((c) => `${c.label} (${c.unit})`)];
    const rows = sortedEvaluationsWithIndex.map(({ ev, originalIndex }) => [
      `#${originalIndex + 1}`,
      `"${ev.name.replace(/"/g, '""')}"`,
      `"${ev.completenessStatus}"`,
      ...visibleColumns.map((col) => {
        const cell = getMatrixCellDisplay(ev, col.id);
        return `"${cell.text.replace(/"/g, '""')}"`;
      }),
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Luna_Comparison_Matrix_${evaluations.length}Sites_${durationDays}d.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    notifySuccess('Comparison Matrix Exported', 'Downloaded CSV table with current parameters.');
  };

  // ── Export Comparison PDF Dossier ─────────────────────────────────────────
  const handleExportPdf = async () => {
    if (isExportingPdf) return;
    setIsExportingPdf(true);
    try {
      const fileName = await exportComparisonDossierPdf({
        evaluations,
        durationDays,
        referenceEpochMs,
        tradeOff,
      });
      notifySuccess('Comparison PDF Dossier Exported', `Saved ${fileName}`);
    } catch (err) {
      console.error('PDF export failed:', err);
      notifyWarn('PDF Export Error', err?.message || 'Unable to generate PDF dossier.');
    } finally {
      setIsExportingPdf(false);
    }
  };

  const toggleSection = (key) => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const activeProvenanceDef = useMemo(
    () => COMPARISON_PARAMETER_DEFINITIONS.find((d) => d.id === activeProvenanceParamId) || null,
    [activeProvenanceParamId]
  );

  return (
    <div className="flex-1 overflow-y-auto bg-[#050507] text-[#F1F5F9] px-5 sm:px-8 lg:px-10 py-7 space-y-6">
      {/* =================================================================== */}
      {/* 1. CONCISE PAGE HEADER (Section 9A)                                 */}
      {/* =================================================================== */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#1E2028] pb-5">
        <div>
          <h1 className="text-2xl sm:text-[26px] font-display font-semibold tracking-tight text-white">
            Landing Site Comparison
          </h1>
          <p className="text-[13.5px] font-sans text-[#8E95A5] mt-1.5 leading-relaxed">
            Evaluate lunar landing candidates across terrain, illumination, communication, thermal conditions, and mission duration.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={handleResetComparison}
            className="px-3.5 py-2 rounded-lg bg-[#0C0D12] hover:bg-[#14161D] border border-[#1E2028] text-xs font-sans font-medium text-slate-200 flex items-center gap-1.5 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
            <span>Reset Comparison</span>
          </button>

          <button
            type="button"
            onClick={handleExportPdf}
            disabled={isExportingPdf || evaluations.length < 2}
            className="px-4 py-2 rounded-lg bg-white hover:bg-[#E2E8F0] disabled:opacity-50 text-xs font-sans font-semibold text-[#050507] flex items-center gap-2 transition-colors shadow-sm"
          >
            <FileDown className="w-4 h-4" />
            <span>{isExportingPdf ? 'Generating Dossier PDF...' : 'Export Comparison PDF'}</span>
          </button>
        </div>
      </div>

      {/* =================================================================== */}
      {/* 2. COMPACT MISSION CONFIGURATION PANEL (Section 2 & Section 9B)     */}
      {/* =================================================================== */}
      <section
        aria-label="Mission Configuration"
        className="p-5 rounded-xl bg-[#0C0D12] border border-[#1E2028] space-y-4"
      >
        <div className="flex flex-wrap items-end justify-between gap-4">
          {/* Mission Duration Selector: 7 / 14 / 28 Days */}
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <span className="block text-xs font-sans font-medium text-[#8E95A5] mb-1.5">
                Mission Duration
              </span>
              <div
                role="group"
                aria-label="Select Mission Duration"
                className="inline-flex items-center p-0.5 rounded-lg bg-[#050507] border border-[#1E2028]"
              >
                {MISSION_DURATIONS.map((d) => {
                  const isActive = durationDays === d.days;
                  return (
                    <button
                      key={d.days}
                      type="button"
                      onClick={() => setDurationDays(d.days)}
                      aria-pressed={isActive}
                      className={`px-3.5 py-1.5 rounded-md text-xs font-sans transition-colors ${
                        isActive
                          ? 'bg-white text-[#050507] font-semibold shadow-sm'
                          : 'text-[#94A3B8] font-medium hover:text-white'
                      }`}
                    >
                      {d.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Reference Epoch Input & Presets */}
            <div>
              <label
                htmlFor="comparison-epoch-input"
                className="block text-xs font-sans font-medium text-[#8E95A5] mb-1.5"
              >
                Reference Touchdown Epoch (UTC)
              </label>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  id="comparison-epoch-input"
                  type="datetime-local"
                  value={toDatetimeLocalUtc(referenceEpochMs)}
                  onChange={(e) => {
                    const parsed = new Date(`${e.target.value}:00Z`).getTime();
                    if (Number.isFinite(parsed)) {
                      setReferenceEpochMs(normalizeCelestialTimeMs(parsed));
                    }
                  }}
                  className="px-3 py-1.5 rounded-lg bg-[#050507] border border-[#1E2028] text-xs font-mono tabular-nums text-white focus:outline-none focus:border-white/40"
                />
                <div className="hidden xl:flex items-center gap-1.5">
                  {EPOCH_PRESETS.map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => setReferenceEpochMs(preset.getMs())}
                      className="px-2.5 py-1.5 rounded-lg bg-[#050507] hover:bg-[#14161D] border border-[#1E2028] text-xs font-sans font-medium text-slate-300 hover:text-white transition-colors"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Selection Counter & Location Addition Actions */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Counter */}
            <span
              data-testid="location-counter"
              className="text-xs font-mono tabular-nums font-semibold text-[#F8FAFC] mr-1.5 tracking-wide"
            >
              {selectedLocations.length} / 8 LOCATIONS SELECTED
            </span>

            {/* Method 1: Select Locations from 3D Lunar Map */}
            <button
              type="button"
              onClick={handleSelectLocationsFrom3DMap}
              className="px-3 py-1.5 rounded-lg bg-white/[0.08] hover:bg-white/[0.12] border border-white/25 text-xs font-sans font-medium text-[#F8FAFC] flex items-center gap-1.5 transition-colors"
            >
              <MapPin className="w-3.5 h-3.5" />
              <span>Select Locations from Map</span>
            </button>

            {/* Predefined Landing Sites Dropdown */}
            <select
              aria-label="Add predefined landing site"
              value={predefinedPickerId}
              disabled={selectedLocations.length >= 8}
              onChange={(e) => handleAddPredefinedSite(e.target.value)}
              className="px-3 py-1.5 rounded-lg bg-[#050507] border border-[#1E2028] text-xs font-sans font-medium text-slate-200 focus:outline-none focus:border-white/40 disabled:opacity-40 max-w-[225px]"
            >
              <option value="">
                {selectedLocations.length >= 8 ? 'Max 8 Sites Reached' : '+ Add Predefined Site...'}
              </option>
              {PREDEFINED_COMPARISON_SITES.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({formatSelenographicCoords(s.latitude, s.longitude, 1)})
                </option>
              ))}
            </select>

            {/* Method 2: Manual Coordinate Entry Toggle */}
            <button
              type="button"
              disabled={selectedLocations.length >= 8}
              onClick={() => {
                setIsManualFormOpen((prev) => !prev);
                setManualError(null);
              }}
              className="px-3 py-1.5 rounded-lg bg-[#050507] hover:bg-[#14161D] border border-[#1E2028] text-xs font-sans font-medium text-slate-200 flex items-center gap-1.5 disabled:opacity-40 transition-colors"
            >
              <Plus className="w-3.5 h-3.5 text-[#F8FAFC]" />
              <span>Manual Coordinates</span>
            </button>

            {selectedLocations.length > 0 && (
              <button
                type="button"
                onClick={() => comparisonSelectionStore.resetLocations()}
                className="px-2.5 py-1.5 rounded-lg bg-[#050507] hover:bg-rose-950/40 border border-[#1E2028] hover:border-rose-800/50 text-xs font-sans font-medium text-slate-400 hover:text-rose-300 transition-colors"
                title="Clear all selected locations"
              >
                Clear All
              </button>
            )}
          </div>
        </div>

        {/* Manual Coordinate Entry Compact Form (Method 2) */}
        {isManualFormOpen && (
          <form
            onSubmit={handleManualSubmit}
            className="pt-3.5 border-t border-[#1E2028] flex flex-wrap items-end gap-3"
          >
            <div>
              <label className="block text-xs font-sans font-medium text-[#8E95A5] mb-1">
                Latitude (-90° to +90°) *
              </label>
              <input
                type="text"
                inputMode="decimal"
                placeholder="e.g. -85.42"
                value={manualLat}
                onChange={(e) => {
                  setManualLat(e.target.value);
                  setManualError(null);
                }}
                className="w-36 px-3 py-1.5 rounded-lg bg-[#050507] border border-[#1E2028] text-xs font-mono tabular-nums text-white focus:outline-none focus:border-white/40"
              />
            </div>

            <div>
              <label className="block text-xs font-sans font-medium text-[#8E95A5] mb-1">
                Longitude (-180° to +180°) *
              </label>
              <input
                type="text"
                inputMode="decimal"
                placeholder="e.g. 29.20"
                value={manualLon}
                onChange={(e) => {
                  setManualLon(e.target.value);
                  setManualError(null);
                }}
                className="w-36 px-3 py-1.5 rounded-lg bg-[#050507] border border-[#1E2028] text-xs font-mono tabular-nums text-white focus:outline-none focus:border-white/40"
              />
            </div>

            <div>
              <label className="block text-xs font-sans font-medium text-[#8E95A5] mb-1">
                Location Name (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. Ridge Alpha"
                value={manualName}
                onChange={(e) => setManualName(e.target.value)}
                className="w-48 px-3 py-1.5 rounded-lg bg-[#050507] border border-[#1E2028] text-xs font-sans text-white focus:outline-none focus:border-white/40"
              />
            </div>

            <div className="flex items-center gap-2">
              <button
                type="submit"
                className="px-3.5 py-1.5 rounded-lg bg-white hover:bg-[#E2E8F0] text-xs font-sans font-semibold text-[#050507] transition-colors"
              >
                Validate &amp; Add Location
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsManualFormOpen(false);
                  setManualError(null);
                }}
                className="px-3 py-1.5 rounded-lg bg-[#050507] border border-[#1E2028] text-xs font-sans font-medium text-slate-400 hover:text-white"
              >
                Cancel
              </button>
            </div>

            {manualError && (
              <div
                role="alert"
                className="w-full text-xs font-sans font-medium text-rose-400 flex items-center gap-1.5 pt-1"
              >
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                <span>{manualError}</span>
              </div>
            )}
          </form>
        )}

        {/* Compact Configuration Summary Bar (Section 2) */}
        <div className="pt-3 border-t border-[#1E2028]/80 flex flex-wrap items-center justify-between gap-2 text-xs font-sans text-[#8E95A5]">
          <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1">
            <span>
              Duration: <strong className="font-semibold text-[#E2E8F0]">{durationDays} Days ({durationDays * 24}h)</strong>
            </span>
            <span aria-hidden="true" className="text-[#475569]">·</span>
            <span>
              Epoch: <strong className="font-mono font-medium tabular-nums text-[#E2E8F0]">{new Date(referenceEpochMs).toISOString().slice(0, 16).replace('T', ' ')} UTC</strong>
            </span>
            <span aria-hidden="true" className="text-[#475569]">·</span>
            <span>
              Locations: <strong className="font-semibold text-[#E2E8F0]">{selectedLocations.length} active</strong>
            </span>
            <span aria-hidden="true" className="text-[#475569]">·</span>
            <span>
              Datasets: <strong className="font-medium text-[#E2E8F0]">LRO LOLA 400 m/px Polar DEM, DE421/Meeus Ephemeris, Analytical Thermal</strong>
            </span>
          </div>
          <div className="text-emerald-400 font-medium">
            Calculation Status: Synchronized ({evaluations.length} sites × {Math.round((durationDays * 24) / 2)} time-steps)
          </div>
        </div>
      </section>

      {/* =================================================================== */}
      {/* 3. COMPACT SELECTED LOCATIONS BAR (Section 1A/C & Section 9C)       */}
      {/* =================================================================== */}
      <section aria-label="Selected Locations" className="space-y-2.5">
        {selectedLocations.length === 0 ? (
          <div className="p-8 rounded-xl bg-[#0C0D12] border border-dashed border-[#1E2028] text-center space-y-4">
            <div className="w-12 h-12 rounded-xl bg-white/[0.08] border border-white/25 flex items-center justify-center text-[#F8FAFC] mx-auto">
              <GitCompare className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-display font-semibold text-white">No Locations Selected for Comparison</h3>
              <p className="text-xs font-sans text-[#8E95A5] mt-1 max-w-md mx-auto leading-relaxed">
                Select landing sites to compare below, or click any site on the 3D Moon globe.
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => {
                  const s1 = PREDEFINED_COMPARISON_SITES.find((s) => s.id === 'landing-artemis3-shackleton') || PREDEFINED_COMPARISON_SITES[0];
                  const s2 = PREDEFINED_COMPARISON_SITES.find((s) => s.id === 'landing-artemis3-malapert') || PREDEFINED_COMPARISON_SITES[1];
                  comparisonSelectionStore.setLocations([s1, s2]);
                }}
                className="px-3.5 py-2 rounded-lg bg-white/[0.08] hover:bg-white/[0.12] border border-white/25 text-xs font-sans font-semibold text-[#F8FAFC] transition-colors"
              >
                Compare Artemis III Polar Sites
              </button>
              <button
                type="button"
                onClick={handleSelectLocationsFrom3DMap}
                className="px-3.5 py-2 rounded-lg bg-[#14161D] hover:bg-[#1E2028] border border-[#1E2028] text-xs font-sans font-medium text-slate-200 transition-colors flex items-center gap-1.5"
              >
                <MapPin className="w-3.5 h-3.5 text-[#F8FAFC]" />
                Select on 3D Map
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {evaluations.map((ev, idx) => {
            const loc = selectedLocations[idx];
            const palette = COMPARISON_SITE_PALETTE[idx % COMPARISON_SITE_PALETTE.length];
            const isEditing = editingLocationId === loc.id;

            return (
              <div
                key={loc.id}
                className="p-4 rounded-xl bg-[#0C0D12] border border-[#1E2028] flex flex-col justify-between gap-3"
              >
                {isEditing ? (
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      aria-label="Edit location name"
                      className="w-full px-2.5 py-1.5 rounded bg-[#050507] border border-[#1E2028] text-xs font-sans text-white"
                    />
                    <div className="grid grid-cols-2 gap-1.5">
                      <input
                        type="text"
                        value={editLat}
                        onChange={(e) => setEditLat(e.target.value)}
                        aria-label="Edit latitude"
                        placeholder="Lat (°)"
                        className="px-2.5 py-1.5 rounded bg-[#050507] border border-[#1E2028] text-xs font-mono tabular-nums text-white"
                      />
                      <input
                        type="text"
                        value={editLon}
                        onChange={(e) => setEditLon(e.target.value)}
                        aria-label="Edit longitude"
                        placeholder="Lon (°)"
                        className="px-2.5 py-1.5 rounded bg-[#050507] border border-[#1E2028] text-xs font-mono tabular-nums text-white"
                      />
                    </div>
                    {editError && (
                      <p className="text-[11px] font-sans text-rose-400">{editError}</p>
                    )}
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleSaveEditLocation(loc.id)}
                        className="px-2.5 py-1 rounded bg-white text-[#050507] text-[11px] font-sans font-semibold flex items-center gap-1"
                      >
                        <Check className="w-3 h-3" /> Save
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingLocationId(null);
                          setEditError(null);
                        }}
                        className="px-2.5 py-1 rounded bg-[#050507] border border-[#1E2028] text-[11px] font-sans text-slate-400"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span
                          className="w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-mono font-bold text-[#050507] shrink-0"
                          style={{ backgroundColor: palette.hex }}
                        >
                          {idx + 1}
                        </span>
                        <div className="min-w-0">
                          <div className="text-[13.5px] font-sans font-semibold text-white truncate" title={ev.name}>
                            {ev.name}
                          </div>
                          <div className="text-[11.5px] font-mono tabular-nums text-[#8E95A5] mt-0.5">
                            {ev.formattedCoords}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-0.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleReorderLocation(idx, -1)}
                          disabled={idx === 0}
                          title="Move earlier"
                          aria-label={`Move ${ev.name} left`}
                          className="p-1 text-slate-500 hover:text-slate-200 disabled:opacity-25"
                        >
                          <MoveLeft className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleReorderLocation(idx, 1)}
                          disabled={idx === selectedLocations.length - 1}
                          title="Move later"
                          aria-label={`Move ${ev.name} right`}
                          className="p-1 text-slate-500 hover:text-slate-200 disabled:opacity-25"
                        >
                          <MoveRight className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleStartEditLocation(loc)}
                          title="Rename or edit coordinates"
                          aria-label={`Edit ${ev.name}`}
                          className="p-1 text-slate-400 hover:text-white"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (onSelectSiteForView) onSelectSiteForView(loc);
                            if (onNavigate) onNavigate('explorer');
                          }}
                          title="Inspect location on 3D/2D Lunar Map"
                          aria-label={`View ${ev.name} on map`}
                          className="p-1 text-slate-400 hover:text-white"
                        >
                          <Compass className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemoveLocation(loc.id)}
                          title={`Remove ${ev.name} from comparison`}
                          aria-label={`Remove ${ev.name}`}
                          className="p-1 text-slate-400 hover:text-rose-400 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-2 text-[11.5px] font-sans font-medium pt-2.5 border-t border-[#1E2028]">
                      <span
                        className={
                          ev.completenessStatus === 'Complete'
                            ? 'text-emerald-400'
                            : ev.completenessStatus === 'Partially Available'
                            ? 'text-amber-300'
                            : 'text-rose-400'
                        }
                        title={ev.completenessDetail}
                      >
                        Data: {ev.completenessStatus}
                      </span>
                      <span className="text-[#8E95A5] shrink-0">
                        {ev.suitability.overallSuitability !== null ? (
                          <>
                            Score:{' '}
                            <span className="font-mono tabular-nums font-semibold text-white">
                              {ev.suitability.overallSuitability}/100
                            </span>
                          </>
                        ) : (
                          'Unscored (Partial)'
                        )}
                      </span>
                    </div>
                  </>
                )}
              </div>
            );
          })}

          {/* Quick Add Candidate Card (when under 8 locations) */}
          {selectedLocations.length < 8 && (
            <div className="p-4 rounded-xl bg-[#050507]/80 border border-dashed border-[#1E2028] hover:border-white/30 flex flex-col justify-center items-center gap-2.5 text-center transition-colors min-h-[104px]">
              <div className="text-xs font-sans font-medium text-slate-300 flex items-center gap-1.5">
                <Plus className="w-3.5 h-3.5 text-[#F8FAFC]" />
                <span>
                  {selectedLocations.length === 1
                    ? 'Add 2nd Site to Compare'
                    : `Add Site (${selectedLocations.length}/8)`}
                </span>
              </div>
              <div className="flex items-center gap-1.5 w-full">
                <select
                  aria-label="Add comparison site"
                  value=""
                  onChange={(e) => handleAddPredefinedSite(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-[#050507] border border-[#1E2028] text-xs font-sans text-slate-300 focus:outline-none focus:border-white/40"
                >
                  <option value="">+ Choose Site...</option>
                  {PREDEFINED_COMPARISON_SITES.filter(
                    (s) => !selectedLocations.some((l) => l.id === s.id)
                  ).map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </div>
        )}
      </section>

      {/* =================================================================== */}
      {/* 4. COMPACT EVIDENCE-BASED MISSION TRADE-OFF SUMMARY (Section 7/9D)  */}
      {/* =================================================================== */}
      <section
        aria-label="Mission Trade-Off Summary"
        className="p-5 rounded-xl bg-[#0C0D12] border border-[#1E2028] space-y-3.5"
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 pb-3 border-b border-[#1E2028]">
          <div className="flex items-center gap-2.5">
            {tradeOff.hasDefensibleWinner ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            )}
            <h2 className="text-[15px] font-display font-semibold text-white">
              {tradeOff.recommendationTitle}
            </h2>
          </div>
          <span className="text-xs font-sans font-medium text-[#8E95A5]">
            Mission Trade-Off Verdict · {durationDays}-Day Window
          </span>
        </div>

        {tradeOff.recommendationRationale && (
          <p className="text-[13px] font-sans text-[#CBD5E1] leading-relaxed">
            {tradeOff.recommendationRationale}
          </p>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 pt-1">
          {/* Significant Quantitative Differences */}
          <div className="space-y-2">
            <h3 className="text-xs font-sans font-semibold text-[#F8FAFC] uppercase tracking-wider">
              Evidence-Based Parameter Differences
            </h3>
            <ul className="space-y-1.5 text-[12.5px] font-sans text-[#CBD5E1]">
              {tradeOff.keyDifferences.map((diff, i) => (
                <li key={i} className="leading-relaxed">
                  • {diff}
                </li>
              ))}
            </ul>
          </div>

          {/* Critical Risks & Data Limitations */}
          <div className="space-y-2">
            <h3 className="text-xs font-sans font-semibold text-[#F8FAFC] uppercase tracking-wider">
              Operational Risks &amp; Data Coverage Limitations
            </h3>
            <ul className="space-y-1.5 text-[12.5px] font-sans text-[#CBD5E1]">
              {tradeOff.criticalRisks.map((risk, i) => (
                <li key={`risk-${i}`} className="text-rose-300 leading-relaxed">
                  • [Risk] {risk}
                </li>
              ))}
              {tradeOff.missingInformation.slice(0, 3).map((info, i) => (
                <li key={`miss-${i}`} className="text-amber-200/90 leading-relaxed">
                  • [Data Limitation] {info}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* =================================================================== */}
      {/* 5. CENTERPIECE COMPARISON MATRIX (Section 4, 5, 9E)                 */}
      {/*    Rows = Landing Sites | Columns = Evaluation Parameters           */}
      {/* =================================================================== */}
      <section
        aria-label="Landing Site Comparison Matrix"
        className="rounded-xl bg-[#0C0D12] border border-[#1E2028] flex flex-col overflow-hidden"
      >
        {/* Matrix Control Bar */}
        <div className="p-4 border-b border-[#1E2028] bg-[#0C0D12] flex flex-wrap items-center justify-between gap-3">
          {/* Category Filter Tabs */}
          <div className="flex flex-wrap items-center gap-1.5">
            {PARAMETER_CATEGORIES.map((cat) => {
              const isActive = activeCategoryFilter === cat;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setActiveCategoryFilter(cat)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-sans transition-colors ${
                    isActive
                      ? 'bg-white text-[#050507] font-semibold shadow-sm'
                      : 'text-[#8E95A5] font-medium hover:text-white hover:bg-[#14161D]'
                  }`}
                >
                  {cat}
                </button>
              );
            })}
          </div>

          {/* Right Matrix Controls: View Density, Highlight Best/Worst, Parameter Picker, CSV Export */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Compact vs Detailed View */}
            {activeCategoryFilter === 'All' && (
              <div className="inline-flex items-center p-0.5 rounded-lg bg-[#050507] border border-[#1E2028] text-xs font-sans">
                <button
                  type="button"
                  onClick={() => setMatrixMode('standard')}
                  className={`px-3 py-1 rounded-md transition-colors ${
                    matrixMode === 'standard'
                      ? 'bg-[#14161D] text-white font-semibold'
                      : 'text-[#8E95A5] font-medium hover:text-white'
                  }`}
                >
                  Core (10 Cols)
                </button>
                <button
                  type="button"
                  onClick={() => setMatrixMode('detailed')}
                  className={`px-3 py-1 rounded-md transition-colors ${
                    matrixMode === 'detailed'
                      ? 'bg-[#14161D] text-white font-semibold'
                      : 'text-[#8E95A5] font-medium hover:text-white'
                  }`}
                >
                  Detailed (All 24 Cols)
                </button>
              </div>
            )}

            {/* Highlight Best / Worst Toggle */}
            <button
              type="button"
              onClick={() => setHighlightExtrema((prev) => !prev)}
              aria-pressed={highlightExtrema}
              className={`px-3 py-1.5 rounded-lg border text-xs font-sans font-medium transition-colors ${
                highlightExtrema
                  ? 'bg-emerald-950/40 border-emerald-600/50 text-emerald-300'
                  : 'bg-[#050507] border-[#1E2028] text-[#8E95A5] hover:text-white'
              }`}
            >
              {highlightExtrema ? 'Extrema Highlighted' : 'Highlight Best/Worst'}
            </button>

            {/* Show/Hide Parameters Dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsParamFilterOpen((prev) => !prev)}
                className="px-3 py-1.5 rounded-lg bg-[#050507] hover:bg-[#14161D] border border-[#1E2028] text-xs font-sans font-medium text-slate-300 flex items-center gap-1.5"
              >
                <SlidersHorizontal className="w-3.5 h-3.5 text-[#F8FAFC]" />
                <span>Columns ({visibleColumns.length})</span>
              </button>

              {isParamFilterOpen && (
                <div className="absolute right-0 top-full mt-1.5 w-72 max-h-80 overflow-y-auto bg-[#0C0D12] border border-[#1E2028] rounded-xl shadow-2xl p-3.5 z-40 space-y-2">
                  <div className="flex items-center justify-between text-xs font-sans pb-2 border-b border-[#1E2028]">
                    <span className="font-semibold text-white">Show / Hide Parameters</span>
                    <button
                      type="button"
                      onClick={() => setHiddenParamIds(new Set())}
                      className="text-[11px] font-medium text-[#F8FAFC] hover:underline"
                    >
                      Reset All
                    </button>
                  </div>
                  {COMPARISON_PARAMETER_DEFINITIONS.map((param) => {
                    const isChecked = !hiddenParamIds.has(param.id);
                    return (
                      <label
                        key={param.id}
                        className="flex items-center gap-2 text-xs font-sans text-slate-300 cursor-pointer hover:text-white py-0.5"
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {
                            setHiddenParamIds((prev) => {
                              const next = new Set(prev);
                              if (next.has(param.id)) next.delete(param.id);
                              else next.add(param.id);
                              return next;
                            });
                          }}
                          className="rounded border-slate-600 accent-white"
                        />
                        <span className="truncate">{param.label}</span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Export Matrix CSV */}
            <button
              type="button"
              onClick={handleExportMatrixCsv}
              className="px-3 py-1.5 rounded-lg bg-[#050507] hover:bg-[#14161D] border border-[#1E2028] text-xs font-sans font-medium text-slate-300 flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5 text-[#F8FAFC]" />
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        {/* Active Parameter Provenance Banner (when user clicks a column's info icon) */}
        {activeProvenanceDef && (
          <div className="px-5 py-3.5 bg-[#14161D] border-b border-[#1E2028] flex items-start justify-between gap-4 text-xs font-sans">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <strong className="text-[#F8FAFC] font-semibold">
                  Parameter Provenance: {activeProvenanceDef.label} ({activeProvenanceDef.unit})
                </strong>
                <span className="text-slate-400">·</span>
                <span className="text-slate-300">
                  Derivation: <strong>{activeProvenanceDef.provenance.derivationType}</strong>
                </span>
              </div>
              <div className="text-slate-300">
                <strong>Dataset:</strong> {activeProvenanceDef.provenance.datasetName} ({activeProvenanceDef.provenance.organization})
              </div>
              <div className="text-slate-400">
                <strong>Resolution:</strong> {activeProvenanceDef.provenance.spatialResolution} ·{' '}
                <strong>Temporal:</strong> {activeProvenanceDef.provenance.temporalResolution} (Epoch: {new Date(referenceEpochMs).toUTCString()})
              </div>
              <div className="text-slate-300">
                <strong>Calculation Method:</strong> {activeProvenanceDef.provenance.method}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setActiveProvenanceParamId(null)}
              aria-label="Close parameter provenance"
              className="p-1 text-slate-400 hover:text-white shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Horizontally & Vertically Scrollable Matrix Table */}
        <div className="relative overflow-x-auto max-h-[620px] overflow-y-auto">
          <table
            data-testid="comparison-matrix-table"
            className="w-full border-collapse text-left font-sans text-xs"
          >
            <thead className="sticky top-0 z-20 bg-[#0C0D12] border-b border-[#1E2028]">
              <tr>
                {/* Sticky First Column Header: Landing Site */}
                <th
                  scope="col"
                  className="sticky left-0 z-30 bg-[#0C0D12] py-3.5 px-4 min-w-[220px] max-w-[250px] border-r border-[#1E2028] font-sans text-[12.5px] font-semibold text-white align-middle"
                >
                  Landing Site
                </th>

                {visibleColumns.map((col) => {
                  const isSorted = sortConfig.paramId === col.id;
                  return (
                    <th
                      key={col.id}
                      scope="col"
                      className="py-3.5 px-4 min-w-[165px] border-r border-[#1E2028] last:border-r-0 align-top bg-[#0C0D12]"
                    >
                      <div className="flex items-start justify-between gap-1.5">
                        <button
                          type="button"
                          disabled={!col.sortable}
                          onClick={() => handleSortColumn(col)}
                          title={
                            col.sortable
                              ? `Sort by ${col.label} (${col.provenance.derivationType})`
                              : col.label
                          }
                          className={`text-left font-sans font-semibold text-[12.5px] text-[#F8FAFC] leading-snug flex items-center gap-1 ${
                            col.sortable ? 'hover:text-white cursor-pointer' : 'cursor-default'
                          }`}
                        >
                          <span>{col.shortLabel}</span>
                          {col.sortable && (
                            <span className="text-slate-500 shrink-0">
                              {isSorted ? (
                                sortConfig.direction === 'asc' ? (
                                  <ArrowUp className="w-3 h-3 text-[#F8FAFC]" />
                                ) : (
                                  <ArrowDown className="w-3 h-3 text-[#F8FAFC]" />
                                )
                              ) : (
                                <ArrowUpDown className="w-3 h-3 opacity-60" />
                              )}
                            </span>
                          )}
                        </button>

                        {/* Parameter Provenance Info Trigger */}
                        <button
                          type="button"
                          onClick={() =>
                            setActiveProvenanceParamId((prev) =>
                              prev === col.id ? null : col.id
                            )
                          }
                          aria-label={`Inspect provenance for ${col.label}`}
                          title={`${col.provenance.datasetName} — Click for methodology`}
                          className={`p-0.5 rounded hover:text-white shrink-0 ${
                            activeProvenanceParamId === col.id
                              ? 'text-[#F8FAFC]'
                              : 'text-slate-500'
                          }`}
                        >
                          <Info className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <div className="text-[11px] font-sans font-normal text-[#7E8696] mt-1 leading-snug">
                        {col.unit} · {col.category}
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>

            <tbody className="divide-y divide-[#1E2028]">
              {sortedEvaluationsWithIndex.length === 0 ? (
                <tr>
                  <td
                    colSpan={visibleColumns.length + 1}
                    className="py-12 text-center text-[#8E95A5] font-sans text-xs"
                  >
                    No lunar locations selected. Select sites on the 3D map or add predefined sites above to compare.
                  </td>
                </tr>
              ) : (
                sortedEvaluationsWithIndex.map(({ ev, originalIndex, palette }, rowIdx) => {
                  const rowBg = rowIdx % 2 === 0 ? 'bg-[#0C0D12]' : 'bg-[#0C0D12]';

                  return (
                    <tr
                      key={ev.id}
                      className={`${rowBg} hover:bg-[#14161D] transition-colors`}
                    >
                      {/* Sticky First Column: Landing Site Name & Identifier */}
                      <th
                        scope="row"
                        className={`sticky left-0 z-10 ${rowBg} py-3.5 px-4 border-r border-[#1E2028] font-sans align-top`}
                      >
                        <div className="flex items-start gap-2.5">
                          <span
                            className="w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-mono font-bold text-[#050507] shrink-0 mt-0.5"
                            style={{ backgroundColor: palette.hex }}
                          >
                            {originalIndex + 1}
                          </span>
                          <div className="min-w-0">
                            <div className="text-[13px] font-sans font-semibold text-white leading-snug break-words">
                              {ev.name}
                            </div>
                            <div className="text-[11px] font-sans font-medium text-[#8E95A5] mt-0.5">
                              {ev.completenessStatus}
                            </div>
                          </div>
                        </div>
                      </th>

                      {/* Parameter Cells */}
                      {visibleColumns.map((col) => {
                        const cell = getMatrixCellDisplay(ev, col.id);
                        const extrema = columnExtrema[col.id];
                        const isBest =
                          highlightExtrema &&
                          extrema &&
                          !cell.isUnavailable &&
                          cell.numericValue === extrema.bestVal;
                        const isWorst =
                          highlightExtrema &&
                          extrema &&
                          !cell.isUnavailable &&
                          cell.numericValue === extrema.worstVal;

                        let textColorClass = 'text-[#F8FAFC]';
                        if (cell.isUnavailable) {
                          textColorClass = 'text-[#64748B] italic font-sans font-normal text-[12px]';
                        } else if (cell.status === 'favorable') {
                          textColorClass = 'text-emerald-300 font-mono font-semibold text-[13px] tabular-nums';
                        } else if (cell.status === 'conditional') {
                          textColorClass = 'text-amber-300 font-mono font-semibold text-[13px] tabular-nums';
                        } else if (cell.status === 'unfavorable') {
                          textColorClass = 'text-rose-300 font-mono font-semibold text-[13px] tabular-nums';
                        } else {
                          textColorClass = 'text-[#F8FAFC] font-mono font-semibold text-[13px] tabular-nums';
                        }

                        return (
                          <td
                            key={col.id}
                            className={`py-3.5 px-4 border-r border-[#1E2028] last:border-r-0 align-top ${
                              isBest
                                ? 'bg-emerald-950/20'
                                : isWorst
                                ? 'bg-rose-950/15'
                                : ''
                            }`}
                          >
                            <div className="flex items-center justify-between gap-1.5">
                              <span className={textColorClass}>
                                {cell.text}
                              </span>
                              {/* Non-color-only explicit status tags */}
                              {isBest && (
                                <span className="text-[10px] font-mono font-semibold text-emerald-400 shrink-0">
                                  [BEST]
                                </span>
                              )}
                              {isWorst && !isBest && (
                                <span className="text-[10px] font-mono font-semibold text-rose-400 shrink-0">
                                  [LOW]
                                </span>
                              )}
                            </div>
                            {cell.subtext && (
                              <div className="text-[11.5px] font-sans font-normal text-[#8E95A5] mt-1 leading-snug">
                                {cell.subtext}
                              </div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* =================================================================== */}
      {/* 6. EXPANDABLE DETAILED SCIENTIFIC ANALYSIS SECTIONS (Section 9F)    */}
      {/* =================================================================== */}
      <section aria-label="Detailed Parameter Investigation" className="space-y-3 pb-8">
        <h2 className="text-[16px] font-display font-semibold text-white tracking-tight">
          Detailed Scientific Breakdown &amp; Methodology
        </h2>

        {/* 1. Solar & Energy Analysis */}
        <div className="rounded-xl bg-[#0C0D12] border border-[#1E2028] overflow-hidden">
          <button
            type="button"
            onClick={() => toggleSection('solar')}
            aria-expanded={openSections.solar}
            className="w-full px-5 py-4 flex items-center justify-between text-left hover:bg-[#14161D] transition-colors"
          >
            <div>
              <span className="text-[13.5px] font-display font-semibold text-white">
                1. Solar &amp; Energy Analysis ({durationDays}-Day Integration)
              </span>
              <span className="block text-[12px] font-sans text-[#8E95A5] mt-0.5">
                Solar elevation extrema, cumulative sunlight/darkness hours, longest shadow streaks, and charging windows.
              </span>
            </div>
            {openSections.solar ? (
              <ChevronDown className="w-4 h-4 text-[#F8FAFC]" />
            ) : (
              <ChevronRight className="w-4 h-4 text-slate-400" />
            )}
          </button>

          {openSections.solar && (
            <div className="p-5 border-t border-[#1E2028] overflow-x-auto space-y-3">
              <table className="w-full text-left font-mono tabular-nums text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[#1E2028] font-sans font-medium text-[#8E95A5]">
                    <th className="py-2.5 pr-3">Landing Site</th>
                    <th className="py-2.5 px-3">Touchdown Sun Elev.</th>
                    <th className="py-2.5 px-3">Min / Max Sun Elev.</th>
                    <th className="py-2.5 px-3">Illumination (%)</th>
                    <th className="py-2.5 px-3">Sunlight / Darkness (h)</th>
                    <th className="py-2.5 px-3">Longest Dark Streak</th>
                    <th className="py-2.5 px-3">Mean Flux Factor</th>
                    <th className="py-2.5 pl-3">Power Opportunities &amp; Stability</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1E2028]">
                  {evaluations.map((ev, idx) => (
                    <tr key={ev.id}>
                      <td className="py-2.5 pr-3 font-sans font-semibold text-white">
                        #{idx + 1} {ev.name}
                      </td>
                      <td className="py-2.5 px-3">{ev.solar.touchdownElevationDeg.toFixed(2)}°</td>
                      <td className="py-2.5 px-3">
                        {ev.solar.minElevationDeg.toFixed(1)}° / {ev.solar.maxElevationDeg.toFixed(1)}°
                      </td>
                      <td className="py-2.5 px-3 text-amber-300 font-semibold">
                        {ev.solar.solarIlluminationPct.toFixed(1)}%
                      </td>
                      <td className="py-2.5 px-3">
                        {ev.solar.totalSunlightHours}h lit / {ev.solar.totalDarknessHours}h dark
                      </td>
                      <td className="py-2.5 px-3">{ev.solar.longestContinuousDarkHours} h</td>
                      <td className="py-2.5 px-3">{ev.solar.solarPowerPotentialPct.toFixed(1)}%</td>
                      <td className="py-2.5 pl-3 font-sans text-slate-300">{ev.solar.powerOpportunitiesLabel}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* 2. Communication & Visibility */}
        <div className="rounded-xl bg-[#0C0D12] border border-[#1E2028] overflow-hidden">
          <button
            type="button"
            onClick={() => toggleSection('comm')}
            aria-expanded={openSections.comm}
            className="w-full px-5 py-4 flex items-center justify-between text-left hover:bg-[#14161D] transition-colors"
          >
            <div>
              <span className="text-[13.5px] font-display font-semibold text-white">
                2. Communication &amp; Visibility ({durationDays}-Day Libration Sweep)
              </span>
              <span className="block text-[12px] font-sans text-[#8E95A5] mt-0.5">
                Topocentric Earth elevation, terrain clearance margin, communication window counts, and blackout durations.
              </span>
            </div>
            {openSections.comm ? (
              <ChevronDown className="w-4 h-4 text-[#F8FAFC]" />
            ) : (
              <ChevronRight className="w-4 h-4 text-slate-400" />
            )}
          </button>

          {openSections.comm && (
            <div className="p-5 border-t border-[#1E2028] overflow-x-auto space-y-3">
              <table className="w-full text-left font-mono tabular-nums text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[#1E2028] font-sans font-medium text-[#8E95A5]">
                    <th className="py-2.5 pr-3">Landing Site</th>
                    <th className="py-2.5 px-3">Visibility Regime</th>
                    <th className="py-2.5 px-3">Earth Elev. (t₀ / Range)</th>
                    <th className="py-2.5 px-3">DTE Availability</th>
                    <th className="py-2.5 px-3">Comm Windows</th>
                    <th className="py-2.5 px-3">Total Comm Hours</th>
                    <th className="py-2.5 pl-3">Max Blackout Duration</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1E2028]">
                  {evaluations.map((ev, idx) => (
                    <tr key={ev.id}>
                      <td className="py-2.5 pr-3 font-sans font-semibold text-white">
                        #{idx + 1} {ev.name}
                      </td>
                      <td className="py-2.5 px-3 font-sans text-slate-200">{ev.communication.earthVisibilityLabel}</td>
                      <td className="py-2.5 px-3">
                        {ev.communication.touchdownElevationDeg.toFixed(2)}° ({ev.communication.minElevationDeg.toFixed(1)}° to {ev.communication.maxElevationDeg.toFixed(1)}°)
                      </td>
                      <td className="py-2.5 px-3 text-cyan-300 font-semibold">
                        {ev.communication.earthVisibilityPct.toFixed(1)}%
                      </td>
                      <td className="py-2.5 px-3">{ev.communication.commWindowsCount} window(s)</td>
                      <td className="py-2.5 px-3">{ev.communication.totalCommHours} h</td>
                      <td className="py-2.5 pl-3">{ev.communication.maxBlackoutHours} h</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="text-xs font-sans text-[#8E95A5] leading-relaxed">
                Note: Geometric visibility indicates that the apparent Earth disc clears the local lunar horizon and terrain obstacles. Operational RF link availability also depends on lander antenna gimbal limits and Earth DSN ground station scheduling.
              </p>
            </div>
          )}
        </div>

        {/* 3. Terrain Characteristics */}
        <div className="rounded-xl bg-[#0C0D12] border border-[#1E2028] overflow-hidden">
          <button
            type="button"
            onClick={() => toggleSection('terrain')}
            aria-expanded={openSections.terrain}
            className="w-full px-5 py-4 flex items-center justify-between text-left hover:bg-[#14161D] transition-colors"
          >
            <div>
              <span className="text-[13.5px] font-display font-semibold text-white">
                3. Terrain Characteristics (NASA LRO LOLA DEM)
              </span>
              <span className="block text-[12px] font-sans text-[#8E95A5] mt-0.5">
                Surface elevation, Horn 3×3 slope gradient, 2 km RMS roughness, local relief, crater density status, and landing hazards.
              </span>
            </div>
            {openSections.terrain ? (
              <ChevronDown className="w-4 h-4 text-[#F8FAFC]" />
            ) : (
              <ChevronRight className="w-4 h-4 text-slate-400" />
            )}
          </button>

          {openSections.terrain && (
            <div className="p-5 border-t border-[#1E2028] overflow-x-auto space-y-3">
              <table className="w-full text-left font-mono tabular-nums text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[#1E2028] font-sans font-medium text-[#8E95A5]">
                    <th className="py-2.5 pr-3">Landing Site</th>
                    <th className="py-2.5 px-3">Elevation (m)</th>
                    <th className="py-2.5 px-3">Slope (°)</th>
                    <th className="py-2.5 px-3">Roughness (RMS)</th>
                    <th className="py-2.5 px-3">Local Relief (2 km)</th>
                    <th className="py-2.5 px-3">Crater Density</th>
                    <th className="py-2.5 px-3">Classification</th>
                    <th className="py-2.5 pl-3">Identified Landing Hazards</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1E2028]">
                  {evaluations.map((ev, idx) => (
                    <tr key={ev.id}>
                      <td className="py-2.5 pr-3 font-sans font-semibold text-white">
                        #{idx + 1} {ev.name}
                      </td>
                      <td className="py-2.5 px-3">
                        {ev.terrain.elevationM !== null
                          ? `${ev.terrain.elevationM >= 0 ? '+' : ''}${ev.terrain.elevationM.toLocaleString()} m`
                          : <span className="font-sans text-[#64748B] italic">Data Not Available</span>}
                      </td>
                      <td className="py-2.5 px-3">
                        {ev.terrain.slopeDeg !== null
                          ? `${ev.terrain.slopeDeg.toFixed(1)}°`
                          : <span className="font-sans text-[#64748B] italic">Data Not Available</span>}
                      </td>
                      <td className="py-2.5 px-3">
                        {ev.terrain.roughnessM !== null
                          ? `${ev.terrain.roughnessM.toFixed(1)} m RMS`
                          : <span className="font-sans text-[#64748B] italic">Data Not Available</span>}
                      </td>
                      <td className="py-2.5 px-3">
                        {ev.terrain.localReliefM !== null
                          ? `${ev.terrain.localReliefM.toFixed(0)} m`
                          : <span className="font-sans text-[#64748B] italic">Data Not Available</span>}
                      </td>
                      <td className="py-2.5 px-3 font-sans text-[#64748B] italic">Data Not Available</td>
                      <td className="py-2.5 px-3 font-sans text-slate-200">{ev.terrain.terrainClassification}</td>
                      <td className="py-2.5 pl-3 font-sans text-slate-300">{ev.terrain.hazardSummary}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* 4. Thermal Analysis */}
        <div className="rounded-xl bg-[#0C0D12] border border-[#1E2028] overflow-hidden">
          <button
            type="button"
            onClick={() => toggleSection('thermal')}
            aria-expanded={openSections.thermal}
            className="w-full px-5 py-4 flex items-center justify-between text-left hover:bg-[#14161D] transition-colors"
          >
            <div>
              <span className="text-[13.5px] font-display font-semibold text-white">
                4. Thermal Analysis (Model-Derived Radiative Equilibrium)
              </span>
              <span className="block text-[12px] font-sans text-[#8E95A5] mt-0.5">
                Touchdown temperature, mission minimum/maximum temperature, diurnal variation ΔT, and cryogenic exposure hours.
              </span>
            </div>
            {openSections.thermal ? (
              <ChevronDown className="w-4 h-4 text-[#F8FAFC]" />
            ) : (
              <ChevronRight className="w-4 h-4 text-slate-400" />
            )}
          </button>

          {openSections.thermal && (
            <div className="p-5 border-t border-[#1E2028] overflow-x-auto space-y-3">
              <table className="w-full text-left font-mono tabular-nums text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[#1E2028] font-sans font-medium text-[#8E95A5]">
                    <th className="py-2.5 pr-3">Landing Site</th>
                    <th className="py-2.5 px-3">Touchdown Temp</th>
                    <th className="py-2.5 px-3">Min Surface Temp</th>
                    <th className="py-2.5 px-3">Max Surface Temp</th>
                    <th className="py-2.5 px-3">Temp Swing (ΔT)</th>
                    <th className="py-2.5 px-3">Subsurface Eq.</th>
                    <th className="py-2.5 pl-3">Mission Thermal Exposure</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1E2028]">
                  {evaluations.map((ev, idx) => (
                    <tr key={ev.id}>
                      <td className="py-2.5 pr-3 font-sans font-semibold text-white">
                        #{idx + 1} {ev.name}
                      </td>
                      <td className="py-2.5 px-3">
                        {ev.thermal.touchdownTempC}°C ({ev.thermal.touchdownTempK} K)
                      </td>
                      <td className="py-2.5 px-3">
                        {ev.thermal.minTempC}°C ({ev.thermal.minTempK} K)
                      </td>
                      <td className="py-2.5 px-3">
                        {ev.thermal.maxTempC}°C ({ev.thermal.maxTempK} K)
                      </td>
                      <td className="py-2.5 px-3">Δ{ev.thermal.tempVariationC}°C</td>
                      <td className="py-2.5 px-3">{ev.thermal.subsurfaceTempC}°C</td>
                      <td className="py-2.5 pl-3 font-sans text-slate-300">{ev.thermal.exposureSummary}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="text-xs font-sans text-[#8E95A5] leading-relaxed">
                Provenance Distinction: Surface temperatures are Model-Derived using an analytical Stefan-Boltzmann radiative balance model parameterized by LRO Diviner literature (Vasavada et al. 2012; Paige et al. 2010) and coupled to local LOLA DEM shadow masks.
              </p>
            </div>
          )}
        </div>

        {/* 5. Mission Suitability */}
        <div className="rounded-xl bg-[#0C0D12] border border-[#1E2028] overflow-hidden">
          <button
            type="button"
            onClick={() => toggleSection('suitability')}
            aria-expanded={openSections.suitability}
            className="w-full px-5 py-4 flex items-center justify-between text-left hover:bg-[#14161D] transition-colors"
          >
            <div>
              <span className="text-[13.5px] font-display font-semibold text-white">
                5. Mission Suitability &amp; Scoring Methodology
              </span>
              <span className="block text-[12px] font-sans text-[#8E95A5] mt-0.5">
                Transparent component weights (35% Solar, 30% Comm, 20% Terrain, 15% Thermal) and completeness guards.
              </span>
            </div>
            {openSections.suitability ? (
              <ChevronDown className="w-4 h-4 text-[#F8FAFC]" />
            ) : (
              <ChevronRight className="w-4 h-4 text-slate-400" />
            )}
          </button>

          {openSections.suitability && (
            <div className="p-5 border-t border-[#1E2028] overflow-x-auto space-y-3">
              <div className="text-xs text-slate-300 font-sans bg-[#050507] p-3.5 rounded-lg border border-[#1E2028] leading-relaxed">
                <strong className="text-white">Documented Scoring Equation:</strong>{' '}
                <span className="font-mono text-[#E2E8F0]">
                  Overall Suitability = {(SUITABILITY_WEIGHTS.solar * 100).toFixed(0)}% × Solar +{' '}
                  {(SUITABILITY_WEIGHTS.communication * 100).toFixed(0)}% × Communication +{' '}
                  {(SUITABILITY_WEIGHTS.terrain * 100).toFixed(0)}% × Terrain +{' '}
                  {(SUITABILITY_WEIGHTS.thermal * 100).toFixed(0)}% × Thermal.
                </span>{' '}
                <span className="text-[#8E95A5]">
                  If any component input (such as local terrain slope north of 80°S) is missing, Overall Suitability is reported as &ldquo;Insufficient Data for Scoring&rdquo; rather than substituting zero or re-normalizing partial weights.
                </span>
              </div>

              <table className="w-full text-left font-mono tabular-nums text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[#1E2028] font-sans font-medium text-[#8E95A5]">
                    <th className="py-2.5 pr-3">Landing Site</th>
                    <th className="py-2.5 px-3">Solar (35%)</th>
                    <th className="py-2.5 px-3">Comm (30%)</th>
                    <th className="py-2.5 px-3">Terrain (20%)</th>
                    <th className="py-2.5 px-3">Thermal (15%)</th>
                    <th className="py-2.5 px-3">Overall Suitability</th>
                    <th className="py-2.5 pl-3">Derivation Breakdown</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1E2028]">
                  {evaluations.map((ev, idx) => (
                    <tr key={ev.id}>
                      <td className="py-2.5 pr-3 font-sans font-semibold text-white">
                        #{idx + 1} {ev.name}
                      </td>
                      <td className="py-2.5 px-3">{ev.suitability.solarSuitability} / 100</td>
                      <td className="py-2.5 px-3">{ev.suitability.commSuitability} / 100</td>
                      <td className="py-2.5 px-3">
                        {ev.suitability.terrainSuitability !== null
                          ? `${ev.suitability.terrainSuitability} / 100`
                          : <span className="font-sans text-[#64748B] italic">Data Not Available</span>}
                      </td>
                      <td className="py-2.5 px-3">{ev.suitability.thermalSuitability} / 100</td>
                      <td className="py-2.5 px-3 font-semibold text-[#F8FAFC]">
                        {ev.suitability.overallSuitability !== null
                          ? `${ev.suitability.overallSuitability} / 100`
                          : <span className="font-sans font-normal text-[#8E95A5]">Insufficient Data for Scoring</span>}
                      </td>
                      <td className="py-2.5 pl-3 font-sans text-[#8E95A5]">{ev.suitability.formulaExplanation}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* 6. Data Sources & Methodology */}
        <div className="rounded-xl bg-[#0C0D12] border border-[#1E2028] overflow-hidden">
          <button
            type="button"
            onClick={() => toggleSection('methodology')}
            aria-expanded={openSections.methodology}
            className="w-full px-5 py-4 flex items-center justify-between text-left hover:bg-[#14161D] transition-colors"
          >
            <div>
              <span className="text-[13.5px] font-display font-semibold text-white">
                6. Data Sources, Provenance &amp; Coverage Limitations
              </span>
              <span className="block text-[12px] font-sans text-[#8E95A5] mt-0.5">
                Complete registry of NASA PDS datasets, spatial/temporal resolutions, and parameters requiring further investigation.
              </span>
            </div>
            {openSections.methodology ? (
              <ChevronDown className="w-4 h-4 text-[#F8FAFC]" />
            ) : (
              <ChevronRight className="w-4 h-4 text-slate-400" />
            )}
          </button>

          {openSections.methodology && (
            <div className="p-5 border-t border-[#1E2028] space-y-4 text-xs font-sans">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {NASA_DATASETS_REGISTRY.map((ds) => (
                  <div
                    key={ds.id}
                    className="p-3.5 rounded-lg bg-[#050507] border border-[#1E2028] space-y-1.5"
                  >
                    <div className="font-display font-semibold text-[13px] text-white">{ds.datasetName}</div>
                    <div className="text-[11px] font-mono text-[#E2E8F0]">{ds.instrument}</div>
                    <div className="text-[11.5px] text-[#8E95A5]">
                      Resolution: {ds.spatialResolution} · Coverage: {ds.coverageArea}
                    </div>
                    <div className="text-[12px] text-slate-300 leading-relaxed">{ds.description}</div>
                  </div>
                ))}
              </div>

              <div className="p-4 rounded-lg bg-[#050507] border border-[#1E2028] space-y-2">
                <div className="font-display font-semibold text-[13px] text-white">
                  Parameters Requiring Further Investigation Prior to Flight Selection
                </div>
                <ul className="space-y-1.5 text-[12px] text-slate-300 leading-relaxed">
                  {tradeOff.parametersRequiringInvestigation.map((item, idx) => (
                    <li key={idx}>• {item}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
