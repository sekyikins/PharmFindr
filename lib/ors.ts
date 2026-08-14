import type { Coords } from './location';

const ORS_API_KEY = (process.env.EXPO_PUBLIC_ORS_API_KEY ?? '').trim();
const ORS_BASE = 'https://api.openrouteservice.org/v2';

export interface RouteResult {
  /** Ordered list of coordinates forming the route polyline. */
  coordinates: Coords[];
  /** Total distance in metres. */
  distanceMeters: number;
  /** Estimated travel time in seconds. */
  durationSeconds: number;
}

/**
 * Fetch a driving route from `origin` to `destination` using OpenRouteService.
 * Uses the foot-walking profile so it works in dense urban areas where
 * driving routes may be restricted or unhelpful.
 */
export async function getRoute(
  origin: Coords,
  destination: Coords
): Promise<RouteResult> {
  const url = `${ORS_BASE}/directions/foot-walking/geojson`;

  const body = {
    coordinates: [
      [origin.longitude, origin.latitude],
      [destination.longitude, destination.latitude],
    ],
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: ORS_API_KEY,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`ORS error ${response.status}: ${text}`);
  }

  const json = await response.json();
  const feature = json.features?.[0];
  if (!feature) throw new Error('ORS returned no route');

  const rawCoords: [number, number][] = feature.geometry?.coordinates ?? [];
  const summary = feature.properties?.summary ?? {};

  return {
    coordinates: rawCoords.map(([lon, lat]) => ({ latitude: lat, longitude: lon })),
    distanceMeters: summary.distance ?? 0,
    durationSeconds: summary.duration ?? 0,
  };
}

/** Format metres into a human-readable distance string (e.g. "1.3 km"). */
export function formatDistance(metres: number): string {
  if (metres < 1000) return `${Math.round(metres)} m`;
  return `${(metres / 1000).toFixed(1)} km`;
}

/** Format seconds into a human-readable duration string (e.g. "12 min"). */
export function formatDuration(seconds: number): string {
  const mins = Math.round(seconds / 60);
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}min` : `${h}h`;
}

/** Format distance string consistently with unit (e.g. "1.3 km" or "800 m"). */
export function cleanDistanceString(val?: string | number | null): string {
  if (val === undefined || val === null || val === 'N/A' || val === '—' || val === '') return '—';
  const s = String(val).trim();
  if (s.endsWith('km') || s.endsWith('m')) return s;
  const num = parseFloat(s);
  if (isNaN(num)) return s;
  if (num < 1) return `${Math.round(num * 1000)} m`;
  return `${num.toFixed(1)} km`;
}

/** Format walk duration string consistently with unit (e.g. "12 min walk"). */
export function cleanDurationString(val?: string | number | null): string {
  if (val === undefined || val === null || val === 'N/A' || val === '—' || val === '') return '—';
  const s = String(val).trim();
  if (s.includes('walk')) return s;
  if (s.includes('min') || s.includes('h')) return `${s} walk`;
  const num = parseFloat(s);
  if (isNaN(num)) return s;
  return `${Math.round(num)} min walk`;
}
