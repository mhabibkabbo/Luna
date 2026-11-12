import React, { useMemo, useState, useEffect, useId } from "react";
import { Eye, HelpCircle, Compass, AlertTriangle, CheckCircle2 } from "lucide-react";
import {
  computeCelestialState,
  solarPosition,
} from "../../utils/lunarEphemeris.js";
import {
  earthLookFromMoon,
} from "../../utils/earthLink.js";
import {
  HORIZON_TABLE,
  getHorizonProfile,
  horizonAt,
  ensurePolarDemLoaded,
} from "../../utils/horizons.js";
import {
  COMMUNICATION_TIMELINE_COLORS,
  SUNLIGHT_TIMELINE_COLORS,
} from "../../utils/visibilityColors.js";

const W = 360;
const H = 230;
const PAD_TOP = 14;
const PAD_BOTTOM = 24;
const PAD_LEFT = 32;
const PAD_RIGHT = 4;
const PLOT_H = H - PAD_TOP - PAD_BOTTOM;
const PLOT_W = W - PAD_LEFT - PAD_RIGHT;
const MAX_ELEVATION = 90;
const HORIZON_Y = H - PAD_BOTTOM;
const ELEVATION_TICKS = [0, 10, 30, 60, 90];
const ELEVATION_LOG_FACTOR = 2;
const PATH_DAYS = 30;
const PATH_STEP_H = 3;
const HOURS_PER_DAY = 24;
const AZIMUTH_TICKS = [0, 90, 180, 270, 360];
const AZIMUTH_LABELS = { 0: "N", 90: "E", 180: "S", 270: "W", 360: "N" };

const sunColor = (status) => SUNLIGHT_TIMELINE_COLORS[status] || "#fde68a";
const earthColor = (status) => COMMUNICATION_TIMELINE_COLORS[status] || "#60a5fa";
const earthTrackColor = (status) => COMMUNICATION_TIMELINE_COLORS[status] || "#60a5fa";

function smoothTrackSegments(track, x, y, colorFor) {
  return track.slice(1).flatMap((point, index) => {
    const previous = track[index];
    if (
      !previous.visible ||
      !point.visible ||
      Math.abs(point.azimuth - previous.azimuth) > 180
    ) {
      return [];
    }

    const before = track[index - 1];
    const after = track[index + 2];
    const useBefore =
      before?.visible && Math.abs(previous.azimuth - before.azimuth) <= 180
        ? before
        : previous;
    const useAfter =
      after?.visible && Math.abs(after.azimuth - point.azimuth) <= 180
        ? after
        : point;
    const x0 = x(previous.azimuth);
    const y0 = y(previous.elevation);
    const x1 = x(point.azimuth);
    const y1 = y(point.elevation);
    const cp1x = x0 + (x1 - x(useBefore.azimuth)) / 6;
    const cp1y = y0 + (y1 - y(useBefore.elevation)) / 6;
    const cp2x = x1 - (x(useAfter.azimuth) - x0) / 6;
    const cp2y = y1 - (y(useAfter.elevation) - y0) / 6;

    return [
      {
        d: `M ${x0} ${y0} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${x1} ${y1}`,
        color: colorFor(point.status),
      },
    ];
  });
}

/**
 * Shared azimuth/elevation plot for the terrain silhouette and apparent Sun/Earth discs.
 * Uses real NASA LOLA DEM horizon profiles (precomputed or dynamically ray-marched for 80°S-90°S).
 * Never substitutes fake sine-wave terrain; outside modeled DEM coverage, explicitly marks flat 0° analytical horizon.
 */
