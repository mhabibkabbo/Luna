import React, { useState, useEffect } from 'react';
import { Loader2, Moon, Globe, Radio, Database } from 'lucide-react';

/**
 * High-precision scientific loading overlay and tile streaming HUD for Cesium 3D Viewers.
 * 
 * Provides:
 * 1. Initial full-stage initialization overlay with smooth fade-out.
 * 2. Background tile streaming HUD indicator during deep orbital zoom and high-res data fetching.
 */
export default function CesiumLoadingOverlay({
  isInitializing = true,
  stage = 'Initializing 3D Planetary Engine...',
  pendingTiles = 0,
  planet = 'moon',
}) {
  // Retain overlay in DOM during opacity fade-out animation
  const [shouldRenderOverlay, setShouldRenderOverlay] = useState(isInitializing);
  const [fadeComplete, setFadeComplete] = useState(!isInitializing);

  useEffect(() => {
    if (isInitializing) {
      setShouldRenderOverlay(true);
      setFadeComplete(false);
    } else {
      // Allow 400ms smooth fade transition before unmounting
      const timer = setTimeout(() => {
        setFadeComplete(true);
        setShouldRenderOverlay(false);
      }, 450);
      return () => clearTimeout(timer);
    }
  }, [isInitializing]);

  const isStreamingTiles = pendingTiles > 0 && !isInitializing;

  return (
    <>
      {/* ========================================================================= */}
      {/* 1. FULL VIEWPORT INITIALIZATION OVERLAY */}
      {/* ========================================================================= */}
      {shouldRenderOverlay && (
        <div
          role="status"
          aria-live="polite"
          aria-label={`Initializing 3D ${planet === 'earth' ? 'Earth' : 'Lunar'} Viewer`}
          className={`absolute inset-0 z-40 flex flex-col items-center justify-center bg-[#050811] text-slate-100 select-none transition-opacity duration-400 ease-out ${
            fadeComplete || !isInitializing
              ? 'opacity-0 pointer-events-none'
              : 'opacity-100 pointer-events-auto'
          }`}
        >
          {/* Subtle Deep Space Starfield Backdrop */}
          <div
            className="absolute inset-0 pointer-events-none opacity-40"
            style={{
              backgroundImage: `
                radial-gradient(1px 1px at 15% 20%, #ffffff 100%, transparent 0),
                radial-gradient(1px 1px at 35% 65%, #93c5fd 100%, transparent 0),
                radial-gradient(1.2px 1.2px at 70% 30%, #67e8f9 100%, transparent 0),
                radial-gradient(1px 1px at 85% 75%, #ffffff 100%, transparent 0)
              `,
              backgroundSize: '240px 240px',
            }}
          />

          <div className="relative z-10 flex flex-col items-center max-w-sm px-6 text-center space-y-5">
            {/* Scientific Orbital Gyroscope / Astrolabe Spinner */}
            <div className="relative w-20 h-20 flex items-center justify-center">
              {/* Outer Gyro Ring */}
              <svg
                className="absolute inset-0 w-full h-full animate-[spin_6s_linear_infinite]"
                viewBox="0 0 80 80"
                fill="none"
              >
                <circle
                  cx="40"
                  cy="40"
                  r="36"
                  stroke="#1e293b"
                  strokeWidth="1.5"
                />
                <circle
                  cx="40"
                  cy="40"
                  r="36"
                  stroke="#06b6d4"
                  strokeWidth="2"
                  strokeDasharray="40 180"
                  strokeLinecap="round"
                />
              </svg>

              {/* Middle Counter-Rotating Ring */}
              <svg
                className="absolute inset-2 w-16 h-16 animate-[spin_3s_linear_infinite_reverse]"
                viewBox="0 0 64 64"
                fill="none"
              >
                <circle
                  cx="32"
                  cy="32"
                  r="28"
                  stroke="#0e7490"
                  strokeWidth="1.5"
                  strokeDasharray="20 40"
                  strokeOpacity="0.6"
                />
              </svg>

              {/* Center Planet Glyph */}
              <div className="w-10 h-10 rounded-full bg-slate-900/90 border border-slate-700/80 flex items-center justify-center shadow-inner text-cyan-300">
                {planet === 'earth' ? (
                  <Globe className="w-5 h-5 text-blue-400 animate-pulse" />
                ) : (
                  <Moon className="w-5 h-5 text-cyan-300" />
                )}
              </div>
            </div>

            {/* Typography & Status Hierarchy */}
            <div className="space-y-1.5">
              <h2 className="text-sm font-bold tracking-tight text-white uppercase font-sans">
                {planet === 'earth'
                  ? 'Initializing 3D Earth Environment'
                  : 'Initializing 3D Lunar Environment'}
              </h2>
              <p className="text-[11px] font-mono text-cyan-400/90 min-h-[1.25rem]">
                {stage}
              </p>
            </div>

            {/* Progress / Status Metric */}
            <div className="w-full max-w-[240px] space-y-1.5">
              <div className="h-1 w-full bg-slate-800 rounded-full overflow-hidden relative">
                <div
                  className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full animate-[pulse_1.5s_ease-in-out_infinite]"
                  style={{ width: '85%' }}
                />
              </div>

              <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
                <span>IAU Datum R = 1,737.4 km</span>
                {pendingTiles > 0 ? (
                  <span className="text-cyan-300 tabular-nums">
                    {pendingTiles} tiles queued
                  </span>
                ) : (
                  <span className="text-emerald-400">WebGL Ready</span>
                )}
              </div>
            </div>

            {/* Data Source Footnote */}
            <div className="pt-2 border-t border-slate-800/80 text-[10px] text-slate-400 flex items-center justify-center gap-1.5">
              <Database className="w-3 h-3 text-cyan-400 shrink-0" />
              <span>NASA Moon Trek WMTS · LROC & LOLA Datasets</span>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. BACKGROUND DATA FETCHING & TILE STREAMING HUD INDICATOR */}
      {/* ========================================================================= */}
      {isStreamingTiles && (
        <aside
          role="status"
          aria-live="polite"
          aria-label="Streaming planetary tiles"
          className="absolute top-14 left-4 z-20 flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#07090e]/85 backdrop-blur-md border border-slate-800 text-[11px] font-mono text-slate-300 shadow-xl pointer-events-none animate-in fade-in duration-150"
        >
          <Loader2 className="w-3 h-3 text-cyan-400 animate-spin shrink-0" />
          <span className="text-slate-200">
            NASA WMTS Tiles:{' '}
            <strong className="text-cyan-300 tabular-nums">{pendingTiles}</strong> in queue
          </span>
        </aside>
      )}
    </>
  );
}
