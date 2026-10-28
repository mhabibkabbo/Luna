import React, { useMemo } from "react";
import {
  computeCelestialState,
  solarPosition,
} from "../../utils/lunarEphemeris.js";
import {
  HORIZON_TABLE,
  getHorizonProfile,
  horizonAt,
} from "../../utils/horizons.js";

const W = 360; // 1 SVG unit = 1° azimuth
const H = 110;
const PAD_TOP = 6;
const PAD_BOTTOM = 14;
const PATH_DAYS = 30;
const PATH_STEP_H = 3;

/**
 * Horizon profile (terrain elevation vs azimuth) with the Sun's track for the next 30 days.
 * Dots above the terrain line are visible Sun positions; dots below it are blocked.
 */
export default function HorizonProfileChart({
  siteId,
  latitude,
  longitude,
  currentSun,
  startMs,
}) {
  const profile = getHorizonProfile(HORIZON_TABLE, siteId);

  const data = useMemo(() => {
    const terrain = [];
    for (let az = 0; az <= 360; az += 1) {
      terrain.push({ az, h: horizonAt(HORIZON_TABLE, siteId, az) });
    }

    const track = [];
    const steps = (PATH_DAYS * 24) / PATH_STEP_H;
    for (let i = 0; i < steps; i++) {
      const state = computeCelestialState(startMs + i * PATH_STEP_H * 3600000);
      const flat = solarPosition(state, latitude, longitude);
      const hz = horizonAt(HORIZON_TABLE, siteId, flat.azimuthDeg) ?? 0;
      const pos = solarPosition(state, latitude, longitude, hz);
      // Only plot Sun positions that are plausibly interesting (near or above the horizon)
      if (flat.elevationDeg > -3) {
        track.push({
          az: pos.azimuthDeg,
          el: pos.elevationDeg,
          status: pos.status,
        });
      }
    }
    return { terrain, track };
  }, [siteId, latitude, longitude, startMs]);

  const modeled = Boolean(profile?.horizon);

  // Y range covers terrain and sun track, always including 0°
  const values = [0, ...data.track.map((p) => p.el)];
  data.terrain.forEach((p) => p.h !== null && values.push(p.h));
  const yMin = Math.floor(Math.min(...values) - 1);
  const yMax = Math.ceil(Math.max(...values) + 1);
  const plotH = H - PAD_TOP - PAD_BOTTOM;
  const y = (deg) => PAD_TOP + ((yMax - deg) / (yMax - yMin)) * plotH;

  const terrainPoints = data.terrain
    .map((p) => `${p.az},${y(p.h ?? 0)}`)
    .join(" ");
  const terrainPolygon = `0,${y(yMin)} ${terrainPoints} 360,${y(yMin)}`;

  const colorFor = (status) =>
    status === "sunlit"
      ? "#19cc16"
      : status === "blocked"
        ? "#fa5215"
        : "#64748b";

  const ticks = [0, 90, 180, 270, 360];
  const labels = { 0: "N", 90: "E", 180: "S", 270: "W", 360: "N" };

  return (
    <div className="space-y-1">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="w-full h-[110px] rounded-lg bg-slate-950/70 border border-slate-800/80"
        role="img"
        aria-label="Terrain horizon profile with the Sun's track over the next 30 days"
      >
        {/* Grid: 0° line and azimuth ticks */}
        {ticks.map((t) => (
          <line
            key={t}
            x1={t}
            x2={t}
            y1={PAD_TOP}
            y2={H - PAD_BOTTOM}
            stroke="#1e293b"
            strokeWidth="0.5"
          />
        ))}
        <line
          x1="0"
          x2={W}
          y1={y(0)}
          y2={y(0)}
          stroke="#475569"
          strokeWidth="0.6"
          strokeDasharray="3 3"
        />

        {/* Terrain silhouette */}
        {modeled ? (
          <>
            <polygon
              points={terrainPolygon}
              fill="#334155"
              fillOpacity="0.85"
            />
            <polyline
              points={terrainPoints}
              fill="none"
              stroke="#94a3b8"
              strokeWidth="0.9"
            />
          </>
        ) : null}

        {/* Sun track */}
        {data.track.map((p, i) => (
          <circle
            key={i}
            cx={p.az}
            cy={y(p.el)}
            r="1.1"
            fill={colorFor(p.status)}
            fillOpacity="0.85"
          />
        ))}

        {/* Current Sun */}
        {currentSun && currentSun.elevationDeg > yMin - 1 && (
          <circle
            cx={currentSun.azimuthDeg}
            cy={y(currentSun.elevationDeg)}
            r="3.2"
            fill="#fbbf24"
            stroke="#ffffff"
            strokeWidth="0.8"
          />
        )}

        {/* Axis labels */}
        {ticks.map((t) => (
          <text
            key={`l${t}`}
            x={t === 0 ? 3 : t === 360 ? W - 3 : t}
            y={H - 3}
            fontSize="7"
            fill="#94a3b8"
            textAnchor={t === 0 ? "start" : t === 360 ? "end" : "middle"}
          >
            {labels[t]} {t % 360 === 0 && t === 360 ? "" : `${t}°`}
          </text>
        ))}
        <text
          x={W - 3}
          y={y(0) - 2}
          fontSize="6.5"
          fill="#94a3b8"
          textAnchor="end"
        >
          0°
        </text>
      </svg>

      <div className="flex items-center justify-between text-[9.5px] text-slate-500">
        <span className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1">
            <i className="h-2 w-2 rounded-full bg-[#19cc16]" /> visible
          </span>
          <span className="inline-flex items-center gap-1">
            <i className="h-2 w-2 rounded-full bg-[#fa5215]" /> blocked
          </span>
          <span className="inline-flex items-center gap-1">
            <i className="h-2 w-2 rounded-full bg-amber-400" /> now
          </span>
        </span>
        <span>
          Sun track: next {PATH_DAYS} d · y: {yMin}° to {yMax}°
        </span>
      </div>
    </div>
  );
}
