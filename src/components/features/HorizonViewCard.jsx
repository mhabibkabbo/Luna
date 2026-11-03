import React, { useEffect, useMemo, useState } from 'react';
import { Radio, Sun } from 'lucide-react';
import { computeCelestialState, solarPosition } from '../../utils/lunarEphemeris.js';
import { celestialTimeStore } from '../../utils/celestialTime.js';
import { HORIZON_TABLE, horizonAt } from '../../utils/horizons.js';
import {
  DEFAULT_DTE_CONSTRAINTS,
  earthLookFromMoon,
  evaluateEarthLink,
} from '../../utils/earthLink.js';
import {
  calculateEarthPositionTransition,
  calculateSolarTransition,
} from '../../utils/transitionTimes.js';
import {
  COMMUNICATION_TIMELINE_COLORS,
  SUNLIGHT_TIMELINE_COLORS,
} from '../../utils/visibilityColors.js';
import HorizonViewChart from './HorizonViewChart.jsx';

const SUN_STATUS = {
  sunlit: { label: 'Sunlit', color: SUNLIGHT_TIMELINE_COLORS.sunlit },
  blocked: { label: 'Blocked', color: SUNLIGHT_TIMELINE_COLORS.blocked },
  night: { label: 'Night', color: SUNLIGHT_TIMELINE_COLORS.night },
};

const EARTH_STATUS = {
  clear: { label: 'Link Active', color: COMMUNICATION_TIMELINE_COLORS.clear },
  doubtful: { label: 'Marginal', color: COMMUNICATION_TIMELINE_COLORS.doubtful },
  blocked: { label: 'Blocked', color: COMMUNICATION_TIMELINE_COLORS.blocked },
  away: { label: 'Far Side', color: '#fb923c' },
};

