import React, { useState } from 'react';
import {
  Compass,
  Layers,
  Mountain,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  ShieldAlert,
  Route,
  Radio,
  ExternalLink,
  Sliders,
} from 'lucide-react';
import { TOPO_STYLE } from '../../constants/topoStyle.js';
import {
  SOUTH_POLE_SCIENTIFIC_LAYERS,
  PROVENANCE_BADGES,
} from '../../data/nasaProvenance.js';

/**
 * SouthPoleLegendHUD
 * Cartographic collar legend & 9-Layer Scientific Layer Selector for the
 * 2D Lunar South Pole Topographic Map (80°S–90°S).
 */
export default function SouthPoleLegendHUD({
  selectedLocation,
  contourInterval = 200,
  indexInterval = 1000,
  activeRenderMode = 'svs-5127',
  onSelectRenderMode,
  rasterOpacity = 1.0,
  onChangeRasterOpacity,
  showContours = true,
  onToggleContours,
  showSlopeHazard = true,
  onToggleSlopeHazard,
  showTraverses = true,
  onToggleTraverses,
  showRidges = true,
  onToggleRidges,
  showPsrs = true,
  onTogglePsrs,
  showDsnLink = false,
  onToggleDsnLink,
  showLandmarks = true,
  onToggleLandmarks,
  selectedFeature,
  onSwitchTo3D,
}) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [activeTab, setActiveTab] = useState('layers'); // 'layers' | 'legend' | 'metadata'

  const elevValue =
    selectedLocation?.elevation ?? selectedFeature?.elevationMeters ?? null;
  const slopeValue =
    selectedLocation?.slope ?? selectedFeature?.slopeDeg ?? null;

  const isOutOfDemBounds =
    selectedLocation?.isOutOfDemBounds ||
    (selectedLocation?.lat != null && selectedLocation.lat > -79.9);

  const activeLayerMeta =
    SOUTH_POLE_SCIENTIFIC_LAYERS.find((l) => l.renderMode === activeRenderMode) ||
    SOUTH_POLE_SCIENTIFIC_LAYERS[0];

  const activeProvenance =
    PROVENANCE_BADGES[activeLayerMeta.provenance] ||
    PROVENANCE_BADGES.NASA_MEASURED;

  const rasterLayers = SOUTH_POLE_SCIENTIFIC_LAYERS.filter(
    (l) => l.type !== 'vector'
  );

  return (
    <div className="absolute top-14 sm:top-16 left-14 sm:left-16 z-20 pointer-events-auto select-none w-[310px] sm:w-[356px] max-w-[calc(100vw-4.5rem)]">
      <div className="rounded-xl border border-slate-800/95 bg-[#070C15]/95 shadow-[0_16px_40px_rgba(0,0,0,0.85)] backdrop-blur-xl p-3 text-slate-100 transition-all">
        {/* Header Collar */}
        <div className="flex items-center justify-between pb-2 border-b border-slate-800 gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 border border-cyan-500/30 bg-cyan-500/10 text-cyan-400">
              <Compass className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="text-[11px] font-mono tracking-wider uppercase font-bold flex items-center gap-1.5 text-cyan-300">
                <span>South Pole 2D GIS</span>
                <span className="text-[9px] font-mono px-1.5 py-0.2 rounded border border-cyan-500/30 bg-cyan-950/60 text-cyan-200">
                  80°S–90°S
                </span>
              </div>
              <div className="text-[9.5px] font-mono truncate text-slate-400">
                {activeLayerMeta.name} · {activeLayerMeta.resolution}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            aria-label={isExpanded ? 'Collapse map legend' : 'Expand map legend'}
            className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800/80 transition-colors shrink-0"
            title={isExpanded ? 'Collapse Collar' : 'Expand Collar'}
          >
            {isExpanded ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </button>
        </div>

        {isExpanded && (
          <div className="mt-2.5 space-y-2.5">
            {/* Active Layer Quantitative Color Ramp & Provenance */}
            <div className="space-y-1.5 bg-[#0B1220] p-2.5 rounded-lg border border-slate-800/90">
              <div className="flex items-center justify-between gap-1 text-[10px] font-mono">
                <span className="font-semibold text-white truncate">
                  {activeLayerMeta.name}
                </span>
                <span
                  className={`text-[8.5px] px-1.5 py-0.5 rounded border font-bold shrink-0 ${activeProvenance.className}`}
                >
                  {activeProvenance.shortLabel}
                </span>
              </div>

              <div
                className="h-2.5 w-full rounded-sm border border-white/15"
                style={{
                  background:
                    activeLayerMeta.gradientCss ||
                    TOPO_STYLE.svs5127.gradientCss,
                }}
              />

              <div className="flex justify-between text-[8.5px] font-mono text-slate-400 tabular-nums">
                {(
                  activeLayerMeta.legendLabels || [
                    '-6k m',
                    '-3k m',
                    '0 m',
                    '+3k m',
                    '+6k m',
                  ]
                ).map((lbl, idx) => (
                  <span key={idx}>{lbl}</span>
                ))}
              </div>

              <div className="pt-1 border-t border-slate-800/80 flex items-center justify-between text-[9px] font-mono text-slate-400">
                <span>Units: {activeLayerMeta.units}</span>
                <span>{activeLayerMeta.resolution}</span>
              </div>
            </div>

            {/* Tab Switcher */}
            <div
              role="tablist"
              aria-label="South Pole Map Controls"
              className="grid grid-cols-3 rounded-lg p-0.5 border border-slate-800 bg-[#0B1220] text-[10px] font-mono"
            >
              <button
                role="tab"
                type="button"
                aria-selected={activeTab === 'layers'}
                onClick={() => setActiveTab('layers')}
                className={`py-1 px-2 rounded-md transition-all text-center ${
                  activeTab === 'layers'
                    ? 'bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/40'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                9 Map Layers
              </button>
              <button
                role="tab"
                type="button"
                aria-selected={activeTab === 'legend'}
                onClick={() => setActiveTab('legend')}
                className={`py-1 px-2 rounded-md transition-all text-center ${
                  activeTab === 'legend'
                    ? 'bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/40'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Symbol Key
              </button>
              <button
                role="tab"
                type="button"
                aria-selected={activeTab === 'metadata'}
                onClick={() => setActiveTab('metadata')}
                className={`py-1 px-2 rounded-md transition-all text-center ${
                  activeTab === 'metadata'
                    ? 'bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/40'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Provenance
              </button>
            </div>

            {/* TAB 1: 9 SCIENTIFIC LAYERS SELECTOR & OPACITY */}
            {activeTab === 'layers' && (
              <div className="space-y-2 max-h-[290px] overflow-y-auto custom-scrollbar pr-0.5">
                {/* Primary Raster Synthesis Selector (8 Scientific Raster Modes) */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[9.5px] font-mono uppercase tracking-wider text-slate-400">
                    <span>Scientific Surface Raster (Select 1)</span>
                    <span className="text-cyan-400 tabular-nums">
                      Opacity {Math.round(rasterOpacity * 100)}%
                    </span>
                  </div>

                  {/* Raster Opacity Slider */}
                  <div className="flex items-center gap-2 px-2 py-1 rounded bg-[#0B1220] border border-slate-800/80">
                    <Sliders className="w-3 h-3 text-cyan-400 shrink-0" />
                    <input
                      type="range"
                      min="0.25"
                      max="1"
                      step="0.05"
                      aria-label="Surface raster opacity"
                      value={rasterOpacity}
                      onChange={(e) =>
                        onChangeRasterOpacity?.( parseFloat(e.target.value) )
                      }
                      className="w-full h-1.5 accent-cyan-400 cursor-pointer"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-1 pt-0.5">
                    {rasterLayers.map((layer) => {
                      const isSelected = activeRenderMode === layer.renderMode;
                      return (
                        <button
                          key={layer.id}
                          type="button"
                          onClick={() => onSelectRenderMode?.(layer.renderMode)}
                          title={layer.description}
                          className={`px-2 py-1.5 rounded-lg border text-left font-mono transition-all ${
                            isSelected
                              ? 'bg-cyan-950/60 border-cyan-400 text-cyan-200 shadow-sm'
                              : 'bg-[#0B1220] border-slate-800/80 text-slate-300 hover:border-slate-700 hover:text-white'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-1">
                            <span className="text-[10px] font-semibold truncate">
                              {layer.number}. {layer.shortName}
                            </span>
                            {isSelected && (
                              <span className="text-[8px] text-cyan-300 font-bold">
                                ●
                              </span>
                            )}
                          </div>
                          <div className="text-[8.5px] text-slate-400 truncate mt-0.5">
                            {layer.resolution}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Vector & Hazard Overlays (Independent Toggles) */}
                <div className="pt-1.5 border-t border-slate-800 space-y-1 text-[10px] font-mono">
                  <div className="text-[9.5px] uppercase tracking-wider text-slate-400 mb-1">
                    Vector &amp; Hazard Overlays (Layer 5 + Aux)
                  </div>

                  <label className="flex items-center justify-between px-2 py-1.5 rounded-lg bg-[#0B1220] border border-slate-800/80 cursor-pointer hover:border-slate-700">
                    <span className="flex items-center gap-1.5 text-slate-200">
                      <Mountain className="w-3 h-3 text-cyan-400" />
                      <span>5. Craters, Rims &amp; Landmarks</span>
                    </span>
                    <input
                      type="checkbox"
                      checked={showLandmarks && showRidges}
                      onChange={() => {
                        const next = !(showLandmarks && showRidges);
                        onToggleLandmarks?.(next);
                        onToggleRidges?.(next);
                      }}
                      className="accent-cyan-400 w-3.5 h-3.5 cursor-pointer rounded"
                    />
                  </label>

                  <label className="flex items-center justify-between px-2 py-1.5 rounded-lg bg-[#0B1220] border border-slate-800/80 cursor-pointer hover:border-slate-700">
                    <span className="flex items-center gap-1.5 text-slate-200">
                      <Layers className="w-3 h-3 text-amber-400" />
                      <span>Elevation Contours ({contourInterval} m)</span>
                    </span>
                    <input
                      type="checkbox"
                      checked={showContours}
                      onChange={onToggleContours}
                      className="accent-amber-400 w-3.5 h-3.5 cursor-pointer rounded"
                    />
                  </label>

                  <label className="flex items-center justify-between px-2 py-1.5 rounded-lg bg-[#0B1220] border border-slate-800/80 cursor-pointer hover:border-slate-700">
                    <span className="flex items-center gap-1.5 text-slate-200">
                      <ShieldAlert className="w-3 h-3 text-rose-400" />
                      <span>Slope Hazard Tint (≥ 15.0°)</span>
                    </span>
                    <input
                      type="checkbox"
                      checked={showSlopeHazard}
                      onChange={onToggleSlopeHazard}
                      className="accent-rose-500 w-3.5 h-3.5 cursor-pointer rounded"
                    />
                  </label>

                  <label className="flex items-center justify-between px-2 py-1.5 rounded-lg bg-[#0B1220] border border-slate-800/80 cursor-pointer hover:border-slate-700">
                    <span className="flex items-center gap-1.5 text-slate-200">
                      <span className="w-2.5 h-2.5 rounded-full border border-sky-400 bg-sky-500/30 inline-block" />
                      <span>PSR Cold-Trap Footprints</span>
                    </span>
                    <input
                      type="checkbox"
                      checked={showPsrs}
                      onChange={onTogglePsrs}
                      className="accent-sky-400 w-3.5 h-3.5 cursor-pointer rounded"
                    />
                  </label>

                  <label className="flex items-center justify-between px-2 py-1.5 rounded-lg bg-[#0B1220] border border-slate-800/80 cursor-pointer hover:border-slate-700">
                    <span className="flex items-center gap-1.5 text-slate-200">
                      <Route className="w-3 h-3 text-amber-400" />
                      <span>Artemis / VIPER Traverses</span>
                    </span>
                    <input
                      type="checkbox"
                      checked={showTraverses}
                      onChange={onToggleTraverses}
                      className="accent-amber-400 w-3.5 h-3.5 cursor-pointer rounded"
                    />
                  </label>

                  <label className="flex items-center justify-between px-2 py-1.5 rounded-lg bg-[#0B1220] border border-slate-800/80 cursor-pointer hover:border-slate-700">
                    <span className="flex items-center gap-1.5 text-slate-200">
                      <Radio className="w-3 h-3 text-emerald-400" />
                      <span>Dynamic Earth LOS Vector</span>
                    </span>
                    <input
                      type="checkbox"
                      checked={showDsnLink}
                      onChange={onToggleDsnLink}
                      className="accent-emerald-400 w-3.5 h-3.5 cursor-pointer rounded"
                    />
                  </label>
                </div>
              </div>
            )}

            {/* TAB 2: CARTOGRAPHIC SYMBOL KEY */}
            {activeTab === 'legend' && (
              <div className="space-y-2 text-[10px] font-mono">
                <div className="rounded-lg p-2 bg-[#0B1220] border border-slate-800 flex items-center justify-between">
                  <div>
                    <span className="text-slate-400 block text-[9px] uppercase">
                      Contour Interval
                    </span>
                    <span className="font-bold text-xs text-cyan-300 tabular-nums">
                      {contourInterval} m
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-slate-400 block text-[9px] uppercase">
                      Index Interval (5th)
                    </span>
                    <span className="font-bold text-xs text-emerald-300 tabular-nums">
                      {indexInterval} m
                    </span>
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between py-1 px-2 rounded bg-[#0B1220]">
                    <span className="text-slate-200">Index Contour</span>
                    <span className="text-[9px] text-slate-400">
                      Solid white (1.3px)
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-1 px-2 rounded bg-[#0B1220]">
                    <span className="text-slate-200">Slope Hazard Zone</span>
                    <span className="text-[9px] text-rose-400 font-semibold">
                      ≥ 15.0° (Horn 3×3)
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-1 px-2 rounded bg-[#0B1220]">
                    <span className="text-slate-200">PSR Cold Trap</span>
                    <span className="text-[9px] text-sky-400">
                      LOLA &lt;110 K Basin
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-1 px-2 rounded bg-[#0B1220]">
                    <span className="text-slate-200">Earth LOS Corridor</span>
                    <span className="text-[9px] text-emerald-400">
                      Sub-Earth Meridian
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: PROVENANCE & DATUM */}
            {activeTab === 'metadata' && (
              <div className="space-y-2 text-[10px] font-mono">
                <div className="p-2.5 rounded-lg bg-[#0B1220] border border-slate-800 space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Dataset:</span>
                    <a
                      href="https://svs.gsfc.nasa.gov/5127/"
                      target="_blank"
                      rel="noreferrer"
                      className="text-cyan-400 hover:underline flex items-center gap-1 font-semibold"
                    >
                      NASA LOLA GDR / SVS 5127{' '}
                      <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Coverage:</span>
                    <span className="text-white">80°S to 90°S (±304 km)</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">CRS / Datum:</span>
                    <span className="text-emerald-300 font-semibold">
                      IAU Moon 2000 (R₀=1,737.4 km)
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Grid Resolution:</span>
                    <span className="text-white">240 m/px (20 m base GDR)</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Accuracy:</span>
                    <span className="text-cyan-300">
                      ±1.0 m vertical · ±20 m horiz
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* LIVE ALTIMETRY & SLOPE PROBE READOUT */}
            <div className="pt-2 border-t border-slate-800 text-[10px] font-mono space-y-1">
              {isOutOfDemBounds ? (
                <div className="p-2 rounded-lg bg-amber-950/40 border border-amber-800/60 text-amber-200 flex items-start gap-2">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-bold text-[10.5px]">
                      Outside 80°S–90°S Polar DEM
                    </div>
                    <div className="text-[9px] text-amber-300/80">
                      High-resolution 2D polar grid covers 80°S–90°S. No synthetic values shown.
                    </div>
                    {onSwitchTo3D && (
                      <button
                        type="button"
                        onClick={onSwitchTo3D}
                        className="mt-1.5 px-2 py-0.5 rounded bg-amber-800/60 hover:bg-amber-700/80 text-[9px] font-bold text-white transition-colors"
                      >
                        Switch to 3D Globe [1]
                      </button>
                    )}
                  </div>
                </div>
              ) : selectedLocation || selectedFeature ? (
                <div className="flex items-center justify-between">
                  <div className="min-w-0 pr-2">
                    <span className="text-slate-400 block text-[9px] truncate">
                      {selectedLocation?.name ||
                        selectedFeature?.name ||
                        'Sampled LOLA Position'}
                    </span>
                    <span className="text-white text-[9.5px] tabular-nums">
                      {selectedLocation?.lat != null
                        ? `${Math.abs(selectedLocation.lat).toFixed(3)}°S, ${
                            selectedLocation.lon >= 0
                              ? `${selectedLocation.lon.toFixed(3)}°E`
                              : `${Math.abs(selectedLocation.lon).toFixed(3)}°W`
                          }`
                        : 'Surface Coordinate'}
                    </span>
                  </div>
                  <div className="text-right shrink-0 tabular-nums">
                    <span className="text-xs font-bold block text-cyan-300">
                      {typeof elevValue === 'number'
                        ? `${elevValue > 0 ? '+' : ''}${elevValue.toLocaleString()} m`
                        : 'Coverage N/A'}
                    </span>
                    {typeof slopeValue === 'number' && (
                      <span
                        className={`text-[9.5px] font-bold ${
                          slopeValue >= 15 ? 'text-rose-400' : 'text-emerald-400'
                        }`}
                      >
                        Slope: {slopeValue.toFixed(1)}°
                        {slopeValue >= 15 ? ' (✖ Hazard)' : ' (● Safe)'}
                      </span>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between text-slate-400">
                  <span>Altimetry Probe:</span>
                  <span className="text-[9.5px] text-cyan-300">
                    Click surface to sample LOLA DEM
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
