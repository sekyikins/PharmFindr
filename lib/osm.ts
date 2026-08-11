import { getCurrentLocation, DEFAULT_COORDS, type Coords } from './location';
import { supabase } from './supabase';

export interface OsmPharmacy {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  phone?: string;
  hours?: string;
  weeklyHours?: string[];
  statusText?: string;
  nextOpenTime?: string;
  nextCloseTime?: string;
  isClosingSoon?: boolean;
  utcOffsetMinutes?: number;
  distanceKm: number;
  walkMinutes: number;
  isRegistered?: boolean;
  verified?: boolean;
  isOpen?: boolean;
}

/**
 * Strips seconds from time strings, ensuring only hours and minutes are displayed.
 * E.g. "08:00:00" -> "08:00", "20:00:00" -> "20:00", "08:00:00 - 20:00:00" -> "08:00 - 20:00"
 */
export function formatTimeHHMM(timeStr?: string | null): string {
  if (!timeStr) return '';
  const clean = timeStr.trim();
  if (clean.includes('-') || clean.includes('–') || clean.includes('—')) {
    const parts = clean.split(/[-–—]/).map((s) => formatTimeHHMM(s.trim()));
    return parts.join(' - ');
  }
  const match = clean.match(/^(\d{1,2}):(\d{2})(?::\d{2})?(?:\.\d+)?\s*(AM|PM)?$/i);
  if (match) {
    const [, h, m, ampm] = match;
    const hStr = h.padStart(2, '0');
    return ampm ? `${parseInt(h, 10)}:${m} ${ampm.toUpperCase()}` : `${hStr}:${m}`;
  }
  return clean;
}

function parseTimeMinutes(timeStr?: string | null): number | null {
  if (!timeStr) return null;
  const [h, m] = timeStr.split(':').map(Number);
  return !isNaN(h) ? h * 60 + (m || 0) : null;
}

function isTimeWithin(openMin: number, closeMin: number, currentMin: number): boolean {
  return closeMin > openMin
    ? currentMin >= openMin && currentMin <= closeMin
    : currentMin >= openMin || currentMin <= closeMin;
}

/**
 * Evaluate whether opening hours indicate the pharmacy is open now.
 */
