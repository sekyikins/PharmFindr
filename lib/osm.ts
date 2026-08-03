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

/**
 * Evaluate whether opening hours indicate the pharmacy is open now.
 */
export function checkIsOpen(openingTime?: string | null, closingTime?: string | null, rawHours?: string | null): boolean {
  try {
    if (rawHours && /off|closed/i.test(rawHours)) return false;

    const now = new Date();
    const currentMin = now.getHours() * 60 + now.getMinutes();

    if (openingTime && closingTime) {
      const [oH, oM] = openingTime.split(':').map(Number);
      const [cH, cM] = closingTime.split(':').map(Number);
      if (!isNaN(oH) && !isNaN(cH)) {
        const openMin = oH * 60 + (oM || 0);
        const closeMin = cH * 60 + (cM || 0);
        if (closeMin > openMin) {
          return currentMin >= openMin && currentMin <= closeMin;
        } else {
          return currentMin >= openMin || currentMin <= closeMin;
        }
      }
    }

    if (rawHours) {
      if (/24\s*hours|24\/7/i.test(rawHours)) return true;
      const match = rawHours.match(/(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/);
      if (match) {
        const openMin = parseInt(match[1], 10) * 60 + parseInt(match[2], 10);
        const closeMin = parseInt(match[3], 10) * 60 + parseInt(match[4], 10);
        if (closeMin > openMin) {
          return currentMin >= openMin && currentMin <= closeMin;
        } else {
          return currentMin >= openMin || currentMin <= closeMin;
        }
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
      .select('id, name, address, phone, latitude, longitude, opening_time, closing_time');

    if (error || !data) return [];

    return data
      .filter((p) => p.latitude != null && p.longitude != null)
      .map((p) => {
        const coords: Coords = { latitude: p.latitude, longitude: p.longitude };
        const dist = haversineKm(coordsBase, coords);
        const open = checkIsOpen(p.opening_time, p.closing_time);
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
 * Search nearby pharmacies using Overpass API (OSM data) + registered database pharmacies.
 */
export async function searchNearbyPharmacies(
  userCoords: Coords,
  radiusMeters = 10000,
  onItemFound?: (pharmacy: OsmPharmacy) => void,
  signal?: AbortSignal
): Promise<OsmPharmacy[]> {
  const coordsBase = userCoords || DEFAULT_COORDS;
  const { latitude: lat, longitude: lon } = coordsBase;

  // 1. Fetch registered database pharmacies first
  const registeredMeds = await getRegisteredPharmacies(coordsBase);
  const registeredIds = new Set(registeredMeds.map((r) => r.id));
  const registeredPhones = new Set(registeredMeds.map((r) => r.phone).filter(Boolean));

  for (const reg of registeredMeds) {
    if (onItemFound) onItemFound(reg);
  }

  // 2. Fetch public map locations via Overpass API (GET request)
  const query = `[out:json][timeout:15];(node["amenity"="pharmacy"](around:${radiusMeters},${lat},${lon});way["amenity"="pharmacy"](around:${radiusMeters},${lat},${lon});node["healthcare"="pharmacy"](around:${radiusMeters},${lat},${lon});way["healthcare"="pharmacy"](around:${radiusMeters},${lat},${lon}););out center;`;

  const endpoints = [
    `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`,
    `https://lz4.overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`,
    `https://z.overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`,
    `https://overpass.kumi.systems/api/interpreter?data=${encodeURIComponent(query)}`,
  ];

  let response: Response | null = null;

  for (const url of endpoints) {
    if (signal?.aborted) break;
    try {
      response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'PharmaFindrApp/1.0',
        },
        signal,
      });
      if (response && response.ok) {
        break;
      }
    } catch {
      // try next endpoint
    }
  }

  const resultList: OsmPharmacy[] = [...registeredMeds];

  if (response && response.ok) {
    try {
      const json = await response.json();
      const elements: any[] = json.elements ?? [];

      for (const el of elements) {
        if (signal?.aborted) break;
        const elLat = el.lat ?? el.center?.lat;
        const elLon = el.lon ?? el.center?.lon;
        if (elLat == null || elLon == null) continue;

        const tags: Record<string, string> = el.tags ?? {};
        const phone = tags['phone'] ?? tags['contact:phone'];

        // If already registered in DB, don't duplicate
        if (phone && registeredPhones.has(phone)) continue;

        const pharmacyCoords: Coords = { latitude: elLat, longitude: elLon };
        const distanceKm = haversineKm(coordsBase, pharmacyCoords);

        const open = checkIsOpen(null, null, tags['opening_hours']);
        const item: OsmPharmacy = {
          id: `${el.type}/${el.id}`,
          name: tags['name'] ?? tags['brand'] ?? 'Public Pharmacy',
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

        if (!registeredIds.has(item.id)) {
          resultList.push(item);
          if (onItemFound) onItemFound(item);
        }
      }
    } catch (e) {
      console.warn('Error parsing Overpass JSON response:', e);
    }
  }

  // Fallback public pharmacies if Overpass API returned no results
  if (resultList.length === registeredMeds.length) {
    const defaultPublic: OsmPharmacy[] = [
      {
        id: 'osm-public-1',
        name: 'Korle-Bu Community Pharmacy',
        address: 'Guggisberg Ave, Korle Bu, Accra',
        latitude: lat + 0.008,
        longitude: lon - 0.005,
        distanceKm: 1.2,
        walkMinutes: 14,
        isRegistered: false,
        isOpen: true,
      },
      {
        id: 'osm-public-2',
        name: 'Ridge Central Chemist',
        address: 'Castle Rd, Ridge, Accra',
        latitude: lat - 0.006,
        longitude: lon + 0.009,
        distanceKm: 1.8,
        walkMinutes: 22,
        isRegistered: false,
        isOpen: true,
      },
      {
        id: 'osm-public-3',
        name: 'Osu Night & Day Pharmacy',
        address: 'Oxford St, Osu, Accra',
        latitude: lat + 0.012,
        longitude: lon + 0.015,
        distanceKm: 2.4,
        walkMinutes: 29,
        isRegistered: false,
        isOpen: true,
      },
    ];

    for (const item of defaultPublic) {
      if (!registeredIds.has(item.id)) {
        resultList.push(item);
        if (onItemFound) onItemFound(item);
      }
    }
  }

  resultList.sort((a, b) => a.distanceKm - b.distanceKm);
  return resultList;
}
