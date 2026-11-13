import React, { useState, useMemo, useEffect, useCallback, useRef, useLayoutEffect } from 'react';
import {
  X,
  MapPin,
  Navigation,
  Copy,
  Check,
  Maximize2,
  Minimize2,
  Minus,
  Share2,
  GitCompare,
  Compass,
  Thermometer,
  Radio,
  ShieldCheck,
  Mountain,
  Bookmark,
} from 'lucide-react';
import {
  useSavedPins,
  savePin,
  removeSavedPin,
  isPinSaved,
} from '../../utils/savedPinsStore.js';
import { formatLunarCoordinates, getLunarRegionInfo } from '../../utils/coordinates.js';
import { getCanonicalPolarLandmark, getVolatileDataForFeature } from '../../data/lunarCanonicalCatalog.js';
import { getClpsMission } from '../../data/clpsMissions.js';
import { getLunarTemperature, classifySolarLightingState } from '../../utils/lunarThermal.js';
import { notifySuccess, notifyWarn } from '../../utils/feedbackStore.js';
import { computeCelestialState, solarPosition } from '../../utils/lunarEphemeris.js';
import { celestialTimeStore } from '../../utils/celestialTime.js';
import {
  HORIZON_TABLE,
  horizonAt,
  ensurePolarDemLoaded,
  sampleLunarTerrainMetrics,
} from '../../utils/horizons.js';
import {
  DEFAULT_DTE_CONSTRAINTS,
  earthLookFromMoon,
  evaluateEarthLink,
} from '../../utils/earthLink.js';
import {
  calculateEarthPositionTransition,
  calculateSolarTransition,
} from '../../utils/transitionTimes.js';
import {
  COMMUNICATION_TIMELINE_COLORS,
  SUNLIGHT_TIMELINE_COLORS,
} from '../../utils/visibilityColors.js';
import { EARTH_COMMUNICATION_SITES } from '../../data/earthCommunicationSites.js';
import { fetchSpaceWeather, FALLBACK_SPACE_WEATHER } from '../../services/spaceWeather.js';
import FeaturePanelInfoTab from './tabs/FeaturePanelInfoTab.jsx';
import FeaturePanelTerrainTab from './tabs/FeaturePanelTerrainTab.jsx';
import FeaturePanelThermalTab from './tabs/FeaturePanelThermalTab.jsx';
import FeaturePanelCommsTab from './tabs/FeaturePanelCommsTab.jsx';
import FeaturePanelDossierTab from './tabs/FeaturePanelDossierTab.jsx';

import {
  evaluateCandidateForMissionWindow,
  DEFAULT_PLANNER_CONSTRAINTS,
} from '../../utils/plannerEngine.js';
import { LOLA_VALIDATION_BENCHMARKS } from '../../data/nasaProvenance.js';
import { comparisonSelectionStore } from '../../utils/comparisonEngine.js';

const TABS = [
  { id: 'terrain', label: 'Terrain', icon: Mountain },
  { id: 'communication', label: 'Comms', icon: Radio },
  { id: 'temperature', label: 'Temp', icon: Thermometer },
  { id: 'dossier', label: 'Dossier', icon: ShieldCheck },
  { id: 'info', label: 'Info', icon: Compass },
];

const SUN_STATUS = {
  sunlit: { label: 'Day', color: SUNLIGHT_TIMELINE_COLORS.sunlit },
  blocked: { label: 'Terrain-Shadowed', color: SUNLIGHT_TIMELINE_COLORS.blocked },
  night: { label: 'Night', color: SUNLIGHT_TIMELINE_COLORS.night },
};

const EARTH_STATUS = {
  clear: { label: 'Link Active', color: COMMUNICATION_TIMELINE_COLORS.clear },
  doubtful: { label: 'Marginal', color: COMMUNICATION_TIMELINE_COLORS.doubtful },
  blocked: { label: 'Link Blocked', color: COMMUNICATION_TIMELINE_COLORS.blocked },
  away: { label: 'Far Side', color: '#fb923c' },
};

