/**
 * lib/pharmacyDiscovery.ts
 *
 * Central Pharmacy Discovery Coordinator & Prefetched Geographic Cache.
 *
 * Architecture:
 * - PREFETCHED GEOGRAPHIC DISCOVERY: When a region is queried, proactively discovers pharmacies
 *   for the visible region PLUS a substantially larger surrounding prefetch area.
 * - INSTANT RENDERING: Panning within the prefetched area renders cached pharmacies immediately
 *   with ZERO network requests.
 * - EDGE DETECTION: Queries are only fired when the visible map approaches or enters uncovered geographic cells.
 * - MAXIMUM COVERAGE: Concurrently queries Supabase Registered + Google Places + OSM / Overpass.
 * - PROGRESSIVE ACCUMULATION: Discovered pharmacies persist in memory across map movements.
 */

import { type Coords } from './location';
import {
  getRegisteredPharmacies,
  fetchOsmPharmacies,
  isDuplicatePharmacy,
  mergeDiscoveredPharmacies,
  haversineKm,
  isValidRegion,
} from './osm';
import { searchGoogleViewportPharmacies } from './googlePlaces';
import type { DiscoveredPharmacy, MapBounds, MapRegion, OsmPharmacy } from '@/types/map';

/**
 * Central discovery and prefetch configuration constants.
 */
export const DISCOVERY_CONFIG = {
  PREFETCH_BUFFER_FACTOR: 2.0,
  MIN_PREFETCH_RADIUS_METERS: 4000,
  MAX_PREFETCH_RADIUS_METERS: 50000,
  GRID_CELL_SIZE: 0.02,
  DISCOVERY_EDGE_THRESHOLD: 0.15,
};

export interface ProviderCoverageMap {
  supabase: Set<string>;
  google: Set<string>;
  osm: Set<string>;
}
export const sessionCoverage: ProviderCoverageMap = {
  supabase: new Set<string>(),
  google: new Set<string>(),
  osm: new Set<string>(),
};
export function computeViewportBounds(
  region: MapRegion,
  bufferFactor = DISCOVERY_CONFIG.PREFETCH_BUFFER_FACTOR
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
  bufferFactor = DISCOVERY_CONFIG.PREFETCH_BUFFER_FACTOR
): number {
  const latSpanKm = Math.abs(region.latitudeDelta) * (1 + bufferFactor) * 111;
  const clampedLat = Math.min(85, Math.max(-85, region.latitude));
  const lonSpanKm = Math.abs(region.longitudeDelta) * (1 + bufferFactor) * 111 * Math.cos((clampedLat * Math.PI) / 180);
  const calculatedRadiusMeters = Math.round((Math.sqrt(latSpanKm ** 2 + lonSpanKm ** 2) / 2) * 1000);

  return Math.max(
    DISCOVERY_CONFIG.MIN_PREFETCH_RADIUS_METERS,
    Math.min(DISCOVERY_CONFIG.MAX_PREFETCH_RADIUS_METERS, calculatedRadiusMeters)
  );
}

/**
 * Get grid cell keys covering the given viewport / prefetch bounds.
 */
export function getRegionGridCellKeys(
  region: MapRegion,
  bufferFactor = DISCOVERY_CONFIG.PREFETCH_BUFFER_FACTOR
): string[] {
  const bounds = computeViewportBounds(region, bufferFactor);
  const minLatRow = Math.floor(bounds.south / DISCOVERY_CONFIG.GRID_CELL_SIZE);
  const maxLatRow = Math.floor(bounds.north / DISCOVERY_CONFIG.GRID_CELL_SIZE);
  const minLonCol = Math.floor(bounds.west / DISCOVERY_CONFIG.GRID_CELL_SIZE);
  const maxLonCol = Math.floor(bounds.east / DISCOVERY_CONFIG.GRID_CELL_SIZE);

  const keys: string[] = [];
  const clampedMaxLat = Math.min(maxLatRow, minLatRow + 25);
  const clampedMaxLon = Math.min(maxLonCol, minLonCol + 25);

  for (let r = minLatRow; r <= clampedMaxLat; r++) {
    for (let c = minLonCol; c <= clampedMaxLon; c++) {
      keys.push(`${r}:${c}`);
    }
  }
  return keys;
}

