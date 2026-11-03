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
<<<<<<< HEAD
import HorizonViewCard from './HorizonViewCard.jsx';
import { notifySuccess, notifyNavigation, notifyInfo } from '../../utils/feedbackStore.js';
=======
import { notifySuccess } from '../../utils/feedbackStore.js';
>>>>>>> 66b8661a38360fddf9890f8e655a4868134e6291

// Adjust this value to experiment with desktop feature-panel width; mobile remains full-width.
const FEATURE_PANEL_WIDTH_REM = 31.2;

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
<<<<<<< HEAD
      className={`absolute ${
        timelineVisible ? 'bottom-[110px]' : 'bottom-7'
      } sm:bottom-auto sm:top-14 right-0 sm:right-4 left-0 sm:left-auto z-50 sm:w-[min(var(--feature-panel-width),calc(100vw-2rem))] max-h-[72vh] ${
        timelineVisible
          ? 'sm:max-h-[calc(100vh-12rem)]'
          : 'sm:max-h-[calc(100vh-6rem)]'
      } flex flex-col bg-[#060b14]/96 backdrop-blur-2xl border-t sm:border border-slate-800 rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden pointer-events-auto select-none transition-all animate-in fade-in slide-in-from-top-2 duration-150`}
      style={{ '--feature-panel-width': `${FEATURE_PANEL_WIDTH_REM}rem` }}
=======
      className={`fixed ${
        timelineVisible ? 'bottom-[104px]' : 'bottom-10'
      } right-14 sm:right-18 z-30 w-80 sm:w-88 rounded-2xl bg-[#080E18]/95 backdrop-blur-xl border border-[#16283C] shadow-[0_20px_60px_rgba(0,0,0,0.85)] p-4 space-y-3.5 select-none pointer-events-auto transition-all animate-in fade-in slide-in-from-bottom-2 duration-150`}
>>>>>>> 66b8661a38360fddf9890f8e655a4868134e6291
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

