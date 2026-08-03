import * as ExpoLocation from 'expo-location';

export type Coords = { latitude: number; longitude: number };

// Fallback Accra coordinates if device GPS is disabled/denied
export const DEFAULT_COORDS: Coords = {
  latitude: 5.6037,
  longitude: -0.1870,
};

/**
 * Request foreground location permission from the user.
 * Returns true if granted, false otherwise.
 */
export async function requestLocationPermission(): Promise<boolean> {
  try {
    const { status } = await ExpoLocation.requestForegroundPermissionsAsync();
    return status === 'granted';
  } catch (e) {
    console.warn('Error requesting location permission:', e);
    return false;
  }
}

/**
 * Get device GPS coordinates with multi-tier fallback:
 * 1. Balanced current GPS position
 * 2. Last known position
 * 3. Default city coordinates (Accra 5.6037, -0.1870)
 *
 * Guaranteed NEVER to throw — returns fallback coordinates if permission is denied or GPS is unavailable.
 */
export async function getCurrentLocation(): Promise<Coords> {
  try {
    const granted = await requestLocationPermission();
    if (granted) {
      // 1. Try current position with a 6-second timeout
      const posPromise = ExpoLocation.getCurrentPositionAsync({
        accuracy: ExpoLocation.Accuracy.Balanced,
      });

      const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 6000));

      const location = await Promise.race([posPromise, timeoutPromise]);

      if (location && location.coords) {
        return {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        };
      }

      // 2. Fallback to last known position
      const lastKnown = await ExpoLocation.getLastKnownPositionAsync({});
      if (lastKnown && lastKnown.coords) {
        return {
          latitude: lastKnown.coords.latitude,
          longitude: lastKnown.coords.longitude,
        };
      }
    }
  } catch (e) {
    console.warn('getCurrentLocation error, using fallback:', e);
  }

  // 3. Absolute fallback so maps & pharmacies list never break
  return DEFAULT_COORDS;
}
