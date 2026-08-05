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

export const MASTER_MEDICINES_CATALOGUE: MedicineItem[] = [
  {
    id: 'paracetamol-500mg',
    name: 'Paracetamol',
    genericName: 'Acetaminophen',
    brandNames: ['Panadol', 'Tylenol', 'Calpol', 'Efamol'],
    strength: '500mg',
    category: 'Pain Relief & Fever',
    dosageForm: 'Tablet',
    dosage: '1–2 Tablets',
    frequency: 'Every 4–6 Hours',
    duration: 'As needed (max 3 days for fever)',
    uses: 'Effective relief for mild-to-moderate pain including headaches, muscle aches, toothaches, backaches, and fever reduction associated with colds or flu.',
    howToTake: 'Take with a full glass of water with or without food. Do not exceed 4,000mg (8 tablets) in any 24-hour period to prevent liver damage.',
    sideEffects: 'Generally very safe at recommended doses. Rare side effects include skin rash or allergic reactions.',
    warnings: 'Avoid taking with other acetaminophen-containing products or alcohol. Use with caution in patients with severe liver impairment.',
    contraindications: 'Severe hepatic impairment, hypersensitivity to acetaminophen.',
    storage: 'Store below 30°C in a cool, dry place away from direct sunlight.',
    alternatives: ['Ibuprofen 400mg', 'Aspirin 300mg', 'Diclofenac 50mg'],
    fdaStatus: 'FDA Approved (Essential OTC Medicine)',
    estimatedPriceRange: 'GH₵ 5.00 – GH₵ 15.00',
  },
  {
    id: 'amoxicillin-500mg',
    name: 'Amoxicillin',
    genericName: 'Amoxicillin Trihydrate',
    brandNames: ['Augmentin', 'Amoxil', 'Trimox', 'Moxatag'],
    strength: '500mg',
    category: 'Antibiotics',
    dosageForm: 'Capsule',
    dosage: '1 Capsule',
    frequency: '3× Daily (every 8 hours)',
    duration: '5–7 Days',
    uses: 'Broad-spectrum antibiotic used to treat bacterial infections of the respiratory tract, ear/nose/throat, urinary tract, and skin.',
    howToTake: 'Take at evenly spaced intervals with or without food. Swallow capsules whole with water. Complete full prescribed course even if symptoms improve.',
    sideEffects: 'Common: Nausea, diarrhea, mild stomach discomfort. Rare: Allergic reactions (hives, difficulty breathing, facial swelling).',
    warnings: 'Inform healthcare providers of penicillin allergies. May reduce effectiveness of oral contraceptive pills.',
    contraindications: 'History of penicillin or cephalosporin allergy.',
    storage: 'Keep tightly closed at room temperature below 25°C.',
    alternatives: ['Ampicillin 500mg', 'Azithromycin 250mg', 'Cefuroxime 500mg'],
    fdaStatus: 'FDA Approved (Rx Prescription Required)',
    estimatedPriceRange: 'GH₵ 25.00 – GH₵ 60.00',
  },
  {
    id: 'ibuprofen-400mg',
    name: 'Ibuprofen',
    genericName: 'Ibuprofen',
    brandNames: ['Advil', 'Nurofen', 'Motrin', 'Brufen'],
    strength: '400mg',
    category: 'Pain Relief & Fever',
    dosageForm: 'Tablet',
    dosage: '1 Tablet',
    frequency: '3× Daily (after food)',
    duration: '3–5 Days',
    uses: 'Non-steroidal anti-inflammatory drug (NSAID) used to relieve pain, swelling, and inflammation from arthritis, dental pain, dysmenorrhea, and athletic injuries.',
    howToTake: 'Must be taken immediately after a meal or snack with water to protect stomach lining.',
    sideEffects: 'Common: Indigestion, heartburn, stomach distress, dizziness. Rare: Gastrointestinal bleeding or ulceration.',
    warnings: 'Do not use if you have history of stomach ulcers, asthma triggered by NSAIDs, or severe heart failure.',
    contraindications: 'Active peptic ulcer, third trimester of pregnancy, severe renal or cardiac failure.',
    storage: 'Store in dry container away from moisture.',
    alternatives: ['Naproxen 250mg', 'Diclofenac 50mg', 'Paracetamol 500mg'],
    fdaStatus: 'FDA Approved (OTC / Rx)',
    estimatedPriceRange: 'GH₵ 10.00 – GH₵ 25.00',
  },
  {
    id: 'metformin-850mg',
    name: 'Metformin',
    genericName: 'Metformin Hydrochloride',
    brandNames: ['Glucophage', 'Fortamet', 'Riomet'],
    strength: '850mg',
    category: 'Diabetes & Metabolism',
    dosageForm: 'Tablet',
    dosage: '1 Tablet',
    frequency: '2× Daily',
    duration: 'Ongoing maintenance',
    uses: 'First-line medication for Type 2 Diabetes Mellitus to lower blood sugar levels and improve insulin sensitivity.',
    howToTake: 'Take during or immediately after morning and evening meals to minimize GI side effects.',
    sideEffects: 'Common: Nausea, diarrhea, abdominal cramps, metallic taste. Rare: Lactic acidosis.',
    warnings: 'Periodic renal function and Vitamin B12 level monitoring is recommended.',
    contraindications: 'Severe renal impairment (eGFR < 30 mL/min), acute metabolic acidosis.',
    storage: 'Store at controlled room temperature 20°C to 25°C.',
    alternatives: ['Glipizide 5mg', 'Glibenclamide 5mg', 'Sitagliptin 100mg'],
    fdaStatus: 'FDA Approved (Rx Chronic Care)',
    estimatedPriceRange: 'GH₵ 30.00 – GH₵ 75.00',
  },
  {
    id: 'lisinopril-10mg',
    name: 'Lisinopril',
    genericName: 'Lisinopril',
    brandNames: ['Zestril', 'Prinivil'],
    strength: '10mg',
    category: 'Heart & Blood Pressure',
    dosageForm: 'Tablet',
    dosage: '1 Tablet',
    frequency: '1× Daily',
    duration: 'Ongoing maintenance',
    uses: 'ACE inhibitor prescribed for hypertension (high blood pressure) and heart failure management, helping lower risk of stroke or heart attack.',
    howToTake: 'Take at the same time every morning with water. Maintain adequate daily hydration.',
    sideEffects: 'Common: Persistent dry cough, lightheadedness. Rare: Angioedema (swelling of face/lip/tongue).',
    warnings: 'Strictly prohibited during pregnancy as it causes fetal toxicity.',
    contraindications: 'Pregnancy, history of angioedema related to ACE inhibitors.',
    storage: 'Protect from light and moisture.',
    alternatives: ['Losartan 50mg', 'Amlodipine 5mg', 'Enalapril 10mg'],
    fdaStatus: 'FDA Approved (Rx Chronic Care)',
    estimatedPriceRange: 'GH₵ 20.00 – GH₵ 50.00',
  },
  {
    id: 'omeprazole-20mg',
    name: 'Omeprazole',
    genericName: 'Omeprazole',
    brandNames: ['Prilosec', 'Losec', 'Omez', 'Zegerid'],
    strength: '20mg',
    category: 'Gastrointestinal',
    dosageForm: 'Capsule',
    dosage: '1 Capsule',
    frequency: '1× Daily (before breakfast)',
    duration: '14 Days or as prescribed',
    uses: 'Proton pump inhibitor (PPI) that decreases stomach acid production to treat acid reflux (GERD), heartburn, and stomach ulcers.',
    howToTake: 'Swallow whole with water at least 30 minutes before your first meal of the day. Do not chew or crush capsules.',
    sideEffects: 'Common: Headache, abdominal pain, flatulence, mild constipation.',
    warnings: 'Long-term use (>1 year) may reduce Vitamin B12 and magnesium absorption.',
    contraindications: 'Hypersensitivity to PPIs, concurrent use with nelfinavir.',
    storage: 'Store in dry place below 25°C.',
    alternatives: ['Esomeprazole 40mg', 'Pantoprazole 40mg', 'Ranitidine 150mg'],
    fdaStatus: 'FDA Approved (OTC / Rx)',
    estimatedPriceRange: 'GH₵ 15.00 – GH₵ 40.00',
  },
  {
    id: 'cetirizine-10mg',
    name: 'Cetirizine',
    genericName: 'Cetirizine Hydrochloride',
    brandNames: ['Zyrtec', 'Cetrine', 'Alerid'],
    strength: '10mg',
    category: 'Allergy & Cold',
    dosageForm: 'Tablet',
    dosage: '1 Tablet',
    frequency: '1× Daily (evening)',
    duration: 'As needed for allergy relief',
    uses: 'Second-generation antihistamine for relief of allergic rhinitis, sneezing, runny nose, itchy eyes, and chronic hives (urticaria).',
    howToTake: 'Take once daily in the evening with water, with or without food.',
    sideEffects: 'Common: Mild drowsiness, dry mouth, tiredness.',
    warnings: 'Avoid driving or operating heavy machinery if experiencing drowsiness.',
    contraindications: 'End-stage renal disease (eGFR < 10 mL/min).',
    storage: 'Store between 15°C and 30°C.',
    alternatives: ['Loratadine 10mg', 'Fexofenadine 120mg', 'Levocetirizine 5mg'],
    fdaStatus: 'FDA Approved (OTC Essential)',
    estimatedPriceRange: 'GH₵ 8.00 – GH₵ 20.00',
  },
  {
    id: 'azithromycin-500mg',
    name: 'Azithromycin',
    genericName: 'Azithromycin Dihydrate',
    brandNames: ['Zithromax', 'Azithrocin', 'Z-Pak'],
    strength: '500mg',
    category: 'Antibiotics',
    dosageForm: 'Tablet',
    dosage: '1 Tablet',
    frequency: '1× Daily',
    duration: '3–5 Days',
    uses: 'Macrolide antibiotic prescribed for chest infections, throat infections, skin infections, and sexually transmitted infections.',
    howToTake: 'Take 1 hour before or 2 hours after meals with water for optimal absorption.',
    sideEffects: 'Common: Loose stools, abdominal cramps, nausea.',
    warnings: 'Inform doctor if you have history of QT prolongation or heart arrhythmia.',
    contraindications: 'History of cholestatic jaundice/hepatic dysfunction associated with prior azithromycin use.',
    storage: 'Store below 30°C in dry container.',
    alternatives: ['Clarithromycin 500mg', 'Erythromycin 500mg', 'Amoxicillin 500mg'],
    fdaStatus: 'FDA Approved (Rx Prescription)',
    estimatedPriceRange: 'GH₵ 35.00 – GH₵ 80.00',
  },
  {
    id: 'artemether-lumefantrine-80-480',
    name: 'Artemether + Lumefantrine',
    genericName: 'Artemether / Lumefantrine',
    brandNames: ['Coartem', 'Lonart', 'Artefan', 'Riamet'],
    strength: '80mg / 480mg',
    category: 'Antimalarial',
    dosageForm: 'Tablet',
    dosage: '1 Tablet',
    frequency: '2× Daily for 3 Days (total 6 doses)',
    duration: '3 Days (complete 6-dose course)',
    uses: 'Artemisinin-based combination therapy (ACT) for rapid treatment of uncomplicated Plasmodium falciparum malaria infection.',
    howToTake: 'Take with high-fat food or milk (such as tea with milk or a snack) to ensure full absorption of lumefantrine.',
    sideEffects: 'Common: Loss of appetite, dizziness, joint pain, fatigue.',
    warnings: 'Must complete the entire 6-dose regimen over 3 days to eradicate malaria parasites.',
    contraindications: 'First trimester of pregnancy (unless no alternative), severe malaria with complications.',
    storage: 'Store in dry place protected from light.',
    alternatives: ['Artesunate-Amodiaquine', 'Dihydroartemisinin-Piperaquine (P-Alaxin)'],
    fdaStatus: 'FDA Approved (National Essential Medicine)',
    estimatedPriceRange: 'GH₵ 20.00 – GH₵ 45.00',
  },
  {
    id: 'ciprofloxacin-500mg',
    name: 'Ciprofloxacin',
    genericName: 'Ciprofloxacin Hydrochloride',
    brandNames: ['Cipro', 'Ciprobay', 'Cifran'],
    strength: '500mg',
    category: 'Antibiotics',
    dosageForm: 'Tablet',
    dosage: '1 Tablet',
    frequency: '2× Daily (every 12 hours)',
    duration: '5–10 Days',
    uses: 'Fluoroquinolone antibiotic for urinary tract infections (UTIs), severe gastrointestinal bacterial infections, and typhoid fever.',
    howToTake: 'Take with full glass of water. Avoid taking with dairy products, calcium, or antacids within 2 hours.',
    sideEffects: 'Common: Nausea, diarrhea. Rare: Tendonitis or tendon rupture.',
    warnings: 'Discontinue immediately if experiencing tendon pain or joint inflammation.',
    contraindications: 'Hypersensitivity to fluoroquinolones, concomitant administration with tizanidine.',
    storage: 'Store below 25°C.',
    alternatives: ['Levofloxacin 500mg', 'Ofloxacin 400mg', 'Co-trimoxazole 960mg'],
    fdaStatus: 'FDA Approved (Rx Prescription)',
    estimatedPriceRange: 'GH₵ 20.00 – GH₵ 55.00',
  },
];

