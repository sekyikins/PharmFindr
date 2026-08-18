import * as Linking from 'expo-linking';
import { supabase } from './supabase';

export interface AuthUrlResult {
  user: any | null;
  session: any | null;
  isRecovery: boolean;
  error: Error | null;
}

/**
 * Parses deep link URLs (both query parameters and hash fragments)
 * and establishes the active Supabase authentication session.
 */
export async function processAuthUrl(rawUrl?: string | null): Promise<AuthUrlResult> {
  try {
    // 1. Resolve URL from argument, or active URL, or initial cold-start URL
    let url = rawUrl || null;
    if (!url) {
      url = await Linking.getInitialURL();
    }

    let code: string | null = null;
    let accessToken: string | null = null;
    let refreshToken: string | null = null;
    let isRecovery = false;

    if (url) {
      if (
        url.includes('type=recovery') ||
        url.includes('flow=recovery') ||
        url.includes('reset-password') ||
        url.includes('recovery')
      ) {
        isRecovery = true;
      }

      // Check query string (?code=...&access_token=...)
      if (url.includes('?')) {
        const queryPart = url.split('?')[1].split('#')[0];
        const qParams = new URLSearchParams(queryPart);
        if (qParams.get('code')) code = qParams.get('code');
        if (qParams.get('access_token')) accessToken = qParams.get('access_token');
        if (qParams.get('refresh_token')) refreshToken = qParams.get('refresh_token');
        if (qParams.get('type') === 'recovery' || qParams.get('flow') === 'recovery') {
          isRecovery = true;
        }
      }

      // Check hash fragment (#access_token=...&refresh_token=...&type=recovery)
      if (url.includes('#')) {
        const hashPart = url.split('#')[1];
        const hParams = new URLSearchParams(hashPart);
        if (!code && hParams.get('code')) code = hParams.get('code');
        if (hParams.get('access_token')) accessToken = hParams.get('access_token');
        if (hParams.get('refresh_token')) refreshToken = hParams.get('refresh_token');
        if (hParams.get('type') === 'recovery') isRecovery = true;
      }
    }

    // 2. Exchange PKCE code for session
    if (code) {
      const { data, error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) {
        console.warn('exchangeCodeForSession warning:', error.message);
      } else if (data.session) {
        return {
          user: data.session.user,
          session: data.session,
          isRecovery,
          error: null,
        };
      }
    }

    // 3. Set implicit token session
    if (accessToken && refreshToken) {
      const { data, error } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });
      if (error) {
        console.warn('setSession warning:', error.message);
      } else if (data.session) {
        return {
          user: data.session.user,
          session: data.session,
          isRecovery,
          error: null,
        };
      }
    }

    // 4. Fallback: check if session is already active in Supabase storage
    const { data: sessionData, error: sessionErr } = await supabase.auth.getSession();
    if (sessionErr) {
      return { user: null, session: null, isRecovery, error: sessionErr };
    }

    return {
      user: sessionData.session?.user ?? null,
      session: sessionData.session ?? null,
      isRecovery,
      error: null,
    };
  } catch (err: any) {
    console.warn('processAuthUrl error:', err);
    return {
      user: null,
      session: null,
      isRecovery: false,
      error: err instanceof Error ? err : new Error(String(err)),
    };
  }
}
