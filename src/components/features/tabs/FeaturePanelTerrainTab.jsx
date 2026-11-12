import React from 'react';
import {
  Sun,
  Radio,
  Info,
  Mountain,
  AlertTriangle,
  CheckCircle2,
  Database,
  ChevronDown,
} from 'lucide-react';
import HorizonViewChart from '../HorizonViewChart.jsx';

export default function FeaturePanelTerrainTab({
  siteId,
  featLat,
  featLon,
  latStr,
  lonStr,
  moonPoint,
  sun,
  earthLook,
  solarLightingState,
  solarDiscPct,
  sunStatusMeta,
  earthStatusMeta,
  solarTransition,
  earthTransition,
  sunTerrainHorizon,
  trackStartMs,
  currentSun,
  currentEarth,
  isPlaceholderLocation,
  isExpanded,
  terrainMetrics,
  regionInfo,
  roughnessRadiusM,
  onChangeRoughnessRadiusM,
  isDataSourcesOpen,
  onToggleDataSources,
}) {
  return (
    <div className="space-y-2.5">
      <div className="grid grid-cols-2 gap-2 font-mono">
        <div className="p-3 rounded-xl bg-[#0C0D12] border border-white/[0.08] space-y-1.5">
          <div className="flex items-center justify-between text-[11.5px]">
            <span className="flex items-center gap-1.5 text-[#E2E8F0] font-sans font-medium">
              <Sun className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span>Sun Position</span>
            </span>
            <span
              className={`px-1.5 py-0.5 rounded text-[10px] font-sans font-semibold whitespace-nowrap border ${
                isPlaceholderLocation
                  ? 'bg-slate-900/60 text-slate-400 border-slate-700/50'
                  : solarLightingState
                  ? solarLightingState.badgeClass
                  : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
              }`}
            >
              {solarDiscPct > 0 && solarDiscPct < 100
                ? `${solarDiscPct}% Disc (${solarLightingState?.shortLabel || sunStatusMeta.label})`
                : sunStatusMeta.label}
            </span>
          </div>
          <div className="flex items-baseline justify-between tabular-nums pt-0.5">
            <span className="text-[16px] font-mono font-semibold text-white">
              {sun?.elevationDeg != null ? `${sun.elevationDeg.toFixed(1)}°` : '—'}
              <span className="text-[11px] font-sans font-normal text-[#8E95A5] ml-1">el</span>
            </span>
            <span className="text-[11.5px] font-mono font-medium text-[#CBD5E1]">
              Az {sun?.azimuthDeg != null ? `${sun.azimuthDeg.toFixed(0)}°` : '—'}
            </span>
          </div>
          <div className="text-[11px] font-sans text-[#8E95A5] leading-snug break-words">
            {isPlaceholderLocation
              ? 'Data Withheld (Coordinates TBD)'
              : !solarTransition
              ? 'No transition data'
              : solarTransition.timeUntilMs === null
              ? solarTransition.isCurrentlySunlit
                ? 'Continuous Sunlight'
                : 'Continuous Shadow'
              : `${solarTransition.nextEvent === 'sunset' ? 'Sunset' : 'Sunrise'} in ${solarTransition.formattedDuration}`}
          </div>
        </div>

        <div className="p-3 rounded-xl bg-[#0C0D12] border border-white/[0.08] space-y-1.5">
          <div className="flex items-center justify-between text-[11.5px]">
            <span className="flex items-center gap-1.5 text-[#E2E8F0] font-sans font-medium">
              <Radio className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>Earth Direct</span>
            </span>
            <span
              className={`px-1.5 py-0.5 rounded text-[10px] font-sans font-semibold whitespace-nowrap border ${
                earthStatusMeta.label === 'Link Active'
                  ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                  : earthStatusMeta.label === 'Marginal'
                  ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                  : 'bg-rose-500/15 text-rose-300 border-rose-500/30'
              }`}
            >
              {earthStatusMeta.label}
            </span>
          </div>
          <div className="flex items-baseline justify-between tabular-nums pt-0.5">
            <span className="text-[16px] font-mono font-semibold text-white">
              {earthLook?.elevationDeg != null ? `${earthLook.elevationDeg.toFixed(1)}°` : '—'}
              <span className="text-[11px] font-sans font-normal text-[#8E95A5] ml-1">el</span>
            </span>
            <span className="text-[11.5px] font-mono font-medium text-[#CBD5E1]">
              Az {earthLook?.azimuthDeg != null ? `${earthLook.azimuthDeg.toFixed(0)}°` : '—'}
            </span>
          </div>
          <div className="text-[11px] font-sans text-[#8E95A5] leading-snug break-words">
            {isPlaceholderLocation
              ? 'Data Withheld (Coordinates TBD)'
              : !earthTransition
              ? 'No transition data'
              : earthTransition.timeUntilMs === null
              ? earthTransition.isAboveHorizon
                ? 'Continuous Visibility'
                : 'No Earthrise (35d+)'
              : `Earth${earthTransition.nextEvent === 'earthset' ? 'set' : 'rise'} in ${earthTransition.formattedDuration}`}
          </div>
        </div>
      </div>

      {isExpanded && (
        <div className="space-y-2.5 pt-1 border-t border-slate-800/80">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 font-mono text-xs">
            <div className="p-2.5 rounded-xl bg-[#0A121E] border border-slate-800/80">
              <span className="text-[10px] text-slate-400 block">Horizon Mask</span>
              <span className="text-sm font-bold text-cyan-300 tabular-nums">
                {sunTerrainHorizon != null ? `${sunTerrainHorizon.toFixed(1)}°` : '—'}
              </span>
              <span className="text-[10px] text-slate-400 block">Solar Azimuth</span>
            </div>
          </div>
        </div>
      )}

      <div className="p-2.5 rounded-xl bg-[#0A121E] border border-slate-800/80 space-y-2">
        <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
          <span className="text-white font-semibold">
            360° Horizon Mask, Sun Track &amp; Libration Zone
          </span>
          <span>LOLA Altimetry</span>
        </div>
        <HorizonViewChart
          siteId={siteId}
          latitude={featLat}
          longitude={featLon}
          moonFeature={moonPoint}
          startMs={trackStartMs}
          currentSun={currentSun}
          currentEarth={currentEarth}
        />
      </div>

      {terrainMetrics ? (
        <div className="flex flex-col gap-2.5">
          <div className="p-2 rounded-xl bg-[#0A121E] border border-slate-800/80 flex items-center justify-between gap-1 text-[10px] font-mono">
            <span className="text-slate-400">Analysis Radius:</span>
            <div className="flex items-center gap-1 flex-wrap justify-end">
              {[500, 1000, 2000, 5000, 10000].map((r) => (
                <button
                  key={r}
                  type="button"
                  aria-pressed={roughnessRadiusM === r}
                  onClick={() => onChangeRoughnessRadiusM(r)}
                  className={`px-2 py-0.5 rounded text-[10px] font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/70 ${
                    roughnessRadiusM === r
                      ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/50 font-bold'
                      : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                  }`}
                >
                  {r >= 1000 ? `${r / 1000}km` : `${r}m`}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 font-mono">
            <div className="p-2.5 rounded-xl bg-[#0C0D12] border border-slate-800/80">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-slate-400 block">Surface Elevation</span>
                {terrainMetrics.elevationM !== null && (
                  <span className="text-[9px] font-mono text-cyan-400/80">
                    {terrainMetrics.isDemAvailable ? 'LOLA DEM' : 'CATALOG'}
                  </span>
                )}
              </div>
              <div className="text-base font-bold text-white tabular-nums mt-0.5">
                {terrainMetrics.elevationM !== null ? (
                  <>
                    {terrainMetrics.elevationM > 0 ? '+' : ''}
                    {terrainMetrics.elevationM.toLocaleString()}
                    <span className="text-xs font-normal text-slate-400 ml-1">m</span>
                  </>
                ) : (
                  <span className="text-xs font-normal text-slate-400">Not present in loaded dataset</span>
                )}
              </div>
              <span className="text-[10px] text-slate-400 block whitespace-normal break-words leading-tight">
                {terrainMetrics.elevationSource ||
                  (terrainMetrics.inSouthPoleCap
                    ? 'Rel. to R₀ = 1,737.4 km'
                    : 'Outside 80°S–90°S LOLA DEM')}
              </span>
            </div>

            <div className="p-2.5 rounded-xl bg-[#0C0D12] border border-slate-800/80">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-slate-400 block">Local Slope Angle</span>
                {terrainMetrics.slopeDeg !== null && (
                  <span className="text-[9px] font-mono text-emerald-400/80">
                    Horn 3×3
                  </span>
                )}
              </div>
              <div
                className={`text-base font-bold tabular-nums mt-0.5 ${
                  terrainMetrics.slopeDeg === null
                    ? 'text-slate-400 text-xs font-normal'
                    : terrainMetrics.slopeDeg >= 15
                    ? 'text-rose-400'
                    : terrainMetrics.slopeDeg >= 10
                    ? 'text-amber-400'
                    : 'text-emerald-400'
                }`}
              >
                {terrainMetrics.slopeDeg !== null
                  ? `${terrainMetrics.slopeDeg.toFixed(1)}°`
                  : 'Not present in loaded dataset'}
              </div>
              <span className="text-[10px] text-slate-400 block whitespace-normal break-words leading-tight">
                {terrainMetrics.slopeSource ||
                  (terrainMetrics.slopeDeg !== null
                    ? '15.0° max lander limit'
                    : 'Requires LOLA DEM')}
              </span>
            </div>

            <div className="p-2.5 rounded-xl bg-[#0C0D12] border border-slate-800/80">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-slate-400 block">Surface Roughness</span>
                <span className="text-[9px] font-mono text-slate-400">
                  R={(roughnessRadiusM / 1000).toFixed(1)}km
                </span>
              </div>
              <div className="text-base font-bold text-white tabular-nums mt-0.5">
                {terrainMetrics.roughnessM !== null ? (
                  <>
                    {terrainMetrics.roughnessM.toFixed(1)}
                    <span className="text-xs font-normal text-slate-400 ml-1">m RMS</span>
                  </>
                ) : (
                  <span className="text-xs font-normal text-slate-400">Not present in loaded dataset</span>
                )}
              </div>
              <span className="text-[10px] text-slate-400 block whitespace-normal break-words leading-tight">
                {terrainMetrics.roughnessM !== null
                  ? `Dispersion in ${(roughnessRadiusM / 1000).toFixed(1)} km radius`
                  : 'Requires LOLA DEM'}
              </span>
            </div>

            <div className="p-2.5 rounded-xl bg-[#0C0D12] border border-slate-800/80">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-slate-400 block">Local Relief (Δz)</span>
                <span className="text-[9px] font-mono text-slate-400">
                  R={(roughnessRadiusM / 1000).toFixed(1)}km
                </span>
              </div>
              <div className="text-base font-bold text-cyan-300 tabular-nums mt-0.5">
                {terrainMetrics.reliefM !== null ? (
                  <>
                    {terrainMetrics.reliefM.toLocaleString()}
                    <span className="text-xs font-normal text-slate-400 ml-1">m</span>
                  </>
                ) : (
                  <span className="text-xs font-normal text-slate-400">Not present in loaded dataset</span>
                )}
              </div>
              <span className="text-[10px] text-slate-400 block whitespace-normal break-words leading-tight">
                {terrainMetrics.reliefM !== null
                  ? `Max - min in ${(roughnessRadiusM / 1000).toFixed(1)} km radius`
                  : 'Requires LOLA DEM'}
              </span>
            </div>
          </div>

          {terrainMetrics.radialProfile ? (
            <div className="p-2.5 rounded-xl bg-[#0A121E] border border-slate-800/80 space-y-1.5">
              <div className="flex items-center justify-between text-[10px] font-mono">
                <span className="text-slate-200 font-semibold">
                  Radial Elevation Profile (±10 km Cross-Section)
                </span>
                <span className="text-cyan-300">
                  Relief: {Math.round(terrainMetrics.radialProfile.reliefM).toLocaleString()} m
                </span>
              </div>
              {(() => {
                const prof = terrainMetrics.radialProfile;
                const ns = prof.northSouth || [];
                const we = prof.westEast || [];
                const minE = prof.minElevM - 100;
                const maxE = Math.max(minE + 200, prof.maxElevM + 100);
                const w = 320;
                const h = 84;
                const toPath = (pts) =>
                  pts
                    .map((p, idx) => {
                      const x = ((p.offsetKm + 10) / 20) * (w - 24) + 12;
                      const y = h - 14 - ((p.elevationM - minE) / (maxE - minE)) * (h - 24);
                      return `${idx === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
                    })
                    .join(' ');
                const centerElev = terrainMetrics.elevationM ?? (minE + maxE) / 2;
                const centerY =
                  h - 14 - ((centerElev - minE) / (maxE - minE)) * (h - 24);
                return (
                  <svg
                    role="img"
                    aria-label="Radial elevation transect profile plus or minus 10 kilometers"
                    viewBox={`0 0 ${w} ${h}`}
                    className="w-full h-20 bg-[#050507] rounded-lg border border-slate-800/80"
                  >
                    <line
                      x1={w / 2}
                      y1={6}
                      x2={w / 2}
                      y2={h - 12}
                      stroke="rgba(148,163,184,0.28)"
                      strokeDasharray="2,2"
                    />
                    <path
                      d={toPath(we)}
                      fill="none"
                      stroke="#38BDF8"
                      strokeWidth="1.5"
                      opacity="0.75"
                    />
                    <path d={toPath(ns)} fill="none" stroke="#F59E0B" strokeWidth="1.8" />
                    <circle
                      cx={w / 2}
                      cy={Math.max(8, Math.min(h - 14, centerY))}
                      r="3"
                      fill="#EF4444"
                      stroke="#FFFFFF"
                      strokeWidth="1"
                    />
                    <text x="10" y={h - 3} fill="#94A3B8" fontSize="8" fontFamily="JetBrains Mono, monospace">
                      -10km
                    </text>
                    <text
                      x={w / 2}
                      y={h - 3}
                      fill="#E2E8F0"
                      fontSize="8"
                      textAnchor="middle"
                      fontFamily="JetBrains Mono, monospace"
                    >
                      0km (Pin)
                    </text>
                    <text
                      x={w - 10}
                      y={h - 3}
                      fill="#94A3B8"
                      fontSize="8"
                      textAnchor="end"
                      fontFamily="JetBrains Mono, monospace"
                    >
                      +10km
                    </text>
                  </svg>
                );
              })()}
              <div className="flex items-center justify-between text-[9.5px] font-mono text-slate-400">
                <span className="flex items-center gap-2">
                  <span className="text-amber-400">━ N–S Transect</span>
                  <span className="text-sky-400">━ W–E Transect</span>
                </span>
                <span>
                  {Math.round(terrainMetrics.radialProfile.minElevM)}m to{' '}
                  {terrainMetrics.radialProfile.maxElevM > 0 ? '+' : ''}
                  {Math.round(terrainMetrics.radialProfile.maxElevM)}m
                </span>
              </div>
            </div>
          ) : (
            <div className="p-2.5 rounded-xl bg-[#0A121E] border border-slate-800/80 text-xs font-mono text-slate-400 space-y-1">
              <div className="flex items-center gap-1.5 text-slate-300 font-semibold">
                <Mountain className="w-3.5 h-3.5 text-cyan-400" />
                <span>Radial Elevation Profile: Not present in loaded dataset</span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Cross-sectional transect generation samples the NASA LOLA South Polar DEM (80.0°S to 90.0°S).
                Selected location ({featLat.toFixed(2)}°, {featLon.toFixed(2)}°) is outside local DEM coverage.
              </p>
            </div>
          )}

          <div className="p-2.5 rounded-xl bg-[#0A121E] border border-slate-800/80 space-y-1.5 text-xs">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-mono text-slate-400 shrink-0">Geologic Region</span>
              <span className="font-mono text-slate-200 text-right">
                {terrainMetrics.geologicalRegion?.province || regionInfo?.province || 'Feldspathic Highlands'}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2 border-t border-slate-800/70 pt-1.5">
              <span className="text-[10px] font-mono text-slate-400 shrink-0">Crustal Terrane</span>
              <span className="font-mono text-slate-300 text-right text-[11px]">
                {terrainMetrics.geologicalRegion?.terrane || regionInfo?.terrane || 'Feldspathic Highlands Terrane (FHT)'}
              </span>
            </div>
            {terrainMetrics.nearestLandmark && (
              <div className="flex items-center justify-between gap-2 border-t border-slate-800/70 pt-1.5">
                <span className="text-[10px] font-mono text-slate-400 shrink-0">Nearest Landmark</span>
                <span className="font-mono text-cyan-300 text-[11px] text-right">
                  {terrainMetrics.nearestLandmark.name}
                  <span className="text-slate-400 text-[10px] block">
                    {terrainMetrics.nearestLandmark.distanceKm} km · {terrainMetrics.nearestLandmark.bearingDeg}° az ({terrainMetrics.nearestLandmark.type})
                  </span>
                </span>
              </div>
            )}
            <div className="flex items-center justify-between gap-2 border-t border-slate-800/70 pt-1.5">
              <span className="text-[10px] font-mono text-slate-400 shrink-0">Altimetry Uncertainty</span>
              <span className="text-[10px] font-mono text-slate-300 text-right">
                {terrainMetrics.uncertainty?.isAvailable ? (
                  <>
                    {terrainMetrics.uncertainty.verticalAccuracy} vert · {terrainMetrics.uncertainty.horizontalAccuracy} horiz
                  </>
                ) : (
                  <span className="text-slate-400">Not present in loaded dataset (outside 80°S DEM)</span>
                )}
              </span>
            </div>
          </div>

          <div className="p-2.5 rounded-xl bg-[#0A121E] border border-slate-800/80 flex items-center justify-between gap-2">
            <div>
              <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 block">
                Terrain Classification
              </span>
              <span className="text-xs font-semibold text-cyan-300">
                {terrainMetrics.terrainClassification}
              </span>
            </div>
            <span
              className={`text-[10px] font-mono font-semibold px-2 py-0.5 rounded border shrink-0 ${
                terrainMetrics.slopeDeg === null
                  ? 'bg-slate-900/60 text-slate-400 border-slate-700/50'
                  : terrainMetrics.isSlopeHazard
                  ? 'bg-rose-950/50 text-rose-300 border-rose-500/40'
                  : 'bg-emerald-950/40 text-emerald-300 border-emerald-500/30'
              }`}
            >
              {terrainMetrics.slopeDeg === null
                ? 'DEM UNMODELED'
                : terrainMetrics.isSlopeHazard
                ? '✖ SLOPE HAZARD'
                : '● LANDER SAFE'}
            </span>
          </div>

          {!terrainMetrics.inSouthPoleCap && (
            <div className="p-2.5 rounded-xl bg-cyan-950/20 border border-cyan-500/30 flex items-start gap-2 text-[11px] font-mono text-cyan-200">
              <Info className="w-3.5 h-3.5 text-cyan-400 shrink-0 mt-0.5" />
              <div className="space-y-0.5 leading-tight">
                <span className="font-semibold text-white">Equatorial / Mid-Latitude Region</span>
                <p className="text-[10.5px] text-slate-300">
                  High-resolution Horn slope &amp; surface roughness models cover the South Polar Cap (80.0°S–90.0°S). Regional selenography and published catalog data are displayed below.
                </p>
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 block">
              Terrain Engineering Advisories
            </span>
            {terrainMetrics.slopeDeg === null ? (
              <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800/80 text-[11px] font-mono text-slate-400">
                Slope data is unavailable outside the LOLA South Pole DEM. Terrain tilt advisories require local high-resolution topography.
              </div>
            ) : terrainMetrics.warnings.length > 0 ? (
              terrainMetrics.warnings.map((warn) => (
                <div
                  key={warn.id}
                  className={`p-2.5 rounded-xl border space-y-0.5 ${
                    warn.severity === 'critical'
                      ? 'bg-rose-950/35 border-rose-500/40'
                      : 'bg-amber-950/30 border-amber-500/35'
                  }`}
                >
                  <div className="flex items-center gap-1.5 text-xs font-mono font-semibold text-white">
                    <AlertTriangle
                      className={`w-3.5 h-3.5 shrink-0 ${
                        warn.severity === 'critical' ? 'text-rose-400' : 'text-amber-400'
                      }`}
                    />
                    <span>{warn.title}</span>
                  </div>
                  <p className="text-[11px] text-slate-300 leading-relaxed pl-5">
                    {warn.detail}
                  </p>
                </div>
              ))
            ) : (
              <div className="p-2.5 rounded-xl bg-emerald-950/25 border border-emerald-500/30 flex items-center gap-2 text-xs font-mono text-emerald-300">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>
                  Slope ({terrainMetrics.slopeDeg != null ? `${terrainMetrics.slopeDeg.toFixed(1)}°` : 'nominal'}) and roughness (
                  {terrainMetrics.roughnessM !== null ? `${terrainMetrics.roughnessM.toFixed(1)} m` : 'nominal'}) are within safe landing limits.
                </span>
              </div>
            )}
          </div>

          <div className="rounded-xl bg-[#0A121E] border border-slate-800/80 overflow-hidden">
            <button
              type="button"
              onClick={onToggleDataSources}
              aria-expanded={isDataSourcesOpen}
              aria-controls="terrain-data-sources-panel"
              className="w-full p-2.5 flex items-center justify-between text-left hover:bg-slate-800/30 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/70"
            >
              <div className="flex items-center gap-1.5 text-xs font-mono font-semibold text-slate-200">
                <Database className="w-3.5 h-3.5 text-cyan-400" />
                <span>Data Sources &amp; Topographic Provenance</span>
              </div>
              <div className="flex items-center gap-1 text-[10px] font-mono text-cyan-400">
                <span>{isDataSourcesOpen ? 'Hide' : 'View'}</span>
                <ChevronDown
                  className={`w-3.5 h-3.5 transition-transform duration-200 ${
                    isDataSourcesOpen ? 'rotate-180' : ''
                  }`}
                />
              </div>
            </button>
            {isDataSourcesOpen && (
              <div
                id="terrain-data-sources-panel"
                className="p-3 pt-0 border-t border-slate-800/60 space-y-2 text-[11px] font-mono text-slate-300"
              >
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1 py-1 border-b border-slate-800/50">
                  <span className="text-slate-400 col-span-1">Dataset Name</span>
                  <span className="text-white col-span-1 sm:col-span-2">
                    NASA PDS LRO-L-LOLA-4-GDR-V1.0
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1 py-1 border-b border-slate-800/50">
                  <span className="text-slate-400 col-span-1">Instrument</span>
                  <span className="text-slate-200 col-span-1 sm:col-span-2">
                    Lunar Orbiter Laser Altimeter (LOLA) / LRO
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1 py-1 border-b border-slate-800/50">
                  <span className="text-slate-400 col-span-1">Spatial Resolution</span>
                  <span className="text-slate-200 col-span-1 sm:col-span-2">
                    400 m/pixel Polar Stereographic Grid (20 m/px base track profiles)
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1 py-1 border-b border-slate-800/50">
                  <span className="text-slate-400 col-span-1">Elevation Units</span>
                  <span className="text-slate-200 col-span-1 sm:col-span-2">
                    Meters relative to IAU Lunar Sphere (R₀ = 1,737,400.0 m)
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1 py-1 border-b border-slate-800/50">
                  <span className="text-slate-400 col-span-1">Uncertainty</span>
                  <span className="text-slate-200 col-span-1 sm:col-span-2">
                    ±1.0 m absolute vertical · ±0.1–0.3 m inter-track · ±20 m horizontal
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1 py-1 border-b border-slate-800/50">
                  <span className="text-slate-400 col-span-1">Coverage Area</span>
                  <span className="text-slate-200 col-span-1 sm:col-span-2">
                    80.0°S to 90.0°S (Lunar South Polar Cap, ±304 km bounds)
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1 py-1">
                  <span className="text-slate-400 col-span-1">Derivation Method</span>
                  <span className="text-slate-200 col-span-1 sm:col-span-2">
                    Horn 3×3 weighted gradient stencil for slope; local window RMS height dispersion for roughness; Great-Circle geodesic distance for landmarks.
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="p-6 rounded-xl bg-[#0C0D12] border border-slate-800/80 text-xs font-mono text-slate-400 space-y-2.5 text-center my-4">
          <Mountain className="w-8 h-8 text-cyan-400 mx-auto opacity-70" />
          <div className="text-slate-200 font-semibold text-sm">Terrain Telemetry Unavailable</div>
          <p className="text-[11px] text-slate-400 max-w-xs mx-auto leading-relaxed">
            LOLA digital elevation model telemetry is not present for this coordinate ({latStr}, {lonStr}).
          </p>
        </div>
      )}
    </div>
  );
}
