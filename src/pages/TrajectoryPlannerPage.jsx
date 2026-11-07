/**
 * @file TrajectoryPlannerPage.jsx
 * Dedicated Workspace Page: Earth-to-Moon 3D Cislunar Transfer Orbit Planner.
 * Visualizes direct Hohmann transfers, Apollo free-return circumlunar loops, and WSB ballistic captures.
 * Integrates NASA JPL Horizons ephemerides, 3D WebGL spaceflight, and synchronized 2D barycentric projections.
 */

import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  Rocket,
  Play,
  Pause,
  RotateCcw,
  Compass,
  Globe2,
  Moon,
  Clock,
  Activity,
  Sparkles,
  Flame,
  Radio,
  RefreshCw,
  Box,
  Layers,
  Gauge,
  Fuel,
  ShieldCheck,
  Camera,
  Maximize2,
} from 'lucide-react';
import {
  computeTransferOrbit,
  formatTransitTime,
  getInterpolatedStateAtFrac,
  TRAJECTORY_PROFILES,
} from '../utils/transferOrbit.js';
import { fetchJplMoonEphemeris, LUNAR_ROCKETS } from '../utils/jplHorizons.js';
import TransferOrbit3DViewport from '../components/trajectory/TransferOrbit3DViewport.jsx';

