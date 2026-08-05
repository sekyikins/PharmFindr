/** A single medicine extracted from a prescription image by Gemini Vision. */
export interface PrescriptionMedicine {
  name: string;
  genericName?: string | null;
  strength: string | null;
  dosage: string | null;
  frequency: string | null;
  duration: string | null;
  route: string | null;
  instructions: string | null;
  /** Target demographic (e.g., 'Infant / Pediatric', 'Adult', 'Geriatric'). */
  targetDemographic?: string | null;
  /** Advisory note when health parameters like weight or age are needed for dosing. */
  missingParametersNote?: string | null;
  /** 0–100 confidence score from the AI model. */
  confidence: number;
}

/** A single inventory row matched against a prescribed medicine. */
export interface InventoryMatch {
  inventoryId: string;
  medicineName: string;
  genericName?: string | null;
  brandName?: string | null;
  strength: string;
  dosageForm?: string | null;
  manufacturer?: string | null;
  price: number;
  quantity: number;
  pharmacyId: string;
  pharmacyName: string;
  pharmacyPhone: string | null;
}

/** A pharmacy grouped with all the prescribed medicines it stocks. */
export interface PharmacyWithMedicines {
  pharmacyId: string;
  pharmacyName: string;
  pharmacyPhone: string | null;
  medicines: InventoryMatch[];
  /** How many of the prescribed medicines this pharmacy has in stock. */
  matchCount: number;
  /** Total number of medicines from the prescription. */
  totalPrescribed: number;
  latitude?: number;
  longitude?: number;
}
