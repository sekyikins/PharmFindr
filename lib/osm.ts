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
  distanceKm: number;
  walkMinutes: number;
  isRegistered?: boolean;
  isOpen?: boolean;
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

    // 1. Check detailed weekly schedule array
    if (operatingHours && Array.isArray(operatingHours) && operatingHours.length > 0) {
      const todaySchedule = operatingHours.find(
        (item: any) => item.day?.toLowerCase() === currentDayName.toLowerCase()
      );
      if (todaySchedule) {
        if (!todaySchedule.isOpen) return false;
        const openMin = parseTimeMinutes(todaySchedule.opens);
        const closeMin = parseTimeMinutes(todaySchedule.closes);
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
 * Fetch registered pharmacies from Supabase database.
 */
export async function getRegisteredPharmacies(userCoords?: Coords | null): Promise<OsmPharmacy[]> {
  const coordsBase = userCoords || DEFAULT_COORDS;
  try {
    const { data, error } = await supabase
      .from('pharmacies')
      .select('id, name, address, phone, latitude, longitude, opening_time, closing_time, operating_hours');

    if (error || !data) return [];

    return data
      .filter((p) => p.latitude != null && p.longitude != null)
      .map((p: any) => {
        const coords: Coords = { latitude: p.latitude, longitude: p.longitude };
        const dist = haversineKm(coordsBase, coords);
        const open = checkIsOpen(p.opening_time, p.closing_time, null, p.operating_hours);
        return {
          id: p.id,
          name: p.name,
          address: p.address || 'Address registered in database',
          latitude: p.latitude,
          longitude: p.longitude,
          phone: p.phone || undefined,
          hours: p.opening_time && p.closing_time ? `${p.opening_time} - ${p.closing_time}` : undefined,
          distanceKm: Math.round(dist * 10) / 10,
          walkMinutes: Math.round((dist / 5) * 60),
          isRegistered: true,
          isOpen: open,
        };
      });
  } catch (e) {
    console.warn('Error fetching registered pharmacies:', e);
    return [];
  }
}

/**
 * Search nearby pharmacies using live Overpass API (OSM real-world data) + Supabase database.
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

  // 1. Fetch registered database pharmacies from Supabase
  const registeredMeds = await getRegisteredPharmacies(coordsBase);
  const registeredPhones = new Set(registeredMeds.map((r) => r.phone).filter(Boolean));

  for (const reg of registeredMeds) {
    if (!knownIds.has(reg.id)) {
      knownIds.add(reg.id);
      resultList.push(reg);
      if (onItemFound) onItemFound(reg);
    }
  }

  // 2. Fetch live real-world public map locations via Overpass API
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
          if (phone && registeredPhones.has(phone)) continue;

          const itemId = `osm-${el.type || 'node'}-${el.id}`;
          if (knownIds.has(itemId)) continue;

          const pharmacyCoords: Coords = { latitude: elLat, longitude: elLon };
          const distanceKm = haversineKm(coordsBase, pharmacyCoords);

          const open = checkIsOpen(null, null, tags['opening_hours']);
          const item: OsmPharmacy = {
            id: itemId,
            name: tags['name'] ?? tags['brand'] ?? tags['operator'] ?? 'Public Pharmacy',
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
          resultList.push(item);
          if (onItemFound) onItemFound(item);
        }
        break; // Successfully fetched live OSM map data!
      }
    } catch {
      clearTimeout(timeoutId);
    }
  }

  resultList.sort((a, b) => a.distanceKm - b.distanceKm);
  return resultList;
}
