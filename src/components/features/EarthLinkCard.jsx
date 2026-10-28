import React, { useEffect, useMemo, useState } from "react";
import { Radio } from "lucide-react";
import { computeCelestialState } from "../../utils/lunarEphemeris.js";
import { celestialTimeStore } from "../../utils/celestialTime.js";
import { HORIZON_TABLE, horizonAt } from "../../utils/horizons.js";
import {
  DEFAULT_DTE_CONSTRAINTS,
  LINK_REASON_LABELS,
  earthSlewRates,
  evaluateEarthLink,
  sweepEarthLink,
} from "../../utils/earthLink.js";
import { calculateEarthTransition } from "../../utils/transitionTimes.js";

const HOUR_MS = 3600000;
const HOURS_BEFORE = 2;
const HOURS_AFTER = 5;

const STATUS_STYLE = {
  clear: { label: "Link", dot: "#1dffac", cls: "text-emerald-300" },
  doubtful: { label: "Marginal", dot: "#facc15", cls: "text-yellow-300" },
  blocked: { label: "No link", dot: "#f43f5e", cls: "text-rose-300" },
};

const hhmm = (ms) =>
  new Date(ms).toISOString().slice(11, 16);

/** Side view along Earth's azimuth: ground, terrain horizon, antenna minimum and the ray to Earth. */
function EarthElevationDiagram({ look, constraints }) {
  const W = 240;
  const H = 180;
  const gx = 34;
  const gy = 146;
  const len = 120;
  const el = Math.max(-12, Math.min(80, look.elevationDeg));
  const point = (deg, l = len) => [
    gx + l * Math.cos((deg * Math.PI) / 180),
    gy - l * Math.sin((deg * Math.PI) / 180),
  ];
  const [ex, ey] = point(el);
  const [mx, my] = point(constraints.minEarthElevationDeg);
  const terrain = look.terrainHorizonDeg;
  const [tx, ty] = point(terrain ?? 0);
  const arcR = 26;
  const [ax, ay] = point(el, arcR);
  const sweep = el >= 0 ? 0 : 1;
  const color = STATUS_STYLE[look.status].dot;
  // Earth drawn at a legible size; the true disc is only ~1.9° across.
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full h-auto rounded-lg bg-slate-950/70 border border-slate-800/80"
      role="img"
      aria-label={`Earth is ${look.elevationDeg.toFixed(1)} degrees above the horizon at azimuth ${look.azimuthDeg.toFixed(0)} degrees`}
    >
      <rect x="0" y={gy} width={W} height={H - gy} fill="#1e293b" />
      <line x1="0" x2={W} y1={gy} y2={gy} stroke="#94a3b8" strokeWidth="1" />
      {terrain !== null && terrain > 0 && (
        <>
          <line x1={gx} y1={gy} x2={tx} y2={ty} stroke="#fa5215" strokeWidth="1" strokeDasharray="3 3" />
          <text x={tx - 4} y={ty - 3} fontSize="7" fill="#fa5215" textAnchor="end">
            terrain {terrain.toFixed(1)}°
          </text>
        </>
      )}
      <line x1={gx} y1={gy} x2={mx} y2={my} stroke="#64748b" strokeWidth="0.8" strokeDasharray="1.5 3" />
      <text x={mx - 4} y={my - 3} fontSize="7" fill="#64748b" textAnchor="end">
        min {constraints.minEarthElevationDeg}°
      </text>
      <line x1={gx} y1={gy} x2={ex} y2={ey} stroke={color} strokeWidth="1.4" />
      <path d={`M ${gx + arcR} ${gy} A ${arcR} ${arcR} 0 0 ${sweep} ${ax} ${ay}`} fill="none" stroke={color} strokeWidth="1" />
      <text x={gx + arcR + 4} y={gy - 4} fontSize="8" fill="#e2e8f0">
        {look.elevationDeg.toFixed(1)}°
      </text>
      <circle cx={ex} cy={ey} r="8" fill="#2563eb" stroke="#bfdbfe" strokeWidth="1" fillOpacity={look.elevationDeg < 0 ? 0.35 : 1} />
      <path d={`M ${ex - 4} ${ey - 2} q 3 -3 6 0 q -1 4 -4 5 z`} fill="#22c55e" fillOpacity={look.elevationDeg < 0 ? 0.35 : 0.9} />
      <circle cx={gx} cy={gy} r="2.6" fill="#fbbf24" stroke="#fff" strokeWidth="0.6" />
      <text x="4" y={H - 4} fontSize="7" fill="#94a3b8">horizon</text>
    </svg>
  );
}

