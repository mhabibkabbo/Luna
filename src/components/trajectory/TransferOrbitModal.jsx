import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  X,
  Orbit,
  Rocket,
  Play,
  Pause,
  RotateCcw,
  Compass,
  MapPin,
  Globe2,
  Moon,
  ArrowRight,
  Gauge,
  Fuel,
  Clock,
  Activity,
  ChevronRight,
  Sparkles,
  Navigation,
  ExternalLink,
  Flame,
  ShieldCheck,
  Zap,
  Radio,
  RefreshCw,
  Box,
  Layers,
} from 'lucide-react';
import { EARTH_LAUNCH_SITES } from '../../data/earthLaunchSites.js';
import { LANDING_SITES } from '../../data/landingSites.js';
import {
  computeTransferOrbit,
  formatTransitTime,
  getInterpolatedStateAtFrac,
  TRAJECTORY_PROFILES,
  SCALE_3D,
  EARTH_RADIUS_KM,
  MOON_RADIUS_KM,
  EARTH_MOON_DIST_KM,
  MOON_SOI_KM,
} from '../../utils/transferOrbit.js';
import { fetchJplMoonEphemeris, LUNAR_ROCKETS } from '../../utils/jplHorizons.js';
import TransferOrbit3DViewport from './TransferOrbit3DViewport.jsx';

