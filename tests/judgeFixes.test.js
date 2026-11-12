import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { PLANNER_CANDIDATES } from '../src/data/plannerCandidates.js';
import {
  DEFAULT_PLANNER_CONSTRAINTS,
  evaluateCandidateForMissionWindow,
  rankLandingCandidates,
} from '../src/utils/plannerEngine.js';
import { ensurePolarDemLoaded } from '../src/utils/horizons.js';
import { findNearestScreenMarker, selectBestPickedMarker } from '../src/utils/markerHitSelection.js';
import { formatLunarCoordinates, getLunarRegionInfo } from '../src/utils/coordinates.js';
import { classifySolarLightingState } from '../src/utils/lunarThermal.js';
import {
  DEFAULT_MISSION_EPOCH_ISO,
  DEFAULT_MISSION_EPOCH_MS,
  SYNCHRONIZED_MISSION_PRESETS,
  buildMissionEpochPresets,
  getMissionOutcomeMeta,
  isMissionAnomaly,
} from '../src/data/missions.js';
import { CLPS_MISSIONS, filterClpsMissions } from '../src/data/clpsMissions.js';
import {
  LOLA_VALIDATION_BENCHMARKS,
  SCORE_PILLAR_METADATA,
  OVERALL_SCORE_METADATA,
} from '../src/data/nasaProvenance.js';

describe('Task 1: Planner Default View & Decoupled Compliance Ranking', () => {
  it('ranks viable sites #1..#k at DEFAULT_MISSION_EPOCH_MS and sets rank=null on disqualified sites', async () => {
    await ensurePolarDemLoaded();
    const results = rankLandingCandidates(PLANNER_CANDIDATES, DEFAULT_MISSION_EPOCH_MS, 14);
    assert.ok(Array.isArray(results) && results.length === PLANNER_CANDIDATES.length);

    const compliant = results.filter((r) => r.isCompliant);
    const disqualified = results.filter((r) => !r.isCompliant);

    assert.ok(compliant.length >= 1, `Expected >=1 compliant sites at ${DEFAULT_MISSION_EPOCH_ISO}, got ${compliant.length}`);

    compliant.forEach((entry, idx) => {
      assert.equal(entry.rank, idx + 1);
      assert.equal(entry.compliantRank, idx + 1);
      assert.equal(entry.potentialScore, entry.overallScore);
    });

    for (const entry of disqualified) {
      assert.equal(entry.rank, null);
      assert.equal(entry.compliantRank, null);
      assert.equal(entry.potentialScore, entry.overallScore);
    }
  });

  it('never assigns #1 or numeric rank to disqualified sites even in challenging/all-disqualified windows', async () => {
    await ensurePolarDemLoaded();

    const novResults = rankLandingCandidates(PLANNER_CANDIDATES, Date.parse('2026-11-11T00:00:00Z'), 14);
    for (const entry of novResults) {
      if (!entry.isCompliant) {
        assert.equal(entry.rank, null);
        assert.equal(entry.compliantRank, null);
      } else {
        assert.equal(typeof entry.rank, 'number');
      }
    }

    const strictResults = rankLandingCandidates(
      PLANNER_CANDIDATES,
      DEFAULT_MISSION_EPOCH_MS,
      14,
      { minSunlitPct: 100, minDtePct: 100, maxSlopeDeg: 0.1 }
    );
    const anyCompliant = strictResults.some((r) => r.isCompliant);
    assert.equal(anyCompliant, false);
    assert.ok(strictResults.every((r) => r.rank === null && r.compliantRank === null));
    assert.ok(strictResults.every((r) => typeof r.potentialScore === 'number'));
  });
});

