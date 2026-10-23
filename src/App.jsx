/**
 * @file App.jsx
 * Root application component that coordinates the map, planet viewport, and panels.
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import LunarMap from './components/map/LunarMap.jsx';
import PlanetViewport from './components/globe/PlanetViewport.jsx';
import SearchBox from './components/search/SearchBox.jsx';
import MapControls from './components/map/MapControls.jsx';
import LayerPanel from './components/layers/LayerPanel.jsx';
import FeaturePanel from './components/features/FeaturePanel.jsx';
import LunarSunlightTimeline from './components/features/LunarSunlightTimeline.jsx';
import MeasurementToolbar from './components/measurements/MeasurementToolbar.jsx';
import CelestialPanel from './components/celestial/CelestialPanel.jsx';
import UnifiedToolbar from './components/navigation/UnifiedToolbar.jsx';
import TelemetryStatusBar from './components/map/TelemetryStatusBar.jsx';
import MoonPhaseWidget from './components/status/MoonPhaseWidget.jsx';
import MissionExplorerModal from './components/missions/MissionExplorerModal.jsx';
import MissionComparisonModal from './components/missions/MissionComparisonModal.jsx';
import LandingPage from './components/landing/LandingPage.jsx';
import LunaBrandLogo from './components/common/LunaBrandLogo.jsx';
import { CLPS_MISSIONS } from './data/clpsMissions.js';
import { LUNAR_LAYERS_CATALOG } from './services/nasa/layers.js';
import { Layers, Ruler, Globe, Map as MapIcon, Moon, Sun, ArrowLeft } from 'lucide-react';

import { pointerStore, mapViewStore } from './utils/pointerStore.js';
import { celestialTimeStore } from './utils/celestialTime.js';
import { computeCommunicationLink } from './utils/communication.js';
export default function App() {
  const mapRef = useRef(null);
  const globeRef = useRef(null);

  // App View: 'landing' (cinematic overview & mission discovery) vs 'explorer' (interactive 3D/2D lunar GIS)
  const [currentView, setCurrentView] = useState(() => {
    if (typeof window !== 'undefined') {
      const hash = window.location.hash.toLowerCase();
      if (hash.includes('explorer') || hash.includes('map') || hash.includes('globe')) {
        return 'explorer';
      }
    }
    return 'landing';
  });

  // Listen to hash changes (for browser back/forward buttons and direct bookmark navigation)
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.toLowerCase();
      if (hash.includes('explorer') || hash.includes('map') || hash.includes('globe')) {
        setCurrentView('explorer');
      } else if (
        hash === '' ||
        hash === '#' ||
        hash.includes('landing') ||
        hash.includes('about') ||
        hash.includes('explore') ||
        hash.includes('missions') ||
        hash.includes('datasources')
      ) {
        setCurrentView('landing');
      }
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // View mode: '3d' (Cesium 3D Globe) vs '2d' (OpenLayers Planar Map)
  // 3D Moon is available on all platforms (mobile and desktop)
  const [viewMode, setViewMode] = useState(() => {
    if (typeof window !== 'undefined') {
      const hash = window.location.hash.toLowerCase();
      if (hash.includes('2d') || hash.includes('planar')) {
        return '2d';
      }
    }
    return '3d';
  });

  // In 3D: 'moon' vs 'earth'
  const [activePlanet, setActivePlanet] = useState('moon');

  // Selenographic coordinates under cursor

  // Selected feature for detail inspection
  const [selectedFeature, setSelectedFeature] = useState(null);
  const [selectedMoonFeature, setSelectedMoonFeature] = useState(null);
  const [selectedEarthFeature, setSelectedEarthFeature] = useState(null);

  // Layer & Tool drawers
  const [layers, setLayers] = useState(LUNAR_LAYERS_CATALOG);
  const [isLayersOpen, setIsLayersOpen] = useState(false);
  const [isCelestialOpen, setIsCelestialOpen] = useState(false);
  const [isMissionExplorerOpen, setIsMissionExplorerOpen] = useState(false);
  const [isComparisonOpen, setIsComparisonOpen] = useState(false);
  const [comparisonMissionA, setComparisonMissionA] = useState(null);

  // Distance measurement tool state (2D mode)
  const [isMeasureActive, setIsMeasureActive] = useState(false);
  const [isAutoRotating, setIsAutoRotating] = useState(false);
  const [isSolarLighting, setIsSolarLighting] = useState(false);
  const [isVectorsVisible, setIsVectorsVisible] = useState(false); // Vector arrows from Earth & Sun default OFF
  const [measurement, setMeasurement] = useState({
    coordinates: [],
    totalDistanceKm: 0,
    segmentDistancesKm: [],
    initialBearingDeg: 0,
    isComplete: false,
  });

  // Active controller selector helper
  const getActiveController = () => (viewMode === '3d' ? globeRef.current : mapRef.current);

  useEffect(() => {
    if (viewMode !== '3d') return;
    const lightingEnabled = globeRef.current?.getLightingEnabled?.();
    if (lightingEnabled !== undefined) {
      setIsSolarLighting(lightingEnabled);
    }
  }, [activePlanet, viewMode]);

  // Custom user-dropped pin state
  const [customPin, setCustomPin] = useState(null);

  const setFeatureSelection = useCallback((feature, body = 'moon') => {
    if (!feature) return;
    const normalized = feature.body === body ? feature : { ...feature, body };
    setSelectedFeature(normalized);
    if (body === 'earth') {
      setSelectedEarthFeature(normalized);
    } else {
      setSelectedMoonFeature(normalized);
    }
  }, []);

  const handlePlanetChange = (body) => {
    setActivePlanet(body);
    setSelectedFeature(body === 'earth' ? selectedEarthFeature : selectedMoonFeature);
  };

  // Callbacks from Map / Globe
  const handlePointerCoordinates = useCallback((lon, lat) => {
    pointerStore.set({ lon, lat });
  }, []);

  const handleFeatureSelect = useCallback((featureProps) => {
    const body = featureProps?.body === 'earth' ? 'earth' : 'moon';
    setFeatureSelection(featureProps, body);
    if (viewMode === '3d' && featureProps?.id) {
      globeRef.current?.selectFeaturePin?.(featureProps.id, body);
    }
  }, [setFeatureSelection, viewMode]);

  // Dropped custom pin on 3D globe
  const handleDropCustomPin = useCallback((pinData) => {
    const body = pinData?.body === 'earth' ? 'earth' : 'moon';
    const normalized = pinData?.body === body ? pinData : { ...pinData, body };
    setCustomPin(normalized);
    setFeatureSelection(normalized, body);
  }, [setFeatureSelection]);

  // Clear custom pin
  const handleClearCustomPin = useCallback((planetId = activePlanet) => {
    const body = planetId === 'earth' ? 'earth' : 'moon';
    setCustomPin((pin) => (pin?.body === body ? null : pin));
    globeRef.current?.clearCustomPin(body);
    if (body === 'earth') {
      setSelectedEarthFeature((feature) => (feature?.isCustomPin ? null : feature));
    } else {
      setSelectedMoonFeature((feature) => (feature?.isCustomPin ? null : feature));
    }
    setSelectedFeature((feature) =>
      feature?.isCustomPin && feature.body === body ? null : feature
    );
  }, [activePlanet]);

  useEffect(() => {
    if (
      viewMode !== '3d' ||
      !selectedMoonFeature ||
      !selectedEarthFeature
    ) {
      globeRef.current?.setCommunicationLink?.(null);
      return undefined;
    }

    let alive = true;
    let unsubscribe = null;
    const updateLink = (timeMs) => {
      if (!alive) return;
      try {
        const link = computeCommunicationLink({
          moonFeature: selectedMoonFeature,
          earthFeature: selectedEarthFeature,
          when: timeMs,
        });
        globeRef.current?.setCommunicationLink?.(link);
      } catch (error) {
        console.error('Failed to update the Earth-Moon communication line.', error);
        globeRef.current?.setCommunicationLink?.(null);
      }
    };

    updateLink(celestialTimeStore.get().ms);
    unsubscribe = celestialTimeStore.subscribe(({ ms }) => updateLink(ms));

    return () => {
      alive = false;
      unsubscribe?.();
      globeRef.current?.setCommunicationLink?.(null);
    };
  }, [selectedMoonFeature, selectedEarthFeature, viewMode]);

  const handleMeasurementUpdate = useCallback((measureData) => {
    setMeasurement(measureData);
  }, []);

  const handleResolutionChange = useCallback((res) => {
    const mapInst = mapRef.current?.getMapInstance?.();
    mapViewStore.set({
      resolution: res,
      zoom: mapInst ? mapInst.getView().getZoom() : mapViewStore.get().zoom,
    });
  }, []);

  // Controls actions
  const handleZoomIn = () => getActiveController()?.zoomIn();
  const handleZoomOut = () => getActiveController()?.zoomOut();
  const handleResetOverview = () => getActiveController()?.resetOverview();
  const handleGoToSouthPole = () => {
    if (viewMode === '3d' && activePlanet !== 'moon') {
      handlePlanetChange('moon');
    }
    if (getActiveController()?.goToSouthPole) {
      getActiveController()?.goToSouthPole(4.8);
    } else {
      getActiveController()?.flyTo(0, -90, 4.8);
    }
  };

  const handleToggleAutoRotate = () => {
    if (globeRef.current) {
      const state = globeRef.current.toggleAutoRotate();
      setIsAutoRotating(state);
    }
  };

  const handleToggleLighting = () => {
    if (globeRef.current) {
      const state = globeRef.current.toggleLighting();
      setIsSolarLighting(state);
    }
  };

  const handleToggleVectors = () => {
    if (globeRef.current) {
      const next = !isVectorsVisible;
      setIsVectorsVisible(next);
      globeRef.current.setCelestialVectorsVisible?.(next);
    }
  };

  // Search feature selection
  const handleSearchSelect = (feature) => {
    const body = feature.body === 'earth' ? 'earth' : 'moon';
    if (viewMode === '3d' && activePlanet !== body) {
      handlePlanetChange(body);
    }
    if (viewMode === '3d') {
      globeRef.current?.switchPlanet?.(body);
      globeRef.current?.selectFeaturePin?.(feature.id, body);
      globeRef.current?.flyTo?.(feature.longitude, feature.latitude);
    } else {
      getActiveController()?.selectFeature(feature.id, true);
    }
    setFeatureSelection(feature, body);
  };

  // Quick Expedition Selection
  const handleSelectExpedition = (feature, lon, lat, zoom = 5.0) => {
    if (viewMode === '3d' && activePlanet !== 'moon') {
      handlePlanetChange('moon');
    }
    setFeatureSelection(feature, 'moon');
    if (viewMode === '3d') {
      globeRef.current?.switchPlanet?.('moon');
      globeRef.current?.selectFeaturePin?.(feature.id, 'moon');
    }
    getActiveController()?.flyTo(lon, lat, zoom);
  };

  const handleOpenComparison = (initialMission = null) => {
    setComparisonMissionA(initialMission);
    setIsComparisonOpen(true);
  };

  const handleSelectMissionFromModal = (mission) => {
    const lon = mission.verifiedCoordinates?.longitude ?? mission.lon ?? 0;
    const lat = mission.verifiedCoordinates?.latitude ?? mission.lat ?? 0;
    const zoom = mission.defaultZoom || 5.2;
    handleSelectExpedition(mission, lon, lat, zoom);
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
    if (viewMode === '3d' && activePlanet === 'earth') {
      getActiveController()?.flyTo(lon, lat, 500_000);
      return;
    }
    const zoom = selectedFeature?.type === 'mare' ? 2.5 : 5.0;
    getActiveController()?.flyTo(lon, lat, zoom);
  };

  const handleSelectOtherBody = (body) => {
    setViewMode('3d');
    handlePlanetChange(body);
    globeRef.current?.switchPlanet?.(body);
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

  // Launch Lunar Explorer from Landing Page
  const handleLaunchExplorer = (options = {}) => {
    if (options.viewMode) {
      setViewMode(options.viewMode);
    }
    setCurrentView('explorer');
    window.location.hash = '#explorer';

    // If an explicit feature or mission was targeted
    if (options.selectedFeature) {
      setTimeout(() => {
        const feat = options.selectedFeature;
        const lon = feat.longitude ?? feat.lon ?? options.lon ?? 0;
        const lat = feat.latitude ?? feat.lat ?? options.lat ?? 0;
        handleSelectExpedition(feat, lon, lat, options.zoom || 5.0);
      }, 350);
    } else if (options.selectedMission || options.missionId) {
      const mission =
        options.selectedMission ||
        CLPS_MISSIONS.find((m) => m.id === options.missionId);
      if (mission) {
        setTimeout(() => {
          handleSelectMissionFromModal(mission);
        }, 350);
      }
    } else if (typeof options.lon === 'number' && typeof options.lat === 'number') {
      setTimeout(() => {
        getActiveController()?.flyTo(options.lon, options.lat, options.zoom || 5.0);
      }, 350);
    } else if (options.target === 'south-pole') {
      setTimeout(() => {
        handleGoToSouthPole();
      }, 350);
    }

    if (options.openCelestial) {
      setIsCelestialOpen(true);
    }
    if (options.openLayers) {
      setIsLayersOpen(true);
    }
    if (options.activateMeasure) {
      setIsMeasureActive(true);
      mapRef.current?.activateMeasurement();
    }
  };

  // Return from Explorer to Landing Page
  const handleReturnToLanding = () => {
    setCurrentView('landing');
    window.location.hash = '#';
  };

  const otherBody = selectedFeature?.body === 'earth' ? 'moon' : 'earth';
  const canSelectOtherBody =
    selectedFeature &&
    (otherBody === 'moon' ? !selectedMoonFeature : !selectedEarthFeature);
  const hasMoonCoordinates =
    Number.isFinite(selectedMoonFeature?.latitude) &&
    Number.isFinite(selectedMoonFeature?.longitude);
  const showLunarTimeline =
    hasMoonCoordinates &&
    (viewMode === '2d' ||
      activePlanet === 'moon' ||
      Boolean(selectedEarthFeature));
  const selectedCommunicationEarthFeature =
    selectedMoonFeature && selectedEarthFeature ? selectedEarthFeature : null;

  // Render Landing Page if currentView is 'landing'
  if (currentView === 'landing') {
    return <LandingPage onLaunchExplorer={handleLaunchExplorer} />;
  }

  return (
    <div className="relative w-screen h-screen overflow-hidden flex flex-col bg-black text-slate-100 font-sans select-none animate-in fade-in duration-200">
      {/* ========================================================================= */}
      {/* TOP HEADER: Clean NASA-inspired compact navigation */}
      {/* ========================================================================= */}
      <header
        id="app-header"
        className="absolute top-0 left-0 right-0 z-30 h-12 px-3 sm:px-4 flex items-center justify-between gap-2.5 bg-[#040711]/55 backdrop-blur-xl border-b border-slate-800/50 shadow-none pointer-events-auto"
      >
        {/* Unified Luna Brand Logo & Quick Back to Home indicator */}
        <div className="flex items-center gap-2 shrink-0">
          <LunaBrandLogo
            asButton
            onClick={handleReturnToLanding}
            showBackIndicator
            backLabel="Home"
            title="Return to Luna Overview & Mission Discovery"
          />
        </div>

        {/* Search Field & View Switcher */}
        <div className="flex items-center gap-2 sm:gap-3 flex-1 max-w-lg justify-center">
          <div className="w-full max-w-xs sm:max-w-sm">
            <SearchBox
              body={viewMode === '3d' ? activePlanet : 'moon'}
              onSelectFeature={handleSearchSelect}
              onCoordinateSearch={([lon, lat]) => getActiveController()?.flyTo(lon, lat, 4)}
            />
          </div>

          {/* 2D / 3D Mode Segmented Switcher */}
          <div className="flex items-center p-0.5 rounded-lg bg-slate-900/90 border border-slate-800/90 shrink-0">
            <button
              type="button"
              id="btn-switch-3d"
              onClick={() => setViewMode('3d')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs transition-all ${
                viewMode === '3d'
                  ? 'bg-slate-800 text-cyan-300 font-semibold border border-cyan-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="3D Cesium Orbit View"
            >
              <Globe className="w-3 h-3" />
              <span>3D</span>
            </button>
            <button
              type="button"
              id="btn-switch-2d"
              onClick={() => setViewMode('2d')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs transition-all ${
                viewMode === '2d'
                  ? 'bg-slate-800 text-cyan-300 font-semibold border border-cyan-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="2D Planar GIS Map"
            >
              <MapIcon className="w-3 h-3" />
              <span>2D</span>
            </button>
          </div>

          {/* 3D Moon vs Earth comparison toggle */}
          {viewMode === '3d' && (
            <div className="hidden xl:flex items-center p-0.5 rounded-lg bg-slate-900/90 border border-slate-800/90 shrink-0">
              <button
                type="button"
                onClick={() => handlePlanetChange('moon')}
                className={`px-2 py-0.5 rounded text-[11px] font-medium transition-all ${
                  activePlanet === 'moon'
                    ? 'bg-slate-800 text-cyan-300 font-semibold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Moon
              </button>
              <button
                type="button"
                onClick={() => handlePlanetChange('earth')}
                className={`px-2 py-0.5 rounded text-[11px] font-medium transition-all ${
                  activePlanet === 'earth'
                    ? 'bg-slate-800 text-blue-300 font-semibold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Earth
              </button>
            </div>
          )}
        </div>

        {/* Right Actions: Ephemeris, Measure, Layers & Moon Phase */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Live Astronomical Moon Phase */}
          <div className="hidden lg:block">
            <MoonPhaseWidget />
          </div>

          {/* 3D Ephemeris Drawer */}
          {viewMode === '3d' && (
            <button
              type="button"
              id="btn-toggle-ephemeris"
              onClick={() => setIsCelestialOpen((prev) => !prev)}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                isCelestialOpen
                  ? 'bg-amber-950/80 text-amber-300 border-amber-500/40 shadow-sm'
                  : 'bg-slate-900/80 hover:bg-slate-800 text-slate-300 hover:text-white border-slate-800'
              }`}
              title="Earth & Sun Solar Terminator Ephemeris"
            >
              <Sun className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden sm:inline">Ephemeris</span>
            </button>
          )}

          {/* 2D Geodesic Measurement */}
          {viewMode === '2d' && (
            <button
              type="button"
              onClick={handleToggleMeasure}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                isMeasureActive
                  ? 'bg-amber-950/80 text-amber-300 border-amber-500/40 shadow-sm'
                  : 'bg-slate-900/80 hover:bg-slate-800 text-slate-300 hover:text-white border-slate-800'
              }`}
              title="Measure surface distance"
            >
              <Ruler className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden sm:inline">Measure</span>
            </button>
          )}

          {/* Map Layers Panel Toggle */}
          <button
            type="button"
            onClick={() => setIsLayersOpen((prev) => !prev)}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all ${
              isLayersOpen
                ? 'bg-cyan-950/80 text-cyan-300 border-cyan-500/40 shadow-sm'
                : 'bg-slate-900/80 hover:bg-slate-800 text-slate-300 hover:text-white border-slate-800'
            }`}
            title={activePlanet === 'earth' ? 'Toggle Earth Layers' : 'Toggle Map Layers & NASA Datasets'}
          >
            <Layers className="w-3.5 h-3.5 text-cyan-400" />
            <span className="hidden sm:inline">Layers</span>
          </button>
        </div>
      </header>

      {/* ========================================================================= */}
      {/* UNIFIED COMPACT MISSION & SURFACE EXPLORER TOOLBAR */}
      {/* Replaces the two crowded rows with one streamlined, minimal control strip */}
      {/* ========================================================================= */}
      <UnifiedToolbar
        layers={layers}
        onToggleLayer={handleToggleLayer}
        onToggleAllSymbols={handleToggleAllSymbols}
        onGoToSouthPole={handleGoToSouthPole}
        onSelectExpedition={handleSelectExpedition}
        onOpenMissionExplorer={() => setIsMissionExplorerOpen(true)}
        onOpenComparison={() => handleOpenComparison(null)}
      />

      {/* ========================================================================= */}
      {/* MAIN VIEWPORT: Moon & Terrain occupy 100% of the canvas */}
      {/* Both Viewers are kept mounted to preserve tile caches, camera states, and GPU memory */}
      {/* ========================================================================= */}
      <main className="relative w-full h-full">
        {/* 3D Cesium Orbit View */}
        <div
          className={`absolute inset-0 w-full h-full ${
            viewMode === '3d' ? 'block' : 'hidden'
          }`}
        >
          <PlanetViewport
            ref={globeRef}
            onPointerCoordinates={handlePointerCoordinates}
            onFeatureSelect={handleFeatureSelect}
            onDropCustomPin={handleDropCustomPin}
            hasCustomPin={!!customPin}
            onClearCustomPin={handleClearCustomPin}
            activePlanet={activePlanet}
            onPlanetChange={handlePlanetChange}
            isVisible={viewMode === '3d'}
          />
        </div>

        {/* 2D Planar GIS Map */}
        <div
          className={`absolute inset-0 w-full h-full ${
            viewMode === '2d' ? 'block' : 'hidden'
          }`}
        >
          <LunarMap
            ref={mapRef}
            onPointerCoordinates={handlePointerCoordinates}
            onFeatureSelect={handleFeatureSelect}
            onMeasurementUpdate={handleMeasurementUpdate}
            onResolutionChange={handleResolutionChange}
            isVisible={viewMode === '2d'}
          />
        </div>

        {/* Real-time Earth & Sun Ephemeris Drawer (3D Mode) */}
        <CelestialPanel
          globeRef={globeRef}
          isActive={viewMode === '3d'}
          isOpen={isCelestialOpen}
          onClose={() => setIsCelestialOpen(false)}
          vectorsVisible={isVectorsVisible}
          onToggleVectors={handleToggleVectors}
        />

        {/* Single Compact Floating Control Cluster */}
        <div
          className={`absolute right-3 sm:right-4 z-20 ${
            showLunarTimeline ? 'bottom-[110px]' : 'bottom-9'
          }`}
        >
          <MapControls
            viewMode={viewMode}
            onZoomIn={handleZoomIn}
            onZoomOut={handleZoomOut}
            onResetOverview={handleResetOverview}
            onGoToSouthPole={handleGoToSouthPole}
            onToggleMeasure={handleToggleMeasure}
            isMeasureActive={isMeasureActive}
            onToggleAutoRotate={handleToggleAutoRotate}
            isAutoRotating={isAutoRotating}
            onToggleLighting={handleToggleLighting}
            isSolarLighting={isSolarLighting}
            onToggleVectors={handleToggleVectors}
            isVectorsVisible={isVectorsVisible}
          />
        </div>

        {/* Floating Layer Management Panel */}
        <LayerPanel
          isOpen={isLayersOpen}
          onClose={() => setIsLayersOpen(false)}
          layers={layers}
          onToggleLayer={handleToggleLayer}
          onChangeOpacity={handleChangeOpacity}
          activePlanet={activePlanet}
        />

        {/* Collapsible Mission / Feature Details Side Panel & Mobile Bottom Sheet */}
        <FeaturePanel
          feature={selectedFeature}
          timelineVisible={showLunarTimeline}
          onClose={() => setSelectedFeature(null)}
          onZoomHere={handleZoomHere}
          onMeasureFromHere={handleMeasureFromFeature}
          onClearCustomPin={handleClearCustomPin}
          onCompareMission={(mission) => handleOpenComparison(mission)}
          onSelectOtherBody={
            canSelectOtherBody ? handleSelectOtherBody : undefined
          }
        />

        {showLunarTimeline && (
          <LunarSunlightTimeline
            feature={selectedMoonFeature}
            earthFeature={selectedCommunicationEarthFeature}
          />
        )}

        {/* 2D Geodesic Measurement Status Ribbon */}
        {viewMode === '2d' && (
          <MeasurementToolbar
            isActive={isMeasureActive}
            measurement={measurement}
            onToggleActive={handleToggleMeasure}
            onClear={handleClearMeasurement}
          />
        )}

        {/* Dedicated NASA CLPS Mission Explorer Dialog */}
        <MissionExplorerModal
          isOpen={isMissionExplorerOpen}
          onClose={() => setIsMissionExplorerOpen(false)}
          onSelectMission={handleSelectMissionFromModal}
          onCompareMission={(mission) => {
            setIsMissionExplorerOpen(false);
            handleOpenComparison(mission);
          }}
          currentSelectedId={selectedFeature?.id}
        />

        {/* Side-by-side CLPS Mission Comparison Modal */}
        <MissionComparisonModal
          isOpen={isComparisonOpen}
          onClose={() => setIsComparisonOpen(false)}
          initialMissionA={comparisonMissionA}
          onSelectMission={(mission) => {
            setIsComparisonOpen(false);
            handleSelectMissionFromModal(mission);
          }}
        />
      </main>

      {/* ========================================================================= */}
      {/* DISCREET STATUS BAR AT BOTTOM EDGE */}
      {/* ========================================================================= */}
      <TelemetryStatusBar
        viewMode={viewMode}
        selectedFeature={selectedFeature}
      />
    </div>
  );
}
