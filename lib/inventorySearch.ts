import { supabase } from '@/lib/supabase';
import { checkIsOpen, formatTimeHHMM, haversineKm } from '@/lib/osm';
import { usePharmacyStore } from '@/store/pharmacyStore';
import type { Coords } from './location';
import type {
  PrescriptionMedicine,
  InventoryMatch,
  PharmacyWithMedicines,
} from '@/types/prescription';

export function normalizeMedicineName(raw: string): string[] {
  if (!raw) return [];
  const cleaned = raw
    .trim()
    .toLowerCase()
    .replace(/[\(\)\[\],;\/\\]/g, ' ')
    .replace(/[^a-z0-9\s\-\.]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!cleaned) return [];

  // Medical abbreviations & dosage form noise to filter out
  const stopWords = new Set([
    'tab', 'tabs', 'tablet', 'tablets',
    'cap', 'caps', 'capsule', 'capsules',
    'inj', 'injection', 'injections',
    'syr', 'syrup', 'syrups',
    'susp', 'suspension',
    'oint', 'ointment',
    'crm', 'cream',
    'drop', 'drops',
    'iv', 'im', 'po',
    'sol', 'solution',
    'gel', 'lotion',
    'supp', 'suppository',
    'daily', 'od', 'bd', 'tds', 'tid', 'qid', 'stat', 'prn', 'nocte', 'mane',
  ]);

  const rawTokens = cleaned.split(' ').filter(Boolean);
  const meaningfulTokens = rawTokens.filter(
    (t) => !stopWords.has(t) && !/^\d+(?:mg|g|ml|mcg|iu|%)?$/i.test(t)
  );

  const variants: string[] = [];

  // 1. Meaningful tokens joined (e.g. "amoxicillin clavulanate")
  if (meaningfulTokens.length > 0) {
    const joined = meaningfulTokens.join(' ');
    if (joined.length >= 2) {
      variants.push(joined);
    }
  }

  // 2. Individual substantial drug tokens (e.g. "amoxicillin", "paracetamol")
  for (const token of meaningfulTokens) {
    if (token.length >= 3 && !variants.includes(token)) {
      variants.push(token);
    }
  }

  // 3. Full cleaned string
  if (cleaned.length >= 2 && !variants.includes(cleaned)) {
    variants.push(cleaned);
  }

  // 4. Sub-slice combinations
  for (let i = rawTokens.length - 1; i >= 1; i--) {
    const variant = rawTokens.slice(0, i).join(' ');
    if (variant && variant.length >= 3 && !variants.includes(variant)) {
      variants.push(variant);
    }
  }

  return variants;
}

/**
 * For each prescribed medicine, search the inventory table across generic_name,
 * brand_name, and medicine_name for matches.
 */
async function searchInventoryForMedicine(
  med: PrescriptionMedicine
): Promise<InventoryMatch[]> {
  const variants = normalizeMedicineName(med.name);
  if (variants.length === 0) return [];

  const now = new Date();
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const currentDayName = dayNames[now.getDay()];

  // Build a single OR filter across all variants — one round-trip instead of N
  const orFilter = variants
    .map((term) => `generic_name.ilike.%${term}%,brand_name.ilike.%${term}%,medicine_name.ilike.%${term}%`)
    .join(',');

  try {
    const { data, error } = await supabase
      .from('inventory')
      .select(`
        id,
        medicine_name,
        generic_name,
        brand_name,
        strength,
        dosage_form,
        manufacturer,
        price,
        quantity,
        pharmacies (
          id,
          name,
          phone,
          latitude,
          longitude,
          opening_time,
          closing_time,
          is_verified,
          pharmacy_operating_hours (
            day_of_week,
            is_open,
            opening_time,
            closing_time
          )
        )
      `)
      .or(orFilter)
      .gt('quantity', 0)
      .limit(60);

    if (error) {
      console.warn('Inventory search error:', error.message);
      return [];
    }

    if (!data || data.length === 0) return [];

    const matchMap = new Map<string, InventoryMatch>();

    for (const item of data) {
      if (matchMap.has(item.id)) continue;

      const pharm: any = item.pharmacies;
      const weeklyHours = pharm?.pharmacy_operating_hours?.length > 0
        ? pharm.pharmacy_operating_hours
        : null;

      const open = checkIsOpen(pharm?.opening_time, pharm?.closing_time, null, weeklyHours);
      const oTime = formatTimeHHMM(pharm?.opening_time);
      const cTime = formatTimeHHMM(pharm?.closing_time);
      let todayHours = oTime && cTime ? `${oTime} - ${cTime}` : undefined;

      if (weeklyHours) {
        const todayRow = weeklyHours.find((h: any) =>
          (h.day || h.day_of_week)?.toLowerCase() === currentDayName.toLowerCase()
        );
        if (todayRow) {
          const isOpenToday = todayRow.isOpen !== undefined ? todayRow.isOpen : todayRow.is_open;
          if (isOpenToday === false) {
            todayHours = 'Closed today';
          } else {
            const o = formatTimeHHMM(todayRow.opens || todayRow.opening_time || pharm?.opening_time || '08:00');
            const c = formatTimeHHMM(todayRow.closes || todayRow.closing_time || pharm?.closing_time || '20:00');
            todayHours = `${o} - ${c}`;
          }
        }
      }

      matchMap.set(item.id, {
        inventoryId: item.id,
        medicineName: item.medicine_name,
        genericName: item.generic_name ?? null,
        brandName: item.brand_name ?? null,
        strength: item.strength ?? '',
        dosageForm: item.dosage_form ?? null,
        manufacturer: item.manufacturer ?? null,
        price: parseFloat(item.price) || 0,
        quantity: item.quantity,
        pharmacyId: pharm?.id ?? '',
        pharmacyName: pharm?.name ?? 'Unknown Pharmacy',
        pharmacyPhone: pharm?.phone ?? null,
        latitude: pharm?.latitude,
        longitude: pharm?.longitude,
        isOpen: open,
        hours: todayHours,
      });
    }

    return Array.from(matchMap.values());
  } catch (e: any) {
    console.warn('Inventory search failed:', e.message);
    return [];
  }
}

