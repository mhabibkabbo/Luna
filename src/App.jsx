import React, { useState, useRef, useCallback, useEffect } from 'react';
import MeasurementToolbar from './components/measurements/MeasurementToolbar.jsx';
import RoutePlannerToolbar from './components/measurements/RoutePlannerToolbar.jsx';
import { planRoverTraverse } from './services/routePlannerService.js';

const LayerPanel = React.lazy(() => import('./components/layers/LayerPanel.jsx'));
const FeaturePanel = React.lazy(() => import('./components/features/FeaturePanel.jsx'));
const LunarSunlightTimeline = React.lazy(() => import('./components/features/LunarSunlightTimeline.jsx'));
const CelestialPanel = React.lazy(() => import('./components/celestial/CelestialPanel.jsx'));
const PlanetViewport = React.lazy(() => import('./components/globe/PlanetViewport.jsx'));
const SouthPoleTopoMap = React.lazy(() => import('./components/map/SouthPoleTopoMap.jsx'));
const MissionComparisonModal = React.lazy(() => import('./components/missions/MissionComparisonModal.jsx'));
const SlipSimulatorModal = React.lazy(() => import('./components/missions/SlipSimulatorModal.jsx'));
const TransferOrbitModal = React.lazy(() => import('./components/trajectory/TransferOrbitModal.jsx'));
const DteCalculationModal = React.lazy(() => import('./components/communication/DteCalculationModal.jsx'));
const SiteAnalysisModal = React.lazy(() => import('./components/analysis/SiteAnalysisModal.jsx'));
const LunarWeatherModal = React.lazy(() => import('./components/status/LunarWeatherModal.jsx'));
const MissionsPage = React.lazy(() => import('./components/missions/MissionsPage.jsx'));
const AboutPage = React.lazy(() => import('./components/landing/AboutPage.jsx'));
const LandingPlannerPage = React.lazy(() => import('./pages/LandingPlannerPage.jsx'));
const SiteComparisonPage = React.lazy(() => import('./pages/SiteComparisonPage.jsx'));
const MissionLibraryPage = React.lazy(() => import('./pages/MissionLibraryPage.jsx'));
const TrajectoryPlannerPage = React.lazy(() => import('./pages/TrajectoryPlannerPage.jsx'));

import MainNavbar from './components/navigation/MainNavbar.jsx';
import LeftSidebarNav from './components/navigation/LeftSidebarNav.jsx';
const SavedPinsPanel = React.lazy(() => import('./components/pins/SavedPinsPanel.jsx'));
const LandingPage = React.lazy(() => import('./components/landing/LandingPage.jsx'));
import LunaIntroAnimation from './components/landing/LunaIntroAnimation.jsx';
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

import { CLPS_MISSIONS } from './data/clpsMissions.js';
import { LANDING_SITES } from './data/landingSites.js';
import { LUNAR_LAYERS_CATALOG } from './services/nasa/layers.js';

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
import { parseExplorerRoute, buildExplorerHash } from './utils/explorerRoute.js';
import { featureToRouteWaypoint } from './utils/panelStateMachine.js';

