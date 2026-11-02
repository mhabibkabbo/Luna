/**
 * @file LunarWeatherWidget.jsx
 * Interactive Real-Time Lunar Weather & Space Weather Telemetry Popover.
 *
 * Combines:
 * 1. Live NOAA SWPC interplanetary solar wind plasma & magnetic field (IMF) telemetry.
 * 2. Radiative surface thermal calculations driven by solar zenith angle and polar shadowing.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Thermometer,
  Wind,
  Sun,
  Activity,
  Compass,
  RefreshCw,
  ChevronDown,
  ShieldAlert,
  Radio,
  Clock,
  Sparkles,
  MapPin,
  ExternalLink,
} from 'lucide-react';
import { fetchSpaceWeather, FALLBACK_SPACE_WEATHER } from '../../services/spaceWeather.js';
import { getLunarTemperature, getSubsolarPoint } from '../../utils/lunarThermal.js';
import { pointerStore } from '../../utils/pointerStore.js';

export default function LunarWeatherWidget({
  selectedFeature = null,
  activePlanet = 'moon',
  placement = 'left',
  className = '',
  isOpen: controlledIsOpen,
  onToggle: controlledOnToggle,
  onClose: controlledOnClose,
}) {
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const isControlled = controlledIsOpen !== undefined;
  const isOpen = isControlled ? controlledIsOpen : internalIsOpen;

  const [spaceWeather, setSpaceWeather] = useState(FALLBACK_SPACE_WEATHER);
  const [isLoading, setIsLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const widgetRef = useRef(null);

  const handleToggle = () => {
    if (isControlled) {
      controlledOnToggle?.();
    } else {
      setInternalIsOpen((prev) => !prev);
    }
  };

  const handleClose = () => {
    if (isControlled) {
      if (controlledOnClose) {
        controlledOnClose();
      } else {
        controlledOnToggle?.();
      }
    } else {
      setInternalIsOpen(false);
    }
  };

  // Close on outside click in uncontrolled mode
  useEffect(() => {
    if (isControlled || !isOpen) return;
    const handleClickOutside = (e) => {
      if (widgetRef.current && !widgetRef.current.contains(e.target)) {
        setInternalIsOpen(false);
      }
    };
    window.addEventListener('pointerdown', handleClickOutside);
    return () => window.removeEventListener('pointerdown', handleClickOutside);
  }, [isControlled, isOpen]);

  // Subscribe to pointer coordinates for dynamic surface probe
  const [pointer, setPointer] = useState(pointerStore.get());
  useEffect(() => {
    return pointerStore.subscribe(setPointer);
  }, []);

  // Fetch live NOAA space weather telemetry
  const loadSpaceWeather = useCallback(async (force = false) => {
    setIsLoading(true);
    try {
      const data = await fetchSpaceWeather(force);
      setSpaceWeather(data);
      setLastUpdated(new Date());
    } catch (err) {
      console.warn('[LunarWeatherWidget] Error fetching space weather:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSpaceWeather(false);
    // Refresh telemetry every 5 minutes
    const interval = setInterval(() => loadSpaceWeather(false), 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [loadSpaceWeather]);

  // Determine target coordinates for local thermal calculation
  const targetLat = selectedFeature?.latitude ?? pointer.lat ?? -89.9;
  const targetLon = selectedFeature?.longitude ?? pointer.lon ?? 0.0;
  const targetName =
    selectedFeature?.name ||
    selectedFeature?.title ||
    (pointer.lat !== 0 || pointer.lon !== 0
      ? 'Cursor Probe Site'
      : 'South Pole (Shackleton)');

  // Local temperature calculation
  const localThermal = getLunarTemperature(targetLat, targetLon, lastUpdated);
  const subsolar = getSubsolarPoint(lastUpdated);

  // Status color styles for solar wind
  const getSpeedBadgeStyle = (status) => {
    switch (status) {
      case 'High Speed Stream':
        return 'text-rose-400 bg-rose-950/80 border-rose-500/40';
      case 'Moderate':
        return 'text-cyan-300 bg-cyan-950/80 border-cyan-500/40';
      case 'Nominal / Slow':
      default:
        return 'text-emerald-300 bg-emerald-950/80 border-emerald-500/40';
    }
  };

  // Temperature color styling
  const getTempColorClass = (tempC, isPSR, isDaylight) => {
    if (isPSR) return 'text-purple-400';
    if (!isDaylight) return 'text-sky-400';
    if (tempC > 80) return 'text-amber-400';
    if (tempC > 0) return 'text-cyan-300';
    return 'text-blue-300';
  };

  return (
    <div ref={widgetRef} className={`relative ${className}`}>
      {/* Upper Stripe Toolbar Button */}
      <button
        type="button"
        id="btn-lunar-weather-widget"
        onClick={handleToggle}
        className={`h-8 px-2.5 flex items-center gap-1.5 rounded-lg text-xs font-medium border transition-all duration-150 active:scale-95 shadow-sm select-none ${
          isOpen
            ? 'bg-slate-800 text-white border-slate-700 shadow-md'
            : 'bg-slate-900/60 hover:bg-slate-850 text-slate-200 border-slate-800 hover:border-slate-700'
        }`}
        title="Real-Time Lunar Surface Weather & Interplanetary Solar Wind Telemetry"
      >
        <Thermometer className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
        <span>Weather</span>
        <span
          className={`font-mono font-bold shrink-0 ${getTempColorClass(
            localThermal.tempC,
            localThermal.isPSR,
            localThermal.isDaylight
          )}`}
        >
          {localThermal.tempC > 0 ? `+${localThermal.tempC}` : localThermal.tempC}°C
        </span>
        <ChevronDown
          className={`w-3 h-3 text-slate-400 transition-transform duration-200 ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {/* Expanded Popover */}
      {isOpen && (
        <div
          id="lunar-weather-popover"
          className={`absolute top-full ${
            placement === 'left' ? 'left-0' : 'right-0'
          } mt-1.5 w-84 sm:w-96 bg-[#060b14]/98 backdrop-blur-2xl border border-slate-800/90 rounded-xl p-4 shadow-2xl shadow-black/90 z-50 flex flex-col gap-3.5 animate-in fade-in zoom-in-95 duration-150 select-none text-slate-200`}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-cyan-950/80 border border-cyan-500/40 text-cyan-400">
                <Wind className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-white tracking-wide uppercase">
                  Lunar Space Weather
                </h4>
                <p className="text-[10px] font-mono text-slate-400">
                  Surface Thermal & Upstream Solar Wind
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => loadSpaceWeather(true)}
                disabled={isLoading}
                title="Refresh NOAA Telemetry"
                className="p-1 rounded-lg text-slate-400 hover:text-cyan-300 hover:bg-slate-900 border border-transparent hover:border-slate-800 transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-cyan-400' : ''}`} />
              </button>
              <button
                type="button"
                onClick={handleClose}
                className="text-xs text-slate-400 hover:text-white px-2 py-1 rounded-lg hover:bg-slate-900 transition-colors"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Section 1: Surface Thermal Telemetry */}
          <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800/80 space-y-2.5">
            <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-wider text-slate-400 border-b border-slate-800 pb-1.5">
              <div className="flex items-center gap-1.5 text-cyan-400 font-semibold">
                <Thermometer className="w-3.5 h-3.5" />
                <span>Surface Radiative Equilibrium</span>
              </div>
              <span className="text-slate-400 font-sans truncate max-w-[140px]" title={targetName}>
                {targetName}
              </span>
            </div>

            <div className="flex items-baseline justify-between">
              <div>
                <div
                  className={`text-2xl font-bold font-mono tracking-tight ${getTempColorClass(
                    localThermal.tempC,
                    localThermal.isPSR,
                    localThermal.isDaylight
                  )}`}
                >
                  {localThermal.tempC > 0 ? `+${localThermal.tempC}` : localThermal.tempC}°C
                </div>
                <div className="text-[11px] font-mono text-slate-400 mt-0.5">
                  {localThermal.tempK} K <span className="text-slate-600">·</span>{' '}
                  {localThermal.tempF > 0 ? `+${localThermal.tempF}` : localThermal.tempF}°F
                </div>
              </div>

              <div className="text-right">
                <span
                  className={`inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-full border ${
                    localThermal.isPSR
                      ? 'bg-purple-950/80 text-purple-300 border-purple-500/40'
                      : localThermal.isDaylight
                      ? 'bg-amber-950/80 text-amber-300 border-amber-500/40'
                      : 'bg-blue-950/80 text-blue-300 border-blue-500/40'
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      localThermal.isPSR
                        ? 'bg-purple-400 animate-pulse'
                        : localThermal.isDaylight
                        ? 'bg-amber-400'
                        : 'bg-blue-400'
                    }`}
                  />
                  {localThermal.isPSR
                    ? 'Permanent Shadow (PSR)'
                    : localThermal.isDaylight
                    ? 'Direct Sunlight'
                    : 'Lunar Night'}
                </span>
                <div className="text-[10px] font-mono text-slate-400 mt-1">
                  Solar Elev: <strong className="text-slate-200">{localThermal.solarElevationDeg}°</strong>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-1.5 pt-1 text-[9.5px] font-mono border-t border-slate-800/80 text-slate-400">
              <div className="p-1.5 rounded-lg bg-slate-950/60 border border-slate-800/60 text-center">
                <span className="block text-slate-500">Day Peak</span>
                <span className="font-bold text-amber-400">+117°C (390K)</span>
              </div>
              <div className="p-1.5 rounded-lg bg-slate-950/60 border border-slate-800/60 text-center">
                <span className="block text-slate-500">Night Floor</span>
                <span className="font-bold text-sky-400">-173°C (100K)</span>
              </div>
              <div className="p-1.5 rounded-lg bg-slate-950/60 border border-slate-800/60 text-center">
                <span className="block text-slate-500">PSR Deep Trap</span>
                <span className="font-bold text-purple-400">-233°C (40K)</span>
              </div>
            </div>
          </div>

          {/* Section 2: Real-time Solar Wind & Space Weather (NOAA SWPC) */}
          <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800/80 space-y-2.5">
            <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-wider text-slate-400 border-b border-slate-800 pb-1.5">
              <div className="flex items-center gap-1.5 text-cyan-400 font-semibold">
                <Activity className="w-3.5 h-3.5" />
                <span>Upstream Solar Wind (L1 DSCOVR/ACE)</span>
              </div>
              <span
                className={`text-[9.5px] font-mono px-1.5 py-0.2 rounded border ${getSpeedBadgeStyle(
                  spaceWeather.speedStatus
                )}`}
              >
                {spaceWeather.speedStatus}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2 rounded-lg bg-slate-950/60 border border-slate-800/70">
                <div className="text-[10px] text-slate-500 font-sans">Wind Speed</div>
                <div className="font-mono text-cyan-300 font-bold text-sm mt-0.5">
                  {spaceWeather.speed.toFixed(1)}{' '}
                  <span className="text-[10px] font-normal text-slate-400">km/s</span>
                </div>
              </div>

              <div className="p-2 rounded-lg bg-slate-950/60 border border-slate-800/70">
                <div className="text-[10px] text-slate-500 font-sans">Proton Density</div>
                <div className="font-mono text-emerald-300 font-bold text-sm mt-0.5">
                  {spaceWeather.density.toFixed(2)}{' '}
                  <span className="text-[10px] font-normal text-slate-400">p/cm³</span>
                </div>
              </div>

              <div className="p-2 rounded-lg bg-slate-950/60 border border-slate-800/70">
                <div className="text-[10px] text-slate-500 font-sans">IMF Bz (North/South)</div>
                <div
                  className={`font-mono font-bold text-sm mt-0.5 ${
                    spaceWeather.bz < -5
                      ? 'text-rose-400'
                      : spaceWeather.bz < 0
                      ? 'text-amber-400'
                      : 'text-cyan-300'
                  }`}
                >
                  {spaceWeather.bz > 0 ? `+${spaceWeather.bz}` : spaceWeather.bz}{' '}
                  <span className="text-[10px] font-normal text-slate-400">nT</span>
                </div>
              </div>

              <div className="p-2 rounded-lg bg-slate-950/60 border border-slate-800/70">
                <div className="text-[10px] text-slate-500 font-sans">Plasma Temp</div>
                <div className="font-mono text-slate-200 font-bold text-sm mt-0.5">
                  {spaceWeather.temperature.toLocaleString()}{' '}
                  <span className="text-[10px] font-normal text-slate-400">K</span>
                </div>
              </div>
            </div>
          </div>

          {/* Subsolar Point Location */}
          <div className="flex items-center justify-between p-2 rounded-lg bg-slate-950/60 border border-slate-800 text-[10px] font-mono text-slate-400">
            <div className="flex items-center gap-1.5">
              <Sun className="w-3 h-3 text-amber-400" />
              <span>Subsolar Point:</span>
            </div>
            <span className="font-bold text-amber-300">
              {Math.abs(subsolar.lat).toFixed(2)}°{subsolar.lat >= 0 ? 'N' : 'S'},{' '}
              {Math.abs(subsolar.lon).toFixed(2)}°{subsolar.lon >= 0 ? 'E' : 'W'}
            </span>
          </div>

          {/* Footer attribution */}
          <div className="flex items-center justify-between text-[9.5px] font-mono text-slate-500 border-t border-slate-800 pt-2">
            <div className="flex items-center gap-1.5 truncate">
              <Radio className="w-3 h-3 text-cyan-400 shrink-0" />
              <span className="truncate">{spaceWeather.source}</span>
            </div>
            <span className="font-mono text-[9px] uppercase px-1.5 py-0.5 rounded bg-slate-900 text-slate-400 border border-slate-800 shrink-0 ml-2">
              {spaceWeather.isFallback ? 'Fallback Model' : 'Live NOAA SWPC'}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
