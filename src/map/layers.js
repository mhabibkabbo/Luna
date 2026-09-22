/**
 * @file layers.js
 * OpenLayers Vector Layer management for lunar features, landing sites, and crater rims.
 * Uses high-performance canvas vector rendering with distinctive cartographic styling for
 * craters, mountains (Montes), maria, valleys/rilles, and landing sites.
 */

import VectorLayer from 'ol/layer/Vector.js';
import VectorSource from 'ol/source/Vector.js';
import Feature from 'ol/Feature.js';
import Point from 'ol/geom/Point.js';
import Polygon from 'ol/geom/Polygon.js';
import { Style, Circle as CircleStyle, RegularShape, Fill, Stroke, Text } from 'ol/style.js';
import { LUNAR_FEATURES } from '../data/lunarFeatures.js';
import { LANDING_SITES } from '../data/landingSites.js';

/**
 * Creates OpenLayers Feature objects from lunar feature records.
 * @param {Array<import('../types/lunar.js').LunarFeature>} featureList 
 * @returns {Array<Feature>}
 */
export function createFeatureGeometries(featureList) {
  return featureList.map((item) => {
    const feature = new Feature({
      geometry: new Point([item.longitude, item.latitude]),
      ...item,
    });
    feature.setId(item.id);
    return feature;
  });
}

/**
 * Creates circular polygon rim geometries on the lunar sphere for major impact craters.
 * Moon mean radius: ~1,737.4 km -> ~30.32 km per degree at the equator.
 * @param {Array<import('../types/lunar.js').LunarFeature>} featureList 
 * @returns {Array<Feature>}
 */
export function createCraterRimGeometries(featureList) {
  return featureList
    .filter((f) => f.type === 'crater' && f.diameterKm && f.diameterKm >= 40)
    .map((c) => {
      const radiusKm = c.diameterKm / 2;
      const degLat = radiusKm / 30.32;
      const cosLat = Math.cos((c.latitude * Math.PI) / 180);
      const degLon = radiusKm / (30.32 * Math.max(0.12, Math.abs(cosLat)));

      const numPoints = 40;
      const ring = [];
      for (let i = 0; i <= numPoints; i++) {
        const theta = (i * 2 * Math.PI) / numPoints;
        const lon = c.longitude + degLon * Math.cos(theta);
        const lat = c.latitude + degLat * Math.sin(theta);
        ring.push([lon, lat]);
      }

      const poly = new Polygon([ring]);
      const rimFeature = new Feature({
        geometry: poly,
        craterId: c.id,
        name: c.name,
        diameterKm: c.diameterKm,
        isRim: true,
      });
      rimFeature.setId(`rim-${c.id}`);
      return rimFeature;
    });
}

/**
 * Zoom-adaptive vector style function for impact craters.
 * Features an authentic planetary impact ring glyph and clean typography.
 */
export function craterStyleFunction(feature, resolution) {
  const isSelected = feature.get('isSelected');
  const name = feature.get('name');
  const diameterKm = feature.get('diameterKm') || 0;

  // Zoom levels: Level 0 ~ 0.70, Level 1 ~ 0.35, Zoom 2.5 ~ 0.25, Level 2 ~ 0.17, Level 3 ~ 0.08
  const isMajorCrater = diameterKm >= 60 || ['Tycho', 'Copernicus', 'Plato', 'Clavius', 'Aristarchus', 'Kepler', 'Langrenus', 'Shackleton', 'Archimedes', 'Ptolemaeus', 'Theophilus', 'Gassendi'].includes(name);
  const showLabel = isSelected || (resolution <= 0.45 && isMajorCrater) || (resolution <= 0.25 && diameterKm >= 30) || resolution <= 0.12;

  const radius = isSelected ? 9 : (resolution < 0.1 ? 7 : 5.5);
  const ringColor = isSelected ? '#38bdf8' : '#7dd3fc';
  const fillColor = isSelected ? '#0284c7' : 'rgba(15, 23, 42, 0.85)';

  return new Style({
    image: new CircleStyle({
      radius: radius,
      fill: new Fill({ color: fillColor }),
      stroke: new Stroke({
        color: ringColor,
        width: isSelected ? 3 : 1.8,
      }),
    }),
    text: showLabel
      ? new Text({
          text: diameterKm ? `${name} (${Math.round(diameterKm)} km)` : name,
          font: isSelected ? 'bold 13px "Plus Jakarta Sans", sans-serif' : '600 12px "Plus Jakarta Sans", sans-serif',
          offsetY: -15,
          fill: new Fill({ color: isSelected ? '#38bdf8' : '#f8fafc' }),
          stroke: new Stroke({ color: '#050811', width: 4 }),
          backgroundFill: new Fill({ color: 'rgba(5, 8, 17, 0.85)' }),
          padding: [2, 5, 2, 5],
        })
      : undefined,
    zIndex: isSelected ? 120 : (isMajorCrater ? 50 : 20),
  });
}

/**
 * Style function for crater rim boundary rings.
 */
