import React, { useState } from 'react';
import {
  Compass,
  Layers,
  Mountain,
  ChevronDown,
  ChevronUp,
  MapPin,
  AlertTriangle,
  Navigation,
  Info,
  ShieldAlert,
  Route,
  Sun,
  Radio,
  ExternalLink,
} from 'lucide-react';
import { TOPO_STYLE } from '../../constants/topoStyle.js';

/**
 * SouthPoleLegendHUD
 * Authentic cartographic collar legend for the NASA SVS 5127
 * "Lunar South Pole Terrain in Coded Color" (80°S–90°S) map.
 * https://svs.gsfc.nasa.gov/5127/
 *
 * Positioned to the right of the vertical toolbar (left-16 sm:left-20).
 * Displays the NASA SVS 5127 elevation spectrum bar, adaptive contour intervals,
 * vector layer controls, real-time probe altimetry, and official NASA provenance.
 */
export default function SouthPoleLegendHUD({
  selectedLocation,
  contourInterval = 200,
  indexInterval = 1000,
  zoomLevel = 1,
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
  selectedFeature,
  onSwitchTo3D,
}) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [activeTab, setActiveTab] = useState('legend'); // 'legend' | 'layers' | 'metadata'

  const elevValue =
    selectedLocation?.elevation ?? selectedFeature?.elevationMeters ?? null;
  const slopeValue =
    selectedLocation?.slope ?? selectedFeature?.slopeDeg ?? null;

  const isOutOfDemBounds =
    selectedLocation?.isOutOfDemBounds ||
    (selectedLocation?.lat != null && selectedLocation.lat > -79.9);

  return (
    <div className="absolute top-4 left-16 sm:left-20 z-20 pointer-events-auto select-none w-[320px] sm:w-[364px] max-w-[calc(100vw-5rem)]">
      <div
        className="rounded-xl border shadow-[0_16px_40px_rgba(0,0,0,0.85)] backdrop-blur-xl p-3 transition-all"
        style={{
          backgroundColor: `${TOPO_STYLE.hud.panelBg}F5`,
          borderColor: TOPO_STYLE.hud.panelBorder,
          color: TOPO_STYLE.hud.textPrimary,
        }}
      >
        {/* Header Collar */}
        <div
          className="flex items-center justify-between pb-2 border-b gap-2"
          style={{ borderColor: `${TOPO_STYLE.hud.panelBorder}AA` }}
        >
          <div className="flex items-center gap-2 min-w-0">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 border"
              style={{
                backgroundColor: '#1E1B15',
                borderColor: '#3D3728',
                color: TOPO_STYLE.hud.accentTerracotta,
              }}
            >
              <Compass className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div
                className="text-[11px] font-mono tracking-wider uppercase font-bold flex items-center gap-1.5"
                style={{ color: TOPO_STYLE.hud.accentTerracotta }}
              >
                NASA SVS 5127 Topo
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              </div>
              <div
                className="text-[9.5px] font-mono truncate"
                style={{ color: TOPO_STYLE.hud.textMuted }}
              >
                LOLA Coded Color · 80°S–90°S
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1 rounded-md text-[#A8A193] hover:text-white hover:bg-[#221F18] transition-colors shrink-0"
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
          <div className="mt-2.5 space-y-3">
            {/* NASA SVS 5127 Elevation Color Bar (The Official NASA Elevation Spectrum) */}
            <div className="space-y-1.5 bg-[#171510] p-2 rounded-lg border border-[#2D281E]">
              <div className="flex items-center justify-between text-[10px] font-mono text-[#D4CEBF]">
                <span className="flex items-center gap-1 font-semibold text-[#E59A6D]">
                  <Mountain className="w-3 h-3 text-[#E59A6D]" /> Coded Elevation (SVS 5127)
                </span>
                <a
                  href="https://svs.gsfc.nasa.gov/5127/"
                  target="_blank"
                  rel="noreferrer"
                  className="text-[9px] text-sky-400 hover:text-sky-300 flex items-center gap-0.5 font-sans"
                >
                  NASA Page <ExternalLink className="w-2.5 h-2.5 inline" />
                </a>
              </div>
              <div
                className="h-2.5 w-full rounded-sm shadow-inner border border-white/20"
                style={{ background: TOPO_STYLE.svs5127.gradientCss }}
              />
              <div className="flex justify-between text-[8px] font-mono text-[#A8A193]">
                <span>-9k (Indigo)</span>
                <span>-3k (Cyan)</span>
                <span className="text-[#88B38A] font-bold">0m (Datum)</span>
                <span>+3k (Gold)</span>
                <span>+8k (White)</span>
              </div>
            </div>

            {/* Tab Switcher */}
            <div
              className="flex items-center rounded-lg p-0.5 border text-[10px] font-mono"
              style={{
                backgroundColor: '#181611',
                borderColor: TOPO_STYLE.hud.panelBorder,
              }}
            >
              <button
                type="button"
                onClick={() => setActiveTab('legend')}
                className={`flex-1 py-1 px-2 rounded-md transition-all text-center ${
                  activeTab === 'legend'
                    ? 'bg-[#2A251D] text-[#E59A6D] font-bold shadow-sm'
                    : 'text-[#A8A193] hover:text-[#F4EFE6]'
                }`}
              >
                Symbol Key
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('layers')}
                className={`flex-1 py-1 px-2 rounded-md transition-all text-center ${
                  activeTab === 'layers'
                    ? 'bg-[#2A251D] text-[#88B38A] font-bold shadow-sm'
                    : 'text-[#A8A193] hover:text-[#F4EFE6]'
                }`}
              >
                Layers
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('metadata')}
                className={`flex-1 py-1 px-2 rounded-md transition-all text-center ${
                  activeTab === 'metadata'
                    ? 'bg-[#2A251D] text-[#F4EFE6] font-bold shadow-sm'
                    : 'text-[#A8A193] hover:text-[#F4EFE6]'
                }`}
              >
                Provenance
              </button>
            </div>

            {/* TAB 1: CARTOGRAPHIC SYMBOL KEY */}
            {activeTab === 'legend' && (
              <div className="space-y-2.5">
                {/* Active Contour Intervals Badge */}
                <div
                  className="rounded-lg p-2 border flex items-center justify-between text-[10px] font-mono"
                  style={{
                    backgroundColor: '#171510',
                    borderColor: '#2D281E',
                  }}
                >
                  <div>
                    <span className="text-[#A8A193] block text-[9px] uppercase tracking-wide">
                      Contour Interval
                    </span>
                    <span
                      className="font-bold text-[12px]"
                      style={{ color: TOPO_STYLE.hud.accentTerracotta }}
                    >
                      {contourInterval} m
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-[#A8A193] block text-[9px] uppercase tracking-wide">
                      Index Interval (5th)
                    </span>
                    <span
                      className="font-bold text-[12px]"
                      style={{ color: TOPO_STYLE.hud.accentSage }}
                    >
                      {indexInterval} m
                    </span>
                  </div>
                </div>

                {/* Symbols Grid */}
                <div className="space-y-1.5 text-[10px] font-mono">
                  {/* Index Contour */}
                  <div className="flex items-center justify-between py-1 px-2 rounded bg-[#171510]/60">
                    <div className="flex items-center gap-2">
                      <div className="w-7 flex items-center justify-center">
                        <span className="inline-block w-6 h-[2px] bg-white rounded shadow-sm" />
                      </div>
                      <span className="text-[#D4CEBF]">Index Contour</span>
                    </div>
                    <span className="text-[9px] text-[#A8A193]">
                      Solid white with halo
                    </span>
                  </div>

                  {/* Intermediate Contour */}
                  <div className="flex items-center justify-between py-1 px-2 rounded bg-[#171510]/60">
                    <div className="flex items-center gap-2">
                      <div className="w-7 flex items-center justify-center">
                        <span className="inline-block w-6 h-[1px] bg-white/40" />
                      </div>
                      <span className="text-[#D4CEBF]">Intermediate</span>
                    </div>
                    <span className="text-[9px] text-[#A8A193]">
                      Thin hairline (0.65px)
                    </span>
                  </div>

                  {/* Slope Hazard */}
                  <div className="flex items-center justify-between py-1 px-2 rounded bg-[#171510]/60">
                    <div className="flex items-center gap-2">
                      <div className="w-7 flex items-center justify-center">
                        <span
                          className="inline-block w-6 border-b border-dashed"
                          style={{
                            borderColor: TOPO_STYLE.canvas.slopeHazardColor,
                            borderWidth: '1.5px',
                          }}
                        />
                      </div>
                      <span className="text-[#D4CEBF]">Slope Hazard</span>
                    </div>
                    <span
                      className="text-[9px] font-semibold text-red-400"
                    >
                      ≥ 15.0° (DEM horn)
                    </span>
                  </div>

                  {/* Candidate Traverse Routes */}
                  <div className="flex items-center justify-between py-1 px-2 rounded bg-[#171510]/60">
                    <div className="flex items-center gap-2">
                      <div className="w-7 flex items-center justify-center">
                        <span
                          className="inline-block w-6 border-b border-dashed"
                          style={{
                            borderColor: TOPO_STYLE.canvas.traverseRouteColor,
                            borderWidth: '2.5px',
                          }}
                        />
                      </div>
                      <span className="text-[#D4CEBF]">Candidate Traverse</span>
                    </div>
                    <span
                      className="text-[9px] font-semibold text-amber-400"
                    >
                      Artemis & VIPER
                    </span>
                  </div>

                  {/* Ridge & Crater Rim */}
                  <div className="flex items-center justify-between py-1 px-2 rounded bg-[#171510]/60">
                    <div className="flex items-center gap-2">
                      <div className="w-7 flex items-center justify-center">
                        <span
                          className="inline-block w-6 border-b border-dotted"
                          style={{
                            borderColor: TOPO_STYLE.canvas.ridgeRimColor,
                            borderWidth: '2px',
                          }}
                        />
                      </div>
                      <span className="text-[#D4CEBF]">Crater Rim / Ridge</span>
                    </div>
                    <span className="text-[9px] text-[#A8A193]">
                      Dotted crest line
                    </span>
                  </div>

                  {/* PSR Cold Traps */}
                  <div className="flex items-center justify-between py-1 px-2 rounded bg-[#171510]/60">
                    <div className="flex items-center gap-2">
                      <div className="w-7 flex items-center justify-center">
                        <span className="inline-block w-3.5 h-3.5 rounded-full border border-dashed border-sky-400 bg-sky-500/20" />
                      </div>
                      <span className="text-[#D4CEBF]">PSR Cold Trap</span>
                    </div>
                    <span className="text-[9px] text-sky-400">
                      Volatile Ice Deposit
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: LAYER CONTROLS */}
            {activeTab === 'layers' && (
              <div className="space-y-2 text-[10.5px] font-mono">
                {/* Contours Toggle */}
                <label className="flex items-center justify-between p-2 rounded-lg bg-[#171510] border border-[#2D281E] cursor-pointer hover:bg-[#1E1B15] transition-colors">
                  <span className="flex items-center gap-2 text-[#F4EFE6]">
                    <Layers className="w-3.5 h-3.5 text-[#E59A6D]" /> Elevation
                    Contours
                  </span>
                  <input
                    type="checkbox"
                    checked={showContours}
                    onChange={onToggleContours}
                    className="accent-[#E59A6D] w-3.5 h-3.5 cursor-pointer rounded"
                  />
                </label>

                {/* Slope Hazard Toggle */}
                <label className="flex items-center justify-between p-2 rounded-lg bg-[#171510] border border-[#2D281E] cursor-pointer hover:bg-[#1E1B15] transition-colors">
                  <span className="flex items-center gap-2 text-[#F4EFE6]">
                    <ShieldAlert className="w-3.5 h-3.5 text-red-400" /> Slope
                    Hazard (≥ 15°)
                  </span>
                  <input
                    type="checkbox"
                    checked={showSlopeHazard}
                    onChange={onToggleSlopeHazard}
                    className="accent-red-500 w-3.5 h-3.5 cursor-pointer rounded"
                  />
                </label>

                {/* Planned Traverses Toggle */}
                <label className="flex items-center justify-between p-2 rounded-lg bg-[#171510] border border-[#2D281E] cursor-pointer hover:bg-[#1E1B15] transition-colors">
                  <span className="flex items-center gap-2 text-[#F4EFE6]">
                    <Route className="w-3.5 h-3.5 text-amber-500" /> Planned
                    Traverse Routes
                  </span>
                  <input
                    type="checkbox"
                    checked={showTraverses}
                    onChange={onToggleTraverses}
                    className="accent-amber-500 w-3.5 h-3.5 cursor-pointer rounded"
                  />
                </label>

                {/* Crater Rims & Ridges Toggle */}
                <label className="flex items-center justify-between p-2 rounded-lg bg-[#171510] border border-[#2D281E] cursor-pointer hover:bg-[#1E1B15] transition-colors">
                  <span className="flex items-center gap-2 text-[#F4EFE6]">
                    <Mountain className="w-3.5 h-3.5 text-[#88B38A]" /> Ridge
                    Lines & Crater Rims
                  </span>
                  <input
                    type="checkbox"
                    checked={showRidges}
                    onChange={onToggleRidges}
                    className="accent-[#88B38A] w-3.5 h-3.5 cursor-pointer rounded"
                  />
                </label>

                {/* PSR Volatile Traps Toggle */}
                <label className="flex items-center justify-between p-2 rounded-lg bg-[#171510] border border-[#2D281E] cursor-pointer hover:bg-[#1E1B15] transition-colors">
                  <span className="flex items-center gap-2 text-[#F4EFE6]">
                    <span className="w-3 h-3 rounded-full border border-sky-400 bg-sky-500/30 inline-block" />{' '}
                    PSR Cold Traps
                  </span>
                  <input
                    type="checkbox"
                    checked={showPsrs}
                    onChange={onTogglePsrs}
                    className="accent-sky-400 w-3.5 h-3.5 cursor-pointer rounded"
                  />
                </label>

                {/* Earth DSN Corridor Toggle */}
                <label className="flex items-center justify-between p-2 rounded-lg bg-[#171510] border border-[#2D281E] cursor-pointer hover:bg-[#1E1B15] transition-colors">
                  <span className="flex items-center gap-2 text-[#F4EFE6]">
                    <Radio className="w-3.5 h-3.5 text-emerald-400" /> DSN
                    Line-of-Sight (0°E)
                  </span>
                  <input
                    type="checkbox"
                    checked={showDsnLink}
                    onChange={onToggleDsnLink}
                    className="accent-emerald-400 w-3.5 h-3.5 cursor-pointer rounded"
                  />
                </label>
              </div>
            )}

            {/* TAB 3: PROVENANCE & DATUM */}
            {activeTab === 'metadata' && (
              <div className="space-y-2 text-[10px] font-mono">
                <div className="p-2.5 rounded-lg bg-[#171510] border border-[#2D281E] space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-[#A8A193]">Source Project:</span>
                    <a
                      href="https://svs.gsfc.nasa.gov/5127/"
                      target="_blank"
                      rel="noreferrer"
                      className="text-sky-400 hover:underline flex items-center gap-1 font-semibold"
                    >
                      NASA SVS 5127 <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#A8A193]">Dataset:</span>
                    <span className="text-[#E59A6D] font-semibold text-right">
                      {TOPO_STYLE.metadata.product}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#A8A193]">Coverage:</span>
                    <span className="text-[#F4EFE6]">
                      {TOPO_STYLE.metadata.coverage}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#A8A193]">Reference Datum:</span>
                    <span className="text-[#88B38A] font-semibold text-right">
                      R₀ = 1,737,400.0 m
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#A8A193]">Projection:</span>
                    <span className="text-[#F4EFE6] text-right">
                      South Polar Stereographic
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#A8A193]">Resolution:</span>
                    <span className="text-[#F4EFE6] text-right">
                      20 m base GDR (400 m grid)
                    </span>
                  </div>
                </div>

                <div className="p-2 rounded-lg bg-[#171510]/80 border border-[#2D281E] text-[9.5px] text-[#A8A193] leading-relaxed">
                  Coded elevation palette and shaded relief derived directly from
                  NASA Goddard SVS 5127 by Ernie Wright and the LRO LOLA science team.
                </div>
              </div>
            )}

            {/* LIVE ALTIMETRY & SLOPE PROBE READOUT */}
            <div
              className="pt-2 border-t text-[10px] font-mono space-y-1"
              style={{ borderColor: `${TOPO_STYLE.hud.panelBorder}90` }}
            >
              {isOutOfDemBounds ? (
                <div className="p-2 rounded-lg bg-amber-950/40 border border-amber-800/60 text-amber-200 flex items-start gap-2">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-bold text-[10.5px]">
                      Beyond 80°S LOLA DEM
                    </div>
                    <div className="text-[9px] text-amber-300/80">
                      High-resolution 2D Topo covers 80°S–90°S.
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
                    <span className="text-[#A8A193] block text-[9px] truncate">
                      {selectedLocation?.name ||
                        selectedFeature?.name ||
                        'Sampled Position'}
                    </span>
                    <span className="text-[#F4EFE6] text-[9.5px]">
                      {selectedLocation?.lat != null
                        ? `${Math.abs(selectedLocation.lat).toFixed(3)}°S, ${
                            selectedLocation.lon >= 0
                              ? `${selectedLocation.lon.toFixed(3)}°E`
                              : `${Math.abs(selectedLocation.lon).toFixed(3)}°W`
                          }`
                        : 'Surface Point'}
                    </span>
                  </div>
                  <div className="text-right shrink-0">
                    <span
                      className="text-[12px] font-bold block"
                      style={{ color: TOPO_STYLE.hud.accentTerracotta }}
                    >
                      {typeof elevValue === 'number'
                        ? `${elevValue > 0 ? '+' : ''}${elevValue.toLocaleString()} m`
                        : 'No Data'}
                    </span>
                    {typeof slopeValue === 'number' && (
                      <span
                        className={`text-[9.5px] font-bold ${
                          slopeValue >= 15 ? 'text-red-400' : 'text-[#88B38A]'
                        }`}
                      >
                        Slope: {slopeValue.toFixed(1)}°
                        {slopeValue >= 15 ? ' (Hazard)' : ''}
                      </span>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between text-[#A8A193]">
                  <span>Altimetry Probe:</span>
                  <span className="italic text-[9.5px]">
                    Click map to sample DEM
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
