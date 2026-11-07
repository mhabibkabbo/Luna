/**
 * @file MissionBriefingPage.jsx
 * Page 6: Dedicated Mission Briefing & Assessment Dossier.
 * Consolidated scientific findings, operational risks, candidate selection, and exportable reports.
 */

import React, { useState, useMemo, useEffect } from 'react';
import {
  FileText,
  Copy,
  Printer,
  Check,
  AlertTriangle,
  Sun,
  Radio,
  Thermometer,
  Mountain,
  ShieldAlert,
  ShieldCheck,
  CheckCircle2,
  Compass,
  ArrowRight,
  Sparkles,
  Download,
  Clock,
} from 'lucide-react';
import { LANDING_SITES } from '../data/landingSites.js';
import { CLPS_MISSIONS } from '../data/clpsMissions.js';
import {
  HORIZON_TABLE,
  horizonAt,
  ensurePolarDemLoaded,
  sampleLunarTerrainMetrics,
} from '../utils/horizons.js';
import { computeCelestialState, solarPosition } from '../utils/lunarEphemeris.js';
import { evaluateEarthLink, DEFAULT_DTE_CONSTRAINTS } from '../utils/earthLink.js';
import { getLunarTemperature } from '../utils/lunarThermal.js';
import { calculateSolarTransition } from '../utils/transitionTimes.js';
import {
  evaluateCandidateForMissionWindow,
  DEFAULT_PLANNER_CONSTRAINTS,
} from '../utils/plannerEngine.js';
import { celestialTimeStore } from '../utils/celestialTime.js';
import { notifySuccess } from '../utils/feedbackStore.js';

// Safe number formatter that never throws on undefined/null/NaN
const fmtNum = (val, digits = 2, fallback = '0.00') => {
  return Number.isFinite(val) ? Number(val).toFixed(digits) : fallback;
};