export function checkIsOpen(
  openingTime?: string | null,
  closingTime?: string | null,
  rawHours?: string | null,
  operatingHours?: any[] | null
): boolean {
  try {
    const now = new Date();
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const currentDayName = dayNames[now.getDay()];
    const currentMin = now.getHours() * 60 + now.getMinutes();

    // 1. Check detailed weekly schedule array (from table or JSON)
    if (operatingHours && Array.isArray(operatingHours) && operatingHours.length > 0) {
      const todaySchedule = operatingHours.find(
        (item: any) =>
          (item.day || item.day_of_week)?.toLowerCase() === currentDayName.toLowerCase()
      );
      if (todaySchedule) {
        const isOpenFlag = todaySchedule.isOpen !== undefined ? todaySchedule.isOpen : todaySchedule.is_open;
        if (isOpenFlag === false) return false;
        const openMin = parseTimeMinutes(todaySchedule.opens || todaySchedule.opening_time);
        const closeMin = parseTimeMinutes(todaySchedule.closes || todaySchedule.closing_time);
        if (openMin !== null && closeMin !== null) {
          return isTimeWithin(openMin, closeMin, currentMin);
        }
      }
    }

    // 2. Check default opening_time & closing_time
    const openMin = parseTimeMinutes(openingTime);
    const closeMin = parseTimeMinutes(closingTime);
    if (openMin !== null && closeMin !== null) {
      return isTimeWithin(openMin, closeMin, currentMin);
    }

    // 3. Check raw OSM hours string
    if (rawHours) {
      if (/24\s*hours|24\/7/i.test(rawHours)) return true;
      if (/off|closed/i.test(rawHours)) return false;
      const match = rawHours.match(/(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/);
      if (match) {
        const oMin = parseInt(match[1], 10) * 60 + parseInt(match[2], 10);
        const cMin = parseInt(match[3], 10) * 60 + parseInt(match[4], 10);
        return isTimeWithin(oMin, cMin, currentMin);
      }
    }
  } catch (e) {
    // fallback
  }
  return true;
}

/**
 * Calculate straight-line distance between two coordinates (Haversine formula), in km.
 */
export function haversineKm(a: Coords, b: Coords): number {
  const R = 6371;
  const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
  const dLon = ((b.longitude - a.longitude) * Math.PI) / 180;
  const lat1 = (a.latitude * Math.PI) / 180;
  const lat2 = (b.latitude * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(x));
}

/**
 * Build a human-readable address from OSM tags.
 */
function buildAddress(tags: Record<string, string>): string {
  const parts: string[] = [];
  if (tags['addr:housenumber'] && tags['addr:street']) {
    parts.push(`${tags['addr:housenumber']} ${tags['addr:street']}`);
  } else if (tags['addr:street']) {
    parts.push(tags['addr:street']);
  }
  if (tags['addr:city']) parts.push(tags['addr:city']);
  return parts.length > 0 ? parts.join(', ') : 'Public Map Address';
}

/**
 * Fetch registered verified pharmacies from Supabase database including weekly operating hours.
 */
export async function getRegisteredPharmacies(userCoords?: Coords | null): Promise<OsmPharmacy[]> {
  const coordsBase = userCoords || DEFAULT_COORDS;
  const now = new Date();
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const currentDayName = dayNames[now.getDay()];

  try {
    const { data, error } = await supabase
      .from('pharmacies')
      .select('id, name, address, phone, latitude, longitude, opening_time, closing_time, verified, pharmacy_operating_hours(day_of_week, is_open, opening_time, closing_time)');

    if (error) {
      console.warn('Error fetching registered pharmacies from Supabase:', error.message);
      return [];
    }

    if (!data) return [];

    return data
      .filter((p) => p.latitude != null && p.longitude != null)
      .map((p: any) => {
        const coords: Coords = { latitude: p.latitude, longitude: p.longitude };
        const dist = haversineKm(coordsBase, coords);
        const weeklyHours = (p.pharmacy_operating_hours && p.pharmacy_operating_hours.length > 0)
          ? p.pharmacy_operating_hours
          : null;

        const open = checkIsOpen(p.opening_time, p.closing_time, null, weeklyHours);

        const oTime = formatTimeHHMM(p.opening_time);
        const cTime = formatTimeHHMM(p.closing_time);
        let todayHoursStr = oTime && cTime ? `${oTime} - ${cTime}` : undefined;
        if (weeklyHours) {
          const todayRow = weeklyHours.find(
            (h: any) => (h.day || h.day_of_week)?.toLowerCase() === currentDayName.toLowerCase()
          );
          if (todayRow) {
            const isOpenToday = todayRow.isOpen !== undefined ? todayRow.isOpen : todayRow.is_open;
            if (isOpenToday === false) {
              todayHoursStr = 'Closed today';
            } else {
              const o = formatTimeHHMM(todayRow.opens || todayRow.opening_time || p.opening_time || '08:00');
              const c = formatTimeHHMM(todayRow.closes || todayRow.closing_time || p.closing_time || '20:00');
              todayHoursStr = `${o} - ${c}`;
            }
          }
        }

        const statusText = !open
          ? 'Closed'
          : todayHoursStr && todayHoursStr !== 'Closed today'
          ? `Open (${todayHoursStr})`
          : 'Open';

        return {
          id: p.id,
          name: p.name,
          address: p.address || 'Address registered in database',
          latitude: p.latitude,
          longitude: p.longitude,
          phone: p.phone || undefined,
          hours: todayHoursStr,
          statusText,
          distanceKm: Math.round(dist * 10) / 10,
          walkMinutes: Math.round((dist / 5) * 60),
          isRegistered: true,
          verified: p.verified ?? true,
          isOpen: open,
        };
      });
  } catch (e) {
    console.warn('Error fetching registered pharmacies:', e);
    return [];
  }
}

/**
 * Search nearby pharmacies using:
 * 1. Supabase database (Registered & verified partner pharmacies)
 * 2. Google Places API (New) (Live public pharmacies with real-time operating hours)
 * 3. Overpass API (OSM real-world open map fallback)
 */
export async function searchNearbyPharmacies(
  userCoords: Coords,
  radiusMeters = 10000,
  onItemFound?: (pharmacy: OsmPharmacy) => void,
  signal?: AbortSignal
): Promise<OsmPharmacy[]> {
  const coordsBase = userCoords || DEFAULT_COORDS;
  const { latitude: lat, longitude: lon } = coordsBase;

  const resultList: OsmPharmacy[] = [];
  const knownIds = new Set<string>();
  const knownNames = new Set<string>();

  // 1. Fetch registered database pharmacies from Supabase
  const registeredMeds = await getRegisteredPharmacies(coordsBase);
  const registeredPhones = new Set(registeredMeds.map((r) => r.phone).filter(Boolean));

  for (const reg of registeredMeds) {
    if (!knownIds.has(reg.id)) {
      knownIds.add(reg.id);
      knownNames.add(reg.name.toLowerCase().trim());
      resultList.push(reg);
      if (onItemFound) onItemFound(reg);
    }
  }

  // 2. Fetch live public pharmacies with real-time operating hours via Google Places API (New)
  try {
    const { searchGoogleNearbyPharmacies } = await import('./googlePlaces');
    const googlePharmacies = await searchGoogleNearbyPharmacies(coordsBase, radiusMeters, signal);

    for (const gPharm of googlePharmacies) {
      if (signal?.aborted) break;
      const cleanName = gPharm.name.toLowerCase().trim();
      if (
        !knownIds.has(gPharm.id) &&
        !knownNames.has(cleanName) &&
        (!gPharm.phone || !registeredPhones.has(gPharm.phone))
      ) {
        knownIds.add(gPharm.id);
        knownNames.add(cleanName);
        resultList.push(gPharm);
        if (onItemFound) onItemFound(gPharm);
      }
    }
  } catch (err: any) {
    if (err?.name !== 'AbortError') {
      console.warn('Google Places live search fallback:', err.message);
    }
  }

  // 3. Supplemental live OSM map locations via Overpass API (if Google returns few or for open-map coverage)
  if (resultList.length < 5 && !signal?.aborted) {
    const query = `[out:json][timeout:10];(node["amenity"="pharmacy"](around:${radiusMeters},${lat},${lon});way["amenity"="pharmacy"](around:${radiusMeters},${lat},${lon});node["healthcare"="pharmacy"](around:${radiusMeters},${lat},${lon});way["healthcare"="pharmacy"](around:${radiusMeters},${lat},${lon}););out center;`;

    const endpoints = [
      `https://places.googleapis.com/v1/places:searchNearby`, // proxy guard
      `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`,
      `https://lz4.overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`,
      `https://z.overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`,
      `https://overpass.kumi.systems/api/interpreter?data=${encodeURIComponent(query)}`,
    ].slice(1);

    for (const url of endpoints) {
      if (signal?.aborted) break;
      const fetchController = new AbortController();
      const timeoutId = setTimeout(() => fetchController.abort(), 8000);

      try {
        const res = await fetch(url, {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'PharmFindrApp/1.0',
          },
          signal: fetchController.signal,
        });
        clearTimeout(timeoutId);

        if (res && res.ok) {
          const json = await res.json();
          const elements: any[] = json.elements ?? [];

          for (const el of elements) {
            if (signal?.aborted) break;
            const elLat = el.lat ?? el.center?.lat;
            const elLon = el.lon ?? el.center?.lon;
            if (elLat == null || elLon == null) continue;

            const tags: Record<string, string> = el.tags ?? {};
            const phone = tags['phone'] ?? tags['contact:phone'];
            if (phone && registeredPhones.has(phone)) continue;

            const itemId = `osm-${el.type || 'node'}-${el.id}`;
            const name = tags['name'] ?? tags['brand'] ?? tags['operator'] ?? 'Public Pharmacy';
            const cleanName = name.toLowerCase().trim();

            if (knownIds.has(itemId) || knownNames.has(cleanName)) continue;

            const pharmacyCoords: Coords = { latitude: elLat, longitude: elLon };
            const distanceKm = haversineKm(coordsBase, pharmacyCoords);

            const open = checkIsOpen(null, null, tags['opening_hours']);
            const item: OsmPharmacy = {
              id: itemId,
              name,
              address: buildAddress(tags),
              latitude: elLat,
              longitude: elLon,
              phone,
              hours: tags['opening_hours'] ?? undefined,
              distanceKm: Math.round(distanceKm * 10) / 10,
              walkMinutes: Math.round((distanceKm / 5) * 60),
              isRegistered: false,
              isOpen: open,
            };

            knownIds.add(itemId);
            knownNames.add(cleanName);
            resultList.push(item);
            if (onItemFound) onItemFound(item);
          }
          break;
        }
      } catch {
        clearTimeout(timeoutId);
      }
    }
  }

  resultList.sort((a, b) => a.distanceKm - b.distanceKm);
  return resultList;
}
