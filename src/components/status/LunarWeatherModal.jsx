import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  X,
  Thermometer,
  Sun,
  Activity,
  Wind,
  ShieldAlert,
  RefreshCw,
  Compass,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';
import { fetchSpaceWeather, FALLBACK_SPACE_WEATHER } from '../../services/spaceWeather.js';
import { getLunarTemperature, classifySolarLightingState } from '../../utils/lunarThermal.js';
import { formatLunarCoordinates } from '../../utils/coordinates.js';
import { celestialTimeStore } from '../../utils/celestialTime.js';
import { computeCelestialState, solarPosition } from '../../utils/lunarEphemeris.js';
import {
  horizonAt,
  HORIZON_TABLE,
  ensurePolarDemLoaded,
  sampleLunarTerrainMetrics,
  subscribePolarDemReady,
} from '../../utils/horizons.js';
import { useDialogA11y } from '../../hooks/useDialogA11y.js';

export default function LunarWeatherModal({
  isOpen,
  onClose,
  selectedMoonFeature,
}) {
  const dialogRef = useRef(null);
  const { titleId } = useDialogA11y({ isOpen, onClose, containerRef: dialogRef });
  const [spaceWeather, setSpaceWeather] = useState(FALLBACK_SPACE_WEATHER);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSynced, setHasSynced] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState(null);
  const [demTick, setDemTick] = useState(0);
  const [timeMs, setTimeMs] = useState(() => celestialTimeStore.get().ms);

  useEffect(() => {
    const unsubDem = subscribePolarDemReady(() => setDemTick((t) => t + 1));
    ensurePolarDemLoaded()
      .then((g) => {
        if (g) setDemTick((t) => t + 1);
      })
      .catch(() => {});
    const unsubTime = celestialTimeStore.subscribe(({ ms }) => {
      setTimeMs(ms);
    });
    return () => {
      unsubDem();
      unsubTime();
    };
  }, []);

  const targetLat = selectedMoonFeature?.latitude ?? -89.4;
  const targetLon = selectedMoonFeature?.longitude ?? 0.0;
  const targetId = selectedMoonFeature?.id || 'lunar-south-pole';
  const { latStr, lonStr } = formatLunarCoordinates(targetLon, targetLat, 2);

  const terrainMetrics = useMemo(() => {
    void demTick;
    return sampleLunarTerrainMetrics(targetLat, targetLon, selectedMoonFeature);
  }, [targetLat, targetLon, selectedMoonFeature, demTick]);

  const solarStateFlat = useMemo(() => {
    const cState = computeCelestialState(timeMs);
    return solarPosition(cState, targetLat, targetLon);
  }, [timeMs, targetLat, targetLon]);

  const solarHorizonDeg = useMemo(() => {
    void demTick;
    return horizonAt(HORIZON_TABLE, targetId, solarStateFlat.azimuthDeg, targetLat, targetLon) ?? 0;
  }, [targetId, solarStateFlat.azimuthDeg, targetLat, targetLon, demTick]);

  const localThermal = useMemo(() => {
    return getLunarTemperature(targetLat, targetLon, new Date(timeMs), {
      terrainHorizonDeg: solarHorizonDeg,
      elevationM: terrainMetrics?.elevationM ?? null,
    });
  }, [targetLat, targetLon, timeMs, solarHorizonDeg, terrainMetrics?.elevationM]);

  const lightingState = useMemo(() => {
    return classifySolarLightingState({
      solarElevationDeg: localThermal.solarElevationDeg,
      terrainHorizonDeg: solarHorizonDeg,
      isDaylight: localThermal.isDaylight,
      isTerrainShadowed: localThermal.isTerrainShadowed,
      isPSR: localThermal.isPSR,
    });
  }, [localThermal, solarHorizonDeg]);

  const loadData = useCallback(async (force = false) => {
    setIsLoading(true);
    try {
      const data = await fetchSpaceWeather(force);
      setSpaceWeather(data);
      setLastRefreshed(new Date());
    } catch {
      // Handled in service fallback
    } finally {
      setHasSynced(true);
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      loadData(false);
    } else {
      setHasSynced(false);
    }
  }, [isOpen, loadData]);

  if (!isOpen) return null;

  const isSyncing = isLoading || !hasSynced;
  const isLiveFeed = !isSyncing && spaceWeather.speed != null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md animate-in fade-in duration-150 pointer-events-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="relative w-full max-w-2xl max-h-[92dvh] flex flex-col bg-[#050507] border border-[#1E2028] rounded-3xl shadow-2xl overflow-hidden text-[#F8FAFC] font-sans focus:outline-none"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#1E2028] bg-[#0C0D12] shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-[#14161D] border border-[#88B38A]/40 flex items-center justify-center text-[#88B38A]">
              <Thermometer className="w-4 h-4" />
            </div>
            <div>
              <h2 id={titleId} className="font-serif text-xl text-[#F8FAFC]">Lunar &amp; Space Weather</h2>
              <p className="text-[10px] font-mono text-[#8E95A5]">
                Surface Thermal Environment · Solar Wind &amp; Radiation Telemetry
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => loadData(true)}
              disabled={isLoading}
              aria-label="Refresh telemetry"
              className="p-1.5 rounded-full bg-[#14161D] hover:bg-[#1E2028] text-[#8E95A5] hover:text-white disabled:opacity-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
              title="Refresh telemetry"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close lunar weather dialog"
              className="p-1.5 rounded-full bg-[#14161D] hover:bg-[#1E2028] text-[#8E95A5] hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6 flex-1 overflow-y-auto custom-scrollbar">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[#F8FAFC] flex items-center gap-2">
                <Sun className="w-3.5 h-3.5 text-[#F8FAFC]" />
                <span>Surface Thermal Environment</span>
              </span>
              <span className="text-[10px] font-mono text-[#8E95A5]">
                Probe: {latStr}, {lonStr}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-4 rounded-2xl bg-[#0C0D12] border border-[#1E2028] space-y-1">
                <span className="text-[10px] font-mono text-[#8E95A5] block">Surface Temperature</span>
                <div className="font-mono text-2xl font-bold text-[#F8FAFC]">
                  {localThermal.tempC > 0 ? `+${localThermal.tempC}` : localThermal.tempC}°C
                </div>
                <div className="text-[10px] font-mono text-[#8E95A5]">
                  {localThermal.tempK} K · {localThermal.tempF > 0 ? `+${localThermal.tempF}` : localThermal.tempF}°F
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-[#0C0D12] border border-[#1E2028] space-y-1">
                <span className="text-[10px] font-mono text-[#8E95A5] block">Solar Elevation</span>
                <div className="font-mono text-2xl font-bold text-[#F8FAFC]">
                  {localThermal.solarElevationDeg.toFixed(1)}°
                </div>
                <div className="text-[10px] font-mono text-[#8E95A5]">
                  {localThermal.isDaylight
                    ? 'Direct Solar Insolation'
                    : lightingState.isTerrainShadowed
                    ? `Masked by ${solarHorizonDeg.toFixed(1)}° Ridge`
                    : 'Sub-Horizon'}
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-[#0C0D12] border border-[#1E2028] space-y-1">
                <span className="text-[10px] font-mono text-[#8E95A5] block">Thermal Regime</span>
                <div
                  className={`font-mono text-base font-bold mt-1 ${
                    localThermal.isPSR
                      ? 'text-purple-400'
                      : lightingState.isTerrainShadowed
                      ? 'text-amber-300'
                      : localThermal.isDaylight
                      ? 'text-[#34D399]'
                      : 'text-blue-400'
                  }`}
                >
                  {localThermal.isPSR
                    ? 'Permanent Shadow'
                    : lightingState.isTerrainShadowed
                    ? 'Terrain-Shadowed'
                    : localThermal.isDaylight
                    ? 'Daylight Insolation'
                    : 'Lunar Night'}
                </div>
                <div className="text-[9.5px] text-[#8E95A5]">
                  {localThermal.isPSR
                    ? 'Cryogenic Volatile Trap (<40K)'
                    : lightingState.isTerrainShadowed
                    ? 'Low Sun Occluded by Topography'
                    : 'Equilibrium Radiation'}
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-semibold text-[#F8FAFC] flex items-center gap-2">
                <Wind className="w-3.5 h-3.5 text-[#88B38A]" />
                <span>Solar Wind &amp; Magnetic Field Telemetry</span>
              </span>
              <span className="text-[10px] font-mono text-[#8E95A5]">
                Source: {spaceWeather.source}
                {lastRefreshed ? ` · Synced ${lastRefreshed.toISOString().slice(11, 16)} UTC` : ''}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3.5 rounded-2xl bg-[#0C0D12] border border-[#1E2028] space-y-1">
                <span className="text-[10px] font-mono text-[#8E95A5] block">Solar Wind Speed</span>
                <div className="font-mono text-lg font-bold text-[#F8FAFC]">
                  {spaceWeather.speed != null ? `${spaceWeather.speed} km/s` : 'Not available'}
                </div>
                <span className="text-[9.5px] text-[#88B38A] font-mono">
                  {spaceWeather.speedStatus}
                </span>
              </div>

              <div className="p-3.5 rounded-2xl bg-[#0C0D12] border border-[#1E2028] space-y-1">
                <span className="text-[10px] font-mono text-[#8E95A5] block">Proton Density</span>
                <div className="font-mono text-lg font-bold text-[#F8FAFC]">
                  {spaceWeather.density != null ? `${spaceWeather.density} p/cm³` : 'Not available'}
                </div>
                <span className="text-[9.5px] text-[#8E95A5]">Solar wind stream</span>
              </div>

              <div className="p-3.5 rounded-2xl bg-[#0C0D12] border border-[#1E2028] space-y-1">
                <span className="text-[10px] font-mono text-[#8E95A5] block">IMF Bz Field</span>
                <div className="font-mono text-lg font-bold text-[#F8FAFC]">
                  {spaceWeather.bz != null ? `${spaceWeather.bz} nT` : 'Not available'}
                </div>
                <span className="text-[9.5px] text-[#8E95A5]">
                  Total Bt: {spaceWeather.bt != null ? `${spaceWeather.bt} nT` : 'N/A'}
                </span>
              </div>

              <div className="p-3.5 rounded-2xl bg-[#0C0D12] border border-[#1E2028] space-y-1">
                <span className="text-[10px] font-mono text-[#8E95A5] block">Ion Temperature</span>
                <div className="font-mono text-lg font-bold text-[#F8FAFC]">
                  {spaceWeather.temperature != null
                    ? `${spaceWeather.temperature.toLocaleString()} K`
                    : 'Not available'}
                </div>
                <span className="text-[9.5px] text-[#8E95A5]">Thermal plasma</span>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-[#0C0D12] border border-[#1E2028] flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <ShieldAlert
                  className={`w-4 h-4 shrink-0 ${
                    isSyncing ? 'text-amber-300' : isLiveFeed ? 'text-[#88B38A]' : 'text-rose-400'
                  }`}
                />
                <div className="min-w-0">
                  <div className="text-xs font-medium text-[#F8FAFC]">
                    Lunar EVA Radiation &amp; Plasma Environment
                  </div>
                  <div className="text-[10px] text-[#8E95A5]">
                    {isSyncing
                      ? 'Syncing NOAA SWPC DSCOVR/ACE L1 telemetry feed...'
                      : isLiveFeed
                      ? 'Live NOAA SWPC DSCOVR/ACE L1 solar wind feed active'
                      : 'Live NOAA SWPC feed unreachable · Displaying analytical surface thermal model only'}
                  </div>
                </div>
              </div>
              <span
                className={`px-2.5 py-1 rounded-full text-[10px] font-mono font-semibold border shrink-0 ${
                  isSyncing
                    ? 'bg-amber-500/15 text-amber-300 border-amber-500/35'
                    : isLiveFeed
                    ? 'bg-[#88B38A]/20 text-[#88B38A] border-[#88B38A]/40'
                    : 'bg-rose-500/15 text-rose-300 border-rose-500/35'
                }`}
              >
                {isSyncing ? 'SYNCING...' : isLiveFeed ? 'LIVE FEED' : 'OFFLINE'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
