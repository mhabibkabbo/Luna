import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Clock3, Pause, Play, Radio, Sun, ZoomIn, ZoomOut } from 'lucide-react';
import {
  CELESTIAL_MINUTE_MS,
  celestialTimeStore,
  MAX_CELESTIAL_TIME_MS,
  MIN_CELESTIAL_TIME_MS,
  normalizeCelestialTimeMs,
} from '../../utils/celestialTime.js';
import { sweepIllumination } from '../../utils/illumination.js';
import { DEFAULT_DTE_CONSTRAINTS, sweepEarthLink } from '../../utils/earthLink.js';
import { HORIZON_TABLE, horizonAt, ensurePolarDemLoaded } from "../../utils/horizons.js";
import {
  COMMUNICATION_TIMELINE_COLORS,
  SUNLIGHT_TIMELINE_COLORS,
} from "../../utils/visibilityColors.js";

const DAYS = 30;
const DAY_MS = 86400000;
const STEP_MIN = 30;
const MAX_ZOOM_LEVEL = 5;

export { COMMUNICATION_TIMELINE_COLORS, SUNLIGHT_TIMELINE_COLORS };

const UTC_FORMAT = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'UTC',
  year: 'numeric',
  month: 'short',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

const formatUTC = (ms) => `${UTC_FORMAT.format(new Date(ms))} UTC`;

const TimelineTrack = React.memo(function TimelineTrack({
  kind,
  statuses,
  colors,
  transitions,
  anchorMs,
  playheadRef,
  earthFeatureName,
}) {
  const sampleCount = statuses?.length ?? 1;
  const isSunlightTrack = kind === 'sunlight';

  return (
    <div
      className={`relative w-full overflow-visible rounded-sm ${
        earthFeatureName ? 'h-[9px]' : 'h-3'
      }`}
    >
      <svg
        className="absolute inset-0 h-full w-full overflow-visible"
        viewBox={`0 0 ${sampleCount} 1`}
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        {(statuses ?? [null]).map((status, index) => (
          <rect
            key={index}
            x={index}
            y="0"
            width="1.01"
            height="1"
            fill={status ? colors[status] : colors.pending}
          />
        ))}
        {transitions.map((transition) => (
          <rect
            key={`${transition.index}-${transition.status ?? transition.enteringSunlight}`}
            x={transition.index - 0.5}
            y="0"
            width="1"
            height="1"
            fill={
              isSunlightTrack
                ? '#f8fafc'
                : colors[transition.status]
            }
          >
            <title>
              {formatUTC(anchorMs + transition.index * STEP_MIN * 60000)} ·{' '}
              {isSunlightTrack
                ? transition.enteringSunlight
                  ? 'Sunrise'
                  : 'Sunset'
                : transition.status}
            </title>
          </rect>
        ))}
        <line
          ref={playheadRef}
          x1="0"
          x2="0"
          y1="-0.45"
          y2="1.45"
          stroke={SUNLIGHT_TIMELINE_COLORS.playhead}
          strokeWidth={Math.max(1, sampleCount / 1200)}
        />
      </svg>
      <span className="sr-only">
        {isSunlightTrack
          ? 'Sunlight · transition ticks indicate sunrise or sunset'
          : `Communication · ${earthFeatureName}`}
      </span>
    </div>
  );
});

function windowStartForTime(timeMs, days, centered) {
  const durationMs = days * DAY_MS;
  const latestStartMs = MAX_CELESTIAL_TIME_MS - durationMs;
  const desiredStartMs = centered ? timeMs - durationMs / 2 : timeMs;
  return Math.max(
    MIN_CELESTIAL_TIME_MS,
    Math.min(latestStartMs, desiredStartMs)
  );
}

function windowStartForPosition(timeMs, days, position) {
  const durationMs = days * DAY_MS;
  const latestStartMs = MAX_CELESTIAL_TIME_MS - durationMs;
  const desiredStartMs = timeMs - durationMs * position;
  return Math.max(
    MIN_CELESTIAL_TIME_MS,
    Math.min(latestStartMs, desiredStartMs)
  );
}