export function craterRimStyleFunction(feature) {
  const isSelected = feature.get('isSelected');
  return new Style({
    stroke: new Stroke({
      color: isSelected ? '#38bdf8' : 'rgba(56, 189, 248, 0.45)',
      width: isSelected ? 2.5 : 1.2,
      lineDash: isSelected ? undefined : [4, 4],
    }),
    fill: new Fill({
      color: isSelected ? 'rgba(56, 189, 248, 0.12)' : 'rgba(2, 132, 199, 0.03)',
    }),
    zIndex: isSelected ? 15 : 5,
  });
}

/**
 * Zoom-adaptive vector style function for lunar mountains (Montes) and solitary peaks.
 * Uses a prominent upward triangle peak glyph (▲) in warm golden amber.
 */
export function mountainStyleFunction(feature, resolution) {
  const isSelected = feature.get('isSelected');
  const name = feature.get('name');
  const elevationM = feature.get('elevationM') || 0;

  // Prominent mountain ranges visible at overview zooms
  const isMajorRange = [
    'Montes Apenninus',
    'Montes Caucasus',
    'Montes Alpes',
    'Montes Carpatus',
    'Montes Jura',
    'Montes Taurus',
    'Montes Haemus',
    'Montes Pyrenaeus',
    'Montes Rook',
    'Montes Cordillera',
    'Mons Huygens',
    'Mons Pico',
    'Mons Piton',
    'Mons Hadley',
    'Mons Bradley',
    'Mons Blanc',
  ].includes(name);
  const showLabel = isSelected || (resolution <= 0.38 && isMajorRange) || resolution <= 0.20;

  const peakSize = isSelected ? 8 : (resolution < 0.1 ? 6.5 : 5);

  return new Style({
    image: new RegularShape({
      points: 3,
      radius: peakSize,
      rotation: 0,
      fill: new Fill({ color: isSelected ? '#fbbf24' : '#f59e0b' }),
      stroke: new Stroke({
        color: isSelected ? '#ffffff' : '#451a03',
        width: isSelected ? 2.0 : 1.2,
      }),
    }),
    text: showLabel
      ? new Text({
          text: elevationM ? `${name} (${elevationM.toLocaleString()}m)` : name,
          font: isSelected ? 'bold 12px "Plus Jakarta Sans", sans-serif' : '600 11px "Plus Jakarta Sans", sans-serif',
          offsetY: -14,
          fill: new Fill({ color: isSelected ? '#fde68a' : '#fef3c7' }),
          stroke: new Stroke({ color: '#1c1917', width: 3.5 }),
          backgroundFill: new Fill({ color: 'rgba(28, 25, 23, 0.85)' }),
          padding: [2, 4, 2, 4],
        })
      : undefined,
    zIndex: isSelected ? 130 : 60,
  });
}

/**
 * Zoom-adaptive vector style function for lunar maria (basaltic plains).
 * Displays prominent, beautiful typography across the Moon's vast basalt plains.
 */
export function mareStyleFunction(feature, resolution) {
  const isSelected = feature.get('isSelected');
  const name = feature.get('name');

  const showLabel = isSelected || resolution <= 0.32;

  return new Style({
    image: new CircleStyle({
      radius: isSelected ? 6.5 : 4,
      fill: new Fill({ color: isSelected ? '#60a5fa' : 'rgba(30, 41, 59, 0.85)' }),
      stroke: new Stroke({
        color: isSelected ? '#ffffff' : '#93c5fd',
        width: isSelected ? 2.0 : 1.0,
      }),
    }),
    text: showLabel
      ? new Text({
          text: name.toUpperCase(),
          font: isSelected ? 'bold 12px "Space Mono", monospace' : 'bold 11px "Space Mono", monospace',
          offsetY: -13,
          fill: new Fill({ color: isSelected ? '#67e8f9' : '#93c5fd' }),
          stroke: new Stroke({ color: '#030712', width: 4 }),
          backgroundFill: new Fill({ color: 'rgba(3, 7, 18, 0.85)' }),
          padding: [2, 5, 2, 5],
        })
      : undefined,
    zIndex: isSelected ? 110 : 30,
  });
}

/**
 * Zoom-adaptive vector style function for valleys, sinuous rilles, faults, and bays.
 */
export function valleyStyleFunction(feature, resolution) {
  const isSelected = feature.get('isSelected');
  const name = feature.get('name');
  const lengthKm = feature.get('lengthKm');

  const showLabel = isSelected || resolution <= 0.28;

  return new Style({
    image: new RegularShape({
      points: 4,
      radius: isSelected ? 6.5 : 4.5,
      rotation: Math.PI / 4, // Diamond
      fill: new Fill({ color: isSelected ? '#c084fc' : '#a855f7' }),
      stroke: new Stroke({
        color: isSelected ? '#ffffff' : '#581c87',
        width: isSelected ? 2.0 : 1.0,
      }),
    }),
    text: showLabel
      ? new Text({
          text: lengthKm ? `${name} (${lengthKm} km)` : name,
          font: isSelected ? 'bold 12px "Plus Jakarta Sans", sans-serif' : '600 11px "Plus Jakarta Sans", sans-serif',
          offsetY: -14,
          fill: new Fill({ color: isSelected ? '#e9d5ff' : '#d8b4fe' }),
          stroke: new Stroke({ color: '#090d16', width: 3.5 }),
          backgroundFill: new Fill({ color: 'rgba(9, 13, 22, 0.85)' }),
          padding: [2, 4, 2, 4],
        })
      : undefined,
    zIndex: isSelected ? 120 : 40,
  });
}

