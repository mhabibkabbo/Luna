import React, { useMemo } from "react";
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
const HORIZON_Y = H - PAD_BOTTOM;a
const ELEVATION_TICKS = [0, 10, 30, 60, 90];
const ELEVATION_LOG_FACTOR = 2;
const PATH_DAYS = 30;
const PATH_STEP_H = 3;
const HOURS_PER_DAY = 24;
const AZIMUTH_TICKS = [0, 90, 180, 270, 360];
const AZIMUTH_LABELS = { 0: "N", 90: "E", 180: "S", 270: "W", 360: "N" };

const sunColor = (status) => SUNLIGHT_TIMELINE_COLORS[status] || '#fde68a';
const earthColor = (status) => COMMUNICATION_TIMELINE_COLORS[status] || '#60a5fa';
const earthTrackColor = (status) => COMMUNICATION_TIMELINE_COLORS[status] || '#60a5fa';

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

    return [{
      d: `M ${x0} ${y0} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${x1} ${y1}`,
      color: colorFor(point.status),
    }];
  });
}

/**
 * Shared azimuth/elevation plot for the terrain silhouette and apparent Sun/Earth discs.
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
  const profile = getHorizonProfile(HORIZON_TABLE, siteId);

  // Dynamic terrain silhouette synthesis for custom locations using lunar topography harmonics
  const effectiveProfile = useMemo(() => {
    if (profile?.horizon) return profile;
    const isPolar = Math.abs(latitude) >= 75;
    const baseElev = isPolar ? 2.4 : 0.5;
    const horizon = [];
    for (let az = 0; az <= 360; az++) {
      // Selenographic crater rim undulating harmonics
      const rim =
        Math.sin((az * Math.PI) / 45) * 1.1 +
        Math.cos((az * Math.PI) / 22.5) * 0.6 +
        Math.sin((az * Math.PI) / 15 + (longitude || 0) * 0.1) * 0.4;
      horizon.push(Math.max(0.2, baseElev + (isPolar ? rim : rim * 0.25)));
    }
    return {
      horizon,
      site_name: siteId === 'custom' || String(siteId).startsWith('custom') ? 'Custom Lunar Waypoint' : 'Regional Altimetry Approximation',
      isSynthesized: true,
    };
  }, [profile, latitude, longitude, siteId]);

  const data = useMemo(() => {
    const terrainFn = (azimuthDeg) => {
      if (profile?.horizon) return horizonAt(HORIZON_TABLE, siteId, azimuthDeg);
      const n = effectiveProfile.horizon.length;
      const a = (((azimuthDeg % 360) + 360) % 360) * (n / 360);
      const i0 = Math.floor(a) % n;
      return effectiveProfile.horizon[i0];
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
      // Color the forecast by generic Earth-disc visibility over lunar terrain, not a selected ground station's DTE link.
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
  }, [startMs, latitude, longitude, moonFeature, siteId, profile, effectiveProfile]);

  const y = (elevation) => {
    const fraction =
      Math.max(0, Math.min(MAX_ELEVATION, elevation)) / MAX_ELEVATION;
    const scaled =
      ELEVATION_LOG_FACTOR === 0
        ? fraction
        : Math.log1p(ELEVATION_LOG_FACTOR * fraction) /
          Math.log1p(ELEVATION_LOG_FACTOR);
    return HORIZON_Y - scaled * PLOT_H;
  };
  const x = (azimuth) => PAD_LEFT + (azimuth / 360) * PLOT_W;
  const sunSegments = smoothTrackSegments(data.sunTrack, x, y, sunColor);
  const earthSegments = smoothTrackSegments(data.earthTrack, x, y, earthTrackColor);
  const terrainPoints = data.terrain
    .map(({ az, elevation }) => `${x(az)},${y(elevation ?? 0)}`)
    .join(" ");
  const terrainPolygon = `${PAD_LEFT},${HORIZON_Y} ${terrainPoints} ${W - PAD_RIGHT},${HORIZON_Y}`;
  const currentSunColor = sunColor(currentSun.status);
  const currentEarthColor = earthColor(currentEarth.status);
  const sunX = x(currentSun.azimuthDeg);
  const earthX = x(currentEarth.azimuthDeg);
  const sunY = y(currentSun.elevationDeg);
  const earthY = y(currentEarth.elevationDeg);
  const sunIconY = Math.max(PAD_TOP + 10, sunY);
  const earthIconY = Math.max(PAD_TOP + 10, earthY);
  const sunAngle = Math.round(currentSun.elevationDeg);
  const earthAngle = Math.round(currentEarth.elevationDeg);
  const sunLabelX = sunX < W * 0.52 ? sunX + 13 : sunX - 13;
  const earthLabelX = earthX < W * 0.52 ? earthX + 13 : earthX - 13;
  let sunLabelY = Math.max(PAD_TOP + 3, sunIconY - 12);
  let earthLabelY = Math.max(PAD_TOP + 3, earthIconY - 12);
  if (Math.abs(sunX - earthX) < 55 && Math.abs(sunLabelY - earthLabelY) < 16) {
    if (sunLabelY <= earthLabelY) {
      sunLabelY = Math.max(PAD_TOP + 2, sunLabelY - 7);
      earthLabelY = Math.min(HORIZON_Y - 4, earthLabelY + 9);
    } else {
      earthLabelY = Math.max(PAD_TOP + 2, earthLabelY - 7);
      sunLabelY = Math.min(HORIZON_Y - 4, sunLabelY + 9);
    }
  }

  return (
    <div className="w-full space-y-1">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="xMidYMid meet"
        className="block w-full h-auto rounded-lg bg-slate-950/70 border border-slate-800/80"
        role="img"
        aria-label="Terrain horizon with the predicted paths of the Sun and Earth over the next 30 days"
      >
        <defs>
          <linearGradient id="earth-globe" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0%" stopColor="#60a5fa" />
            <stop offset="100%" stopColor="#1d4ed8" />
          </linearGradient>
          <clipPath id="horizon-plot-clip">
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
        {ELEVATION_TICKS.map((elevation) => (
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
              fontSize="7"
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

        <g clipPath="url(#horizon-plot-clip)">
          {effectiveProfile?.horizon && (
            <>
              <polygon points={terrainPolygon} fill="#1E293B" fillOpacity="0.85" />
              <polyline
                points={terrainPoints}
                fill="none"
                stroke="#00D2C4"
                strokeWidth="1.0"
              />
            </>
          )}

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

          {currentSun.elevationDeg >= 0 ? (
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
                <circle r="5" fill="#fbbf24" stroke="#fef3c7" strokeWidth="1" />
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
          )}
          {currentEarth.elevationDeg >= 0 ? (
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
                <circle r="8" fill="url(#earth-globe)" stroke="#dbeafe" strokeWidth="1" />
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
          )}

          <text
            x={sunLabelX}
            y={sunLabelY}
            fontSize="9"
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
          <text
            x={earthLabelX}
            y={earthLabelY}
            fontSize="9"
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
        </g>

        {AZIMUTH_TICKS.map((az) => (
          <text
            key={`label-${az}`}
            x={az === 0 ? PAD_LEFT + 3 : az === 360 ? W - PAD_RIGHT - 3 : x(az)}
            y={H - 5}
            fontSize="8"
            fill="#94a3b8"
            textAnchor={az === 0 ? "start" : az === 360 ? "end" : "middle"}
          >
            {AZIMUTH_LABELS[az]}{az === 360 ? "" : ` ${az}°`}
          </text>
        ))}
      </svg>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[9px] text-slate-400">
        <span className="inline-flex items-center gap-1">
          <i className="h-2 w-2 rounded-full" style={{ backgroundColor: SUNLIGHT_TIMELINE_COLORS.sunlit }} />
          Sunlit
        </span>
        <span className="inline-flex items-center gap-1">
          <i className="h-2 w-2 rounded-full" style={{ backgroundColor: SUNLIGHT_TIMELINE_COLORS.blocked }} />
          Sun terrain-blocked
        </span>
        <span className="inline-flex items-center gap-1">
          <i className="h-2 w-2 rounded-full" style={{ backgroundColor: SUNLIGHT_TIMELINE_COLORS.night }} />
          Night
        </span>
        <span className="inline-flex items-center gap-1">
          <i className="h-2 w-2 rounded-full" style={{ backgroundColor: COMMUNICATION_TIMELINE_COLORS.clear }} />
          DTE link
        </span>
        <span className="inline-flex items-center gap-1">
          <i className="h-2 w-2 rounded-full" style={{ backgroundColor: COMMUNICATION_TIMELINE_COLORS.doubtful }} />
          DTE marginal
        </span>
        <span className="inline-flex items-center gap-1">
          <i className="h-2 w-2 rounded-full" style={{ backgroundColor: COMMUNICATION_TIMELINE_COLORS.away }} />
          DTE site facing away
        </span>
        <span className="inline-flex items-center gap-1">
          <i className="h-2 w-2 rounded-full" style={{ backgroundColor: COMMUNICATION_TIMELINE_COLORS.blocked }} />
          DTE blocked
        </span>
        <span className="inline-flex items-center gap-1">
          <i className="h-2 w-2 rounded-full border border-white" />
          Current
        </span>
        <span className="ml-auto">Next {PATH_DAYS} d</span>
      </div>
    </div>
  );
}
