import * as ExpoLocation from 'expo-location';

export type Coords = { latitude: number; longitude: number };

/**
 * Request foreground location permission from the user.
 * Returns true if granted, false otherwise.
 */
export async function requestLocationPermission(): Promise<boolean> {
  const { status } = await ExpoLocation.requestForegroundPermissionsAsync();
  return status === 'granted';
}

/**
 * Get the device current GPS coordinates.
 * Throws if permission is denied or location unavailable.
 */
export async function getCurrentLocation(): Promise<Coords> {
  const granted = await requestLocationPermission();
  if (!granted) {
    throw new Error('Location permission denied');
  }

  const location = await ExpoLocation.getCurrentPositionAsync({
    accuracy: ExpoLocation.Accuracy.Balanced,
  });

  return {
    latitude: location.coords.latitude,
    longitude: location.coords.longitude,
  };
}
