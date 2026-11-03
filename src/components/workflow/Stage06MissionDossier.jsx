/**
 * @file Stage06MissionDossier.jsx
 * Stage 06 Mission Assessment & Comprehensive Briefing Dossier.
 * Evidence-based suitability analysis, operational risk matrix, and exportable report.
 */

import React, { useState, useMemo } from 'react';
import {
  FileCheck2,
  Copy,
  Printer,
  X,
  Check,
  AlertTriangle,
  Sun,
  Radio,
  Thermometer,
  Mountain,
  ShieldAlert,
  Compass,
} from 'lucide-react';
import { celestialTimeStore } from '../../utils/celestialTime.js';
import { computeCelestialState } from '../../utils/lunarEphemeris.js';
import { evaluateEarthLink, DEFAULT_DTE_CONSTRAINTS } from '../../utils/earthLink.js';
import { HORIZON_TABLE, horizonAt } from '../../utils/horizons.js';
import { getLunarTemperature } from '../../utils/lunarThermal.js';
import { notifySuccess } from '../../utils/feedbackStore.js';

export default function Stage06MissionDossier({
  isOpen = false,
  onClose,
  activeMission,
  candidateSite,
  candidateSiteB,
}) {
  const [copied, setCopied] = useState(false);

  const site = candidateSite || {
    id: 'landing-artemis3-malapert',
    name: 'Malapert Massif',
    latitude: -85.90,
    longitude: 0.00,
    agency: 'NASA Artemis',
  };

  const simulationTime = celestialTimeStore.get().ms;

  // Compute live scientific indicators for candidate site
  const evaluation = useMemo(() => {
    try {
      const state = computeCelestialState(simulationTime);
      const thermal = getLunarTemperature(site.latitude, site.longitude, new Date(simulationTime));
      const dte = evaluateEarthLink({
        state,
        moonFeature: site,
        constraints: DEFAULT_DTE_CONSTRAINTS,
        terrainFn: (azDeg) => horizonAt(HORIZON_TABLE, site.id, azDeg),
      });

      // Solar elevation & horizon at sun azimuth
      const sunAzimuth = (state.sun.subLon - site.longitude + 360) % 360;
      const sunHorizonDeg = horizonAt(HORIZON_TABLE, site.id, sunAzimuth) ?? 0;
      const sunClearanceDeg = thermal.solarElevationDeg - sunHorizonDeg;
      const isSunlit = thermal.solarElevationDeg > 0 && sunClearanceDeg > 0;
      const powerPotential = isSunlit
        ? Math.min(100, Math.max(10, Math.round(Math.sin((thermal.solarElevationDeg * Math.PI) / 180) * 110)))
        : 0;

      // Risk evaluations
      const thermalRisk = thermal.isPSR || thermal.tempK < 70 ? 'HIGH' : thermal.tempK < 120 ? 'MODERATE' : 'LOW';
      const commsRisk = dte.status === 'blocked' ? 'HIGH' : dte.status === 'doubtful' ? 'MODERATE' : 'LOW';
      const sunAngleRisk = thermal.solarElevationDeg < 2 && thermal.solarElevationDeg > 0 ? 'MODERATE' : thermal.solarElevationDeg <= 0 ? 'HIGH' : 'LOW';

      return {
        state,
        thermal,
        dte,
        sunHorizonDeg,
        sunClearanceDeg,
        isSunlit,
        powerPotential,
        thermalRisk,
        commsRisk,
        sunAngleRisk,
      };
    } catch (err) {
      console.error('Error computing mission dossier metrics:', err);
      return null;
    }
  }, [site, simulationTime]);

  if (!isOpen) return null;

  const latFormatted = `${Math.abs(site.latitude).toFixed(3)}° ${site.latitude >= 0 ? 'N' : 'S'}`;
  const lonFormatted = `${Math.abs(site.longitude).toFixed(3)}° ${site.longitude >= 0 ? 'E' : 'W'}`;
  const epochFormatted = new Date(simulationTime).toUTCString();

  const handleCopyMarkdown = () => {
    if (!evaluation) return;

    const report = `# LUNA MISSION ASSESSMENT & DOSSIER
**Mission**: ${activeMission?.name || 'Lunar Landing Mission'} (${activeMission?.lander || 'Lunar Lander'})
**Target Landing Site**: ${site.name}
**Coordinates**: ${latFormatted}, ${lonFormatted}
**Epoch**: ${epochFormatted}

## 1. Topographic & Environmental Summary
- **Surface Elevation**: ${site.elevationM ? `${site.elevationM} m` : 'Topographic Datum (LOLA)'}
- **Surface Temperature**: ${evaluation.thermal.tempK} K (${evaluation.thermal.tempC}°C)
- **Cryogenic PSR Status**: ${evaluation.thermal.isPSR ? 'YES (Permanently Shadowed Volatile Trap)' : 'NO (Standard Insolation Zone)'}

## 2. Solar Illumination & Power Generation
- **Solar Elevation Angle**: ${evaluation.thermal.solarElevationDeg}°
- **Local DEM Horizon at Sun Azimuth**: ${evaluation.sunHorizonDeg.toFixed(1)}°
- **Illumination Status**: ${evaluation.isSunlit ? 'SUNLIT (Direct Solar Insolation)' : 'SHADOWED (Blocked by Terrain or Night)'}
- **Photovoltaic Power Potential**: ${evaluation.powerPotential}%

## 3. Direct-to-Earth (DTE) Communication Link
- **Line-of-Sight Status**: ${evaluation.dte.status.toUpperCase()} (${evaluation.dte.reason})
- **Earth Elevation Angle**: ${evaluation.dte.elevationDeg.toFixed(1)}°
- **Terrain Horizon at Earth Azimuth**: ${evaluation.dte.terrainHorizonDeg !== null ? `${evaluation.dte.terrainHorizonDeg.toFixed(1)}°` : 'Nominal horizon'}
- **Link Margin**: ${evaluation.dte.marginDeg.toFixed(1)}° clearance

## 4. Operational Risk Assessment
- **Thermal Stress**: ${evaluation.thermalRisk} (${evaluation.thermal.tempC}°C environment)
- **Communication Blackout Risk**: ${evaluation.commsRisk} (DSN Line-of-Sight status: ${evaluation.dte.status})
- **Low Solar Angle Tracking**: ${evaluation.sunAngleRisk} (Sun elevation: ${evaluation.thermal.solarElevationDeg}°)

---
*Generated by LUNA — Lunar Landing Site Navigator · NASA Moon Trek WMTS & LOLA Planetary Data*
`;

    navigator.clipboard.writeText(report).then(() => {
      setCopied(true);
      notifySuccess('Mission Briefing Copied', 'Markdown dossier formatted to clipboard.');
      setTimeout(() => setCopied(false), 2500);
    });
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Mission Assessment Dossier"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
    >
      <div className="relative w-full max-w-4xl max-h-[90vh] flex flex-col bg-[#050813] border border-slate-800 rounded-2xl shadow-2xl overflow-hidden text-slate-100">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/60 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-cyan-950/80 border border-cyan-500/40 text-cyan-300 flex items-center justify-center font-mono font-bold text-sm">
              06
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold text-white tracking-wide">
                  Mission Assessment & Site Dossier
                </h1>
                <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800/40">
                  Evidence-Based
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Empirical synthesis of terrain obstruction, illumination longevity, and DTE communications.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            title="Close Dossier"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
          {/* Site & Flight Banner */}
          <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800 flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="text-[11px] font-mono text-cyan-400 uppercase tracking-wider">
                Target Candidate Site
              </div>
              <div className="text-lg font-bold text-white">
                {site.name}
              </div>
              <div className="text-xs font-mono text-slate-400 mt-0.5">
                {latFormatted} · {lonFormatted}
              </div>
            </div>

            <div>
              <div className="text-[11px] font-mono text-amber-400 uppercase tracking-wider">
                Mission Profile
              </div>
              <div className="text-sm font-semibold text-slate-200">
                {activeMission?.name || 'Artemis III Exploration'}
              </div>
              <div className="text-xs font-mono text-slate-400 mt-0.5">
                Lander: {activeMission?.lander || 'Human Landing System (HLS)'}
              </div>
            </div>

            <div>
              <div className="text-[11px] font-mono text-slate-400 uppercase tracking-wider">
                Evaluation Epoch
              </div>
              <div className="text-xs font-mono font-medium text-slate-200">
                {epochFormatted}
              </div>
            </div>
          </div>

          {evaluation && (
            <>
              {/* Primary Evaluation Metrics Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* 1. Sunlight & Power */}
                <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-800">
                  <div className="flex items-center justify-between text-xs font-mono text-slate-400 mb-2">
                    <span className="flex items-center gap-1.5 text-amber-400">
                      <Sun className="w-4 h-4" />
                      Solar Insolation
                    </span>
                    <span className="font-semibold text-slate-200">
                      {evaluation.isSunlit ? 'SUNLIT' : 'SHADOWED'}
                    </span>
                  </div>
                  <div className="text-2xl font-bold font-mono tabular-nums text-white">
                    {evaluation.powerPotential}%
                  </div>
                  <div className="text-[11px] text-slate-400 mt-1">
                    Solar Elevation: {evaluation.thermal.solarElevationDeg}° (DEM Horizon: {evaluation.sunHorizonDeg.toFixed(1)}°)
                  </div>
                </div>

                {/* 2. DTE Link */}
                <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-800">
                  <div className="flex items-center justify-between text-xs font-mono text-slate-400 mb-2">
                    <span className="flex items-center gap-1.5 text-cyan-400">
                      <Radio className="w-4 h-4" />
                      Earth Line-of-Sight
                    </span>
                    <span className={`font-semibold uppercase ${
                      evaluation.dte.status === 'clear' ? 'text-emerald-400' : 'text-amber-400'
                    }`}>
                      {evaluation.dte.status}
                    </span>
                  </div>
                  <div className="text-2xl font-bold font-mono tabular-nums text-white">
                    {evaluation.dte.elevationDeg.toFixed(1)}°
                  </div>
                  <div className="text-[11px] text-slate-400 mt-1">
                    Margin: {evaluation.dte.marginDeg.toFixed(1)}° above terrain
                  </div>
                </div>

                {/* 3. Surface Thermal */}
                <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-800">
                  <div className="flex items-center justify-between text-xs font-mono text-slate-400 mb-2">
                    <span className="flex items-center gap-1.5 text-blue-400">
                      <Thermometer className="w-4 h-4" />
                      Surface Thermal
                    </span>
                    <span className="font-semibold text-slate-200">
                      {evaluation.thermal.isPSR ? 'PSR Trap' : 'Insolated'}
                    </span>
                  </div>
                  <div className="text-2xl font-bold font-mono tabular-nums text-white">
                    {evaluation.thermal.tempK} K
                  </div>
                  <div className="text-[11px] text-slate-400 mt-1">
                    Equivalent: {evaluation.thermal.tempC}°C ({evaluation.thermal.tempF}°F)
                  </div>
                </div>
              </div>

              {/* Operational Risk Assessment Matrix */}
              <div>
                <h2 className="text-xs font-mono uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-amber-400" />
                  Operational Risk Matrix & Environmental Constraints
                </h2>

                <div className="border border-slate-800 rounded-xl overflow-hidden divide-y divide-slate-800/80">
                  {/* Risk Row 1 */}
                  <div className="p-3.5 bg-slate-900/40 flex items-center justify-between gap-4">
                    <div>
                      <div className="text-xs font-semibold text-slate-200">
                        Thermal Extreme & Deep Cold-Trap Hazard
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        {evaluation.thermal.isPSR
                          ? 'Site is inside a Permanently Shadowed Region (40 K). High cryogenic risk requiring radioisotope heating.'
                          : 'Standard illumination cycle. Thermal environment stays within nominal operational tolerances.'}
                      </div>
                    </div>
                    <span className={`text-[11px] font-mono px-2.5 py-1 rounded font-bold uppercase ${
                      evaluation.thermalRisk === 'HIGH'
                        ? 'bg-rose-950/80 text-rose-300 border border-rose-800/60'
                        : 'bg-emerald-950/80 text-emerald-300 border border-emerald-800/60'
                    }`}>
                      {evaluation.thermalRisk} RISK
                    </span>
                  </div>

                  {/* Risk Row 2 */}
                  <div className="p-3.5 bg-slate-900/40 flex items-center justify-between gap-4">
                    <div>
                      <div className="text-xs font-semibold text-slate-200">
                        Direct-to-Earth Communication Occultation
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        {evaluation.dte.status === 'blocked'
                          ? `Communication link is blocked (${evaluation.dte.reason}). Surface rover or orbital relay satellite required.`
                          : 'Direct line of sight to Earth Deep Space Network is uninterrupted above the local terrain mask.'}
                      </div>
                    </div>
                    <span className={`text-[11px] font-mono px-2.5 py-1 rounded font-bold uppercase ${
                      evaluation.commsRisk === 'HIGH'
                        ? 'bg-rose-950/80 text-rose-300 border border-rose-800/60'
                        : 'bg-emerald-950/80 text-emerald-300 border border-emerald-800/60'
                    }`}>
                      {evaluation.commsRisk} RISK
                    </span>
                  </div>

                  {/* Risk Row 3 */}
                  <div className="p-3.5 bg-slate-900/40 flex items-center justify-between gap-4">
                    <div>
                      <div className="text-xs font-semibold text-slate-200">
                        Solar Horizon Masking & Low Grazing Angles
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        {evaluation.sunAngleRisk === 'HIGH'
                          ? 'Sun is currently below the local LOLA DEM topographic horizon. Solar arrays generate zero power.'
                          : 'Solar elevation provides positive clearance above surrounding crater ridges.'}
                      </div>
                    </div>
                    <span className={`text-[11px] font-mono px-2.5 py-1 rounded font-bold uppercase ${
                      evaluation.sunAngleRisk === 'HIGH'
                        ? 'bg-rose-950/80 text-rose-300 border border-rose-800/60'
                        : 'bg-emerald-950/80 text-emerald-300 border border-emerald-800/60'
                    }`}>
                      {evaluation.sunAngleRisk} RISK
                    </span>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 px-6 border-t border-slate-800 bg-slate-900/60 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="text-[11px] text-slate-400 font-mono">
            Ground Truth: NASA LROC, LOLA DEM Topography & Astronomy Engine Ephemeris
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={handlePrint}
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-2 transition-colors active:scale-95"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Dossier</span>
            </button>

            <button
              type="button"
              onClick={handleCopyMarkdown}
              className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold flex items-center gap-2 transition-all shadow-md active:scale-95"
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied Briefing!' : 'Copy Briefing'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