export default function HorizonViewCard({
  siteId,
  latitude,
  longitude,
  moonFeature,
  earthFeature = null,
}) {
  const [timeMs, setTimeMs] = useState(() => celestialTimeStore.get().ms);
  const [trackStartMs, setTrackStartMs] = useState(() => celestialTimeStore.get().ms);
  const constraints = DEFAULT_DTE_CONSTRAINTS;

  useEffect(() => {
    setTrackStartMs(celestialTimeStore.get().ms);
  }, [siteId, latitude, longitude]);

  useEffect(
    () =>
      celestialTimeStore.subscribe(({ ms }) => {
        setTimeMs(ms);
      }),
    []
  );

  const terrainFn = useMemo(
    () => (azimuthDeg) => horizonAt(HORIZON_TABLE, siteId, azimuthDeg),
    [siteId]
  );
  const state = useMemo(() => computeCelestialState(timeMs), [timeMs]);
  const flatSun = useMemo(
    () => solarPosition(state, latitude, longitude),
    [state, latitude, longitude]
  );
  const terrainHorizon = terrainFn(flatSun.azimuthDeg) ?? 0;
  const sun = useMemo(
    () => solarPosition(state, latitude, longitude, terrainHorizon),
    [state, latitude, longitude, terrainHorizon]
  );
  const earth = useMemo(
    () => earthLookFromMoon(state, moonFeature),
    [state, moonFeature]
  );
  const link = useMemo(
    () =>
      evaluateEarthLink({
        state,
        moonFeature,
        earthFeature,
        constraints,
        terrainFn,
      }),
    [state, moonFeature, earthFeature, constraints, terrainFn]
  );
  const currentSun = useMemo(
    () => ({
      azimuthDeg: sun.azimuthDeg,
      elevationDeg: sun.elevationDeg,
      radius: state.sun.angularDiameterDeg / 2,
      status: sun.status,
    }),
    [sun, state]
  );
  const currentEarth = useMemo(
    () => ({
      azimuthDeg: earth.azimuthDeg,
      elevationDeg: earth.elevationDeg,
      radius: earth.radiusDeg,
      status: link.status,
    }),
    [earth, link]
  );

  const solarTransition = useMemo(
    () => calculateSolarTransition(timeMs, latitude, longitude, siteId),
    [timeMs, latitude, longitude, siteId]
  );
  const earthTransition = useMemo(
    () => calculateEarthPositionTransition(timeMs, moonFeature),
    [timeMs, moonFeature]
  );

  return (
    <section className="space-y-3 rounded-2xl border border-[#16283C] bg-[#060B13] p-4 text-[#F8FAFC]">
      {/* Compact 2-Pill Telemetry Summary */}
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-xl border border-[#16283C] bg-[#0A111C] p-2.5">
          <div className="flex items-center justify-between text-[10px] font-mono text-[#94A3B8]">
            <span className="flex items-center gap-1">
              <Sun className="h-3.5 w-3.5 text-[#00D2C4]" />
              <span className="font-semibold text-[#F8FAFC]">Sun Position</span>
            </span>
            <span style={{ color: SUN_STATUS[sun.status].color }} className="font-mono font-bold">
              {SUN_STATUS[sun.status].label}
            </span>
          </div>
          <div className="mt-1 font-mono text-sm font-bold text-[#F8FAFC]">
            {sun.elevationDeg.toFixed(1)}° el
          </div>
          <div className="text-[10px] font-mono text-[#94A3B8] truncate">
            {solarTransition.nextEvent === 'sunset' ? 'Sunset' : 'Sunrise'} in{' '}
            {solarTransition.formattedDuration}
          </div>
        </div>

        <div className="rounded-xl border border-[#16283C] bg-[#0A111C] p-2.5">
          <div className="flex items-center justify-between text-[10px] font-mono text-[#94A3B8]">
            <span className="flex items-center gap-1">
              <Radio className="h-3.5 w-3.5 text-[#34D399]" />
              <span className="font-semibold text-[#F8FAFC]">Earth Direct</span>
            </span>
            <span
              style={{ color: EARTH_STATUS[link.status].color }}
              className="font-mono font-bold"
            >
              {EARTH_STATUS[link.status].label}
            </span>
          </div>
          <div className="mt-1 font-mono text-sm font-bold text-[#F8FAFC]">
            {earth.elevationDeg.toFixed(1)}° el
          </div>
          <div className="text-[10px] font-mono text-[#94A3B8] truncate">
            {earthTransition.nextEvent === 'earthset' ? 'Set' : 'Rise'} in{' '}
            {earthTransition.formattedDuration}
          </div>
        </div>
      </div>

      {/* Horizon Chart */}
      <HorizonViewChart
        siteId={siteId}
        latitude={latitude}
        longitude={longitude}
        moonFeature={moonFeature}
        startMs={trackStartMs}
        currentSun={currentSun}
        currentEarth={currentEarth}
      />
    </section>
  );
}
import React, { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Orbit, Radio, Sun } from "lucide-react";
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
import {
  DEFAULT_DTE_CONSTRAINTS,
  LINK_REASON_LABELS,
  earthLookFromMoon,
  earthSlewRates,
  evaluateEarthLink,
  sweepEarthLink,
} from "../../utils/earthLink.js";
import {
  calculateEarthPositionTransition,
  calculateSolarTransition,
} from "../../utils/transitionTimes.js";
import {
  COMMUNICATION_TIMELINE_COLORS,
  SUNLIGHT_TIMELINE_COLORS,
} from "../../utils/visibilityColors.js";
import HorizonViewChart from "./HorizonViewChart.jsx";

const HOUR_MS = 3600000;
const HOURS_BEFORE = 2;
const HOURS_AFTER = 5;

const SUN_STATUS = {
  sunlit: { label: "Sunlit", color: SUNLIGHT_TIMELINE_COLORS.sunlit },
  blocked: { label: "Blocked", color: SUNLIGHT_TIMELINE_COLORS.blocked },
  night: { label: "Night", color: SUNLIGHT_TIMELINE_COLORS.night },
};

const EARTH_STATUS = {
  clear: { label: "Link", color: COMMUNICATION_TIMELINE_COLORS.clear },
  doubtful: { label: "Marginal", color: COMMUNICATION_TIMELINE_COLORS.doubtful },
  blocked: { label: "No link", color: COMMUNICATION_TIMELINE_COLORS.blocked },
  away: { label: "Facing away", color: "#fb923c" },
};

const hhmm = (ms) => new Date(ms).toISOString().slice(11, 16);

function Countdown({ kind, title, duration, active, secondary }) {
  const Icon = kind === "sun" ? Sun : Radio;
  return (
    <div
      className={`min-w-0 rounded-lg border p-2 ${
        active
          ? kind === "sun"
            ? "bg-amber-950/40 border-amber-500/30"
            : "bg-sky-950/40 border-sky-500/30"
          : "bg-slate-950/60 border-slate-800"
      }`}
    >
      <div className="flex items-center gap-1 text-[9px] uppercase tracking-wider text-slate-400">
        <Icon className={`h-3 w-3 shrink-0 ${kind === "sun" ? "text-amber-400" : "text-sky-400"}`} />
        <span className="truncate">{title}</span>
      </div>
      <div className="mt-1 truncate font-mono text-xs font-bold text-white" title={duration}>
        {duration}
      </div>
      <div className="mt-0.5 truncate text-[9px] text-slate-400">{secondary}</div>
    </div>
  );
}

export default function HorizonViewCard({
  siteId,
  latitude,
  longitude,
  moonFeature,
  earthFeature = null,
}) {
  const [timeMs, setTimeMs] = useState(() => celestialTimeStore.get().ms);
  const [outlook, setOutlook] = useState(null);
  const [trackStartMs, setTrackStartMs] = useState(
    () => celestialTimeStore.get().ms,
  );
  const constraints = DEFAULT_DTE_CONSTRAINTS;
  const profile = getHorizonProfile(HORIZON_TABLE, siteId);

  useEffect(() => {
    setTrackStartMs(celestialTimeStore.get().ms);
  }, [siteId, latitude, longitude]);

  useEffect(
    () =>
      celestialTimeStore.subscribe(({ ms }) => {
        setTimeMs(ms);
      }),
    [],
  );

  const terrainFn = useMemo(
    () => (azimuthDeg) => horizonAt(HORIZON_TABLE, siteId, azimuthDeg),
    [siteId],
  );
  const state = useMemo(() => computeCelestialState(timeMs), [timeMs]);
  const flatSun = useMemo(
    () => solarPosition(state, latitude, longitude),
    [state, latitude, longitude],
  );
  const terrainHorizon = terrainFn(flatSun.azimuthDeg) ?? 0;
  const sun = useMemo(
    () => solarPosition(state, latitude, longitude, terrainHorizon),
    [state, latitude, longitude, terrainHorizon],
  );
  const earth = useMemo(
    () => earthLookFromMoon(state, moonFeature),
    [state, moonFeature],
  );
  const link = useMemo(
    () =>
      evaluateEarthLink({
        state,
        moonFeature,
        earthFeature,
        constraints,
        terrainFn,
      }),
    [state, moonFeature, earthFeature, constraints, terrainFn],
  );
  const currentSun = useMemo(
    () => ({
      azimuthDeg: sun.azimuthDeg,
      elevationDeg: sun.elevationDeg,
      radius: state.sun.angularDiameterDeg / 2,
      status: sun.status,
    }),
    [sun, state],
  );
  const currentEarth = useMemo(
    () => ({
      azimuthDeg: earth.azimuthDeg,
      elevationDeg: earth.elevationDeg,
      radius: earth.radiusDeg,
      status: link.status,
    }),
    [earth, link],
  );

  const solarTransition = useMemo(
    () => calculateSolarTransition(timeMs, latitude, longitude, siteId),
    [timeMs, latitude, longitude, siteId],
  );
  const earthTransition = useMemo(
    () => calculateEarthPositionTransition(timeMs, moonFeature),
    [timeMs, moonFeature],
  );

  const hourIndex = Math.floor(timeMs / HOUR_MS);
  const rows = useMemo(() => {
    const result = [];
    for (let offset = -HOURS_BEFORE; offset <= HOURS_AFTER; offset += 1) {
      const ms = (hourIndex + offset) * HOUR_MS;
      try {
        const rowState = computeCelestialState(ms);
        const rowSunFlat = solarPosition(rowState, latitude, longitude);
        const rowSun = solarPosition(
          rowState,
          latitude,
          longitude,
          terrainFn(rowSunFlat.azimuthDeg) ?? 0,
        );
        const rates = earthSlewRates(moonFeature, ms);
        const rowEarth = evaluateEarthLink({
          state: rowState,
          moonFeature,
          earthFeature,
          constraints,
          terrainFn,
          slewDegPerHour: Math.max(
            rates.azimuthDegPerHour,
            rates.elevationDegPerHour,
          ),
        });
        result.push({ ms, offset, sunStatus: rowSun.status, earthStatus: rowEarth.status });
      } catch (error) {
        console.error("Horizon view hourly calculation failed.", error);
      }
    }
    return result;
  }, [hourIndex, latitude, longitude, moonFeature, earthFeature, constraints, terrainFn]);

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
        const count = (predicate) => result.visibility.filter(predicate).length;
        setOutlook({
          linkPct: (count((status) => status === "clear") / result.visibility.length) * 100,
          visiblePct:
            (result.reasons.filter((reason) => reason !== "below-horizon").length /
              result.visibility.length) *
            100,
        });
      })
      .catch((error) => console.error("Earth link outlook failed.", error));
    return () => controller.abort();
  }, [moonFeature, earthFeature, constraints, terrainFn]);

  const target = earthFeature ? earthFeature.name : "Earth (centre)";
  const solarEventTitle =
    solarTransition.nextEvent === "sunset"
      ? "Time until sunset"
      : "Time until sunrise";
  const earthEventTitle =
    earthTransition.nextEvent === "earthset"
      ? "Time until Earthset"
      : "Time until Earthrise";
  const earthSecondary = link.status === "away"
    ? `DTE: ${EARTH_STATUS.away.label}`
    : link.status !== "blocked"
    ? `DTE: ${EARTH_STATUS[link.status].label} · margin ${link.marginDeg > 0 ? "+" : ""}${link.marginDeg.toFixed(1)}°`
    : `DTE: No link · ${LINK_REASON_LABELS[link.reason]}`;

  return (
    <section className="space-y-2.5 rounded-xl border border-slate-800/80 bg-slate-900/60 p-2.5">
      <header className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-slate-300">
        <Orbit className="h-3.5 w-3.5 text-cyan-400" />
        <h3>Horizon View</h3>
      </header>

      <div className="grid grid-cols-2 gap-2">
        <Countdown
          kind="sun"
          title={solarEventTitle}
          duration={solarTransition.formattedDuration}
          active={solarTransition.isCurrentlySunlit}
          secondary={`${SUN_STATUS[sun.status].label} · ${solarTransition.isCurrentlySunlit ? solarTransition.powerEfficiencyPct : 0}% power`}
        />
        <Countdown
          kind="earth"
          title={earthEventTitle}
          duration={earthTransition.formattedDuration}
          active={earthTransition.isAboveHorizon}
          secondary={earthSecondary}
        />
      </div>

      <div className="grid grid-cols-2 gap-2 border-t border-slate-800/80 pt-2 font-mono">
        <div>
          <div className="text-[9.5px] text-amber-300">Sun elevation · azimuth</div>
          <div className="font-bold text-white">
            {sun.elevationDeg.toFixed(2)}° · {sun.azimuthDeg.toFixed(1)}°
          </div>
        </div>
        <div>
          <div className="text-[9.5px] text-sky-300">Earth elevation · azimuth</div>
          <div className="font-bold text-white">
            {earth.elevationDeg.toFixed(1)}° · {earth.azimuthDeg.toFixed(1)}°
          </div>
        </div>
      </div>

      <HorizonViewChart
        siteId={siteId}
        latitude={latitude}
        longitude={longitude}
        moonFeature={moonFeature}
        startMs={trackStartMs}
        currentSun={currentSun}
        currentEarth={currentEarth}
      />
      {!profile?.horizon && (
        <p className="text-[11px] text-amber-300">
          Terrain data currently not available for this site
        </p>
      )}

      <div className="border-t border-slate-800/80 pt-1.5">
        <div className="mb-1 text-[9.5px] font-mono uppercase tracking-wider text-slate-400">
          Hourly visibility · UTC
        </div>
        <div
          className="grid grid-cols-[3.2rem_1fr_1fr] items-center gap-x-2 gap-y-0.5 font-mono text-[10px]"
          role="table"
          aria-label="Hourly Sun and Earth visibility"
        >
          <span className="text-slate-500" role="columnheader">Time</span>
          <span className="text-amber-300" role="columnheader">Sun</span>
          <span className="text-sky-300" role="columnheader">Earth · DTE</span>
          {rows.map((row) => {
            const sunStatus = SUN_STATUS[row.sunStatus];
            const earthStatus = EARTH_STATUS[row.earthStatus];
            return (
              <React.Fragment key={row.ms}>
                <span
                  className={`rounded px-1 py-0.5 text-slate-300 ${row.offset === 0 ? "bg-slate-800/70" : ""}`}
                  role="cell"
                >
                  {hhmm(row.ms)}
                </span>
                <span className="flex items-center gap-1 rounded px-1 py-0.5" role="cell">
                  <i className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: sunStatus.color }} />
                  <span style={{ color: sunStatus.color }}>{sunStatus.label}</span>
                </span>
                <span className="flex items-center gap-1 rounded px-1 py-0.5" role="cell">
                  <i className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: earthStatus.color }} />
                  <span style={{ color: earthStatus.color }}>{earthStatus.label}</span>
                </span>
              </React.Fragment>
            );
          })}
        </div>
      </div>

      <div className="space-y-1 text-[9.5px] leading-snug text-slate-500">
        <p>
          {LINK_REASON_LABELS[link.reason]} · target: {target}
          {link.stationElevationDeg !== null &&
            ` · Moon is ${link.stationElevationDeg.toFixed(1)}° above the station horizon`}
          {" · "}Earth apparent diameter {(earth.radiusDeg * 2).toFixed(2)}°; Sun apparent diameter{" "}
          {(state.sun.angularDiameterDeg).toFixed(2)}°.
        </p>
        {outlook ? (
          <p>
            Next 30 days: Earth above the horizon {outlook.visiblePct.toFixed(0)}% of the time · DTE link available{" "}
            {outlook.linkPct.toFixed(0)}%.
          </p>
        ) : (
          <p>Calculating 30-day DTE outlook…</p>
        )}
        {profile?.horizon ? (
          <>
            {(profile.quality === "partial" || profile.quality === "enclosed") && (
              <p className="flex items-start gap-1 text-amber-300/90">
                <AlertTriangle className="mt-px h-3 w-3 shrink-0" />
                <span>
                  {profile.quality === "partial"
                    ? `DEM covers only ${Math.round((profile.coverage ?? 0) * 100)}% of the search radius; some directions may be underestimated.`
                    : "Horizon is above 5° in every direction; check whether the coordinates are inside a crater."}
                </span>
              </p>
            )}
            <p>
              Terrain: LRO LOLA DEM ({profile.dem ?? "NASA PDS"}), {profile.step_deg ?? 1}° azimuth steps within{" "}
              {profile.maxDistKm ?? 40} km. Sun's upper limb determines sunlight.
            </p>
          </>
        ) : null}
        <p>
          Earth visibility uses the apparent disc and local terrain. DTE assumptions: station mask{" "}
          {constraints.stationMinElevationDeg}°, zenith keyhole above {constraints.antennaMaxElevationDeg}°, slew ≤{" "}
          {constraints.maxSlewDegPerHour}°/h. Geometry only; excludes atmosphere, link budget, and station schedules.
        </p>
      </div>
    </section>
  );
}
