import React, { useEffect, useRef, useState, useImperativeHandle, forwardRef } from 'react';
import { createLunarMap } from '../../map/createMap.js';
import { Loader2, AlertTriangle, RefreshCw } from 'lucide-react';

/**
 * LunarMap component hosting the OpenLayers 2D map viewport.
 * Encapsulates the OpenLayers lifecycle, keeping React renders separate from map renders.
 */
const LunarMap = forwardRef(function LunarMap(
  {
    onPointerCoordinates,
    onFeatureSelect,
    onMeasurementUpdate,
    onResolutionChange,
  },
  ref
) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);

  const [isLoadingTiles, setIsLoadingTiles] = useState(true);
  const [loadError, setLoadError] = useState(null);

  useEffect(() => {
    if (!mapContainerRef.current) return;

    let tilePendingCount = 0;

    // Initialize the OpenLayers Map
    const mapController = createLunarMap(mapContainerRef.current, {
      onPointerCoordinates,
      onFeatureSelect,
      onMeasurementUpdate,
      onTileLoading: () => {
        tilePendingCount++;
        setIsLoadingTiles(true);
      },
      onTileLoaded: () => {
        tilePendingCount = Math.max(0, tilePendingCount - 1);
        if (tilePendingCount === 0) {
          setIsLoadingTiles(false);
          setLoadError(null);
        }
      },
      onTileError: (e) => {
        tilePendingCount = Math.max(0, tilePendingCount - 1);
        if (tilePendingCount === 0) {
          setIsLoadingTiles(false);
        }
        // Graceful error logging
        console.warn('[LunarMap] Tile request warning:', e);
      },
    });

    mapInstanceRef.current = mapController;

    // Listen to resolution changes for the scale bar
    const view = mapController.view;
    const updateResolution = () => {
      if (onResolutionChange) {
        onResolutionChange(view.getResolution());
      }
    };
    view.on('change:resolution', updateResolution);
    updateResolution();

    // Initial load safety timeout so spinner clears even if initial tiles are fast cached
    const safetyTimer = setTimeout(() => {
      setIsLoadingTiles(false);
    }, 1500);

    return () => {
      clearTimeout(safetyTimer);
      view.un('change:resolution', updateResolution);
      mapController.destroy();
      mapInstanceRef.current = null;
    };
  }, []);

  // Expose map manipulation methods to parent via ref
  useImperativeHandle(ref, () => ({
    zoomIn: () => {
      if (mapInstanceRef.current) {
        const view = mapInstanceRef.current.view;
        view.animate({ zoom: view.getZoom() + 1, duration: 250 });
      }
    },
    zoomOut: () => {
      if (mapInstanceRef.current) {
        const view = mapInstanceRef.current.view;
        view.animate({ zoom: Math.max(2.5, view.getZoom() - 1), duration: 250 });
      }
    },
    resetOverview: () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.resetToMoonOverview();
      }
    },
    goToSouthPole: (zoom = 4.8) => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.flyToSouthPole(zoom);
      }
    },
    flyTo: (lon, lat, zoom = 4) => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.flyToCoordinate(lon, lat, zoom);
      }
    },
    selectFeature: (featureId, zoomIn = true) => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.selectFeatureById(featureId, zoomIn);
      }
    },
    setLayerVisibility: (layerId, isVisible, opacity) => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.setLayerVisibility(layerId, isVisible, opacity);
      }
    },
    setTerrainMode: (mode) => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.setTerrainMode(mode);
      }
    },
    activateMeasurement: () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.measurementController.activate();
      }
    },
    deactivateMeasurement: () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.measurementController.deactivate();
      }
    },
    clearMeasurement: () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.measurementController.clear();
      }
    },
    getMapInstance: () => mapInstanceRef.current?.map,
  }));

  const handleRetry = () => {
    setLoadError(null);
    setIsLoadingTiles(true);
    if (mapInstanceRef.current) {
      mapInstanceRef.current.map.render();
    }
  };

  return (
    <div className="relative w-full h-full overflow-hidden bg-[#050811]">
      {/* OpenLayers Viewport Target Element */}
      <div
        id="lunar-ol-map-viewport"
        ref={mapContainerRef}
        className="w-full h-full cursor-grab active:cursor-grabbing"
      />

      {/* Subtle Tile Loading Status Indicator */}
      {isLoadingTiles && (
        <div
          id="nasa-tile-loading-indicator"
          className="absolute top-20 right-4 z-10 flex items-center gap-2 bg-slate-900/80 backdrop-blur-md border border-slate-800 px-3 py-1.5 rounded-full text-xs text-slate-300 shadow-md animate-fade-in pointer-events-none"
        >
          <Loader2 className="w-3.5 h-3.5 text-cyan-400 animate-spin" />
          <span className="text-[11px] font-medium">Loading NASA tiles...</span>
        </div>
      )}

      {/* Error state banner if NASA service has connectivity problems */}
      {loadError && (
        <div
          id="nasa-service-error-alert"
          className="absolute top-20 left-1/2 -translate-x-1/2 z-20 flex items-center gap-3 bg-red-950/90 border border-red-800/80 px-4 py-2.5 rounded-xl shadow-2xl backdrop-blur-md text-red-200 text-xs"
        >
          <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
          <span>{loadError}</span>
          <button
            type="button"
            onClick={handleRetry}
            className="flex items-center gap-1 bg-red-800 hover:bg-red-700 text-white font-medium px-2.5 py-1 rounded-md transition-colors"
          >
            <RefreshCw className="w-3 h-3" />
            Retry
          </button>
        </div>
      )}
    </div>
  );
});

export default LunarMap;
