import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  X,
  GitCompare,
  Navigation,
  Sun,
  Radio,
  Clock,
  Sparkles,
  Calendar,
  Globe2,
  Thermometer,
} from 'lucide-react';
import { CLPS_MISSIONS } from '../../data/clpsMissions.js';
import { LANDING_SITES } from '../../data/landingSites.js';
import { DEFAULT_DTE_CONSTRAINTS, sweepEarthLink } from '../../utils/earthLink.js';
import {
  calculateSolarTransition,
  calculateEarthTransition,
} from '../../utils/transitionTimes.js';
import { horizonAt, HORIZON_TABLE, ensurePolarDemLoaded } from '../../utils/horizons.js';
import { sweepIllumination } from '../../utils/illumination.js';
import { celestialTimeStore } from '../../utils/celestialTime.js';
import { getLunarTemperature } from '../../utils/lunarThermal.js';
import { useDialogA11y } from '../../hooks/useDialogA11y.js';

const ALL_SITES = LANDING_SITES.map((s) => ({
  id: s.id,
  name: s.name,
  latitude: s.latitude,
  longitude: s.longitude,
  category: s.name.includes('Artemis')
    ? 'Artemis South Pole'
    : s.type === 'clps-mission'
    ? 'NASA CLPS'
    : s.type === 'landing-site'
    ? 'Apollo Sites'
    : 'Robotic Probes',
  clpsData: s.clpsData || CLPS_MISSIONS.find((m) => m.id === s.id),
}));

const EARTH_CITY_BENCHMARKS = [
  {
    city: 'McMurdo Station, Antarctica (77.8°S)',
    daylightCycle: '24h Summer Sun / 4 Months Polar Night',
    tempRange: '-50°C to +8°C (Δ 58°C)',
    contrastNote: 'Like McMurdo, Lunar South Pole peaks have multi-month grazing sunlight, but crater floors 2 km away drop to -235°C (38 K) due to zero atmosphere.',
  },
  {
    city: 'Houston, TX — NASA JSC (29.8°N)',
    daylightCycle: '24.0 Earth Hours (10–14h Sun)',
    tempRange: '-5°C to +40°C (Δ 45°C)',
    contrastNote: 'Equatorial & mid-latitude Moon sites endure 354 hours (14.7 Earth days) of scorching +121°C sun followed by 354 hours of -180°C cryogenic night.',
  },
];

const toInputValue = (ms) => new Date(ms).toISOString().slice(0, 16);
const fromInputValue = (value) => {
  const ms = Date.parse(`${value}:00Z`);
  return Number.isNaN(ms) ? null : ms;
};

