/**
 * @file MissionBriefingPage.jsx
 * Page 6: Dedicated Mission Briefing & Assessment Dossier.
 * Consolidated scientific findings, operational risks, candidate selection, and exportable reports.
 */

import React, { useState, useMemo } from 'react';
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
import { HORIZON_TABLE, horizonAt } from '../utils/horizons.js';
import { computeCelestialState, solarPosition } from '../utils/lunarEphemeris.js';
import { evaluateEarthLink, DEFAULT_DTE_CONSTRAINTS } from '../utils/earthLink.js';
import { getLunarTemperature } from '../utils/lunarThermal.js';
import { calculateSolarTransition } from '../utils/transitionTimes.js';
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
  const simulationTime = celestialTimeStore.get().ms;

  const currentSite = selectedSite || LANDING_SITES.find((s) => s.id === 'landing-artemis3-malapert') || LANDING_SITES[0];
  const mission = activeMission || CLPS_MISSIONS[0];

  const siteLat = currentSite.latitude ?? currentSite.lat ?? 0;
  const siteLon = currentSite.longitude ?? currentSite.lon ?? 0;

  // Compute live assessment data
  const assessment = useMemo(() => {
    try {
      const state = computeCelestialState(simulationTime);
      const thermal = getLunarTemperature(siteLat, siteLon, new Date(simulationTime));
      const dte = evaluateEarthLink({
        state,
        moonFeature: currentSite,
        constraints: DEFAULT_DTE_CONSTRAINTS,
        terrainFn: (az) => horizonAt(HORIZON_TABLE, currentSite.id, az),
      });

      const flat = solarPosition(state, siteLat, siteLon);
      const terrainHorizonDeg = horizonAt(HORIZON_TABLE, currentSite.id, flat.azimuthDeg) ?? 0;
      const sun = solarPosition(state, siteLat, siteLon, terrainHorizonDeg);

      const solarTransition = calculateSolarTransition(simulationTime, siteLat, siteLon, currentSite.id);
      const clearance = sun.elevationDeg - terrainHorizonDeg;
      const isSunlit = sun.elevationDeg > 0 && clearance > 0;
      const powerPct = isSunlit
        ? Math.min(100, Math.max(10, Math.round(Math.sin((sun.elevationDeg * Math.PI) / 180) * 110)))
        : 0;

      // Overall Score
      let score = 60;
      if (isSunlit) score += 20;
      if (dte.status === 'clear') score += 20;
      else if (dte.status === 'doubtful') score += 5;
      else score -= 25;

      const surfaceTemp = thermal.surfaceTempC;
      if (surfaceTemp < -180) score -= 15;
      else if (surfaceTemp > -80 && surfaceTemp < 50) score += 10;

      score = Math.max(0, Math.min(100, score));

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

      if (surfaceTemp < -150) {
        risks.push({
          title: 'Extreme Cryogenic Surface Environment',
          severity: 'HIGH',
          desc: `Surface temperature is ${surfaceTemp.toFixed(0)}°C. Mechanism cold-welding and battery freeze hazards.`,
        });
      }

      return {
        state,
        thermal,
        dte,
        sun,
        clearance,
        isSunlit,
        powerPct,
        solarTransition,
        score,
        risks,
        isGo: score >= 65 && dte.status !== 'blocked',
      };
    } catch (err) {
      console.warn('Assessment computation failed:', err);
      return null;
    }
  }, [simulationTime, currentSite, siteLat, siteLon]);

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
- **Diviner Thermal Regimen:**
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
    <div className="flex-1 overflow-y-auto bg-[#07090e] text-slate-100 p-4 md:p-8 space-y-6">
      {/* Workspace Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 border-b border-slate-800/80 pb-5">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono tracking-widest text-cyan-400 uppercase">
            <FileText className="w-4 h-4 text-cyan-400" />
            <span>Workspace 06 · Mission Assessment & Briefing Dossier</span>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-white mt-1">
            Flight Readiness Review & Mission Dossier
          </h1>
          <p className="text-xs text-slate-400 mt-1 max-w-3xl">
            Consolidated evaluation of solar power continuity, direct-to-Earth communication links, thermal constraints, and operational hazard matrix.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-3">
          <button
            onClick={copyMarkdown}
            className="px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-700 hover:border-slate-600 text-xs font-medium text-slate-200 flex items-center gap-2 transition"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-slate-400" />}
            {copied ? 'Copied Markdown' : 'Copy Briefing MD'}
          </button>

          <button
            onClick={handlePrint}
            className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-xs font-bold text-white flex items-center gap-2 shadow-lg shadow-cyan-950/60 transition active:scale-98"
          >
            <Printer className="w-4 h-4" />
            Print / Export PDF
          </button>
        </div>
      </div>

      {/* Target & Epoch Bar */}
      <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div>
            <label className="text-[10px] font-mono uppercase tracking-wider text-slate-400 block mb-1">
              Evaluated Landing Site
            </label>
            <select
              value={currentSite.id}
              onChange={(e) => {
                const found = LANDING_SITES.find((s) => s.id === e.target.value);
                if (found && onSelectSite) onSelectSite(found);
              }}
              className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs font-bold text-slate-200 focus:outline-none focus:border-cyan-500"
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

          <div className="hidden sm:block border-l border-slate-800 pl-4">
            <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500 block">
              Mission Profile
            </span>
            <span className="text-xs font-bold text-white mt-0.5 block">{mission.name}</span>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
          <Clock className="w-4 h-4 text-cyan-400" />
          <span>Epoch:</span>
          <span className="font-bold text-white">{new Date(simulationTime).toUTCString()}</span>
        </div>
      </div>

      {/* Executive Verdict Banner */}
      <div
        className={`p-6 rounded-2xl border flex flex-col md:flex-row md:items-center justify-between gap-6 ${
          assessment?.isGo
            ? 'bg-gradient-to-r from-emerald-950/40 via-slate-900 to-slate-900 border-emerald-500/40'
            : 'bg-gradient-to-r from-amber-950/40 via-slate-900 to-slate-900 border-amber-500/40'
        }`}
      >
        <div className="flex items-start gap-4">
          <div
            className={`p-3 rounded-xl border mt-0.5 ${
              assessment?.isGo
                ? 'bg-emerald-900/50 text-emerald-400 border-emerald-700'
                : 'bg-amber-900/50 text-amber-400 border-amber-700'
            }`}
          >
            {assessment?.isGo ? <CheckCircle2 className="w-6 h-6" /> : <AlertTriangle className="w-6 h-6" />}
          </div>
          <div>
            <div className="flex items-center gap-2 font-mono text-xs">
              <span
                className={`px-2 py-0.5 rounded font-bold uppercase ${
                  assessment?.isGo ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'
                }`}
              >
                {assessment?.isGo ? 'STATUS: GO FOR DESCENT' : 'STATUS: CAUTION / CONSTRAINED'}
              </span>
              <span className="text-slate-400">Readiness Score: {assessment?.score}/100</span>
            </div>
            <h2 className="text-xl font-black text-white mt-1">
              {assessment?.isGo
                ? 'All Critical Mission Flight Parameters Satisfied'
                : 'Identified Hazards Require Mitigation or Window Adjustment'}
            </h2>
            <p className="text-xs text-slate-300 mt-1 max-w-2xl">
              Evaluation at {currentSite.name} reveals {assessment?.isSunlit ? 'active solar illumination' : 'darkness/shadow'} and{' '}
              {assessment?.dte.status === 'clear' ? 'continuous Earth line of sight' : 'RF communication obstruction'}.
            </p>
          </div>
        </div>

        <div className="text-right font-mono flex md:flex-col items-center md:items-end justify-between">
          <span className="text-[10px] text-slate-400 uppercase">Mission Suitability</span>
          <span
            className={`text-3xl font-black ${
              assessment?.isGo ? 'text-emerald-400' : 'text-amber-400'
            }`}
          >
            {assessment?.score}%
          </span>
        </div>
      </div>

      {/* 4 Pillars Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 font-mono">
        {/* Pillar 1: Solar */}
        <div className="p-5 rounded-2xl bg-[#0c1017] border border-slate-800 space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400 uppercase flex items-center gap-1.5">
              <Sun className="w-4 h-4 text-amber-400" />
              Illumination
            </span>
            <span className="font-bold text-amber-300">{assessment?.powerPct}% Pwr</span>
          </div>
          <div className="text-lg font-black text-white">
            {assessment?.isSunlit ? 'Active Sunlit' : 'Shadow / Night'}
          </div>
          <div className="text-[11px] text-slate-400 space-y-1 pt-2 border-t border-slate-800/80">
            <p>Sun Elevation: {fmtNum(assessment?.sun?.elevationDeg, 2)}°</p>
            <p>Ridge Clearance: {fmtNum(assessment?.clearance, 2)}°</p>
          </div>
        </div>

        {/* Pillar 2: Comms */}
        <div className="p-5 rounded-2xl bg-[#0c1017] border border-slate-800 space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400 uppercase flex items-center gap-1.5">
              <Radio className="w-4 h-4 text-cyan-400" />
              Direct Comms
            </span>
            <span
              className={`font-bold uppercase ${
                assessment?.dte?.status === 'clear' ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {assessment?.dte?.status ?? 'N/A'}
            </span>
          </div>
          <div className="text-lg font-black text-white">
            {assessment?.dte?.status === 'clear' ? 'LOS Unobstructed' : 'Line of Sight Masked'}
          </div>
          <div className="text-[11px] text-slate-400 space-y-1 pt-2 border-t border-slate-800/80">
            <p>Earth Elevation: {fmtNum(assessment?.dte?.elevationDeg, 2)}°</p>
            <p>Terrain Margin: {fmtNum(assessment?.dte?.marginDeg, 2)}°</p>
          </div>
        </div>

        {/* Pillar 3: Thermal */}
        <div className="p-5 rounded-2xl bg-[#0c1017] border border-slate-800 space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400 uppercase flex items-center gap-1.5">
              <Thermometer className="w-4 h-4 text-rose-400" />
              Thermal Regimen
            </span>
            <span className="font-bold text-white">Diviner</span>
          </div>
          <div className="text-lg font-black text-white">
            {fmtNum(assessment?.thermal?.surfaceTempC, 0)}°C
          </div>
          <div className="text-[11px] text-slate-400 space-y-1 pt-2 border-t border-slate-800/80">
            <p>Absolute: {assessment?.thermal?.surfaceTempC != null ? fmtNum(assessment.thermal.surfaceTempC + 273.15, 0) : '0'} K</p>
            <p>Subsurface: {fmtNum(assessment?.thermal?.subsurfaceTempC, 0)}°C</p>
          </div>
        </div>

        {/* Pillar 4: Topography */}
        <div className="p-5 rounded-2xl bg-[#0c1017] border border-slate-800 space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400 uppercase flex items-center gap-1.5">
              <Mountain className="w-4 h-4 text-purple-400" />
              Topography
            </span>
            <span className="font-bold text-purple-300">LOLA DEM</span>
          </div>
          <div className="text-lg font-black text-white">
            {currentSite.elevationM ? `${currentSite.elevationM.toLocaleString()} m` : 'Summit Peak'}
          </div>
          <div className="text-[11px] text-slate-400 space-y-1 pt-2 border-t border-slate-800/80">
            <p>Relief: High South Polar</p>
            <p>Horizon: 360° Profile</p>
          </div>
        </div>
      </div>

      {/* Operational Risk Matrix */}
      <div className="p-6 rounded-2xl bg-[#0c1017] border border-slate-800/80 space-y-4">
        <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-amber-400" />
          Operational Hazard Identification & Flight Constraints
        </h3>

        {assessment?.risks.length === 0 ? (
          <div className="p-4 rounded-xl bg-emerald-950/30 border border-emerald-800/40 text-emerald-300 text-xs font-mono">
            All primary operational safety constraints satisfied with zero critical flags.
          </div>
        ) : (
          <div className="space-y-3">
            {assessment.risks.map((risk, index) => (
              <div
                key={index}
                className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex items-start gap-3"
              >
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase mt-0.5 ${
                    risk.severity === 'HIGH'
                      ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                      : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                  }`}
                >
                  {risk.severity}
                </span>
                <div>
                  <h4 className="text-xs font-bold text-white">{risk.title}</h4>
                  <p className="text-xs text-slate-400 mt-0.5">{risk.desc}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Navigation Footnotes */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl bg-slate-900/40 border border-slate-800 text-xs">
        <span className="text-slate-400">
          Need detailed sensor models or horizon geometry?
        </span>
        <div className="flex items-center gap-3">
          <button
            onClick={() => onNavigate && onNavigate('site-analysis')}
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition"
          >
            Open Site Topography Analysis
          </button>
          <button
            onClick={() => onNavigate && onNavigate('comms')}
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition"
          >
            Open DSN Ground Stations
          </button>
          <button
            onClick={() => onNavigate && onNavigate('explorer')}
            className="px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-medium transition"
          >
            View in 3D Celestial Explorer
          </button>
        </div>
      </div>
    </div>
  );
}
