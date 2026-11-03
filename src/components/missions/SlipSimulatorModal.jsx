import React, { useState, useMemo, useEffect } from 'react';
import {
  X,
  Rocket,
  Calendar,
  Sparkles,
  Sun,
  Radio,
  Sliders,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Clock,
  Compass,
} from 'lucide-react';
import { LANDING_SITES } from '../../data/landingSites.js';
import { SOUTH_POLE_LANDMARKS } from '../map/SouthPoleTopoMap.jsx';
import { computeCelestialState } from '../../utils/lunarEphemeris.js';
import { celestialTimeStore } from '../../utils/celestialTime.js';
import { evaluateEarthLink, DEFAULT_DTE_CONSTRAINTS } from '../../utils/earthLink.js';
import { horizonAt, HORIZON_TABLE } from '../../utils/horizons.js';
import { notifySuccess, notifyInfo } from '../../utils/feedbackStore.js';

const SITES_TO_ANALYZE = [
  { id: 'landing-artemis3-shackleton', name: 'Shackleton Rim (A3)', lat: -89.65, lon: 129.0 },
  { id: 'landing-artemis3-malapert', name: 'Malapert Massif', lat: -86.02, lon: 2.7 },
  { id: 'haworth-crater', name: 'Haworth Rim', lat: -87.45, lon: -4.0 },
  { id: 'de-gerlache-crater', name: 'De Gerlache Rim', lat: -88.50, lon: -87.1 },
  { id: 'amundsen-crater', name: 'Amundsen Plains', lat: -84.50, lon: 82.8 },
  { id: 'cabeus-crater', name: 'Cabeus Peak', lat: -84.90, lon: -35.5 },
];