export default function FeaturePanel({
  feature,
  timelineVisible = false,
  communicationEarthFeature = null,
  onClose,
  onZoomHere,
  onClearCustomPin,
  onCompareMission,
  onReturnToComparison,
  onSelectOtherBody,
  initialTab = 'terrain',
  onTabChange,
}) {
  const isEarthFeature = feature?.body === 'earth';
  const [activeTab, setActiveTab] = useState(initialTab);

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);
  const contentScrollRef = useRef(null);
  const contentScrollTopRef = useRef(0);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copiedDossier, setCopiedDossier] = useState(false);
  const [shared, setShared] = useState(false);
  const [demLoadedTick, setDemLoadedTick] = useState(0);
  const [roughnessRadiusM, setRoughnessRadiusM] = useState(2000);
  const [isDataSourcesOpen, setIsDataSourcesOpen] = useState(false);
  const [isContextExpanded, setIsContextExpanded] = useState(false);
  const [comparisonSnap, setComparisonSnap] = useState(() => comparisonSelectionStore.get());
  const [comparisonFeedbackMsg, setComparisonFeedbackMsg] = useState(null);

  useSavedPins();

  useEffect(() => {
    return comparisonSelectionStore.subscribe((snap) => {
      setComparisonSnap(snap);
    });
  }, []);

  useEffect(() => {
    setComparisonFeedbackMsg(null);
  }, [feature?.id, feature?.latitude, feature?.longitude]);

  const [spaceWeather, setSpaceWeather] = useState(FALLBACK_SPACE_WEATHER);
  const [isWeatherLoading, setIsWeatherLoading] = useState(false);

  const [missionWindowDays, setMissionWindowDays] = useState(14);

  const [selectedStationId, setSelectedStationId] = useState(
    () => communicationEarthFeature?.id || 'all'
  );

  const [tabTimeMs, setTabTimeMs] = useState(() => celestialTimeStore.get().ms);
  const [settledTabTimeMs, setSettledTabTimeMs] = useState(() => celestialTimeStore.get().ms);
  const [trackStartMs, setTrackStartMs] = useState(() => celestialTimeStore.get().ms);

  useEffect(() => {
    return celestialTimeStore.subscribe(({ ms, source }) => {
      if (feature && !isEarthFeature) {
        if (!isMinimized) setTabTimeMs(ms);
        if (source === 'ephemeris-pause') setTrackStartMs(ms);
      }
    });
  }, [feature, isEarthFeature, isMinimized]);

  useEffect(() => {
    ensurePolarDemLoaded()
      .then((grid) => {
        if (grid) setDemLoadedTick((t) => t + 1);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (feature && !isEarthFeature && !isMinimized) {
      setTabTimeMs(celestialTimeStore.get().ms);
      setSettledTabTimeMs(celestialTimeStore.get().ms);
    }
  }, [activeTab, feature, isEarthFeature, isMinimized]);

  useEffect(() => {
    const timeout = setTimeout(() => setSettledTabTimeMs(tabTimeMs), 250);
    return () => clearTimeout(timeout);
  }, [tabTimeMs]);

  useEffect(() => {
    if (communicationEarthFeature?.id) {
      setSelectedStationId(communicationEarthFeature.id);
    }
  }, [communicationEarthFeature]);

  useLayoutEffect(() => {
    if (contentScrollRef.current) {
      contentScrollRef.current.scrollTop = contentScrollTopRef.current;
    }
  }, [feature?.id, feature?.latitude, feature?.longitude, feature?.lat, feature?.lon]);

  useEffect(() => {
    if (feature) {
      setTrackStartMs(celestialTimeStore.get().ms);
      setIsContextExpanded(false);
      setIsMinimized(false);
    }
  }, [feature?.id, feature?.latitude, feature?.longitude, feature?.lat, feature?.lon]);

  const loadWeather = useCallback(async (force = false) => {
    setIsWeatherLoading(true);
    try {
      const data = await fetchSpaceWeather(force);
      setSpaceWeather(data);
    } catch {
      // Fallback handled in service
    } finally {
      setIsWeatherLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'temperature') {
      loadWeather(false);
      const interval = setInterval(() => loadWeather(false), 5 * 60 * 1000);
      return () => clearInterval(interval);
    }
  }, [activeTab, loadWeather]);

  const safeFeature = feature || {};
  const isCustomPin = Boolean(
    safeFeature.isCustomPin || safeFeature.type === 'custom_pin'
  );

  const featLat =
    typeof safeFeature.latitude === 'number'
      ? safeFeature.latitude
      : typeof safeFeature.lat === 'number'
      ? safeFeature.lat
      : -85.9;
  const featLon =
    typeof safeFeature.longitude === 'number'
      ? safeFeature.longitude
      : typeof safeFeature.lon === 'number'
      ? safeFeature.lon
      : 0.0;
  const siteId = safeFeature.id || 'custom-dropped-pin';

  useEffect(() => {
    setIsContextExpanded(false);
  }, [siteId]);

  const clpsData = useMemo(() => {
    if (!feature || isEarthFeature) return null;
    return (
      feature.clpsData ||
      getClpsMission(feature.canonicalId) ||
      getClpsMission(feature.id) ||
      (feature.id === 'landing-odysseus' || feature.id === 'malapert-a'
        ? getClpsMission('clps-im1-odysseus')
        : null)
    );
  }, [feature, isEarthFeature]);

  const isClps = Boolean(
    clpsData || safeFeature.isClps || safeFeature.type === 'clps-mission'
  );

  const isPlaceholderLocation = Boolean(
    feature?.locationType === 'placeholder' ||
    clpsData?.locationType === 'placeholder' ||
    safeFeature?.locationType === 'placeholder'
  );

  const regionInfo = useMemo(() => {
    if (!feature || isEarthFeature) return null;
    return feature.regionInfo || getLunarRegionInfo(featLon, featLat);
  }, [feature, isEarthFeature, featLon, featLat]);

  const terrainMetrics = useMemo(() => {
    if (!feature || isEarthFeature) return null;
    return sampleLunarTerrainMetrics(featLat, featLon, feature, {
      roughnessRadiusM,
    });
  }, [feature, isEarthFeature, featLat, featLon, demLoadedTick, roughnessRadiusM]);

  const state = useMemo(() => computeCelestialState(tabTimeMs), [tabTimeMs]);

  const terrainFn = useMemo(
    () => (azimuthDeg) =>
      horizonAt(HORIZON_TABLE, siteId, azimuthDeg, featLat, featLon) ?? 0,
    [siteId, featLat, featLon, demLoadedTick]
  );

  const moonPoint = useMemo(
    () => ({
      id: siteId,
      name: isCustomPin ? 'Custom Dropped Pin' : clpsData?.name || safeFeature.name || 'Lunar Site',
      latitude: featLat,
      longitude: featLon,
    }),
    [siteId, isCustomPin, clpsData, safeFeature.name, featLat, featLon]
  );

  const flatSun = useMemo(() => {
    if (isPlaceholderLocation) {
      return { azimuthDeg: null, elevationDeg: null, status: 'unmodeled', distanceKm: null };
    }
    return solarPosition(state, featLat, featLon);
  }, [state, featLat, featLon, isPlaceholderLocation]);

  const sunTerrainHorizon = terrainFn(flatSun.azimuthDeg) ?? 0;
  const sun = useMemo(() => {
    if (isPlaceholderLocation) {
      return { azimuthDeg: null, elevationDeg: null, status: 'unmodeled', discPct: null };
    }
    return solarPosition(state, featLat, featLon, sunTerrainHorizon);
  }, [state, featLat, featLon, sunTerrainHorizon, isPlaceholderLocation]);

  const localThermal = useMemo(() => {
    if (!feature || isEarthFeature || isPlaceholderLocation) return null;
    return getLunarTemperature(featLat, featLon, new Date(tabTimeMs), {
      terrainHorizonDeg: sunTerrainHorizon,
      elevationM: terrainMetrics?.elevationM ?? null,
    });
  }, [feature, isEarthFeature, isPlaceholderLocation, featLat, featLon, tabTimeMs, sunTerrainHorizon, terrainMetrics?.elevationM]);

  const solarLightingState = useMemo(() => {
    if (!feature || isEarthFeature || isPlaceholderLocation) return null;
    return classifySolarLightingState({
      sunStatus: sun?.status,
      solarElevationDeg: flatSun?.elevationDeg,
      terrainHorizonDeg: sunTerrainHorizon,
      isDaylight: localThermal?.isDaylight,
      isTerrainShadowed: localThermal?.isTerrainShadowed,
      isPSR: localThermal?.isPSR,
    });
  }, [
    feature,
    isEarthFeature,
    isPlaceholderLocation,
    sun?.status,
    flatSun?.elevationDeg,
    sunTerrainHorizon,
    localThermal?.isDaylight,
    localThermal?.isTerrainShadowed,
    localThermal?.isPSR,
  ]);

  const volatileData = useMemo(() => {
    if (!feature || isEarthFeature || isPlaceholderLocation) return null;
    return getVolatileDataForFeature(feature);
  }, [feature, isEarthFeature, isPlaceholderLocation]);

  const earthLook = useMemo(() => {
    if (isPlaceholderLocation) {
      return { azimuthDeg: null, elevationDeg: null, radiusDeg: 0, isDirectToEarth: false };
    }
    return earthLookFromMoon(state, moonPoint);
  }, [state, moonPoint, isPlaceholderLocation]);

  const earthTerrainHorizon = terrainFn(earthLook.azimuthDeg) ?? 0;

  const activeStation = useMemo(() => {
    if (!selectedStationId || selectedStationId === 'all') return null;
    return (
      EARTH_COMMUNICATION_SITES.find((s) => s.id === selectedStationId) ||
      (communicationEarthFeature?.id === selectedStationId
        ? communicationEarthFeature
        : null)
    );
  }, [selectedStationId, communicationEarthFeature]);

  const generalLink = useMemo(() => {
    if (isPlaceholderLocation) {
      return { status: 'unmodeled', isVisible: false, reason: 'Coordinates TBD' };
    }
    return evaluateEarthLink({
      state,
      moonFeature: moonPoint,
      earthFeature: activeStation,
      constraints: DEFAULT_DTE_CONSTRAINTS,
      terrainFn,
    });
  }, [state, moonPoint, activeStation, terrainFn, isPlaceholderLocation]);

  const solarDiscPct = useMemo(() => {
    if (isPlaceholderLocation || flatSun.elevationDeg == null) return null;
    const r = (state?.sun?.angularDiameterDeg || 0.533) / 2;
    const upperLimb = flatSun.elevationDeg + r;
    const lowerLimb = flatSun.elevationDeg - r;
    if (upperLimb <= sunTerrainHorizon) return 0;
    if (lowerLimb >= sunTerrainHorizon) return 100;
    return Math.round(((upperLimb - sunTerrainHorizon) / (2 * r)) * 100);
  }, [flatSun.elevationDeg, sunTerrainHorizon, state, isPlaceholderLocation]);

  const currentSun = useMemo(
    () => ({
      azimuthDeg: sun.azimuthDeg,
      elevationDeg: sun.elevationDeg,
      radius: state.sun.angularDiameterDeg / 2,
      status: sun.status,
      discPct: solarDiscPct,
      terrainHorizonDeg: sunTerrainHorizon,
    }),
    [sun, state, solarDiscPct, sunTerrainHorizon]
  );

  const currentEarth = useMemo(
    () => ({
      azimuthDeg: earthLook.azimuthDeg,
      elevationDeg: earthLook.elevationDeg,
      radius: earthLook.radiusDeg,
      status: generalLink.status,
      terrainHorizonDeg: earthTerrainHorizon,
    }),
    [earthLook, generalLink.status, earthTerrainHorizon]
  );

  const solarTransition = useMemo(
    () =>
      feature && !isEarthFeature && !isPlaceholderLocation && (activeTab === 'terrain' || activeTab === 'info')
        ? calculateSolarTransition(settledTabTimeMs, featLat, featLon, siteId)
        : null,
    [feature, isEarthFeature, isPlaceholderLocation, activeTab, settledTabTimeMs, featLat, featLon, siteId]
  );

  const earthTransition = useMemo(
    () =>
      feature && !isEarthFeature && !isPlaceholderLocation && (activeTab === 'terrain' || activeTab === 'info')
        ? calculateEarthPositionTransition(settledTabTimeMs, moonPoint)
        : null,
    [feature, isEarthFeature, isPlaceholderLocation, activeTab, settledTabTimeMs, moonPoint]
  );

  const dsnSitesCalculations = useMemo(() => {
    if (isEarthFeature || isPlaceholderLocation || activeTab !== 'communication') return [];
    return EARTH_COMMUNICATION_SITES.map((station) => {
      const evaluation = evaluateEarthLink({
        state,
        moonFeature: moonPoint,
        earthFeature: station,
        constraints: DEFAULT_DTE_CONSTRAINTS,
        terrainFn,
      });
      return {
        ...station,
        evaluation,
      };
    });
  }, [isEarthFeature, activeTab, state, moonPoint, terrainFn]);

  const missionWindowAssessment = useMemo(() => {
    if (!feature || isEarthFeature || isPlaceholderLocation || activeTab !== 'dossier') return null;

    void demLoadedTick;
    const isFarside = Boolean(regionInfo?.isFarside ?? regionInfo?.face === 'Farside');
    const candidate = {
      id: siteId,
      name: moonPoint.name,
      latitude: featLat,
      longitude: featLon,
      isFarSide: isFarside,
      slopeDeg: terrainMetrics?.slopeDeg ?? null,
      elevationM: terrainMetrics?.elevationM ?? null,
      roughnessM: terrainMetrics?.roughnessM ?? null,
    };
    const unifiedEval = evaluateCandidateForMissionWindow(
      candidate,
      settledTabTimeMs,
      missionWindowDays,
      {
        ...DEFAULT_PLANNER_CONSTRAINTS,
        includeDailyBreakdown: true,
      }
    );
    const benchmark = LOLA_VALIDATION_BENCHMARKS.find((item) => item.siteId === siteId);
    const annualEval = benchmark
      ? evaluateCandidateForMissionWindow(candidate, {
          landingMs: settledTabTimeMs,
          durationDays: 365,
          stepHours: 24,
          constraints: DEFAULT_PLANNER_CONSTRAINTS,
        })
      : null;

    const windowScore =
      unifiedEval?.isPartialScore && unifiedEval?.overallScore === null
        ? null
        : unifiedEval?.overallScore ?? null;

    return {
      windowScore,
      sunlitRatio: unifiedEval?.sunlitRatio ?? 0,
      dsnRatio: unifiedEval?.dteUptimeRatio ?? 0,
      longestSunlitHours: unifiedEval?.durationOutlook?.longestSunlitHours ?? 0,
      minTemp: Math.round(unifiedEval?.durationOutlook?.minSurfaceTempC ?? 0),
      maxTemp: Math.round(unifiedEval?.durationOutlook?.maxSurfaceTempC ?? 0),
      dailyScores: unifiedEval?.dailyScores ?? [],
      formulaString: unifiedEval?.formulaString,
      isPartialScore: unifiedEval?.isPartialScore ?? (windowScore === null),
      lolaBenchmark: benchmark
        ? {
          ...benchmark,
          annualSunlitPct: annualEval?.sunlitRatio ?? null,
          annualEarthVisibilityDays:
            annualEval?.dteUptimeRatio != null
              ? Number(((annualEval.dteUptimeRatio / 100) * 365).toFixed(1))
                : null,
          }
        : null,
    };
  }, [
    feature,
    isEarthFeature,
    isPlaceholderLocation,
    activeTab,
    missionWindowDays,
    settledTabTimeMs,
    siteId,
    featLat,
    featLon,
    regionInfo,
    moonPoint.name,
    terrainMetrics,
    demLoadedTick,
  ]);

  const dossierAssessment = useMemo(() => {
    if (!feature || isEarthFeature || isPlaceholderLocation || activeTab !== 'dossier') return null;

    const risks = [];
    const isSunlit = solarLightingState ? solarLightingState.isSunlit : (sun.status === 'sunlit' && !localThermal?.isPSR);
    const sunClearance = flatSun.elevationDeg != null ? flatSun.elevationDeg - (sunTerrainHorizon ?? 0) : null;

    if (solarLightingState?.isPSR) {
      risks.push({
        title: 'Permanently Shadowed Region (PSR) Active',
        severity: 'HIGH',
        desc: 'Cold-trap floor receives zero direct sunlight year-round. Surface temperatures near 40 K require radioisotope heating and external beam/battery power.',
      });
    } else if (solarLightingState?.isTerrainShadowed) {
      risks.push({
        title: 'Terrain-Shadowed (Positive Sun Blocked by Topography)',
        severity: 'HIGH',
        desc: `Sun is at +${flatSun.elevationDeg != null ? flatSun.elevationDeg.toFixed(1) : '0.0'}° above astronomical 0° horizon but occluded by local ${sunTerrainHorizon != null ? sunTerrainHorizon.toFixed(1) : 'crater rim'}° topography. Array output is 0% until solar azimuth clears ridge.`,
      });
    } else if (!isSunlit) {
      risks.push({
        title: 'Lunar Night Phase Active (Sun Below Horizon)',
        severity: 'HIGH',
        desc: `True astronomical lunar night (Sun at ${flatSun.elevationDeg != null ? flatSun.elevationDeg.toFixed(1) : 'negative'}°). Array power output is 0%; lander relies on battery or RPS reserves.`,
      });
    } else if (sunClearance !== null && sunClearance < 1.0) {
      risks.push({
        title: 'Low Solar Elevation Clearance',
        severity: 'MEDIUM',
        desc: `Sun is only ${sunClearance.toFixed(1)}° above local mountain ridge; high risk of terrain shadow casting.`,
      });
    }

    if (generalLink.status === 'blocked') {
      const isKeyhole = generalLink.reason === 'keyhole';
      const isStation = generalLink.reason === 'station';
      risks.push({
        title: isKeyhole ? 'Antenna Zenith Keyhole' : isStation ? 'Ground Station Masked' : 'Telemetry Blackout',
        severity: isKeyhole ? 'MEDIUM' : 'HIGH',
        desc: isKeyhole
          ? 'Earth is directly overhead at zenith, exceeding steerable 2-axis tracking antenna gimbal limit.'
          : isStation
          ? 'Target Earth ground station is below its operational minimum elevation mask.'
          : 'Direct line of sight to Earth is obstructed by lunar curvature or local terrain mask.',
      });
    } else if (generalLink.status === 'doubtful') {
      risks.push({
        title: 'Marginal Earth Line of Sight',
        severity: 'MEDIUM',
        desc: 'Earth disk partially grazes local horizon topography; potential multipath or RF degradation.',
      });
    }

    const surfaceTemp = localThermal?.tempC ?? null;
    if (surfaceTemp != null && surfaceTemp < -150) {
      risks.push({
        title: 'Extreme Cryogenic Surface Environment',
        severity: 'HIGH',
        desc: `Surface temperature is ${surfaceTemp.toFixed(0)}°C. Mechanism cold-welding and battery freeze hazards.`,
      });
    }

    const score = missionWindowAssessment?.windowScore ?? null;
    const isDataWithheld = score === null;
    const isGo = !isDataWithheld && score >= 65 && generalLink.status !== 'blocked' && generalLink.status !== 'away';

    return {
      score,
      isDataWithheld,
      isGo,
      risks,
    };
  }, [
    feature,
    isEarthFeature,
    isPlaceholderLocation,
    activeTab,
    sun.status,
    solarLightingState,
    flatSun.elevationDeg,
    sunTerrainHorizon,
    localThermal?.isPSR,
    localThermal?.tempC,
    generalLink.status,
    generalLink.reason,
    missionWindowAssessment?.windowScore,
  ]);

  const overviewWarnings = useMemo(() => {
    if (!feature || isEarthFeature || activeTab !== 'info') return [];
    const list = [];

    if (isPlaceholderLocation) {
      list.push({
        id: 'warn-placeholder',
        tone: 'neutral',
        text: 'Landing Coordinates Not Published: Official coordinates have not been announced by NASA or Firefly Aerospace. Coordinate-dependent solar, thermal, and DTE telemetry are withheld to prevent fabricated metrics.',
      });
      return list;
    }

    if (terrainMetrics?.slopeDeg != null && terrainMetrics.slopeDeg >= 15) {
      list.push({
        id: 'warn-slope',
        tone: 'critical',
        text: `Slope Hazard: ${terrainMetrics.slopeDeg.toFixed(1)}° exceeds 15° lander tip-over limit`,
      });
    } else if (terrainMetrics?.slopeDeg != null && terrainMetrics.slopeDeg >= 10) {
      list.push({
        id: 'warn-slope-mod',
        tone: 'warning',
        text: `Moderate Slope (${terrainMetrics.slopeDeg.toFixed(1)}°) — precision landing sensors required`,
      });
    }

    if (solarLightingState?.isPSR || localThermal?.isPSR) {
      list.push({
        id: 'warn-psr',
        tone: 'critical',
        text: `Permanent Shadow (PSR): Cryogenic surface (${localThermal.tempC}°C / ${localThermal.tempK} K)`,
      });
    } else if (solarLightingState?.isTerrainShadowed) {
      list.push({
        id: 'warn-sun-masked',
        tone: 'warning',
        text: `Terrain-Shadowed: Sun (+${flatSun.elevationDeg?.toFixed(1) ?? '0.0'}°) occluded by local terrain (${(sunTerrainHorizon ?? 0).toFixed(1)}° horizon)`,
      });
    } else if (solarLightingState?.isTrueNight || sun.status === 'night') {
      list.push({
        id: 'warn-night',
        tone: 'warning',
        text: `Lunar Night Active (${localThermal?.tempC ?? -160}°C) — Sun below astronomical horizon`,
      });
    }

    if (generalLink.status === 'away') {
      list.push({
        id: 'warn-farside',
        tone: 'critical',
        text: 'Lunar Far Side: Direct-to-Earth RF occulted (orbital relay required)',
      });
    } else if (generalLink.status === 'blocked') {
      let warningText = `DTE Line-of-Sight blocked by local terrain (${(earthTerrainHorizon ?? 0).toFixed(1)}° horizon mask)`;
      if (generalLink.reason === 'keyhole') {
        warningText = `Antenna Zenith Keyhole: Earth is directly overhead (${(generalLink.elevationDeg ?? 90).toFixed(1)}° el), exceeding antenna gimbal elevation limit`;
      } else if (generalLink.reason === 'below-horizon') {
        warningText = 'Earth below local lunar horizon (occulted by lunar curvature)';
      } else if (generalLink.reason === 'station') {
        warningText = `Target Earth ground station below minimum elevation mask (${(generalLink.stationElevationDeg ?? 0).toFixed(1)}°)`;
      } else if (generalLink.reason === 'slew') {
        warningText = 'Required antenna slew rate exceeds tracking gimbal limit';
      }
      list.push({
        id: 'warn-dte-blocked',
        tone: 'warning',
        text: warningText,
      });
    }

    return list;
  }, [
    feature,
    isEarthFeature,
    activeTab,
    terrainMetrics,
    localThermal,
    sun.status,
    sunTerrainHorizon,
    generalLink.status,
    generalLink.reason,
    generalLink.elevationDeg,
    generalLink.stationElevationDeg,
    earthTerrainHorizon,
  ]);

  if (!feature) return null;

  const coordResult = isEarthFeature
    ? {
        latStr: `${Math.abs(featLat).toFixed(4)}° ${featLat >= 0 ? 'N' : 'S'}`,
        lonStr: `${Math.abs(featLon).toFixed(4)}° ${featLon >= 0 ? 'E' : 'W'}`,
        fullStr: `${Math.abs(featLat).toFixed(4)}° ${featLat >= 0 ? 'N' : 'S'}, ${Math.abs(featLon).toFixed(4)}° ${featLon >= 0 ? 'E' : 'W'}`,
      }
    : formatLunarCoordinates(featLon, featLat, 4);
  const { latStr, lonStr } = coordResult;
  const fullStr = coordResult.fullStr || coordResult.combined || `${latStr}, ${lonStr}`;

  const siteContextDescription =
    clpsData?.description ||
    clpsData?.objectives ||
    safeFeature.description ||
    `Lunar surface coordinate (${latStr}, ${lonStr}) in the ${
      regionInfo?.province || 'Southern Polar Region'
    }. Evaluated using NASA LRO LOLA digital elevation models and DE421/440 analytical ephemerides.`;

  const copyWithFeedback = (text, { onCopied, title, description }) => {
    if (!navigator.clipboard?.writeText) {
      notifyWarn('Clipboard Unavailable', 'Automatic clipboard access is restricted in this browser.');
      return;
    }
    navigator.clipboard
      .writeText(text)
      .then(() => {
        onCopied?.();
        notifySuccess(title, description);
      })
      .catch(() => {
        notifyWarn('Clipboard Unavailable', 'Could not copy content to clipboard.');
      });
  };

  const handleCopyCoords = () => {
    copyWithFeedback(fullStr, {
      onCopied: () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      },
      title: 'Coordinates Copied',
      description: `${fullStr} copied to clipboard.`,
    });
  };

  const handleShareLocation = () => {
    const url = new URL(window.location.href);
    url.hash = '#explorer';
    url.searchParams.set('planet', isEarthFeature ? 'earth' : 'moon');
    url.searchParams.set('lat', String(Number(featLat.toFixed(4))));
    url.searchParams.set('lon', String(Number(featLon.toFixed(4))));
    if (feature.id) url.searchParams.set('site', feature.id);
    copyWithFeedback(url.toString(), {
      onCopied: () => {
        setShared(true);
        setTimeout(() => setShared(false), 2200);
      },
      title: 'Permalink Copied',
      description: 'Shareable location link copied to clipboard.',
    });
  };

  const handleCopyDossierMarkdown = () => {
    if (!feature || isEarthFeature) return;
    const isGo = dossierAssessment?.isGo ?? false;
    const scoreStr =
      dossierAssessment?.score !== null && dossierAssessment?.score !== undefined
        ? `${dossierAssessment.score} / 100`
        : 'Withheld / Data Unavailable';
    const text = `# LUNA MISSION ASSESSMENT DOSSIER
**Target Landing Site:** ${panelTitle} (${latStr}, ${lonStr})
**Mission Window:** ${missionWindowDays}-Day Flight Evaluation
**Evaluation Epoch:** ${new Date(settledTabTimeMs).toUTCString()}
**Mission Readiness Score:** ${scoreStr} [${
      dossierAssessment?.isDataWithheld
        ? 'DATA WITHHELD'
        : isGo
        ? 'STATUS: GO FOR DESCENT'
        : 'STATUS: CAUTION / CONSTRAINED'
    }]

## 1. SCIENTIFIC & OPERATIONAL CRITERIA
- **Solar Illumination:** ${solarLightingState ? solarLightingState.exposureLabel.toUpperCase() : sun.status === 'sunlit' ? 'DAY (SUNLIT)' : 'NIGHT'}
  - Solar Elevation: ${sun.elevationDeg?.toFixed(2) ?? '0.00'}° (Ridge Clearance: ${(sun.elevationDeg - (sunTerrainHorizon ?? 0)).toFixed(2)}°)
  - Solar Window Availability: ${missionWindowAssessment?.sunlitRatio ?? 0}% (Max Continuous Sun: ${missionWindowAssessment?.longestSunlitHours ?? 0}h)
- **Direct-to-Earth Link (DTE):** ${generalLink.status.toUpperCase()} (${generalLink.reason})
  - Earth Elevation: ${generalLink.elevationDeg?.toFixed(2) ?? '0.00'}°
  - Terrain Clearance Margin: ${generalLink.marginDeg?.toFixed(2) ?? '0.00'}°
  - DSN Window Availability: ${missionWindowAssessment?.dsnRatio ?? 0}%
- **Analytical Thermal Regimen (Calculated):**
  - Surface Temperature: ${localThermal?.tempC?.toFixed(0) ?? 'N/A'}°C (${localThermal?.tempC != null ? (localThermal.tempC + 273.15).toFixed(0) : 'N/A'} K)
  - Window Temperature Extremes: ${missionWindowAssessment?.minTemp ?? -160}°C to ${missionWindowAssessment?.maxTemp ?? 20}°C
- **Topography & Landing Terrain:**
  - Elevation: ${terrainMetrics?.elevationM != null ? `${Math.round(terrainMetrics.elevationM)} m` : 'Not present in LOLA DEM'}
  - Slope: ${terrainMetrics?.slopeDeg != null ? `${terrainMetrics.slopeDeg.toFixed(1)}°` : 'Not present in LOLA DEM'}

## 2. OPERATIONAL RISK MATRIX
${
  !dossierAssessment?.risks || dossierAssessment.risks.length === 0
    ? '- All primary operational safety constraints satisfied with zero critical flags.'
    : dossierAssessment.risks.map((r) => `- [${r.severity}] ${r.title}: ${r.desc}`).join('\n')
}

Generated via LUNA — Lunar Landing Site Navigator
`;
    copyWithFeedback(text, {
      onCopied: () => {
        setCopiedDossier(true);
        setTimeout(() => setCopiedDossier(false), 2200);
      },
      title: 'Mission Dossier Copied',
      description: 'Full Markdown dossier copied to clipboard.',
    });
  };

  const handleTabSelect = (tabId) => {
    const currentTimeMs = celestialTimeStore.get().ms;
    setTabTimeMs(currentTimeMs);
    setSettledTabTimeMs(currentTimeMs);
    setActiveTab(tabId);
    if (onTabChange) onTabChange(tabId);
  };

  const sunStatusMeta = isPlaceholderLocation
    ? { label: 'Coordinates TBD', color: '#94a3b8' }
    : solarLightingState
    ? {
        label: solarLightingState.label,
        color: solarLightingState.isSunlit
          ? SUNLIGHT_TIMELINE_COLORS.sunlit
          : solarLightingState.isTerrainShadowed
          ? SUNLIGHT_TIMELINE_COLORS.blocked
          : SUNLIGHT_TIMELINE_COLORS.night,
      }
    : SUN_STATUS[sun?.status] || { label: 'Day', color: '#fde68a' };

  const earthStatusMeta = isPlaceholderLocation
    ? { label: 'Coordinates TBD', color: '#94a3b8' }
    : generalLink?.status === 'blocked'
    ? generalLink?.reason === 'keyhole'
      ? { label: 'Antenna Keyhole', color: '#f59e0b' }
      : generalLink?.reason === 'below-horizon'
      ? { label: 'Below Horizon', color: COMMUNICATION_TIMELINE_COLORS.blocked }
      : generalLink?.reason === 'station'
      ? { label: 'Station Masked', color: COMMUNICATION_TIMELINE_COLORS.blocked }
      : generalLink?.reason === 'slew'
      ? { label: 'Slew Exceeded', color: '#f59e0b' }
      : { label: 'Terrain Blocked', color: COMMUNICATION_TIMELINE_COLORS.blocked }
    : EARTH_STATUS[generalLink?.status] || {
        label: 'Link Active',
        color: '#60a5fa',
      };
  const lightTravelSec = (state.earth.distanceKm / 299792.458).toFixed(2);

  const panelTitle = isCustomPin
    ? 'Custom Dropped Pin'
    : clpsData?.name || feature.name || 'Custom Dropped Pin';

  const payloadsList = clpsData?.payloads || (Array.isArray(feature.payloads) ? feature.payloads : []);
  const showFullCardData = isExpanded;

  const isSaved = isPinSaved(safeFeature);
  const handleToggleSavePin = () => {
    if (isSaved) {
      removeSavedPin(safeFeature);
    } else {
      savePin(safeFeature);
    }
  };

  if (isMinimized) {
    return (
      <aside
        aria-label="Minimized Lunar Site Information"
        data-guide="feature-panel-minimized"
        className="fixed z-40 right-3 sm:right-4 top-16 bg-[#050507]/95 backdrop-blur-xl border border-slate-800/90 rounded-2xl shadow-[0_12px_35px_rgba(0,0,0,0.85)] flex items-center justify-between gap-3 px-3 py-2 pointer-events-auto transition-all duration-200 animate-in fade-in slide-in-from-top-2"
      >
        <button
          type="button"
          onClick={() => setIsMinimized(false)}
          className="flex items-center gap-2.5 min-w-0 text-left hover:opacity-90 transition-opacity"
          title="Restore full site details"
        >
          <div className="w-7 h-7 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0 shadow-[0_0_12px_rgba(245,158,11,0.25)]">
            <MapPin className="w-3.5 h-3.5" />
          </div>
          <div className="min-w-0">
            <div className="text-[9px] font-mono uppercase tracking-wider text-amber-400 font-semibold truncate leading-none mb-0.5">
              {isCustomPin
                ? 'Custom Waypoint'
                : isClps
                ? `NASA CLPS · ${clpsData?.taskOrder || 'Mission'}`
                : feature.body === 'earth'
                ? 'Earth Station'
                : regionInfo?.face || 'Lunar Site'}
            </div>
            <h2 className="text-xs sm:text-sm font-bold text-white tracking-tight truncate leading-tight max-w-[130px] sm:max-w-[190px]">
              {panelTitle}
            </h2>
          </div>
          {localThermal && (
            <span className="ml-1 hidden sm:inline-flex items-center px-1.5 py-0.5 rounded text-[9.5px] font-mono font-semibold bg-[#0C0D12] border border-slate-800 text-slate-300">
              {localThermal.tempC > 0 ? `+${localThermal.tempC}` : localThermal.tempC}°C
            </span>
          )}
        </button>

        <div className="flex items-center gap-1.5 shrink-0 ml-1">
          <button
            type="button"
            onClick={() => setIsMinimized(false)}
            aria-label="Restore full panel"
            title="Restore full panel"
            className="p-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 hover:text-emerald-300 border border-emerald-500/30 transition-colors shadow-[0_0_8px_rgba(16,185,129,0.12)]"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close panel"
            title="Close panel [Esc]"
            className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 hover:text-rose-300 border border-rose-500/30 transition-colors shadow-[0_0_8px_rgba(244,63,94,0.12)]"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </aside>
    );
  }

  return (
    <aside
      aria-label="Lunar Site Information Panel"
      data-guide="feature-panel"
      className={`fixed z-40 right-3 sm:right-4 top-16 ${
        timelineVisible
          ? 'bottom-[116px] max-h-[calc(100dvh-11.5rem)]'
          : 'bottom-3 sm:bottom-4 max-h-[calc(100dvh-5rem)]'
      } ${
        isExpanded
          ? 'w-[calc(100vw-1.5rem)] max-w-[calc(100vw-1.5rem)] sm:w-[60vw] sm:max-w-[60vw]'
          : 'w-[calc(100vw-1.5rem)] sm:w-[29.5rem]'
      } bg-[#050507]/95 backdrop-blur-xl border border-slate-800/90 rounded-2xl flex flex-col shadow-[0_20px_50px_rgba(0,0,0,0.85)] overflow-hidden transition-all duration-300 ease-out pointer-events-auto`}
    >
      <div
        data-guide="feature-panel-header"
        className="px-3 sm:px-4 py-3 border-b border-white/[0.08] flex items-center justify-between gap-2 sm:gap-3 bg-[#0C0D12] shrink-0"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-amber-500/15 border border-amber-500/35 flex items-center justify-center text-amber-400 shrink-0">
            <MapPin className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 leading-none mb-1">
              <span className="text-[10px] font-mono font-medium uppercase tracking-[0.08em] text-amber-400/90 truncate">
                {isCustomPin
                  ? 'Custom Waypoint'
                  : isClps
                  ? `NASA CLPS · ${clpsData?.taskOrder || 'Mission'}`
                  : feature.body === 'earth'
                  ? 'Earth Station'
                  : regionInfo?.face || 'Lunar Site'}
              </span>
            </div>
            <h2 className="text-[15px] font-display font-semibold text-white tracking-[-0.015em] truncate leading-tight">
              {panelTitle}
            </h2>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => setIsExpanded((prev) => !prev)}
            aria-pressed={isExpanded}
            aria-label={isExpanded ? 'Compact panel width' : 'Expand panel width'}
            title={isExpanded ? 'Restore compact panel width' : 'Expand panel width'}
            className="hidden sm:inline-flex p-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-[#94A3B8] hover:text-white border border-white/[0.08] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/70"
          >
            {isExpanded ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
          <button
            type="button"
            onClick={() => setIsMinimized(true)}
            aria-label="Minimize panel"
            title="Minimize to compact bar"
            className="p-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-[#94A3B8] hover:text-white border border-white/[0.08] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/70"
          >
            <Minus className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close panel"
            title="Close panel [Esc]"
            className="p-1.5 rounded-lg bg-white/[0.04] hover:bg-rose-500/15 text-[#94A3B8] hover:text-rose-300 border border-white/[0.08] hover:border-rose-500/30 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400/70"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {!isEarthFeature && (
        <div
          role="tablist"
          aria-label="Lunar site analysis tabs"
          data-guide="feature-analysis-tabs"
          className="grid grid-cols-5 border-b border-white/[0.08] bg-[#050507] p-1.5 gap-1 shrink-0"
        >
          {TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                id={`feature-tab-${tab.id}`}
                role="tab"
                type="button"
                aria-selected={isActive}
                aria-controls="feature-tabpanel"
                onClick={() => handleTabSelect(tab.id)}
                className={`min-w-0 py-1.5 px-0.5 sm:px-1.5 rounded-lg text-[9px] sm:text-[11.5px] font-sans flex flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-1.5 text-center leading-tight transition-all whitespace-normal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/70 ${
                  isActive
                    ? 'bg-white text-[#050507] font-semibold shadow-sm'
                    : 'text-[#8E95A5] hover:text-white hover:bg-[#0C0D12] font-medium'
                }`}
              >
                {Icon && <Icon className="w-3.5 h-3.5 shrink-0" />}
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      )}

      <div
        ref={contentScrollRef}
        id={!isEarthFeature ? 'feature-tabpanel' : undefined}
        role={!isEarthFeature ? 'tabpanel' : undefined}
        aria-labelledby={!isEarthFeature ? `feature-tab-${activeTab}` : undefined}
        onScroll={(event) => {
          contentScrollTopRef.current = event.currentTarget.scrollTop;
        }}
        className="px-3.5 py-3 space-y-2.5 overflow-y-auto custom-scrollbar flex-1 min-h-0"
      >
        {isEarthFeature && (
          <div className="space-y-2.5">
            <div className="p-2.5 rounded-xl bg-[#0C0D12] border border-slate-800/90 flex items-center justify-between">
              <div className="text-[11px] font-mono text-slate-300">
                {latStr} · {lonStr}
              </div>
              <button
                type="button"
                onClick={handleCopyCoords}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-900 hover:bg-slate-800 text-[10px] font-mono text-cyan-400 border border-slate-800"
              >
                {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
            {feature.description && (
              <p className="text-xs text-slate-300 leading-relaxed">{feature.description}</p>
            )}
            {onSelectOtherBody && (
              <button
                type="button"
                onClick={() => onSelectOtherBody('moon')}
                className="w-full py-2 px-3 rounded-xl bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/30 text-xs font-mono text-cyan-300 transition-colors"
              >
                Switch to Moon View
              </button>
            )}
          </div>
        )}

        {!isEarthFeature && activeTab === 'info' && (
          <FeaturePanelInfoTab
            safeFeature={safeFeature}
            clpsData={clpsData}
            regionInfo={regionInfo}
            featLat={featLat}
            featLon={featLon}
            isPlaceholderLocation={isPlaceholderLocation}
            terrainMetrics={terrainMetrics}
            copied={copied}
            onCopyCoords={handleCopyCoords}
            isContextExpanded={isContextExpanded}
            onToggleContextExpanded={() => setIsContextExpanded((expanded) => !expanded)}
            siteContextDescription={siteContextDescription}
            overviewWarnings={overviewWarnings}
            localThermal={localThermal}
            isExpanded={isExpanded}
            state={state}
            sun={sun}
            sunStatusMeta={sunStatusMeta}
            solarDiscPct={solarDiscPct}
            solarLightingState={solarLightingState}
            sunTerrainHorizon={sunTerrainHorizon}
            solarTransition={solarTransition}
            earthLook={earthLook}
            earthTerrainHorizon={earthTerrainHorizon}
          />
        )}

        {!isEarthFeature && activeTab === 'terrain' && (
          <FeaturePanelTerrainTab
            siteId={siteId}
            featLat={featLat}
            featLon={featLon}
            latStr={latStr}
            lonStr={lonStr}
            moonPoint={moonPoint}
            sun={sun}
            earthLook={earthLook}
            solarLightingState={solarLightingState}
            solarDiscPct={solarDiscPct}
            sunStatusMeta={sunStatusMeta}
            earthStatusMeta={earthStatusMeta}
            solarTransition={solarTransition}
            earthTransition={earthTransition}
            sunTerrainHorizon={sunTerrainHorizon}
            trackStartMs={trackStartMs}
            currentSun={currentSun}
            currentEarth={currentEarth}
            isPlaceholderLocation={isPlaceholderLocation}
            isExpanded={isExpanded}
            terrainMetrics={terrainMetrics}
            regionInfo={regionInfo}
            roughnessRadiusM={roughnessRadiusM}
            onChangeRoughnessRadiusM={setRoughnessRadiusM}
            isDataSourcesOpen={isDataSourcesOpen}
            onToggleDataSources={() => setIsDataSourcesOpen((open) => !open)}
          />
        )}

        {!isEarthFeature && activeTab === 'temperature' && (
          <FeaturePanelThermalTab
            isPlaceholderLocation={isPlaceholderLocation}
            solarLightingState={solarLightingState}
            localThermal={localThermal}
            onRefreshWeather={() => loadWeather(true)}
            isWeatherLoading={isWeatherLoading}
            spaceWeather={spaceWeather}
            volatileData={volatileData}
            isExpanded={isExpanded}
          />
        )}

        {!isEarthFeature && activeTab === 'communication' && (
          <FeaturePanelCommsTab
            earthLook={earthLook}
            generalLink={generalLink}
            lightTravelSec={lightTravelSec}
            moonPoint={moonPoint}
            selectedStationId={selectedStationId}
            onSelectStation={setSelectedStationId}
            dsnSitesCalculations={dsnSitesCalculations}
          />
        )}

        {!isEarthFeature && activeTab === 'dossier' && (
          <FeaturePanelDossierTab
            missionWindowDays={missionWindowDays}
            onChangeMissionWindowDays={setMissionWindowDays}
            onCopyDossierMarkdown={handleCopyDossierMarkdown}
            copiedDossier={copiedDossier}
            isPlaceholderLocation={isPlaceholderLocation}
            missionWindowAssessment={missionWindowAssessment}
            siteName={moonPoint.name}
            dossierAssessment={dossierAssessment}
            solarLightingState={solarLightingState}
            sun={sun}
            earthStatusMeta={earthStatusMeta}
            generalLink={generalLink}
            localThermal={localThermal}
            terrainMetrics={terrainMetrics}
            isClps={isClps}
            clpsData={clpsData}
            payloadsList={payloadsList}
          />
        )}








      </div>

      {(() => {
        const targetFeature = clpsData || feature;
        const isAlreadyAdded =
          !isEarthFeature && comparisonSelectionStore.isFeatureInComparison(targetFeature);
        const isAtLimit =
          !isAlreadyAdded &&
          comparisonSnap.locations.length >= comparisonSnap.maxLocations;
        const showComparisonError =
          !isEarthFeature && comparisonFeedbackMsg?.type === 'error';

        return (
          <>
            {showComparisonError && (
              <div className="px-3 py-1.5 border-t border-slate-800/90 bg-[#050507] flex items-center justify-between gap-2 shrink-0 animate-in fade-in duration-150">
                <span className="text-[10px] font-mono font-semibold text-amber-300 truncate">
                  {comparisonFeedbackMsg.text}
                </span>
              </div>
            )}

            {!isEarthFeature && comparisonSnap.locations.length > 0 && (
              <div
                data-testid="map-comparison-selection-bar"
                role="region"
                aria-label="Comparison site selection bar"
                className="px-3 sm:px-4 py-2 border-t border-white/[0.08] bg-[#0A0B0E] flex flex-col gap-1.5 shrink-0"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                    <span
                      data-testid="map-comparison-selection-count"
                      className="text-[11px] font-mono font-bold text-white whitespace-nowrap tabular-nums"
                    >
                      {comparisonSnap.locations.length}/{comparisonSnap.maxLocations || 8} Sites Selected
                    </span>
                  </div>

                  <button
                    type="button"
                    data-testid="take-me-to-comparison-btn"
                    onClick={() => {
                      comparisonSelectionStore.exitMapSelectionMode();
                      onReturnToComparison?.();
                    }}
                    className="px-3 py-1 rounded-lg bg-white hover:bg-neutral-200 text-[#050507] text-[11px] font-sans font-semibold tracking-tight transition-all active:scale-95 whitespace-nowrap cursor-pointer shadow-sm shrink-0"
                  >
                    Take Me to Comparison
                  </button>
                </div>

                <div className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar py-0.5">
                  {comparisonSnap.locations.map((loc) => (
                    <span
                      key={loc.id}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white/[0.06] border border-white/[0.1] text-[10px] font-mono text-[#CBD5E1] whitespace-nowrap shrink-0"
                    >
                      <span className="truncate max-w-[110px]">{loc.name}</span>
                      <button
                        type="button"
                        onClick={() => comparisonSelectionStore.removeLocation(loc.id)}
                        aria-label={`Remove ${loc.name} from comparison`}
                        className="text-[#8E95A5] hover:text-white ml-0.5 cursor-pointer"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div
              data-guide="site-actions"
              className="px-3 sm:px-4 py-2.5 border-t border-white/[0.08] bg-[#0C0D12] grid grid-cols-2 sm:grid-cols-4 gap-2 shrink-0"
            >
              <button
                type="button"
                onClick={handleToggleSavePin}
                title={isSaved ? 'Remove from saved pins' : 'Save pin for quick access'}
                className={`min-w-0 min-h-8 py-1.5 px-2 rounded-lg font-sans text-[10px] sm:text-[12px] font-medium flex items-center justify-center gap-1.5 text-center leading-tight transition-colors whitespace-normal border ${
                  isSaved
                    ? 'bg-amber-950/40 hover:bg-amber-900/60 text-amber-300 border-amber-500/40'
                    : 'bg-[#050507] hover:bg-white/[0.05] text-[#E2E8F0] border-white/[0.08]'
                }`}
              >
                <Bookmark className={`w-3.5 h-3.5 shrink-0 ${isSaved ? 'text-amber-400 fill-amber-400' : 'text-[#94A3B8]'}`} />
                <span>{isSaved ? 'Saved' : 'Save'}</span>
              </button>

              <button
                type="button"
                onClick={() => onZoomHere?.(featLon, featLat)}
                title="Center map view on this pin"
                className="min-w-0 min-h-8 py-1.5 px-2 rounded-lg bg-white/[0.08] hover:bg-white/[0.14] text-white border border-white/[0.14] font-sans text-[10px] sm:text-[12px] font-medium flex items-center justify-center gap-1.5 text-center leading-tight transition-colors whitespace-normal"
              >
                <Navigation className="w-3.5 h-3.5 shrink-0" />
                <span>{isCustomPin ? 'Center' : 'Center'}</span>
              </button>

              <button
                type="button"
                disabled={isEarthFeature}
                aria-pressed={!isEarthFeature && isAlreadyAdded}
                data-testid="feature-panel-compare-btn"
                onClick={() => {
                  if (isEarthFeature) return;
                  setComparisonFeedbackMsg(null);
                  const res = onCompareMission
                    ? onCompareMission(targetFeature)
                    : comparisonSelectionStore.toggleLocationFromMap(targetFeature);
                  if (res && !res.ok && res.reason === 'LIMIT_REACHED') {
                    setComparisonFeedbackMsg({ type: 'error', text: res.message });
                  }
                }}
                title={
                  isEarthFeature
                    ? 'Site comparison is only available for lunar landing sites and surface features'
                    : isAlreadyAdded
                    ? 'Click again to deselect this site from comparison'
                    : isAtLimit
                    ? `Cannot add: Maximum of ${comparisonSnap.maxLocations} locations reached`
                    : 'Add this site to comparison selection'
                }
                className={`min-w-0 min-h-8 py-1.5 px-2 rounded-lg font-sans text-[10px] sm:text-[12px] font-medium flex items-center justify-center gap-1.5 text-center leading-tight transition-colors whitespace-normal border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/70 disabled:opacity-40 disabled:cursor-not-allowed ${
                  isEarthFeature
                    ? 'bg-[#050507] text-[#64748B] border-white/[0.06]'
                    : isAlreadyAdded
                    ? 'bg-emerald-950/50 hover:bg-emerald-900/60 text-emerald-300 border-emerald-500/50'
                    : isAtLimit
                    ? 'bg-amber-950/40 hover:bg-amber-900/60 text-amber-300 border-amber-500/40'
                    : 'bg-[#050507] hover:bg-white/[0.05] text-[#E2E8F0] border-white/[0.08]'
                }`}
              >
                <GitCompare className={`w-3.5 h-3.5 shrink-0 ${isAlreadyAdded ? 'text-emerald-400' : 'text-[#94A3B8]'}`} />
                <span>{isAlreadyAdded ? 'Compare ✓' : 'Compare'}</span>
              </button>

              <button
                type="button"
                onClick={handleShareLocation}
                title="Copy shareable permalink"
                className="min-w-0 min-h-8 py-1.5 px-2 rounded-lg bg-[#050507] hover:bg-white/[0.05] text-[#E2E8F0] border border-white/[0.08] font-sans text-[10px] sm:text-[12px] font-medium flex items-center justify-center gap-1.5 text-center leading-tight transition-colors whitespace-normal"
              >
                {shared ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span className="text-emerald-300">Copied</span>
                  </>
                ) : (
                  <>
                    <Share2 className="w-3.5 h-3.5 text-[#94A3B8] shrink-0" />
                    <span>Share</span>
                  </>
                )}
              </button>
            </div>
          </>
        );
      })()}
    </aside>
  );
}