export default function MissionBriefingPage({
  selectedSite,
  onSelectSite,
  activeMission,
  onNavigate,
}) {
  const [copied, setCopied] = useState(false);
  const [simulationTime, setSimulationTime] = useState(() => celestialTimeStore.get().ms);
  const [demLoadedTick, setDemLoadedTick] = useState(0);

  useEffect(() => {
    ensurePolarDemLoaded()
      .then((grid) => {
        if (grid) setDemLoadedTick((t) => t + 1);
      })
      .catch(() => {});
    return celestialTimeStore.subscribe(({ ms }) => {
      setSimulationTime(ms);
    });
  }, []);

  const currentSite = selectedSite || LANDING_SITES.find((s) => s.id === 'landing-artemis3-malapert') || LANDING_SITES[0];
  const mission = activeMission || CLPS_MISSIONS[0];

  const siteLat = currentSite.latitude ?? currentSite.lat ?? 0;
  const siteLon = currentSite.longitude ?? currentSite.lon ?? 0;

  // Compute live assessment data
  const assessment = useMemo(() => {
    try {
      const state = computeCelestialState(simulationTime);
      const terrainMetrics = sampleLunarTerrainMetrics(siteLat, siteLon, currentSite);
      const flat = solarPosition(state, siteLat, siteLon);
      const terrainHorizonDeg = horizonAt(HORIZON_TABLE, currentSite.id, flat.azimuthDeg, siteLat, siteLon) ?? 0;
      const sun = solarPosition(state, siteLat, siteLon, terrainHorizonDeg);

      const thermal = getLunarTemperature(siteLat, siteLon, new Date(simulationTime), {
        terrainHorizonDeg,
        elevationM: terrainMetrics?.elevationM ?? null,
      });
      const dte = evaluateEarthLink({
        state,
        moonFeature: currentSite,
        constraints: DEFAULT_DTE_CONSTRAINTS,
        terrainFn: (az) => horizonAt(HORIZON_TABLE, currentSite.id, az, siteLat, siteLon) ?? 0,
      });

      const solarTransition = calculateSolarTransition(simulationTime, siteLat, siteLon, currentSite.id);
      const clearance = sun.elevationDeg - terrainHorizonDeg;
      const isSunlit = sun.elevationDeg > 0 && clearance > 0 && !thermal.isPSR;
      const powerPct = isSunlit
        ? solarTransition?.powerEfficiencyPct ?? Math.round(Math.max(0, Math.sin((sun.elevationDeg * Math.PI) / 180)) * 100)
        : 0;

      // Unified Overall Suitability Score from plannerEngine
      const unifiedEval = evaluateCandidateForMissionWindow(
        {
          ...currentSite,
          latitude: siteLat,
          longitude: siteLon,
          slopeDeg: terrainMetrics?.slopeDeg ?? null,
          elevationM: terrainMetrics?.elevationM ?? null,
          roughnessM: terrainMetrics?.roughnessM ?? null,
        },
        simulationTime,
        14,
        DEFAULT_PLANNER_CONSTRAINTS
      );
      const score = unifiedEval?.overallScore ?? 50;

      // Risk items
      const risks = [];
      if (!isSunlit) {
        risks.push({
          title: 'Solar Eclipse or Night Phase Active',
          severity: 'HIGH',
          desc: 'Array power output is 0%. Landers require internal primary battery or RTG power reserves.',
        });
      } else if (clearance < 1.0) {
        risks.push({
          title: 'Low Solar Elevation Clearance',
          severity: 'MEDIUM',
          desc: `Sun is only ${clearance.toFixed(1)}° above local mountain ridge; high risk of terrain shadow casting.`,
        });
      }

      if (dte.status === 'blocked') {
        risks.push({
          title: 'Telemetry Blackout',
          severity: 'HIGH',
          desc: 'Direct line of sight to Earth is obstructed by lunar curvature or local terrain mask.',
        });
      } else if (dte.status === 'doubtful') {
        risks.push({
          title: 'Marginal Earth Line of Sight',
          severity: 'MEDIUM',
          desc: 'Earth disk partially grazes local horizon topography; potential multipath or RF degradation.',
        });
      }

      const surfaceTemp = thermal?.surfaceTempC ?? null;
      if (surfaceTemp != null && surfaceTemp < -150) {
        risks.push({
          title: 'Extreme Cryogenic Surface Environment',
          severity: 'HIGH',
          desc: `Surface temperature is ${surfaceTemp.toFixed(0)}°C. Mechanism cold-welding and battery freeze hazards.`,
        });
      }

      return {
        state,
        thermal,
        terrainMetrics,
        dte,
        sun,
        clearance,
        isSunlit,
        powerPct,
        solarTransition,
        score,
        formulaString: unifiedEval?.formulaString,
        isPartialScore: unifiedEval?.isPartialScore,
        risks,
        isGo: score >= 65 && dte.status !== 'blocked' && dte.status !== 'away',
      };
    } catch (err) {
      console.warn('Assessment computation failed:', err);
      return null;
    }
  }, [simulationTime, currentSite, siteLat, siteLon, demLoadedTick]);

  const copyMarkdown = () => {
    if (!assessment) return;
    const text = `# LUNA MISSION ASSESSMENT DOSSIER
**Target Landing Site:** ${currentSite.name} (${siteLat.toFixed(2)}°, ${siteLon.toFixed(2)}°)
**Flight Profile:** ${mission.name} (${mission.provider || mission.agency})
**Evaluation Epoch:** ${new Date(simulationTime).toUTCString()}
**Mission Readiness Score:** ${assessment.score} / 100 [${assessment.isGo ? 'MISSION GO' : 'MISSION NO-GO / CAUTION'}]

## 1. SCIENTIFIC & OPERATIONAL CRITERIA
- **Solar Illumination:** ${assessment.isSunlit ? 'SUNLIT' : 'SHADOWED / OCCULTED'}
  - Solar Elevation: ${assessment.sun.elevationDeg.toFixed(2)}° (Clearance: ${assessment.clearance.toFixed(2)}°)
  - Solar Array Power Potential: ${assessment.powerPct}%
- **Direct-to-Earth Link (DTE):** ${assessment.dte.status.toUpperCase()}
  - Earth Elevation: ${assessment.dte.elevationDeg.toFixed(2)}°
  - Terrain Clearance Margin: ${assessment.dte.marginDeg.toFixed(2)}°
- **Analytical Thermal Regimen (Calculated):**
  - Surface Temperature: ${assessment.thermal.surfaceTempC.toFixed(0)}°C (${(assessment.thermal.surfaceTempC + 273.15).toFixed(0)} K)
  - Subsurface Equilibrium: ${assessment.thermal.subsurfaceTempC.toFixed(0)}°C

## 2. OPERATIONAL RISK MATRIX
${assessment.risks.length === 0 ? '- No critical operational hazards identified.' : assessment.risks.map((r) => `- [${r.severity}] ${r.title}: ${r.desc}`).join('\n')}

Generated via LUNA — Lunar Landing Site Navigator (NASA Space Apps Challenge)
`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    notifySuccess('Mission dossier copied as Markdown');
    setTimeout(() => setCopied(false), 2500);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="flex-1 overflow-y-auto bg-[#050507] text-slate-100 px-5 sm:px-8 lg:px-10 py-7 space-y-6">
      {/* Workspace Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 border-b border-[#1E2028] pb-5">
        <div>
          <div className="flex items-center gap-2 text-[11px] font-sans font-semibold tracking-[0.14em] text-[#8E95A5] uppercase">
            <FileText className="w-3.5 h-3.5 text-[#F8FAFC]" />
            <span>Workspace 05 · Mission Assessment &amp; Briefing Dossier</span>
          </div>
          <h1 className="text-2xl sm:text-[26px] font-display font-semibold tracking-tight text-white mt-1.5">
            Flight Readiness Review &amp; Mission Dossier
          </h1>
          <p className="text-[13.5px] font-sans text-[#8E95A5] mt-1 max-w-3xl leading-relaxed">
            Consolidated evaluation of solar power continuity, direct-to-Earth communication links, thermal constraints, and operational hazard matrix.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2.5 shrink-0">
          <button
            onClick={copyMarkdown}
            className="px-3.5 py-2 rounded-lg bg-[#0C0D12] border border-[#1E2028] hover:bg-[#14161D] text-xs font-sans font-medium text-slate-200 flex items-center gap-2 transition"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
            {copied ? 'Copied Markdown' : 'Copy Briefing MD'}
          </button>

          <button
            onClick={handlePrint}
            className="px-4 py-2 rounded-lg bg-white hover:bg-[#E2E8F0] text-xs font-sans font-semibold text-[#050507] flex items-center gap-2 shadow-sm transition active:scale-98"
          >
            <Printer className="w-3.5 h-3.5" />
            Print / Export PDF
          </button>
        </div>
      </div>

      {/* Target & Epoch Bar */}
      <div className="p-5 rounded-xl bg-[#0C0D12] border border-[#1E2028] flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-5">
          <div>
            <label className="text-[11px] font-sans font-semibold uppercase tracking-[0.08em] text-[#8E95A5] block mb-1.5">
              Evaluated Landing Site
            </label>
            <select
              value={currentSite.id}
              onChange={(e) => {
                const found = LANDING_SITES.find((s) => s.id === e.target.value);
                if (found && onSelectSite) onSelectSite(found);
              }}
              className="px-3 py-1.5 rounded-lg bg-[#050507] border border-[#1E2028] text-xs font-sans font-medium text-white focus:outline-none focus:border-white/40"
            >
              {LANDING_SITES.map((site) => {
                const sLat = site.latitude ?? site.lat ?? 0;
                return (
                  <option key={site.id} value={site.id}>
                    {site.name} ({sLat >= 0 ? `${fmtNum(sLat, 1, '0.0')}°N` : `${fmtNum(Math.abs(sLat), 1, '0.0')}°S`})
                  </option>
                );
              })}
            </select>
          </div>

          <div className="hidden sm:block border-l border-[#1E2028] pl-5">
            <span className="text-[11px] font-sans font-semibold uppercase tracking-[0.08em] text-[#8E95A5] block">
              Mission Profile
            </span>
            <span className="text-[13.5px] font-display font-semibold text-white mt-1 block">{mission.name}</span>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs font-sans text-[#8E95A5]">
          <Clock className="w-4 h-4 text-[#F8FAFC]" />
          <span>Epoch:</span>
          <span className="font-mono tabular-nums font-medium text-white">{new Date(simulationTime).toUTCString()}</span>
        </div>
      </div>

      {/* Executive Verdict Banner */}
      <div
        className={`p-6 rounded-2xl border flex flex-col md:flex-row md:items-center justify-between gap-6 ${
          assessment?.isGo
            ? 'bg-gradient-to-r from-emerald-950/35 via-[#0C0D12] to-[#0C0D12] border-emerald-500/35'
            : 'bg-gradient-to-r from-amber-950/35 via-[#0C0D12] to-[#0C0D12] border-amber-500/35'
        }`}
      >
        <div className="flex items-start gap-4">
          <div
            className={`p-3 rounded-xl border mt-0.5 ${
              assessment?.isGo
                ? 'bg-emerald-950/60 text-emerald-400 border-emerald-700/60'
                : 'bg-amber-950/60 text-amber-400 border-amber-700/60'
            }`}
          >
            {assessment?.isGo ? <CheckCircle2 className="w-6 h-6" /> : <AlertTriangle className="w-6 h-6" />}
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2.5 text-xs">
              <span
                className={`px-2.5 py-0.5 rounded-md font-sans font-semibold uppercase tracking-wider text-[11px] ${
                  assessment?.isGo ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'
                }`}
              >
                {assessment?.isGo ? 'STATUS: GO FOR DESCENT' : 'STATUS: CAUTION / CONSTRAINED'}
              </span>
              <span className="font-sans text-[#8E95A5]">
                Readiness Score: <strong className="font-mono tabular-nums text-white">{assessment?.score ?? '--'}/100</strong>
              </span>
            </div>
            <h2 className="text-lg sm:text-xl font-display font-semibold text-white mt-2">
              {assessment?.isGo
                ? 'All Critical Mission Flight Parameters Satisfied'
                : 'Identified Hazards Require Mitigation or Window Adjustment'}
            </h2>
            <p className="text-[13px] font-sans text-[#CBD5E1] mt-1 max-w-2xl leading-relaxed">
              Evaluation at {currentSite.name} reveals {assessment?.isSunlit ? 'active solar illumination' : 'darkness/shadow'} and{' '}
              {assessment?.dte?.status === 'clear' ? 'continuous Earth line of sight' : 'RF communication obstruction'}.
            </p>
          </div>
        </div>

        <div className="text-right flex md:flex-col items-center md:items-end justify-between shrink-0">
          <span className="text-[11px] font-sans font-semibold text-[#8E95A5] uppercase tracking-[0.08em]">Mission Suitability</span>
          <span
            className={`text-3xl font-mono tabular-nums font-semibold mt-1 ${
              assessment?.isGo ? 'text-emerald-400' : 'text-amber-400'
            }`}
          >
            {assessment?.score ?? '--'}%
          </span>
        </div>
      </div>

      {/* 4 Pillars Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Pillar 1: Solar */}
        <div className="p-5 rounded-xl bg-[#0C0D12] border border-[#1E2028] space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="text-[#8E95A5] font-sans font-semibold uppercase tracking-[0.08em] text-[11px] flex items-center gap-1.5">
              <Sun className="w-4 h-4 text-amber-400" />
              Illumination
            </span>
            <span className="font-mono tabular-nums font-semibold text-amber-300">{assessment?.powerPct ?? 0}% Pwr</span>
          </div>
          <div className="text-lg font-display font-semibold text-white">
            {assessment?.isSunlit ? 'Active Sunlit' : 'Shadow / Night'}
          </div>
          <div className="text-xs font-sans text-[#8E95A5] space-y-1.5 pt-2.5 border-t border-[#1E2028]">
            <p className="flex justify-between">
              <span>Sun Elevation:</span>
              <span className="font-mono tabular-nums text-[#E2E8F0]">{fmtNum(assessment?.sun?.elevationDeg, 2)}°</span>
            </p>
            <p className="flex justify-between">
              <span>Ridge Clearance:</span>
              <span className="font-mono tabular-nums text-[#E2E8F0]">{fmtNum(assessment?.clearance, 2)}°</span>
            </p>
          </div>
        </div>

        {/* Pillar 2: Comms */}
        <div className="p-5 rounded-xl bg-[#0C0D12] border border-[#1E2028] space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="text-[#8E95A5] font-sans font-semibold uppercase tracking-[0.08em] text-[11px] flex items-center gap-1.5">
              <Radio className="w-4 h-4 text-cyan-400" />
              Direct Comms
            </span>
            <span
              className={`font-sans font-semibold uppercase text-[11px] ${
                assessment?.dte?.status === 'clear' ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {assessment?.dte?.status ?? 'N/A'}
            </span>
          </div>
          <div className="text-lg font-display font-semibold text-white">
            {assessment?.dte?.status === 'clear' ? 'LOS Unobstructed' : 'Line of Sight Masked'}
          </div>
          <div className="text-xs font-sans text-[#8E95A5] space-y-1.5 pt-2.5 border-t border-[#1E2028]">
            <p className="flex justify-between">
              <span>Earth Elevation:</span>
              <span className="font-mono tabular-nums text-[#E2E8F0]">{fmtNum(assessment?.dte?.elevationDeg, 2)}°</span>
            </p>
            <p className="flex justify-between">
              <span>Terrain Margin:</span>
              <span className="font-mono tabular-nums text-[#E2E8F0]">{fmtNum(assessment?.dte?.marginDeg, 2)}°</span>
            </p>
          </div>
        </div>

        {/* Pillar 3: Thermal */}
        <div className="p-5 rounded-xl bg-[#0C0D12] border border-[#1E2028] space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="text-[#8E95A5] font-sans font-semibold uppercase tracking-[0.08em] text-[11px] flex items-center gap-1.5">
              <Thermometer className="w-4 h-4 text-rose-400" />
              Thermal Regimen
            </span>
            <span className="font-sans font-medium text-[#CBD5E1] text-[11px]">Calculated</span>
          </div>
          <div className="text-lg font-mono tabular-nums font-semibold text-white">
            {fmtNum(assessment?.thermal?.surfaceTempC, 0)}°C
          </div>
          <div className="text-xs font-sans text-[#8E95A5] space-y-1.5 pt-2.5 border-t border-[#1E2028]">
            <p className="flex justify-between">
              <span>Absolute:</span>
              <span className="font-mono tabular-nums text-[#E2E8F0]">{assessment?.thermal?.surfaceTempC != null ? fmtNum(assessment.thermal.surfaceTempC + 273.15, 0) : '0'} K</span>
            </p>
            <p className="flex justify-between">
              <span>Subsurface:</span>
              <span className="font-mono tabular-nums text-[#E2E8F0]">{fmtNum(assessment?.thermal?.subsurfaceTempC, 0)}°C</span>
            </p>
          </div>
        </div>

        {/* Pillar 4: Topography */}
        <div className="p-5 rounded-xl bg-[#0C0D12] border border-[#1E2028] space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="text-[#8E95A5] font-sans font-semibold uppercase tracking-[0.08em] text-[11px] flex items-center gap-1.5">
              <Mountain className="w-4 h-4 text-purple-400" />
              Topography
            </span>
            <span className="font-sans font-semibold text-purple-300 text-[11px]">LOLA DEM</span>
          </div>
          <div className="text-lg font-mono tabular-nums font-semibold text-white">
            {assessment?.terrainMetrics?.elevationM != null
              ? `${Math.round(assessment.terrainMetrics.elevationM).toLocaleString()} m`
              : currentSite.elevationM != null
              ? `${currentSite.elevationM.toLocaleString()} m`
              : <span className="font-sans text-sm font-normal text-[#8E95A5]">Not present in DEM</span>}
          </div>
          <div className="text-xs font-sans text-[#8E95A5] space-y-1.5 pt-2.5 border-t border-[#1E2028]">
            <p className="flex justify-between">
              <span>Slope:</span>
              <span className="font-mono tabular-nums text-[#E2E8F0]">
                {assessment?.terrainMetrics?.slopeDeg != null
                  ? `${fmtNum(assessment.terrainMetrics.slopeDeg, 1)}°`
                  : <span className="font-sans text-[#8E95A5]">Not present in DEM</span>}
              </span>
            </p>
            <p className="flex justify-between">
              <span>Horizon:</span>
              <span className="text-[#E2E8F0]">360° Profile</span>
            </p>
          </div>
        </div>
      </div>

      {/* Operational Risk Matrix */}
      <div className="p-6 rounded-xl bg-[#0C0D12] border border-[#1E2028] space-y-4">
        <h3 className="text-sm font-display font-semibold text-white flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-amber-400" />
          Operational Hazard Identification &amp; Flight Constraints
        </h3>

        {!assessment?.risks || assessment.risks.length === 0 ? (
          <div className="p-4 rounded-xl bg-emerald-950/30 border border-emerald-800/40 text-emerald-300 text-xs font-sans font-medium">
            All primary operational safety constraints satisfied with zero critical flags.
          </div>
        ) : (
          <div className="space-y-3">
            {assessment.risks.map((risk, index) => (
              <div
                key={index}
                className="p-4 rounded-xl bg-[#050507] border border-[#1E2028] flex items-start gap-3.5"
              >
                <span
                  className={`px-2 py-0.5 rounded text-[10.5px] font-sans font-semibold uppercase mt-0.5 shrink-0 ${
                    risk.severity === 'HIGH'
                      ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                      : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                  }`}
                >
                  {risk.severity}
                </span>
                <div>
                  <h4 className="text-[13px] font-sans font-semibold text-white">{risk.title}</h4>
                  <p className="text-xs font-sans text-[#8E95A5] mt-1 leading-relaxed">{risk.desc}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Navigation Footnotes */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl bg-[#0C0D12] border border-[#1E2028] text-xs font-sans">
        <span className="text-[#8E95A5]">
          Need detailed sensor models or horizon geometry?
        </span>
        <div className="flex items-center gap-3">
          <button
            onClick={() => onNavigate && onNavigate('comparison')}
            className="px-3.5 py-2 rounded-lg bg-[#14161D] hover:bg-[#1E2028] border border-[#1E2028] font-medium text-slate-200 transition"
          >
            Compare Landing Sites
          </button>
          <button
            onClick={() => onNavigate && onNavigate('explorer')}
            className="px-3.5 py-2 rounded-lg bg-white hover:bg-[#E2E8F0] text-[#050507] font-semibold transition"
          >
            View in 3D Celestial Explorer
          </button>
        </div>
      </div>
    </div>
  );
}
