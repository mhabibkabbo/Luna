import React, { useState, useEffect, useCallback } from 'react';
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
import { getLunarTemperature } from '../../utils/lunarThermal.js';
import { formatLunarCoordinates } from '../../utils/coordinates.js';
import { celestialTimeStore } from '../../utils/celestialTime.js';

export default function LunarWeatherModal({
  isOpen,
  onClose,
  selectedMoonFeature,
}) {
  const [spaceWeather, setSpaceWeather] = useState(FALLBACK_SPACE_WEATHER);
  const [isLoading, setIsLoading] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState(new Date());
  const [timeMs, setTimeMs] = useState(() => celestialTimeStore.get().ms);

  useEffect(() => {
    return celestialTimeStore.subscribe(({ ms }) => {
      setTimeMs(ms);
    });
  }, []);

  const targetLat = selectedMoonFeature?.latitude ?? -89.4;
  const targetLon = selectedMoonFeature?.longitude ?? 0.0;
  const { latStr, lonStr } = formatLunarCoordinates(targetLon, targetLat, 2);

  const localThermal = getLunarTemperature(targetLat, targetLon, new Date(timeMs));

  const loadData = useCallback(async (force = false) => {
    setIsLoading(true);
    try {
      const data = await fetchSpaceWeather(force);
      setSpaceWeather(data);
      setLastRefreshed(new Date());
    } catch {
      // Handled in service fallback
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      loadData(false);
    }
  }, [isOpen, loadData]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md animate-in fade-in duration-150 select-none pointer-events-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative w-full max-w-2xl bg-[#050507] border border-[#1E2028] rounded-3xl shadow-2xl overflow-hidden text-[#F8FAFC] font-sans">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#1E2028] bg-[#0C0D12]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-[#14161D] border border-[#88B38A]/40 flex items-center justify-center text-[#88B38A]">
              <Thermometer className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-serif text-xl text-[#F8FAFC]">Lunar &amp; Space Weather</h2>
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
              className="p-1.5 rounded-full bg-[#14161D] hover:bg-[#14161D] text-[#8E95A5] hover:text-white transition-colors"
              title="Refresh telemetry"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-full bg-[#14161D] hover:bg-[#14161D] text-[#8E95A5] hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-6 max-h-[82vh] overflow-y-auto custom-scrollbar">
          {/* Section 1: Surface Thermal Model */}
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
                  {localThermal.isDaylight ? 'Solar Insolation Active' : 'Sub-Horizon'}
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-[#0C0D12] border border-[#1E2028] space-y-1">
                <span className="text-[10px] font-mono text-[#8E95A5] block">Thermal Regime</span>
                <div
                  className={`font-mono text-base font-bold mt-1 ${
                    localThermal.isPSR
                      ? 'text-purple-400'
                      : localThermal.isDaylight
                      ? 'text-[#F8FAFC]'
                      : 'text-blue-400'
                  }`}
                >
                  {localThermal.isPSR
                    ? 'Permanent Shadow'
                    : localThermal.isDaylight
                    ? 'Daylight Insolation'
                    : 'Lunar Night'}
                </div>
                <div className="text-[9.5px] text-[#8E95A5]">
                  {localThermal.isPSR ? 'Cryogenic Volatile Trap (<40K)' : 'Equilibrium Radiation'}
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Space Weather NOAA SWPC Telemetry */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[#F8FAFC] flex items-center gap-2">
                <Wind className="w-3.5 h-3.5 text-[#88B38A]" />
                <span>Solar Wind &amp; Magnetic Field Telemetry</span>
              </span>
              <span className="text-[10px] font-mono text-[#8E95A5]">
                Source: {spaceWeather.source}
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

            {/* Astronaut EVA Environmental Assessment Banner */}
            <div className="p-3.5 rounded-2xl bg-[#0C0D12] border border-[#1E2028] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <ShieldAlert className="w-4 h-4 text-[#88B38A]" />
                <div>
                  <div className="text-xs font-medium text-[#F8FAFC]">
                    Lunar EVA Radiation &amp; Plasma Environment
                  </div>
                  <div className="text-[10px] text-[#8E95A5]">
                    {spaceWeather.speed != null
                      ? 'Live NOAA SWPC DSCOVR/ACE L1 solar wind feed active'
                      : 'Live NOAA SWPC feed unreachable · Displaying analytical surface thermal model only'}
                  </div>
                </div>
              </div>
              <span className="px-2.5 py-1 rounded-full text-[10px] font-mono font-semibold bg-[#88B38A]/20 text-[#88B38A] border border-[#88B38A]/40">
                {spaceWeather.speed != null ? 'LIVE FEED' : 'OFFLINE'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
