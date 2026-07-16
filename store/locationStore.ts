import { create } from 'zustand';
import * as Location from 'expo-location';

interface Coordinates {
  latitude: number;
  longitude: number;
}

interface LocationState {
  coords: Coordinates | null;
  errorMsg: string | null;
  loading: boolean;
  requestLocationPermission: () => Promise<Coordinates | null>;
}

export const useLocationStore = create<LocationState>((set) => ({
  coords: null,
  errorMsg: null,
  loading: false,

  requestLocationPermission: async () => {
    set({ loading: true, errorMsg: null });
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        const errorMsg = 'Permission to access location was denied';
        set({ errorMsg, loading: false });
        return null;
      }

      const location = await Location.getCurrentPositionAsync({});
      const coords = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      };
      set({ coords, loading: false });
      return coords;
    } catch (error: any) {
      const errorMsg = error?.message || 'Failed to fetch location';
      set({ errorMsg, loading: false });
      return null;
    }
  },
}));
