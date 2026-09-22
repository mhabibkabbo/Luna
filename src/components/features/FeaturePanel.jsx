import React, { useState } from 'react';
import {
  X,
  Navigation,
  Compass,
  Calendar,
  Award,
  Database,
  Ruler,
  MapPin,
  Copy,
  Check,
  Trash2,
  Share2,
  Globe2,
} from 'lucide-react';
import {
  formatLunarCoordinates,
  getLunarRegionInfo,
} from '../../utils/coordinates.js';

/**
 * Feature Information Panel (Floating side card on desktop, bottom sheet on mobile).
 * Displays verified scientific and historical details of lunar features or user-dropped custom pins.
 * 
 * @param {{
 *   feature: import('../../types/lunar.js').LunarFeature | any | null,
 *   onClose: () => void,
 *   onZoomHere: (lon: number, lat: number) => void,
 *   onMeasureFromHere?: (lon: number, lat: number) => void,
 *   onClearCustomPin?: () => void
 * }} props
 */
export default function FeaturePanel({
  feature,
  onClose,
  onZoomHere,
  onMeasureFromHere,
  onClearCustomPin,
}) {
  const [isCopied, setIsCopied] = useState(false);

  if (!feature) return null;

  const isCustomPin = feature.isCustomPin || feature.type === 'custom_pin';

  const precision = isCustomPin ? 4 : 2;
  const { latStr, lonStr, combined } = formatLunarCoordinates(
    feature.longitude,
    feature.latitude,
    precision
  );

  const regionInfo = feature.regionInfo || getLunarRegionInfo(feature.longitude, feature.latitude);

  const handleCopyCoords = () => {
    const textToCopy = `${latStr}, ${lonStr} (${feature.latitude.toFixed(4)}, ${feature.longitude.toFixed(4)})`;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(textToCopy);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    }
  };

  const getTypeLabel = (type) => {
    switch (type) {
      case 'custom_pin':
        return 'Custom Dropped Pin';
      case 'south_pole':
        return 'Lunar Polar Feature';
      case 'landing-site':
        return 'Apollo Lunar Landing Site';
      case 'mission-site':
        return 'Robotic Lander / Impact Site';
      case 'mountain':
        return 'Lunar Mountain (Mons)';
      case 'mare':
        return 'Lunar Mare (Basaltic Plain)';
      case 'valley':
        return 'Lunar Valley (Vallis)';
      case 'rille':
        return 'Sinuous Rille (Rima)';
      case 'crater':
      default:
        return 'Impact Crater';
    }
  };

  return (
    <div
      id="lunar-feature-panel"
      className="absolute bottom-16 sm:bottom-auto sm:top-16 left-4 right-4 sm:right-auto z-30 sm:w-92 max-h-[78vh] sm:max-h-[calc(100vh-5.5rem)] flex flex-col bg-slate-900/95 backdrop-blur-xl border border-slate-800 rounded-2xl shadow-2xl overflow-hidden pointer-events-auto transition-all animate-fade-in"
    >
      {/* Header */}
      <div
        className={`flex items-start justify-between p-4 pb-3 border-b ${
          isCustomPin
            ? 'border-rose-900/50 bg-rose-950/20'
            : 'border-slate-800 bg-slate-950/40'
        }`}
      >
        <div className="flex flex-col pr-2 min-w-0">
          <div className="flex items-center gap-1.5">
            {isCustomPin && <MapPin className="w-3.5 h-3.5 text-rose-400 shrink-0" />}
            <span
              className={`text-[10px] font-bold uppercase tracking-wider font-sans ${
                isCustomPin ? 'text-rose-400' : 'text-cyan-400'
              }`}
            >
              {getTypeLabel(feature.type)}
            </span>
          </div>
          <h2 className="text-lg font-bold text-white tracking-tight leading-snug truncate mt-0.5">
            {feature.name}
          </h2>
        </div>
        <button
          id="btn-close-feature-panel"
          type="button"
          onClick={onClose}
          className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors shrink-0"
          aria-label="Close feature details"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Scrollable specs and description */}
      <div className="overflow-y-auto p-4 space-y-3.5 custom-scrollbar text-xs text-slate-300">
        {/* Exact Selenographic Coordinates Card with Copy Button */}
        <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
              Selenographic Coordinates
            </span>
            <button
              type="button"
              onClick={handleCopyCoords}
              className="flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium text-cyan-300 hover:text-cyan-200 bg-cyan-950/40 hover:bg-cyan-900/50 border border-cyan-800/60 rounded-md transition-all"
              title="Copy coordinates to clipboard"
            >
              {isCopied ? (
                <>
                  <Check className="w-3 h-3 text-emerald-400" />
                  <span className="text-emerald-300">Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3 h-3 text-cyan-400" />
                  <span>Copy</span>
                </>
              )}
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-800/60 font-mono">
            <div>
              <div className="text-[10px] text-slate-500 font-sans">Latitude</div>
              <div className="text-slate-100 font-bold mt-0.5">{latStr}</div>
              <div className="text-[10px] text-slate-500">({feature.latitude.toFixed(4)}°)</div>
            </div>
            <div>
              <div className="text-[10px] text-slate-500 font-sans">Longitude</div>
              <div className="text-slate-100 font-bold mt-0.5">{lonStr}</div>
              <div className="text-[10px] text-slate-500">({feature.longitude.toFixed(4)}°)</div>
            </div>
          </div>
        </div>

        {/* Lunar Region & Hemisphere */}
        {regionInfo && (
          <div className="flex items-start gap-2 p-2.5 rounded-xl bg-slate-950/50 border border-slate-800/70 text-slate-300">
            <Globe2 className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
            <div className="text-[11px] leading-relaxed">
              <div className="font-semibold text-slate-200">{regionInfo.face}</div>
              <div className="text-slate-400 text-[10px]">{regionInfo.quadrant}</div>
            </div>
          </div>
        )}

        {/* Nearest Landmark for Custom Pin */}
        {isCustomPin && feature.nearestFeature && (
          <div className="p-2.5 rounded-xl bg-rose-950/20 border border-rose-900/40 space-y-1">
            <div className="text-[10px] font-bold uppercase tracking-wider text-rose-300">
              Nearest Lunar Landmark
            </div>
            <div className="flex items-baseline justify-between text-xs text-slate-200">
              <span className="font-semibold text-white">{feature.nearestFeature}</span>
              <span className="font-mono text-rose-300 font-medium">
                {feature.nearestFeatureDistanceKm} km away
              </span>
            </div>
          </div>
        )}

        {/* Physical / Geological Specs for named features */}
        {(!isCustomPin || feature.diameterKm || feature.elevationM) && (
          <div className="grid grid-cols-2 gap-2 bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/80">
            {feature.diameterKm && (
              <div>
                <div className="text-[10px] text-slate-500 font-medium">Diameter</div>
                <div className="font-mono text-cyan-400 font-semibold mt-0.5">
                  {feature.diameterKm} km
                </div>
              </div>
            )}

            {feature.depthKm && (
              <div>
                <div className="text-[10px] text-slate-500 font-medium">Rim Depth</div>
                <div className="font-mono text-slate-200 font-semibold mt-0.5">
                  {feature.depthKm} km
                </div>
              </div>
            )}

            {feature.elevationM && (
              <div>
                <div className="text-[10px] text-slate-500 font-medium">Peak Elevation</div>
                <div className="font-mono text-amber-400 font-semibold mt-0.5">
                  +{feature.elevationM.toLocaleString()} m
                </div>
              </div>
            )}

            {feature.lengthKm && (
              <div>
                <div className="text-[10px] text-slate-500 font-medium">Length</div>
                <div className="font-mono text-purple-400 font-semibold mt-0.5">
                  {feature.lengthKm} km
                </div>
              </div>
            )}

            {feature.period && (
              <div>
                <div className="text-[10px] text-slate-500 font-medium">Geologic Period</div>
                <div className="font-sans text-slate-200 font-medium mt-0.5">{feature.period}</div>
              </div>
            )}

            {feature.date && (
              <div>
                <div className="text-[10px] text-slate-500 font-medium">Landing Date</div>
                <div className="font-mono text-amber-400 font-semibold mt-0.5">{feature.date}</div>
              </div>
            )}
          </div>
        )}

        {/* Agency / Mission Status if available */}
        {feature.agency && (
          <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-purple-950/30 border border-purple-900/50 text-[11px] text-purple-200">
            <Award className="w-3.5 h-3.5 text-purple-400 shrink-0" />
            <span>
              <strong className="text-white">{feature.agency}</strong> — {feature.status || 'Mission'}
            </span>
          </div>
        )}

        {/* Description */}
        {feature.description && (
          <div className="leading-relaxed text-slate-300 text-[11px] bg-slate-950/40 p-2.5 rounded-xl border border-slate-800/60">
            <p>{feature.description}</p>
          </div>
        )}

        {/* Data Source citation */}
        <div className="flex items-center gap-1.5 text-[10px] text-slate-500 pt-1 border-t border-slate-800">
          <Database className="w-3 h-3 text-slate-600 shrink-0" />
          <span>
            Catalog: <span className="text-slate-400">{feature.source || 'NASA / IAU'}</span>
          </span>
        </div>
      </div>

      {/* Action buttons */}
      <div className="p-3 border-t border-slate-800 bg-slate-950/40 flex items-center gap-2">
        <button
          id="btn-feature-zoom-here"
          type="button"
          onClick={() => onZoomHere(feature.longitude, feature.latitude)}
          className={`flex-1 flex items-center justify-center gap-1.5 h-9 font-medium text-xs rounded-xl shadow-lg transition-colors ${
            isCustomPin
              ? 'bg-rose-600 hover:bg-rose-500 text-white'
              : 'bg-cyan-600 hover:bg-cyan-500 text-white'
          }`}
        >
          <Navigation className="w-3.5 h-3.5" />
          Zoom Here
        </button>

        {onMeasureFromHere && (
          <button
            id="btn-feature-measure-from-here"
            type="button"
            onClick={() => onMeasureFromHere(feature.longitude, feature.latitude)}
            className="flex items-center justify-center gap-1.5 px-3 h-9 bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-xs rounded-xl border border-slate-700/60 transition-colors"
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
            className="flex items-center justify-center gap-1 px-3 h-9 bg-slate-800/80 hover:bg-rose-950 text-slate-300 hover:text-rose-300 font-medium text-xs rounded-xl border border-slate-700/60 hover:border-rose-800 transition-colors"
            title="Remove dropped custom pin"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Remove</span>
          </button>
        )}
      </div>
    </div>
  );
}
