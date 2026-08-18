/**
 * store/pharmacyStore.ts
 *
 * Central Zustand store for viewport-driven progressive pharmacy discovery.
 * Maintains an accumulated collection of discovered pharmacies across map movements
 * alongside decoupled user-controlled filter settings.
 */

import { create } from 'zustand';
import { getCurrentLocation, type Coords } from '@/lib/location';
import { haversineKm } from '@/lib/geoUtils';
import { mergeDiscoveredPharmacies } from '@/lib/pharmacyDeduplication';
import { discoverPharmaciesInViewport, clearDiscoveryCoverage } from '@/lib/pharmacyDiscovery';
import type { DiscoveredPharmacy, MapRegion } from '@/types/map';

let activeAbortController: AbortController | null = null;
let requestCounter = 0;

interface PharmacyState {
  // Accumulated discovered pharmacies across session
  pharmacies: DiscoveredPharmacy[];
  userCoords: Coords | null;
  currentRegion: MapRegion | null;
  selectedPharmacyId: string | null;
  loading: boolean;
  error: string | null;

  // Decoupled user filters
  maxDistanceKm: number | null; // null = no distance restriction
  onlyOpen: boolean;
  onlyVerified: boolean;
  searchQuery: string;

  // Viewport Discovery Actions
  discoverInRegion: (region: MapRegion, options?: { force?: boolean }) => Promise<void>;
  addDiscoveredPharmacies: (newPharmacies: DiscoveredPharmacy[]) => void;
  loadNearby: (userCoordsInput?: Coords | null) => Promise<void>;
  stopDiscovery: () => void;
  clearDiscoveredPharmacies: () => void;

  // State setters
  setPharmacies: (pharmacies: DiscoveredPharmacy[]) => void;
  setUserCoords: (coords: Coords | null) => void;
  setCurrentRegion: (region: MapRegion | null) => void;
  setSelectedPharmacyId: (id: string | null) => void;

  // Filter setters (pure local state, does NOT trigger API refetch)
  setMaxDistanceKm: (distance: number | null) => void;
  setOnlyOpen: (value: boolean) => void;
  setOnlyVerified: (value: boolean) => void;
  setSearchQuery: (query: string) => void;

  // Filtered selector
  getFilteredPharmacies: () => DiscoveredPharmacy[];
}

export const usePharmacyStore = create<PharmacyState>((set, get) => ({
  pharmacies: [],
  userCoords: null,
  currentRegion: null,
  selectedPharmacyId: null,
  loading: false,
  error: null,

  maxDistanceKm: null, // Default: no distance restriction
  onlyOpen: false,
  onlyVerified: false,
  searchQuery: '',

  setPharmacies: (pharmacies) => set({ pharmacies }),

  setSelectedPharmacyId: (id) => set({ selectedPharmacyId: id }),

  addDiscoveredPharmacies: (incoming) => {
    const current = get().pharmacies;
    const merged = mergeDiscoveredPharmacies(current, incoming);
    const userCoords = get().userCoords;
    if (userCoords) {
      for (const p of merged) {
        const dist = haversineKm(userCoords, { latitude: p.latitude, longitude: p.longitude });
        p.distanceKm = Math.round(dist * 1000) / 1000;
        p.walkMinutes = Math.max(1, Math.round((dist / 5) * 60));
      }
      merged.sort((a, b) => (a.distanceKm ?? 9999) - (b.distanceKm ?? 9999));
    }
    set({ pharmacies: merged });
  },

  clearDiscoveredPharmacies: () => {
    clearDiscoveryCoverage();
    set({ pharmacies: [] });
  },

  setUserCoords: (coords) => {
    set({ userCoords: coords });
    if (coords && get().pharmacies.length > 0) {
      const updated = get().pharmacies.map((p) => {
        const dist = haversineKm(coords, { latitude: p.latitude, longitude: p.longitude });
        return {
          ...p,
          distanceKm: Math.round(dist * 1000) / 1000,
          walkMinutes: Math.max(1, Math.round((dist / 5) * 60)),
        };
      });
      set({ pharmacies: updated });
    }
  },

  setCurrentRegion: (region) => set({ currentRegion: region }),

  setMaxDistanceKm: (distance) => set({ maxDistanceKm: distance }),
  setOnlyOpen: (value) => set({ onlyOpen: value }),
  setOnlyVerified: (value) => set({ onlyVerified: value }),
  setSearchQuery: (query) => set({ searchQuery: query }),

  stopDiscovery: () => {
    if (activeAbortController) {
      activeAbortController.abort();
      activeAbortController = null;
    }
    set({ loading: false });
  },

  discoverInRegion: async (region: MapRegion, options?: { force?: boolean }) => {
    // 1. Stale request protection: cancel previous in-flight requests
    if (activeAbortController) {
      activeAbortController.abort();
    }
    const controller = new AbortController();
    activeAbortController = controller;
    const currentRequestId = ++requestCounter;

    set({ loading: true, error: null, currentRegion: region });

    try {
      const userCoords = get().userCoords;
      const currentPharmacies = get().pharmacies;

      // 2. Discover in region with coverage tracking and progressive accumulation
      const accumulated = await discoverPharmaciesInViewport({
        region,
        userCoords,
        existingPharmacies: currentPharmacies,
        signal: controller.signal,
        force: options?.force,
      });

      // 3. Functional state-safe commit: merge with latest store state
      if (!controller.signal.aborted && currentRequestId === requestCounter) {
        // Merge in case background actions added items during in-flight query
        const latestPharmacies = get().pharmacies;
        const finalMerged = mergeDiscoveredPharmacies(latestPharmacies, accumulated);
        set({ pharmacies: finalMerged, loading: false });
      }
    } catch (err: any) {
      if (err?.name !== 'AbortError' && currentRequestId === requestCounter) {
        set({ error: err?.message || 'Could not discover pharmacies.', loading: false });
      }
    } finally {
      if (currentRequestId === requestCounter && !controller.signal.aborted) {
        set({ loading: false });
      }
    }
  },

  loadNearby: async (userCoordsInput?: Coords | null) => {
    let coords = userCoordsInput || get().userCoords;
    if (!coords) {
      try {
        coords = await getCurrentLocation();
      } catch (err) {
        console.warn('GPS location request error:', err);
      }
    }

    if (coords) {
      get().setUserCoords(coords);
      const initialRegion: MapRegion = {
        latitude: coords.latitude,
        longitude: coords.longitude,
        latitudeDelta: 0.03,
        longitudeDelta: 0.03,
      };
      await get().discoverInRegion(initialRegion);
    }
  },

  getFilteredPharmacies: () => {
    const { pharmacies, maxDistanceKm, onlyOpen, onlyVerified, searchQuery, userCoords } = get();
    const cleanQ = searchQuery.toLowerCase().trim();

    return pharmacies.filter((p) => {
      // Search text filter
      if (cleanQ) {
        const matchesName = p.name.toLowerCase().includes(cleanQ);
        const matchesAddr = p.address?.toLowerCase().includes(cleanQ);
        if (!matchesName && !matchesAddr) return false;
      }

      // Distance limit filter (relative to real device GPS position)
      if (maxDistanceKm !== null && userCoords && p.distanceKm !== undefined) {
        if (p.distanceKm > maxDistanceKm) return false;
      }

      // Open only filter
      if (onlyOpen && p.isOpen === false) {
        return false;
      }

      // Verified only filter
      if (onlyVerified && !p.isVerified) {
        return false;
      }

      return true;
    });
  },
}));
