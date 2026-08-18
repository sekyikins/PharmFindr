/**
 * lib/googlePlaces.ts
 *
 * Google Places API (New) Provider.
 * Worldwide pharmacy discovery with adaptive spatial subdivision, place details,
 * reverse geocoding, and registration searching.
 */

import { haversineKm, isValidCoordinate, isValidRegion, computeViewportRadiusMeters } from './geoUtils';
import { formatGoogleTodayHours } from './timeUtils';
import type { Coords } from './location';
import type { DiscoveredPharmacy, MapRegion, WeeklyScheduleDay } from '@/types/map';

const GOOGLE_MAPS_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '';

export interface PlaceDetailsResult {
  placeId: string;
  name: string;
  address: string;
  phone?: string;
  isOpen?: boolean;
  hours?: string;
  statusText?: string;
  isClosingSoon?: boolean;
  nextOpenTime?: string;
  nextCloseTime?: string;
  utcOffsetMinutes?: number;
  weekdayDescriptions?: string[];
  weeklySchedule?: WeeklyScheduleDay[];
  latitude?: number;
  longitude?: number;
}

export type GooglePlacesDiscoveryResult =
  | { status: 'ok'; pharmacies: DiscoveredPharmacy[] }
  | { status: 'failed'; error: string }
  | { status: 'aborted' };

/**
 * Executes a single circular nearby search on Google Places API (New) for up to 20 places.
 */
async function querySingleGoogleCircle(
  center: Coords,
  radiusMeters: number,
  signal?: AbortSignal
): Promise<{ ok: boolean; places: any[]; error?: string }> {
  try {
    const res = await fetch('https://places.googleapis.com/v1/places:searchNearby', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': GOOGLE_MAPS_API_KEY,
        'X-Goog-FieldMask':
          'places.id,places.displayName,places.formattedAddress,places.location,places.currentOpeningHours,places.regularOpeningHours,places.nationalPhoneNumber,places.internationalPhoneNumber,places.utcOffsetMinutes',
      },
      body: JSON.stringify({
        includedTypes: ['pharmacy', 'drugstore'],
        maxResultCount: 20,
        locationRestriction: {
          circle: {
            center: {
              latitude: center.latitude,
              longitude: center.longitude,
            },
            radius: radiusMeters,
          },
        },
      }),
      signal,
    });

    if (!res.ok) {
      const errorText = await res.text().catch(() => '');
      return { ok: false, places: [], error: `HTTP ${res.status}: ${errorText}` };
    }

    const data = await res.json();
    const places: any[] = Array.isArray(data?.places) ? data.places : [];
    return { ok: true, places };
  } catch (err: any) {
    if (err?.name === 'AbortError' || signal?.aborted) {
      return { ok: false, places: [], error: 'aborted' };
    }
    return { ok: false, places: [], error: err?.message || 'Network request failed' };
  }
}

/**
 * Fetch live pharmacies in a given map region worldwide via Google Places API (New).
 *
 * Adaptive Spatial Subdivision:
 * - Solves the provider-enforced 20-result ceiling per request without invalid pagination.
 * - Subdivides the prefetch region into 5 overlapping spatial queries (Center + NW, NE, SW, SE quadrants).
 * - Queries quadrants in parallel, yielding up to 100 places across the entire prefetch envelope.
 * - Deduplicates all returned places by Place ID.
 */
