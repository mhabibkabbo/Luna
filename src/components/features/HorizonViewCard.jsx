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
