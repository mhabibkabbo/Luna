import React, { useState, useRef, useEffect } from 'react';
import {
  Target,
  Rocket,
  CircleDot,
  Mountain,
  Waves,
  Diamond,
  Eye,
  EyeOff,
  Info,
  ChevronDown,
  Sparkles,
  Compass,
  Check,
  X,
  Layers,
  MapPin,
  ExternalLink,
  GitCompare,
  Navigation,
  AlertTriangle,
} from 'lucide-react';
import { LANDING_SITES } from '../../data/landingSites.js';
import { LUNAR_FEATURES } from '../../data/lunarFeatures.js';
import { parseLunarCoordinates, clampLatitude, normalizeLongitude } from '../../utils/coordinates.js';

export const FEATURED_MISSIONS = [
  {
    category: 'NASA CLPS & Artemis',
    items: [
      {
        id: 'clps-im1-odysseus',
        name: 'Odysseus (IM-1 / Nova-C)',
        sublabel: 'First Commercial Soft Landing · Malapert A (80.1°S)',
        tag: 'CLPS TO 2-IM',
        lon: 1.44,
        lat: -80.13,
        zoom: 5.6,
        icon: Rocket,
        colorClass: 'text-cyan-400',
      },
      {
        id: 'clps-im2-athena',
        name: 'IM-2 (Athena / PRIME-1)',
        sublabel: 'Shackleton Ridge (89.7°S) · 1m Subsurface Ice Drill',
        tag: 'CLPS PRIME-1',
        lon: 120.00,
        lat: -89.70,
        zoom: 5.8,
        icon: Target,
        colorClass: 'text-cyan-400',
      },
      {
        id: 'clps-firefly-bgm1',
        name: 'Blue Ghost Mission 1',
        sublabel: 'Mare Crisium Basin · Heat Flow & GPS Receiver',
        tag: 'CLPS TO 19D',
        lon: 61.81,
        lat: 18.56,
        zoom: 5.4,
        icon: Rocket,
        colorClass: 'text-cyan-400',
      },
      {
        id: 'clps-griffin-gm1',
        name: 'Griffin Mission 1',
        sublabel: 'Mons Mouton (84.5°S) · Heavy Lander Qualification',
        tag: 'CLPS TO 20A',
        lon: 31.70,
        lat: -84.50,
        zoom: 5.3,
        icon: Mountain,
        colorClass: 'text-cyan-400',
      },
      {
        id: 'clps-im3-vertex',
        name: 'IM-3 (Lunar Vertex)',
        sublabel: 'Reiner Gamma Swirl · Magnetic Anomaly & CADRE',
        tag: 'CLPS TO CP-11',
        lon: -59.00,
        lat: 7.50,
        zoom: 5.4,
        icon: CircleDot,
        colorClass: 'text-cyan-400',
      },
      {
        id: 'clps-draper-cp12',
        name: 'Draper CP-12 (APEX 1.0)',
        sublabel: 'Schrödinger Basin (Farside) · Seismic Observatory',
        tag: 'CLPS TO CP-12',
        lon: 132.40,
        lat: -75.00,
        zoom: 5.3,
        icon: CircleDot,
        colorClass: 'text-cyan-400',
      },
      {
        id: 'clps-peregrine-pm1',
        name: 'Peregrine Mission 1',
        sublabel: 'Sinus Viscositatis Target · Transiting Radiation Data',
        tag: 'CLPS TO 2-AB',
        lon: -40.99,
        lat: 35.25,
        zoom: 5.2,
        icon: AlertTriangle,
        colorClass: 'text-rose-400',
      },
      {
        id: 'landing-lcross',
        name: 'LCROSS Impact (Cabeus)',
        sublabel: 'Water Ice Vapor Discovery Site (84.7°S)',
        tag: 'NASA',
        lon: -48.725,
        lat: -84.675,
        zoom: 5.2,
        icon: CircleDot,
        colorClass: 'text-sky-400',
      },
    ],
  },
  {
    category: 'Apollo Crewed Landings',
    items: [
      {
        id: 'landing-apollo-11',
        name: 'Apollo 11',
        sublabel: 'Tranquility Base · Neil Armstrong & Buzz Aldrin',
        tag: 'Apollo',
        lon: 23.4730,
        lat: 0.6741,
        zoom: 5.2,
        icon: Rocket,
        colorClass: 'text-amber-400',
      },
      {
        id: 'landing-apollo-12',
        name: 'Apollo 12',
        sublabel: 'Ocean of Storms · Surveyor 3 Precision Landing',
        tag: 'Apollo',
        lon: -23.4216,
        lat: -3.0124,
        zoom: 5.2,
        icon: Rocket,
        colorClass: 'text-amber-400',
      },
      {
        id: 'landing-apollo-15',
        name: 'Apollo 15',
        sublabel: 'Hadley-Apennine · Genesis Rock Sample',
        tag: 'Apollo',
        lon: 3.6339,
        lat: 26.1322,
        zoom: 5.2,
        icon: Rocket,
        colorClass: 'text-amber-400',
      },
      {
        id: 'landing-apollo-17',
        name: 'Apollo 17',
        sublabel: 'Taurus-Littrow · Final Crewed Mission',
        tag: 'Apollo',
        lon: 30.7717,
        lat: 20.1908,
        zoom: 5.2,
        icon: Rocket,
        colorClass: 'text-amber-400',
      },
    ],
  },
  {
    category: 'Robotic & Far Side Explorers',
    items: [
      {
        id: 'landing-change-4',
        name: "Chang'e 4",
        sublabel: 'Historic First Lunar Far Side Soft Landing',
        tag: 'CNSA',
        lon: 177.599,
        lat: -45.444,
        zoom: 5.2,
        icon: Rocket,
        colorClass: 'text-emerald-400',
      },
      {
        id: 'landing-change-6',
        name: "Chang'e 6",
        sublabel: 'First Far Side Sample Return (1.93 kg)',
        tag: 'CNSA',
        lon: -153.99,
        lat: -41.64,
        zoom: 5.2,
        icon: Rocket,
        colorClass: 'text-emerald-400',
      },
      {
        id: 'landing-chandrayaan-3',
        name: 'Chandrayaan-3',
        sublabel: 'Shiv Shakti Point · Near South Pole (69.4°S)',
        tag: 'ISRO',
        lon: 32.35,
        lat: -69.37,
        zoom: 5.2,
        icon: Rocket,
        colorClass: 'text-emerald-400',
      },
      {
        id: 'landing-slim',
        name: 'SLIM (Moon Sniper)',
        sublabel: 'Pinpoint Landing (~55m Accuracy) near Shioli',
        tag: 'JAXA',
        lon: 25.25,
        lat: -13.31,
        zoom: 5.5,
        icon: Rocket,
        colorClass: 'text-emerald-400',
      },
    ],
  },
  {
    category: 'Key Selenographic Landmarks',
    items: [
      {
        id: 'south-pole-highlight',
        name: 'Lunar South Pole (90°S)',
        sublabel: 'Volatile Water Ice Reserves & Constant Sunlight',
        tag: 'Pole',
        lon: 0.0,
        lat: -90.0,
        zoom: 4.8,
        icon: Target,
        colorClass: 'text-cyan-400',
      },
      {
        id: 'crater-tycho',
        name: 'Tycho Crater',
        sublabel: 'Prominent 85 km Rayed Impact Basin',
        tag: 'Crater',
        lon: -11.36,
        lat: -43.31,
        zoom: 5.5,
        icon: CircleDot,
        colorClass: 'text-slate-300',
      },
      {
        id: 'crater-copernicus',
        name: 'Copernicus Crater',
        sublabel: 'Classic 93 km Terraced Impact Rim',
        tag: 'Crater',
        lon: -20.08,
        lat: 9.62,
        zoom: 5.5,
        icon: CircleDot,
        colorClass: 'text-slate-300',
      },
      {
        id: 'mountain-mons-huygens',
        name: 'Mons Huygens',
        sublabel: '+5,500m Highest Mountain Massif',
        tag: 'Peak',
        lon: -2.87,
        lat: 19.92,
        zoom: 5.0,
        icon: Mountain,
        colorClass: 'text-amber-400',
      },
      {
        id: 'mare-tranquillitatis',
        name: 'Mare Tranquillitatis',
        sublabel: 'Ancient Basaltic Sea (Sea of Tranquility)',
        tag: 'Sea',
        lon: 31.40,
        lat: 8.50,
        zoom: 3.2,
        icon: Waves,
        colorClass: 'text-sky-400',
      },
    ],
  },
];

