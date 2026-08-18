import { haversineKm } from './geoUtils';
import type { DiscoveredPharmacy } from '@/types/map';

export const BRANCH_QUALIFIERS = new Set([
  'east', 'west', 'north', 'south', 'central', 'main', 'branch',
  'airport', 'junction', 'station', 'market', 'mall', 'plaza', 'circle',
  'terminal', 'hospital', 'clinic', 'campus', 'ridge', 'annex', 'centre',
  'center', 'legon', 'cantonments', 'osu', 'tema', 'kumasi', 'tamale',
  'spintex', 'dansoman', 'madina', 'adabraka', 'labone', 'kasoa',
]);

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

export function extractDistinctiveTokens(normalizedName: string): Set<string> {
  const common = new Set(['and', 'the', 'for', 'at', 'in', 'of', 'on', 'st', 'nd', 'rd', 'th', 'a', 'an']);
  const tokens = normalizedName.split(/\s+/).filter((t) => t.length >= 3 && !common.has(t));
  return new Set(tokens);
}

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

export function isDuplicatePharmacy(
  candidate: { latitude: number; longitude: number; name?: string; phone?: string; googlePlaceId?: string; id?: string },
  existing: DiscoveredPharmacy
): boolean {
  // 1. Exact ID or Google Place ID match
  if (candidate.id && existing.id && candidate.id === existing.id) {
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

  // 4. Token-based overlap within 200m (with branch qualifier protection)
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

      // Check if all distinctive tokens match
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
        // Supabase is authoritative entity: preserve identity, enrich missing live metadata
        if (!existing.hours || existing.hours === 'N/A' || existing.hours === 'Hours not set') {
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
          // Upgrade to authoritative Supabase entity while retaining Google live details
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
          // Enrich missing fields from incoming
          if (!existing.phone && incoming.phone) existing.phone = incoming.phone;
          if (!existing.hours && incoming.hours) existing.hours = incoming.hours;
        }
      } else if (existing.source === 'osm') {
        if (incoming.source === 'supabase' || incoming.source === 'google') {
          // Upgrade to authoritative Supabase or Google entity
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
