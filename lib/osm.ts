import { type Coords } from './location';
import { supabase } from './supabase';
import type {
  DiscoveredPharmacy,
  OsmPharmacy,
  MapBounds,
  MapRegion,
  WeeklyScheduleDay,
} from '@/types/map';

export type { DiscoveredPharmacy, OsmPharmacy };

/**
 * Validate finite geographic coordinates.
 */
export function isValidCoordinate(lat: unknown, lon: unknown): lat is number {
  return (
    typeof lat === 'number' &&
    typeof lon === 'number' &&
    Number.isFinite(lat) &&
    Number.isFinite(lon) &&
    lat >= -90 &&
    lat <= 90 &&
    lon >= -180 &&
    lon <= 180
  );
}

/**
 * Validate a non-empty, finite map region.
 */
export function isValidRegion(region: unknown): region is MapRegion {
  if (!region || typeof region !== 'object') return false;
  const r = region as MapRegion;
  return (
    typeof r.latitude === 'number' &&
    Number.isFinite(r.latitude) &&
    typeof r.longitude === 'number' &&
    Number.isFinite(r.longitude) &&
    typeof r.latitudeDelta === 'number' &&
    Number.isFinite(r.latitudeDelta) &&
    r.latitudeDelta > 0 &&
    typeof r.longitudeDelta === 'number' &&
    Number.isFinite(r.longitudeDelta) &&
    r.longitudeDelta > 0
  );
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
    const hNum = parseInt(h, 10);
    if (ampm) {
      return `${hNum}:${m} ${ampm.toUpperCase()}`;
    }
    const hStr = String(hNum).padStart(2, '0');
    return `${hStr}:${m}`;
  }
  return clean;
}

export function parseTimeMinutes(timeStr?: string | null): number | null {
  if (!timeStr) return null;
  const clean = timeStr.trim().toLowerCase();

  if (clean === '24:00' || clean === '24:00:00') return 1440;
  if (clean === '23:59' || clean === '23:59:00') return 1439;

  const match = clean.match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(am|pm)?$/i);
  if (match) {
    let [, hStr, mStr, ampm] = match;
    let h = parseInt(hStr, 10);
    const m = parseInt(mStr, 10) || 0;
    if (ampm) {
      if (ampm.toLowerCase() === 'pm' && h < 12) h += 12;
      if (ampm.toLowerCase() === 'am' && h === 12) h = 0;
    }
    return h * 60 + m;
  }

  const [h, m] = clean.split(':').map(Number);
  return !isNaN(h) ? h * 60 + (m || 0) : null;
}

/**
 * Checks if current minute falls within [openMin, closeMin).
 * Correctly supports 24-hour schedules and overnight schedules (e.g. 20:00 - 02:00).
 */
export function isTimeWithinRange(openMin: number, closeMin: number, currentMin: number): boolean {
  if (openMin === 0 && (closeMin === 1440 || closeMin === 1439 || closeMin === 0)) {
    return true; // 24-hour open
  }
  if (closeMin > openMin) {
    // Normal same-day schedule
    return currentMin >= openMin && currentMin < closeMin;
  }
  if (closeMin < openMin) {
    // Overnight schedule (e.g. 20:00 -> 02:00)
    return currentMin >= openMin || currentMin < closeMin;
  }
  return true;
}

/**
 * Normalizes pharmacy names for comparison across providers.
 * Removes common generic descriptors while preserving distinctive tokens.
 */
