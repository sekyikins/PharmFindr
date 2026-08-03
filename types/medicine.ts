/**
 * Data structures for Generic-First Medicine Catalog
 */

export interface GenericMedicine {
  id: string;
  generic_name: string;
  description?: string | null;
  atc_code?: string | null;
  dosage_forms?: string[] | null;
  created_at?: string;
}

export interface MedicineProduct {
  id: string;
  generic_id: string;
  brand_name: string;
  strength: string;
  dosage_form: string;
  pack_size?: string | null;
  manufacturer?: string | null;
  generic_medicines?: GenericMedicine | null;
  created_at?: string;
}

export interface AutocompleteSuggestion {
  id: string;
  type: 'generic' | 'brand';
  genericId: string;
  genericName: string;
  brandName: string;
  strength: string;
  dosageForm: string;
  manufacturer: string;
}

export const COMMON_DOSAGE_FORMS = [
  'Tablet',
  'Capsule',
  'Syrup',
  'Suspension',
  'Injection',
  'Cream',
  'Ointment',
  'Gel',
  'Eye Drop',
  'Ear Drop',
  'Inhaler',
  'Suppository',
] as const;

export type DosageForm = (typeof COMMON_DOSAGE_FORMS)[number];
