import React, { useState } from 'react';
import {
  X,
  Navigation,
  Award,
  Database,
  Ruler,
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
} from 'lucide-react';
import {
  formatLunarCoordinates,
  getLunarRegionInfo,
} from '../../utils/coordinates.js';
import { getClpsMission } from '../../data/clpsMissions.js';

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

  const regionInfo = feature.regionInfo || getLunarRegionInfo(featLon, featLat);

  const handleCopyCoords = () => {
    const textToCopy = `${latStr}, ${lonStr} (${featLat.toFixed(4)}°, ${featLon.toFixed(4)}°)`;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(textToCopy);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    }
  };

  const getTypeLabel = (type) => {
    if (isClps) return `NASA CLPS · ${clpsData?.taskOrder || 'Commercial Mission'}`;
    switch (type) {
      case 'custom_pin':
        return 'Custom Waypoint';
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

  const getStatusBadge = () => {
    if (isClps && clpsData) {
      switch (clpsData.missionStatus) {
        case 'completed':
          return (
            <span className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-950/80 text-emerald-300 border border-emerald-500/40">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              Completed Soft Landing
            </span>
          );
        case 'failed':
          return (
            <span className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-full bg-rose-950/80 text-rose-300 border border-rose-500/40">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
              Flight Anomaly (Earth Re-entry)
            </span>
          );
        case 'in-progress':
          return (
            <span className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-950/80 text-amber-300 border border-amber-500/40 animate-pulse">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
              Mission Active
            </span>
          );
        case 'planned':
        default:
          return (
            <span className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-950/80 text-cyan-300 border border-cyan-500/40">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
              Planned Mission Target
            </span>
          );
      }
    }

    if (feature.status) {
      const isApollo = feature.type === 'landing-site';
      return (
        <span
          className={`inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-full border ${
            isApollo
              ? 'bg-amber-950/80 text-amber-300 border-amber-500/40'
              : 'bg-slate-900 text-slate-300 border-slate-700'
          }`}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${isApollo ? 'bg-amber-400' : 'bg-slate-400'}`} />
          {feature.status}
        </span>
      );
    }

    return null;
  };

  const getLocationTypeBadge = () => {
    const locType = clpsData?.locationType || (feature.type === 'landing-site' ? 'confirmed' : 'approximate');
    if (locType === 'confirmed') {
      return (
        <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-emerald-950/60 text-emerald-300 border border-emerald-500/30">
          CONFIRMED COORDINATES
        </span>
      );
    }
    if (locType === 'planned') {
      return (
        <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-cyan-950/60 text-cyan-300 border border-cyan-500/30">
          PLANNED LANDING ZONE
        </span>
      );
    }
    return (
      <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-slate-900 text-slate-400 border border-slate-800">
        GEOGRAPHIC COORDINATES
      </span>
    );
  };

  // Minimized state pill docked on side
  if (isCollapsed) {
    return (
      <div
        id="feature-panel-collapsed"
        className="absolute top-14 right-3 sm:right-4 z-30 flex items-center gap-2 p-2 bg-[#060b14]/95 backdrop-blur-xl border border-slate-800 rounded-xl shadow-2xl pointer-events-auto animate-in fade-in select-none"
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
      className="absolute bottom-7 sm:bottom-auto sm:top-14 right-0 sm:right-4 left-0 sm:left-auto z-30 sm:w-96 max-h-[72vh] sm:max-h-[calc(100vh-6rem)] flex flex-col bg-[#060b14]/96 backdrop-blur-2xl border-t sm:border border-slate-800 rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden pointer-events-auto select-none transition-all animate-in fade-in duration-150"
    >
      {/* Mobile drag bar */}
      <div className="w-10 h-1 bg-slate-700 rounded-full mx-auto mt-2 sm:hidden" />

      {/* Header */}
      <div className="flex items-start justify-between p-3.5 pb-2.5 border-b border-slate-800 bg-[#070d18]/60">
        <div className="flex flex-col min-w-0 pr-2">
          <div className="flex items-center gap-1.5 flex-wrap">
            {isCustomPin && <MapPin className="w-3 h-3 text-rose-400 shrink-0" />}
            <span
              className={`text-[9.5px] font-mono font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded border ${
                isClps
                  ? 'text-cyan-300 bg-cyan-950/60 border-cyan-500/30'
                  : 'text-slate-300 bg-slate-900 border-slate-700'
              }`}
            >
              {getTypeLabel(feature.type)}
            </span>
            {getLocationTypeBadge()}
          </div>
          <h2 className="text-base font-bold text-white tracking-tight leading-snug truncate mt-1">
            {clpsData?.name || feature.name}
          </h2>
          <div className="mt-1">{getStatusBadge()}</div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {isClps && onCompareMission && (
            <button
              type="button"
              onClick={() => onCompareMission(clpsData || feature)}
              className="p-1 text-cyan-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
              title="Compare this mission with another CLPS mission"
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

        {/* Coordinates card */}
        <div className="bg-slate-900/60 p-2.5 rounded-xl border border-slate-800/80 space-y-1.5">
          <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 uppercase tracking-wider">
            <span>Selenographic Coordinates</span>
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
              <span>NASA Doc</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>
      </div>

      {/* Action buttons */}
      <div className="p-3 border-t border-slate-800 bg-[#040711] flex items-center gap-2">
        <button
          id="btn-feature-zoom-here"
          type="button"
          onClick={() => onZoomHere(featLon, featLat)}
          className={`flex-1 flex items-center justify-center gap-1.5 h-8.5 font-medium text-xs rounded-xl transition-all shadow-md ${
            isCustomPin
              ? 'bg-rose-600 hover:bg-rose-500 text-white'
              : 'bg-gradient-to-r from-cyan-600 to-blue-600 hover:brightness-110 text-white'
          }`}
        >
          <Navigation className="w-3.5 h-3.5" />
          Fly To Target
        </button>

        {isClps && onCompareMission && (
          <button
            type="button"
            onClick={() => onCompareMission(clpsData || feature)}
            className="flex items-center justify-center gap-1.5 px-3 h-8.5 bg-slate-900 hover:bg-slate-800 text-cyan-300 font-medium text-xs rounded-xl border border-slate-800 hover:border-cyan-500/40 transition-colors"
            title="Compare with another mission"
          >
            <GitCompare className="w-3.5 h-3.5" />
            Compare
          </button>
        )}

        {onMeasureFromHere && (
          <button
            id="btn-feature-measure-from-here"
            type="button"
            onClick={() => onMeasureFromHere(featLon, featLat)}
            className="flex items-center justify-center gap-1.5 px-3 h-8.5 bg-slate-900 hover:bg-slate-800 text-slate-200 font-medium text-xs rounded-xl border border-slate-800 transition-colors"
            title="Start measurement from this point"
          >
            <Ruler className="w-3.5 h-3.5 text-amber-400" />
            Measure
          </button>
        )}

        {isCustomPin && onClearCustomPin && (
          <button
            id="btn-feature-clear-pin"
            type="button"
            onClick={() => {
              onClearCustomPin();
              onClose();
            }}
            className="flex items-center justify-center gap-1 px-2.5 h-8.5 bg-slate-900 hover:bg-rose-950 text-slate-400 hover:text-rose-300 rounded-xl border border-slate-800 transition-colors"
            title="Remove waypoint"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </aside>
  );
}