/**
 * Searches the master medicine catalogue and dynamic database for matching medicines.
 */
export async function searchMasterMedicines(query: string, categoryFilter?: string): Promise<MedicineItem[]> {
  const trimmed = query.trim().toLowerCase();
  
  // 1. Filter local master list
  let matches = MASTER_MEDICINES_CATALOGUE.filter((m) => {
    const nameMatch = m.name.toLowerCase().includes(trimmed);
    const genericMatch = m.genericName.toLowerCase().includes(trimmed);
    const brandMatch = m.brandNames.some((b) => b.toLowerCase().includes(trimmed));
    const categoryMatch = m.category.toLowerCase().includes(trimmed);

    if (categoryFilter && categoryFilter !== 'All') {
      return (nameMatch || genericMatch || brandMatch) && m.category.toLowerCase().includes(categoryFilter.toLowerCase());
    }

    return nameMatch || genericMatch || brandMatch || categoryMatch;
  });

  // 2. Query Supabase database inventory/medicines table to discover additional medicines dynamically
  try {
    const { data: dbMeds } = await supabase
      .from('inventory')
      .select('id, medicine_name, generic_name, brand_name, strength, dosage_form, price')
      .or(`medicine_name.ilike.%${trimmed}%,generic_name.ilike.%${trimmed}%,brand_name.ilike.%${trimmed}%`)
      .limit(20);

    if (dbMeds && dbMeds.length > 0) {
      const existingNames = new Set(matches.map((m) => m.name.toLowerCase()));
      
      for (const row of dbMeds) {
        const medName = row.medicine_name || row.generic_name || 'Medicine';
        if (!existingNames.has(medName.toLowerCase())) {
          existingNames.add(medName.toLowerCase());
          matches.push({
            id: `db-${row.id}`,
            name: medName,
            genericName: row.generic_name || medName,
            brandNames: row.brand_name ? [row.brand_name] : [],
            strength: row.strength || 'Standard',
            category: 'Pharmacy Inventory',
            dosageForm: row.dosage_form || 'Tablet/Capsule',
            dosage: '1 Dose',
            frequency: 'As directed by pharmacist',
            duration: 'As prescribed',
            uses: `PharmFindr catalogue record for ${medName}. Consult your pharmacist or physician for detailed medical guidance.`,
            howToTake: 'Follow dosage instructions provided on the packaging or by your dispensing pharmacist.',
            sideEffects: 'Consult your prescribing doctor or pharmacist for full safety information.',
            warnings: 'Keep out of reach of children. Store safely.',
            contraindications: 'Consult healthcare professional prior to use.',
            storage: 'Store in a cool dry place below 30°C.',
            alternatives: [],
            fdaStatus: 'Registered Pharmacy Supply',
            estimatedPriceRange: row.price ? `GH₵ ${(parseFloat(row.price)).toFixed(2)}` : 'Varies by pharmacy',
          });
        }
      }
    }
  } catch (e: any) {
    console.warn('DB catalogue query fallback:', e.message);
  }

  return matches;
}

