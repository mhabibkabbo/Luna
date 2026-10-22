import React, { useEffect, useMemo, useState } from "react";
import { Sun } from "lucide-react";
import {
  computeCelestialState,
  solarPosition,
} from "../../utils/lunarEphemeris.js";
import { celestialTimeStore } from "../../utils/celestialTime.js";

const STATUS = {
  sunlit: {
    label: "Sunlit",
    cls: "bg-amber-950/80 text-amber-300 border-amber-500/40",
  },
  blocked: {
    label: "Below horizon",
    cls: "bg-rose-950/80 text-rose-300 border-rose-500/40",
  },
  night: {
    label: "Night",
    cls: "bg-slate-900 text-slate-300 border-slate-700",
  },
};

export default function SolarConditionsCard({ latitude, longitude }) {
  const [timeMs, setTimeMs] = useState(() => celestialTimeStore.get().ms);

  useEffect(() => {
    return celestialTimeStore.subscribe(({ ms }) => setTimeMs(ms));
  }, []);

  const sun = useMemo(() => {
    const state = computeCelestialState(timeMs);
    return solarPosition(state, latitude, longitude);
  }, [timeMs, latitude, longitude]);

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
            Geometric horizon
          </div>
          <div className="text-white font-bold">
            0.0°
          </div>
        </div>
      </div>

      <p className="text-[9.5px] text-slate-500 leading-snug">
        Flat geometric-horizon model; terrain shadowing is not included.
      </p>
    </div>
  );
}
