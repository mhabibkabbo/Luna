import React, { useEffect, useMemo, useState } from "react";
import { Sun } from "lucide-react";
import {
  computeCelestialState,
  solarPosition,
} from "../../utils/lunarEphemeris.js";
import { loadHorizons, horizonAt } from "../../utils/horizons.js";
import { sweepIllumination } from "../../utils/illumination.js";

const STATUS = {
  sunlit: {
    label: "Sunlit",
    cls: "bg-amber-950/80 text-amber-300 border-amber-500/40",
  },
  blocked: {
    label: "Blocked by terrain",
    cls: "bg-rose-950/80 text-rose-300 border-rose-500/40",
  },
  night: {
    label: "Night",
    cls: "bg-slate-900 text-slate-300 border-slate-700",
  },
};

export default function SolarConditionsCard({ siteId, latitude, longitude }) {
  const [now, setNow] = useState(() => new Date());
  const [table, setTable] = useState(null);
  const [timeline, setTimeline] = useState(null);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    let alive = true;
    loadHorizons().then((t) => alive && setTable(t));
    return () => {
      alive = false;
    };
  }, []);

  const modeled = Boolean(table?.[siteId]);

  const sun = useMemo(() => {
    const state = computeCelestialState(now);
    const flat = solarPosition(state, latitude, longitude);
    const hz = horizonAt(table, siteId, flat.azimuthDeg);
    return {
      ...(hz == null ? flat : solarPosition(state, latitude, longitude, hz)),
      horizonDeg: hz,
    };
  }, [now, latitude, longitude, table, siteId]);

  // 30-day sweep, once per site (cached per day)
  useEffect(() => {
    if (table === null) return undefined;
    let alive = true;
    setTimeline(null);
    sweepIllumination({
      key: siteId,
      lat: latitude,
      lon: longitude,
      horizonFn: (az) => horizonAt(table, siteId, az) ?? 0,
    }).then((r) => alive && setTimeline(r));
    return () => {
      alive = false;
    };
  }, [table, siteId, latitude, longitude]);

  const strip = useMemo(() => {
    if (!timeline) return null;
    const { sunlit } = timeline;
    const rects = [];
    let i = 0;
    while (i < sunlit.length) {
      if (!sunlit[i]) {
        i++;
        continue;
      }
      let j = i;
      while (j < sunlit.length && sunlit[j]) j++;
      rects.push([i, j - i]);
      i = j;
    }
    return { rects, n: sunlit.length };
  }, [timeline]);

  const badge = STATUS[sun.status];

  return (
    <div className="bg-slate-900/60 p-2.5 rounded-xl border border-slate-800/80 space-y-1.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-[10px] font-mono text-slate-400 uppercase tracking-wider">
          <Sun className="w-3 h-3 text-amber-400" />
          <span>Solar Conditions (Live)</span>
        </div>
        <span
          className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${badge.cls}`}
        >
          {badge.label}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2 pt-1 border-t border-slate-800/80 font-mono">
        <div>
          <div className="text-[9.5px] text-slate-500 font-sans">
            Sun elevation
          </div>
          <div className="text-white font-bold">
            {sun.elevationDeg.toFixed(2)}°
          </div>
        </div>
        <div>
          <div className="text-[9.5px] text-slate-500 font-sans">
            Sun azimuth
          </div>
          <div className="text-white font-bold">
            {sun.azimuthDeg.toFixed(1)}°
          </div>
        </div>
        <div>
          <div className="text-[9.5px] text-slate-500 font-sans">
            Terrain horizon
          </div>
          <div className="text-white font-bold">
            {sun.horizonDeg == null ? "—" : `${sun.horizonDeg.toFixed(1)}°`}
          </div>
        </div>
      </div>

      {strip && (
        <div className="pt-1.5 border-t border-slate-800/80">
          <div className="flex items-center justify-between text-[9.5px] text-slate-500 mb-1">
            <span>Next 30 days</span>
            <span className="font-mono text-slate-300">
              {timeline.sunlitPct.toFixed(0)}% sunlit · longest dark{" "}
              {Math.round(timeline.longestDarkHours)} h
            </span>
          </div>
          <svg
            viewBox={`0 0 ${strip.n} 1`}
            preserveAspectRatio="none"
            className="w-full h-3 rounded bg-slate-950"
          >
            {strip.rects.map(([x, w]) => (
              <rect key={x} x={x} y="0" width={w} height="1" fill="#fbbf24" />
            ))}
          </svg>
        </div>
      )}

      <p className="text-[9.5px] text-slate-500 leading-snug">
        {modeled
          ? "Terrain horizon from LOLA DEM (1° azimuth steps, ~40 km radius). Approximate."
          : "Flat-horizon model. Terrain shadowing not available for this site."}
      </p>
    </div>
  );
}
