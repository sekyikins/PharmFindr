import { haversineKm, formatTimeHHMM, isValidCoordinate, isValidRegion } from './osm';
import { computeViewportRadiusMeters } from './pharmacyDiscovery';
import { type Coords } from './location';
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

const DAYS_ORDER = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

/**
 * Get current time & calendar date in the pharmacy's local timezone using utcOffsetMinutes.
 */
export function getPharmacyTimeInfo(utcOffsetMinutes?: number): {
  dayIndex: number;
  hours: number;
  minutes: number;
  currentMinutes: number;
  year: number;
  month: number;
  date: number;
} {
  const nowUtcMs = Date.now();
  const offsetMs = (utcOffsetMinutes !== undefined && !isNaN(utcOffsetMinutes))
    ? utcOffsetMinutes * 60000
    : -new Date().getTimezoneOffset() * 60000;
  const localDate = new Date(nowUtcMs + offsetMs);
  const hours = localDate.getUTCHours();
  const minutes = localDate.getUTCMinutes();
  return {
    dayIndex: localDate.getUTCDay(),
    hours,
    minutes,
    currentMinutes: hours * 60 + minutes,
    year: localDate.getUTCFullYear(),
    month: localDate.getUTCMonth(),
    date: localDate.getUTCDate(),
  };
}

/**
 * Format a time string from ISO datetime string taking utcOffsetMinutes into account.
 * E.g. "2026-08-10T22:00:00Z" -> "10:00 PM"
 */
export function formatTimeFromIso(isoStr?: string | null, utcOffsetMinutes?: number): string | null {
  if (!isoStr) return null;
  try {
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return null;

    const offsetMs = (utcOffsetMinutes !== undefined && !isNaN(utcOffsetMinutes))
      ? utcOffsetMinutes * 60000
      : -new Date().getTimezoneOffset() * 60000;

    const targetDate = new Date(d.getTime() + offsetMs);
    let hours = targetDate.getUTCHours();
    const minutes = targetDate.getUTCMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;
    const minutesStr = minutes < 10 ? '0' + minutes : String(minutes);

    return `${hours}:${minutesStr} ${ampm}`;
  } catch {
    return null;
  }
}

/**
 * Format relative day + time for next open/close timestamp in the pharmacy's local timezone.
 * E.g. "10:00 PM", "Tomorrow 8:00 AM", "Tue 8:00 AM"
 */
export function formatRelativeDateTime(isoStr?: string | null, utcOffsetMinutes?: number): string | null {
  if (!isoStr) return null;
  try {
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return null;

    const offsetMs = (utcOffsetMinutes !== undefined && !isNaN(utcOffsetMinutes))
      ? utcOffsetMinutes * 60000
      : -new Date().getTimezoneOffset() * 60000;

    const eventDate = new Date(d.getTime() + offsetMs);
    const nowInfo = getPharmacyTimeInfo(utcOffsetMinutes);

    const nowDayMs = Date.UTC(nowInfo.year, nowInfo.month, nowInfo.date);
    const eventDayMs = Date.UTC(eventDate.getUTCFullYear(), eventDate.getUTCMonth(), eventDate.getUTCDate());
    const dayDiff = Math.round((eventDayMs - nowDayMs) / (1000 * 60 * 60 * 24));

    const timeStr = formatTimeFromIso(isoStr, utcOffsetMinutes);
    if (!timeStr) return null;

    if (dayDiff === 0) {
      return timeStr;
    } else if (dayDiff === 1) {
      return `Tomorrow ${timeStr}`;
    } else {
      const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      return `${dayNames[eventDate.getUTCDay()]} ${timeStr}`;
    }
  } catch {
    return null;
  }
}

/**
 * Build a concise status label using openNow, nextCloseTime, hours.
 */
