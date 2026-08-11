import { supabase } from '@/lib/supabase';
import { normalizeMedicineName } from '@/lib/normalizeMedicine';
import { checkIsOpen, formatTimeHHMM } from '@/lib/osm';
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

  const now = new Date();
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const currentDayName = dayNames[now.getDay()];

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
          pharmacies (
            id,
            name,
            phone,
            latitude,
            longitude,
            opening_time,
            closing_time,
            operating_hours,
            pharmacy_operating_hours (
              day_of_week,
              is_open,
              opening_time,
              closing_time
            )
          )
        `)
        .or(`generic_name.ilike.%${term}%,brand_name.ilike.%${term}%,medicine_name.ilike.%${term}%`)
        .gt('quantity', 0)
        .limit(25);

      if (error) {
        console.warn('Inventory search error:', error.message);
        continue;
      }

      if (data && data.length > 0) {
        return data.map((item: any) => {
          const pharm = item.pharmacies;
          const weeklyHours = (pharm?.pharmacy_operating_hours && pharm?.pharmacy_operating_hours.length > 0)
            ? pharm.pharmacy_operating_hours
            : (Array.isArray(pharm?.operating_hours) ? pharm.operating_hours : null);

          const open = checkIsOpen(pharm?.opening_time, pharm?.closing_time, null, weeklyHours);
          const oTime = formatTimeHHMM(pharm?.opening_time);
          const cTime = formatTimeHHMM(pharm?.closing_time);
          let todayHours = oTime && cTime ? `${oTime} - ${cTime}` : undefined;
          if (weeklyHours) {
            const todayRow = weeklyHours.find((h: any) => (h.day || h.day_of_week)?.toLowerCase() === currentDayName.toLowerCase());
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

          return {
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
          };
        });
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
      isOpen?: boolean;
      hours?: string;
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
          isOpen: (match as any).isOpen,
          hours: (match as any).hours,
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
      isOpen: data.isOpen,
      hours: data.hours,
      medicines: data.medicines,
      matchCount: data.matchedNames.size,
      totalPrescribed: medicines.length,
    }))
    .sort((a, b) => b.matchCount - a.matchCount);

  return results;
}
