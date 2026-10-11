import React from 'react';
import { Moon, Rocket, Globe, Map as MapIcon, ArrowUp, Compass } from 'lucide-react';

export default function LandingFooter({ onLaunchExplorer }) {
  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <footer className="bg-[#02040b] border-t border-slate-900 text-slate-400">
      {/* High-Impact CTA Banner */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-16">
        <div className="relative rounded-3xl bg-gradient-to-br from-slate-900/90 via-[#070e22] to-slate-900/90 border border-slate-800 p-8 sm:p-12 lg:p-16 text-center overflow-hidden shadow-2xl">
          {/* Subtle Glow */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 max-w-2xl mx-auto">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-950/80 border border-cyan-500/30 text-[11px] font-mono text-cyan-400 uppercase tracking-wider mb-5">
              <Rocket className="w-3.5 h-3.5" />
              <span>START YOUR EXPEDITION</span>
            </div>

            <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight mb-4">
              Ready to Explore the Lunar Surface?
            </h2>

            <p className="text-sm sm:text-base text-slate-300 leading-relaxed mb-8">
              Launch Luna now to navigate commercial landing sites, compute selenographic distances,
              and explore the Moon in interactive 3D and 2D.
            </p>

            <div className="flex flex-wrap items-center justify-center gap-3.5">
              <button
                type="button"
                onClick={() => onLaunchExplorer({ viewMode: '3d' })}
                className="flex items-center gap-2.5 px-6 py-3.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-semibold text-xs sm:text-sm tracking-wide shadow-lg shadow-cyan-950/60 transition-all hover:-translate-y-0.5 active:translate-y-0"
              >
                <Globe className="w-4 h-4 text-cyan-200" />
                <span>Launch 3D Cesium Orbit</span>
              </button>

              <button
                type="button"
                onClick={() => onLaunchExplorer({ viewMode: '2d' })}
                className="flex items-center gap-2 px-5 py-3.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 hover:text-white border border-slate-700 text-xs sm:text-sm font-medium transition-all hover:-translate-y-0.5 active:translate-y-0"
              >
                <MapIcon className="w-4 h-4 text-slate-400" />
                <span>Launch 2D Planar Map</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Footer Links & Credits */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 border-t border-slate-900/80">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-10">
          {/* Brand Info */}
          <div className="md:col-span-2">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-6 h-6 rounded-md bg-gradient-to-br from-cyan-500/20 to-blue-600/30 border border-cyan-400/30 flex items-center justify-center">
                <Moon className="w-3.5 h-3.5 text-cyan-300" />
              </div>
              <span className="text-sm font-bold text-white tracking-tight">LUNA</span>
              <span className="text-[9px] font-mono text-cyan-400 uppercase px-1 py-0.2 rounded bg-cyan-950/60 border border-cyan-500/25">
                CLPS BROWSER
              </span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed max-w-sm">
              An open, interactive exploration platform for NASA Commercial Lunar Payload Services
              missions, selenographic geography, and scientific instruments on the Moon.
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="text-xs font-semibold text-white uppercase tracking-wider mb-3 font-mono">
              Navigation
            </h4>
            <ul className="space-y-2 text-xs">
              <li>
                <a href="#about" className="hover:text-cyan-300 transition-colors">
                  About Luna
                </a>
              </li>
              <li>
                <a href="#explore" className="hover:text-cyan-300 transition-colors">
                  Capabilities
                </a>
              </li>
              <li>
                <a href="#missions" className="hover:text-cyan-300 transition-colors">
                  CLPS Missions
                </a>
              </li>
              <li>
                <a href="#datasources" className="hover:text-cyan-300 transition-colors">
                  Data Sources
                </a>
              </li>
            </ul>
          </div>

          {/* External References */}
          <div>
            <h4 className="text-xs font-semibold text-white uppercase tracking-wider mb-3 font-mono">
              Scientific Resources
            </h4>
            <ul className="space-y-2 text-xs">
              <li>
                <a
                  href="https://www.nasa.gov/commercial-lunar-payload-services/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-cyan-300 transition-colors"
                >
                  NASA CLPS Office
                </a>
              </li>
              <li>
                <a
                  href="https://trek.nasa.gov/moon/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-cyan-300 transition-colors"
                >
                  NASA Moon Trek WMTS
                </a>
              </li>
              <li>
                <a
                  href="https://planetarynames.wr.usgs.gov/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-cyan-300 transition-colors"
                >
                  USGS Lunar Gazetteer
                </a>
              </li>
              <li>
                <a
                  href="https://www.lpi.usra.edu/lunar/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-cyan-300 transition-colors"
                >
                  LPI Lunar Exploration
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Line */}
        <div className="pt-8 border-t border-slate-900 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs">
          <p className="text-slate-500">
            Data sourced from NASA, USGS, and commercial mission declarations. Built for scientific
            discovery.
          </p>
          <button
            type="button"
            onClick={scrollToTop}
            className="flex items-center gap-1.5 text-slate-400 hover:text-cyan-300 transition-colors"
          >
            <span>Back to top</span>
            <ArrowUp className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </footer>
  );
}