describe('Task 2: Screen-Space Marker Hit Resolution', () => {
  it('selects nearest 2D marker rather than first matching array element (Odysseus over South Pole)', () => {
    const southPole = { id: 'south-pole', name: 'Lunar South Pole' };
    const odysseus = { id: 'malapert-a', name: 'Odysseus (IM-1)' };

    const entries = [
      { item: southPole, pt: { x: 100, y: 100 }, priority: 2 },
      { item: odysseus, pt: { x: 108, y: 100 }, priority: 1 },
    ];

    const hit = findNearestScreenMarker({ x: 107, y: 100 }, entries, 14);
    assert.equal(hit?.id, 'malapert-a');

    const miss = findNearestScreenMarker({ x: 200, y: 200 }, entries, 14);
    assert.equal(miss, null);
  });

  it('prefers direct billboard center hit over overhanging neighboring label in Cesium drillPick', () => {
    const southPoleEntity = { id: 'south-pole' };
    const odysseusEntity = { id: 'landing-odysseus' };

    const winner = selectBestPickedMarker(
      { x: 136, y: 102 },
      [
        {
          entity: southPoleEntity,
          feature: { id: 'south-pole', name: 'Lunar South Pole' },
          centerPt: { x: 100, y: 100 },
          hitType: 'label',
          maxHitRadiusPx: 26,
        },
        {
          entity: odysseusEntity,
          feature: { id: 'landing-odysseus', name: 'Odysseus (IM-1)' },
          centerPt: { x: 136, y: 102 },
          hitType: 'billboard',
          maxHitRadiusPx: 26,
        },
      ]
    );

    assert.equal(winner, odysseusEntity);

    // Direct WebGL billboard hits must not be discarded even on taller/scaled icons (> maxHitRadiusPx * 1.75)
    const offsetBillboard = selectBestPickedMarker(
      { x: 100, y: 50 },
      [
        {
          entity: odysseusEntity,
          feature: { id: 'landing-odysseus', name: 'Odysseus (IM-1)' },
          centerPt: { x: 100, y: 105 },
          hitType: 'billboard',
          maxHitRadiusPx: 26,
        },
      ]
    );
    assert.equal(offsetBillboard, odysseusEntity);
  });

  it('keeps click-handler helpers in scope across 3D Cesium and 2D Leaflet modules', async () => {
    const tsMod = await import('typescript');
    const ts = tsMod.default || tsMod;
    const files = [
      'src/cesium/moon/index.js',
      'src/cesium/moon/moonFeatures.js',
      'src/cesium/earth/index.js',
      'src/cesium/earth/earthFeatures.js',
      'src/cesium/globeCameraControls.js',
      'src/components/globe/PlanetViewport.jsx',
      'src/components/map/SouthPoleTopoMap.jsx',
      'src/components/features/FeaturePanel.jsx',
      'src/components/features/LunarSunlightTimeline.jsx',
      'src/components/features/HorizonViewChart.jsx',
      'src/components/analysis/SiteAnalysisModal.jsx',
      'src/components/navigation/MainNavbar.jsx',
      'src/pages/MissionLibraryPage.jsx',
      'src/pages/SiteComparisonPage.jsx',
      'src/App.jsx',
    ];
    const prog = ts.createProgram(files, {
      allowJs: true,
      checkJs: true,
      jsx: ts.JsxEmit.React,
      noEmit: true,
      moduleResolution: ts.ModuleResolutionKind.Bundler,
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext,
    });
    for (const file of files) {
      const sf = prog.getSourceFile(file);
      assert.ok(sf, `Missing source file ${file}`);
      const scopeErrors = prog
        .getSemanticDiagnostics(sf)
        .filter((d) => [2304, 2448, 2454, 2552, 2305, 2614].includes(d.code))
        .map((d) => ts.flattenDiagnosticMessageText(d.messageText, ' '));
      assert.deepEqual(scopeErrors, [], `Scope/import errors in ${file}: ${scopeErrors.join('; ')}`);
    }
  });
});

describe('Task 3: South Pole Panel & Hemisphere Labels', () => {
  it('labels 90°S pole as Polar Highlands rather than Lunar Nearside', () => {
    const pole = getLunarRegionInfo(0, -90);
    assert.equal(pole.isSouthPole, true);
    assert.equal(pole.face, 'Lunar South Pole (90°S Polar Highlands)');
    assert.equal(pole.face.includes('Lunar Nearside'), false);

    const odysseus = getLunarRegionInfo(1.44, -80.13);
    assert.equal(odysseus.isSouthPole, true);
    assert.ok(odysseus.face.includes('South Pole'));
    assert.equal(odysseus.isNearside, true);
    assert.equal(odysseus.isFarside, false);
  });

  it('sets boolean nearside/farside flags consistently', () => {
    const farside = getLunarRegionInfo(-154.0, -43.3);
    assert.equal(farside.isFarside, true);
    assert.equal(farside.isNearside, false);

    const apollo11 = getLunarRegionInfo(23.47, 0.67);
    assert.equal(apollo11.isNearside, true);
    assert.equal(apollo11.isFarside, false);
  });
});