/**
 * Returns the subset of cell keys that have not yet been successfully discovered by the specified provider.
 */
export function getUncoveredCells(
  cellKeys: string[],
  provider: 'supabase' | 'google' | 'osm'
): string[] {
  const coveredSet = sessionCoverage[provider];
  return cellKeys.filter((k) => !coveredSet.has(k));
}

/**
 * Checks whether the visible area (with edge threshold) has any uncovered cells for a provider.
 */
export function hasUncoveredVisibleCells(
  region: MapRegion,
  provider: 'supabase' | 'google' | 'osm'
): boolean {
  const visibleKeys = getRegionGridCellKeys(region, DISCOVERY_CONFIG.DISCOVERY_EDGE_THRESHOLD);
  const uncovered = getUncoveredCells(visibleKeys, provider);
  return uncovered.length > 0;
}

/**
 * Marks cells as successfully discovered for a provider.
 */
export function markCellsCovered(
  cellKeys: string[],
  provider: 'supabase' | 'google' | 'osm'
): void {
  const coveredSet = sessionCoverage[provider];
  for (const k of cellKeys) {
    coveredSet.add(k);
  }
}

/**
 * Reset session discovery coverage (useful for explicit refresh).
 */
export function clearDiscoveryCoverage(): void {
  sessionCoverage.supabase.clear();
  sessionCoverage.google.clear();
  sessionCoverage.osm.clear();
}

/**
 * Checks whether a camera movement is meaningful enough or approaches uncovered territory.
 * If the new visible viewport is already fully covered by the prefetch cache, returns false
 * so cached pharmacies render immediately with zero network requests.
 */
export function hasMeaningfulRegionChange(prev: MapRegion | null, next: MapRegion): boolean {
  if (!prev) return true;

  // 1. If any provider has uncovered cells in the new visible viewport (or approaching its edge), discovery is required!
  if (
    hasUncoveredVisibleCells(next, 'supabase') ||
    hasUncoveredVisibleCells(next, 'google') ||
    hasUncoveredVisibleCells(next, 'osm')
  ) {
    return true;
  }

  // 2. All visible cells are already covered in the prefetch cache.
  // Only trigger discovery if the user zooms far out to a much broader scale.
  const zoomRatio = next.latitudeDelta / (prev.latitudeDelta || 0.001);
  if (zoomRatio < 0.50 || zoomRatio > 2.00) {
    return true;
  }

  // 3. Panning within the already prefetched and cached territory -> NO NETWORK REQUEST NEEDED!
  return false;
}

/**
 * Coordinates prefetched viewport discovery across all data providers:
 * - Computes enlarged prefetch bounds covering visible viewport + surrounding neighborhood.
 * - Only queries providers that have uncovered cells in this viewport/edge.
 * - Merges results into accumulated session cache.
 * - Marks all prefetched cells as covered for successful providers.
 */
