/**
 * @file projection.js
 * Lunar Selenographic Projection Configuration for OpenLayers.
 * 
 * ============================================================================
 * LUNAR GEODETIC REFERENCE FRAME SPECIFICATION
 * ============================================================================
 * 
 * 1. PROJECTION IDENTIFIER:
 *    - Primary Code: 'MOON:EQ'
 *    - OGC / NASA URN: 'urn:ogc:def:crs:EPSG::104903' (IAU 2000 Moon Equirectangular)
 *    - Equivalent Standard: EPSG:4326 (Plate Carrée / Equirectangular on sphere)
 * 
 * 2. UNITS:
 *    - Decimal degrees (°).
 *    - 1 degree of longitude at lunar equator = 2 * PI * 1737.4 km / 360 ≈ 30.323 km.
 * 
 * 3. SELENOGRAPHIC CONVENTIONS:
 *    - Longitude: East is positive [0° to +180°], West is negative [-180° to 0°].
 *      The Prime Meridian (0°) points directly along the mean sub-Earth direction
 *      at mean Earth-Moon distance and mean libration.
 *    - Latitude: North is positive [0° to +90°], South is negative [-90° to 0°].
 *      The North Pole (+90°) is defined by the rotational axis pointing into the
 *      northern celestial hemisphere.
 *    - Reference Datum Radius: Mean Lunar Radius = 1737.4 km.
 * 
 * 4. EXTENT & BOUNDS:
 *    - Geographic Extent: [-180.0, -90.0, 180.0, 90.0]
 *    - Width: 360 degrees
 *    - Height: 180 degrees
 * 
 * 5. NASA WMTS ALIGNMENT:
 *    - NASA Moon Trek WMTS services ('tiles/Moon/EQ/...') publish tiles in this exact
 *      equirectangular matrix (MatrixSet: 'default028mm').
 *    - At zoom level 0, MatrixWidth = 2 and MatrixHeight = 1, perfectly covering
 *      the 360° x 180° selenographic globe with two 256x256 px tiles.
 */

import Projection from 'ol/proj/Projection.js';
import { addProjection, addEquivalentProjections, get as getProjection } from 'ol/proj.js';

export const LUNAR_PROJ_CODE = 'MOON:EQ';
export const NASA_LUNAR_CRS_URN = 'urn:ogc:def:crs:EPSG::104903';

export const LUNAR_EXTENT = [-180.0, -90.0, 180.0, 90.0];
export const LUNAR_CENTER = [0.0, 0.0];

/**
 * Initializes and registers the lunar selenographic projection within OpenLayers.
 * @returns {Projection} The registered OpenLayers Projection object
 */
export function initializeLunarProjection() {
  let moonProj = getProjection(LUNAR_PROJ_CODE);

  if (!moonProj) {
    moonProj = new Projection({
      code: LUNAR_PROJ_CODE,
      units: 'degrees',
      extent: LUNAR_EXTENT,
      worldExtent: LUNAR_EXTENT,
      global: false,
      axisOrientation: 'enu', // East, North, Up
    });

    addProjection(moonProj);

    // Register NASA URN alias
    const nasaProj = new Projection({
      code: NASA_LUNAR_CRS_URN,
      units: 'degrees',
      extent: LUNAR_EXTENT,
      worldExtent: LUNAR_EXTENT,
      global: false,
      axisOrientation: 'enu',
    });
    addProjection(nasaProj);

    // Register equivalence with EPSG:4326 so OpenLayers vector transforms work seamlessly
    const epsg4326 = getProjection('EPSG:4326');
    if (epsg4326) {
      addEquivalentProjections([moonProj, nasaProj, epsg4326]);
    }
  }

  return moonProj;
}