export default function EarthLinkCard({ moonFeature, earthFeature = null }) {
  const siteId = moonFeature.id;
  const [timeMs, setTimeMs] = useState(() => celestialTimeStore.get().ms);
  const [outlook, setOutlook] = useState(null);
  const constraints = DEFAULT_DTE_CONSTRAINTS;

  useEffect(() => celestialTimeStore.subscribe(({ ms }) => setTimeMs(ms)), []);

  const terrainFn = useMemo(() => (az) => horizonAt(HORIZON_TABLE, siteId, az), [siteId]);

  const look = useMemo(() => {
    try {
      const state = computeCelestialState(timeMs);
      return evaluateEarthLink({ state, moonFeature, earthFeature, constraints, terrainFn });
    } catch (error) {
      console.error("Earth link calculation failed.", error);
      return null;
    }
  }, [timeMs, moonFeature, earthFeature, constraints, terrainFn]);

  const hourIndex = Math.floor(timeMs / HOUR_MS);
  const rows = useMemo(() => {
    const result = [];
    for (let offset = -HOURS_BEFORE; offset <= HOURS_AFTER; offset++) {
      const ms = (hourIndex + offset) * HOUR_MS;
      try {
        const rates = earthSlewRates(moonFeature, ms);
        const evaluated = evaluateEarthLink({
          state: computeCelestialState(ms),
          moonFeature,
          earthFeature,
          constraints,
          terrainFn,
          slewDegPerHour: Math.max(rates.azimuthDegPerHour, rates.elevationDegPerHour),
        });
        result.push({ ms, offset, ...evaluated });
      } catch (error) {
        console.error("Earth link row failed.", error);
      }
    }
    return result;
  }, [hourIndex, moonFeature, earthFeature, constraints, terrainFn]);

  // 30-day outlook, anchored when the site or station changes.
  useEffect(() => {
    const controller = new AbortController();
    setOutlook(null);
    sweepEarthLink({
      moonFeature,
      earthFeature,
      startMs: celestialTimeStore.get().ms,
      days: 30,
      stepMin: 60,
      constraints,
      terrainFn,
      signal: controller.signal,
    })
      .then((result) => {
        if (!result) return;
        const n = result.visibility.length;
        const count = (predicate) => result.visibility.filter(predicate).length;
        setOutlook({
          linkPct: (count((s) => s === "clear") / n) * 100,
          visiblePct: (result.reasons.filter((r) => r !== "below-horizon").length / n) * 100,
        });
      })
      .catch((error) => console.error("Earth link outlook failed.", error));
    return () => controller.abort();
  }, [moonFeature, earthFeature, constraints, terrainFn]);

  // Compute upcoming Earthset/Earthrise transition & DTE window duration
  const earthTransition = useMemo(() => {
    return calculateEarthTransition(timeMs, moonFeature, earthFeature, constraints);
  }, [timeMs, moonFeature, earthFeature, constraints]);
  if (!look) return null;
  const badge = STATUS_STYLE[look.status];
  const target = earthFeature ? earthFeature.name : "Earth (centre)";

  return (
    <div className="bg-slate-900/60 p-2.5 rounded-xl border border-slate-800/80 space-y-2.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-[10px] font-mono text-slate-400 uppercase tracking-wider">
          <Radio className="w-3.5 h-3.5 text-sky-400" />
          <span>Direct-To-Earth (DTE) Link</span>
        </div>
        <span className={`text-[10px] font-mono ${badge.cls}`}>
          <span aria-hidden="true">● </span>
          {badge.label}
        </span>
      </div>

      {/* Prominent Operational DTE Countdown: Earthset / Earthrise / Permanent LOS */}
      <div className={`p-2 rounded-lg border text-xs font-mono flex items-center justify-between ${
        earthTransition.isLinked
          ? "bg-sky-950/40 border-sky-500/30 text-sky-200"
          : "bg-slate-950/60 border-slate-800 text-slate-300"
      }`}>
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${
            earthTransition.isLinked ? "bg-emerald-400 animate-pulse" : "bg-rose-500"
          }`} />
          <div>
            <span className="text-[10px] uppercase tracking-wider text-slate-400 block font-sans">
              {earthTransition.status === 'perpetual_los'
                ? 'DTE Link Continuity'
                : earthTransition.status === 'farside'
                ? 'Relay Satellite Requirement'
                : earthTransition.nextEvent === 'earthset'
                ? 'Time Until Earthset (LOS)'
                : 'Time Until Earthrise (AOS)'}
            </span>
            <span className="font-bold text-sm text-white">
              {earthTransition.formattedDuration}
            </span>
          </div>
        </div>
        <div className="text-right">
          <span className="text-[9.5px] uppercase tracking-wider text-slate-400 block font-sans">
            Link Margin
          </span>
          <span className={`font-bold text-xs ${
            look.marginDeg > 0 ? 'text-emerald-400' : 'text-rose-400'
          }`}>
            {look.marginDeg > 0 ? `+${look.marginDeg.toFixed(1)}°` : `${look.marginDeg.toFixed(1)}°`}
          </span>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2 pt-1 border-t border-slate-800/80 font-mono">
        <div>
          <div className="text-[9.5px] text-slate-500 font-sans">Earth elevation</div>
          <div className="text-white font-bold">{look.elevationDeg.toFixed(1)}°</div>
        </div>
        <div>
          <div className="text-[9.5px] text-slate-500 font-sans">Azimuth</div>
          <div className="text-white font-bold">{look.azimuthDeg.toFixed(0)}°</div>
        </div>
        <div>
          <div className="text-[9.5px] text-slate-500 font-sans">Terrain horizon</div>
          <div className="text-white font-bold">
            {look.terrainHorizonDeg === null ? "n/a" : `${look.terrainHorizonDeg.toFixed(1)}°`}
          </div>
        </div>
      </div>

      <EarthElevationDiagram look={look} constraints={constraints} />

      <p className={`text-[10px] leading-snug ${badge.cls}`}>
        {LINK_REASON_LABELS[look.reason]}
        <span className="text-slate-500"> · target: {target}</span>
        {look.stationElevationDeg !== null && (
          <span className="text-slate-500"> · Moon is {look.stationElevationDeg.toFixed(1)}° above the station horizon</span>
        )}
      </p>

      <div className="border-t border-slate-800/80 pt-1.5">
        <div className="text-[9.5px] font-mono uppercase tracking-wider text-slate-400 mb-1">
          DTE link · UTC
        </div>
        <ul className="space-y-0.5 font-mono text-[10.5px]" aria-label="Hourly direct-to-Earth link availability">
          {rows.map((row) => {
            const s = STATUS_STYLE[row.status];
            return (
              <li
                key={row.ms}
                className={`flex items-center gap-2 rounded px-1.5 py-0.5 ${
                  row.offset === 0 ? "bg-slate-800/70" : ""
                }`}
              >
                <span className="text-slate-300 w-10">{hhmm(row.ms)}</span>
                <span aria-hidden="true" style={{ color: s.dot }}>●</span>
                <span className={`${s.cls} w-14`}>{s.label}</span>
                <span className="text-slate-500 tabular-nums w-14 text-right">
                  {row.elevationDeg.toFixed(1)}°
                </span>
                <span className="text-slate-500 truncate font-sans text-[9.5px]">
                  {row.reason === "ok" ? "" : LINK_REASON_LABELS[row.reason]}
                </span>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="text-[9.5px] text-slate-500 leading-snug space-y-0.5">
        {outlook ? (
          <p>
            Next 30 days: Earth above the horizon {outlook.visiblePct.toFixed(0)}% of the time · link available{" "}
            {outlook.linkPct.toFixed(0)}%.
          </p>
        ) : (
          <p>Calculating 30-day outlook…</p>
        )}
        <p>
          Assumed constraints: Earth ≥ {constraints.minEarthElevationDeg}° elevation, station mask{" "}
          {constraints.stationMinElevationDeg}°, zenith keyhole above {constraints.antennaMaxElevationDeg}°, slew ≤{" "}
          {constraints.maxSlewDegPerHour}°/h.{" "}
          {look.terrainHorizonDeg === null
            ? "No terrain data for this site, so terrain is not included."
            : "Terrain from the LOLA horizon profile."}{" "}
          Geometry only: no atmosphere, link budget or station schedules.
        </p>
      </div>
    </div>
  );
}
