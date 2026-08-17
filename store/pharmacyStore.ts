/**
 * pharmacyStore.ts
 *
 * Shared Zustand store for nearby pharmacies (OSM data).
 * The "Nearby Pharmacies" screen populates this store.
 * The home screen reads from it — no duplicate GPS fetch required.
 */
import { create } from 'zustand';
import { getCurrentLocation, type Coords } from '@/lib/location';
import { searchNearbyPharmacies, type OsmPharmacy } from '@/lib/osm';

interface PharmacyState {
  pharmacies: OsmPharmacy[];
  userCoords: Coords | null;
  loading: boolean;
  error: string | null;

  // Filter & Radius Settings
  maxDistanceKm: number;
  onlyOpen: boolean;
  onlyVerified: boolean;

  /** Load (or refresh) nearby pharmacies using current device GPS and active radius limit. */
  loadNearby: (signal?: AbortSignal) => Promise<void>;
  setPharmacies: (pharmacies: OsmPharmacy[]) => void;
  setUserCoords: (coords: Coords | null) => void;
  setMaxDistanceKm: (distance: number) => void;
  setOnlyOpen: (value: boolean) => void;
  setOnlyVerified: (value: boolean) => void;
}

export const usePharmacyStore = create<PharmacyState>((set, get) => ({
  pharmacies: [],
  userCoords: null,
  loading: false,
  error: null,

  maxDistanceKm: 5, // Default 5 km radius limit
  onlyOpen: false,
  onlyVerified: false,

  setPharmacies: (pharmacies) =>
    set({ pharmacies: [...pharmacies].sort((a, b) => a.distanceKm - b.distanceKm) }),
  setUserCoords: (coords) => set({ userCoords: coords }),

  setMaxDistanceKm: (distance) => set({ maxDistanceKm: distance }),

  setOnlyOpen: (value) => set({ onlyOpen: value }),
  setOnlyVerified: (value) => set({ onlyVerified: value }),

  loadNearby: async (signal?: AbortSignal) => {
    set({ loading: true, error: null });
    try {
      const coords = await getCurrentLocation();
      if (signal?.aborted) return;
      set({ userCoords: coords });

      const radiusMeters = Math.min(Math.max(get().maxDistanceKm * 1000, 1000), 50000);
      const foundMap = new Map<string, OsmPharmacy>();

      const allPharmacies = await searchNearbyPharmacies(
        coords,
        radiusMeters,
        (pharmacy) => {
          if (signal?.aborted) return;
          if (!foundMap.has(pharmacy.id)) {
            foundMap.set(pharmacy.id, pharmacy);
            const sorted = Array.from(foundMap.values()).sort((a, b) => a.distanceKm - b.distanceKm);
            set({ pharmacies: sorted });
          }
        },
        signal
      );
      if (!signal?.aborted && allPharmacies.length > 0) {
        set({ pharmacies: allPharmacies });
      }
    } catch (e: any) {
      if (e?.message !== 'Aborted' && !signal?.aborted) {
        set({ error: e?.message ?? 'Could not load pharmacies.' });
      }
    } finally {
      if (!signal?.aborted) {
        set({ loading: false });
      }
    }
  },
}));
