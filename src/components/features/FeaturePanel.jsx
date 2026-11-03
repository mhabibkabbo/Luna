import React, { useState } from 'react';
import {
  X,
  Navigation,
  Compass,
  Copy,
  Check,
  Trash2,
  GitCompare,
  ExternalLink,
  Sun,
  Radio,
  Thermometer,
  Globe2,
  Moon,
} from 'lucide-react';
import { formatLunarCoordinates } from '../../utils/coordinates.js';
import { getClpsMission } from '../../data/clpsMissions.js';
import { getLunarTemperature } from '../../utils/lunarThermal.js';
import { notifySuccess } from '../../utils/feedbackStore.js';

/**
 * Compact, sleek floating inspector card for a selected feature or dropped pin.
 * Provides instant access to DTE Calculation, Site Analysis, and Weather for the selected point.
 */
export default function FeaturePanel({
  feature,
  onClose,
  onZoomHere,
  onClearCustomPin,
  onCompareMission,
  onOpenSiteAnalysis,
  onOpenDteCalculation,
  onOpenWeather,
  timelineVisible = false,
  onSelectOtherBody,
}) {
  const [isCopied, setIsCopied] = useState(false);

  if (!feature) return null;

  const clpsData =
    feature.clpsData ||
    getClpsMission(feature.id) ||
    (feature.id === 'landing-odysseus' ? getClpsMission('clps-im1-odysseus') : null);

  const isCustomPin = feature.isCustomPin || feature.type === 'custom_pin';
  const isClps = Boolean(clpsData || feature.isClps || feature.type === 'clps-mission');

  const featLat =
    typeof feature.latitude === 'number'
      ? feature.latitude
      : typeof feature.lat === 'number'
      ? feature.lat
      : 0;

  const featLon =
    typeof feature.longitude === 'number'
      ? feature.longitude
      : typeof feature.lon === 'number'
      ? feature.lon
      : 0;

  const { latStr, lonStr } = formatLunarCoordinates(featLon, featLat, 2);
  const localThermal = feature.body !== 'earth' ? getLunarTemperature(featLat, featLon) : null;

  const handleCopyCoords = (e) => {
    e.stopPropagation();
    const textToCopy = `${latStr}, ${lonStr}`;
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(textToCopy)
        .then(() => {
          setIsCopied(true);
          notifySuccess('Copied', textToCopy);
          setTimeout(() => setIsCopied(false), 2000);
        })
        .catch((err) => {
          console.warn('Clipboard write failed:', err);
        });
    }
  };

  return (
    <aside
      id="lunar-feature-panel"
      className={`fixed ${
        timelineVisible ? 'bottom-[104px]' : 'bottom-10'
      } right-14 sm:right-18 z-30 w-80 sm:w-88 rounded-2xl bg-[#080E18]/95 backdrop-blur-xl border border-[#16283C] shadow-[0_20px_60px_rgba(0,0,0,0.85)] p-4 space-y-3.5 select-none pointer-events-auto transition-all animate-in fade-in slide-in-from-bottom-2 duration-150`}
    >
      {/* Top Category & Close */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-[#00D2C4]">
            <span>
              {isCustomPin
                ? 'Custom Waypoint'
                : isClps
                ? `CLPS · ${clpsData?.taskOrder || 'Lander'}`
                : feature.body === 'earth'
                ? 'Earth Station'
                : feature.type || 'Lunar Site'}
            </span>
          </div>

          <h3 className="font-serif text-lg font-medium text-[#F1F5F9] truncate mt-0.5">
            {clpsData?.name || feature.name}
          </h3>

          <div className="flex items-center gap-2 mt-1 text-[11px] font-mono text-[#94A3B8]">
            <span>{latStr}, {lonStr}</span>
            <button
              type="button"
              onClick={handleCopyCoords}
              className="text-[#34D399] hover:underline flex items-center gap-1"
            >
              {isCopied ? <Check className="w-3 h-3 text-[#34D399]" /> : <Copy className="w-3 h-3" />}
            </button>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="p-1 rounded-full text-[#94A3B8] hover:text-white hover:bg-[#15273F] transition-colors"
          title="Close inspector"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Quick Telemetry Pills */}
      <div className="grid grid-cols-2 gap-2 text-xs font-mono">
        <div className="p-2 rounded-xl bg-[#0D1726] border border-[#16283C] flex items-center justify-between">
          <span className="flex items-center gap-1 text-[#94A3B8]">
            <Sun className="w-3 h-3 text-[#00D2C4]" />
            <span>Sun</span>
          </span>
          <span className="text-[#F1F5F9] font-semibold">
            {localThermal?.isDaylight ? 'Daylight' : localThermal?.isPSR ? 'PSR' : 'Night'}
          </span>
        </div>

        <div className="p-2 rounded-xl bg-[#0D1726] border border-[#16283C] flex items-center justify-between">
          <span className="flex items-center gap-1 text-[#94A3B8]">
            <Radio className="w-3 h-3 text-[#34D399]" />
            <span>Temp</span>
          </span>
          <span className="text-[#34D399] font-semibold">
            {localThermal ? `${localThermal.tempC > 0 ? '+' : ''}${localThermal.tempC}°C` : 'N/A'}
          </span>
        </div>
      </div>

      {/* Point Analysis & Options */}
      <div className="space-y-2 pt-0.5">
        <button
          type="button"
          onClick={() => onOpenSiteAnalysis?.(feature)}
          className="w-full h-10 px-3 flex items-center justify-center gap-2 bg-[#0D1726] hover:bg-[#15273F] text-[#00D2C4] hover:text-[#F1F5F9] rounded-xl border border-[#16283C] hover:border-[#00D2C4]/60 transition-all font-semibold"
          title="Complete Site Analysis: Unified Overview, Weather, DTE & Landing Verdict"
        >
          <Compass className="w-4 h-4 text-[#00D2C4]" />
          <span className="text-xs">Site Analysis (Complete Overview)</span>
        </button>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => onOpenDteCalculation?.(feature)}
            className="h-9 px-2.5 flex items-center justify-center gap-1.5 bg-[#0D1726] hover:bg-[#15273F] text-[#34D399] rounded-xl border border-[#16283C] hover:border-[#34D399]/50 transition-all text-xs font-semibold"
            title="Direct-To-Earth Communication Calculation & 30-Day Timeline"
          >
            <Radio className="w-3.5 h-3.5 text-[#34D399]" />
            <span>DTE Calc</span>
          </button>

          <button
            type="button"
            onClick={() => onOpenWeather?.(feature)}
            className="h-9 px-2.5 flex items-center justify-center gap-1.5 bg-[#0D1726] hover:bg-[#15273F] text-[#22D3EE] rounded-xl border border-[#16283C] hover:border-[#22D3EE]/50 transition-all text-xs font-semibold"
            title="Lunar Surface Thermal Weather & Solar Cycle"
          >
            <Thermometer className="w-3.5 h-3.5 text-[#22D3EE]" />
            <span>Weather</span>
          </button>
        </div>

        {/* Cross-body selection: Select Target from Earth (when inspecting Moon) or Select Target from Moon (when inspecting Earth) */}
        {feature.body === 'earth' ? (
          <button
            type="button"
            onClick={() => onSelectOtherBody?.('moon')}
            className="w-full h-9 px-3 flex items-center justify-center gap-2 bg-[#0D1726] hover:bg-[#15273F] text-[#00D2C4] hover:text-[#F1F5F9] rounded-xl border border-[#16283C] hover:border-[#00D2C4]/60 transition-all font-semibold text-xs"
            title="Switch to Moon to select a lunar surface location"
          >
            <Moon className="w-3.5 h-3.5 text-[#00D2C4]" />
            <span>Select Target from Moon</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={() => onSelectOtherBody?.('earth')}
            className="w-full h-9 px-3 flex items-center justify-center gap-2 bg-[#0D1726] hover:bg-[#15273F] text-[#34D399] hover:text-[#F1F5F9] rounded-xl border border-[#16283C] hover:border-[#34D399]/60 transition-all font-semibold text-xs"
            title="Switch to Earth to select an Earth ground station"
          >
            <Globe2 className="w-3.5 h-3.5 text-[#34D399]" />
            <span>Select Target from Earth</span>
          </button>
        )}
      </div>

      {/* Navigation & Pin Actions */}
      <div className="flex items-center gap-1.5 pt-1 border-t border-[#16283C]/60">
        <button
          type="button"
          onClick={() => onZoomHere(featLon, featLat)}
          className="flex-1 h-8 px-2.5 flex items-center justify-center gap-1 bg-[#0D1726] hover:bg-[#15273F] text-[#F1F5F9] hover:text-[#00D2C4] font-semibold text-xs rounded-xl border border-[#16283C] hover:border-[#00D2C4]/60 transition-colors"
        >
          <Navigation className="w-3.5 h-3.5 text-[#00D2C4]" />
          <span>Center</span>
        </button>

        {onCompareMission && feature.body !== 'earth' && (
          <button
            type="button"
            onClick={() => onCompareMission(clpsData || feature)}
            className="h-8 px-2.5 flex items-center justify-center gap-1 bg-[#0D1726] hover:bg-[#15273F] text-[#34D399] font-medium text-xs rounded-xl border border-[#16283C] transition-colors"
            title="Compare site"
          >
            <GitCompare className="w-3.5 h-3.5" />
            <span>Compare</span>
          </button>
        )}

        {isCustomPin && onClearCustomPin && (
          <button
            type="button"
            onClick={() => {
              onClearCustomPin(feature.body === 'earth' ? 'earth' : 'moon');
              onClose();
            }}
            className="h-8 w-8 flex items-center justify-center bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 rounded-xl border border-rose-500/30 transition-colors shrink-0"
            title="Delete pin"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </aside>
  );
}
