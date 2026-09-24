import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Sun,
  Globe2,
  Clock,
  Play,
  Pause,
  Eye,
  EyeOff,
  ChevronUp,
  ChevronDown,
  Maximize2,
} from 'lucide-react';
import { formatLunarCoordinates } from '../../utils/coordinates.js';

// The ephemeris models are validated for these years; the date input enforces the same range.
const MIN_MS = Date.UTC(1900, 0, 1);
const MAX_MS = Date.UTC(2100, 11, 31, 23, 59);

const RATES = [
  { label: '1 min/s', value: 60 },
  { label: '1 hour/s', value: 3600 },
  { label: '1 day/s', value: 86400 },
  { label: '1 week/s', value: 604800 },
];

const STEPS = [
  { label: '−1 d', ms: -86400000 },
  { label: '−1 h', ms: -3600000 },
  { label: '+1 h', ms: 3600000 },
  { label: '+1 d', ms: 86400000 },
];

const toInputValue = (ms) => new Date(ms).toISOString().slice(0, 16);
const fromInputValue = (value) => {
  const ms = Date.parse(`${value}:00Z`);
  return Number.isNaN(ms) ? null : ms;
};

const fmtInt = (n) => Math.round(n).toLocaleString('en-US');
const fmtPercent = (fraction) => `${(fraction * 100).toFixed(fraction < 0.1 || fraction > 0.9 ? 1 : 0)}%`;
const fmtPoint = (lon, lat) => {
  const { latStr, lonStr } = formatLunarCoordinates(lon, lat, 1);
  return `${latStr}, ${lonStr}`;
};

function Row({ label, value }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-[11px] text-slate-400">{label}</dt>
      <dd className="font-mono text-[11px] text-slate-100 text-right">{value}</dd>
    </div>
  );
}

function Readout({ icon: Icon, title, accent, children }) {
  return (
    <section className="rounded-xl border border-slate-800/80 bg-slate-950/60 p-2.5">
      <div className="mb-1.5 flex items-center gap-1.5">
        <Icon className={`h-3.5 w-3.5 ${accent}`} />
        <h3 className={`text-xs font-semibold ${accent}`}>{title}</h3>
      </div>
      <dl className="space-y-1">{children}</dl>
    </section>
  );
}

/**
 * Earth & Sun panel for the 3D globe: date/time controls and live astronomical readouts.
 * It owns the time engine and talks to the globe imperatively, so animating the time
 * never re-renders the rest of the app.
 *
 * @param {{
 *   globeRef: React.RefObject<any>,
 *   isActive: boolean
 * }} props
 */