describe('Task 4: Polar Siting Solar Lighting States (Day / Terrain-Shadowed / Night / PSR)', () => {
  it('classifies positive blocked sun (+1.6°) as Terrain-Shadowed instead of Night', () => {
    const blockedExplicit = classifySolarLightingState({
      sunStatus: 'blocked',
      solarElevationDeg: 1.6,
      terrainHorizonDeg: 2.5,
    });
    assert.equal(blockedExplicit.key, 'terrain-shadowed');
    assert.equal(blockedExplicit.label, 'Terrain-Shadowed');
    assert.equal(blockedExplicit.isTerrainShadowed, true);
    assert.equal(blockedExplicit.isTrueNight, false);
    assert.equal(blockedExplicit.isSunlit, false);

    const positiveInferred = classifySolarLightingState({
      solarElevationDeg: 1.6,
      terrainHorizonDeg: 2.5,
      isDaylight: false,
    });
    assert.equal(positiveInferred.key, 'terrain-shadowed');
  });

  it('classifies sunlit, below-horizon night, and PSR distinctly', () => {
    const day = classifySolarLightingState({
      sunStatus: 'sunlit',
      solarElevationDeg: 5.0,
      terrainHorizonDeg: 2.0,
    });
    assert.equal(day.key, 'day');
    assert.equal(day.label, 'Day');
    assert.equal(day.isSunlit, true);

    const night = classifySolarLightingState({
      sunStatus: 'night',
      solarElevationDeg: -1.6,
      terrainHorizonDeg: 1.5,
    });
    assert.equal(night.key, 'night');
    assert.equal(night.label, 'Night');
    assert.equal(night.isTrueNight, true);
    assert.equal(night.isTerrainShadowed, false);

    const psr = classifySolarLightingState({
      solarElevationDeg: 1.0,
      terrainHorizonDeg: 4.0,
      isPSR: true,
    });
    assert.equal(psr.key, 'psr');
    assert.equal(psr.label, 'Permanent Shadow');
    assert.equal(psr.isPSR, true);
  });
});

describe('Task 5 & 6: Centralized Schedules, Outcome Categories & Anomaly Filter', () => {
  it('exposes synchronized mission presets anchored on DEFAULT_MISSION_EPOCH_ISO', () => {
    assert.equal(DEFAULT_MISSION_EPOCH_ISO, '2027-03-15T12:00:00Z');
    assert.equal(DEFAULT_MISSION_EPOCH_MS, Date.parse('2027-03-15T12:00:00Z'));

    const presets = buildMissionEpochPresets({ includeShifts: true });
    assert.equal(presets[0].id, SYNCHRONIZED_MISSION_PRESETS[0].id);
    assert.equal(presets[0].getMs(), DEFAULT_MISSION_EPOCH_MS);
    assert.ok(presets.some((p) => p.id === 'shift-14d'));
    assert.ok(presets.some((p) => p.id === 'live-utc'));
  });

  it('records IM-2 Athena as Partial with side-landing reason and accurate Anomaly filter results', () => {
    const im2 = CLPS_MISSIONS.find((m) => m.id === 'clps-im2-athena');
    assert.ok(im2, 'clps-im2-athena must exist');
    assert.equal(im2.outcome, 'partial');
    assert.ok(/side|curtailed/i.test(im2.outcomeReason), `Unexpected IM-2 outcomeReason: ${im2.outcomeReason}`);
    assert.equal(isMissionAnomaly(im2), true);
    assert.equal(getMissionOutcomeMeta(im2).label, 'Partial');

    const bgm1 = CLPS_MISSIONS.find((m) => m.id === 'clps-firefly-bgm1');
    assert.equal(bgm1?.outcome, 'success');
    assert.equal(isMissionAnomaly(bgm1), false);

    const anomalies = filterClpsMissions({ status: 'anomaly' });
    const anomalyIds = new Set(anomalies.map((m) => m.id));
    assert.ok(anomalyIds.has('clps-im1-odysseus'));
    assert.ok(anomalyIds.has('clps-im2-athena'));
    assert.ok(anomalyIds.has('clps-peregrine-pm1'));
    assert.ok(anomalyIds.has('clps-draper-cp12'));
    assert.equal(anomalyIds.has('clps-firefly-bgm1'), false);

    const reasonSearch = filterClpsMissions({ query: 'curtailed' });
    assert.ok(reasonSearch.some((m) => m.id === 'clps-im2-athena'));
  });
});

