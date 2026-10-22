/**
 * @file CelestialPanel.jsx
 * Controls the shared UTC clock and displays Earth, Sun, and Moon ephemeris data.
 */

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
  X,
  Navigation,
} from 'lucide-react';
import { formatLunarCoordinates } from '../../utils/coordinates.js';
import {
  celestialTimeStore,
  MIN_CELESTIAL_TIME_MS,
  MAX_CELESTIAL_TIME_MS,
} from '../../utils/celestialTime.js';

// The ephemeris models are validated for these years; the date input enforces the same range.
const MIN_MS = MIN_CELESTIAL_TIME_MS;
const MAX_MS = MAX_CELESTIAL_TIME_MS;

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
 *   isActive: boolean,
 *   isOpen?: boolean,
 *   onClose?: () => void,
 *   vectorsVisible?: boolean,
 *   onToggleVectors?: () => void
 * }} props
 */
export default function CelestialPanel({
  globeRef,
  isActive,
  isOpen = true,
  onClose,
  vectorsVisible: propVectorsVisible,
  onToggleVectors: propToggleVectors,
}) {
  const [expanded, setExpanded] = useState(
    () => typeof window === 'undefined' || window.innerWidth >= 640
  );
  const [overlayVisible, setOverlayVisible] = useState(true);
  const [internalVectorsVisible, setInternalVectorsVisible] = useState(false); // Default is OFF as requested
  const vectorsVisible = propVectorsVisible !== undefined ? propVectorsVisible : internalVectorsVisible;
  const [live, setLive] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [rate, setRate] = useState(3600);
  const [shownTime, setShownTime] = useState(() => celestialTimeStore.get().ms);
  const [state, setState] = useState(null);

  const timeRef = useRef(celestialTimeStore.get().ms);
  const lastPublishRef = useRef(0);

  /** Applies a time to the globe; publishes to React state at most ~4 times a second. */
  const applyTime = useCallback(
    (ms, { force = false, source = 'ephemeris' } = {}) => {
      const clamped = Math.min(MAX_MS, Math.max(MIN_MS, ms));
      timeRef.current = clamped;
      celestialTimeStore.setTime(clamped, source);
      const next = globeRef.current?.getCelestialState?.();
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

  // Subscribe separately from the local controls so other time publishers stay in sync.
  useEffect(() => celestialTimeStore.subscribe(({ ms, source }) => {
    timeRef.current = ms;
    if (source === 'timeline') {
      setLive(false);
      setPlaying(false);
    }
    const now = performance.now();
    if (now - lastPublishRef.current >= 250) {
      lastPublishRef.current = now;
      setShownTime(ms);
      const next = globeRef.current?.getCelestialState?.();
      if (next) setState(next);
    }
  }), [globeRef]);

  // The globe may be recreated while the shared clock is paused at a chosen date.
  useEffect(() => {
    if (!isActive) return;
    globeRef.current?.setCelestialVisible?.(overlayVisible);
    globeRef.current?.setCelestialVectorsVisible?.(vectorsVisible);
    if (!live) applyTime(timeRef.current, { force: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive]);

  // Keep the shared clock current even when the panel is closed or the app is in 2D mode.
  useEffect(() => {
    if (!live) return undefined;
    applyTime(Date.now(), { force: true, source: 'live' });
    const id = setInterval(
      () => applyTime(Date.now(), { force: true, source: 'live' }),
      1000
    );
    return () => clearInterval(id);
  }, [live, applyTime]);

  // Time-lapse
  useEffect(() => {
    if (!playing) return undefined;
    let raf = 0;
    let last = null;
    const tick = (now) => {
      if (last === null) {
        last = now; // seed from the frame clock itself
        raf = requestAnimationFrame(tick);
        return;
      }
      if (now - last < 33) { // cap time-lapse updates at ~30 Hz
        raf = requestAnimationFrame(tick);
        return;
      }
      const dt = Math.max(0, Math.min(0.1, (now - last) / 1000)); // ignore long gaps (hidden tab)
      last = now;
      const target = timeRef.current + dt * rate * 1000;
      const applied = applyTime(target, { source: 'playback' });
      if (applied !== target) {
        setPlaying(false); // reached the end of the supported range
        applyTime(applied, { force: true, source: 'playback' });
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
    applyTime(Date.now(), { force: true, source: 'ephemeris' });
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

  const handleToggleVectors = () => {
    if (propToggleVectors) {
      propToggleVectors();
    } else {
      const next = !vectorsVisible;
      setInternalVectorsVisible(next);
      globeRef.current?.setCelestialVectorsVisible?.(next);
    }
  };

  const handleFrame = () => {
    if (!overlayVisible) {
      setOverlayVisible(true);
      globeRef.current?.setCelestialVisible?.(true);
    }
    globeRef.current?.flyToCelestialOverview?.();
  };

  if (!isActive || !isOpen) return null;

  const { earth, sun, moon } = state || {};
  const iconButton =
    'p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/70';
  const chipButton =
    'px-2 py-1 rounded-lg text-[11px] font-medium text-slate-300 bg-slate-900 hover:bg-slate-800 hover:text-white border border-slate-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/70';

  return (
    <div
      id="celestial-panel"
      className="absolute top-14 right-3 sm:right-4 z-30 w-[min(22rem,calc(100vw-2rem))] max-h-[calc(100vh-5rem)] flex flex-col bg-[#060b14]/96 backdrop-blur-2xl border border-slate-800 rounded-xl shadow-2xl shadow-black/80 overflow-hidden pointer-events-auto transition-all animate-in fade-in select-none"
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2 px-3.5 py-2.5 border-b border-slate-800 bg-slate-900/60">
        <div className="flex items-center gap-2 min-w-0">
          <Sun className="h-4 w-4 shrink-0 text-amber-400" />
          <h2 className="text-xs font-bold text-slate-100 uppercase tracking-wider truncate">
            Celestial Ephemeris
          </h2>
          {live && (
            <span className="font-mono text-[9px] uppercase px-1.5 py-0.5 rounded bg-emerald-950/80 text-emerald-300 border border-emerald-500/30">
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
            <Maximize2 className="h-3.5 w-3.5" />
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
            {overlayVisible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
          </button>
          <button
            type="button"
            id="btn-celestial-vectors-header"
            onClick={handleToggleVectors}
            className={`${iconButton} ${vectorsVisible ? 'text-cyan-300 bg-cyan-950/70 border border-cyan-500/40' : ''}`}
            title={vectorsVisible ? 'Turn off Earth & Sun vector lines (currently ON)' : 'Turn on Earth & Sun vector lines (currently OFF)'}
            aria-label={vectorsVisible ? 'Turn off vector lines' : 'Turn on vector lines'}
            aria-pressed={vectorsVisible}
          >
            <Navigation className={`h-3.5 w-3.5 ${vectorsVisible ? 'rotate-45 text-cyan-300' : 'text-slate-400'}`} />
          </button>
          <button
            type="button"
            id="btn-celestial-collapse"
            onClick={() => setExpanded((v) => !v)}
            className={iconButton}
            aria-label={expanded ? 'Collapse Earth and Sun panel' : 'Expand Earth and Sun panel'}
            aria-expanded={expanded}
          >
            {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
          </button>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className={iconButton}
              title="Close Ephemeris panel"
              aria-label="Close panel"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {expanded && (
        <div className="overflow-y-auto custom-scrollbar p-3 space-y-3">
          {/* Earth & Sun Direction Vectors Toggle Card */}
          <div className="flex items-center justify-between p-2.5 rounded-xl border border-slate-800/80 bg-slate-950/70">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className={`p-1.5 rounded-lg border transition-colors shrink-0 ${
                vectorsVisible ? 'bg-cyan-950/80 border-cyan-500/40 text-cyan-300' : 'bg-slate-900 border-slate-800 text-slate-500'
              }`}>
                <Navigation className={`h-3.5 w-3.5 transition-transform ${vectorsVisible ? 'rotate-45' : ''}`} />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-semibold text-slate-200 truncate">
                  Earth & Sun Vector Arrows
                </div>
                <div className="text-[10px] text-slate-400 truncate">
                  {vectorsVisible ? 'Vector arrows & sub-points ON' : 'Turned OFF by default'}
                </div>
              </div>
            </div>
            <button
              type="button"
              id="btn-celestial-vectors-toggle"
              onClick={handleToggleVectors}
              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/70 ${
                vectorsVisible ? 'bg-cyan-500' : 'bg-slate-800'
              }`}
              role="switch"
              aria-checked={vectorsVisible}
              aria-label="Toggle Earth and Sun vector arrows"
            >
              <span
                aria-hidden="true"
                className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                  vectorsVisible ? 'translate-x-4' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

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
