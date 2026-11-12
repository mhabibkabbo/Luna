import React from 'react';
import { Globe2 } from 'lucide-react';
import DteSignalChart from '../../communication/DteSignalChart.jsx';

export default function FeaturePanelCommsTab({
  earthLook,
  generalLink,
  lightTravelSec,
  moonPoint,
  selectedStationId,
  onSelectStation,
  dsnSitesCalculations,
}) {
  return (
    <div className="space-y-2.5">
      <div className="px-2.5 py-1.5 rounded-xl bg-cyan-950/25 border border-cyan-500/30 text-[10px] font-mono text-cyan-200 leading-snug">
        <strong className="text-cyan-300">Geometric LOS vs. RF Link:</strong> Evaluates topographic horizon clearance and sub-Earth libration geometry. Operational RF link closure additionally depends on antenna gain, frequency band (S/X/Ka), and lander attitude.
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 font-mono">
        <div className="p-2 rounded-xl bg-[#0C0D12] border border-slate-800/80">
          <span className="text-[9.5px] text-slate-400 block">Earth Elev</span>
          <span className="text-xs font-bold text-white tabular-nums">
            {earthLook?.elevationDeg != null ? `${earthLook.elevationDeg.toFixed(1)}°` : '—'}
          </span>
        </div>
        <div className="p-2 rounded-xl bg-[#0C0D12] border border-slate-800/80">
          <span className="text-[9.5px] text-slate-400 block">Earth Az</span>
          <span className="text-xs font-bold text-white tabular-nums">
            {earthLook?.azimuthDeg != null ? `${earthLook.azimuthDeg.toFixed(1)}°` : '—'}
          </span>
        </div>
        <div className="p-2 rounded-xl bg-[#0C0D12] border border-slate-800/80">
          <span className="text-[9.5px] text-slate-400 block">Link Margin</span>
          <span
            className={`text-xs font-bold tabular-nums ${
              generalLink?.status === 'clear' ? 'text-emerald-400' : 'text-amber-400'
            }`}
          >
            {generalLink?.marginDeg != null ? (
              <>
                {generalLink.marginDeg >= 0 ? '+' : ''}
                {generalLink.marginDeg.toFixed(1)}°
              </>
            ) : '—'}
          </span>
        </div>
        <div className="p-2 rounded-xl bg-[#0C0D12] border border-slate-800/80">
          <span className="text-[9.5px] text-slate-400 block">1-Way Delay</span>
          <span className="text-xs font-bold text-cyan-300 tabular-nums">
            {lightTravelSec} s
          </span>
        </div>
      </div>

      <DteSignalChart
        moonFeature={moonPoint}
        initialStationId={selectedStationId}
        onStationSelect={onSelectStation}
      />

      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
          <span className="flex items-center gap-1 text-slate-200 font-semibold">
            <Globe2 className="w-3 h-3 text-emerald-400" />
            <span>NASA Deep Space Network Complexes</span>
          </span>
          <span>Click station to filter</span>
        </div>
        <div className="space-y-1">
          {dsnSitesCalculations.map((station) => {
            const isSelected = selectedStationId === station.id;
            const isLinked = station.evaluation.status === 'clear';
            return (
              <button
                key={station.id}
                type="button"
                aria-pressed={isSelected}
                onClick={() =>
                  onSelectStation((prev) => (prev === station.id ? 'all' : station.id))
                }
                className={`w-full text-left px-2.5 py-1.5 rounded-xl border transition-colors cursor-pointer flex items-center justify-between gap-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/70 ${
                  isSelected
                    ? 'bg-cyan-950/30 border-cyan-500/50'
                    : 'bg-[#0C0D12] border-slate-800/80 hover:border-slate-700'
                }`}
              >
                <div className="min-w-0">
                  <div className="font-medium text-white whitespace-normal break-words leading-tight">
                    {station.name}{' '}
                    <span className="text-[10px] font-mono text-slate-400">
                      ({station.country})
                    </span>
                  </div>
                  <div className="text-[10px] font-mono text-slate-400 tabular-nums">
                    Moon el:{' '}
                    {station.evaluation.stationElevationDeg != null
                      ? `${station.evaluation.stationElevationDeg.toFixed(1)}°`
                      : '—'}
                  </div>
                </div>
                <span
                  className={`text-[10px] font-mono font-bold whitespace-nowrap ${
                    isLinked ? 'text-emerald-400' : 'text-slate-400'
                  }`}
                >
                  {isLinked ? '● LINK ACTIVE' : '▲ BELOW MASK'}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
