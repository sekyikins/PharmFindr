import { GoogleGenAI } from "@google/genai";
import type { PrescriptionMedicine } from '@/types/prescription';
import { supabase } from '@/lib/supabase';

const GEMINI_API_KEY = (process.env.EXPO_PUBLIC_GEMINI_API_KEY || '').trim();

// Lazily create client so we don't crash on missing key
let _ai: GoogleGenAI | null = null;
function getAI(): GoogleGenAI {
  if (!_ai) {
    _ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
  }
  return _ai;
}

export async function askGemini(
  prompt: string,
  history: { role: 'user' | 'assistant'; content: string }[] = [],
  systemInstruction?: string
): Promise<string> {
  if (!GEMINI_API_KEY) {
    console.warn('Gemini API key is not configured.');
    return 'Gemini AI is currently offline. Please configure your API key.';
  }

  const ai = getAI();

  // Valid Gemini model identifiers supported by the Google GenAI API v1beta
  const MODEL = "gemini-3.6-flash"

  const contents = [
    ...history.map((msg) => ({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.content }],
    })),
    { role: 'user', parts: [{ text: prompt }] },
  ];

  try {
    const response = await ai.models.generateContent({
      model: MODEL,
      contents,
      config: {
        temperature: 0.7,
        maxOutputTokens: 2048,
        ...(systemInstruction ? { systemInstruction } : {}),
      },
    });

    const text = response.text ?? '';
    if (text.trim()) {
      return text;
    }
  } catch (error: any) {
    console.warn(`Gemini attempt with ${MODEL} failed:`, error?.message || error);
  }

  return 'I am currently unable to process your request. Please check your Gemini API key configuration in .env.';
}

/**
 * Cross-references raw OCR extractions against official Supabase medicine_products
 * and generic_medicines tables to verify and canonicalize medical entities.
 */
async function validateAndEnrichPrescriptionMedicines(
  rawList: PrescriptionMedicine[]
): Promise<PrescriptionMedicine[]> {
  if (!rawList || rawList.length === 0) return [];

  const verifiedList: PrescriptionMedicine[] = [];

  for (const item of rawList) {
    const medName = item.name?.trim();
    const genericName = item.genericName?.trim() || medName;

    if (!medName && !genericName) continue;

    try {
      const [{ data: prodMatches }, { data: genMatches }] = await Promise.all([
        supabase
          .from('medicine_products')
          .select(`
            id,
            brand_name,
            strength,
            dosage_form,
            generic_medicines (
              id,
              generic_name
            )
          `)
          .or(`brand_name.ilike.%${medName}%,brand_name.ilike.%${genericName}%`)
          .limit(1),
        supabase
          .from('generic_medicines')
          .select('id, generic_name, dosage_forms')
          .or(`generic_name.ilike.%${genericName}%,generic_name.ilike.%${medName}%`)
          .limit(1),
      ]);

      if (prodMatches && prodMatches.length > 0) {
        const prod = prodMatches[0];
        const gen = Array.isArray(prod.generic_medicines) ? prod.generic_medicines[0] : prod.generic_medicines;
        verifiedList.push({
          ...item,
          name: prod.brand_name || item.name,
          genericName: gen?.generic_name || item.genericName || prod.brand_name,
          strength: item.strength || prod.strength || 'Standard Dosage',
          confidence: Math.max(item.confidence || 85, 95),
        });
      } else if (genMatches && genMatches.length > 0) {
        const gen = genMatches[0];
        verifiedList.push({
          ...item,
          genericName: gen.generic_name,
          confidence: Math.max(item.confidence || 80, 90),
        });
      } else {
        // Retain candidate if confidence is acceptable
        if ((item.confidence ?? 70) >= 40) {
          verifiedList.push(item);
        }
      }
    } catch (dbErr: any) {
      console.warn('Post-OCR database validation warning:', dbErr.message);
      verifiedList.push(item);
    }
  }

  return verifiedList;
}