/**
 * Zoom-adaptive vector style function for mission landing sites.
 */
export function landingSiteStyleFunction(feature, resolution) {
  const isSelected = feature.get('isSelected');
  const isApollo = feature.get('id')?.startsWith('landing-apollo');
  const name = feature.get('name');

  const showLabel = isSelected || resolution <= 0.45;
  const fillColor = isApollo ? '#f59e0b' : '#06b6d4';
  const strokeColor = isSelected ? '#ffffff' : (isApollo ? '#78350f' : '#083344');

  return new Style({
    image: new CircleStyle({
      radius: isSelected ? 9 : (isApollo ? 7.5 : 6.5),
      fill: new Fill({ color: isSelected ? '#38bdf8' : fillColor }),
      stroke: new Stroke({
        color: strokeColor,
        width: isSelected ? 3 : 2,
      }),
    }),
    text: showLabel
      ? new Text({
          text: name.split('(')[0].trim(),
          font: isSelected ? 'bold 13px "Space Mono", monospace' : 'bold 11.5px "Space Mono", monospace',
          offsetY: -15,
          fill: new Fill({ color: isApollo ? '#fde68a' : '#a5f3fc' }),
          stroke: new Stroke({ color: '#090d16', width: 4 }),
          backgroundFill: new Fill({ color: 'rgba(9, 13, 22, 0.9)' }),
          padding: [2, 5, 2, 5],
        })
      : undefined,
    zIndex: isSelected ? 150 : (isApollo ? 80 : 70),
  });
}

/**
 * Creates distinct vector layers for lunar natural features: mountains, maria, and valleys/rilles.
 * Craters and mission landing sites are omitted per user specification.
 * @returns {Object} Layer bundle with individual vector layers and sources.
 */
export function createLunarVectorLayers() {
  const craters = LUNAR_FEATURES.filter((f) => f.type === 'crater');
  const mountains = LUNAR_FEATURES.filter((f) => f.type === 'mountain');
  const maria = LUNAR_FEATURES.filter((f) => f.type === 'mare');
  const valleys = LUNAR_FEATURES.filter((f) => f.type === 'valley' || f.type === 'rille');
  const landingSites = LANDING_SITES;

  // Vector Sources (wrapX: false prevents feature duplication across repeating world extents)
  const cratersSource = new VectorSource({ features: createFeatureGeometries(craters), wrapX: false });
  const mountainsSource = new VectorSource({ features: createFeatureGeometries(mountains), wrapX: false });
  const mariaSource = new VectorSource({ features: createFeatureGeometries(maria), wrapX: false });
  const valleysSource = new VectorSource({ features: createFeatureGeometries(valleys), wrapX: false });
  const landingSitesSource = new VectorSource({ features: createFeatureGeometries(landingSites), wrapX: false });

  // Vector Layers
  const cratersLayer = new VectorLayer({
    source: cratersSource,
    style: craterStyleFunction,
    properties: { id: 'lunar-craters', category: 'FEATURES', layerType: 'vector' },
    zIndex: 25,
  });

  const mountainsLayer = new VectorLayer({
    source: mountainsSource,
    style: mountainStyleFunction,
    properties: { id: 'lunar-mountains', category: 'FEATURES', layerType: 'vector' },
    zIndex: 26,
  });

  const mariaLayer = new VectorLayer({
    source: mariaSource,
    style: mareStyleFunction,
    properties: { id: 'lunar-maria', category: 'FEATURES', layerType: 'vector' },
    zIndex: 20,
  });

  const valleysLayer = new VectorLayer({
    source: valleysSource,
    style: valleyStyleFunction,
    properties: { id: 'lunar-valleys', category: 'FEATURES', layerType: 'vector' },
    zIndex: 24,
  });

  const landingSitesLayer = new VectorLayer({
    source: landingSitesSource,
    style: landingSiteStyleFunction,
    properties: { id: 'lunar-landing-sites', category: 'FEATURES', layerType: 'vector' },
    zIndex: 28,
  });

  return {
    cratersLayer,
    mountainsLayer,
    mariaLayer,
    valleysLayer,
    landingSitesLayer,
    vectorLayers: [
      cratersLayer,
      mountainsLayer,
      mariaLayer,
      valleysLayer,
      landingSitesLayer,
    ],
    vectorSources: {
      cratersSource,
      mountainsSource,
      mariaSource,
      valleysSource,
      landingSitesSource,
    },
  };
}
