import React, { useState, useMemo, useEffect } from 'react';
import {
  X,
  GitCompare,
  Navigation,
  Sun,
  Radio,
  Clock,
  Sparkles,
} from 'lucide-react';
import { CLPS_MISSIONS } from '../../data/clpsMissions.js';
import { LANDING_SITES } from '../../data/landingSites.js';
import { DEFAULT_DTE_CONSTRAINTS, sweepEarthLink } from '../../utils/earthLink.js';
import {
  calculateSolarTransition,
  calculateEarthTransition,
} from '../../utils/transitionTimes.js';
import { horizonAt, HORIZON_TABLE } from '../../utils/horizons.js';
import { sweepIllumination } from '../../utils/illumination.js';
import { celestialTimeStore } from '../../utils/celestialTime.js';

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
  const [siteAId, setSiteAId] = useState('landing-artemis3-shackleton');
  const [siteBId, setSiteBId] = useState('landing-artemis3-malapert');

  // Custom coordinates for Site A and Site B
  const [customNameA, setCustomNameA] = useState('Custom Site A');
  const [customLatA, setCustomLatA] = useState('-89.45');
  const [customLonA, setCustomLonA] = useState('22.50');

  const [customNameB, setCustomNameB] = useState('Custom Site B');
  const [customLatB, setCustomLatB] = useState('-85.90');
  const [customLonB, setCustomLonB] = useState('0.00');

  const [dateMs, setDateMs] = useState(() => celestialTimeStore.get().ms);
  useEffect(() => {
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
  }, [siteBId, customNameB, customLatB, customLonB]);

  const metricsA = useMemo(() => {
    const solar = calculateSolarTransition(dateMs, siteA.latitude, siteA.longitude, siteA.id);
    const earth = calculateEarthTransition(dateMs, siteA, null, DEFAULT_DTE_CONSTRAINTS);
    return { solar, earth };
  }, [siteA, dateMs]);

  const metricsB = useMemo(() => {
    const solar = calculateSolarTransition(dateMs, siteB.latitude, siteB.longitude, siteB.id);
    const earth = calculateEarthTransition(dateMs, siteB, null, DEFAULT_DTE_CONSTRAINTS);
    return { solar, earth };
  }, [siteB, dateMs]);

  useEffect(() => {
    const controller = new AbortController();
    const terrainFn = (az) => horizonAt(HORIZON_TABLE, siteA.id, az);

    Promise.all([
      sweepIllumination({
        key: siteA.id,
        lat: siteA.latitude,
        lon: siteA.longitude,
        horizonFn: (az) => terrainFn(az) ?? 0,
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
          dteLinkPct:
            (dte.visibility.filter((s) => s === 'clear').length / dte.visibility.length) * 100,
        });
      })
      .catch(() => {});

    return () => controller.abort();
  }, [siteA, dateMs]);

  useEffect(() => {
    const controller = new AbortController();
    const terrainFn = (az) => horizonAt(HORIZON_TABLE, siteB.id, az);

    Promise.all([
      sweepIllumination({
        key: siteB.id,
        lat: siteB.latitude,
        lon: siteB.longitude,
        horizonFn: (az) => terrainFn(az) ?? 0,
        startMs: dateMs,
        days: 30,
        stepMin: 60,
        signal: controller.signal,
      }),
      sweepEarthLink({
        moonFeature: siteB,
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
        setOutlookB({
          sunlitPct: illum.sunlitPct,
          dteLinkPct:
            (dte.visibility.filter((s) => s === 'clear').length / dte.visibility.length) * 100,
        });
      })
      .catch(() => {});

    return () => controller.abort();
  }, [siteB, dateMs]);

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
  }) => (
    <div className="p-4 space-y-3.5 bg-[#060B13] rounded-2xl border border-[#16283C]">
      {/* Site Selector Header */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-mono uppercase tracking-wider" style={{ color: accentColor }}>
          {label}
        </span>
        <div className="flex items-center gap-2">
          {siteId !== 'custom' && (
            <button
              type="button"
              onClick={() => setSiteId('custom')}
              className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#0D1726] hover:bg-[#15273F] text-[#00D2C4] border border-[#16283C]"
            >
              + Custom Coordinates
            </button>
          )}
          <span className="text-[11px] font-mono text-[#94A3B8]">
            {site.latitude.toFixed(2)}°, {site.longitude.toFixed(2)}°
          </span>
        </div>
      </div>

      {/* Dropdown Selector */}
      <select
        value={siteId}
        onChange={(e) => setSiteId(e.target.value)}
        className="w-full h-9 px-3 bg-[#0A111C] border border-[#16283C] rounded-xl text-xs font-medium text-[#F8FAFC] focus:outline-none focus:border-[#00D2C4] cursor-pointer"
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

      {/* Custom Coordinate Inputs */}
      {siteId === 'custom' && (
        <div className="p-2.5 rounded-xl bg-[#0A111C] border border-[#00D2C4]/40 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <input
              type="text"
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              placeholder="Site Label"
              className="flex-1 h-7 px-2 bg-[#060B13] border border-[#16283C] rounded-lg text-xs text-[#F8FAFC]"
            />
            {customMoonPin && (
              <button
                type="button"
                onClick={() => {
                  setCustomLat(Number(customMoonPin.latitude ?? 0).toFixed(2));
                  setCustomLon(Number(customMoonPin.longitude ?? 0).toFixed(2));
                  setCustomName(customMoonPin.name || 'Map Pin');
                }}
                className="px-2 h-7 rounded-lg bg-[#101F33] text-[#00D2C4] text-[10px] font-mono"
              >
                Use Map Pin
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[9.5px] text-[#94A3B8] block mb-0.5">Latitude (°)</label>
              <input
                type="number"
                step="0.01"
                min="-90"
                max="90"
                value={customLat}
                onChange={(e) => setCustomLat(e.target.value)}
                className="w-full h-7 px-2 bg-[#060B13] border border-[#16283C] rounded-lg text-xs font-mono text-[#F8FAFC]"
              />
            </div>
            <div>
              <label className="text-[9.5px] text-[#94A3B8] block mb-0.5">Longitude (°)</label>
              <input
                type="number"
                step="0.01"
                min="-180"
                max="180"
                value={customLon}
                onChange={(e) => setCustomLon(e.target.value)}
                className="w-full h-7 px-2 bg-[#060B13] border border-[#16283C] rounded-lg text-xs font-mono text-[#F8FAFC]"
              />
            </div>
          </div>
        </div>
      )}

      {/* Compact Metrics Grid */}
      <div className="grid grid-cols-2 gap-2.5">
        {/* Solar Card */}
        <div className="p-3 rounded-xl bg-[#0A111C] border border-[#16283C] space-y-1">
          <div className="flex items-center justify-between text-[10px] text-[#94A3B8]">
            <span className="flex items-center gap-1">
              <Sun className="w-3 h-3 text-[#00D2C4]" />
              <span>Sunlight</span>
            </span>
            <span
              className={`font-mono font-semibold ${
                metrics.solar.isCurrentlySunlit ? 'text-[#34D399]' : 'text-rose-400'
              }`}
            >
              {metrics.solar.isCurrentlySunlit ? 'Sunlit' : 'Shadow'}
            </span>
          </div>
          <div className="font-mono text-sm font-bold text-[#F8FAFC]">
            {metrics.solar.solarElevationDeg.toFixed(1)}° el
          </div>
          <div className="text-[10px] text-[#94A3B8] truncate">
            {metrics.solar.nextEvent === 'sunset' ? 'Sunset' : 'Sunrise'} in{' '}
            {metrics.solar.formattedDuration}
          </div>
        </div>

        {/* Earth Link Card */}
        <div className="p-3 rounded-xl bg-[#0A111C] border border-[#16283C] space-y-1">
          <div className="flex items-center justify-between text-[10px] text-[#94A3B8]">
            <span className="flex items-center gap-1">
              <Radio className="w-3 h-3 text-[#34D399]" />
              <span>Earth Link</span>
            </span>
            <span
              className={`font-mono font-semibold ${
                metrics.earth.isLinked ? 'text-[#34D399]' : 'text-rose-400'
              }`}
            >
              {metrics.earth.isLinked ? 'Active' : 'Blocked'}
            </span>
          </div>
          <div className="font-mono text-sm font-bold text-[#F8FAFC]">
            {metrics.earth.earthElevationDeg.toFixed(1)}° el
          </div>
          <div className="text-[10px] text-[#94A3B8] truncate">
            Margin {metrics.earth.linkMarginDeg >= 0 ? '+' : ''}
            {metrics.earth.linkMarginDeg.toFixed(1)}°
          </div>
        </div>
      </div>

      {/* 30-Day Outlook & Fly To */}
      <div className="pt-2 border-t border-[#16283C] flex items-center justify-between gap-2">
        <div className="text-[10px] font-mono text-[#94A3B8]">
          {outlook ? (
            <span>
              30d Sun <strong className="text-[#00D2C4]">{outlook.sunlitPct.toFixed(0)}%</strong> ·
              DTE <strong className="text-[#34D399]">{outlook.dteLinkPct.toFixed(0)}%</strong>
            </span>
          ) : (
            <span>Computing 30d outlook…</span>
          )}
        </div>

        <button
          type="button"
          onClick={() => {
            onSelectMission(site);
            onClose();
          }}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#101F33] hover:bg-[#00D2C4] text-[#F8FAFC] hover:text-[#060B13] text-xs font-semibold transition-colors"
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
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-150 select-none pointer-events-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative w-full max-w-3xl bg-[#0A111C] border border-[#16283C] rounded-3xl shadow-2xl overflow-hidden text-[#F8FAFC] font-sans">
        {/* Compact Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 border-b border-[#16283C] bg-[#060B13]">
          <div className="flex items-center gap-2.5">
            <GitCompare className="w-4 h-4 text-[#00D2C4]" />
            <h2 className="font-serif text-xl text-[#F8FAFC]">Compare Landing Sites</h2>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setSiteAId('custom');
                setSiteBId('custom');
              }}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                siteAId === 'custom' && siteBId === 'custom'
                  ? 'bg-[#00D2C4] text-[#060B13] font-semibold shadow-[0_0_8px_rgba(0,210,196,0.3)]'
                  : 'bg-[#0D1726] text-[#00D2C4] border border-[#16283C]'
              }`}
            >
              <Sparkles className="w-3 h-3" />
              <span>2 Custom Sites</span>
            </button>

            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#060B13] border border-[#16283C]">
              <Clock className="w-3 h-3 text-[#34D399]" />
              <input
                type="datetime-local"
                value={toInputValue(dateMs)}
                onChange={(e) => {
                  const ms = fromInputValue(e.target.value);
                  if (ms) setDateMs(ms);
                }}
                className="bg-transparent text-[11px] font-mono text-[#F8FAFC] focus:outline-none"
                style={{ colorScheme: 'dark' }}
              />
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-[#94A3B8] hover:text-white rounded-full hover:bg-[#16283C]"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Side-by-Side Site Columns */}
        <div className="p-4 sm:p-5 grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-[80vh] overflow-y-auto custom-scrollbar">
          {renderSiteColumn({
            label: 'Site A',
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
          })}

          {renderSiteColumn({
            label: 'Site B',
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
          })}
        </div>
      </div>
    </div>
  );
}
