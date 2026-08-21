import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import { Session, User } from '@supabase/supabase-js';
import {
  registerDeviceSession,
  checkInactivityTimeout,
  updateLastActiveTimestamp,
  revokeAllOtherSessions,
} from '@/lib/deviceSession';
import { enqueueOfflineAction } from '@/lib/offlineSyncQueue';
import * as FileSystem from 'expo-file-system/legacy';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { Platform } from 'react-native';

WebBrowser.maybeCompleteAuthSession();

/** Base64 to ArrayBuffer helper for React Native Native uploads */
function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
  let str = base64.replace(/=+$/, '');
  let output = '';
  for (let i = 0; i < str.length; i += 4) {
    const enc1 = chars.indexOf(str.charAt(i));
    const enc2 = chars.indexOf(str.charAt(i + 1));
    const enc3 = chars.indexOf(str.charAt(i + 2));
    const enc4 = chars.indexOf(str.charAt(i + 3));

    const chr1 = (enc1 << 2) | (enc2 >> 4);
    const chr2 = ((enc2 & 15) << 4) | (enc3 >> 2);
    const chr3 = ((enc3 & 3) << 6) | enc4;

    output += String.fromCharCode(chr1);
    if (enc3 !== 64 && enc3 !== -1) output += String.fromCharCode(chr2);
    if (enc4 !== 64 && enc4 !== -1) output += String.fromCharCode(chr3);
  }
  const bytes = new Uint8Array(output.length);
  for (let i = 0; i < output.length; i++) {
    bytes[i] = output.charCodeAt(i);
  }
  return bytes.buffer;
}

export const PHARMACY_PASS = 'PharmacyPass123!';

// ─── Types ────────────────────────────────────────────────────────────────────

/** Lightweight role record — one row per auth.users account */
export interface UserRole {
  id: string;
  role: 'user' | 'pharmacy' | 'both';
}

/** Full app_users row (identity + health data merged) */
export interface AppUser {
  id: string;
  full_name: string | null;
  phone: string | null;
  avatar_url: string | null;
  age: number | null;
  weight: number | null;
  height: number | null;
  gender: string | null;
  allergies: string[];
  existing_conditions: string[];
  current_medications: string[];
  created_at: string;
  updated_at?: string;
}

/**
 * Unified profile presented to the rest of the app.
 * role 'both' = this account owns a pharmacy AND has an app_user record.
 */
export interface Profile {
  id: string;
  role: 'user' | 'pharmacy' | 'both';
  full_name: string | null;
  phone: string | null;
  avatar_url: string | null;
  created_at: string;
}

// ─── Auth Store ───────────────────────────────────────────────────────────────

interface AuthState {
  session: Session | null;
  user: User | null;
  /** Unified profile (role + identity) for routing and display */
  profile: Profile | null;
  /** Full app_users record including health data */
  appUser: AppUser | null;
  loading: boolean;
  initialized: boolean;
  securityNotice: string | null;

