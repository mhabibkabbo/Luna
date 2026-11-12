import React from 'react';
import {
  ShieldCheck,
  Copy,
  Check,
  AlertTriangle,
  CheckCircle2,
  Sun,
  Radio,
  Thermometer,
  Mountain,
  ShieldAlert,
  Rocket,
} from 'lucide-react';
import { getMissionOutcomeMeta } from '../../../data/missions.js';
import { SCORE_PILLAR_METADATA, OVERALL_SCORE_METADATA } from '../../../data/nasaProvenance.js';

export default function FeaturePanelDossierTab({
  missionWindowDays,
  onChangeMissionWindowDays,
  onCopyDossierMarkdown,
  copiedDossier,
  isPlaceholderLocation,
  missionWindowAssessment,
  dossierAssessment,
  solarLightingState,
  sun,
  earthStatusMeta,
  generalLink,
  localThermal,
  terrainMetrics,
  isClps,
  clpsData,
  payloadsList,
}) {
  return (
    <div className="space-y-2.5">
      <div className="p-3 rounded-xl bg-[#0C0D12] border border-slate-800/80 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs font-semibold text-white flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>Mission Feasibility &amp; Readiness Dossier</span>
          </span>
          <div className="flex items-center gap-1.5 shrink-0">
            <div className="flex items-center gap-1 bg-[#050507] p-0.5 rounded-lg border border-slate-800">
              {[7, 14, 28].map((days) => (
                <button
                  key={days}
                  type="button"
                  aria-pressed={missionWindowDays === days}
                  onClick={() => onChangeMissionWindowDays(days)}
                  className={`px-2 py-0.5 rounded text-[10px] font-mono transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/70 ${
                    missionWindowDays === days
                      ? 'bg-cyan-400 text-slate-950 font-bold'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {days}d
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={onCopyDossierMarkdown}
              className="px-2 py-1 rounded bg-[#050507] border border-slate-800 hover:border-slate-700 text-[10px] font-mono text-slate-300 hover:text-white flex items-center gap-1 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/70"
              title="Copy full Mission Dossier as Markdown"
            >
              {copiedDossier ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3 text-slate-400" />}
              <span>{copiedDossier ? 'Copied' : 'Copy MD'}</span>
            </button>
          </div>
        </div>

        {isPlaceholderLocation ? (
          <div className="p-3 rounded-xl bg-[#050507] border border-amber-500/30 text-amber-200 text-xs font-mono space-y-1.5">
            <div className="flex items-center gap-1.5 font-bold text-amber-300">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
              <span>Mission Window Evaluation Withheld</span>
            </div>
            <p className="text-[11px] text-slate-300 leading-relaxed font-sans">
              Official landing coordinates have not been announced by NASA or Firefly Aerospace for Blue Ghost Mission 2. Multi-day solar illumination windows, Earth line-of-sight availability, surface temperatures, and composite landing suitability scores cannot be computed for placeholder coordinates.
            </p>
          </div>
        ) : missionWindowAssessment && (
          <>
            <div
              className={`p-3 rounded-xl border flex items-center justify-between gap-3 ${
                dossierAssessment?.isDataWithheld
                  ? 'bg-slate-950/40 border-slate-800'
                  : dossierAssessment?.isGo
                  ? 'bg-gradient-to-r from-emerald-950/40 via-[#050507] to-[#050507] border-emerald-500/40'
                  : 'bg-gradient-to-r from-amber-950/40 via-[#050507] to-[#050507] border-amber-500/40'
              }`}
            >
              <div className="flex items-start gap-2.5">
                <div
                  className={`p-1.5 rounded-lg border mt-0.5 shrink-0 ${
                    dossierAssessment?.isDataWithheld
                      ? 'bg-slate-900 border-slate-700 text-slate-400'
                      : dossierAssessment?.isGo
                      ? 'bg-emerald-950/80 text-emerald-400 border-emerald-600/60'
                      : 'bg-amber-950/80 text-amber-400 border-amber-600/60'
                  }`}
                >
                  {dossierAssessment?.isGo ? (
                    <CheckCircle2 className="w-4 h-4" />
                  ) : (
                    <AlertTriangle className="w-4 h-4" />
                  )}
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`px-1.5 py-0.5 rounded font-mono font-bold text-[10px] tracking-wider uppercase ${
                        dossierAssessment?.isDataWithheld
                          ? 'bg-slate-800 text-slate-300 border border-slate-700'
                          : dossierAssessment?.isGo
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                          : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                      }`}
                    >
                      {dossierAssessment?.isDataWithheld
                        ? 'DATA WITHHELD'
                        : dossierAssessment?.isGo
                        ? 'STATUS: GO FOR DESCENT'
                        : 'STATUS: CAUTION / CONSTRAINED'}
                    </span>
                    <span className="text-[10px] font-mono text-slate-400">
                      {missionWindowDays}d Window
                    </span>
                  </div>
                  <p className="text-[11px] font-sans text-slate-300 mt-1 leading-snug">
                    {dossierAssessment?.isDataWithheld
                      ? 'Topographic DEM coverage unavailable at these coordinates; suitability cannot be synthesized.'
                      : dossierAssessment?.isGo
                      ? 'Primary operational safety thresholds satisfied for power, RF direct link, and descent.'
                      : 'Identified thermal, illumination, or communication hazards require mitigation.'}
                  </p>
                </div>
              </div>

              <div className="text-right shrink-0 font-mono" title={`How computed: ${OVERALL_SCORE_METADATA.shortHowComputed}`}>
                <span className="text-[9px] text-slate-400 uppercase tracking-wider block">Suitability</span>
                <span
                  className={`text-xl font-bold tabular-nums block ${
                    missionWindowAssessment.windowScore === null
                      ? 'text-slate-400'
                      : dossierAssessment?.isGo
                      ? 'text-emerald-400'
                      : 'text-amber-400'
                  }`}
                >
                  {missionWindowAssessment.windowScore !== null ? `${missionWindowAssessment.windowScore}%` : '--'}
                </span>
                {missionWindowAssessment.windowScore !== null && (
                  <span className="text-[8.5px] font-mono text-amber-300/90 block">
                    {OVERALL_SCORE_METADATA.uncertainty} · 4-factor
                  </span>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2.5 rounded-lg bg-[#050507] border border-slate-800/80 space-y-1">
                <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
                  <span className="flex items-center gap-1 font-semibold text-amber-300">
                    <Sun className="w-3 h-3 text-amber-400" />
                    <span>Solar</span>
                  </span>
                  <span className="text-white font-bold">{missionWindowAssessment.sunlitRatio}%</span>
                </div>
                <div className="text-[11px] font-mono text-slate-200">
                  {solarLightingState?.label || (sun.status === 'sunlit' ? 'Day' : 'Night')}
                </div>
                <div className="text-[9.5px] font-mono text-slate-400">
                  El {sun.elevationDeg != null ? `${sun.elevationDeg.toFixed(1)}°` : '—'} · Max {missionWindowAssessment.longestSunlitHours}h
                </div>
                <div className="pt-1 border-t border-slate-800/60 text-[9px] font-sans text-slate-400 leading-snug">
                  <span className="text-amber-300/90 font-mono font-semibold">{SCORE_PILLAR_METADATA.solar.uncertainty}</span>
                  {' · '}
                  {SCORE_PILLAR_METADATA.solar.howComputed}
                </div>
              </div>

              <div className="p-2.5 rounded-lg bg-[#050507] border border-slate-800/80 space-y-1">
                <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
                  <span className="flex items-center gap-1 font-semibold text-cyan-300">
                    <Radio className="w-3 h-3 text-cyan-400" />
                    <span>Comms</span>
                  </span>
                  <span className="text-white font-bold">{missionWindowAssessment.dsnRatio}%</span>
                </div>
                <div className="text-[11px] font-mono text-slate-200 whitespace-normal break-words leading-tight">
                  {earthStatusMeta.label}
                </div>
                <div className="text-[9.5px] font-mono text-slate-400">
                  Earth {generalLink.elevationDeg != null ? `${generalLink.elevationDeg.toFixed(1)}°` : '—'} · {generalLink.marginDeg != null ? `${generalLink.marginDeg >= 0 ? '+' : ''}${generalLink.marginDeg.toFixed(1)}°` : '—'}
                </div>
                <div className="pt-1 border-t border-slate-800/60 text-[9px] font-sans text-slate-400 leading-snug">
                  <span className="text-amber-300/90 font-mono font-semibold">{SCORE_PILLAR_METADATA.dte.uncertainty}</span>
                  {' · '}
                  {SCORE_PILLAR_METADATA.dte.howComputed}
                </div>
              </div>

              <div className="p-2.5 rounded-lg bg-[#050507] border border-slate-800/80 space-y-1">
                <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
                  <span className="flex items-center gap-1 font-semibold text-rose-300">
                    <Thermometer className="w-3 h-3 text-rose-400" />
                    <span>Thermal</span>
                  </span>
                  <span className="text-white font-bold">
                    {localThermal?.tempC != null ? `${localThermal.tempC.toFixed(0)}°C` : '—'}
                  </span>
                </div>
                <div className="text-[11px] font-mono text-slate-200">
                  {localThermal?.tempC != null ? `${(localThermal.tempC + 273.15).toFixed(0)} K` : '—'}
                </div>
                <div className="text-[9.5px] font-mono text-slate-400">
                  {missionWindowAssessment.minTemp}° to {missionWindowAssessment.maxTemp}°C
                </div>
                <div className="pt-1 border-t border-slate-800/60 text-[9px] font-sans text-slate-400 leading-snug">
                  <span className="text-amber-300/90 font-mono font-semibold">{SCORE_PILLAR_METADATA.thermal.uncertainty}</span>
                  {' · '}
                  {SCORE_PILLAR_METADATA.thermal.howComputed}
                </div>
              </div>

              <div className="p-2.5 rounded-lg bg-[#050507] border border-slate-800/80 space-y-1">
                <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
                  <span className="flex items-center gap-1 font-semibold text-purple-300">
                    <Mountain className="w-3 h-3 text-purple-400" />
                    <span>Terrain</span>
                  </span>
                  <span className="text-white font-bold">
                    {terrainMetrics?.slopeDeg != null ? `${terrainMetrics.slopeDeg.toFixed(1)}°` : '—'}
                  </span>
                </div>
                <div className="text-[11px] font-mono text-slate-200">
                  {terrainMetrics?.elevationM != null
                    ? `${Math.round(terrainMetrics.elevationM).toLocaleString()} m`
                    : 'Not in DEM'}
                </div>
                <div className="text-[9.5px] font-mono text-slate-400">
                  {terrainMetrics?.roughnessM != null ? `Roughness ${terrainMetrics.roughnessM.toFixed(1)} m` : '360° Profile'}
                </div>
                <div className="pt-1 border-t border-slate-800/60 text-[9px] font-sans text-slate-400 leading-snug">
                  <span className="text-amber-300/90 font-mono font-semibold">{SCORE_PILLAR_METADATA.slope.uncertainty}</span>
                  {' · '}
                  {SCORE_PILLAR_METADATA.slope.howComputed}
                </div>
              </div>
            </div>

            <div className="space-y-1 pt-1">
              <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
                <span>Daily Suitability Progression</span>
                <span>{missionWindowDays}d Timeline</span>
              </div>
              <div className="grid grid-cols-7 gap-1">
                {missionWindowAssessment.dailyScores.map((d) => (
                  <div
                    key={d.day}
                    title={`Day +${d.day}: Score ${d.score}%, Sun ${d.sunlitPct}%, DSN ${d.dsnPct}%`}
                    className={`h-6 rounded flex items-center justify-center font-mono text-[9px] font-bold tabular-nums ${
                      d.score >= 80
                        ? 'bg-emerald-500/80 text-slate-950'
                        : d.score >= 50
                        ? 'bg-cyan-500/80 text-slate-950'
                        : 'bg-rose-500/60 text-white'
                    }`}
                  >
                    d{d.day}
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-1.5 pt-1.5 border-t border-slate-800/80">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-white">
                <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
                <span>Operational Hazard Matrix</span>
              </div>
              {!dossierAssessment?.risks || dossierAssessment.risks.length === 0 ? (
                <div className="p-2 rounded-lg bg-emerald-950/20 border border-emerald-800/40 text-emerald-300 text-[11px] font-sans flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-emerald-400" />
                  <span>All primary operational safety constraints satisfied with zero critical flags.</span>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {dossierAssessment.risks.map((risk, index) => (
                    <div
                      key={index}
                      className="p-2 rounded-lg bg-[#050507] border border-slate-800/80 flex items-start gap-2"
                    >
                      <span
                        className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold uppercase mt-0.5 shrink-0 ${
                          risk.severity === 'HIGH'
                            ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                            : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        }`}
                      >
                        {risk.severity}
                      </span>
                      <div className="min-w-0">
                        <h5 className="text-[11px] font-sans font-semibold text-white leading-tight">
                          {risk.title}
                        </h5>
                        <p className="text-[10px] font-sans text-slate-400 mt-0.5 leading-snug">
                          {risk.desc}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {isClps && clpsData && (
        <div className="p-2.5 rounded-xl bg-[#0C0D12] border border-slate-800/80 space-y-2">
          {(() => {
            const outcomeMeta = getMissionOutcomeMeta(clpsData);
            return (
              <>
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="text-xs font-semibold text-white flex items-center gap-1.5">
                    <Rocket className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                    <span>{clpsData.taskOrder || 'CLPS Mission Architecture'}</span>
                  </span>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className={`px-1.5 py-0.5 rounded border text-[9px] font-mono font-bold uppercase tracking-wider ${outcomeMeta.badgeClass}`}>
                      {outcomeMeta.label}
                    </span>
                    <span className="text-[10px] font-mono text-emerald-400">
                      {clpsData.provider} · {clpsData.lander}
                    </span>
                  </div>
                </div>
                {outcomeMeta.reason && (
                  <p className="text-[10px] leading-snug text-slate-300 bg-slate-900/70 border border-slate-800/80 rounded-lg px-2 py-1">
                    <span className="text-slate-400 font-medium">Outcome: </span>
                    {outcomeMeta.reason}
                  </p>
                )}
              </>
            );
          })()}
          {payloadsList.length > 0 && (
            <div className="space-y-1 pt-1 border-t border-slate-800/70">
              <span className="text-[10px] font-mono text-slate-400 block">
                Payloads Manifest ({payloadsList.length})
              </span>
              <div className="flex flex-wrap gap-1">
                {payloadsList.map((p, idx) => {
                  const pName = typeof p === 'string' ? p : p.name;
                  return (
                    <span
                      key={idx}
                      className="text-[10px] font-mono text-cyan-300 bg-[#050507] px-2 py-0.5 rounded border border-slate-800"
                    >
                      {pName}
                    </span>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
