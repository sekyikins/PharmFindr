import { haversineKm, formatTimeHHMM, type OsmPharmacy } from './osm';
import { DEFAULT_COORDS, type Coords } from './location';

const GOOGLE_MAPS_API_KEY =
  process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || 'AIzaSyAXy83HZpz5JTArZYZ8IZFfXDSjGiNzxd0';

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
  weeklySchedule?: Array<{ day: string; isOpen: boolean; opens: string; closes: string }>;
  latitude?: number;
  longitude?: number;
}

const DAYS_ORDER = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

/**
 * Format a time string from ISO datetime string taking utcOffsetMinutes into account.
 * E.g. "2026-08-10T22:00:00Z" -> "10:00 PM"
 */
export function formatTimeFromIso(isoStr?: string | null, utcOffsetMinutes?: number): string | null {
  if (!isoStr) return null;
  try {
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return null;

    const targetDate = utcOffsetMinutes !== undefined
      ? new Date(d.getTime() + (utcOffsetMinutes + d.getTimezoneOffset()) * 60000)
      : d;

    let hours = targetDate.getHours();
    const minutes = targetDate.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;
    const minutesStr = minutes < 10 ? '0' + minutes : String(minutes);

    return `${hours}:${minutesStr} ${ampm}`;
  } catch {
    return null;
  }
}

/**
 * Format relative day + time for next open/close timestamp.
 * E.g. "Today 10:00 PM", "Tomorrow 8:00 AM", "Tue 8:00 AM"
 */
