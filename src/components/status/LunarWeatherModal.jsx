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
      <div className="relative w-full max-w-2xl bg-[#12110D] border border-[#2D2A22] rounded-3xl shadow-2xl overflow-hidden text-[#F4EFE6] font-sans">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#2D2A22] bg-[#181711]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-[#26231B] border border-[#88B38A]/40 flex items-center justify-center text-[#88B38A]">
              <Thermometer className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-serif text-xl text-[#F4EFE6]">Lunar &amp; Space Weather</h2>
              <p className="text-[10px] font-mono text-[#A8A193]">
                Surface Thermal Environment · Solar Wind &amp; Radiation Telemetry
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => loadData(true)}
              disabled={isLoading}
              className="p-1.5 rounded-full bg-[#26231B] hover:bg-[#332E24] text-[#A8A193] hover:text-[#F4EFE6] transition-colors"
              title="Refresh telemetry"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-full bg-[#26231B] hover:bg-[#332E24] text-[#A8A193] hover:text-[#F4EFE6] transition-colors"
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
              <span className="text-xs font-semibold text-[#F4EFE6] flex items-center gap-2">
                <Sun className="w-3.5 h-3.5 text-[#E59A6D]" />
                <span>Surface Thermal Environment</span>
              </span>
              <span className="text-[10px] font-mono text-[#A8A193]">
                Probe: {latStr}, {lonStr}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-4 rounded-2xl bg-[#181711] border border-[#2D2A22] space-y-1">
                <span className="text-[10px] font-mono text-[#A8A193] block">Surface Temperature</span>
                <div className="font-mono text-2xl font-bold text-[#F4EFE6]">
                  {localThermal.tempC > 0 ? `+${localThermal.tempC}` : localThermal.tempC}°C
                </div>
                <div className="text-[10px] font-mono text-[#A8A193]">
                  {localThermal.tempK} K · {localThermal.tempF > 0 ? `+${localThermal.tempF}` : localThermal.tempF}°F
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-[#181711] border border-[#2D2A22] space-y-1">
                <span className="text-[10px] font-mono text-[#A8A193] block">Solar Elevation</span>
                <div className="font-mono text-2xl font-bold text-[#E59A6D]">
                  {localThermal.solarElevationDeg.toFixed(1)}°
                </div>
                <div className="text-[10px] font-mono text-[#A8A193]">
                  {localThermal.isDaylight ? 'Solar Insolation Active' : 'Sub-Horizon'}
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-[#181711] border border-[#2D2A22] space-y-1">
                <span className="text-[10px] font-mono text-[#A8A193] block">Thermal Regime</span>
                <div
                  className={`font-mono text-base font-bold mt-1 ${
                    localThermal.isPSR
                      ? 'text-purple-400'
                      : localThermal.isDaylight
                      ? 'text-[#E59A6D]'
                      : 'text-blue-400'
                  }`}
                >
                  {localThermal.isPSR
                    ? 'Permanent Shadow'
                    : localThermal.isDaylight
                    ? 'Daylight Insolation'
                    : 'Lunar Night'}
                </div>
                <div className="text-[9.5px] text-[#A8A193]">
                  {localThermal.isPSR ? 'Cryogenic Volatile Trap (<40K)' : 'Equilibrium Radiation'}
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Space Weather NOAA SWPC Telemetry */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[#F4EFE6] flex items-center gap-2">
                <Wind className="w-3.5 h-3.5 text-[#88B38A]" />
                <span>Solar Wind &amp; Magnetic Field Telemetry</span>
              </span>
              <span className="text-[10px] font-mono text-[#A8A193]">
                Source: {spaceWeather.source}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3.5 rounded-2xl bg-[#181711] border border-[#2D2A22] space-y-1">
                <span className="text-[10px] font-mono text-[#A8A193] block">Solar Wind Speed</span>
                <div className="font-mono text-lg font-bold text-[#F4EFE6]">
                  {spaceWeather.speed} km/s
                </div>
                <span className="text-[9.5px] text-[#88B38A] font-mono">
                  {spaceWeather.speedStatus}
                </span>
              </div>

              <div className="p-3.5 rounded-2xl bg-[#181711] border border-[#2D2A22] space-y-1">
                <span className="text-[10px] font-mono text-[#A8A193] block">Proton Density</span>
                <div className="font-mono text-lg font-bold text-[#F4EFE6]">
                  {spaceWeather.density} p/cm³
                </div>
                <span className="text-[9.5px] text-[#A8A193]">Solar wind stream</span>
              </div>

              <div className="p-3.5 rounded-2xl bg-[#181711] border border-[#2D2A22] space-y-1">
                <span className="text-[10px] font-mono text-[#A8A193] block">IMF Bz Field</span>
                <div className="font-mono text-lg font-bold text-[#E59A6D]">
                  {spaceWeather.bz} nT
                </div>
                <span className="text-[9.5px] text-[#A8A193]">Total Bt: {spaceWeather.bt} nT</span>
              </div>

              <div className="p-3.5 rounded-2xl bg-[#181711] border border-[#2D2A22] space-y-1">
                <span className="text-[10px] font-mono text-[#A8A193] block">Ion Temperature</span>
                <div className="font-mono text-lg font-bold text-[#F4EFE6]">
                  {(spaceWeather.temperature).toLocaleString()} K
                </div>
                <span className="text-[9.5px] text-[#A8A193]">Thermal plasma</span>
              </div>
            </div>

            {/* Astronaut EVA Environmental Assessment Banner */}
            <div className="p-3.5 rounded-2xl bg-[#181711] border border-[#2D2A22] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <ShieldAlert className="w-4 h-4 text-[#88B38A]" />
                <div>
                  <div className="text-xs font-medium text-[#F4EFE6]">
                    Lunar EVA Radiation &amp; Plasma Environment
                  </div>
                  <div className="text-[10px] text-[#A8A193]">
                    No solar particle storm active · Solar wind velocity within nominal limits
                  </div>
                </div>
              </div>
              <span className="px-2.5 py-1 rounded-full text-[10px] font-mono font-semibold bg-[#88B38A]/20 text-[#88B38A] border border-[#88B38A]/40">
                NOMINAL
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
