/**
 * @file App.jsx
 * Root application component that coordinates the map, planet viewport, and panels.
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import LunarMap from './components/map/LunarMap.jsx';
import SouthPoleTopoMap from './components/map/SouthPoleTopoMap.jsx';
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
import MissionExplorerModal from './components/missions/MissionExplorerModal.jsx';
import MissionComparisonModal from './components/missions/MissionComparisonModal.jsx';
import SlipSimulatorModal from './components/missions/SlipSimulatorModal.jsx';
import DteCalculationModal from './components/communication/DteCalculationModal.jsx';
import SiteAnalysisModal from './components/analysis/SiteAnalysisModal.jsx';
import LunarWeatherModal from './components/status/LunarWeatherModal.jsx';
import LandingPage from './components/landing/LandingPage.jsx';
import MissionsPage from './components/missions/MissionsPage.jsx';
import TransparentLunarSearch from './components/search/TransparentLunarSearch.jsx';
import LunaBrandLogo from './components/common/LunaBrandLogo.jsx';
import ToastFeedback from './components/common/ToastFeedback.jsx';
import { CLPS_MISSIONS } from './data/clpsMissions.js';
import { LUNAR_LAYERS_CATALOG } from './services/nasa/layers.js';
import { Layers, Ruler, Globe, Map as MapIcon, Moon, Sun, Radio, Compass, Thermometer, Sparkles, ChevronDown } from 'lucide-react';

import { pointerStore, mapViewStore } from './utils/pointerStore.js';
import { celestialTimeStore } from './utils/celestialTime.js';
import { computeCommunicationLink } from './utils/communication.js';
import { computeCelestialState } from './utils/lunarEphemeris.js';
import { DEFAULT_DTE_CONSTRAINTS, evaluateEarthLink } from './utils/earthLink.js';
import { HORIZON_TABLE, horizonAt } from './utils/horizons.js';
import {
  notifySuccess,
  notifyInfo,
  notifyNavigation,
  notifyWarn,
} from './utils/feedbackStore.js';
export default function App() {
  const mapRef = useRef(null);
  const southPoleMapRef = useRef(null);
  const globeRef = useRef(null);

  // App View: 'landing' (cinematic overview & mission discovery) vs 'explorer' (interactive 3D/2D lunar GIS)
  // Always default to 'landing' when user first lands on the website
  const [currentView, setCurrentView] = useState('landing');

  // Listen to hash changes (for browser back/forward buttons and direct bookmark navigation)
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.toLowerCase();
      if (hash.includes('sp-2d') || hash.includes('southpole')) {
        setCurrentView('explorer');
        setViewMode('sp-2d');
      } else if (hash.includes('explorer') || hash.includes('map') || hash.includes('globe')) {
        setCurrentView('explorer');
      } else if (hash.includes('missions')) {
        setCurrentView('missions');
      } else {
        setCurrentView('landing');
      }
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // View mode: '3d' (Cesium 3D Globe) vs '2d' (OpenLayers Planar Map) vs 'sp-2d' (South Pole 2D Topo)
  const [viewMode, setViewMode] = useState(() => {
    if (typeof window !== 'undefined') {
      const hash = window.location.hash.toLowerCase();
      if (hash.includes('sp-2d') || hash.includes('southpole')) return 'sp-2d';
      if (hash.includes('2d') || hash.includes('planar')) return '2d';
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

  // Tool modals: DTE Calculation, Site Analysis, Weather, Slip Simulator
  const [isDteOpen, setIsDteOpen] = useState(false);
  const [isSiteAnalysisOpen, setIsSiteAnalysisOpen] = useState(false);
  const [isWeatherOpen, setIsWeatherOpen] = useState(false);
  const [isSlipSimulatorOpen, setIsSlipSimulatorOpen] = useState(false);
  const [isInsightsOpen, setIsInsightsOpen] = useState(false);

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
  const getActiveController = () => {
    if (viewMode === '3d') return globeRef.current;
    return southPoleMapRef.current;
  };

  useEffect(() => {
    if (viewMode !== '3d') return;
    const lightingEnabled = globeRef.current?.getLightingEnabled?.();
    if (lightingEnabled !== undefined) {
      setIsSolarLighting(lightingEnabled);
    }
  }, [activePlanet, viewMode]);

  // Separate custom user-dropped pin states for Moon and Earth
  const [customMoonPin, setCustomMoonPin] = useState(null);
  const [customEarthPin, setCustomEarthPin] = useState(null);

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

  const handlePlanetChange = useCallback((body) => {
    const targetBody = body === 'earth' ? 'earth' : 'moon';
    setActivePlanet(targetBody);
    setSelectedFeature((prev) => {
      if (targetBody === 'earth') {
        return selectedEarthFeature || (prev?.body === 'earth' ? prev : null);
      }
      return selectedMoonFeature || (prev?.body === 'moon' ? prev : null);
    });
    globeRef.current?.switchPlanet?.(targetBody);
    notifyInfo(
      `Switched to ${targetBody === 'earth' ? 'Earth' : 'Moon'} View`,
      targetBody === 'earth'
        ? 'Deep Space Network tracking facilities and ground link stations.'
        : 'Lunar selenographic surface topography and exploration sites.'
    );
  }, [selectedEarthFeature, selectedMoonFeature]);

  // Callbacks from Map / Globe
  const handlePointerCoordinates = useCallback((lon, lat) => {
    pointerStore.set({ lon, lat });
  }, []);

  const handleFeatureSelect = useCallback((featureProps) => {
    if (!featureProps) return;
    const body = featureProps?.body === 'earth' ? 'earth' : 'moon';
    setFeatureSelection(featureProps, body);
    if (viewMode === '3d' && featureProps?.id) {
      globeRef.current?.selectFeaturePin?.(featureProps.id, body);
    }
  }, [setFeatureSelection, viewMode]);

  // Dropped custom pin on 3D globe (Moon or Earth)
  const handleDropCustomPin = useCallback((pinData) => {
    const body = pinData?.body === 'earth' ? 'earth' : 'moon';
    const normalized = pinData?.body === body ? pinData : { ...pinData, body };
    if (body === 'earth') {
      setCustomEarthPin(normalized);
    } else {
      setCustomMoonPin(normalized);
    }
    setFeatureSelection(normalized, body);
    const lat = normalized.latitude ?? 0;
    const lon = normalized.longitude ?? 0;
    notifySuccess(
      body === 'earth' ? 'Custom Earth Station Dropped' : 'Custom Lunar Waypoint Dropped',
      `${Math.abs(lat).toFixed(2)}°${lat >= 0 ? 'N' : 'S'}, ${Math.abs(lon).toFixed(2)}°${lon >= 0 ? 'E' : 'W'} · Cross-body link updated.`
    );
  }, [setFeatureSelection]);

  // Clear custom pin
  const handleClearCustomPin = useCallback((planetId = activePlanet) => {
    const body = planetId === 'earth' ? 'earth' : 'moon';
    if (body === 'earth') {
      setCustomEarthPin(null);
      setSelectedEarthFeature((feature) => (feature?.isCustomPin ? null : feature));
    } else {
      setCustomMoonPin(null);
      setSelectedMoonFeature((feature) => (feature?.isCustomPin ? null : feature));
    }
    globeRef.current?.clearCustomPin(body);
    setSelectedFeature((feature) =>
      feature?.isCustomPin && feature.body === body ? null : feature
    );
    notifyInfo('Waypoint Removed', `Custom waypoint cleared from ${body === 'earth' ? 'Earth' : 'Moon'} surface.`);
  }, [activePlanet]);

  // Global Keyboard Shortcuts for enhanced user friendliness
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ignore when user is typing in form inputs, textareas, or selects
      const tag = e.target?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select' || e.target?.isContentEditable) {
        return;
      }

      if (e.key === 'Escape') {
        if (isComparisonOpen) {
          setIsComparisonOpen(false);
        } else if (isDteOpen) {
          setIsDteOpen(false);
        } else if (isSiteAnalysisOpen) {
          setIsSiteAnalysisOpen(false);
        } else if (isWeatherOpen) {
          setIsWeatherOpen(false);
        } else if (isSlipSimulatorOpen) {
          setIsSlipSimulatorOpen(false);
        } else if (isMissionExplorerOpen) {
          setIsMissionExplorerOpen(false);
        } else if (isCelestialOpen) {
          setIsCelestialOpen(false);
        } else if (isLayersOpen) {
          setIsLayersOpen(false);
        } else if (selectedFeature) {
          setSelectedFeature(null);
        }
        return;
      }

      if (e.key === '1') {
        if (viewMode !== '3d') {
          setViewMode('3d');
          notifyInfo('3D Cesium Orbit View [1]', 'Switched to 3D planetary sphere with orbital controls.');
        }
      } else if (e.key === '2') {
        if (viewMode !== '2d') {
          setViewMode('2d');
          notifyInfo('2D Planar GIS Map [2]', 'Switched to 2D planar map with IAU Moon datum.');
        }
      } else if (e.key === 's' || e.key === 'S') {
        handleGoToSouthPole();
      } else if (e.key === 'l' || e.key === 'L') {
        setIsLayersOpen((prev) => {
          notifyInfo(!prev ? 'Layers Panel Opened [L]' : 'Layers Panel Closed [L]', 'Toggled lunar basemaps and datasets.');
          return !prev;
        });
      } else if (e.key === 'e' || e.key === 'E') {
        if (viewMode === '3d') {
          setIsCelestialOpen((prev) => !prev);
        }
      } else if (e.key === 'm' || e.key === 'M') {
        handleToggleMeasure();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    viewMode,
    isComparisonOpen,
    isMissionExplorerOpen,
    isCelestialOpen,
    isLayersOpen,
    isDteOpen,
    isSiteAnalysisOpen,
    isWeatherOpen,
    isSlipSimulatorOpen,
    selectedFeature,
    isMeasureActive,
  ]);

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
    let updateTimer = null;
    let pendingTimeMs = null;
    let lastTimelineUpdate = 0;
    const updateLink = (timeMs) => {
      if (!alive) return;
      try {
        const state = computeCelestialState(timeMs);
        const link = computeCommunicationLink({
          moonFeature: selectedMoonFeature,
          earthFeature: selectedEarthFeature,
          state,
        });
        const dte = evaluateEarthLink({
          state,
          moonFeature: selectedMoonFeature,
          earthFeature: selectedEarthFeature,
          constraints: DEFAULT_DTE_CONSTRAINTS,
          terrainFn: (azimuthDeg) =>
            horizonAt(HORIZON_TABLE, selectedMoonFeature.id, azimuthDeg),
        });
        globeRef.current?.setCommunicationLink?.({ ...link, status: dte.status });
      } catch (error) {
        console.error('Failed to update the Earth-Moon communication line.', error);
        globeRef.current?.setCommunicationLink?.(null);
      }
    };

    const updateLineOfSight = (timeMs) => {
      if (!alive) return;
      try {
        const link = computeCommunicationLink({
          moonFeature: selectedMoonFeature,
          earthFeature: selectedEarthFeature,
          when: timeMs,
        });
        globeRef.current?.setCommunicationLink?.(link);
      } catch (error) {
        console.error('Failed to update the Earth-Moon line of sight.', error);
        globeRef.current?.setCommunicationLink?.(null);
      }
    };

    const scheduleTimelineUpdate = (timeMs) => {
      pendingTimeMs = timeMs;
      if (updateTimer !== null) return;

      // Limit synchronous link calculations while timeline input is changing rapidly.
      const delay = Math.max(0, 100 - (performance.now() - lastTimelineUpdate));
      updateTimer = setTimeout(() => {
        updateTimer = null;
        const latestTimeMs = pendingTimeMs;
        pendingTimeMs = null;
        if (latestTimeMs === null) return;
        lastTimelineUpdate = performance.now();
        updateLink(latestTimeMs);
      }, delay);
    };

    updateLink(celestialTimeStore.get().ms);
    lastTimelineUpdate = performance.now();
    unsubscribe = celestialTimeStore.subscribe(({ ms, source }) => {
      if (source === 'timeline-drag') {
        if (updateTimer !== null) {
          clearTimeout(updateTimer);
          updateTimer = null;
        }
        pendingTimeMs = null;
        updateLineOfSight(ms);
        return;
      }

      if (source === 'timeline') {
        scheduleTimelineUpdate(ms);
        return;
      }

      if (updateTimer !== null) {
        clearTimeout(updateTimer);
        updateTimer = null;
        pendingTimeMs = null;
      }
      updateLink(ms);
    });

    return () => {
      alive = false;
      if (updateTimer !== null) clearTimeout(updateTimer);
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
    notifyNavigation(
      'Targeting South Pole 2D Topo',
      'Centering view on Lunar South Pole (80°S-90°S) with NASA LOLA Altimetry'
    );
    if (viewMode === 'sp-2d') {
      southPoleMapRef.current?.resetOverview?.();
    } else if (getActiveController()?.goToSouthPole) {
      getActiveController()?.goToSouthPole(4.8);
    } else {
      getActiveController()?.flyTo(0, -90, 4.8);
    }
  };

  const handleToggleAutoRotate = () => {
    if (globeRef.current) {
      const state = globeRef.current.toggleAutoRotate();
      setIsAutoRotating(state);
      notifyInfo(
        state ? 'Auto-Rotation Active' : 'Auto-Rotation Paused',
        'Planetary orbital rotation toggled.'
      );
    }
  };

  const handleToggleLighting = () => {
    if (globeRef.current) {
      const state = globeRef.current.toggleLighting();
      setIsSolarLighting(state);
      notifyInfo(
        state ? 'Solar Terminator Shading' : 'Even Terrain Lighting',
        state
          ? 'Real-time solar terminator shading enabled.'
          : 'Even lighting enabled for surface inspection.'
      );
    }
  };

  const handleToggleVectors = () => {
    if (globeRef.current) {
      const next = !isVectorsVisible;
      setIsVectorsVisible(next);
      globeRef.current.setCelestialVectorsVisible?.(next);
      notifyInfo(
        next ? 'Pointing Vectors Visible' : 'Pointing Vectors Hidden',
        'Earth and Sun orientation vectors toggled.'
      );
    }
  };

  // Search feature selection
  const handleSearchSelect = (feature) => {
    const body = feature.body === 'earth' ? 'earth' : 'moon';
    if (viewMode === '3d' && activePlanet !== body) {
      handlePlanetChange(body);
    }

    if (feature.type === 'coordinate') {
      const lat = feature.latitude;
      const lon = feature.longitude;
      const customFeature = {
        ...feature,
        id: `custom-pin-${lon}-${lat}`,
        isCustomPin: true,
        latitude: lat,
        longitude: lon,
      };
      setFeatureSelection(customFeature, body);
      if (viewMode === '3d') {
        globeRef.current?.switchPlanet?.(body);
        globeRef.current?.dropCustomPin?.(lon, lat, feature.name, body);
        globeRef.current?.flyTo?.(lon, lat, 5.0);
      } else {
        getActiveController()?.flyTo(lon, lat, 5.0);
      }
      return;
    }

    if (viewMode === 'sp-2d') {
      southPoleMapRef.current?.flyTo(feature.longitude, feature.latitude, 5.2);
      southPoleMapRef.current?.selectFeature(feature.id);
      setFeatureSelection(feature, body);
      return;
    }

    if (viewMode === '3d') {
      globeRef.current?.switchPlanet?.(body);
      globeRef.current?.selectFeaturePin?.(feature.id, body);
      globeRef.current?.flyTo?.(feature.longitude, feature.latitude, 5.0);
    } else {
      getActiveController()?.selectFeature(feature.id, true);
    }
    setFeatureSelection(feature, body);
  };

  // Quick Expedition Selection (Moon)
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

  // Quick Earth DSN Station Selection
  const handleSelectEarthSite = (station) => {
    if (viewMode !== '3d') {
      setViewMode('3d');
    }
    if (activePlanet !== 'earth') {
      handlePlanetChange('earth');
    }
    const normalized = { ...station, body: 'earth' };
    setFeatureSelection(normalized, 'earth');
    setTimeout(() => {
      globeRef.current?.switchPlanet?.('earth');
      globeRef.current?.selectFeaturePin?.(station.id, 'earth');
      globeRef.current?.flyTo?.(station.longitude, station.latitude, 1_500_000);
    }, 120);
  };

  const handleOpenComparison = (initialMission = null) => {
    setComparisonMissionA(initialMission || selectedMoonFeature || null);
    setIsComparisonOpen(true);
  };

  const handleSelectMissionFromModal = (mission) => {
    const lon =
      mission.verifiedCoordinates?.longitude ??
      mission.longitude ??
      mission.lon ??
      0;
    const lat =
      mission.verifiedCoordinates?.latitude ??
      mission.latitude ??
      mission.lat ??
      0;
    const zoom = mission.defaultZoom || 5.2;

    const isCustom =
      mission.isCustomPin ||
      mission.type === 'custom_pin' ||
      String(mission.id || '').startsWith('custom');

    if (isCustom) {
      if (viewMode === '3d' && activePlanet !== 'moon') {
        handlePlanetChange('moon');
      }
      const customFeature = {
        ...mission,
        id: 'custom-user-pin',
        body: 'moon',
        type: 'custom_pin',
        isCustomPin: true,
        latitude: lat,
        longitude: lon,
      };
      setCustomMoonPin(customFeature);
      setFeatureSelection(customFeature, 'moon');
      if (viewMode === '3d') {
        globeRef.current?.switchPlanet?.('moon');
        globeRef.current?.dropCustomPin?.(lon, lat, mission.name, 'moon');
      }
      getActiveController()?.flyTo(lon, lat, zoom);
      return;
    }

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
    notifyInfo(
      visible ? `${layer?.name || 'Dataset'} Enabled` : `${layer?.name || 'Dataset'} Disabled`,
      layer?.description || 'Planetary layer visibility updated.'
    );
  };

  // Toggle all symbols on or off
  const handleToggleAllSymbols = (visible) => {
    const symbolLayerIds = [
      'lunar-craters',
      'lunar-mountains',
      'lunar-maria',
      'lunar-valleys',
      'lunar-landing-sites',
      'earth-communication-sites',
    ];

    setLayers((prev) =>
      prev.map((l) => (symbolLayerIds.includes(l.id) ? { ...l, visible } : l))
    );

    symbolLayerIds.forEach((id) => {
      const layer = layers.find((l) => l.id === id);
      mapRef.current?.setLayerVisibility(id, visible, layer?.opacity);
      globeRef.current?.setLayerVisibility(id, visible);
      southPoleMapRef.current?.setLayerVisibility?.(id, visible, layer?.opacity);
    });

    notifyInfo(
      visible ? 'All Symbology Enabled' : 'All Symbology Hidden',
      visible
        ? 'Showing landing sites, craters, mountains, maria, and valleys.'
        : 'Surface markers hidden for unobstructed terrain viewing.'
    );
  };

  // Layer opacity handler
  const handleChangeOpacity = (layerId, opacity) => {
    setLayers((prev) =>
      prev.map((l) => (l.id === layerId ? { ...l, opacity } : l))
    );
    mapRef.current?.setLayerVisibility(layerId, true, opacity);
    southPoleMapRef.current?.setLayerVisibility?.(layerId, true, opacity);
  };

  // Measurement mode toggling (2D)
  const handleToggleMeasure = () => {
    if (viewMode === '3d') {
      setViewMode('2d');
    }
    if (isMeasureActive) {
      setIsMeasureActive(false);
      southPoleMapRef.current?.deactivateMeasurement?.();
      mapRef.current?.deactivateMeasurement?.();
      notifyInfo('Measurement Complete', 'Geodesic distance tool deactivated.');
    } else {
      setIsMeasureActive(true);
      setIsLayersOpen(false);
      southPoleMapRef.current?.activateMeasurement?.();
      mapRef.current?.activateMeasurement?.();
      notifyInfo(
        'Geodesic Ruler Active',
        'Click anywhere on the lunar surface to add measurement waypoints.'
      );
    }
  };

  const handleClearMeasurement = () => {
    southPoleMapRef.current?.clearMeasurement?.();
    mapRef.current?.clearMeasurement?.();
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
    const targetBody = body === 'earth' ? 'earth' : 'moon';
    if (viewMode !== '3d') {
      setViewMode('3d');
    }
    handlePlanetChange(targetBody);
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
    if (options.planet === 'earth' || options.planet === 'moon') {
      setActivePlanet(options.planet);
    } else {
      setActivePlanet('moon');
    }
    setCurrentView('explorer');
    window.location.hash = '#explorer';

    if (options.planet === 'earth') {
      setTimeout(() => {
        globeRef.current?.switchPlanet?.('earth');
      }, 250);
    }

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
    if (options.openComparison) {
      setIsComparisonOpen(true);
    }
    if (options.activateMeasure) {
      setIsMeasureActive(true);
      southPoleMapRef.current?.activateMeasurement?.();
      mapRef.current?.activateMeasurement?.();
    }
  };

  // Return from Explorer to Landing Page
  const handleReturnToLanding = () => {
    setCurrentView('landing');
    window.location.hash = '#';
  };

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

  const handleNavigateToMissions = () => {
    setCurrentView('missions');
    window.location.hash = '#missions';
  };

  const handleNavigateToLanding = () => {
    setCurrentView('landing');
    window.location.hash = '#';
  };

  // Render Landing Page if currentView is 'landing'
  if (currentView === 'landing') {
    return (
      <LandingPage
        onNavigateToMissions={handleNavigateToMissions}
        onLaunchExplorer={handleLaunchExplorer}
      />
    );
  }

  // Render Dedicated Missions Overview Page if currentView is 'missions'
  if (currentView === 'missions') {
    return (
      <MissionsPage
        onNavigateToLanding={handleNavigateToLanding}
        onLaunchExplorer={handleLaunchExplorer}
      />
    );
  }

  return (
    <div className="relative w-screen h-screen overflow-hidden flex flex-col bg-black text-slate-100 font-sans select-none animate-in fade-in duration-200">
      {/* ========================================================================= */}
      {/* TOP HEADER: Clean NASA-inspired compact navigation */}
      {/* ========================================================================= */}
      {/* ========================================================================= */}
      {/* TOP HEADER: Minimal clean navigation bar                                  */}
      {/* Floating Compact Left Sidebar Navigation */}
      <UnifiedToolbar
        onReturnHome={handleReturnToLanding}
        onToggleLayers={() => {
          setIsLayersOpen((prev) => {
            if (!prev) setIsCelestialOpen(false);
            return !prev;
          });
        }}
        isLayersOpen={isLayersOpen}
        layers={layers}
        onToggleLayer={handleToggleLayer}
        onToggleAllSymbols={handleToggleAllSymbols}
        onGoToSouthPole={handleGoToSouthPole}
        onSelectExpedition={handleSelectExpedition}
        onSelectEarthSite={handleSelectEarthSite}
        onOpenMissionExplorer={() => setIsMissionExplorerOpen(true)}
        onOpenSlipSimulator={() => setIsSlipSimulatorOpen(true)}
        onOpenComparison={() => handleOpenComparison(null)}
        onNavigateCoordinates={(lon, lat) => {
          if (viewMode === '3d' && activePlanet === 'earth') {
            getActiveController()?.flyTo(lon, lat, 1_500_000);
          } else {
            getActiveController()?.flyTo(lon, lat, 4.5);
          }
        }}
        onPlanetChange={(body) => {
          if (viewMode !== '3d') setViewMode('3d');
          handlePlanetChange(body);
        }}
        onToggleAutoRotate={handleToggleAutoRotate}
        isAutoRotating={isAutoRotating}
        onToggleLighting={handleToggleLighting}
        isSolarLighting={isSolarLighting}
        onResetOverview={handleResetOverview}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        selectedFeature={selectedFeature}
        activePlanet={activePlanet}
      />

      {/* Transparent Top-Centered Lunar Location Search Bar */}
      <TransparentLunarSearch
        onSelectFeature={handleSearchSelect}
        activePlanet={activePlanet}
      />

      {/* Floating Feedback Notifications */}
      <ToastFeedback
        maxItems={2}
        className="absolute top-[104px] sm:top-[106px] left-3 sm:left-4 z-30 select-none max-w-[calc(100vw-24px)] sm:max-w-md"
      />

      {/* ========================================================================= */}
      {/* MAIN VIEWPORT: Moon & Terrain occupy 100% of the canvas                   */}
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
            hasCustomPin={activePlanet === 'earth' ? !!customEarthPin : !!customMoonPin}
            onClearCustomPin={handleClearCustomPin}
            activePlanet={activePlanet}
            onPlanetChange={handlePlanetChange}
            isVisible={viewMode === '3d'}
          />
        </div>

        {/* Exclusive 2D NASA Lunar South Pole Topographical GIS Map */}
        <div
          className={`absolute inset-0 w-full h-full ${
            viewMode === '2d' || viewMode === 'sp-2d' ? 'block' : 'hidden'
          }`}
        >
          <SouthPoleTopoMap
            ref={southPoleMapRef}
            onPointerCoordinates={handlePointerCoordinates}
            onFeatureSelect={handleFeatureSelect}
            selectedFeature={selectedFeature}
            isVisible={viewMode === '2d' || viewMode === 'sp-2d'}
            onMeasurementChange={handleMeasurementUpdate}
            onSwitchTo3D={() => setViewMode('3d')}
            onOutOfDemBounds={(lat, lon) => {
              notifyWarn(
                'Target Outside Polar Cap (80°S–90°S)',
                `${Math.abs(lat).toFixed(1)}°${lat >= 0 ? 'N' : 'S'} is beyond the high-res South Pole DEM. Switch to 3D Globe [1] for global selenographic views.`
              );
            }}
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
          communicationEarthFeature={selectedCommunicationEarthFeature}
          onClose={() => setSelectedFeature(null)}
          onZoomHere={handleZoomHere}
          onMeasureFromHere={handleMeasureFromFeature}
          onClearCustomPin={handleClearCustomPin}
          onCompareMission={(mission) => handleOpenComparison(mission)}
          onSelectOtherBody={handleSelectOtherBody}
          onOpenSiteAnalysis={(feat) => {
            if (feat) setFeatureSelection(feat, feat.body || 'moon');
            setIsSiteAnalysisOpen(true);
          }}
          onOpenDteCalculation={(feat) => {
            if (feat) setFeatureSelection(feat, feat.body || 'moon');
            setIsDteOpen(true);
          }}
          onOpenWeather={(feat) => {
            if (feat) setFeatureSelection(feat, feat.body || 'moon');
            setIsWeatherOpen(true);
          }}
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

        {/* Side-by-side CLPS & Custom Landing Site Comparison Modal */}
        <MissionComparisonModal
          isOpen={isComparisonOpen}
          onClose={() => setIsComparisonOpen(false)}
          initialMissionA={comparisonMissionA}
          customMoonPin={customMoonPin}
          onSelectMission={(mission) => {
            setIsComparisonOpen(false);
            handleSelectMissionFromModal(mission);
          }}
        />

        {/* 1. Direct-to-Earth Communication Calculation Modal */}
        <DteCalculationModal
          isOpen={isDteOpen}
          onClose={() => setIsDteOpen(false)}
          selectedMoonFeature={selectedMoonFeature || selectedFeature}
          selectedEarthFeature={selectedEarthFeature}
          onSelectEarthSite={handleSelectEarthSite}
          onFlyToMoonSite={(lon, lat) => {
            getActiveController()?.flyTo(lon, lat, 4.5);
          }}
        />

        {/* 2. Comprehensive Site Analysis Modal (every information) */}
        <SiteAnalysisModal
          isOpen={isSiteAnalysisOpen}
          onClose={() => setIsSiteAnalysisOpen(false)}
          feature={
            selectedMoonFeature ||
            selectedFeature || {
              id: 'lunar-target-default',
              name: 'Lunar Target',
              latitude: -89.4,
              longitude: 0.0,
              body: 'moon',
            }
          }
          onZoomHere={handleZoomHere}
          onCompareMission={(mission) => handleOpenComparison(mission)}
          onSelectOtherBody={handleSelectOtherBody}
          onClearCustomPin={handleClearCustomPin}
          communicationEarthFeature={selectedCommunicationEarthFeature}
        />

        {/* 3. Space Weather & Surface Thermal Modal */}
        <LunarWeatherModal
          isOpen={isWeatherOpen}
          onClose={() => setIsWeatherOpen(false)}
          selectedMoonFeature={selectedMoonFeature || selectedFeature}
        />

        {/* 4. Launch Slip Simulator & Window Heatmap Modal */}
        <SlipSimulatorModal
          isOpen={isSlipSimulatorOpen}
          onClose={() => setIsSlipSimulatorOpen(false)}
          onSelectSiteAndDate={(site, targetMs) => {
            handleFeatureSelect(site);
            if (viewMode !== '2d' && viewMode !== 'sp-2d') {
              getActiveController()?.flyTo(site.longitude, site.latitude, 4.5);
            }
          }}
        />
      </main>

      {/* ========================================================================= */}
      <TelemetryStatusBar
        viewMode={viewMode}
        selectedFeature={selectedFeature}
      />
    </div>
  );
}

