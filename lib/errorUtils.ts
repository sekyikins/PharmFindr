/**
 * Translates raw API/Supabase/Network error exceptions into clear, non-technical, human-friendly messages.
 */
export function getFriendlyErrorMessage(
  err: any,
  fallbackMessage = 'An unexpected error occurred. Please try again.'
): string {
  if (!err) return fallbackMessage;

  // Extract all text fields from err object to catch nested exceptions
  const fullText = [
    typeof err === 'string' ? err : '',
    err?.message,
    err?.error_description,
    err?.error,
    err?.details,
    err?.hint,
    err?.cause?.message,
    err?.originalError?.message,
    String(err || ''),
  ]
    .filter(Boolean)
    .join(' ');

  if (!fullText || fullText.trim() === '[object Object]') return fallbackMessage;

  // 1. Network / Offline / Timeout / Fetch Errors
  if (
    /network|offline|connection|internet|failed to fetch|econnrefused|timeout|getaddrinfo|net::/i.test(
      fullText
    )
  ) {
    return "You're offline. Check your internet connection.";
  }

  // 2. Authentication & Credentials Errors
  if (
    /invalid login credentials|invalid email or password|invalid credentials|user not found/i.test(
      fullText
    )
  ) {
    return 'Invalid email or password. Please check your credentials and try again.';
  }
  if (/jwt expired|session expired|invalid token|unauthorized/i.test(fullText)) {
    return 'Your session has expired. Please sign in again.';
  }
  if (/rate limit|too many requests/i.test(fullText)) {
    return 'Too many attempts. Please wait a moment before trying again.';
  }

  // 3. Database / Supabase technical codes (PGRST, SQL constraints, etc.)
  if (
    /PGRST|postgres|constraint|violates|foreign key|syntax error|TypeError|ReferenceError/i.test(
      fullText
    )
  ) {
    return fallbackMessage;
  }

  // 4. Return primary message if it's already short and user-friendly, otherwise fallback
  const primaryMsg = typeof err === 'string' ? err : err?.message || '';
  if (
    primaryMsg &&
    primaryMsg.length < 120 &&
    !/error|exception|stack|undefined|null/i.test(primaryMsg)
  ) {
    return primaryMsg;
  }

  return fallbackMessage;
}
