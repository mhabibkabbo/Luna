import React, { useState } from 'react';
import {
  Globe,
  Map as MapIcon,
  Sun,
  Ruler,
  Compass,
  Layers,
  ArrowRight,
  Sparkles,
  CheckCircle2,
  Maximize2,
} from 'lucide-react';

export default function CapabilitiesSection({ onLaunchExplorer }) {
  const [activeTab, setActiveTab] = useState('3d-globe');

  const capabilities = [
    {
      id: '3d-globe',
      title: '3D Cesium Lunar Orbit',
      category: 'ORBITAL EXPLORATION',
      icon: Globe,
      description:
        'Experience full 3D interactive orbit around the Moon powered by CesiumJS. Rotate, pitch, tilt, and fly directly to landing sites with selenographic latitude and longitude precision.',
      bullets: [
        'Real-time smooth camera flight navigation',
        'Direct pin selection and landing site markers',
        'Toggleable lunar vs terrestrial perspective',
        'Auto-rotation and dynamic solar illumination',
      ],
      actionText: 'Open 3D Orbit View',
      actionPayload: { viewMode: '3d' },
      previewBadge: 'CESIUMJS 3D ENGINE',
    },
    {
      id: '2d-gis',
      title: '2D Planar GIS Cartography',
      category: 'PRECISION MAPPING',
      icon: MapIcon,
      description:
        'A high-performance OpenLayers planetary GIS interface displaying NASA Moon Trek WMTS orthorectified imagery, with seamless zoom from full lunar disk down to sub-kilometer crater rims.',
      bullets: [
        'NASA LRO WAC global photographic basemap',
        'Multi-scale label decluttering and collision prevention',
        'Dynamic map resolution and scale bar telemetry',
        'Optimized for mobile touchscreens & desktop trackpads',
      ],
      actionText: 'Open 2D Cartography View',
      actionPayload: { viewMode: '2d' },
      previewBadge: 'OPENLAYERS GIS',
    },
    {
      id: 'south-pole',
      title: 'Lunar South Pole Focus',
      category: 'TARGET OF INTEREST',
      icon: Compass,
      description:
        'Direct high-latitude focus on the lunar South Pole—the primary destination for NASA’s Artemis and CLPS landers targeting water-ice deposits in Permanently Shadowed Regions (PSRs).',
      bullets: [
        'One-click South Pole navigator (-90° Selenographic)',
        'Malapert A Rim (IM-1 Odysseus site)',
        'Shackleton Connecting Ridge (IM-2 PRIME-1 site)',
        'Mons Mouton South Pole plateau (Griffin GM1)',
      ],
      actionText: 'Fly to Lunar South Pole',
      actionPayload: { viewMode: '3d', target: 'south-pole' },
      previewBadge: 'ARTEMIS EXPLORATION ZONE',
    },
    {
      id: 'ephemeris',
      title: 'Live Celestial Ephemeris',
      category: 'ASTRONOMICAL TELEMETRY',
      icon: Sun,
      description:
        'Calculates real-time Earth and Sun positions relative to the lunar surface using high-precision planetary ephemeris algorithms, simulating the dynamic lunar day/night solar terminator.',
      bullets: [
        'Dynamic Sun position and day/night solar terminator',
        'Earthrise line-of-sight elevation and azimuth',
        'Live astronomical lunar phase & illumination percentage',
        'Critical for solar-powered lunar surface missions',
      ],
      actionText: 'Explore Solar Lighting',
      actionPayload: { viewMode: '3d', openCelestial: true },
      previewBadge: 'ASTRONOMY ENGINE',
    },
    {
      id: 'measurement',
      title: 'Geodesic Surface Measurement',
      category: 'GEOMETRIC ANALYSIS',
      icon: Ruler,
      description:
        'Accurately calculate surface distances across lunar terrain using great-circle geodesic trigonometry, calibrated to the Moon’s mean volumetric radius of 1,737.4 km.',
      bullets: [
        'Click-to-measure crater diameters and basin widths',
        'Segment-by-segment distances in kilometers',
        'Initial bearing angles and total traversed path',
        'Available in the 2D planar GIS view',
      ],
      actionText: 'Launch Measurement Tool',
      actionPayload: { viewMode: '2d', activateMeasure: true },
      previewBadge: 'SPHERICAL GEODESICS',
    },
    {
      id: 'layers',
      title: 'NASA Lunar Datasets Catalog',
      category: 'MULTI-LAYER ANALYSIS',
      icon: Layers,
      description:
        'Independently toggle scientific overlays including LOLA digital elevation models, shaded relief, surface nomenclature, craters, mountain massifs, and lunar volcanic maria.',
      bullets: [
        'LRO WAC Global Photographic Basemap',
        'LOLA Color Elevation / Topography Shading',
        'Individual toggle control for Craters, Maria, and Ranges',
        'Adjustable opacity sliders for layered comparison',
      ],
      actionText: 'Explore Map Layers',
      actionPayload: { openLayers: true },
      previewBadge: 'NASA MOON TREK WMTS',
    },
  ];

  const currentCap = capabilities.find((c) => c.id === activeTab) || capabilities[0];
  const CurrentIcon = currentCap.icon;

  return (
    <section id="explore" className="py-24 px-4 sm:px-6 lg:px-8 bg-[#030611] border-t border-slate-900">
      <div className="max-w-7xl mx-auto">
        {/* Section Header */}
        <div className="max-w-3xl mx-auto text-center mb-16">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-900 border border-slate-800 text-[11px] font-mono tracking-wider text-cyan-400 uppercase mb-4">
            <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
            <span>INTERACTIVE CAPABILITIES</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight mb-5">
            Explore the Moon With Scientific Precision
          </h2>
          <p className="text-base sm:text-lg text-slate-300 leading-relaxed">
            Built from the ground up for lunar cartography, Luna combines 3D orbital mechanics,
            geodesic measurement tools, and NASA Moon Trek web map tile services into a seamless
            experience.
          </p>
        </div>

        {/* Capability Navigation Tabs */}
        <div className="flex items-center justify-start sm:justify-center gap-2 overflow-x-auto pb-4 mb-10 no-scrollbar">
          {capabilities.map((cap) => {
            const Icon = cap.icon;
            const isSelected = activeTab === cap.id;
            return (
              <button
                key={cap.id}
                type="button"
                onClick={() => setActiveTab(cap.id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                  isSelected
                    ? 'bg-slate-800 text-cyan-300 border border-cyan-500/40 shadow-md shadow-cyan-950/40'
                    : 'bg-slate-900/60 text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border border-slate-800'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isSelected ? 'text-cyan-400' : 'text-slate-400'}`} />
                <span>{cap.title}</span>
              </button>
            );
          })}
        </div>

        {/* Feature Spotlight Card */}
        <div className="rounded-3xl bg-slate-900/50 border border-slate-800 p-6 sm:p-10 lg:p-12 shadow-2xl">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
            {/* Left Description Column */}
            <div className="lg:col-span-7 flex flex-col items-start">
              <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-cyan-950/60 border border-cyan-500/30 text-[10px] font-mono text-cyan-300 tracking-wider uppercase mb-4">
                {currentCap.previewBadge}
              </div>

              <h3 className="text-2xl sm:text-3xl font-bold text-white mb-4 tracking-tight">
                {currentCap.title}
              </h3>

              <p className="text-base text-slate-300 leading-relaxed mb-6">
                {currentCap.description}
              </p>

              {/* Bullet Features */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-8 w-full">
                {currentCap.bullets.map((bullet) => (
                  <div key={bullet} className="flex items-start gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                    <span className="text-xs text-slate-300 leading-normal">{bullet}</span>
                  </div>
                ))}
              </div>

              {/* Action Button */}
              <button
                type="button"
                onClick={() => onLaunchExplorer(currentCap.actionPayload)}
                className="inline-flex items-center gap-2.5 px-5 py-3 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs font-semibold tracking-wide shadow-md transition-all hover:-translate-y-0.5 active:translate-y-0"
              >
                <span>{currentCap.actionText}</span>
                <ArrowRight className="w-3.5 h-3.5 text-cyan-200" />
              </button>
            </div>

            {/* Right Interactive Mock / Preview Panel */}
            <div className="lg:col-span-5">
              <div className="rounded-2xl bg-[#060a17] border border-slate-800/90 p-5 shadow-inner">
                {/* Simulated Header */}
                <div className="flex items-center justify-between pb-4 border-b border-slate-800/80 mb-4 text-xs font-mono text-slate-400">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-red-500/80" />
                    <div className="w-2.5 h-2.5 rounded-full bg-amber-500/80" />
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/80" />
                    <span className="ml-1 text-[11px] text-slate-400">LUNA // {currentCap.category}</span>
                  </div>
                  <span className="text-cyan-400/90 text-[10px]">LIVE RENDER</span>
                </div>

                {/* Simulated Interface Preview */}
                <div className="space-y-3 font-mono text-xs">
                  <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center justify-between">
                    <span className="text-slate-400">Subsolar Longitude:</span>
                    <span className="text-cyan-300 font-semibold">+42.18° E</span>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center justify-between">
                    <span className="text-slate-400">Lunar Volumetric Radius:</span>
                    <span className="text-slate-200 font-semibold">1,737.4 km</span>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center justify-between">
                    <span className="text-slate-400">Coordinate System:</span>
                    <span className="text-cyan-300 font-semibold">IAU / NASA Selenographic</span>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center justify-between">
                    <span className="text-slate-400">Elevation Datum:</span>
                    <span className="text-slate-200 font-semibold">LRO LOLA 118m/px</span>
                  </div>
                </div>

                <div className="mt-5 pt-4 border-t border-slate-800/80 flex items-center justify-between text-[11px]">
                  <span className="text-slate-500">Ready in Explorer</span>
                  <button
                    type="button"
                    onClick={() => onLaunchExplorer(currentCap.actionPayload)}
                    className="text-cyan-400 hover:text-cyan-300 font-medium flex items-center gap-1"
                  >
                    Launch this tool &rarr;
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
