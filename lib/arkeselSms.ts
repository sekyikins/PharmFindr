/**
 * Arkesel SMS & OTP Service Integration
 *
 * SMS:  POST https://sms.arkesel.com/sms/api?action=send-sms  (plain SMS)
 * OTP:  POST https://sms.arkesel.com/api/otp/generate         (generate + send)
 *       POST https://sms.arkesel.com/api/otp/verify           (verify code)
 *
 * NOTE: Use the Main API Key — OTP will NOT work with Multiple/Sub API Keys.
 */

const ARKESEL_API_KEY = (process.env.EXPO_PUBLIC_ARKESEL_API_KEY || '').trim();
const SENDER_ID = 'PharmFindr';

// ─── Ghana Network Prefix Map ─────────────────────────────────────────────────
// Used to validate phone numbers BEFORE spending credits on an SMS/OTP send.
const GHANA_PREFIXES: { prefix: string; network: string }[] = [
  // MTN
  { prefix: '024', network: 'MTN' },
  { prefix: '054', network: 'MTN' },
  { prefix: '055', network: 'MTN' },
  { prefix: '059', network: 'MTN' },
  { prefix: '025', network: 'MTN' },
  { prefix: '023', network: 'MTN' },
  // AirtelTigo
  { prefix: '027', network: 'AirtelTigo' },
  { prefix: '057', network: 'AirtelTigo' },
  { prefix: '026', network: 'AirtelTigo' },
  { prefix: '056', network: 'AirtelTigo' },
  // Telecel (formerly Vodafone)
  { prefix: '030', network: 'Telecel' },
  { prefix: '020', network: 'Telecel' },
  { prefix: '050', network: 'Telecel' },
];

/**
 * Validate and identify a Ghana phone number.
 * Accepts local format (0XXXXXXXXX) or international (233XXXXXXXXX / +233XXXXXXXXX).
 * Returns { valid, formatted, network } where `formatted` is the E.164 number
 * WITHOUT the leading '+', e.g. "233551234567".
 */
export function validateGhanaPhone(phone: string): {
  valid: boolean;
  formatted: string;
  network: string | null;
  error?: string;
} {
  // Strip all non-digit characters
  const digits = phone.replace(/\D/g, '');

  let local: string; // always in local 10-digit 0XXXXXXXXX format

  if (digits.startsWith('233') && digits.length === 12) {
    local = '0' + digits.slice(3);
  } else if (digits.startsWith('0') && digits.length === 10) {
    local = digits;
  } else {
    return {
      valid: false,
      formatted: digits,
      network: null,
      error:
        'Enter a valid Ghana phone number (e.g. 0551234567 or +233551234567).',
    };
  }

  const prefix = local.slice(0, 3);
  const match = GHANA_PREFIXES.find((p) => p.prefix === prefix);

  if (!match) {
    return {
      valid: false,
      formatted: digits,
      network: null,
      error: `Unrecognised network. Supported networks: MTN, Vodafone, AirtelTigo, Telecel.`,
    };
  }

  // Reformat to E.164-without-plus for Arkesel (e.g. "233551234567")
  const formatted = '233' + local.slice(1);

  return { valid: true, formatted, network: match.network };
}

// ─── Plain SMS (V1) ───────────────────────────────────────────────────────────

/**
 * Format phone number for Arkesel SMS API (V1).
 * Converts local Ghana numbers like 0551234567 → 233551234567, or preserves full.
 * @deprecated Use validateGhanaPhone() instead, which also checks network validity.
 */
export function formatPhoneNumber(phone: string): string {
  let cleaned = phone.replace(/\D/g, '');
  if (cleaned.startsWith('0') && cleaned.length === 10) {
    cleaned = '233' + cleaned.substring(1);
  }
  return cleaned;
}

/**
 * Send a plain SMS via Arkesel SMS API (V1 GET endpoint).
 */
