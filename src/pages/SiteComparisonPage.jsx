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
    if (selectedLocations.length <= 2) {
      notifyWarn('Minimum 2 Locations Required', 'At least 2 locations must remain selected for comparison.');
      return;
    }
    setSelectedLocations((prev) => prev.filter((l) => l.id !== id));
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
    notifyInfo('Comparison Reset', 'Restored default 2-site 14-day comparison configuration.');
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
    <div className="flex-1 overflow-y-auto bg-[#060911] text-[#F1F5F9] px-4 sm:px-6 lg:px-8 py-5 space-y-5">
      {/* =================================================================== */}
      {/* 1. CONCISE PAGE HEADER (Section 9A)                                 */}
      {/* =================================================================== */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#162436] pb-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-white">
            Landing Site Comparison
          </h1>
          <p className="text-xs sm:text-sm text-[#94A3B8] mt-1">
            Evaluate lunar landing candidates across terrain, illumination, communication, thermal conditions, and mission duration.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={handleResetComparison}
            className="px-3.5 py-2 rounded-lg bg-[#0C1422] hover:bg-[#132035] border border-[#1E3148] text-xs font-medium text-slate-200 flex items-center gap-1.5 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
            <span>Reset Comparison</span>
          </button>

          <button
            type="button"
            onClick={handleExportPdf}
            disabled={isExportingPdf || evaluations.length < 2}
            className="px-4 py-2 rounded-lg bg-[#00D2C4] hover:bg-[#22E7D9] disabled:opacity-50 text-xs font-semibold text-[#060B13] flex items-center gap-2 transition-colors shadow-sm"
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
        className="p-4 rounded-xl bg-[#0A111D] border border-[#17263B] space-y-3.5"
      >
        <div className="flex flex-wrap items-center justify-between gap-4">
          {/* Mission Duration Selector: 7 / 14 / 28 Days */}
          <div className="flex flex-wrap items-center gap-3">
            <div>
              <span className="block text-[11px] font-medium text-slate-400 mb-1">
                Mission Duration
              </span>
              <div
                role="group"
                aria-label="Select Mission Duration"
                className="inline-flex items-center p-0.5 rounded-lg bg-[#060B13] border border-[#1B2C42]"
              >
                {MISSION_DURATIONS.map((d) => {
                  const isActive = durationDays === d.days;
                  return (
                    <button
                      key={d.days}
                      type="button"
                      onClick={() => setDurationDays(d.days)}
                      aria-pressed={isActive}
                      className={`px-3 py-1.5 rounded-md text-xs font-mono font-medium transition-colors ${
                        isActive
                          ? 'bg-[#00D2C4] text-[#060B13] font-semibold'
                          : 'text-slate-300 hover:text-white'
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
                className="block text-[11px] font-medium text-slate-400 mb-1"
              >
                Reference Touchdown Epoch (UTC)
              </label>
              <div className="flex flex-wrap items-center gap-1.5">
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
                  className="px-2.5 py-1.5 rounded-lg bg-[#060B13] border border-[#1B2C42] text-xs font-mono text-white focus:outline-none focus:border-[#00D2C4]"
                />
                <div className="hidden xl:flex items-center gap-1">
                  {EPOCH_PRESETS.map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => setReferenceEpochMs(preset.getMs())}
                      className="px-2 py-1.5 rounded-lg bg-[#060B13] hover:bg-[#111D30] border border-[#1B2C42] text-[11px] font-mono text-slate-300 transition-colors"
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
              className="text-xs font-mono font-semibold text-[#00D2C4] mr-1"
            >
              {selectedLocations.length} / 8 LOCATIONS SELECTED
            </span>

            {/* Method 1: Select Locations from 3D Lunar Map */}
            <button
              type="button"
              onClick={handleSelectLocationsFrom3DMap}
              className="px-3 py-1.5 rounded-lg bg-[#00D2C4]/15 hover:bg-[#00D2C4]/25 border border-[#00D2C4]/50 text-xs font-medium text-[#00D2C4] flex items-center gap-1.5 transition-colors"
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
              className="px-2.5 py-1.5 rounded-lg bg-[#060B13] border border-[#1B2C42] text-xs text-slate-200 focus:outline-none focus:border-[#00D2C4] disabled:opacity-40 max-w-[215px]"
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
              className="px-3 py-1.5 rounded-lg bg-[#060B13] hover:bg-[#111D30] border border-[#1B2C42] text-xs font-medium text-slate-200 flex items-center gap-1.5 disabled:opacity-40 transition-colors"
            >
              <Plus className="w-3.5 h-3.5 text-[#00D2C4]" />
              <span>Manual Coordinates</span>
            </button>

            {selectedLocations.length > 2 && (
              <button
                type="button"
                onClick={() => setSelectedLocations((prev) => prev.slice(0, 2))}
                className="px-2.5 py-1.5 rounded-lg bg-[#060B13] hover:bg-rose-950/40 border border-[#1B2C42] hover:border-rose-800/50 text-xs text-slate-400 hover:text-rose-300 transition-colors"
              >
                Keep First 2
              </button>
            )}
          </div>
        </div>

        {/* Manual Coordinate Entry Compact Form (Method 2) */}
        {isManualFormOpen && (
          <form
            onSubmit={handleManualSubmit}
            className="pt-3 border-t border-[#17263B] flex flex-wrap items-end gap-3"
          >
            <div>
              <label className="block text-[11px] text-slate-400 mb-1">
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
                className="w-36 px-2.5 py-1.5 rounded-lg bg-[#060B13] border border-[#1B2C42] text-xs font-mono text-white focus:outline-none focus:border-[#00D2C4]"
              />
            </div>

            <div>
              <label className="block text-[11px] text-slate-400 mb-1">
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
                className="w-36 px-2.5 py-1.5 rounded-lg bg-[#060B13] border border-[#1B2C42] text-xs font-mono text-white focus:outline-none focus:border-[#00D2C4]"
              />
            </div>

            <div>
              <label className="block text-[11px] text-slate-400 mb-1">
                Location Name (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. Ridge Alpha"
                value={manualName}
                onChange={(e) => setManualName(e.target.value)}
                className="w-48 px-2.5 py-1.5 rounded-lg bg-[#060B13] border border-[#1B2C42] text-xs text-white focus:outline-none focus:border-[#00D2C4]"
              />
            </div>

            <div className="flex items-center gap-2">
              <button
                type="submit"
                className="px-3.5 py-1.5 rounded-lg bg-[#00D2C4] hover:bg-[#22E7D9] text-xs font-semibold text-[#060B13] transition-colors"
              >
                Validate &amp; Add Location
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsManualFormOpen(false);
                  setManualError(null);
                }}
                className="px-2.5 py-1.5 rounded-lg bg-[#060B13] border border-[#1B2C42] text-xs text-slate-400 hover:text-white"
              >
                Cancel
              </button>
            </div>

            {manualError && (
              <div
                role="alert"
                className="w-full text-xs font-mono text-rose-400 flex items-center gap-1.5 pt-1"
              >
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                <span>{manualError}</span>
              </div>
            )}
          </form>
        )}

        {/* Compact Configuration Summary Bar (Section 2) */}
        <div className="pt-2.5 border-t border-[#17263B]/80 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400 font-mono">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span>
              Duration: <strong className="text-slate-200">{durationDays} Days ({durationDays * 24}h)</strong>
            </span>
            <span aria-hidden="true">·</span>
            <span>
              Epoch: <strong className="text-slate-200">{new Date(referenceEpochMs).toISOString().slice(0, 16).replace('T', ' ')} UTC</strong>
            </span>
            <span aria-hidden="true">·</span>
            <span>
              Locations: <strong className="text-slate-200">{selectedLocations.length} active</strong>
            </span>
            <span aria-hidden="true">·</span>
            <span>
              Datasets: <strong className="text-slate-200">LRO LOLA 400 m/px Polar DEM, DE421/Meeus Ephemeris, Analytical Thermal</strong>
            </span>
          </div>
          <div className="text-emerald-400">
            Calculation Status: Synchronized ({evaluations.length} sites × {Math.round((durationDays * 24) / 2)} time-steps)
          </div>
        </div>
      </section>

      {/* =================================================================== */}
      {/* 3. COMPACT SELECTED LOCATIONS BAR (Section 1A/C & Section 9C)       */}
      {/* =================================================================== */}
      <section aria-label="Selected Locations" className="space-y-2">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
          {evaluations.map((ev, idx) => {
            const loc = selectedLocations[idx];
            const palette = COMPARISON_SITE_PALETTE[idx % COMPARISON_SITE_PALETTE.length];
            const isEditing = editingLocationId === loc.id;

            return (
              <div
                key={loc.id}
                className="px-3.5 py-2.5 rounded-xl bg-[#0A111D] border border-[#17263B] flex flex-col justify-between gap-2"
              >
                {isEditing ? (
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      aria-label="Edit location name"
                      className="w-full px-2 py-1 rounded bg-[#060B13] border border-[#1E324A] text-xs text-white"
                    />
                    <div className="grid grid-cols-2 gap-1.5">
                      <input
                        type="text"
                        value={editLat}
                        onChange={(e) => setEditLat(e.target.value)}
                        aria-label="Edit latitude"
                        placeholder="Lat (°)"
                        className="px-2 py-1 rounded bg-[#060B13] border border-[#1E324A] text-xs font-mono text-white"
                      />
                      <input
                        type="text"
                        value={editLon}
                        onChange={(e) => setEditLon(e.target.value)}
                        aria-label="Edit longitude"
                        placeholder="Lon (°)"
                        className="px-2 py-1 rounded bg-[#060B13] border border-[#1E324A] text-xs font-mono text-white"
                      />
                    </div>
                    {editError && (
                      <p className="text-[10.5px] font-mono text-rose-400">{editError}</p>
                    )}
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleSaveEditLocation(loc.id)}
                        className="px-2 py-1 rounded bg-[#00D2C4] text-[#060B13] text-[11px] font-semibold flex items-center gap-1"
                      >
                        <Check className="w-3 h-3" /> Save
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingLocationId(null);
                          setEditError(null);
                        }}
                        className="px-2 py-1 rounded bg-[#060B13] border border-[#1E324A] text-[11px] text-slate-400"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className="w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-mono font-bold text-[#060B13] shrink-0"
                          style={{ backgroundColor: palette.hex }}
                        >
                          {idx + 1}
                        </span>
                        <div className="min-w-0">
                          <div className="text-xs font-semibold text-white truncate" title={ev.name}>
                            {ev.name}
                          </div>
                          <div className="text-[11px] font-mono text-slate-400">
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
                          <MoveLeft className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleReorderLocation(idx, 1)}
                          disabled={idx === selectedLocations.length - 1}
                          title="Move later"
                          aria-label={`Move ${ev.name} right`}
                          className="p-1 text-slate-500 hover:text-slate-200 disabled:opacity-25"
                        >
                          <MoveRight className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleStartEditLocation(loc)}
                          title="Rename or edit coordinates"
                          aria-label={`Edit ${ev.name}`}
                          className="p-1 text-slate-400 hover:text-white"
                        >
                          <Edit3 className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (onSelectSiteForView) onSelectSiteForView(loc);
                            if (onNavigate) onNavigate('explorer');
                          }}
                          title="Inspect location on 3D/2D Lunar Map"
                          aria-label={`View ${ev.name} on map`}
                          className="p-1 text-slate-400 hover:text-[#00D2C4]"
                        >
                          <Compass className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          disabled={selectedLocations.length <= 2}
                          onClick={() => handleRemoveLocation(loc.id)}
                          title={
                            selectedLocations.length <= 2
                              ? 'Minimum 2 locations required'
                              : 'Remove location'
                          }
                          aria-label={`Remove ${ev.name}`}
                          className="p-1 text-slate-400 hover:text-rose-400 disabled:opacity-25 disabled:pointer-events-none"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[11px] pt-1 border-t border-[#152236]">
                      <span
                        className={`font-mono ${
                          ev.completenessStatus === 'Complete'
                            ? 'text-emerald-400'
                            : ev.completenessStatus === 'Partially Available'
                            ? 'text-amber-300'
                            : 'text-rose-400'
                        }`}
                        title={ev.completenessDetail}
                      >
                        Data: {ev.completenessStatus}
                      </span>
                      <span className="font-mono text-slate-400">
                        {ev.suitability.overallSuitability !== null
                          ? `Score: ${ev.suitability.overallSuitability}/100`
                          : 'Unscored (Partial)'}
                      </span>
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* =================================================================== */}
      {/* 4. COMPACT EVIDENCE-BASED MISSION TRADE-OFF SUMMARY (Section 7/9D)  */}
      {/* =================================================================== */}
      <section
        aria-label="Mission Trade-Off Summary"
        className="p-4 rounded-xl bg-[#0A111D] border border-[#17263B] space-y-3"
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 pb-2.5 border-b border-[#162436]">
          <div className="flex items-center gap-2">
            {tradeOff.hasDefensibleWinner ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            )}
            <h2 className="text-sm font-semibold text-white">
              {tradeOff.recommendationTitle}
            </h2>
          </div>
          <span className="text-[11px] font-mono text-slate-400">
            Mission Trade-Off Verdict · {durationDays}-Day Window
          </span>
        </div>

        {tradeOff.recommendationRationale && (
          <p className="text-xs text-slate-300 leading-relaxed">
            {tradeOff.recommendationRationale}
          </p>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pt-1">
          {/* Significant Quantitative Differences */}
          <div className="space-y-1.5">
            <h3 className="text-xs font-semibold text-slate-200">
              Evidence-Based Parameter Differences
            </h3>
            <ul className="space-y-1 text-xs text-slate-300">
              {tradeOff.keyDifferences.map((diff, i) => (
                <li key={i} className="leading-relaxed">
                  • {diff}
                </li>
              ))}
            </ul>
          </div>

          {/* Critical Risks & Data Limitations */}
          <div className="space-y-1.5">
            <h3 className="text-xs font-semibold text-slate-200">
              Operational Risks &amp; Data Coverage Limitations
            </h3>
            <ul className="space-y-1 text-xs text-slate-300">
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
        className="rounded-xl bg-[#0A111D] border border-[#17263B] flex flex-col overflow-hidden"
      >
        {/* Matrix Control Bar */}
        <div className="p-3.5 border-b border-[#17263B] bg-[#080E18] flex flex-wrap items-center justify-between gap-3">
          {/* Category Filter Tabs */}
          <div className="flex flex-wrap items-center gap-1">
            {PARAMETER_CATEGORIES.map((cat) => {
              const isActive = activeCategoryFilter === cat;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setActiveCategoryFilter(cat)}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                    isActive
                      ? 'bg-[#00D2C4] text-[#060B13] font-semibold'
                      : 'text-slate-400 hover:text-white hover:bg-[#101B2D]'
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
              <div className="inline-flex items-center p-0.5 rounded-lg bg-[#060B13] border border-[#1B2C42] text-xs">
                <button
                  type="button"
                  onClick={() => setMatrixMode('standard')}
                  className={`px-2.5 py-1 rounded-md transition-colors ${
                    matrixMode === 'standard'
                      ? 'bg-[#152438] text-white font-medium'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Core (10 Cols)
                </button>
                <button
                  type="button"
                  onClick={() => setMatrixMode('detailed')}
                  className={`px-2.5 py-1 rounded-md transition-colors ${
                    matrixMode === 'detailed'
                      ? 'bg-[#152438] text-white font-medium'
                      : 'text-slate-400 hover:text-white'
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
              className={`px-2.5 py-1 rounded-lg border text-xs transition-colors ${
                highlightExtrema
                  ? 'bg-emerald-950/40 border-emerald-600/50 text-emerald-300'
                  : 'bg-[#060B13] border-[#1B2C42] text-slate-400 hover:text-white'
              }`}
            >
              {highlightExtrema ? 'Extrema Highlighted' : 'Highlight Best/Worst'}
            </button>

            {/* Show/Hide Parameters Dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsParamFilterOpen((prev) => !prev)}
                className="px-2.5 py-1 rounded-lg bg-[#060B13] hover:bg-[#111D30] border border-[#1B2C42] text-xs text-slate-300 flex items-center gap-1.5"
              >
                <SlidersHorizontal className="w-3.5 h-3.5 text-[#00D2C4]" />
                <span>Columns ({visibleColumns.length})</span>
              </button>

              {isParamFilterOpen && (
                <div className="absolute right-0 top-full mt-1.5 w-72 max-h-80 overflow-y-auto bg-[#080E18] border border-[#1E324A] rounded-xl shadow-2xl p-3 z-40 space-y-2">
                  <div className="flex items-center justify-between text-xs pb-1.5 border-b border-[#17263B]">
                    <span className="font-semibold text-white">Show / Hide Parameters</span>
                    <button
                      type="button"
                      onClick={() => setHiddenParamIds(new Set())}
                      className="text-[11px] text-[#00D2C4] hover:underline"
                    >
                      Reset All
                    </button>
                  </div>
                  {COMPARISON_PARAMETER_DEFINITIONS.map((param) => {
                    const isChecked = !hiddenParamIds.has(param.id);
                    return (
                      <label
                        key={param.id}
                        className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer hover:text-white py-0.5"
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
                          className="rounded border-slate-600 accent-[#00D2C4]"
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
              className="px-2.5 py-1 rounded-lg bg-[#060B13] hover:bg-[#111D30] border border-[#1B2C42] text-xs text-slate-300 flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5 text-[#00D2C4]" />
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        {/* Active Parameter Provenance Banner (when user clicks a column's info icon) */}
        {activeProvenanceDef && (
          <div className="px-4 py-3 bg-[#0D1829] border-b border-[#1E3554] flex items-start justify-between gap-4 text-xs">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <strong className="text-[#00D2C4] font-mono">
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
            className="w-full border-collapse text-left font-mono text-xs"
          >
            <thead className="sticky top-0 z-20 bg-[#080E18] border-b border-[#1B2C42]">
              <tr>
                {/* Sticky First Column Header: Landing Site */}
                <th
                  scope="col"
                  className="sticky left-0 z-30 bg-[#080E18] py-3 px-4 min-w-[210px] max-w-[240px] border-r border-[#1B2C42] font-sans text-xs font-semibold text-white"
                >
                  Landing Site
                </th>

                {visibleColumns.map((col) => {
                  const isSorted = sortConfig.paramId === col.id;
                  return (
                    <th
                      key={col.id}
                      scope="col"
                      className="py-3 px-3.5 min-w-[155px] border-r border-[#142033] last:border-r-0 align-top bg-[#080E18]"
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
                          className={`text-left font-sans font-semibold text-slate-200 leading-snug flex items-center gap-1 ${
                            col.sortable ? 'hover:text-[#00D2C4] cursor-pointer' : 'cursor-default'
                          }`}
                        >
                          <span>{col.shortLabel}</span>
                          {col.sortable && (
                            <span className="text-slate-500 shrink-0">
                              {isSorted ? (
                                sortConfig.direction === 'asc' ? (
                                  <ArrowUp className="w-3 h-3 text-[#00D2C4]" />
                                ) : (
                                  <ArrowDown className="w-3 h-3 text-[#00D2C4]" />
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
                          className={`p-0.5 rounded hover:text-[#00D2C4] shrink-0 ${
                            activeProvenanceParamId === col.id
                              ? 'text-[#00D2C4]'
                              : 'text-slate-500'
                          }`}
                        >
                          <Info className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <div className="text-[10px] font-mono text-slate-500 mt-0.5">
                        {col.unit} · {col.category}
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>

            <tbody className="divide-y divide-[#142033]">
              {sortedEvaluationsWithIndex.map(({ ev, originalIndex, palette }, rowIdx) => {
                const rowBg = rowIdx % 2 === 0 ? 'bg-[#0A111D]' : 'bg-[#0C1524]';

                return (
                  <tr
                    key={ev.id}
                    className={`${rowBg} hover:bg-[#111E33] transition-colors`}
                  >
                    {/* Sticky First Column: Landing Site Name & Identifier */}
                    <th
                      scope="row"
                      className={`sticky left-0 z-10 ${rowBg} py-3 px-4 border-r border-[#1B2C42] font-sans align-top`}
                    >
                      <div className="flex items-start gap-2.5">
                        <span
                          className="w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-mono font-bold text-[#060B13] shrink-0 mt-0.5"
                          style={{ backgroundColor: palette.hex }}
                        >
                          {originalIndex + 1}
                        </span>
                        <div className="min-w-0">
                          <div className="text-xs font-semibold text-white leading-snug break-words">
                            {ev.name}
                          </div>
                          <div className="text-[10.5px] font-mono text-slate-400 mt-0.5">
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

                      let textColorClass = 'text-slate-100';
                      if (cell.isUnavailable) {
                        textColorClass = 'text-slate-500 italic';
                      } else if (cell.status === 'favorable') {
                        textColorClass = 'text-emerald-300';
                      } else if (cell.status === 'conditional') {
                        textColorClass = 'text-amber-300';
                      } else if (cell.status === 'unfavorable') {
                        textColorClass = 'text-rose-300';
                      }

                      return (
                        <td
                          key={col.id}
                          className={`py-3 px-3.5 border-r border-[#142033] last:border-r-0 align-top tabular-nums ${
                            isBest
                              ? 'bg-emerald-950/20'
                              : isWorst
                              ? 'bg-rose-950/15'
                              : ''
                          }`}
                        >
                          <div className="flex items-center justify-between gap-1.5">
                            <span className={`font-semibold ${textColorClass}`}>
                              {cell.text}
                            </span>
                            {/* Non-color-only explicit status tags */}
                            {isBest && (
                              <span className="text-[9.5px] font-mono font-bold text-emerald-400 shrink-0">
                                [BEST]
                              </span>
                            )}
                            {isWorst && !isBest && (
                              <span className="text-[9.5px] font-mono text-rose-400 shrink-0">
                                [LOW]
                              </span>
                            )}
                          </div>
                          {cell.subtext && (
                            <div className="text-[10.5px] text-slate-400 mt-0.5 leading-tight">
                              {cell.subtext}
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* =================================================================== */}
      {/* 6. EXPANDABLE DETAILED SCIENTIFIC ANALYSIS SECTIONS (Section 9F)    */}
      {/* =================================================================== */}
      <section aria-label="Detailed Parameter Investigation" className="space-y-2.5 pb-6">
        <h2 className="text-sm font-semibold text-slate-200">
          Detailed Scientific Breakdown &amp; Methodology
        </h2>

        {/* 1. Solar & Energy Analysis */}
        <div className="rounded-xl bg-[#0A111D] border border-[#17263B] overflow-hidden">
          <button
            type="button"
            onClick={() => toggleSection('solar')}
            aria-expanded={openSections.solar}
            className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-[#0E1829] transition-colors"
          >
            <div>
              <span className="text-xs font-semibold text-white">
                1. Solar &amp; Energy Analysis ({durationDays}-Day Integration)
              </span>
              <span className="block text-[11px] text-slate-400">
                Solar elevation extrema, cumulative sunlight/darkness hours, longest shadow streaks, and charging windows.
              </span>
            </div>
            {openSections.solar ? (
              <ChevronDown className="w-4 h-4 text-[#00D2C4]" />
            ) : (
              <ChevronRight className="w-4 h-4 text-slate-400" />
            )}
          </button>

          {openSections.solar && (
            <div className="p-4 border-t border-[#17263B] overflow-x-auto space-y-3">
              <table className="w-full text-left font-mono text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[#17263B] text-slate-400">
                    <th className="py-2 pr-3">Landing Site</th>
                    <th className="py-2 px-3">Touchdown Sun Elev.</th>
                    <th className="py-2 px-3">Min / Max Sun Elev.</th>
                    <th className="py-2 px-3">Illumination (%)</th>
                    <th className="py-2 px-3">Sunlight / Darkness (h)</th>
                    <th className="py-2 px-3">Longest Dark Streak</th>
                    <th className="py-2 px-3">Mean Flux Factor</th>
                    <th className="py-2 pl-3">Power Opportunities &amp; Stability</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#142033]">
                  {evaluations.map((ev, idx) => (
                    <tr key={ev.id}>
                      <td className="py-2 pr-3 font-sans font-semibold text-white">
                        #{idx + 1} {ev.name}
                      </td>
                      <td className="py-2 px-3">{ev.solar.touchdownElevationDeg.toFixed(2)}°</td>
                      <td className="py-2 px-3">
                        {ev.solar.minElevationDeg.toFixed(1)}° / {ev.solar.maxElevationDeg.toFixed(1)}°
                      </td>
                      <td className="py-2 px-3 text-amber-300 font-semibold">
                        {ev.solar.solarIlluminationPct.toFixed(1)}%
                      </td>
                      <td className="py-2 px-3">
                        {ev.solar.totalSunlightHours}h lit / {ev.solar.totalDarknessHours}h dark
                      </td>
                      <td className="py-2 px-3">{ev.solar.longestContinuousDarkHours} h</td>
                      <td className="py-2 px-3">{ev.solar.solarPowerPotentialPct.toFixed(1)}%</td>
                      <td className="py-2 pl-3 text-slate-300">{ev.solar.powerOpportunitiesLabel}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* 2. Communication & Visibility */}
        <div className="rounded-xl bg-[#0A111D] border border-[#17263B] overflow-hidden">
          <button
            type="button"
            onClick={() => toggleSection('comm')}
            aria-expanded={openSections.comm}
            className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-[#0E1829] transition-colors"
          >
            <div>
              <span className="text-xs font-semibold text-white">
                2. Communication &amp; Visibility ({durationDays}-Day Libration Sweep)
              </span>
              <span className="block text-[11px] text-slate-400">
                Topocentric Earth elevation, terrain clearance margin, communication window counts, and blackout durations.
              </span>
            </div>
            {openSections.comm ? (
              <ChevronDown className="w-4 h-4 text-[#00D2C4]" />
            ) : (
              <ChevronRight className="w-4 h-4 text-slate-400" />
            )}
          </button>

          {openSections.comm && (
            <div className="p-4 border-t border-[#17263B] overflow-x-auto space-y-3">
              <table className="w-full text-left font-mono text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[#17263B] text-slate-400">
                    <th className="py-2 pr-3">Landing Site</th>
                    <th className="py-2 px-3">Visibility Regime</th>
                    <th className="py-2 px-3">Earth Elev. (t₀ / Range)</th>
                    <th className="py-2 px-3">DTE Availability</th>
                    <th className="py-2 px-3">Comm Windows</th>
                    <th className="py-2 px-3">Total Comm Hours</th>
                    <th className="py-2 pl-3">Max Blackout Duration</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#142033]">
                  {evaluations.map((ev, idx) => (
                    <tr key={ev.id}>
                      <td className="py-2 pr-3 font-sans font-semibold text-white">
                        #{idx + 1} {ev.name}
                      </td>
                      <td className="py-2 px-3">{ev.communication.earthVisibilityLabel}</td>
                      <td className="py-2 px-3">
                        {ev.communication.touchdownElevationDeg.toFixed(2)}° ({ev.communication.minElevationDeg.toFixed(1)}° to {ev.communication.maxElevationDeg.toFixed(1)}°)
                      </td>
                      <td className="py-2 px-3 text-cyan-300 font-semibold">
                        {ev.communication.earthVisibilityPct.toFixed(1)}%
                      </td>
                      <td className="py-2 px-3">{ev.communication.commWindowsCount} window(s)</td>
                      <td className="py-2 px-3">{ev.communication.totalCommHours} h</td>
                      <td className="py-2 pl-3">{ev.communication.maxBlackoutHours} h</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="text-[11px] text-slate-400">
                Note: Geometric visibility indicates that the apparent Earth disc clears the local lunar horizon and terrain obstacles. Operational RF link availability also depends on lander antenna gimbal limits and Earth DSN ground station scheduling.
              </p>
            </div>
          )}
        </div>

        {/* 3. Terrain Characteristics */}
        <div className="rounded-xl bg-[#0A111D] border border-[#17263B] overflow-hidden">
          <button
            type="button"
            onClick={() => toggleSection('terrain')}
            aria-expanded={openSections.terrain}
            className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-[#0E1829] transition-colors"
          >
            <div>
              <span className="text-xs font-semibold text-white">
                3. Terrain Characteristics (NASA LRO LOLA DEM)
              </span>
              <span className="block text-[11px] text-slate-400">
                Surface elevation, Horn 3×3 slope gradient, 2 km RMS roughness, local relief, crater density status, and landing hazards.
              </span>
            </div>
            {openSections.terrain ? (
              <ChevronDown className="w-4 h-4 text-[#00D2C4]" />
            ) : (
              <ChevronRight className="w-4 h-4 text-slate-400" />
            )}
          </button>

          {openSections.terrain && (
            <div className="p-4 border-t border-[#17263B] overflow-x-auto space-y-3">
              <table className="w-full text-left font-mono text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[#17263B] text-slate-400">
                    <th className="py-2 pr-3">Landing Site</th>
                    <th className="py-2 px-3">Elevation (m)</th>
                    <th className="py-2 px-3">Slope (°)</th>
                    <th className="py-2 px-3">Roughness (RMS)</th>
                    <th className="py-2 px-3">Local Relief (2 km)</th>
                    <th className="py-2 px-3">Crater Density</th>
                    <th className="py-2 px-3">Classification</th>
                    <th className="py-2 pl-3">Identified Landing Hazards</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#142033]">
                  {evaluations.map((ev, idx) => (
                    <tr key={ev.id}>
                      <td className="py-2 pr-3 font-sans font-semibold text-white">
                        #{idx + 1} {ev.name}
                      </td>
                      <td className="py-2 px-3">
                        {ev.terrain.elevationM !== null
                          ? `${ev.terrain.elevationM >= 0 ? '+' : ''}${ev.terrain.elevationM.toLocaleString()} m`
                          : 'Data Not Available'}
                      </td>
                      <td className="py-2 px-3">
                        {ev.terrain.slopeDeg !== null
                          ? `${ev.terrain.slopeDeg.toFixed(1)}°`
                          : 'Data Not Available'}
                      </td>
                      <td className="py-2 px-3">
                        {ev.terrain.roughnessM !== null
                          ? `${ev.terrain.roughnessM.toFixed(1)} m RMS`
                          : 'Data Not Available'}
                      </td>
                      <td className="py-2 px-3">
                        {ev.terrain.localReliefM !== null
                          ? `${ev.terrain.localReliefM.toFixed(0)} m`
                          : 'Data Not Available'}
                      </td>
                      <td className="py-2 px-3 text-slate-500 italic">Data Not Available</td>
                      <td className="py-2 px-3">{ev.terrain.terrainClassification}</td>
                      <td className="py-2 pl-3 text-slate-300">{ev.terrain.hazardSummary}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* 4. Thermal Analysis */}
        <div className="rounded-xl bg-[#0A111D] border border-[#17263B] overflow-hidden">
          <button
            type="button"
            onClick={() => toggleSection('thermal')}
            aria-expanded={openSections.thermal}
            className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-[#0E1829] transition-colors"
          >
            <div>
              <span className="text-xs font-semibold text-white">
                4. Thermal Analysis (Model-Derived Radiative Equilibrium)
              </span>
              <span className="block text-[11px] text-slate-400">
                Touchdown temperature, mission minimum/maximum temperature, diurnal variation ΔT, and cryogenic exposure hours.
              </span>
            </div>
            {openSections.thermal ? (
              <ChevronDown className="w-4 h-4 text-[#00D2C4]" />
            ) : (
              <ChevronRight className="w-4 h-4 text-slate-400" />
            )}
          </button>

          {openSections.thermal && (
            <div className="p-4 border-t border-[#17263B] overflow-x-auto space-y-3">
              <table className="w-full text-left font-mono text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[#17263B] text-slate-400">
                    <th className="py-2 pr-3">Landing Site</th>
                    <th className="py-2 px-3">Touchdown Temp</th>
                    <th className="py-2 px-3">Min Surface Temp</th>
                    <th className="py-2 px-3">Max Surface Temp</th>
                    <th className="py-2 px-3">Temp Swing (ΔT)</th>
                    <th className="py-2 px-3">Subsurface Eq.</th>
                    <th className="py-2 pl-3">Mission Thermal Exposure</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#142033]">
                  {evaluations.map((ev, idx) => (
                    <tr key={ev.id}>
                      <td className="py-2 pr-3 font-sans font-semibold text-white">
                        #{idx + 1} {ev.name}
                      </td>
                      <td className="py-2 px-3">
                        {ev.thermal.touchdownTempC}°C ({ev.thermal.touchdownTempK} K)
                      </td>
                      <td className="py-2 px-3">
                        {ev.thermal.minTempC}°C ({ev.thermal.minTempK} K)
                      </td>
                      <td className="py-2 px-3">
                        {ev.thermal.maxTempC}°C ({ev.thermal.maxTempK} K)
                      </td>
                      <td className="py-2 px-3">Δ{ev.thermal.tempVariationC}°C</td>
                      <td className="py-2 px-3">{ev.thermal.subsurfaceTempC}°C</td>
                      <td className="py-2 pl-3">{ev.thermal.exposureSummary}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="text-[11px] text-slate-400">
                Provenance Distinction: Surface temperatures are Model-Derived using an analytical Stefan-Boltzmann radiative balance model parameterized by LRO Diviner literature (Vasavada et al. 2012; Paige et al. 2010) and coupled to local LOLA DEM shadow masks.
              </p>
            </div>
          )}
        </div>

        {/* 5. Mission Suitability */}
        <div className="rounded-xl bg-[#0A111D] border border-[#17263B] overflow-hidden">
          <button
            type="button"
            onClick={() => toggleSection('suitability')}
            aria-expanded={openSections.suitability}
            className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-[#0E1829] transition-colors"
          >
            <div>
              <span className="text-xs font-semibold text-white">
                5. Mission Suitability &amp; Scoring Methodology
              </span>
              <span className="block text-[11px] text-slate-400">
                Transparent component weights (35% Solar, 30% Comm, 20% Terrain, 15% Thermal) and completeness guards.
              </span>
            </div>
            {openSections.suitability ? (
              <ChevronDown className="w-4 h-4 text-[#00D2C4]" />
            ) : (
              <ChevronRight className="w-4 h-4 text-slate-400" />
            )}
          </button>

          {openSections.suitability && (
            <div className="p-4 border-t border-[#17263B] overflow-x-auto space-y-3">
              <div className="text-xs text-slate-300 font-mono bg-[#060B13] p-3 rounded-lg border border-[#16263B]">
                <strong>Documented Scoring Equation:</strong> Overall Suitability ={' '}
                {(SUITABILITY_WEIGHTS.solar * 100).toFixed(0)}% × Solar +{' '}
                {(SUITABILITY_WEIGHTS.communication * 100).toFixed(0)}% × Communication +{' '}
                {(SUITABILITY_WEIGHTS.terrain * 100).toFixed(0)}% × Terrain +{' '}
                {(SUITABILITY_WEIGHTS.thermal * 100).toFixed(0)}% × Thermal.{' '}
                <span className="text-slate-400">
                  If any component input (such as local terrain slope north of 80°S) is missing, Overall Suitability is reported as &ldquo;Insufficient Data for Scoring&rdquo; rather than substituting zero or re-normalizing partial weights.
                </span>
              </div>

              <table className="w-full text-left font-mono text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[#17263B] text-slate-400">
                    <th className="py-2 pr-3">Landing Site</th>
                    <th className="py-2 px-3">Solar (35%)</th>
                    <th className="py-2 px-3">Comm (30%)</th>
                    <th className="py-2 px-3">Terrain (20%)</th>
                    <th className="py-2 px-3">Thermal (15%)</th>
                    <th className="py-2 px-3">Overall Suitability</th>
                    <th className="py-2 pl-3">Derivation Breakdown</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#142033]">
                  {evaluations.map((ev, idx) => (
                    <tr key={ev.id}>
                      <td className="py-2 pr-3 font-sans font-semibold text-white">
                        #{idx + 1} {ev.name}
                      </td>
                      <td className="py-2 px-3">{ev.suitability.solarSuitability} / 100</td>
                      <td className="py-2 px-3">{ev.suitability.commSuitability} / 100</td>
                      <td className="py-2 px-3">
                        {ev.suitability.terrainSuitability !== null
                          ? `${ev.suitability.terrainSuitability} / 100`
                          : 'Data Not Available'}
                      </td>
                      <td className="py-2 px-3">{ev.suitability.thermalSuitability} / 100</td>
                      <td className="py-2 px-3 font-semibold text-[#00D2C4]">
                        {ev.suitability.overallSuitability !== null
                          ? `${ev.suitability.overallSuitability} / 100`
                          : 'Insufficient Data for Scoring'}
                      </td>
                      <td className="py-2 pl-3 text-slate-400">{ev.suitability.formulaExplanation}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* 6. Data Sources & Methodology */}
        <div className="rounded-xl bg-[#0A111D] border border-[#17263B] overflow-hidden">
          <button
            type="button"
            onClick={() => toggleSection('methodology')}
            aria-expanded={openSections.methodology}
            className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-[#0E1829] transition-colors"
          >
            <div>
              <span className="text-xs font-semibold text-white">
                6. Data Sources, Provenance &amp; Coverage Limitations
              </span>
              <span className="block text-[11px] text-slate-400">
                Complete registry of NASA PDS datasets, spatial/temporal resolutions, and parameters requiring further investigation.
              </span>
            </div>
            {openSections.methodology ? (
              <ChevronDown className="w-4 h-4 text-[#00D2C4]" />
            ) : (
              <ChevronRight className="w-4 h-4 text-slate-400" />
            )}
          </button>

          {openSections.methodology && (
            <div className="p-4 border-t border-[#17263B] space-y-4 text-xs">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {NASA_DATASETS_REGISTRY.map((ds) => (
                  <div
                    key={ds.id}
                    className="p-3 rounded-lg bg-[#060B13] border border-[#16263B] space-y-1"
                  >
                    <div className="font-semibold text-white">{ds.datasetName}</div>
                    <div className="text-[11px] font-mono text-[#00D2C4]">{ds.instrument}</div>
                    <div className="text-[11px] text-slate-400">
                      Resolution: {ds.spatialResolution} · Coverage: {ds.coverageArea}
                    </div>
                    <div className="text-[11px] text-slate-300">{ds.description}</div>
                  </div>
                ))}
              </div>

              <div className="p-3 rounded-lg bg-[#060B13] border border-[#16263B] space-y-1.5">
                <div className="font-semibold text-white">
                  Parameters Requiring Further Investigation Prior to Flight Selection
                </div>
                <ul className="space-y-1 text-slate-300">
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