export default function TrajectoryPlannerPage({ onNavigate }) {
  // ── Selection State ────────────────────────────────────────────────────────
  const [profileId, setProfileId] = useState('direct');
  const [selectedRocketId, setSelectedRocketId] = useState('sls-block1');
  const [viewDimension, setViewDimension] = useState('3d'); // '3d' | '2d'
  const [hoveredMilestone, setHoveredMilestone] = useState(null);
  const [parkingAltKm, setParkingAltKm] = useState(185);
  const [lunarOrbitAltKm, setLunarOrbitAltKm] = useState(100);

  // ── Camera Focus State ───────────────────────────────────────────────────
  const [cameraMode, setCameraMode] = useState('overview'); // 'overview' | 'chase' | 'earth' | 'moon'
  const [cameraFocusSeq, setCameraFocusSeq] = useState(0);

  const handleSetCameraMode = (mode) => {
    setCameraMode(mode);
    setCameraFocusSeq((prev) => prev + 1);
  };

  // ── NASA JPL Horizons Live Ephemeris State ─────────────────────────────────
  const [jplEphemeris, setJplEphemeris] = useState(null);
  const [isLoadingJpl, setIsLoadingJpl] = useState(false);

  // ── Playback & Simulation State (Opens PAUSED by default) ──────────────────
  const [simProgress, setSimProgress] = useState(0.0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [simSpeed, setSimSpeed] = useState(1); // 1x, 3x, 8x
  const animFrameRef = useRef(null);
  const lastTimeRef = useRef(performance.now());

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
    loadJplData();
    setIsPlaying(false);
    setSimProgress(0.0);
  }, []);

  const selectedRocket = useMemo(() => {
    return LUNAR_ROCKETS.find((r) => r.id === selectedRocketId) || LUNAR_ROCKETS[0];
  }, [selectedRocketId]);

  // ── Physics Trajectory Computation ─────────────────────────────────────────
  const orbitPlan = useMemo(() => {
    let moon3dPos = null;
    if (jplEphemeris && jplEphemeris.rangeKm) {
      const scaleDist = 75.0 * (jplEphemeris.rangeKm / 384400);
      const yMoon = scaleDist * (jplEphemeris.zKm / jplEphemeris.rangeKm);
      const zMoon = scaleDist * (jplEphemeris.yKm / jplEphemeris.rangeKm) * 0.2;
      const xMoon = Math.sqrt(Math.max(10, scaleDist * scaleDist - yMoon * yMoon - zMoon * zMoon));
      moon3dPos = { x: xMoon, y: yMoon, z: zMoon };
    }

    return computeTransferOrbit({
      profileId,
      parkingAltKm,
      lunarOrbitAltKm,
      moon3dPos,
    });
  }, [profileId, parkingAltKm, lunarOrbitAltKm, jplEphemeris]);

  // ── Animation Loop ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isPlaying) return;

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
  }, [isPlaying, simSpeed]);

  // Current interpolated state of the rocket
  const currentState = useMemo(() => {
    return getInterpolatedStateAtFrac(orbitPlan.waypoints, simProgress);
  }, [orbitPlan.waypoints, simProgress]);

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
    <div className="flex-1 w-full h-full overflow-y-auto custom-scrollbar px-2 sm:px-4 lg:px-6 py-2.5 pb-8 space-y-3 bg-[#050507] text-[#F8FAFC] scroll-smooth">
      {/* ── Main Workspace: Display on Left, Unified Controls on Right ─────── */}
      <div className="flex flex-col lg:flex-row gap-3 items-stretch h-auto lg:h-[calc(100vh-4.75rem)] lg:min-h-[500px]">

        {/* Left: 3D / 2D Visualizer Display (Auto-readjusts to fit display height) */}
        <div className="flex-1 lg:w-[62%] xl:w-[65%] min-w-0 flex flex-col bg-[#050507] border border-[#1E2028] rounded-2xl p-2.5 sm:p-3 overflow-hidden shadow-2xl">
          {/* Visualizer Status Bar */}
          <div className="flex items-center justify-between gap-3 mb-2 pb-2 border-b border-[#1E2028]/80 flex-shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              <Activity className="w-3.5 h-3.5 text-[#F8FAFC] flex-shrink-0" />
              <span className="text-xs font-mono font-medium text-white truncate">
                {viewDimension === '3d' ? '3D Cislunar Orbital Flight Simulation' : '2D Translunar Transfer Diagram'}
              </span>
            </div>
            <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full ${phaseInfo.bg} ${phaseInfo.color} border border-current/20 flex items-center gap-1 flex-shrink-0`}>
              {phaseInfo.isThrusting && <Flame className="w-3 h-3 animate-bounce" />}
              <span>{phaseInfo.label}</span>
            </span>
          </div>

          {/* Canvas Display Viewport */}
          <div className="relative flex-1 min-h-0 w-full rounded-xl overflow-hidden flex flex-col">
            {viewDimension === '3d' ? (
              <TransferOrbit3DViewport
                orbitPlan={orbitPlan}
                simProgress={simProgress}
                jplEphemeris={jplEphemeris}
                cameraMode={cameraMode}
                cameraFocusSeq={cameraFocusSeq}
                onCameraModeChange={setCameraMode}
                hideEmbeddedControls={true}
              />
            ) : (
              <div className="relative w-full h-full min-h-0 bg-gradient-to-b from-[#050507] via-[#050507] to-[#050507] rounded-xl overflow-hidden border border-[#1E2028] p-3 flex flex-col justify-between">
                {projection2d && (
                  <>
                    {/* 2D Projection Header & Mode Badge */}
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-1 z-10 flex-shrink-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-[#38BDF8]/15 text-[#38BDF8] border border-[#38BDF8]/30 font-semibold">
                          {projection2d.frameType === 'sun-earth-wsb'
                            ? 'Sun-Earth Synodic Frame · WSB (L1/L2)'
                            : 'Earth-Moon Rotating (Synodic) Frame'}
                        </span>
                        <span className="text-[10px] font-mono text-[#64748B] hidden sm:inline">
                          {projection2d.subtitle}
                        </span>
                      </div>

                      {/* Phase Legend */}
                      <div className="flex items-center gap-3 text-[10px] font-mono">
                        <div className="flex items-center gap-1 text-[#38BDF8]">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#38BDF8]" />
                          <span>Outbound</span>
                        </div>
                        <div className="flex items-center gap-1 text-[#A78BFA]">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#A78BFA]" />
                          <span>{projection2d.frameType === 'sun-earth-wsb' ? 'Turnaround' : 'Encounter'}</span>
                        </div>
                        <div className="flex items-center gap-1 text-[#F43F5E]">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#F43F5E]" />
                          <span>{profileId === 'free-return' ? 'Return' : profileId === 'low-energy' ? 'Capture' : 'LOI'}</span>
                        </div>
                      </div>
                    </div>

                    {/* SVG Diagram Canvas */}
                    <div className="relative flex-1 w-full min-h-0">
                      <svg viewBox={projection2d.viewBox || "0 0 920 400"} className="w-full h-full select-none overflow-visible">
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
                        </defs>

                        {/* Coordinate axes */}
                        <line x1="40" y1="200" x2="880" y2="200" stroke="#16283C" strokeWidth="1" strokeDasharray="3 4" strokeOpacity="0.7" />
                        <line x1="460" y1="40" x2="460" y2="360" stroke="#16283C" strokeWidth="1" strokeDasharray="3 4" strokeOpacity="0.4" />

                        {projection2d.frameType === 'sun-earth-wsb' ? (
                          <>
                            {/* Complete Moon 27.3-Day Orbit Ellipse */}
                            {projection2d.moonOrbit && (
                              <ellipse
                                cx={projection2d.moonOrbit.cx}
                                cy={projection2d.moonOrbit.cy}
                                rx={projection2d.moonOrbit.rx}
                                ry={projection2d.moonOrbit.ry}
                                fill="none"
                                stroke="#00D2C4"
                                strokeWidth="1.2"
                                strokeDasharray="4 4"
                                strokeOpacity="0.35"
                              />
                            )}

                            {/* Sun-Earth L1 Saddle Point */}
                            {projection2d.lagrangeL1 && (
                              <g transform={`translate(${projection2d.lagrangeL1.x}, ${projection2d.lagrangeL1.y})`}>
                                <rect x="-5" y="-5" width="10" height="10" fill="none" stroke="#FBBF24" strokeWidth="1.5" transform="rotate(45)" />
                                <text x="0" y="-10" fill="#FBBF24" fontSize="8" fontWeight="bold" fontFamily="monospace" textAnchor="middle">L1</text>
                              </g>
                            )}

                            {/* Sun-Earth L2 / WSB Apex Saddle Point */}
                            {projection2d.lagrangeL2 && (
                              <g transform={`translate(${projection2d.lagrangeL2.x}, ${projection2d.lagrangeL2.y})`}>
                                <rect x="-6" y="-6" width="12" height="12" fill="none" stroke="#A855F7" strokeWidth="1.5" transform="rotate(45)" />
                                <text x="0" y="-12" fill="#A855F7" fontSize="8" fontWeight="bold" fontFamily="monospace" textAnchor="middle">L2 / WSB</text>
                              </g>
                            )}

                            {/* Segmented WSB Paths */}
                            {projection2d.paths?.outbound && (
                              <path d={projection2d.paths.outbound} fill="none" stroke="#38BDF8" strokeWidth="2.5" strokeLinecap="round" />
                            )}
                            {projection2d.paths?.turnaround && (
                              <path d={projection2d.paths.turnaround} fill="none" stroke="#FBBF24" strokeWidth="2.5" strokeLinecap="round" />
                            )}
                            {projection2d.paths?.capture && (
                              <path d={projection2d.paths.capture} fill="none" stroke="#10B981" strokeWidth="2.5" strokeLinecap="round" />
                            )}

                            {/* Moon Target */}
                            {projection2d.moon && (
                              <g transform={`translate(${projection2d.moon.x}, ${projection2d.moon.y})`}>
                                <circle r={projection2d.moon.radius || 12} fill="url(#moonGlow2d)" />
                                <text x="0" y="24" fill="#00D2C4" fontSize="9" fontWeight="bold" fontFamily="monospace" textAnchor="middle">Moon</text>
                              </g>
                            )}

                            {/* Earth Body */}
                            {projection2d.earth && (
                              <g transform={`translate(${projection2d.earth.x}, ${projection2d.earth.y})`}>
                                <circle r={projection2d.earth.radius || 18} fill="url(#earthGlow2d)" />
                                <text x="0" y="30" fill="#93C5FD" fontSize="9" fontWeight="bold" fontFamily="monospace" textAnchor="middle">Earth</text>
                              </g>
                            )}
                          </>
                        ) : (
                          <>
                            {/* Lunar SOI Halo */}
                            {projection2d.moon?.soiRadius && (
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
                            )}

                            {/* Earth LEO Parking Orbit Ring */}
                            {projection2d.earth?.parkingRadius && (
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
                            )}

                            {/* Trajectory Paths */}
                            {projection2d.paths?.outbound && (
                              <path d={projection2d.paths.outbound} fill="none" stroke="#38BDF8" strokeWidth="2.8" strokeLinecap="round" />
                            )}
                            {projection2d.paths?.encounter && (
                              <path d={projection2d.paths.encounter} fill="none" stroke={profileId === 'free-return' ? '#A78BFA' : '#F59E0B'} strokeWidth="3" strokeLinecap="round" />
                            )}
                            {projection2d.paths?.return && (
                              <path d={projection2d.paths.return} fill="none" stroke={profileId === 'free-return' ? '#F43F5E' : '#10B981'} strokeWidth="2.8" strokeLinecap="round" />
                            )}
                            {!projection2d.paths?.outbound && projection2d.pathD && (
                              <path d={projection2d.pathD} fill="none" stroke="#38BDF8" strokeWidth="2.5" strokeLinecap="round" />
                            )}

                            {/* Earth Body */}
                            {projection2d.earth && (
                              <g transform={`translate(${projection2d.earth.x}, ${projection2d.earth.y})`}>
                                <circle r={projection2d.earth.radius || 20} fill="url(#earthGlow2d)" />
                                <text x="0" y="32" fill="#93C5FD" fontSize="10" fontWeight="bold" fontFamily="monospace" textAnchor="middle">Earth</text>
                              </g>
                            )}

                            {/* Moon Body */}
                            {projection2d.moon && (
                              <g transform={`translate(${projection2d.moon.x}, ${projection2d.moon.y})`}>
                                <circle r={projection2d.moon.radius || 14} fill="url(#moonGlow2d)" />
                                <text x="0" y="26" fill="#00D2C4" fontSize="10" fontWeight="bold" fontFamily="monospace" textAnchor="middle">Moon</text>
                              </g>
                            )}
                          </>
                        )}

                        {/* Milestone Pins */}
                        {projection2d.milestones?.map((m) => {
                          const isHovered = hoveredMilestone?.id === m.id;
                          return (
                            <g
                              key={m.id}
                              transform={`translate(${m.svgX}, ${m.svgY})`}
                              className="cursor-pointer"
                              onMouseEnter={() => setHoveredMilestone(m)}
                              onMouseLeave={() => setHoveredMilestone(null)}
                            >
                              <circle r={isHovered ? 6 : 4} fill={m.badgeColor || '#38BDF8'} stroke="#ffffff" strokeWidth="1.5" />
                              <text x="0" y="-8" fill={m.badgeColor || '#38BDF8'} fontSize="8" fontFamily="monospace" textAnchor="middle" fontWeight="bold">
                                {m.shortLabel || m.label}
                              </text>
                            </g>
                          );
                        })}

                        {/* Animated Rocket Position Marker */}
                        {rocketSvg && (
                          <g transform={`translate(${rocketSvg.x}, ${rocketSvg.y})`}>
                            <circle r="5" fill="#f59e0b" stroke="#ffffff" strokeWidth="2" />
                            <circle r="12" fill="none" stroke="#f59e0b" strokeWidth="1.2" opacity="0.6">
                              <animate attributeName="r" values="8;16;8" dur="1.8s" repeatCount="indefinite" />
                              <animate attributeName="opacity" values="0.8;0.1;0.8" dur="1.8s" repeatCount="indefinite" />
                            </circle>
                          </g>
                        )}
                      </svg>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right: Unified Single Flexbox for Controls (Auto-readjusted & Aligned) */}
        <div className="lg:w-[38%] xl:w-[35%] flex flex-col justify-between gap-2.5 bg-[#0C0D12] border border-[#1E2028] rounded-2xl p-3.5 sm:p-4 shadow-2xl overflow-y-auto min-h-0">
          <div className="space-y-3">
            {/* 1. 2D / 3D Dimension Toggle */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] font-sans uppercase text-[#8E95A5] font-semibold tracking-[0.08em] flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-[#F8FAFC]" />
                  <span>View Dimension</span>
                </span>
                <span className="text-[11px] font-mono text-[#E2E8F0]">
                  {viewDimension === '3d' ? '3D WebGL' : '2D Plane'}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-1.5 bg-[#050507] p-1 rounded-xl border border-[#1E2028]">
                <button
                  type="button"
                  onClick={() => setViewDimension('3d')}
                  className={`py-1.5 px-2.5 rounded-lg text-xs font-sans flex items-center justify-center gap-1.5 transition-all ${
                    viewDimension === '3d'
                      ? 'bg-white text-[#050507] font-semibold shadow-sm'
                      : 'text-[#8E95A5] font-medium hover:text-white hover:bg-[#14161D]'
                  }`}
                  title="Switch to Interactive 3D Cislunar Space"
                >
                  <Box className="w-3.5 h-3.5" />
                  <span>3D Space</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewDimension('2d')}
                  className={`py-1.5 px-2.5 rounded-lg text-xs font-sans flex items-center justify-center gap-1.5 transition-all ${
                    viewDimension === '2d'
                      ? 'bg-white text-[#050507] font-semibold shadow-sm'
                      : 'text-[#8E95A5] font-medium hover:text-white hover:bg-[#14161D]'
                  }`}
                  title="Switch to 2D Mission Flight Diagram"
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>2D Diagram</span>
                </button>
              </div>
            </div>

            {/* Launch Vehicle Selector */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] font-sans uppercase text-[#8E95A5] font-semibold tracking-[0.08em] flex items-center gap-1.5">
                  <Rocket className="w-3.5 h-3.5 text-[#F8FAFC]" />
                  <span>Launch Vehicle</span>
                </span>
                <span className="text-[11px] font-mono tabular-nums text-[#38BDF8]">
                  {selectedRocket?.tliPayloadKg ? `${(selectedRocket.tliPayloadKg / 1000).toFixed(0)}t to TLI` : ''}
                </span>
              </div>
              <select
                value={selectedRocketId}
                onChange={(e) => setSelectedRocketId(e.target.value)}
                className="w-full bg-[#050507] border border-[#1E2028] text-white text-xs rounded-xl px-2.5 py-2 font-sans focus:outline-none focus:border-white/40 transition-colors cursor-pointer"
              >
                {LUNAR_ROCKETS.map((r) => (
                  <option key={r.id} value={r.id} className="bg-[#0C0D12] text-white">
                    {r.name} ({r.agency}) &middot; {(r.tliPayloadKg / 1000).toFixed(0)}t TLI
                  </option>
                ))}
              </select>
              {selectedRocket && (
                <div className="mt-1 text-[11px] font-sans text-[#8E95A5] flex items-center justify-between px-1">
                  <span>{selectedRocket.family} &middot; {selectedRocket.stages} stages</span>
                  <span className="font-mono text-[#CBD5E1]">{((selectedRocket.liftoffThrustKn || 0) / 1000).toFixed(1)} MN thrust</span>
                </div>
              )}
            </div>

            {/* 2. Trajectory Profile Selection (Path Selection) */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] font-sans uppercase text-[#8E95A5] font-semibold tracking-[0.08em] flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-[#F8FAFC]" />
                  <span>Path Selection</span>
                </span>
                <span className="text-[11px] font-mono tabular-nums text-[#E2E8F0]">
                  {orbitPlan.transfer?.transitLabel || ''}
                </span>
              </div>

              <div className="flex flex-col gap-1.5">
                {TRAJECTORY_PROFILES.map((p) => {
                  const isSelected = profileId === p.id;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setProfileId(p.id)}
                      className={`p-2.5 rounded-xl border text-left flex items-center justify-between transition-all ${
                        isSelected
                          ? 'bg-[#14161D] border-white/40 text-white shadow-sm'
                          : 'bg-[#050507] border-[#1E2028] text-[#8E95A5] hover:text-white hover:bg-[#14161D]/60'
                      }`}
                    >
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-sans font-semibold text-xs text-white leading-tight">{p.name}</span>
                          {p.isSchematic && (
                            <span className="text-[9px] font-mono uppercase px-1.5 py-0.2 bg-amber-500/15 text-amber-400 border border-amber-500/30 rounded">
                              Bézier
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] font-sans text-[#8E95A5] mt-0.5">{p.subtitle}</div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                        <span className="text-[11px] font-mono tabular-nums text-[#E2E8F0] hidden sm:inline">
                          {p.transitNote}
                        </span>
                        {isSelected ? (
                          <div className="w-2 h-2 rounded-full bg-white" />
                        ) : (
                          <div className="w-2 h-2 rounded-full border border-[#8E95A5]/40" />
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Path description summary & Physics model disclosure */}
              <div className="mt-2 text-[11.5px] font-sans text-[#CBD5E1] bg-[#050507] border border-[#1E2028] rounded-lg p-2.5 leading-relaxed space-y-1.5">
                <div>
                  <span className="text-white font-semibold">{orbitPlan.profile.name}: </span>
                  {orbitPlan.profile.description}
                </div>
                <div className="text-[10.5px] text-[#8E95A5] pt-1.5 border-t border-[#1E2028]/80 flex items-center justify-between">
                  <span>Model: <strong className="text-[#E2E8F0] font-mono">{orbitPlan.profile.modelType || 'Analytic Transfer'}</strong></span>
                  {orbitPlan.profile.isSchematic && (
                    <span className="text-amber-400 font-mono text-[10px]">Schematic Approximation</span>
                  )}
                </div>
              </div>
            </div>

            {/* 3. Camera Focus Controls (Earth, Moon, Follow Rocket, Full Trajectory) */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] font-sans uppercase text-[#8E95A5] font-semibold tracking-[0.08em] flex items-center gap-1.5">
                  <Camera className="w-3.5 h-3.5 text-[#F8FAFC]" />
                  <span>Camera Focus</span>
                </span>
                <span className="text-[11px] font-sans font-medium text-[#8E95A5]">
                  {viewDimension === '3d' ? '3D View' : 'Fixed 2D'}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={() => handleSetCameraMode('overview')}
                  className={`py-1.5 px-2 rounded-lg border text-xs font-sans flex items-center justify-center gap-1.5 transition-all ${
                    cameraMode === 'overview'
                      ? 'bg-white text-[#050507] border-white font-semibold shadow-sm'
                      : 'bg-[#050507] border-[#1E2028] text-[#8E95A5] font-medium hover:text-white hover:bg-[#14161D]'
                  }`}
                  title="Center entire Earth to Moon trajectory"
                >
                  <Maximize2 className="w-3.5 h-3.5" />
                  <span>Full Path</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleSetCameraMode('chase')}
                  className={`py-1.5 px-2 rounded-lg border text-xs font-sans flex items-center justify-center gap-1.5 transition-all ${
                    cameraMode === 'chase'
                      ? 'bg-white text-[#050507] border-white font-semibold shadow-sm'
                      : 'bg-[#050507] border-[#1E2028] text-[#8E95A5] font-medium hover:text-white hover:bg-[#14161D]'
                  }`}
                  title="Lock camera to follow the rocket"
                >
                  <Rocket className="w-3.5 h-3.5" />
                  <span>Rocket</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleSetCameraMode('earth')}
                  className={`py-1.5 px-2 rounded-lg border text-xs font-sans flex items-center justify-center gap-1.5 transition-all ${
                    cameraMode === 'earth'
                      ? 'bg-white text-[#050507] border-white font-semibold shadow-sm'
                      : 'bg-[#050507] border-[#1E2028] text-[#8E95A5] font-medium hover:text-white hover:bg-[#14161D]'
                  }`}
                  title="Focus on Earth departure and parking orbit"
                >
                  <Globe2 className="w-3.5 h-3.5" />
                  <span>Earth</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleSetCameraMode('moon')}
                  className={`py-1.5 px-2 rounded-lg border text-xs font-sans flex items-center justify-center gap-1.5 transition-all ${
                    cameraMode === 'moon'
                      ? 'bg-white text-[#050507] border-white font-semibold shadow-sm'
                      : 'bg-[#050507] border-[#1E2028] text-[#8E95A5] font-medium hover:text-white hover:bg-[#14161D]'
                  }`}
                  title="Focus on Moon arrival and orbit insertion"
                >
                  <Moon className="w-3.5 h-3.5" />
                  <span>Moon</span>
                </button>
              </div>
            </div>
          </div>

          {/* 4. Playback Controls (Play / Pause / Reset / Speed / Timeline Scrubber) */}
          <div className="pt-2.5 border-t border-[#1E2028] space-y-2 flex-shrink-0">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-sans uppercase text-[#8E95A5] font-semibold tracking-[0.08em] flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-[#F8FAFC]" />
                <span>Playback Controls</span>
              </span>
              <span className="text-[11px] font-sans font-medium text-[#F59E0B] truncate">
                {phaseInfo.label}
              </span>
            </div>

            {/* Main Play / Pause / Reset & Speed Controls */}
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setIsPlaying(!isPlaying)}
                className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-sans font-semibold flex items-center justify-center gap-1.5 transition-all ${
                  isPlaying
                    ? 'bg-amber-500 hover:bg-amber-400 text-[#050507]'
                    : 'bg-white hover:bg-[#E2E8F0] text-[#050507]'
                }`}
                title={isPlaying ? 'Pause Simulation' : 'Play Simulation'}
              >
                {isPlaying ? (
                  <>
                    <Pause className="w-3.5 h-3.5 fill-current" />
                    <span>PAUSE</span>
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>PLAY</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => setSimProgress(0)}
                className="p-1.5 rounded-lg bg-[#050507] hover:bg-[#14161D] text-[#8E95A5] hover:text-white border border-[#1E2028] transition-colors"
                title="Reset to LEO Liftoff"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>

              <div className="flex items-center bg-[#050507] rounded-lg p-0.5 border border-[#1E2028] text-xs font-mono tabular-nums">
                {[1, 3, 8].map((spd) => (
                  <button
                    key={spd}
                    type="button"
                    onClick={() => setSimSpeed(spd)}
                    className={`px-2 py-1 rounded text-[11px] transition-colors ${
                      simSpeed === spd ? 'bg-white text-[#050507] font-semibold' : 'text-[#8E95A5] hover:text-white'
                    }`}
                  >
                    {spd}x
                  </button>
                ))}
              </div>
            </div>

            {/* Timeline Progress Scrubber & MET Time readout */}
            <div className="bg-[#050507] border border-[#1E2028] rounded-lg p-2.5 space-y-1.5">
              <div className="flex items-center justify-between text-xs font-sans">
                <span className="flex items-center gap-1.5 text-white">
                  <Clock className="w-3.5 h-3.5 text-[#F8FAFC]" />
                  <span className="text-[#8E95A5]">MET:</span>
                  <span className="font-mono tabular-nums font-semibold text-white">
                    {currentState ? formatTransitTime(currentState.t) : '0h 0m'}
                  </span>
                </span>
                <span className="text-[#8E95A5]">
                  Progress: <strong className="font-mono tabular-nums text-white">{(simProgress * 100).toFixed(1)}%</strong>
                </span>
              </div>

              <input
                type="range"
                min="0"
                max="1"
                step="0.001"
                value={simProgress}
                onChange={(e) => setSimProgress(parseFloat(e.target.value))}
                className="w-full h-1.5 bg-[#14161D] rounded-lg appearance-none cursor-pointer accent-white"
              />
            </div>
          </div>
        </div>
      </div>

      {/* ── Flight Telemetry & Delta-V Budget Deck ─────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 snap-start scroll-mt-2.5">
        {/* 1. Transit Duration */}
        <div className="bg-[#0C0D12] border border-[#1E2028] rounded-xl p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-[11px] font-sans font-semibold uppercase tracking-[0.08em] text-[#8E95A5]">
            <span>Estimated Transit Time</span>
            <Clock className="w-4 h-4 text-[#38BDF8]" />
          </div>
          <div className="mt-2.5 text-2xl font-semibold font-mono tabular-nums text-white">
            {orbitPlan.transfer?.transitLabel || formatTransitTime(orbitPlan.transfer?.transitTimeS ?? 0)}
          </div>
          <div className="mt-1.5 text-xs font-mono tabular-nums text-[#8E95A5]">
            Epoch: Day {(orbitPlan.transfer?.transitTimeS != null ? orbitPlan.transfer.transitTimeS / 86400 : 5).toFixed(1)} &middot; e = {orbitPlan.transfer?.eccentricity?.toFixed(3) ?? '0.966'}
          </div>
        </div>

        {/* 2. TLI Delta-V */}
        <div className="bg-[#0C0D12] border border-[#1E2028] rounded-xl p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-[11px] font-sans font-semibold uppercase tracking-[0.08em] text-[#8E95A5]">
            <span>Trans-Lunar Injection (TLI)</span>
            <Flame className="w-4 h-4 text-[#F59E0B]" />
          </div>
          <div className="mt-2.5 text-2xl font-semibold font-mono tabular-nums text-[#F59E0B]">
            +{((orbitPlan.tli?.deltaVKmS ?? 3.15) * 1000).toFixed(0)} <span className="text-sm font-sans font-normal text-[#8E95A5]">m/s</span>
          </div>
          <div className="mt-1.5 text-xs font-mono tabular-nums text-[#8E95A5]">
            v_LEO: {orbitPlan.parkingOrbit?.velocityKmS?.toFixed(2) ?? '7.79'} km/s &rarr; v_TLI: {(orbitPlan.tli?.velocityPostBurnKmS ?? orbitPlan.tli?.velocityKmS ?? 10.93).toFixed(2)} km/s
          </div>
        </div>

        {/* 3. Lunar Insertion Delta-V */}
        <div className="bg-[#0C0D12] border border-[#1E2028] rounded-xl p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-[11px] font-sans font-semibold uppercase tracking-[0.08em] text-[#8E95A5]">
            <span>Lunar Orbit Insertion (LOI)</span>
            <Gauge className="w-4 h-4 text-[#F8FAFC]" />
          </div>
          <div className="mt-2.5 text-2xl font-semibold font-mono tabular-nums text-[#F8FAFC]">
            {(orbitPlan.lunarArrival?.orbitInsertionDvKmS ?? 0) > 0
              ? `-${((orbitPlan.lunarArrival?.orbitInsertionDvKmS ?? 0) * 1000).toFixed(0)} m/s`
              : '0 m/s (Flyby)'}
          </div>
          <div className="mt-1.5 text-xs font-mono tabular-nums text-[#8E95A5]">
            Approach: {orbitPlan.lunarArrival?.approachVelocityKmS?.toFixed(2) ?? '2.32'} km/s &rarr; Orbit: {orbitPlan.lunarArrival?.orbitVelocityKmS?.toFixed(2) ?? '1.63'} km/s
          </div>
        </div>

        {/* 4. Total Mission Delta-V */}
        <div className="bg-[#0C0D12] border border-[#1E2028] rounded-xl p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-[11px] font-sans font-semibold uppercase tracking-[0.08em] text-[#8E95A5]">
            <span>Total ΔV Budget</span>
            <Fuel className="w-4 h-4 text-[#EC4899]" />
          </div>
          <div className="mt-2.5 text-2xl font-semibold font-mono tabular-nums text-[#EC4899]">
            {((orbitPlan.totalDeltaVKmS ?? 4.0) * 1000).toFixed(0)} <span className="text-sm font-sans font-normal text-[#8E95A5]">m/s</span>
          </div>
          <div className="mt-1.5 text-xs font-mono tabular-nums text-[#8E95A5]">
            LOI: {((orbitPlan.lunarArrival?.orbitInsertionDvKmS ?? 0) * 1000).toFixed(0)} m/s &middot; Descent: {((orbitPlan.descentDvKmS ?? 0) * 1000).toFixed(0)} m/s
          </div>
        </div>
      </div>

      {/* ── Flight Phase Milestones Timeline ──────────────────────────────────── */}
      <div className="bg-[#0C0D12] border border-[#1E2028] rounded-xl p-5 snap-start scroll-mt-2.5">
        <h3 className="text-sm font-display font-semibold text-white mb-3.5 flex items-center gap-2">
          <Compass className="w-4 h-4 text-[#F8FAFC]" />
          <span>Mission Flight Profile &amp; Burn Sequence</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-3.5">
          <div className="bg-[#050507] border border-[#1E2028] rounded-xl p-3.5">
            <div className="text-[10.5px] font-sans font-semibold tracking-wider text-[#38BDF8] uppercase">PHASE 1 &middot; LIFTOFF</div>
            <div className="text-[13px] font-display font-semibold text-white mt-1">LEO Parking Orbit</div>
            <div className="text-xs font-sans text-[#8E95A5] mt-1.5 leading-relaxed">
              Launch via <span className="font-semibold text-white">{selectedRocket?.name || 'Payload Rocket'}</span> ({selectedRocket?.agency || 'Space Agency'}, <span className="font-mono text-[#E2E8F0]">{selectedRocket?.tliPayloadKg ? `${(selectedRocket.tliPayloadKg / 1000).toFixed(0)}t TLI` : ''}</span>) into <span className="font-mono text-[#E2E8F0]">{orbitPlan.parkingOrbit?.altKm ?? 185} km</span> LEO orbit (<span className="font-mono text-[#E2E8F0]">v = {orbitPlan.parkingOrbit?.velocityKmS?.toFixed(2) ?? '7.79'} km/s</span>).
            </div>
          </div>

          <div className="bg-[#050507] border border-[#1E2028] rounded-xl p-3.5">
            <div className="text-[10.5px] font-sans font-semibold tracking-wider text-[#F59E0B] uppercase">PHASE 2 &middot; TLI BURN</div>
            <div className="text-[13px] font-display font-semibold text-white mt-1">Trans-Lunar Injection</div>
            <div className="text-xs font-sans text-[#8E95A5] mt-1.5 leading-relaxed">
              Upper stage prograde burn of <span className="font-mono text-[#E2E8F0]">+{((orbitPlan.tli?.deltaVKmS ?? 3.15) * 1000).toFixed(0)} m/s</span> into transfer ellipse (<span className="font-mono text-[#E2E8F0]">e = {orbitPlan.transfer?.eccentricity?.toFixed(3) ?? '0.966'}</span>).
            </div>
          </div>

          <div className="bg-[#050507] border border-[#1E2028] rounded-xl p-3.5">
            <div className="text-[10.5px] font-sans font-semibold tracking-wider text-[#34D399] uppercase">PHASE 3 &middot; TRANSLUNAR COAST</div>
            <div className="text-[13px] font-display font-semibold text-white mt-1">Cislunar Transit</div>
            <div className="text-xs font-sans text-[#8E95A5] mt-1.5 leading-relaxed">
              <span className="font-mono text-[#E2E8F0]">{orbitPlan.transfer?.transitLabel || formatTransitTime(orbitPlan.transfer?.transitTimeS ?? 0)}</span> coast with PTC roll and mid-course correction (MCC) burns.
            </div>
          </div>

          <div className="bg-[#050507] border border-[#1E2028] rounded-xl p-3.5">
            <div className="text-[10.5px] font-sans font-semibold tracking-wider text-[#EC4899] uppercase">PHASE 4 &middot; LUNAR CAPTURE</div>
            <div className="text-[13px] font-display font-semibold text-white mt-1">Lunar Orbit Insertion</div>
            <div className="text-xs font-sans text-[#8E95A5] mt-1.5 leading-relaxed">
              LOI retro-burn of <span className="font-mono text-[#E2E8F0]">-{((orbitPlan.lunarArrival?.orbitInsertionDvKmS ?? 0) * 1000).toFixed(0)} m/s</span> into <span className="font-mono text-[#E2E8F0]">{orbitPlan.lunarArrival?.orbitAltKm ?? 100} km</span> polar/equatorial orbit.
            </div>
          </div>

          <div className="bg-[#050507] border border-[#1E2028] rounded-xl p-3.5">
            <div className="text-[10.5px] font-sans font-semibold tracking-wider text-[#F8FAFC] uppercase">PHASE 5 &middot; TOUCHDOWN</div>
            <div className="text-[13px] font-display font-semibold text-white mt-1">Target Landing Site</div>
            <div className="text-xs font-sans text-[#8E95A5] mt-1.5 leading-relaxed">
              Deorbit burn and terminal powered descent of <span className="font-mono text-[#E2E8F0]">~{((orbitPlan.descentDvKmS ?? 0) * 1000).toFixed(0)} m/s</span> to surface touchdown.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