export default function SlipSimulatorModal({ isOpen, onClose, onSelectSiteAndDate }) {
  const [baseTimeMs, setBaseTimeMs] = useState(() => celestialTimeStore.get().ms);
  const [slipDays, setSlipDays] = useState(0); // -15 to +45 days
  const [selectedSiteId, setSelectedSiteId] = useState(SITES_TO_ANALYZE[0].id);
  const [windowDurationDays, setWindowDurationDays] = useState(14); // 7, 14, or 30 days heatmap

  // Subscribe to global celestial clock
  useEffect(() => {
    const unsubscribe = celestialTimeStore.subscribe(({ ms }) => {
      setBaseTimeMs(ms);
    });
    return unsubscribe;
  }, []);

  const simulatedTimeMs = useMemo(() => {
    return baseTimeMs + slipDays * 24 * 60 * 60 * 1000;
  }, [baseTimeMs, slipDays]);

  const celestialState = useMemo(() => computeCelestialState(simulatedTimeMs), [simulatedTimeMs]);

  // Evaluate all sites for the current slip time
  const siteEvaluations = useMemo(() => {
    return SITES_TO_ANALYZE.map((site) => {
      const terrainFn = (az) => horizonAt(HORIZON_TABLE, site.id, az) ?? 0;
      const link = evaluateEarthLink({
        state: celestialState,
        moonFeature: { id: site.id, latitude: site.lat, longitude: site.lon },
        earthFeature: null, // Any DSN station
        constraints: DEFAULT_DTE_CONSTRAINTS,
        terrainFn,
      });

      // Approximate solar illumination based on lunar position & latitude
      // South pole sites near 89°S have approximately 50-86% illumination depending on lunar node
      const latFactor = Math.cos((site.lat * Math.PI) / 180);
      const phaseCycle = Math.sin((simulatedTimeMs / (29.53 * 24 * 3600 * 1000)) * 2 * Math.PI + site.lon * 0.01);
      const sunlitScore = Math.max(0, Math.min(100, Math.round(50 + 40 * phaseCycle * (1 - Math.abs(site.lat - 85) / 10))));
      const isSunlit = sunlitScore > 35;

      let score = 50;
      if (link.status === 'clear') score += 30;
      if (isSunlit) score += 20;
      if (site.lat < -88) score += 10; // High priority south pole peaks

      return {
        ...site,
        sunlitScore,
        isSunlit,
        linkStatus: link.status,
        linkMargin: link.marginDeg,
        score: Math.min(100, Math.max(0, score)),
      };
    });
  }, [simulatedTimeMs, celestialState]);

  // Heatmap generation: 14 days window (day 0 to windowDurationDays) vs SITES_TO_ANALYZE
  const heatmapMatrix = useMemo(() => {
    const daysArray = Array.from({ length: windowDurationDays }, (_, i) => i);
    return SITES_TO_ANALYZE.map((site) => {
      const dayScores = daysArray.map((dayOffset) => {
        const testMs = baseTimeMs + (slipDays + dayOffset) * 24 * 60 * 60 * 1000;
        const testState = computeCelestialState(testMs);
        const terrainFn = (az) => horizonAt(HORIZON_TABLE, site.id, az) ?? 0;
        const link = evaluateEarthLink({
          state: testState,
          moonFeature: { id: site.id, latitude: site.lat, longitude: site.lon },
          earthFeature: null,
          constraints: DEFAULT_DTE_CONSTRAINTS,
          terrainFn,
        });
        const cycle = Math.sin((testMs / (29.53 * 24 * 3600 * 1000)) * 2 * Math.PI + site.lon * 0.01);
        const sunlit = Math.max(0, Math.min(100, Math.round(50 + 40 * cycle)));
        let scr = 50;
        if (link.status === 'clear') scr += 30;
        if (sunlit > 35) scr += 20;
        return { dayOffset, score: Math.min(100, Math.max(0, scr)), sunlit, linkClear: link.status === 'clear' };
      });
      return { ...site, dayScores };
    });
  }, [baseTimeMs, slipDays, windowDurationDays]);

  if (!isOpen) return null;

  const handleApplyToGlobalClock = () => {
    celestialTimeStore.setTime(simulatedTimeMs, 'slip-simulator');
    notifySuccess('Celestial Clock Synced', `Global time advanced by ${slipDays >= 0 ? `+${slipDays}` : slipDays} days.`);
  };

  const handleSelectCell = (site, dayOffset) => {
    const targetMs = baseTimeMs + (slipDays + dayOffset) * 24 * 60 * 60 * 1000;
    celestialTimeStore.setTime(targetMs, 'slip-heatmap');
    if (onSelectSiteAndDate) {
      onSelectSiteAndDate({ id: site.id, latitude: site.lat, longitude: site.lon, name: site.name }, targetMs);
    }
    notifySuccess('Launched to Date & Site', `Synchronized to ${site.name} at day +${slipDays + dayOffset}.`);
    onClose();
  };

  const formattedSimDate = new Date(simulatedTimeMs).toUTCString().replace('GMT', 'UTC');

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-md animate-in fade-in duration-150 select-none pointer-events-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative w-full max-w-5xl max-h-[90vh] bg-[#0A111C] border border-[#16283C] rounded-3xl shadow-2xl overflow-hidden flex flex-col text-[#F8FAFC] font-sans">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#16283C] bg-[#060B13]">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-[#00D2C4]/15 border border-[#00D2C4]/30 text-[#00D2C4]">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[10px] font-mono uppercase tracking-wider text-[#00D2C4]">Mission Planning & Analysis</div>
              <h2 className="font-serif text-xl font-medium text-[#F8FAFC]">Launch Slip Simulator & Window Heatmap</h2>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleApplyToGlobalClock}
              className="px-4 py-2 rounded-xl bg-[#00D2C4] hover:bg-[#00e6d6] text-[#060B13] font-mono text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-lg"
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Sync Global Clock</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-full text-[#94A3B8] hover:text-white hover:bg-[#16283C] transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Slip Slider Control Bar */}
          <div className="p-5 rounded-2xl bg-[#060B13] border border-[#16283C] space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <span className="text-xs font-mono uppercase tracking-wider text-[#94A3B8]">Simulated Launch Slip Offset</span>
                <div className="text-lg font-serif text-[#F8FAFC] font-medium mt-0.5">
                  {slipDays === 0 ? 'On-Schedule (Base Mission Date)' : `${slipDays > 0 ? `+${slipDays}` : slipDays} Days from Baseline`}
                </div>
              </div>
              <div className="px-3 py-1.5 rounded-xl bg-[#0A111C] border border-[#16283C] text-xs font-mono text-[#00D2C4]">
                {formattedSimDate}
              </div>
            </div>

            <div className="space-y-2">
              <input
                type="range"
                min="-15"
                max="45"
                step="1"
                value={slipDays}
                onChange={(e) => setSlipDays(parseInt(e.target.value, 10))}
                className="w-full accent-[#00D2C4] cursor-pointer bg-[#16283C] h-2 rounded-lg"
              />
              <div className="flex justify-between text-[10px] font-mono text-[#94A3B8]">
                <span>-15 Days (Early)</span>
                <span>0 (Nominal)</span>
                <span>+15 Days</span>
                <span>+30 Days</span>
                <span>+45 Days (Late)</span>
              </div>
            </div>
          </div>

          {/* Site Viability Comparison Grid at Current Slip */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-mono uppercase tracking-wider text-[#94A3B8]">Landing Site Viability Rankings (Slip Day {slipDays >= 0 ? `+${slipDays}` : slipDays})</h3>
              <span className="text-xs font-mono text-[#34D399]">Evaluated via LOLA DEM & Ephemeris</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {siteEvaluations.map((site) => (
                <div
                  key={site.id}
                  onClick={() => setSelectedSiteId(site.id)}
                  className={`p-4 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between gap-3 ${
                    selectedSiteId === site.id
                      ? 'bg-[#0F1C2E] border-[#00D2C4] shadow-[0_0_20px_rgba(0,210,196,0.15)]'
                      : 'bg-[#060B13] border-[#16283C] hover:border-[#22D3EE]/40'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-xs font-serif font-medium text-[#F8FAFC]">{site.name}</div>
                      <div className="text-[10px] font-mono text-[#94A3B8] mt-0.5">
                        {Math.abs(site.lat).toFixed(2)}°S, {Math.abs(site.lon).toFixed(2)}°{site.lon >= 0 ? 'E' : 'W'}
                      </div>
                    </div>
                    <div
                      className={`px-2 py-1 rounded-lg font-mono text-xs font-bold ${
                        site.score >= 80
                          ? 'bg-[#34D399]/20 text-[#34D399] border border-[#34D399]/30'
                          : site.score >= 60
                          ? 'bg-[#00D2C4]/20 text-[#00D2C4] border border-[#00D2C4]/30'
                          : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                      }`}
                    >
                      {site.score}% Viable
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[#16283C] text-[11px] font-mono">
                    <div className="flex items-center justify-between text-[#94A3B8]">
                      <span className="flex items-center gap-1">
                        <Sun className="w-3 h-3 text-[#00D2C4]" />
                        <span>Sunlit</span>
                      </span>
                      <span className={site.isSunlit ? 'text-[#34D399]' : 'text-amber-400'}>
                        {site.sunlitScore}%
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[#94A3B8]">
                      <span className="flex items-center gap-1">
                        <Radio className="w-3 h-3 text-[#34D399]" />
                        <span>DTE Link</span>
                      </span>
                      <span className={site.linkStatus === 'clear' ? 'text-[#34D399]' : 'text-rose-400'}>
                        {site.linkStatus === 'clear' ? 'Clear' : 'Blocked'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSelectCell(site, 0);
                      }}
                      className="text-[11px] font-mono text-[#00D2C4] hover:underline flex items-center gap-1"
                    >
                      <span>Focus Site & Time</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Launch-Window Heatmap Matrix */}
          <div className="p-5 rounded-2xl bg-[#060B13] border border-[#16283C] space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-mono uppercase tracking-wider text-[#94A3B8]">Launch Window Heatmap (Day vs Site Viability)</h3>
                <p className="text-xs text-[#94A3B8] mt-0.5">Click any cell to instantly jump global clock and focus that landing site.</p>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs font-mono text-[#94A3B8]">Window:</span>
                {[7, 14, 30].map((days) => (
                  <button
                    key={days}
                    type="button"
                    onClick={() => setWindowDurationDays(days)}
                    className={`px-3 py-1 rounded-xl text-xs font-mono transition-colors ${
                      windowDurationDays === days
                        ? 'bg-[#00D2C4] text-[#060B13] font-bold'
                        : 'bg-[#0A111C] text-[#94A3B8] hover:text-white border border-[#16283C]'
                    }`}
                  >
                    {days} Days
                  </button>
                ))}
              </div>
            </div>

            {/* Matrix Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse font-mono text-xs">
                <thead>
                  <tr className="border-b border-[#16283C] text-[#94A3B8]">
                    <th className="py-2.5 px-3 font-normal">Landing Site</th>
                    {Array.from({ length: windowDurationDays }, (_, i) => (
                      <th key={i} className="py-2.5 px-1.5 text-center font-normal">
                        +{slipDays + i}d
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#16283C]/50">
                  {heatmapMatrix.map((siteRow) => (
                    <tr key={siteRow.id} className="hover:bg-[#0F1C2E] transition-colors">
                      <td className="py-2.5 px-3 font-serif font-medium text-[#F8FAFC] whitespace-nowrap">
                        {siteRow.name}
                      </td>
                      {siteRow.dayScores.map((cell) => {
                        const bgClass =
                          cell.score >= 80
                            ? 'bg-[#34D399]/25 text-[#34D399] border-[#34D399]/40'
                            : cell.score >= 60
                            ? 'bg-[#00D2C4]/25 text-[#00D2C4] border-[#00D2C4]/40'
                            : 'bg-rose-500/20 text-rose-400 border-rose-500/30';
                        return (
                          <td key={cell.dayOffset} className="py-2 px-1 text-center">
                            <button
                              type="button"
                              onClick={() => handleSelectCell(siteRow, cell.dayOffset)}
                              title={`${siteRow.name} (Day +${slipDays + cell.dayOffset}): Score ${cell.score}%, Sunlit ${cell.sunlit}%, DTE ${cell.linkClear ? 'Clear' : 'Blocked'}`}
                              className={`w-9 h-8 rounded-lg border flex items-center justify-center font-bold text-[11px] transition-transform hover:scale-110 ${bgClass}`}
                            >
                              {cell.score}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between text-[11px] font-mono text-[#94A3B8] pt-2 border-t border-[#16283C]">
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded bg-[#34D399]/40 border border-[#34D399]"></span>
                  <span>Optimal (&gt;80%)</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded bg-[#00D2C4]/40 border border-[#00D2C4]"></span>
                  <span>Marginal (60-79%)</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded bg-rose-500/30 border border-rose-500"></span>
                  <span>High Risk (&lt;60%)</span>
                </span>
              </div>
              <span>Click any score to instantly jump time & site</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
