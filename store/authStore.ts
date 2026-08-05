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
import { Platform } from 'react-native';

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
  signOut: () => Promise<void>;
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

/**
 * Single-query role lookup via user_roles table, then fetch matching identity row.
 * Returns a unified Profile object ready for the rest of the app.
 */
async function resolveProfile(userId: string): Promise<Profile | null> {
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
      return {
        id: userId,
        role: 'pharmacy',
        full_name: pharm.name ?? 'Pharmacy Manager',
        phone: pharm.phone ?? null,
        avatar_url: null,
        created_at: pharm.created_at ?? new Date().toISOString(),
      };
    }
  }

  // For 'user' and 'both': identity lives in app_users
  if (role === 'user' || role === 'both') {
    const { data: appUser } = await supabase
      .from('app_users')
      .select('id, full_name, phone, avatar_url, created_at')
      .eq('id', userId)
      .maybeSingle();

    return {
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

    return {
      id: userId,
      role: 'pharmacy',
      full_name: pharmacy?.name ?? 'Pharmacy Manager',
      phone: pharmacy?.phone ?? null,
      avatar_url: null,
      created_at: pharmacy?.created_at ?? new Date().toISOString(),
    };
  }
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useAuthStore = create<AuthState>((set, get) => {
  // Listen to Supabase auth state changes
  supabase.auth.onAuthStateChange(async (event, session) => {
    if (session) {
      set({ session, user: session.user, loading: true });
      try {
        const profile = await resolveProfile(session.user.id);
        set({ profile });
        await updateLastActiveTimestamp();
      } catch (e) {
        console.error('Error resolving profile in auth state change:', e);
      } finally {
        set({ loading: false });
      }
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

    // ── Update Password & Revoke Other Sessions ──────────────────────────────
    updatePasswordAndRevokeOtherSessions: async (newPassword: string) => {
      set({ loading: true });
      try {
        const { error } = await supabase.auth.updateUser({ password: newPassword });
        if (error) throw error;

        await revokeAllOtherSessions();

        set({
          securityNotice: 'Your password was updated. All other active device sessions have been logged out for security.',
        });
      } catch (e) {
        throw e;
      } finally {
        set({ loading: false });
      }
    },

    // ── Sign Out ─────────────────────────────────────────────────────────────
    signOut: async () => {
      set({ loading: true });
      const { error } = await supabase.auth.signOut();
      if (error) {
        set({ loading: false });
        throw error;
      }
      set({ session: null, user: null, profile: null, appUser: null, loading: false });
    },

    // ── Initialize (cold start with 7-day inactivity check) ────────────────
    initialize: async () => {
      if (get().initialized) return;
      set({ loading: true });
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          const isExpired = await checkInactivityTimeout();
          if (isExpired) {
            console.info('Session expired due to 7 days of inactivity.');
            await supabase.auth.signOut();
            set({
              session: null,
              user: null,
              profile: null,
              appUser: null,
              securityNotice: 'You have been logged out due to 7 days of inactivity for account security.',
            });
            return;
          }

          const profile = await resolveProfile(session.user.id);
          set({ session, user: session.user, profile });

          const userRole = profile?.role === 'pharmacy' ? 'pharmacy' : 'patient';
          await registerDeviceSession(session.user.id, userRole);

          if (profile?.role === 'user') {
            get().fetchAppUser();
          }
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

        if (data) {
          set({
            appUser: {
              id: data.id,
              full_name: data.full_name ?? null,
              phone: data.phone ?? null,
              avatar_url: data.avatar_url ?? null,
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