<<<<<<< HEAD
        <div className="flex items-center gap-1 shrink-0">
          {onCompareMission && (
            <button
              type="button"
              onClick={() => onCompareMission(clpsData || feature)}
              className="p-1 text-cyan-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
              title="Compare this site/mission in the Landing Site Navigator"
            >
              <GitCompare className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            type="button"
            onClick={() => setIsCollapsed(true)}
            className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
            title="Collapse panel"
          >
            <Minimize2 className="w-3.5 h-3.5" />
          </button>
          <button
            id="btn-close-feature-panel"
            type="button"
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
            title="Close details"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Scrollable details */}
      <div className="overflow-y-auto p-3.5 space-y-3 custom-scrollbar text-xs text-slate-300">
        {feature.body !== 'earth' && (
          <HorizonViewCard
            siteId={feature.id}
            latitude={featLat}
            longitude={featLon}
            moonFeature={feature}
            earthFeature={communicationEarthFeature}
          />
        )}
        {/* Nearest cataloged landmark for custom pin */}
        {isCustomPin && feature.nearestFeature && (
          <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-900/60 border border-slate-800/80 text-xs">
            <div className="flex items-center gap-2 min-w-0">
              <Compass className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
              <div className="min-w-0">
                <span className="text-[9.5px] font-mono uppercase text-slate-500 block">Nearest Lunar Landmark</span>
                <span className="font-semibold text-slate-200 truncate block">{feature.nearestFeature}</span>
              </div>
            </div>
            {feature.nearestFeatureDistanceKm != null && (
              <span className="font-mono text-cyan-300 text-[10px] font-medium px-2 py-0.5 rounded bg-cyan-950/60 border border-cyan-500/30 shrink-0 ml-2">
                {feature.nearestFeatureDistanceKm} km away
              </span>
            )}
          </div>
        )}

        {/* CLPS Provider & Lander Card */}
        {isClps && clpsData && (
          <div className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-800 space-y-1.5">
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div>
                <span className="text-[9.5px] font-mono uppercase text-slate-500 block">Commercial Provider</span>
                <span className="font-semibold text-white">{clpsData.provider}</span>
              </div>
              <div>
                <span className="text-[9.5px] font-mono uppercase text-slate-500 block">Lander Vehicle</span>
                <span className="font-semibold text-cyan-300">{clpsData.lander}</span>
              </div>
              <div>
                <span className="text-[9.5px] font-mono uppercase text-slate-500 block">Launch Date</span>
                <span className="font-mono text-slate-200">{clpsData.launchDate}</span>
              </div>
              <div>
                <span className="text-[9.5px] font-mono uppercase text-slate-500 block">Landing Site</span>
                <span className="font-semibold text-slate-200 truncate block">{clpsData.landingSiteName}</span>
              </div>
            </div>
            {clpsData.launchVehicle && (
              <div className="pt-1.5 border-t border-slate-800/80 text-[10px] text-slate-400 flex items-center justify-between">
                <span>Launch Vehicle: <strong className="text-slate-200">{clpsData.launchVehicle}</strong></span>
                <span className="text-cyan-400/90 font-mono">{clpsData.targetRegion}</span>
              </div>
            )}
          </div>
        )}

        {feature.body === 'earth' && !isCustomPin && (
          <div className="grid grid-cols-2 gap-2 bg-slate-900/60 p-2.5 rounded-xl border border-slate-800/70">
            {feature.agency && (
              <div>
                <div className="text-[9.5px] text-slate-500 font-sans">Agency</div>
                <div className="text-white mt-0.5">{feature.agency}</div>
              </div>
            )}
            {feature.country && (
              <div>
                <div className="text-[9.5px] text-slate-500 font-sans">Country</div>
                <div className="text-white mt-0.5">{feature.country}</div>
              </div>
            )}
            {feature.network && (
              <div className="col-span-2">
                <div className="text-[9.5px] text-slate-500 font-sans">Network</div>
                <div className="text-cyan-300 mt-0.5">{feature.network}</div>
              </div>
            )}
          </div>
        )}

        {/* Coordinates  card */}
        <div className="bg-slate-900/60 p-2.5 rounded-xl border border-slate-800/80 space-y-1.5">
          <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 uppercase tracking-wider">
            <span>{feature.body === 'earth' ? 'Geographic Coordinates' : 'Selenographic Coordinates'}</span>
=======
          <div className="flex items-center gap-2 mt-1 text-[11px] font-mono text-[#94A3B8]">
            <span>{latStr}, {lonStr}</span>
>>>>>>> 66b8661a38360fddf9890f8e655a4868134e6291
            <button
              type="button"
              onClick={handleCopyCoords}
              className="text-[#34D399] hover:underline flex items-center gap-1"
            >
              {isCopied ? <Check className="w-3 h-3 text-[#34D399]" /> : <Copy className="w-3 h-3" />}
            </button>
          </div>
        </div>

<<<<<<< HEAD

        {/* Real-time Surface Thermal & Solar Insolation Telemetry */}
        {localThermal && (
          <div className="bg-slate-900/60 p-2.5 rounded-xl border border-slate-800/80 space-y-1.5">
            <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 uppercase tracking-wider">
              <div className="flex items-center gap-1.5 text-cyan-400 font-semibold">
                <Thermometer className="w-3.5 h-3.5" />
                <span>Surface Temperature & Insolation</span>
              </div>
              <span
                className={`text-[9.5px] font-mono px-1.5 py-0.5 rounded border ${
                  localThermal.isPSR
                    ? 'bg-purple-950/80 text-purple-300 border-purple-500/40'
                    : localThermal.isDaylight
                    ? 'bg-amber-950/80 text-amber-300 border-amber-500/40'
                    : 'bg-blue-950/80 text-blue-300 border-blue-500/40'
                }`}
              >
                {localThermal.isPSR ? 'PSR Permanent Shadow' : localThermal.isDaylight ? 'Sunlit Daylight' : 'Lunar Night'}
              </span>
            </div>
=======
        <button
          type="button"
          onClick={onClose}
          className="p-1 rounded-full text-[#94A3B8] hover:text-white hover:bg-[#15273F] transition-colors"
          title="Close inspector"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
>>>>>>> 66b8661a38360fddf9890f8e655a4868134e6291

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
