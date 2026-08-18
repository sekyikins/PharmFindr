/**
 * lib/pharmacyDiscovery.ts
 *
 * Central Pharmacy Discovery Coordinator & Prefetched Geographic Cache.
 *
 * Architecture:
 * - MAXIMUM COVERAGE: Concurrently queries Supabase Registered, Google Places, and OSM / Overpass.
 * - PREFETCHED GEOGRAPHIC DISCOVERY: When a region is queried, proactively discovers pharmacies
 *   for the visible region PLUS a substantially larger surrounding prefetch envelope.
 * - INSTANT RENDERING: Panning within the prefetched area renders cached pharmacies immediately
 *   with ZERO network requests.
 * - ISOLATED PROVIDER RESILIENCE: If one provider fails or returns 0 results, the remaining providers
 *   continue contributing uninterrupted.
 * - PROGRESSIVE ACCUMULATION: Discovered pharmacies persist across camera movements.
 */

import { type Coords } from './location';
import {
  haversineKm,
  isValidRegion,
  computeViewportBounds,
  computeViewportRadiusMeters,
} from './geoUtils';
import { getRegisteredPharmacies } from './supabasePharmacies';
import { fetchOsmPharmacies } from './osm';
import { searchGoogleViewportPharmacies } from './googlePlaces';
import { mergeDiscoveredPharmacies } from './pharmacyDeduplication';
import type { DiscoveredPharmacy, MapRegion } from '@/types/map';

/**
 * Discovery configuration constants.
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
 * Reset session discovery coverage (for full pull-to-refresh).
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

  // 1. If any provider has uncovered cells in the new visible viewport (or approaching its edge), discovery is required
  if (
    hasUncoveredVisibleCells(next, 'supabase') ||
    hasUncoveredVisibleCells(next, 'google') ||
    hasUncoveredVisibleCells(next, 'osm')
  ) {
    return true;
  }

  // 2. If zoom changed significantly (zoomed far out)
  const zoomRatio = next.latitudeDelta / (prev.latitudeDelta || 0.001);
  if (zoomRatio < 0.50 || zoomRatio > 2.00) {
    return true;
  }

  // 3. Panning within already prefetched and cached territory -> zero network requests needed
  return false;
}

/**
 * Central Pharmacy Discovery Coordinator:
 * - Computes enlarged prefetch bounds covering visible viewport + surrounding neighborhood.
 * - Only queries providers that have uncovered cells in this viewport/edge.
 * - Concurrently queries all eligible providers.
 * - Resiliently merges successful provider results into accumulated session cache.
 * - Marks prefetched cells as covered for successful providers.
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

  // 2. If all visible cells are already covered by all providers -> return cached pharmacies immediately
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
