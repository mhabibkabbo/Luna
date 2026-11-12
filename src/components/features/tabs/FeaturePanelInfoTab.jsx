import React from 'react';
import {
  Copy,
  Check,
  AlertTriangle,
  ExternalLink,
  CheckCircle2,
} from 'lucide-react';

export default function FeaturePanelInfoTab({
  safeFeature,
  clpsData,
  regionInfo,
  featLat,
  featLon,
  isPlaceholderLocation,
  terrainMetrics,
  copied,
  onCopyCoords,
  isContextExpanded,
  onToggleContextExpanded,
  siteContextDescription,
  overviewWarnings,
  localThermal,
  isExpanded,
  state,
  sun,
  sunStatusMeta,
  solarDiscPct,
  solarLightingState,
  sunTerrainHorizon,
  solarTransition,
  earthLook,
  earthTerrainHorizon,
}) {
  return (
    <div className="space-y-2.5">
      <div className="p-3 rounded-xl bg-[#0C0D12] border border-white/[0.08] flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[10.5px] font-sans font-medium uppercase tracking-[0.06em] text-[#8E95A5]">
            Coordinates · {regionInfo?.face || 'Nearside'}
          </div>
          <div className="font-mono text-[13px] font-medium text-white tabular-nums whitespace-nowrap mt-0.5">
            {isPlaceholderLocation ? (
              <span className="text-amber-300 font-sans text-xs">Unannounced (Far Side TBD)</span>
            ) : (
              <>
                {Math.abs(featLat).toFixed(3)}°{featLat >= 0 ? 'N' : 'S'},{' '}
                {Math.abs(featLon).toFixed(3)}°{featLon >= 0 ? 'E' : 'W'}
              </>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2.5 shrink-0">
          {terrainMetrics && (
            <div className="text-right">
              <span className="text-[10.5px] font-sans font-medium text-[#8E95A5] block">Elev / Slope</span>
              <span className="text-[12.5px] font-mono font-medium text-[#E2E8F0] tabular-nums whitespace-nowrap mt-0.5 block">
                {isPlaceholderLocation ? (
                  <span className="font-sans font-normal text-amber-300/80 text-[11.5px]">Withheld (TBD)</span>
                ) : terrainMetrics.elevationM != null && terrainMetrics.slopeDeg != null ? (
                  <>
                    {terrainMetrics.elevationM > 0 ? '+' : ''}
                    {Math.round(terrainMetrics.elevationM).toLocaleString()}m ·{' '}
                    {terrainMetrics.slopeDeg.toFixed(1)}°
                  </>
                ) : (
                  <span className="font-sans font-normal text-[#8E95A5] text-[11.5px]">Not present in loaded dataset</span>
                )}
              </span>
            </div>
          )}
          <button
            type="button"
            onClick={onCopyCoords}
            title="Copy coordinates"
            className="p-1.5 rounded-lg bg-[#050507] hover:bg-white/[0.06] text-[#94A3B8] hover:text-white border border-white/[0.08] transition-colors"
          >
            {copied ? (
              <Check className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
      </div>

      {(safeFeature.horizonEligible === false ||
        safeFeature.positionTrust === 'illustrative' ||
        clpsData?.horizonEligible === false ||
        clpsData?.positionTrust === 'illustrative') && (
        <div className="px-2.5 py-1.5 rounded-xl bg-amber-950/40 border border-amber-500/40 flex items-center gap-2 text-[11px] font-mono text-amber-200">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <span>Exact landing coordinates not published by NASA (Display placeholder only)</span>
        </div>
      )}

      <div className="p-2.5 rounded-xl bg-[#0A121E] border border-slate-800/80 space-y-1.5">
        <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 block">
          Site Context &amp; Provenance
        </span>
        <p
          className="text-xs text-slate-300 leading-relaxed"
          style={
            isContextExpanded
              ? undefined
              : {
                  display: '-webkit-box',
                  WebkitBoxOrient: 'vertical',
                  WebkitLineClamp: 3,
                  overflow: 'hidden',
                }
          }
        >
          {siteContextDescription}
        </p>
        {siteContextDescription.length > 120 && (
          <button
            type="button"
            aria-expanded={isContextExpanded}
            onClick={onToggleContextExpanded}
            className="text-[10px] font-mono text-cyan-400 hover:text-cyan-300 transition-colors"
          >
            {isContextExpanded ? 'Show less' : 'Read full description'}
          </button>
        )}
        <div className="pt-1 flex items-center justify-between text-[10px] font-mono text-slate-400 border-t border-slate-800/70">
          <span>Datum: IAU Moon 2000 (R₀ = 1,737.4 km)</span>
          <a
            href={clpsData?.referenceLinks?.[0]?.url || 'https://lunar.gsfc.nasa.gov/'}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-cyan-400 hover:text-cyan-300"
          >
            <span>NASA LRO / PDS</span>
            <ExternalLink className="w-2.5 h-2.5" />
          </a>
        </div>
        <div className="text-[9.5px] font-mono text-slate-400 pt-1 border-t border-slate-800/70">
          Suitability scores are decision-support approximations computed from LOLA DEM altimetry and DE440 ephemerides—not official NASA flight certification.
        </div>
      </div>

      {overviewWarnings.length > 0 ? (
        <div className="space-y-1.5">
          {overviewWarnings.map((w) => (
            <div
              key={w.id}
              className={`px-2.5 py-1.5 rounded-xl border flex items-center gap-2 text-[11px] font-mono ${
                w.tone === 'critical'
                  ? 'bg-rose-950/35 border-rose-500/40 text-rose-200'
                  : 'bg-amber-950/30 border-amber-500/35 text-amber-200'
              }`}
            >
              <AlertTriangle
                className={`w-3.5 h-3.5 shrink-0 ${
                  w.tone === 'critical' ? 'text-rose-400' : 'text-amber-400'
                }`}
              />
              <span className="leading-tight">{w.text}</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="px-2.5 py-1.5 rounded-xl bg-emerald-950/25 border border-emerald-500/30 flex items-center justify-between text-[11px] font-mono text-emerald-300">
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span>Nominal Surface &amp; Link Conditions</span>
          </span>
          <span className="text-slate-400 tabular-nums">
            {localThermal ? `${localThermal.tempC > 0 ? '+' : ''}${localThermal.tempC}°C` : ''}
          </span>
        </div>
      )}

      {isExpanded && (
        <div className="space-y-2.5 pt-1 border-t border-slate-800/80">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 font-mono text-xs">
            <div className="p-2.5 rounded-xl bg-[#0A121E] border border-slate-800/80">
              <span className="text-[10px] text-slate-400 block">Earth Distance</span>
              <span className="text-sm font-bold text-white tabular-nums">
                {Math.round(state.earth.distanceKm).toLocaleString()} km
              </span>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2 font-mono">
        <div className="p-2.5 rounded-xl bg-[#0C0D12] border border-slate-800/80 space-y-1">
          <div className="flex items-center justify-between text-[10px]">
            <span className="text-slate-400">Sun Elevation / Az</span>
            <span
              className={`px-1.5 py-0.5 rounded text-[9px] font-bold whitespace-nowrap border ${
                solarLightingState
                  ? solarLightingState.badgeClass
                  : sunStatusMeta.label === 'Day' || sunStatusMeta.label === 'Sunlit'
                  ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                  : sunStatusMeta.label === 'Terrain-Shadowed' || sunStatusMeta.label === 'Terrain Masked'
                  ? 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                  : 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30'
              }`}
            >
              {sunStatusMeta.label}
            </span>
          </div>
          <div className="text-sm font-bold text-white tabular-nums">
            {sun?.elevationDeg != null ? `${sun.elevationDeg.toFixed(2)}° el` : '—'} ·{' '}
            {sun?.azimuthDeg != null ? `${sun.azimuthDeg.toFixed(1)}° az` : '—'}
          </div>
          <div className="text-[10px] text-slate-400">
            Solar Disc Visible: <strong className="text-amber-300">{solarDiscPct != null ? `${solarDiscPct}%` : '—'}</strong>
          </div>
        </div>

        <div className="p-2.5 rounded-xl bg-[#0C0D12] border border-slate-800/80 space-y-1">
          <div className="flex items-center justify-between text-[10px]">
            <span className="text-slate-400">Shadow / Masking</span>
            <span className="text-cyan-300 font-bold">
              {localThermal?.isPSR ? 'PSR Trap' : `${(sunTerrainHorizon ?? 0).toFixed(1)}° Ridge`}
            </span>
          </div>
          <div className="text-sm font-bold text-white tabular-nums">
            {sun?.elevationDeg != null
              ? `${sun.elevationDeg - (sunTerrainHorizon ?? 0) >= 0 ? '+' : ''}${(
                  sun.elevationDeg - (sunTerrainHorizon ?? 0)
                ).toFixed(2)}° clearance`
              : '—'}
          </div>
          <div className="text-[10px] text-slate-400 leading-snug break-words">
            {!solarTransition
              ? 'Telemetry withheld (Coordinates TBD)'
              : solarTransition.timeUntilMs === null
              ? solarTransition.isCurrentlySunlit
                ? 'Continuous Polar Day'
                : 'Extended Shadow Window'
              : `Next ${solarTransition.nextEvent}: ${solarTransition.formattedDuration}`}
          </div>
        </div>
      </div>

      <div className="p-2.5 rounded-xl bg-[#0C0D12] border border-slate-800/80 grid grid-cols-2 sm:grid-cols-3 gap-2 font-mono text-xs">
        <div>
          <span className="text-[10px] text-slate-400 block">Earth Elevation</span>
          <span className="font-bold text-white tabular-nums">
            {earthLook?.elevationDeg != null ? `${earthLook.elevationDeg.toFixed(1)}°` : '—'}
          </span>
          <span className="text-[10px] text-slate-400 block">
            Az {earthLook?.azimuthDeg != null ? `${earthLook.azimuthDeg.toFixed(0)}°` : '—'}
          </span>
        </div>
        <div>
          <span className="text-[10px] text-slate-400 block">Earth Horizon</span>
          <span className="font-bold text-cyan-300 tabular-nums">
            {(earthTerrainHorizon ?? 0).toFixed(1)}°
          </span>
          <span className="text-[10px] text-slate-400 block">
            {earthLook?.elevationDeg != null && earthLook.elevationDeg - (earthTerrainHorizon ?? 0) >= 0
              ? 'Unobstructed'
              : 'Occluded'}
          </span>
        </div>
        <div>
          <span className="text-[10px] text-slate-400 block">Optical Regime</span>
          <span className="font-bold text-emerald-300">
            {solarDiscPct == null
              ? 'Pending'
              : solarDiscPct > 0
              ? sun?.elevationDeg != null && sun.elevationDeg < 5
                ? 'Low-Angle Glint'
                : 'Daylight Ops'
              : 'Earthshine / IR'}
          </span>
          <span className="text-[10px] text-slate-400 block">Lidar Nominal</span>
        </div>
      </div>
    </div>
  );
}