export default function App() {
  const mapRef = useRef(null);
  const southPoleMapRef = useRef(null);
  const globeRef = useRef(null);

  const initialRoute =
    typeof window !== 'undefined'
      ? parseExplorerRoute(window.location.hash, window.location.search)
      : { currentView: 'landing', viewMode: '3d', activePlanet: 'moon' };

  const [currentView, setCurrentView] = useState(() => initialRoute.currentView);

  const [showIntro, setShowIntro] = useState(() => currentView === 'landing');

  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);

  const ensureExplorerView = useCallback(() => {
    if (currentView !== 'explorer') {
      setCurrentView('explorer');
      window.location.hash = '#explorer';
    }
  }, [currentView]);

  const [activeMission, setActiveMission] = useState(() => CLPS_MISSIONS[0]);
  const [comparisonMissionB, setComparisonMissionB] = useState(() => CLPS_MISSIONS[1] || null);

  const [isGuideActive, setIsGuideActive] = useState(() => guideStore.get().isActive || guideStore.get().isPromptOpen);
  const [newGuideSteps, setNewGuideSteps] = useState([]);

  useEffect(() => {
    return guideStore.subscribe((state) => {
      setIsGuideActive(state.isActive || state.isPromptOpen);
    });
  }, []);

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

  useEffect(() => {
    const handleHashChange = () => {
      const parsed = parseExplorerRoute(window.location.hash, window.location.search);
      setCurrentView(parsed.currentView);
      if (parsed.currentView === 'explorer') {
        setViewMode(parsed.viewMode);
        viewModeRef.current = parsed.viewMode;
        setActivePlanet(parsed.activePlanet);
        if (parsed.viewMode === '3d') {
          globeRef.current?.switchPlanet?.(parsed.activePlanet);
        }
      }
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const [viewMode, setViewMode] = useState(() => initialRoute.viewMode);
  const viewModeRef = useRef(viewMode);
  useEffect(() => {
    viewModeRef.current = viewMode;
  }, [viewMode]);

  const [activePlanet, setActivePlanet] = useState(() => initialRoute.activePlanet);

  const handleNavigate = useCallback(
    (pageId) => {
      const normalized =
        pageId === 'site-comparison'
          ? 'comparison'
          : pageId === 'orbit' || pageId === 'transfer'
          ? 'trajectory'
          : pageId;
      setCurrentView(normalized);
      window.location.hash = buildExplorerHash({
        currentView: normalized,
        viewMode: viewModeRef.current,
        activePlanet,
      });
      notifyNavigation(`Navigated to ${normalized}`);
    },
    [activePlanet]
  );

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

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const pLat = parseFloat(params.get('lat'));
    const pLon = parseFloat(params.get('lon'));
    if (!Number.isFinite(pLat) || !Number.isFinite(pLon)) return;
    const pPlanet = params.get('planet') === 'earth' ? 'earth' : 'moon';
    const pSite = params.get('site') || null;

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

  const [selectedFeature, setSelectedFeature] = useState(null);
  const [selectedMoonFeature, setSelectedMoonFeature] = useState(null);
  const [selectedEarthFeature, setSelectedEarthFeature] = useState(null);
  const [isFeaturePanelOpen, setIsFeaturePanelOpen] = useState(true);
  const [featurePanelTab, setFeaturePanelTab] = useState('terrain');

  const [selectedFeature3D, setSelectedFeature3D] = useState(null);
  const [selectedFeature2D, setSelectedFeature2D] = useState(null);
  const selectedFeature3DRef = useRef(null);
  const selectedFeature2DRef = useRef(null);

  const [layers, setLayers] = useState(LUNAR_LAYERS_CATALOG);
  const [isLayersOpen3D, setIsLayersOpen3D] = useState(false);
  const [isLayersOpen2D, setIsLayersOpen2D] = useState(false);
  const is2DMode = viewMode === '2d' || viewMode === 'sp-2d';
  const isLayersOpen = is2DMode ? isLayersOpen2D : isLayersOpen3D;
  const [isCelestialOpen, setIsCelestialOpen] = useState(false);
  const [isComparisonOpen, setIsComparisonOpen] = useState(false);
  const [comparisonMissionA, setComparisonMissionA] = useState(null);

  const [isDteOpen, setIsDteOpen] = useState(false);
  const [isSiteAnalysisOpen, setIsSiteAnalysisOpen] = useState(false);
  const [isWeatherOpen, setIsWeatherOpen] = useState(false);
  const [isSlipSimulatorOpen, setIsSlipSimulatorOpen] = useState(false);
  const [isTransferOrbitOpen, setIsTransferOrbitOpen] = useState(false);
  const [isInsightsOpen, setIsInsightsOpen] = useState(false);

  const [isMeasureActive, setIsMeasureActive] = useState(false);
  const [isAutoRotating, setIsAutoRotating] = useState(false);
  const [solarLightingByPlanet, setSolarLightingByPlanet] = useState({
    moon: true,
    earth: true,
  });
  const isSolarLighting = solarLightingByPlanet[activePlanet] ?? true;
  const [isVectorsVisible, setIsVectorsVisible] = useState(false);
  const [measurement, setMeasurement] = useState({
    coordinates: [],
    totalDistanceKm: 0,
    segmentDistancesKm: [],
    initialBearingDeg: 0,
    isComplete: false,
  });

  const [isRouteActive, setIsRouteActive] = useState(false);
  const isRouteActiveRef = useRef(false);
  useEffect(() => {
    isRouteActiveRef.current = isRouteActive;
  }, [isRouteActive]);
  const [routeStartPoint, setRouteStartPoint] = useState(null);
  const [routeGoalPoint, setRouteGoalPoint] = useState(null);
  const [routeResult, setRouteResult] = useState(null);
  const [isRouteCalculating, setIsRouteCalculating] = useState(false);
  const [routeMaxSlope, setRouteMaxSlope] = useState(15);
  const [routeRoverSpeedKmh, setRouteRoverSpeedKmh] = useState(0.15);

  const handleToggleLayers = useCallback(() => {
    ensureExplorerView();
    if (viewMode === '2d' || viewMode === 'sp-2d') {
      const next = !isLayersOpen2D;
      setIsLayersOpen2D(next);
      notifyInfo(next ? 'Map Layers Opened [L]' : 'Map Layers Closed [L]', 'Toggled lunar South Pole GIS layers.');
    } else {
      const next = !isLayersOpen3D;
      setIsLayersOpen3D(next);
      if (next) setIsCelestialOpen(false);
      notifyInfo(next ? 'Layers Panel Opened [L]' : 'Layers Panel Closed [L]', 'Toggled lunar basemaps and datasets.');
    }
  }, [viewMode, ensureExplorerView, isLayersOpen2D, isLayersOpen3D]);

  const getActiveController = () => {
    if (viewMode === '3d') return globeRef.current;
    return southPoleMapRef.current;
  };

  const handleViewModeChange = useCallback((nextMode) => {
    const currentMode = viewModeRef.current;
    if (currentMode === nextMode) return;

    const isCurrent3D = currentMode === '3d';
    const isNext3D = nextMode === '3d';

    if (isCurrent3D !== isNext3D) {
      if (isNext3D) {
        let feat3D = selectedFeature3DRef.current;
        const feat2D = selectedFeature2DRef.current || selectedFeature;
        const is2DCustom = Boolean(
          feat2D?.isCustomPin ||
          feat2D?.type === 'custom_pin' ||
          (typeof feat2D?.id === 'string' && (feat2D.id.startsWith('sp-probe-') || feat2D.id.startsWith('custom-')))
        );

        if (is2DCustom && feat2D) {
          feat3D = feat2D;
          selectedFeature3DRef.current = feat2D;
          setSelectedFeature3D(feat2D);
        }

        setSelectedFeature(feat3D);
        if (feat3D?.body === 'earth') {
          setSelectedEarthFeature(feat3D);
        } else if (feat3D) {
          setSelectedMoonFeature(feat3D);
        }

        const isFeat3DCustom = Boolean(
          feat3D?.isCustomPin ||
          feat3D?.type === 'custom_pin' ||
          (typeof feat3D?.id === 'string' && (feat3D.id.startsWith('sp-probe-') || feat3D.id.startsWith('custom-')))
        );

        if (isFeat3DCustom && feat3D) {
          const lon = feat3D.longitude ?? feat3D.lon ?? 0;
          const lat = feat3D.latitude ?? feat3D.lat ?? 0;
          const body = feat3D.body || 'moon';
          if (body === 'earth') {
            setCustomEarthPin(feat3D);
          } else {
            setCustomMoonPin(feat3D);
          }
          setTimeout(() => {
            globeRef.current?.dropCustomPin?.(lon, lat, feat3D.name, body);
            globeRef.current?.flyTo?.(lon, lat);
          }, 150);
        } else if (feat3D?.id) {
          globeRef.current?.selectFeaturePin?.(feat3D.id, feat3D.body || 'moon');
        } else {
          globeRef.current?.selectFeaturePin?.(null, activePlanet);
        }
      } else {
        const feat2D = selectedFeature2DRef.current;
        setSelectedFeature(feat2D);
        if (feat2D) {
          setSelectedMoonFeature(feat2D);
        }
      }
    }

    viewModeRef.current = nextMode;
    setViewMode(nextMode);
    if (typeof window !== 'undefined') {
      const nextHash = buildExplorerHash({
        currentView: 'explorer',
        viewMode: nextMode,
        activePlanet,
      });
      if (window.location.hash !== nextHash) {
        window.location.hash = nextHash;
      }
    }
  }, [activePlanet, selectedFeature]);

  const handleResetNorth = useCallback(() => {
    getActiveController()?.resetOverview?.();
    notifyInfo('Orientation Reset', 'Reset view orientation and overview.');
  }, [viewMode]);

  const [surfaceBlendOpacity, setSurfaceBlendOpacity] = useState(0.85);
  const handleSurfaceBlendChange = useCallback((opacity) => {
    setSurfaceBlendOpacity(opacity);
    handleChangeOpacity('lola-color-dem', opacity);
    handleChangeOpacity('lola-shaded-relief', opacity * 0.9);
  }, []);

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

    const isCustom = Boolean(
      normalized.isCustomPin ||
      normalized.type === 'custom_pin' ||
      (typeof normalized.id === 'string' && (normalized.id.startsWith('sp-probe-') || normalized.id.startsWith('custom-')))
    );
    if (isCustom) {
      if (body === 'earth') {
        setCustomEarthPin(normalized);
      } else {
        setCustomMoonPin(normalized);
      }
    }

    const is3D = viewModeRef.current === '3d';
    if (is3D) {
      selectedFeature3DRef.current = normalized;
      setSelectedFeature3D(normalized);
    } else {
      selectedFeature2DRef.current = normalized;
      setSelectedFeature2D(normalized);
    }
    setIsFeaturePanelOpen(true);
  }, []);

  const handlePlanetChange = useCallback((body) => {
    const targetBody = body === 'earth' ? 'earth' : 'moon';
    setActivePlanet(targetBody);
    if (targetBody === 'earth') {
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
    if (typeof window !== 'undefined') {
      const nextHash = buildExplorerHash({
        currentView: 'explorer',
        viewMode: '3d',
        activePlanet: targetBody,
      });
      if (window.location.hash !== nextHash) {
        window.location.hash = nextHash;
      }
    }
    notifyInfo(
      `Switched to ${targetBody === 'earth' ? 'Earth' : 'Moon'} View`,
      targetBody === 'earth'
        ? 'Deep Space Network tracking facilities and ground link stations.'
        : 'Lunar selenographic surface topography and exploration sites.'
    );
  }, [selectedEarthFeature, selectedMoonFeature]);

  const handlePointerCoordinates = useCallback((lon, lat) => {
    pointerStore.set({ lon, lat });
  }, []);

  const handleFeatureSelect = useCallback((featureProps) => {
    if (!featureProps) return;
    const body = featureProps?.body === 'earth' ? 'earth' : 'moon';
    setFeatureSelection(featureProps, body);

    const isCustom = Boolean(
      featureProps.isCustomPin ||
      featureProps.type === 'custom_pin' ||
      (typeof featureProps.id === 'string' && (featureProps.id.startsWith('sp-probe-') || featureProps.id.startsWith('custom-')))
    );

    if (viewMode === '3d') {
      if (isCustom) {
        const lon = featureProps.longitude ?? featureProps.lon ?? 0;
        const lat = featureProps.latitude ?? featureProps.lat ?? 0;
        if (Number.isFinite(lon) && Number.isFinite(lat)) {
          globeRef.current?.dropCustomPin?.(lon, lat, featureProps.name, body);
        }
      } else if (featureProps?.id) {
        globeRef.current?.selectFeaturePin?.(featureProps.id, body);
      }
    }
  }, [setFeatureSelection, viewMode]);

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
    southPoleMapRef.current?.clearSelectedLocation?.();
    setIsFeaturePanelOpen(false);
    notifyInfo('Waypoint Removed', `Custom waypoint cleared from ${body === 'earth' ? 'Earth' : 'Moon'} surface.`);
  }, [activePlanet]);

  const handleCloseFeaturePanel = useCallback(() => {
    setIsFeaturePanelOpen(false);
    const targetFeature = selectedFeature;
    const isCustom = Boolean(
      targetFeature?.isCustomPin || targetFeature?.type === 'custom_pin'
    );
    if (isCustom) {
      handleClearCustomPin(targetFeature?.body || activePlanet);
    } else {
      setSelectedFeature(null);
      setSelectedMoonFeature(null);
      setSelectedEarthFeature(null);
      selectedFeature3DRef.current = null;
      setSelectedFeature3D(null);
      selectedFeature2DRef.current = null;
      setSelectedFeature2D(null);
      globeRef.current?.selectFeaturePin?.(null, targetFeature?.body || activePlanet);
    }
    southPoleMapRef.current?.clearSelectedLocation?.();
  }, [selectedFeature, handleClearCustomPin, activePlanet]);

  const handleReopenFeaturePanel = useCallback(() => {
    if (!selectedFeature) return;
    isRouteActiveRef.current = false;
    setIsRouteActive(false);
    setIsFeaturePanelOpen(true);
  }, [selectedFeature]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.defaultPrevented || e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;

      if (e.key === 'Escape') {
        if (isComparisonOpen) {
          setIsComparisonOpen(false);
          return;
        }
        if (isDteOpen) {
          setIsDteOpen(false);
          return;
        }
        if (isSiteAnalysisOpen) {
          setIsSiteAnalysisOpen(false);
          return;
        }
        if (isWeatherOpen) {
          setIsWeatherOpen(false);
          return;
        }
        if (isSlipSimulatorOpen) {
          setIsSlipSimulatorOpen(false);
          return;
        }
        if (isTransferOrbitOpen) {
          setIsTransferOrbitOpen(false);
          return;
        }
      }

      const tag = e.target?.tagName?.toLowerCase();
      if (
        tag === 'input' || tag === 'textarea' || tag === 'select' ||
        e.target?.isContentEditable || e.target?.closest?.('[data-keyboard-shortcuts-ignore]')
      ) {
        return;
      }

      if (e.key === 'Escape') {
        if (isCelestialOpen) {
          setIsCelestialOpen(false);
        } else if (isLayersOpen) {
          if (viewMode === '2d' || viewMode === 'sp-2d') {
            setIsLayersOpen2D(false);
          } else {
            setIsLayersOpen3D(false);
          }
        } else if (isRouteActive) {
          isRouteActiveRef.current = false;
          setIsRouteActive(false);
          if (selectedFeature) {
            setIsFeaturePanelOpen(true);
          }
        } else if (isFeaturePanelOpen && selectedFeature) {
          handleCloseFeaturePanel();
        } else if (currentView === 'explorer') {
          handleResetOverview();
        }
        return;
      }

      if (e.code === 'Space' && isCelestialOpen && viewMode === '3d' && currentView === 'explorer') {
        e.preventDefault();
        document.getElementById('btn-celestial-play')?.click();
        return;
      }

      if (e.key === 'p' || e.key === 'P') {
        e.preventDefault();
        handleNavigate('planner');
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
      } else if (e.key === 'r' || e.key === 'R') {
        handleToggleRoute();
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
    isRouteActive,
    isFeaturePanelOpen,
    selectedFeature,
    isMeasureActive,
    handleToggleLayers,
    handleViewModeChange,
    handleGoToSouthPole,
    handleToggleMeasure,
    handleCloseFeaturePanel,
    handleNavigate,
    notifyInfo,
    skipGuide,
    startGuide,
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
        console.error('Failed to update the Earth-Moon line of sight.', error);
        globeRef.current?.setCommunicationLink?.(null);
      }
    };

    const scheduleTimelineUpdate = (timeMs) => {
      pendingTimeMs = timeMs;
      if (updateTimer !== null) return;

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

  const handleZoomIn = () => getActiveController()?.zoomIn();
  const handleZoomOut = () => getActiveController()?.zoomOut();
  const handleResetOverview = () => {
    getActiveController()?.resetOverview();
    notifyNavigation('View Reset', 'Returned to global overview.');
  };
  function handleGoToSouthPole() {
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
  }

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
      notifyWarn('No Location Selected', 'Select a site or drop a pin on the Lunar Map first.');
      return null;
    }
    const result = comparisonSelectionStore.toggleLocationFromMap(target);
    setComparisonMissionA(target);
    if (result?.reason === 'REMOVED' || result?.action === 'removed') {
      const count = comparisonSelectionStore.get().locations.length;
      notifyInfo(
        'Removed from Comparison',
        `${target.name || 'Site'} deselected (${count}/8 sites selected).`
      );
    } else if (result?.ok) {
      const count = comparisonSelectionStore.get().locations.length;
      notifySuccess(
        'Added to Comparison',
        `${target.name || 'Site'} selected (${count}/8 sites selected).`
      );
    } else if (result?.reason === 'LIMIT_REACHED') {
      notifyWarn(
        'Maximum 8 Sites Selected',
        'You can compare up to 8 sites at once. Deselect a site to add another.'
      );
    }
    return result;
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

  const handleToggleLayer = (layerId, visible) => {
    const layer = layers.find((l) => l.id === layerId);
    setLayers((prev) =>
      prev.map((l) => (l.id === layerId ? { ...l, visible } : l))
    );
    mapRef.current?.setLayerVisibility(layerId, visible, layer?.opacity);
    globeRef.current?.setLayerVisibility(layerId, visible, layer?.opacity);
    southPoleMapRef.current?.setLayerVisibility?.(layerId, visible);
    notifyInfo(
      visible ? `${layer?.name || 'Dataset'} Enabled` : `${layer?.name || 'Dataset'} Disabled`,
      layer?.description || 'Planetary layer visibility updated.'
    );
  };

  const handleToggleAllSymbols = (visible) => {
    const symbolLayerIds = [
      'lunar-craters',
      'lunar-mountains',
      'lunar-maria',
      'lunar-valleys',
      'lunar-landing-sites',
      'earth-communication-sites',
      'earth-launch-sites',
    ];

    setLayers((prev) =>
      prev.map((l) => (symbolLayerIds.includes(l.id) ? { ...l, visible } : l))
    );

    symbolLayerIds.forEach((id) => {
      const layer = layers.find((l) => l.id === id);
      mapRef.current?.setLayerVisibility(id, visible, layer?.opacity);
      globeRef.current?.setLayerVisibility(id, visible, layer?.opacity);
      southPoleMapRef.current?.setLayerVisibility?.(id, visible, layer?.opacity);
    });

    notifyInfo(
      visible ? 'All Symbology Enabled' : 'All Symbology Hidden',
      visible
        ? 'Showing landing sites, craters, mountains, maria, and valleys.'
        : 'Surface markers hidden for unobstructed terrain viewing.'
    );
  };

  const handleChangeOpacity = (layerId, opacity) => {
    setLayers((prev) =>
      prev.map((l) => (l.id === layerId ? { ...l, opacity } : l))
    );
    mapRef.current?.setLayerVisibility(layerId, true, opacity);
    globeRef.current?.setLayerVisibility(layerId, true, opacity);
  };

  function handleToggleMeasure() {
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
  }

  const handleClearMeasurement = () => {
    southPoleMapRef.current?.clearMeasurement?.();
    mapRef.current?.clearMeasurement?.();
  };

  function handleToggleRoute() {
    if (viewMode === '3d') {
      handleViewModeChange('2d');
    }
    if (isRouteActive) {
      isRouteActiveRef.current = false;
      setIsRouteActive(false);
      if (selectedFeature) {
        setIsFeaturePanelOpen(true);
      }
      notifyInfo('Route Planner Deactivated', 'Surface traverse planning closed.');
    } else {
      isRouteActiveRef.current = true;
      setIsRouteActive(true);
      setIsFeaturePanelOpen(false);
      setIsMeasureActive(false);
      setIsLayersOpen2D(false);
      setIsLayersOpen3D(false);
      southPoleMapRef.current?.deactivateMeasurement?.();
      mapRef.current?.deactivateMeasurement?.();

      const preservedLoc =
        selectedFeature2DRef.current || selectedMoonFeature || selectedFeature;
      const candidateWaypoint = featureToRouteWaypoint(preservedLoc);
      if (candidateWaypoint && (!routeStartPoint || (!routeGoalPoint && !routeResult))) {
        setRouteStartPoint(candidateWaypoint);
      }

      notifyInfo(
        'Surface Route Planner Active',
        'Click map or landmarks to set Traverse Origin (Start) and Destination (Goal).'
      );
    }
  }

  const handleUseSelectedLocationInRoute = useCallback(
    (role = 'start') => {
      const preservedLoc =
        selectedFeature2DRef.current || selectedMoonFeature || selectedFeature;
      const wp = featureToRouteWaypoint(preservedLoc);
      if (!wp) return;
      if (role === 'goal') {
        setRouteGoalPoint(wp);
        setRouteResult(null);
        notifySuccess(
          'Destination Set from Selection',
          wp.name || `${Math.abs(wp.lat).toFixed(2)}°S, ${Math.abs(wp.lon).toFixed(2)}°E`
        );
      } else {
        setRouteStartPoint(wp);
        setRouteResult(null);
        notifySuccess(
          'Traverse Origin Set from Selection',
          wp.name || `${Math.abs(wp.lat).toFixed(2)}°S, ${Math.abs(wp.lon).toFixed(2)}°E`
        );
      }
    },
    [selectedMoonFeature, selectedFeature]
  );

  const handleRoutePointClick = useCallback((point) => {
    if (point && Number.isFinite(point.lat) && Number.isFinite(point.lon)) {
      const routeFeat = {
        id: `route-wp-${point.lon.toFixed(2)}-${point.lat.toFixed(2)}`,
        name: point.name || 'Selected Route Waypoint',
        type: point.name ? 'landmark' : 'custom_pin',
        isCustomPin: !point.name,
        body: 'moon',
        latitude: point.lat,
        longitude: point.lon,
      };
      setSelectedFeature(routeFeat);
      setSelectedMoonFeature(routeFeat);
      selectedFeature2DRef.current = routeFeat;
      setSelectedFeature2D(routeFeat);
    }
    if (!routeStartPoint) {
      setRouteStartPoint(point);
      setRouteResult(null);
      notifySuccess('Traverse Origin Set', point.name || `${Math.abs(point.lat).toFixed(2)}°S, ${Math.abs(point.lon).toFixed(2)}°E`);
    } else if (!routeGoalPoint) {
      setRouteGoalPoint(point);
      notifySuccess('Destination Set', point.name || `${Math.abs(point.lat).toFixed(2)}°S, ${Math.abs(point.lon).toFixed(2)}°E`);
    } else {
      setRouteStartPoint(point);
      setRouteGoalPoint(null);
      setRouteResult(null);
      notifyInfo('New Origin Selected', point.name || `${Math.abs(point.lat).toFixed(2)}°S, ${Math.abs(point.lon).toFixed(2)}°E`);
    }
  }, [routeStartPoint, routeGoalPoint]);

  const handleComputeRoute = useCallback(async () => {
    if (!routeStartPoint || !routeGoalPoint) return;
    setIsRouteCalculating(true);
    try {
      const curTime = celestialTimeStore.get().ms;
      const res = await planRoverTraverse(
        routeStartPoint,
        routeGoalPoint,
        {
          maxSlopeDeg: routeMaxSlope,
          roverSpeedKmh: routeRoverSpeedKmh,
        },
        {
          startEpochMs: curTime,
          roverSpeedKmh: routeRoverSpeedKmh,
        }
      );
      setRouteResult(res);
      if (res.success) {
        notifySuccess(
          'Traverse Route Computed',
          `Distance: ${res.totalDistanceKm} km · Max Slope: ${res.maxSlopeDeg}° · Sunlit: ${res.sunlitPct}%`
        );
      } else {
        notifyWarn('Traverse Impassable', res.reason || 'No path found below slope constraint.');
      }
    } catch (err) {
      notifyWarn('Route Planning Error', err?.message || 'Calculation failed');
    } finally {
      setIsRouteCalculating(false);
    }
  }, [routeStartPoint, routeGoalPoint, routeMaxSlope, routeRoverSpeedKmh]);

  const handleClearRoute = useCallback(() => {
    setRouteStartPoint(null);
    setRouteGoalPoint(null);
    setRouteResult(null);
    notifyInfo('Route Reset', 'Origin and destination cleared.');
  }, []);

  const handleSelectRoutePreset = useCallback((preset) => {
    setRouteStartPoint(preset.start);
    setRouteGoalPoint(preset.goal);
    setRouteResult(null);
    notifyInfo('Preset Loaded', `${preset.start.name} → ${preset.goal.name}`);
  }, []);

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

  const handleSelectSavedPin = useCallback((pin, forceMode) => {
    if (!pin) return;
    const targetBody = pin.body === 'earth' ? 'earth' : 'moon';
    const lon = pin.longitude ?? pin.lon ?? 0;
    const lat = pin.latitude ?? pin.lat ?? 0;

    const isCustom = Boolean(
      pin.isCustomPin ||
      pin.type === 'custom_pin' ||
      (typeof pin.id === 'string' && (pin.id.startsWith('sp-probe-') || pin.id.startsWith('custom-')))
    );

    const shouldSwitchTo3D = forceMode === '3d' || targetBody === 'earth' || lat > -79.9;
    if (shouldSwitchTo3D && viewMode !== '3d') {
      handleViewModeChange('3d');
    }

    if (activePlanet !== targetBody) {
      handlePlanetChange(targetBody);
    }

    if (isCustom) {
      if (targetBody === 'earth') {
        setCustomEarthPin(pin);
      } else {
        setCustomMoonPin(pin);
      }
    }

    handleFeatureSelect(pin);
    setIsFeaturePanelOpen(true);

    const willBe3D = shouldSwitchTo3D || viewMode === '3d';
    setTimeout(() => {
      if (willBe3D) {
        if (isCustom) {
          globeRef.current?.dropCustomPin?.(lon, lat, pin.name, targetBody);
        }
        globeRef.current?.flyTo?.(lon, lat, pin.zoom || 5.0);
      } else {
        southPoleMapRef.current?.flyTo?.(lon, lat, pin.zoom || 4.0);
      }
    }, 200);
  }, [activePlanet, handleFeatureSelect, handlePlanetChange, handleViewModeChange, viewMode]);

  const handleOpenSiteInExplorer = useCallback((site, { force3D = false } = {}) => {
    if (!site) return;
    const lat = site.latitude ?? site.lat ?? 0;
    const lon = site.longitude ?? site.lon ?? 0;
    const targetBody = site.body === 'earth' ? 'earth' : 'moon';
    const shouldUse3D =
      force3D ||
      targetBody === 'earth' ||
      !Number.isFinite(lat) ||
      lat > -79.9 ||
      viewModeRef.current === '3d';

    if (shouldUse3D && viewModeRef.current !== '3d') {
      handleViewModeChange('3d');
    }
    if (shouldUse3D && activePlanet !== targetBody) {
      handlePlanetChange(targetBody);
    }

    setFeatureSelection(site, targetBody);
    setIsFeaturePanelOpen(true);
    handleNavigate('explorer');

    let attempts = 0;
    const flyWhenReady = () => {
      const ctrl = shouldUse3D ? globeRef.current : southPoleMapRef.current;
      if (ctrl?.flyTo) {
        if (site.id) {
          ctrl.selectFeaturePin?.(site.id, targetBody);
        }
        ctrl.flyTo(lon, lat);
        return;
      }
      if (attempts < 15) {
        attempts += 1;
        setTimeout(flyWhenReady, 120);
      }
    };
    setTimeout(flyWhenReady, 120);
  }, [activePlanet, handleNavigate, handlePlanetChange, handleViewModeChange, setFeatureSelection]);

  const handleLaunchExplorer = (options = {}) => {
    const targetMode = options.viewMode || viewModeRef.current || '3d';
    const targetPlanet =
      options.planet === 'earth' || options.planet === 'moon'
        ? options.planet
        : 'moon';
    if (options.viewMode) {
      handleViewModeChange(options.viewMode);
    }
    setActivePlanet(targetPlanet);
    setCurrentView('explorer');
    window.location.hash = buildExplorerHash({
      currentView: 'explorer',
      viewMode: targetMode,
      activePlanet: targetPlanet,
    });

    if (targetPlanet === 'earth') {
      setTimeout(() => {
        globeRef.current?.switchPlanet?.('earth');
      }, 250);
    }

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
      const effectiveMode = options.viewMode || viewModeRef.current;
      if (effectiveMode === '2d' || effectiveMode === 'sp-2d') {
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

  const handleReturnToLanding = () => {
    setCurrentView('landing');
    window.location.hash = '#';
  };

  const hasMoonCoordinates =
    Number.isFinite(selectedMoonFeature?.latitude) &&
    Number.isFinite(selectedMoonFeature?.longitude);
  const is2DTopo = viewMode === '2d' || viewMode === 'sp-2d';
  const showLunarTimeline =
    !is2DTopo &&
    hasMoonCoordinates &&
    isFeaturePanelOpen &&
    !isRouteActive &&
    (activePlanet === 'moon' || Boolean(selectedEarthFeature));
  const selectedCommunicationEarthFeature =
    selectedMoonFeature && selectedEarthFeature ? selectedEarthFeature : null;

  if (currentView === 'landing') {
    return (
      <>
        {showIntro && (
          <LunaIntroAnimation onComplete={() => setShowIntro(false)} />
        )}
        <React.Suspense
          fallback={
            <div className="w-screen h-dvh flex items-center justify-center bg-[#050507]">
              <div className="w-7 h-7 rounded-full border-2 border-white/15 border-t-white animate-spin" />
            </div>
          }
        >
          <LandingPage
            onLaunchExplorer={handleLaunchExplorer}
            onNavigate={handleNavigate}
          />
        </React.Suspense>
      </>
    );
  }

  return (
    <div className="relative w-screen h-dvh overflow-hidden flex flex-col bg-[#050507] text-slate-100 font-sans animate-in fade-in duration-200">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:px-3 focus:py-1.5 focus:bg-white focus:text-[#050507] focus:font-semibold focus:rounded-md focus:shadow-lg focus:outline-none"
      >
        Skip to main content
      </a>

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

      <ToastFeedback
        maxItems={1}
        className={`fixed ${
          currentView === 'explorer' && showLunarTimeline ? 'bottom-[116px]' : 'bottom-5'
        } left-5 z-50 items-start max-w-[calc(100vw-24px)] sm:max-w-xs`}
      />

      <div className="relative flex-1 min-h-0 w-full flex overflow-hidden">
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
            isRouteActive={isRouteActive}
            onToggleRoute={() => {
              ensureExplorerView();
              handleToggleRoute();
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

        <main
          id="main-content"
          tabIndex={-1}
          aria-label={currentView === 'explorer' ? 'Lunar Exploration Workspace' : 'Mission Workspace Content'}
          className="relative flex-1 min-w-0 h-full overflow-hidden flex flex-col bg-[#050507] focus:outline-none"
        >
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
                    onSelectSite={(site, tab = 'terrain') => {
                      if (tab) setFeaturePanelTab(tab);
                      handleFeatureSelect(site);
                    }}
                    onFlyToSite={(site) => handleOpenSiteInExplorer(site, { force3D: true })}
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
                    onSelectSiteForView={(site) => handleOpenSiteInExplorer(site)}
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

          <div
            aria-label="Lunar Exploration Viewport"
            className={`relative w-full flex-1 h-full overflow-hidden select-none ${
              currentView === 'explorer' ? 'block' : 'hidden'
            }`}
          >
        {/* 3D Cesium Orbit View (Strict unmount on 2D switch to invoke viewer.destroy() and free WebGL resources) */}
        {currentView === 'explorer' && viewMode === '3d' && (
          <div className="absolute inset-0 w-full h-full">
            <React.Suspense
              fallback={
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950 text-slate-300">
                  <div className="w-10 h-10 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin mb-3" />
                  <span className="font-mono text-xs tracking-wider uppercase text-cyan-400">Loading 3D Cesium Planetary Engine...</span>
                </div>
              }
            >
              <PlanetViewport
                ref={globeRef}
                onPointerCoordinates={handlePointerCoordinates}
                onFeatureSelect={handleFeatureSelect}
                onDropCustomPin={handleDropCustomPin}
                customPin={activePlanet === 'earth' ? customEarthPin : customMoonPin}
                hasCustomPin={activePlanet === 'earth' ? !!customEarthPin : !!customMoonPin}
                onClearCustomPin={handleClearCustomPin}
                layers={layers}
                activePlanet={activePlanet}
                onPlanetChange={handlePlanetChange}
                onSwitchTo2D={() => handleViewModeChange('2d')}
                isVisible={currentView === 'explorer' && viewMode === '3d'}
              />
            </React.Suspense>
          </div>
        )}

        {currentView === 'explorer' && (viewMode === '2d' || viewMode === 'sp-2d') && (
          <div className="absolute inset-0 w-full h-full">
            <React.Suspense
              fallback={
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950 text-slate-300">
                  <div className="w-10 h-10 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin mb-3" />
                  <span className="font-mono text-xs tracking-wider uppercase text-emerald-400">Loading 2D Topographic GIS...</span>
                </div>
              }
            >
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
                rasterOpacity={surfaceBlendOpacity}
                isRoutePlanning={isRouteActive}
                routeStartPoint={routeStartPoint}
                routeGoalPoint={routeGoalPoint}
                routeResult={routeResult}
                onRoutePointClick={handleRoutePointClick}
                onOutOfDemBounds={(lat, lon) => {
                  notifyWarn(
                    'Target Outside Polar Cap (80°S–90°S)',
                    `${Math.abs(lat).toFixed(1)}°${lat >= 0 ? 'N' : 'S'} is beyond the high-res South Pole DEM. Switch to 3D Globe [1] for global selenographic views.`
                  );
                }}
              />
            </React.Suspense>
          </div>
        )}

        {currentView === 'explorer' && (
          <React.Suspense fallback={null}>
            <CelestialPanel
              globeRef={globeRef}
              activePlanet={activePlanet}
              isActive={viewMode === '3d'}
              isOpen={isCelestialOpen && viewMode === '3d'}
              onClose={() => setIsCelestialOpen(false)}
              vectorsVisible={isVectorsVisible}
              onToggleVectors={handleToggleVectors}
            />

            <LayerPanel
              isOpen={isLayersOpen3D && viewMode === '3d'}
              onClose={() => setIsLayersOpen3D(false)}
              layers={layers}
              onToggleLayer={handleToggleLayer}
              onChangeOpacity={handleChangeOpacity}
              onToggleAllSymbols={handleToggleAllSymbols}
              activePlanet={activePlanet}
            />

            <SavedPinsPanel
              activePinId={selectedFeature?.id}
              onSelectPin={handleSelectSavedPin}
            />

            <FeaturePanel
              feature={isFeaturePanelOpen ? selectedFeature : null}
              timelineVisible={showLunarTimeline}
              communicationEarthFeature={selectedCommunicationEarthFeature}
              initialTab={featurePanelTab}
              onTabChange={setFeaturePanelTab}
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
          </React.Suspense>
        )}

        {selectedFeature && !isFeaturePanelOpen && (
          <button
            type="button"
            data-testid="reopen-location-panel"
            aria-label="Reopen location panel"
            onClick={handleReopenFeaturePanel}
            className="fixed top-16 right-4 z-30 flex items-center gap-2.5 px-3.5 py-2 rounded-xl bg-[#0D0F14]/95 hover:bg-[#131722] border border-white/15 hover:border-cyan-400/50 shadow-[0_8px_24px_rgba(0,0,0,0.65)] text-left transition-all cursor-pointer group"
          >
            <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
            <span className="flex flex-col min-w-0">
              <span className="text-[11px] font-semibold text-white truncate max-w-[180px]">
                {selectedFeature.name || 'Selected Location'}
              </span>
              <span className="text-[10px] font-mono text-cyan-300 tabular-nums">
                {Math.abs(selectedFeature.latitude ?? 0).toFixed(2)}°
                {(selectedFeature.latitude ?? 0) >= 0 ? 'N' : 'S'},{' '}
                {Math.abs(selectedFeature.longitude ?? 0).toFixed(2)}°
                {(selectedFeature.longitude ?? 0) >= 0 ? 'E' : 'W'}
              </span>
            </span>
            <span className="text-[10px] font-mono uppercase tracking-wider text-slate-300 group-hover:text-cyan-300 pl-1 border-l border-white/10">
              Inspect
            </span>
          </button>
        )}

        {currentView === 'explorer' && showLunarTimeline && (
          <React.Suspense fallback={null}>
            <LunarSunlightTimeline
              feature={selectedMoonFeature}
              earthFeature={selectedCommunicationEarthFeature}
            />
          </React.Suspense>
        )}

        {(viewMode === '2d' || viewMode === 'sp-2d') && (
          <MeasurementToolbar
            isActive={isMeasureActive}
            measurement={measurement}
            onToggleActive={handleToggleMeasure}
            onClear={handleClearMeasurement}
          />
        )}

        {(viewMode === '2d' || viewMode === 'sp-2d') && (
          <RoutePlannerToolbar
            isActive={isRouteActive}
            onToggleActive={handleToggleRoute}
            startPoint={routeStartPoint}
            goalPoint={routeGoalPoint}
            routeResult={routeResult}
            isCalculating={isRouteCalculating}
            maxSlopeLimit={routeMaxSlope}
            onChangeMaxSlope={setRouteMaxSlope}
            roverSpeedKmh={routeRoverSpeedKmh}
            onChangeRoverSpeed={setRouteRoverSpeedKmh}
            onComputeRoute={handleComputeRoute}
            onClearRoute={handleClearRoute}
            onSelectPreset={handleSelectRoutePreset}
            selectedLocation={selectedFeature2D || selectedMoonFeature || selectedFeature}
            onUseSelectedLocation={handleUseSelectedLocationInRoute}
          />
        )}

        <React.Suspense fallback={null}>
          {isComparisonOpen && (
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
          )}

          {isDteOpen && (
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
          )}

          {isSiteAnalysisOpen && (
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
          )}

          {isWeatherOpen && (
            <LunarWeatherModal
              isOpen={isWeatherOpen}
              onClose={() => setIsWeatherOpen(false)}
              selectedMoonFeature={selectedMoonFeature || selectedFeature}
            />
          )}

          {isSlipSimulatorOpen && (
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
          )}

          {isTransferOrbitOpen && (
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
          )}
        </React.Suspense>
          </div>
        </main>
      </div>

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
          viewMode,
          setMobileToolbarOpen: setIsMobileNavOpen,
        }}
        isOtherModalOpen={
          isComparisonOpen ||
          isDteOpen ||
          isSiteAnalysisOpen ||
          isWeatherOpen ||
          isSlipSimulatorOpen ||
          isTransferOrbitOpen
        }
      />

      <WhatsNewToast
        view={currentView}
        newSteps={newGuideSteps}
        timelineVisible={currentView === 'explorer' && showLunarTimeline}
        onDismiss={() => setNewGuideSteps([])}
      />
    </div>
  );
}
