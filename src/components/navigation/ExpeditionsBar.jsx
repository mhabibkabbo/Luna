import React from 'react';
import { Rocket, Target, CircleDot, Mountain, Waves, Compass, Sparkles } from 'lucide-react';
import { LANDING_SITES } from '../../data/landingSites.js';
import { LUNAR_FEATURES } from '../../data/lunarFeatures.js';

export const FEATURED_EXPEDITIONS = [
  {
    id: 'landing-apollo-11',
    label: 'Apollo 11',
    sublabel: 'Tranquility Base',
    lon: 23.4730,
    lat: 0.6741,
    zoom: 5.2,
    icon: Rocket,
    colorClass: 'text-amber-300 border-amber-500/40 bg-amber-950/40 hover:bg-amber-900/60 shadow-amber-950/40',
  },
  {
    id: 'south-pole-highlight',
    label: 'South Pole',
    sublabel: '90°S Water Ice',
    lon: 0.0,
    lat: -90.0,
    zoom: 4.8,
    icon: Target,
    colorClass: 'text-cyan-300 border-cyan-400/50 bg-cyan-950/50 hover:bg-cyan-900/60 shadow-cyan-950/40',
  },
  {
    id: 'crater-tycho',
    label: 'Tycho',
    sublabel: 'Rayed Impact',
    lon: -11.36,
    lat: -43.31,
    zoom: 5.5,
    icon: CircleDot,
    colorClass: 'text-slate-200 border-slate-600/40 bg-slate-900/60 hover:bg-slate-800/80 shadow-slate-950/40',
  },
  {
    id: 'crater-copernicus',
    label: 'Copernicus',
    sublabel: 'Terraced Crater',
    lon: -20.08,
    lat: 9.62,
    zoom: 5.5,
    icon: CircleDot,
    colorClass: 'text-slate-200 border-slate-600/40 bg-slate-900/60 hover:bg-slate-800/80 shadow-slate-950/40',
  },
  {
    id: 'landing-change-4',
    label: "Chang'e 4",
    sublabel: 'Lunar Far Side',
    lon: 177.599,
    lat: -45.444,
    zoom: 5.2,
    icon: Rocket,
    colorClass: 'text-emerald-300 border-emerald-500/40 bg-emerald-950/40 hover:bg-emerald-900/60 shadow-emerald-950/40',
  },
  {
    id: 'mountain-mons-huygens',
    label: 'Mons Huygens',
    sublabel: '+5,500m Peak',
    lon: -2.87,
    lat: 19.92,
    zoom: 5.0,
    icon: Mountain,
    colorClass: 'text-amber-400 border-amber-500/40 bg-amber-950/40 hover:bg-amber-900/60 shadow-amber-950/40',
  },
  {
    id: 'mare-tranquillitatis',
    label: 'Mare Tranquillitatis',
    sublabel: 'Basalt Sea',
    lon: 31.40,
    lat: 8.50,
    zoom: 3.2,
    icon: Waves,
    colorClass: 'text-sky-300 border-sky-500/40 bg-sky-950/40 hover:bg-sky-900/60 shadow-sky-950/40',
  },
];

/**
 * Interactive Quick Expedition Bar allowing single-click travel to legendary lunar sites.
 */
export default function ExpeditionsBar({ onSelectExpedition }) {
  const handleClick = (expedition) => {
    // Locate the full feature metadata object
    const feature =
      LANDING_SITES.find((s) => s.id === expedition.id || s.name.toLowerCase().includes(expedition.label.toLowerCase())) ||
      LUNAR_FEATURES.find((f) => f.id === expedition.id || f.name.toLowerCase() === expedition.label.toLowerCase()) ||
      {
        id: expedition.id,
        name: `${expedition.label} (${expedition.sublabel})`,
        type: expedition.icon === Rocket ? 'landing-site' : (expedition.icon === Mountain ? 'mountain' : 'crater'),
        longitude: expedition.lon,
        latitude: expedition.lat,
        description: `Featured lunar exploration landmark: ${expedition.label}. Selenographic coordinate target.`,
        source: 'NASA Planetary Data System',
      };

    onSelectExpedition(feature, expedition.lon, expedition.lat, expedition.zoom);
  };

  return (
    <div
      id="featured-expeditions-bar"
      className="flex items-center gap-1.5 overflow-x-auto py-1 px-1 custom-scrollbar pointer-events-auto select-none"
    >
      <div className="flex items-center gap-1.5 text-[10px] uppercase font-mono tracking-wider text-cyan-400/80 px-2 shrink-0 border-r border-slate-800/80">
        <Compass className="w-3.5 h-3.5 text-cyan-400" />
        <span className="hidden lg:inline">Quick Jump</span>
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        {FEATURED_EXPEDITIONS.map((exp) => {
          const Icon = exp.icon;
          return (
            <button
              key={exp.id}
              type="button"
              onClick={() => handleClick(exp)}
              title={`Explore ${exp.label} (${exp.sublabel})`}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-medium border shadow-sm backdrop-blur-md transition-all active:scale-95 shrink-0 ${exp.colorClass}`}
            >
              <Icon className="w-3 h-3 shrink-0" />
              <span className="font-semibold whitespace-nowrap">{exp.label}</span>
              <span className="text-[10px] opacity-75 font-mono hidden xl:inline">· {exp.sublabel}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
