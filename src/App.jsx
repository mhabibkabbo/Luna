import React, { useState, useRef, useCallback } from 'react';
import LunarMap from './components/map/LunarMap.jsx';
import SearchBox from './components/search/SearchBox.jsx';
import CoordinateDisplay from './components/map/CoordinateDisplay.jsx';
import ScaleControl from './components/map/ScaleControl.jsx';
import MapControls from './components/map/MapControls.jsx';
import LayerPanel from './components/layers/LayerPanel.jsx';
import FeaturePanel from './components/features/FeaturePanel.jsx';
import MeasurementToolbar from './components/measurements/MeasurementToolbar.jsx';
import TerrainModeBar from './components/map/TerrainModeBar.jsx';
import { LUNAR_LAYERS_CATALOG } from './services/nasa/layers.js';
import { Layers, Ruler, Target } from 'lucide-react';

export default function App() {
  const mapRef = useRef(null);

  // Selenographic coordinates under cursor
  const [pointerCoords, setPointerCoords] = useState({ lon: 0.0, lat: 0.0 });
  const [currentZoom, setCurrentZoom] = useState(2.5);
  const [currentResolution, setCurrentResolution] = useState(0.24859);

  // Selected feature for detail inspection
  const [selectedFeature, setSelectedFeature] = useState(null);

  // Layer management state
  const [layers, setLayers] = useState(LUNAR_LAYERS_CATALOG);
  const [isLayersOpen, setIsLayersOpen] = useState(false);

  // Distance measurement tool state
  const [isMeasureActive, setIsMeasureActive] = useState(false);
  const [measurement, setMeasurement] = useState({
    coordinates: [],
    totalDistanceKm: 0,
    segmentDistancesKm: [],
    initialBearingDeg: 0,
    isComplete: false,
  });

  // Callbacks from Map
  const handlePointerCoordinates = useCallback((lon, lat) => {
    setPointerCoords({ lon, lat });
  }, []);

  const handleFeatureSelect = useCallback((featureProps) => {
    setSelectedFeature(featureProps);
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

  // Map control actions
  const handleZoomIn = () => mapRef.current?.zoomIn();
  const handleZoomOut = () => mapRef.current?.zoomOut();
  const handleResetOverview = () => mapRef.current?.resetOverview();
  const handleGoToSouthPole = () => mapRef.current?.goToSouthPole(4.8);

  // Search feature selection
  const handleSearchSelect = (feature) => {
    setSelectedFeature(feature);
    mapRef.current?.selectFeature(feature.id, true);
  };

  // Layer toggle handler
  const handleToggleLayer = (layerId, visible) => {
    setLayers((prev) =>
      prev.map((l) => (l.id === layerId ? { ...l, visible } : l))
    );
    const layer = layers.find((l) => l.id === layerId);
    mapRef.current?.setLayerVisibility(layerId, visible, layer?.opacity);
  };

  // Toggle all symbols on or off
  const handleToggleAllSymbols = (visible) => {
    const symbolLayerIds = [
      'lunar-mountains',
      'lunar-craters',
      'lunar-maria',
      'lunar-valleys',
      'apollo-landing-sites',
      'robotic-landing-sites',
    ];

    setLayers((prev) =>
      prev.map((l) => (symbolLayerIds.includes(l.id) ? { ...l, visible } : l))
    );

    symbolLayerIds.forEach((id) => {
      const layer = layers.find((l) => l.id === id);
      mapRef.current?.setLayerVisibility(id, visible, layer?.opacity);
    });
  };

  // Quick jump to coordinates
  const handleQuickJump = (lon, lat, zoom = 4.5) => {
    mapRef.current?.flyTo(lon, lat, zoom);
  };

  // Layer opacity handler
  const handleChangeOpacity = (layerId, opacity) => {
    setLayers((prev) =>
      prev.map((l) => (l.id === layerId ? { ...l, opacity } : l))
    );
    mapRef.current?.setLayerVisibility(layerId, true, opacity);
  };

  // Measurement mode toggling
  const handleToggleMeasure = () => {
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
    mapRef.current?.flyTo(lon, lat, zoom);
  };

  // Start measurement from feature
  const handleMeasureFromFeature = (lon, lat) => {
    if (!isMeasureActive) {
      setIsMeasureActive(true);
      mapRef.current?.activateMeasurement();
    }
    // Pan there
    mapRef.current?.flyTo(lon, lat, 4.0);
  };

  return (
    <div className="relative w-screen h-screen overflow-hidden flex flex-col bg-[#050811] text-slate-100 font-sans select-none">
      {/* ========================================================================= */}
      {/* TOP HEADER / SEARCH NAVIGATION BAR */}
      {/* ========================================================================= */}
      <header
        id="app-header"
        className="absolute top-0 left-0 right-0 z-30 h-14 px-3 sm:px-4 flex items-center justify-between gap-3 bg-slate-950/85 backdrop-blur-xl border-b border-slate-800/80 shadow-lg pointer-events-auto"
      >
        {/* Global Lunar Feature Search Box */}
        <div className="flex-1 max-w-lg">
          <SearchBox
            onSelectFeature={handleSearchSelect}
            onCoordinateSearch={([lon, lat]) => mapRef.current?.flyTo(lon, lat, 4)}
          />
        </div>

        {/* Action button shortcuts */}
        <div className="flex items-center gap-2 shrink-0">
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
      {/* INTERACTIVE 2D OPENLAYERS MAP CANVAS VIEWPORT */}
      {/* ========================================================================= */}
      <main className="relative w-full h-full pt-14">
        <LunarMap
          ref={mapRef}
          onPointerCoordinates={handlePointerCoordinates}
          onFeatureSelect={handleFeatureSelect}
          onMeasurementUpdate={handleMeasurementUpdate}
          onResolutionChange={handleResolutionChange}
        />

        {/* Floating Feature & Symbol Quick-Toggle Toolbar */}
        <TerrainModeBar
          layers={layers}
          onToggleLayer={handleToggleLayer}
          onToggleAllSymbols={handleToggleAllSymbols}
          onQuickJump={handleQuickJump}
          onGoToSouthPole={handleGoToSouthPole}
        />

        {/* Floating Map Navigation Controls (Zoom In/Out, Layers, Home Overview) */}
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
        />

        {/* Floating Measurement Toolbar */}
        <MeasurementToolbar
          isActive={isMeasureActive}
          measurement={measurement}
          onToggleActive={handleToggleMeasure}
          onClear={handleClearMeasurement}
        />
      </main>

      {/* ========================================================================= */}
      {/* BOTTOM SCIENTIFIC STATUS & SCALE BAR */}
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
            zoom={currentZoom}
          />
        </div>

        {/* Center: Dynamic Lunar Scale Bar */}
        <div className="hidden sm:flex items-center">
          <ScaleControl resolution={currentResolution} />
        </div>

        {/* Right: NASA Data Attribution */}
        <div className="flex items-center gap-2 text-[10px] text-slate-500 font-mono pointer-events-auto">
          <span className="hidden md:inline">NASA LRO WAC Photo Basemap</span>
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-slate-400">Live NASA WMTS</span>
        </div>
      </footer>
    </div>
  );
}
