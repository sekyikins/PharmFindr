/**
 * lib/geoUtils.ts
 *
 * Core geographic calculations, coordinate validation, distance formulas,
 * and bounding box computations for map viewport discovery.
 */

import type { Coords } from './location';
import type { MapBounds, MapRegion } from '@/types/map';

/**
 * Validate finite geographic coordinates.
 */
export function isValidCoordinate(lat: unknown, lon: unknown): lat is number {
  return (
    typeof lat === 'number' &&
    typeof lon === 'number' &&
    Number.isFinite(lat) &&
    Number.isFinite(lon) &&
    lat >= -90 &&
    lat <= 90 &&
    lon >= -180 &&
    lon <= 180
  );
}

/**
 * Validate a non-empty, finite map region.
 */
export function isValidRegion(region: unknown): region is MapRegion {
  if (!region || typeof region !== 'object') return false;
  const r = region as MapRegion;
  return (
    typeof r.latitude === 'number' &&
    Number.isFinite(r.latitude) &&
    typeof r.longitude === 'number' &&
    Number.isFinite(r.longitude) &&
    typeof r.latitudeDelta === 'number' &&
    Number.isFinite(r.latitudeDelta) &&
    r.latitudeDelta > 0 &&
    typeof r.longitudeDelta === 'number' &&
    Number.isFinite(r.longitudeDelta) &&
    r.longitudeDelta > 0
  );
}

/**
 * Calculate straight-line distance between two coordinates (Haversine formula), in km.
 */
export function haversineKm(a: Coords, b: Coords): number {
  const R = 6371;
  const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
  const dLon = ((b.longitude - a.longitude) * Math.PI) / 180;
  const lat1 = (a.latitude * Math.PI) / 180;
  const lat2 = (b.latitude * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(x));
}

/**
 * Compute viewport bounding box with an optional prefetch expansion buffer factor.
 */
export function computeViewportBounds(
  region: MapRegion,
  bufferFactor = 2.0
): MapBounds {
  const latDelta = Math.abs(region.latitudeDelta) * (1 + bufferFactor);
  const lonDelta = Math.abs(region.longitudeDelta) * (1 + bufferFactor);

  return {
    north: Math.min(90, region.latitude + latDelta / 2),
    south: Math.max(-90, region.latitude - latDelta / 2),
    east: Math.min(180, region.longitude + lonDelta / 2),
    west: Math.max(-180, region.longitude - lonDelta / 2),
  };
}

/**
 * Compute search radius in meters from viewport bounding box.
 */
export function computeViewportRadiusMeters(
  region: MapRegion,
  bufferFactor = 2.0,
  minRadiusMeters = 4000,
  maxRadiusMeters = 50000
): number {
  const latSpanKm = Math.abs(region.latitudeDelta) * (1 + bufferFactor) * 111;
  const clampedLat = Math.min(85, Math.max(-85, region.latitude));
  const lonSpanKm = Math.abs(region.longitudeDelta) * (1 + bufferFactor) * 111 * Math.cos((clampedLat * Math.PI) / 180);
  const calculatedRadiusMeters = Math.round((Math.sqrt(latSpanKm ** 2 + lonSpanKm ** 2) / 2) * 1000);

  return Math.max(minRadiusMeters, Math.min(maxRadiusMeters, calculatedRadiusMeters));
}