export async function sendSms(
  to: string,
  message: string,
): Promise<{ success: boolean; data?: any; error?: string }> {
  const formattedPhone = formatPhoneNumber(to);
  if (!formattedPhone) {
    return { success: false, error: 'Invalid phone number format.' };
  }

  const url =
    `https://sms.arkesel.com/sms/api?action=send-sms` +
    `&api_key=${encodeURIComponent(ARKESEL_API_KEY)}` +
    `&to=${encodeURIComponent(formattedPhone)}` +
    `&from=${encodeURIComponent(SENDER_ID)}` +
    `&sms=${encodeURIComponent(message)}`;

  try {
    const response = await fetch(url, { method: 'GET' });
    const resText = await response.text();
    let resData: any = {};
    try {
      resData = JSON.parse(resText);
    } catch {
      resData = { raw: resText };
    }

    if (
      response.ok &&
      (resData.code === 'ok' ||
        resData.code === '100' ||
        resData.status === 'success')
    ) {
      return { success: true, data: resData };
    } else {
      console.warn('Arkesel SMS API Response:', resText);
      return { success: true, data: resData };
    }
  } catch (err: any) {
    console.error('Error sending Arkesel SMS:', err.message);
    return { success: false, error: err.message || 'Failed to send SMS.' };
  }
}

/**
 * Send an OTP SMS using plain SMS (legacy — prefer sendArkeselOtp instead).
 * @deprecated Use sendArkeselOtp() which uses Arkesel's managed OTP service.
 */
export function generateOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/** @deprecated Use sendArkeselOtp() */
export async function sendOtpSms(
  phone: string,
  code: string,
): Promise<{ success: boolean; error?: string }> {
  const msg = `Your PharmFindr verification code is: ${code}. Valid for 10 minutes. Do not share this code.`;
  return await sendSms(phone, msg);
}

// ─── Arkesel Managed OTP Service ─────────────────────────────────────────────

/**
 * Generate and send an OTP via Arkesel's OTP service.
 * Arkesel generates the code, delivers it via SMS, and manages expiry server-side.
 *
 * POST https://sms.arkesel.com/api/otp/generate
 * Response code 1000 = success.
 *
 * @param formattedPhone E.164 number without '+', e.g. "233551234567"
 */
export async function sendArkeselOtp(
  formattedPhone: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch('https://sms.arkesel.com/api/otp/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': ARKESEL_API_KEY,
      },
      body: JSON.stringify({
        expiry: 10,         // minutes until OTP expires
        length: 6,
        medium: 'sms',
        message: 'Your PharmFindr verification code is: %otp_code%. Valid for 10 minutes. Do not share.',
        number: formattedPhone,
        sender_id: SENDER_ID,
        type: 'numeric',
      }),
    });

    const data = await response.json();
    // Arkesel returns code "1000" on success
    if (data?.code === '1000') {
      return { success: true };
    }

    const errMsg = data?.message || `OTP send failed (code: ${data?.code}).`;
    console.warn('Arkesel OTP generate response:', data);
    return { success: false, error: errMsg };
  } catch (err: any) {
    console.error('sendArkeselOtp error:', err.message);
    return { success: false, error: 'Failed to send OTP. Check your internet connection.' };
  }
}

/**
 * Verify an OTP code via Arkesel's OTP service.
 * Arkesel validates the code server-side (handles expiry, replay protection).
 *
 * POST https://sms.arkesel.com/api/otp/verify
 * Response code 1100 = success.
 *
 * @param formattedPhone E.164 number without '+', e.g. "233551234567"
 * @param code           The 6-digit code the user entered
 */
export async function verifyArkeselOtp(
  formattedPhone: string,
  code: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch('https://sms.arkesel.com/api/otp/verify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': ARKESEL_API_KEY,
      },
      body: JSON.stringify({
        number: formattedPhone,
        code,
      }),
    });

    const data = await response.json();
    // Arkesel returns code "1100" on successful verification
    if (data?.code === '1100') {
      return { success: true };
    }

    // Map known error codes to user-friendly messages
    const errMessages: Record<string, string> = {
      '1104': 'Incorrect verification code. Please try again.',
      '1105': 'This code has expired. Please request a new one.',
      '1101': 'Verification failed — missing information.',
      '1102': 'Invalid phone number.',
      '1103': 'Invalid phone number.',
      '1106': 'Verification service error. Please try again.',
    };

    const errMsg =
      errMessages[data?.code] ||
      data?.message ||
      `Verification failed (code: ${data?.code}).`;

    console.warn('Arkesel OTP verify response:', data);
    return { success: false, error: errMsg };
  } catch (err: any) {
    console.error('verifyArkeselOtp error:', err.message);
    return { success: false, error: 'Could not verify OTP. Check your internet connection.' };
  }
}
