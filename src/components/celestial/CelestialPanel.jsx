import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Sun,
  Moon,
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
import { computeEarthCelestialState } from '../../utils/earthEphemeris.js';
import { computeCelestialState } from '../../utils/lunarEphemeris.js';
import {
  CELESTIAL_MINUTE_MS,
  celestialTimeStore,
  MIN_CELESTIAL_TIME_MS,
  MAX_CELESTIAL_TIME_MS,
  normalizeCelestialTimeMs,
} from '../../utils/celestialTime.js';

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

/** Owns the globe time engine and drives updates imperatively so animating time never re-renders the rest of the app. */
export default function CelestialPanel({
  globeRef,
  isActive,
  isOpen = true,
  onClose,
  vectorsVisible: propVectorsVisible,
  onToggleVectors: propToggleVectors,
  activePlanet = 'moon',
}) {
  const [expanded, setExpanded] = useState(
    true
  );
  const [overlayVisible, setOverlayVisible] = useState(true);
  const [internalVectorsVisible, setInternalVectorsVisible] = useState(false);
  const vectorsVisible = propVectorsVisible !== undefined ? propVectorsVisible : internalVectorsVisible;
  const [live, setLive] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [rate, setRate] = useState(3600);
  const [shownTime, setShownTime] = useState(() => celestialTimeStore.get().ms);
  const [state, setState] = useState(null);
  const [statePlanet, setStatePlanet] = useState(activePlanet);

  const timeRef = useRef(celestialTimeStore.get().ms);
  const getStateAt = useCallback(
    (ms) => activePlanet === 'earth'
      ? computeEarthCelestialState(ms)
      : computeCelestialState(ms),
    [activePlanet]
  );

  const applyTime = useCallback(
    (ms, { force = false, source = 'ephemeris' } = {}) => {
      const clamped = normalizeCelestialTimeMs(
        Math.min(MAX_MS, Math.max(MIN_MS, ms))
      );
      const changed = clamped !== timeRef.current;
      timeRef.current = clamped;
      if (changed) {
        celestialTimeStore.setTime(clamped, source);
      }
      if (changed || force) {
        setShownTime(clamped);
      }
      return clamped;
    },
    []
  );

  useEffect(() => {
    const syncState = (ms) => {
      const next = getStateAt(ms);
      setState(next);
      setStatePlanet(activePlanet);
    };
    syncState(celestialTimeStore.get().ms);
    return celestialTimeStore.subscribe(({ ms, source }) => {
      timeRef.current = ms;
      setShownTime(ms);
      if (source === 'timeline-drag' || source === 'timeline' || source === 'timeline-final') {
        setLive(false);
        setPlaying(false);
      }
      syncState(ms);
    });
  }, [getStateAt]);

  useEffect(() => {
    if (!isActive) return;
    globeRef.current?.setCelestialVisible?.(overlayVisible);
    globeRef.current?.setCelestialVectorsVisible?.(vectorsVisible);
    if (!live) applyTime(timeRef.current, { force: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive]);

  useEffect(() => {
    if (!live) return undefined;
    let timeoutId;
    const updateAtNextMinute = () => {
      applyTime(Date.now(), { force: true, source: 'live' });
      const delay = CELESTIAL_MINUTE_MS - (Date.now() % CELESTIAL_MINUTE_MS);
      timeoutId = setTimeout(updateAtNextMinute, delay);
    };
    applyTime(Date.now(), { force: true, source: 'live' });
    const delay = CELESTIAL_MINUTE_MS - (Date.now() % CELESTIAL_MINUTE_MS);
    timeoutId = setTimeout(updateAtNextMinute, delay);
    return () => clearTimeout(timeoutId);
  }, [live, applyTime]);

  useEffect(() => {
    if (!playing) return undefined;
    let raf = 0;
    let last = null;
    let remainderMs = 0;
    const tick = (now) => {
      if (last === null) {
        last = now;
        raf = requestAnimationFrame(tick);
        return;
      }
      const dt = Math.max(0, Math.min(0.1, (now - last) / 1000));
      last = now;
      remainderMs += dt * rate * 1000;
      const minuteSteps = Math.floor(remainderMs / CELESTIAL_MINUTE_MS);
      if (minuteSteps > 0) {
        remainderMs %= CELESTIAL_MINUTE_MS;
        const target = timeRef.current + minuteSteps * CELESTIAL_MINUTE_MS;
        const applied = applyTime(target, { source: 'playback' });
        if (applied !== target) {
          setPlaying(false);
          applyTime(applied, { force: true, source: 'playback' });
          return;
        }
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
      applyTime(timeRef.current, { force: true, source: 'ephemeris' });
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
    if (activePlanet === 'earth') {
      globeRef.current?.resetOverview?.();
    } else {
      globeRef.current?.flyToCelestialOverview?.();
    }
  };

  if (!isActive || !isOpen) return null;

  const { earth, sun, moon } = statePlanet === activePlanet ? state || {} : {};
  const iconButton =
    'p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-all duration-150 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/70';
  const chipButton =
    'px-2 py-1 rounded-lg text-[11px] font-medium text-slate-300 bg-slate-900 hover:bg-slate-800 hover:text-white border border-slate-800 transition-all duration-150 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/70';

  return (
    <div
      id="celestial-panel"
      className={`fixed left-1/2 z-[60] flex max-h-[calc(100dvh-6rem)] w-[min(23rem,calc(100vw-1.5rem))] -translate-x-1/2 flex-col overflow-hidden rounded-2xl border border-slate-800/90 bg-[#050507]/96 shadow-[0_20px_50px_rgba(0,0,0,0.85)] backdrop-blur-2xl pointer-events-auto transition-all ease-out select-none lg:left-[4.5rem] lg:translate-x-0 ${
        expanded
          ? 'top-[calc(50%+1.75rem)] -translate-y-1/2'
          : 'top-auto bottom-4 translate-y-0'
      }`}
    >
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-800 bg-slate-900/60 px-3.5 py-2.5">
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
            onClick={() => setExpanded((value) => !value)}
            className={iconButton}
            aria-label={expanded ? 'Collapse ephemeris panel' : 'Expand ephemeris panel'}
            aria-expanded={expanded}
          >
            {expanded ? (
              <ChevronUp className="h-3.5 w-3.5" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5" />
            )}
          </button>
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
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3 custom-scrollbar">
          {activePlanet === 'moon' && <div className="flex items-center justify-between p-2.5 rounded-xl border border-slate-800/80 bg-slate-950/70">
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
          </div>}

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

          {earth && sun && moon ? (
            <div className="space-y-2">
              {activePlanet === 'earth' ? (
                <>
                  <Readout icon={Globe2} title="Earth" accent="text-sky-300">
                    <Row label="Apparent sidereal time" value={`${earth.siderealTimeHours.toFixed(3)} h`} />
                    <Row label="Subsolar point" value={fmtPoint(earth.subsolar.lon, earth.subsolar.lat)} />
                    <Row label="Sublunar point" value={fmtPoint(earth.sublunar.lon, earth.sublunar.lat)} />
                  </Readout>
                  <Readout icon={Sun} title="Sun" accent="text-amber-300">
                    <Row label="Distance" value={`${(sun.distanceKm / 1e6).toFixed(2)} M km · ${sun.distanceAU.toFixed(4)} AU`} />
                    <Row label="Apparent diameter" value={`${sun.angularDiameterDeg.toFixed(3)}°`} />
                    <Row label="Subsolar point" value={fmtPoint(sun.subLon, sun.subLat)} />
                  </Readout>
                  <Readout icon={Moon} title="Moon" accent="text-slate-200">
                    <Row label="Distance" value={`${fmtInt(moon.distanceKm)} km`} />
                    <Row label="Apparent diameter" value={`${moon.angularDiameterDeg.toFixed(2)}°`} />
                    <Row label="Sublunar point" value={fmtPoint(moon.subLon, moon.subLat)} />
                    <Row label="Illuminated" value={fmtPercent(moon.illuminatedFraction)} />
                  </Readout>
                </>
              ) : (
                <>
                  <Readout icon={Globe2} title="Earth" accent="text-sky-300">
                    <Row label="Distance" value={`${fmtInt(earth.distanceKm)} km`} />
                    <Row label="Sub-Earth point" value={fmtPoint(earth.subLon, earth.subLat)} />
                    <Row label="Apparent diameter" value={`${earth.angularDiameterDeg.toFixed(2)}°`} />
                    <Row label="Sunlit, seen from Moon" value={fmtPercent(earth.litFraction)} />
                    <Row label="Moon overhead at" value={fmtPoint(earth.sublunar.lon, earth.sublunar.lat)} />
                  </Readout>
                  <Readout icon={Sun} title="Sun" accent="text-amber-300">
                    <Row label="Distance" value={`${(sun.distanceKm / 1e6).toFixed(2)} M km · ${sun.distanceAU.toFixed(4)} AU`} />
                    <Row label="Subsolar point" value={fmtPoint(sun.subLon, sun.subLat)} />
                    <Row label="Apparent diameter" value={`${sun.angularDiameterDeg.toFixed(3)}°`} />
                    <Row label="Moon lit, seen from Earth" value={fmtPercent(moon.illuminatedFraction)} />
                  </Readout>
                </>
              )}
            </div>
          ) : (
            <p className="text-[11px] text-slate-400">Calculating lunar &amp; Earth ephemeris…</p>
          )}
        </div>
      )}
    </div>
  );
}