export async function parsePrescriptionImage(
  base64Image: string,
  mimeType: string = 'image/jpeg'
): Promise<PrescriptionMedicine[]> {
  if (!GEMINI_API_KEY) {
    console.warn('Gemini API key is not configured.');
    return [];
  }

  const prompt = `
You are an expert pharmacist and medical prescription OCR interpreter.

Analyze the attached handwritten or printed prescription image.

Extract every verified prescribed medicine.

For each medicine return:
- name (the standard, correctly spelled brand or printed medicine name, e.g. 'Panadol', 'Augmentin')
- genericName (the canonical active pharmaceutical ingredient, e.g. 'Paracetamol', 'Amoxicillin / Clavulanic Acid')
- strength (e.g. '500 mg')
- dosage (e.g. '1 tablet', '5 mL')
- frequency (e.g. 'Twice daily', 'Every 8 hours')
- duration (e.g. '5 days')
- route (e.g. 'Oral')
- instructions (e.g. 'Take after meals')
- targetDemographic (optional: e.g. "Infant / Pediatric", "Adult", "Geriatric", "Neonatal")
- confidence (integer from 0 to 100)

CRITICAL RULES:
1. ALWAYS output a standard, correctly spelled, real drug name in 'name' and 'genericName', even if the doctor or prescription spelt it incorrectly or abbreviated it.
2. IF AN ITEM IS AN UNKNOWN DRUG, illegible scribble, non-medication, or cannot be identified with high confidence as a real pharmaceutical medicine, DO NOT output anything for that specific item. Completely omit unknown or unverified items from the output array.
3. Return ONLY a valid JSON array of objects. Do not include markdown code blocks or explanatory text.
4. Expand standard medical abbreviations (e.g., 'tab' → 'Tablet', 'bid' / 'bd' → 'Twice daily', 'tid' / 'tds' → 'Three times daily', 'qid' / 'qds' → 'Four times daily', 'po' → 'Oral', 'prn' → 'As needed', 'PCD' → 'Paracetamol').

Example:
[
  {
    "name": "Augmentin Drops",
    "genericName": "Amoxicillin / Clavulanic Acid",
    "strength": "100 mg / 12.5 mg per mL",
    "dosage": "0.5 mL",
    "frequency": "Three times daily",
    "duration": "5 days",
    "route": "Oral",
    "instructions": "Administer 0.5 mL 8-hourly after feeding",
    "targetDemographic": "Infant / Pediatric",
    "confidence": 95
  }
]
`;

  const ai = getAI();
  const MODEL = "gemini-3.6-flash";

  try {
    const response = await ai.models.generateContent({
      model: MODEL,
      contents: [
        {
          parts: [
            {
              inlineData: {
                mimeType,
                data: base64Image,
              },
            },
            { text: prompt },
          ],
        },
      ],
      config: {
        temperature: 0.2,
        maxOutputTokens: 4096,
        responseMimeType: 'application/json',
      },
    });

    const rawText = (response.text ?? '').trim();

    if (!rawText) {
      console.warn('Gemini returned empty response for prescription image.');
      return [];
    }

    let parsed: PrescriptionMedicine[] = [];

    // Try direct parse first (responseMimeType should give clean JSON)
    try {
      const jsonRes = JSON.parse(rawText);
      parsed = Array.isArray(jsonRes) ? jsonRes : [];
    } catch {
      // Fallback: strip markdown fences in case responseMimeType was ignored
      const cleaned = rawText
        .replace(/```json/gi, '')
        .replace(/```/g, '')
        .trim();

      try {
        const jsonRes = JSON.parse(cleaned);
        parsed = Array.isArray(jsonRes) ? jsonRes : [];
      } catch (parseErr: any) {
        console.warn('Could not parse Gemini response as JSON:', parseErr.message);
        console.warn('Raw response (first 500 chars):', rawText.substring(0, 500));
        return [];
      }
    }

    // Post-OCR database verification & normalization against generic_medicines & medicine_products
    return await validateAndEnrichPrescriptionMedicines(parsed);
  } catch (error: any) {
    console.warn(`Gemini prescription analysis failed:`, error?.message || error);
    return [];
  }
}

