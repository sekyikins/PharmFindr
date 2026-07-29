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
  /** Load (or refresh) nearby pharmacies using current device GPS. */
  loadNearby: (signal?: AbortSignal) => Promise<void>;
  /** Append pharmacies as they stream in from OSM (called by pharmacies screen). */
  setPharmacies: (pharmacies: OsmPharmacy[]) => void;
  setUserCoords: (coords: Coords) => void;
}

export const usePharmacyStore = create<PharmacyState>((set, get) => ({
  pharmacies: [],
  userCoords: null,
  loading: false,
  error: null,

  setPharmacies: (pharmacies) =>
    set({ pharmacies: [...pharmacies].sort((a, b) => a.distanceKm - b.distanceKm) }),
  setUserCoords: (coords) => set({ userCoords: coords }),

  loadNearby: async (signal?: AbortSignal) => {
    set({ loading: true, error: null, pharmacies: [] });
    try {
      const coords = await getCurrentLocation();
      if (signal?.aborted) return;
      set({ userCoords: coords });

      const found: OsmPharmacy[] = [];
      await searchNearbyPharmacies(
        coords,
        5000,
        (pharmacy) => {
          if (signal?.aborted) return;
          found.push(pharmacy);
          const sorted = [...found].sort((a, b) => a.distanceKm - b.distanceKm);
          set({ pharmacies: sorted });
        },
        signal
      );
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
