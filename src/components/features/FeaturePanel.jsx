import React from 'react';
import { X, Navigation, Compass, Calendar, Award, Database, Ruler } from 'lucide-react';
import { formatLunarCoordinates } from '../../utils/coordinates.js';

/**
 * Feature Information Panel (Floating side card on desktop, bottom sheet on mobile).
 * Displays verified scientific and historical details of the selected lunar feature.
 * 
 * @param {{
 *   feature: import('../../types/lunar.js').LunarFeature | null,
 *   onClose: () => void,
 *   onZoomHere: (lon: number, lat: number) => void,
 *   onMeasureFromHere?: (lon: number, lat: number) => void
 * }} props
 */
export default function FeaturePanel({
  feature,
  onClose,
  onZoomHere,
  onMeasureFromHere,
}) {
  if (!feature) return null;

  const { latStr, lonStr, combined } = formatLunarCoordinates(
    feature.longitude,
    feature.latitude,
    2
  );

  const getTypeLabel = (type) => {
    switch (type) {
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
      className="absolute bottom-16 sm:bottom-auto sm:top-16 left-4 right-4 sm:right-auto z-30 sm:w-88 max-h-[75vh] sm:max-h-[calc(100vh-5.5rem)] flex flex-col bg-slate-900/95 backdrop-blur-xl border border-slate-800 rounded-2xl shadow-2xl overflow-hidden pointer-events-auto transition-all animate-fade-in"
    >
      {/* Header */}
      <div className="flex items-start justify-between p-4 pb-3 border-b border-slate-800 bg-slate-950/40">
        <div className="flex flex-col pr-2 min-w-0">
          <div className="text-[10px] font-bold uppercase tracking-wider text-cyan-400 font-sans">
            {getTypeLabel(feature.type)}
          </div>
          <h2 className="text-lg font-bold text-white tracking-tight leading-snug truncate">
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
        {/* Key Metrics Grid */}
        <div className="grid grid-cols-2 gap-2 bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/80">
          <div>
            <div className="text-[10px] text-slate-500 font-medium">Selenographic Latitude</div>
            <div className="font-mono text-slate-200 font-semibold mt-0.5">{latStr}</div>
          </div>
          <div>
            <div className="text-[10px] text-slate-500 font-medium">Selenographic Longitude</div>
            <div className="font-mono text-slate-200 font-semibold mt-0.5">{lonStr}</div>
          </div>

          {feature.diameterKm && (
            <div>
              <div className="text-[10px] text-slate-500 font-medium">Diameter</div>
              <div className="font-mono text-cyan-400 font-semibold mt-0.5">{feature.diameterKm} km</div>
            </div>
          )}

          {feature.depthKm && (
            <div>
              <div className="text-[10px] text-slate-500 font-medium">Rim Depth</div>
              <div className="font-mono text-slate-200 font-semibold mt-0.5">{feature.depthKm} km</div>
            </div>
          )}

          {feature.elevationM && (
            <div>
              <div className="text-[10px] text-slate-500 font-medium">Peak Elevation</div>
              <div className="font-mono text-amber-400 font-semibold mt-0.5">+{feature.elevationM.toLocaleString()} m</div>
            </div>
          )}

          {feature.lengthKm && (
            <div>
              <div className="text-[10px] text-slate-500 font-medium">Length</div>
              <div className="font-mono text-purple-400 font-semibold mt-0.5">{feature.lengthKm} km</div>
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

        {/* Agency / Mission Status if available */}
        {feature.agency && (
          <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-purple-950/30 border border-purple-900/50 text-[11px] text-purple-200">
            <Award className="w-3.5 h-3.5 text-purple-400 shrink-0" />
            <span><strong className="text-white">{feature.agency}</strong> — {feature.status || 'Mission'}</span>
          </div>
        )}

        {/* Scientific Description */}
        {feature.description && (
          <div className="leading-relaxed text-slate-300">
            <p>{feature.description}</p>
          </div>
        )}

        {/* Data Source citation */}
        <div className="flex items-center gap-1.5 text-[10px] text-slate-500 pt-1 border-t border-slate-800">
          <Database className="w-3 h-3 text-slate-600 shrink-0" />
          <span>Catalog: <span className="text-slate-400">{feature.source || 'NASA / IAU'}</span></span>
        </div>
      </div>

      {/* Action buttons */}
      <div className="p-3 border-t border-slate-800 bg-slate-950/40 flex items-center gap-2">
        <button
          id="btn-feature-zoom-here"
          type="button"
          onClick={() => onZoomHere(feature.longitude, feature.latitude)}
          className="flex-1 flex items-center justify-center gap-1.5 h-9 bg-cyan-600 hover:bg-cyan-500 text-white font-medium text-xs rounded-xl shadow-lg transition-colors"
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
      </div>
    </div>
  );
}