export async function searchGoogleViewportPharmacies(
  region: MapRegion,
  userCoords?: Coords | null,
  signal?: AbortSignal
): Promise<GooglePlacesDiscoveryResult> {
  if (signal?.aborted) {
    return { status: 'aborted' };
  }

  if (!isValidRegion(region)) {
    return { status: 'ok', pharmacies: [] };
  }

  if (!GOOGLE_MAPS_API_KEY) {
    console.warn('Google Places API key is missing. Ensure EXPO_PUBLIC_GOOGLE_MAPS_API_KEY is configured.');
    return { status: 'failed', error: 'Missing EXPO_PUBLIC_GOOGLE_MAPS_API_KEY' };
  }

  const primaryRadius = computeViewportRadiusMeters(region);
  const subRadius = Math.max(3000, Math.min(35000, Math.round(primaryRadius * 0.60)));
  const offsetLat = region.latitudeDelta / 3;
  const offsetLon = region.longitudeDelta / 3;

  // 1. Define spatial subdivision query points (Center + 4 Quadrants)
  const searchPoints: Array<{ center: Coords; radius: number }> = [
    { center: { latitude: region.latitude, longitude: region.longitude }, radius: primaryRadius },
    { center: { latitude: region.latitude + offsetLat, longitude: region.longitude - offsetLon }, radius: subRadius },
    { center: { latitude: region.latitude + offsetLat, longitude: region.longitude + offsetLon }, radius: subRadius },
    { center: { latitude: region.latitude - offsetLat, longitude: region.longitude - offsetLon }, radius: subRadius },
    { center: { latitude: region.latitude - offsetLat, longitude: region.longitude + offsetLon }, radius: subRadius },
  ];

  // 2. Query all spatial points in parallel
  const queryPromises = searchPoints.map((pt) => querySingleGoogleCircle(pt.center, pt.radius, signal));
  const results = await Promise.allSettled(queryPromises);

  if (signal?.aborted) {
    return { status: 'aborted' };
  }

  // 3. Aggregate places and detect complete provider failure vs. successful queries
  const seenPlaceIds = new Set<string>();
  const aggregatedPlaces: any[] = [];
  let successfulQueries = 0;
  let lastError = '';

  for (const res of results) {
    if (res.status === 'fulfilled') {
      const val = res.value;
      if (val.ok) {
        successfulQueries++;
        for (const p of val.places) {
          if (p.location && isValidCoordinate(p.location.latitude, p.location.longitude)) {
            const pId = p.id || `${p.location.latitude},${p.location.longitude}`;
            if (!seenPlaceIds.has(pId)) {
              seenPlaceIds.add(pId);
              aggregatedPlaces.push(p);
            }
          }
        }
      } else {
        if (val.error === 'aborted') return { status: 'aborted' };
        if (val.error) lastError = val.error;
      }
    } else {
      lastError = res.reason?.message || 'Query rejected';
    }
  }

  // If every single query failed with network/API error, report failure
  if (successfulQueries === 0 && results.length > 0) {
    return { status: 'failed', error: lastError || 'Google Places discovery failed across all subdivisions' };
  }

  // 4. Transform unique aggregated places into DiscoveredPharmacy structures
  const pharmacies: DiscoveredPharmacy[] = aggregatedPlaces.map((p) => {
    const pharmacyCoords: Coords = {
      latitude: p.location.latitude,
      longitude: p.location.longitude,
    };
    const distKm = userCoords ? haversineKm(userCoords, pharmacyCoords) : undefined;
    const hoursData = formatGoogleTodayHours(
      p.currentOpeningHours,
      p.regularOpeningHours,
      p.utcOffsetMinutes
    );
    const phone = p.nationalPhoneNumber || p.internationalPhoneNumber;

    return {
      id: `gplace-${p.id}`,
      googlePlaceId: p.id,
      name: p.displayName?.text || 'Pharmacy',
      address: p.formattedAddress || 'Public Map Location',
      latitude: p.location.latitude,
      longitude: p.location.longitude,
      phone: phone || undefined,
      hours: hoursData.hours,
      weeklyHours: hoursData.weekdayDescriptions,
      weeklySchedule: hoursData.weeklySchedule,
      statusText: hoursData.statusText,
      nextCloseTime: hoursData.nextCloseTime,
      nextOpenTime: hoursData.nextOpenTime,
      isClosingSoon: hoursData.isClosingSoon,
      utcOffsetMinutes: p.utcOffsetMinutes,
      distanceKm: distKm !== undefined ? Math.round(distKm * 1000) / 1000 : undefined,
      walkMinutes: distKm !== undefined ? Math.max(1, Math.round((distKm / 5) * 60)) : undefined,
      isVerified: false,
      isOpen: hoursData.isOpen,
      source: 'google' as const,
    };
  });

  return { status: 'ok', pharmacies };
}

/**
 * Fetch detailed place info (including full weekly schedule & next open/close) by name and coords.
 */
export async function fetchPlaceDetailsByNameAndCoords(
  name: string,
  coords: Coords,
  signal?: AbortSignal
): Promise<PlaceDetailsResult | null> {
  if (!GOOGLE_MAPS_API_KEY || !isValidCoordinate(coords.latitude, coords.longitude)) {
    return null;
  }

  try {
    const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': GOOGLE_MAPS_API_KEY,
        'X-Goog-FieldMask':
          'places.id,places.displayName,places.formattedAddress,places.location,places.currentOpeningHours,places.regularOpeningHours,places.nationalPhoneNumber,places.internationalPhoneNumber,places.utcOffsetMinutes',
      },
      body: JSON.stringify({
        textQuery: `${name} pharmacy`,
        locationBias: {
          circle: {
            center: {
              latitude: coords.latitude,
              longitude: coords.longitude,
            },
            radius: 2000.0,
          },
        },
        maxResultCount: 1,
      }),
      signal,
    });

    if (!res.ok) return null;

    const data = await res.json();
    const place = data.places?.[0];
    if (!place) return null;

    const hoursData = formatGoogleTodayHours(
      place.currentOpeningHours,
      place.regularOpeningHours,
      place.utcOffsetMinutes
    );

    return {
      placeId: place.id,
      name: place.displayName?.text || name,
      address: place.formattedAddress || '',
      phone: place.nationalPhoneNumber || place.internationalPhoneNumber,
      isOpen: hoursData.isOpen,
      hours: hoursData.hours,
      statusText: hoursData.statusText,
      isClosingSoon: hoursData.isClosingSoon,
      nextCloseTime: hoursData.nextCloseTime,
      nextOpenTime: hoursData.nextOpenTime,
      utcOffsetMinutes: place.utcOffsetMinutes,
      weekdayDescriptions: hoursData.weekdayDescriptions,
      weeklySchedule: hoursData.weeklySchedule,
      latitude: place.location?.latitude,
      longitude: place.location?.longitude,
    };
  } catch (err: any) {
    if (err?.name !== 'AbortError') {
      console.warn('Error fetching place details from Google Places:', err.message);
    }
    return null;
  }
}

