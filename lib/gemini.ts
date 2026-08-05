import { GoogleGenAI } from "@google/genai";
import type { PrescriptionMedicine } from '@/types/prescription';

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

export async function parsePrescriptionImage(
  base64Image: string,
  mimeType: string = 'image/jpeg'
): Promise<PrescriptionMedicine[]> {
  if (!GEMINI_API_KEY) {
    console.warn('Gemini API key is not configured.');
    return [];
  }

  const prompt = `
You are an expert pharmacist and medical prescription interpreter.

Analyze the attached handwritten or printed prescription.

Extract every prescribed medicine.

For each medicine return:

- name (the brand or printed name on paper, e.g. 'Panadol', 'Augmentin')
- genericName (the canonical active ingredient, e.g. 'Paracetamol', 'Amoxicillin / Clavulanic Acid')
- strength (e.g. '500 mg')
- dosage
- frequency
- duration
- route
- instructions
- targetDemographic (optional: e.g. "Infant / Pediatric", "Adult", "Geriatric", "Neonatal")
- missingParametersNote (optional: e.g. "Infant/Pediatric formulation detected — body weight and exact age required for precise dosing")
- confidence

Rules:

- Return ONLY JSON.
- Never invent medicines.
- Identify the underlying active ingredient (genericName) for both brand names and generic names.
- Identify if the drug formulation is specifically for infants, children, adults, or elderly (set targetDemographic).
- If a drug (e.g., infant drops, pediatric syrups, weight-based antibiotics) requires age, weight, or allergy checks for safe dosing, provide a helpful note in missingParametersNote advising the user to fill out their Health Profile parameters.
- Expand medical abbreviations. (e.g., 'tab' → 'tablet', 'bid' → 'twice daily', 'PCD' → 'Paracetamol', etc.)
- Correct obvious spelling mistakes.
- If unreadable, return null.
- Confidence is an integer from 0 to 100.

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
    "missingParametersNote": "Infant formulation detected — please ensure infant weight and exact age are recorded in your Health Profile for safe dosing verification.",
    "confidence": 94
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

    // Try direct parse first (responseMimeType should give clean JSON)
    try {
      const parsed = JSON.parse(rawText);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      // Fallback: strip markdown fences in case responseMimeType was ignored
      const cleaned = rawText
        .replace(/```json/gi, '')
        .replace(/```/g, '')
        .trim();

      try {
        const parsed = JSON.parse(cleaned);
        return Array.isArray(parsed) ? parsed : [];
      } catch (parseErr: any) {
        console.warn('Could not parse Gemini response as JSON:', parseErr.message);
        console.warn('Raw response (first 500 chars):', rawText.substring(0, 500));
        return [];
      }
    }
  } catch (error: any) {
    console.warn(`Gemini prescription analysis failed:`, error?.message || error);
    return [];
  }
}
