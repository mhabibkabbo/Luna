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
  Minus,
  Maximize2,
  X,
} from 'lucide-react';
import { TOPO_STYLE } from '../../constants/topoStyle.js';
import {
  SOUTH_POLE_SCIENTIFIC_LAYERS,
  PROVENANCE_BADGES,
} from '../../data/nasaProvenance.js';

export default function SouthPoleLegendHUD({
  isOpen = true,
  onClose,
  selectedLocation,
  contourInterval = 200,
  indexInterval = 1000,
  zoomLevel = 1,
  whiteOutlineMinZoom = 2,
  whiteOutlineStatus = null,
  greenConnectionStatus = null,
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
  const [isMinimized, setIsMinimized] = useState(false);
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

  if (isOpen === false) return null;

  if (isMinimized) {
    return (
      <div className="absolute top-4 left-14 sm:left-16 z-20 pointer-events-auto animate-in fade-in duration-150">
        <button
          type="button"
          onClick={() => setIsMinimized(false)}
          className="h-9 px-3 rounded-xl bg-[#050507]/95 hover:bg-[#14161D] border border-[#1E2028] hover:border-cyan-500/50 text-xs font-mono text-cyan-300 flex items-center gap-2.5 shadow-[0_12px_35px_rgba(0,0,0,0.85)] backdrop-blur-xl transition-all group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/70"
          title="Restore South Pole 2D GIS Layers & Legend"
          aria-label="Restore South Pole 2D GIS Layers & Legend"
        >
          <div className="w-5 h-5 rounded-md flex items-center justify-center border border-cyan-500/40 bg-cyan-500/10 text-cyan-400 group-hover:scale-105 transition-transform">
            <Layers className="w-3 h-3" />
          </div>
          <span className="font-semibold text-slate-100 group-hover:text-cyan-300">
            9 Map Layers
          </span>
          <span className="hidden sm:inline text-[9.5px] px-1.5 py-0.5 rounded border border-cyan-500/30 bg-cyan-950/60 text-cyan-200">
            South Pole Only · 80°S–90°S
          </span>
          <Maximize2 className="w-3.5 h-3.5 text-slate-400 group-hover:text-cyan-300 ml-0.5" />
        </button>
      </div>
    );
  }

  return (
    <div className="absolute top-4 sm:top-4 left-16 sm:left-16 z-20 pointer-events-auto w-[310px] sm:w-[356px] max-w-[calc(100vw-4.5rem)] max-h-[calc(100%-8rem)] flex flex-col animate-in fade-in duration-150">
      <div className="rounded-xl border border-slate-800/95 bg-[#050507]/95 shadow-[0_16px_40px_rgba(0,0,0,0.85)] backdrop-blur-xl p-3 text-slate-100 transition-all flex flex-col max-h-full overflow-hidden">
        <div className="flex items-center justify-between pb-2 border-b border-slate-800 gap-2 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 border border-cyan-500/30 bg-cyan-500/10 text-cyan-400">
              <Compass className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="text-[11px] font-mono tracking-wider uppercase font-bold flex items-center gap-1.5 text-cyan-300">
                <span>South Pole 2D GIS</span>
                <span className="text-[9px] font-mono px-1.5 py-0.5 rounded border border-amber-500/40 bg-amber-950/60 text-amber-200">
                  South Pole Only
                </span>
              </div>
              <div className="text-[9px] font-mono truncate text-slate-300">
                Lat: 80.0°S–90.0°S · Lon: 180.0°W–180.0°E (±304 km)
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => setIsExpanded((prev) => !prev)}
              aria-expanded={isExpanded}
              aria-label={isExpanded ? 'Collapse layers body' : 'Expand layers body'}
              title={isExpanded ? 'Collapse layers body' : 'Expand layers body'}
              className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800/80 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/70"
            >
              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
            <button
              type="button"
              onClick={() => setIsMinimized(true)}
              aria-label="Minimize map layers panel"
              title="Minimize map layers panel"
              className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800/80 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/70"
            >
              <Minus className="w-4 h-4" />
            </button>
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                aria-label="Close map layers panel"
                title="Close map layers panel"
                className="p-1 rounded-md text-slate-400 hover:text-rose-300 hover:bg-rose-500/15 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400/70"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {isExpanded && (
          <>
            <div className="mt-2.5 space-y-2.5 flex-1 min-h-0 overflow-y-auto custom-scrollbar pr-1">
            <div className="space-y-1.5 bg-[#0C0D12] p-2.5 rounded-lg border border-slate-800/90">
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

            <div
              role="tablist"
              aria-label="South Pole Map Controls"
              className="grid grid-cols-3 rounded-lg p-0.5 border border-slate-800 bg-[#0C0D12] text-[10px] font-mono"
            >
              <button
                id="sp-hud-tab-layers"
                role="tab"
                type="button"
                aria-selected={activeTab === 'layers'}
                onClick={() => setActiveTab('layers')}
                className={`py-1 px-2 rounded-md transition-all text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/70 ${
                  activeTab === 'layers'
                    ? 'bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/40'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                9 Map Layers
              </button>
              <button
                id="sp-hud-tab-legend"
                role="tab"
                type="button"
                aria-selected={activeTab === 'legend'}
                onClick={() => setActiveTab('legend')}
                className={`py-1 px-2 rounded-md transition-all text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/70 ${
                  activeTab === 'legend'
                    ? 'bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/40'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Symbol Key
              </button>
              <button
                id="sp-hud-tab-metadata"
                role="tab"
                type="button"
                aria-selected={activeTab === 'metadata'}
                onClick={() => setActiveTab('metadata')}
                className={`py-1 px-2 rounded-md transition-all text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/70 ${
                  activeTab === 'metadata'
                    ? 'bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/40'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Provenance
              </button>
            </div>

            {activeTab === 'layers' && (
              <div className="space-y-2 pr-0.5">
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[9.5px] font-mono uppercase tracking-wider text-slate-400">
                    <span>Scientific Surface Raster (Select 1)</span>
                    <span className="text-cyan-400 tabular-nums">
                      Opacity {Math.round(rasterOpacity * 100)}%
                    </span>
                  </div>

                  <div className="flex items-center gap-2 px-2 py-1 rounded bg-[#0C0D12] border border-slate-800/80">
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
                              : 'bg-[#0C0D12] border-slate-800/80 text-slate-300 hover:border-slate-700 hover:text-white'
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

                <div className="pt-1.5 border-t border-slate-800 space-y-1 text-[10px] font-mono">
                  <div className="text-[9.5px] uppercase tracking-wider text-slate-400 mb-1">
                    Vector &amp; Hazard Overlays (Layer 5 + Aux)
                  </div>

                  <label className="flex items-center justify-between px-2 py-1.5 rounded-lg bg-[#0C0D12] border border-slate-800/80 cursor-pointer hover:border-slate-700">
                    <span className="flex items-center gap-1.5 text-slate-200">
                      <Mountain className="w-3 h-3 text-cyan-400" />
                      <span>5. Landmarks &amp; Rim Outlines (Zoom ≥ {whiteOutlineMinZoom}x)</span>
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

                  <label className="flex items-center justify-between px-2 py-1.5 rounded-lg bg-[#0C0D12] border border-slate-800/80 cursor-pointer hover:border-slate-700">
                    <div className="flex flex-col min-w-0">
                      <span className="flex items-center gap-1.5 text-slate-200">
                        <Layers className="w-3 h-3 text-amber-400 shrink-0" />
                        <span className="truncate">White Elevation Outlines ({contourInterval} m)</span>
                      </span>
                      <span className="text-[8.5px] text-slate-400 pl-4">
                        {whiteOutlineStatus?.isVisible || zoomLevel >= whiteOutlineMinZoom
                          ? `Visible at Zoom ${Number(zoomLevel).toFixed(1)}x (≥ ${whiteOutlineMinZoom}.0x)`
                          : `Auto-hidden below Zoom ${whiteOutlineMinZoom}.0x (cur: ${Number(zoomLevel).toFixed(1)}x)`}
                      </span>
                    </div>
                    <input
                      type="checkbox"
                      checked={showContours}
                      onChange={onToggleContours}
                      className="accent-amber-400 w-3.5 h-3.5 cursor-pointer rounded shrink-0"
                    />
                  </label>

                  <label className="flex items-center justify-between px-2 py-1.5 rounded-lg bg-[#0C0D12] border border-slate-800/80 cursor-pointer hover:border-slate-700">
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

                  <label className="flex items-center justify-between px-2 py-1.5 rounded-lg bg-[#0C0D12] border border-slate-800/80 cursor-pointer hover:border-slate-700">
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

                  <label className="flex items-center justify-between px-2 py-1.5 rounded-lg bg-[#0C0D12] border border-slate-800/80 cursor-pointer hover:border-slate-700">
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

                  <label className="flex items-center justify-between px-2 py-1.5 rounded-lg bg-[#0C0D12] border border-slate-800/80 cursor-pointer hover:border-slate-700">
                    <div className="flex flex-col min-w-0">
                      <span className="flex items-center gap-1.5 text-slate-200">
                        <Radio className="w-3 h-3 text-emerald-400 shrink-0" />
                        <span className="truncate">Green Earth DSN Connection Line</span>
                      </span>
                      <span className="text-[8.5px] text-emerald-400/80 pl-4">
                        Independent scientific layer (all zoom levels)
                      </span>
                    </div>
                    <input
                      type="checkbox"
                      checked={showDsnLink}
                      onChange={onToggleDsnLink}
                      className="accent-emerald-400 w-3.5 h-3.5 cursor-pointer rounded shrink-0"
                    />
                  </label>
                </div>
              </div>
            )}

            {activeTab === 'legend' && (
              <div className="space-y-2 text-[10px] font-mono">
                <div className="rounded-lg p-2 bg-[#0C0D12] border border-slate-800 flex items-center justify-between">
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
                  <div className="flex items-center justify-between py-1 px-2 rounded bg-[#0C0D12]">
                    <span className="text-slate-200">White Outline Layer</span>
                    <span className="text-[9px] text-slate-400">
                      Shown at Zoom ≥ {whiteOutlineMinZoom}.0x
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-1 px-2 rounded bg-[#0C0D12]">
                    <span className="text-slate-200">Slope Hazard Zone</span>
                    <span className="text-[9px] text-rose-400 font-semibold">
                      ≥ 15.0° (Horn 3×3)
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-1 px-2 rounded bg-[#0C0D12]">
                    <span className="text-slate-200">PSR Cold Trap</span>
                    <span className="text-[9px] text-sky-400">
                      LOLA &lt;110 K Basin
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-1 px-2 rounded bg-[#0C0D12]">
                    <span className="text-slate-200">Green DSN Connection</span>
                    <span className="text-[9px] text-emerald-400">
                      Sub-Earth Meridian (All Zooms)
                    </span>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'metadata' && (
              <div className="space-y-2 text-[10px] font-mono">
                <div className="p-2.5 rounded-lg bg-[#0C0D12] border border-slate-800 space-y-1.5">
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
                    <span className="text-slate-400">Scope:</span>
                    <span className="text-amber-300 font-semibold">Lunar South Pole Only</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Latitude Range:</span>
                    <span className="text-white">80.0°S to 90.0°S (-80° to -90°)</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Longitude Range:</span>
                    <span className="text-white">180.0°W to 180.0°E (-180° to +180°)</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Planar Extent:</span>
                    <span className="text-white">±304 km × ±304 km</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">CRS / Datum:</span>
                    <span className="text-emerald-300 font-semibold">
                      IAU2015:30135 (R₀=1,737.4 km)
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Grid Resolution:</span>
                    <span className="text-white">400 m/px (0.5 m vertical unit)</span>
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
          </div>

          <div className="pt-2 mt-2 border-t border-slate-800 text-[10px] font-mono space-y-1 shrink-0">
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
        </>
      )}
      </div>
    </div>
  );
}
