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
import {
  fetchAndProjectGeoJson,
  loadContoursFromWorker,
} from '../../services/geoJsonParserService.js';
import {
  getResolutionForZoom,
  getScaleForZoom,
  computeViewportZoomLimits,
  computeClampedStereographicCenter,
  computeClampedPixelOffset,
  computeDraggablePaneOffsetBounds,
  SOUTH_POLE_MAP_COVERAGE,
  WHITE_OUTLINE_MIN_ZOOM,
  evaluateWhiteOutlineLayerVisibility,
  evaluateGreenConnectionLayerVisibility,
} from '../../utils/mapViewportBounds.js';
import { findNearestScreenMarker } from '../../utils/markerHitSelection.js';

/**
 * South Polar Stereographic on Lunar Sphere (R = 1,737,400 m)
 * Extent: [-304 km, -304 km] to [+304 km, +304 km] (80°S–90°S)
 */
const LUNAR_RADIUS_M = 1737400;
const HALF_EXTENT_M = 304000;
const MAX_PAN_EXTENT_M = HALF_EXTENT_M;
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
    rasterOpacity: propRasterOpacity,
    isRoutePlanning = false,
    routeStartPoint = null,
    routeGoalPoint = null,
    routeResult = null,
    onRoutePointClick = null,
    showScaleBar = false,
  },
  ref
) {
  const mapContainerRef = useRef(null);
  const whiteOutlineCanvasRef = useRef(null);
  const greenConnectionCanvasRef = useRef(null);
  const overlayCanvasRef = useRef(null);
  const leafletMapRef = useRef(null);
  const gridLayerRef = useRef(null);
  const workerRef = useRef(null);
  const pendingTilesRef = useRef(new Map());
  const probeCallbackRef = useRef(null);

  const isRoutePlanningRef = useRef(isRoutePlanning);
  useEffect(() => {
    isRoutePlanningRef.current = isRoutePlanning;
  }, [isRoutePlanning]);

  const onRoutePointClickRef = useRef(onRoutePointClick);
  useEffect(() => {
    onRoutePointClickRef.current = onRoutePointClick;
  }, [onRoutePointClick]);

  const [isMeasuring, setIsMeasuring] = useState(false);
  const [measureNodes, setMeasureNodes] = useState([]);
  const isMeasuringRef = useRef(false);
  const measureNodesRef = useRef([]);

  const [zoomLevel, setZoomLevel] = useState(1);
  const [activeRenderMode, setActiveRenderMode] = useState('svs-5127');
  const activeRenderModeRef = useRef('svs-5127');
  const [rasterOpacity, setRasterOpacity] = useState(propRasterOpacity ?? 1.0);

  useEffect(() => {
    if (propRasterOpacity !== undefined && typeof propRasterOpacity === 'number') {
      setRasterOpacity(propRasterOpacity);
    }
  }, [propRasterOpacity]);
  const [showContours, setShowContours] = useState(true);
  const showContoursRef = useRef(true);
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
  const drawOverlayCanvasRef = useRef(null); // always-current ref to avoid stale closures
  const isAnimatingRef = useRef(false);
  const animLoopRef = useRef(null);
  const lastHoverTimeRef = useRef(0);

  const [selectedLocation, setSelectedLocation] = useState(null);
  const [probedPin, setProbedPin] = useState(null);
  const [hoveredLandmarkId, setHoveredLandmarkId] = useState(null);

  const [contourGridData, setContourGridData] = useState(null);

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
    showContoursRef.current = showContours;
    if (gridLayerRef.current) {
      gridLayerRef.current.redraw();
    }
  }, [showContours]);

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
      requestAnimationFrame(() => {
        drawOverlayCanvasRef.current?.();
      });
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

  const currentIntervalEntry = useMemo(
    () => getContourIntervalForZoom(zoomLevel),
    [zoomLevel]
  );
  const currentGridEntry = useMemo(
    () => getGridSpacingForZoom(zoomLevel),
    [zoomLevel]
  );

  useEffect(() => {
    let isMounted = true;

    fetchAndProjectGeoJson('/data/topo/planned_traverses.geojson')
      .then((data) => {
        if (isMounted && data) setPlannedTraverses(data);
      })
      .catch(() => {});

    fetchAndProjectGeoJson('/data/topo/ridges_and_rims.geojson')
      .then((data) => {
        if (isMounted && data) setRidgesAndRims(data);
      })
      .catch(() => {});

    fetchAndProjectGeoJson('/data/topo/psr_footprints.geojson')
      .then((data) => {
        if (isMounted && data) setPsrFootprints(data);
      })
      .catch(() => {});

    return () => {
      isMounted = false;
    };
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

  useEffect(() => {
    const worker = new Worker(
      new URL('../../workers/lolaTileWorker.js', import.meta.url),
      { type: 'module' }
    );
    workerRef.current = worker;

    worker.onmessage = (event) => {
      const { type, payload } = event.data;

      if (type === 'DEM_READY') {
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

  const whiteOutlineLayerStatus = useMemo(
    () =>
      evaluateWhiteOutlineLayerVisibility({
        zoomLevel,
        showContours,
        showRidges,
        minZoom: WHITE_OUTLINE_MIN_ZOOM,
      }),
    [zoomLevel, showContours, showRidges]
  );

  const greenConnectionLayerStatus = useMemo(
    () =>
      evaluateGreenConnectionLayerVisibility({
        showDsnLink,
        subEarthLonDeg,
        routeResult,
      }),
    [showDsnLink, subEarthLonDeg, routeResult]
  );

  const prepareCanvasLayer = (canvas, size, dpr) => {
    if (!canvas) return null;
    if (canvas.width !== size.x * dpr || canvas.height !== size.y * dpr) {
      canvas.width = size.x * dpr;
      canvas.height = size.y * dpr;
      canvas.style.width = `${size.x}px`;
      canvas.style.height = `${size.y}px`;
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    return ctx;
  };

  const drawWhiteOutlineLayer = useCallback(
    (size, dpr, currentZoom, metersToPx, latLonToPx) => {
      const ctx = prepareCanvasLayer(whiteOutlineCanvasRef.current, size, dpr);
      if (!ctx) return;

      const whiteVis = evaluateWhiteOutlineLayerVisibility({
        zoomLevel: currentZoom,
        showContours,
        showRidges,
        minZoom: WHITE_OUTLINE_MIN_ZOOM,
      });

      if (!whiteVis.meetsZoomThreshold) {
        return;
      }

      ctx.save();
      ctx.scale(dpr, dpr);

      if (whiteVis.contoursVisible && contourGridData && computedContours.length > 0) {
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

              if (layer.isIndex && ring.length >= 16) {
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

        ctx.save();
        ctx.font = 'bold 9px "JetBrains Mono", monospace';
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

      if (whiteVis.ridgesVisible && ridgesAndRims?.features) {
        ctx.save();
        ctx.strokeStyle = TOPO_STYLE.canvas.ridgeRimColor;
        ctx.lineWidth = TOPO_STYLE.canvas.ridgeRimWidth;
        ctx.setLineDash(TOPO_STYLE.canvas.ridgeRimDash);

        for (const feature of ridgesAndRims.features) {
          const coords = feature.geometry?.coordinates;
          if (!coords || coords.length < 2) continue;
          const isProj = Boolean(feature.properties?.isProjected);
          const getPt = (c) => (isProj ? metersToPx(c[0], c[1]) : latLonToPx(c[1], c[0]));

          ctx.beginPath();
          coords.forEach((coord, i) => {
            const pt = getPt(coord);
            if (i === 0) ctx.moveTo(pt.x, pt.y);
            else ctx.lineTo(pt.x, pt.y);
          });
          ctx.stroke();

          const midCoord = coords[Math.floor(coords.length / 2)];
          const midPt = getPt(midCoord);
          ctx.save();
          ctx.font = '600 8.5px "JetBrains Mono", monospace';
          ctx.fillStyle = '#FFFFFF';
          ctx.strokeStyle = 'rgba(0,0,0,0.8)';
          ctx.lineWidth = 2.5;
          ctx.strokeText(feature.properties?.name || '', midPt.x, midPt.y - 6);
          ctx.fillText(feature.properties?.name || '', midPt.x, midPt.y - 6);
          ctx.restore();
        }
        ctx.restore();
      }

      if (whiteVis.neatlineVisible) {
        ctx.save();
        ctx.strokeStyle = TOPO_STYLE.canvas.neatlineColor;
        ctx.lineWidth = TOPO_STYLE.canvas.neatlineWidth;
        ctx.strokeRect(6, 6, size.x - 12, size.y - 12);
        ctx.restore();
      }

      ctx.restore();
    },
    [computedContours, contourGridData, ridgesAndRims, showContours, showRidges]
  );

  const drawGreenConnectionLayer = useCallback(
    (size, dpr, currentZoom, latLonToPx) => {
      const ctx = prepareCanvasLayer(greenConnectionCanvasRef.current, size, dpr);
      if (!ctx) return;

      const greenVis = evaluateGreenConnectionLayerVisibility({
        showDsnLink,
        subEarthLonDeg,
        routeResult,
      });

      if (!greenVis.isVisible) {
        return;
      }

      ctx.save();
      ctx.scale(dpr, dpr);

      if (greenVis.dsnConnectionVisible) {
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

        ctx.font = 'bold 9px "JetBrains Mono", monospace';
        ctx.fillStyle = '#34D399';
        ctx.strokeStyle = 'rgba(7, 10, 16, 0.9)';
        ctx.lineWidth = 2.5;
        ctx.textAlign = 'center';
        ctx.strokeText(`EARTH DSN LOS (${lonLabel}) ▲`, midPt.x, midPt.y - 6);
        ctx.fillText(`EARTH DSN LOS (${lonLabel}) ▲`, midPt.x, midPt.y - 6);
        ctx.restore();
      }

      if (greenVis.routeConnectionVisible) {
        const wps = routeResult.waypoints;
        ctx.save();
        for (let i = 1; i < wps.length; i++) {
          const p1 = latLonToPx(wps[i - 1].lat, wps[i - 1].lon);
          const p2 = latLonToPx(wps[i].lat, wps[i].lon);
          const isSunlit = wps[i].sunStatus === 'sunlit';

          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.strokeStyle = isSunlit ? 'rgba(16, 185, 129, 0.4)' : 'rgba(56, 189, 248, 0.4)';
          ctx.lineWidth = 6;
          ctx.stroke();

          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.strokeStyle = isSunlit ? '#10B981' : '#38BDF8';
          ctx.lineWidth = 2.8;
          ctx.stroke();
        }

        wps.forEach((wp, idx) => {
          if (idx === 0 || idx === wps.length - 1 || idx % 10 === 0) {
            const pt = latLonToPx(wp.lat, wp.lon);
            ctx.beginPath();
            ctx.arc(pt.x, pt.y, idx === 0 || idx === wps.length - 1 ? 5 : 3, 0, Math.PI * 2);
            ctx.fillStyle = idx === 0 ? '#10B981' : idx === wps.length - 1 ? '#00E5FF' : '#FFFFFF';
            ctx.fill();
            ctx.strokeStyle = '#050507';
            ctx.lineWidth = 1.5;
            ctx.stroke();

            if (currentZoom >= 2 && (idx === 0 || idx === wps.length - 1)) {
              ctx.font = 'bold 9px "JetBrains Mono", monospace';
              ctx.fillStyle = idx === 0 ? '#34D399' : '#38BDF8';
              ctx.textAlign = 'left';
              ctx.fillText(idx === 0 ? 'START' : 'DEST', pt.x + 8, pt.y - 3);
            }
          }
        });
        ctx.restore();
      }

      ctx.restore();
    },
    [routeResult, selectedFeature, selectedLocation, showDsnLink, subEarthLonDeg]
  );

  const drawOverlayCanvas = useCallback(() => {
    const map = leafletMapRef.current;
    const canvas = overlayCanvasRef.current;
    if (!map || !map._loaded || !map._mapPane || !canvas) return;

    const size = map.getSize();
    if (!size || size.x <= 0 || size.y <= 0) return;
    const dpr = window.devicePixelRatio || 1;

    // Exact unrounded affine transformation from South Polar Stereographic meters (xM, yM) to screen pixels
    const currentZoom = map.getZoom();
    const crsScale = map.options.crs?.scale
      ? map.options.crs.scale(currentZoom)
      : getScaleForZoom(currentZoom);

    let polePx;
    if (typeof map.getPixelOrigin === 'function' && typeof map._getMapPanePos === 'function') {
      const pixelOrigin = map.getPixelOrigin();
      const panePos = map._getMapPanePos();
      const poleWorldX = HALF_EXTENT_M * crsScale;
      const poleWorldY = HALF_EXTENT_M * crsScale;
      polePx = {
        x: poleWorldX - pixelOrigin.x + panePos.x,
        y: poleWorldY - pixelOrigin.y + panePos.y,
      };
    } else {
      polePx = map.latLngToContainerPoint(L.latLng(-90, 0));
    }

    const scaleX = crsScale;
    const scaleY = -crsScale;

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

    drawWhiteOutlineLayer(size, dpr, currentZoom, metersToPx, latLonToPx);

    drawGreenConnectionLayer(size, dpr, currentZoom, latLonToPx);

    const ctx = prepareCanvasLayer(canvas, size, dpr);
    if (!ctx) return;
    ctx.save();
    ctx.scale(dpr, dpr);

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

    if (showTraverses && plannedTraverses?.features) {
      ctx.save();
      ctx.strokeStyle = TOPO_STYLE.canvas.traverseRouteColor;
      ctx.lineWidth = TOPO_STYLE.canvas.traverseRouteWidth;
      ctx.setLineDash(TOPO_STYLE.canvas.traverseRouteDash);

      for (const feature of plannedTraverses.features) {
        const coords = feature.geometry?.coordinates;
        if (!coords || coords.length < 2) continue;
        const isProj = Boolean(feature.properties?.isProjected);
        const getPt = (c) => (isProj ? metersToPx(c[0], c[1]) : latLonToPx(c[1], c[0]));

        ctx.beginPath();
        coords.forEach((coord, i) => {
          const pt = getPt(coord);
          if (i === 0) ctx.moveTo(pt.x, pt.y);
          else ctx.lineTo(pt.x, pt.y);
        });
        ctx.stroke();

        coords.forEach((coord, idx) => {
          const pt = getPt(coord);
          ctx.save();
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, idx === 0 ? 4 : 2.5, 0, Math.PI * 2);
          ctx.fillStyle = TOPO_STYLE.canvas.traverseRouteColor;
          ctx.fill();
          ctx.strokeStyle = '#FFFFFF';
          ctx.lineWidth = 1;
          ctx.stroke();

          if (idx === 0 && currentZoom >= 2) {
            ctx.font = 'bold 9px "JetBrains Mono", monospace';
            ctx.fillStyle = TOPO_STYLE.canvas.traverseRouteColor;
            ctx.textAlign = 'left';
            ctx.fillText(feature.properties?.name || 'Traverse', pt.x + 8, pt.y - 4);
          }
          ctx.restore();
        });
      }
      ctx.restore();
    }

    if (showPsrs && psrFootprints?.features) {
      ctx.save();
      ctx.fillStyle = 'rgba(56, 189, 248, 0.14)';
      ctx.strokeStyle = 'rgba(125, 211, 252, 0.72)';
      ctx.lineWidth = 1.1;
      ctx.setLineDash([4, 3]);

      for (const feature of psrFootprints.features) {
        const coords = feature.geometry?.coordinates;
        if (!coords || coords.length < 3) continue;
        const isProj = Boolean(feature.properties?.isProjected);
        const getPt = (c) => (isProj ? metersToPx(c[0], c[1]) : latLonToPx(c[1], c[0]));

        ctx.beginPath();
        coords.forEach((coord, idx) => {
          const pt = getPt(coord);
          if (idx === 0) ctx.moveTo(pt.x, pt.y);
          else ctx.lineTo(pt.x, pt.y);
        });
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }

      if (currentZoom >= 2) {
        ctx.setLineDash([]);
        ctx.font = '600 8px "JetBrains Mono", monospace';
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
        ? 'bold 10px "JetBrains Mono", monospace'
        : '600 9px "JetBrains Mono", monospace';

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
          ? 'bold 10px "JetBrains Mono", monospace'
          : '600 9px "JetBrains Mono", monospace';
        ctx.textAlign = pos.align;
        ctx.strokeStyle = 'rgba(7, 10, 16, 0.92)';
        ctx.lineWidth = 3;
        ctx.strokeText(fullText, pos.x, pos.y);
        ctx.fillStyle = isSelected ? '#FDE68A' : isHovered ? '#FCA5A5' : '#FFFFFF';
        ctx.fillText(fullText, pos.x, pos.y);
        ctx.restore();
      }
    }

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

      const pinLabel = selectedFeature?.name || 'Custom Dropped Pin';
      ctx.font = 'bold 9.5px "JetBrains Mono", monospace';
      ctx.textAlign = 'left';
      ctx.strokeStyle = 'rgba(7, 10, 16, 0.92)';
      ctx.lineWidth = 3;
      ctx.strokeText(pinLabel, pt.x + 14, pt.y + 3);
      ctx.fillStyle = '#FDE68A';
      ctx.fillText(pinLabel, pt.x + 14, pt.y + 3);

      ctx.restore();
    }

    if (!routeResult?.success) {
      if (routeStartPoint) {
        const pt = latLonToPx(routeStartPoint.lat, routeStartPoint.lon);
        ctx.save();
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 6, 0, Math.PI * 2);
        ctx.fillStyle = '#10B981';
        ctx.fill();
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.font = 'bold 9.5px "JetBrains Mono", monospace';
        ctx.fillStyle = '#34D399';
        ctx.textAlign = 'left';
        ctx.fillText(routeStartPoint.name || 'START', pt.x + 9, pt.y + 3);
        ctx.restore();
      }
      if (routeGoalPoint) {
        const pt = latLonToPx(routeGoalPoint.lat, routeGoalPoint.lon);
        ctx.save();
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 6, 0, Math.PI * 2);
        ctx.fillStyle = '#00E5FF';
        ctx.fill();
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.font = 'bold 9.5px "JetBrains Mono", monospace';
        ctx.fillStyle = '#38BDF8';
        ctx.textAlign = 'left';
        ctx.fillText(routeGoalPoint.name || 'GOAL', pt.x + 9, pt.y + 3);
        ctx.restore();
      }
    }

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

        ctx.font = 'bold 9.5px "JetBrains Mono", monospace';
        ctx.fillStyle = '#FFFFFF';
        ctx.textAlign = 'left';
        ctx.fillText(`WP${idx + 1}`, pt.x + 8, pt.y - 4);
      });
      ctx.restore();
    }

    if (showScaleBar) {
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

      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(scaleBarX - scalePx, scaleBarY, scalePx / 2, 4);
      ctx.fillStyle = '#070A10';
      ctx.fillRect(scaleBarX - scalePx / 2, scaleBarY, scalePx / 2, 4);
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 1;
      ctx.strokeRect(scaleBarX - scalePx, scaleBarY, scalePx, 4);

      ctx.font = '7.5px "JetBrains Mono", monospace';
      ctx.fillStyle = '#94A3B8';
      ctx.fillText('NASA SVS 5127 · LOLA GDR', scaleBarX, scaleBarY + 12);
      ctx.restore();
    }

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

    ctx.font = 'bold 9px "JetBrains Mono", monospace';
    ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = 'center';
    ctx.fillText('N', 0, -22);
    ctx.font = '7px "JetBrains Mono", monospace';
    ctx.fillStyle = '#94A3B8';
    ctx.fillText('0°E', 0, 12);
    ctx.restore();

    ctx.restore();
  }, [
    currentGridEntry,
    currentIntervalEntry,
    drawGreenConnectionLayer,
    drawWhiteOutlineLayer,
    hoveredLandmarkId,
    measureNodes,
    plannedTraverses,
    probedPin,
    psrFootprints,
    selectedFeature,
    showLandmarks,
    showPsrs,
    showTraverses,
    routeStartPoint,
    routeGoalPoint,
    routeResult,
  ]);

  useEffect(() => {
    drawOverlayCanvasRef.current = drawOverlayCanvas;
  }, [drawOverlayCanvas]);

  // Continuous RAF loop used while Leaflet zoom animation is running.
  // We do NOT cancel the loop on every new event — we just let it run until
  // animation ends, so the canvas always reflects the current mid-zoom state.
  const startAnimLoop = useCallback(() => {
    if (animLoopRef.current) return;
    const tick = () => {
      drawOverlayCanvasRef.current?.();
      if (isAnimatingRef.current) {
        animLoopRef.current = requestAnimationFrame(tick);
      } else {
        animLoopRef.current = null;
      }
    };
    animLoopRef.current = requestAnimationFrame(tick);
  }, []);

  const stopAnimLoop = useCallback(() => {
    isAnimatingRef.current = false;
    // Let the loop drain naturally on its next tick
  }, []);

  const scheduleOverlayDraw = useCallback(() => {
    if (isAnimatingRef.current) return;
    if (!rafDrawRef.current) {
      rafDrawRef.current = requestAnimationFrame(() => {
        rafDrawRef.current = null;
        drawOverlayCanvasRef.current?.();
      });
    }
  }, []);

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
    const initialLimits = computeViewportZoomLimits(
      container.clientWidth || 1024,
      container.clientHeight || 768
    );

    const map = L.map(container, {
      crs: southPoleCRS,
      center: [-90, 0],
      zoom: initialLimits.optimalFitZoom,
      minZoom: initialLimits.minZoom,
      maxZoom: initialLimits.maxZoom,
      zoomControl: false,
      attributionControl: false,
      doubleClickZoom: false,
      maxBounds: L.latLngBounds(
        L.latLng(panSw.lat, panSw.lon),
        L.latLng(panNe.lat, panNe.lon)
      ),
      maxBoundsViscosity: 1.0,
      inertia: false,
    });

    // Override Leaflet's _limitCenter and _limitOffset so pan/zoom boundary enforcement
    // operates directly in South Polar Stereographic meters with independent X and Y bounds
    // and zero integer-pixel rounding drift across repeated zoom-in/zoom-out cycles.
    map._limitCenter = function (center, zoom, bounds) {
      if (!bounds || !center) return L.latLng(center);
      const targetZoom = zoom !== undefined ? zoom : this.getZoom();
      const size = this.getSize();
      const projected = southPoleCRS.projection.project(L.latLng(center));
      if (!projected || !Number.isFinite(projected.x) || !Number.isFinite(projected.y)) {
        return L.latLng(-90, 0);
      }
      const res = getResolutionForZoom(targetZoom);
      const clamped = computeClampedStereographicCenter(
        projected.x,
        projected.y,
        size.x,
        size.y,
        res,
        HALF_EXTENT_M
      );
      return southPoleCRS.projection.unproject(L.point(clamped.x, clamped.y));
    };

    map._limitOffset = function (offset, bounds) {
      if (!bounds || !offset) return L.point(offset);
      const zoom = this.getZoom();
      const size = this.getSize();
      const curCenterPx = this.project(this.getCenter(), zoom);
      const clamped = computeClampedPixelOffset(
        offset,
        curCenterPx,
        size,
        zoom,
        HALF_EXTENT_M
      );
      return L.point(clamped.x, clamped.y);
    };

    leafletMapRef.current = map;

    let tileSeq = 0;
    // Custom GridLayer delegating NASA SVS 5127 coded color decoding to Web Worker
    const LolaDemGridLayer = L.GridLayer.extend({
      createTile(coords, done) {
        const canvas = document.createElement('canvas');
        const size = this.getTileSize();
        canvas.width = size.x;
        canvas.height = size.y;

        tileSeq += 1;
        const tileKey = `${coords.z}:${coords.x}:${coords.y}:${Date.now()}:${tileSeq}`;
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

    const handleViewChange = () => {
      setZoomLevel(map.getZoom());
      scheduleOverlayDraw();
    };

    const handleZoomStart = () => {
      isAnimatingRef.current = true;
      startAnimLoop();
    };
    const handleZoomEnd = () => {
      stopAnimLoop();
      setZoomLevel(map.getZoom());
      // Ensure center is strictly within valid bounds for the settled zoom level
      const center = map.getCenter();
      const limited = map._limitCenter(center, map.getZoom(), map.options.maxBounds);
      if (
        Math.abs(limited.lat - center.lat) > 1e-6 ||
        Math.abs(limited.lng - center.lng) > 1e-6
      ) {
        map.setView(limited, map.getZoom(), { animate: false });
      }
      requestAnimationFrame(() => requestAnimationFrame(() => {
        drawOverlayCanvasRef.current?.();
      }));
    };

    map.on('move zoom zoomend moveend viewreset resize', handleViewChange);
    map.on('zoomstart', handleZoomStart);
    map.on('zoomend', handleZoomEnd);

    // Track pointer/drag motion at both DOM pointer level and Leaflet drag level
    // so dragging (even against a clamped boundary) never registers as a click-to-select.
    let pointerStartClient = null;
    let dragStartPos = null;
    let didDrag = false;
    let lastDragEndTime = 0;

    const handlePointerDown = (ev) => {
      if (ev.button !== undefined && ev.button !== 0) return;
      pointerStartClient = { x: ev.clientX, y: ev.clientY };
      didDrag = false;
    };

    const handlePointerMove = (ev) => {
      if (!pointerStartClient) return;
      const dist = Math.hypot(
        ev.clientX - pointerStartClient.x,
        ev.clientY - pointerStartClient.y
      );
      if (dist > 4) {
        didDrag = true;
        lastDragEndTime = performance.now();
      }
    };

    const handlePointerUp = (ev) => {
      if (pointerStartClient) {
        const dist = Math.hypot(
          ev.clientX - pointerStartClient.x,
          ev.clientY - pointerStartClient.y
        );
        if (dist > 4) {
          didDrag = true;
          lastDragEndTime = performance.now();
        }
        pointerStartClient = null;
      }
    };

    container.addEventListener('pointerdown', handlePointerDown, { passive: true });
    window.addEventListener('pointermove', handlePointerMove, { passive: true });
    window.addEventListener('pointerup', handlePointerUp, { passive: true });
    window.addEventListener('pointercancel', handlePointerUp, { passive: true });

    map.on('mousedown', (e) => {
      dragStartPos = e.containerPoint ? { x: e.containerPoint.x, y: e.containerPoint.y } : null;
      didDrag = false;
    });

    map.on('dragstart', () => {
      didDrag = true;
      lastDragEndTime = performance.now();
      // Replace Leaflet's default _offsetLimit (which uses bounds.getNorthWest/getSouthEast
      // and inverts Y in South Polar Stereographic) with exact projected Stereographic bounds.
      if (map.dragging) {
        const zoom = map.getZoom();
        const size = map.getSize();
        const curCenterPx = map.project(map.getCenter(), zoom);
        const paneBounds = computeDraggablePaneOffsetBounds(
          curCenterPx,
          size,
          zoom,
          HALF_EXTENT_M
        );
        map.dragging._offsetLimit = L.bounds(
          L.point(paneBounds.min.x, paneBounds.min.y),
          L.point(paneBounds.max.x, paneBounds.max.y)
        );
        map.dragging._viscosity = 1.0;
      }
    });

    map.on('move drag', (e) => {
      if (map.dragging && map.dragging.moved()) {
        didDrag = true;
        lastDragEndTime = performance.now();
      }
      if (dragStartPos && e.containerPoint) {
        const dist = Math.hypot(
          e.containerPoint.x - dragStartPos.x,
          e.containerPoint.y - dragStartPos.y
        );
        if (dist > 4) {
          didDrag = true;
          lastDragEndTime = performance.now();
        }
      }
    });

    map.on('dragend', () => {
      lastDragEndTime = performance.now();
      const center = map.getCenter();
      const limited = map._limitCenter(center, map.getZoom(), map.options.maxBounds);
      if (
        Math.abs(limited.lat - center.lat) > 1e-6 ||
        Math.abs(limited.lng - center.lng) > 1e-6
      ) {
        map.setView(limited, map.getZoom(), { animate: false });
      }
      drawOverlayCanvasRef.current?.();
      setTimeout(() => {
        didDrag = false;
        dragStartPos = null;
      }, 180);
    });

    const findNearestLandmarkAtPoint = (pointerPt) =>
      findNearestScreenMarker(
        pointerPt,
        SOUTH_POLE_LANDMARKS.map((lm) => ({
          item: lm,
          pt: map.latLngToContainerPoint(L.latLng(lm.latitude, lm.longitude)),
          priority: lm.priority,
        })),
        14
      );

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

      const hit = findNearestLandmarkAtPoint(e.containerPoint);
      setHoveredLandmarkId((prev) => (prev === (hit ? hit.id : null) ? prev : hit ? hit.id : null));
    });

    map.on('click', (e) => {
      if (
        didDrag ||
        performance.now() - lastDragEndTime < 220 ||
        (map.dragging && map.dragging.moved())
      ) {
        return;
      }
      if (dragStartPos && e.containerPoint) {
        const dist = Math.hypot(
          e.containerPoint.x - dragStartPos.x,
          e.containerPoint.y - dragStartPos.y
        );
        if (dist > 4) {
          return;
        }
      }
      const projected = southPoleCRS.projection.project(e.latlng);
      const { lat, lon } = stereographicMetersToLatLon(projected.x, projected.y);

      if (isRoutePlanningRef.current) {
        const hit = findNearestLandmarkAtPoint(e.containerPoint);

        if (onRoutePointClickRef.current) {
          onRoutePointClickRef.current({
            lat,
            lon,
            name: hit ? hit.name : null,
          });
        }
        return;
      }

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

      // Check Landmark Hit (nearest marker within 14px, avoiding array-order masking)
      const hit = findNearestLandmarkAtPoint(e.containerPoint);

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
        if (
          leafletMapRef.current &&
          Number.isFinite(hit.latitude) &&
          Number.isFinite(hit.longitude)
        ) {
          leafletMapRef.current.stop?.();
          leafletMapRef.current.panTo([hit.latitude, hit.longitude], { animate: false });
        }
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

    // Responsive container resize observer: recalculates zoom limits and valid pan bounds
    // while preserving the user's geographic focus whenever the viewport or panels change size.
    const handleContainerResize = () => {
      if (!leafletMapRef.current || !map._loaded || !map._mapPane) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      if (w <= 0 || h <= 0) return;

      const prevCenter = map.getCenter();
      const prevProj =
        prevCenter && !Number.isNaN(prevCenter.lat) && !Number.isNaN(prevCenter.lng)
          ? latLonToStereographicMeters(prevCenter.lat, prevCenter.lng)
          : { x: 0, y: 0 };

      map.invalidateSize({ pan: false, animate: false });

      const { minZoom, maxZoom } = computeViewportZoomLimits(w, h);
      if (map.getMinZoom() !== minZoom) {
        map.setMinZoom(minZoom);
      }
      if (map.getMaxZoom() !== maxZoom) {
        map.setMaxZoom(maxZoom);
      }

      const currentZoom = map.getZoom();
      const targetZoom = Math.max(minZoom, Math.min(maxZoom, currentZoom));
      const res = getResolutionForZoom(targetZoom);
      const clamped = computeClampedStereographicCenter(
        prevProj.x,
        prevProj.y,
        w,
        h,
        res,
        HALF_EXTENT_M
      );
      const nextCenter = stereographicMetersToLatLon(clamped.x, clamped.y);
      map.setView([nextCenter.lat, nextCenter.lon], targetZoom, { animate: false });
      setZoomLevel(targetZoom);
      drawOverlayCanvasRef.current?.();
    };

    let resizeObserver = null;
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => {
        handleContainerResize();
      });
      resizeObserver.observe(container);
    }

    const initTimer = setTimeout(() => {
      if (!leafletMapRef.current || !map._loaded || !map._mapPane) return;
      map.invalidateSize({ pan: false, animate: false });
      const size = map.getSize();
      const limits = computeViewportZoomLimits(size.x, size.y);
      map.setMinZoom(limits.minZoom);
      map.setMaxZoom(limits.maxZoom);
      map.setView([-90, 0], limits.optimalFitZoom, { animate: false });
      setZoomLevel(limits.optimalFitZoom);
      drawOverlayCanvasRef.current?.();
    }, 60);

    return () => {
      clearTimeout(initTimer);
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
      container.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
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

  const performResetView = useCallback(() => {
    const map = leafletMapRef.current;
    if (!map || !map._loaded || !map._mapPane) return;
    map.stop();
    isAnimatingRef.current = false;
    map.invalidateSize({ pan: false, animate: false });
    const size = map.getSize();
    const limits = computeViewportZoomLimits(size.x, size.y);
    map.setMinZoom(limits.minZoom);
    map.setMaxZoom(limits.maxZoom);
    map.setView([-90, 0], limits.optimalFitZoom, { animate: false });
    setZoomLevel(limits.optimalFitZoom);
    drawOverlayCanvasRef.current?.();
    requestAnimationFrame(() => {
      drawOverlayCanvasRef.current?.();
    });
  }, []);

  useEffect(() => {
    drawOverlayCanvas();
  }, [drawOverlayCanvas]);

  useEffect(() => {
    if (isVisible && leafletMapRef.current) {
      const map = leafletMapRef.current;
      const timer = setTimeout(() => {
        if (!leafletMapRef.current || !map._loaded || !map._mapPane) return;
        const center = map.getCenter();
        const prevProj =
          center && !Number.isNaN(center.lat) && !Number.isNaN(center.lng)
            ? latLonToStereographicMeters(center.lat, center.lng)
            : { x: 0, y: 0 };

        map.invalidateSize({ pan: false, animate: false });
        const size = map.getSize();
        const limits = computeViewportZoomLimits(size.x, size.y);
        map.setMinZoom(limits.minZoom);
        map.setMaxZoom(limits.maxZoom);

        const targetZoom = Math.max(limits.minZoom, Math.min(limits.maxZoom, map.getZoom()));
        if (
          Math.abs(prevProj.x) > MAX_PAN_EXTENT_M ||
          Math.abs(prevProj.y) > MAX_PAN_EXTENT_M
        ) {
          map.setView([-90, 0], limits.optimalFitZoom, { animate: false });
          setZoomLevel(limits.optimalFitZoom);
        } else {
          const clamped = computeClampedStereographicCenter(
            prevProj.x,
            prevProj.y,
            size.x,
            size.y,
            getResolutionForZoom(targetZoom),
            HALF_EXTENT_M
          );
          const nextCenter = stereographicMetersToLatLon(clamped.x, clamped.y);
          map.setView([nextCenter.lat, nextCenter.lon], targetZoom, { animate: false });
          setZoomLevel(targetZoom);
        }
        drawOverlayCanvasRef.current?.();
      }, 40);
      return () => clearTimeout(timer);
    }
  }, [isVisible, isLayersOpen, isRoutePlanning, Boolean(selectedFeature)]);

  useImperativeHandle(ref, () => ({
    clearSelectedLocation: () => {
      setProbedPin(null);
      setSelectedLocation(null);
      drawOverlayCanvasRef.current?.();
      requestAnimationFrame(() => {
        drawOverlayCanvasRef.current?.();
      });
    },
    zoomIn: () => leafletMapRef.current?.zoomIn(),
    zoomOut: () => leafletMapRef.current?.zoomOut(),
    resetOverview: () => {
      performResetView();
    },
    goToSouthPole: () => {
      performResetView();
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
      } else if (id.includes('landmark') || id.includes('site') || id.includes('mission')) {
        setShowLandmarks(Boolean(visible));
      }
    },
  }));

  return (
    <div
      className="relative w-full h-full overflow-hidden select-none"
      style={{ backgroundColor: TOPO_STYLE.canvas.backgroundColor }}
    >
      <div
        ref={mapContainerRef}
        className="w-full h-full z-0"
        style={{ backgroundColor: TOPO_STYLE.canvas.backgroundColor }}
      />

      <canvas
        ref={whiteOutlineCanvasRef}
        data-testid="white-outline-layer-canvas"
        data-layer-visible={whiteOutlineLayerStatus.isVisible ? 'true' : 'false'}
        data-meets-zoom-threshold={whiteOutlineLayerStatus.meetsZoomThreshold ? 'true' : 'false'}
        data-min-zoom={WHITE_OUTLINE_MIN_ZOOM}
        className="absolute inset-0 pointer-events-none z-10"
      />

      <canvas
        ref={greenConnectionCanvasRef}
        data-testid="green-connection-layer-canvas"
        data-layer-visible={greenConnectionLayerStatus.isVisible ? 'true' : 'false'}
        data-dsn-visible={greenConnectionLayerStatus.dsnConnectionVisible ? 'true' : 'false'}
        className="absolute inset-0 pointer-events-none z-[11]"
      />

      <canvas
        ref={overlayCanvasRef}
        data-testid="base-cartographic-layer-canvas"
        className="absolute inset-0 pointer-events-none z-[12]"
      />

      {isVisible && (
        <div
          data-testid="south-pole-scope-banner"
          className={`absolute z-20 pointer-events-none transition-all duration-200 ${
            isLayersOpen
              ? 'bottom-3 left-3 xl:bottom-auto xl:top-3 xl:left-[436px]'
              : 'top-3 left-16'
          } max-w-[calc(100vw-5.5rem)] sm:max-w-[540px]`}
        >
          <div className="px-3 py-2 rounded-xl bg-[#070A10]/90 backdrop-blur-md border border-white/15 shadow-[0_8px_28px_rgba(0,0,0,0.75)] flex flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-amber-500/15 border border-amber-400/35 text-[9.5px] font-mono font-bold uppercase tracking-wider text-amber-300">
                2D Map: Lunar South Pole Only
              </span>
              <span className="text-[10px] font-mono text-slate-200 tabular-nums">
                Lat: <strong className="text-white">{SOUTH_POLE_MAP_COVERAGE.latitudeRangeText}</strong> · Lon:{' '}
                <strong className="text-white">{SOUTH_POLE_MAP_COVERAGE.longitudeRangeText}</strong>
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[9.5px] font-mono text-slate-400">
              <span>
                Grid: <span className="text-slate-300">±304 km ({SOUTH_POLE_MAP_COVERAGE.crsCode})</span>
              </span>
              <span
                data-testid="white-outline-layer-status"
                className={
                  whiteOutlineLayerStatus.isVisible
                    ? 'text-white'
                    : 'text-slate-400'
                }
              >
                • White Outlines:{' '}
                {whiteOutlineLayerStatus.isVisible
                  ? `Shown (Zoom ${zoomLevel.toFixed(1)}x ≥ ${WHITE_OUTLINE_MIN_ZOOM}.0x)`
                  : !showContours && !showRidges
                    ? 'Off'
                    : `Hidden at Zoom ${zoomLevel.toFixed(1)}x (Zoom ≥ ${WHITE_OUTLINE_MIN_ZOOM}.0x to show)`}
              </span>
              <span
                data-testid="green-connection-layer-status"
                className={
                  greenConnectionLayerStatus.isVisible
                    ? 'text-emerald-400'
                    : 'text-slate-500'
                }
              >
                • Green Connection:{' '}
                {greenConnectionLayerStatus.dsnConnectionVisible
                  ? `Active (${Math.abs(subEarthLonDeg).toFixed(1)}°${subEarthLonDeg >= 0 ? 'E' : 'W'} DSN LOS)`
                  : greenConnectionLayerStatus.routeConnectionVisible
                    ? 'Active (Traverse Route)'
                    : 'Off'}
              </span>
            </div>
          </div>
        </div>
      )}

      {isVisible && isLayersOpen && (
        <SouthPoleLegendHUD
          isOpen={isLayersOpen}
          onClose={onCloseLayers}
          selectedLocation={selectedLocation}
          contourInterval={Math.max(200, currentIntervalEntry.intervalM)}
          indexInterval={Math.max(200, currentIntervalEntry.intervalM) * 5}
          zoomLevel={zoomLevel}
          whiteOutlineMinZoom={WHITE_OUTLINE_MIN_ZOOM}
          whiteOutlineStatus={whiteOutlineLayerStatus}
          greenConnectionStatus={greenConnectionLayerStatus}
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
