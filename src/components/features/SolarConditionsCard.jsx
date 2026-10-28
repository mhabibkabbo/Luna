import React, { useEffect, useMemo, useState } from "react";
import { Sun, AlertTriangle } from "lucide-react";
import {
  computeCelestialState,
  solarPosition,
} from "../../utils/lunarEphemeris.js";
import { celestialTimeStore } from "../../utils/celestialTime.js";
import {
  HORIZON_TABLE,
  getHorizonProfile,
  horizonAt,
} from "../../utils/horizons.js";
import HorizonProfileChart from "./HorizonProfileChart.jsx";
import { calculateSolarTransition } from "../../utils/transitionTimes.js";

const STATUS = {
  sunlit: {
    label: "Sunlit",
    cls: "bg-emerald-950/80 text-emerald-300 border-emerald-500/40",
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
  const [timeMs, setTimeMs] = useState(() => celestialTimeStore.get().ms);
  // The Sun track is anchored when the site is selected, so scrubbing time moves only the "now" dot.
  const [trackStartMs, setTrackStartMs] = useState(
    () => celestialTimeStore.get().ms,
  );

  useEffect(() => {
    setTrackStartMs(celestialTimeStore.get().ms);
  }, [siteId, latitude, longitude]);

  useEffect(() => {
    return celestialTimeStore.subscribe(({ ms }) => setTimeMs(ms));
  }, []);

  const profile = getHorizonProfile(HORIZON_TABLE, siteId);

  const { sun, terrainHorizon } = useMemo(() => {
    const state = computeCelestialState(timeMs);
    const flat = solarPosition(state, latitude, longitude);
    const hz = horizonAt(HORIZON_TABLE, siteId, flat.azimuthDeg);
    return {
      sun: solarPosition(state, latitude, longitude, hz ?? 0),
      terrainHorizon: hz,
    };
  }, [timeMs, siteId, latitude, longitude]);

  // Compute upcoming sunset/sunrise transition & solar power generation potential
  const solarTransition = useMemo(() => {
    return calculateSolarTransition(timeMs, latitude, longitude, siteId);
  }, [timeMs, latitude, longitude, siteId]);

  const badge = STATUS[sun.status];
  const quality = profile?.quality;

  return (
    <div className="bg-slate-900/60 p-2.5 rounded-xl border border-slate-800/80 space-y-2.5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-[10px] font-mono text-slate-400 uppercase tracking-wider">
          <Sun className="w-3.5 h-3.5 text-amber-400" />
          <span>Solar Conditions & Power</span>
        </div>
        <span
          className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${badge.cls}`}
        >
          {badge.label}
        </span>
      </div>

      {/* Prominent Operational Countdown: Time Remaining Before Sunset / Sunrise */}
      <div className={`p-2 rounded-lg border text-xs font-mono flex items-center justify-between ${
        solarTransition.isCurrentlySunlit
          ? "bg-amber-950/40 border-amber-500/30 text-amber-200"
          : "bg-slate-950/60 border-slate-800 text-slate-300"
      }`}>
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${
            solarTransition.isCurrentlySunlit ? "bg-amber-400 animate-pulse" : "bg-slate-600"
          }`} />
          <div>
            <span className="text-[10px] uppercase tracking-wider text-slate-400 block font-sans">
              {solarTransition.nextEvent === 'sunset' ? 'Time Until Sunset (Power Window)' : 'Time Until Sunrise (Darkness Period)'}
            </span>
            <span className="font-bold text-sm text-white">
              {solarTransition.formattedDuration}
            </span>
          </div>
        </div>
        <div className="text-right">
          <span className="text-[9.5px] uppercase tracking-wider text-slate-400 block font-sans">
            Power Potential
          </span>
          <span className={`font-bold text-xs ${
            solarTransition.powerEfficiencyPct > 50 ? 'text-emerald-400' : (solarTransition.powerEfficiencyPct > 0 ? 'text-amber-400' : 'text-slate-500')
          }`}>
            {solarTransition.isCurrentlySunlit ? `${solarTransition.powerEfficiencyPct}%` : '0% (Night)'}
          </span>
        </div>
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
            {terrainHorizon === null ? "n/a" : `${terrainHorizon.toFixed(1)}°`}
          </div>
        </div>
      </div>

      {profile?.horizon ? (
        <>
          <HorizonProfileChart
            siteId={siteId}
            latitude={latitude}
            longitude={longitude}
            currentSun={sun}
            startMs={trackStartMs}
          />
          {(quality === "partial" || quality === "enclosed") && (
            <div className="flex items-start gap-1.5 text-[9.5px] text-amber-300/90 leading-snug">
              <AlertTriangle className="w-3 h-3 shrink-0 mt-px" />
              <span>
                {quality === "partial"
                  ? `DEM covers only ${Math.round((profile.coverage ?? 0) * 100)}% of the 40 km search radius; some directions may be underestimated.`
                  : "Horizon is above 5° in every direction, so this location may sit inside a crater. Check the site coordinates."}
              </span>
            </div>
          )}
          <p className="text-[9.5px] text-slate-500 leading-snug">
            Terrain horizon: LRO LOLA DEM ({profile.dem ?? "NASA PDS"}),{" "}
            {profile.step_deg ?? 1}° azimuth steps within{" "}
            {profile.maxDistKm ?? 40} km. Sun's upper limb is used.
          </p>
        </>
      ) : (
        <p className="text-[9.5px] text-slate-500 leading-snug">
          No terrain data for this site yet. Using a flat 0° horizon; terrain
          shadowing is not included.
        </p>
      )}
    </div>
  );
}