/**
 * Retrieves a medicine by ID or Name.
 */
export function getMedicineByIdOrName(identifier: string): MedicineItem {
  const found = MASTER_MEDICINES_CATALOGUE.find(
    (m) => m.id === identifier || m.name.toLowerCase() === identifier.toLowerCase()
  );

  if (found) return found;

  // Fallback dynamic object
  return {
    id: identifier,
    name: identifier,
    genericName: identifier,
    brandNames: [],
    strength: 'Standard Dosage',
    category: 'Essential Medicine',
    dosageForm: 'Tablet/Capsule',
    dosage: '1 Unit',
    frequency: 'As directed by physician',
    duration: 'As prescribed',
    uses: `Medical details for ${identifier}. Always consult a registered pharmacist or physician for exact usage and dosage guidelines.`,
    howToTake: 'Take with water as directed by your healthcare professional.',
    sideEffects: 'Consult your prescribing physician for potential side effects.',
    warnings: 'Store out of reach of children.',
    contraindications: 'Hypersensitivity to active ingredient.',
    storage: 'Store in a cool, dry place.',
    alternatives: ['Paracetamol 500mg', 'Amoxicillin 500mg'],
    fdaStatus: 'FDA Registered Medical Compound',
    estimatedPriceRange: 'GH₵ 10.00 – GH₵ 50.00',
  };
}