/**
 * Reverse-geocode coordinates into a human-readable street address using Google Places API (New).
 */
export async function fetchAddressForCoords(
  coords: Coords,
  signal?: AbortSignal
): Promise<string | null> {
  if (!GOOGLE_MAPS_API_KEY || !isValidCoordinate(coords.latitude, coords.longitude)) {
    return null;
  }

  try {
    const res = await fetch('https://places.googleapis.com/v1/places:searchNearby', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': GOOGLE_MAPS_API_KEY,
        'X-Goog-FieldMask': 'places.formattedAddress,places.displayName',
      },
      body: JSON.stringify({
        maxResultCount: 1,
        locationRestriction: {
          circle: {
            center: {
              latitude: coords.latitude,
              longitude: coords.longitude,
            },
            radius: 200.0,
          },
        },
      }),
      signal,
    });

    if (res.ok) {
      const data = await res.json();
      const place = data.places?.[0];
      if (place?.formattedAddress) {
        return place.formattedAddress;
      }
    }
  } catch (err: any) {
    if (err?.name !== 'AbortError') {
      console.warn('Google Places reverse address lookup notice:', err.message);
    }
  }
  return null;
}

export interface GoogleMapPharmacyItem {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  phone?: string;
}

/**
 * Dedicated Google Maps fetcher for pharmacy registration.
 */
export async function fetchGoogleMapsPharmaciesForRegistration(
  coords: Coords,
  radiusMeters = 10000,
  signal?: AbortSignal
): Promise<GoogleMapPharmacyItem[]> {
  if (!GOOGLE_MAPS_API_KEY || !isValidCoordinate(coords.latitude, coords.longitude)) {
    return [];
  }

  const radius = Math.min(Math.max(radiusMeters, 1000), 50000);
  const results: GoogleMapPharmacyItem[] = [];
  const seenIds = new Set<string>();

  const processPlaces = (places: any[]) => {
    for (const p of places || []) {
      if (p.location && isValidCoordinate(p.location.latitude, p.location.longitude)) {
        const id = `gplace-${p.id}`;
        if (!seenIds.has(id)) {
          seenIds.add(id);
          results.push({
            id,
            name: p.displayName?.text || 'Pharmacy',
            address: p.formattedAddress || 'Google Maps Location',
            latitude: p.location.latitude,
            longitude: p.location.longitude,
            phone: p.nationalPhoneNumber || p.internationalPhoneNumber || undefined,
          });
        }
      }
    }
  };

  const fetchNearby = async () => {
    try {
      const nearbyRes = await fetch('https://places.googleapis.com/v1/places:searchNearby', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': GOOGLE_MAPS_API_KEY,
          'X-Goog-FieldMask':
            'places.id,places.displayName,places.formattedAddress,places.location,places.nationalPhoneNumber,places.internationalPhoneNumber',
        },
        body: JSON.stringify({
          includedTypes: ['pharmacy', 'drugstore'],
          maxResultCount: 20,
          locationRestriction: {
            circle: {
              center: {
                latitude: coords.latitude,
                longitude: coords.longitude,
              },
              radius,
            },
          },
        }),
        signal,
      });
      if (nearbyRes.ok) {
        const data = await nearbyRes.json();
        processPlaces(data.places);
      }
    } catch {
      // handled
    }
  };

  const fetchText = async () => {
    try {
      const textRes = await fetch('https://places.googleapis.com/v1/places:searchText', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': GOOGLE_MAPS_API_KEY,
          'X-Goog-FieldMask':
            'places.id,places.displayName,places.formattedAddress,places.location,places.nationalPhoneNumber,places.internationalPhoneNumber',
        },
        body: JSON.stringify({
          textQuery: 'pharmacy OR drugstore OR apotheke OR pharmacie',
          locationBias: {
            circle: {
              center: {
                latitude: coords.latitude,
                longitude: coords.longitude,
              },
              radius,
            },
          },
          maxResultCount: 20,
        }),
        signal,
      });
      if (textRes.ok) {
        const data = await textRes.json();
        processPlaces(data.places);
      }
    } catch {
      // handled
    }
  };

  await Promise.allSettled([fetchNearby(), fetchText()]);

  return results;
}
