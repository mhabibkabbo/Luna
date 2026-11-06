import React, { useEffect, useMemo, useState } from 'react';
import { Radio, Sun } from 'lucide-react';
import { computeCelestialState, solarPosition } from '../../utils/lunarEphemeris.js';
import { celestialTimeStore } from '../../utils/celestialTime.js';
import { HORIZON_TABLE, horizonAt, ensurePolarDemLoaded } from '../../utils/horizons.js';
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
  blocked: { label: 'Terrain Masked', color: SUNLIGHT_TIMELINE_COLORS.blocked },
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
  const [demLoadedTick, setDemLoadedTick] = useState(0);
  const constraints = DEFAULT_DTE_CONSTRAINTS;

  useEffect(() => {
    ensurePolarDemLoaded()
      .then((grid) => {
        if (grid) setDemLoadedTick((t) => t + 1);
      })
      .catch(() => {});
  }, []);

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
    () => (azimuthDeg) =>
      horizonAt(HORIZON_TABLE, siteId, azimuthDeg, latitude, longitude),
    [siteId, latitude, longitude, demLoadedTick]
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

  // Partial solar disc visibility fraction (0% to 100%)
  const solarDiscPct = useMemo(() => {
    const r = (state?.sun?.angularDiameterDeg || 0.533) / 2;
    const upperLimb = flatSun.elevationDeg + r;
    const lowerLimb = flatSun.elevationDeg - r;
    if (upperLimb <= terrainHorizon) return 0;
    if (lowerLimb >= terrainHorizon) return 100;
    return Math.round(((upperLimb - terrainHorizon) / (2 * r)) * 100);
  }, [flatSun.elevationDeg, terrainHorizon, state]);

  const currentSun = useMemo(
    () => ({
      azimuthDeg: sun.azimuthDeg,
      elevationDeg: sun.elevationDeg,
      radius: state.sun.angularDiameterDeg / 2,
      status: sun.status,
      discPct: solarDiscPct,
      terrainHorizonDeg: terrainHorizon,
    }),
    [sun, state, solarDiscPct, terrainHorizon]
  );
  const currentEarth = useMemo(
    () => ({
      azimuthDeg: earth.azimuthDeg,
      elevationDeg: earth.elevationDeg,
      radius: earth.radiusDeg,
      status: link.status,
      terrainHorizonDeg: terrainFn(earth.azimuthDeg) ?? 0,
    }),
    [earth, link, terrainFn]
  );

  const solarTransition = useMemo(
    () => calculateSolarTransition(timeMs, latitude, longitude, siteId),
    [timeMs, latitude, longitude, siteId]
  );
  const earthTransition = useMemo(
    () => calculateEarthPositionTransition(timeMs, moonFeature),
    [timeMs, moonFeature]
  );

  const sunStatusMeta = SUN_STATUS[sun?.status] || { label: 'Unknown', color: '#fde68a' };
  const earthStatusMeta = EARTH_STATUS[link?.status] || { label: 'Unknown', color: '#60a5fa' };

  return (
    <section className="space-y-3 rounded-2xl border border-[#1E2028] bg-[#050507] p-4 text-[#F8FAFC]">
      {/* Compact 2-Pill Telemetry Summary */}
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-xl border border-[#1E2028] bg-[#0C0D12] p-2.5">
          <div className="flex items-center justify-between text-[10px] font-mono text-[#94A3B8]">
            <span className="flex items-center gap-1">
              <Sun className="h-3.5 w-3.5 text-[#F8FAFC]" />
              <span className="font-semibold text-[#F8FAFC]">Sun Position</span>
            </span>
            <span style={{ color: sunStatusMeta.color }} className="font-mono font-bold">
              {solarDiscPct > 0 && solarDiscPct < 100
                ? `${solarDiscPct}% Disc`
                : sunStatusMeta.label}
            </span>
          </div>
          <div className="mt-1 font-mono text-sm font-bold text-[#F8FAFC] flex items-baseline justify-between">
            <span>{sun?.elevationDeg != null ? `${sun.elevationDeg.toFixed(1)}° el` : '—'}</span>
            <span className="text-[10px] font-normal text-[#94A3B8]">
              Az {sun?.azimuthDeg != null ? `${sun.azimuthDeg.toFixed(0)}°` : '—'}
            </span>
          </div>
          <div className="text-[10px] font-mono text-[#94A3B8] truncate">
            {solarTransition.timeUntilMs === null
              ? solarTransition.isCurrentlySunlit
                ? 'Continuous Sunlight'
                : 'Continuous Shadow'
              : `${solarTransition.nextEvent === 'sunset' ? 'Sunset' : 'Sunrise'} in ${solarTransition.formattedDuration}`}
          </div>
        </div>

        <div className="rounded-xl border border-[#1E2028] bg-[#0C0D12] p-2.5">
          <div className="flex items-center justify-between text-[10px] font-mono text-[#94A3B8]">
            <span className="flex items-center gap-1">
              <Radio className="h-3.5 w-3.5 text-[#34D399]" />
              <span className="font-semibold text-[#F8FAFC]">Earth Direct</span>
            </span>
            <span
              style={{ color: earthStatusMeta.color }}
              className="font-mono font-bold"
            >
              {earthStatusMeta.label}
            </span>
          </div>
          <div className="mt-1 font-mono text-sm font-bold text-[#F8FAFC] flex items-baseline justify-between">
            <span>{earth?.elevationDeg != null ? `${earth.elevationDeg.toFixed(1)}° el` : '—'}</span>
            <span className="text-[10px] font-normal text-[#94A3B8]">
              Az {earth?.azimuthDeg != null ? `${earth.azimuthDeg.toFixed(0)}°` : '—'}
            </span>
          </div>
          <div className="text-[10px] font-mono text-[#94A3B8] truncate">
            {earthTransition.timeUntilMs === null
              ? earthTransition.isAboveHorizon
                ? 'Continuous Visibility (35d+)'
                : 'No Earthrise (35d+)'
              : `${earthTransition.nextEvent === 'earthset' ? 'Set' : 'Rise'} in ${earthTransition.formattedDuration}`}
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
