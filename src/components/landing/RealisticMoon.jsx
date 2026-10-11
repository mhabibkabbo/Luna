import React, { useState } from 'react';
import { MapPin, ArrowRight } from 'lucide-react';
import { CLPS_MISSIONS } from '../../data/clpsMissions.js';

/**
 * High-definition, lightweight realistic Moon centerpiece.
 * Uses high-resolution photographic lunar mosaic with spherical shading,
 * realistic solar terminator, and subtle interactive landing site fiducial markers.
 */
export default function RealisticMoon({ onLaunchExplorer }) {
  const [activePin, setActivePin] = useState(null);

  // Key landing sites georeferenced to 2D disk projection (percent from top/left)
  const landingPins = [
    {
      id: 'clps-im1-odysseus',
      name: 'IM-1 Odysseus',
      coords: '80.1° S, 1.4° E',
      region: 'Malapert A (South Pole)',
      // South Pole is near bottom center
      top: '84%',
      left: '51%',
      status: 'First commercial soft landing',
    },
    {
      id: 'clps-firefly-blueghost1',
      name: 'Blue Ghost 1',
      coords: '18.6° N, 61.8° E',
      region: 'Mare Crisium Basin',
      // Eastern basin (right side)
      top: '38%',
      left: '74%',
      status: 'Firefly Aerospace lander',
    },
    {
      id: 'clps-im2-prime1',
      name: 'IM-2 PRIME-1',
      coords: '89.4° S, 0.0° E',
      region: 'Shackleton Ridge',
      top: '89%',
      left: '49%',
      status: 'Polar volatile ice drill',
    },
    {
      id: 'apollo-11',
      name: 'Apollo 11',
      coords: '0.7° N, 23.5° E',
      region: 'Tranquility Base',
      top: '49%',
      left: '59%',
      status: 'Historic 1969 landing',
      isApollo: true,
    },
  ];

  const handlePinClick = (pin) => {
    const mission = CLPS_MISSIONS.find((m) => m.id === pin.id);
    if (mission) {
      onLaunchExplorer({
        selectedMission: mission,
        lon: mission.longitude,
        lat: mission.latitude,
        zoom: 5.2,
      });
    } else {
      onLaunchExplorer({
        lon: 23.47,
        lat: 0.67,
        zoom: 4.5,
      });
    }
  };

  return (
    <div className="relative flex items-center justify-center select-none w-full max-w-[340px] sm:max-w-[460px] lg:max-w-[560px] xl:max-w-[620px] aspect-square mx-auto">
      {/* Outer Atmospheric / Lunar Limb Backlight Glow */}
      <div
        className="absolute inset-0 rounded-full pointer-events-none -z-10"
        style={{
          background:
            'radial-gradient(circle at 45% 45%, rgba(34, 211, 238, 0.10) 0%, rgba(148, 163, 184, 0.05) 50%, transparent 72%)',
          filter: 'blur(32px)',
        }}
      />

      {/* Main Lunar Sphere Container */}
      <div className="relative w-full h-full rounded-full overflow-hidden shadow-2xl shadow-black/90 border border-slate-700/20 group">
        {/* Photographic Lunar Basemap (NASA LRO high-res photographic texture) */}
        <div
          className="absolute inset-0 w-full h-full bg-cover bg-center transition-transform duration-1000 ease-out group-hover:scale-[1.02]"
          style={{
            backgroundImage: `url('https://cdn.jsdelivr.net/npm/three-globe@2.31.0/example/img/lunar_surface.jpg')`,
            backgroundColor: '#1e293b',
          }}
        />

        {/* Fallback procedural lunar shading in case image is loading */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'radial-gradient(circle at 38% 34%, rgba(255,255,255,0.06) 0%, rgba(0,0,0,0) 45%)',
          }}
        />

        {/* Realistic Spherical 3D Depth Shading & Grazing Terminator */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: `
              radial-gradient(circle at 34% 32%, transparent 35%, rgba(3, 5, 12, 0.35) 60%, rgba(2, 4, 9, 0.92) 85%, #020409 100%),
              linear-gradient(135deg, rgba(255,255,255,0.08) 0%, transparent 40%, rgba(2,4,9,0.75) 75%, rgba(1,2,6,0.96) 100%)
            `,
          }}
        />

        {/* Subtle Lunar Limb Edge Rim Highlight */}
        <div
          className="absolute inset-0 rounded-full pointer-events-none border border-slate-400/15"
          style={{
            boxShadow: 'inset -20px -20px 60px 10px rgba(2, 4, 9, 0.85), inset 4px 4px 20px rgba(255, 255, 255, 0.12)',
          }}
        />

        {/* Interactive Landing Site Pins on the Lunar Surface */}
        {landingPins.map((pin) => {
          const isHovered = activePin?.id === pin.id;
          return (
            <div
              key={pin.id}
              style={{ top: pin.top, left: pin.left }}
              className="absolute -translate-x-1/2 -translate-y-1/2 z-20 cursor-pointer"
              onMouseEnter={() => setActivePin(pin)}
              onMouseLeave={() => setActivePin(null)}
              onClick={() => handlePinClick(pin)}
            >
              {/* Pulse Ring */}
              <div className="relative flex items-center justify-center">
                <span
                  className={`absolute w-4 h-4 rounded-full animate-ping opacity-60 ${
                    pin.isApollo ? 'bg-amber-400' : 'bg-cyan-400'
                  }`}
                />
                <span
                  className={`relative w-2 h-2 rounded-full border border-black/80 shadow-sm ${
                    pin.isApollo ? 'bg-amber-300' : 'bg-cyan-300'
                  }`}
                />
              </div>

              {/* Pin Tooltip */}
              {isHovered && (
                <div
                  className="absolute bottom-4 left-1/2 -translate-x-1/2 w-44 p-2.5 rounded-lg bg-slate-950/95 border border-cyan-500/40 backdrop-blur-md shadow-xl text-left pointer-events-none z-30 animate-in fade-in zoom-in-95 duration-150"
                  style={{ transformOrigin: 'bottom center' }}
                >
                  <div className="flex items-center justify-between text-[10px] font-mono mb-1">
                    <span className="text-cyan-300 font-semibold">{pin.name}</span>
                    <span className="text-slate-400 text-[9px]">{pin.coords}</span>
                  </div>
                  <div className="text-[10px] text-slate-300 leading-tight mb-1">
                    {pin.region}
                  </div>
                  <div className="flex items-center gap-1 text-[9px] font-mono text-cyan-400/90 pt-1 border-t border-slate-800">
                    <span>Click to explore on map</span>
                    <ArrowRight className="w-2.5 h-2.5" />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Discreet Coordinate Watermark (Selenographic Prime Meridian) */}
      <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-[10px] font-mono text-slate-600 tracking-wider uppercase pointer-events-none">
        0.00° N, 0.00° E · Mean Earth Subsolar Meridian
      </div>
    </div>
  );
}
