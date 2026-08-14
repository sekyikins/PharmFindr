import { DEFAULT_COORDS, type Coords } from './location';
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
  isVerified: boolean;
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
    ? currentMin >= openMin && currentMin < closeMin
    : currentMin >= openMin || currentMin < closeMin;
}

/**
 * Normalizes pharmacy names for fuzzy duplicate comparison.
 * Removes common variations like 'pharmacy', 'chemist', 'ltd', 'limited', etc.
 */
export function normalizePharmacyName(name?: string | null): string {
  if (!name) return '';
  return name
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\b(pharmacy|chemist|chemists|drugstore|limited|ltd|ghana|gh|branch|store|enterprise|ent)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Normalizes phone numbers by stripping non-digit characters and extracting the last 9 digits.
 */
export function normalizePhoneNumber(phone?: string | null): string {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  return digits.length >= 9 ? digits.slice(-9) : digits;
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
 * Multi-criteria pharmacy deduplication matcher:
 * 1. Phone number match (normalized Ghana phone)
 * 2. Exact/tight geographic proximity (distance <= 60m)
 * 3. Normalized name token overlap + spatial proximity (distance <= 300m)
 */
export function isDuplicatePharmacy(
  candidate: { latitude: number; longitude: number; name?: string; phone?: string },
  existing: OsmPharmacy
): boolean {
  // 1. Direct phone match
  const candPhone = normalizePhoneNumber(candidate.phone);
  const existPhone = normalizePhoneNumber(existing.phone);
  if (candPhone && existPhone && candPhone.length >= 9 && candPhone === existPhone) {
    return true;
  }

  const distKm = haversineKm(
    { latitude: candidate.latitude, longitude: candidate.longitude },
    { latitude: existing.latitude, longitude: existing.longitude }
  );

  // 2. Physical location identical (< 60 meters / 0.06 km)
  if (distKm <= 0.06) {
    return true;
  }

  // 3. Name match/overlap + close proximity (< 300 meters / 0.30 km)
  if (distKm <= 0.30) {
    const candNorm = normalizePharmacyName(candidate.name);
    const existNorm = normalizePharmacyName(existing.name);
    if (candNorm && existNorm) {
      if (candNorm === existNorm || candNorm.includes(existNorm) || existNorm.includes(candNorm)) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Evaluate whether opening hours indicate the pharmacy is open now.
 * Returns true if open, false if closed, or undefined if unknown.
 */
export function checkIsOpen(
  openingTime?: string | null,
  closingTime?: string | null,
  rawHours?: string | null,
  operatingHours?: any[] | null
): boolean | undefined {
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
        return isOpenFlag !== undefined ? Boolean(isOpenFlag) : true;
      }
      return false; // If schedule defined but today is omitted, pharmacy is closed today
    }

    // 2. Check default opening_time & closing_time
    if (openingTime || closingTime) {
      const openMin = parseTimeMinutes(openingTime || '08:00');
      const closeMin = parseTimeMinutes(closingTime || '20:00');
      if (openMin !== null && closeMin !== null) {
        return isTimeWithin(openMin, closeMin, currentMin);
      }
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
  } catch {
    // fallback
  }

  // When no hours information is available, return undefined (unknown)
  return undefined;
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
      .select('id, name, address, phone, latitude, longitude, opening_time, closing_time, is_verified, pharmacy_operating_hours(day_of_week, is_open, opening_time, closing_time)');

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

        const statusText = open === false
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
          distanceKm: Math.round(dist * 1000) / 1000,
          walkMinutes: Math.max(1, Math.round((dist / 5) * 60)),
          isVerified: (p.is_verified ?? p.verified) ?? true,
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
 * 2. Google Places API (Live public pharmacies with real-time operating hours)
 * 3. Overpass API (OSM real-world open map fallback)
 *
 * Implements robust multi-criteria deduplication to ensure registered partner
 * pharmacies take precedence and are never duplicated by overlapping public markers.
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

  // 1. Fetch registered database pharmacies from Supabase
  const registeredMeds = await getRegisteredPharmacies(coordsBase);
  for (const reg of registeredMeds) {
    resultList.push(reg);
    if (onItemFound) onItemFound(reg);
  }

  let publicFound = 0;

  // 2. Fetch live public pharmacies with real-time operating hours via Google Places API
  try {
    const { searchGoogleNearbyPharmacies } = await import('./googlePlaces');
    const googlePharmacies = await searchGoogleNearbyPharmacies(coordsBase, radiusMeters, signal);

    for (const gPharm of googlePharmacies) {
      if (signal?.aborted) break;

      // Check if gPharm duplicates an existing registered or previously found pharmacy
      const dupIdx = resultList.findIndex((p) => isDuplicatePharmacy(gPharm, p));
      if (dupIdx !== -1) {
        const existing = resultList[dupIdx];
        if (existing.isVerified) {
          // Enrich registered pharmacy with Google live hours if database hours were blank
          if (!existing.hours || existing.hours === 'N/A') {
            existing.hours = gPharm.hours;
            existing.weeklyHours = gPharm.weeklyHours;
            existing.statusText = gPharm.statusText;
            existing.nextCloseTime = gPharm.nextCloseTime;
            existing.nextOpenTime = gPharm.nextOpenTime;
            if (gPharm.isOpen !== undefined) {
              existing.isOpen = gPharm.isOpen;
            }
          }
        }
        continue;
      }

      resultList.push(gPharm);
      publicFound++;
      if (onItemFound) onItemFound(gPharm);
    }
  } catch (err: any) {
    if (err?.name !== 'AbortError') {
      console.warn('Google Places live search fallback:', err.message);
    }
  }

  // 3. Supplemental live OSM map locations via Overpass API
  if (publicFound < 15 && !signal?.aborted) {
    const query = `[out:json][timeout:10];(node["amenity"="pharmacy"](around:${radiusMeters},${lat},${lon});way["amenity"="pharmacy"](around:${radiusMeters},${lat},${lon});node["healthcare"="pharmacy"](around:${radiusMeters},${lat},${lon});way["healthcare"="pharmacy"](around:${radiusMeters},${lat},${lon}););out center;`;

    const endpoints = [
      `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`,
      `https://lz4.overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`,
      `https://z.overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`,
      `https://overpass.kumi.systems/api/interpreter?data=${encodeURIComponent(query)}`,
    ];

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
            const name = tags['name'] ?? tags['brand'] ?? tags['operator'] ?? 'Public Pharmacy';
            const pharmacyCoords: Coords = { latitude: elLat, longitude: elLon };

            const cand = { latitude: elLat, longitude: elLon, name, phone };
            const isDup = resultList.some((p) => isDuplicatePharmacy(cand, p));
            if (isDup) continue;

            const distanceKm = haversineKm(coordsBase, pharmacyCoords);
            const open = checkIsOpen(null, null, tags['opening_hours']);
            const item: OsmPharmacy = {
              id: `osm-${el.type || 'node'}-${el.id}`,
              name,
              address: buildAddress(tags),
              latitude: elLat,
              longitude: elLon,
              phone,
              hours: tags['opening_hours'] ?? undefined,
              statusText: open === false ? 'Closed' : open === true ? 'Open' : 'Public Map Location',
              distanceKm: Math.round(distanceKm * 1000) / 1000,
              walkMinutes: Math.max(1, Math.round((distanceKm / 5) * 60)),
              isVerified: false,
              isOpen: open,
            };

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
