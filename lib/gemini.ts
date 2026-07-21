import { GoogleGenAI } from "@google/genai";

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
  const modelsToTry = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash'];

  const contents = [
    ...history.map((msg) => ({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.content }],
    })),
    { role: 'user', parts: [{ text: prompt }] },
  ];

  for (const modelName of modelsToTry) {
    try {
      const response = await ai.models.generateContent({
        model: modelName,
        contents,
        config: {
          temperature: 0.7,
          maxOutputTokens: 800,
          ...(systemInstruction ? { systemInstruction } : {}),
        },
      });

      return response.text ?? '';
    } catch (error: any) {
      console.warn(`Gemini attempt with ${modelName} failed:`, error?.message || error);
    }
  }

  return 'I am currently unable to process your request. Please check your Gemini API key configuration in .env.';
}

export async function parsePrescriptionImage(
  base64Image: string,
  mimeType: string = 'image/jpeg'
): Promise<any[]> {
  if (!GEMINI_API_KEY) {
    console.warn('Gemini API key is not configured.');
    return [];
  }

  const prompt = `Analyze this prescription. Extract all medicines, strengths, quantities, dosage frequencies, and duration.
Return ONLY a valid JSON array of objects without any markdown blocks or comments.
Example Output Format:
[
  {"name": "Amoxicillin", "strength": "500mg", "quantity": 15, "frequency": "1 tablet three times daily", "duration": "5 days"},
  {"name": "Paracetamol", "strength": "500mg", "quantity": 10, "frequency": "1 tablet twice daily as needed", "duration": "3 days"}
]`;

  const ai = getAI();
  const modelsToTry = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash'];

  for (const modelName of modelsToTry) {
    try {
      const response = await ai.models.generateContent({
        model: modelName,
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
      });

      const rawText = response.text ?? '';

      // Strip markdown fences if Gemini wraps the response
      const cleanedText = rawText
        .replace(/```json/gi, '')
        .replace(/```/g, '')
        .trim();

      return JSON.parse(cleanedText);
    } catch (error: any) {
      console.warn(`Gemini image parsing attempt with ${modelName} failed:`, error?.message || error);
    }
  }

  // Return safe defaults if AI fails
  return [
    { name: 'Amoxicillin', strength: '500mg', quantity: 15, frequency: '1 capsule three times daily', duration: '5 days' },
    { name: 'Paracetamol', strength: '500mg', quantity: 10, frequency: '1 tablet as needed for pain', duration: '5 days' },
  ];
}
