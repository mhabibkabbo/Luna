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

  const badge = STATUS[sun.status];
  const quality = profile?.quality;

  return (
    <div className="bg-slate-900/60 p-2.5 rounded-xl border border-slate-800/80 space-y-2">
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
