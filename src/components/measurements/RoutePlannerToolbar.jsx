import React, { useState } from 'react';
import {
  Route,
  Play,
  RotateCcw,
  X,
  Sun,
  Moon,
  AlertTriangle,
  Mountain,
  ChevronDown,
  ChevronUp,
  Clock,
  Sparkles,
  Info,
  MapPin,
  Compass,
} from 'lucide-react';
import { notifyInfo } from '../../utils/feedbackStore.js';

export default function RoutePlannerToolbar({
  isActive,
  onToggleActive,
  startPoint,
  goalPoint,
  routeResult,
  isCalculating,
  maxSlopeLimit,
  onChangeMaxSlope,
  roverSpeedKmh,
  onChangeRoverSpeed,
  onComputeRoute,
  onClearRoute,
  onSelectPreset,
  selectedLocation = null,
  onUseSelectedLocation = null,
}) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [showSettings, setShowSettings] = useState(false);

  if (!isActive) return null;

  const hasRoute = Boolean(routeResult?.success && routeResult?.waypoints?.length > 0);
  const waypoints = routeResult?.waypoints || [];

  const selLat = selectedLocation?.latitude ?? selectedLocation?.lat ?? null;
  const selLon = selectedLocation?.longitude ?? selectedLocation?.lon ?? null;
  const hasSelectedCoords =
    Number.isFinite(selLat) &&
    Number.isFinite(selLon) &&
    (selectedLocation?.body ? selectedLocation.body === 'moon' : true);
  const isSelectedEligibleForPolarRoute = hasSelectedCoords && selLat <= -79.9;
  const selCoordsStr = hasSelectedCoords
    ? `${Math.abs(selLat).toFixed(2)}°${selLat >= 0 ? 'N' : 'S'}, ${Math.abs(selLon).toFixed(2)}°${selLon >= 0 ? 'E' : 'W'}`
    : null;

  const svgWidth = 360;
  const svgHeight = 72;
  const padding = { top: 8, bottom: 18, left: 32, right: 12 };
  const plotW = svgWidth - padding.left - padding.right;
  const plotH = svgHeight - padding.top - padding.bottom;

  let minElev = routeResult?.minElevationM ?? 0;
  let maxElev = routeResult?.maxElevationM ?? 1000;
  if (minElev === maxElev) {
    minElev -= 100;
    maxElev += 100;
  }
  const elevRange = Math.max(1, maxElev - minElev);
  const totalKm = Math.max(0.1, routeResult?.totalDistanceKm ?? 1);

  const points = waypoints.map((wp) => {
    const x = padding.left + (wp.cumulativeDistKm / totalKm) * plotW;
    const y = padding.top + plotH - ((wp.elevationM - minElev) / elevRange) * plotH;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');

  return (
    <div
      id="route-planner-floating-toolbar"
      data-guide="route-planner"
      className="fixed z-30 left-3.5 sm:left-16 top-16 w-[calc(100vw-1.5rem)] sm:w-[420px] max-w-md max-h-[calc(100vh-5rem)] overflow-y-auto custom-scrollbar bg-[#050507]/96 backdrop-blur-2xl border border-cyan-500/50 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.85)] p-3 pointer-events-auto transition-all animate-in fade-in slide-in-from-left-2 duration-150 text-slate-100"
    >
      <div className="flex items-center justify-between gap-3 pb-2.5 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-cyan-500/20 text-cyan-400 rounded-lg shadow-[0_0_12px_rgba(6,182,212,0.25)]">
            <Route className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-100 uppercase tracking-wide font-sans">
                Surface Route Planner
              </span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800/80 font-mono">
                LOLA DEM A*
              </span>
            </div>
            <span className="text-[10px] text-cyan-300/80 font-mono block">
              {!startPoint
                ? 'Step 1: Click map to place Traverse Origin (Start)'
                : !goalPoint
                ? 'Step 2: Click map to place Destination (Goal)'
                : hasRoute
                ? `Route computed (${routeResult.totalDistanceKm} km)`
                : 'Ready to compute optimal traverse'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setIsExpanded((prev) => !prev)}
            aria-label={isExpanded ? 'Collapse route planner' : 'Expand route planner'}
            aria-expanded={isExpanded}
            className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/70"
            title={isExpanded ? 'Collapse HUD' : 'Expand HUD'}
          >
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          <button
            id="btn-clear-route"
            type="button"
            onClick={onClearRoute}
            className="flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-slate-300 hover:text-white bg-slate-800/90 hover:bg-slate-700/80 rounded-lg transition-all active:scale-95"
            title="Reset route waypoints"
          >
            <RotateCcw className="w-3 h-3 text-slate-400" />
            Reset
          </button>

          <button
            id="btn-exit-route-planner"
            type="button"
            onClick={onToggleActive}
            className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-all active:scale-95"
            aria-label="Exit route planner"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="mt-2.5 flex flex-col gap-2.5">
          {hasSelectedCoords && (
            <div
              data-testid="route-planner-selected-location"
              className="px-2.5 py-1.5 rounded-lg bg-slate-900/80 border border-slate-800 flex items-center justify-between gap-2 text-[10.5px]"
            >
              <div className="min-w-0 flex items-center gap-1.5">
                <MapPin className="w-3 h-3 text-amber-400 shrink-0" />
                <span className="text-slate-400 shrink-0">Selected:</span>
                <span className="font-semibold text-slate-100 truncate">
                  {selectedLocation.name || 'Sampled Point'}
                </span>
                <span className="font-mono text-cyan-300 shrink-0 tabular-nums">
                  ({selCoordsStr})
                </span>
              </div>
              {isSelectedEligibleForPolarRoute && onUseSelectedLocation && (
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => onUseSelectedLocation('start')}
                    className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-emerald-950/80 text-emerald-300 border border-emerald-700/50 font-mono text-[9.5px] transition-colors"
                    title="Use selected location as Traverse Origin (Start)"
                  >
                    Use as Start
                  </button>
                  <button
                    type="button"
                    onClick={() => onUseSelectedLocation('goal')}
                    className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-cyan-950/80 text-cyan-300 border border-cyan-700/50 font-mono text-[9.5px] transition-colors"
                    title="Use selected location as Destination (Goal)"
                  >
                    Use as Goal
                  </button>
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <div className={`p-2 rounded-lg border flex flex-col gap-0.5 ${
              startPoint ? 'bg-cyan-950/40 border-cyan-700/60' : 'bg-slate-900/60 border-slate-800 border-dashed'
            }`}>
              <div className="flex items-center justify-between text-slate-400">
                <span className="font-semibold text-cyan-400 flex items-center gap-1">
                  <MapPin className="w-3 h-3 text-emerald-400" /> Start
                </span>
                {startPoint && <span className="text-[9px] font-mono text-emerald-400">Locked</span>}
              </div>
              <div className="font-mono text-slate-200 truncate">
                {startPoint
                  ? startPoint.name || `${Math.abs(startPoint.lat).toFixed(2)}°S, ${Math.abs(startPoint.lon).toFixed(2)}°${startPoint.lon >= 0 ? 'E' : 'W'}`
                  : 'Click map or landmark'}
              </div>
              {startPoint && startPoint.name && (
                <div className="font-mono text-[9.5px] text-slate-400 tabular-nums truncate">
                  {Math.abs(startPoint.lat).toFixed(2)}°S, {Math.abs(startPoint.lon).toFixed(2)}°{startPoint.lon >= 0 ? 'E' : 'W'}
                </div>
              )}
            </div>

            <div className={`p-2 rounded-lg border flex flex-col gap-0.5 ${
              goalPoint ? 'bg-cyan-950/40 border-cyan-700/60' : 'bg-slate-900/60 border-slate-800 border-dashed'
            }`}>
              <div className="flex items-center justify-between text-slate-400">
                <span className="font-semibold text-cyan-400 flex items-center gap-1">
                  <Compass className="w-3 h-3 text-cyan-400" /> Goal
                </span>
                {goalPoint && <span className="text-[9px] font-mono text-cyan-400">Locked</span>}
              </div>
              <div className="font-mono text-slate-200 truncate">
                {goalPoint
                  ? goalPoint.name || `${Math.abs(goalPoint.lat).toFixed(2)}°S, ${Math.abs(goalPoint.lon).toFixed(2)}°${goalPoint.lon >= 0 ? 'E' : 'W'}`
                  : 'Click destination'}
              </div>
              {goalPoint && goalPoint.name && (
                <div className="font-mono text-[9.5px] text-slate-400 tabular-nums truncate">
                  {Math.abs(goalPoint.lat).toFixed(2)}°S, {Math.abs(goalPoint.lon).toFixed(2)}°{goalPoint.lon >= 0 ? 'E' : 'W'}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between gap-2 text-[10px]">
            <div className="flex items-center gap-1">
              <span className="text-slate-400 font-sans">Presets:</span>
              <button
                type="button"
                onClick={() => onSelectPreset?.({
                  start: { lat: -89.56, lon: -140, name: 'Connecting Ridge North' },
                  goal: { lat: -89.12, lon: -87.1, name: 'De Gerlache Ridge' },
                })}
                className="px-2 py-0.5 bg-slate-800 hover:bg-cyan-900/50 hover:text-cyan-200 rounded text-slate-300 font-mono transition-colors"
              >
                Connecting Ridge
              </button>
              <button
                type="button"
                onClick={() => onSelectPreset?.({
                  start: { lat: -86.5, lon: 0, name: 'Malapert Plateau Base' },
                  goal: { lat: -85.8, lon: 3.8, name: 'Malapert Massif Summit' },
                })}
                className="px-2 py-0.5 bg-slate-800 hover:bg-cyan-900/50 hover:text-cyan-200 rounded text-slate-300 font-mono transition-colors"
              >
                Malapert
              </button>
            </div>

            <button
              type="button"
              onClick={() => setShowSettings((s) => !s)}
              aria-expanded={showSettings}
              className="text-cyan-400 hover:text-cyan-300 underline font-mono text-[10px] rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/70"
            >
              {showSettings ? 'Hide Parameters' : 'Rover Constraints'}
            </button>
          </div>

          {showSettings && (
            <div className="p-2.5 bg-slate-900/80 rounded-lg border border-slate-800 flex flex-col gap-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-300 flex items-center gap-1.5">
                  <Mountain className="w-3.5 h-3.5 text-amber-400" /> Max Slope Limit:
                </span>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min="5"
                    max="25"
                    step="1"
                    value={maxSlopeLimit}
                    onChange={(e) => onChangeMaxSlope(Number(e.target.value))}
                    aria-label="Maximum slope limit in degrees"
                    className="w-24 accent-cyan-400 cursor-pointer"
                  />
                  <span className="font-mono text-cyan-300 w-8 text-right font-bold">
                    {maxSlopeLimit}°
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-300 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-blue-400" /> Planned Speed:
                </span>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min="0.05"
                    max="0.5"
                    step="0.05"
                    value={roverSpeedKmh}
                    onChange={(e) => onChangeRoverSpeed(Number(e.target.value))}
                    aria-label="Planned rover speed in meters per hour"
                    className="w-24 accent-cyan-400 cursor-pointer"
                  />
                  <span className="font-mono text-cyan-300 w-16 text-right font-bold">
                    {Math.round(roverSpeedKmh * 1000)} m/h
                  </span>
                </div>
              </div>
            </div>
          )}

          {startPoint && goalPoint && (
            <button
              id="btn-compute-route"
              type="button"
              disabled={isCalculating}
              onClick={onComputeRoute}
              className="w-full py-2 bg-white text-[#050507] font-semibold rounded-lg flex items-center justify-center gap-2 text-xs shadow-lg transition-all active:scale-[0.99] disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/70"
            >
              {isCalculating ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-[#050507] border-t-transparent rounded-full animate-spin" />
                  <span>Computing A* Path on LOLA DEM Grid...</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Compute Slope-Limited Traverse</span>
                </>
              )}
            </button>
          )}

          {routeResult && !routeResult.success && (
            <div className="p-2.5 rounded-lg bg-rose-950/60 border border-rose-700/60 flex items-start gap-2 text-xs text-rose-200">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold block text-rose-300">Traverse Impassable</span>
                <span className="text-[11px] text-rose-200/90">{routeResult.reason}</span>
              </div>
            </div>
          )}

          {hasRoute && (
            <div className="flex flex-col gap-2 pt-1 border-t border-slate-800">
              <div className="grid grid-cols-4 gap-1.5 text-center">
                <div className="p-1.5 bg-slate-900/90 rounded border border-slate-800/80">
                  <span className="text-[9px] text-slate-400 block font-sans">Distance</span>
                  <span className="font-mono text-xs font-bold text-cyan-400">
                    {routeResult.totalDistanceKm} km
                  </span>
                </div>
                <div className="p-1.5 bg-slate-900/90 rounded border border-slate-800/80">
                  <span className="text-[9px] text-slate-400 block font-sans">Max Slope</span>
                  <span className="font-mono text-xs font-bold text-amber-400">
                    {routeResult.maxSlopeDeg}°
                  </span>
                </div>
                <div className="p-1.5 bg-slate-900/90 rounded border border-slate-800/80">
                  <span className="text-[9px] text-slate-400 block font-sans">Sunlit Pct</span>
                  <span className="font-mono text-xs font-bold text-emerald-400 flex items-center justify-center gap-0.5">
                    <Sun className="w-2.5 h-2.5 text-emerald-400" />
                    {routeResult.sunlitPct ?? 0}%
                  </span>
                </div>
                <div className="p-1.5 bg-slate-900/90 rounded border border-slate-800/80">
                  <span className="text-[9px] text-slate-400 block font-sans">Shadow Pct</span>
                  <span className="font-mono text-xs font-bold text-sky-400 flex items-center justify-center gap-0.5">
                    <Moon className="w-2.5 h-2.5 text-sky-400" />
                    {routeResult.shadowedPct ?? 0}%
                  </span>
                </div>
              </div>

              <div className="bg-[#04060A] rounded-lg p-2 border border-slate-800/90 relative">
                <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1 px-1">
                  <span className="font-semibold text-slate-300">Elevation Profile (LOLA DEM)</span>
                  <span className="font-mono text-[9px] text-slate-400">
                    Δ {routeResult.elevationChangeM}m (Min {minElev}m / Max {maxElev}m)
                  </span>
                </div>

                <svg
                  role="img"
                  aria-label={`Elevation profile along route: ${routeResult.elevationChangeM}m change, min ${minElev}m to max ${maxElev}m`}
                  viewBox={`0 0 ${svgWidth} ${svgHeight}`}
                  className="w-full h-16 overflow-visible"
                >
                  <line
                    x1={padding.left}
                    y1={padding.top}
                    x2={svgWidth - padding.right}
                    y2={padding.top}
                    stroke="#1E293B"
                    strokeDasharray="2,2"
                  />
                  <line
                    x1={padding.left}
                    y1={padding.top + plotH / 2}
                    x2={svgWidth - padding.right}
                    y2={padding.top + plotH / 2}
                    stroke="#1E293B"
                    strokeDasharray="2,2"
                  />
                  <line
                    x1={padding.left}
                    y1={padding.top + plotH}
                    x2={svgWidth - padding.right}
                    y2={padding.top + plotH}
                    stroke="#334155"
                  />

                  <text
                    x={padding.left - 4}
                    y={padding.top + 3}
                    textAnchor="end"
                    fill="#64748B"
                    fontSize="7"
                    fontFamily="monospace"
                  >
                    {maxElev}m
                  </text>
                  <text
                    x={padding.left - 4}
                    y={padding.top + plotH}
                    textAnchor="end"
                    fill="#64748B"
                    fontSize="7"
                    fontFamily="monospace"
                  >
                    {minElev}m
                  </text>

                  {waypoints.map((wp, i) => {
                    if (i === 0) return null;
                    const prev = waypoints[i - 1];
                    const x1 = padding.left + (prev.cumulativeDistKm / totalKm) * plotW;
                    const y1 = padding.top + plotH - ((prev.elevationM - minElev) / elevRange) * plotH;
                    const x2 = padding.left + (wp.cumulativeDistKm / totalKm) * plotW;
                    const y2 = padding.top + plotH - ((wp.elevationM - minElev) / elevRange) * plotH;

                    const strokeColor = wp.sunStatus === 'sunlit' ? '#10B981' : '#38BDF8';

                    return (
                      <line
                        key={i}
                        x1={x1}
                        y1={y1}
                        x2={x2}
                        y2={y2}
                        stroke={strokeColor}
                        strokeWidth="2.5"
                        strokeLinecap="round"
                      />
                    );
                  })}

                  <text
                    x={padding.left}
                    y={svgHeight - 2}
                    textAnchor="start"
                    fill="#64748B"
                    fontSize="7"
                    fontFamily="monospace"
                  >
                    0 km
                  </text>
                  <text
                    x={svgWidth - padding.right}
                    y={svgHeight - 2}
                    textAnchor="end"
                    fill="#64748B"
                    fontSize="7"
                    fontFamily="monospace"
                  >
                    {routeResult.totalDistanceKm} km
                  </text>
                </svg>

                <div className="flex items-center justify-center gap-4 text-[9px] text-slate-400 mt-1 font-mono">
                  <span className="flex items-center gap-1">
                    <span className="w-2.5 h-1 bg-[#10B981] rounded-full inline-block" /> Sunlit Segment
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2.5 h-1 bg-[#38BDF8] rounded-full inline-block" /> Shadowed Segment
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="mt-2 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[9px] text-slate-500">
        <span className="flex items-center gap-1">
          <Info className="w-3 h-3 text-slate-600" />
          <span>A* on LOLA DEM (400 m/px) · 360° Ray-Marched Horizon Masking</span>
        </span>
        <span className="font-mono text-cyan-400">Slope ≤ {maxSlopeLimit}°</span>
      </div>
    </div>
  );
}
