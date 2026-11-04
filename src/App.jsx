/**
 * @file App.jsx
 * Root application component that coordinates the map, planet viewport, and panels.
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import SouthPoleTopoMap from './components/map/SouthPoleTopoMap.jsx';
import PlanetViewport from './components/globe/PlanetViewport.jsx';
import LayerPanel from './components/layers/LayerPanel.jsx';
import FeaturePanel from './components/features/FeaturePanel.jsx';
import LunarSunlightTimeline from './components/features/LunarSunlightTimeline.jsx';
import MeasurementToolbar from './components/measurements/MeasurementToolbar.jsx';
import CelestialPanel from './components/celestial/CelestialPanel.jsx';
import UnifiedToolbar from './components/navigation/UnifiedToolbar.jsx';
import MissionExplorerModal from './components/missions/MissionExplorerModal.jsx';
import MissionComparisonModal from './components/missions/MissionComparisonModal.jsx';
import SlipSimulatorModal from './components/missions/SlipSimulatorModal.jsx';
import TransferOrbitModal from './components/trajectory/TransferOrbitModal.jsx';
import DteCalculationModal from './components/communication/DteCalculationModal.jsx';
import SiteAnalysisModal from './components/analysis/SiteAnalysisModal.jsx';
import LunarWeatherModal from './components/status/LunarWeatherModal.jsx';
import LandingPage from './components/landing/LandingPage.jsx';
import MissionsPage from './components/missions/MissionsPage.jsx';
import UserGuideModal from './components/common/UserGuideModal.jsx';
import GuidedMissionTour from './components/workflow/GuidedMissionTour.jsx';
import TransparentLunarSearch from './components/search/TransparentLunarSearch.jsx';
import ToastFeedback from './components/common/ToastFeedback.jsx';

// Lazy-load dedicated lunar mission workspaces for maximum performance and code splitting
const MissionControlPage = React.lazy(() => import('./pages/MissionControlPage.jsx'));
const SiteAnalysisPage = React.lazy(() => import('./pages/SiteAnalysisPage.jsx'));
const CommunicationPage = React.lazy(() => import('./pages/CommunicationPage.jsx'));
const LandingPlannerPage = React.lazy(() => import('./pages/LandingPlannerPage.jsx'));
const SiteComparisonPage = React.lazy(() => import('./pages/SiteComparisonPage.jsx'));
const MissionBriefingPage = React.lazy(() => import('./pages/MissionBriefingPage.jsx'));
const MissionLibraryPage = React.lazy(() => import('./pages/MissionLibraryPage.jsx'));
import { CLPS_MISSIONS } from './data/clpsMissions.js';
import { LANDING_SITES } from './data/landingSites.js';
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

  // App View: 'landing' (cinematic overview) vs 'explorer' (3D/2D GIS) vs dedicated workspaces
  // Supports full 8-page NASA Mission Platform architecture
  const [currentView, setCurrentView] = useState(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const hash = window.location.hash.toLowerCase().replace('#', '');
      if (
        hash.includes('sp-2d') ||
        hash.includes('southpole') ||
        hash.includes('2d') ||
        hash.includes('planar') ||
        hash.includes('explorer') ||
        hash.includes('map') ||
        hash.includes('globe')
      ) {
        return 'explorer';
      }
      if (hash === 'mission-control' || hash === 'missions') return 'mission-control';
      if (hash === 'site-analysis' || hash === 'analysis') return 'site-analysis';
      if (hash === 'communication' || hash === 'comms') return 'communication';
      if (hash === 'planner') return 'planner';
      if (hash === 'comparison' || hash === 'compare') return 'comparison';
      if (hash === 'briefing') return 'briefing';
      if (hash === 'library' || hash === 'guide') return 'library';
      if (params.get('autostart') === '1') return 'explorer';
    }
    return 'landing';
  });

  // Active mission & comparison candidates
  const [activeMission, setActiveMission] = useState(() => CLPS_MISSIONS[0]);
  const [comparisonMissionB, setComparisonMissionB] = useState(() => CLPS_MISSIONS[1] || null);

  // User Guide Modal & Guided Tour state
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [isTourActive, setIsTourActive] = useState(false);
  const [tourStep, setTourStep] = useState(0);

  // Listen to hash changes (for browser back/forward buttons and direct bookmark navigation)
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.toLowerCase().replace('#', '');
      if (hash.includes('sp-2d') || hash.includes('southpole')) {
        setCurrentView('explorer');
        setViewMode('sp-2d');
      } else if (hash.includes('explorer') || hash.includes('map') || hash.includes('globe')) {
        setCurrentView('explorer');
      } else if (hash === 'mission-control' || hash === 'missions') {
        setCurrentView('mission-control');
      } else if (hash === 'site-analysis' || hash === 'analysis') {
        setCurrentView('site-analysis');
      } else if (hash === 'communication' || hash === 'comms') {
        setCurrentView('communication');
      } else if (hash === 'planner') {
        setCurrentView('planner');
      } else if (hash === 'comparison' || hash === 'compare') {
        setCurrentView('comparison');
      } else if (hash === 'briefing') {
        setCurrentView('briefing');
      } else if (hash === 'library' || hash === 'guide') {
        setCurrentView('library');
      } else if (hash === '' || hash === 'landing') {
        setCurrentView('landing');
      }
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // Centralized navigation dispatcher
  const handleNavigate = useCallback((pageId) => {
    const normalized =
      pageId === 'comms'
        ? 'communication'
        : pageId === 'site-comparison'
        ? 'comparison'
        : pageId === 'missions'
        ? 'mission-control'
        : pageId;
    setCurrentView(normalized);
    window.location.hash = normalized === 'landing' ? '#' : `#${normalized}`;
    notifyNavigation(`Navigated to ${normalized}`);
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

  // Track whether 3D/2D Explorer viewports have been visited so they only mount on demand
  const [hasVisitedExplorer, setHasVisitedExplorer] = useState(
    () => currentView === 'explorer' && viewMode === '3d'
  );
  const [hasVisited2D, setHasVisited2D] = useState(
    () => currentView === 'explorer' && (viewMode === '2d' || viewMode === 'sp-2d')
  );

  useEffect(() => {
    if (currentView === 'explorer') {
      if (viewMode === '3d') {
        setHasVisitedExplorer(true);
      }
      if (viewMode === '2d' || viewMode === 'sp-2d') {
        setHasVisited2D(true);
      }
    }
  }, [currentView, viewMode]);

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
  const [isTransferOrbitOpen, setIsTransferOrbitOpen] = useState(false);
  const [isInsightsOpen, setIsInsightsOpen] = useState(false);

  // Distance measurement tool state (2D mode)
  const [isMeasureActive, setIsMeasureActive] = useState(false);
  const [isAutoRotating, setIsAutoRotating] = useState(false);
  const [solarLightingByPlanet, setSolarLightingByPlanet] = useState({
    moon: true,
    earth: true,
  });
  const isSolarLighting = solarLightingByPlanet[activePlanet] ?? true;
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

  // Separate custom user-dropped pin states for Moon and Earth
  const [customMoonPin, setCustomMoonPin] = useState(null);
  const [customEarthPin, setCustomEarthPin] = useState(null);

  const setFeatureSelection = useCallback((feature, body = 'moon') => {
    if (!feature) return;
    const normalized = {
      ...feature,
      body,
      latitude: feature.latitude ?? feature.lat ?? 0,
      longitude: feature.longitude ?? feature.lon ?? 0,
      elevationMeters: feature.elevationMeters ?? feature.elevationM ?? null,
    };
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
        if (isTourActive) {
          setIsTourActive(false);
          setIsSiteAnalysisOpen(false);
          setIsDteOpen(false);
          setIsSlipSimulatorOpen(false);
          notifyInfo('Tour Dismissed', 'Free exploration active.');
          return;
        }
        if (isGuideOpen) {
          setIsGuideOpen(false);
          return;
        }
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
        } else if (isTransferOrbitOpen) {
          setIsTransferOrbitOpen(false);
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
        setIsCelestialOpen((prev) => {
          const next = !prev;
          if (next) setIsLayersOpen(false);
          return next;
        });
      } else if (e.key === 'd' || e.key === 'D') {
        setIsDteOpen((prev) => !prev);
      } else if (e.key === 'w' || e.key === 'W') {
        setIsWeatherOpen((prev) => !prev);
      } else if (e.key === 'a' || e.key === 'A') {
        setIsSiteAnalysisOpen((prev) => !prev);
      } else if (e.key === 'c' || e.key === 'C') {
        setIsComparisonOpen((prev) => !prev);
      } else if (e.key === 'm' || e.key === 'M') {
        handleToggleMeasure();
      } else if (e.key === 'o' || e.key === 'O') {
        setIsTransferOrbitOpen((prev) => !prev);
      } else if (e.key === '?' || (e.key === 'h' && !e.ctrlKey && !e.metaKey && !e.altKey)) {
        e.preventDefault();
        setIsGuideOpen((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    viewMode,
    isTourActive,
    isGuideOpen,
    isComparisonOpen,
    isMissionExplorerOpen,
    isCelestialOpen,
    isLayersOpen,
    isDteOpen,
    isSiteAnalysisOpen,
    isWeatherOpen,
    isSlipSimulatorOpen,
    isTransferOrbitOpen,
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
  const handleResetOverview = () => {
    getActiveController()?.resetOverview();
    notifyNavigation('View Reset', 'Returned to global overview.');
  };
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
      const state = globeRef.current.toggleLighting(activePlanet);
      setSolarLightingByPlanet((previous) => ({
        ...previous,
        [activePlanet]: state,
      }));
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
    southPoleMapRef.current?.setLayerVisibility?.(layerId, visible);
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
      southPoleMapRef.current?.activateMeasurement?.();
      mapRef.current?.activateMeasurement?.();
    }
    southPoleMapRef.current?.flyTo?.(lon, lat, 4.0);
    mapRef.current?.flyTo?.(lon, lat, 4.0);
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

  // 60-Second Interactive Guided Tour Orchestrator
  const executeTourStep = useCallback(
    (step) => {
      setTourStep(step);
      const malapert =
        LANDING_SITES.find((s) => s.id === 'landing-artemis3-malapert') ||
        LANDING_SITES.find((s) => s.id.includes('malapert')) ||
        LANDING_SITES[0];

      if (step === 0) {
        // Step 1: Target South Pole Malapert Massif in 3D with Lighting
        setIsSiteAnalysisOpen(false);
        setIsDteOpen(false);
        setIsSlipSimulatorOpen(false);
        setIsComparisonOpen(false);
        setIsLayersOpen(false);
        if (activePlanet !== 'moon') handlePlanetChange('moon');
        if (viewMode !== '3d') setViewMode('3d');
        handleFeatureSelect(malapert);
        if (!solarLightingByPlanet.moon) {
          globeRef.current?.setLightingEnabled?.(true, 'moon');
          setSolarLightingByPlanet((previous) => ({ ...previous, moon: true }));
        }
        setTimeout(() => {
          getActiveController()?.flyTo(
            malapert.longitude ?? 0,
            malapert.latitude ?? -85.9,
            4.5
          );
        }, 120);
        notifySuccess(
          'Guided Tour: Step 1 of 6',
          'Artemis III Malapert Massif (85.90°S, 0.00°E) targeted with solar terminator.'
        );
      } else if (step === 1) {
        // Step 2: Switch to 2D South Pole Topographic GIS Map
        setIsSiteAnalysisOpen(false);
        setIsDteOpen(false);
        setIsSlipSimulatorOpen(false);
        setIsComparisonOpen(false);
        setViewMode('sp-2d');
        notifyInfo(
          'Guided Tour: Step 2 of 6',
          'Switched to 2D South Pole Topographic Map with 100m/200m LOLA DEM contours.'
        );
      } else if (step === 2) {
        // Step 3: Landing Site Horizon & Diviner Thermal
        if (viewMode !== '3d') setViewMode('3d');
        setIsDteOpen(false);
        setIsSlipSimulatorOpen(false);
        setIsComparisonOpen(false);
        handleFeatureSelect(malapert);
        setTimeout(() => {
          getActiveController()?.flyTo(
            malapert.longitude ?? 0,
            malapert.latitude ?? -85.9,
            4.5
          );
          setIsSiteAnalysisOpen(true);
        }, 150);
        notifyInfo(
          'Guided Tour: Step 3 of 6',
          'Inspect panoramic 360° LOLA DEM horizons and Diviner thermal environment.'
        );
      } else if (step === 3) {
        // Step 4: Direct-to-Earth Communication Link
        setIsSiteAnalysisOpen(false);
        setIsSlipSimulatorOpen(false);
        setIsComparisonOpen(false);
        setIsDteOpen(true);
        setIsVectorsVisible(true);
        notifyInfo(
          'Guided Tour: Step 4 of 6',
          'Direct-to-Earth communication links evaluated to Deep Space Network tracking sites.'
        );
      } else if (step === 4) {
        // Step 5: Launch Window Slip Simulator
        setIsDteOpen(false);
        setIsSiteAnalysisOpen(false);
        setIsComparisonOpen(false);
        setIsSlipSimulatorOpen(true);
        notifyInfo(
          'Guided Tour: Step 5 of 6',
          'Launch slip simulation sweeps daylight duration and candidate rankings.'
        );
      } else if (step === 5) {
        // Step 6: Ready for Free Exploration
        setIsSlipSimulatorOpen(false);
        setIsDteOpen(false);
        setIsSiteAnalysisOpen(false);
        setIsComparisonOpen(false);
        if (viewMode !== '3d') setViewMode('3d');
        setTimeout(() => {
          getActiveController()?.flyTo(0, -90, 5.2);
        }, 120);
        notifySuccess(
          'Tour Complete!',
          'Full operational command active. Press [?] anytime for reference and shortcuts.'
        );
      }
    },
    [
      activePlanet,
      viewMode,
      isSolarLighting,
      solarLightingByPlanet,
      handlePlanetChange,
      handleFeatureSelect,
    ]
  );

  const handleStartTour = useCallback(() => {
    setIsGuideOpen(false);
    if (currentView !== 'explorer') {
      setCurrentView('explorer');
      window.location.hash = '#explorer';
    }
    setIsTourActive(true);
    executeTourStep(0);
  }, [currentView, executeTourStep]);

  const handleNextTourStep = useCallback(() => {
    if (tourStep < 5) {
      executeTourStep(tourStep + 1);
    } else {
      setIsTourActive(false);
      notifySuccess(
        'Ready to Explore',
        'Use the left toolbar or press [L] for layers, [1]/[2] for 3D/2D views.'
      );
    }
  }, [tourStep, executeTourStep]);

  const handlePrevTourStep = useCallback(() => {
    if (tourStep > 0) {
      executeTourStep(tourStep - 1);
    }
  }, [tourStep, executeTourStep]);

  const handleEndTour = useCallback(() => {
    setIsTourActive(false);
    setIsSiteAnalysisOpen(false);
    setIsDteOpen(false);
    setIsSlipSimulatorOpen(false);
    notifyInfo('Tour Dismissed', 'Free exploration active.');
  }, []);

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
        onNavigateToMissions={() => handleNavigate('mission-control')}
        onLaunchExplorer={handleLaunchExplorer}
      />
    );
  }

  return (
    <div className="relative w-screen h-screen overflow-hidden flex flex-col bg-black text-slate-100 font-sans select-none animate-in fade-in duration-200">
      {/* ========================================================================= */}
      {/* MODULAR WORKSPACE SWITCHER: Upper left corner                             */}
      {/* ========================================================================= */}
      <div className="fixed top-3 left-3 sm:top-4 sm:left-4 z-40 pointer-events-auto select-none flex items-center gap-2">
        <select
          aria-label="Mission Workspace Switcher"
          value={currentView}
          onChange={(e) => {
            const val = e.target.value;
            if (val === 'sp-2d') {
              setCurrentView('explorer');
              setViewMode('sp-2d');
              window.location.hash = '#sp-2d';
            } else if (val === 'explorer') {
              setCurrentView('explorer');
              setViewMode('3d');
              window.location.hash = '#explorer';
            } else {
              handleNavigate(val);
            }
          }}
          className="h-8 px-2.5 rounded-xl bg-[#060b14]/90 backdrop-blur-md border border-slate-800/90 hover:border-cyan-500/50 text-[11px] font-mono text-cyan-300 focus:outline-none shadow-lg cursor-pointer"
        >
          <option value="explorer">Lunar Map (3D / 2D)</option>
          <option value="mission-control">Mission Overview</option>
          <option value="site-analysis">Site Analysis</option>
          <option value="communication">DTE Communications</option>
          <option value="planner">Landing Recommendations</option>
          <option value="comparison">Site Comparison</option>
          <option value="library">Data Sources &amp; Library</option>
        </select>
      </div>

      {/* ========================================================================= */}
      {/* FLOATING NOTIFICATIONS: Upper right corner                                */}
      {/* ========================================================================= */}
      <ToastFeedback
        maxItems={3}
        className="fixed top-3 sm:top-4 right-3 sm:right-4 z-50 items-end select-none max-w-[calc(100vw-24px)] sm:max-w-xs"
      />

      {/* Dedicated Subpage Workspaces (Lazy Loaded) */}
      {currentView !== 'explorer' && (
        <div className="flex-1 w-full h-full overflow-hidden flex flex-col bg-[#07090e] pt-11 sm:pt-12">
          <React.Suspense
            fallback={
              <div className="flex-1 flex flex-col items-center justify-center min-h-[50vh] text-cyan-400 font-mono text-xs gap-3">
                <div className="w-8 h-8 rounded-full border-2 border-cyan-500/30 border-t-cyan-400 animate-spin" />
                <span>INITIALIZING MISSION WORKSPACE...</span>
              </div>
            }
          >
            {currentView === 'mission-control' && (
              <MissionControlPage
                onNavigate={handleNavigate}
                activeMission={activeMission}
                onSelectMission={(m) => {
                  setActiveMission(m);
                  handleSelectMissionFromModal(m);
                }}
                selectedFeature={selectedMoonFeature || selectedFeature}
                onSelectFeature={handleFeatureSelect}
                onStartTour={handleStartTour}
              />
            )}
            {currentView === 'site-analysis' && (
              <SiteAnalysisPage
                selectedSite={selectedMoonFeature || selectedFeature}
                onSelectSite={handleFeatureSelect}
                onNavigate={handleNavigate}
              />
            )}
            {currentView === 'communication' && (
              <CommunicationPage
                selectedSite={selectedMoonFeature || selectedFeature}
                onSelectSite={handleFeatureSelect}
                onNavigate={handleNavigate}
                onSelectStation={handleSelectEarthSite}
              />
            )}
            {currentView === 'planner' && (
              <LandingPlannerPage
                onNavigate={handleNavigate}
                onSelectSite={handleFeatureSelect}
                onFlyToSite={(site) => {
                  handleFeatureSelect(site);
                  handleNavigate('explorer');
                  setTimeout(() => {
                    getActiveController()?.flyTo(
                      site.longitude ?? site.lon,
                      site.latitude ?? site.lat,
                      4.5
                    );
                  }, 150);
                }}
              />
            )}
            {currentView === 'comparison' && (
              <SiteComparisonPage
                siteA={comparisonMissionA || selectedMoonFeature || selectedFeature}
                siteB={comparisonMissionB}
                onSelectSiteA={setComparisonMissionA}
                onSelectSiteB={setComparisonMissionB}
                onNavigate={handleNavigate}
                onSelectSiteForView={(site) => {
                  handleFeatureSelect(site);
                  handleNavigate('explorer');
                  setTimeout(() => {
                    getActiveController()?.flyTo(
                      site.longitude ?? site.lon,
                      site.latitude ?? site.lat,
                      4.5
                    );
                  }, 150);
                }}
              />
            )}
            {currentView === 'briefing' && (
              <MissionBriefingPage
                selectedSite={selectedMoonFeature || selectedFeature}
                onSelectSite={handleFeatureSelect}
                activeMission={activeMission}
                onNavigate={handleNavigate}
              />
            )}
            {currentView === 'library' && (
              <MissionLibraryPage
                onSelectMission={(m) => {
                  setActiveMission(m);
                  handleSelectMissionFromModal(m);
                }}
                onNavigate={handleNavigate}
                onStartTour={handleStartTour}
              />
            )}
            {currentView === 'missions' && (
              <MissionsPage
                onNavigateToLanding={handleNavigateToLanding}
                onLaunchExplorer={handleLaunchExplorer}
              />
            )}
          </React.Suspense>
        </div>
      )}

      {/* Persistent Celestial Explorer Viewport (Maintains Cesium WebGL Context & State) */}
      <div
        className={`relative w-full flex-1 h-full overflow-hidden ${
          currentView === 'explorer' ? 'block' : 'hidden'
        }`}
      >
        {/* Floating Compact Left Sidebar Navigation */}
        <UnifiedToolbar
          onReturnHome={handleReturnToLanding}
          timelineVisible={showLunarTimeline}
          onToggleLayers={() => {
            setIsLayersOpen((prev) => {
              if (!prev) setIsCelestialOpen(false);
              return !prev;
            });
          }}
          isLayersOpen={isLayersOpen}
          onToggleCelestial={() => {
            setIsCelestialOpen((prev) => {
              const next = !prev;
              if (next) {
                setIsLayersOpen(false);
              }
              return next;
            });
          }}
          isCelestialOpen={isCelestialOpen}
          layers={layers}
          onToggleLayer={handleToggleLayer}
          onToggleAllSymbols={handleToggleAllSymbols}
          onGoToSouthPole={handleGoToSouthPole}
          onSelectExpedition={handleSelectExpedition}
          onSelectEarthSite={handleSelectEarthSite}
          onOpenMissionExplorer={() => setIsMissionExplorerOpen(true)}
          onOpenSlipSimulator={() => setIsSlipSimulatorOpen(true)}
          onOpenTransferOrbit={() => setIsTransferOrbitOpen(true)}
          isTransferOrbitOpen={isTransferOrbitOpen}
          onOpenComparison={() => handleOpenComparison(null)}
          onOpenDte={() => setIsDteOpen(true)}
          isDteOpen={isDteOpen}
          onOpenWeather={() => setIsWeatherOpen(true)}
          isWeatherOpen={isWeatherOpen}
          onOpenSiteAnalysis={() => setIsSiteAnalysisOpen(true)}
          isSiteAnalysisOpen={isSiteAnalysisOpen}
          onToggleMeasure={handleToggleMeasure}
          isMeasureActive={isMeasureActive}
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
          onOpenGuide={() => setIsGuideOpen(true)}
        />

        {/* Transparent Top-Centered Lunar Location Search Bar */}
        <TransparentLunarSearch
          onSelectFeature={handleSearchSelect}
          activePlanet={activePlanet}
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
          {(hasVisitedExplorer || (currentView === 'explorer' && viewMode === '3d')) && (
            <PlanetViewport
              ref={globeRef}
              onPointerCoordinates={handlePointerCoordinates}
              onFeatureSelect={handleFeatureSelect}
              onDropCustomPin={handleDropCustomPin}
              hasCustomPin={activePlanet === 'earth' ? !!customEarthPin : !!customMoonPin}
              onClearCustomPin={handleClearCustomPin}
              layers={layers}
              activePlanet={activePlanet}
              onPlanetChange={handlePlanetChange}
              isVisible={currentView === 'explorer' && viewMode === '3d'}
            />
          )}
        </div>

        {/* Exclusive 2D NASA Lunar South Pole Topographical GIS Map */}
        <div
          className={`absolute inset-0 w-full h-full ${
            viewMode === '2d' || viewMode === 'sp-2d' ? 'block' : 'hidden'
          }`}
        >
          {(hasVisited2D || (currentView === 'explorer' && (viewMode === '2d' || viewMode === 'sp-2d'))) && (
            <SouthPoleTopoMap
              ref={southPoleMapRef}
              onPointerCoordinates={handlePointerCoordinates}
              onFeatureSelect={handleFeatureSelect}
              selectedFeature={selectedFeature}
              isVisible={currentView === 'explorer' && (viewMode === '2d' || viewMode === 'sp-2d')}
              onMeasurementChange={handleMeasurementUpdate}
              onSwitchTo3D={() => setViewMode('3d')}
              onOutOfDemBounds={(lat, lon) => {
                notifyWarn(
                  'Target Outside Polar Cap (80°S–90°S)',
                  `${Math.abs(lat).toFixed(1)}°${lat >= 0 ? 'N' : 'S'} is beyond the high-res South Pole DEM. Switch to 3D Globe [1] for global selenographic views.`
                );
              }}
            />
          )}
        </div>

        {/* Real-time Earth & Sun Ephemeris Drawer (Active in both 3D & 2D Mode) */}
        <CelestialPanel
          globeRef={globeRef}
          isActive={true}
          isOpen={isCelestialOpen}
          onClose={() => setIsCelestialOpen(false)}
          vectorsVisible={isVectorsVisible}
          onToggleVectors={handleToggleVectors}
        />

        {/* Celestial Panel vectors */}

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
        {(viewMode === '2d' || viewMode === 'sp-2d') && (
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

        {/* 5. Earth-to-Moon Transfer Orbit Planner Modal */}
        <TransferOrbitModal
          isOpen={isTransferOrbitOpen}
          onClose={() => setIsTransferOrbitOpen(false)}
          initialLaunchSiteId={selectedCommunicationEarthFeature?.id || selectedEarthFeature?.id}
          initialMoonSiteId={selectedMoonFeature?.id || selectedFeature?.id}
          onNavigateToEarthPad={(site) => {
            if (viewMode !== '3d') setViewMode('3d');
            if (activePlanet !== 'earth') handlePlanetChange('earth');
            getActiveController()?.flyTo(site.longitude, site.latitude, 1_500_000);
            notifyNavigation?.(site.name, 'Navigated to Earth departure launch facility.');
          }}
          onNavigateToMoonTarget={(site) => {
            if (viewMode !== '3d') setViewMode('3d');
            if (activePlanet !== 'moon') handlePlanetChange('moon');
            handleFeatureSelect(site);
            getActiveController()?.flyTo(site.longitude, site.latitude, 4.5);
            notifyNavigation?.(site.name, 'Navigated to Lunar target landing site.');
          }}
        />
      </main>
      </div>

      {/* Dedicated NASA Space Apps User Guide & Keyboard Shortcuts Modal */}
      <UserGuideModal
        isOpen={isGuideOpen}
        onClose={() => setIsGuideOpen(false)}
        onStartTour={handleStartTour}
      />

      {/* 60-Second Interactive Guided Onboarding Tour */}
      <GuidedMissionTour
        isActive={isTourActive}
        stepIndex={tourStep}
        onNext={handleNextTourStep}
        onPrev={handlePrevTourStep}
        onEnd={handleEndTour}
      />
    </div>
  );
}
