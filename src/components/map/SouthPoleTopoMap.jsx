import React, {
  useEffect,
  useRef,
  useState,
  useImperativeHandle,
  forwardRef,
  useCallback,
  useMemo,
} from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import proj4 from 'proj4';
import 'proj4leaflet';
import { contours as d3Contours } from 'd3';
import SouthPoleLegendHUD from './SouthPoleLegendHUD.jsx';
import {
  TOPO_STYLE,
  getContourIntervalForZoom,
  getGridSpacingForZoom,
  isIndexContour,
} from '../../constants/topoStyle.js';
import { calculateLunarPathDistance, calculateLunarBearing } from '../../utils/distance.js';
import { celestialTimeStore } from '../../utils/celestialTime.js';
import { computeCelestialState, solarPosition } from '../../utils/lunarEphemeris.js';
import { ensurePolarDemLoaded } from '../../utils/horizons.js';
import { CANONICAL_POLAR_LANDMARKS } from '../../data/lunarCanonicalCatalog.js';

/**
 * South Polar Stereographic on Lunar Sphere (R = 1,737,400 m)
 * Extent: [-304 km, -304 km] to [+304 km, +304 km] (80°S–90°S)
 */
const LUNAR_RADIUS_M = 1737400;
const HALF_EXTENT_M = 304000;
const MAX_PAN_EXTENT_M = 600000;
const SP_PROJ4_DEF =
  '+proj=stere +lat_0=-90 +lon_0=0 +k=1 +a=1737400 +b=1737400 +units=m +no_defs';
const LUNAR_LONLAT_DEF = '+proj=longlat +a=1737400 +b=1737400 +no_defs';

// Resolutions matching 20 m/px base pyramid (z = 0..6)
const SP_RESOLUTIONS = [1280, 640, 320, 160, 80, 40, 20];
const DEM_BINARY_URL = '/data/lola_sp_80s_int16.bin';

/**
 * Forward projection: Selenographic (lat, lon) -> Stereographic (x, y) meters
 */
export function latLonToStereographicMeters(lat, lon) {
  const [x, y] = proj4(LUNAR_LONLAT_DEF, SP_PROJ4_DEF, [lon, lat]);
  return { x, y };
}

/**
 * Inverse projection: Stereographic (x, y) meters -> Selenographic (lat, lon)
 */
export function stereographicMetersToLatLon(x, y) {
  const [lon, lat] = proj4(SP_PROJ4_DEF, LUNAR_LONLAT_DEF, [x, y]);
  return { lat, lon };
}

/**
 * Computes symmetric stereographic corner coordinates in selenographic (lat, lon)
 * so Leaflet's projected pixel maxBounds spans [-extentM, +extentM] across all 4 quadrants.
 */
export function getPolarStereographicPanBounds(extentM = MAX_PAN_EXTENT_M) {
  const sw = stereographicMetersToLatLon(-extentM, -extentM);
  const ne = stereographicMetersToLatLon(extentM, extentM);
  return { sw, ne, extentM };
}

/**
 * Prominent NASA SVS 5127 Lunar South Pole Features & Craters (80°S - 90°S)
 * https://svs.gsfc.nasa.gov/5127/
 */
export const SOUTH_POLE_LANDMARKS = CANONICAL_POLAR_LANDMARKS;

/**
 * Named NASA LOLA Polar Cold-Trap Anchor Labels (footprints loaded from /data/topo/psr_footprints.geojson)
 */
const PSR_COLD_TRAP_ANCHORS = [
  { id: 'psr-shackleton', name: 'Shackleton PSR', lat: -89.67, lon: 129.78 },
  { id: 'psr-haworth', name: 'Haworth PSR', lat: -87.45, lon: -4.0 },
  { id: 'psr-shoemaker', name: 'Shoemaker PSR', lat: -88.1, lon: 45.0 },
  { id: 'psr-cabeus', name: 'Cabeus LCROSS PSR', lat: -84.9, lon: -35.5 },
  { id: 'psr-faustini', name: 'Faustini PSR', lat: -87.3, lon: 77.0 },
  { id: 'psr-degerlache', name: 'De Gerlache PSR', lat: -88.5, lon: -87.1 },
  { id: 'psr-sverdrup', name: 'Sverdrup PSR', lat: -88.3, lon: -152.0 },
  { id: 'psr-slater', name: 'Slater PSR', lat: -88.1, lon: 111.0 },
  { id: 'psr-amundsen-floor', name: 'Amundsen Floor PSR', lat: -84.1, lon: 83.2 },
];

function boxesOverlap(a, b) {
  return !(
    a.right < b.left ||
    a.left > b.right ||
    a.bottom < b.top ||
    a.top > b.bottom
  );
}

/**
 * SouthPoleTopoMap
 * NASA SVS 5127 "Lunar South Pole Terrain in Coded Color" Topographical Map.
 * Backed by Web Worker decoding of NASA LOLA 16-bit DEM data, directional shaded relief,
 * dynamic contour line overlays, and real-time altimetry probing.
 */
