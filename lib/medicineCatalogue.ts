import { supabase } from '@/lib/supabase';

export interface MedicineItem {
  id: string;
  name: string;
  genericName: string;
  brandNames: string[];
  strength: string;
  category: string;
  dosageForm: string;
  dosage: string;
  frequency: string;
  duration: string;
  uses: string;
  howToTake: string;
  sideEffects: string;
  warnings: string;
  contraindications: string;
  storage: string;
  alternatives: string[];
  fdaStatus: string;
  estimatedPriceRange?: string;
  pharmacyCount?: number;
}

export interface PopularMedicine {
  id: string;
  name: string;
  genericName: string;
  category: string;
  strength: string;
  dosageForm: string;
}

/**
 * Fetches popular/common medicines at random from Supabase database (default 6 items).
 */
export async function fetchPopularMedicines(limit: number = 6): Promise<PopularMedicine[]> {
  try {
    // Generate a random page/offset from the national products dataset
    const randomOffset = Math.floor(Math.random() * 200);

    const { data, error } = await supabase
      .from('medicine_products')
      .select(`
        id,
        brand_name,
        strength,
        dosage_form,
        generic_medicines (
          id,
          generic_name,
          category
        )
      `)
      .range(randomOffset, randomOffset + 25);

    if (error || !data || data.length === 0) return [];

    // Shuffle and pick 6 unique items
    const shuffled = [...data].sort(() => 0.5 - Math.random());
    const selected = shuffled.slice(0, limit);

    return selected.map((row) => {
      const gen = Array.isArray(row.generic_medicines) ? row.generic_medicines[0] : row.generic_medicines;
      return {
        id: row.id,
        name: row.brand_name,
        genericName: gen?.generic_name || row.brand_name,
        category: gen?.category || 'Prescription & OTC',
        strength: row.strength || 'Standard',
        dosageForm: row.dosage_form || 'Tablet/Capsule',
      };
    });
  } catch (e: any) {
    console.warn('Error fetching popular medicines from database:', e.message);
    return [];
  }
}

/**
 * Fetches distinct categories dynamically from the generic_medicines table.
 */
export async function fetchMedicineCategories(): Promise<string[]> {
  try {
    const { data, error } = await supabase
      .from('generic_medicines')
      .select('category')
      .not('category', 'is', null)
      .neq('category', '');

    if (error || !data || data.length === 0) {
      return ['All', 'Pain Relief', 'Antibiotics', 'Diabetes', 'Heart & BP', 'Gastro', 'Allergy', 'Antimalarial', 'CNS', 'Dermatology', 'Eye & Ear', 'Vitamins'];
    }

    const counts = new Map<string, number>();
    for (const row of data) {
      if (row.category && row.category.trim()) {
        const cat = row.category.trim();
        counts.set(cat, (counts.get(cat) || 0) + 1);
      }
    }

    // Priority ordering for popular clinical categories
    const priorityOrder = [
      'Pain Relief',
      'Antibiotics',
      'Diabetes',
      'Heart & BP',
      'Gastro',
      'Allergy',
      'Antimalarial',
      'CNS',
      'Dermatology',
      'Eye & Ear',
      'Vitamins',
      'General',
      'Immunology',
      'Oncology',
    ];

    const uniqueCategories = Array.from(counts.keys()).sort((a, b) => {
      const idxA = priorityOrder.indexOf(a);
      const idxB = priorityOrder.indexOf(b);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return (counts.get(b) || 0) - (counts.get(a) || 0);
    });

    return ['All', ...uniqueCategories];
  } catch (e: any) {
    console.warn('Error fetching medicine categories:', e.message);
    return ['All', 'Pain Relief', 'Antibiotics', 'Diabetes', 'Heart & BP', 'Gastro', 'Allergy', 'Antimalarial'];
  }
}

/**
 * Searches the national medicine database (medicine_products + generic_medicines).
 */
