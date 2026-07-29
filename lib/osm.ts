import type { Coords } from './location';
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
  return parts.length > 0 ? parts.join(', ') : 'Address unavailable';
}

/**
 * Fetch registered pharmacies from Supabase database.
 */
export async function getRegisteredPharmacies(userCoords: Coords): Promise<OsmPharmacy[]> {
  try {
    const { data, error } = await supabase
      .from('pharmacies')
      .select('id, name, address, phone, latitude, longitude, opening_time, closing_time');

    if (error || !data) return [];

    return data
      .filter((p) => p.latitude != null && p.longitude != null)
      .map((p) => {
        const coords: Coords = { latitude: p.latitude, longitude: p.longitude };
        const dist = haversineKm(userCoords, coords);
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
        };
      });
  } catch (e) {
    return [];
  }
}

/**
 * Search nearby pharmacies using the Overpass API (OSM data) + registered database pharmacies.
 */
export async function searchNearbyPharmacies(
  userCoords: Coords,
  radiusMeters = 5000,
  onItemFound?: (pharmacy: OsmPharmacy) => void,
  signal?: AbortSignal
): Promise<OsmPharmacy[]> {
  const { latitude: lat, longitude: lon } = userCoords;

  // 1. Fetch registered database pharmacies first
  const registeredMeds = await getRegisteredPharmacies(userCoords);
  const registeredIds = new Set(registeredMeds.map((r) => r.id));
  const registeredPhones = new Set(registeredMeds.map((r) => r.phone).filter(Boolean));

  for (const reg of registeredMeds) {
    if (onItemFound) onItemFound(reg);
  }

  // 2. Fetch public map locations via Overpass API
  const query = `
    [out:json][timeout:25];
    (
      node["amenity"="pharmacy"](around:${radiusMeters},${lat},${lon});
      way["amenity"="pharmacy"](around:${radiusMeters},${lat},${lon});
    );
    out center;
  `.trim();

  const endpoints = [
    'https://overpass-api.de/api/interpreter',
    'https://lz4.overpass-api.de/api/interpreter',
    'https://z.overpass-api.de/api/interpreter',
    'https://overpass.kumi.systems/api/interpreter',
  ];

  let response: Response | null = null;
  let lastError: Error | null = null;

  for (const url of endpoints) {
    if (signal?.aborted) throw new Error('Aborted');
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'PharmaFindrApp/1.0 (contact: support@pharmafindr.com)',
        },
        body: `data=${encodeURIComponent(query)}`,
        signal,
      });
      if (response && response.ok) {
        break;
      }
      lastError = new Error(`Overpass API error from ${url}: ${response ? response.status : 'No response'}`);
    } catch (e: any) {
      lastError = e;
    }
  }

  const resultList: OsmPharmacy[] = [...registeredMeds];

  if (response && response.ok) {
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
      if (registeredPhones.has(phone)) continue;

      const pharmacyCoords: Coords = { latitude: elLat, longitude: elLon };
      const distanceKm = haversineKm(userCoords, pharmacyCoords);

      const item: OsmPharmacy = {
        id: `${el.type}/${el.id}`,
        name: tags['name'] ?? tags['brand'] ?? 'Pharmacy',
        address: buildAddress(tags),
        latitude: elLat,
        longitude: elLon,
        phone,
        hours: tags['opening_hours'] ?? undefined,
        distanceKm: Math.round(distanceKm * 10) / 10,
        walkMinutes: Math.round((distanceKm / 5) * 60),
        isRegistered: false,
      };

      if (!registeredIds.has(item.id)) {
        resultList.push(item);
        if (onItemFound) onItemFound(item);
      }
    }
  }

  resultList.sort((a, b) => a.distanceKm - b.distanceKm);
  return resultList;
}
