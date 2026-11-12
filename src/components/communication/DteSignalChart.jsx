import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as d3 from 'd3';
import {
  Radio,
  Signal,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Globe2,
  Layers,
  ChevronDown,
  ChevronUp,
  Info,
  ExternalLink,
  ShieldAlert,
  ShieldCheck,
  Satellite,
  Compass,
  RefreshCw,
} from 'lucide-react';
import { EARTH_COMMUNICATION_SITES } from '../../data/earthCommunicationSites.js';
import { celestialTimeStore } from '../../utils/celestialTime.js';
import {
  COMMUNICATION_DATA_SOURCES,
  LUNAR_RELAYS,
  sweepCommunicationAvailability,
  getSurfaceElevationM,
} from '../../utils/communicationAnalysis.js';

const UTC_FORMAT = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'UTC',
  month: 'short',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

const formatUTC = (ms) => `${UTC_FORMAT.format(new Date(ms))} UTC`;

export default function DteSignalChart({
  moonFeature,
  initialStationId = 'all',
  onStationSelect,
}) {
  const svgRef = useRef(null);
  const containerRef = useRef(null);

  const [selectedStationId, setSelectedStationId] = useState(initialStationId || 'all');
  const [durationDays, setDurationDays] = useState(30);
  const [viewMode, setViewMode] = useState('timeline'); // 'timeline' (swimlane) | 'elevation' (degrees curve)
  const [relayType, setRelayType] = useState('none'); // 'none' | 'lro' | 'eml2_halo'
  const [hoverData, setHoverData] = useState(null);
  const [isComputing, setIsComputing] = useState(false);
  const [sweepResult, setSweepResult] = useState(null);
  const [isProvenanceOpen, setIsProvenanceOpen] = useState(false);
  const [containerWidth, setContainerWidth] = useState(0);

  const [currentMs, setCurrentMs] = useState(() => celestialTimeStore.get().ms);

  useEffect(() => {
    if (!containerRef.current) return;
    const updateWidth = () => {
      const el = containerRef.current;
      if (el && el.clientWidth > 0) {
        setContainerWidth(el.clientWidth);
      }
    };
    updateWidth();
    const ro = new ResizeObserver(updateWidth);
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const unsub = celestialTimeStore.subscribe(({ ms }) => {
      setCurrentMs(ms);
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (initialStationId !== undefined) {
      setSelectedStationId(initialStationId || 'all');
    }
  }, [initialStationId]);

  const activeStation = useMemo(() => {
    if (!selectedStationId || selectedStationId === 'all') return null;
    return (
      EARTH_COMMUNICATION_SITES.find((s) => s.id === selectedStationId) || null
    );
  }, [selectedStationId]);

  const handleStationChange = (stId) => {
    setSelectedStationId(stId);
    onStationSelect?.(stId);
  };

  const moonLat = moonFeature?.latitude ?? moonFeature?.lat ?? -89.4;
  const moonLon = moonFeature?.longitude ?? moonFeature?.lon ?? 0.0;
  const moonElevM = moonFeature?.elevationM ?? getSurfaceElevationM(moonLat, moonLon);
  const hasDemCoverage = moonLat <= -80.0;

  useEffect(() => {
    let active = true;
    const controller = new AbortController();

    async function computeAnalysis() {
      setIsComputing(true);
      try {
        const stepMinutes = durationDays <= 7 ? 30 : durationDays <= 14 ? 60 : 120;
        const res = await sweepCommunicationAvailability({
          lat: moonLat,
          lon: moonLon,
          elevationM: moonElevM,
          startMs: currentMs,
          durationDays,
          stepMinutes,
          earthStation: activeStation,
          relayType,
          siteId: moonFeature?.id,
          signal: controller.signal,
        });

        if (active && res) {
          setSweepResult(res);
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          console.warn('Communication sweep error:', err);
        }
      } finally {
        if (active) setIsComputing(false);
      }
    }

    computeAnalysis();

    return () => {
      active = false;
      controller.abort();
    };
  }, [moonLat, moonLon, moonElevM, moonFeature?.id, currentMs, durationDays, selectedStationId, relayType]);

  const stats = sweepResult?.statistics;
  const samples = sweepResult?.samples || [];

  useEffect(() => {
    setHoverData(null);
    if (!svgRef.current || !containerRef.current || samples.length === 0) return;

    const width = containerWidth || containerRef.current.clientWidth || 420;
    const height = viewMode === 'timeline' ? 140 : 180;
    const margin = { top: 16, right: 16, bottom: 26, left: 44 };
    const innerWidth = Math.max(120, width - margin.left - margin.right);
    const innerHeight = Math.max(60, height - margin.top - margin.bottom);

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    svg.attr('viewBox', `0 0 ${width} ${height}`);

    const g = svg
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    const timeExtent = d3.extent(samples, (d) => d.timestamp);
    const xScale = d3.scaleTime().domain(timeExtent).range([0, innerWidth]);

    // X Axis with dynamic tick spacing to prevent label collision
    const tickCount = Math.max(3, Math.min(6, Math.floor(innerWidth / 75)));
    const xAxis = d3
      .axisBottom(xScale)
      .ticks(tickCount)
      .tickFormat(d3.utcFormat('%b %d'));

    g.append('g')
      .attr('transform', `translate(0,${innerHeight})`)
      .call(xAxis)
      .call((axis) => {
        axis.select('.domain').attr('stroke', '#334155');
        axis.selectAll('.tick line').attr('stroke', '#1e293b');
        axis.selectAll('.tick text').attr('fill', '#94a3b8').attr('font-size', '10px').attr('font-family', 'monospace');
      });

    if (viewMode === 'timeline') {
      const barHeight = 44;
      const barY = (innerHeight - barHeight) / 2;

      g.append('rect')
        .attr('x', 0)
        .attr('y', barY)
        .attr('width', innerWidth)
        .attr('height', barHeight)
        .attr('rx', 6)
        .attr('fill', '#050811')
        .attr('stroke', '#1e293b');

      const sampleWidth = Math.max(1.5, innerWidth / samples.length);

      g.selectAll('.avail-segment')
        .data(samples)
        .enter()
        .append('rect')
        .attr('class', 'avail-segment')
        .attr('x', (d) => xScale(d.timestamp))
        .attr('y', barY + 3)
        .attr('width', sampleWidth + 0.5)
        .attr('height', barHeight - 6)
        .attr('fill', (d) => {
          if (d.status === 'clear') return '#10b981';
          if (d.status === 'relay') return '#3b82f6';
          if (d.status === 'doubtful') return '#f59e0b'; // Amber: Partial Grazing
          if (d.status === 'blocked') return '#ef4444';
          return '#475569'; // Grey: Uncomputed fallback
        })
        .attr('opacity', 0.9);

      g.append('text')
        .attr('x', -margin.left + 8)
        .attr('y', barY + barHeight / 2 + 4)
        .attr('fill', '#64748b')
        .attr('font-size', '9.5px')
        .attr('font-family', 'monospace')
        .text('LINK');
    } else {
      const minEl = Math.min(-5, d3.min(samples, (d) => d.elevationDeg) ?? -5);
      const maxEl = Math.max(15, d3.max(samples, (d) => Math.max(d.elevationDeg, d.terrainMaskDeg)) ?? 15);

      const yScale = d3.scaleLinear().domain([minEl, maxEl]).range([innerHeight, 0]);

      const yAxis = d3.axisLeft(yScale).ticks(5).tickFormat((d) => `${d}°`);

      g.append('g')
        .call(yAxis)
        .call((axis) => {
          axis.select('.domain').attr('stroke', '#334155');
          axis.selectAll('.tick line').attr('stroke', '#1e293b');
          axis.selectAll('.tick text').attr('fill', '#94a3b8').attr('font-size', '9.5px').attr('font-family', 'monospace');
        });

      if (yScale(0) >= 0 && yScale(0) <= innerHeight) {
        g.append('line')
          .attr('x1', 0)
          .attr('x2', innerWidth)
          .attr('y1', yScale(0))
          .attr('y2', yScale(0))
          .attr('stroke', '#64748b')
          .attr('stroke-width', 1)
          .attr('stroke-dasharray', '3 3')
          .attr('opacity', 0.6);

        g.append('text')
          .attr('x', innerWidth - 4)
          .attr('y', yScale(0) - 3)
          .attr('text-anchor', 'end')
          .attr('fill', '#64748b')
          .attr('font-size', '9px')
          .attr('font-family', 'monospace')
          .text('0° Geometric Horizon');
      }

      const terrainArea = d3
        .area()
        .x((d) => xScale(d.timestamp))
        .y0(innerHeight)
        .y1((d) => yScale(Math.max(minEl, d.terrainMaskDeg)))
        .curve(d3.curveMonotoneX);

      g.append('path')
        .datum(samples)
        .attr('fill', 'rgba(239, 68, 68, 0.12)')
        .attr('d', terrainArea);

      const terrainLine = d3
        .line()
        .x((d) => xScale(d.timestamp))
        .y((d) => yScale(d.terrainMaskDeg))
        .curve(d3.curveMonotoneX);

      g.append('path')
        .datum(samples)
        .attr('fill', 'none')
        .attr('stroke', '#f43f5e')
        .attr('stroke-width', 1.2)
        .attr('stroke-dasharray', '4 3')
        .attr('d', terrainLine);

      const earthLine = d3
        .line()
        .x((d) => xScale(d.timestamp))
        .y((d) => yScale(d.elevationDeg))
        .curve(d3.curveMonotoneX);

      g.append('path')
        .datum(samples)
        .attr('fill', 'none')
        .attr('stroke', '#38bdf8')
        .attr('stroke-width', 2)
        .attr('d', earthLine);
    }

    const bisectTime = d3.bisector((d) => d.timestamp).left;

    const overlay = g
      .append('rect')
      .attr('width', innerWidth)
      .attr('height', innerHeight)
      .attr('fill', 'transparent')
      .attr('cursor', 'crosshair')
      .style('touch-action', 'pan-y');

    const hoverLine = g
      .append('line')
      .attr('class', 'dte-hover-line')
      .attr('y1', 0)
      .attr('y2', innerHeight)
      .attr('stroke', '#38bdf8')
      .attr('stroke-width', 1)
      .attr('stroke-dasharray', '2 2')
      .style('pointer-events', 'none')
      .style('opacity', 0);

    const inspectAtX = (mx) => {
      const clampedMx = Math.max(0, Math.min(innerWidth, mx));
      const hoveredDate = xScale.invert(clampedMx).getTime();
      const index = bisectTime(samples, hoveredDate, 1);
      const d0 = samples[index - 1];
      const d1 = samples[index];
      const d = !d1 ? d0 : hoveredDate - d0.timestamp > d1.timestamp - hoveredDate ? d1 : d0;

      if (d) {
        const clampedX = Math.max(0, Math.min(innerWidth, xScale(d.timestamp)));
        hoverLine.attr('x1', clampedX).attr('x2', clampedX).style('opacity', 1);
        setHoverData(d);
      }
    };

    const clearInspect = () => {
      hoverLine.style('opacity', 0);
      setHoverData(null);
    };

    overlay
      .on('mousemove', (event) => {
        const [mx] = d3.pointer(event, overlay.node());
        inspectAtX(mx);
      })
      .on('touchstart', (event) => {
        const touch = event.touches?.[0];
        if (!touch) return;
        const [mx] = d3.pointer(touch, overlay.node());
        inspectAtX(mx);
      }, { passive: true })
      .on('touchmove', (event) => {
        const touch = event.touches?.[0];
        if (!touch) return;
        const [mx] = d3.pointer(touch, overlay.node());
        inspectAtX(mx);
      }, { passive: true })
      .on('touchend', clearInspect)
      .on('mouseleave', clearInspect);

    g.property('__xScale', xScale);
  }, [samples, viewMode, durationDays, containerWidth]);

  useEffect(() => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);
    const g = svg.select('g');
    const hoverLine = svg.select('.dte-hover-line');
    const xScale = !g.empty() ? g.property('__xScale') : null;
    if (!hoverData || !xScale || hoverLine.empty()) {
      hoverLine.style('opacity', 0);
      return;
    }
    const clampedX = Math.max(0, Math.min(xScale.range()[1] ?? 0, xScale(hoverData.timestamp)));
    hoverLine.attr('x1', clampedX).attr('x2', clampedX).style('opacity', 1);
  }, [hoverData]);

  return (
    <div className="space-y-3.5">
      <div className="p-3.5 rounded-2xl bg-[#0C0D12] border border-slate-800/80 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div>
            <div className="flex items-center gap-1.5 text-xs font-mono font-semibold text-white">
              <Radio className="w-4 h-4 text-emerald-400" />
              <span>Direct-to-Earth (DTE) Availability Analysis</span>
            </div>
            <p className="text-[11px] font-mono text-slate-400 mt-0.5">
              NASA LOLA South Pole DEM line of sight & topocentric Earth libration tracking
            </p>
          </div>

          <div className="flex items-center gap-1 bg-slate-900/90 p-1 rounded-xl border border-slate-800 self-start sm:self-auto">
            {[7, 14, 30, 60].map((days) => (
              <button
                key={days}
                type="button"
                aria-pressed={durationDays === days}
                onClick={() => setDurationDays(days)}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-mono transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/50 ${
                  durationDays === days
                    ? 'bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/40'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {days}d
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2 pt-1 border-t border-slate-800/60 text-xs font-mono">
          <div>
            <label htmlFor="dte-chart-endpoint-select" className="text-[10px] text-slate-400 block mb-1">
              Target Endpoint
            </label>
            <select
              id="dte-chart-endpoint-select"
              value={selectedStationId}
              onChange={(e) => handleStationChange(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-slate-200 focus:outline-none focus:border-cyan-500 focus-visible:ring-2 focus-visible:ring-cyan-400/50"
            >
              <option value="all">Earth Center (Geometric Mean)</option>
              {EARTH_COMMUNICATION_SITES.map((st) => (
                <option key={st.id} value={st.id}>
                  {st.name} ({st.agency})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label htmlFor="dte-chart-relay-select" className="text-[10px] text-slate-400 block mb-1">
                Orbital Relay
              </label>
              <select
                id="dte-chart-relay-select"
                value={relayType}
                onChange={(e) => setRelayType(e.target.value)}
                className="w-full px-2 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-slate-200 focus:outline-none focus:border-cyan-500 focus-visible:ring-2 focus-visible:ring-cyan-400/50 truncate"
              >
                <option value="none">DTE Only (No Relay)</option>
                <option value="lro">NASA LRO (50km Polar)</option>
                <option value="eml2_halo">Artemis EML-2 Halo</option>
              </select>
            </div>

            <div>
              <span className="text-[10px] text-slate-400 block mb-1">Graph Format</span>
              <div className="grid grid-cols-2 gap-1">
                <button
                  type="button"
                  aria-pressed={viewMode === 'timeline'}
                  onClick={() => setViewMode('timeline')}
                  className={`py-1.5 px-1 rounded-lg text-center text-[10.5px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/50 ${
                    viewMode === 'timeline'
                      ? 'bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/40'
                      : 'bg-slate-900/60 text-slate-400 border border-slate-800 hover:text-white'
                  }`}
                >
                  Swimlane
                </button>
                <button
                  type="button"
                  aria-pressed={viewMode === 'elevation'}
                  onClick={() => setViewMode('elevation')}
                  className={`py-1.5 px-1 rounded-lg text-center text-[10.5px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/50 ${
                    viewMode === 'elevation'
                      ? 'bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/40'
                      : 'bg-slate-900/60 text-slate-400 border border-slate-800 hover:text-white'
                  }`}
                >
                  LOS Angles
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div
        ref={containerRef}
        className="p-3 rounded-2xl bg-[#0C0D12] border border-slate-800/80 relative space-y-2"
      >
        <div className="flex items-center justify-between text-[11px] font-mono px-1">
          <span className="text-slate-400">
            {durationDays}-Day Telemetry Availability · Epoch: {new Date(currentMs).toUTCString().slice(5, 16)}
          </span>
          {isComputing && (
            <span className="text-cyan-400 animate-pulse text-[10px]">
              Computing NASA DEM ray-march...
            </span>
          )}
        </div>

        <div className="w-full relative min-h-[140px] flex items-center justify-center">
          {isComputing && samples.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-xs font-mono text-cyan-400 gap-2">
              <RefreshCw className="w-5 h-5 animate-spin text-cyan-400" />
              <span>Computing line-of-sight &amp; DSN visibility...</span>
            </div>
          ) : (
            <svg
              ref={svgRef}
              tabIndex={samples.length > 0 ? 0 : undefined}
              role="img"
              aria-label={`${durationDays}-day Direct-to-Earth telemetry chart. Use Left and Right arrow keys to inspect timestamps.`}
              onKeyDown={(e) => {
                if (samples.length === 0) return;
                if (e.key === 'Escape') {
                  setHoverData(null);
                  return;
                }
                if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
                e.preventDefault();
                const currentIdx = hoverData
                  ? samples.findIndex((s) => s.timestamp === hoverData.timestamp)
                  : -1;
                const step = Math.max(1, Math.floor(samples.length / 24));
                let nextIdx;
                if (e.key === 'ArrowRight') {
                  nextIdx = currentIdx < 0 ? 0 : Math.min(samples.length - 1, currentIdx + step);
                } else {
                  nextIdx = currentIdx < 0 ? samples.length - 1 : Math.max(0, currentIdx - step);
                }
                setHoverData(samples[nextIdx]);
              }}
              onBlur={() => setHoverData(null)}
              className="w-full h-auto block select-none overflow-visible rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/50"
            />
          )}
        </div>

        {!hasDemCoverage && (
          <div className="flex items-start gap-2 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[11px] font-mono">
            <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400 mt-0.5" />
            <div>
              <span className="font-semibold text-amber-200">Analytical 0.0° Horizon:</span>{' '}
              Selected location ({moonLat.toFixed(2)}°, {moonLon.toFixed(2)}°) is outside the LOLA South Pole DEM (80°S–90°S). Line-of-sight geometry, Earth libration, and DSN ground station tracking are fully modeled using the lunar mean sphere without local crater rim relief.
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800/60 text-[10px] font-mono text-slate-300">
          <div className="flex flex-wrap items-center gap-4">
            {viewMode === 'timeline' ? (
              <>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500" />
                  <span>DTE Available ({stats?.totalAvailableHours || 0} hrs)</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm bg-amber-500" />
                  <span>Marginal Grazing</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm bg-rose-500" />
                  <span>Blocked / Below Mask ({stats?.totalBlackoutHours || 0} hrs)</span>
                </span>
                {relayType !== 'none' && (
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-sm bg-blue-500" />
                    <span>Relay Active ({stats?.relayAvailableHours || 0} hrs)</span>
                  </span>
                )}
              </>
            ) : (
              <>
                <span className="flex items-center gap-1.5">
                  <span className="w-3.5 h-0.5 bg-sky-400" />
                  <span>Earth Elevation (°)</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3.5 border-t-2 border-dashed border-rose-500" />
                  <span>Terrain Ridge Mask (°)</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3.5 border-t border-dashed border-slate-500" />
                  <span>0° Geometric Horizon</span>
                </span>
              </>
            )}
            {!hasDemCoverage && (
              <span className="flex items-center gap-1 text-amber-400">
                <AlertTriangle className="w-3 h-3 text-amber-400" />
                <span>Analytical 0° Horizon (No Polar DEM)</span>
              </span>
            )}
          </div>

          <span className="text-slate-500">Hover, touch, or ← / → keys to inspect</span>
        </div>

        {hoverData && (
          <div className="p-2.5 rounded-xl bg-slate-950/95 border border-cyan-500/40 text-xs font-mono grid grid-cols-2 gap-2 animate-in fade-in duration-100">
            <div>
              <span className="text-[10px] text-slate-400 block uppercase">Timestamp</span>
              <span className="font-semibold text-white">{formatUTC(hoverData.timestamp)}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 block uppercase">Calculated Status</span>
              <span
                className={`font-bold ${
                  hoverData.status === 'clear'
                    ? 'text-emerald-400'
                    : hoverData.status === 'relay'
                    ? 'text-blue-400'
                    : hoverData.status === 'doubtful'
                    ? 'text-amber-400'
                    : 'text-rose-400'
                }`}
              >
                {hoverData.status === 'clear'
                  ? '● DTE Clear LOS'
                  : hoverData.status === 'relay'
                  ? '◆ Relay-Assisted'
                  : hoverData.status === 'doubtful'
                  ? '▲ Marginal Grazing'
                  : '✕ Occluded'}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 block uppercase">Earth Look Angle</span>
              <span className="text-slate-200">
                {hoverData.elevationDeg.toFixed(2)}° el · {hoverData.azimuthDeg.toFixed(1)}° az
              </span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 block uppercase">Terrain Margin</span>
              <span
                className={`font-semibold ${
                  hoverData.marginDeg >= 0 ? 'text-emerald-300' : 'text-rose-300'
                }`}
              >
                {hoverData.hasDemCoverage ? (
                  <>
                    {hoverData.marginDeg >= 0 ? '+' : ''}
                    {hoverData.marginDeg.toFixed(2)}° (Ridge {hoverData.terrainMaskDeg.toFixed(1)}°)
                  </>
                ) : (
                  <>
                    {hoverData.marginDeg >= 0 ? '+' : ''}
                    {hoverData.marginDeg.toFixed(2)}° (0.0° Flat Horizon)
                  </>
                )}
              </span>
            </div>
          </div>
        )}
      </div>

      {stats && (
        <div className="p-3.5 rounded-2xl bg-[#0C0D12] border border-slate-800/80 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-semibold uppercase text-slate-300 tracking-wider">
              Calculated Telemetry Metrics ({durationDays} Days)
            </span>
            <span className="text-[10px] font-mono text-cyan-400">
              {stats.directAvailabilityPct}% DTE Availability
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 font-mono text-xs">
            <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800">
              <span className="text-[10px] text-slate-400 block">Total DTE Access</span>
              <span className="text-base font-bold text-emerald-400 tabular-nums">
                {stats.totalAvailableHours} hrs
              </span>
              <span className="text-[9.5px] text-slate-500 block">
                {stats.windowCount} contact windows
              </span>
            </div>

            <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800">
              <span className="text-[10px] text-slate-400 block">Total Blackout</span>
              <span className="text-base font-bold text-rose-400 tabular-nums">
                {stats.totalBlackoutHours} hrs
              </span>
              <span className="text-[9.5px] text-slate-500 block">
                Terrain or body blockage
              </span>
            </div>

            <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800">
              <span className="text-[10px] text-slate-400 block">Longest Blackout</span>
              <span className="text-base font-bold text-amber-400 tabular-nums">
                {stats.longestBlackoutHours} hrs
              </span>
              <span className="text-[9.5px] text-slate-500 block">
                Max continuous outage
              </span>
            </div>

            <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800">
              <span className="text-[10px] text-slate-400 block">Next Window</span>
              <span className="text-xs font-bold text-cyan-300 tabular-nums block mt-0.5 leading-snug">
                {stats.nextWindow
                  ? formatUTC(stats.nextWindow.startMs)
                  : 'No lock in window'}
              </span>
              <span className="text-[9.5px] text-slate-500 block">
                {stats.nextWindow ? `Duration: ${stats.nextWindow.durationHours} hrs` : 'Continuous shadow'}
              </span>
            </div>
          </div>

          <div className="p-2 rounded-xl bg-slate-900/40 border border-slate-800 flex items-center gap-2 text-xs font-mono">
            {stats.isTerrainLimited ? (
              <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" />
            ) : (
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            )}
            <div className="min-w-0">
              <span className="text-slate-300 font-semibold">Terrain Obstruction Status: </span>
              <span className="text-slate-400">{stats.terrainObstructionStatus}</span>
            </div>
          </div>
        </div>
      )}

      <div className="rounded-2xl bg-[#0C0D12] border border-slate-800/80 overflow-hidden">
        <button
          type="button"
          aria-expanded={isProvenanceOpen}
          aria-controls="dte-provenance-panel"
          onClick={() => setIsProvenanceOpen(!isProvenanceOpen)}
          className="w-full p-3 flex items-center justify-between text-left hover:bg-slate-800/30 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/50 rounded-t-2xl"
        >
          <div className="flex items-center gap-2 text-xs font-mono font-semibold text-slate-200">
            <Info className="w-3.5 h-3.5 text-cyan-400" />
            <span>NASA Data Sources, Provenance &amp; Scientific Methodology</span>
          </div>
          {isProvenanceOpen ? (
            <ChevronUp className="w-4 h-4 text-slate-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-slate-400" />
          )}
        </button>

        {isProvenanceOpen && (
          <div
            id="dte-provenance-panel"
            className="p-3.5 border-t border-slate-800/80 space-y-3 text-xs font-mono text-slate-300"
          >
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Every displayed measurement is derived from authentic NASA mission datasets and orbital geometry physics.
              Calculations strictly prohibit artificial signal synthesis or fabricated dBm values.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              <div className="p-2.5 rounded-xl bg-slate-900/70 border border-slate-800 space-y-1">
                <span className="text-[10px] text-cyan-400 uppercase font-bold block">
                  1. NASA LOLA Polar Elevation Model
                </span>
                <p className="text-[11px] text-slate-200 font-medium">
                  {COMMUNICATION_DATA_SOURCES.LOLA_DEM.product}
                </p>
                <p className="text-[10px] text-slate-400">
                  Datum: {COMMUNICATION_DATA_SOURCES.LOLA_DEM.verticalDatum} · Vertical Accuracy: {COMMUNICATION_DATA_SOURCES.LOLA_DEM.verticalAccuracy}
                </p>
              </div>

              <div className="p-2.5 rounded-xl bg-slate-900/70 border border-slate-800 space-y-1">
                <span className="text-[10px] text-emerald-400 uppercase font-bold block">
                  2. NAIF SPICE Reference Frames
                </span>
                <p className="text-[11px] text-slate-200 font-medium">
                  {COMMUNICATION_DATA_SOURCES.SPICE_EPHEMERIS.frame}
                </p>
                <p className="text-[10px] text-slate-400">
                  Accuracy: {COMMUNICATION_DATA_SOURCES.SPICE_EPHEMERIS.accuracy}
                </p>
              </div>

              <div className="p-2.5 rounded-xl bg-slate-900/70 border border-slate-800 space-y-1">
                <span className="text-[10px] text-amber-400 uppercase font-bold block">
                  3. NASA Deep Space Network (DSN)
                </span>
                <p className="text-[11px] text-slate-200 font-medium">
                  {COMMUNICATION_DATA_SOURCES.DSN_NETWORK.complexes}
                </p>
                <p className="text-[10px] text-slate-400">
                  Station Elevation Mask: {COMMUNICATION_DATA_SOURCES.DSN_NETWORK.elevationMask}
                </p>
              </div>

              <div className="p-2.5 rounded-xl bg-slate-900/70 border border-slate-800 space-y-1">
                <span className="text-[10px] text-purple-400 uppercase font-bold block">
                  4. LRO Radio Science Tracking Archive
                </span>
                <p className="text-[11px] text-slate-200 font-medium">
                  {COMMUNICATION_DATA_SOURCES.RADIO_SCIENCE.archive}
                </p>
                <p className="text-[10px] text-slate-400">
                  {COMMUNICATION_DATA_SOURCES.RADIO_SCIENCE.methodologyNote}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