export function formatRelativeDateTime(isoStr?: string | null, utcOffsetMinutes?: number): string | null {
  if (!isoStr) return null;
  try {
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return null;

    const targetDate = utcOffsetMinutes !== undefined
      ? new Date(d.getTime() + (utcOffsetMinutes + d.getTimezoneOffset()) * 60000)
      : d;

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const eventDay = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());
    const dayDiff = Math.round((eventDay.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    const timeStr = formatTimeFromIso(isoStr, utcOffsetMinutes);
    if (!timeStr) return null;

    if (dayDiff === 0) {
      return timeStr;
    } else if (dayDiff === 1) {
      return `Tomorrow ${timeStr}`;
    } else {
      const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      return `${dayNames[targetDate.getDay()]} ${timeStr}`;
    }
  } catch {
    return null;
  }
}

/**
 * Build a concise, intuitive status label using openNow, nextCloseTime, hours.
 * For closed pharmacies, cleanly returns 'Closed' without trailing times.
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

  if (hours && /24\s*hours/i.test(hours)) {
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
 * Convert Google Places weekday descriptions into structured weekly schedule.
 */
export function parseWeekdayDescriptions(
  weekdayDescriptions?: string[]
): Array<{ day: string; isOpen: boolean; opens: string; closes: string }> {
  if (!weekdayDescriptions || weekdayDescriptions.length === 0) return [];

  const dayMap = new Map<string, { isOpen: boolean; opens: string; closes: string }>();

  for (const line of weekdayDescriptions) {
    const cleanLine = line.replace(/[\u200B-\u200D\uFEFF\u202F\u00A0]/g, ' ').trim();
    const colonIdx = cleanLine.indexOf(':');
    if (colonIdx === -1) continue;

    const dayName = cleanLine.slice(0, colonIdx).trim();
    const hoursStr = cleanLine.slice(colonIdx + 1).trim();

    if (/closed/i.test(hoursStr)) {
      dayMap.set(dayName.toLowerCase(), { isOpen: false, opens: '', closes: '' });
    } else if (/24\s*hours/i.test(hoursStr)) {
      dayMap.set(dayName.toLowerCase(), { isOpen: true, opens: '00:00', closes: '24:00' });
    } else {
      const parts = hoursStr.split(/[–—\-]/).map((s) => s.trim());
      if (parts.length >= 2) {
        dayMap.set(dayName.toLowerCase(), {
          isOpen: true,
          opens: formatTimeHHMM(parts[0]),
          closes: formatTimeHHMM(parts[1]),
        });
      } else {
        dayMap.set(dayName.toLowerCase(), { isOpen: true, opens: formatTimeHHMM(hoursStr), closes: '' });
      }
    }
  }

  return DAYS_ORDER.map((d) => {
    const entry = dayMap.get(d.toLowerCase());
    return {
      day: d,
      isOpen: entry ? entry.isOpen : d !== 'Sunday',
      opens: entry ? entry.opens : '08:00',
      closes: entry ? entry.closes : '20:00',
    };
  });
}

/**
 * Format today's operating hours and extract openNow, nextCloseTime, nextOpenTime.
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
} {
  const hoursObj = currentOpeningHours || regularOpeningHours;
  if (!hoursObj) return {};

  const weekdayDescriptions: string[] =
    currentOpeningHours?.weekdayDescriptions || regularOpeningHours?.weekdayDescriptions || [];
  const isOpen = hoursObj.openNow !== undefined ? Boolean(hoursObj.openNow) : undefined;
  const nextCloseTime = currentOpeningHours?.nextCloseTime || regularOpeningHours?.nextCloseTime;
  const nextOpenTime = currentOpeningHours?.nextOpenTime || regularOpeningHours?.nextOpenTime;

  const targetNow = utcOffsetMinutes !== undefined
    ? new Date(Date.now() + (utcOffsetMinutes + new Date().getTimezoneOffset()) * 60000)
    : new Date();
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const currentDayName = dayNames[targetNow.getDay()];

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

  if (!todayHoursStr && hoursObj.periods && hoursObj.periods.length > 0) {
    const todayPeriod = hoursObj.periods.find((p: any) => p.open?.day === targetNow.getDay());
    if (todayPeriod) {
      if (todayPeriod.open?.hour === 0 && todayPeriod.close?.hour === 23) {
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
  };
}

/**
 * Fetch live nearby pharmacies with real-time operating hours from Google Places API (New).
 */
export async function searchGoogleNearbyPharmacies(
  userCoords: Coords,
  radiusMeters = 8000,
  signal?: AbortSignal
): Promise<OsmPharmacy[]> {
  const coordsBase = userCoords || DEFAULT_COORDS;
  const radius = Math.min(Math.max(radiusMeters, 1000), 50000);

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
              latitude: coordsBase.latitude,
              longitude: coordsBase.longitude,
            },
            radius,
          },
        },
      }),
      signal,
    });

    if (!res.ok) {
      return [];
    }

    const data = await res.json();
    const places: any[] = data.places || [];

    return places
      .filter((p) => p.location && p.location.latitude && p.location.longitude)
      .map((p) => {
        const pharmacyCoords: Coords = {
          latitude: p.location.latitude,
          longitude: p.location.longitude,
        };
        const distanceKm = haversineKm(coordsBase, pharmacyCoords);
        const hoursData = formatGoogleTodayHours(
          p.currentOpeningHours,
          p.regularOpeningHours,
          p.utcOffsetMinutes
        );
        const phone = p.nationalPhoneNumber || p.internationalPhoneNumber;

        return {
          id: `gplace-${p.id}`,
          name: p.displayName?.text || 'Pharmacy',
          address: p.formattedAddress || 'Ghana',
          latitude: p.location.latitude,
          longitude: p.location.longitude,
          phone: phone || undefined,
          hours: hoursData.hours,
          weeklyHours: hoursData.weekdayDescriptions,
          statusText: hoursData.statusText,
          nextCloseTime: hoursData.nextCloseTime,
          nextOpenTime: hoursData.nextOpenTime,
          distanceKm: Math.round(distanceKm * 1000) / 1000,
          walkMinutes: Math.max(1, Math.round((distanceKm / 5) * 60)),
          isVerified: false,
          isOpen: hoursData.isOpen,
        };
      });
  } catch (err: any) {
    if (err?.name !== 'AbortError') {
      console.warn('Google Places API search error:', err.message);
    }
    return [];
  }
}

/**
 * Fetch detailed place info (including full weekly schedule, exceptions & next open/close) by name and coords.
 */
export async function fetchPlaceDetailsByNameAndCoords(
  name: string,
  coords: Coords,
  signal?: AbortSignal
): Promise<PlaceDetailsResult | null> {
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
    const weeklySchedule = parseWeekdayDescriptions(hoursData.weekdayDescriptions);

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
      weeklySchedule,
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
  const radius = Math.min(Math.max(radiusMeters, 1000), 50000);
  const results: GoogleMapPharmacyItem[] = [];
  const seenIds = new Set<string>();

  const processPlaces = (places: any[]) => {
    for (const p of places || []) {
      if (p.location?.latitude && p.location?.longitude) {
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

  // Run nearby search + multilingual text search simultaneously for comprehensive worldwide results
  const fetchNearby = async () => {
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
  };

  const fetchText = async () => {
    const textRes = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': GOOGLE_MAPS_API_KEY,
        'X-Goog-FieldMask':
          'places.id,places.displayName,places.formattedAddress,places.location,places.nationalPhoneNumber,places.internationalPhoneNumber',
      },
      body: JSON.stringify({
        textQuery: 'pharmacie OR pharmacy OR صيدلية',
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
  };

  await Promise.allSettled([fetchNearby(), fetchText()]);

  return results;
}

