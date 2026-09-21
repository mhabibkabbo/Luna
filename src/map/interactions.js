/**
 * @file interactions.js
 * OpenLayers map interactions: Feature picking, throttled coordinate tracking,
 * and geodesic distance measurement on the Moon.
 */

import VectorLayer from 'ol/layer/Vector.js';
import VectorSource from 'ol/source/Vector.js';
import Feature from 'ol/Feature.js';
import Point from 'ol/geom/Point.js';
import LineString from 'ol/geom/LineString.js';
import { Style, Stroke, Circle as CircleStyle, Fill, Text } from 'ol/style.js';
import { calculateLunarPathDistance, calculateLunarBearing, formatLunarDistance } from '../utils/distance.js';

/**
 * Creates the vector layer for interactive distance measurements.
 * @returns {{ measureLayer: VectorLayer, measureSource: VectorSource }}
 */
export function createMeasurementLayer() {
  const measureSource = new VectorSource({ wrapX: false });

  const measureLayer = new VectorLayer({
    source: measureSource,
    style: function (feature) {
      const geomType = feature.getGeometry().getType();
      const label = feature.get('label');
      const isVertex = feature.get('isVertex');

      if (geomType === 'LineString') {
        return new Style({
          stroke: new Stroke({
            color: '#38bdf8',
            width: 3,
            lineDash: [6, 6],
          }),
        });
      }

      if (geomType === 'Point') {
        return new Style({
          image: new CircleStyle({
            radius: isVertex ? 5 : 6,
            fill: new Fill({ color: '#ffffff' }),
            stroke: new Stroke({ color: '#0284c7', width: 2.5 }),
          }),
          text: label
            ? new Text({
                text: label,
                font: 'bold 11px "Space Mono", monospace',
                offsetY: -14,
                fill: new Fill({ color: '#ffffff' }),
                stroke: new Stroke({ color: '#090d16', width: 3 }),
              })
            : undefined,
        });
      }
    },
    zIndex: 200,
  });

  return { measureLayer, measureSource };
}

/**
 * Sets up throttled pointer tracking to efficiently display selenographic coordinates.
 * Prevents React rerenders on every mouse frame.
 * 
 * @param {import('ol/Map.js').default} map 
 * @param {Function} onCoordinateChange - Callback with [lon, lat]
 * @param {number} [throttleMs=50]
 * @returns {Function} Unsubscribe cleanup function
 */
export function setupPointerTracking(map, onCoordinateChange, throttleMs = 50) {
  let lastCall = 0;

  const handlePointerMove = (evt) => {
    if (evt.dragging) return;
    const now = performance.now();
    if (now - lastCall < throttleMs) return;
    lastCall = now;

    const coords = evt.coordinate;
    if (coords && coords.length >= 2) {
      onCoordinateChange(coords[0], coords[1]);
    }
  };

  map.on('pointermove', handlePointerMove);

  return () => {
    map.un('pointermove', handlePointerMove);
  };
}

/**
 * Controller class for interactive geodesic distance measurement.
 */
export class LunarMeasurementController {
  /**
   * @param {import('ol/Map.js').default} map 
   * @param {VectorSource} source 
   * @param {Function} onUpdateCallback 
   */
  constructor(map, source, onUpdateCallback) {
    this.map = map;
    this.source = source;
    this.onUpdate = onUpdateCallback;
    this.points = [];
    this.isActive = false;
    this.lineFeature = null;
    this.previewFeature = null;

    this.handleClick = this.handleClick.bind(this);
    this.handleMouseMove = this.handleMouseMove.bind(this);
  }

  activate() {
    this.clear();
    this.isActive = true;
    this.map.on('singleclick', this.handleClick);
    this.map.on('pointermove', this.handleMouseMove);
    this.map.getTargetElement().style.cursor = 'crosshair';
  }

  deactivate() {
    this.isActive = false;
    this.map.un('singleclick', this.handleClick);
    this.map.un('pointermove', this.handleMouseMove);
    this.map.getTargetElement().style.cursor = '';
    if (this.previewFeature) {
      this.source.removeFeature(this.previewFeature);
      this.previewFeature = null;
    }
  }

  clear() {
    this.points = [];
    this.lineFeature = null;
    this.previewFeature = null;
    this.source.clear();
    if (this.onUpdate) {
      this.onUpdate({
        coordinates: [],
        totalDistanceKm: 0,
        segmentDistancesKm: [],
        initialBearingDeg: 0,
        isComplete: false,
      });
    }
  }

  handleClick(evt) {
    if (!this.isActive) return;
    const coord = evt.coordinate;
    this.points.push(coord);

    const pointIndex = this.points.length;
    const pointLabel = String.fromCharCode(64 + pointIndex); // A, B, C...

    const ptFeature = new Feature({
      geometry: new Point(coord),
      label: pointLabel,
      isVertex: true,
    });
    this.source.addFeature(ptFeature);

    this.updateGeometry();
  }

  handleMouseMove(evt) {
    if (!this.isActive || this.points.length === 0) return;
    const hoverCoord = evt.coordinate;
    const activeCoords = [...this.points, hoverCoord];

    if (!this.previewFeature) {
      this.previewFeature = new Feature({
        geometry: new LineString(activeCoords),
      });
      this.source.addFeature(this.previewFeature);
    } else {
      this.previewFeature.getGeometry().setCoordinates(activeCoords);
    }

    const { totalKm } = calculateLunarPathDistance(activeCoords);
    if (this.onUpdate) {
      this.onUpdate({
        coordinates: activeCoords,
        totalDistanceKm: totalKm,
        segmentDistancesKm: [],
        initialBearingDeg: calculateLunarBearing(this.points[0], hoverCoord),
        isComplete: false,
      });
    }
  }

  updateGeometry() {
    if (this.previewFeature) {
      this.source.removeFeature(this.previewFeature);
      this.previewFeature = null;
    }

    if (this.points.length >= 2) {
      if (!this.lineFeature) {
        this.lineFeature = new Feature({
          geometry: new LineString(this.points),
        });
        this.source.addFeature(this.lineFeature);
      } else {
        this.lineFeature.getGeometry().setCoordinates(this.points);
      }
    }

    const { totalKm, segmentsKm } = calculateLunarPathDistance(this.points);
    const initialBearing = this.points.length >= 2 ? calculateLunarBearing(this.points[0], this.points[1]) : 0;

    if (this.onUpdate) {
      this.onUpdate({
        coordinates: [...this.points],
        totalDistanceKm: totalKm,
        segmentDistancesKm: segmentsKm,
        initialBearingDeg: initialBearing,
        isComplete: this.points.length >= 2,
      });
    }
  }
}
