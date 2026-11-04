import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as d3 from 'd3';
import {
  Radio,
  Signal,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Globe2,
  Sliders,
  TrendingUp,
  Info,
} from 'lucide-react';
import { EARTH_COMMUNICATION_SITES } from '../../data/earthCommunicationSites.js';
import {
  DEFAULT_DTE_CONSTRAINTS,
  evaluateEarthLink,
  LINK_REASON_LABELS,
} from '../../utils/earthLink.js';
import { computeCelestialState } from '../../utils/lunarEphemeris.js';
import { celestialTimeStore } from '../../utils/celestialTime.js';
import { horizonAt, HORIZON_TABLE } from '../../utils/horizons.js';

const UTC_FORMAT = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'UTC',
  month: 'short',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

const formatUTC = (ms) => `${UTC_FORMAT.format(new Date(ms))} UTC`;

/**
 * Calculates physics-based received signal strength (dBm) & link margin (dB)
 * for a lunar-to-Earth communication link at time `t`.
 */
function calculateSignalMetrics(evaluateResult, rangeKm) {
  const { status, elevationDeg, stationElevationDeg } = evaluateResult;

  // Base parameters for X-Band 8.4 GHz (8400 MHz) Direct-To-Earth link
  // Free space path loss: FSPL(dB) = 20*log10(rangeKm) + 20*log10(f_MHz) + 32.45
  const fspl = 20 * Math.log10(Math.max(350000, rangeKm)) + 20 * Math.log10(8400) + 32.45; // ~222.5 to 223.4 dB
  const txPowerDbm = 40; // 10W lunar lander X-band SSPA transmitter (+40 dBm)
  const txAntennaGainDbi = 24; // High-gain lunar steerable dish (0.5m X-band HGA)
  const rxAntennaGainDbi = 68; // 34-meter DSN Beam Waveguide antenna at X-band (~68 dBi)

  // Elevation-dependent atmospheric & pointing loss on Earth
  const stEl = stationElevationDeg ?? 0;
  let atmosphericLossDb = 0.5;
  if (stEl > 0 && stEl < 20) {
    atmosphericLossDb += (20 - stEl) * 0.15; // Increased atmospheric path length at low elevation
  }

  // Base Received Power (dBm)
  let signalDbm = txPowerDbm + txAntennaGainDbi + rxAntennaGainDbi - fspl - atmosphericLossDb;

  // Apply degradation based on Link Evaluation Status
  if (status === 'blocked' || status === 'away') {
    signalDbm = -160; // Deep attenuation / loss of lock below noise floor
  } else if (status === 'station') {
    signalDbm = -148; // Below station elevation mask
  } else if (status === 'doubtful') {
    signalDbm -= 12; // Grazing terrain masking / partial disc obstruction
  }

  // Receiver noise floor sensitivity threshold (-135 dBm for 100 kbps telemetry rate)
  const sensitivityThresholdDbm = -135;
  const linkMarginDb = signalDbm - sensitivityThresholdDbm;

  return {
    signalDbm: Math.round(signalDbm * 10) / 10,
    linkMarginDb: Math.round(linkMarginDb * 10) / 10,
    fspl: Math.round(fspl * 10) / 10,
    sensitivityThresholdDbm,
  };
}