export function normalizePharmacyName(name?: string | null): string {
  if (!name) return '';
  return name
    .toLowerCase()
    .replace(/['’`]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\b(pharmacy|chemist|chemists|drugstore|limited|ltd|inc|corp|co|store|enterprise|ent|apotheke|farmacia|pharmacie)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Extracts distinctive tokens (excluding common stop words and short particles).
 */
export function extractDistinctiveTokens(normalizedName: string): Set<string> {
  const common = new Set(['and', 'the', 'for', 'at', 'in', 'of', 'on', 'st', 'nd', 'rd', 'th']);
  const tokens = normalizedName.split(/\s+/).filter((t) => t.length >= 3 && !common.has(t));
  return new Set(tokens);
}

/**
 * Normalizes phone number into international digit string or clean national string.
 */
export function normalizePhoneNumber(phone?: string | null): string {
  if (!phone) return '';
  let clean = phone.trim().replace(/[^\d+]/g, '');
  if (clean.startsWith('+')) {
    clean = clean.slice(1);
  } else if (clean.startsWith('00')) {
    clean = clean.slice(2);
  }
  return clean;
}

/**
 * Safe provider-aware phone comparison that handles national leading '0' vs international country prefix.
 * Avoids false positive collisions between different international numbers sharing final digits.
 */
export function isSamePhoneNumber(phoneA?: string | null, phoneB?: string | null): boolean {
  if (!phoneA || !phoneB) return false;
  const a = normalizePhoneNumber(phoneA);
  const b = normalizePhoneNumber(phoneB);
  if (!a || !b || a.length < 7 || b.length < 7) return false;

  // Exact digit match
  if (a === b) return true;

  // Handle local vs international prefix: e.g. "0241234567" vs "233241234567"
  const aNoZero = a.startsWith('0') ? a.slice(1) : a;
  const bNoZero = b.startsWith('0') ? b.slice(1) : b;

  if (aNoZero === bNoZero && aNoZero.length >= 7) return true;

  if (a.startsWith('0') && !b.startsWith('0') && aNoZero.length >= 7) {
    if (b.endsWith(aNoZero) && b.length <= aNoZero.length + 3) return true;
  }
  if (b.startsWith('0') && !a.startsWith('0') && bNoZero.length >= 7) {
    if (a.endsWith(bNoZero) && a.length <= bNoZero.length + 3) return true;
  }

  return false;
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
 * Known location/branch differentiator keywords.
 * When two records differ by one having a branch qualifier and the other lacking it, they must NOT be merged.
 */
const BRANCH_QUALIFIERS = new Set([
  'east', 'west', 'north', 'south', 'central', 'main', 'branch',
  'airport', 'junction', 'station', 'market', 'mall', 'plaza', 'circle',
  'terminal', 'hospital', 'clinic', 'campus', 'ridge', 'annex', 'centre',
]);

/**
 * Conservative pharmacy deduplication matcher:
 * Prioritizes maximum coverage; if uncertain whether two records represent the same physical store, KEEP BOTH.
 *
 * 1. Google Place ID exact match
 * 2. Exact phone number match (provider-aware)
 * 3. Exact normalized name match + close proximity (<= 500m)
 * 4. Token-based overlap requiring identical distinctive tokens + tight proximity (<= 200m)
 *
 * Proximity alone is NEVER used as definitive proof to merge distinct physical stores.
 */
export function isDuplicatePharmacy(
  candidate: { latitude: number; longitude: number; name?: string; phone?: string; googlePlaceId?: string },
  existing: DiscoveredPharmacy
): boolean {
  // 1. Exact ID or Google Place ID match
  if ((candidate as any).id && existing.id && (candidate as any).id === existing.id) {
    return true;
  }
  if (candidate.googlePlaceId && existing.googlePlaceId && candidate.googlePlaceId === existing.googlePlaceId) {
    return true;
  }

  // 2. Direct phone match
  if (isSamePhoneNumber(candidate.phone, existing.phone)) {
    return true;
  }

  const distKm = haversineKm(
    { latitude: candidate.latitude, longitude: candidate.longitude },
    { latitude: existing.latitude, longitude: existing.longitude }
  );

  const candNorm = normalizePharmacyName(candidate.name);
  const existNorm = normalizePharmacyName(existing.name);

  if (!candNorm || !existNorm) return false;

  // 3. Exact normalized name match within 500m
  if (candNorm === existNorm && distKm <= 0.5) {
    return true;
  }

  // 4. Token-based overlap within 200m
  if (distKm <= 0.2) {
    const candTokens = extractDistinctiveTokens(candNorm);
    const existTokens = extractDistinctiveTokens(existNorm);

    if (candTokens.size >= 2 && existTokens.size >= 2) {
      // Check for branch qualifier differences
      for (const token of candTokens) {
        if (BRANCH_QUALIFIERS.has(token) && !existTokens.has(token)) return false;
      }
      for (const token of existTokens) {
        if (BRANCH_QUALIFIERS.has(token) && !candTokens.has(token)) return false;
      }

      // Check if tokens are identical
      if (candTokens.size === existTokens.size) {
        let allMatch = true;
        for (const token of candTokens) {
          if (!existTokens.has(token)) {
            allMatch = false;
            break;
          }
        }
        if (allMatch) return true;
      }
    }
  }

  return false;
}

/**
 * Merges incoming discovered pharmacies into an existing pharmacy list.
 * Preserves Supabase entity authority, enriches missing fields, and retains all unique records.
 */
export function mergeDiscoveredPharmacies(
  existingList: DiscoveredPharmacy[],
  incomingList: DiscoveredPharmacy[]
): DiscoveredPharmacy[] {
  const merged = [...existingList];

  for (const incoming of incomingList) {
    const dupIdx = merged.findIndex((p) => isDuplicatePharmacy(incoming, p));
    if (dupIdx !== -1) {
      const existing = merged[dupIdx];
      if (existing.source === 'supabase') {
        // Supabase is authoritative entity
        if (!existing.hours || existing.hours === 'N/A') {
          if (incoming.hours && incoming.hours !== 'N/A') existing.hours = incoming.hours;
          if (incoming.weeklyHours) existing.weeklyHours = incoming.weeklyHours;
          if (incoming.weeklySchedule) existing.weeklySchedule = incoming.weeklySchedule;
          if (incoming.statusText) existing.statusText = incoming.statusText;
          if (incoming.nextCloseTime) existing.nextCloseTime = incoming.nextCloseTime;
          if (incoming.nextOpenTime) existing.nextOpenTime = incoming.nextOpenTime;
          if (incoming.isOpen !== undefined) existing.isOpen = incoming.isOpen;
        }
        if (!existing.phone && incoming.phone) existing.phone = incoming.phone;
        if (!existing.googlePlaceId && incoming.googlePlaceId) existing.googlePlaceId = incoming.googlePlaceId;
      } else if (existing.source === 'google') {
        if (incoming.source === 'supabase') {
          // Upgrade to Supabase entity while retaining Google live details
          merged[dupIdx] = {
            ...incoming,
            hours: incoming.hours || existing.hours,
            weeklyHours: incoming.weeklyHours || existing.weeklyHours,
            weeklySchedule: incoming.weeklySchedule || existing.weeklySchedule,
            statusText: incoming.statusText || existing.statusText,
            nextCloseTime: incoming.nextCloseTime || existing.nextCloseTime,
            nextOpenTime: incoming.nextOpenTime || existing.nextOpenTime,
            isOpen: incoming.isOpen !== undefined ? incoming.isOpen : existing.isOpen,
            phone: incoming.phone || existing.phone,
            googlePlaceId: incoming.googlePlaceId || existing.googlePlaceId,
          };
        } else {
          // Enrich missing phone or hours from incoming
          if (!existing.phone && incoming.phone) existing.phone = incoming.phone;
          if (!existing.hours && incoming.hours) existing.hours = incoming.hours;
        }
      } else if (existing.source === 'osm') {
        if (incoming.source === 'supabase' || incoming.source === 'google') {
          // Upgrade to authoritative Supabase/Google entity
          merged[dupIdx] = {
            ...incoming,
            hours: incoming.hours || existing.hours,
            phone: incoming.phone || existing.phone,
          };
        }
      }
      continue;
    }

    // Unique pharmacy -> add to accumulated collection
    merged.push(incoming);
  }

  return merged;
}

/**
 * Evaluate whether operating hours indicate the pharmacy is open right now.
 * Supports timezone offset when available.
 * Returns true if open, false if closed, or undefined if unknown.
 */
export function checkIsOpen(
  openingTime?: string | null,
  closingTime?: string | null,
  rawHours?: string | null,
  operatingHours?: any[] | null,
  utcOffsetMinutes?: number
): boolean | undefined {
  try {
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    let currentDayName: string;
    let currentMin: number;

    if (utcOffsetMinutes !== undefined && !isNaN(utcOffsetMinutes)) {
      const targetDate = new Date(Date.now() + utcOffsetMinutes * 60000);
      currentDayName = dayNames[targetDate.getUTCDay()];
      currentMin = targetDate.getUTCHours() * 60 + targetDate.getUTCMinutes();
    } else {
      const now = new Date();
      currentDayName = dayNames[now.getDay()];
      currentMin = now.getHours() * 60 + now.getMinutes();
    }

    // 1. Check raw hours string for explicit 24h / closed keywords
    if (rawHours) {
      if (/24\s*hours|24\/7|open 24/i.test(rawHours)) return true;
      if (/off|closed/i.test(rawHours)) return false;
      const match = rawHours.match(/(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/);
      if (match) {
        const oMin = parseInt(match[1], 10) * 60 + parseInt(match[2], 10);
        const cMin = parseInt(match[3], 10) * 60 + parseInt(match[4], 10);
        return isTimeWithinRange(oMin, cMin, currentMin);
      }
    }

    // 2. Check detailed weekly schedule array
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
          return isTimeWithinRange(openMin, closeMin, currentMin);
        }
        return isOpenFlag !== undefined ? Boolean(isOpenFlag) : true;
      }
      return false;
    }

    // 3. Check default opening_time & closing_time
    if (openingTime || closingTime) {
      const openMin = parseTimeMinutes(openingTime || '08:00');
      const closeMin = parseTimeMinutes(closingTime || '20:00');
      if (openMin !== null && closeMin !== null) {
        return isTimeWithinRange(openMin, closeMin, currentMin);
      }
    }
  } catch {
    // fallback
  }

  return undefined;
}

/**
 * Build human-readable address from OSM tags.
 */
function buildAddress(tags: Record<string, string>): string {
  const parts: string[] = [];
  if (tags['addr:housenumber'] && tags['addr:street']) {
    parts.push(`${tags['addr:housenumber']} ${tags['addr:street']}`);
  } else if (tags['addr:street']) {
    parts.push(tags['addr:street']);
  }
  if (tags['addr:city']) parts.push(tags['addr:city']);
  if (tags['addr:country']) parts.push(tags['addr:country']);
  return parts.length > 0 ? parts.join(', ') : 'Public Map Address';
}

/**
 * Fetch registered partner pharmacies from Supabase.
 * If spatial bounds are provided, filters by viewport on the database level.
 */
export async function getRegisteredPharmacies(
  bounds?: MapBounds | null,
  userCoords?: Coords | null,
  signal?: AbortSignal
): Promise<DiscoveredPharmacy[]> {
  const now = new Date();
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const currentDayName = dayNames[now.getDay()];
  const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  try {
    let query = supabase
      .from('pharmacies')
      .select('id, name, address, phone, email, latitude, longitude, opening_time, closing_time, is_verified, pharmacy_operating_hours(day_of_week, is_open, opening_time, closing_time)');

    if (bounds) {
      query = query
        .gte('latitude', bounds.south)
        .lte('latitude', bounds.north)
        .gte('longitude', bounds.west)
        .lte('longitude', bounds.east);
    }

    if (signal?.aborted) return [];

    const { data, error } = await query;

    if (error) {
      console.warn('Error fetching registered pharmacies from Supabase:', error.message);
      return [];
    }

    if (!data) return [];

    return data
      .filter((p) => p.latitude != null && p.longitude != null && isValidCoordinate(p.latitude, p.longitude))
      .map((p: any) => {
        const coords: Coords = { latitude: p.latitude, longitude: p.longitude };
        const distKm = userCoords ? haversineKm(userCoords, coords) : undefined;
        const rawHoursList = (p.pharmacy_operating_hours && Array.isArray(p.pharmacy_operating_hours) && p.pharmacy_operating_hours.length > 0)
          ? p.pharmacy_operating_hours
          : null;

        const open = checkIsOpen(p.opening_time, p.closing_time, null, rawHoursList);

        // Build structured weekly schedule & weekday descriptions
        const weeklySchedule: WeeklyScheduleDay[] = DAYS.map((d) => {
          const row = (rawHoursList || []).find(
            (h: any) => h.day_of_week?.toLowerCase() === d.toLowerCase()
          );
          if (!row) {
            return { day: d, isOpen: null, opens: '', closes: '', isUnknown: true };
          }
          const o = row.opening_time ? formatTimeHHMM(row.opening_time) : '';
          const c = row.closing_time ? formatTimeHHMM(row.closing_time) : '';
          return {
            day: d,
            isOpen: row.is_open ?? (o && c ? true : false),
            opens: o,
            closes: c,
          };
        });

        const weeklyHours: string[] = weeklySchedule.map((s) => {
          if (s.isUnknown || s.isOpen === null) return `${s.day}: Hours unavailable`;
          if (s.isOpen === false) return `${s.day}: Closed`;
          if (s.opens && s.closes) return `${s.day}: ${s.opens} – ${s.closes}`;
          return `${s.day}: Open`;
        });

        const oTime = formatTimeHHMM(p.opening_time);
        const cTime = formatTimeHHMM(p.closing_time);
        let todayHoursStr = oTime && cTime ? `${oTime} - ${cTime}` : undefined;
        if (rawHoursList) {
          const todayRow = rawHoursList.find(
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

        let statusText = 'Open';
        if (open === false) {
          statusText = todayHoursStr === 'Closed today' ? 'Closed today' : 'Closed';
        } else if (open === true) {
          statusText = todayHoursStr && /24\s*hours/i.test(todayHoursStr) ? 'Open 24 Hours' : 'Open';
        } else {
          statusText = todayHoursStr ? 'Open' : 'Public Map Location';
        }

        return {
          id: p.id,
          name: p.name,
          address: p.address || 'Address registered in database',
          latitude: p.latitude,
          longitude: p.longitude,
          phone: p.phone || undefined,
          email: p.email || undefined,
          hours: todayHoursStr,
          weeklyHours,
          weeklySchedule,
          statusText,
          distanceKm: distKm !== undefined ? Math.round(distKm * 1000) / 1000 : undefined,
          walkMinutes: distKm !== undefined ? Math.max(1, Math.round((distKm / 5) * 60)) : undefined,
          isVerified: (p.is_verified ?? p.verified) ?? true,
          isOpen: open,
          source: 'supabase' as const,
        };
      });
  } catch (e) {
    console.warn('Error fetching registered pharmacies:', e);
    return [];
  }
}

/**
 * OSM / Overpass fetcher for a given geographic region.
 * Serves as a complementary discovery provider alongside Google Places and Supabase.
 * Respects both caller cancellation and per-request endpoint timeout.
 */
export async function fetchOsmPharmacies(
  region: MapRegion,
  userCoords?: Coords | null,
  signal?: AbortSignal
): Promise<DiscoveredPharmacy[]> {
  if (signal?.aborted || !isValidRegion(region)) return [];

  const { latitude: lat, longitude: lon, latitudeDelta, longitudeDelta } = region;
  const latSpanKm = Math.abs(latitudeDelta) * 2.0 * 111;
  const clampedLat = Math.min(85, Math.max(-85, lat));
  const lonSpanKm = Math.abs(longitudeDelta) * 2.0 * 111 * Math.cos((clampedLat * Math.PI) / 180);
  const radiusMeters = Math.max(4000, Math.min(50000, Math.round((Math.sqrt(latSpanKm ** 2 + lonSpanKm ** 2) / 2) * 1000)));

  const query = `[out:json][timeout:10];(node["amenity"="pharmacy"](around:${radiusMeters},${lat},${lon});way["amenity"="pharmacy"](around:${radiusMeters},${lat},${lon});node["healthcare"="pharmacy"](around:${radiusMeters},${lat},${lon});way["healthcare"="pharmacy"](around:${radiusMeters},${lat},${lon}););out center;`;

  const endpoints = [
    `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`,
    `https://lz4.overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`,
    `https://z.overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`,
    `https://overpass.kumi.systems/api/interpreter?data=${encodeURIComponent(query)}`,
  ];

  for (const url of endpoints) {
    if (signal?.aborted) return [];

    const fetchController = new AbortController();
    const timeoutId = setTimeout(() => fetchController.abort(), 8000);

    const onCallerAbort = () => fetchController.abort();
    if (signal) {
      signal.addEventListener('abort', onCallerAbort, { once: true });
    }

    try {
      const res = await fetch(url, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          'User-Agent': 'PharmFindrApp/1.0',
        },
        signal: fetchController.signal,
      });

      if (res && res.ok) {
        let json: any;
        try {
          json = await res.json();
        } catch {
          // Malformed JSON on this endpoint, continue to next endpoint
          continue;
        }

        const elements: any[] = Array.isArray(json?.elements) ? json.elements : [];
        const results: DiscoveredPharmacy[] = [];
        const seenOsmIds = new Set<string>();

        for (const el of elements) {
          if (signal?.aborted) return [];
          const elLat = el.lat ?? el.center?.lat;
          const elLon = el.lon ?? el.center?.lon;
          if (!isValidCoordinate(elLat, elLon)) continue;

          const osmId = `osm-${el.type || 'node'}-${el.id}`;
          if (seenOsmIds.has(osmId)) continue;
          seenOsmIds.add(osmId);

          const tags: Record<string, string> = el.tags ?? {};
          const phone = tags['phone'] ?? tags['contact:phone'];
          const name = tags['name'] ?? tags['brand'] ?? tags['operator'] ?? 'Public Pharmacy';
          const pharmacyCoords: Coords = { latitude: elLat, longitude: elLon };
          const distKm = userCoords ? haversineKm(userCoords, pharmacyCoords) : undefined;
          const open = checkIsOpen(null, null, tags['opening_hours']);

          results.push({
            id: osmId,
            name,
            address: buildAddress(tags),
            latitude: elLat,
            longitude: elLon,
            phone,
            hours: tags['opening_hours'] ?? undefined,
            statusText: open === false ? 'Closed' : open === true ? 'Open' : 'Public Map Location',
            distanceKm: distKm !== undefined ? Math.round(distKm * 1000) / 1000 : undefined,
            walkMinutes: distKm !== undefined ? Math.max(1, Math.round((distKm / 5) * 60)) : undefined,
            isVerified: false,
            isOpen: open,
            source: 'osm' as const,
          });
        }

        return results;
      }
    } catch {
      if (signal?.aborted) return [];
      // Endpoint error or timeout, continue to next fallback endpoint
    } finally {
      clearTimeout(timeoutId);
      if (signal) {
        signal.removeEventListener('abort', onCallerAbort);
      }
    }
  }

  return [];
}

/**
 * Backward compatibility alias for fetchOsmPharmacies.
 */
export const fetchOsmPharmaciesFallback = fetchOsmPharmacies;

export { searchNearbyPharmacies } from './pharmacyDiscovery';
