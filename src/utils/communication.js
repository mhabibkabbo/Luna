import {
  computeCelestialState,
  MOON_RADIUS_KM,
} from './lunarEphemeris.js';

const DEG = Math.PI / 180;
const KM_TO_METERS = 1000;
const EARTH_SEMI_MAJOR_KM = 6378.137;
const EARTH_ECCENTRICITY_SQUARED = 6.69437999014e-3;
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const subtract = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const scale = (vector, scalar) => vector.map((value) => value * scalar);
const normalize = (vector) => scale(vector, 1 / Math.hypot(...vector));

function multiplyMatrixVector(matrix, vector) {
  return matrix.map((row) => dot(row, vector));
}

function transposeMultiplyMatrixVector(matrix, vector) {
  return matrix[0].map((_, column) =>
    dot(matrix.map((row) => row[column]), vector)
  );
}

function earthFixedPositionKm(latitude, longitude, heightKm = 0) {
  const lat = latitude * DEG;
  const lon = longitude * DEG;
  const sinLat = Math.sin(lat);
  const cosLat = Math.cos(lat);
  const primeVerticalRadius =
    EARTH_SEMI_MAJOR_KM /
    Math.sqrt(1 - EARTH_ECCENTRICITY_SQUARED * sinLat * sinLat);
  const radialDistance = primeVerticalRadius + heightKm;
  const polarDistance =
    primeVerticalRadius * (1 - EARTH_ECCENTRICITY_SQUARED) + heightKm;

  return [
    radialDistance * cosLat * Math.cos(lon),
    radialDistance * cosLat * Math.sin(lon),
    polarDistance * sinLat,
  ];
}

export function lunarFixedPositionKm(latitude, longitude, elevationKm = 0) {
  const lat = latitude * DEG;
  const lon = longitude * DEG;
  const radius = MOON_RADIUS_KM + elevationKm;
  return [
    radius * Math.cos(lat) * Math.cos(lon),
    radius * Math.cos(lat) * Math.sin(lon),
    radius * Math.sin(lat),
  ];
}

function earthSurfaceNormal(latitude, longitude) {
  const lat = latitude * DEG;
  const lon = longitude * DEG;
  return [
    Math.cos(lat) * Math.cos(lon),
    Math.cos(lat) * Math.sin(lon),
    Math.sin(lat),
  ];
}

export function lunarLocalCoordinates(latitude, longitude, direction) {
  const lat = latitude * DEG;
  const lon = longitude * DEG;
  const east = [-Math.sin(lon), Math.cos(lon), 0];
  const north = [
    -Math.sin(lat) * Math.cos(lon),
    -Math.sin(lat) * Math.sin(lon),
    Math.cos(lat),
  ];
  const up = [
    Math.cos(lat) * Math.cos(lon),
    Math.cos(lat) * Math.sin(lon),
    Math.sin(lat),
  ];

  return {
    azimuthDeg:
      ((Math.atan2(dot(direction, east), dot(direction, north)) / DEG) + 360) %
      360,
    elevationDeg: Math.asin(Math.max(-1, Math.min(1, dot(direction, up)))) / DEG,
  };
}

function getFeatureCoordinates(feature, body) {
  const latitude = feature?.latitude ?? feature?.lat;
  const longitude = feature?.longitude ?? feature?.lon;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    throw new TypeError(`The selected ${body} location has invalid coordinates.`);
  }
  return { latitude, longitude };
}

/**
 * Computes geometric Earth-Moon visibility using endpoint elevation angles.
 * Terrain is intentionally excluded until terrain profiles are enabled in runtime calculations.
 */
export function computeCommunicationLink({
  moonFeature,
  earthFeature,
  when,
  state: suppliedState,
}) {
  const moonCoordinates = getFeatureCoordinates(moonFeature, 'Moon');
  const earthCoordinates = getFeatureCoordinates(earthFeature, 'Earth');
  const state = suppliedState ?? computeCelestialState(when);
  const earthCenterMoonFixedKm = scale(
    state.earth.dir,
    state.earth.distanceKm
  );
  const moonPositionMoonFixedKm = lunarFixedPositionKm(
    moonCoordinates.latitude,
    moonCoordinates.longitude,
    (moonFeature.elevationM ?? 0) / KM_TO_METERS
  );
  const earthPositionEarthFixedKm = earthFixedPositionKm(
    earthCoordinates.latitude,
    earthCoordinates.longitude,
    (earthFeature.height ?? 0) / KM_TO_METERS
  );
  const earthPositionMoonFixedKm = add(
    earthCenterMoonFixedKm,
    multiplyMatrixVector(state.earth.toMoonFixed, earthPositionEarthFixedKm)
  );

  const moonToEarthDirection = normalize(
    subtract(earthPositionMoonFixedKm, moonPositionMoonFixedKm)
  );
  const moonLook = lunarLocalCoordinates(
    moonCoordinates.latitude,
    moonCoordinates.longitude,
    moonToEarthDirection
  );
  const earthToMoonDirectionEarthFixed = normalize(
    transposeMultiplyMatrixVector(
      state.earth.toMoonFixed,
      subtract(moonPositionMoonFixedKm, earthCenterMoonFixedKm)
    )
  );
  const earthLookElevationDeg =
    Math.asin(
      Math.max(
        -1,
        Math.min(
          1,
          dot(
            earthToMoonDirectionEarthFixed,
            earthSurfaceNormal(
              earthCoordinates.latitude,
              earthCoordinates.longitude
            )
          )
        )
      )
    ) / DEG;

  const blocked =
    moonLook.elevationDeg <= 0 || earthLookElevationDeg <= 0;
  const status = blocked ? 'blocked' : 'clear';

  const toMeters = (positionKm) => positionKm.map((value) => value * KM_TO_METERS);
  const moonPositionMoonFixedMeters = toMeters(moonPositionMoonFixedKm);
  const earthPositionMoonFixedMeters = toMeters(earthPositionMoonFixedKm);
  const moonPositionEarthFixedMeters = toMeters(
    transposeMultiplyMatrixVector(
      state.earth.toMoonFixed,
      subtract(moonPositionMoonFixedKm, earthCenterMoonFixedKm)
    )
  );

  return {
    status,
    moonElevationDeg: moonLook.elevationDeg,
    moonAzimuthDeg: moonLook.azimuthDeg,
    earthElevationDeg: earthLookElevationDeg,
    moonPositionMoonFixedMeters,
    earthPositionMoonFixedMeters,
    earthPositionEarthFixedMeters: toMeters(earthPositionEarthFixedKm),
    moonPositionEarthFixedMeters,
  };
}

export function communicationStatus(options) {
  return computeCommunicationLink(options).status;
}

export async function sweepCommunication({
  moonFeature,
  earthFeature,
  startMs,
  days = 30,
  stepMin = 30,
  signal,
}) {
  const sampleCount = Math.round((days * 1440) / stepMin);
  const stepMs = stepMin * 60000;
  const visibility = new Array(sampleCount);

  for (let index = 0; index < sampleCount; index++) {
    if (signal?.aborted) return null;
    const when = startMs + (index + 0.5) * stepMs;
    visibility[index] = communicationStatus({
      moonFeature,
      earthFeature,
      when,
    });
    if (index % 30 === 29) await new Promise((resolve) => setTimeout(resolve, 0));
  }

  return {
    startMs,
    endMs: startMs + days * 86400000,
    stepMin,
    visibility,
  };
}