export async function searchMasterMedicines(query: string, categoryFilter?: string): Promise<MedicineItem[]> {
  const trimmed = query.trim();
  const hasCategory = categoryFilter && categoryFilter !== 'All';

  if (!trimmed && !hasCategory) return [];

  const results: MedicineItem[] = [];
  const seenIds = new Set<string>();

  try {
    let productsQuery = supabase
      .from('medicine_products')
      .select(`
        id,
        brand_name,
        strength,
        dosage_form,
        pack_size,
        manufacturer,
        generic_id,
        generic_medicines (
          id,
          generic_name,
          description,
          category,
          how_to_take,
          side_effects,
          warnings,
          storage_conditions,
          contraindications,
          dosage_forms
        )
      `);

    let genericsQuery = supabase
      .from('generic_medicines')
      .select('id, generic_name, description, category, how_to_take, side_effects, warnings, storage_conditions, contraindications, dosage_forms');

    if (trimmed) {
      productsQuery = productsQuery.ilike('brand_name', `%${trimmed}%`).limit(30);
      genericsQuery = genericsQuery.ilike('generic_name', `%${trimmed}%`).limit(15);
    } else if (hasCategory) {
      genericsQuery = genericsQuery.eq('category', categoryFilter).limit(25);
      productsQuery = productsQuery.limit(30);
    }

    const [{ data: dbProducts }, { data: dbGenerics }] = await Promise.all([
      productsQuery,
      genericsQuery,
    ]);

    if (dbProducts && dbProducts.length > 0) {
      for (const row of dbProducts) {
        const gen = Array.isArray(row.generic_medicines) ? row.generic_medicines[0] : row.generic_medicines;
        const genericName = gen?.generic_name || row.brand_name;
        const itemCategory = gen?.category || 'Prescription & OTC';

        if (categoryFilter && categoryFilter !== 'All' && !itemCategory.toLowerCase().includes(categoryFilter.toLowerCase())) {
          continue;
        }

        const item: MedicineItem = {
          id: row.id,
          name: row.brand_name,
          genericName,
          brandNames: [row.brand_name],
          strength: row.strength || 'Standard Dosage',
          category: itemCategory,
          dosageForm: row.dosage_form || 'Tablet/Capsule',
          dosage: '1 Unit',
          frequency: 'As directed by physician or pharmacist',
          duration: 'As prescribed',
          uses: gen?.description || `Registered pharmaceutical preparation of ${genericName} manufactured by ${row.manufacturer || 'Approved Manufacturer'}.`,
          howToTake: gen?.how_to_take || `Take according to prescribing instructions or product label (${row.dosage_form || 'Oral'}).`,
          sideEffects: gen?.side_effects || 'Consult your prescribing doctor or dispensing pharmacist for full safety profile.',
          warnings: gen?.warnings || 'Keep out of reach of children. Store safely.',
          contraindications: gen?.contraindications || 'Hypersensitivity to active ingredient.',
          storage: gen?.storage_conditions || 'Store below 30°C in a dry place away from direct sunlight.',
          alternatives: [],
          fdaStatus: 'Ghana FDA Registered Product',
        };
        results.push(item);
        seenIds.add(row.id);
      }
    }

    if (dbGenerics && dbGenerics.length > 0) {
      for (const gen of dbGenerics) {
        if (!seenIds.has(gen.id)) {
          const itemCategory = gen.category || 'Essential Generic Molecule';

          if (categoryFilter && categoryFilter !== 'All' && !itemCategory.toLowerCase().includes(categoryFilter.toLowerCase())) {
            continue;
          }

          const forms = Array.isArray(gen.dosage_forms) ? gen.dosage_forms.join(', ') : 'Tablet, Capsule';
          results.push({
            id: gen.id,
            name: gen.generic_name,
            genericName: gen.generic_name,
            brandNames: [],
            strength: 'Various Strengths',
            category: itemCategory,
            dosageForm: forms || 'Oral Formulations',
            dosage: 'As prescribed',
            frequency: 'As directed by healthcare provider',
            duration: 'Full prescribed course',
            uses: gen.description || `Active pharmaceutical ingredient: ${gen.generic_name}.`,
            howToTake: gen.how_to_take || 'Take with water as directed by your physician.',
            sideEffects: gen.side_effects || 'Consult prescribing physician or pharmacist.',
            warnings: gen.warnings || 'Complete full prescribed course. Do not self-medicate.',
            contraindications: gen.contraindications || `Known allergy to ${gen.generic_name}.`,
            storage: gen.storage_conditions || 'Store below 30°C in a cool, dry place.',
            alternatives: [],
            fdaStatus: 'Essential Generic Molecule',
          });
          seenIds.add(gen.id);
        }
      }
    }
  } catch (e: any) {
    console.warn('Database medicine search error:', e.message);
  }

  return results;
}

/**
 * Asynchronously fetches comprehensive details for a medicine by UUID or name,
 * querying clinical profile columns from generic_medicines and live stock from inventory.
 */
