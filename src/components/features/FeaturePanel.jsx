/**
 * @file FeaturePanel.jsx
 * Displays details and actions for a selected Moon or Earth feature.
 */

import React, { useState } from 'react';
import {
  X,
  Navigation,
  Award,
  Database,
  MapPin,
  Copy,
  Check,
  Trash2,
  Globe2,
  ExternalLink,
  GitCompare,
  Layers,
  ChevronDown,
  ChevronUp,
  Maximize2,
  Minimize2,
  Calendar,
  Rocket,
  ShieldCheck,
  Clock,
  Sparkles,
  Thermometer,
  Sun,
  Compass,
} from 'lucide-react';
import {
  formatLunarCoordinates,
  getLunarRegionInfo,
} from '../../utils/coordinates.js';
import { getClpsMission } from '../../data/clpsMissions.js';
import { getLunarTemperature } from '../../utils/lunarThermal.js';
import HorizonViewCard from './HorizonViewCard.jsx';
import { notifySuccess, notifyNavigation, notifyInfo } from '../../utils/feedbackStore.js';

// Adjust this value to experiment with desktop feature-panel width; mobile remains full-width.
const FEATURE_PANEL_WIDTH_REM = 31.2;

/**
 * Collapsible side panel (desktop) / bottom sheet (mobile) for selected mission or feature.
 * Features comprehensive NASA CLPS mission metadata, payload registers, and comparison tools.
 */
