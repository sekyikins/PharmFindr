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

let cachedLocation: { coords: Coords; timestamp: number } | null = null;

/**
 * Get device GPS coordinates with multi-tier fallback and memory caching:
 * 1. Fresh cache within 60 seconds
 * 2. Balanced current GPS position
 * 3. Last known position
 * 4. Previously cached location
 * 5. Default city coordinates (Accra 5.6037, -0.1870)
 *
 * Guaranteed NEVER to throw — returns fallback coordinates if permission is denied or GPS is unavailable.
 */
export async function getCurrentLocation(maxAgeMs = 60000): Promise<Coords> {
  if (cachedLocation && Date.now() - cachedLocation.timestamp < maxAgeMs) {
    return cachedLocation.coords;
  }

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
        const coords: Coords = {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        };
        cachedLocation = { coords, timestamp: Date.now() };
        return coords;
      }

      // 2. Fallback to last known position
      const lastKnown = await ExpoLocation.getLastKnownPositionAsync({});
      if (lastKnown && lastKnown.coords) {
        const coords: Coords = {
          latitude: lastKnown.coords.latitude,
          longitude: lastKnown.coords.longitude,
        };
        cachedLocation = { coords, timestamp: Date.now() };
        return coords;
      }
    }
  } catch (e) {
    console.warn('getCurrentLocation error, using fallback:', e);
  }

  // 3. Previously known location if fresh GPS timed out
  if (cachedLocation) {
    return cachedLocation.coords;
  }

  // 4. Absolute fallback so maps & pharmacies list never break
  return DEFAULT_COORDS;
}

/**
 * Watch device GPS location in real-time.
 * Calls onLocationUpdate continuously as user moves.
 * Returns a subscription object with a remove() method.
 */
export async function watchLocation(
  onLocationUpdate: (coords: Coords) => void,
  options?: {
    accuracy?: ExpoLocation.Accuracy;
    timeInterval?: number;
    distanceInterval?: number;
  }
): Promise<ExpoLocation.LocationSubscription | null> {
  try {
    const granted = await requestLocationPermission();
    if (!granted) return null;

    return await ExpoLocation.watchPositionAsync(
      {
        accuracy: options?.accuracy ?? ExpoLocation.Accuracy.High,
        timeInterval: options?.timeInterval ?? 2000,
        distanceInterval: options?.distanceInterval ?? 5, // update on 5 meters movement
      },
      (location) => {
        if (location?.coords) {
          const coords: Coords = {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
          };
          cachedLocation = { coords, timestamp: Date.now() };
          onLocationUpdate(coords);
        }
      }
    );
  } catch (e) {
    console.warn('watchLocation error:', e);
    return null;
  }
}