export function buildPharmacyStatusText(params: {
  isOpen?: boolean;
  hours?: string;
  nextCloseTime?: string;
  nextOpenTime?: string;
  utcOffsetMinutes?: number;
}): { statusText: string; isClosingSoon: boolean } {
  const { isOpen, hours, nextCloseTime, utcOffsetMinutes } = params;

  if (isOpen === false) {
    return { statusText: 'Closed', isClosingSoon: false };
  }

  if (hours && /24\s*hours|24\/7/i.test(hours)) {
    return { statusText: 'Open 24 Hours', isClosingSoon: false };
  }

  if (isOpen === true) {
    if (nextCloseTime) {
      const closeTime = new Date(nextCloseTime);
      const now = new Date();
      const diffMinutes = Math.round((closeTime.getTime() - now.getTime()) / 60000);
      const formattedClose = formatTimeFromIso(nextCloseTime, utcOffsetMinutes);

      if (diffMinutes > 0 && diffMinutes <= 60 && formattedClose) {
        return { statusText: `Closes soon · ${formattedClose}`, isClosingSoon: true };
      }
      if (formattedClose) {
        return { statusText: `Open · Closes ${formattedClose}`, isClosingSoon: false };
      }
    }
    const cleanHours = hours ? formatTimeHHMM(hours) : null;
    return { statusText: cleanHours && cleanHours !== 'Closed today' ? `Open (${cleanHours})` : 'Open', isClosingSoon: false };
  }

  return { statusText: hours ? formatTimeHHMM(hours) : 'Public Map Location', isClosingSoon: false };
}

/**
 * Convert Google Places weekday descriptions into structured weekly schedule without inventing missing hours.
 */
export function parseWeekdayDescriptions(
  weekdayDescriptions?: string[]
): WeeklyScheduleDay[] {
  if (!weekdayDescriptions || weekdayDescriptions.length === 0) return [];

  const dayMap = new Map<string, { isOpen: boolean | null; opens: string; closes: string; isUnknown?: boolean }>();

  for (const line of weekdayDescriptions) {
    const cleanLine = line.replace(/[\u200B-\u200D\uFEFF\u202F\u00A0]/g, ' ').trim();
    const colonIdx = cleanLine.indexOf(':');
    if (colonIdx === -1) continue;

    const dayName = cleanLine.slice(0, colonIdx).trim();
    const hoursStr = cleanLine.slice(colonIdx + 1).trim();

    if (/closed/i.test(hoursStr)) {
      dayMap.set(dayName.toLowerCase(), { isOpen: false, opens: '', closes: '', isUnknown: false });
    } else if (/24\s*hours|24\/7/i.test(hoursStr)) {
      dayMap.set(dayName.toLowerCase(), { isOpen: true, opens: '00:00', closes: '24:00', isUnknown: false });
    } else {
      const parts = hoursStr.split(/[–—\-]/).map((s) => s.trim());
      if (parts.length >= 2) {
        dayMap.set(dayName.toLowerCase(), {
          isOpen: true,
          opens: formatTimeHHMM(parts[0]),
          closes: formatTimeHHMM(parts[1]),
          isUnknown: false,
        });
      } else {
        dayMap.set(dayName.toLowerCase(), { isOpen: true, opens: formatTimeHHMM(hoursStr), closes: '', isUnknown: false });
      }
    }
  }

  return DAYS_ORDER.map((d) => {
    const entry = dayMap.get(d.toLowerCase());
    if (!entry) {
      return {
        day: d,
        isOpen: null,
        opens: '',
        closes: '',
        isUnknown: true,
      };
    }
    return {
      day: d,
      isOpen: entry.isOpen,
      opens: entry.opens,
      closes: entry.closes,
      isUnknown: entry.isUnknown,
    };
  });
}

/**
 * Format today's operating hours and extract openNow, nextCloseTime, nextOpenTime in local timezone.
 */