const SouthPoleTopoMap = forwardRef(function SouthPoleTopoMap(
  {
    onPointerCoordinates,
    onFeatureSelect,
    selectedFeature,
    isVisible = true,
    isLayersOpen = false,
    onToggleLayers,
    onCloseLayers,
    onMeasurementChange,
    onOutOfDemBounds,
    onSwitchTo3D,
  },
  ref
) {
  const mapContainerRef = useRef(null);
  const overlayCanvasRef = useRef(null);
  const leafletMapRef = useRef(null);
  const gridLayerRef = useRef(null);
  const workerRef = useRef(null);
  const pendingTilesRef = useRef(new Map());
  const probeCallbackRef = useRef(null);

  // Measurement State & Refs
  const [isMeasuring, setIsMeasuring] = useState(false);
  const [measureNodes, setMeasureNodes] = useState([]);
  const isMeasuringRef = useRef(false);
  const measureNodesRef = useRef([]);

  // Map & Layer Toggles + 9-Layer Scientific Raster Mode
  const [zoomLevel, setZoomLevel] = useState(1);
  const [activeRenderMode, setActiveRenderMode] = useState('svs-5127');
  const activeRenderModeRef = useRef('svs-5127');
  const [rasterOpacity, setRasterOpacity] = useState(1.0);
  const [showContours, setShowContours] = useState(true);
  const [showSlopeHazard, setShowSlopeHazard] = useState(true);
  const showSlopeHazardRef = useRef(true);
  const [showTraverses, setShowTraverses] = useState(true);
  const [showRidges, setShowRidges] = useState(true);
  const [showPsrs, setShowPsrs] = useState(true);
  const [showDsnLink, setShowDsnLink] = useState(true);
  const [showLandmarks, setShowLandmarks] = useState(true);
  const [subEarthLonDeg, setSubEarthLonDeg] = useState(0);
  const celestialAnglesRef = useRef({
    sunAzimuthDeg: 315,
    sunElevationDeg: 1.5,
    subSunLonDeg: 315,
    subSunLatDeg: -1.5,
    subEarthLonDeg: 0,
    subEarthLatDeg: -6.5,
  });
  const contourCacheRef = useRef(new Map());
  const rafDrawRef = useRef(null);
  const lastHoverTimeRef = useRef(0);

  // Altimetry Probe & Feature Selection
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [probedPin, setProbedPin] = useState(null);
  const [hoveredLandmarkId, setHoveredLandmarkId] = useState(null);

  // In-memory smoothed contour grid computed from DEM
  const [contourGridData, setContourGridData] = useState(null);

  // Static Auxiliary Layers (Traverses, Ridges, DEM-Derived PSR Polygons)
  const [plannedTraverses, setPlannedTraverses] = useState(null);
  const [ridgesAndRims, setRidgesAndRims] = useState(null);
  const [psrFootprints, setPsrFootprints] = useState(null);

  // Preload polar DEM for main-thread 360° horizon ray-marching & subscribe to live Sub-Earth and Sub-Solar selenographic vectors
  useEffect(() => {
    ensurePolarDemLoaded().catch(() => {});
    let redrawTimer = null;
    const syncCelestial = (s) => {
      const ms = s?.ms ?? Date.now();
      const state = computeCelestialState(ms);
      const sLon = state?.sun?.subLon ?? s?.sun?.subLon ?? 315;
      const sLat = state?.sun?.subLat ?? s?.sun?.subLat ?? -1.5;
      const eLon = state?.earth?.subLon ?? s?.earth?.subLon ?? 0;
      const eLat = state?.earth?.subLat ?? -6.5;
      setSubEarthLonDeg(eLon);
      celestialAnglesRef.current = {
        // In South Polar Stereographic (+Y = 0°E, +X = 90°E), planar solar azimuth clockwise from +Y is subSunLonDeg
        sunAzimuthDeg: sLon,
        sunElevationDeg: -sLat,
        subSunLonDeg: sLon,
        subSunLatDeg: sLat,
        subEarthLonDeg: eLon,
        subEarthLatDeg: eLat,
      };
      const mode = activeRenderModeRef.current;
      if (
        gridLayerRef.current &&
        (mode === 'illumination' ||
          mode === 'psr' ||
          mode === 'earth-visibility' ||
          mode === 'risk')
      ) {
        if (redrawTimer) clearTimeout(redrawTimer);
        redrawTimer = setTimeout(() => {
          gridLayerRef.current?.redraw();
        }, 120);
      }
    };
    syncCelestial(celestialTimeStore.get());
    const unsub = celestialTimeStore.subscribe(syncCelestial);
    return () => {
      if (redrawTimer) clearTimeout(redrawTimer);
      unsub();
    };
  }, []);

  useEffect(() => {
    showSlopeHazardRef.current = showSlopeHazard;
    if (gridLayerRef.current) {
      gridLayerRef.current.redraw();
    }
  }, [showSlopeHazard]);

  useEffect(() => {
    activeRenderModeRef.current = activeRenderMode;
    if (gridLayerRef.current) {
      gridLayerRef.current.redraw();
    }
  }, [activeRenderMode]);

  useEffect(() => {
    if (gridLayerRef.current) {
      gridLayerRef.current.setOpacity(rasterOpacity);
    }
  }, [rasterOpacity]);

  useEffect(() => {
    if (!selectedFeature) {
      setProbedPin(null);
      setSelectedLocation(null);
    } else if (selectedFeature.latitude != null && selectedFeature.longitude != null) {
      setSelectedLocation({
        lat: selectedFeature.latitude,
        lon: selectedFeature.longitude,
        elevation: selectedFeature.elevationMeters ?? null,
        slope: null,
        name: selectedFeature.name || 'Selected Site',
        isOutOfDemBounds: selectedFeature.latitude > -79.9,
      });
      if (selectedFeature.isCustomPin || selectedFeature.type === 'custom_pin') {
        setProbedPin({
          lat: selectedFeature.latitude,
          lon: selectedFeature.longitude,
          elevation: selectedFeature.elevationMeters ?? null,
          slope: selectedFeature.slopeDeg ?? null,
        });
      }
    }
  }, [selectedFeature]);

  // Active intervals by zoom
  const currentIntervalEntry = useMemo(
    () => getContourIntervalForZoom(zoomLevel),
    [zoomLevel]
  );
  const currentGridEntry = useMemo(
    () => getGridSpacingForZoom(zoomLevel),
    [zoomLevel]
  );

  // Load auxiliary traverses, ridges, and DEM-derived PSR footprints once
  useEffect(() => {
    fetch('/data/topo/planned_traverses.geojson')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => data && setPlannedTraverses(data))
      .catch(() => {});

    fetch('/data/topo/ridges_and_rims.geojson')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => data && setRidgesAndRims(data))
      .catch(() => {});

    fetch('/data/topo/psr_footprints.geojson')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => data && setPsrFootprints(data))
      .catch(() => {});
  }, []);

  // Precompute & cache d3-contour geometries from the smoothed elevation grid (capped at >=200m so zoom never blocks)
  const computedContours = useMemo(() => {
    if (!contourGridData || !showContours) return [];
    const { gridSize, values } = contourGridData;

    const interval = Math.max(200, currentIntervalEntry.intervalM);
    const indexStep = interval * 5;

    if (contourCacheRef.current.has(interval)) {
      return contourCacheRef.current.get(interval);
    }

    const thresholds = [];
    for (let elev = -6000; elev <= 6000; elev += interval) {
      thresholds.push(elev);
    }

    const generator = d3Contours()
      .size([gridSize, gridSize])
      .smooth(true)
      .thresholds(thresholds);

    const geometries = generator(values);

    const result = geometries.map((geom) => ({
      value: geom.value,
      isIndex: Math.abs(geom.value % indexStep) < 1e-3,
      coordinates: geom.coordinates,
    }));
    contourCacheRef.current.set(interval, result);
    return result;
  }, [contourGridData, currentIntervalEntry.intervalM, showContours]);

  // Initialize Web Worker for Background Tile Rendering & Altimetry Probing
  useEffect(() => {
    const worker = new Worker(
      new URL('../../workers/lolaTileWorker.js', import.meta.url),
      { type: 'module' }
    );
    workerRef.current = worker;

    worker.onmessage = (event) => {
      const { type, payload } = event.data;

      if (type === 'DEM_READY') {
        // Request smoothed contour grid (240x240) once DEM is in memory
        worker.postMessage({
          type: 'EXTRACT_CONTOUR_GRID',
          payload: { gridSize: 240, demUrl: DEM_BINARY_URL },
        });
        return;
      }

      if (type === 'TILE_RENDERED') {
        const { tileKey, tileSize, rgbaBuffer } = payload;
        const entry = pendingTilesRef.current.get(tileKey);
        if (entry) {
          pendingTilesRef.current.delete(tileKey);
          const { canvas, done } = entry;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            const imgData = new ImageData(
              new Uint8ClampedArray(rgbaBuffer),
              tileSize,
              tileSize
            );
            ctx.putImageData(imgData, 0, 0);
          }
          done(null, canvas);
        }
        return;
      }

      if (type === 'CONTOUR_GRID_READY') {
        const { gridSize, cellM, halfExtentM, valuesBuffer } = payload;
        setContourGridData({
          gridSize,
          cellM,
          halfExtentM,
          values: new Float32Array(valuesBuffer),
        });
        return;
      }

      if (type === 'PROBE_RESULT') {
        if (probeCallbackRef.current) {
          probeCallbackRef.current(payload);
          probeCallbackRef.current = null;
        }
        return;
      }

      if (type === 'WORKER_ERROR') {
        console.error('[LOLA WORKER ERROR]', payload.message);
      }
    };

    worker.postMessage({
      type: 'INIT_DEM',
      payload: { demUrl: DEM_BINARY_URL },
    });

    return () => {
      worker.terminate();
      workerRef.current = null;
    };
  }, []);

  // Synchronized Vector Canvas Renderer
  const drawOverlayCanvas = useCallback(() => {
    const map = leafletMapRef.current;
    const canvas = overlayCanvasRef.current;
    if (!map || !map._loaded || !map._mapPane || !canvas) return;

    const size = map.getSize();
    if (!size || size.x <= 0 || size.y <= 0) return;
    const dpr = window.devicePixelRatio || 1;
    if (canvas.width !== size.x * dpr || canvas.height !== size.y * dpr) {
      canvas.width = size.x * dpr;
      canvas.height = size.y * dpr;
      canvas.style.width = `${size.x}px`;
      canvas.style.height = `${size.y}px`;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, size.x, size.y);

    // O(1) linear affine transformation from South Polar Stereographic meters (xM, yM) to screen pixels
    const polePx = map.latLngToContainerPoint(L.latLng(-90, 0));
    const refXLatLon = stereographicMetersToLatLon(100000, 0);
    const refYLatLon = stereographicMetersToLatLon(0, 100000);
    const refXPx = map.latLngToContainerPoint(L.latLng(refXLatLon.lat, refXLatLon.lon));
    const refYPx = map.latLngToContainerPoint(L.latLng(refYLatLon.lat, refYLatLon.lon));
    const scaleX = (refXPx.x - polePx.x) / 100000;
    const scaleY = (refYPx.y - polePx.y) / 100000;

    const metersToPx = (xM, yM) => ({
      x: polePx.x + xM * scaleX,
      y: polePx.y + yM * scaleY,
    });

    const latLonToPx = (lat, lon) => {
      const { x, y } = latLonToStereographicMeters(lat, lon);
      return {
        x: polePx.x + x * scaleX,
        y: polePx.y + y * scaleY,
      };
    };

    const currentZoom = map.getZoom();

    // 1. RECTILINEAR POLAR-STEREOGRAPHIC GRID (adaptive by zoom)
    const gridSpacing = currentGridEntry.spacingM;
    ctx.save();
    ctx.strokeStyle = TOPO_STYLE.canvas.gridColor;
    ctx.lineWidth = TOPO_STYLE.canvas.gridWidth;
    ctx.setLineDash([3, 5]);

    for (let x = -HALF_EXTENT_M; x <= HALF_EXTENT_M; x += gridSpacing) {
      const pTop = metersToPx(x, HALF_EXTENT_M);
      const pBottom = metersToPx(x, -HALF_EXTENT_M);
      ctx.beginPath();
      ctx.moveTo(pTop.x, pTop.y);
      ctx.lineTo(pBottom.x, pBottom.y);
      ctx.stroke();

      if (pTop.y >= 0 && pTop.y <= size.y) {
        ctx.fillStyle = TOPO_STYLE.canvas.gridLabelColor;
        ctx.font = TOPO_STYLE.canvas.gridLabelFont;
        ctx.textAlign = 'center';
        const labelText = `${x > 0 ? '+' : ''}${Math.round(x / 1000)}k`;
        ctx.fillText(labelText, pTop.x, Math.max(16, pTop.y));
      }
    }

    for (let y = -HALF_EXTENT_M; y <= HALF_EXTENT_M; y += gridSpacing) {
      const pLeft = metersToPx(-HALF_EXTENT_M, y);
      const pRight = metersToPx(HALF_EXTENT_M, y);
      ctx.beginPath();
      ctx.moveTo(pLeft.x, pLeft.y);
      ctx.lineTo(pRight.x, pRight.y);
      ctx.stroke();

      if (pLeft.x >= 0 && pLeft.x <= size.x) {
        ctx.fillStyle = TOPO_STYLE.canvas.gridLabelColor;
        ctx.font = TOPO_STYLE.canvas.gridLabelFont;
        ctx.textAlign = 'left';
        const labelText = `${y > 0 ? '+' : ''}${Math.round(y / 1000)}k`;
        ctx.fillText(labelText, Math.max(8, pLeft.x + 4), pLeft.y - 3);
      }
    }
    ctx.restore();

    // 2. CONTOURS (Vector Elevation Lines from Smoothed DEM Grid)
    if (showContours && contourGridData && computedContours.length > 0) {
      const { gridSize, halfExtentM } = contourGridData;
      const cellM = (halfExtentM * 2) / gridSize;
      const indexLabelsToPlace = [];

      for (const layer of computedContours) {
        ctx.save();
        ctx.beginPath();
        ctx.strokeStyle = layer.isIndex
          ? 'rgba(255, 255, 255, 0.70)'
          : 'rgba(255, 255, 255, 0.24)';
        ctx.lineWidth = layer.isIndex ? 1.3 : 0.65;

        for (const polygon of layer.coordinates) {
          for (const ring of polygon) {
            if (ring.length < 3) continue;
            for (let i = 0; i < ring.length; i++) {
              const [gx, gy] = ring[i];
              const xM = -halfExtentM + gx * cellM;
              const yM = halfExtentM - gy * cellM;
              const pt = metersToPx(xM, yM);
              if (i === 0) ctx.moveTo(pt.x, pt.y);
              else ctx.lineTo(pt.x, pt.y);
            }

            // Index Contour Label sampling
            if (layer.isIndex && ring.length >= 16 && currentZoom >= 1) {
              const midIdx = Math.floor(ring.length / 2);
              const pA = metersToPx(
                -halfExtentM + ring[midIdx - 1][0] * cellM,
                halfExtentM - ring[midIdx - 1][1] * cellM
              );
              const pB = metersToPx(
                -halfExtentM + ring[midIdx + 1][0] * cellM,
                halfExtentM - ring[midIdx + 1][1] * cellM
              );
              const pMid = metersToPx(
                -halfExtentM + ring[midIdx][0] * cellM,
                halfExtentM - ring[midIdx][1] * cellM
              );

              if (
                pMid.x > 40 &&
                pMid.x < size.x - 40 &&
                pMid.y > 40 &&
                pMid.y < size.y - 40
              ) {
                let angle = Math.atan2(pB.y - pA.y, pB.x - pA.x);
                if (angle > Math.PI / 2) angle -= Math.PI;
                else if (angle < -Math.PI / 2) angle += Math.PI;

                indexLabelsToPlace.push({
                  x: pMid.x,
                  y: pMid.y,
                  angle,
                  text: `${layer.value > 0 ? '+' : ''}${Math.round(layer.value)}m`,
                });
              }
            }
          }
        }
        ctx.stroke();
        ctx.restore();
      }

      // Draw Index Contour Labels with Dark Halo
      ctx.save();
      ctx.font = 'bold 9px "Space Mono", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const placedLabelPts = [];

      for (const item of indexLabelsToPlace) {
        if (placedLabelPts.some((p) => Math.hypot(p.x - item.x, p.y - item.y) < 80)) {
          continue;
        }
        placedLabelPts.push(item);

        ctx.save();
        ctx.translate(item.x, item.y);
        ctx.rotate(item.angle);
        ctx.strokeStyle = 'rgba(4, 8, 16, 0.85)';
        ctx.lineWidth = 3.5;
        ctx.strokeText(item.text, 0, 0);
        ctx.fillStyle = '#FFFFFF';
        ctx.fillText(item.text, 0, 0);
        ctx.restore();
      }
      ctx.restore();
    }

    // 3. CANDIDATE TRAVERSE ROUTES
    if (showTraverses && plannedTraverses?.features) {
      ctx.save();
      ctx.strokeStyle = TOPO_STYLE.canvas.traverseRouteColor;
      ctx.lineWidth = TOPO_STYLE.canvas.traverseRouteWidth;
      ctx.setLineDash(TOPO_STYLE.canvas.traverseRouteDash);

      for (const feature of plannedTraverses.features) {
        const coords = feature.geometry.coordinates;
        if (!coords || coords.length < 2) continue;
        ctx.beginPath();
        coords.forEach(([lon, lat], i) => {
          const pt = latLonToPx(lat, lon);
          if (i === 0) ctx.moveTo(pt.x, pt.y);
          else ctx.lineTo(pt.x, pt.y);
        });
        ctx.stroke();

        coords.forEach(([lon, lat], idx) => {
          const pt = latLonToPx(lat, lon);
          ctx.save();
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, idx === 0 ? 4 : 2.5, 0, Math.PI * 2);
          ctx.fillStyle = TOPO_STYLE.canvas.traverseRouteColor;
          ctx.fill();
          ctx.strokeStyle = '#FFFFFF';
          ctx.lineWidth = 1;
          ctx.stroke();

          if (idx === 0 && currentZoom >= 2) {
            ctx.font = 'bold 9px "Space Mono", monospace';
            ctx.fillStyle = TOPO_STYLE.canvas.traverseRouteColor;
            ctx.textAlign = 'left';
            ctx.fillText(feature.properties.name || 'Traverse', pt.x + 8, pt.y - 4);
          }
          ctx.restore();
        });
      }
      ctx.restore();
    }

    // 4. CRATER RIMS AND RIDGE CRESTS
    if (showRidges && ridgesAndRims?.features) {
      ctx.save();
      ctx.strokeStyle = TOPO_STYLE.canvas.ridgeRimColor;
      ctx.lineWidth = TOPO_STYLE.canvas.ridgeRimWidth;
      ctx.setLineDash(TOPO_STYLE.canvas.ridgeRimDash);

      for (const feature of ridgesAndRims.features) {
        const coords = feature.geometry.coordinates;
        if (!coords || coords.length < 2) continue;
        ctx.beginPath();
        coords.forEach(([lon, lat], i) => {
          const pt = latLonToPx(lat, lon);
          if (i === 0) ctx.moveTo(pt.x, pt.y);
          else ctx.lineTo(pt.x, pt.y);
        });
        ctx.stroke();

        if (currentZoom >= 2) {
          const midPt = latLonToPx(
            coords[Math.floor(coords.length / 2)][1],
            coords[Math.floor(coords.length / 2)][0]
          );
          ctx.save();
          ctx.font = '600 8.5px "Space Mono", monospace';
          ctx.fillStyle = '#FFFFFF';
          ctx.strokeStyle = 'rgba(0,0,0,0.8)';
          ctx.lineWidth = 2.5;
          ctx.strokeText(feature.properties.name, midPt.x, midPt.y - 6);
          ctx.fillText(feature.properties.name, midPt.x, midPt.y - 6);
          ctx.restore();
        }
      }
      ctx.restore();
    }

    // 5. PERMANENTLY SHADOWED REGIONS (LOLA 16-Azimuth Horizon Shadow PSR Polygons)
    if (showPsrs && psrFootprints?.features) {
      ctx.save();
      ctx.fillStyle = 'rgba(56, 189, 248, 0.14)';
      ctx.strokeStyle = 'rgba(125, 211, 252, 0.72)';
      ctx.lineWidth = 1.1;
      ctx.setLineDash([4, 3]);

      for (const feature of psrFootprints.features) {
        const coords = feature.geometry?.coordinates;
        if (!coords || coords.length < 3) continue;
        ctx.beginPath();
        coords.forEach(([lon, lat], idx) => {
          const pt = latLonToPx(lat, lon);
          if (idx === 0) ctx.moveTo(pt.x, pt.y);
          else ctx.lineTo(pt.x, pt.y);
        });
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }

      if (currentZoom >= 2) {
        ctx.setLineDash([]);
        ctx.font = '600 8px "Space Mono", monospace';
        ctx.textAlign = 'center';
        PSR_COLD_TRAP_ANCHORS.forEach((anchor) => {
          const pt = latLonToPx(anchor.lat, anchor.lon);
          if (pt.x > 30 && pt.x < size.x - 30 && pt.y > 30 && pt.y < size.y - 30) {
            ctx.strokeStyle = 'rgba(4, 8, 16, 0.85)';
            ctx.lineWidth = 2.5;
            ctx.strokeText(anchor.name, pt.x, pt.y);
            ctx.fillStyle = '#7DD3FC';
            ctx.fillText(anchor.name, pt.x, pt.y);
          }
        });
      }
      ctx.restore();
    }

    // 6. DYNAMIC EARTH DSN LINE-OF-SIGHT CORRIDOR (Along Instantaneous Sub-Earth Longitude)
    if (showDsnLink) {
      const originLat = selectedLocation?.lat ?? selectedFeature?.latitude ?? -90;
      const originLon = selectedLocation?.lon ?? selectedFeature?.longitude ?? 0;
      const startPt = latLonToPx(originLat, originLon);
      const earthEdgePt = latLonToPx(-80, subEarthLonDeg);
      const midPt = latLonToPx(-83.5, subEarthLonDeg);
      const lonLabel = `${Math.abs(subEarthLonDeg).toFixed(1)}°${subEarthLonDeg >= 0 ? 'E' : 'W'}`;
      ctx.save();
      ctx.strokeStyle = '#10B981';
      ctx.lineWidth = 1.8;
      ctx.setLineDash([5, 4]);
      ctx.beginPath();
      ctx.moveTo(startPt.x, startPt.y);
      ctx.lineTo(earthEdgePt.x, earthEdgePt.y);
      ctx.stroke();

      ctx.font = 'bold 9px "Space Mono", monospace';
      ctx.fillStyle = '#34D399';
      ctx.strokeStyle = 'rgba(7, 10, 16, 0.9)';
      ctx.lineWidth = 2.5;
      ctx.textAlign = 'center';
      ctx.strokeText(`EARTH DSN LOS (${lonLabel}) ▲`, midPt.x, midPt.y - 6);
      ctx.fillText(`EARTH DSN LOS (${lonLabel}) ▲`, midPt.x, midPt.y - 6);
      ctx.restore();
    }

    // 7. NASA SVS 5127 PROMINENT SITE MARKERS & LABELS
    const placedBoxes = [];
    const sortedLandmarks = showLandmarks
      ? [...SOUTH_POLE_LANDMARKS].sort((a, b) => {
          const aSel = selectedFeature?.id === a.id ? -10 : 0;
          const bSel = selectedFeature?.id === b.id ? -10 : 0;
          const aHov = hoveredLandmarkId === a.id ? -5 : 0;
          const bHov = hoveredLandmarkId === b.id ? -5 : 0;
          return a.priority + aSel + aHov - (b.priority + bSel + bHov);
        })
      : [];

    for (const lm of sortedLandmarks) {
      const pt = latLonToPx(lm.latitude, lm.longitude);
      if (pt.x < -30 || pt.x > size.x + 30 || pt.y < -30 || pt.y > size.y + 30) {
        continue;
      }

      const isSelected = selectedFeature?.id === lm.id;
      const isHovered = hoveredLandmarkId === lm.id;

      // Draw high-visibility marker dot
      const dotR = isSelected || isHovered ? 5.5 : 3.8;
      ctx.save();
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, dotR, 0, Math.PI * 2);
      ctx.fillStyle = isSelected ? '#FDE047' : isHovered ? '#EF4444' : '#00E5FF';
      ctx.fill();
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(pt.x, pt.y, dotR * 0.45, 0, Math.PI * 2);
      ctx.fillStyle = '#070A10';
      ctx.fill();
      ctx.restore();

      const shouldLabel =
        lm.priority === 1 || currentZoom >= 2 || isSelected || isHovered;
      if (!shouldLabel) continue;

      const fullText = `${lm.shortName} (${lm.elevationMeters > 0 ? '+' : ''}${lm.elevationMeters}m)`;
      ctx.font = isSelected || isHovered
        ? 'bold 10px "Space Mono", monospace'
        : '600 9px "Space Mono", monospace';

      const metrics = ctx.measureText(fullText);
      const textW = metrics.width + 8;
      const textH = 14;

      const candidates = [
        {
          x: pt.x,
          y: pt.y - 9,
          align: 'center',
          box: {
            left: pt.x - textW / 2,
            right: pt.x + textW / 2,
            top: pt.y - 9 - textH,
            bottom: pt.y - 5,
          },
        },
        {
          x: pt.x + 8,
          y: pt.y + 3,
          align: 'left',
          box: {
            left: pt.x + 6,
            right: pt.x + 6 + textW,
            top: pt.y - 8,
            bottom: pt.y + 8,
          },
        },
      ];

      let chosen = null;
      for (const cand of candidates) {
        if (!placedBoxes.some((b) => boxesOverlap(cand.box, b))) {
          chosen = cand;
          break;
        }
      }

      if (chosen || isSelected || isHovered) {
        const pos = chosen || candidates[0];
        placedBoxes.push(pos.box);

        ctx.save();
        ctx.font = isSelected || isHovered
          ? 'bold 10px "Space Mono", monospace'
          : '600 9px "Space Mono", monospace';
        ctx.textAlign = pos.align;
        ctx.strokeStyle = 'rgba(7, 10, 16, 0.92)';
        ctx.lineWidth = 3;
        ctx.strokeText(fullText, pos.x, pos.y);
        ctx.fillStyle = isSelected ? '#FDE68A' : isHovered ? '#FCA5A5' : '#FFFFFF';
        ctx.fillText(fullText, pos.x, pos.y);
        ctx.restore();
      }
    }

    // 8. PROBED ALTIMETRY PIN / CUSTOM DROPPED PIN
    const customPinToDraw = probedPin || (
      (selectedFeature?.isCustomPin || selectedFeature?.type === 'custom_pin') &&
      selectedFeature.latitude != null &&
      selectedFeature.longitude != null
        ? {
            lat: selectedFeature.latitude,
            lon: selectedFeature.longitude,
            elevation: selectedFeature.elevationMeters ?? null,
            slope: selectedFeature.slopeDeg ?? null,
          }
        : null
    );

    if (customPinToDraw && customPinToDraw.lat != null && customPinToDraw.lon != null) {
      const pt = latLonToPx(customPinToDraw.lat, customPinToDraw.lon);
      ctx.save();
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 5, 0, Math.PI * 2);
      ctx.fillStyle = '#FDE047';
      ctx.fill();
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 11, 0, Math.PI * 2);
      ctx.strokeStyle = '#FDE047';
      ctx.lineWidth = 1.2;
      ctx.stroke();

      // Custom Pin Label
      const pinLabel = selectedFeature?.name || 'Custom Dropped Pin';
      ctx.font = 'bold 9.5px "Space Mono", monospace';
      ctx.textAlign = 'left';
      ctx.strokeStyle = 'rgba(7, 10, 16, 0.92)';
      ctx.lineWidth = 3;
      ctx.strokeText(pinLabel, pt.x + 14, pt.y + 3);
      ctx.fillStyle = '#FDE68A';
      ctx.fillText(pinLabel, pt.x + 14, pt.y + 3);

      ctx.restore();
    }

    // 9. GEODESIC MEASUREMENT POLYLINE
    if (measureNodes.length > 0) {
      ctx.save();
      ctx.strokeStyle = '#00E5FF';
      ctx.lineWidth = 2.2;
      ctx.setLineDash([5, 4]);
      ctx.beginPath();
      measureNodes.forEach(([nLon, nLat], idx) => {
        const pt = latLonToPx(nLat, nLon);
        if (idx === 0) ctx.moveTo(pt.x, pt.y);
        else ctx.lineTo(pt.x, pt.y);
      });
      ctx.stroke();
      ctx.setLineDash([]);

      measureNodes.forEach(([nLon, nLat], idx) => {
        const pt = latLonToPx(nLat, nLon);
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, idx === 0 ? 5 : 4, 0, Math.PI * 2);
        ctx.fillStyle = idx === 0 ? '#10B981' : '#00E5FF';
        ctx.fill();
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.font = 'bold 9.5px "Space Mono", monospace';
        ctx.fillStyle = '#FFFFFF';
        ctx.textAlign = 'left';
        ctx.fillText(`WP${idx + 1}`, pt.x + 8, pt.y - 4);
      });
      ctx.restore();
    }

    // 10. NEATLINE BORDER, SCALE BAR & ORIENTEERING NORTH ARROW
    // (a) Neatline
    ctx.save();
    ctx.strokeStyle = TOPO_STYLE.canvas.neatlineColor;
    ctx.lineWidth = TOPO_STYLE.canvas.neatlineWidth;
    ctx.strokeRect(6, 6, size.x - 12, size.y - 12);
    ctx.restore();

    // (b) Scale Bar (bottom-right)
    const scaleBarX = size.x - 170;
    const scaleBarY = size.y - 24;
    const scaleLenMeters = currentIntervalEntry.intervalM <= 50 ? 5000 : 20000;
    const ptA = metersToPx(0, 0);
    const ptB = metersToPx(scaleLenMeters, 0);
    const scalePx = Math.max(40, Math.min(130, Math.abs(ptB.x - ptA.x)));

    ctx.save();
    ctx.fillStyle = TOPO_STYLE.canvas.scaleBarColor;
    ctx.font = TOPO_STYLE.canvas.scaleBarFont;
    ctx.textAlign = 'right';
    const scaleLabel = `${scaleLenMeters >= 1000 ? scaleLenMeters / 1000 : scaleLenMeters} ${scaleLenMeters >= 1000 ? 'km' : 'm'}`;
    ctx.fillText(`0`, scaleBarX - scalePx, scaleBarY - 5);
    ctx.fillText(scaleLabel, scaleBarX, scaleBarY - 5);

    // Alternating scale segments
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(scaleBarX - scalePx, scaleBarY, scalePx / 2, 4);
    ctx.fillStyle = '#070A10';
    ctx.fillRect(scaleBarX - scalePx / 2, scaleBarY, scalePx / 2, 4);
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 1;
    ctx.strokeRect(scaleBarX - scalePx, scaleBarY, scalePx, 4);

    ctx.font = '7.5px "Space Mono", monospace';
    ctx.fillStyle = '#94A3B8';
    ctx.fillText('NASA SVS 5127 · LOLA GDR', scaleBarX, scaleBarY + 12);
    ctx.restore();

    // (c) North Arrow (bottom-left)
    const arrowX = 36;
    const arrowY = size.y - 36;
    ctx.save();
    ctx.translate(arrowX, arrowY);
    ctx.beginPath();
    ctx.moveTo(0, -18);
    ctx.lineTo(5, 4);
    ctx.lineTo(0, 0);
    ctx.closePath();
    ctx.fillStyle = '#EF4444';
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(0, -18);
    ctx.lineTo(-5, 4);
    ctx.lineTo(0, 0);
    ctx.closePath();
    ctx.fillStyle = '#FFFFFF';
    ctx.fill();

    ctx.font = 'bold 9px "Space Mono", monospace';
    ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = 'center';
    ctx.fillText('N', 0, -22);
    ctx.font = '7px "Space Mono", monospace';
    ctx.fillStyle = '#94A3B8';
    ctx.fillText('0°E', 0, 12);
    ctx.restore();

    ctx.restore();
  }, [
    computedContours,
    contourGridData,
    currentGridEntry,
    currentIntervalEntry,
    hoveredLandmarkId,
    measureNodes,
    plannedTraverses,
    probedPin,
    psrFootprints,
    ridgesAndRims,
    selectedFeature,
    selectedLocation,
    showContours,
    showDsnLink,
    showLandmarks,
    showPsrs,
    showRidges,
    showTraverses,
    subEarthLonDeg,
  ]);

  const scheduleOverlayDraw = useCallback(() => {
    if (rafDrawRef.current) cancelAnimationFrame(rafDrawRef.current);
    rafDrawRef.current = requestAnimationFrame(() => {
      rafDrawRef.current = null;
      drawOverlayCanvas();
    });
  }, [drawOverlayCanvas]);

  // Initialize Leaflet Map with South Polar Stereographic CRS
  useEffect(() => {
    const container = mapContainerRef.current;
    if (!container || leafletMapRef.current) return;

    const southPoleCRS = new L.Proj.CRS('IAU2015:30135', SP_PROJ4_DEF, {
      origin: [-HALF_EXTENT_M, HALF_EXTENT_M],
      resolutions: SP_RESOLUTIONS,
      bounds: L.bounds(
        [-HALF_EXTENT_M, -HALF_EXTENT_M],
        [HALF_EXTENT_M, HALF_EXTENT_M]
      ),
    });

    const { sw: panSw, ne: panNe } = getPolarStereographicPanBounds(MAX_PAN_EXTENT_M);

    const map = L.map(container, {
      crs: southPoleCRS,
      center: [-90, 0],
      zoom: 1,
      minZoom: 0,
      maxZoom: 6,
      zoomControl: false,
      attributionControl: false,
      maxBounds: L.latLngBounds(
        L.latLng(panSw.lat, panSw.lon),
        L.latLng(panNe.lat, panNe.lon)
      ),
      maxBoundsViscosity: 0.7,
    });

    leafletMapRef.current = map;

    // Custom GridLayer delegating NASA SVS 5127 coded color decoding to Web Worker
    const LolaDemGridLayer = L.GridLayer.extend({
      createTile(coords, done) {
        const canvas = document.createElement('canvas');
        const size = this.getTileSize();
        canvas.width = size.x;
        canvas.height = size.y;

        const tileKey = `${coords.z}:${coords.x}:${coords.y}:${Date.now()}:${Math.random()}`;
        pendingTilesRef.current.set(tileKey, { canvas, done });

        if (workerRef.current) {
          const angles = celestialAnglesRef.current;
          workerRef.current.postMessage({
            type: 'RENDER_TILE',
            payload: {
              tileKey,
              z: coords.z,
              x: coords.x,
              y: coords.y,
              tileSize: size.x,
              renderMode: activeRenderModeRef.current,
              enableHillshade: true,
              showSlopeHazard: showSlopeHazardRef.current,
              sunAzimuthDeg: angles.sunAzimuthDeg,
              sunElevationDeg: angles.sunElevationDeg,
              subSunLonDeg: angles.subSunLonDeg,
              subSunLatDeg: angles.subSunLatDeg,
              subEarthLonDeg: angles.subEarthLonDeg,
              subEarthLatDeg: angles.subEarthLatDeg,
              demUrl: DEM_BINARY_URL,
            },
          });
        } else {
          done(null, canvas);
        }

        return canvas;
      },
    });

    const lolaLayer = new LolaDemGridLayer({
      tileSize: 256,
      minZoom: 0,
      maxZoom: 6,
      noWrap: true,
      keepBuffer: 2,
    });

    lolaLayer.addTo(map);
    gridLayerRef.current = lolaLayer;

    // Synchronize View Changes
    const handleViewChange = () => {
      setZoomLevel(map.getZoom());
      scheduleOverlayDraw();
    };

    map.on('move zoom viewreset resize', handleViewChange);

    // Track pan/drag motion to prevent trailing click from wiping or moving custom marker
    let dragStartPos = null;
    let didDrag = false;

    map.on('mousedown', (e) => {
      dragStartPos = e.containerPoint ? { x: e.containerPoint.x, y: e.containerPoint.y } : null;
      didDrag = false;
    });

    map.on('movestart dragstart', () => {
      didDrag = true;
    });

    map.on('move drag', (e) => {
      if (dragStartPos && e.containerPoint) {
        const dist = Math.hypot(
          e.containerPoint.x - dragStartPos.x,
          e.containerPoint.y - dragStartPos.y
        );
        if (dist > 5) {
          didDrag = true;
        }
      }
    });

    map.on('moveend dragend', () => {
      // Keep didDrag true briefly so any synthetic/trailing click from drag release is ignored
      setTimeout(() => {
        didDrag = false;
        dragStartPos = null;
      }, 150);
    });

    // Mouse Move: Pointer coordinates + landmark hover detection (throttled to 40ms)
    map.on('mousemove', (e) => {
      const projected = southPoleCRS.projection.project(e.latlng);
      const { lat, lon } = stereographicMetersToLatLon(projected.x, projected.y);

      if (onPointerCoordinates) {
        onPointerCoordinates(lon, lat);
      }

      const now = performance.now();
      if (now - lastHoverTimeRef.current < 40) return;
      lastHoverTimeRef.current = now;

      const mousePt = e.containerPoint;
      const hit = SOUTH_POLE_LANDMARKS.find((lm) => {
        const lmPt = map.latLngToContainerPoint(
          L.latLng(lm.latitude, lm.longitude)
        );
        return Math.hypot(lmPt.x - mousePt.x, lmPt.y - mousePt.y) < 14;
      });
      setHoveredLandmarkId((prev) => (prev === (hit ? hit.id : null) ? prev : hit ? hit.id : null));
    });

    // Click: Distance measurement or Altimetry Probe or landmark select
    map.on('click', (e) => {
      // Ignore click if the interaction was a pan/drag gesture
      if (didDrag || (map.dragging && map.dragging.moved())) {
        return;
      }
      if (dragStartPos && e.containerPoint) {
        const dist = Math.hypot(
          e.containerPoint.x - dragStartPos.x,
          e.containerPoint.y - dragStartPos.y
        );
        if (dist > 5) {
          return;
        }
      }
      const projected = southPoleCRS.projection.project(e.latlng);
      const { lat, lon } = stereographicMetersToLatLon(projected.x, projected.y);

      // Handle active measurement mode
      if (isMeasuringRef.current) {
        const nextNodes = [...measureNodesRef.current, [lon, lat]];
        measureNodesRef.current = nextNodes;
        setMeasureNodes(nextNodes);
        const { totalKm, segmentsKm } = calculateLunarPathDistance(nextNodes);
        const initialBearingDeg =
          nextNodes.length >= 2
            ? calculateLunarBearing(nextNodes[0], nextNodes[1])
            : 0;
        if (onMeasurementChange) {
          onMeasurementChange({
            coordinates: nextNodes,
            totalDistanceKm: totalKm,
            segmentDistancesKm: segmentsKm,
            initialBearingDeg,
            isComplete: false,
          });
        }
        drawOverlayCanvas();
        return;
      }

      // Check Landmark Hit
      const clickPt = e.containerPoint;
      const hit = SOUTH_POLE_LANDMARKS.find((lm) => {
        const lmPt = map.latLngToContainerPoint(
          L.latLng(lm.latitude, lm.longitude)
        );
        return Math.hypot(lmPt.x - clickPt.x, lmPt.y - clickPt.y) < 14;
      });

      if (hit) {
        setProbedPin(null);
        setSelectedLocation({
          lat: hit.latitude,
          lon: hit.longitude,
          elevation: hit.elevationMeters,
          slope: null,
          name: hit.name,
          isOutOfDemBounds: false,
        });
        leafletMapRef.current?.panTo([hit.latitude, hit.longitude], { animate: true });
        if (onFeatureSelect) onFeatureSelect(hit);
        return;
      }

      // Out of bounds check (> 80°S) - NEVER clamp or fallback to -1500
      if (lat > -79.9 || Math.abs(projected.x) > HALF_EXTENT_M || Math.abs(projected.y) > HALF_EXTENT_M) {
        setSelectedLocation({
          lat,
          lon,
          elevation: null,
          slope: null,
          name: 'Point Outside 80°S Coverage',
          isOutOfDemBounds: true,
        });
        setProbedPin(null);
        onOutOfDemBounds?.(lat, lon);
        drawOverlayCanvas();
        return;
      }

      // Real NASA LOLA Altimetry Probe via Worker
      if (workerRef.current) {
        probeCallbackRef.current = ({ elevationM, slopeDeg }) => {
          const roundedElev = elevationM != null ? Math.round(elevationM) : null;
          const roundedSlope = slopeDeg != null ? Math.round(slopeDeg * 10) / 10 : null;
          setProbedPin({ lat, lon, elevation: roundedElev, slope: roundedSlope });
          setSelectedLocation({
            lat,
            lon,
            elevation: roundedElev,
            slope: roundedSlope,
            name: 'Sampled LOLA DEM Point',
            isOutOfDemBounds: false,
          });

          if (onFeatureSelect) {
            onFeatureSelect({
              id: `sp-probe-${lon.toFixed(2)}-${lat.toFixed(2)}`,
              name: 'Custom Dropped Pin',
              type: 'custom_pin',
              isCustomPin: true,
              latitude: lat,
              longitude: lon,
              elevationMeters: roundedElev,
              slopeDeg: roundedSlope,
              body: 'moon',
              description: `South Polar Stereographic coordinate ${Math.abs(
                lat
              ).toFixed(3)}°S, ${
                lon >= 0 ? `${lon.toFixed(3)}°E` : `${Math.abs(lon).toFixed(3)}°W`
              } (X=${Math.round(projected.x).toLocaleString()} m, Y=${Math.round(
                projected.y
              ).toLocaleString()} m). Decoded NASA LOLA elevation: ${
                roundedElev != null ? `${roundedElev > 0 ? '+' : ''}${roundedElev.toLocaleString()} m` : 'No Data'
              } (relative to R₀=1,737,400 m)${roundedSlope != null ? `, local slope: ${roundedSlope.toFixed(1)}°` : ''}.`,
            });
          }
        };

        workerRef.current.postMessage({
          type: 'PROBE_POINT',
          payload: {
            xMeters: projected.x,
            yMeters: projected.y,
            demUrl: DEM_BINARY_URL,
          },
        });
      }
    });

    const initTimer = setTimeout(() => {
      if (!leafletMapRef.current || !map._loaded || !map._mapPane) return;
      map.invalidateSize();
      map.setView([-90, 0], 1, { animate: false });
      drawOverlayCanvas();
    }, 60);

    return () => {
      clearTimeout(initTimer);
      map.remove();
      leafletMapRef.current = null;
      gridLayerRef.current = null;
    };
  }, []);

  // Safe helper to update Leaflet view only when map pane and layout are active
  const safeSetView = useCallback((latLng, zoom, preferAnimate = false) => {
    const map = leafletMapRef.current;
    if (!map || !map._loaded || !map._mapPane) return;
    const size = map.getSize();
    const canAnimate = Boolean(preferAnimate && size && size.x > 0 && size.y > 0);
    map.setView(latLng, zoom, { animate: canAnimate });
  }, []);

  // Redraw when overlay layers or selection changes
  useEffect(() => {
    drawOverlayCanvas();
  }, [drawOverlayCanvas]);

  // Handle visibility / resize
  useEffect(() => {
    if (isVisible && leafletMapRef.current) {
      const map = leafletMapRef.current;
      const timer = setTimeout(() => {
        if (!leafletMapRef.current || !map._loaded || !map._mapPane) return;
        map.invalidateSize();
        const center = map.getCenter();
        if (!center || Number.isNaN(center.lat) || Number.isNaN(center.lng)) {
          safeSetView([-90, 0], 1, false);
        } else {
          const projCenter = latLonToStereographicMeters(center.lat, center.lng);
          if (
            Math.abs(projCenter.x) > MAX_PAN_EXTENT_M ||
            Math.abs(projCenter.y) > MAX_PAN_EXTENT_M
          ) {
            safeSetView([-90, 0], 1, false);
          }
        }
        drawOverlayCanvas();
      }, 70);
      return () => clearTimeout(timer);
    }
  }, [isVisible, safeSetView]);

  // Expose Imperative Controller API
  useImperativeHandle(ref, () => ({
    zoomIn: () => leafletMapRef.current?.zoomIn(),
    zoomOut: () => leafletMapRef.current?.zoomOut(),
    resetOverview: () => {
      safeSetView([-90, 0], 1, true);
    },
    goToSouthPole: () => {
      safeSetView([-90, 0], 1, true);
    },
    activateMeasurement: () => {
      isMeasuringRef.current = true;
      setIsMeasuring(true);
    },
    deactivateMeasurement: () => {
      isMeasuringRef.current = false;
      setIsMeasuring(false);
    },
    clearMeasurement: () => {
      isMeasuringRef.current = false;
      setIsMeasuring(false);
      measureNodesRef.current = [];
      setMeasureNodes([]);
      if (onMeasurementChange) {
        onMeasurementChange({
          coordinates: [],
          totalDistanceKm: 0,
          segmentDistancesKm: [],
          initialBearingDeg: 0,
          isComplete: false,
        });
      }
      setTimeout(() => drawOverlayCanvas(), 10);
    },
    flyTo: (lon, lat, targetZoom) => {
      const curZoom = leafletMapRef.current?.getZoom() ?? 3;
      if (typeof lat === 'number' && lat > -79.9) {
        onOutOfDemBounds?.(lat, lon);
        safeSetView([lat, lon ?? 0], typeof targetZoom === 'number' ? targetZoom : curZoom, true);
        return;
      }
      const z =
        typeof targetZoom === 'number'
          ? Math.max(1, Math.min(5, Math.round(targetZoom - 2)))
          : curZoom;
      safeSetView([lat ?? -90, lon ?? 0], z, true);
    },
    selectFeature: (featureOrId) => {
      const featId = typeof featureOrId === 'string' ? featureOrId : featureOrId?.id;
      const lm = SOUTH_POLE_LANDMARKS.find((l) => l.id === featId);
      const curZoom = leafletMapRef.current?.getZoom() ?? 3;
      if (lm) {
        setSelectedLocation({
          lat: lm.latitude,
          lon: lm.longitude,
          elevation: lm.elevationMeters,
          slope: null,
          name: lm.name,
          isOutOfDemBounds: false,
        });
        safeSetView([lm.latitude, lm.longitude], curZoom, true);
      } else if (
        typeof featureOrId === 'object' &&
        typeof featureOrId?.latitude === 'number'
      ) {
        const lat = featureOrId.latitude;
        const lon = featureOrId.longitude ?? 0;
        const isOutOf = lat > -79.9;
        setSelectedLocation({
          lat,
          lon,
          elevation: featureOrId.elevationMeters || null,
          slope: null,
          name: featureOrId.name || 'Selected Site',
          isOutOfDemBounds: isOutOf,
        });
        if (featureOrId.isCustomPin || featureOrId.type === 'custom_pin') {
          setProbedPin({
            lat,
            lon,
            elevation: featureOrId.elevationMeters ?? null,
            slope: featureOrId.slopeDeg ?? null,
          });
        }
        if (isOutOf) onOutOfDemBounds?.(lat, lon);
        safeSetView([lat, lon], curZoom, true);
      }
    },
    setLayerVisibility: (layerId, visible) => {
      const id = String(layerId || '').toLowerCase();
      if (id.includes('contour') || id.includes('topo')) {
        setShowContours(Boolean(visible));
      } else if (id.includes('psr') || id.includes('shadow') || id.includes('ice')) {
        setShowPsrs(Boolean(visible));
      } else if (id.includes('ridge') || id.includes('illumination') || id.includes('sun')) {
        setShowRidges(Boolean(visible));
      } else if (id.includes('slope') || id.includes('hazard')) {
        setShowSlopeHazard(Boolean(visible));
      } else if (id.includes('dsn') || id.includes('comm') || id.includes('earth')) {
        setShowDsnLink(Boolean(visible));
      } else if (id.includes('traverse') || id.includes('route')) {
        setShowTraverses(Boolean(visible));
      } else {
        setShowLandmarks(Boolean(visible));
      }
    },
  }));

  return (
    <div
      className="relative w-full h-full overflow-hidden select-none"
      style={{ backgroundColor: TOPO_STYLE.canvas.backgroundColor }}
    >
      {/* Leaflet South Polar Stereographic Container */}
      <div
        ref={mapContainerRef}
        className="w-full h-full z-0"
        style={{ backgroundColor: TOPO_STYLE.canvas.backgroundColor }}
      />

      {/* Synchronized Vector Overlay Canvas */}
      <canvas
        ref={overlayCanvasRef}
        className="absolute inset-0 pointer-events-none z-10"
      />

      {/* Cartographic Collar Legend HUD */}
      {isVisible && isLayersOpen && (
        <SouthPoleLegendHUD
          isOpen={isLayersOpen}
          onClose={onCloseLayers}
          selectedLocation={selectedLocation}
          contourInterval={Math.max(200, currentIntervalEntry.intervalM)}
          indexInterval={Math.max(200, currentIntervalEntry.intervalM) * 5}
          zoomLevel={zoomLevel}
          activeRenderMode={activeRenderMode}
          onSelectRenderMode={setActiveRenderMode}
          rasterOpacity={rasterOpacity}
          onChangeRasterOpacity={setRasterOpacity}
          showContours={showContours}
          onToggleContours={() => setShowContours((prev) => !prev)}
          showSlopeHazard={showSlopeHazard}
          onToggleSlopeHazard={() => setShowSlopeHazard((prev) => !prev)}
          showTraverses={showTraverses}
          onToggleTraverses={() => setShowTraverses((prev) => !prev)}
          showRidges={showRidges}
          onToggleRidges={() => setShowRidges((prev) => !prev)}
          showPsrs={showPsrs}
          onTogglePsrs={() => setShowPsrs((prev) => !prev)}
          showDsnLink={showDsnLink}
          onToggleDsnLink={() => setShowDsnLink((prev) => !prev)}
          showLandmarks={showLandmarks}
          onToggleLandmarks={() => setShowLandmarks((prev) => !prev)}
          selectedFeature={selectedFeature}
          onSwitchTo3D={onSwitchTo3D}
        />
      )}
    </div>
  );
});

export default SouthPoleTopoMap;
