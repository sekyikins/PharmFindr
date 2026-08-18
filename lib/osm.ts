/**
 * lib/osm.ts
 *
 * OpenStreetMap / Overpass API Pharmacy Provider.
 * Serves as a complementary discovery provider alongside Google Places and Supabase.
 * Respects caller cancellation, per-endpoint timeout, and multi-endpoint failover.
 */

import { haversineKm, isValidCoordinate, isValidRegion } from './geoUtils';
import { checkIsOpen } from './timeUtils';
import type { Coords } from './location';
import type { DiscoveredPharmacy, MapRegion } from '@/types/map';

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
 * Fetch pharmacies from OpenStreetMap via Overpass API for a given geographic region.
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
          // Malformed JSON on this endpoint, try next endpoint
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