export function formatGoogleTodayHours(
  currentOpeningHours?: any,
  regularOpeningHours?: any,
  utcOffsetMinutes?: number
): {
  hours?: string;
  isOpen?: boolean;
  statusText?: string;
  isClosingSoon?: boolean;
  nextCloseTime?: string;
  nextOpenTime?: string;
  weekdayDescriptions?: string[];
  weeklySchedule?: WeeklyScheduleDay[];
} {
  const hoursObj = currentOpeningHours || regularOpeningHours;
  if (!hoursObj) return {};

  const weekdayDescriptions: string[] =
    currentOpeningHours?.weekdayDescriptions || regularOpeningHours?.weekdayDescriptions || [];
  const weeklySchedule = parseWeekdayDescriptions(weekdayDescriptions);

  const isOpen = hoursObj.openNow !== undefined ? Boolean(hoursObj.openNow) : undefined;
  const nextCloseTime = currentOpeningHours?.nextCloseTime || regularOpeningHours?.nextCloseTime;
  const nextOpenTime = currentOpeningHours?.nextOpenTime || regularOpeningHours?.nextOpenTime;

  const nowInfo = getPharmacyTimeInfo(utcOffsetMinutes);
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const currentDayName = dayNames[nowInfo.dayIndex];

  let todayHoursStr: string | undefined;

  if (weekdayDescriptions.length > 0) {
    const matchLine = weekdayDescriptions.find((line) =>
      line.toLowerCase().startsWith(currentDayName.toLowerCase())
    );
    if (matchLine) {
      const cleanLine = matchLine.replace(/[\u200B-\u200D\uFEFF\u202F\u00A0]/g, ' ').trim();
      const colonIdx = cleanLine.indexOf(':');
      if (colonIdx !== -1) {
        todayHoursStr = cleanLine.slice(colonIdx + 1).trim();
      }
    }
  }

  if (!todayHoursStr && hoursObj.periods && Array.isArray(hoursObj.periods)) {
    const todayPeriod = hoursObj.periods.find((p: any) => p.open?.day === nowInfo.dayIndex);
    if (todayPeriod) {
      if (todayPeriod.open?.hour === 0 && (todayPeriod.close?.hour === 23 || todayPeriod.close?.hour === 24 || !todayPeriod.close)) {
        todayHoursStr = 'Open 24 hours';
      } else {
        const oH = String(todayPeriod.open?.hour || 8).padStart(2, '0');
        const oM = String(todayPeriod.open?.minute || 0).padStart(2, '0');
        const cH = String(todayPeriod.close?.hour || 20).padStart(2, '0');
        const cM = String(todayPeriod.close?.minute || 0).padStart(2, '0');
        todayHoursStr = `${oH}:${oM} - ${cH}:${cM}`;
      }
    }
  }

  const cleanTodayHours = todayHoursStr ? formatTimeHHMM(todayHoursStr) : undefined;

  const statusInfo = buildPharmacyStatusText({
    isOpen,
    hours: cleanTodayHours,
    nextCloseTime,
    nextOpenTime,
    utcOffsetMinutes,
  });

  return {
    hours: cleanTodayHours,
    isOpen,
    statusText: statusInfo.statusText,
    isClosingSoon: statusInfo.isClosingSoon,
    nextCloseTime,
    nextOpenTime,
    weekdayDescriptions,
    weeklySchedule,
  };
}

/**
 * Fetch live pharmacies in a given map region worldwide via Google Places API (New).
 * Distinguishes success (including valid 0 results) from provider failures or aborts.
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

  const radiusMeters = computeViewportRadiusMeters(region);

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
              latitude: region.latitude,
              longitude: region.longitude,
            },
            radius: radiusMeters,
          },
        },
      }),
      signal,
    });

    if (!res.ok) {
      const errorText = await res.text().catch(() => '');
      return { status: 'failed', error: `Google Places API error (${res.status}): ${errorText}` };
    }

    const data = await res.json();
    const rawPlaces: any[] = Array.isArray(data?.places) ? data.places : [];

    // Deduplicate within Google provider output by place id
    const seenPlaceIds = new Set<string>();
    const uniquePlaces: any[] = [];

    for (const p of rawPlaces) {
      if (p.location && isValidCoordinate(p.location.latitude, p.location.longitude)) {
        const pId = p.id || `${p.location.latitude},${p.location.longitude}`;
        if (!seenPlaceIds.has(pId)) {
          seenPlaceIds.add(pId);
          uniquePlaces.push(p);
        }
      }
    }

    const pharmacies: DiscoveredPharmacy[] = uniquePlaces.map((p) => {
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
  } catch (err: any) {
    if (err?.name === 'AbortError' || signal?.aborted) {
      return { status: 'aborted' };
    }
    return { status: 'failed', error: err?.message || 'Google Places network request failed' };
  }
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
 * Reverse-geocode coordinates into a human-readable street address
 * using Google Places API (New).
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
 * Fetches all pharmacies in any region worldwide via Google Places API.
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
