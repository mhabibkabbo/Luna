import React, { useState, useRef, useCallback } from 'react';
import LunarMap from './components/map/LunarMap.jsx';
import LunarGlobe3D from './components/globe/LunarGlobe3D.jsx';
import SearchBox from './components/search/SearchBox.jsx';
import CoordinateDisplay from './components/map/CoordinateDisplay.jsx';
import ScaleControl from './components/map/ScaleControl.jsx';
import MapControls from './components/map/MapControls.jsx';
import LayerPanel from './components/layers/LayerPanel.jsx';
import FeaturePanel from './components/features/FeaturePanel.jsx';
import MeasurementToolbar from './components/measurements/MeasurementToolbar.jsx';
import TerrainModeBar from './components/map/TerrainModeBar.jsx';
import MoonPhaseWidget from './components/status/MoonPhaseWidget.jsx';
import { LUNAR_LAYERS_CATALOG } from './services/nasa/layers.js';
import { Layers, Ruler, Target, Globe, Map as MapIcon } from 'lucide-react';

export default function App() {
  const mapRef = useRef(null);
  const globeRef = useRef(null);

  // View mode: '3d' (Three.js 3D Globe) vs '2d' (OpenLayers Planar Map)
  const [viewMode, setViewMode] = useState('3d');

  // Selenographic coordinates under cursor
  const [pointerCoords, setPointerCoords] = useState({ lon: 0.0, lat: 0.0 });
  const [currentZoom, setCurrentZoom] = useState(2.5);
  const [currentResolution, setCurrentResolution] = useState(0.24859);

  // Selected feature for detail inspection
  const [selectedFeature, setSelectedFeature] = useState(null);

  // Layer management state
  const [layers, setLayers] = useState(LUNAR_LAYERS_CATALOG);
  const [isLayersOpen, setIsLayersOpen] = useState(false);

  // Distance measurement tool state (2D mode)
  const [isMeasureActive, setIsMeasureActive] = useState(false);
  const [measurement, setMeasurement] = useState({
    coordinates: [],
    totalDistanceKm: 0,
    segmentDistancesKm: [],
    initialBearingDeg: 0,
    isComplete: false,
  });

  // Active controller selector helper
  const getActiveController = () => (viewMode === '3d' ? globeRef.current : mapRef.current);

  // Custom user-dropped pin state
  const [customPin, setCustomPin] = useState(null);

  // Callbacks from Map / Globe
  const handlePointerCoordinates = useCallback((lon, lat) => {
    setPointerCoords({ lon, lat });
  }, []);

  const handleFeatureSelect = useCallback((featureProps) => {
    setSelectedFeature(featureProps);
  }, []);

  // Dropped custom pin on 3D globe
  const handleDropCustomPin = useCallback((pinData) => {
    setCustomPin(pinData);
    setSelectedFeature(pinData);
  }, []);

  // Clear custom pin
  const handleClearCustomPin = useCallback(() => {
    setCustomPin(null);
    globeRef.current?.clearCustomPin();
    setSelectedFeature((prev) => (prev?.isCustomPin ? null : prev));
  }, []);

  const handleMeasurementUpdate = useCallback((measureData) => {
    setMeasurement(measureData);
  }, []);

  const handleResolutionChange = useCallback((res) => {
    setCurrentResolution(res);
    if (mapRef.current) {
      const mapInst = mapRef.current.getMapInstance?.();
      if (mapInst) {
        setCurrentZoom(mapInst.getView().getZoom());
      }
    }
  }, []);

  // Controls actions
  const handleZoomIn = () => getActiveController()?.zoomIn();
  const handleZoomOut = () => getActiveController()?.zoomOut();
  const handleResetOverview = () => getActiveController()?.resetOverview();
  const handleGoToSouthPole = () => getActiveController()?.goToSouthPole(4.8);

  // Search feature selection
  const handleSearchSelect = (feature) => {
    setSelectedFeature(feature);
    getActiveController()?.selectFeature(feature.id, true);
  };

  // Layer toggle handler
  const handleToggleLayer = (layerId, visible) => {
    setLayers((prev) =>
      prev.map((l) => (l.id === layerId ? { ...l, visible } : l))
    );
    const layer = layers.find((l) => l.id === layerId);
    mapRef.current?.setLayerVisibility(layerId, visible, layer?.opacity);
    globeRef.current?.setLayerVisibility(layerId, visible);
  };

  // Toggle all symbols on or off
  const handleToggleAllSymbols = (visible) => {
    const symbolLayerIds = [
      'lunar-craters',
      'lunar-mountains',
      'lunar-maria',
      'lunar-valleys',
      'lunar-landing-sites',
    ];

    setLayers((prev) =>
      prev.map((l) => (symbolLayerIds.includes(l.id) ? { ...l, visible } : l))
    );

    symbolLayerIds.forEach((id) => {
      const layer = layers.find((l) => l.id === id);
      mapRef.current?.setLayerVisibility(id, visible, layer?.opacity);
      globeRef.current?.setLayerVisibility(id, visible);
    });
  };

  // Layer opacity handler
  const handleChangeOpacity = (layerId, opacity) => {
    setLayers((prev) =>
      prev.map((l) => (l.id === layerId ? { ...l, opacity } : l))
    );
    mapRef.current?.setLayerVisibility(layerId, true, opacity);
  };

  // Measurement mode toggling (2D)
  const handleToggleMeasure = () => {
    if (viewMode === '3d') {
      setViewMode('2d');
    }
    if (isMeasureActive) {
      setIsMeasureActive(false);
      mapRef.current?.deactivateMeasurement();
    } else {
      setIsMeasureActive(true);
      setIsLayersOpen(false);
      mapRef.current?.activateMeasurement();
    }
  };

  const handleClearMeasurement = () => {
    mapRef.current?.clearMeasurement();
  };

  // Fly to feature from panel
  const handleZoomHere = (lon, lat) => {
    const zoom = selectedFeature?.type === 'mare' ? 2.5 : 5.0;
    getActiveController()?.flyTo(lon, lat, zoom);
  };

  // Start measurement from feature
  const handleMeasureFromFeature = (lon, lat) => {
    if (viewMode === '3d') setViewMode('2d');
    if (!isMeasureActive) {
      setIsMeasureActive(true);
      mapRef.current?.activateMeasurement();
    }
    mapRef.current?.flyTo(lon, lat, 4.0);
  };

  return (
    <div className="relative w-screen h-screen overflow-hidden flex flex-col bg-[#050811] text-slate-100 font-sans select-none">
      {/* ========================================================================= */}
      {/* TOP HEADER / SEARCH & 2D/3D MODE NAVIGATION */}
      {/* ========================================================================= */}
      <header
        id="app-header"
        className="absolute top-0 left-0 right-0 z-30 h-14 px-3 sm:px-4 flex items-center justify-between gap-3 bg-slate-950/85 backdrop-blur-xl border-b border-slate-800/80 shadow-lg pointer-events-auto"
      >
        {/* Global Lunar Feature Search Box */}
        <div className="flex-1 max-w-lg">
          <SearchBox
            onSelectFeature={handleSearchSelect}
            onCoordinateSearch={([lon, lat]) => getActiveController()?.flyTo(lon, lat, 4)}
          />
        </div>

        {/* Action buttons & 2D/3D Globe Switcher */}
        <div className="flex items-center gap-2 shrink-0">
          {/* 2D / 3D Switcher */}
          <div className="flex items-center p-0.5 rounded-xl bg-slate-900 border border-slate-800 shadow-inner">
            <button
              type="button"
              id="btn-switch-3d"
              onClick={() => setViewMode('3d')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                viewMode === '3d'
                  ? 'bg-cyan-500 text-white shadow-md shadow-cyan-500/25'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Switch to Interactive 3D Lunar Globe"
            >
              <Globe className="w-3.5 h-3.5" />
              <span>3D Globe</span>
            </button>
            <button
              type="button"
              id="btn-switch-2d"
              onClick={() => setViewMode('2d')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                viewMode === '2d'
                  ? 'bg-cyan-500 text-white shadow-md shadow-cyan-500/25'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Switch to 2D Planar Basemap"
            >
              <MapIcon className="w-3.5 h-3.5" />
              <span>2D Map</span>
            </button>
          </div>

          <button
            type="button"
            id="btn-header-south-pole"
            onClick={handleGoToSouthPole}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-cyan-950/90 text-cyan-300 hover:text-white hover:bg-cyan-600/90 border border-cyan-500/40 shadow-lg shadow-cyan-950/50 transition-all select-none group"
            title="Fly directly to the Lunar South Pole (90°S)"
          >
            <Target className="w-3.5 h-3.5 text-cyan-400 group-hover:rotate-90 transition-transform duration-300" />
            <span className="hidden xs:inline">South Pole</span>
            <span className="text-[10px] font-mono text-cyan-200">90°S</span>
          </button>

          {viewMode === '2d' && (
            <button
              type="button"
              onClick={handleToggleMeasure}
              className={`hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition-all ${
                isMeasureActive
                  ? 'bg-amber-500 text-white border-amber-400 shadow-lg shadow-amber-500/20'
                  : 'bg-slate-900/90 hover:bg-slate-800 text-slate-300 hover:text-white border-slate-800'
              }`}
            >
              <Ruler className="w-3.5 h-3.5" />
              <span>Measure</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setIsLayersOpen((prev) => !prev)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition-all ${
              isLayersOpen
                ? 'bg-cyan-500 text-white border-cyan-400 shadow-lg shadow-cyan-500/20'
                : 'bg-slate-900/90 hover:bg-slate-800 text-slate-300 hover:text-white border-slate-800'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Layers</span>
          </button>
        </div>
      </header>

      {/* ========================================================================= */}
      {/* MAP / GLOBE VIEWPORT */}
      {/* ========================================================================= */}
      <main className="relative w-full h-full pt-14">
        {viewMode === '3d' ? (
          <LunarGlobe3D
            ref={globeRef}
            onPointerCoordinates={handlePointerCoordinates}
            onFeatureSelect={handleFeatureSelect}
            onDropCustomPin={handleDropCustomPin}
            hasCustomPin={!!customPin}
            onClearCustomPin={handleClearCustomPin}
          />
        ) : (
          <LunarMap
            ref={mapRef}
            onPointerCoordinates={handlePointerCoordinates}
            onFeatureSelect={handleFeatureSelect}
            onMeasurementUpdate={handleMeasurementUpdate}
            onResolutionChange={handleResolutionChange}
          />
        )}

        {/* Floating Feature & Symbol Quick-Toggle Toolbar */}
        <TerrainModeBar
          layers={layers}
          onToggleLayer={handleToggleLayer}
          onToggleAllSymbols={handleToggleAllSymbols}
          onGoToSouthPole={handleGoToSouthPole}
        />

        {/* Floating Map Navigation Controls */}
        <div className="absolute bottom-16 right-4 z-20">
          <MapControls
            onZoomIn={handleZoomIn}
            onZoomOut={handleZoomOut}
            onResetOverview={handleResetOverview}
            onGoToSouthPole={handleGoToSouthPole}
            onToggleLayers={() => setIsLayersOpen((prev) => !prev)}
            isLayersOpen={isLayersOpen}
            onToggleMeasure={handleToggleMeasure}
            isMeasureActive={isMeasureActive}
          />
        </div>

        {/* Floating Layer Management Panel */}
        <LayerPanel
          isOpen={isLayersOpen}
          onClose={() => setIsLayersOpen(false)}
          layers={layers}
          onToggleLayer={handleToggleLayer}
          onChangeOpacity={handleChangeOpacity}
        />

        {/* Floating Feature Details Panel */}
        <FeaturePanel
          feature={selectedFeature}
          onClose={() => setSelectedFeature(null)}
          onZoomHere={handleZoomHere}
          onMeasureFromHere={handleMeasureFromFeature}
          onClearCustomPin={handleClearCustomPin}
        />

        {/* Floating Measurement Toolbar (2D) */}
        {viewMode === '2d' && (
          <MeasurementToolbar
            isActive={isMeasureActive}
            measurement={measurement}
            onToggleActive={handleToggleMeasure}
            onClear={handleClearMeasurement}
          />
        )}
      </main>

      {/* ========================================================================= */}
      {/* BOTTOM STATUS & SCALE BAR */}
      {/* ========================================================================= */}
      <footer
        id="app-bottom-bar"
        className="absolute bottom-0 left-0 right-0 z-20 flex items-center justify-between gap-3 px-3 sm:px-4 py-2 bg-slate-950/80 backdrop-blur-xl border-t border-slate-800/80 shadow-lg pointer-events-none"
      >
        {/* Left: Dynamic Selenographic Coordinates */}
        <div className="flex items-center gap-2 pointer-events-auto">
          <CoordinateDisplay
            longitude={pointerCoords.lon}
            latitude={pointerCoords.lat}
            zoom={viewMode === '3d' ? 3.0 : currentZoom}
          />
        </div>

        {/* Center: Dynamic Scale Bar for 2D */}
        {viewMode === '2d' && (
          <div className="hidden sm:flex items-center">
            <ScaleControl resolution={currentResolution} />
          </div>
        )}

        {/* Right: Real-time Moon Phase Widget & NASA Attribution */}
        <div className="flex items-center gap-3 pointer-events-auto">
          <MoonPhaseWidget />

          <div className="hidden lg:flex items-center gap-2 text-[10px] text-slate-500 font-mono">
            <span className="hidden xl:inline">NASA LRO Mosaic</span>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-slate-400">Live WMTS</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

