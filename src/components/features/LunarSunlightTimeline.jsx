import React, { useEffect, useRef, useState } from 'react';
import { Pause, Play, Radio, Sun, ZoomIn, ZoomOut } from 'lucide-react';
import { celestialTimeStore, MAX_CELESTIAL_TIME_MS, MIN_CELESTIAL_TIME_MS } from '../../utils/celestialTime.js';
import { sweepIllumination } from '../../utils/illumination.js';
import { sweepCommunication } from '../../utils/communication.js';

const DAYS = 30;
const DAY_MS = 86400000;
const STEP_MIN = 30;
const MAX_ZOOM_LEVEL = 5;

export const SUNLIGHT_TIMELINE_COLORS = {
  sunlit: '#84cc16',
  blocked: '#facc15',
  night: '#475569',
  pending: '#1e293b',
  playhead: '#f8fafc',
};

export const COMMUNICATION_TIMELINE_COLORS = {
  clear: '#22c55e',
  doubtful: '#facc15',
  blocked: '#ef4444',
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

function windowStartForTime(timeMs, days, centered) {
  const durationMs = days * DAY_MS;
  const latestStartMs = MAX_CELESTIAL_TIME_MS - durationMs;
  const desiredStartMs = centered ? timeMs - durationMs / 2 : timeMs;
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
  const currentTimeRef = useRef(currentMs);
  const centerWindowRef = useRef(false);
  const rangeDays = DAYS / (2 ** zoomLevel);
  const durationMs = rangeDays * DAY_MS;
  const durationMin = durationMs / 60000;
  const endMs = anchorMs + durationMs;

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
            horizonFn: () => 0,
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
          const result = await sweepCommunication({
            moonFeature: feature,
            earthFeature,
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
    const centered = centerWindowRef.current || zoomLevel > 0;
    centerWindowRef.current = false;
    calculate(windowStartForTime(currentMs, rangeDays, centered));

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
        currentTimeRef.current + elapsed * 3600000
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

  const setTimeAtFraction = (fraction) => {
    const boundedFraction = Math.max(0, Math.min(1, fraction));
    const timeMs = Math.max(
      MIN_CELESTIAL_TIME_MS,
      Math.min(endMs, anchorMs + boundedFraction * durationMs)
    );
    celestialTimeStore.setTime(timeMs, 'timeline');
  };

  const handlePointer = (event) => {
    if (!dragging.current) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    setTimeAtFraction((event.clientX - bounds.left) / bounds.width);
  };

  const currentOffsetMin = (currentMs - anchorMs) / 60000;
  const playheadX = Math.max(
    0,
    Math.min(1, currentOffsetMin / durationMin)
  ) * (forecast?.visibility.length ?? 1);
  const sunlitPct = forecast?.sunlitPct;
  const longestDark = forecast?.longestDarkHours;
  const sunlightTransitions = (forecast?.visibility ?? []).flatMap((status, index, statuses) => {
    if (index === 0) return [];
    const wasSunlit = statuses[index - 1] === 'sunlit';
    const isSunlit = status === 'sunlit';
    return wasSunlit === isSunlit
      ? []
      : [{ index, enteringSunlight: isSunlit }];
  });
  const communicationTransitions = (
    communicationForecast?.visibility ?? []
  ).flatMap((status, index, statuses) => {
    if (index === 0 || statuses[index - 1] === status) return [];
    return [{ index, status }];
  });
  const changeZoom = (delta) => {
    const nextZoomLevel = Math.max(
      0,
      Math.min(MAX_ZOOM_LEVEL, zoomLevel + delta)
    );
    if (nextZoomLevel === zoomLevel) return;
    centerWindowRef.current = true;
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
              <i className="h-2 w-2 rounded-sm bg-yellow-400" /> Horizon
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
                  <i className="h-2 w-2 rounded-sm bg-green-500" /> Link
                </span>
                <span className="inline-flex items-center gap-1">
                  <i className="h-2 w-2 rounded-sm bg-yellow-400" /> Doubtful
                </span>
                <span className="inline-flex items-center gap-1">
                  <i className="h-2 w-2 rounded-sm bg-red-500" /> Blocked
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
          event.currentTarget.setPointerCapture(event.pointerId);
          handlePointer(event);
        }}
        onPointerMove={handlePointer}
        onPointerUp={(event) => {
          dragging.current = false;
          if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId);
          }
        }}
        onPointerCancel={() => {
          dragging.current = false;
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
        {[
          {
            key: 'sunlight',
            statuses: forecast?.visibility,
            colors: SUNLIGHT_TIMELINE_COLORS,
            transitions: sunlightTransitions,
            title: 'Sunlight · transition ticks indicate sunrise or sunset',
            transitionColor: '#f8fafc',
            transitionTitle: (transition, index) =>
              `${formatUTC(anchorMs + transition.index * STEP_MIN * 60000)} · ${
                transition.enteringSunlight ? 'Sunrise' : 'Sunset'
              }`,
          },
          ...(earthFeature
            ? [
                {
                  key: 'communication',
                  statuses: communicationForecast?.visibility,
                  colors: COMMUNICATION_TIMELINE_COLORS,
                  transitions: communicationTransitions,
                  title: `Communication · ${earthFeature.name}`,
                  transitionColor: null,
                  transitionTitle: (transition) =>
                    `${formatUTC(anchorMs + transition.index * STEP_MIN * 60000)} · ${
                      transition.status
                    }`,
                },
              ]
            : []),
        ].map((track) => {
          const sampleCount = track.statuses?.length ?? 1;
          return (
            <div
              key={track.key}
              className={`relative w-full overflow-visible rounded-sm ${
                earthFeature ? 'h-[9px]' : 'h-3'
              }`}
            >
              <svg
                className="absolute inset-0 h-full w-full overflow-visible"
                viewBox={`0 0 ${sampleCount} 1`}
                preserveAspectRatio="none"
                aria-hidden="true"
              >
                {(track.statuses ?? [null]).map((status, index) => (
                  <rect
                    key={index}
                    x={index}
                    y="0"
                    width="1.01"
                    height="1"
                    fill={
                      status
                        ? track.colors[status]
                        : track.colors.pending
                    }
                  />
                ))}
                {track.transitions.map((transition) => (
                  <rect
                    key={`${transition.index}-${transition.status ?? transition.enteringSunlight}`}
                    x={transition.index - 0.5}
                    y="0"
                    width="1"
                    height="1"
                    fill={
                      track.transitionColor ??
                      track.colors[transition.status]
                    }
                  >
                    <title>{track.transitionTitle(transition)}</title>
                  </rect>
                ))}
                <line
                  x1={playheadX}
                  x2={playheadX}
                  y1="-0.45"
                  y2="1.45"
                  stroke={SUNLIGHT_TIMELINE_COLORS.playhead}
                  strokeWidth={Math.max(1, sampleCount / 1200)}
                />
              </svg>
              <span className="sr-only">{track.title}</span>
            </div>
          );
        })}
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
