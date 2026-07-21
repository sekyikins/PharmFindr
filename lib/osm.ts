import type { Coords } from './location';

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
}

/**
 * Calculate straight-line distance between two coordinates (Haversine formula), in km.
 */
function haversineKm(a: Coords, b: Coords): number {
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
 * Search nearby pharmacies using the Overpass API (OSM data).
 *
 * @param userCoords  The user current GPS position.
 * @param radiusMeters  Search radius in metres (default 5 km).
 */
export async function searchNearbyPharmacies(
  userCoords: Coords,
  radiusMeters = 5000,
  onItemFound?: (pharmacy: OsmPharmacy) => void,
  signal?: AbortSignal
): Promise<OsmPharmacy[]> {
  const { latitude: lat, longitude: lon } = userCoords;

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
    'https://overpass.kumi.systems/api/interpreter'
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
          'User-Agent': 'PharmaFindrApp/1.0 (contact: support@pharmafindr.com)'
        },
        body: `data=${encodeURIComponent(query)}`,
        signal,
      });
      if (response && response.ok) {
        break; // Success!
      }
      lastError = new Error(`Overpass API error from ${url}: ${response ? response.status : 'No response'}`);
    } catch (e: any) {
      lastError = e;
    }
  }

  if (!response || !response.ok) {
    throw lastError || new Error('All Overpass API endpoints failed.');
  }

  const json = await response.json();
  const elements: any[] = json.elements ?? [];

  const pharmacies: OsmPharmacy[] = [];

  for (const el of elements) {
    if (signal?.aborted) break;
    const elLat = el.lat ?? el.center?.lat;
    const elLon = el.lon ?? el.center?.lon;
    if (elLat == null || elLon == null) continue;

    const tags: Record<string, string> = el.tags ?? {};
    const pharmacyCoords: Coords = { latitude: elLat, longitude: elLon };
    const distanceKm = haversineKm(userCoords, pharmacyCoords);

    const item: OsmPharmacy = {
      id: `${el.type}/${el.id}`,
      name: tags['name'] ?? tags['brand'] ?? 'Pharmacy',
      address: buildAddress(tags),
      latitude: elLat,
      longitude: elLon,
      phone: tags['phone'] ?? tags['contact:phone'] ?? undefined,
      hours: tags['opening_hours'] ?? undefined,
      distanceKm: Math.round(distanceKm * 10) / 10,
      walkMinutes: Math.round((distanceKm / 5) * 60),
    };

    pharmacies.push(item);
    if (onItemFound) {
      onItemFound(item);
    }
  }

  pharmacies.sort((a, b) => a.distanceKm - b.distanceKm);
  return pharmacies;

  return pharmacies;
}
