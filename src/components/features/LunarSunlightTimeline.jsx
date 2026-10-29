import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pause, Play, Radio, Sun, ZoomIn, ZoomOut } from 'lucide-react';
import { celestialTimeStore, MAX_CELESTIAL_TIME_MS, MIN_CELESTIAL_TIME_MS } from '../../utils/celestialTime.js';
import { sweepIllumination } from '../../utils/illumination.js';
import { DEFAULT_DTE_CONSTRAINTS, sweepEarthLink } from '../../utils/earthLink.js';
import { HORIZON_TABLE, horizonAt } from "../../utils/horizons.js";

const DAYS = 30;
const DAY_MS = 86400000;
const STEP_MIN = 30;
const MAX_ZOOM_LEVEL = 5;

export const SUNLIGHT_TIMELINE_COLORS = {
  sunlit: '#19cc16',
  blocked: '#fa5215',
  night: '#475569',
  pending: '#1e293b',
  playhead: '#f8fafc',
};

export const COMMUNICATION_TIMELINE_COLORS = {
  clear: '#1dffac',
  doubtful: '#facc15',
  blocked: '#f43f5e',
  pending: '#1e293b',
};

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

/**
 * Zoomable sunlight and communication forecasts for a selected lunar location.
 * Scrubbing the timeline publishes time to the shared ephemeris clock.
 */
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
  const dragging = useRef(false);
  const pointerFrame = useRef(0);
  const pendingPointerFraction = useRef(null);
  const lastDragPublishAt = useRef(0);
  const sunlightPlayheadRef = useRef(null);
  const communicationPlayheadRef = useRef(null);
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
      const calculateSunlight = async () => {
        try {
          const result = await sweepIllumination({
            key: siteId,
            lat: latitude,
            lon: longitude,
            ...calculationOptions,
            horizonFn: (az) => horizonAt(HORIZON_TABLE, siteId, az) ?? 0,
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
        if (!earthFeature) return;
        try {
          const result = await sweepEarthLink({
            moonFeature: feature,
            earthFeature,
            constraints: DEFAULT_DTE_CONSTRAINTS,
            terrainFn: (az) => horizonAt(HORIZON_TABLE, siteId, az),
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
    const tick = (now) => {
      if (previous === null) {
        previous = now;
        frame = requestAnimationFrame(tick);
        return;
      }
      const elapsed = Math.max(0, Math.min(0.1, (now - previous) / 1000));
      previous = now;
      const nextMs = Math.min(
        endMs,
        currentTimeRef.current + elapsed * DAY_MS
      );
      celestialTimeStore.setTime(nextMs, 'timeline');
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
    return Math.max(
      MIN_CELESTIAL_TIME_MS,
      Math.min(endMs, anchorMs + boundedFraction * durationMs)
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
    currentTimeRef.current = timeMs;
    updatePlayhead(timeMs);
    celestialTimeStore.setTime(timeMs, 'timeline-drag');

    // Keep the text readout responsive without rendering the panel every frame.
    const now = performance.now();
    if (now - lastDragPublishAt.current >= 100) {
      lastDragPublishAt.current = now;
      setCurrentMs(timeMs);
    }
  };

  const handlePointer = (event) => {
    if (!dragging.current) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    pendingPointerFraction.current =
      (event.clientX - bounds.left) / bounds.width;
    if (pointerFrame.current !== 0) return;
    // Collapse high-frequency pointer events into one playhead update per frame.
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
    lastDragPublishAt.current = 0;
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

  return (
    <section
      id="lunar-sunlight-timeline"
      className={`absolute bottom-7 left-0 right-0 z-40 border-t border-slate-700/80 bg-slate-950/95 px-2 pt-1.5 pb-1 shadow-[0_-8px_30px_rgba(0,0,0,0.45)] backdrop-blur-xl sm:px-4 ${
        earthFeature ? 'h-[82px]' : 'h-[67px]'
      }`}
      aria-label={`${rangeDays.toFixed(rangeDays < 1 ? 2 : 1)}-day sunlight timeline for ${feature.name}`}
    >
      <div className="mb-1 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <Sun className="h-3 w-3 shrink-0 text-lime-400" />
          <span className="truncate text-[9px] font-semibold uppercase tracking-wider text-slate-200 sm:text-[10px]">
            {feature.name}
          </span>
          <span className="hidden items-center gap-2 text-[9px] text-slate-400 sm:flex">
            <span className="inline-flex items-center gap-1">
              <i className="h-2 w-2 rounded-sm bg-lime-500" /> Sunlit
            </span>
            <span className="inline-flex items-center gap-1">
              <i className="h-2 w-2 rounded-sm" style={{ backgroundColor: SUNLIGHT_TIMELINE_COLORS.blocked }} /> Terrain
            </span>
            <span className="inline-flex items-center gap-1">
              <i className="h-2 w-2 rounded-sm bg-slate-600" /> Night
            </span>
            {earthFeature && (
              <>
                <span className="mx-0.5 h-2.5 border-l border-slate-700" />
                <span className="inline-flex items-center gap-1 text-slate-300">
                  <Radio className="h-3 w-3" /> LOS
                </span>
                <span className="inline-flex items-center gap-1">
                  <i className="h-2 w-2 rounded-sm" style={{ backgroundColor: COMMUNICATION_TIMELINE_COLORS.clear }} /> Link
                </span>
                <span className="inline-flex items-center gap-1">
                  <i className="h-2 w-2 rounded-sm" style={{ backgroundColor: COMMUNICATION_TIMELINE_COLORS.doubtful }} /> Marginal
                </span>
                <span className="inline-flex items-center gap-1">
                  <i className="h-2 w-2 rounded-sm" style={{ backgroundColor: COMMUNICATION_TIMELINE_COLORS.blocked }} /> No link
                </span>
              </>
            )}
          </span>
        </div>

        <div className="flex shrink-0 items-center gap-1.5 font-mono text-[8px] text-slate-300 sm:text-[9px]">
          {error ? (
            <span className="text-rose-300">Forecast unavailable</span>
          ) : forecast ? (
            <span>
              {sunlitPct.toFixed(0)}% sun · dark {longestDark.toFixed(1)} h
            </span>
          ) : (
            <span>Calculating…</span>
          )}
          {earthFeature && communicationError && (
            <span className="text-rose-300" title={communicationError.message}>
              LOS unavailable
            </span>
          )}
          <button
            type="button"
            onClick={() => changeZoom(-1)}
            disabled={zoomLevel === 0}
            aria-label="Zoom out timeline"
            title="Show a longer forecast range"
            className="flex h-5 w-5 items-center justify-center rounded border border-slate-700 text-slate-200 hover:border-lime-500/60 hover:text-lime-300 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ZoomOut className="h-3 w-3" />
          </button>
          <span className="min-w-[38px] text-center text-slate-400">
            {rangeDays >= 1 ? `${rangeDays.toFixed(rangeDays % 1 ? 1 : 0)}d` : `${Math.round(rangeDays * 24)}h`}
          </span>
          <button
            type="button"
            onClick={() => changeZoom(1)}
            disabled={zoomLevel === MAX_ZOOM_LEVEL}
            aria-label="Zoom in timeline"
            title="Zoom around the playhead"
            className="flex h-5 w-5 items-center justify-center rounded border border-slate-700 text-slate-200 hover:border-lime-500/60 hover:text-lime-300 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ZoomIn className="h-3 w-3" />
          </button>
          <button
            type="button"
            onClick={() => setPlaying((value) => !value)}
            disabled={!forecast}
            aria-label={playing ? 'Pause ephemeris time' : 'Play ephemeris time'}
            className="flex h-5 w-5 items-center justify-center rounded border border-slate-700 text-slate-200 hover:border-lime-500/60 hover:text-lime-300 disabled:cursor-not-allowed disabled:opacity-40"
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
          lastDragPublishAt.current = performance.now();
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
        className={`relative flex w-full cursor-ew-resize touch-none flex-col rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-lime-400/80 ${
          earthFeature ? 'gap-1' : ''
        }`}
        style={{ touchAction: 'none' }}
      >
        <TimelineTrack
          kind="sunlight"
          statuses={forecast?.visibility}
          colors={SUNLIGHT_TIMELINE_COLORS}
          transitions={sunlightTransitions}
          anchorMs={anchorMs}
          playheadRef={sunlightPlayheadRef}
          earthFeatureName={earthFeature?.name}
        />
        {earthFeature && (
          <TimelineTrack
            kind="communication"
            statuses={communicationForecast?.visibility}
            colors={COMMUNICATION_TIMELINE_COLORS}
            transitions={communicationTransitions}
            anchorMs={anchorMs}
            playheadRef={communicationPlayheadRef}
            earthFeatureName={earthFeature.name}
          />
        )}
      </div>

      <div className="mt-1 flex items-center justify-between gap-2 font-mono text-[7px] text-slate-400 sm:text-[8px]">
        <span className="truncate">{formatUTC(anchorMs)}</span>
        <span className="max-w-[50%] truncate text-center text-slate-200">
          {formatUTC(currentMs)}
        </span>
        <span className="truncate text-right">{formatUTC(endMs)}</span>
      </div>
    </section>
  );
}
