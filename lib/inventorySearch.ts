import { supabase } from '@/lib/supabase';
import { normalizeMedicineName } from '@/lib/normalizeMedicine';
import type {
  PrescriptionMedicine,
  InventoryMatch,
  PharmacyWithMedicines,
} from '@/types/prescription';

/**
 * For each prescribed medicine, search the inventory table across generic_name,
 * brand_name, and medicine_name for matches.
 */
async function searchInventoryForMedicine(
  med: PrescriptionMedicine
): Promise<InventoryMatch[]> {
  const variants = normalizeMedicineName(med.name);
  if (variants.length === 0) return [];

  for (const term of variants) {
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
          pharmacies ( id, name, phone, latitude, longitude )
        `)
        .or(`generic_name.ilike.%${term}%,brand_name.ilike.%${term}%,medicine_name.ilike.%${term}%`)
        .gt('quantity', 0)
        .limit(25);

      if (error) {
        console.warn('Inventory search error:', error.message);
        continue;
      }

      if (data && data.length > 0) {
        return data.map((item: any) => ({
          inventoryId: item.id,
          medicineName: item.medicine_name,
          genericName: item.generic_name ?? null,
          brandName: item.brand_name ?? null,
          strength: item.strength ?? '',
          dosageForm: item.dosage_form ?? null,
          manufacturer: item.manufacturer ?? null,
          price: parseFloat(item.price) || 0,
          quantity: item.quantity,
          pharmacyId: item.pharmacies?.id ?? '',
          pharmacyName: item.pharmacies?.name ?? 'Unknown Pharmacy',
          pharmacyPhone: item.pharmacies?.phone ?? null,
          latitude: item.pharmacies?.latitude,
          longitude: item.pharmacies?.longitude,
        }));
      }
    } catch (e: any) {
      console.warn(`Search variant "${term}" failed:`, e.message);
    }
  }

  return [];
}

/**
 * Search inventory for all prescribed medicines, then group results
 * by pharmacy. Pharmacies are sorted by matchCount (descending).
 */
export async function searchPharmaciesForPrescription(
  medicines: PrescriptionMedicine[]
): Promise<PharmacyWithMedicines[]> {
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
        pharmacyMap.set(match.pharmacyId, {
          pharmacyName: match.pharmacyName,
          pharmacyPhone: match.pharmacyPhone,
          latitude: (match as any).latitude,
          longitude: (match as any).longitude,
          medicines: [match],
          matchedNames: new Set([matchKey]),
        });
      }
    }
  }

  // Convert map to array and sort by matchCount descending
  const results: PharmacyWithMedicines[] = Array.from(pharmacyMap.entries())
    .map(([pharmacyId, data]) => ({
      pharmacyId,
      pharmacyName: data.pharmacyName,
      pharmacyPhone: data.pharmacyPhone,
      latitude: data.latitude,
      longitude: data.longitude,
      medicines: data.medicines,
      matchCount: data.matchedNames.size,
      totalPrescribed: medicines.length,
    }))
    .sort((a, b) => b.matchCount - a.matchCount);

  return results;
}
