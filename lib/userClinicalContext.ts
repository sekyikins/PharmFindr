import * as ExpoLocation from 'expo-location';
import { useAuthStore } from '@/store/authStore';
import { getCurrentLocation, Coords } from '@/lib/location';

export interface DynamicUserContext {
  fullName: string | null;
  age: number | null;
  gender: string | null;
  weightKg: number | null;
  heightCm: number | null;
  bmi: string | null;
  allergies: string[];
  existingConditions: string[];
  currentMedications: string[];
  location: {
    latitude: number | null;
    longitude: number | null;
    city: string | null;
    region: string | null;
    country: string | null;
    isoCountryCode: string | null;
  };
}

/**
 * Dynamically retrieves user profile, health parameters, and live device location.
 * Does NOT hardcode any country or regional rules — relies 100% on live user & device data.
 */
export async function getDynamicUserContext(): Promise<DynamicUserContext> {
  const { profile, appUser } = useAuthStore.getState();

  const weight = appUser?.weight ?? null;
  const height = appUser?.height ?? null;

  let bmiStr: string | null = null;
  if (weight && height && height > 0) {
    const bmiVal = weight / Math.pow(height / 100, 2);
    bmiStr = bmiVal.toFixed(1);
  }

  // Fetch live GPS coordinates
  let coords: Coords | null = null;
  try {
    coords = await getCurrentLocation();
  } catch (e) {
    coords = null;
  }

  // Reverse geocode to get live city/region/country name without any hardcoding
  let city: string | null = null;
  let region: string | null = null;
  let country: string | null = null;
  let isoCountryCode: string | null = null;

  if (coords) {
    try {
      const geocoded = await ExpoLocation.reverseGeocodeAsync({
        latitude: coords.latitude,
        longitude: coords.longitude,
      });

      if (geocoded && geocoded.length > 0) {
        const primary = geocoded[0];
        city = primary.city || primary.subregion || primary.name || null;
        region = primary.region || null;
        country = primary.country || null;
        isoCountryCode = primary.isoCountryCode || null;
      }
    } catch (e) {
      console.warn('Reverse geocoding error:', e);
    }
  }

  return {
    fullName: appUser?.full_name || profile?.full_name || null,
    age: appUser?.age ?? null,
    gender: appUser?.gender ?? null,
    weightKg: weight,
    heightCm: height,
    bmi: bmiStr,
    allergies: appUser?.allergies ?? [],
    existingConditions: appUser?.existing_conditions ?? [],
    currentMedications: appUser?.current_medications ?? [],
    location: {
      latitude: coords?.latitude ?? null,
      longitude: coords?.longitude ?? null,
      city,
      region,
      country,
      isoCountryCode,
    },
  };
}

/**
 * Builds the AI system instruction dynamically fed with live user data,
 * physical metrics, clinical profile, and GPS location.
 */
export async function buildDynamicSystemInstruction(activeConsultationMeds?: any[]): Promise<string> {
  const ctx = await getDynamicUserContext();

  const userContextLines: string[] = [];

  // Demographics & Physical Metrics
  if (ctx.fullName) userContextLines.push(`- Full Name: ${ctx.fullName}`);
  if (ctx.age) userContextLines.push(`- Age: ${ctx.age} years`);
  if (ctx.gender) userContextLines.push(`- Gender: ${ctx.gender}`);
  if (ctx.weightKg) userContextLines.push(`- Weight: ${ctx.weightKg} kg`);
  if (ctx.heightCm) userContextLines.push(`- Height: ${ctx.heightCm} cm`);
  if (ctx.bmi) userContextLines.push(`- Body Mass Index (BMI): ${ctx.bmi}`);

  // Health Guardrails & Profile Data
  userContextLines.push(
    `- Reported Allergies: ${ctx.allergies.length > 0 ? ctx.allergies.join(', ') : 'None listed'}`
  );
  userContextLines.push(
    `- Medical Conditions: ${ctx.existingConditions.length > 0 ? ctx.existingConditions.join(', ') : 'None listed'}`
  );
  userContextLines.push(
    `- Current Active Medications: ${ctx.currentMedications.length > 0 ? ctx.currentMedications.join(', ') : 'None listed'}`
  );

  // Live Geographic & Location Context
  const locationParts: string[] = [];
  if (ctx.location.city) locationParts.push(ctx.location.city);
  if (ctx.location.region) locationParts.push(ctx.location.region);
  if (ctx.location.country) locationParts.push(ctx.location.country);

  const coordsStr =
    ctx.location.latitude != null && ctx.location.longitude != null
      ? `(Coordinates: ${ctx.location.latitude.toFixed(4)}, ${ctx.location.longitude.toFixed(4)})`
      : '';
  const locationStr =
    locationParts.length > 0
      ? `${locationParts.join(', ')}${coordsStr ? ` ${coordsStr}` : ''}`
      : coordsStr || 'Not available';

  userContextLines.push(`- Current Location: ${locationStr}`);

  let systemPrompt = `You are a professional AI Health Assistant inside the PharmFindr mobile app.

LIVE USER PROFILE & LOCATION DATA:
${userContextLines.join('\n')}

DYNAMIC RESPONSIBILITY INSTRUCTIONS:
1. INDIVIDUALIZED GUIDANCE: Automatically adapt all dosage, safety, and health advice to the user's specific data (Age: ${ctx.age || 'Not specified'}, Gender: ${ctx.gender || 'Not specified'}, Weight: ${ctx.weightKg ? ctx.weightKg + 'kg' : 'Not specified'}, Allergies: ${ctx.allergies.join(', ') || 'None'}, Conditions: ${ctx.existingConditions.join(', ') || 'None'}, Current Meds: ${ctx.currentMedications.join(', ') || 'None'}).
2. DEMOGRAPHIC & TARGET GROUP CLARITY: Identify if a drug or formulation discussed is specifically designed for infants, children, adults, or elderly. Explicitly state the target demographic (e.g., "👶 Note: This formulation is intended for infants/pediatric use").
3. MISSING PROFILE ADVISORY RULE: If key health parameters (such as Age, Weight, Gender, Allergies, or Existing Conditions) are 'Not specified' in the profile above and are necessary for safe dosage calculation or contraindication checking, explicitly inform the user which parameters are missing and politely recommend that they complete their **Health Profile** in app settings (Profile → Health Profile) for optimal safety analysis.
4. SAFETY ALERTS: If a requested medicine conflicts with the user's reported allergies or interacts with their active medications, prominently highlight the warning in bold at the start of your response and clarify if prescription is for another person instead.
5. LOCATION RELEVANCE: Utilize the user's current location (${locationStr}) to provide relevant regional emergency guidelines, local health authority contact numbers, and local healthcare protocols appropriate for their country/region.
6. TONE & FORMAT: Answer questions directly without generic introductory greetings. Present information clearly with bullet points and bold headers. Use '➔' for arrows or direction indicators instead of ASCII symbols like '->', '-->', or literal '\\n' text.
7. End medical advice with a single short disclaimer encouraging consultation with a licensed pharmacist or healthcare provider, when necessary (according to context of query and response).`;

  if (activeConsultationMeds && activeConsultationMeds.length > 0) {
    const rxSummary = activeConsultationMeds
      .map((m: any) => `${m.name || m.genericName} (${m.strength || ''}, ${m.dosage || ''}, ${m.frequency || ''})`)
      .join('; ');
    systemPrompt += `\n\nACTIVE PRESCRIPTION CONSULTATION CONTEXT: The user is currently asking about: ${rxSummary}. Cross-reference these medicines with their profile data.`;
  }

  return systemPrompt;
}