export default function DteSignalChart({
  moonFeature,
  initialStationId = 'earth-comms-nasa-goldstone',
  onStationSelect,
}) {
  const svgRef = useRef(null);
  const containerRef = useRef(null);

  const [selectedStationId, setSelectedStationId] = useState(initialStationId);
  const [metricMode, setMetricMode] = useState('signal'); // 'signal' (dBm) | 'margin' (dB) | 'elevation' (deg)
  const [hoverData, setHoverData] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentMs, setCurrentMs] = useState(() => celestialTimeStore.get().ms);

  useEffect(() => {
    const unsub = celestialTimeStore.subscribe(({ ms }) => {
      setCurrentMs(ms);
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (initialStationId) {
      setSelectedStationId(initialStationId);
    }
  }, [initialStationId]);

  const activeStation = useMemo(() => {
    return (
      EARTH_COMMUNICATION_SITES.find((s) => s.id === selectedStationId) ||
      EARTH_COMMUNICATION_SITES[0]
    );
  }, [selectedStationId]);

  const handleStationChange = (stId) => {
    setSelectedStationId(stId);
    onStationSelect?.(stId);
  };

  // Safe lunar point properties
  const moonLat = moonFeature?.latitude ?? moonFeature?.lat ?? -89.4;
  const moonLon = moonFeature?.longitude ?? moonFeature?.lon ?? 0.0;
  const moonPoint = useMemo(
    () => ({
      id: moonFeature?.id || 'moon-dte-site',
      name: moonFeature?.name || 'Lunar Target Point',
      latitude: moonLat,
      longitude: moonLon,
    }),
    [moonFeature, moonLat, moonLon]
  );

  const terrainFn = useMemo(
    () => (azimuthDeg) =>
      horizonAt(HORIZON_TABLE, moonPoint.id, azimuthDeg, moonPoint.latitude, moonPoint.longitude) ?? 0,
    [moonPoint.id, moonPoint.latitude, moonPoint.longitude]
  );

  // Compute 30-day timeline series data (~180 sample points at 4-hour intervals)
  const chartData = useMemo(() => {
    const startMs = currentMs;
    const days = 30;
    const stepHours = 4;
    const stepMs = stepHours * 3600000;
    const samplesCount = Math.round((days * 24) / stepHours);

    const points = [];

    for (let i = 0; i < samplesCount; i++) {
      const tMs = startMs + i * stepMs;
      const date = new Date(tMs);
      const state = computeCelestialState(tMs);

      const evaluation = evaluateEarthLink({
        state,
        moonFeature: moonPoint,
        earthFeature: activeStation,
        constraints: DEFAULT_DTE_CONSTRAINTS,
        terrainFn,
      });

      const metrics = calculateSignalMetrics(evaluation, state.earth.distanceKm);

      points.push({
        index: i,
        timestamp: tMs,
        date,
        status: evaluation.status,
        reason: evaluation.reason,
        elevationDeg: evaluation.elevationDeg,
        stationElevationDeg: evaluation.stationElevationDeg ?? 0,
        azimuthDeg: evaluation.azimuthDeg,
        rangeKm: state.earth.distanceKm,
        signalDbm: metrics.signalDbm,
        linkMarginDb: metrics.linkMarginDb,
        sensitivityThresholdDbm: metrics.sensitivityThresholdDbm,
      });
    }

    return points;
  }, [moonPoint, activeStation, terrainFn, currentMs]);

  // Aggregate telemetry statistics over 30 days
  const stats = useMemo(() => {
    if (!chartData || chartData.length === 0) return null;

    const clearCount = chartData.filter((d) => d.status === 'clear').length;
    const availabilityPct = Math.round((clearCount / chartData.length) * 100);

    const maxSignal = Math.max(...chartData.map((d) => d.signalDbm));
    const minSignal = Math.min(...chartData.map((d) => d.signalDbm));
    const maxMargin = Math.max(...chartData.map((d) => d.linkMarginDb));

    // Find next access window
    const firstClear = chartData.find((d) => d.status === 'clear');
    const nextAccessText = firstClear
      ? formatUTC(firstClear.timestamp)
      : 'No Lock in 30 Days';

    return {
      availabilityPct,
      maxSignal,
      minSignal,
      maxMargin,
      nextAccessText,
      totalSamples: chartData.length,
    };
  }, [chartData]);

  // D3 Chart Rendering Logic
  useEffect(() => {
    if (!svgRef.current || !chartData || chartData.length === 0) return;

    const container = containerRef.current;
    if (!container) return;

    // Clear previous SVG contents
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const containerWidth = container.clientWidth || 680;
    const containerHeight = 260;

    const margin = { top: 25, right: 30, bottom: 35, left: 50 };
    const width = containerWidth - margin.left - margin.right;
    const height = containerHeight - margin.top - margin.bottom;

    svg
      .attr('width', containerWidth)
      .attr('height', containerHeight)
      .attr('viewBox', `0 0 ${containerWidth} ${containerHeight}`);

    const g = svg
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // Define X Scale (Time)
    const xScale = d3
      .scaleTime()
      .domain(d3.extent(chartData, (d) => d.date))
      .range([0, width]);

    // Define Y Scale based on active metric mode
    let yExtent;
    let yValue;
    let yUnit;
    let thresholdValue = null;

    if (metricMode === 'signal') {
      yValue = (d) => d.signalDbm;
      yUnit = 'dBm';
      yExtent = [-165, -100];
      thresholdValue = -135; // Sensitivity threshold
    } else if (metricMode === 'margin') {
      yValue = (d) => d.linkMarginDb;
      yUnit = 'dB';
      yExtent = [-30, +25];
      thresholdValue = 0; // 0 dB margin threshold
    } else {
      yValue = (d) => d.stationElevationDeg;
      yUnit = '°';
      yExtent = [-20, +90];
      thresholdValue = 10; // 10° station mask
    }

    const yScale = d3.scaleLinear().domain(yExtent).range([height, 0]).nice();

    // Color Gradients
    const defs = svg.append('defs');

    // Area Gradient
    const areaGradient = defs
      .append('linearGradient')
      .attr('id', 'dte-signal-gradient')
      .attr('x1', '0%')
      .attr('y1', '0%')
      .attr('x2', '0%')
      .attr('y2', '100%');

    areaGradient
      .append('stop')
      .attr('offset', '0%')
      .attr('stop-color', '#88B38A')
      .attr('stop-opacity', 0.45);

    areaGradient
      .append('stop')
      .attr('offset', '60%')
      .attr('stop-color', '#E59A6D')
      .attr('stop-opacity', 0.15);

    areaGradient
      .append('stop')
      .attr('offset', '100%')
      .attr('stop-color', '#E57373')
      .attr('stop-opacity', 0.0);

    // Subtle horizontal gridlines
    const yAxisGrid = d3
      .axisLeft(yScale)
      .ticks(5)
      .tickSize(-width)
      .tickFormat('');

    g.append('g')
      .attr('class', 'grid')
      .style('stroke', '#2D2A22')
      .style('stroke-opacity', '0.5')
      .style('stroke-dasharray', '3 3')
      .call(yAxisGrid);

    // D3 Area Generator
    const area = d3
      .area()
      .x((d) => xScale(d.date))
      .y0(height)
      .y1((d) => yScale(yValue(d)))
      .curve(d3.curveMonotoneX);

    g.append('path')
      .datum(chartData)
      .attr('fill', 'url(#dte-signal-gradient)')
      .attr('d', area);

    // D3 Line Generator
    const line = d3
      .line()
      .x((d) => xScale(d.date))
      .y((d) => yScale(yValue(d)))
      .curve(d3.curveMonotoneX);

    g.append('path')
      .datum(chartData)
      .attr('fill', 'none')
      .attr('stroke', '#88B38A')
      .attr('stroke-width', 2.2)
      .attr('d', line);

    // Threshold Reference Line (if applicable)
    if (thresholdValue !== null && thresholdValue >= yExtent[0] && thresholdValue <= yExtent[1]) {
      const tY = yScale(thresholdValue);

      g.append('line')
        .attr('x1', 0)
        .attr('x2', width)
        .attr('y1', tY)
        .attr('y2', tY)
        .attr('stroke', '#E57373')
        .attr('stroke-dasharray', '4 4')
        .attr('stroke-width', 1.5)
        .attr('opacity', 0.85);

      g.append('text')
        .attr('x', width - 6)
        .attr('y', tY - 5)
        .attr('text-anchor', 'end')
        .attr('fill', '#E57373')
        .attr('font-size', '9px')
        .attr('font-family', 'monospace')
        .text(`Threshold (${thresholdValue} ${yUnit})`);
    }

    // X Axis
    const xAxis = d3
      .axisBottom(xScale)
      .ticks(6)
      .tickFormat(d3.timeFormat('%b %d'));

    g.append('g')
      .attr('transform', `translate(0,${height})`)
      .call(xAxis)
      .selectAll('text')
      .attr('fill', '#A8A193')
      .attr('font-size', '10px')
      .attr('font-family', 'monospace');

    g.selectAll('.domain, .tick line').attr('stroke', '#2D2A22');

    // Y Axis
    const yAxis = d3
      .axisLeft(yScale)
      .ticks(5)
      .tickFormat((d) => `${d} ${yUnit}`);

    g.append('g')
      .call(yAxis)
      .selectAll('text')
      .attr('fill', '#A8A193')
      .attr('font-size', '10px')
      .attr('font-family', 'monospace');

    // Interactive Hover Cursor Overlay
    const focus = g.append('g').style('display', 'none');

    // Hover vertical crosshair line
    focus
      .append('line')
      .attr('class', 'focus-line')
      .attr('y1', 0)
      .attr('y2', height)
      .attr('stroke', '#E59A6D')
      .attr('stroke-dasharray', '3 3')
      .attr('stroke-width', 1.2);

    // Hover circle marker
    focus
      .append('circle')
      .attr('r', 5)
      .attr('fill', '#E59A6D')
      .attr('stroke', '#12110D')
      .attr('stroke-width', 2);

    // Invisible transparent overlay rectangle for mouse tracking
    const bisectDate = d3.bisector((d) => d.date).left;

    g.append('rect')
      .attr('class', 'overlay')
      .attr('width', width)
      .attr('height', height)
      .attr('fill', 'none')
      .attr('pointer-events', 'all')
      .on('mouseover', () => focus.style('display', null))
      .on('mouseout', () => {
        focus.style('display', 'none');
        setHoverData(null);
      })
      .on('mousemove', function (event) {
        const [mouseX] = d3.pointer(event);
        const x0 = xScale.invert(mouseX);
        const i = bisectDate(chartData, x0, 1);
        const d0 = chartData[i - 1];
        const d1 = chartData[i];

        if (!d0) return;
        const d =
          d1 && x0 - d0.date > d1.date - x0 ? d1 : d0;

        const xPos = xScale(d.date);
        const yPos = yScale(yValue(d));

        focus.attr('transform', `translate(${xPos},${yPos})`);
        focus.select('.focus-line').attr('transform', `translate(0,${-yPos})`);

        setHoverData(d);
      });
  }, [chartData, metricMode]);

  return (
    <div className="space-y-4 font-sans text-[#F4EFE6] select-none">
      {/* Top Station Selector & Metric Mode Controls */}
      <div className="flex flex-col gap-2.5 p-3 rounded-xl bg-[#0A121E] border border-[#16283C]">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <Radio className="w-3.5 h-3.5 text-[#34D399] shrink-0" />
            <span className="text-[11px] font-bold text-[#F8FAFC] font-mono uppercase tracking-wider truncate">
              30-Day Signal &amp; Link Margin Trend
            </span>
          </div>
          <span className="text-[10px] text-[#94A3B8] font-mono truncate shrink-0">
            {activeStation.country}
          </span>
        </div>

        <div className="flex flex-col gap-2">
          {/* Earth Station Selector Dropdown */}
          <select
            value={selectedStationId}
            onChange={(e) => handleStationChange(e.target.value)}
            className="w-full h-8 px-2.5 bg-[#060B13] border border-[#16283C] rounded-lg text-[11px] font-mono text-white focus:outline-none focus:border-[#00D2C4] cursor-pointer"
          >
            {EARTH_COMMUNICATION_SITES.map((st) => (
              <option key={st.id} value={st.id}>
                {st.name} ({st.country})
              </option>
            ))}
          </select>

          {/* Metric Toggle Buttons */}
          <div className="grid grid-cols-3 gap-1 bg-[#060B13] p-1 rounded-lg border border-[#16283C]">
            <button
              type="button"
              onClick={() => setMetricMode('signal')}
              className={`px-2 py-1 rounded text-[11px] font-mono transition-colors whitespace-nowrap ${
                metricMode === 'signal'
                  ? 'bg-[#00D2C4] text-[#060B13] font-bold'
                  : 'text-[#94A3B8] hover:text-white'
              }`}
            >
              Signal (dBm)
            </button>
            <button
              type="button"
              onClick={() => setMetricMode('margin')}
              className={`px-2 py-1 rounded text-[11px] font-mono transition-colors whitespace-nowrap ${
                metricMode === 'margin'
                  ? 'bg-[#00D2C4] text-[#060B13] font-bold'
                  : 'text-[#94A3B8] hover:text-white'
              }`}
            >
              Margin (dB)
            </button>
            <button
              type="button"
              onClick={() => setMetricMode('elevation')}
              className={`px-2 py-1 rounded text-[11px] font-mono transition-colors whitespace-nowrap ${
                metricMode === 'elevation'
                  ? 'bg-[#00D2C4] text-[#060B13] font-bold'
                  : 'text-[#94A3B8] hover:text-white'
              }`}
            >
              Elevation (°)
            </button>
          </div>
        </div>
      </div>

      {/* 30-Day D3 Chart Canvas Container */}
      <div className="relative p-4 rounded-2xl bg-[#0A1220] border border-[#16283C]" ref={containerRef}>
        <div className="flex items-center justify-between pb-2">
          <span className="text-[10px] font-mono text-[#94A3B8] flex items-center flex-wrap gap-1.5">
            <span>X-Band 8.4 GHz Direct-To-Earth Signal Trend over 30 Days</span>
            <span className="inline-block whitespace-nowrap text-[#00D2C4] bg-[#00D2C4]/15 px-1.5 py-0.5 rounded border border-[#00D2C4]/30 text-[9px]">
              Illustrative RF Link Model
            </span>
          </span>
          <span className="text-[10px] font-mono text-[#88B38A] flex items-center gap-1">
            <TrendingUp className="w-3 h-3" />
            <span>Interactive D3.js Visualization</span>
          </span>
        </div>

        {/* SVG Render Target */}
        <div className="w-full h-[260px] relative">
          <svg ref={svgRef} className="w-full h-full overflow-visible" />
        </div>

        {/* Hover Inspector Tooltip Overlay */}
        {hoverData && (
          <div className="absolute top-4 right-6 p-3 rounded-xl bg-[#12110D]/95 backdrop-blur-md border border-[#E59A6D] text-xs font-mono space-y-1 shadow-xl z-20 pointer-events-none">
            <div className="text-[10px] text-[#A8A193] border-b border-[#2D2A22] pb-1 font-bold">
              {formatUTC(hoverData.timestamp)}
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-[#A8A193]">Signal Strength:</span>
              <span className="font-bold text-[#88B38A]">{hoverData.signalDbm} dBm</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-[#A8A193]">Link Margin:</span>
              <span
                className={`font-bold ${
                  hoverData.linkMarginDb >= 0 ? 'text-[#88B38A]' : 'text-[#E57373]'
                }`}
              >
                {hoverData.linkMarginDb >= 0 ? '+' : ''}
                {hoverData.linkMarginDb} dB
              </span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-[#A8A193]">Station Elevation:</span>
              <span className="font-bold text-white">
                {hoverData.stationElevationDeg.toFixed(1)}°
              </span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-[#A8A193]">Status:</span>
              <span
                className={`font-bold uppercase ${
                  hoverData.status === 'clear'
                    ? 'text-[#88B38A]'
                    : hoverData.status === 'doubtful'
                    ? 'text-[#E59A6D]'
                    : 'text-[#E57373]'
                }`}
              >
                {hoverData.status}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Summary Telemetry Metrics Grid */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3.5 rounded-2xl bg-[#181711] border border-[#2D2A22]">
            <span className="text-[10px] font-mono text-[#A8A193] block">30-Day Link Availability</span>
            <div className="font-mono text-base font-bold text-[#88B38A]">
              {stats.availabilityPct}%
            </div>
            <span className="text-[9.5px] text-[#A8A193]">Direct line-of-sight uptime</span>
          </div>

          <div className="p-3.5 rounded-2xl bg-[#181711] border border-[#2D2A22]">
            <span className="text-[10px] font-mono text-[#A8A193] block">Peak Signal Strength</span>
            <div className="font-mono text-base font-bold text-[#F4EFE6]">
              {stats.maxSignal} dBm
            </div>
            <span className="text-[9.5px] text-[#88B38A]">
              Margin +{stats.maxMargin} dB
            </span>
          </div>

          <div className="p-3.5 rounded-2xl bg-[#181711] border border-[#2D2A22]">
            <span className="text-[10px] font-mono text-[#A8A193] block">Receiver Threshold</span>
            <div className="font-mono text-base font-bold text-[#E59A6D]">
              -135 dBm
            </div>
            <span className="text-[9.5px] text-[#A8A193]">Minimum lock sensitivity</span>
          </div>

          <div className="p-3.5 rounded-2xl bg-[#181711] border border-[#2D2A22]">
            <span className="text-[10px] font-mono text-[#A8A193] block">Next Contact Window</span>
            <div className="font-mono text-xs font-bold text-[#88B38A] truncate" title={stats.nextAccessText}>
              {stats.nextAccessText}
            </div>
            <span className="text-[9.5px] text-[#A8A193]">DSN tracking acquisition</span>
          </div>
        </div>
      )}
    </div>
  );
}