/**
 * Compact, unified mission browser & surface features toolbar.
 * Replaces the two stacked rows of buttons with one organized, minimal control strip.
 */
export default function UnifiedToolbar({
  layers,
  onToggleLayer,
  onToggleAllSymbols,
  onGoToSouthPole,
  onSelectExpedition,
  onOpenMissionExplorer,
  onOpenComparison,
  onNavigateCoordinates,
  isSouthPoleMode = false,
}) {
  const [isMissionsOpen, setIsMissionsOpen] = useState(false);
  const [isFeaturesOpen, setIsFeaturesOpen] = useState(false);
  const [isLegendOpen, setIsLegendOpen] = useState(false);
  const [isCoordsOpen, setIsCoordsOpen] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  // Coordinate jump input states
  const [coordInputLat, setCoordInputLat] = useState('');
  const [coordInputLon, setCoordInputLon] = useState('');
  const [coordError, setCoordError] = useState('');

  const missionsRef = useRef(null);
  const featuresRef = useRef(null);
  const coordsRef = useRef(null);

  // Status for symbol layers
  const isLandingsVisible = layers.find((l) => l.id === 'lunar-landing-sites')?.visible ?? true;
  const isCratersVisible = layers.find((l) => l.id === 'lunar-craters')?.visible ?? true;
  const isMountainsVisible = layers.find((l) => l.id === 'lunar-mountains')?.visible ?? true;
  const isMariaVisible = layers.find((l) => l.id === 'lunar-maria')?.visible ?? true;
  const isValleysVisible = layers.find((l) => l.id === 'lunar-valleys')?.visible ?? true;

  const allSymbolsVisible = isLandingsVisible && isCratersVisible && isMountainsVisible && isMariaVisible && isValleysVisible;

  const activeCount = [
    isLandingsVisible,
    isCratersVisible,
    isMountainsVisible,
    isMariaVisible,
    isValleysVisible,
  ].filter(Boolean).length;

  // Close dropdowns on outside click
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (missionsRef.current && !missionsRef.current.contains(e.target)) {
        setIsMissionsOpen(false);
      }
      if (featuresRef.current && !featuresRef.current.contains(e.target)) {
        setIsFeaturesOpen(false);
      }
      if (coordsRef.current && !coordsRef.current.contains(e.target)) {
        setIsCoordsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const handleSelectMission = (item) => {
    setIsMissionsOpen(false);
    setIsMobileOpen(false);

    const feature =
      LANDING_SITES.find((s) => s.id === item.id || s.name.toLowerCase().includes(item.name.toLowerCase())) ||
      LUNAR_FEATURES.find((f) => f.id === item.id || f.name.toLowerCase() === item.name.toLowerCase()) ||
      {
        id: item.id,
        name: item.name,
        type: item.tag?.includes('CLPS') || item.tag === 'Apollo' || item.tag === 'CNSA' || item.tag === 'ISRO' || item.tag === 'JAXA' ? 'clps-mission' : (item.tag === 'Peak' ? 'mountain' : (item.tag === 'Sea' ? 'mare' : 'crater')),
        longitude: item.lon,
        latitude: item.lat,
        description: `${item.name}: ${item.sublabel}. Selenographic landmark target.`,
        source: 'NASA Planetary Data System',
      };

    onSelectExpedition(feature, item.lon, item.lat, item.zoom);
  };

  const handleCoordinateJump = (e) => {
    e.preventDefault();
    setCoordError('');

    // Test if combined string or separate lat/lon
    const latNum = parseFloat(coordInputLat);
    const lonNum = parseFloat(coordInputLon);

    if (isNaN(latNum) || isNaN(lonNum)) {
      // Try parsing single combined string if entered in lat
      const parsed = parseLunarCoordinates(coordInputLat);
      if (parsed) {
        onNavigateCoordinates?.(parsed[0], parsed[1]);
        setIsCoordsOpen(false);
        setCoordInputLat('');
        setCoordInputLon('');
        return;
      }
      setCoordError('Please enter valid numeric latitude (-90 to +90) and longitude (-180 to +180).');
      return;
    }

    const clampedLat = clampLatitude(latNum);
    const normLon = normalizeLongitude(lonNum);

    onNavigateCoordinates?.(normLon, clampedLat);
    setIsCoordsOpen(false);
    setCoordInputLat('');
    setCoordInputLon('');
  };

  const featureLayersList = [
    {
      id: 'lunar-landing-sites',
      name: 'Landing Sites',
      subtext: 'Apollo & Commercial CLPS',
      visible: isLandingsVisible,
      icon: Rocket,
      dotClass: 'bg-cyan-400',
    },
    {
      id: 'lunar-craters',
      name: 'Impact Craters',
      subtext: 'IAU Selenographic catalog',
      visible: isCratersVisible,
      icon: CircleDot,
      dotClass: 'bg-slate-300',
    },
    {
      id: 'lunar-mountains',
      name: 'Mountains & Massifs',
      subtext: 'Montes & Polar peaks',
      visible: isMountainsVisible,
      icon: Mountain,
      dotClass: 'bg-amber-400',
    },
    {
      id: 'lunar-maria',
      name: 'Maria (Basaltic Seas)',
      subtext: 'Ancient volcanic basalt plains',
      visible: isMariaVisible,
      icon: Waves,
      dotClass: 'bg-sky-400',
    },
    {
      id: 'lunar-valleys',
      name: 'Valleys & Rilles',
      subtext: 'Sinuous graben & lava tubes',
      visible: isValleysVisible,
      icon: Diamond,
      dotClass: 'bg-purple-400',
    },
  ];

  return (
    <>
      {/* ========================================================================= */}
      {/* DESKTOP COMPACT FLOATING TOOLBAR */}
      {/* ========================================================================= */}
      <div
        id="unified-mission-toolbar"
        className="absolute top-14 left-3 sm:left-4 z-20 hidden sm:flex items-center gap-1.5 p-1 bg-[#060b14]/90 backdrop-blur-xl border border-slate-800/80 rounded-xl shadow-2xl pointer-events-auto select-none"
      >
        {/* 1. Quick South Pole Jump & Focus */}
        <button
          type="button"
          id="btn-quick-south-pole"
          onClick={onGoToSouthPole}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
            isSouthPoleMode
              ? 'bg-cyan-500 text-white border-cyan-400 shadow-md shadow-cyan-950/50'
              : 'bg-cyan-950/70 hover:bg-cyan-900/80 text-cyan-300 border-cyan-500/30 hover:border-cyan-400/60 shadow-sm'
          }`}
          title="Toggle South Pole Exploration Mode (90°S - Artemis & CLPS Zone)"
        >
          <Target className="w-3.5 h-3.5 text-cyan-300" />
          <span>South Pole (90°S)</span>
        </button>

        <div className="h-4 w-px bg-slate-800" />

        {/* 2. Featured Missions Dropdown */}
        <div ref={missionsRef} className="relative">
          <button
            type="button"
            id="btn-missions-dropdown"
            onClick={() => {
              setIsMissionsOpen((prev) => !prev);
              setIsFeaturesOpen(false);
              setIsCoordsOpen(false);
            }}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all ${
              isMissionsOpen
                ? 'bg-slate-800 text-white border-slate-700 shadow-md'
                : 'bg-slate-900/60 hover:bg-slate-850 text-slate-200 border-slate-800 hover:border-slate-700'
            }`}
          >
            <Rocket className="w-3.5 h-3.5 text-cyan-400" />
            <span>Missions</span>
            <ChevronDown className={`w-3 h-3 text-slate-400 transition-transform ${isMissionsOpen ? 'rotate-180' : ''}`} />
          </button>

          {isMissionsOpen && (
            <div id="missions-dropdown-menu" className="absolute top-full left-0 mt-1.5 w-84 max-h-[70vh] overflow-y-auto bg-[#060b14]/55 backdrop-blur-2xl border border-slate-800 rounded-xl shadow-2xl p-2 space-y-3 z-50 custom-scrollbar animate-in fade-in zoom-in-95 duration-100">
              <div className="px-2 pt-1 pb-1 text-[10px] font-mono uppercase tracking-wider text-cyan-400 border-b border-slate-800 flex items-center justify-between">
                <span>Featured Lunar Missions</span>
                {onOpenMissionExplorer && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsMissionsOpen(false);
                      onOpenMissionExplorer();
                    }}
                    className="text-cyan-300 hover:underline flex items-center gap-1"
                  >
                    <span>Full Explorer</span>
                    <ExternalLink className="w-2.5 h-2.5" />
                  </button>
                )}
              </div>

              {FEATURED_MISSIONS.map((group) => (
                <div key={group.category} className="space-y-1">
                  <div className="px-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    {group.category}
                  </div>
                  <div className="space-y-0.5">
                    {group.items.map((item) => {
                      const Icon = item.icon;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => handleSelectMission(item)}
                          className="w-full flex items-center justify-between p-2 rounded-lg text-left text-xs hover:bg-slate-850/80 transition-colors group"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <Icon className={`w-3.5 h-3.5 shrink-0 ${item.colorClass}`} />
                            <div className="min-w-0">
                              <div className="font-medium text-slate-100 truncate group-hover:text-cyan-300">
                                {item.name}
                              </div>
                              <div className="text-[10px] text-slate-400 truncate">
                                {item.sublabel}
                              </div>
                            </div>
                          </div>
                          <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-400 shrink-0 ml-2">
                            {item.tag}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 3. Dedicated Full Mission Explorer Button */}
        {onOpenMissionExplorer && (
          <button
            type="button"
            id="btn-open-explorer-dialog"
            onClick={onOpenMissionExplorer}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-slate-900/60 hover:bg-slate-800 text-slate-200 border border-slate-800 hover:border-slate-700 transition-colors"
            title="Open Dedicated CLPS Mission Explorer List & Filter Dialog"
          >
            <Compass className="w-3.5 h-3.5 text-cyan-400" />
            <span className="hidden md:inline">Explorer</span>
          </button>
        )}

        {/* 4. Compare Missions Button */}
        {onOpenComparison && (
          <button
            type="button"
            id="btn-open-comparison-dialog"
            onClick={onOpenComparison}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-slate-900/60 hover:bg-slate-800 text-slate-200 border border-slate-800 hover:border-slate-700 transition-colors"
            title="Compare two NASA CLPS missions side-by-side"
          >
            <GitCompare className="w-3.5 h-3.5 text-cyan-400" />
            <span className="hidden md:inline">Compare</span>
          </button>
        )}

        {/* 5. Surface Features Filter Dropdown */}
        <div ref={featuresRef} className="relative">
          <button
            type="button"
            id="btn-features-dropdown"
            onClick={() => {
              setIsFeaturesOpen((prev) => !prev);
              setIsMissionsOpen(false);
              setIsCoordsOpen(false);
            }}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all ${
              isFeaturesOpen
                ? 'bg-slate-800 text-white border-slate-700 shadow-md'
                : 'bg-slate-900/60 hover:bg-slate-850 text-slate-200 border-slate-800 hover:border-slate-700'
            }`}
          >
            <Layers className="w-3.5 h-3.5 text-slate-300" />
            <span>Features ({activeCount}/5)</span>
            <ChevronDown className={`w-3 h-3 text-slate-400 transition-transform ${isFeaturesOpen ? 'rotate-180' : ''}`} />
          </button>

          {isFeaturesOpen && (
            <div id="features-dropdown-menu" className="absolute top-full left-0 mt-1.5 w-72 bg-[#060b14]/55 backdrop-blur-2xl border border-slate-800 rounded-xl shadow-2xl p-2.5 z-50 animate-in fade-in zoom-in-95 duration-100">
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800 text-[11px]">
                <span className="font-semibold text-slate-200">Surface Features</span>
                <button
                  type="button"
                  onClick={() => onToggleAllSymbols(!allSymbolsVisible)}
                  className="text-[10px] text-cyan-400 hover:text-cyan-300 font-mono transition-colors"
                >
                  {allSymbolsVisible ? 'Hide All' : 'Show All'}
                </button>
              </div>

              <div className="space-y-1">
                {featureLayersList.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => onToggleLayer(item.id, !item.visible)}
                      className="w-full flex items-center justify-between p-2 rounded-lg text-left text-xs hover:bg-slate-850/80 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${item.dotClass}`} />
                        <Icon className="w-3.5 h-3.5 text-slate-400" />
                        <div>
                          <div className="text-slate-200 font-medium">{item.name}</div>
                          <div className="text-[10px] text-slate-500">{item.subtext}</div>
                        </div>
                      </div>
                      <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                        item.visible
                          ? 'bg-cyan-500 border-cyan-400 text-white'
                          : 'border-slate-700 bg-slate-900 text-transparent'
                      }`}>
                        <Check className="w-3 h-3" />
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="mt-2.5 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[10px]">
                <button
                  type="button"
                  onClick={() => {
                    setIsLegendOpen(true);
                    setIsFeaturesOpen(false);
                  }}
                  className="flex items-center gap-1 text-slate-400 hover:text-cyan-300 transition-colors"
                >
                  <Info className="w-3 h-3 text-cyan-400" />
                  <span>Symbology Key & Info</span>
                </button>
                <span className="font-mono text-slate-500">IAU GIS</span>
              </div>
            </div>
          )}
        </div>

        {/* 6. Navigate to Exact Coordinates Popover */}
        <div ref={coordsRef} className="relative">
          <button
            type="button"
            id="btn-coords-dropdown"
            onClick={() => {
              setIsCoordsOpen((prev) => !prev);
              setIsMissionsOpen(false);
              setIsFeaturesOpen(false);
            }}
            className={`p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/70 transition-colors ${
              isCoordsOpen ? 'bg-slate-800 text-white' : ''
            }`}
            title="Navigate directly to selenographic coordinates (Lat / Lon)"
          >
            <MapPin className="w-3.5 h-3.5" />
          </button>

          {isCoordsOpen && (
            <div className="absolute top-full left-0 mt-1.5 w-64 bg-[#060b14]/98 backdrop-blur-2xl border border-slate-800 rounded-xl shadow-2xl p-3 z-50 animate-in fade-in zoom-in-95 duration-100">
              <form onSubmit={handleCoordinateJump} className="space-y-2.5">
                <div className="flex items-center justify-between border-b border-slate-800 pb-1.5 text-[11px]">
                  <span className="font-semibold text-slate-200">Go to Coordinates</span>
                  <span className="font-mono text-[9px] text-cyan-400">Selenographic</span>
                </div>

                <div className="space-y-1.5 text-xs font-mono">
                  <div>
                    <label className="text-[10px] text-slate-400 font-sans block mb-0.5">Latitude (-90° to +90°)</label>
                    <input
                      type="text"
                      placeholder="e.g. -80.13 or 80.13S"
                      value={coordInputLat}
                      onChange={(e) => setCoordInputLat(e.target.value)}
                      className="w-full h-8 px-2.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 font-sans block mb-0.5">Longitude (-180° to +180°)</label>
                    <input
                      type="text"
                      placeholder="e.g. 1.44 or 1.44E"
                      value={coordInputLon}
                      onChange={(e) => setCoordInputLon(e.target.value)}
                      className="w-full h-8 px-2.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                </div>

                {coordError && (
                  <p className="text-[10px] text-rose-400 leading-tight">{coordError}</p>
                )}

                <button
                  type="submit"
                  className="w-full h-8 flex items-center justify-center gap-1.5 text-xs font-semibold text-white bg-gradient-to-r from-cyan-600 to-blue-600 rounded-lg hover:brightness-110 shadow-sm"
                >
                  <Navigation className="w-3 h-3" />
                  <span>Fly to Target</span>
                </button>
              </form>
            </div>
          )}
        </div>

        {/* 7. Symbology Legend & Info Button */}
        <button
          type="button"
          onClick={() => setIsLegendOpen(true)}
          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/70 transition-colors"
          title="View Map Symbology Key & Planetary Data Sources"
        >
          <Info className="w-3.5 h-3.5 text-slate-400" />
        </button>
      </div>

      {/* ========================================================================= */}
      {/* MOBILE COMPACT EXPLORE PILL */}
      {/* ========================================================================= */}
      <div className="absolute top-14 left-3 z-20 sm:hidden pointer-events-auto">
        <button
          type="button"
          onClick={() => setIsMobileOpen(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#060b14]/90 backdrop-blur-xl border border-slate-800 text-xs font-semibold text-slate-200 shadow-xl"
        >
          <Compass className="w-3.5 h-3.5 text-cyan-400" />
          <span>Missions ({activeCount})</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* MOBILE BOTTOM SHEET FOR MISSIONS & FEATURES */}
      {/* ========================================================================= */}
      {isMobileOpen && (
        <div className="fixed inset-0 z-50 sm:hidden flex flex-col justify-end bg-black/70 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-[#060b14] border-t border-slate-800 rounded-t-2xl p-4 max-h-[85vh] flex flex-col space-y-4 shadow-2xl overflow-y-auto">
            {/* Grab handle & header */}
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Compass className="w-4 h-4 text-cyan-400" />
                <h3 className="text-sm font-bold text-white">Missions & Features</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsMobileOpen(false)}
                className="p-1 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Quick Actions Cluster */}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  onGoToSouthPole();
                  setIsMobileOpen(false);
                }}
                className="flex items-center justify-center gap-1.5 p-2.5 rounded-xl bg-cyan-950/80 text-cyan-300 border border-cyan-500/40 text-xs font-bold"
              >
                <Target className="w-4 h-4" />
                <span>South Pole (90°S)</span>
              </button>

              {onOpenMissionExplorer && (
                <button
                  type="button"
                  onClick={() => {
                    setIsMobileOpen(false);
                    onOpenMissionExplorer();
                  }}
                  className="flex items-center justify-center gap-1.5 p-2.5 rounded-xl bg-slate-900 text-slate-200 border border-slate-800 text-xs font-semibold"
                >
                  <Compass className="w-4 h-4 text-cyan-400" />
                  <span>Full Explorer</span>
                </button>
              )}
            </div>

            {/* Surface Toggles */}
            <div className="space-y-1.5">
              <div className="text-[11px] font-mono uppercase text-slate-400 tracking-wider">
                Feature Layers
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {featureLayersList.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onToggleLayer(item.id, !item.visible)}
                    className={`flex items-center justify-between p-2 rounded-lg text-xs border transition-all ${
                      item.visible
                        ? 'bg-slate-850 border-cyan-500/40 text-white'
                        : 'bg-slate-900/60 border-slate-800 text-slate-400'
                    }`}
                  >
                    <span className="truncate">{item.name}</span>
                    <span className={`w-2 h-2 rounded-full ${item.visible ? item.dotClass : 'bg-slate-700'}`} />
                  </button>
                ))}
              </div>
            </div>

            {/* Featured Expeditions list */}
            <div className="space-y-2">
              <div className="text-[11px] font-mono uppercase text-slate-400 tracking-wider">
                Featured Missions & Landmarks
              </div>
              <div className="space-y-1">
                {FEATURED_MISSIONS.flatMap((g) => g.items).slice(0, 8).map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleSelectMission(item)}
                    className="w-full flex items-center justify-between p-2 rounded-lg bg-slate-900/60 border border-slate-800/80 text-left text-xs"
                  >
                    <div>
                      <div className="font-semibold text-slate-200">{item.name}</div>
                      <div className="text-[10px] text-slate-400">{item.sublabel}</div>
                    </div>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-cyan-300">
                      {item.tag}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SYMBOLOGY KEY & DATA MODAL */}
      {/* ========================================================================= */}
      {isLegendOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-[#060b14] border border-slate-800 rounded-2xl p-5 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-cyan-400" />
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                  Lunar Map Symbology & Sources
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsLegendOpen(false)}
                className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="flex items-start gap-3 p-2.5 rounded-xl bg-slate-900/60 border border-slate-800">
                <div className="w-7 h-7 rounded-lg bg-cyan-950/80 border border-cyan-500/40 flex items-center justify-center text-cyan-400 shrink-0">
                  <Rocket className="w-3.5 h-3.5" />
                </div>
                <div>
                  <div className="font-semibold text-slate-100">NASA CLPS & Landing Sites</div>
                  <p className="text-[11px] text-slate-400 leading-relaxed mt-0.5">
                    Commercial Lunar Payload Services (Odysseus IM-1, PRIME-1, Blue Ghost), Apollo crewed sites, and robotic probes.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-2.5 rounded-xl bg-slate-900/60 border border-slate-800">
                <div className="w-7 h-7 rounded-lg bg-slate-800 border border-slate-600 flex items-center justify-center text-slate-200 shrink-0">
                  <CircleDot className="w-3.5 h-3.5" />
                </div>
                <div>
                  <div className="font-semibold text-slate-100">Impact Craters</div>
                  <p className="text-[11px] text-slate-400 leading-relaxed mt-0.5">
                    IAU cataloged impact basins with morphometric diameter, depth, and geologic age period.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-2.5 rounded-xl bg-slate-900/60 border border-slate-800">
                <div className="w-7 h-7 rounded-lg bg-amber-950/80 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0">
                  <Mountain className="w-3.5 h-3.5" />
                </div>
                <div>
                  <div className="font-semibold text-slate-100">Mountains (Montes)</div>
                  <p className="text-[11px] text-slate-400 leading-relaxed mt-0.5">
                    Lunar massif mountain peaks including Mons Huygens (+5,500m) and Mons Malapert near the South Pole.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-2.5 rounded-xl bg-slate-900/60 border border-slate-800">
                <div className="w-7 h-7 rounded-lg bg-sky-950/80 border border-sky-500/40 flex items-center justify-center text-sky-400 shrink-0">
                  <Waves className="w-3.5 h-3.5" />
                </div>
                <div>
                  <div className="font-semibold text-slate-100">Maria (Basaltic Seas)</div>
                  <p className="text-[11px] text-slate-400 leading-relaxed mt-0.5">
                    Extensive dark basalt plains formed by ancient volcanic eruptions filling giant impact basins.
                  </p>
                </div>
              </div>
            </div>

            <div className="p-2.5 rounded-xl bg-cyan-950/40 border border-cyan-500/30 text-[11px] text-cyan-300 flex items-center justify-between">
              <div>
                <span className="font-semibold">NASA Moon Trek WMTS</span>
                <span className="text-slate-400 ml-1.5">LROC & LOLA GIS</span>
              </div>
              <span className="font-mono text-[10px] text-cyan-400">trek.nasa.gov</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
