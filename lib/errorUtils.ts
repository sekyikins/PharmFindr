/**
 * Translates raw API/Supabase/Network error exceptions into clear, non-technical, human-friendly messages.
 */
export function getFriendlyErrorMessage(
  err: any,
  fallbackMessage = 'An unexpected error occurred. Please try again.'
): string {
  if (!err) return fallbackMessage;

  const rawMessage = typeof err === 'string'
    ? err
    : err?.message || err?.error_description || String(err);

  if (!rawMessage || rawMessage === '[object Object]') return fallbackMessage;

  // 1. Network / Offline / Timeout Errors
  if (/network request failed|failed to fetch|econnrefused|timeout|getaddrinfo|offline|internet|connection|net::/i.test(rawMessage)) {
    return "You're offline. Check your internet connection.";
  }

  // 2. Authentication & Authorization Errors
  if (/invalid login credentials|invalid email or password|invalid credentials|user not found/i.test(rawMessage)) {
    return 'Invalid credentials. Please check your details and try again.';
  }
  if (/jwt expired|session expired|invalid token|unauthorized/i.test(rawMessage)) {
    return 'Your session has expired. Please sign in again.';
  }
  if (/rate limit|too many requests/i.test(rawMessage)) {
    return 'Too many attempts. Please wait a moment before trying again.';
  }

  // 3. Database / Supabase technical codes (PGRST, SQL constraints, etc.)
  if (/PGRST|postgres|constraint|violates|foreign key|syntax error|TypeError|ReferenceError/i.test(rawMessage)) {
    return fallbackMessage;
  }

  // 4. Return raw message if it's already concise and user-friendly, otherwise fallback
  if (rawMessage.length < 120 && !/error|exception|stack|undefined|null/i.test(rawMessage)) {
    return rawMessage;
  }

  return fallbackMessage;
}