export default function CelestialPanel({ globeRef, isActive }) {
  const [expanded, setExpanded] = useState(
    () => typeof window === 'undefined' || window.innerWidth >= 640
  );
  const [overlayVisible, setOverlayVisible] = useState(true);
  const [live, setLive] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [rate, setRate] = useState(3600);
  const [shownTime, setShownTime] = useState(() => Date.now());
  const [state, setState] = useState(null);

  const timeRef = useRef(Date.now());
  const lastPublishRef = useRef(0);

  /** Applies a time to the globe; publishes to React state at most ~4 times a second. */
  const applyTime = useCallback(
    (ms, { force = false } = {}) => {
      const clamped = Math.min(MAX_MS, Math.max(MIN_MS, ms));
      timeRef.current = clamped;
      const next = globeRef.current?.setCelestialTime?.(new Date(clamped));
      const now = performance.now();
      if (force || now - lastPublishRef.current >= 250) {
        lastPublishRef.current = now;
        setShownTime(clamped);
        if (next) setState(next);
      }
      return clamped;
    },
    [globeRef]
  );

  // The globe is destroyed and rebuilt when switching 2D/3D, so re-apply everything on return
  useEffect(() => {
    if (!isActive) return;
    globeRef.current?.setCelestialVisible?.(overlayVisible);
    if (!live) applyTime(timeRef.current, { force: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive]);

  // Live mode: follow the wall clock
  useEffect(() => {
    if (!isActive || !live) return undefined;
    applyTime(Date.now(), { force: true });
    const id = setInterval(() => applyTime(Date.now(), { force: true }), 1000);
    return () => clearInterval(id);
  }, [isActive, live, applyTime]);

  // Time-lapse
  useEffect(() => {
    if (!isActive || !playing) return undefined;
    let raf = 0;
    let last = null;
    const tick = (now) => {
      if (last === null) {
        last = now; // seed from the frame clock itself
        raf = requestAnimationFrame(tick);
        return;
      }
      const dt = Math.max(0, Math.min(0.1, (now - last) / 1000)); // ignore long gaps (hidden tab)
      last = now;
      const target = timeRef.current + dt * rate * 1000;
      const applied = applyTime(target);
      if (applied !== target) {
        setPlaying(false); // reached the end of the supported range
        applyTime(applied, { force: true });
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [isActive, playing, rate, applyTime]);

  const handleDateChange = (e) => {
    const ms = fromInputValue(e.target.value);
    if (ms === null) return;
    setLive(false);
    setPlaying(false);
    applyTime(ms, { force: true });
  };

  const handleStep = (deltaMs) => {
    setLive(false);
    setPlaying(false);
    applyTime(timeRef.current + deltaMs, { force: true });
  };

  const handleNow = () => {
    setPlaying(false);
    setLive(true);
  };

  const handleTogglePlay = () => {
    if (playing) {
      setPlaying(false);
    } else {
      setLive(false);
      setPlaying(true);
    }
  };

  const handleToggleVisible = () => {
    const next = !overlayVisible;
    setOverlayVisible(next);
    globeRef.current?.setCelestialVisible?.(next);
  };

  const handleFrame = () => {
    if (!overlayVisible) {
      setOverlayVisible(true);
      globeRef.current?.setCelestialVisible?.(true);
    }
    globeRef.current?.flyToCelestialOverview?.();
  };

  if (!isActive) return null;

  const { earth, sun, moon } = state || {};
  const iconButton =
    'p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/70';
  const chipButton =
    'px-2 py-1 rounded-lg text-[11px] font-medium text-slate-300 bg-slate-900 hover:bg-slate-800 hover:text-white border border-slate-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/70';

  return (
    <div
      id="celestial-panel"
      className="absolute bottom-14 left-3 sm:left-4 z-20 w-[min(21rem,calc(100vw-1.5rem))] max-h-[calc(100vh-11rem)] flex flex-col bg-slate-900/95 backdrop-blur-xl border border-slate-800 rounded-2xl shadow-2xl overflow-hidden pointer-events-auto"
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-slate-800 bg-slate-950/50">
        <div className="flex items-center gap-2 min-w-0">
          <Sun className="h-4 w-4 shrink-0 text-amber-400" />
          <h2 className="text-sm font-semibold text-slate-100 truncate">Earth &amp; Sun</h2>
          {live && (
            <span className="flex items-center gap-1 text-[10px] font-medium text-emerald-300">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Live
            </span>
          )}
        </div>
        <div className="flex items-center gap-0.5 shrink-0">
          <button
            type="button"
            id="btn-celestial-frame"
            onClick={handleFrame}
            className={iconButton}
            title="Frame the Moon, Earth and Sun"
            aria-label="Frame the Moon, Earth and Sun"
          >
            <Maximize2 className="h-4 w-4" />
          </button>
          <button
            type="button"
            id="btn-celestial-visibility"
            onClick={handleToggleVisible}
            className={iconButton}
            title={overlayVisible ? 'Hide Earth and Sun in the 3D view' : 'Show Earth and Sun in the 3D view'}
            aria-label={overlayVisible ? 'Hide Earth and Sun' : 'Show Earth and Sun'}
            aria-pressed={overlayVisible}
          >
            {overlayVisible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
          </button>
          <button
            type="button"
            id="btn-celestial-collapse"
            onClick={() => setExpanded((v) => !v)}
            className={iconButton}
            aria-label={expanded ? 'Collapse Earth and Sun panel' : 'Expand Earth and Sun panel'}
            aria-expanded={expanded}
          >
            {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="overflow-y-auto custom-scrollbar p-3 space-y-3">
          {/* Time controls */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <label htmlFor="celestial-datetime" className="sr-only">
                Date and time (UTC)
              </label>
              <div className="relative flex-1">
                <Clock className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
                <input
                  id="celestial-datetime"
                  type="datetime-local"
                  value={toInputValue(shownTime)}
                  min="1900-01-01T00:00"
                  max="2100-12-31T23:59"
                  onChange={handleDateChange}
                  style={{ colorScheme: 'dark' }}
                  className="w-full h-8 pl-7 pr-1 bg-slate-950 border border-slate-800 focus:border-cyan-500/80 rounded-lg text-[11px] font-mono text-slate-100 focus:outline-none focus:ring-1 focus:ring-cyan-500/50"
                />
              </div>
              <span className="text-[10px] font-medium text-slate-500">UTC</span>
              <button
                type="button"
                id="btn-celestial-now"
                onClick={handleNow}
                disabled={live}
                className={`${chipButton} disabled:opacity-40 disabled:cursor-default`}
                title="Follow the current time"
              >
                Now
              </button>
            </div>

            <div className="flex items-center gap-1.5">
              {STEPS.map((s) => (
                <button
                  key={s.label}
                  type="button"
                  onClick={() => handleStep(s.ms)}
                  className={chipButton}
                  aria-label={`Step ${s.label.replace('−', 'back ').replace('+', 'forward ')}`}
                >
                  {s.label}
                </button>
              ))}
              <div className="ml-auto flex items-center gap-1.5">
                <label htmlFor="celestial-rate" className="sr-only">
                  Time-lapse speed
                </label>
                <select
                  id="celestial-rate"
                  value={rate}
                  onChange={(e) => setRate(Number(e.target.value))}
                  className="h-7 rounded-lg bg-slate-950 border border-slate-800 px-1 text-[11px] text-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-500/70"
                  style={{ colorScheme: 'dark' }}
                >
                  {RATES.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  id="btn-celestial-play"
                  onClick={handleTogglePlay}
                  className={`flex h-7 w-7 items-center justify-center rounded-lg border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/70 ${
                    playing
                      ? 'bg-cyan-500 border-cyan-400 text-white'
                      : 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`}
                  title={playing ? 'Pause time-lapse' : 'Play time-lapse'}
                  aria-label={playing ? 'Pause time-lapse' : 'Play time-lapse'}
                  aria-pressed={playing}
                >
                  {playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                </button>
              </div>
            </div>
          </div>

          {/* Readouts */}
          {earth && sun && moon ? (
            <div className="space-y-2">
              <Readout icon={Globe2} title="Earth" accent="text-sky-300">
                <Row label="Distance" value={`${fmtInt(earth.distanceKm)} km`} />
                <Row label="Sub-Earth point" value={fmtPoint(earth.subLon, earth.subLat)} />
                <Row label="Apparent diameter" value={`${earth.angularDiameterDeg.toFixed(2)}°`} />
                <Row label="Sunlit, seen from Moon" value={fmtPercent(earth.litFraction)} />
                <Row label="Moon overhead at" value={fmtPoint(earth.sublunar.lon, earth.sublunar.lat)} />
              </Readout>

              <Readout icon={Sun} title="Sun" accent="text-amber-300">
                <Row
                  label="Distance"
                  value={`${(sun.distanceKm / 1e6).toFixed(2)} M km · ${sun.distanceAU.toFixed(4)} AU`}
                />
                <Row label="Subsolar point" value={fmtPoint(sun.subLon, sun.subLat)} />
                <Row label="Apparent diameter" value={`${sun.angularDiameterDeg.toFixed(3)}°`} />
                <Row label="Moon lit, seen from Earth" value={fmtPercent(moon.illuminatedFraction)} />
              </Readout>
            </div>
          ) : (
            <p className="text-[11px] text-slate-400">Waiting for the 3D view…</p>
          )}

          <p className="text-[10px] leading-snug text-slate-500">
            Directions are exact. Sizes and display distances are compressed to fit the view; labels
            give the true distances. Turn on solar shading to see the terminator follow the Sun.
          </p>
        </div>
      )}
    </div>
  );
}