export async function fetchMedicineDetails(identifier: string): Promise<MedicineItem> {
  const fallback = getMedicineByIdOrName(identifier);

  try {
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(identifier);

    // 1. Check medicine_products table joined with generic_medicines
    let productQuery = supabase
      .from('medicine_products')
      .select(`
        id,
        brand_name,
        strength,
        dosage_form,
        pack_size,
        manufacturer,
        generic_id,
        generic_medicines (
          id,
          generic_name,
          description,
          category,
          how_to_take,
          side_effects,
          warnings,
          storage_conditions,
          contraindications,
          dosage_forms
        )
      `);

    if (isUUID) {
      productQuery = productQuery.eq('id', identifier);
    } else {
      productQuery = productQuery.ilike('brand_name', identifier);
    }

    const { data: prodData } = await productQuery.limit(1).maybeSingle();

    if (prodData) {
      const gen = Array.isArray(prodData.generic_medicines) ? prodData.generic_medicines[0] : prodData.generic_medicines;
      const genericName = gen?.generic_name || prodData.brand_name;

      // Query live inventory count and price range across pharmacies
      let pharmacyCount = 0;
      let priceRange: string | undefined;

      try {
        const { data: invRows } = await supabase
          .from('inventory')
          .select('price, quantity, pharmacy_id')
          .or(`medicine_name.ilike.%${prodData.brand_name}%,generic_name.ilike.%${genericName}%,brand_name.ilike.%${prodData.brand_name}%`)
          .gt('quantity', 0);

        if (invRows && invRows.length > 0) {
          const uniquePharmacies = new Set(invRows.map((r) => r.pharmacy_id));
          pharmacyCount = uniquePharmacies.size;
          const prices = invRows.map((r) => parseFloat(r.price)).filter((p) => !isNaN(p) && p > 0);
          if (prices.length > 0) {
            const minP = Math.min(...prices);
            const maxP = Math.max(...prices);
            priceRange = minP === maxP ? `GH₵ ${minP.toFixed(2)}` : `GH₵ ${minP.toFixed(2)} – GH₵ ${maxP.toFixed(2)}`;
          }
        }
      } catch (_) {}

      return {
        id: prodData.id,
        name: prodData.brand_name,
        genericName,
        brandNames: [prodData.brand_name],
        strength: prodData.strength || fallback.strength,
        category: gen?.category || 'Prescription & OTC',
        dosageForm: prodData.dosage_form || fallback.dosageForm,
        dosage: fallback.dosage || '1 Unit',
        frequency: fallback.frequency || 'As directed by physician',
        duration: fallback.duration || 'As prescribed',
        uses: gen?.description || fallback.uses,
        howToTake: gen?.how_to_take || fallback.howToTake,
        sideEffects: gen?.side_effects || fallback.sideEffects,
        warnings: gen?.warnings || fallback.warnings,
        contraindications: gen?.contraindications || fallback.contraindications,
        storage: gen?.storage_conditions || fallback.storage,
        alternatives: fallback.alternatives || [],
        fdaStatus: 'Ghana FDA Registered Product',
        estimatedPriceRange: priceRange || fallback.estimatedPriceRange,
        pharmacyCount,
      };
    }

    // 2. Check generic_medicines table directly
    let genQuery = supabase.from('generic_medicines').select('id, generic_name, description, category, how_to_take, side_effects, warnings, storage_conditions, contraindications, dosage_forms');
    if (isUUID) {
      genQuery = genQuery.eq('id', identifier);
    } else {
      genQuery = genQuery.ilike('generic_name', identifier);
    }

    const { data: genData } = await genQuery.limit(1).maybeSingle();
    if (genData) {
      const { data: relatedProducts } = await supabase
        .from('medicine_products')
        .select('brand_name')
        .eq('generic_id', genData.id)
        .limit(10);

      const brands = relatedProducts?.map((p) => p.brand_name) || [];

      return {
        id: genData.id,
        name: genData.generic_name,
        genericName: genData.generic_name,
        brandNames: brands,
        strength: 'Standard Formulations',
        category: genData.category || 'Essential Generic Molecule',
        dosageForm: Array.isArray(genData.dosage_forms) ? genData.dosage_forms.join(', ') : 'Tablet, Capsule',
        dosage: 'As prescribed',
        frequency: 'As directed by physician',
        duration: 'As prescribed',
        uses: genData.description || fallback.uses,
        howToTake: genData.how_to_take || fallback.howToTake,
        sideEffects: genData.side_effects || fallback.sideEffects,
        warnings: genData.warnings || fallback.warnings,
        contraindications: genData.contraindications || fallback.contraindications,
        storage: genData.storage_conditions || fallback.storage,
        alternatives: brands.slice(0, 4),
        fdaStatus: 'Ghana FDA Essential Molecule',
        estimatedPriceRange: fallback.estimatedPriceRange,
      };
    }
  } catch (e: any) {
    console.warn('Error fetching live medicine details:', e.message);
  }

  return fallback;
}

/**
 * Dynamic fallback factory retrieving a medicine structure by ID or Name.
 */
export function getMedicineByIdOrName(identifier: string, defaultName?: string): MedicineItem {
  const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(identifier) || /^[0-9a-f-]{20,}$/i.test(identifier);
  const displayName = defaultName || (isUUID ? '' : identifier.replace(/[-_]/g, ' '));

  return {
    id: identifier,
    name: displayName,
    genericName: displayName,
    brandNames: displayName ? [displayName] : [],
    strength: 'Standard Dosage',
    category: 'Essential Medicine',
    dosageForm: 'Tablet/Capsule',
    dosage: '1 Unit',
    frequency: 'As directed by physician',
    duration: 'As prescribed',
    uses: displayName ? `Medical details for ${displayName}. Always consult a registered pharmacist or physician for exact usage and dosage guidelines.` : 'Loading medicine details...',
    howToTake: 'Follow dosage instructions provided on the packaging or by your healthcare provider.',
    sideEffects: 'Consult your prescribing physician or pharmacist for potential side effects.',
    warnings: 'Store out of reach of children.',
    contraindications: 'Hypersensitivity to active ingredient.',
    storage: 'Store below 30°C in a cool, dry place away from direct sunlight.',
    alternatives: [],
    fdaStatus: 'Ghana FDA Registered Compound',
    estimatedPriceRange: 'Varies by pharmacy',
  };
}