export async function discoverPharmaciesInViewport(params: {
  region: MapRegion;
  userCoords?: Coords | null;
  existingPharmacies?: DiscoveredPharmacy[];
  signal?: AbortSignal;
  force?: boolean;
}): Promise<DiscoveredPharmacy[]> {
  const { region, userCoords, existingPharmacies = [], signal, force = false } = params;
  if (!isValidRegion(region) || signal?.aborted) return existingPharmacies;

  // 1. Compute enlarged prefetch bounding box and grid cells
  const prefetchBounds = computeViewportBounds(region, DISCOVERY_CONFIG.PREFETCH_BUFFER_FACTOR);
  const prefetchCellKeys = getRegionGridCellKeys(region, DISCOVERY_CONFIG.PREFETCH_BUFFER_FACTOR);
  const visibleCellKeys = getRegionGridCellKeys(region, DISCOVERY_CONFIG.DISCOVERY_EDGE_THRESHOLD);

  const shouldQuerySupabase = force || getUncoveredCells(visibleCellKeys, 'supabase').length > 0;
  const shouldQueryGoogle = force || getUncoveredCells(visibleCellKeys, 'google').length > 0;
  const shouldQueryOsm = force || getUncoveredCells(visibleCellKeys, 'osm').length > 0;

  // 2. If all visible cells are already covered by all providers -> return cached pharmacies immediately!
  if (!shouldQuerySupabase && !shouldQueryGoogle && !shouldQueryOsm) {
    return existingPharmacies;
  }

  const newlyDiscovered: DiscoveredPharmacy[] = [];

  // 3. Concurrently query providers for the enlarged prefetch area
  const [registeredResult, googleResult, osmResult] = await Promise.allSettled([
    shouldQuerySupabase
      ? getRegisteredPharmacies(prefetchBounds, userCoords, signal)
      : Promise.resolve([]),
    shouldQueryGoogle
      ? searchGoogleViewportPharmacies(region, userCoords, signal)
      : Promise.resolve({ status: 'ok' as const, pharmacies: [] }),
    shouldQueryOsm
      ? fetchOsmPharmacies(region, userCoords, signal)
      : Promise.resolve([]),
  ]);

  if (signal?.aborted) return existingPharmacies;

  // 4. Supabase Registered Partner Pharmacies
  if (registeredResult.status === 'fulfilled') {
    if (Array.isArray(registeredResult.value)) {
      for (const reg of registeredResult.value) {
        newlyDiscovered.push(reg);
      }
      markCellsCovered(prefetchCellKeys, 'supabase');
    }
  }

  // 5. Google Places Pharmacies
  if (googleResult.status === 'fulfilled') {
    const gVal = googleResult.value;
    if (gVal.status === 'ok') {
      for (const gPharm of gVal.pharmacies) {
        newlyDiscovered.push(gPharm);
      }
      markCellsCovered(prefetchCellKeys, 'google');
    } else if (gVal.status === 'failed') {
      console.warn('Google Places discovery notice:', gVal.error);
    }
  }

  // 6. OSM / Overpass Pharmacies
  if (osmResult.status === 'fulfilled') {
    if (Array.isArray(osmResult.value)) {
      for (const osmPharm of osmResult.value) {
        newlyDiscovered.push(osmPharm);
      }
      markCellsCovered(prefetchCellKeys, 'osm');
    }
  }

  if (signal?.aborted) return existingPharmacies;

  // 7. Progressively merge newly discovered pharmacies into accumulated cache
  const accumulatedCollection = mergeDiscoveredPharmacies(existingPharmacies, newlyDiscovered);

  // 8. Recalculate dynamic distances relative to user GPS if provided
  if (userCoords) {
    for (const p of accumulatedCollection) {
      const dist = haversineKm(userCoords, { latitude: p.latitude, longitude: p.longitude });
      p.distanceKm = Math.round(dist * 1000) / 1000;
      p.walkMinutes = Math.max(1, Math.round((dist / 5) * 60));
    }
    accumulatedCollection.sort((a, b) => (a.distanceKm ?? 9999) - (b.distanceKm ?? 9999));
  } else {
    accumulatedCollection.sort((a, b) => {
      if (a.source !== b.source) {
        if (a.source === 'supabase') return -1;
        if (b.source === 'supabase') return 1;
      }
      if (a.isVerified !== b.isVerified) return a.isVerified ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
  }

  return accumulatedCollection;
}

/**
 * Backward compatibility delegation for legacy searchNearbyPharmacies callers.
 */
export async function searchNearbyPharmacies(
  userCoords?: Coords | null,
  radiusMeters = 8000,
  onItemFound?: (pharmacy: OsmPharmacy) => void,
  signal?: AbortSignal
): Promise<OsmPharmacy[]> {
  const coords = userCoords || { latitude: 0, longitude: 0 };
  const latDelta = (radiusMeters / 1000 / 111) * 2;
  const lonDelta = (radiusMeters / 1000 / (111 * Math.cos((coords.latitude * Math.PI) / 180 || 1))) * 2;

  const region: MapRegion = {
    latitude: coords.latitude,
    longitude: coords.longitude,
    latitudeDelta: Math.max(0.01, latDelta),
    longitudeDelta: Math.max(0.01, lonDelta),
  };

  const results = await discoverPharmaciesInViewport({ region, userCoords, signal });

  if (onItemFound) {
    for (const item of results) {
      onItemFound(item);
    }
  }

  return results;
}