  signUp: (
    phone: string,
    email: string,
    password: string,
    role: 'user' | 'pharmacy',
    fullName: string,
  ) => Promise<User | null>;
  signIn: (emailOrPhone: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<User | null>;
  signOut: () => Promise<void>;
  deleteAccount: () => Promise<void>;
  initialize: () => Promise<void>;

  updatePasswordAndRevokeOtherSessions: (newPassword: string) => Promise<void>;
  clearSecurityNotice: () => void;

  fetchAppUser: () => Promise<void>;
  updateAppUser: (data: Partial<AppUser>) => Promise<void>;
  updateProfile: (data: Partial<Pick<Profile, 'full_name' | 'phone' | 'avatar_url'>>) => Promise<void>;
  uploadAvatar: (imageUri: string) => Promise<string | null>;
  refreshProfile: () => Promise<void>;
}

// ─── Role + profile resolution ───────────────────────────────────────────────

// ─── Profile Caching & Timeout Helpers ────────────────────────────────────────

const CACHED_PROFILE_PREFIX = 'PharmFindr_cached_profile_';

export async function getCachedProfile(userId: string): Promise<Profile | null> {
  try {
    const AsyncStorage = require('@react-native-async-storage/async-storage').default;
    const json = await AsyncStorage.getItem(CACHED_PROFILE_PREFIX + userId);
    return json ? JSON.parse(json) : null;
  } catch (_) {
    return null;
  }
}

export async function saveCachedProfile(userId: string, profile: Profile | null) {
  try {
    const AsyncStorage = require('@react-native-async-storage/async-storage').default;
    if (profile) {
      await AsyncStorage.setItem(CACHED_PROFILE_PREFIX + userId, JSON.stringify(profile));
    } else {
      await AsyncStorage.removeItem(CACHED_PROFILE_PREFIX + userId);
    }
  } catch (_) {}
}

/**
 * Single-query role lookup via user_roles table, then fetch matching identity row.
 * Returns a unified Profile object ready for the rest of the app.
 */
async function resolveProfile(userId: string): Promise<Profile | null> {
  try {
    // 0. Verify auth user still exists in database
    const { error: userErr } = await supabase.auth.getUser();
    if (userErr && /user not found|does not exist|invalid claim|invalid_grant|user_deleted/i.test(userErr.message)) {
      useAuthStore.setState({
        securityNotice: 'User does not exist anymore. Your account has been removed from the database.',
        session: null,
        user: null,
        profile: null,
        appUser: null,
      });
      await supabase.auth.signOut();
      await saveCachedProfile(userId, null);
      return null;
    }

    // 1. Fast role lookup (1 row, indexed PK)
    const { data: roleRow } = await supabase
      .from('user_roles')
      .select('id, role')
      .eq('id', userId)
      .single();

    let role: 'user' | 'pharmacy' | 'both' = (roleRow?.role as any) || 'user';

    // Fallback: Check if user is an owner in pharmacies table
    if (!roleRow || role === 'user') {
      const { data: pharm } = await supabase
        .from('pharmacies')
        .select('id, name, phone, created_at')
        .eq('owner_id', userId)
        .maybeSingle();

      if (pharm) {
        role = 'pharmacy';
        const p: Profile = {
          id: userId,
          role: 'pharmacy',
          full_name: pharm.name ?? 'Pharmacy Manager',
          phone: pharm.phone ?? null,
          avatar_url: null,
          created_at: pharm.created_at ?? new Date().toISOString(),
        };
        saveCachedProfile(userId, p);
        return p;
      }
    }

    let p: Profile;
    // For 'user' and 'both': identity lives in app_users
    if (role === 'user' || role === 'both') {
      const { data: appUser } = await supabase
        .from('app_users')
        .select('id, full_name, phone, avatar_url, created_at')
        .eq('id', userId)
        .maybeSingle();

      p = {
        id: userId,
        role,
        full_name: appUser?.full_name ?? null,
        phone: appUser?.phone ?? null,
        avatar_url: appUser?.avatar_url ?? null,
        created_at: appUser?.created_at ?? new Date().toISOString(),
      };
    } else {
      // 'pharmacy' only — identity comes from pharmacies table
      const { data: pharmacy } = await supabase
        .from('pharmacies')
        .select('name, phone, created_at')
        .eq('owner_id', userId)
        .maybeSingle();

      p = {
        id: userId,
        role: 'pharmacy',
        full_name: pharmacy?.name ?? 'Pharmacy Manager',
        phone: pharmacy?.phone ?? null,
        avatar_url: null,
        created_at: pharmacy?.created_at ?? new Date().toISOString(),
      };
    }
    saveCachedProfile(userId, p);
    return p;
  } catch (err) {
    console.warn('resolveProfile network error, using cached profile:', err);
    return getCachedProfile(userId);
  }
}

/**
 * Resolves profile with a maximum timeout (default 3.5s) so poor network connections never hang startup.
 */
async function resolveProfileWithTimeout(userId: string, timeoutMs = 3500): Promise<Profile | null> {
  const cached = await getCachedProfile(userId);

  const fetchPromise = resolveProfile(userId);
  const timeoutPromise = new Promise<Profile | null>((res) => {
    setTimeout(() => res(cached), timeoutMs);
  });

  try {
    const result = await Promise.race([fetchPromise, timeoutPromise]);
    return result || cached;
  } catch (_) {
    return cached;
  }
}

// ─── Store ────────────────────────────────────────────────────────────────────

// Flag to distinguish user-initiated sign out from remote/server revocation
let isExplicitSignOut = false;

export const useAuthStore = create<AuthState>((set, get) => {
  // Listen to Supabase auth state changes
  supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_OUT') {
      if (!isExplicitSignOut) {
        const currentNotice = get().securityNotice;
        if (!currentNotice && get().user) {
          set({
            securityNotice: 'You have been signed out of this account. Your session may have been revoked from another device.',
          });
        }
      }
      set({ session: null, user: null, profile: null, appUser: null, loading: false });
      return;
    }

    if (event === 'PASSWORD_RECOVERY') {
      console.log(
        '[Supabase Auth Event] PASSWORD_RECOVERY fired. Session is:',
        session ? `Valid (User ID: ${session.user.id})` : 'NULL'
      );
      if (session) {
        set({ session, user: session.user, loading: false });
      }
      return;
    }

    if ((event as string) === 'USER_DELETED') {
      set({
        securityNotice: 'User does not exist anymore. Your account has been removed from the database.',
        session: null,
        user: null,
        profile: null,
        appUser: null,
        loading: false,
      });
      return;
    }

    if (session) {
      getCachedProfile(session.user.id).then((cached) => {
        const metaRole = session.user.user_metadata?.role || 'user';
        const metaName =
          session.user.user_metadata?.full_name ||
          session.user.user_metadata?.name ||
          session.user.user_metadata?.user_name ||
          null;
        const metaAvatar =
          session.user.user_metadata?.avatar_url ||
          session.user.user_metadata?.picture ||
          null;

        const initialProfile: Profile = cached || {
          id: session.user.id,
          role: metaRole === 'pharmacy' ? 'pharmacy' : 'user',
          full_name: metaName,
          phone: session.user.user_metadata?.phone || null,
          avatar_url: metaAvatar,
          created_at: session.user.created_at,
        };

        // Set session & profile instantly — NEVER block UI with loading: true
        set({ session, user: session.user, profile: initialProfile, loading: false });

        // Background network profile sync
        resolveProfile(session.user.id)
          .then((fresh) => {
            if (fresh) set({ profile: fresh });
          })
          .catch(() => {});

        if (initialProfile.role === 'user') {
          get().fetchAppUser().catch(() => {});
        }

        updateLastActiveTimestamp().catch(() => {});
      });
    } else {
      set({ session: null, user: null, profile: null, appUser: null, loading: false });
    }
  });

  return {
    session: null,
    user: null,
    profile: null,
    appUser: null,
    loading: true,
    initialized: false,
    securityNotice: null,

    clearSecurityNotice: () => set({ securityNotice: null }),

    // ── Sign Up ──────────────────────────────────────────────────────────────
    signUp: async (phone, email, password, role, fullName) => {
      set({ loading: true });

      const cleanEmail = email && email.trim() ? email.trim() : null;
      const finalEmail = cleanEmail || `${phone.replace(/[\s+]+/g, '')}@PharmFindr.com`;

      const { data, error } = await supabase.auth.signUp({
        email: finalEmail,
        password,
        options: {
          data: {
            role,
            full_name: fullName,
            phone,
            business_email: cleanEmail,
          },
        },
      });

      if (error) {
        set({ loading: false });
        throw error;
      }

      if (data.user) {
        await registerDeviceSession(data.user.id, role);
      }

      set({ loading: false });
      return data.user;
    },

    // ── Sign In ──────────────────────────────────────────────────────────────
    signIn: async (emailOrPhone, password) => {
      set({ loading: true });

      const email = emailOrPhone.includes('@')
        ? emailOrPhone.trim()
        : `${emailOrPhone.replace(/[\s+]+/g, '')}@PharmFindr.com`;

      const { data, error } = await supabase.auth.signInWithPassword({ email, password });

      if (error) {
        set({ loading: false });
        throw error;
      }

      try {
        const profile = await resolveProfile(data.user.id);
        set({ profile });

        const userRole = profile?.role === 'pharmacy' ? 'pharmacy' : 'patient';
        await registerDeviceSession(data.user.id, userRole);
      } catch (e) {
        console.warn('resolveProfile after signIn failed (non-fatal):', e);
      }

      set({ loading: false });
    },

    // ── Sign In / Sign Up with Google OAuth ───────────────────────────────────
    signInWithGoogle: async () => {
      set({ loading: true });
      try {
        const redirectUrl = Linking.createURL('callback');
        const { data, error } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: {
            redirectTo: redirectUrl,
            skipBrowserRedirect: true,
            queryParams: {
              access_type: 'offline',
              prompt: 'consent',
            },
          },
        });

        if (error) throw error;
        if (!data?.url) throw new Error('No authorization URL returned from Supabase.');

        const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUrl);

        if (result.type === 'success' && result.url) {
          let session: Session | null = null;
          let user: User | null = null;

          // 1. Check for authorization code (PKCE flow)
          const parsed = Linking.parse(result.url);
          const code = parsed.queryParams?.code ? String(parsed.queryParams.code) : null;

          if (code) {
            const { data: exchangeData, error: exchangeErr } = await supabase.auth.exchangeCodeForSession(code);
            if (exchangeErr) throw exchangeErr;
            session = exchangeData.session;
            user = exchangeData.user;
          } else {
            // 2. Check for access_token and refresh_token (implicit fragment / query)
            let accessToken: string | undefined;
            let refreshToken: string | undefined;

            if (result.url.includes('#')) {
              const fragment = result.url.split('#')[1];
              const params = new URLSearchParams(fragment);
              accessToken = params.get('access_token') || undefined;
              refreshToken = params.get('refresh_token') || undefined;
            } else if (parsed.queryParams?.access_token) {
              accessToken = String(parsed.queryParams.access_token);
              refreshToken = String(parsed.queryParams.refresh_token);
            }

            if (accessToken && refreshToken) {
              const { data: sessionData, error: sessionErr } = await supabase.auth.setSession({
                access_token: accessToken,
                refresh_token: refreshToken,
              });
              if (sessionErr) throw sessionErr;
              session = sessionData.session;
              user = sessionData.user;
            }
          }

          if (user && session) {
            // 3. Extract Google Profile details
            const metaName =
              user.user_metadata?.full_name ||
              user.user_metadata?.name ||
              user.user_metadata?.user_name ||
              user.email?.split('@')[0] ||
              'PharmFindr User';
            const metaAvatar =
              user.user_metadata?.avatar_url ||
              user.user_metadata?.picture ||
              null;

            const initialProfile: Profile = {
              id: user.id,
              role: 'user',
              full_name: metaName,
              phone: user.user_metadata?.phone || null,
              avatar_url: metaAvatar,
              created_at: user.created_at || new Date().toISOString(),
            };

            // 4. INSTANT State Update — Never block navigation with DB roundtrips
            saveCachedProfile(user.id, initialProfile);
            set({ profile: initialProfile, session, user, loading: false });

            // 5. Background asynchronous DB provisioning
            (async () => {
              try {
                await supabase.from('user_roles').upsert({ id: user.id, role: 'user' }, { onConflict: 'id' });

                // Safe check-then-provision for app_users to protect existing biometrics & health data
                const { data: existingAppUser } = await supabase
                  .from('app_users')
                  .select('id, full_name, avatar_url')
                  .eq('id', user.id)
                  .maybeSingle();

                if (!existingAppUser) {
                  await supabase.from('app_users').insert({
                    id: user.id,
                    full_name: metaName,
                    avatar_url: metaAvatar,
                  });
                } else if (!existingAppUser.full_name || !existingAppUser.avatar_url) {
                  await supabase.from('app_users').update({
                    full_name: existingAppUser.full_name || metaName,
                    avatar_url: existingAppUser.avatar_url || metaAvatar,
                  }).eq('id', user.id);
                }

                await registerDeviceSession(user.id, 'patient');
              } catch (err) {
                console.warn('Google Auth background provisioning warning:', err);
              } finally {
                resolveProfile(user.id).then((fresh) => {
                  if (fresh) set({ profile: fresh });
                });
                get().fetchAppUser().catch(() => {});
              }
            })();

            return user;
          }
        }
        return null;
      } catch (err) {
        throw err;
      } finally {
        set({ loading: false });
      }
    },

    // ── Update Password & Revoke Other Sessions ──────────────────────────────
    updatePasswordAndRevokeOtherSessions: async (newPassword: string) => {
      set({ loading: true });
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        if (!sessionData?.session) {
          throw new Error('No active login session found. Please sign in again.');
        }

        const { error } = await supabase.auth.updateUser({ password: newPassword });
        if (error) throw error;

        await revokeAllOtherSessions();
      } catch (e) {
        throw e;
      } finally {
        set({ loading: false });
      }
    },

    // ── Sign Out ─────────────────────────────────────────────────────────────
    signOut: async () => {
      isExplicitSignOut = true;
      set({ loading: true, securityNotice: null });
      const currentUserId = get().user?.id;
      if (currentUserId) {
        saveCachedProfile(currentUserId, null);
      }
      try {
        await supabase.auth.signOut();
      } catch (error) {
        console.warn('Sign out warning:', error);
      } finally {
        set({ session: null, user: null, profile: null, appUser: null, loading: false, securityNotice: null });
        setTimeout(() => {
          isExplicitSignOut = false;
        }, 1500);
      }
      try {
        const { useRecentSearchesStore } = await import('@/store/recentSearchesStore');
        useRecentSearchesStore.getState().resetStore();
      } catch (_) {}
      try {
        const { useSavedMedicinesStore } = await import('@/store/savedMedicinesStore');
        useSavedMedicinesStore.getState().clearAllSaved();
      } catch (_) {}
    },

    // ── Delete Account ───────────────────────────────────────────────────────
    deleteAccount: async () => {
      isExplicitSignOut = true;
      set({ loading: true, securityNotice: null });
      const currentUserId = get().user?.id;

      try {
        // 1. Attempt DB RPC deletion (which removes auth.users & cascades)
        try {
          await supabase.rpc('delete_user_account');
        } catch (rpcErr) {
          console.warn('RPC delete_user_account error or not configured:', rpcErr);
        }

        // 2. Direct RLS clean up of public user tables as safeguard
        if (currentUserId) {
          await Promise.allSettled([
            supabase.from('app_users').delete().eq('id', currentUserId),
            supabase.from('user_roles').delete().eq('id', currentUserId),
            supabase.from('prescriptions').delete().eq('user_id', currentUserId),
            supabase.from('reservations').delete().eq('user_id', currentUserId),
            supabase.from('notifications').delete().eq('user_id', currentUserId),
            supabase.from('pharmacies').delete().eq('owner_id', currentUserId),
          ]);
          saveCachedProfile(currentUserId, null);
        }

        // 3. Clear local cache stores
        try {
          const { useRecentSearchesStore } = await import('@/store/recentSearchesStore');
          useRecentSearchesStore.getState().resetStore();
        } catch (_) {}
        try {
          const { useSavedMedicinesStore } = await import('@/store/savedMedicinesStore');
          useSavedMedicinesStore.getState().clearAllSaved();
        } catch (_) {}

        // 4. Sign out auth session
        await supabase.auth.signOut();
      } catch (err) {
        console.warn('Delete account error:', err);
        throw err;
      } finally {
        set({ session: null, user: null, profile: null, appUser: null, loading: false, securityNotice: null });
        setTimeout(() => {
          isExplicitSignOut = false;
        }, 1500);
      }
    },

    // ── Initialize (cold start with 7-day inactivity check) ────────────────
    initialize: async () => {
      if (get().initialized) return;
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          const cachedProfile = await getCachedProfile(session.user.id);
          const metaRole = session.user.user_metadata?.role || 'user';
          const metaName =
            session.user.user_metadata?.full_name ||
            session.user.user_metadata?.name ||
            session.user.user_metadata?.user_name ||
            null;
          const metaAvatar =
            session.user.user_metadata?.avatar_url ||
            session.user.user_metadata?.picture ||
            null;

          const initialProfile: Profile = cachedProfile || {
            id: session.user.id,
            role: metaRole === 'pharmacy' ? 'pharmacy' : 'user',
            full_name: metaName,
            phone: session.user.user_metadata?.phone || null,
            avatar_url: metaAvatar,
            created_at: session.user.created_at,
          };

          // SET SESSION & PROFILE IMMEDIATELY — INSTANT UI RESOLUTION!
          set({
            session,
            user: session.user,
            profile: initialProfile,
            initialized: true,
            loading: false,
          });

          // All network checks performed non-blockingly in the background
          resolveProfile(session.user.id)
            .then((fresh) => {
              if (fresh) set({ profile: fresh });
            })
            .catch(() => {});

          checkInactivityTimeout()
            .then(async (isExpired) => {
              if (isExpired) {
                console.info('Session expired due to 7 days of inactivity.');
                await supabase.auth.signOut();
                await saveCachedProfile(session.user.id, null);
                set({
                  session: null,
                  user: null,
                  profile: null,
                  appUser: null,
                  securityNotice: 'You have been logged out due to 7 days of inactivity for account security.',
                });
              }
            })
            .catch(() => {});

          registerDeviceSession(session.user.id, initialProfile.role === 'pharmacy' ? 'pharmacy' : 'patient').catch(() => {});
          if (initialProfile.role === 'user') {
            get().fetchAppUser().catch(() => {});
          }
          return;
        }
      } catch (e) {
        console.warn('Error during auth initialization:', e);
      } finally {
        set({ initialized: true, loading: false });
      }
    },

    // ── App User (health + identity data) ────────────────────────────────────
    fetchAppUser: async () => {
      const user = get().user;
      if (!user) return;

      try {
        const { data, error } = await supabase
          .from('app_users')
          .select('*')
          .eq('id', user.id)
          .single();

        if (error && error.code !== 'PGRST116') {
          console.warn('fetchAppUser:', error.message);
        }

        const metaName =
          user.user_metadata?.full_name ||
          user.user_metadata?.name ||
          user.user_metadata?.user_name ||
          null;
        const metaAvatar =
          user.user_metadata?.avatar_url ||
          user.user_metadata?.picture ||
          null;

        if (!data) {
          // If no app_users row exists yet, provision it from Google metadata
          const newRecord = {
            id: user.id,
            full_name: metaName,
            avatar_url: metaAvatar,
            created_at: new Date().toISOString(),
          };
          supabase.from('app_users').insert(newRecord).then(() => {});
          set({
            appUser: {
              id: user.id,
              full_name: metaName,
              phone: null,
              avatar_url: metaAvatar,
              age: null,
              weight: null,
              height: null,
              gender: null,
              allergies: [],
              existing_conditions: [],
              current_medications: [],
              created_at: newRecord.created_at,
              updated_at: newRecord.created_at,
            },
          });
        } else {
          // If existing app_user was missing full_name/avatar_url, fill from Google metadata
          let updatedName = data.full_name;
          let updatedAvatar = data.avatar_url;
          if (!updatedName && metaName) updatedName = metaName;
          if (!updatedAvatar && metaAvatar) updatedAvatar = metaAvatar;

          if ((!data.full_name && metaName) || (!data.avatar_url && metaAvatar)) {
            supabase
              .from('app_users')
              .update({ full_name: updatedName, avatar_url: updatedAvatar })
              .eq('id', user.id)
              .then(() => {});
          }

          set({
            appUser: {
              id: data.id,
              full_name: updatedName ?? null,
              phone: data.phone ?? null,
              avatar_url: updatedAvatar ?? null,
              age: data.age ?? null,
              weight: data.weight ?? null,
              height: data.height ?? null,
              gender: data.gender ?? null,
              allergies: data.allergies ?? [],
              existing_conditions: data.existing_conditions ?? [],
              current_medications: data.current_medications ?? [],
              created_at: data.created_at,
              updated_at: data.updated_at,
            },
          });
        }
      } catch (e: any) {
        console.warn('fetchAppUser error:', e.message);
      }
    },

    updateAppUser: async (dataToUpdate) => {
      const user = get().user;
      if (!user) throw new Error('Not authenticated');

      // Optimistic local update
      const currentAppUser = get().appUser;
      const updatedLocal = {
        id: user.id,
        ...(currentAppUser || {}),
        ...dataToUpdate,
        updated_at: new Date().toISOString(),
      } as AppUser;
      set({ appUser: updatedLocal });

      try {
        const { error } = await supabase.from('app_users').upsert({
          id: user.id,
          ...dataToUpdate,
          updated_at: new Date().toISOString(),
        });
        if (error) throw error;
      } catch (e) {
        console.warn('Network update failed. Enqueued offline sync.');
        await enqueueOfflineAction('UPDATE_APP_USER', user.id, dataToUpdate);
      }
    },

    // ── Profile (name / phone / avatar for display) ──────────────────────────
    updateProfile: async (dataToUpdate) => {
      const user = get().user;
      const currentProfile = get().profile;
      if (!user) return;

      // Optimistic local update in Zustand state
      set({
        profile: currentProfile
          ? { ...currentProfile, ...dataToUpdate }
          : null,
      });

      const role = currentProfile?.role ?? 'user';
      const isRemoteUrl = !dataToUpdate.avatar_url || dataToUpdate.avatar_url.startsWith('http');

      // Only save avatar_url to DB if it is a remote HTTP/HTTPS URL or null (NEVER blob: or file:)
      try {
        const payload: any = {
          id: user.id,
          full_name: dataToUpdate.full_name ?? currentProfile?.full_name,
          phone: dataToUpdate.phone ?? currentProfile?.phone,
          updated_at: new Date().toISOString(),
        };
        if (isRemoteUrl && dataToUpdate.avatar_url !== undefined) {
          payload.avatar_url = dataToUpdate.avatar_url;
        }

        if (role === 'user' || role === 'both') {
          await supabase.from('app_users').upsert(payload);
        }

        if (role === 'pharmacy' || role === 'both') {
          const pharmPayload: any = {
            name: dataToUpdate.full_name ?? currentProfile?.full_name,
            phone: dataToUpdate.phone ?? currentProfile?.phone,
          };
          if (isRemoteUrl && dataToUpdate.avatar_url !== undefined) {
            pharmPayload.avatar_url = dataToUpdate.avatar_url;
          }
          await supabase.from('pharmacies').update(pharmPayload).eq('owner_id', user.id);
        }
      } catch (e) {
        console.warn('Profile update enqueued offline.');
        await enqueueOfflineAction('UPDATE_PROFILE', user.id, dataToUpdate);
      }
    },

    // ── Avatar Upload ────────────────────────────────────────────────────────
    uploadAvatar: async (imageUri: string) => {
      const user = get().user;
      if (!user) return null;

      const previousProfile = get().profile;

      try {
        const cleanUri = imageUri.split('?')[0];
        const fileExt = cleanUri.split('.').pop()?.toLowerCase() || 'jpg';
        const fileName = `${user.id}-${Date.now()}.${fileExt}`;
        const contentType = `image/${fileExt === 'png' ? 'png' : fileExt === 'webp' ? 'webp' : 'jpeg'}`;

        let fileData: any;

        if (Platform.OS === 'web') {
          // Web: fetch blob URL natively
          const res = await fetch(imageUri);
          fileData = await res.blob();
        } else {
          // Native iOS & Android: read via FileSystem legacy API into Base64 -> ArrayBuffer
          const base64 = await FileSystem.readAsStringAsync(imageUri, {
            encoding: FileSystem.EncodingType.Base64,
          });
          fileData = base64ToArrayBuffer(base64);
        }

        // 1. Upload file to public Supabase Storage bucket 'avatars'
        const { data: uploadData, error: uploadErr } = await supabase.storage
          .from('avatars')
          .upload(fileName, fileData, {
            contentType,
            upsert: true,
          });

        if (uploadErr) {
          console.error('Supabase avatars storage error:', uploadErr.message);
          throw uploadErr;
        }

        // 2. Get the permanent public HTTP URL from Supabase Storage
        const { data: urlData } = supabase.storage
          .from('avatars')
          .getPublicUrl(fileName);

        const publicUrl = urlData?.publicUrl;

        if (publicUrl) {
          // 3. Save permanent public URL in database tables & Zustand store
          await get().updateProfile({ avatar_url: publicUrl });
          return publicUrl;
        }
      } catch (e: any) {
        console.warn('Avatar upload warning:', e?.message || e);
        // Revert profile state on failure so broken blob: URLs do not remain stuck in memory
        if (previousProfile) {
          set({ profile: previousProfile });
        }
        await enqueueOfflineAction('UPLOAD_AVATAR', user.id, { imageUri });
      }

      return null;
    },

    refreshProfile: async () => {
      const user = get().user;
      if (!user) return;
      try {
        const freshProfile = await resolveProfile(user.id);
        if (freshProfile) {
          set({ profile: freshProfile });
        }
      } catch (e: any) {
        console.warn('refreshProfile error:', e?.message || e);
      }
    },
  };
});