import React from 'react';
import { Thermometer, RefreshCw, Droplets } from 'lucide-react';

export default function FeaturePanelThermalTab({
  isPlaceholderLocation,
  solarLightingState,
  localThermal,
  onRefreshWeather,
  isWeatherLoading,
  spaceWeather,
  volatileData,
  isExpanded,
}) {
  return (
    <div className="space-y-2.5">
      <div className="p-2.5 rounded-xl bg-[#0A121E] border border-slate-800/80 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-white flex items-center gap-1.5">
            <Thermometer className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            <span>Lunar Weather &amp; Environment</span>
          </span>
          <div className="flex items-center gap-1.5">
            <span
              className={`px-1.5 py-0.5 rounded text-[9.5px] font-mono font-semibold border ${
                isPlaceholderLocation
                  ? 'bg-slate-900/60 text-slate-400 border-slate-700/50'
                  : solarLightingState
                  ? solarLightingState.badgeClass
                  : localThermal?.isPSR
                  ? 'bg-purple-950/40 text-purple-300 border-purple-500/40'
                  : localThermal?.isDaylight
                  ? 'bg-amber-950/40 text-amber-300 border-amber-500/40'
                  : 'bg-blue-950/40 text-blue-300 border-blue-500/40'
              }`}
            >
              {isPlaceholderLocation
                ? 'Coordinates TBD'
                : solarLightingState
                ? solarLightingState.isSunlit
                  ? 'Daylight Insolation'
                  : solarLightingState.label
                : localThermal?.isPSR
                ? 'Permanent Shadow'
                : localThermal?.isDaylight
                ? 'Daylight Insolation'
                : 'Night'}
            </span>
            <button
              type="button"
              onClick={onRefreshWeather}
              disabled={isWeatherLoading}
              aria-label="Refresh live NOAA SWPC telemetry"
              title="Refresh live NOAA SWPC telemetry"
              className="p-1 rounded-md bg-[#050507] hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/70 disabled:opacity-50"
            >
              <RefreshCw className={`w-3 h-3 ${isWeatherLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-1.5 font-mono text-xs">
          <div className="p-2 rounded-lg bg-[#050507] border border-slate-800/70 space-y-0.5">
            <div className="flex items-center justify-between text-[9.5px] text-slate-400">
              <span>Surface Temp</span>
              <span className="text-[9px] text-slate-500">Regolith {localThermal?.subsurfaceTempC ?? -45}°C</span>
            </div>
            <div className="flex items-baseline gap-1.5">
              <span
                className={`text-sm font-bold tabular-nums ${
                  localThermal?.isPSR
                    ? 'text-purple-400'
                    : !localThermal?.isDaylight
                    ? 'text-sky-300'
                    : localThermal?.tempC > 80
                    ? 'text-amber-300'
                    : 'text-white'
                }`}
              >
                {localThermal
                  ? `${localThermal.tempC > 0 ? '+' : ''}${localThermal.tempC}°C`
                  : '—'}
              </span>
              <span className="text-[10px] text-slate-400 tabular-nums">
                ({localThermal?.tempK ?? '—'} K)
              </span>
            </div>
          </div>

          <div className="p-2 rounded-lg bg-[#050507] border border-slate-800/70 space-y-0.5">
            <div className="flex items-center justify-between text-[9.5px]">
              <span className="text-slate-400">Solar Wind</span>
              <span
                className={`text-[9px] font-semibold truncate ${
                  spaceWeather?.speedStatus === 'High Speed Stream'
                    ? 'text-rose-400'
                    : spaceWeather?.speedStatus === 'Moderate'
                    ? 'text-amber-300'
                    : 'text-emerald-400'
                }`}
              >
                {spaceWeather?.speedStatus || 'Nominal'}
              </span>
            </div>
            <div className="text-sm font-bold text-white tabular-nums">
              {spaceWeather?.speed != null ? (
                <>
                  {spaceWeather.speed}{' '}
                  <span className="text-[10px] font-normal text-slate-400">km/s</span>
                </>
              ) : (
                <span className="text-slate-500 font-normal text-xs">Standby</span>
              )}
            </div>
          </div>

          <div className="p-2 rounded-lg bg-[#050507] border border-slate-800/70 space-y-0.5">
            <div className="text-[9.5px] text-slate-400">Proton Density</div>
            <div className="text-xs font-bold text-cyan-300 tabular-nums">
              {spaceWeather?.density != null ? (
                <>
                  {spaceWeather.density}{' '}
                  <span className="text-[9.5px] font-normal text-slate-400">p/cm³</span>
                </>
              ) : (
                <span className="text-slate-500 font-normal text-xs">Simulated</span>
              )}
            </div>
            <div className="text-[9px] text-slate-500">Solar wind plasma</div>
          </div>

          <div className="p-2 rounded-lg bg-[#050507] border border-slate-800/70 space-y-0.5">
            <div className="flex items-center justify-between text-[9.5px] text-slate-400">
              <span>IMF Bz / Bt</span>
              <span className="text-[9px] text-slate-500">
                Bt: {spaceWeather?.bt != null ? `${spaceWeather.bt} nT` : 'N/A'}
              </span>
            </div>
            <div className="text-xs font-bold tabular-nums">
              <span
                className={
                  spaceWeather?.bz < -5
                    ? 'text-rose-400'
                    : spaceWeather?.bz < 0
                    ? 'text-amber-300'
                    : 'text-cyan-300'
                }
              >
                {spaceWeather?.bz != null ? `${spaceWeather.bz > 0 ? '+' : ''}${spaceWeather.bz} nT` : '—'}
              </span>
            </div>
            <div className="text-[9px] text-slate-500">Interplanetary B-field</div>
          </div>
        </div>

        <div className="text-[9.5px] font-mono text-slate-400 flex items-center justify-between border-t border-slate-800/60 pt-1">
          <span className="truncate max-w-[220px]">
            {spaceWeather?.source || 'NOAA Space Weather Prediction Center'}
          </span>
          <span className="px-1.5 py-0.5 rounded bg-[#050507] border border-slate-800 text-slate-300 text-[9px]">
            {spaceWeather?.isFallback ? 'Simulated Model' : 'Live NOAA SWPC'}
          </span>
        </div>
        <p className="text-[9px] font-mono text-slate-500">
          Temperatures follow the selected ephemeris time; NOAA telemetry remains live.
        </p>
      </div>

      {volatileData && (
        <div className="p-2.5 rounded-xl bg-[#0A121E] border border-slate-800/80 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-white flex items-center gap-1.5">
              <Droplets className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
              <span>Volatiles &amp; Cryogenic PSR Assessment</span>
            </span>
            <span
              className={`px-1.5 py-0.5 rounded text-[9.5px] font-mono font-semibold border ${
                volatileData.isPSR
                  ? 'bg-purple-950/40 text-purple-300 border-purple-500/40'
                  : 'bg-slate-900/60 text-slate-400 border-slate-700/50'
              }`}
            >
              {volatileData.isPSR ? '● Cryogenic Cold Trap' : '○ Non-PSR Zone'}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2 font-mono text-xs">
            <div className="p-2 rounded-lg bg-[#050507] border border-slate-800/70 space-y-0.5">
              <span className="text-[9.5px] text-slate-400 block">PSR Surface Area</span>
              <div className="text-sm font-bold text-white tabular-nums">
                {volatileData.psrAreaKm2 > 0 ? (
                  <>
                    {volatileData.psrAreaKm2.toLocaleString()}{' '}
                    <span className="text-[10px] font-normal text-slate-400">km²</span>
                  </>
                ) : (
                  <span className="text-slate-400 text-xs">0 km²</span>
                )}
              </div>
              <span
                className="text-[9px] text-slate-500 block truncate"
                title={
                  volatileData.psrAreaKm2 > 0
                    ? `${volatileData.psrAreaM2.toLocaleString()} m² permanent shadow`
                    : 'Illuminated / Non-cold trap terrain'
                }
              >
                {volatileData.psrAreaKm2 > 0
                  ? `${volatileData.psrAreaM2.toLocaleString()} m² floor`
                  : 'Outside cold trap'}
              </span>
            </div>
            <div className="p-2 rounded-lg bg-[#050507] border border-slate-800/70 space-y-0.5">
              <span className="text-[9.5px] text-slate-400 block">H₂O Regolith Abundance</span>
              <div
                className="text-sm font-bold text-cyan-300 tabular-nums truncate"
                title={volatileData.h2oAbundance}
              >
                {volatileData.h2oAbundance}
              </div>
              <span
                className="text-[9px] text-slate-500 block truncate"
                title={volatileData.provenance}
              >
                {volatileData.provenance}
              </span>
            </div>
          </div>
        </div>
      )}

      {isExpanded && (
        <div className="space-y-2.5 pt-1 border-t border-slate-800/80">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 font-mono text-xs">
            <div className="p-2.5 rounded-xl bg-[#0A121E] border border-slate-800/80">
              <span className="text-[10px] text-slate-400 block">Plasma Temp</span>
              <span className="text-sm font-bold text-white tabular-nums">
                {spaceWeather?.temperature != null
                  ? `${spaceWeather.temperature.toLocaleString()} K`
                  : '100,000 K'}
              </span>
              <span className="text-[10px] text-slate-400 block">Ion Temperature</span>
            </div>
          </div>
        </div>
      )}

      {localThermal && (
        <div className="p-2.5 rounded-xl bg-[#0A121E] border border-slate-800/80 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-white flex items-center gap-1.5">
              <Thermometer className="w-3.5 h-3.5 text-cyan-400" />
              <span>Surface Radiative Temperature (Calculated — Analytical Model)</span>
            </span>
            <span
              className={`text-[10px] font-mono font-semibold px-2 py-0.5 rounded border ${
                solarLightingState
                  ? solarLightingState.badgeClass
                  : localThermal.isPSR
                  ? 'bg-purple-950/50 text-purple-300 border-purple-500/40'
                  : localThermal.isDaylight
                  ? 'bg-amber-950/40 text-amber-300 border-amber-500/40'
                  : 'bg-blue-950/50 text-blue-300 border-blue-500/40'
              }`}
            >
              {solarLightingState
                ? solarLightingState.isPSR
                  ? 'PSR Cold Trap'
                  : solarLightingState.isSunlit
                  ? 'Daylight Insolation'
                  : solarLightingState.label
                : localThermal.isPSR
                ? 'PSR Cold Trap'
                : localThermal.isDaylight
                ? 'Daylight Insolation'
                : 'Night'}
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 font-mono text-xs">
            <div className="p-2 rounded-lg bg-[#050507] border border-slate-800/70">
              <span className="text-[10px] text-slate-400 block">Bolometric Temp</span>
              <span className="text-sm font-bold text-white tabular-nums">
                {localThermal.tempC > 0 ? `+${localThermal.tempC}` : localThermal.tempC}°C
              </span>
              <span className="text-[10px] text-slate-400 block tabular-nums">
                {localThermal.tempK} K
              </span>
            </div>
            <div className="p-2 rounded-lg bg-[#050507] border border-slate-800/70">
              <span className="text-[10px] text-slate-400 block">Subsurface (0.5m)</span>
              <span className="text-sm font-bold text-cyan-300 tabular-nums">
                {localThermal.subsurfaceTempC ?? -45}°C
              </span>
              <span className="text-[10px] text-slate-400 block">Regolith Equilibrium</span>
            </div>
            <div className="p-2 rounded-lg bg-[#050507] border border-slate-800/70">
              <span className="text-[10px] text-slate-400 block">Thermal Regime</span>
              <span className="text-[11px] font-bold text-amber-300 block mt-0.5">
                {localThermal.isPSR
                  ? '< 40 K Trap'
                  : localThermal.tempK < 110
                  ? 'Cryogenic'
                  : 'Nominal'}
              </span>
              <span className="text-[10px] text-slate-400 block">Calculated (Equilibrium)</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