export default function MissionComparisonModal({
  isOpen,
  onClose,
  initialMissionA,
  customMoonPin,
  onSelectMission,
}) {
  const dialogRef = useRef(null);
  const { titleId } = useDialogA11y({ isOpen, onClose, containerRef: dialogRef });
  const [compareMode, setCompareMode] = useState('sites');
  const [siteAId, setSiteAId] = useState('landing-artemis3-shackleton');
  const [siteBId, setSiteBId] = useState('landing-artemis3-malapert');

  const [customNameA, setCustomNameA] = useState('Custom Site A');
  const [customLatA, setCustomLatA] = useState('-89.45');
  const [customLonA, setCustomLonA] = useState('22.50');

  const [customNameB, setCustomNameB] = useState('Custom Site B');
  const [customLatB, setCustomLatB] = useState('-85.90');
  const [customLonB, setCustomLonB] = useState('0.00');

  const [dateMs, setDateMs] = useState(() => celestialTimeStore.get().ms);
  const [dateMsB, setDateMsB] = useState(() => celestialTimeStore.get().ms + 14 * 86400000);
  const [demReadyTick, setDemReadyTick] = useState(0);

  useEffect(() => {
    ensurePolarDemLoaded()
      .then((g) => {
        if (g) setDemReadyTick((t) => t + 1);
      })
      .catch(() => {});
    const unsubscribe = celestialTimeStore.subscribe(({ ms }) => {
      setDateMs(ms);
    });
    return unsubscribe;
  }, []);

  const [outlookA, setOutlookA] = useState(null);
  const [outlookB, setOutlookB] = useState(null);

  useEffect(() => {
    if (!initialMissionA) return;
    const isCustom =
      initialMissionA.isCustomPin ||
      initialMissionA.type === 'custom_pin' ||
      String(initialMissionA.id || '').startsWith('custom');
    const inCatalog = ALL_SITES.some((s) => s.id === initialMissionA.id);

    if (isCustom || !inCatalog) {
      const lat = initialMissionA.latitude ?? initialMissionA.lat ?? -89.45;
      const lon = initialMissionA.longitude ?? initialMissionA.lon ?? 22.5;
      setSiteAId('custom');
      setCustomLatA(Number(lat).toFixed(2));
      setCustomLonA(Number(lon).toFixed(2));
      setCustomNameA(initialMissionA.name || 'Custom Site A');
    } else if (initialMissionA.id) {
      setSiteAId(initialMissionA.id);
    }
  }, [initialMissionA]);

  const siteA = useMemo(() => {
    if (siteAId === 'custom') {
      const lat = Math.max(-90, Math.min(90, parseFloat(customLatA) || 0));
      const lon = Math.max(-180, Math.min(180, parseFloat(customLonA) || 0));
      return {
        id: 'custom-a',
        name: customNameA.trim() || 'Custom Site A',
        latitude: lat,
        longitude: lon,
        lat,
        lon,
        isCustomPin: true,
        type: 'custom_pin',
      };
    }
    return ALL_SITES.find((s) => s.id === siteAId) || ALL_SITES[0];
  }, [siteAId, customNameA, customLatA, customLonA]);

  const siteB = useMemo(() => {
    if (compareMode === 'dates') {
      return siteA;
    }
    if (siteBId === 'custom') {
      const lat = Math.max(-90, Math.min(90, parseFloat(customLatB) || 0));
      const lon = Math.max(-180, Math.min(180, parseFloat(customLonB) || 0));
      return {
        id: 'custom-b',
        name: customNameB.trim() || 'Custom Site B',
        latitude: lat,
        longitude: lon,
        lat,
        lon,
        isCustomPin: true,
        type: 'custom_pin',
      };
    }
    return ALL_SITES.find((s) => s.id === siteBId) || ALL_SITES[1];
  }, [compareMode, siteA, siteBId, customNameB, customLatB, customLonB]);

  const effectiveDateB = compareMode === 'dates' ? dateMsB : dateMs;

  const metricsA = useMemo(() => {
    const solar = calculateSolarTransition(dateMs, siteA.latitude, siteA.longitude, siteA.id);
    const earth = calculateEarthTransition(dateMs, siteA, null, DEFAULT_DTE_CONSTRAINTS);
    const thermal = getLunarTemperature(siteA.latitude, siteA.longitude, new Date(dateMs));
    return { solar, earth, thermal };
  }, [siteA, dateMs, demReadyTick]);

  const metricsB = useMemo(() => {
    const solar = calculateSolarTransition(effectiveDateB, siteB.latitude, siteB.longitude, siteB.id);
    const earth = calculateEarthTransition(effectiveDateB, siteB, null, DEFAULT_DTE_CONSTRAINTS);
    const thermal = getLunarTemperature(siteB.latitude, siteB.longitude, new Date(effectiveDateB));
    return { solar, earth, thermal };
  }, [siteB, effectiveDateB, demReadyTick]);

  useEffect(() => {
    const controller = new AbortController();
    setOutlookA(null);
    const terrainFn = (az) =>
      horizonAt(HORIZON_TABLE, siteA.id, az, siteA.latitude, siteA.longitude) ?? 0;

    Promise.all([
      sweepIllumination({
        key: siteA.id,
        lat: siteA.latitude,
        lon: siteA.longitude,
        horizonFn: terrainFn,
        startMs: dateMs,
        days: 30,
        stepMin: 60,
        signal: controller.signal,
      }),
      sweepEarthLink({
        moonFeature: siteA,
        earthFeature: null,
        startMs: dateMs,
        days: 30,
        stepMin: 60,
        constraints: DEFAULT_DTE_CONSTRAINTS,
        terrainFn,
        signal: controller.signal,
      }),
    ])
      .then(([illum, dte]) => {
        if (!illum || !dte) return;
        setOutlookA({
          sunlitPct: illum.sunlitPct,
          longestDarkHours: illum.longestDarkHours,
          dteLinkPct:
            (dte.visibility.filter((s) => s === 'clear').length / dte.visibility.length) * 100,
        });
      })
      .catch(() => {});

    return () => controller.abort();
  }, [siteA, dateMs, demReadyTick]);

  useEffect(() => {
    const controller = new AbortController();
    setOutlookB(null);
    const terrainFn = (az) =>
      horizonAt(HORIZON_TABLE, siteB.id, az, siteB.latitude, siteB.longitude) ?? 0;

    Promise.all([
      sweepIllumination({
        key: siteB.id,
        lat: siteB.latitude,
        lon: siteB.longitude,
        horizonFn: terrainFn,
        startMs: effectiveDateB,
        days: 30,
        stepMin: 60,
        signal: controller.signal,
      }),
      sweepEarthLink({
        moonFeature: siteB,
        earthFeature: null,
        startMs: effectiveDateB,
        days: 30,
        stepMin: 60,
        constraints: DEFAULT_DTE_CONSTRAINTS,
        terrainFn,
        signal: controller.signal,
      }),
    ])
      .then(([illum, dte]) => {
        if (!illum || !dte) return;
        setOutlookB({
          sunlitPct: illum.sunlitPct,
          longestDarkHours: illum.longestDarkHours,
          dteLinkPct:
            (dte.visibility.filter((s) => s === 'clear').length / dte.visibility.length) * 100,
        });
      })
      .catch(() => {});

    return () => controller.abort();
  }, [siteB, effectiveDateB, demReadyTick]);

  if (!isOpen) return null;

  const renderSiteColumn = ({
    label,
    site,
    siteId,
    setSiteId,
    customName,
    setCustomName,
    customLat,
    setCustomLat,
    customLon,
    setCustomLon,
    metrics,
    outlook,
    accentColor,
    columnDateMs,
    onColumnDateChange,
    disableSiteSelect = false,
  }) => (
    <div className="p-4 space-y-3.5 bg-[#050507] rounded-2xl border border-[#1E2028]">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-[10px] font-mono uppercase tracking-wider font-bold" style={{ color: accentColor }}>
          {label}
        </span>
        <div className="flex flex-wrap items-center gap-2">
          {!disableSiteSelect && siteId !== 'custom' && (
            <button
              type="button"
              onClick={() => setSiteId('custom')}
              className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#14161D] hover:bg-[#1E2028] text-[#F8FAFC] border border-[#1E2028] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
            >
              + Custom Coordinates
            </button>
          )}
          <span className="text-[11px] font-mono text-[#94A3B8]">
            {site.latitude.toFixed(2)}°, {site.longitude.toFixed(2)}°
          </span>
        </div>
      </div>

      {onColumnDateChange && (
        <div className="flex items-center justify-between px-3 py-1.5 rounded-xl bg-[#0C0D12] border border-[#1E2028]">
          <span className="text-[10px] font-mono text-[#94A3B8] flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-[#F8FAFC]" />
            <span>Target Epoch (UTC)</span>
          </span>
          <input
            type="datetime-local"
            aria-label={`${label} target epoch (UTC)`}
            value={toInputValue(columnDateMs)}
            onChange={(e) => {
              const ms = fromInputValue(e.target.value);
              if (ms) onColumnDateChange(ms);
            }}
            className="bg-transparent text-xs font-mono text-[#F8FAFC] focus:outline-none focus-visible:ring-1 focus-visible:ring-white/40 rounded"
            style={{ colorScheme: 'dark' }}
          />
        </div>
      )}

      {!disableSiteSelect ? (
        <select
          aria-label={`Select landing site for ${label}`}
          value={siteId}
          onChange={(e) => setSiteId(e.target.value)}
          className="w-full h-9 px-3 bg-[#0C0D12] border border-[#1E2028] rounded-xl text-xs font-medium text-[#F8FAFC] focus:outline-none focus:border-white/40 focus-visible:ring-2 focus-visible:ring-white/40 cursor-pointer"
        >
          <option value="custom">Custom Coordinates...</option>
          {['Artemis South Pole', 'NASA CLPS', 'Apollo Sites', 'Robotic Probes'].map((cat) => (
            <optgroup key={cat} label={cat}>
              {ALL_SITES.filter((s) => s.category === cat).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.latitude.toFixed(1)}°)
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      ) : (
        <div className="w-full h-9 px-3 flex items-center justify-between gap-2 bg-[#0C0D12]/70 border border-[#1E2028] rounded-xl text-xs font-medium text-[#94A3B8]">
          <span className="truncate">
            Same Site: <strong className="text-[#F8FAFC]">{site.name}</strong>
          </span>
          <span className="font-mono text-[10px] text-[#34D399] shrink-0">Locked to Site A</span>
        </div>
      )}

      {!disableSiteSelect && siteId === 'custom' && (
        <div className="p-2.5 rounded-xl bg-[#0C0D12] border border-white/25 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <input
              type="text"
              aria-label={`${label} custom site label`}
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              placeholder="Site Label"
              className="flex-1 h-7 px-2 bg-[#050507] border border-[#1E2028] rounded-lg text-xs text-[#F8FAFC] focus:outline-none focus:border-white/40"
            />
            {customMoonPin && (
              <button
                type="button"
                onClick={() => {
                  setCustomLat(Number(customMoonPin.latitude ?? 0).toFixed(2));
                  setCustomLon(Number(customMoonPin.longitude ?? 0).toFixed(2));
                  setCustomName(customMoonPin.name || 'Map Pin');
                }}
                className="px-2 h-7 rounded-lg bg-[#14161D] hover:bg-[#1E2028] text-[#F8FAFC] text-[10px] font-mono transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
              >
                Use Map Pin
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label htmlFor={`cmp-lat-${label.replace(/\W+/g, '-')}`} className="text-[9.5px] text-[#94A3B8] block mb-0.5">
                Latitude (°)
              </label>
              <input
                id={`cmp-lat-${label.replace(/\W+/g, '-')}`}
                type="number"
                step="0.01"
                min="-90"
                max="90"
                value={customLat}
                onChange={(e) => setCustomLat(e.target.value)}
                className="w-full h-7 px-2 bg-[#050507] border border-[#1E2028] rounded-lg text-xs font-mono text-[#F8FAFC] focus:outline-none focus:border-white/40"
              />
            </div>
            <div>
              <label htmlFor={`cmp-lon-${label.replace(/\W+/g, '-')}`} className="text-[9.5px] text-[#94A3B8] block mb-0.5">
                Longitude (°)
              </label>
              <input
                id={`cmp-lon-${label.replace(/\W+/g, '-')}`}
                type="number"
                step="0.01"
                min="-180"
                max="180"
                value={customLon}
                onChange={(e) => setCustomLon(e.target.value)}
                className="w-full h-7 px-2 bg-[#050507] border border-[#1E2028] rounded-lg text-xs font-mono text-[#F8FAFC] focus:outline-none focus:border-white/40"
              />
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-3 gap-2">
        <div className="p-2.5 rounded-xl bg-[#0C0D12] border border-[#1E2028] space-y-1">
          <div className="flex items-center justify-between text-[10px] text-[#94A3B8]">
            <span className="flex items-center gap-1">
              <Sun className="w-3 h-3 text-[#F8FAFC]" />
              <span>Sun</span>
            </span>
            <span
              className={`font-mono font-semibold ${
                metrics.solar.isCurrentlySunlit ? 'text-[#34D399]' : 'text-rose-400'
              }`}
            >
              {metrics.solar.isCurrentlySunlit ? 'Lit' : 'Dark'}
            </span>
          </div>
          <div className="font-mono text-sm font-bold text-[#F8FAFC]">
            {metrics.solar.solarElevationDeg.toFixed(1)}° el
          </div>
          <div className="text-[9.5px] text-[#94A3B8] truncate">
            {metrics.solar.nextEvent === 'sunset' ? 'Set' : 'Rise'} in{' '}
            {metrics.solar.formattedDuration}
          </div>
        </div>

        <div className="p-2.5 rounded-xl bg-[#0C0D12] border border-[#1E2028] space-y-1">
          <div className="flex items-center justify-between text-[10px] text-[#94A3B8]">
            <span className="flex items-center gap-1">
              <Radio className="w-3 h-3 text-[#34D399]" />
              <span>DTE</span>
            </span>
            <span
              className={`font-mono font-semibold ${
                metrics.earth.isLinked ? 'text-[#34D399]' : 'text-rose-400'
              }`}
            >
              {metrics.earth.isLinked ? 'Clear' : 'Mask'}
            </span>
          </div>
          <div className="font-mono text-sm font-bold text-[#F8FAFC]">
            {metrics.earth.earthElevationDeg.toFixed(1)}° el
          </div>
          <div className="text-[9.5px] text-[#94A3B8] truncate">
            Margin {metrics.earth.linkMarginDeg >= 0 ? '+' : ''}
            {metrics.earth.linkMarginDeg.toFixed(1)}°
          </div>
        </div>

        <div className="p-2.5 rounded-xl bg-[#0C0D12] border border-[#1E2028] space-y-1">
          <div className="flex items-center justify-between text-[10px] text-[#94A3B8]">
            <span className="flex items-center gap-1">
              <Thermometer className="w-3 h-3 text-amber-400" />
              <span>Temp</span>
            </span>
            <span className="font-mono text-[9.5px] text-amber-300">
              {metrics.thermal.tempK} K
            </span>
          </div>
          <div className="font-mono text-sm font-bold text-[#F8FAFC]">
            {metrics.thermal.tempC > 0 ? `+${metrics.thermal.tempC}` : metrics.thermal.tempC}°C
          </div>
          <div className="text-[9.5px] text-[#94A3B8] truncate">
            {metrics.thermal.isPSR ? 'Cold Trap' : metrics.thermal.isDaylight ? 'Daylight' : 'Night'}
          </div>
        </div>
      </div>

      <div className="pt-2 border-t border-[#1E2028] flex items-center justify-between gap-2">
        <div className="text-[10px] font-mono text-[#94A3B8]">
          {outlook ? (
            <span>
              30d Sun <strong className="text-[#F8FAFC]">{outlook.sunlitPct.toFixed(0)}%</strong> ·
              Dark <strong className="text-amber-300">{outlook.longestDarkHours.toFixed(0)}h</strong> ·
              DTE <strong className="text-[#34D399]">{outlook.dteLinkPct.toFixed(0)}%</strong>
            </span>
          ) : (
            <span>Computing 30d outlook…</span>
          )}
        </div>

        <button
          type="button"
          onClick={() => {
            if (columnDateMs) {
              celestialTimeStore.setTime(columnDateMs, 'comparison-modal');
            }
            onSelectMission(site);
            onClose();
          }}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#14161D] hover:bg-[#E2E8F0] text-[#F8FAFC] hover:text-[#050507] text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
        >
          <Navigation className="w-3 h-3" />
          <span>Fly To</span>
        </button>
      </div>
    </div>
  );

  return (
    <div
      id="mission-comparison-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-150 pointer-events-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="relative w-full max-w-4xl max-h-[92dvh] flex flex-col bg-[#0C0D12] border border-[#1E2028] rounded-3xl shadow-2xl overflow-hidden text-[#F8FAFC] font-sans focus:outline-none"
      >
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 border-b border-[#1E2028] bg-[#050507] shrink-0">
          <div className="flex items-center gap-2.5">
            <GitCompare className="w-4 h-4 text-[#F8FAFC]" />
            <h2 id={titleId} className="font-serif text-xl text-[#F8FAFC]">Compare Sites &amp; Launch Epochs</h2>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center p-0.5 rounded-full bg-[#14161D] border border-[#1E2028] text-[11px] font-mono">
              <button
                type="button"
                aria-pressed={compareMode === 'sites'}
                onClick={() => setCompareMode('sites')}
                className={`px-3 py-1 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 ${
                  compareMode === 'sites'
                    ? 'bg-white text-[#050507] font-bold'
                    : 'text-[#94A3B8] hover:text-white'
                }`}
              >
                Site A vs Site B
              </button>
              <button
                type="button"
                aria-pressed={compareMode === 'dates'}
                onClick={() => setCompareMode('dates')}
                className={`px-3 py-1 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 ${
                  compareMode === 'dates'
                    ? 'bg-white text-[#050507] font-bold'
                    : 'text-[#94A3B8] hover:text-white'
                }`}
              >
                Same Site: Date A vs Date B
              </button>
            </div>

            {compareMode === 'sites' && (
              <>
                <button
                  type="button"
                  aria-pressed={siteAId === 'custom' && siteBId === 'custom'}
                  onClick={() => {
                    setSiteAId('custom');
                    setSiteBId('custom');
                  }}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 ${
                    siteAId === 'custom' && siteBId === 'custom'
                      ? 'bg-white text-[#050507] font-semibold shadow-sm'
                      : 'bg-[#14161D] hover:bg-[#1E2028] text-[#F8FAFC] border border-[#1E2028]'
                  }`}
                >
                  <Sparkles className="w-3 h-3" />
                  <span>2 Custom Sites</span>
                </button>

                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#050507] border border-[#1E2028]">
                  <Clock className="w-3 h-3 text-[#34D399]" />
                  <input
                    type="datetime-local"
                    aria-label="Global comparison epoch (UTC)"
                    value={toInputValue(dateMs)}
                    onChange={(e) => {
                      const ms = fromInputValue(e.target.value);
                      if (ms) setDateMs(ms);
                    }}
                    className="bg-transparent text-[11px] font-mono text-[#F8FAFC] focus:outline-none"
                    style={{ colorScheme: 'dark' }}
                  />
                </div>
              </>
            )}

            <button
              type="button"
              onClick={onClose}
              aria-label="Close site comparison dialog"
              className="p-1.5 text-[#94A3B8] hover:text-white rounded-full hover:bg-[#1E2028] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="p-4 sm:p-5 space-y-4 flex-1 overflow-y-auto custom-scrollbar">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {renderSiteColumn({
              label: compareMode === 'dates' ? 'Epoch A (Baseline)' : 'Site A',
              site: siteA,
              siteId: siteAId,
              setSiteId: setSiteAId,
              customName: customNameA,
              setCustomName: setCustomNameA,
              customLat: customLatA,
              setCustomLat: setCustomLatA,
              customLon: customLonA,
              setCustomLon: setCustomLonA,
              metrics: metricsA,
              outlook: outlookA,
              accentColor: '#00D2C4',
              columnDateMs: compareMode === 'dates' ? dateMs : null,
              onColumnDateChange: compareMode === 'dates' ? setDateMs : null,
            })}

            {renderSiteColumn({
              label: compareMode === 'dates' ? 'Epoch B (Alternate Window)' : 'Site B',
              site: siteB,
              siteId: siteBId,
              setSiteId: setSiteBId,
              customName: customNameB,
              setCustomName: setCustomNameB,
              customLat: customLatB,
              setCustomLat: setCustomLatB,
              customLon: customLonB,
              setCustomLon: setCustomLonB,
              metrics: metricsB,
              outlook: outlookB,
              accentColor: '#34D399',
              columnDateMs: compareMode === 'dates' ? dateMsB : null,
              onColumnDateChange: compareMode === 'dates' ? setDateMsB : null,
              disableSiteSelect: compareMode === 'dates',
            })}
          </div>

          <div className="p-4 rounded-2xl bg-[#050507] border border-[#1E2028] space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[10.5px] font-mono uppercase tracking-wider text-[#F8FAFC] flex items-center gap-1.5 font-bold">
                <Globe2 className="w-3.5 h-3.5" />
                <span>Earth vs. Moon Environmental Contrast</span>
              </span>
              <span className="text-[10px] font-mono text-[#94A3B8]">
                Lunar Synodic Day = 708.7 Hours (29.53 Earth Days)
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              {EARTH_CITY_BENCHMARKS.map((b) => (
                <div key={b.city} className="p-3 rounded-xl bg-[#0C0D12] border border-[#1E2028] space-y-1">
                  <div className="font-semibold text-[#F8FAFC] flex items-center justify-between">
                    <span>{b.city}</span>
                    <span className="text-[10px] font-mono text-[#34D399]">{b.tempRange}</span>
                  </div>
                  <div className="text-[10px] font-mono text-[#F8FAFC]">{b.daylightCycle}</div>
                  <p className="text-[11px] text-[#94A3B8] leading-relaxed">{b.contrastNote}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
