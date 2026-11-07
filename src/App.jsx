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
import MainNavbar from './components/navigation/MainNavbar.jsx';
import LeftSidebarNav from './components/navigation/LeftSidebarNav.jsx';
import MissionComparisonModal from './components/missions/MissionComparisonModal.jsx';
import SlipSimulatorModal from './components/missions/SlipSimulatorModal.jsx';
import TransferOrbitModal from './components/trajectory/TransferOrbitModal.jsx';
import DteCalculationModal from './components/communication/DteCalculationModal.jsx';
import SiteAnalysisModal from './components/analysis/SiteAnalysisModal.jsx';
import LunarWeatherModal from './components/status/LunarWeatherModal.jsx';
import LandingPage from './components/landing/LandingPage.jsx';
import LunaIntroAnimation from './components/landing/LunaIntroAnimation.jsx';
import MissionsPage from './components/missions/MissionsPage.jsx';
import AboutPage from './components/landing/AboutPage.jsx';
import TransparentLunarSearch from './components/search/TransparentLunarSearch.jsx';
import ToastFeedback from './components/common/ToastFeedback.jsx';
import GuideOverlay from './guide/GuideOverlay.jsx';
import WhatsNewToast from './guide/WhatsNewToast.jsx';
import {
  guideStore,
  showFirstVisitPrompt,
  isFirstVisit,
  getNewStepsForView,
  startGuide,
  skipGuide,
} from './guide/guideStore.js';

