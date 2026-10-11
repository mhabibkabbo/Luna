import React from 'react';
import { X, Moon, Globe, Database, Compass, ExternalLink } from 'lucide-react';

export default function CompactAboutModal({ isOpen, onClose, onLaunchExplorer }) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-xl max-h-[85vh] overflow-y-auto rounded-2xl bg-[#050813] border border-slate-800 p-6 sm:p-8 text-left shadow-2xl shadow-cyan-950/20"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-5 right-5 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          aria-label="Close dialog"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Eyebrow & Title */}
        <div className="text-[11px] font-mono tracking-widest text-cyan-400 uppercase mb-2">
          ABOUT THE PLATFORM
        </div>
        <h2 className="text-2xl font-bold text-white mb-4 tracking-tight">
          Luna Lunar Mission Browser
        </h2>

        {/* Description */}
        <div className="space-y-3 text-sm text-slate-300 leading-relaxed mb-6 font-normal">
          <p>
            Luna is a scientific, interactive browser engineered to explore lunar landing sites,
            selenographic terrain, and NASA Commercial Lunar Payload Services (CLPS) missions.
          </p>
          <p className="text-slate-400">
            It brings together global photographic basemaps from the Lunar Reconnaissance Orbiter
            (LRO), topological nomenclature from the USGS Astrogeology Science Center, and verified
            spacecraft payload records.
          </p>
        </div>

        {/* Capabilities Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
          <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800">
            <div className="flex items-center gap-2 text-xs font-semibold text-white mb-1">
              <Globe className="w-3.5 h-3.5 text-cyan-400" />
              <span>3D & 2D Planetary GIS</span>
            </div>
            <p className="text-[11px] text-slate-400 leading-normal">
              Cesium 3D orbital globe and OpenLayers planar map calibrated to the Moon&apos;s 1,737.4 km radius.
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800">
            <div className="flex items-center gap-2 text-xs font-semibold text-white mb-1">
              <Database className="w-3.5 h-3.5 text-cyan-400" />
              <span>NASA Moon Trek Tiles</span>
            </div>
            <p className="text-[11px] text-slate-400 leading-normal">
              Orthorectified LROC WAC photographic mosaics and LOLA color-shaded altimetry.
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800">
            <div className="flex items-center gap-2 text-xs font-semibold text-white mb-1">
              <Compass className="w-3.5 h-3.5 text-cyan-400" />
              <span>IAU Selenographic System</span>
            </div>
            <p className="text-[11px] text-slate-400 leading-normal">
              Real-time latitude and longitude telemetry with geodesic distance calculation.
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800">
            <div className="flex items-center gap-2 text-xs font-semibold text-white mb-1">
              <Moon className="w-3.5 h-3.5 text-cyan-400" />
              <span>Lunar Ephemeris</span>
            </div>
            <p className="text-[11px] text-slate-400 leading-normal">
              Live astronomical lunar phase, solar illumination angle, and day/night terminator.
            </p>
          </div>
        </div>

        {/* Bottom Actions */}
        <div className="pt-4 border-t border-slate-800 flex items-center justify-between">
          <a
            href="https://trek.nasa.gov/moon/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-cyan-300 transition-colors"
          >
            <span>NASA Moon Trek</span>
            <ExternalLink className="w-3 h-3" />
          </a>

          <button
            type="button"
            onClick={() => {
              onClose();
              onLaunchExplorer();
            }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs font-semibold shadow-md transition-all"
          >
            <span>Start Exploring</span>
          </button>
        </div>
      </div>
    </div>
  );
}
