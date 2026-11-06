import React, { useState, useMemo } from 'react';
import {
  X,
  Radio,
  Globe2,
  Navigation,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Compass,
  Signal,
  ArrowUpRight,
} from 'lucide-react';
import { EARTH_COMMUNICATION_SITES } from '../../data/earthCommunicationSites.js';
import {
  DEFAULT_DTE_CONSTRAINTS,
  evaluateEarthLink,
  earthLookFromMoon,
  LINK_REASON_LABELS,
} from '../../utils/earthLink.js';
import { computeCelestialState } from '../../utils/lunarEphemeris.js';
import { celestialTimeStore } from '../../utils/celestialTime.js';
import { horizonAt, HORIZON_TABLE } from '../../utils/horizons.js';
import { formatLunarCoordinates } from '../../utils/coordinates.js';
import DteSignalChart from './DteSignalChart.jsx';

export default function DteCalculationModal({
  isOpen,
  onClose,
  selectedMoonFeature,
  selectedEarthFeature,
  onSelectEarthSite,
  onFlyToMoonSite,
}) {
  const [targetLat, setTargetLat] = useState(() =>
    selectedMoonFeature ? String(selectedMoonFeature.latitude ?? -85.97) : '-85.97'
  );
  const [targetLon, setTargetLon] = useState(() =>
    selectedMoonFeature ? String(selectedMoonFeature.longitude ?? 0.0) : '0.00'
  );
  const [selectedStationId, setSelectedStationId] = useState(() =>
    selectedEarthFeature?.id || 'all'
  );

  // Auto-sync target coordinates whenever selectedMoonFeature or modal visibility changes
  React.useEffect(() => {
    if (selectedMoonFeature && isOpen) {
      const lat = typeof selectedMoonFeature.latitude === 'number' ? selectedMoonFeature.latitude : -85.97;
      const lon = typeof selectedMoonFeature.longitude === 'number' ? selectedMoonFeature.longitude : 0.0;
      setTargetLat(String(lat));
      setTargetLon(String(lon));
    }
  }, [selectedMoonFeature, isOpen]);

  // Auto-sync selected Earth station when selectedEarthFeature changes
  React.useEffect(() => {
    if (selectedEarthFeature && isOpen) {
      setSelectedStationId(selectedEarthFeature.id || 'all');
    }
  }, [selectedEarthFeature, isOpen]);

  const parsedLat = Math.max(-90, Math.min(90, parseFloat(targetLat) || 0));
  const parsedLon = Math.max(-180, Math.min(180, parseFloat(targetLon) || 0));

  const moonPoint = useMemo(() => {
    const isDefaultMalapert =
      !selectedMoonFeature &&
      Math.abs(parsedLat - -85.97) < 0.02 &&
      Math.abs(parsedLon - 0.0) < 0.02;
    return {
      id: selectedMoonFeature?.id || (isDefaultMalapert ? 'mons-malapert' : 'custom-dte-point'),
      name:
        selectedMoonFeature?.name ||
        (isDefaultMalapert
          ? 'Mons Malapert Relay Peak (-85.97°, 0.00°)'
          : `Lunar Target (${parsedLat.toFixed(2)}°, ${parsedLon.toFixed(2)}°)`),
      latitude: parsedLat,
      longitude: parsedLon,
    };
  }, [selectedMoonFeature, parsedLat, parsedLon]);

  const [timeMs, setTimeMs] = useState(() => celestialTimeStore.get().ms);
  React.useEffect(() => {
    const unsubscribe = celestialTimeStore.subscribe(({ ms }) => {
      setTimeMs(ms);
    });
    return unsubscribe;
  }, []);
  const state = useMemo(() => computeCelestialState(timeMs), [timeMs]);
  const terrainFn = useMemo(
    () => (azimuthDeg) =>
      horizonAt(HORIZON_TABLE, moonPoint.id, azimuthDeg, moonPoint.latitude, moonPoint.longitude) ?? 0,
    [moonPoint.id, moonPoint.latitude, moonPoint.longitude]
  );

  // Overall Earth look from lunar surface point
  const earthLook = useMemo(() => earthLookFromMoon(state, moonPoint), [state, moonPoint]);
  const localHorizonDeg = terrainFn(earthLook.azimuthDeg);

  // Selected DSN station (or custom Earth feature)
  const activeStation = useMemo(() => {
    if (!selectedStationId || selectedStationId === 'all') return null;
    const found = EARTH_COMMUNICATION_SITES.find((s) => s.id === selectedStationId);
    if (found) return found;
    if (selectedEarthFeature && selectedEarthFeature.id === selectedStationId) {
      return selectedEarthFeature;
    }
    return null;
  }, [selectedStationId, selectedEarthFeature]);

  // Specific link evaluation to the active station
  const stationLink = useMemo(() => {
    return evaluateEarthLink({
      state,
      moonFeature: moonPoint,
      earthFeature: activeStation,
      constraints: DEFAULT_DTE_CONSTRAINTS,
      terrainFn,
    });
  }, [state, moonPoint, activeStation, terrainFn]);

  // Overall Earth center link evaluation
  const generalLink = useMemo(() => {
    return evaluateEarthLink({
      state,
      moonFeature: moonPoint,
      earthFeature: null,
      constraints: DEFAULT_DTE_CONSTRAINTS,
      terrainFn,
    });
  }, [state, moonPoint, terrainFn]);

  // DSN Stations Calculations
  const dsnSitesCalculations = useMemo(() => {
    return EARTH_COMMUNICATION_SITES.map((station) => {
      const evaluation = evaluateEarthLink({
        state,
        moonFeature: moonPoint,
        earthFeature: station,
        constraints: DEFAULT_DTE_CONSTRAINTS,
        terrainFn,
      });
      return {
        ...station,
        evaluation,
      };
    });
  }, [state, moonPoint, terrainFn]);

  if (!isOpen) return null;

  const { latStr, lonStr } = formatLunarCoordinates(parsedLon, parsedLat, 2);
  const lightTravelSec = (state.earth.distanceKm / 299792.458).toFixed(2);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md animate-in fade-in duration-150 select-none pointer-events-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative w-full max-w-3xl bg-[#12110D] border border-[#2D2A22] rounded-3xl shadow-2xl overflow-hidden text-[#F4EFE6] font-sans">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#2D2A22] bg-[#181711]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-[#26231B] border border-[#E59A6D]/40 flex items-center justify-center text-[#E59A6D]">
              <Radio className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-serif text-xl text-[#F4EFE6]">
                Direct-to-Earth Communication Calculation
              </h2>
              <p className="text-[10px] font-mono text-[#A8A193]">
                Line-of-Sight Geometry · DSN Facilities · Latency &amp; Link Margin
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full bg-[#26231B] hover:bg-[#332E24] text-[#A8A193] hover:text-[#F4EFE6] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-6 max-h-[82vh] overflow-y-auto custom-scrollbar">
          {/* Target Coordinates Row */}
          <div className="p-4 rounded-2xl bg-[#181711] border border-[#2D2A22] space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono uppercase tracking-wider text-[#E59A6D]">
                Lunar Surface Origin Point
              </span>
              <span className="text-xs font-mono text-[#F4EFE6]">
                {latStr}, {lonStr}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-[10px] text-[#A8A193] block mb-1">Target Latitude (°)</label>
                <input
                  type="number"
                  step="0.01"
                  min="-90"
                  max="90"
                  value={targetLat}
                  onChange={(e) => setTargetLat(e.target.value)}
                  className="w-full h-8 px-2.5 bg-[#12110D] border border-[#2D2A22] rounded-lg text-xs font-mono text-white"
                />
              </div>

              <div>
                <label className="text-[10px] text-[#A8A193] block mb-1">Target Longitude (°)</label>
                <input
                  type="number"
                  step="0.01"
                  min="-180"
                  max="180"
                  value={targetLon}
                  onChange={(e) => setTargetLon(e.target.value)}
                  className="w-full h-8 px-2.5 bg-[#12110D] border border-[#2D2A22] rounded-lg text-xs font-mono text-white"
                />
              </div>

              <div className="col-span-2 sm:col-span-1 flex items-end">
                {selectedMoonFeature && (
                  <button
                    type="button"
                    onClick={() => {
                      setTargetLat(String(selectedMoonFeature.latitude ?? -89.4));
                      setTargetLon(String(selectedMoonFeature.longitude ?? 0.0));
                    }}
                    className="w-full h-8 px-3 rounded-lg bg-[#26231B] hover:bg-[#332E24] text-[#E59A6D] text-xs font-medium border border-[#2D2A22] transition-colors"
                  >
                    Use Selected Site
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Core Calculation Metrics Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-2xl bg-[#181711] border border-[#2D2A22] space-y-1">
              <span className="text-[10px] font-mono text-[#A8A193] block">Earth Elevation</span>
              <div className="font-mono text-lg font-bold text-[#F4EFE6]">
                {earthLook.elevationDeg.toFixed(1)}°
              </div>
              <span className="text-[9.5px] text-[#A8A193]">Above local lunar horizon</span>
            </div>

            <div className="p-3.5 rounded-2xl bg-[#181711] border border-[#2D2A22] space-y-1">
              <span className="text-[10px] font-mono text-[#A8A193] block">Earth Azimuth</span>
              <div className="font-mono text-lg font-bold text-[#F4EFE6]">
                {earthLook.azimuthDeg.toFixed(1)}°
              </div>
              <span className="text-[9.5px] text-[#A8A193]">Bearing from North</span>
            </div>

            <div className="p-3.5 rounded-2xl bg-[#181711] border border-[#2D2A22] space-y-1">
              <span className="text-[10px] font-mono text-[#A8A193] block">Line-of-Sight</span>
              <div
                className={`font-mono text-base font-bold ${
                  generalLink.status === 'clear' ? 'text-[#88B38A]' : 'text-[#E59A6D]'
                }`}
              >
                {generalLink.status === 'clear'
                  ? 'Clear Link'
                  : generalLink.status === 'away'
                  ? 'Far Side'
                  : 'Terrain Masked'}
              </div>
              <span className="text-[9.5px] text-[#A8A193]">
                Margin {generalLink.marginDeg >= 0 ? '+' : ''}
                {generalLink.marginDeg.toFixed(1)}°
              </span>
            </div>

            <div className="p-3.5 rounded-2xl bg-[#181711] border border-[#2D2A22] space-y-1">
              <span className="text-[10px] font-mono text-[#A8A193] block">1-Way Light Delay</span>
              <div className="font-mono text-lg font-bold text-[#88B38A]">
                {lightTravelSec} s
              </div>
              <span className="text-[9.5px] text-[#A8A193]">
                {(state.earth.distanceKm).toLocaleString()} km
              </span>
            </div>
          </div>

          {/* D3.js Signal Strength Trend Visualization Module */}
          <DteSignalChart
            moonFeature={moonPoint}
            initialStationId={selectedStationId}
            onStationSelect={setSelectedStationId}
          />

          {/* Deep Space Network Ground Facilities Table */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[#F4EFE6] flex items-center gap-2">
                <Globe2 className="w-3.5 h-3.5 text-[#88B38A]" />
                <span>Deep Space Network (DSN) Ground Stations</span>
              </span>
              <span className="text-[10px] font-mono text-[#A8A193]">
                NASA Goldstone · Madrid · Canberra
              </span>
            </div>

            <div className="space-y-2">
              {dsnSitesCalculations.map((station) => {
                const isSelected = selectedStationId === station.id;
                const isLinked = station.evaluation.status === 'clear';

                return (
                  <div
                    key={station.id}
                    onClick={() => setSelectedStationId(station.id)}
                    className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                      isSelected
                        ? 'bg-[#1C1A14] border-[#E59A6D]/70 shadow-lg'
                        : 'bg-[#181711] border-[#2D2A22] hover:border-[#2D2A22]/80'
                    }`}
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-xs text-[#F4EFE6]">{station.name}</span>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#26231B] text-[#A8A193]">
                          {station.country}
                        </span>
                      </div>
                      <div className="text-[10px] font-mono text-[#94A3B8]">
                        {Math.abs(station.latitude).toFixed(2)}°{station.latitude >= 0 ? 'N' : 'S'}, {Math.abs(station.longitude).toFixed(2)}°{station.longitude >= 0 ? 'E' : 'W'} · {station.network}
                      </div>
                    </div>

                    <div className="flex items-center gap-4 shrink-0">
                      <div className="text-right">
                        <div
                          className={`text-xs font-mono font-bold flex items-center gap-1.5 justify-end ${
                            isLinked ? 'text-[#34D399]' : 'text-[#00D2C4]'
                          }`}
                        >
                          {isLinked ? (
                            <>
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>LINK ACTIVE</span>
                            </>
                          ) : (
                            <>
                              <AlertTriangle className="w-3.5 h-3.5" />
                              <span>BELOW MASK</span>
                            </>
                          )}
                        </div>
                        <div className="text-[10px] font-mono text-[#A8A193]">
                          Moon at {station.evaluation.stationElevationDeg !== null ? `${station.evaluation.stationElevationDeg.toFixed(1)}°` : '0°'} el
                        </div>
                      </div>

                      {onSelectEarthSite && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onClose();
                            onSelectEarthSite(station);
                          }}
                          className="px-3 py-1.5 rounded-full bg-[#26231B] hover:bg-[#E59A6D] text-[#F4EFE6] hover:text-[#12110D] text-[11px] font-medium transition-colors"
                        >
                          View Station ↗
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
