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
    <div className="flex-1 w-full h-full overflow-y-auto custom-scrollbar px-2 sm:px-4 lg:px-6 py-2.5 pb-8 space-y-3 bg-[#07090e] text-[#F8FAFC] scroll-smooth">
      {/* ── Main Workspace: Display on Left, Unified Controls on Right ─────── */}
      <div className="flex flex-col lg:flex-row gap-3 items-stretch h-auto lg:h-[calc(100vh-4.75rem)] lg:min-h-[500px]">

        {/* Left: 3D / 2D Visualizer Display (Auto-readjusts to fit display height) */}
        <div className="flex-1 lg:w-[62%] xl:w-[65%] min-w-0 flex flex-col bg-[#060B13] border border-[#16283C] rounded-2xl p-2.5 sm:p-3 overflow-hidden shadow-2xl">
          {/* Visualizer Status Bar */}
          <div className="flex items-center justify-between gap-3 mb-2 pb-2 border-b border-[#16283C]/80 flex-shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              <Activity className="w-3.5 h-3.5 text-[#22D3EE] flex-shrink-0" />
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
              <div className="relative w-full h-full min-h-0 bg-gradient-to-b from-[#03060d] via-[#050914] to-[#03060c] rounded-xl overflow-hidden border border-[#142338] p-3 flex flex-col justify-between">
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
        <div className="lg:w-[38%] xl:w-[35%] flex flex-col justify-between gap-2 bg-[#0d1624] border border-[#1b2d45] rounded-2xl p-3 sm:p-3.5 shadow-2xl overflow-y-auto min-h-0">
          <div className="space-y-2.5">
            {/* 1. 2D / 3D Dimension Toggle */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-mono uppercase text-[#94A3B8] font-semibold tracking-wider flex items-center gap-1.5">
                  <Layers className="w-3 h-3 text-[#38BDF8]" />
                  <span>View Dimension</span>
                </span>
                <span className="text-[10px] font-mono text-[#38BDF8]">
                  {viewDimension === '3d' ? '3D WebGL' : '2D Plane'}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-1.5 bg-[#152336] p-1 rounded-xl border border-[#223854]">
                <button
                  type="button"
                  onClick={() => setViewDimension('3d')}
                  className={`py-1.5 px-2.5 rounded-lg text-xs font-mono font-semibold flex items-center justify-center gap-1.5 transition-all ${
                    viewDimension === '3d'
                      ? 'bg-[#A78BFA] text-[#060B13] font-bold shadow-[0_0_10px_rgba(167,139,250,0.35)]'
                      : 'text-[#94A3B8] hover:text-white hover:bg-[#1f344f]'
                  }`}
                  title="Switch to Interactive 3D Cislunar Space"
                >
                  <Box className="w-3.5 h-3.5" />
                  <span>3D Space</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewDimension('2d')}
                  className={`py-1.5 px-2.5 rounded-lg text-xs font-mono font-semibold flex items-center justify-center gap-1.5 transition-all ${
                    viewDimension === '2d'
                      ? 'bg-[#38BDF8] text-[#060B13] font-bold shadow-[0_0_10px_rgba(56,189,248,0.35)]'
                      : 'text-[#94A3B8] hover:text-white hover:bg-[#1f344f]'
                  }`}
                  title="Switch to 2D Mission Flight Diagram"
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>2D Diagram</span>
                </button>
              </div>
            </div>

            {/* 2. Trajectory Profile Selection (Path Selection) */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-mono uppercase text-[#A78BFA] font-semibold tracking-wider flex items-center gap-1.5">
                  <Sparkles className="w-3 h-3 text-[#A78BFA]" />
                  <span>Path Selection</span>
                </span>
                <span className="text-[10px] font-mono text-[#38BDF8]">
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
                      className={`p-2 rounded-xl border text-left flex items-center justify-between transition-all ${
                        isSelected
                          ? 'bg-[#A78BFA]/20 border-[#A78BFA] text-white shadow-[0_0_10px_rgba(167,139,250,0.25)] ring-1 ring-[#A78BFA]/50'
                          : 'bg-[#152336]/60 border-[#223854] text-[#94A3B8] hover:text-white hover:bg-[#152336]'
                      }`}
                    >
                      <div>
                        <div className="font-semibold text-xs text-white leading-tight">{p.name}</div>
                        <div className="text-[10px] font-mono text-[#A78BFA] mt-0.5">{p.subtitle}</div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                        <span className="text-[10px] font-mono text-[#94A3B8] hidden sm:inline">
                          {p.transitNote}
                        </span>
                        {isSelected ? (
                          <div className="w-2 h-2 rounded-full bg-[#A78BFA] shadow-[0_0_6px_#A78BFA]" />
                        ) : (
                          <div className="w-2 h-2 rounded-full border border-[#94A3B8]/40" />
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Path description summary */}
              <div className="mt-1.5 text-[10px] font-mono text-[#94A3B8] bg-[#152336]/40 border border-[#223854]/60 rounded-lg p-2 leading-tight">
                <span className="text-[#38BDF8] font-semibold">{orbitPlan.profile.name}: </span>
                {orbitPlan.profile.description}
              </div>
            </div>

            {/* 3. Camera Focus Controls (Earth, Moon, Follow Rocket, Full Trajectory) */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-mono uppercase text-[#38BDF8] font-semibold tracking-wider flex items-center gap-1.5">
                  <Camera className="w-3 h-3 text-[#38BDF8]" />
                  <span>Camera Focus</span>
                </span>
                <span className="text-[10px] font-mono text-[#94A3B8]">
                  {viewDimension === '3d' ? '3D View' : 'Fixed 2D'}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={() => handleSetCameraMode('overview')}
                  className={`py-1.5 px-2 rounded-lg border text-[11px] font-mono font-medium flex items-center justify-center gap-1.5 transition-all ${
                    cameraMode === 'overview'
                      ? 'bg-[#38BDF8] text-[#060B13] border-[#38BDF8] font-bold shadow-[0_0_10px_rgba(56,189,248,0.4)]'
                      : 'bg-[#152336]/70 border-[#223854] text-[#94A3B8] hover:text-white hover:bg-[#152336]'
                  }`}
                  title="Center entire Earth to Moon trajectory"
                >
                  <Maximize2 className="w-3 h-3" />
                  <span>Full Path</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleSetCameraMode('chase')}
                  className={`py-1.5 px-2 rounded-lg border text-[11px] font-mono font-medium flex items-center justify-center gap-1.5 transition-all ${
                    cameraMode === 'chase'
                      ? 'bg-[#A78BFA] text-[#060B13] border-[#A78BFA] font-bold shadow-[0_0_10px_rgba(167,139,250,0.4)]'
                      : 'bg-[#152336]/70 border-[#223854] text-[#94A3B8] hover:text-white hover:bg-[#152336]'
                  }`}
                  title="Lock camera to follow the rocket"
                >
                  <Rocket className="w-3 h-3" />
                  <span>Rocket</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleSetCameraMode('earth')}
                  className={`py-1.5 px-2 rounded-lg border text-[11px] font-mono font-medium flex items-center justify-center gap-1.5 transition-all ${
                    cameraMode === 'earth'
                      ? 'bg-[#38BDF8] text-[#060B13] border-[#38BDF8] font-bold shadow-[0_0_10px_rgba(56,189,248,0.4)]'
                      : 'bg-[#152336]/70 border-[#223854] text-[#94A3B8] hover:text-white hover:bg-[#152336]'
                  }`}
                  title="Focus on Earth departure and parking orbit"
                >
                  <Globe2 className="w-3.5 h-3.5" />
                  <span>Earth</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleSetCameraMode('moon')}
                  className={`py-1.5 px-2 rounded-lg border text-[11px] font-mono font-medium flex items-center justify-center gap-1.5 transition-all ${
                    cameraMode === 'moon'
                      ? 'bg-[#00D2C4] text-[#060B13] border-[#00D2C4] font-bold shadow-[0_0_10px_rgba(0,210,196,0.4)]'
                      : 'bg-[#152336]/70 border-[#223854] text-[#94A3B8] hover:text-white hover:bg-[#152336]'
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
          <div className="pt-2 border-t border-[#1b2d45]/80 space-y-2 flex-shrink-0">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono uppercase text-[#38BDF8] font-semibold tracking-wider flex items-center gap-1.5">
                <Clock className="w-3 h-3 text-[#38BDF8]" />
                <span>Playback Controls</span>
              </span>
              <span className="text-[10px] font-mono text-[#F59E0B] truncate">
                {phaseInfo.label}
              </span>
            </div>

            {/* Main Play / Pause / Reset & Speed Controls */}
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setIsPlaying(!isPlaying)}
                className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-mono font-bold flex items-center justify-center gap-1.5 transition-all ${
                  isPlaying
                    ? 'bg-amber-500 hover:bg-amber-400 text-black shadow-[0_0_12px_rgba(245,158,11,0.4)]'
                    : 'bg-emerald-500 hover:bg-emerald-400 text-black shadow-[0_0_12px_rgba(16,185,129,0.4)]'
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
                className="p-1.5 rounded-lg bg-[#152336] hover:bg-[#223854] text-[#94A3B8] hover:text-white border border-[#223854] transition-colors"
                title="Reset to LEO Liftoff"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>

              <div className="flex items-center bg-[#152336] rounded-lg p-0.5 border border-[#223854] text-xs font-mono">
                {[1, 3, 8].map((spd) => (
                  <button
                    key={spd}
                    type="button"
                    onClick={() => setSimSpeed(spd)}
                    className={`px-2 py-1 rounded text-[11px] transition-colors ${
                      simSpeed === spd ? 'bg-[#38BDF8] text-[#060B13] font-bold' : 'text-[#94A3B8] hover:text-white'
                    }`}
                  >
                    {spd}x
                  </button>
                ))}
              </div>
            </div>

            {/* Timeline Progress Scrubber & MET Time readout */}
            <div className="bg-[#152336]/60 border border-[#223854] rounded-lg p-2 space-y-1">
              <div className="flex items-center justify-between text-[11px] font-mono">
                <span className="flex items-center gap-1.5 text-white">
                  <Clock className="w-3 h-3 text-[#38BDF8]" />
                  <span>MET:</span>
                  <span className="text-[#38BDF8] font-bold">
                    {currentState ? formatTransitTime(currentState.t) : '0h 0m'}
                  </span>
                </span>
                <span className="text-[#94A3B8]">
                  Progress: <strong className="text-white">{(simProgress * 100).toFixed(1)}%</strong>
                </span>
              </div>

              <input
                type="range"
                min="0"
                max="1"
                step="0.001"
                value={simProgress}
                onChange={(e) => setSimProgress(parseFloat(e.target.value))}
                className="w-full h-1.5 bg-[#060B13] rounded-lg appearance-none cursor-pointer accent-[#38BDF8]"
              />
            </div>
          </div>
        </div>
      </div>

      {/* ── Select Vehicle & NASA JPL Horizons Strip (Bottom of Simulation, Ahead of Info) ──
      <div className="bg-[#0d1624] border border-[#1b2d45] rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3 text-xs shadow-lg snap-start scroll-mt-2.5">
        {/* Rocket Launcher Selector */}
        {/*
        <div className="flex items-center gap-2.5 flex-wrap">
          <span className="font-mono text-[#F59E0B] flex items-center gap-1.5 font-semibold uppercase text-xs">
            <Rocket className="w-4 h-4" />
            <span>Select Vehicle:</span>
          </span>
          <div className="flex items-center gap-1.5 flex-wrap">
            {LUNAR_ROCKETS.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => setSelectedRocketId(r.id)}
                className={`text-xs font-mono px-3 py-1.5 rounded-lg border transition-all ${
                  selectedRocketId === r.id
                    ? 'bg-[#F59E0B]/20 border-[#F59E0B] text-white font-medium shadow-[0_0_8px_rgba(245,158,11,0.3)] ring-1 ring-[#F59E0B]/40'
                    : 'bg-[#152336]/60 border-[#223854] text-[#94A3B8] hover:text-white hover:border-[#38BDF8]'
                }`}
              >
                {r.name}
              </button>
            ))}
          </div>
        </div>*/}
        {/* NASA JPL Horizons Ephemeris API Status */}
        {/*
        <div className="flex items-center gap-2 font-mono text-xs">
          <div className="flex items-center gap-2 bg-[#152336] px-3 py-1.5 rounded-lg border border-[#223854]">
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
            className="p-1.5 px-2.5 rounded-lg bg-[#152336] hover:bg-[#223854] text-[#94A3B8] hover:text-white transition-colors"
            title="Refresh Live NASA JPL Horizons Ephemeris"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoadingJpl ? 'animate-spin text-cyan-400' : ''}`} />
          </button>
        </div>
      </div> */}

      {/* ── Flight Telemetry & Delta-V Budget Deck ─────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3.5 snap-start scroll-mt-2.5">
        {/* 1. Transit Duration */}
        <div className="bg-[#0d1624] border border-[#1b2d45] rounded-2xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs font-mono text-[#94A3B8]">
            <span>Estimated Transit Time</span>
            <Clock className="w-4 h-4 text-[#38BDF8]" />
          </div>
          <div className="mt-2 text-2xl font-bold font-mono text-white">
            {orbitPlan.transfer?.transitLabel || formatTransitTime(orbitPlan.transfer?.transitTimeS ?? 0)}
          </div>
          <div className="mt-1 text-[11px] font-mono text-[#38BDF8]">
            Epoch: Day {(orbitPlan.transfer?.transitTimeS != null ? orbitPlan.transfer.transitTimeS / 86400 : 5).toFixed(1)} &middot; e = {orbitPlan.transfer?.eccentricity?.toFixed(3) ?? '0.966'}
          </div>
        </div>

        {/* 2. TLI Delta-V */}
        <div className="bg-[#0d1624] border border-[#1b2d45] rounded-2xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs font-mono text-[#94A3B8]">
            <span>Trans-Lunar Injection (TLI)</span>
            <Flame className="w-4 h-4 text-[#F59E0B]" />
          </div>
          <div className="mt-2 text-2xl font-bold font-mono text-[#F59E0B]">
            +{((orbitPlan.tli?.deltaVKmS ?? 3.15) * 1000).toFixed(0)} <span className="text-sm font-normal text-[#94A3B8]">m/s</span>
          </div>
          <div className="mt-1 text-[11px] font-mono text-[#94A3B8]">
            v_LEO: {orbitPlan.parkingOrbit?.velocityKmS?.toFixed(2) ?? '7.79'} km/s &rarr; v_TLI: {(orbitPlan.tli?.velocityPostBurnKmS ?? orbitPlan.tli?.velocityKmS ?? 10.93).toFixed(2)} km/s
          </div>
        </div>

        {/* 3. Lunar Insertion Delta-V */}
        <div className="bg-[#0d1624] border border-[#1b2d45] rounded-2xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs font-mono text-[#94A3B8]">
            <span>Lunar Orbit Insertion (LOI)</span>
            <Gauge className="w-4 h-4 text-[#00D2C4]" />
          </div>
          <div className="mt-2 text-2xl font-bold font-mono text-[#00D2C4]">
            {(orbitPlan.lunarArrival?.orbitInsertionDvKmS ?? 0) > 0
              ? `-${((orbitPlan.lunarArrival?.orbitInsertionDvKmS ?? 0) * 1000).toFixed(0)} m/s`
              : '0 m/s (Flyby)'}
          </div>
          <div className="mt-1 text-[11px] font-mono text-[#94A3B8]">
            Approach: {orbitPlan.lunarArrival?.approachVelocityKmS?.toFixed(2) ?? '2.32'} km/s &rarr; Orbit: {orbitPlan.lunarArrival?.orbitVelocityKmS?.toFixed(2) ?? '1.63'} km/s
          </div>
        </div>

        {/* 4. Total Mission Delta-V */}
        <div className="bg-[#0d1624] border border-[#1b2d45] rounded-2xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs font-mono text-[#94A3B8]">
            <span>Total ΔV Budget</span>
            <Fuel className="w-4 h-4 text-[#EC4899]" />
          </div>
          <div className="mt-2 text-2xl font-bold font-mono text-[#EC4899]">
            {((orbitPlan.totalDeltaVKmS ?? 4.0) * 1000).toFixed(0)} <span className="text-sm font-normal text-[#94A3B8]">m/s</span>
          </div>
          <div className="mt-1 text-[11px] font-mono text-[#94A3B8]">
            LOI: {((orbitPlan.lunarArrival?.orbitInsertionDvKmS ?? 0) * 1000).toFixed(0)} m/s &middot; Descent: {((orbitPlan.descentDvKmS ?? 0) * 1000).toFixed(0)} m/s
          </div>
        </div>
      </div>

      {/* ── Flight Phase Milestones Timeline ──────────────────────────────────── */}
      <div className="bg-[#0d1624] border border-[#1b2d45] rounded-2xl p-4 snap-start scroll-mt-2.5">
        <h3 className="text-xs font-semibold text-white uppercase tracking-wider mb-3 flex items-center gap-2">
          <Compass className="w-4 h-4 text-[#A78BFA]" />
          <span>Mission Flight Profile &amp; Burn Sequence</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          <div className="bg-[#152336]/60 border border-[#223854] rounded-xl p-3">
            <div className="text-[10px] font-mono text-[#38BDF8] font-bold">PHASE 1 &middot; LIFTOFF</div>
            <div className="text-xs font-semibold text-white mt-1">LEO Parking Orbit</div>
            <div className="text-[11px] font-mono text-[#94A3B8] mt-1 leading-tight">
              Launch via Payload Rocket into {orbitPlan.parkingOrbit?.altKm ?? 185} km LEO orbit (v = {orbitPlan.parkingOrbit?.velocityKmS?.toFixed(2) ?? '7.79'} km/s).
            </div>
          </div>

          <div className="bg-[#152336]/60 border border-[#223854] rounded-xl p-3">
            <div className="text-[10px] font-mono text-[#F59E0B] font-bold">PHASE 2 &middot; TLI BURN</div>
            <div className="text-xs font-semibold text-white mt-1">Trans-Lunar Injection</div>
            <div className="text-[11px] font-mono text-[#94A3B8] mt-1 leading-tight">
              Upper stage prograde burn of +{((orbitPlan.tli?.deltaVKmS ?? 3.15) * 1000).toFixed(0)} m/s into transfer ellipse (e = {orbitPlan.transfer?.eccentricity?.toFixed(3) ?? '0.966'}).
            </div>
          </div>

          <div className="bg-[#152336]/60 border border-[#223854] rounded-xl p-3">
            <div className="text-[10px] font-mono text-[#34D399] font-bold">PHASE 3 &middot; TRANSLUNAR COAST</div>
            <div className="text-xs font-semibold text-white mt-1">Cislunar Transit</div>
            <div className="text-[11px] font-mono text-[#94A3B8] mt-1 leading-tight">
              {orbitPlan.transfer?.transitLabel || formatTransitTime(orbitPlan.transfer?.transitTimeS ?? 0)} coast with PTC roll and mid-course correction (MCC) burns.
            </div>
          </div>

          <div className="bg-[#152336]/60 border border-[#223854] rounded-xl p-3">
            <div className="text-[10px] font-mono text-[#EC4899] font-bold">PHASE 4 &middot; LUNAR CAPTURE</div>
            <div className="text-xs font-semibold text-white mt-1">Lunar Orbit Insertion</div>
            <div className="text-[11px] font-mono text-[#94A3B8] mt-1 leading-tight">
              LOI retro-burn of -{((orbitPlan.lunarArrival?.orbitInsertionDvKmS ?? 0) * 1000).toFixed(0)} m/s into {orbitPlan.lunarArrival?.orbitAltKm ?? 100} km polar/equatorial orbit.
            </div>
          </div>

          <div className="bg-[#152336]/60 border border-[#223854] rounded-xl p-3">
            <div className="text-[10px] font-mono text-[#00D2C4] font-bold">PHASE 5 &middot; TOUCHDOWN</div>
            <div className="text-xs font-semibold text-white mt-1">Target Landing Site</div>
            <div className="text-[11px] font-mono text-[#94A3B8] mt-1 leading-tight">
              Deorbit burn and terminal powered descent of ~{((orbitPlan.descentDvKmS ?? 0) * 1000).toFixed(0)} m/s to surface touchdown.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