export default function HorizonViewChart({
  siteId,
  latitude,
  longitude,
  moonFeature,
  startMs,
  currentSun,
  currentEarth,
}) {
  const clipId = useId();
  const earthGradientId = useId();
  const [demTick, setDemTick] = useState(0);
  const [standThereMode, setStandThereMode] = useState(false);
  const [showExplain, setShowExplain] = useState(false);

  useEffect(() => {
    ensurePolarDemLoaded()
      .then((grid) => {
        if (grid) setDemTick((t) => t + 1);
      })
      .catch(() => {});
  }, []);

  const profile = useMemo(
    () => getHorizonProfile(HORIZON_TABLE, siteId, latitude, longitude),
    [siteId, latitude, longitude, demTick]
  );

  // Authentic terrain profile: real LOLA DEM ray-marched profile or explicit flat 0° analytical horizon
  const effectiveProfile = useMemo(() => {
    if (profile?.horizon) {
      return {
        ...profile,
        isModeled: true,
        sourceLabel: profile.isDemRayMarched
          ? "NASA LOLA 80°S–90°S Ray-Marched DEM"
          : "NASA LOLA Precomputed Horizon Profile",
      };
    }
    return {
      horizon: new Array(361).fill(0),
      site_name: "Unmodeled Non-Polar Coordinate",
      isModeled: false,
      sourceLabel: "Unmodeled Terrain (Flat 0° Analytical Horizon)",
    };
  }, [profile]);

  const data = useMemo(() => {
    const terrainFn = (azimuthDeg) => {
      if (profile?.horizon) {
        return horizonAt(HORIZON_TABLE, siteId, azimuthDeg, latitude, longitude) ?? 0;
      }
      return 0;
    };
    const terrain = [];
    for (let az = 0; az <= 360; az += 1) {
      terrain.push({ az, elevation: terrainFn(az) });
    }

    const sunTrack = [];
    const earthTrack = [];
    const sampleCount = (PATH_DAYS * HOURS_PER_DAY) / PATH_STEP_H;
    for (let i = 0; i < sampleCount; i += 1) {
      const state = computeCelestialState(startMs + i * PATH_STEP_H * 3600000);
      const flatSun = solarPosition(state, latitude, longitude);
      const tElev = terrainFn(flatSun.azimuthDeg) ?? 0;
      const sun = solarPosition(state, latitude, longitude, tElev);
      sunTrack.push({
        azimuth: sun.azimuthDeg,
        elevation: sun.elevationDeg,
        radius: state.sun.angularDiameterDeg / 2,
        status: sun.status,
        visible: flatSun.elevationDeg + state.sun.angularDiameterDeg / 2 > -3,
      });

      const earth = earthLookFromMoon(state, moonFeature);
      const earthTerrain = terrainFn(earth.azimuthDeg) ?? 0;
      const hasLineOfSight =
        earth.elevationDeg + earth.radiusDeg > Math.max(0, earthTerrain);
      earthTrack.push({
        azimuth: earth.azimuthDeg,
        elevation: earth.elevationDeg,
        radius: earth.radiusDeg,
        status: hasLineOfSight ? "clear" : "blocked",
        visible: earth.elevationDeg + earth.radiusDeg > -3,
      });
    }

    return { terrain, sunTrack, earthTrack };
  }, [startMs, latitude, longitude, moonFeature, siteId, profile]);

  const maxElev = standThereMode ? 25 : MAX_ELEVATION;
  const elevTicks = standThereMode ? [0, 5, 10, 15, 25] : ELEVATION_TICKS;

  const y = (elevation) => {
    const fraction =
      Math.max(0, Math.min(maxElev, elevation)) / maxElev;
    const scaled =
      standThereMode || ELEVATION_LOG_FACTOR === 0
        ? fraction
        : Math.log1p(ELEVATION_LOG_FACTOR * fraction) /
          Math.log1p(ELEVATION_LOG_FACTOR);
    return HORIZON_Y - scaled * PLOT_H;
  };
  const x = (azimuth) => PAD_LEFT + (azimuth / 360) * PLOT_W;
  const sunSegments = smoothTrackSegments(data.sunTrack, x, y, sunColor);
  const earthSegments = smoothTrackSegments(data.earthTrack, x, y, earthTrackColor);
  const terrainPoints = data.terrain
    .map(({ az, elevation }) => `${x(az)},${y(Math.max(0, elevation ?? 0))}`)
    .join(" ");
  const terrainPolygon = `${PAD_LEFT},${HORIZON_Y} ${terrainPoints} ${W - PAD_RIGHT},${HORIZON_Y}`;
  const hasSun = Number.isFinite(currentSun?.elevationDeg) && Number.isFinite(currentSun?.azimuthDeg);
  const hasEarth = Number.isFinite(currentEarth?.elevationDeg) && Number.isFinite(currentEarth?.azimuthDeg);
  const currentSunColor = sunColor(currentSun?.status);
  const currentEarthColor = earthColor(currentEarth?.status);
  const sunX = hasSun ? x(currentSun.azimuthDeg) : 0;
  const earthX = hasEarth ? x(currentEarth.azimuthDeg) : 0;
  const sunY = hasSun ? y(currentSun.elevationDeg) : HORIZON_Y;
  const earthY = hasEarth ? y(currentEarth.elevationDeg) : HORIZON_Y;
  const sunIconY = Math.max(PAD_TOP + 10, sunY);
  const earthIconY = Math.max(PAD_TOP + 10, earthY);
  const sunAngle = hasSun ? Math.round(currentSun.elevationDeg * 10) / 10 : null;
  const earthAngle = hasEarth ? Math.round(currentEarth.elevationDeg * 10) / 10 : null;
  const sunLabelX = sunX < W * 0.52 ? sunX + 13 : sunX - 13;
  const earthLabelX = earthX < W * 0.52 ? earthX + 13 : earthX - 13;
  let sunLabelY = Math.max(PAD_TOP + 3, sunIconY - 12);
  let earthLabelY = Math.max(PAD_TOP + 3, earthIconY - 12);
  if (hasSun && hasEarth && Math.abs(sunX - earthX) < 55 && Math.abs(sunLabelY - earthLabelY) < 16) {
    if (sunLabelY <= earthLabelY) {
      sunLabelY = Math.max(PAD_TOP + 2, sunLabelY - 7);
      earthLabelY = Math.min(HORIZON_Y - 4, earthLabelY + 9);
    } else {
      earthLabelY = Math.max(PAD_TOP + 2, earthLabelY - 7);
      sunLabelY = Math.min(HORIZON_Y - 4, sunLabelY + 9);
    }
  }

  return (
    <div className="w-full space-y-1.5">
      <div className="flex items-center justify-between gap-1.5 text-[10px] font-mono">
        <span
          className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border truncate ${
            effectiveProfile.isModeled
              ? "bg-emerald-950/60 border-emerald-500/40 text-emerald-300"
              : "bg-amber-950/60 border-amber-500/40 text-amber-300"
          }`}
          title={effectiveProfile.sourceLabel}
        >
          {effectiveProfile.isModeled ? (
            <CheckCircle2 className="w-3 h-3 shrink-0" />
          ) : (
            <AlertTriangle className="w-3 h-3 shrink-0" />
          )}
          <span className="truncate">{effectiveProfile.sourceLabel}</span>
        </span>

        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => setStandThereMode((v) => !v)}
            className={`px-2 py-0.5 rounded border flex items-center gap-1 transition-colors ${
              standThereMode
                ? "bg-cyan-500/20 border-cyan-400 text-cyan-200 font-bold"
                : "bg-slate-900 border-slate-700 text-slate-300 hover:text-white"
            }`}
            title="Switch between 0–90° Sky Track and 0–25° astronaut surface panorama"
          >
            <Eye className="w-3 h-3" />
            <span>{standThereMode ? "Panorama (0–25°)" : "Stand-There"}</span>
          </button>
          <button
            type="button"
            onClick={() => setShowExplain((v) => !v)}
            className={`p-1 rounded border transition-colors ${
              showExplain
                ? "bg-cyan-500/20 border-cyan-400 text-cyan-200"
                : "bg-slate-900 border-slate-700 text-slate-400 hover:text-white"
            }`}
            title="Explain this 360° horizon chart"
          >
            <HelpCircle className="w-3 h-3" />
          </button>
        </div>
      </div>

      {showExplain && (
        <div className="p-2.5 rounded-lg bg-slate-900/90 border border-cyan-500/30 text-[10.5px] text-slate-200 leading-relaxed space-y-1">
          <div className="font-semibold text-cyan-300 flex items-center gap-1.5">
            <Compass className="w-3.5 h-3.5" />
            <span>How to Read the 360° Lunar Horizon Mask</span>
          </div>
          <p className="text-slate-300">
            Imagine standing on the lunar surface looking all the way around from{" "}
            <strong>North (0°) → East (90°) → South (180°) → West (270°)</strong>. The teal silhouette shows surrounding crater rims and mountains from NASA LOLA laser altimetry.
          </p>
          <p className="text-slate-300">
            At the South Pole, the Sun circles near the horizon (0°–7°), while Earth hovers inside a ~14°×13° libration box near 0°E. Whenever either disc drops behind the teal mountain silhouette, solar power or Direct-to-Earth radio is blocked!
          </p>
        </div>
      )}

      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="xMidYMid meet"
        className="block w-full h-auto rounded-lg bg-slate-950/70 border border-slate-800/80"
        role="img"
        aria-label="Terrain horizon with the predicted paths of the Sun and Earth over the next 30 days"
      >
        <defs>
          <linearGradient id={earthGradientId} x1="0" x2="1" y1="0" y2="1">
            <stop offset="0%" stopColor="#60a5fa" />
            <stop offset="100%" stopColor="#1d4ed8" />
          </linearGradient>
          <clipPath id={clipId}>
            <rect
              x={PAD_LEFT}
              y={PAD_TOP}
              width={PLOT_W}
              height={PLOT_H}
            />
          </clipPath>
        </defs>
        {AZIMUTH_TICKS.map((az) => (
          <line
            key={az}
            x1={x(az)}
            x2={x(az)}
            y1={PAD_TOP}
            y2={HORIZON_Y}
            stroke="#1e293b"
            strokeWidth="0.7"
          />
        ))}
        {elevTicks.map((elevation) => (
          <g key={`elevation-${elevation}`}>
            <line
              x1={PAD_LEFT}
              x2={W - PAD_RIGHT}
              y1={y(elevation)}
              y2={y(elevation)}
              stroke={elevation === 0 ? "#475569" : "#1e293b"}
              strokeWidth={elevation === 0 ? "0.8" : "0.6"}
              strokeDasharray={elevation === 0 ? "3 2" : "2 3"}
            />
            <text
              x={PAD_LEFT - 5}
              y={y(elevation) + 2.5}
              fontSize="8"
              fill="#94a3b8"
              textAnchor="end"
            >
              {elevation}°
            </text>
          </g>
        ))}
        <line
          x1={PAD_LEFT}
          x2={PAD_LEFT}
          y1={PAD_TOP}
          y2={HORIZON_Y}
          stroke="#64748b"
          strokeWidth="0.8"
        />

        <g clipPath={`url(#${clipId})`}>
          {sunSegments.map((segment, index) => (
            <path
              key={`sun-path-${index}`}
              d={segment.d}
              fill="none"
              stroke={segment.color}
              strokeWidth="1.4"
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity="0.9"
            />
          ))}
          {earthSegments.map((segment, index) => (
            <path
              key={`earth-path-${index}`}
              d={segment.d}
              fill="none"
              stroke={segment.color}
              strokeWidth="1.4"
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity="0.9"
            />
          ))}

          {data.sunTrack.filter((point) => point.visible).map((point, index) => (
            <circle
              key={`sun-${index}`}
              cx={x(point.azimuth)}
              cy={y(point.elevation)}
              r="1.1"
              fill={sunColor(point.status)}
              fillOpacity="0.85"
            >
              <title>Sun · {point.status}</title>
            </circle>
          ))}
          {data.earthTrack.filter((point) => point.visible).map((point, index) => (
            <circle
              key={`earth-${index}`}
              cx={x(point.azimuth)}
              cy={y(point.elevation)}
              r="1.1"
              fill={earthTrackColor(point.status)}
              fillOpacity="0.85"
            >
              <title>Earth · {point.status}</title>
            </circle>
          ))}

          {effectiveProfile?.horizon && (
            <>
              <polygon
                points={terrainPolygon}
                fill="#0F172A"
                fillOpacity={standThereMode ? "0.94" : "0.82"}
              />
              <polyline
                points={terrainPoints}
                fill="none"
                stroke={effectiveProfile.isModeled ? "#00D2C4" : "#F59E0B"}
                strokeWidth="1.2"
                strokeDasharray={effectiveProfile.isModeled ? undefined : "4 3"}
              />
            </>
          )}

          {hasSun && (currentSun.elevationDeg >= 0 ? (
            <>
              <line
                x1={sunX}
                y1={HORIZON_Y}
                x2={sunX}
                y2={sunY}
                stroke={currentSunColor}
                strokeWidth="1.1"
                strokeDasharray="3 2"
                opacity="0.8"
              />
              <g transform={`translate(${sunX} ${sunIconY})`}>
                <circle r={standThereMode ? "6" : "5"} fill="#fbbf24" stroke="#fef3c7" strokeWidth="1" />
                <title>Sun · {currentSun.status} · elevation {currentSun.elevationDeg.toFixed(1)}°</title>
              </g>
            </>
          ) : (
            <path
              d={`M ${sunX - 4} ${HORIZON_Y - 7} L ${sunX + 4} ${HORIZON_Y - 7} L ${sunX} ${HORIZON_Y} Z`}
              fill="#fbbf24"
              stroke="#fef3c7"
              strokeWidth="0.7"
            >
              <title>Sun below horizon · elevation {currentSun.elevationDeg.toFixed(1)}°</title>
            </path>
          ))}
          {hasEarth && (currentEarth.elevationDeg >= 0 ? (
            <>
              <line
                x1={earthX}
                y1={HORIZON_Y}
                x2={earthX}
                y2={earthY}
                stroke={currentEarthColor}
                strokeWidth="1.1"
                strokeDasharray="3 2"
                opacity="0.8"
              />
              <g transform={`translate(${earthX} ${earthIconY})`}>
                <circle r={standThereMode ? "9.5" : "8"} fill={`url(#${earthGradientId})`} stroke="#dbeafe" strokeWidth="1" />
                <path
                  d="M-5 -3  -2 -6  1 -5  2 -2  5 -1  4 2  1 3  0 6 -3 4 -4 1 -6 0Z M2 4 5 3 6 5 3 7Z"
                  fill="#34d399"
                  stroke="#a7f3d0"
                  strokeWidth="0.6"
                  strokeLinejoin="round"
                />
                <title>Earth · {currentEarth.status} · elevation {currentEarth.elevationDeg.toFixed(1)}°</title>
              </g>
            </>
          ) : (
            <path
              d={`M ${earthX - 4} ${HORIZON_Y - 7} L ${earthX + 4} ${HORIZON_Y - 7} L ${earthX} ${HORIZON_Y} Z`}
              fill="#93c5fd"
              stroke="#dbeafe"
              strokeWidth="0.7"
            >
              <title>Earth below horizon · elevation {currentEarth.elevationDeg.toFixed(1)}°</title>
            </path>
          ))}

          {hasSun && (
            <text
              x={sunLabelX}
              y={sunLabelY}
              fontSize="9.5"
              fontWeight="600"
              fill="#fde68a"
              textAnchor={sunX < W * 0.52 ? "start" : "end"}
              paintOrder="stroke"
              stroke="#020617"
              strokeWidth="3"
              strokeLinejoin="round"
            >
              Sun {sunAngle}°
            </text>
          )}
          {hasEarth && (
            <text
              x={earthLabelX}
              y={earthLabelY}
              fontSize="9.5"
              fontWeight="600"
              fill="#bfdbfe"
              textAnchor={earthX < W * 0.52 ? "start" : "end"}
              paintOrder="stroke"
              stroke="#020617"
              strokeWidth="3"
              strokeLinejoin="round"
            >
              Earth {earthAngle}°
            </text>
          )}
        </g>

        {AZIMUTH_TICKS.map((az) => (
          <text
            key={`label-${az}`}
            x={az === 0 ? PAD_LEFT + 3 : az === 360 ? W - PAD_RIGHT - 3 : x(az)}
            y={H - 5}
            fontSize="8.5"
            fill="#94a3b8"
            textAnchor={az === 0 ? "start" : az === 360 ? "end" : "middle"}
          >
            {AZIMUTH_LABELS[az]}
            {az === 360 ? "" : ` ${az}°`}
          </text>
        ))}
      </svg>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-slate-300">
        <span className="inline-flex items-center gap-1">
          <i className="h-2 w-2 rounded-full" style={{ backgroundColor: SUNLIGHT_TIMELINE_COLORS.sunlit }} />
          Sunlit
        </span>
        <span className="inline-flex items-center gap-1">
          <i className="h-2 w-2 rounded-full" style={{ backgroundColor: SUNLIGHT_TIMELINE_COLORS.blocked }} />
          Terrain-blocked
        </span>
        <span className="inline-flex items-center gap-1">
          <i className="h-2 w-2 rounded-full" style={{ backgroundColor: SUNLIGHT_TIMELINE_COLORS.night }} />
          Night
        </span>
        <span className="inline-flex items-center gap-1">
          <i className="h-2 w-2 rounded-full" style={{ backgroundColor: COMMUNICATION_TIMELINE_COLORS.clear }} />
          DTE Link
        </span>
        <span className="inline-flex items-center gap-1">
          <i className="h-2 w-2 rounded-full" style={{ backgroundColor: COMMUNICATION_TIMELINE_COLORS.blocked }} />
          DTE Blocked
        </span>
        <span className="ml-auto font-mono text-slate-400">Next {PATH_DAYS}d</span>
      </div>
    </div>
  );
}