describe('Task 7: LRO/LOLA Benchmark Validation & Pillar Uncertainty Notes', () => {
  it('agrees with Connecting Ridge published annual illumination within ±8%', async () => {
    await ensurePolarDemLoaded();
    const bm = LOLA_VALIDATION_BENCHMARKS[0];
    assert.equal(bm.siteId, 'landing-artemis3-connecting-ridge-crest');

    const ev = evaluateCandidateForMissionWindow(
      {
        id: bm.siteId,
        name: bm.siteName,
        lat: bm.latitude,
        lon: bm.longitude,
      },
      {
        landingMs: DEFAULT_MISSION_EPOCH_MS,
        durationDays: 365,
        stepHours: 24,
        constraints: DEFAULT_PLANNER_CONSTRAINTS,
      }
    );

    const delta = Math.abs((ev.sunlitRatio ?? 0) - bm.publishedIllumPct);
    assert.ok(
      delta <= 8.0,
      `Expected Connecting Ridge sunlitRatio (${ev.sunlitRatio}%) within ±8.0% of ${bm.publishedIllumPct}% (delta=${delta.toFixed(1)}%)`
    );

    const lunaDteDaysPerYear = Number((((ev.dteUptimeRatio ?? 0) / 100) * 365).toFixed(1));
    assert.ok(lunaDteDaysPerYear > 150 && lunaDteDaysPerYear <= 365);
    for (const row of LOLA_VALIDATION_BENCHMARKS) {
      assert.ok(Number.isFinite(row.publishedDteDaysPerYear) && row.publishedDteDaysPerYear > 0);
      assert.ok(typeof row.publishedDteDaysNote === 'string' && row.publishedDteDaysNote.includes('d/yr'));
    }
  });

  it('provides howComputed methodology and uncertainty bounds for all 4 score pillars and overall score', () => {
    for (const key of ['solar', 'dte', 'slope', 'thermal']) {
      const meta = SCORE_PILLAR_METADATA[key];
      assert.ok(meta, `Missing metadata for pillar "${key}"`);
      assert.ok(typeof meta.title === 'string' && meta.title.length > 0);
      assert.ok(typeof meta.uncertainty === 'string' && meta.uncertainty.includes('±'));
      assert.ok(typeof meta.howComputed === 'string' && meta.howComputed.length > 15);
      assert.ok(typeof meta.uncertaintyNote === 'string' && meta.uncertaintyNote.length > 15);
    }
    assert.ok(OVERALL_SCORE_METADATA);
    assert.ok(OVERALL_SCORE_METADATA.uncertainty.includes('±'));
    assert.ok(OVERALL_SCORE_METADATA.shortHowComputed.length > 15);
  });
});

describe('Regression Audit Fixes: Farside DTE, Coordinates, and Unmodeled DEM Scoring', () => {
  it('suppresses direct-to-Earth DTE on mid-latitude farside sites even without candidate.isFarSide while preserving polar libration', async () => {
    await ensurePolarDemLoaded();

    const farsideNoFlag = evaluateCandidateForMissionWindow(
      {
        id: 'test-schrodinger',
        name: 'Schrodinger Mid-Lat Farside Proxy',
        lat: -43.3,
        lon: -154.0,
      },
      DEFAULT_MISSION_EPOCH_MS,
      14,
      DEFAULT_PLANNER_CONSTRAINTS
    );
    assert.equal(farsideNoFlag.candidate.isFarSide, true);
    assert.equal(farsideNoFlag.dteUptimeRatio, 0);
    assert.equal(farsideNoFlag.instant.dteStatus, 'away');
    assert.ok(farsideNoFlag.violations.some((v) => v.type === 'dte_blocked'));

    // Polar site beyond ±90° longitude can still see Earth via lunar libration
    const polarRimNoFlag = evaluateCandidateForMissionWindow(
      {
        id: 'test-polar-132e',
        name: 'Peak Near Shackleton 132E',
        lat: -89.01,
        lon: 132.06,
      },
      DEFAULT_MISSION_EPOCH_MS,
      14,
      DEFAULT_PLANNER_CONSTRAINTS
    );
    assert.equal(polarRimNoFlag.candidate.isFarSide, false);
    assert.ok(polarRimNoFlag.dteUptimeRatio > 0, `Expected polar libration DTE > 0%, got ${polarRimNoFlag.dteUptimeRatio}%`);
  });

  it('provides non-empty formatted lunar coordinate string via combined for clipboard copy', () => {
    const formatted = formatLunarCoordinates(59.1, 17.0, 4);
    assert.ok(typeof formatted.latStr === 'string' && formatted.latStr.length > 0);
    assert.ok(typeof formatted.lonStr === 'string' && formatted.lonStr.length > 0);
    assert.ok(typeof formatted.combined === 'string' && formatted.combined.includes('°'));
  });
});

