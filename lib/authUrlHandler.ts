import * as Linking from 'expo-linking';
import { supabase } from './supabase';

export interface AuthUrlResult {
  user: any | null;
  session: any | null;
  isRecovery: boolean;
  errorCode?: string | null;
  errorDescription?: string | null;
  error: Error | null;
  debugLog?: string[];
}

/**
 * Redacts sensitive tokens from URLs for safe diagnostic logging.
 */
export function redactUrl(url: string | null | undefined): string {
  if (!url) return 'null';
  return url
    .replace(/(code=)[^&#]+/gi, '$1[REDACTED]')
    .replace(/(access_token=)[^&#]+/gi, '$1[REDACTED]')
    .replace(/(refresh_token=)[^&#]+/gi, '$1[REDACTED]')
    .replace(/(token=)[^&#]+/gi, '$1[REDACTED]')
    .replace(/(token_hash=)[^&#]+/gi, '$1[REDACTED]');
}

/**
 * Extracts query parameters, hash fragments, and tokens from any URL string.
 */
function parseUrlTokens(url: string) {
  let code: string | null = null;
  let accessToken: string | null = null;
  let refreshToken: string | null = null;
  let type: string | null = null;
  let errorCode: string | null = null;
  let errorDescription: string | null = null;

  // 1. Query parameters
  if (url.includes('?')) {
    const queryPart = url.split('?')[1].split('#')[0];
    const qParams = new URLSearchParams(queryPart);
    if (qParams.get('code')) code = qParams.get('code');
    if (qParams.get('access_token')) accessToken = qParams.get('access_token');
    if (qParams.get('refresh_token')) refreshToken = qParams.get('refresh_token');
    if (qParams.get('type')) type = qParams.get('type');
    if (qParams.get('flow')) type = qParams.get('flow');
    if (qParams.get('error')) errorCode = qParams.get('error');
    if (qParams.get('error_code')) errorCode = qParams.get('error_code');
    if (qParams.get('error_description')) errorDescription = qParams.get('error_description');
  }

  // 2. Hash fragment
  if (url.includes('#')) {
    const hashPart = url.split('#')[1];
    const hParams = new URLSearchParams(hashPart);
    if (!code && hParams.get('code')) code = hParams.get('code');
    if (hParams.get('access_token')) accessToken = hParams.get('access_token');
    if (hParams.get('refresh_token')) refreshToken = hParams.get('refresh_token');
    if (hParams.get('type')) type = hParams.get('type');
    if (hParams.get('error')) errorCode = hParams.get('error');
    if (hParams.get('error_code')) errorCode = hParams.get('error_code');
    if (hParams.get('error_description')) errorDescription = hParams.get('error_description');
  }

  return { code, accessToken, refreshToken, type, errorCode, errorDescription };
}

/**
 * Parses deep link URLs (both query parameters and hash fragments)
 * and establishes the active Supabase authentication session.
 */
export async function processAuthUrl(rawUrl?: string | null): Promise<AuthUrlResult> {
  const debugLog: string[] = [];
  const log = (msg: string) => {
    debugLog.push(`[${new Date().toISOString().split('T')[1].slice(0, 8)}] ${msg}`);
    console.log(`[AuthUrlHandler] ${msg}`);
  };

  log(`Processing callback URL: ${redactUrl(rawUrl)}`);

  try {
    const initialUrl = await Linking.getInitialURL().catch(() => null);
    log(`Initial URL from cold start: ${redactUrl(initialUrl)}`);
    const candidates = [rawUrl, initialUrl].filter(Boolean) as string[];

    let code: string | null = null;
    let accessToken: string | null = null;
    let refreshToken: string | null = null;
    let errorCode: string | null = null;
    let errorDescription: string | null = null;
    let isRecovery = false;

    for (const url of candidates) {
      if (
        url.includes('reset-password') ||
        url.includes('type=recovery') ||
        url.includes('flow=recovery') ||
        url.includes('recovery')
      ) {
        isRecovery = true;
      }

      const parsed = parseUrlTokens(url);
      if (parsed.code) code = parsed.code;
      if (parsed.accessToken) accessToken = parsed.accessToken;
      if (parsed.refreshToken) refreshToken = parsed.refreshToken;
      if (parsed.type === 'recovery') isRecovery = true;
      if (parsed.errorCode) errorCode = parsed.errorCode;
      if (parsed.errorDescription) errorDescription = parsed.errorDescription;
    }

    log(
      `Tokens parsed: code=${!!code}, access_token=${!!accessToken}, refresh_token=${!!refreshToken}, isRecovery=${isRecovery}`
    );

    // Handle Supabase error redirect
    if (errorDescription || errorCode) {
      const msg = errorDescription
        ? decodeURIComponent(errorDescription.replace(/\+/g, ' '))
        : 'The reset link has expired or is invalid.';
      log(`Error from redirect: ${msg}`);
      return {
        user: null,
        session: null,
        isRecovery: true,
        errorCode,
        errorDescription: msg,
        error: new Error(msg),
        debugLog,
      };
    }

    // Case A: Exchange PKCE code for session
    if (code) {
      log('Case A: Exchanging PKCE code for session...');
      const { data, error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) {
        log(`exchangeCodeForSession failed: ${error.message}`);
      } else if (data.session) {
        log(`exchangeCodeForSession succeeded! User: ${data.session.user.id}`);
        return {
          user: data.session.user,
          session: data.session,
          isRecovery,
          error: null,
          debugLog,
        };
      }
    }

    // Case B: Set implicit token session
    if (accessToken && refreshToken) {
      log('Case B: Setting session with access_token & refresh_token...');
      const { data, error } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });
      if (error) {
        log(`setSession failed: ${error.message}`);
      } else if (data.session) {
        log(`setSession succeeded! User: ${data.session.user.id}`);
        return {
          user: data.session.user,
          session: data.session,
          isRecovery,
          error: null,
          debugLog,
        };
      }
    }

    // Fallback: check if session is already active in storage
    const { data: sessionData, error: sessionErr } = await supabase.auth.getSession();
    if (sessionData?.session) {
      log(`Active session found in storage. User: ${sessionData.session.user.id}`);
      return {
        user: sessionData.session.user,
        session: sessionData.session,
        isRecovery,
        error: null,
        debugLog,
      };
    }

    log('No active session established.');
    return {
      user: null,
      session: null,
      isRecovery,
      error: sessionErr ?? null,
      debugLog,
    };
  } catch (err: any) {
    log(`Fatal error in processAuthUrl: ${err.message || String(err)}`);
    return {
      user: null,
      session: null,
      isRecovery: false,
      error: err instanceof Error ? err : new Error(String(err)),
      debugLog,
    };
  }
}
