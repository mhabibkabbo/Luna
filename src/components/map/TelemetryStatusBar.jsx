import React, { useState, useEffect } from 'react';
import { formatLunarCoordinates } from '../../utils/coordinates.js';
import { calculateLunarPhase } from '../../utils/lunarPhase.js';
import { pointerStore, mapViewStore } from '../../utils/pointerStore.js';
import ScaleControl from './ScaleControl.jsx';
import { Compass, Clock, Radio, Copy, Check } from 'lucide-react';

/**
 * Discreet status bar along the bottom edge.
 * Displays selenographic coordinates with copy function, zoom, scale, mission source, and live UTC clock.
 */
export default function TelemetryStatusBar({
  viewMode = '3d',
  selectedFeature,
}) {
  const [copied, setCopied] = useState(false);
  // Subscribe to high-frequency stores locally so App does not re-render on every pointer move.
  const [pointer, setPointer] = useState(pointerStore.get());
  const [mapView, setMapView] = useState(mapViewStore.get());
  useEffect(() => {
    const u1 = pointerStore.subscribe(setPointer);
    const u2 = mapViewStore.subscribe(setMapView);
    return () => { u1(); u2(); };
  }, []);
  const longitude = pointer.lon;
  const latitude = pointer.lat;
  const resolution = mapView.resolution;
  const zoom = viewMode === '3d' ? 3.0 : mapView.zoom;
  const targetLon = selectedFeature ? selectedFeature.longitude : longitude;
  const targetLat = selectedFeature ? selectedFeature.latitude : latitude;
  const { latStr, lonStr } = formatLunarCoordinates(targetLon, targetLat, 2);
  const zoomDisplay = typeof zoom === 'number' ? zoom.toFixed(1) : '2.5';

  const [utcTime, setUtcTime] = useState('');
  const [phaseInfo, setPhaseInfo] = useState(() => calculateLunarPhase(new Date()));

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const timeStr = now.toISOString().substring(11, 19) + ' UTC';
      setUtcTime(timeStr);
      setPhaseInfo(calculateLunarPhase(now));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleCopy = (e) => {
    e.stopPropagation();
    const text = `${targetLat.toFixed(4)}°, ${targetLon.toFixed(4)}° (${latStr}, ${lonStr})`;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      });
    }
  };

  return (
    <footer
      id="telemetry-status-bar"
      className="absolute bottom-0 left-0 right-0 z-20 h-7 px-3 sm:px-4 bg-[#040711]/92 backdrop-blur-md border-t border-slate-800/70 flex items-center justify-between text-[11px] font-mono text-slate-400 select-none pointer-events-auto"
    >
      {/* Left: Coordinates & Zoom */}
      <div className="flex items-center gap-2 sm:gap-3">
        <div className="flex items-center gap-1.5 text-slate-200">
          <Compass className="w-3 h-3 text-cyan-400 shrink-0" />
          <span>
            LAT <strong className="text-white font-semibold">{latStr}</strong>
          </span>
          <span className="text-slate-600">·</span>
          <span>
            LON <strong className="text-white font-semibold">{lonStr}</strong>
          </span>
          <span className="text-slate-600 hidden sm:inline">·</span>
          <span className="hidden sm:inline">
            ZOOM <strong className="text-cyan-300 font-semibold">{zoomDisplay}x</strong>
          </span>
        </div>

        <button
          type="button"
          onClick={handleCopy}
          title="Copy selenographic coordinates"
          className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 hover:border-cyan-500/50 hover:text-cyan-300 transition-colors text-[10px]"
        >
          {copied ? (
            <>
              <Check className="w-3 h-3 text-emerald-400" />
              <span className="text-emerald-400 hidden sm:inline">Copied</span>
            </>
          ) : (
            <>
              <Copy className="w-3 h-3 text-slate-400" />
              <span className="hidden sm:inline">Copy</span>
            </>
          )}
        </button>

        {selectedFeature && (
          <div className="hidden lg:flex items-center gap-1.5 text-slate-400 border-l border-slate-800 pl-3">
            <span className="text-slate-500 text-[10px]">SELECTED:</span>
            <span className="text-slate-200 truncate max-w-[140px] font-sans font-medium">
              {selectedFeature.name || selectedFeature.title}
            </span>
          </div>
        )}

        {/* 2D Mode Scale Bar */}
        {viewMode === '2d' && resolution !== undefined && (
          <div className="hidden md:flex items-center border-l border-slate-800 pl-3">
            <ScaleControl resolution={resolution} />
          </div>
        )}
      </div>

      {/* Center: Mission info (desktop only) */}
      <div className="hidden xl:flex items-center gap-2 text-slate-500 text-[10px] tracking-wider uppercase">
        <Radio className="w-3 h-3 text-cyan-500 animate-pulse" />
        <span>NASA Moon Trek WMTS · LROC & LOLA Planetary Data</span>
      </div>

      {/* Right: Live Lunar Phase & UTC clock */}
      <div className="flex items-center gap-3">
        <div className="hidden sm:flex items-center gap-1.5 text-slate-300">
          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-sm" />
          <span>{phaseInfo.phaseName}</span>
          <span className="text-cyan-400 font-semibold">({phaseInfo.percentage}%)</span>
        </div>

        <div className="flex items-center gap-1.5 text-slate-400 border-l border-slate-800 pl-3">
          <Clock className="w-3 h-3 text-slate-500" />
          <span className="text-slate-200 font-medium">{utcTime}</span>
        </div>
      </div>
    </footer>
  );
}