export default function TransferOrbitModal({
  isOpen,
  onClose,
  initialLaunchSiteId,
  initialMoonSiteId,
  onNavigateToEarthPad,
  onNavigateToMoonTarget,
}) {
  // ── Selection State ────────────────────────────────────────────────────────
  const [selectedLaunchId, setSelectedLaunchId] = useState(
    () => initialLaunchSiteId || 'earth-pad-ksc-lc39a'
  );
  const [selectedMoonId, setSelectedMoonId] = useState(
    () => initialMoonSiteId || 'landing-apollo-11'
  );
  const [profileId, setProfileId] = useState('direct');
  const [selectedRocketId, setSelectedRocketId] = useState('sls-block1');
  const [viewDimension, setViewDimension] = useState('3d'); // '3d' | '2d'
  const [hoveredMilestone, setHoveredMilestone] = useState(null);
  const [parkingAltKm, setParkingAltKm] = useState(185);
  const [lunarOrbitAltKm, setLunarOrbitAltKm] = useState(100);

  // ── NASA JPL Horizons Live Ephemeris State ─────────────────────────────────
  const [jplEphemeris, setJplEphemeris] = useState(null);
  const [isLoadingJpl, setIsLoadingJpl] = useState(false);

  // ── Playback & Simulation State ────────────────────────────────────────────
  const [simProgress, setSimProgress] = useState(0.0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [simSpeed, setSimSpeed] = useState(1); // 1x, 3x, 8x
  const animFrameRef = useRef(null);
  const lastTimeRef = useRef(performance.now());

  // ── Active Data Lookup ─────────────────────────────────────────────────────
  const launchSite = useMemo(() => {
    return (
      EARTH_LAUNCH_SITES.find((s) => s.id === selectedLaunchId) ||
      EARTH_LAUNCH_SITES[0] || {
        id: 'ksc-default',
        name: 'Kennedy Space Center LC-39A',
        latitude: 28.6083,
        longitude: -80.6041,
        country: 'United States',
        agency: 'NASA / SpaceX',
      }
    );
  }, [selectedLaunchId]);

  const moonTarget = useMemo(() => {
    return (
      LANDING_SITES.find((s) => s.id === selectedMoonId) ||
      LANDING_SITES[0] || {
        id: 'apollo-11-default',
        name: 'Apollo 11 (Tranquility Base)',
        latitude: 0.6741,
        longitude: 23.473,
        agency: 'NASA',
      }
    );
  }, [selectedMoonId]);

  const selectedRocket = useMemo(() => {
    return LUNAR_ROCKETS.find((r) => r.id === selectedRocketId) || LUNAR_ROCKETS[0];
  }, [selectedRocketId]);

  // ── Fetch NASA JPL Horizons Ephemeris ──────────────────────────────────────
  const loadJplData = () => {
    setIsLoadingJpl(true);
    fetchJplMoonEphemeris(new Date())
      .then((data) => {
        setJplEphemeris(data);
      })
      .catch(() => {})
      .finally(() => {
        setIsLoadingJpl(false);
      });
  };

  useEffect(() => {
    if (isOpen) {
      loadJplData();
      setIsPlaying(false);
      setSimProgress(0.0);
    }
  }, [isOpen]);

  // ── Physics Trajectory Computation ─────────────────────────────────────────
  const orbitPlan = useMemo(() => {
    let moon3dPos = null;
    if (jplEphemeris && jplEphemeris.rangeKm) {
      // Mission-oriented frame: Earth on the left at (0, 0, 0), Moon on the right (+X)
      const scaleDist = SCALE_3D.DISTANCE * (jplEphemeris.rangeKm / 384400);
      const yMoon = scaleDist * (jplEphemeris.zKm / jplEphemeris.rangeKm);
      const zMoon = scaleDist * (jplEphemeris.yKm / jplEphemeris.rangeKm) * 0.2;
      const xMoon = Math.sqrt(Math.max(10, scaleDist * scaleDist - yMoon * yMoon - zMoon * zMoon));
      moon3dPos = { x: xMoon, y: yMoon, z: zMoon };
    }

    return computeTransferOrbit({
      launchSite,
      moonTarget,
      profileId,
      parkingAltKm,
      lunarOrbitAltKm,
      moon3dPos,
    });
  }, [launchSite, moonTarget, profileId, parkingAltKm, lunarOrbitAltKm, jplEphemeris]);

  // ── Animation Loop ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isOpen || !isPlaying) return;

    lastTimeRef.current = performance.now();

    const loop = (now) => {
      const deltaMs = now - lastTimeRef.current;
      lastTimeRef.current = now;

      // Base cycle duration: ~18 seconds for full transit at 1x
      const cycleDurationMs = 18000 / simSpeed;
      setSimProgress((prev) => {
        const next = prev + deltaMs / cycleDurationMs;
        return next >= 1.0 ? 0.0 : next;
      });

      animFrameRef.current = requestAnimationFrame(loop);
    };

    animFrameRef.current = requestAnimationFrame(loop);

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [isOpen, isPlaying, simSpeed]);

  // Current interpolated state of the rocket
  const currentState = useMemo(() => {
    return getInterpolatedStateAtFrac(orbitPlan.waypoints, simProgress);
  }, [orbitPlan.waypoints, simProgress]);

  if (!isOpen) return null;

  // ── Synchronized 2D Trajectory Projection Data ────────────────────────────
  const projection2d = orbitPlan.projection2d;
  const rocketSvg =
    projection2d && currentState
      ? projection2d.toSvgCoords(currentState.x, currentState.y)
      : { x: 130, y: 200 };

  // Phase badge details
  const getPhaseInfo = (phase) => {
    switch (phase) {
      case 'tli':
        return { label: 'TLI Burn (Engine Firing)', color: 'text-amber-400', bg: 'bg-amber-500/20', isThrusting: true };
      case 'lunar-approach':
        return { label: 'Lunar SOI Encounter', color: 'text-cyan-300', bg: 'bg-cyan-500/20', isThrusting: false };
      case 'return':
        return { label: 'Circumlunar Free-Return Leg', color: 'text-violet-300', bg: 'bg-violet-500/20', isThrusting: false };
      case 'loi':
        return { label: 'LOI Retrograde Burn', color: 'text-rose-400', bg: 'bg-rose-500/20', isThrusting: true };
      default:
        return { label: 'Translunar Coast (PTC Roll)', color: 'text-emerald-400', bg: 'bg-emerald-500/20', isThrusting: false };
    }
  };

  const phaseInfo = getPhaseInfo(currentState?.phase);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-150 select-none pointer-events-auto overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative w-full max-w-6xl max-h-[96vh] bg-[#0A111C] border border-[#16283C] rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col text-[#F8FAFC] font-sans my-auto">
        {/* ── Modal Header ────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-2.5 border-b border-[#16283C] bg-[#060B13]/95 flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#152336] border border-[#A78BFA]/40 flex items-center justify-center text-[#A78BFA] shadow-[0_0_15px_rgba(167,139,250,0.25)]">
              <Orbit className="w-4 h-4 animate-pulse" />
            </div>
            <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-[#A78BFA]/15 text-[#A78BFA] border border-[#A78BFA]/30">
              3D WebGL · NASA JPL Horizons API
            </span>
          </div>

          <div className="flex items-center gap-3">
            {/* 3D / 2D View Dimension Toggle */}
            <div className="flex items-center bg-[#152336] rounded-xl p-0.5 border border-[#223854] text-xs font-mono">
              <button
                type="button"
                onClick={() => setViewDimension('3d')}
                className={`px-3 py-1 rounded-lg flex items-center gap-1.5 transition-all ${
                  viewDimension === '3d'
                    ? 'bg-[#A78BFA] text-[#060B13] font-bold shadow-[0_0_10px_rgba(167,139,250,0.3)]'
                    : 'text-[#94A3B8] hover:text-white'
                }`}
                title="Switch to Interactive 3D Cislunar Space"
              >
                <Box className="w-3.5 h-3.5" />
                <span>3D Space</span>
              </button>
              <button
                type="button"
                onClick={() => setViewDimension('2d')}
                className={`px-3 py-1 rounded-lg flex items-center gap-1.5 transition-all ${
                  viewDimension === '2d'
                    ? 'bg-[#38BDF8] text-[#060B13] font-bold shadow-[0_0_10px_rgba(56,189,248,0.3)]'
                    : 'text-[#94A3B8] hover:text-white'
                }`}
                title="Switch to 2D Mission Flight Diagram"
              >
                <Layers className="w-3.5 h-3.5" />
                <span>2D Diagram</span>
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-full text-[#94A3B8] hover:text-white hover:bg-[#16283C] transition-colors"
              title="Close Planner [Esc]"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* ── Modal Body: Controls & Visualizer ───────────────────────────────── */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {/* ── Flattened Trajectory Profile Selector ────────────────────────── */}
          <div className="bg-[#0d1624] border border-[#1b2d45] rounded-2xl p-3 sm:p-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-[#A78BFA] uppercase tracking-wider flex-shrink-0">
                <Sparkles className="w-4 h-4 text-[#A78BFA]" />
                <span>Flight Trajectory Profile:</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 flex-1">
                {TRAJECTORY_PROFILES.map((p) => {
                  const isSelected = profileId === p.id;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setProfileId(p.id)}
                      className={`p-2.5 px-3.5 rounded-xl border text-left flex items-center justify-between transition-all ${
                        isSelected
                          ? 'bg-[#A78BFA]/20 border-[#A78BFA] text-white shadow-[0_0_12px_rgba(167,139,250,0.25)] ring-1 ring-[#A78BFA]/50'
                          : 'bg-[#152336]/60 border-[#223854] text-[#94A3B8] hover:text-white hover:bg-[#152336]'
                      }`}
                    >
                      <div>
                        <div className="font-semibold text-xs text-white leading-tight">{p.name}</div>
                        <div className="text-[10px] font-mono text-[#A78BFA] mt-0.5">{p.subtitle}</div>
                      </div>
                      {isSelected && (
                        <div className="w-2 h-2 rounded-full bg-[#A78BFA] shadow-[0_0_8px_#A78BFA] ml-2 flex-shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mt-2.5 pt-2 border-t border-[#1b2d45]/70 flex items-center justify-between text-[11px] font-mono text-[#94A3B8]">
              <div className="flex items-center gap-2">
                <span className="text-[#38BDF8] font-semibold">{orbitPlan.profile.name}:</span>
                <span className="text-[#94A3B8]">{orbitPlan.profile.description}</span>
              </div>
              <span className="hidden sm:inline-block text-[#A78BFA] text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-[#A78BFA]/10 border border-[#A78BFA]/20 flex-shrink-0 ml-2">
                {orbitPlan.profile.transitNote}
              </span>
            </div>
          </div>

          {/* ── Main Trajectory Visualizer (3D or 2D) ─────────────────────────── */}
          <div className="relative bg-[#060B13] border border-[#16283C] rounded-2xl sm:rounded-3xl p-3 sm:p-4 overflow-hidden">
            {/* Visualizer Header Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 mb-2.5 pb-2.5 border-b border-[#16283C]/80">
              <div className="flex items-center gap-3">
                <span className="text-xs font-mono font-medium text-white flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5 text-[#22D3EE]" />
                  <span>
                    {viewDimension === '3d' ? '3D Cislunar Orbital Flight Simulation' : '2D Translunar Transfer Diagram'}
                  </span>
                </span>
                <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full ${phaseInfo.bg} ${phaseInfo.color} border border-current/20 flex items-center gap-1`}>
                  {phaseInfo.isThrusting && <Flame className="w-3 h-3 animate-bounce" />}
                  <span>{phaseInfo.label}</span>
                </span>
              </div>

              {/* Playback Controls */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsPlaying(!isPlaying)}
                  className="p-1.5 px-3 rounded-lg bg-[#152336] hover:bg-[#223854] text-white text-xs flex items-center gap-1.5 font-mono transition-colors"
                  title={isPlaying ? 'Pause Simulation' : 'Play Simulation'}
                >
                  {isPlaying ? <Pause className="w-3.5 h-3.5 text-amber-400" /> : <Play className="w-3.5 h-3.5 text-emerald-400" />}
                  <span>{isPlaying ? 'Pause' : 'Play'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSimProgress(0)}
                  className="p-1.5 rounded-lg bg-[#152336] hover:bg-[#223854] text-[#94A3B8] hover:text-white transition-colors"
                  title="Reset to Departure"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>

                <div className="flex items-center bg-[#152336] rounded-lg p-0.5 border border-[#223854] text-[10px] font-mono">
                  {[1, 3, 8].map((speed) => (
                    <button
                      key={speed}
                      type="button"
                      onClick={() => setSimSpeed(speed)}
                      className={`px-2 py-0.5 rounded-md transition-all ${
                        simSpeed === speed ? 'bg-[#A78BFA] text-[#060B13] font-bold' : 'text-[#94A3B8] hover:text-white'
                      }`}
                    >
                      {speed}x
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* ── Viewport Display: 3D or 2D ──────────────────────────────────── */}
            {viewDimension === '3d' ? (
              <TransferOrbit3DViewport
                orbitPlan={orbitPlan}
                simProgress={simProgress}
                launchSite={launchSite}
                moonTarget={moonTarget}
                jplEphemeris={jplEphemeris}
              />
            ) : (
              <div className="relative w-full aspect-[21/9] sm:aspect-[22/9] max-h-[420px] bg-gradient-to-b from-[#03060d] via-[#050914] to-[#03060c] rounded-2xl overflow-hidden border border-[#142338] p-3 flex flex-col justify-between">
                {/* 2D Projection Frame Header & Phase Legend */}
                <div className="flex flex-wrap items-center justify-between gap-2 mb-1 z-10">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] uppercase font-mono px-2.5 py-0.5 rounded-full bg-[#38BDF8]/15 text-[#38BDF8] border border-[#38BDF8]/30 font-semibold">
                      {projection2d.frameType === 'synodic'
                        ? 'Earth-Moon Rotating (Synodic) Barycentric Frame'
                        : 'Sun-Earth Synodic Frame · Weak Stability Boundary (L1/L2)'}
                    </span>
                    <span className="text-[10px] font-mono text-[#64748B] hidden md:inline">
                      {projection2d.subtitle}
                    </span>
                  </div>

                  {/* Phase Legend Dots */}
                  <div className="flex items-center gap-3 text-[10px] font-mono">
                    <div className="flex items-center gap-1.5 text-[#38BDF8]">
                      <span className="w-2 h-2 rounded-full bg-[#38BDF8] shadow-[0_0_6px_#38BDF8]" />
                      <span>Outbound</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-[#A78BFA]">
                      <span className="w-2 h-2 rounded-full bg-[#A78BFA] shadow-[0_0_6px_#A78BFA]" />
                      <span>{projection2d.frameType === 'synodic' ? 'Encounter / Perilune' : 'WSB Turnaround'}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-[#F43F5E]">
                      <span className="w-2 h-2 rounded-full bg-[#F43F5E] shadow-[0_0_6px_#F43F5E]" />
                      <span>{profileId === 'free-return' ? 'Earth Return' : profileId === 'low-energy' ? 'Ballistic Capture' : 'Lunar Descent'}</span>
                    </div>
                  </div>
                </div>

                {/* 2D SVG Canvas */}
                <div className="relative flex-1 w-full min-h-[260px] overflow-visible">
                  <svg viewBox="0 0 920 400" className="w-full h-full select-none overflow-visible">
                    <defs>
                      <radialGradient id="earthGlow2d" cx="50%" cy="50%" r="50%">
                        <stop offset="0%" stopColor="#38BDF8" stopOpacity="0.95" />
                        <stop offset="65%" stopColor="#0284C7" stopOpacity="0.85" />
                        <stop offset="100%" stopColor="#0284C7" stopOpacity="0.1" />
                      </radialGradient>
                      <radialGradient id="moonGlow2d" cx="40%" cy="40%" r="50%">
                        <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.95" />
                        <stop offset="70%" stopColor="#94A3B8" stopOpacity="0.8" />
                        <stop offset="100%" stopColor="#475569" stopOpacity="0.4" />
                      </radialGradient>
                      <filter id="neonGlowCyan" x="-20%" y="-20%" width="140%" height="140%">
                        <feDropShadow dx="0" dy="0" stdDeviation="3" floodColor="#38BDF8" floodOpacity="0.8" />
                      </filter>
                      <filter id="neonGlowViolet" x="-20%" y="-20%" width="140%" height="140%">
                        <feDropShadow dx="0" dy="0" stdDeviation="3" floodColor="#A78BFA" floodOpacity="0.8" />
                      </filter>
                      <filter id="neonGlowRose" x="-20%" y="-20%" width="140%" height="140%">
                        <feDropShadow dx="0" dy="0" stdDeviation="3" floodColor="#F43F5E" floodOpacity="0.8" />
                      </filter>
                    </defs>

                    {/* Background Subtle Coordinate Axes Grid */}
                    <line x1="40" y1="200" x2="880" y2="200" stroke="#16283C" strokeWidth="1" strokeDasharray="3 4" strokeOpacity="0.7" />
                    <line x1="460" y1="40" x2="460" y2="360" stroke="#16283C" strokeWidth="1" strokeDasharray="3 4" strokeOpacity="0.4" />

                    {/* ══════════════ CASE A: Sun-Earth WSB Projection ══════════════ */}
                    {projection2d.frameType === 'sun-earth-wsb' ? (
                      <>
                        {/* Sun Direction Indicator */}
                        <g>
                          <line x1="200" y1="200" x2="50" y2="200" stroke="#FBBF24" strokeWidth="2" strokeDasharray="6 4" opacity="0.8" />
                          <polygon points="40,200 56,194 56,206" fill="#FBBF24" />
                          <circle cx="28" cy="200" r="14" fill="#FBBF24" opacity="0.9" />
                          <text x="28" y="226" fill="#FBBF24" fontSize="9" fontWeight="bold" fontFamily="monospace" textAnchor="middle">Sun</text>
                        </g>

                        {/* Complete Moon 27.3-Day Orbit Ellipse around Earth */}
                        {projection2d.moonOrbit && (
                          <g>
                            <ellipse
                              cx={projection2d.moonOrbit.cx}
                              cy={projection2d.moonOrbit.cy}
                              rx={projection2d.moonOrbit.rx}
                              ry={projection2d.moonOrbit.ry}
                              fill="none"
                              stroke="#00D2C4"
                              strokeWidth="1.5"
                              strokeDasharray="4 4"
                              strokeOpacity="0.4"
                            />
                            <text
                              x={projection2d.moonOrbit.cx}
                              y={projection2d.moonOrbit.cy - projection2d.moonOrbit.ry - 8}
                              fill="#00D2C4"
                              fontSize="8"
                              fontFamily="monospace"
                              textAnchor="middle"
                              opacity="0.8"
                            >
                              Moon 27.3d Orbital Path (384,400 km)
                            </text>
                          </g>
                        )}

                        {/* Sun-Earth L1 Saddle Point */}
                        {projection2d.lagrangeL1 && (
                          <g transform={`translate(${projection2d.lagrangeL1.x}, ${projection2d.lagrangeL1.y})`}>
                            <rect x="-5" y="-5" width="10" height="10" fill="none" stroke="#FBBF24" strokeWidth="1.5" transform="rotate(45)" />
                            <text x="0" y="-12" fill="#FBBF24" fontSize="8" fontWeight="bold" fontFamily="monospace" textAnchor="middle">L1</text>
                            <text x="0" y="18" fill="#94A3B8" fontSize="7" fontFamily="monospace" textAnchor="middle">~1.5M km</text>
                          </g>
                        )}

                        {/* Sun-Earth L2 / WSB Apex Saddle Point */}
                        {projection2d.lagrangeL2 && (
                          <g transform={`translate(${projection2d.lagrangeL2.x}, ${projection2d.lagrangeL2.y})`}>
                            <rect x="-6" y="-6" width="12" height="12" fill="none" stroke="#A855F7" strokeWidth="1.5" transform="rotate(45)" />
                            <text x="0" y="-14" fill="#A855F7" fontSize="8" fontWeight="bold" fontFamily="monospace" textAnchor="middle">L2 / WSB</text>
                            <text x="0" y="20" fill="#94A3B8" fontSize="7" fontFamily="monospace" textAnchor="middle">~1.5M km</text>
                          </g>
                        )}

                        {/* Moon Capture Intercept Marker on Orbit */}
                        {projection2d.moon && (
                          <g transform={`translate(${projection2d.moon.x}, ${projection2d.moon.y})`}>
                            <circle r="14" fill="none" stroke="#10B981" strokeWidth="1.5" strokeDasharray="3 3">
                              <animate attributeName="r" values="10;18;10" dur="2.5s" repeatCount="indefinite" />
                              <animate attributeName="opacity" values="0.9;0.3;0.9" dur="2.5s" repeatCount="indefinite" />
                            </circle>
                            <circle r={projection2d.moon.radius} fill="url(#moonGlow2d)" />
                            <text x="0" y="24" fill="#10B981" fontSize="9" fontWeight="bold" fontFamily="monospace" textAnchor="middle">Moon Intercept</text>
                            <text x="0" y="34" fill="#94A3B8" fontSize="7" fontFamily="monospace" textAnchor="middle">T+100 Days</text>
                          </g>
                        )}

                        {/* Segmented WSB Paths */}
                        {projection2d.paths.outbound && (
                          <path d={projection2d.paths.outbound} fill="none" stroke="#38BDF8" strokeWidth="2.5" strokeLinecap="round" filter="url(#neonGlowCyan)" />
                        )}
                        {projection2d.paths.turnaround && (
                          <path d={projection2d.paths.turnaround} fill="none" stroke="#FBBF24" strokeWidth="2.5" strokeLinecap="round" filter="url(#neonGlowCyan)" />
                        )}
                        {projection2d.paths.capture && (
                          <path d={projection2d.paths.capture} fill="none" stroke="#10B981" strokeWidth="2.5" strokeLinecap="round" filter="url(#neonGlowCyan)" />
                        )}

                        {/* Earth */}
                        <g transform={`translate(${projection2d.earth.x}, ${projection2d.earth.y})`}>
                          <circle r="32" fill="none" stroke="#38BDF8" strokeWidth="1" strokeDasharray="2 3" opacity="0.5" />
                          <circle r={projection2d.earth.radius} fill="url(#earthGlow2d)" />
                          <circle cx="5" cy="-8" r="2.5" fill="#EF4444" />
                          <text x="0" y="34" fill="#93C5FD" fontSize="10" fontWeight="bold" fontFamily="monospace" textAnchor="middle">Earth</text>
                          <text x="0" y="44" fill="#64748B" fontSize="8" fontFamily="monospace" textAnchor="middle">{launchSite.name.slice(0, 18)}</text>
                        </g>
                      </>
                    ) : (
                      /* ══════════════ CASE B: Earth-Moon Synodic Barycentric Frame ══════════════ */
                      <>
                        {/* Earth-Moon Axis Line */}
                        <line
                          x1={projection2d.earth.x}
                          y1={projection2d.earth.y}
                          x2={projection2d.moon.x}
                          y2={projection2d.moon.y}
                          stroke="#1E293B"
                          strokeWidth="1.5"
                          strokeDasharray="4 6"
                        />

                        {/* Lunar SOI Halo */}
                        <circle
                          cx={projection2d.moon.x}
                          cy={projection2d.moon.y}
                          r={projection2d.moon.soiRadius}
                          fill="none"
                          stroke="#6366F1"
                          strokeWidth="1"
                          strokeDasharray="3 4"
                          strokeOpacity="0.35"
                        />
                        <text
                          x={projection2d.moon.x}
                          y={projection2d.moon.y - projection2d.moon.soiRadius - 6}
                          fill="#6366F1"
                          fontSize="8"
                          fontFamily="monospace"
                          textAnchor="middle"
                          opacity="0.75"
                        >
                          Lunar Sphere of Influence (66,183 km)
                        </text>

                        {/* Earth LEO Parking Orbit Ring */}
                        <circle
                          cx={projection2d.earth.x}
                          cy={projection2d.earth.y}
                          r={projection2d.earth.parkingRadius}
                          fill="none"
                          stroke="#38BDF8"
                          strokeWidth="1.2"
                          strokeDasharray="3 3"
                          strokeOpacity="0.65"
                        />

                        {/* Moon Circular Orbit Ring */}
                        <circle
                          cx={projection2d.moon.x}
                          cy={projection2d.moon.y}
                          r={projection2d.moon.orbitRadius}
                          fill="none"
                          stroke="#00D2C4"
                          strokeWidth="1.2"
                          strokeDasharray="2 3"
                          strokeOpacity="0.75"
                        />

                        {/* Segmented Color-Coded Trajectory Paths */}
                        {projection2d.paths.outbound && (
                          <path
                            d={projection2d.paths.outbound}
                            fill="none"
                            stroke="#38BDF8"
                            strokeWidth="2.8"
                            strokeLinecap="round"
                            filter="url(#neonGlowCyan)"
                          />
                        )}
                        {projection2d.paths.encounter && (
                          <path
                            d={projection2d.paths.encounter}
                            fill="none"
                            stroke={profileId === 'free-return' ? '#A78BFA' : '#F59E0B'}
                            strokeWidth="3.2"
                            strokeLinecap="round"
                            filter="url(#neonGlowViolet)"
                          />
                        )}
                        {projection2d.paths.return && (
                          <path
                            d={projection2d.paths.return}
                            fill="none"
                            stroke={profileId === 'free-return' ? '#F43F5E' : '#10B981'}
                            strokeWidth="2.8"
                            strokeLinecap="round"
                            filter="url(#neonGlowRose)"
                          />
                        )}

                        {/* Earth Body */}
                        <g transform={`translate(${projection2d.earth.x}, ${projection2d.earth.y})`}>
                          <circle r={projection2d.earth.radius} fill="url(#earthGlow2d)" />
                          <circle cx="6" cy="-12" r="3" fill="#EF4444" stroke="#FFFFFF" strokeWidth="1" />
                          <text x="0" y="36" fill="#93C5FD" fontSize="10" fontWeight="bold" fontFamily="monospace" textAnchor="middle">Earth</text>
                          <text x="0" y="47" fill="#64748B" fontSize="8" fontFamily="monospace" textAnchor="middle">{launchSite.name.slice(0, 18)}</text>
                        </g>

                        {/* Moon Body */}
                        <g transform={`translate(${projection2d.moon.x}, ${projection2d.moon.y})`}>
                          <circle r={projection2d.moon.radius} fill="url(#moonGlow2d)" />
                          <circle cx="-3" cy="-7" r="2.5" fill="#00D2C4" stroke="#FFFFFF" strokeWidth="1" />
                          <text x="0" y="28" fill="#E2E8F0" fontSize="10" fontWeight="bold" fontFamily="monospace" textAnchor="middle">Moon</text>
                          <text x="0" y="39" fill="#64748B" fontSize="8" fontFamily="monospace" textAnchor="middle">{moonTarget.name.slice(0, 18)}</text>
                        </g>
                      </>
                    )}

                    {/* ══════════════ Key Trajectory Milestones (TLI, MCC, LOI, etc.) ══════════════ */}
                    {projection2d.milestones?.map((m) => {
                      const isHovered = hoveredMilestone?.id === m.id;
                      return (
                        <g
                          key={m.id}
                          transform={`translate(${m.svgX}, ${m.svgY})`}
                          className="cursor-pointer transition-transform duration-150 hover:scale-125"
                          onMouseEnter={() => setHoveredMilestone(m)}
                          onMouseLeave={() => setHoveredMilestone(null)}
                          onClick={() => {
                            setIsPlaying(false);
                            const tRatio = m.t / (orbitPlan.transfer.transitTimeS || 1);
                            setSimProgress(Math.max(0, Math.min(1, tRatio)));
                          }}
                        >
                          {/* Pulsing Outer Ring */}
                          <circle r="9" fill="none" stroke={m.badgeColor} strokeWidth="1.5" opacity="0.6">
                            <animate attributeName="r" values="7;13;7" dur="2s" repeatCount="indefinite" />
                            <animate attributeName="opacity" values="0.8;0.2;0.8" dur="2s" repeatCount="indefinite" />
                          </circle>
                          {/* Diamond Pin */}
                          <rect x="-4.5" y="-4.5" width="9" height="9" fill={m.badgeColor} transform="rotate(45)" stroke="#060B13" strokeWidth="1.5" />

                          {/* Milestone Label Badge */}
                          <g transform="translate(0, -14)">
                            <rect
                              x="-22"
                              y="-8"
                              width="44"
                              height="14"
                              rx="3"
                              fill="#060B13"
                              stroke={m.badgeColor}
                              strokeWidth="1"
                              opacity="0.9"
                            />
                            <text
                              x="0"
                              y="2.5"
                              fill={m.badgeColor}
                              fontSize="8"
                              fontWeight="bold"
                              fontFamily="monospace"
                              textAnchor="middle"
                            >
                              {m.shortLabel}
                            </text>
                          </g>
                        </g>
                      );
                    })}

                    {/* ══════════════ Spacecraft 2D Representation ══════════════ */}
                    {currentState && (
                      <g transform={`translate(${rocketSvg.x}, ${rocketSvg.y}) rotate(${currentState.angleDeg || 0})`}>
                        {/* Locator pulse ring */}
                        <circle r="14" fill="none" stroke="#38BDF8" strokeWidth="1.5" strokeDasharray="3 3" opacity="0.85">
                          <animate attributeName="r" values="9;18;9" dur="1.8s" repeatCount="indefinite" />
                          <animate attributeName="opacity" values="0.95;0.25;0.95" dur="1.8s" repeatCount="indefinite" />
                        </circle>
                        {/* Thruster Flame during burns */}
                        {(currentState.phase === 'tli' || currentState.phase === 'loi') && (
                          <polygon points="-12,-3 -28,0 -12,3 -16,0" fill="#F59E0B" />
                        )}
                        {/* Solar Arrays */}
                        <rect x="-4" y="-15" width="4" height="9" fill="#0284C7" stroke="#38BDF8" strokeWidth="0.8" rx="0.5" />
                        <rect x="-4" y="6" width="4" height="9" fill="#0284C7" stroke="#38BDF8" strokeWidth="0.8" rx="0.5" />
                        {/* Main Spacecraft Fuselage */}
                        <path d="M 16 0 L -8 -7 L -4 0 L -8 7 Z" fill="#FFFFFF" stroke="#0284C7" strokeWidth="1.5" />
                      </g>
                    )}

                    {/* ══════════════ Interactive Milestone Hover Card Overlay ══════════════ */}
                    {hoveredMilestone && (
                      <g
                        transform={`translate(${Math.max(120, Math.min(800, hoveredMilestone.svgX))}, ${
                          hoveredMilestone.svgY > 220 ? hoveredMilestone.svgY - 95 : hoveredMilestone.svgY + 25
                        })`}
                      >
                        <rect
                          x="-110"
                          y="-10"
                          width="220"
                          height="78"
                          rx="8"
                          fill="#060B13"
                          stroke={hoveredMilestone.badgeColor}
                          strokeWidth="1.5"
                          opacity="0.96"
                        />
                        <text x="-98" y="10" fill={hoveredMilestone.badgeColor} fontSize="10" fontWeight="bold" fontFamily="monospace">
                          {hoveredMilestone.label}
                        </text>
                        <text x="-98" y="26" fill="#F8FAFC" fontSize="9" fontFamily="monospace">
                          MET: T+{formatTransitTime(hoveredMilestone.t ?? 0)} &middot; {(hoveredMilestone.velocityKmS ?? 1.0).toFixed(2)} km/s
                        </text>
                        <text x="-98" y="40" fill="#94A3B8" fontSize="8" fontFamily="monospace">
                          Earth: {Math.round(hoveredMilestone.distEarthKm).toLocaleString()} km | Moon: {Math.round(hoveredMilestone.distMoonKm).toLocaleString()} km
                        </text>
                        <text x="-98" y="55" fill="#38BDF8" fontSize="7.5" fontFamily="monospace">
                          Click to seek simulation here
                        </text>
                      </g>
                    )}
                  </svg>
                </div>

                {/* 2D Interactive Milestone Click-Seek Strip */}
                {projection2d.milestones?.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-[#142338] flex flex-wrap items-center justify-between gap-1.5 z-10 text-[10px] font-mono">
                    <span className="text-[#64748B] flex items-center gap-1">
                      <Sparkles className="w-3 h-3 text-[#A78BFA]" />
                      <span>Milestones:</span>
                    </span>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {projection2d.milestones.map((m) => {
                        const tRatio = m.t / (orbitPlan.transfer.transitTimeS || 1);
                        const isActive = Math.abs(simProgress - tRatio) < 0.04;
                        return (
                          <button
                            key={m.id}
                            type="button"
                            onClick={() => {
                              setIsPlaying(false);
                              setSimProgress(Math.max(0, Math.min(1, tRatio)));
                            }}
                            className={`px-2 py-0.5 rounded-lg border transition-all flex items-center gap-1 ${
                              isActive
                                ? 'bg-white/20 text-white font-bold border-white'
                                : 'bg-[#0d1624] text-[#94A3B8] border-[#1b2d45] hover:text-white hover:border-[#38BDF8]'
                            }`}
                            title={`Jump to ${m.label} (T+${formatTransitTime(m.t)})`}
                          >
                            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: m.badgeColor }} />
                            <span>{m.shortLabel}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Floating Real-Time Flight Telemetry HUD Overlay */}
            {currentState && (
              <div className="mt-2.5 bg-[#060B13]/90 backdrop-blur-md border border-[#1b2d45] rounded-xl px-3 py-2 text-[11px] font-mono text-[#F8FAFC] shadow-xl flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-[#38BDF8]" />
                  <span className="text-[#94A3B8]">Mission MET:</span>
                  <span className="font-bold text-white">T+{formatTransitTime(currentState.t)}</span>
                </div>

                <div className="flex items-center gap-1.5">
                  <Gauge className="w-3.5 h-3.5 text-[#22D3EE]" />
                  <span className="text-[#94A3B8]">Velocity:</span>
                  <span className="font-bold text-[#22D3EE]">{(currentState.velocityKmS ?? 1.0).toFixed(2)} km/s</span>
                </div>

                <div className="flex items-center gap-1.5">
                  <Navigation className="w-3.5 h-3.5 text-[#A78BFA]" />
                  <span className="text-[#94A3B8]">From Earth:</span>
                  <span className="font-bold text-white">{Math.round(currentState.distEarthKm).toLocaleString()} km</span>
                </div>

                <div className="flex items-center gap-1.5">
                  <Moon className="w-3.5 h-3.5 text-[#00D2C4]" />
                  <span className="text-[#94A3B8]">To Moon:</span>
                  <span className="font-bold text-[#00D2C4]">{Math.round(currentState.distMoonKm).toLocaleString()} km</span>
                </div>
              </div>
            )}

            {/* Scrubber Timeline Bar */}
            <div className="mt-2.5 flex items-center gap-3 text-xs font-mono">
              <span className="text-[#94A3B8] text-[10px]">T+0 (LEO)</span>
              <input
                type="range"
                min="0"
                max="1"
                step="0.002"
                value={simProgress}
                onChange={(e) => {
                  setIsPlaying(false);
                  setSimProgress(parseFloat(e.target.value));
                }}
                className="flex-1 accent-[#A78BFA] h-1.5 bg-[#16283C] rounded-lg appearance-none cursor-pointer"
              />
              <span className="text-[#94A3B8] text-[10px]">
                {orbitPlan.transfer.transitLabel || formatTransitTime(orbitPlan.transfer.transitTimeS)}
              </span>
            </div>
          </div>

          {/* ── Select Vehicle & NASA JPL Horizons Strip (Bottom of Simulation, Ahead of Info) ── */}
          <div className="bg-[#0d1624] border border-[#1b2d45] rounded-2xl p-3 flex flex-wrap items-center justify-between gap-3 text-xs">
            {/* Rocket Launcher Selector */}
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="font-mono text-[#F59E0B] flex items-center gap-1.5 font-semibold uppercase text-[11px]">
                <Rocket className="w-3.5 h-3.5" />
                <span>Select Vehicle:</span>
              </span>
              <div className="flex items-center gap-1.5 flex-wrap">
                {LUNAR_ROCKETS.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => setSelectedRocketId(r.id)}
                    className={`text-[11px] font-mono px-2.5 py-1 rounded-lg border transition-all ${
                      selectedRocketId === r.id
                        ? 'bg-[#F59E0B]/20 border-[#F59E0B] text-white font-medium shadow-[0_0_8px_rgba(245,158,11,0.3)] ring-1 ring-[#F59E0B]/40'
                        : 'bg-[#152336]/60 border-[#223854] text-[#94A3B8] hover:text-white hover:border-[#38BDF8]'
                    }`}
                  >
                    {r.name}
                  </button>
                ))}
              </div>
            </div>

            {/* NASA JPL Horizons Ephemeris API Status */}
            <div className="flex items-center gap-2 font-mono text-[11px]">
              <div className="flex items-center gap-1.5 bg-[#152336] px-2.5 py-1 rounded-lg border border-[#223854]">
                <Radio className={`w-3.5 h-3.5 ${jplEphemeris?.isLive ? 'text-emerald-400 animate-pulse' : 'text-cyan-400'}`} />
                <span className="text-[#94A3B8]">API:</span>
                <span className="text-white font-semibold">
                  {jplEphemeris?.isLive ? 'NASA JPL Horizons' : 'IAU Ephemeris'}
                </span>
                {jplEphemeris && (
                  <span className="text-[#38BDF8]">
                    ({Math.round(jplEphemeris.rangeKm || 384400).toLocaleString()} km &middot; {(jplEphemeris.lightTimeSec ?? (jplEphemeris.rangeKm / 299792.458))?.toFixed(2) ?? '1.28'}s LT)
                  </span>
                )}
              </div>

              <button
                type="button"
                onClick={loadJplData}
                disabled={isLoadingJpl}
                className="p-1 px-2 rounded-lg bg-[#152336] hover:bg-[#223854] text-[#94A3B8] hover:text-white transition-colors"
                title="Refresh Live NASA JPL Horizons Ephemeris"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoadingJpl ? 'animate-spin text-cyan-400' : ''}`} />
              </button>
            </div>
          </div>

          {/* ── Flight Telemetry & Delta-V Budget Deck ─────────────────────────── */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3.5">
            {/* 1. Transit Duration */}
            <div className="bg-[#0d1624] border border-[#1b2d45] rounded-2xl p-3.5 flex flex-col justify-between">
              <div className="flex items-center justify-between text-xs font-mono text-[#94A3B8]">
                <span>Estimated Transit Time</span>
                <Clock className="w-4 h-4 text-[#38BDF8]" />
              </div>
              <div className="mt-2 text-2xl font-bold font-serif text-white tracking-wide">
                {orbitPlan.transfer?.transitLabel || formatTransitTime(orbitPlan.transfer?.transitTimeS ?? 0)}
              </div>
              <div className="mt-1 text-[11px] font-mono text-[#38BDF8]">
                {(orbitPlan.transfer?.transitDays ?? 5.0).toFixed(1)} Days &middot; {orbitPlan.profile?.name ?? 'Direct'}
              </div>
            </div>

            {/* 2. Total Delta-V Budget */}
            <div className="bg-[#0d1624] border border-[#1b2d45] rounded-2xl p-3.5 flex flex-col justify-between">
              <div className="flex items-center justify-between text-xs font-mono text-[#94A3B8]">
                <span>Total Mission &Delta;V</span>
                <Fuel className="w-4 h-4 text-[#F59E0B]" />
              </div>
              <div className="mt-2 text-2xl font-bold font-mono text-white tracking-wide">
                {((orbitPlan.totalDeltaVKmS ?? 4.0) * 1000).toLocaleString('en-US', { maximumFractionDigits: 0 })}{' '}
                <span className="text-sm font-normal text-[#94A3B8]">m/s</span>
              </div>
              <div className="mt-1 text-[11px] font-mono text-[#FBBF24]">
                {(orbitPlan.totalDeltaVKmS ?? 4.0).toFixed(2)} km/s from LEO to touchdown
              </div>
            </div>

            {/* 3. Rocket Payload to TLI */}
            <div className="bg-[#0d1624] border border-[#1b2d45] rounded-2xl p-3.5 flex flex-col justify-between">
              <div className="flex items-center justify-between text-xs font-mono text-[#94A3B8]">
                <span>TLI Payload Capacity</span>
                <Rocket className="w-4 h-4 text-[#EF4444]" />
              </div>
              <div className="mt-2 text-2xl font-bold font-mono text-white tracking-wide">
                {(selectedRocket?.tliPayloadKg ?? 27000).toLocaleString()}{' '}
                <span className="text-sm font-normal text-[#94A3B8]">kg</span>
              </div>
              <div className="mt-1 text-[11px] font-mono text-[#94A3B8]">
                {selectedRocket?.name ?? 'Rocket'} &middot; {((selectedRocket?.liftoffThrustKn ?? 39000) / 1000).toFixed(1)} MN Thrust
              </div>
            </div>

            {/* 4. Lunar Insertion & Descent */}
            <div className="bg-[#0d1624] border border-[#1b2d45] rounded-2xl p-3.5 flex flex-col justify-between">
              <div className="flex items-center justify-between text-xs font-mono text-[#94A3B8]">
                <span>Lunar Capture &amp; Descent</span>
                <ShieldCheck className="w-4 h-4 text-[#00D2C4]" />
              </div>
              <div className="mt-2 text-2xl font-bold font-mono text-white tracking-wide">
                {(((orbitPlan.lunarArrival?.orbitInsertionDvKmS ?? 0) + (orbitPlan.descentDvKmS ?? 0)) * 1000).toFixed(0)}{' '}
                <span className="text-sm font-normal text-[#94A3B8]">m/s &Delta;V</span>
              </div>
              <div className="mt-1 text-[11px] font-mono text-[#00D2C4]">
                LOI: {((orbitPlan.lunarArrival?.orbitInsertionDvKmS ?? 0) * 1000).toFixed(0)} m/s &middot; Descent: {((orbitPlan.descentDvKmS ?? 0) * 1000).toFixed(0)} m/s
              </div>
            </div>
          </div>

          {/* ── Flight Phase Milestones Timeline ──────────────────────────────── */}
          <div className="bg-[#0d1624] border border-[#1b2d45] rounded-2xl p-3.5">
            <h3 className="text-xs font-semibold text-white uppercase tracking-wider mb-2.5 flex items-center gap-2">
              <Compass className="w-4 h-4 text-[#A78BFA]" />
              <span>Mission Flight Profile &amp; Burn Sequence</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-5 gap-2.5">
              <div className="bg-[#152336]/60 border border-[#223854] rounded-xl p-2.5">
                <div className="text-[10px] font-mono text-[#38BDF8] font-bold">PHASE 1 &middot; LIFTOFF</div>
                <div className="text-xs font-semibold text-white mt-0.5">{launchSite.name}</div>
                <div className="text-[10px] font-mono text-[#94A3B8] mt-1 leading-tight">
                  Launch &amp; ascent via {selectedRocket?.name ?? 'Rocket'} into {orbitPlan.parkingOrbit?.altKm ?? 185} km LEO orbit (v = {(orbitPlan.parkingOrbit?.velocityKmS ?? 7.79).toFixed(2)} km/s).
                </div>
              </div>

              <div className="bg-[#152336]/60 border border-[#223854] rounded-xl p-2.5">
                <div className="text-[10px] font-mono text-[#F59E0B] font-bold">PHASE 2 &middot; TLI BURN</div>
                <div className="text-xs font-semibold text-white mt-0.5">Trans-Lunar Injection</div>
                <div className="text-[10px] font-mono text-[#94A3B8] mt-1 leading-tight">
                  Upper stage prograde burn of +{((orbitPlan.tli?.deltaVKmS ?? 3.15) * 1000).toFixed(0)} m/s into transfer ellipse (e = {(orbitPlan.transfer?.eccentricity ?? 0.966).toFixed(3)}).
                </div>
              </div>

              <div className="bg-[#152336]/60 border border-[#223854] rounded-xl p-2.5">
                <div className="text-[10px] font-mono text-[#34D399] font-bold">PHASE 3 &middot; TRANSLUNAR COAST</div>
                <div className="text-xs font-semibold text-white mt-0.5">Cislunar Transit</div>
                <div className="text-[11px] font-mono text-[#94A3B8] mt-1 leading-tight">
                  {orbitPlan.transfer?.transitLabel || formatTransitTime(orbitPlan.transfer?.transitTimeS ?? 0)} coast with PTC roll and mid-course correction (MCC) burns.
                </div>
              </div>

              <div className="bg-[#152336]/60 border border-[#223854] rounded-xl p-2.5">
                <div className="text-[10px] font-mono text-[#EC4899] font-bold">PHASE 4 &middot; LUNAR CAPTURE</div>
                <div className="text-xs font-semibold text-white mt-0.5">Lunar Orbit Insertion</div>
                <div className="text-[10px] font-mono text-[#94A3B8] mt-1 leading-tight">
                  LOI retro-burn of -{((orbitPlan.lunarArrival?.orbitInsertionDvKmS ?? 0) * 1000).toFixed(0)} m/s into {orbitPlan.lunarArrival?.orbitAltKm ?? 100} km polar/equatorial orbit.
                </div>
              </div>

              <div className="bg-[#152336]/60 border border-[#223854] rounded-xl p-2.5">
                <div className="text-[10px] font-mono text-[#00D2C4] font-bold">PHASE 5 &middot; TOUCHDOWN</div>
                <div className="text-xs font-semibold text-white mt-0.5">{moonTarget?.name ?? 'Moon'}</div>
                <div className="text-[10px] font-mono text-[#94A3B8] mt-1 leading-tight">
                  Deorbit burn and terminal powered descent of ~{((orbitPlan.descentDvKmS ?? 0) * 1000).toFixed(0)} m/s to surface touchdown.
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Modal Footer ────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-3 border-t border-[#16283C] bg-[#060B13]/95 flex-shrink-0 text-xs font-mono text-[#94A3B8]">
          <div className="flex items-center gap-2">
            <span>NASA JPL Horizons &middot; DE440/441</span>
            <span>&middot;</span>
            <span className="text-[#38BDF8]">{launchSite.name.split(' ')[0]}</span>
            <ArrowRight className="w-3.5 h-3.5 text-[#A78BFA]" />
            <span className="text-[#00D2C4]">{moonTarget.name.split(' ')[0]}</span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-[#152336] hover:bg-[#223854] text-white font-sans text-xs transition-colors"
          >
            Close Planner
          </button>
        </div>
      </div>
    </div>
  );
}