export default function LunarSunlightTimeline({ feature, earthFeature = null }) {
  const siteId = feature.id;
  const latitude = feature.latitude;
  const longitude = feature.longitude;
  const [anchorMs, setAnchorMs] = useState(() => celestialTimeStore.get().ms);
  const [currentMs, setCurrentMs] = useState(() => celestialTimeStore.get().ms);
  const [forecast, setForecast] = useState(null);
  const [communicationForecast, setCommunicationForecast] = useState(null);
  const [error, setError] = useState(null);
  const [communicationError, setCommunicationError] = useState(null);
  const [playing, setPlaying] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(0);
  const [showCommTrack, setShowCommTrack] = useState(true);
  const dragging = useRef(false);
  const pointerFrame = useRef(0);
  const pendingPointerFraction = useRef(null);
  const sunlightPlayheadRef = useRef(null);
  const communicationPlayheadRef = useRef(null);
  const sunlightTrackRef = useRef(null);
  const currentTimeRef = useRef(currentMs);
  const zoomStartMsRef = useRef(null);
  const rangeDays = DAYS / (2 ** zoomLevel);
  const durationMs = rangeDays * DAY_MS;
  const durationMin = durationMs / 60000;
  const endMs = anchorMs + durationMs;

  useEffect(() => () => {
    if (pointerFrame.current !== 0) {
      cancelAnimationFrame(pointerFrame.current);
    }
  }, []);

  useEffect(() => {
    let alive = true;
    let request = null;
    let sequence = 0;

    const calculate = async (startMs) => {
      request?.abort();
      request = new AbortController();
      const id = ++sequence;
      setAnchorMs(startMs);
      setForecast(null);
      setCommunicationForecast(null);
      setError(null);
      setCommunicationError(null);

      const calculationOptions = {
        startMs,
        days: rangeDays,
        stepMin: STEP_MIN,
        signal: request.signal,
      };
      await ensurePolarDemLoaded().catch(() => {});

      const calculateSunlight = async () => {
        try {
          const result = await sweepIllumination({
            key: siteId,
            lat: latitude,
            lon: longitude,
            ...calculationOptions,
            horizonFn: (az) => horizonAt(HORIZON_TABLE, siteId, az, latitude, longitude) ?? 0,
          });
          if (alive && id === sequence && result) setForecast(result);
        } catch (calculationError) {
          if (alive && id === sequence) {
            console.error('Failed to calculate the lunar sunlight forecast.', calculationError);
            setError(calculationError);
          }
        }
      };
      const calculateCommunication = async () => {
        try {
          const result = await sweepEarthLink({
            moonFeature: feature,
            earthFeature: earthFeature || null,
            constraints: DEFAULT_DTE_CONSTRAINTS,
            terrainFn: (az) => horizonAt(HORIZON_TABLE, siteId, az, latitude, longitude) ?? 0,
            ...calculationOptions,
          });
          if (alive && id === sequence && result) {
            setCommunicationForecast(result);
          }
        } catch (calculationError) {
          if (alive && id === sequence) {
            console.error('Failed to calculate the communication forecast.', calculationError);
            setCommunicationError(calculationError);
          }
        }
      };

      void calculateSunlight();
      void calculateCommunication();
    };

    const currentMs = celestialTimeStore.get().ms;
    const requestedStartMs = zoomStartMsRef.current;
    zoomStartMsRef.current = null;
    const startMs =
      requestedStartMs ?? windowStartForTime(currentMs, rangeDays, zoomLevel > 0);
    calculate(startMs);

    const unsubscribe = celestialTimeStore.subscribe(({ ms, source }) => {
      currentTimeRef.current = ms;
      setCurrentMs(ms);
      if (source === 'ephemeris') {
        setPlaying(false);
        calculate(windowStartForTime(ms, rangeDays, zoomLevel > 0));
      } else if (source === 'playback') {
        setPlaying(false);
      }
    });

    return () => {
      alive = false;
      sequence++;
      request?.abort();
      unsubscribe();
    };
  }, [
    siteId,
    latitude,
    longitude,
    earthFeature?.id,
    earthFeature?.latitude,
    earthFeature?.longitude,
    rangeDays,
    zoomLevel,
  ]);

  useEffect(() => {
    if (!playing) return undefined;
    let frame = 0;
    let previous = null;
    let remainderMs = 0;
    const tick = (now) => {
      if (previous === null) {
        previous = now;
        frame = requestAnimationFrame(tick);
        return;
      }
      const elapsed = Math.max(0, Math.min(0.1, (now - previous) / 1000));
      previous = now;
      remainderMs += elapsed * DAY_MS;
      const minuteSteps = Math.floor(remainderMs / CELESTIAL_MINUTE_MS);
      let nextMs = currentTimeRef.current;
      if (minuteSteps > 0) {
        remainderMs %= CELESTIAL_MINUTE_MS;
        nextMs = Math.min(
          endMs,
          currentTimeRef.current + minuteSteps * CELESTIAL_MINUTE_MS
        );
        currentTimeRef.current = normalizeCelestialTimeMs(nextMs);
        celestialTimeStore.setTime(currentTimeRef.current, 'timeline');
      }
      if (nextMs >= endMs) {
        setPlaying(false);
        return;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing, anchorMs, endMs]);

  const timeAtFraction = (fraction) => {
    const boundedFraction = Math.max(0, Math.min(1, fraction));
    return normalizeCelestialTimeMs(
      Math.max(
        MIN_CELESTIAL_TIME_MS,
        Math.min(endMs, anchorMs + boundedFraction * durationMs)
      )
    );
  };

  const updatePlayhead = (timeMs) => {
    const position = Math.max(0, Math.min(1, (timeMs - anchorMs) / durationMs));
    const setPosition = (line, sampleCount) => {
      if (!line) return;
      const x = position * sampleCount;
      line.setAttribute('x1', String(x));
      line.setAttribute('x2', String(x));
    };
    setPosition(sunlightPlayheadRef.current, forecast?.visibility.length ?? 1);
    setPosition(
      communicationPlayheadRef.current,
      communicationForecast?.visibility.length ?? 1
    );
  };

  const setTimeAtFraction = (fraction, source = 'timeline') => {
    const timeMs = timeAtFraction(fraction);
    currentTimeRef.current = timeMs;
    setCurrentMs(timeMs);
    updatePlayhead(timeMs);
    celestialTimeStore.setTime(timeMs, source);
  };

  const updateDragTime = (fraction) => {
    const timeMs = timeAtFraction(fraction);
    if (timeMs === currentTimeRef.current) return;
    currentTimeRef.current = timeMs;
    updatePlayhead(timeMs);
    celestialTimeStore.setTime(timeMs, 'timeline-drag');
    setCurrentMs(timeMs);
  };

  const handlePointer = (event) => {
    if (!dragging.current) return;
    const bounds =
      sunlightTrackRef.current?.getBoundingClientRect() ??
      event.currentTarget.getBoundingClientRect();
    pendingPointerFraction.current =
      Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width));
    if (pointerFrame.current !== 0) return;
    pointerFrame.current = requestAnimationFrame(() => {
      pointerFrame.current = 0;
      const fraction = pendingPointerFraction.current;
      pendingPointerFraction.current = null;
      if (dragging.current && fraction !== null) {
        updateDragTime(fraction);
      }
    });
  };

  const finishPointerDrag = (event) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const fraction = (event.clientX - bounds.left) / bounds.width;
    if (pointerFrame.current !== 0) {
      cancelAnimationFrame(pointerFrame.current);
      pointerFrame.current = 0;
    }
    pendingPointerFraction.current = null;
    dragging.current = false;
    setTimeAtFraction(fraction, 'timeline-final');
  };

  const currentOffsetMin = (currentMs - anchorMs) / 60000;
  const sunlitPct = forecast?.sunlitPct;
  const longestDark = forecast?.longestDarkHours;
  const sunlightTransitions = useMemo(
    () => (forecast?.visibility ?? []).flatMap((status, index, statuses) => {
      if (index === 0) return [];
      const wasSunlit = statuses[index - 1] === 'sunlit';
      const isSunlit = status === 'sunlit';
      return wasSunlit === isSunlit
        ? []
        : [{ index, enteringSunlight: isSunlit }];
    }),
    [forecast?.visibility]
  );
  const communicationTransitions = useMemo(
    () => (communicationForecast?.visibility ?? []).flatMap((status, index, statuses) => {
      if (index === 0 || statuses[index - 1] === status) return [];
      return [{ index, status }];
    }),
    [communicationForecast?.visibility]
  );

  useEffect(() => {
    updatePlayhead(currentMs);
  }, [currentMs, anchorMs, forecast, communicationForecast]);
  const changeZoom = (delta) => {
    const nextZoomLevel = Math.max(
      0,
      Math.min(MAX_ZOOM_LEVEL, zoomLevel + delta)
    );
    if (nextZoomLevel === zoomLevel) return;
    const currentPosition = Math.max(
      0,
      Math.min(1, currentOffsetMin / durationMin)
    );
    zoomStartMsRef.current = windowStartForPosition(
      currentMs,
      DAYS / (2 ** nextZoomLevel),
      currentPosition
    );
    setPlaying(false);
    setZoomLevel(nextZoomLevel);
  };

  const activeCommLabel = earthFeature?.name || 'Any NASA DSN Complex';

  return (
    <section
      id="lunar-sunlight-timeline"
      data-guide="timeline"
      className="absolute bottom-0 left-0 right-0 z-40 min-h-[86px] h-auto border-t border-white/[0.08] bg-[#050507]/95 px-3 pt-2 pb-1.5 shadow-[0_-8px_30px_rgba(0,0,0,0.65)] backdrop-blur-xl sm:px-5"
      aria-label={`${rangeDays.toFixed(rangeDays < 1 ? 2 : 1)}-day sunlight & DTE timeline for ${feature.name}`}
    >
      <div className="mb-1.5 flex items-center justify-between gap-2 sm:gap-3">
        <div className="flex min-w-0 items-center gap-2 sm:gap-2.5 font-sans">
          <Clock3 className="h-3.5 w-3.5 shrink-0 text-lime-400" />
          <span className="shrink-0 text-[11px] font-semibold uppercase tracking-[0.06em] text-[#F8FAFC]">
            Timeline:
          </span>
          <span className="truncate text-[11px] font-semibold uppercase tracking-[0.06em] text-[#F8FAFC]">
            {feature.name}
          </span>
          <div className="flex items-center gap-2 text-[11px] font-medium text-[#94A3B8] shrink-0">
            <span className="hidden items-center gap-2 sm:inline-flex">
              <span className="inline-flex items-center gap-1">
                <i className="h-2 w-2 rounded-sm bg-lime-500" /> Day
              </span>
              <span className="inline-flex items-center gap-1">
                <i className="h-2 w-2 rounded-sm" style={{ backgroundColor: SUNLIGHT_TIMELINE_COLORS.blocked }} /> Terrain-Shadowed
              </span>
              <span className="inline-flex items-center gap-1">
                <i className="h-2 w-2 rounded-sm bg-slate-600" /> Night
              </span>
              <span className="mx-0.5 h-3 border-l border-white/[0.1]" />
            </span>
            <button
              type="button"
              aria-pressed={showCommTrack}
              onClick={() => setShowCommTrack((v) => !v)}
              className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10.5px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/70 ${
                showCommTrack
                  ? 'border-emerald-500/40 bg-emerald-950/40 text-emerald-300'
                  : 'border-white/[0.1] bg-[#0C0D12] text-[#8E95A5] hover:text-white'
              }`}
              title="Toggle Direct-to-Earth (DTE) Communication Horizon Track"
            >
              <Radio className="h-2.5 w-2.5 text-emerald-400 shrink-0" />
              <span className="truncate max-w-[90px] sm:max-w-none">DTE: {activeCommLabel}</span>
            </button>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2 font-mono text-[11px] font-medium text-[#E2E8F0] tabular-nums">
          {error ? (
            <span className="font-sans text-rose-300">Forecast unavailable</span>
          ) : forecast ? (
            <span>
              {sunlitPct.toFixed(0)}% sun <span className="text-[#636978]">·</span> dark {longestDark.toFixed(1)} h
            </span>
          ) : (
            <span className="font-sans text-[#8E95A5]">Calculating…</span>
          )}
          {communicationError && (
            <span className="font-sans text-rose-300" title={communicationError.message}>
              LOS unavailable
            </span>
          )}
          <button
            type="button"
            onClick={() => changeZoom(-1)}
            disabled={zoomLevel === 0}
            aria-label="Zoom out timeline"
            title="Show a longer forecast range"
            className="flex h-5 w-5 items-center justify-center rounded border border-white/[0.12] bg-[#0C0D12] text-[#E2E8F0] hover:border-white/30 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ZoomOut className="h-3 w-3" />
          </button>
          <span className="min-w-[36px] text-center text-[#94A3B8]">
            {rangeDays >= 1 ? `${rangeDays.toFixed(rangeDays % 1 ? 1 : 0)}d` : `${Math.round(rangeDays * 24)}h`}
          </span>
          <button
            type="button"
            onClick={() => changeZoom(1)}
            disabled={zoomLevel === MAX_ZOOM_LEVEL}
            aria-label="Zoom in timeline"
            title="Zoom around the playhead"
            className="flex h-5 w-5 items-center justify-center rounded border border-white/[0.12] bg-[#0C0D12] text-[#E2E8F0] hover:border-white/30 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ZoomIn className="h-3 w-3" />
          </button>
          <button
            type="button"
            onClick={() => setPlaying((value) => !value)}
            disabled={!forecast}
            aria-label={playing ? 'Pause ephemeris time' : 'Play ephemeris time'}
            className="flex h-5 w-5 items-center justify-center rounded border border-white/[0.12] bg-[#0C0D12] text-[#E2E8F0] hover:border-white/30 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            {playing ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
          </button>
        </div>
      </div>

      <div
        role="slider"
        aria-label={`Scrub ephemeris time across ${rangeDays.toFixed(2)}-day sunlight and communication timelines for ${feature.name}`}
        aria-valuemin={0}
        aria-valuemax={durationMin}
        aria-valuenow={Math.round(currentOffsetMin)}
        aria-valuetext={formatUTC(currentMs)}
        tabIndex={0}
        onPointerDown={(event) => {
          dragging.current = true;
          setPlaying(false);
          celestialTimeStore.setTime(currentTimeRef.current, 'timeline-drag');
          event.currentTarget.setPointerCapture(event.pointerId);
          handlePointer(event);
        }}
        onPointerMove={handlePointer}
        onPointerUp={(event) => {
          finishPointerDrag(event);
          if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId);
          }
        }}
        onPointerCancel={(event) => {
          finishPointerDrag(event);
        }}
        onKeyDown={(event) => {
          const increments = {
            ArrowLeft: -STEP_MIN * 60000,
            ArrowRight: STEP_MIN * 60000,
            PageDown: -DAY_MS,
            PageUp: DAY_MS,
            Home: -Infinity,
            End: Infinity,
          };
          if (!(event.key in increments)) return;
          event.preventDefault();
          if (event.key === 'Home') setTimeAtFraction(0);
          else if (event.key === 'End') setTimeAtFraction(1);
          else {
            const next = Math.max(
              anchorMs,
              Math.min(endMs, currentMs + increments[event.key])
            );
            celestialTimeStore.setTime(
              Math.max(MIN_CELESTIAL_TIME_MS, Math.min(MAX_CELESTIAL_TIME_MS, next)),
              'timeline'
            );
          }
        }}
        className="relative flex w-full cursor-ew-resize touch-none flex-col rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-lime-400/80 gap-1"
        style={{ touchAction: 'none' }}
      >
        <div className="grid grid-cols-[14px_minmax(0,1fr)] items-center gap-x-1.5">
          <span
            aria-label="Solar illumination timeline"
            title="Solar illumination: sunlit, terrain-shadowed, and lunar night"
            className="flex items-center justify-center pointer-events-none"
          >
            <Sun className="h-3 w-3 text-lime-400" aria-hidden="true" />
          </span>
          <div ref={sunlightTrackRef} className="min-w-0">
            <TimelineTrack
              kind="sunlight"
              statuses={forecast?.visibility}
              colors={SUNLIGHT_TIMELINE_COLORS}
              transitions={sunlightTransitions}
              anchorMs={anchorMs}
              playheadRef={sunlightPlayheadRef}
              earthFeatureName={showCommTrack ? activeCommLabel : null}
            />
          </div>
        </div>
        {showCommTrack && (
          <div className="grid grid-cols-[14px_minmax(0,1fr)] items-center gap-x-1.5">
            <span
              aria-label="Direct-to-Earth communication timeline"
              title={`Direct-to-Earth visibility: ${activeCommLabel}`}
              className="flex items-center justify-center pointer-events-none"
            >
              <Radio className="h-3 w-3 text-emerald-400" aria-hidden="true" />
            </span>
            <TimelineTrack
              kind="communication"
              statuses={communicationForecast?.visibility}
              colors={COMMUNICATION_TIMELINE_COLORS}
              transitions={communicationTransitions}
              anchorMs={anchorMs}
              playheadRef={communicationPlayheadRef}
              earthFeatureName={activeCommLabel}
            />
          </div>
        )}
      </div>
      <div
        data-testid="dte-timeline-color-legend"
        className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] font-sans font-medium text-[#94A3B8] leading-none"
      >
        {showCommTrack && (
          <>
            <span className="text-[10px] font-mono uppercase tracking-wider text-emerald-400 font-semibold">
              DTE Link:
            </span>
            <span className="inline-flex items-center gap-1">
              <i
                className="h-2 w-2 rounded-sm inline-block"
                style={{ backgroundColor: COMMUNICATION_TIMELINE_COLORS.clear }}
              />
              <span>Clear / Link Active</span>
            </span>
            <span className="inline-flex items-center gap-1">
              <i
                className="h-2 w-2 rounded-sm inline-block"
                style={{ backgroundColor: COMMUNICATION_TIMELINE_COLORS.doubtful }}
              />
              <span>Marginal / Grazing</span>
            </span>
            <span className="inline-flex items-center gap-1">
              <i
                className="h-2 w-2 rounded-sm inline-block"
                style={{ backgroundColor: COMMUNICATION_TIMELINE_COLORS.blocked }}
              />
              <span>Blocked / No LOS</span>
            </span>
          </>
        )}
      </div>

      <div className="mt-1.5 flex items-center justify-between gap-2 text-[11px]">
        <span className="truncate font-mono text-[#8E95A5] tabular-nums">{formatUTC(anchorMs)}</span>
        <span className="max-w-[65%] truncate text-center text-[11.5px] font-sans font-medium text-[#94A3B8]">
          Current Viewport Time: <strong className="font-mono font-semibold text-[#F8FAFC] tabular-nums ml-1">{formatUTC(currentMs)}</strong>
        </span>
        <span className="truncate text-right font-mono text-[#8E95A5] tabular-nums">{formatUTC(endMs)}</span>
      </div>
    </section>
  );
}