/**
 * Search inventory for all prescribed medicines, then group results
 * by pharmacy. Pharmacies are sorted by matchCount (descending), then distance (ascending).
 */
export async function searchPharmaciesForPrescription(
  medicines: PrescriptionMedicine[],
  userCoordsInput?: Coords | null
): Promise<PharmacyWithMedicines[]> {
  const userCoords = userCoordsInput || usePharmacyStore.getState().userCoords;

  // Search each medicine in parallel
  const allResults = await Promise.all(
    medicines.map((med) => searchInventoryForMedicine(med))
  );

  // Build a map: pharmacyId → { info, set of matched medicine names }
  const pharmacyMap = new Map<
    string,
    {
      pharmacyName: string;
      pharmacyPhone: string | null;
      latitude?: number;
      longitude?: number;
      isOpen?: boolean;
      hours?: string;
      distanceKm?: number;
      walkMinutes?: number;
      medicines: InventoryMatch[];
      matchedNames: Set<string>;
    }
  >();

  for (const matches of allResults) {
    for (const match of matches) {
      const existing = pharmacyMap.get(match.pharmacyId);
      const matchKey = (match.genericName || match.medicineName).toLowerCase();

      if (existing) {
        if (!existing.matchedNames.has(matchKey)) {
          existing.matchedNames.add(matchKey);
        }
        existing.medicines.push(match);
      } else {
        let dist: number | undefined;
        let walkMins: number | undefined;
        if (userCoords && match.latitude != null && match.longitude != null) {
          const rawKm = haversineKm(userCoords, { latitude: match.latitude, longitude: match.longitude });
          dist = Math.round(rawKm * 1000) / 1000;
          walkMins = Math.max(1, Math.round((rawKm / 5) * 60));
        }

        pharmacyMap.set(match.pharmacyId, {
          pharmacyName: match.pharmacyName,
          pharmacyPhone: match.pharmacyPhone,
          latitude: match.latitude,
          longitude: match.longitude,
          isOpen: match.isOpen,
          hours: match.hours,
          distanceKm: dist,
          walkMinutes: walkMins,
          medicines: [match],
          matchedNames: new Set([matchKey]),
        });
      }
    }
  }

  // Convert map to array and sort by matchCount descending, then distance ascending
  const results: PharmacyWithMedicines[] = Array.from(pharmacyMap.entries())
    .map(([pharmacyId, data]) => ({
      pharmacyId,
      pharmacyName: data.pharmacyName,
      pharmacyPhone: data.pharmacyPhone,
      latitude: data.latitude,
      longitude: data.longitude,
      isOpen: data.isOpen,
      hours: data.hours,
      distanceKm: data.distanceKm,
      walkMinutes: data.walkMinutes,
      medicines: data.medicines,
      matchCount: data.matchedNames.size,
      totalPrescribed: medicines.length,
    }))
    .sort((a, b) => {
      // 1. Shortest distance and time first (nearest pharmacy first)
      if (a.distanceKm != null && b.distanceKm != null) {
        if (a.distanceKm !== b.distanceKm) {
          return a.distanceKm - b.distanceKm;
        }
      } else if (a.distanceKm != null) {
        return -1;
      } else if (b.distanceKm != null) {
        return 1;
      }

      // 2. Secondary sort: match count descending
      return b.matchCount - a.matchCount;
    });

  return results;
}
