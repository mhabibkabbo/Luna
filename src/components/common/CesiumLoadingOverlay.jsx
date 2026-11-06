import React, { useState, useEffect } from 'react';
import { Loader2, Moon, Globe, Database } from 'lucide-react';

/**
 * Warm Editorial Loading Overlay & Planet Readiness Gate for Cesium 3D Viewers.
 */
export default function CesiumLoadingOverlay({
  isInitializing = true,
  stage = 'Initializing 3D Planetary Studio...',
  pendingTiles = 0,
  planet = 'moon',
}) {
  const [shouldRenderOverlay, setShouldRenderOverlay] = useState(isInitializing);
  const [fadeComplete, setFadeComplete] = useState(!isInitializing);
  const peakTilesRef = React.useRef(1);

  if (pendingTiles > peakTilesRef.current) {
    peakTilesRef.current = pendingTiles;
  }
  if (!isInitializing && pendingTiles === 0) {
    peakTilesRef.current = 1;
  }

  useEffect(() => {
    if (isInitializing) {
      setShouldRenderOverlay(true);
      setFadeComplete(false);
    } else {
      const timer = setTimeout(() => {
        setFadeComplete(true);
        setShouldRenderOverlay(false);
      }, 360);
      return () => clearTimeout(timer);
    }
  }, [isInitializing]);

  const isStreamingTiles = pendingTiles > 0 && !isInitializing;
  const tileProgressPct =
    pendingTiles > 0
      ? Math.max(
          25,
          Math.min(
            98,
            Math.round(
              (1 - pendingTiles / Math.max(peakTilesRef.current, pendingTiles + 1)) * 100
            )
          )
        )
      : isInitializing
      ? 45
      : 100;

  return (
    <>
      {shouldRenderOverlay && (
        <div
          role="status"
          aria-live="polite"
          aria-label={`Loading 3D ${planet === 'earth' ? 'Earth' : 'Lunar'} Environment`}
          className={`absolute inset-0 z-40 flex flex-col items-center justify-center bg-[#050507] text-[#F8FAFC] select-none transition-opacity duration-300 ease-out ${
            fadeComplete || !isInitializing
              ? 'opacity-0 pointer-events-none'
              : 'opacity-100 pointer-events-auto'
          }`}
        >
          <div className="relative z-10 flex flex-col items-center max-w-sm px-6 text-center space-y-5">
            <div className="relative w-20 h-20 flex items-center justify-center">
              <svg
                className="absolute inset-0 w-full h-full animate-[spin_6s_linear_infinite]"
                viewBox="0 0 80 80"
                fill="none"
              >
                <circle
                  cx="40"
                  cy="40"
                  r="36"
                  stroke="#1E2028"
                  strokeWidth="1.5"
                />
                <circle
                  cx="40"
                  cy="40"
                  r="36"
                  stroke="#F8FAFC"
                  strokeWidth="2"
                  strokeDasharray="40 180"
                  strokeLinecap="round"
                />
              </svg>

              <svg
                className="absolute inset-2 w-16 h-16 animate-[spin_3s_linear_infinite_reverse]"
                viewBox="0 0 64 64"
                fill="none"
              >
                <circle
                  cx="32"
                  cy="32"
                  r="28"
                  stroke="#94A3B8"
                  strokeWidth="1.5"
                  strokeDasharray="20 40"
                  strokeOpacity="0.65"
                />
              </svg>

              <div className="w-10 h-10 rounded-full bg-[#0C0D12] border border-white/[0.1] flex items-center justify-center text-white">
                {planet === 'earth' ? (
                  <Globe className="w-5 h-5 text-white" />
                ) : (
                  <Moon className="w-5 h-5 text-white" />
                )}
              </div>
            </div>

            <div className="space-y-1.5">
              <h2 className="text-lg font-medium tracking-[-0.015em] text-white">
                {planet === 'earth'
                  ? 'Preparing 3D Earth & Deep Space Network'
                  : 'Preparing 3D Lunar Topography'}
              </h2>
              <p className="text-[11px] font-mono text-[#8E95A5] min-h-[1.25rem]">
                {stage}
              </p>
            </div>

            <div className="w-full max-w-[240px] space-y-1.5">
              <div className="h-1 w-full bg-[#181A20] rounded-full overflow-hidden">
                <div
                  className="h-full bg-white rounded-full transition-all duration-300"
                  style={{
                    width: `${tileProgressPct}%`,
                  }}
                />
              </div>

              <div className="flex items-center justify-between text-[10px] font-mono text-[#8E95A5] tabular-nums">
                <span>{planet === 'earth' ? 'WGS84 Ellipsoid' : 'IAU Moon Datum'}</span>
                {pendingTiles > 0 ? (
                  <span className="text-white">
                    {pendingTiles} tiles queued ({tileProgressPct}%)
                  </span>
                ) : (
                  <span className="text-[#CBD5E1]">Surface Ready (100%)</span>
                )}
              </div>
            </div>

            <div className="pt-2 border-t border-white/[0.08] text-[10px] text-[#8E95A5] flex items-center justify-center gap-1.5">
              <Database className="w-3 h-3 text-[#8E95A5] shrink-0" />
              <span>
                {planet === 'earth'
                  ? 'NASA Blue Marble & DSN Ground Stations'
                  : 'NASA Moon Trek WMTS · LROC & LOLA Datasets'}
              </span>
            </div>
          </div>
        </div>
      )}

      {isStreamingTiles && (
        <aside
          role="status"
          aria-live="polite"
          aria-label="Streaming planetary tiles"
          className="absolute bottom-9 left-3 sm:left-4 z-20 flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#0A0B0E]/95 border border-white/[0.1] text-[11px] font-mono text-[#F8FAFC] shadow-xl pointer-events-none"
        >
          <Loader2 className="w-3 h-3 text-white animate-spin shrink-0" />
          <span>
            Streaming Tiles:{' '}
            <strong className="text-white tabular-nums">{pendingTiles}</strong>
          </span>
        </aside>
      )}
    </>
  );
}