import LandingPlannerPage from './pages/LandingPlannerPage.jsx';
import SiteComparisonPage from './pages/SiteComparisonPage.jsx';
import MissionBriefingPage from './pages/MissionBriefingPage.jsx';
import MissionLibraryPage from './pages/MissionLibraryPage.jsx';
import TrajectoryPlannerPage from './pages/TrajectoryPlannerPage.jsx';
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
import { comparisonSelectionStore } from './utils/comparisonEngine.js';

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
      if (hash === 'landing') return 'landing';
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
      if (hash === 'missions') return 'missions';
      if (hash === 'about') return 'about';
      if (hash === 'planner') return 'planner';
      if (hash === 'comparison' || hash === 'compare') return 'comparison';
      if (hash === 'briefing') return 'briefing';
      if (hash === 'library' || hash === 'guide') return 'library';
      if (hash === 'trajectory' || hash === 'orbit' || hash === 'transfer') return 'trajectory';
      if (params.get('autostart') === '1') return 'explorer';
      // Restore from share link (?planet=&lat=&lon=&site=)
      if (params.get('lat') && params.get('lon')) return 'explorer';
      return 'landing';
    }
    return 'landing';
  });

  // Show cinematic LUNA intro animation when the user first arrives at the landing page
  const [showIntro, setShowIntro] = useState(() => currentView === 'landing');

  // Mobile navigation drawer state
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);

  // Helper to ensure view switches to explorer when visualization tools are engaged
  const ensureExplorerView = useCallback(() => {
    if (currentView !== 'explorer') {
      setCurrentView('explorer');
      window.location.hash = '#explorer';
    }
  }, [currentView]);

  // Active mission & comparison candidates
  const [activeMission, setActiveMission] = useState(() => CLPS_MISSIONS[0]);
  const [comparisonMissionB, setComparisonMissionB] = useState(() => CLPS_MISSIONS[1] || null);

  // Spotlight guide state
  const [isGuideActive, setIsGuideActive] = useState(() => guideStore.get().isActive || guideStore.get().isPromptOpen);
  const [newGuideSteps, setNewGuideSteps] = useState([]);

  // Subscribe to guide store updates
  useEffect(() => {
    return guideStore.subscribe((state) => {
      setIsGuideActive(state.isActive || state.isPromptOpen);
    });
  }, []);

  // Check for first-visit guide and what's-new toast when explorer mounts
  useEffect(() => {
    if (
      currentView !== 'explorer' ||
      guideStore.get().isActive ||
      guideStore.get().isPromptOpen
    ) return;
    const timer = setTimeout(() => {
      if (guideStore.get().isActive || guideStore.get().isPromptOpen) return;
      if (isFirstVisit('explorer')) {
        showFirstVisitPrompt('explorer');
      } else {
        const unvisited = getNewStepsForView('explorer');
        if (unvisited.length > 0) {
          setNewGuideSteps(unvisited);
        }
      }
    }, 800);
    return () => clearTimeout(timer);
  }, [currentView]);

  // Listen to hash changes (for browser back/forward buttons and direct bookmark navigation)
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.toLowerCase().replace('#', '');
      if (hash.includes('sp-2d') || hash.includes('southpole')) {
        setCurrentView('explorer');
        setViewMode('sp-2d');
      } else if (hash.includes('explorer') || hash.includes('map') || hash.includes('globe')) {
        setCurrentView('explorer');
      } else if (hash === 'missions') {
        setCurrentView('missions');
      } else if (hash === 'about') {
        setCurrentView('about');
      } else if (hash === 'planner') {
        setCurrentView('planner');
      } else if (hash === 'comparison' || hash === 'compare') {
        setCurrentView('comparison');
      } else if (hash === 'briefing') {
        setCurrentView('briefing');
      } else if (hash === 'library' || hash === 'guide') {
        setCurrentView('library');
      } else if (hash === 'trajectory' || hash === 'orbit' || hash === 'transfer') {
        setCurrentView('trajectory');
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
      pageId === 'site-comparison'
        ? 'comparison'
        : pageId === 'orbit' || pageId === 'transfer'
        ? 'trajectory'
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
  const viewModeRef = useRef(viewMode);
  useEffect(() => {
    viewModeRef.current = viewMode;
  }, [viewMode]);

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
        setIsCelestialOpen(false);
      }
    }
  }, [currentView, viewMode]);

  // In 3D: 'moon' vs 'earth'
  const [activePlanet, setActivePlanet] = useState('moon');

  // Restore share-link params (?planet=&lat=&lon=&site=) on first mount
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const pLat = parseFloat(params.get('lat'));
    const pLon = parseFloat(params.get('lon'));
    if (!Number.isFinite(pLat) || !Number.isFinite(pLon)) return;
    const pPlanet = params.get('planet') === 'earth' ? 'earth' : 'moon';
    const pSite = params.get('site') || null;

    // Clean params from URL so refresh gives a clean state
    const cleanUrl = new URL(window.location.href);
    ['planet', 'lat', 'lon', 'site'].forEach((k) => cleanUrl.searchParams.delete(k));
    window.history.replaceState(null, '', cleanUrl.toString());

    setActivePlanet(pPlanet);
    const knownSite = pSite ? LANDING_SITES.find((s) => s.id === pSite) || null : null;
    const restoredFeature = knownSite || {
      id: pSite || ('share-' + pLon + '-' + pLat),
      name: pSite || 'Shared Location',
      type: 'custom_pin',
      isCustomPin: !pSite,
      body: pPlanet,
      latitude: pLat,
      longitude: pLon,
    };
    setFeatureSelection(restoredFeature, pPlanet);
    setTimeout(() => {
      if (pPlanet === 'earth') {
        globeRef.current?.switchPlanet?.('earth');
        globeRef.current?.flyTo?.(pLon, pLat, 1500000);
      } else {
        getActiveController()?.flyTo(pLon, pLat, 5.0);
      }
      if (pSite) {
        globeRef.current?.selectFeaturePin?.(pSite, pPlanet);
      } else {
        globeRef.current?.dropCustomPin?.(pLon, pLat, 'Shared Location', pPlanet);
      }
    }, 400);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Selenographic coordinates under cursor

  // Selected feature for detail inspection
  const [selectedFeature, setSelectedFeature] = useState(null);
  const [selectedMoonFeature, setSelectedMoonFeature] = useState(null);
  const [selectedEarthFeature, setSelectedEarthFeature] = useState(null);

  // Independent feature memory for 3D globe vs 2D South Pole map
  const [selectedFeature3D, setSelectedFeature3D] = useState(null);
  const [selectedFeature2D, setSelectedFeature2D] = useState(null);
  const selectedFeature3DRef = useRef(null);
  const selectedFeature2DRef = useRef(null);

  // Layer & Tool drawers
  const [layers, setLayers] = useState(LUNAR_LAYERS_CATALOG);
  const [isLayersOpen3D, setIsLayersOpen3D] = useState(false);
  const [isLayersOpen2D, setIsLayersOpen2D] = useState(false);
  const is2DMode = viewMode === '2d' || viewMode === 'sp-2d';
  const isLayersOpen = is2DMode ? isLayersOpen2D : isLayersOpen3D;
  const [isCelestialOpen, setIsCelestialOpen] = useState(false);
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

  // Layer drawer toggle handler for both 3D Globe and 2D South Pole Topo Map
  const handleToggleLayers = useCallback(() => {
    ensureExplorerView();
    if (viewMode === '2d' || viewMode === 'sp-2d') {
      setIsLayersOpen2D((prev) => {
        notifyInfo(!prev ? 'Map Layers Opened [L]' : 'Map Layers Closed [L]', 'Toggled lunar South Pole GIS layers.');
        return !prev;
      });
    } else {
      setIsLayersOpen3D((prev) => {
        const next = !prev;
        if (next) setIsCelestialOpen(false);
        notifyInfo(next ? 'Layers Panel Opened [L]' : 'Layers Panel Closed [L]', 'Toggled lunar basemaps and datasets.');
        return next;
      });
    }
  }, [viewMode, ensureExplorerView]);

  // Active controller selector helper
  const getActiveController = () => {
    if (viewMode === '3d') return globeRef.current;
    return southPoleMapRef.current;
  };

  // Transition handler that preserves independent 3D vs 2D feature panel memory
  const handleViewModeChange = useCallback((nextMode) => {
    const currentMode = viewModeRef.current;
    if (currentMode === nextMode) return;

    const isCurrent3D = currentMode === '3d';
    const isNext3D = nextMode === '3d';

    if (isCurrent3D !== isNext3D) {
      if (isNext3D) {
        // Switched from 2D -> 3D: restore 3D selection memory (or hide panel if null)
        const feat3D = selectedFeature3DRef.current;
        setSelectedFeature(feat3D);
        if (feat3D?.body === 'earth') {
          setSelectedEarthFeature(feat3D);
        } else if (feat3D) {
          setSelectedMoonFeature(feat3D);
        }
        if (feat3D?.id) {
          globeRef.current?.selectFeaturePin?.(feat3D.id, feat3D.body || 'moon');
        } else {
          globeRef.current?.selectFeaturePin?.(null, activePlanet);
        }
      } else {
        // Switched from 3D -> 2D: restore 2D selection memory (or hide panel if null)
        const feat2D = selectedFeature2DRef.current;
        setSelectedFeature(feat2D);
        if (feat2D) {
          setSelectedMoonFeature(feat2D);
        }
      }
    }

    viewModeRef.current = nextMode;
    setViewMode(nextMode);
  }, [activePlanet]);

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
    const is3D = viewModeRef.current === '3d';
    if (is3D) {
      selectedFeature3DRef.current = normalized;
      setSelectedFeature3D(normalized);
    } else {
      selectedFeature2DRef.current = normalized;
      setSelectedFeature2D(normalized);
    }
  }, []);

  const handlePlanetChange = useCallback((body) => {
    const targetBody = body === 'earth' ? 'earth' : 'moon';
    setActivePlanet(targetBody);
    if (targetBody === 'earth') {
      // These controls describe lunar terrain and lunar ephemerides only.
      setIsCelestialOpen(false);
      setIsLayersOpen3D(false);
      setIsLayersOpen2D(false);
      setIsMeasureActive(false);
    }
    setSelectedFeature((prev) => {
      let nextFeat;
      if (targetBody === 'earth') {
        nextFeat = selectedEarthFeature || (prev?.body === 'earth' ? prev : null);
      } else {
        nextFeat = selectedMoonFeature || (prev?.body === 'moon' ? prev : null);
      }
      selectedFeature3DRef.current = nextFeat;
      setSelectedFeature3D(nextFeat);
      return nextFeat;
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
      setSelectedEarthFeature((feature) =>
        feature?.isCustomPin || feature?.type === 'custom_pin' ? null : feature
      );
    } else {
      setCustomMoonPin(null);
      setSelectedMoonFeature((feature) =>
        feature?.isCustomPin || feature?.type === 'custom_pin' ? null : feature
      );
    }
    globeRef.current?.clearCustomPin?.(body);
    globeRef.current?.selectFeaturePin?.(null, body);
    setSelectedFeature((feature) =>
      (feature?.isCustomPin || feature?.type === 'custom_pin') &&
      (feature.body || 'moon') === body
        ? null
        : feature
    );
    if (
      (selectedFeature3DRef.current?.isCustomPin || selectedFeature3DRef.current?.type === 'custom_pin') &&
      (selectedFeature3DRef.current.body || 'moon') === body
    ) {
      selectedFeature3DRef.current = null;
      setSelectedFeature3D(null);
    }
    if (
      (selectedFeature2DRef.current?.isCustomPin || selectedFeature2DRef.current?.type === 'custom_pin') &&
      (selectedFeature2DRef.current.body || 'moon') === body
    ) {
      selectedFeature2DRef.current = null;
      setSelectedFeature2D(null);
    }
    notifyInfo('Waypoint Removed', `Custom waypoint cleared from ${body === 'earth' ? 'Earth' : 'Moon'} surface.`);
  }, [activePlanet]);

  // Unpin active location (custom or cataloged) when closing FeaturePanel
  const handleCloseFeaturePanel = useCallback(() => {
    if (!selectedFeature) return;
    const body = selectedFeature.body === 'earth' ? 'earth' : 'moon';
    const isCustom = Boolean(
      selectedFeature.isCustomPin || selectedFeature.type === 'custom_pin'
    );
    if (isCustom) {
      handleClearCustomPin(body);
    } else {
      if (body === 'earth') {
        setSelectedEarthFeature(null);
      } else {
        setSelectedMoonFeature(null);
      }
      globeRef.current?.selectFeaturePin?.(null, body);
    }
    const is3D = viewModeRef.current === '3d';
    if (is3D) {
      selectedFeature3DRef.current = null;
      setSelectedFeature3D(null);
    } else {
      selectedFeature2DRef.current = null;
      setSelectedFeature2D(null);
    }
    setSelectedFeature(null);
  }, [selectedFeature, handleClearCustomPin]);

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
        } else if (isTransferOrbitOpen) {
          setIsTransferOrbitOpen(false);
        } else if (isCelestialOpen) {
          setIsCelestialOpen(false);
        } else if (isLayersOpen) {
          if (viewMode === '2d' || viewMode === 'sp-2d') {
            setIsLayersOpen2D(false);
          } else {
            setIsLayersOpen3D(false);
          }
        } else if (selectedFeature) {
          handleCloseFeaturePanel();
        }
        return;
      }

      if (e.key === '1') {
        if (viewMode !== '3d') {
          handleViewModeChange('3d');
          notifyInfo('3D Cesium Orbit View [1]', 'Switched to 3D planetary sphere with orbital controls.');
        }
      } else if (e.key === '2') {
        if (viewMode !== '2d') {
          handleViewModeChange('2d');
          notifyInfo('2D Planar GIS Map [2]', 'Switched to 2D planar map with IAU Moon datum.');
        }
      } else if (e.key === 's' || e.key === 'S') {
        handleGoToSouthPole();
      } else if (e.key === 'l' || e.key === 'L') {
        handleToggleLayers();
      } else if ((e.key === 'e' || e.key === 'E') && viewMode === '3d') {
        setIsCelestialOpen((prev) => {
          const next = !prev;
          if (next) setIsLayersOpen3D(false);
          return next;
        });
      } else if (e.key === 'd' || e.key === 'D') {
        setIsDteOpen((prev) => !prev);
      } else if (e.key === 'w' || e.key === 'W') {
        setIsWeatherOpen((prev) => !prev);
      } else if (e.key === 'a' || e.key === 'A') {
        setIsSiteAnalysisOpen((prev) => !prev);
      } else if (e.key === 'c' || e.key === 'C') {
        if (currentView === 'comparison') {
          handleNavigate('explorer');
        } else {
          handleNavigate('comparison');
        }
      } else if (e.key === 'm' || e.key === 'M') {
        handleToggleMeasure();
      } else if (e.key === 'o' || e.key === 'O') {
        setIsTransferOrbitOpen((prev) => !prev);
      } else if (e.key === '?' || (e.key === 'h' && !e.ctrlKey && !e.metaKey && !e.altKey)) {
        e.preventDefault();
        if (isGuideActive) {
          skipGuide();
        } else {
          startGuide(currentView);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    viewMode,
    isGuideActive,
    currentView,
    isComparisonOpen,
    isCelestialOpen,
    isLayersOpen,
    isDteOpen,
    isSiteAnalysisOpen,
    isWeatherOpen,
    isSlipSimulatorOpen,
    isTransferOrbitOpen,
    selectedFeature,
    isMeasureActive,
    handleToggleLayers,
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
            horizonAt(
              HORIZON_TABLE,
              selectedMoonFeature.id,
              azimuthDeg,
              selectedMoonFeature.latitude,
              selectedMoonFeature.longitude
            ),
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
    if (!feature) {
      setSelectedFeature(null);
      setSelectedMoonFeature(null);
      setSelectedEarthFeature(null);
      if (viewModeRef.current === '3d') {
        selectedFeature3DRef.current = null;
        setSelectedFeature3D(null);
      } else {
        selectedFeature2DRef.current = null;
        setSelectedFeature2D(null);
      }
      return;
    }
    if (currentView !== 'explorer') {
      setCurrentView('explorer');
      window.location.hash = '#explorer';
    }
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
        globeRef.current?.flyTo?.(lon, lat);
      } else {
        getActiveController()?.flyTo(lon, lat);
      }
      return;
    }

    if (viewMode === 'sp-2d') {
      southPoleMapRef.current?.flyTo(feature.longitude, feature.latitude);
      southPoleMapRef.current?.selectFeature(feature.id);
      setFeatureSelection(feature, body);
      return;
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

  // Quick Expedition Selection (Moon) - centers camera without altering zoom
  const handleSelectExpedition = (feature, lon, lat) => {
    if (viewMode === '3d' && activePlanet !== 'moon') {
      handlePlanetChange('moon');
    }
    setFeatureSelection(feature, 'moon');
    if (viewMode === '3d') {
      globeRef.current?.switchPlanet?.('moon');
      globeRef.current?.selectFeaturePin?.(feature.id, 'moon');
    }
    getActiveController()?.flyTo(lon, lat);
  };

  // Quick Earth DSN Station Selection - centers camera without altering zoom
  const handleSelectEarthSite = (station) => {
    if (viewMode !== '3d') {
      handleViewModeChange('3d');
    }
    if (activePlanet !== 'earth') {
      handlePlanetChange('earth');
    }
    const normalized = { ...station, body: 'earth' };
    setFeatureSelection(normalized, 'earth');
    setTimeout(() => {
      globeRef.current?.switchPlanet?.('earth');
      globeRef.current?.selectFeaturePin?.(station.id, 'earth');
      globeRef.current?.flyTo?.(station.longitude, station.latitude);
    }, 120);
  };

  const handleOpenComparison = (initialMission = null) => {
    const target = initialMission || selectedMoonFeature || selectedFeature || null;
    if (!target) {
      notifyWarn('No Location Selected', 'Select a site or drop a pin on the 3D Lunar Map first.');
      return;
    }
    if (!comparisonSelectionStore.isFeatureInComparison(target)) {
      comparisonSelectionStore.addLocationFromMap(target);
    }
    setComparisonMissionA(target);
    handleNavigate('comparison');
    notifyInfo('Site Comparison', `Comparing ${target.name || 'Selected Site'}.`);
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
      getActiveController()?.flyTo(lon, lat);
      return;
    }

    handleSelectExpedition(mission, lon, lat);
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
      handleViewModeChange('2d');
    }
    if (isMeasureActive) {
      setIsMeasureActive(false);
      southPoleMapRef.current?.deactivateMeasurement?.();
      mapRef.current?.deactivateMeasurement?.();
      notifyInfo('Measurement Complete', 'Geodesic distance tool deactivated.');
    } else {
      setIsMeasureActive(true);
      setIsLayersOpen2D(false);
      setIsLayersOpen3D(false);
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

  // Fly to feature from panel - center view without changing zoom
  const handleZoomHere = (lon, lat) => {
    getActiveController()?.flyTo(lon, lat);
  };

  const handleSelectOtherBody = (body) => {
    const targetBody = body === 'earth' ? 'earth' : 'moon';
    if (viewMode !== '3d') {
      handleViewModeChange('3d');
    }
    handlePlanetChange(targetBody);
  };

  // Start measurement from feature
  const handleMeasureFromFeature = (lon, lat) => {
    if (viewMode === '3d') handleViewModeChange('2d');
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
      handleViewModeChange(options.viewMode);
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
      if (viewMode === '2d' || viewMode === 'sp-2d') {
        setIsLayersOpen2D(true);
      } else {
        setIsLayersOpen3D(true);
      }
    }
    if (options.openComparison) {
      handleNavigate('comparison');
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

  // Render Landing Page if currentView is 'landing'
  if (currentView === 'landing') {
    return (
      <>
        {showIntro && (
          <LunaIntroAnimation onComplete={() => setShowIntro(false)} />
        )}
        <LandingPage
          onLaunchExplorer={handleLaunchExplorer}
          onNavigate={handleNavigate}
        />
      </>
    );
  }

  return (
    <div className="relative w-screen h-screen overflow-hidden flex flex-col bg-[#050507] text-slate-100 font-sans select-none animate-in fade-in duration-200">
      {/* Accessible skip link */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:px-3 focus:py-1.5 focus:bg-white focus:text-[#050507] focus:font-semibold focus:rounded-md focus:shadow-lg focus:outline-none"
      >
        Skip to main content
      </a>

      {/* Global Mission Workspace Navbar (rendered on all workspace pages; public pages use PublicPageHeader) */}
      {currentView !== 'missions' && currentView !== 'about' && (
        <MainNavbar
          currentView={currentView}
          viewMode={viewMode}
          activePlanet={activePlanet}
          onNavigate={handleNavigate}
          onViewModeChange={(mode) => {
            ensureExplorerView();
            handleViewModeChange(mode);
          }}
          onPlanetChange={(body) => {
            ensureExplorerView();
            if (viewMode !== '3d') handleViewModeChange('3d');
            handlePlanetChange(body);
          }}
          onSearchSelect={handleSearchSelect}
          onOpenGuide={() => startGuide(currentView)}
          isMobileMenuOpen={isMobileNavOpen}
          onToggleMobileMenu={() => setIsMobileNavOpen((prev) => !prev)}
        />
      )}


      {/* ========================================================================= */}
      {/* FLOATING NOTIFICATIONS: Discrete bottom-right corner                      */}
      {/* ========================================================================= */}
      <ToastFeedback
        maxItems={1}
        className={`fixed ${
          currentView === 'explorer' && showLunarTimeline ? 'bottom-24' : 'bottom-5'
        } right-5 z-50 items-end select-none max-w-[calc(100vw-24px)] sm:max-w-xs`}
      />

      {/* ========================================================================= */}
      {/* 2. THREE-PART DASHBOARD BODY: Left Nav Sidebar + Central Workspace        */}
      {/* ========================================================================= */}
      <div className="relative flex-1 min-h-0 w-full flex overflow-hidden">
        {/* Floating Left Navigation Dock (Visualization Controls for Explorer) */}
        {currentView === 'explorer' && (
          <LeftSidebarNav
            viewMode={viewMode}
            activePlanet={activePlanet}
            onViewModeChange={(mode) => {
              ensureExplorerView();
              handleViewModeChange(mode);
            }}
            isLayersOpen={isLayersOpen}
            onToggleLayers={handleToggleLayers}
            isCelestialOpen={isCelestialOpen}
            onToggleCelestial={() => {
              ensureExplorerView();
              setIsCelestialOpen((prev) => {
                const next = !prev;
                if (next) setIsLayersOpen3D(false);
                return next;
              });
            }}
            isAutoRotating={isAutoRotating}
            onToggleAutoRotate={() => {
              ensureExplorerView();
              handleToggleAutoRotate();
            }}
            isSolarLighting={isSolarLighting}
            onToggleLighting={() => {
              ensureExplorerView();
              handleToggleLighting();
            }}
            isMeasureActive={isMeasureActive}
            onToggleMeasure={() => {
              ensureExplorerView();
              handleToggleMeasure();
            }}
            onGoToSouthPole={() => {
              ensureExplorerView();
              handleGoToSouthPole();
            }}
            onResetOverview={() => {
              ensureExplorerView();
              handleResetOverview();
            }}
            isMobileOpen={isMobileNavOpen}
            onCloseMobile={() => setIsMobileNavOpen(false)}
          />
        )}

        {/* Central Lunar Mission Workspace */}
        <div className="relative flex-1 min-w-0 h-full overflow-hidden flex flex-col bg-[#050507]">
          {/* Dedicated Subpage Workspaces (Lazy Loaded) */}
          {currentView !== 'explorer' && (
            <div className="flex-1 w-full h-full overflow-y-auto custom-scrollbar bg-[#050507]">
              <React.Suspense
                fallback={
                  <div className="flex-1 flex flex-col items-center justify-center min-h-[50vh] text-[#8E95A5] font-sans text-xs font-medium tracking-wide gap-3">
                    <div className="w-7 h-7 rounded-full border-2 border-white/15 border-t-white animate-spin" />
                    <span>Initializing mission workspace...</span>
                  </div>
                }
              >
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
                          site.latitude ?? site.lat
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
                    onSelectFrom3DMap={() => {
                      if (viewMode !== '3d') handleViewModeChange('3d');
                      if (activePlanet !== 'moon') handlePlanetChange('moon');
                      handleNavigate('explorer');
                    }}
                    onSelectSiteForView={(site) => {
                      handleFeatureSelect(site);
                      handleNavigate('explorer');
                      setTimeout(() => {
                        getActiveController()?.flyTo(
                          site.longitude ?? site.lon,
                          site.latitude ?? site.lat
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
                  />
                )}
                {currentView === 'missions' && (
                  <MissionsPage
                    onLaunchExplorer={handleLaunchExplorer}
                    onNavigate={handleNavigate}
                  />
                )}
                {currentView === 'about' && (
                  <AboutPage
                    onLaunchExplorer={handleLaunchExplorer}
                    onNavigate={handleNavigate}
                  />
                )}
                {currentView === 'trajectory' && (
                  <TrajectoryPlannerPage
                    onNavigate={handleNavigate}
                  />
                )}
              </React.Suspense>
            </div>
          )}

          {/* Persistent Celestial Explorer Viewport (Maintains Cesium WebGL Context & State) */}
          <main
            id="main-content"
            tabIndex={-1}
            aria-label="Lunar Exploration Workspace"
            className={`relative w-full flex-1 h-full overflow-hidden focus:outline-none ${
              currentView === 'explorer' ? 'block' : 'hidden'
            }`}
          >
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
              isLayersOpen={isLayersOpen2D}
              onToggleLayers={handleToggleLayers}
              onCloseLayers={() => setIsLayersOpen2D(false)}
              onMeasurementChange={handleMeasurementUpdate}
              onSwitchTo3D={() => handleViewModeChange('3d')}
              onOutOfDemBounds={(lat, lon) => {
                notifyWarn(
                  'Target Outside Polar Cap (80°S–90°S)',
                  `${Math.abs(lat).toFixed(1)}°${lat >= 0 ? 'N' : 'S'} is beyond the high-res South Pole DEM. Switch to 3D Globe [1] for global selenographic views.`
                );
              }}
            />
          )}
        </div>

        {/* Real-time Earth & Sun Ephemeris Drawer (3D Mode) */}
        <CelestialPanel
          globeRef={globeRef}
          isActive={viewMode === '3d'}
          isOpen={isCelestialOpen && viewMode === '3d'}
          onClose={() => setIsCelestialOpen(false)}
          vectorsVisible={isVectorsVisible}
          onToggleVectors={handleToggleVectors}
        />

        {/* Floating Layer Management Panel (3D Mode) */}
        <LayerPanel
          isOpen={isLayersOpen3D && viewMode === '3d'}
          onClose={() => setIsLayersOpen3D(false)}
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
          onClose={handleCloseFeaturePanel}
          onZoomHere={handleZoomHere}
          onMeasureFromHere={handleMeasureFromFeature}
          onClearCustomPin={handleClearCustomPin}
          onCompareMission={(mission) => handleOpenComparison(mission)}
          onReturnToComparison={() => handleNavigate('comparison')}
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
            getActiveController()?.flyTo(lon, lat);
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
              getActiveController()?.flyTo(site.longitude, site.latitude);
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
            if (viewMode !== '3d') handleViewModeChange('3d');
            if (activePlanet !== 'earth') handlePlanetChange('earth');
            getActiveController()?.flyTo(site.longitude, site.latitude);
            notifyNavigation?.(site.name, 'Navigated to Earth departure launch facility.');
          }}
          onNavigateToMoonTarget={(site) => {
            if (viewMode !== '3d') handleViewModeChange('3d');
            if (activePlanet !== 'moon') handlePlanetChange('moon');
            handleFeatureSelect(site);
            getActiveController()?.flyTo(site.longitude, site.latitude);
            notifyNavigation?.(site.name, 'Navigated to Lunar target landing site.');
          }}
        />
          </main>
        </div>
      </div>

      {/* Spotlight Coachmark Guide Overlay */}
      <GuideOverlay
        context={{
          hasSelection: Boolean(selectedFeature),
          selectTargetFeature: (siteId) => {
            const targetSite =
              LANDING_SITES.find((s) => s.id === siteId) ||
              LANDING_SITES.find((s) => s.id.includes('malapert')) ||
              LANDING_SITES[0];
            if (targetSite) {
              handleFeatureSelect(targetSite);
            }
          },
          view: currentView,
        }}
        isOtherModalOpen={
          isComparisonOpen ||
          isDteOpen ||
          isSiteAnalysisOpen ||
          isWeatherOpen ||
          isSlipSimulatorOpen
        }
      />

      {/* What's New Toast */}
      <WhatsNewToast
        view={currentView}
        newSteps={newGuideSteps}
        onDismiss={() => setNewGuideSteps([])}
      />
    </div>
  );
}
