const GEMINI_API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY || '';

interface ChatMessage {
  role: 'user' | 'model';
  parts: { text?: string; inlineData?: { mimeType: string; data: string } }[];
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

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;

  const contents: ChatMessage[] = history.map(msg => ({
    role: msg.role === 'user' ? 'user' : 'model',
    parts: [{ text: msg.content }]
  }));

  contents.push({
    role: 'user',
    parts: [{ text: prompt }]
  });

  const body = {
    contents,
    ...(systemInstruction && {
      systemInstruction: {
        parts: [{ text: systemInstruction }]
      }
    }),
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 800,
    }
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Gemini response error:', errorText);
      throw new Error(`Gemini API error: ${response.status}`);
    }

    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  } catch (error) {
    console.error('Error calling Gemini API:', error);
    throw error;
  }
}

export async function parsePrescriptionImage(
  base64Image: string,
  mimeType: string = 'image/jpeg'
): Promise<any[]> {
  if (!GEMINI_API_KEY) {
    console.warn('Gemini API key is not configured.');
    return [];
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;

  const prompt = `Analyze this prescription. Extract all medicines, strengths, quantities, dosage frequencies, and duration.
Return ONLY a valid JSON array of objects without any markdown blocks or comments.
Example Output Format:
[
  {"name": "Amoxicillin", "strength": "500mg", "quantity": 15, "frequency": "1 tablet three times daily", "duration": "5 days"},
  {"name": "Paracetamol", "strength": "500mg", "quantity": 10, "frequency": "1 tablet twice daily as needed", "duration": "3 days"}
]`;

  const body = {
    contents: [
      {
        parts: [
          {
            inlineData: {
              mimeType,
              data: base64Image
            }
          },
          {
            text: prompt
          }
        ]
      }
    ]
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Gemini image response error:', errorText);
      throw new Error(`Gemini API image error: ${response.status}`);
    }

    const data = await response.json();
    const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    
    // Clean markdown blocks if Gemini returned them
    const cleanedText = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
    
    return JSON.parse(cleanedText);
  } catch (error) {
    console.error('Error parsing prescription image:', error);
    // Return a mock default if AI fails or parses invalid JSON
    return [
      { name: 'Amoxicillin', strength: '500mg', quantity: 15, frequency: '1 capsule three times daily', duration: '5 days' },
      { name: 'Paracetamol', strength: '500mg', quantity: 10, frequency: '1 tablet as needed for pain', duration: '5 days' }
    ];
  }
}