describe('Regression Fixes: Repeated Multi-Click & Double-Click Stability', () => {
  const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const readRepoFile = (relPath) => readFileSync(resolve(repoRoot, relPath), 'utf8');

  it('disables Cesium Viewer default LEFT_CLICK / LEFT_DOUBLE_CLICK entity tracking on Moon and Earth viewers', () => {
    for (const relPath of ['src/cesium/moon/index.js', 'src/cesium/earth/index.js']) {
      const src = readRepoFile(relPath);
      assert.ok(
        src.includes('viewer.screenSpaceEventHandler.removeInputAction(') &&
          src.includes('Cesium.ScreenSpaceEventType.LEFT_CLICK') &&
          src.includes('Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK'),
        `${relPath} must remove default Viewer LEFT_CLICK and LEFT_DOUBLE_CLICK handlers`
      );
      assert.ok(
        src.includes('viewer.trackedEntity = undefined'),
        `${relPath} must clear viewer.trackedEntity`
      );
      assert.ok(
        src.includes('viewer.camera.cancelFlight?.()') && src.includes('Number.isFinite('),
        `${relPath} must cancel in-flight camera transitions and validate finite coordinates`
      );
    }
  });

  it('keeps dropCustomPin and selectFeaturePin idempotent and safe against removed entities in Moon and Earth features', () => {
    for (const relPath of ['src/cesium/moon/moonFeatures.js', 'src/cesium/earth/earthFeatures.js']) {
      const src = readRepoFile(relPath);
      assert.ok(
        src.includes('viewer.entities.contains('),
        `${relPath} must check viewer.entities.contains(...) before mutating selected/hovered entities`
      );
      assert.ok(
        src.includes('target === selectedEntity'),
        `${relPath} must short-circuit redundant selectFeaturePin teardown when clicking the active pin`
      );
      assert.ok(
        src.includes('Math.abs(existing.longitude -'),
        `${relPath} dropCustomPin must reuse an unchanged custom pin instead of destroying and recreating it`
      );
      assert.ok(
        src.includes('Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK'),
        `${relPath} must handle LEFT_DOUBLE_CLICK cleanly without stale drag state or entity tracking`
      );
    }
  });

  it('prevents Leaflet doubleClickZoom and concurrent animated panTo conflicts in SouthPoleTopoMap and validates custom pin coords in App', () => {
    const topoSrc = readRepoFile('src/components/map/SouthPoleTopoMap.jsx');
    assert.ok(topoSrc.includes('doubleClickZoom: false'), 'SouthPoleTopoMap must disable doubleClickZoom');
    assert.ok(
      topoSrc.includes('leafletMapRef.current.stop?.()') &&
        topoSrc.includes('panTo([hit.latitude, hit.longitude], { animate: false })'),
      'SouthPoleTopoMap must stop concurrent map animations and use non-animated panTo on landmark clicks'
    );

    const appSrc = readRepoFile('src/App.jsx');
    assert.ok(
      appSrc.includes('Number.isFinite(lon) && Number.isFinite(lat)'),
      'App handleFeatureSelect must validate finite coordinates before dropping a custom pin'
    );
  });

  it('remains deterministic across repeated hit-selection calls at the same screen coordinate', () => {
    const entries = [
      { item: { id: 'site-a', name: 'Site A' }, pt: { x: 200, y: 200 }, priority: 1 },
      { item: { id: 'site-b', name: 'Site B' }, pt: { x: 240, y: 240 }, priority: 1 },
    ];
    const entityA = { id: 'site-a' };
    const entityB = { id: 'site-b' };
    const candidates = [
      {
        entity: entityA,
        feature: { id: 'site-a', name: 'Site A' },
        centerPt: { x: 200, y: 200 },
        maxHitRadiusPx: 26,
        hitType: 'billboard',
      },
      {
        entity: entityB,
        feature: { id: 'site-b', name: 'Site B' },
        centerPt: { x: 240, y: 240 },
        maxHitRadiusPx: 26,
        hitType: 'billboard',
      },
    ];
    for (let i = 0; i < 10; i += 1) {
      const nearest = findNearestScreenMarker({ x: 202, y: 199 }, entries, 24);
      assert.equal(nearest?.id, 'site-a');
      const picked = selectBestPickedMarker({ x: 202, y: 199 }, candidates);
      assert.equal(picked, entityA);
    }
  });
});