export default function FeaturePanel({
  feature,
  onClose,
  onZoomHere,
  onMeasureFromHere,
  onClearCustomPin,
  onCompareMission,
  onSelectOtherBody,
  timelineVisible = false,
  communicationEarthFeature = null,
}) {
  const [isCopied, setIsCopied] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [arePayloadsExpanded, setArePayloadsExpanded] = useState(true);

  if (!feature) return null;

  // Resolve full CLPS metadata if this feature is a CLPS mission
  const clpsData =
    feature.clpsData ||
    getClpsMission(feature.id) ||
    (feature.id === 'landing-odysseus' ? getClpsMission('clps-im1-odysseus') : null);

  const isCustomPin = feature.isCustomPin || feature.type === 'custom_pin';
  const isClps = Boolean(clpsData || feature.isClps || feature.type === 'clps-mission');
  const otherBody = feature.body === 'earth' ? 'moon' : 'earth';

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

  const precision = isCustomPin ? 4 : 2;
  const { latStr, lonStr } = formatLunarCoordinates(
    featLon,
    featLat,
    precision
  );

  const localThermal = feature.body !== 'earth' && typeof featLat === 'number' && typeof featLon === 'number' ? getLunarTemperature(featLat, featLon) : null;
  const regionInfo =
    feature.body === 'earth'
      ? null
      : feature.regionInfo || getLunarRegionInfo(featLon, featLat);

  const handleCopyCoords = () => {
    const textToCopy = `${latStr}, ${lonStr} (${featLat.toFixed(4)}°, ${featLon.toFixed(4)}°)`;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(textToCopy);
      setIsCopied(true);
      notifySuccess('Coordinates Copied', `${latStr}, ${lonStr} copied to clipboard`);
      setTimeout(() => setIsCopied(false), 2000);
    }
  };

  const getTypeLabel = (type) => {
    if (isClps) return `NASA CLPS · ${clpsData?.taskOrder || 'Commercial Mission'}`;
    switch (type) {
      case 'launch-site':
        return 'Rocket Launch Complex / Spaceport';
      case 'launch-pad':
        return 'Orbital Launch Pad';
      case 'custom_pin':
        return 'Custom Waypoint';
      case 'coordinate':
        return 'Coordinate Target';
      case 'deep-space-communication':
        return 'Deep-Space Communications';
      case 'spacecraft-tracking':
        return 'Spacecraft Tracking';
      case 'launch-tracking':
        return 'Launch Tracking';
      case 'relay-communications':
        return 'Relay Communications';
      case 'mission-operations':
        return 'Mission Operations';
      case 'south_pole':
        return 'Lunar Polar Target';
      case 'landing-site':
        return 'Apollo Crewed Landing';
      case 'mission-site':
        return 'Robotic Lander Site';
      case 'mountain':
        return 'Lunar Mountain (Mons)';
      case 'mare':
        return 'Lunar Mare (Basalt Plain)';
      case 'valley':
        return 'Lunar Valley (Vallis)';
      case 'rille':
        return 'Sinuous Rille (Rima)';
      case 'crater':
      default:
        return 'Impact Crater';
    }
  };

  // Minimized state pill docked at bottom right
  if (isCollapsed) {
    return (
      <div
        id="feature-panel-collapsed"
        className={`absolute ${
          timelineVisible ? 'bottom-[75px]' : 'bottom-3 sm:bottom-4'
        } right-3 sm:right-4 left-auto z-40 flex items-center gap-2 p-2 bg-[#060b14]/95 backdrop-blur-xl border border-slate-800 rounded-xl shadow-2xl pointer-events-auto animate-in fade-in slide-in-from-right-2 duration-150 select-none`}
      >
        <button
          type="button"
          onClick={() => setIsCollapsed(false)}
          className="flex items-center gap-2 text-left"
          title="Expand feature details"
        >
          <div className={`w-2 h-2 rounded-full ${isClps ? 'bg-cyan-400 animate-pulse' : 'bg-slate-400'}`} />
          <span className="text-xs font-semibold text-white max-w-[150px] truncate">
            {clpsData?.name || feature.name}
          </span>
          <Maximize2 className="w-3.5 h-3.5 text-slate-400 hover:text-white" />
        </button>
        <button
          type="button"
          onClick={onClose}
          className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  const payloadsList = clpsData?.payloads || (Array.isArray(feature.payloads) ? feature.payloads : []);

  return (
    <aside
      id="lunar-feature-panel"
      className={`absolute ${
        timelineVisible ? 'bottom-[76px]' : 'bottom-3 sm:bottom-4'
      } top-16 right-0 sm:right-3 md:right-4 left-auto z-40 w-full sm:w-[min(var(--feature-panel-width),calc(100vw-2rem))] flex flex-col bg-[#060b14]/96 backdrop-blur-2xl border-t sm:border border-slate-800 rounded-t-2xl sm:rounded-2xl shadow-2xl shadow-black/80 overflow-hidden pointer-events-auto select-none transition-all animate-in fade-in slide-in-from-right-4 duration-200 ease-out`}
      style={{ '--feature-panel-width': `${FEATURE_PANEL_WIDTH_REM}rem` }}
    >
      {/* Mobile drag bar */}
      <div className="w-10 h-1 bg-slate-700 rounded-full mx-auto mt-2 sm:hidden" />

      {/* Streamlined Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800/90 bg-[#070d18]/80 shrink-0">
        <div className="flex items-center gap-2 min-w-0 pr-2">
          {isCustomPin && <MapPin className="w-4 h-4 text-rose-400 shrink-0" />}
          <div className="min-w-0">
            <span
              className={`text-[9.5px] font-mono font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded border ${
                isClps
                  ? 'text-cyan-300 bg-cyan-950/60 border-cyan-500/30'
                  : isCustomPin
                  ? 'text-rose-300 bg-rose-950/70 border-rose-500/40 shadow-sm'
                  : 'text-slate-300 bg-slate-900 border-slate-700'
              }`}
            >
              {getTypeLabel(feature.type)}
            </span>
            <h2 className="text-base font-bold text-white tracking-tight leading-snug truncate mt-1">
              {clpsData?.name || feature.name}
            </h2>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => setIsCollapsed(true)}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
            title="Minimize panel"
          >
            <Minimize2 className="w-3.5 h-3.5" />
          </button>
          <button
            id="btn-close-feature-panel"
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
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
            <button
              type="button"
              onClick={handleCopyCoords}
              className="flex items-center gap-1 text-cyan-400 hover:text-cyan-300 transition-colors"
              title="Copy coordinates"
            >
              {isCopied ? (
                <>
                  <Check className="w-3 h-3 text-emerald-400" />
                  <span className="text-emerald-300">Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3 h-3" />
                  <span>Copy</span>
                </>
              )}
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-800/80 font-mono">
            <div>
              <div className="text-[9.5px] text-slate-500 font-sans">Latitude</div>
              <div className="text-white font-bold">{latStr}</div>
              <div className="text-[9.5px] text-slate-500">({featLat.toFixed(4)}°)</div>
            </div>
            <div>
              <div className="text-[9.5px] text-slate-500 font-sans">Longitude</div>
              <div className="text-white font-bold">{lonStr}</div>
              <div className="text-[9.5px] text-slate-500">({featLon.toFixed(4)}°)</div>
            </div>
          </div>
        </div>


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

            <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-800/80 font-mono">
              <div>
                <div className="text-[9.5px] text-slate-500 font-sans">Equilibrium Temp</div>
                <div className="text-white font-bold text-sm">
                  {localThermal.tempC > 0 ? `+${localThermal.tempC}` : localThermal.tempC}°C
                </div>
                <div className="text-[9.5px] text-slate-400">
                  {localThermal.tempK} K · {localThermal.tempF > 0 ? `+${localThermal.tempF}` : localThermal.tempF}°F
                </div>
              </div>
              <div>
                <div className="text-[9.5px] text-slate-500 font-sans">Solar Elevation / Zenith</div>
                <div className="text-cyan-300 font-bold text-sm">
                  {localThermal.solarElevationDeg > 0 ? `+${localThermal.solarElevationDeg}` : localThermal.solarElevationDeg}°
                </div>
                <div className="text-[9.5px] text-slate-400">
                  {localThermal.isDaylight ? 'Radiative Heating' : 'Radiative Cooling'}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Region & Hemisphere info */}
        {regionInfo && (
          <div className="flex items-center gap-2 p-2 rounded-xl bg-slate-900/50 border border-slate-800/70 text-slate-300">
            <Globe2 className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            <div className="text-[11px] min-w-0">
              <span className="font-semibold text-slate-200">{regionInfo.face}</span>
              <span className="text-slate-500 mx-1">·</span>
              <span className="text-slate-400 text-[10px]">{regionInfo.quadrant}</span>
            </div>
          </div>
        )}

        {/* Scientific Payloads Section for CLPS missions */}
        {isClps && payloadsList.length > 0 && (
          <div className="bg-slate-900/60 rounded-xl border border-slate-800 overflow-hidden">
            <button
              type="button"
              onClick={() => setArePayloadsExpanded((prev) => !prev)}
              className="w-full flex items-center justify-between p-2.5 text-left text-xs font-semibold text-slate-200 hover:bg-slate-850/80 transition-colors"
            >
              <div className="flex items-center gap-2">
                <Layers className="w-3.5 h-3.5 text-cyan-400" />
                <span>NASA Scientific Payloads ({payloadsList.length})</span>
              </div>
              {arePayloadsExpanded ? (
                <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              )}
            </button>

            {arePayloadsExpanded && (
              <div className="p-2.5 pt-0 space-y-2 border-t border-slate-800/80">
                {payloadsList.map((payload, idx) => {
                  const pName = typeof payload === 'string' ? payload : payload.name;
                  const pFull = typeof payload === 'object' ? payload.fullName : '';
                  const pAgency = typeof payload === 'object' ? payload.agency : '';
                  const pPurpose = typeof payload === 'object' ? payload.purpose : '';

                  return (
                    <div
                      key={idx}
                      className="p-2 rounded-lg bg-[#060b14]/80 border border-slate-800/70 space-y-0.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-bold text-cyan-300">{pName}</span>
                        {pAgency && (
                          <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-slate-800 text-slate-300 border border-slate-700">
                            {pAgency}
                          </span>
                        )}
                      </div>
                      {pFull && <p className="text-[10.5px] font-medium text-slate-200">{pFull}</p>}
                      {pPurpose && <p className="text-[10px] text-slate-400 leading-tight">{pPurpose}</p>}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Mission Objectives / Description */}
        {(clpsData?.objectives || feature.description) && (
          <div className="p-2.5 rounded-xl bg-slate-900/40 border border-slate-800/60 space-y-1">
            <span className="text-[9.5px] font-mono uppercase text-slate-400 tracking-wider block">
              {isClps ? 'Mission Objectives' : 'Scientific Context'}
            </span>
            <p className="text-[11px] text-slate-300 leading-relaxed">
              {clpsData?.objectives || feature.description}
            </p>
          </div>
        )}

        {/* Physical specs for named lunar geographic features (craters/mountains) */}
        {!isClps && (feature.diameterKm || feature.elevationM) && (
          <div className="grid grid-cols-2 gap-2 bg-slate-900/40 p-2.5 rounded-xl border border-slate-800/70">
            {feature.diameterKm && (
              <div>
                <div className="text-[9.5px] text-slate-500 font-sans">Diameter</div>
                <div className="font-mono text-cyan-400 font-bold mt-0.5">
                  {feature.diameterKm} km
                </div>
              </div>
            )}

            {feature.depthKm && (
              <div>
                <div className="text-[9.5px] text-slate-500 font-sans">Rim Depth</div>
                <div className="font-mono text-slate-200 font-bold mt-0.5">
                  {feature.depthKm} km
                </div>
              </div>
            )}

            {feature.elevationM && (
              <div>
                <div className="text-[9.5px] text-slate-500 font-sans">Peak Elevation</div>
                <div className="font-mono text-amber-400 font-bold mt-0.5">
                  +{feature.elevationM.toLocaleString()} m
                </div>
              </div>
            )}

            {feature.lengthKm && (
              <div>
                <div className="text-[9.5px] text-slate-500 font-sans">Length</div>
                <div className="font-mono text-purple-400 font-bold mt-0.5">
                  {feature.lengthKm} km
                </div>
              </div>
            )}
          </div>
        )}

        {/* Data Source & Official Link */}
        <div className="flex items-center justify-between text-[10px] text-slate-400 pt-2 border-t border-slate-800/80">
          <div className="flex items-center gap-1.5 truncate">
            <Database className="w-3 h-3 text-slate-500 shrink-0" />
            <span className="truncate">Source: {clpsData?.source || feature.source || 'NASA CLPS'}</span>
          </div>

          {(clpsData?.sourceUrl || feature.sourceUrl) && (
            <a
              href={clpsData?.sourceUrl || feature.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-cyan-400 hover:text-cyan-300 font-mono shrink-0 ml-2"
            >
              <span>{feature.body === 'earth' ? 'Source' : 'NASA Doc'}</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>
      </div>

      {/* Action buttons footer */}
      <div className="p-3 border-t border-slate-800/80 bg-[#040711]/90 backdrop-blur-md flex items-center gap-2 shrink-0">
        <button
          id="btn-feature-zoom-here"
          type="button"
          onClick={() => {
            notifyNavigation(`Aligning with ${feature.name || 'target'}`, `${latStr}, ${lonStr}`);
            onZoomHere(featLon, featLat);
          }}
          className={`flex-1 h-9 px-3 flex items-center justify-center gap-1.5 font-semibold text-xs rounded-xl shadow-md transition-all duration-150 active:scale-95 ${
            isCustomPin
              ? 'bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600 text-white shadow-rose-950/50'
              : 'bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white shadow-cyan-950/50'
          }`}
        >
          <Navigation className="w-3.5 h-3.5" />
          <span>Center View</span>
        </button>

        {onCompareMission && feature.body !== 'earth' && (
          <button
            type="button"
            onClick={() => {
              notifyInfo('Opening Site Navigator', `Comparing ${feature.name || 'target site'} in trade-off analyzer.`);
              onCompareMission(clpsData || feature);
            }}
            className="flex-1 h-9 px-3 flex items-center justify-center gap-1.5 bg-slate-900/90 hover:bg-slate-850 text-cyan-300 font-semibold text-xs rounded-xl border border-cyan-500/30 hover:border-cyan-400/60 shadow-sm transition-all duration-150 active:scale-95"
            title="Compare this landing site in Site Navigator"
          >
            <GitCompare className="w-3.5 h-3.5 text-cyan-400" />
            <span>Analyze Site</span>
          </button>
        )}

        {isCustomPin && onClearCustomPin && (
          <button
            id="btn-feature-clear-pin"
            type="button"
            onClick={() => {
              notifyInfo('Waypoint Removed', 'Custom landing pin cleared from lunar surface.');
              onClearCustomPin(feature.body === 'earth' ? 'earth' : 'moon');
              onClose();
            }}
            className="h-9 px-3 flex items-center justify-center gap-1.5 bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 hover:text-rose-100 font-semibold text-xs rounded-xl border border-rose-500/40 hover:border-rose-400 transition-all duration-150 active:scale-95 shadow-sm"
            title="Remove this custom waypoint from map"
          >
            <Trash2 className="w-3.5 h-3.5 text-rose-400" />
            <span>Clear Pin</span>
          </button>
        )}

        {onSelectOtherBody && !isCustomPin && (
          <button
            type="button"
            onClick={() => {
              notifyInfo(`Switched to ${otherBody === 'earth' ? 'Earth' : 'Moon'} View`, 'Planetary view changed for cross-body communication analysis.');
              onSelectOtherBody(otherBody);
            }}
            className="h-9 px-3 flex items-center justify-center gap-1.5 rounded-xl border border-slate-700 bg-slate-900/80 text-xs font-semibold text-slate-300 transition-colors hover:border-cyan-500/50 hover:text-cyan-200 active:scale-95 shadow-sm"
            title={`Switch to ${otherBody === 'earth' ? 'Earth' : 'Moon'} view`}
          >
            <Globe2 className="w-3.5 h-3.5 text-cyan-400" />
            <span className="truncate">View {otherBody === 'earth' ? 'Earth' : 'Moon'}</span>
          </button>
        )}
      </div>
    </aside>
  );
}
