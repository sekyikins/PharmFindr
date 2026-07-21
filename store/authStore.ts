import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import { Session, User } from '@supabase/supabase-js';

export interface Profile {
  id: string;
  role: 'patient' | 'pharmacy';
  full_name: string | null;
  phone: string | null;
  avatar_url: string | null;
  created_at: string;
}

export interface PatientProfile {
  id: string;
  age: number | null;
  weight: number | null;
  height: number | null;
  gender: string | null;
  allergies: string[];
  existing_conditions: string[];
  current_medications: string[];
  updated_at?: string;
}

interface AuthState {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  patientProfile: PatientProfile | null;
  loading: boolean;
  initialized: boolean;
  signUp: (phone: string, email: string, password: string, role: 'patient' | 'pharmacy', fullName: string) => Promise<User | null>;
  signIn: (emailOrPhone: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  initialize: () => Promise<void>;
  fetchPatientProfile: () => Promise<void>;
  updatePatientProfile: (data: Partial<PatientProfile>) => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => {
  // Listen to auth state changes from Supabase
  supabase.auth.onAuthStateChange(async (event, session) => {
    if (session) {
      set({ session, user: session.user, loading: true });
      try {
        // Fetch profile
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single();

        if (error || !profile) {
          console.warn('Error fetching profile or profile not found:', error?.message);
          const meta = session.user.user_metadata || {};
          const fallbackProfile: Profile = {
            id: session.user.id,
            role: meta.role || 'patient',
            full_name: meta.full_name || null,
            phone: meta.phone || null,
            avatar_url: meta.avatar_url || null,
            created_at: new Date().toISOString(),
          };
          set({ profile: fallbackProfile });
        } else {
          set({ profile: profile as Profile });
        }
      } catch (e) {
        console.error('Error in auth state change profile fetch:', e);
      } finally {
        set({ loading: false });
      }
    } else {
      set({ session: null, user: null, profile: null, loading: false });
    }
  });

  return {
    session: null,
    user: null,
    profile: null,
    patientProfile: null,
    loading: true,
    initialized: false,

    signUp: async (phone, email, password, role, fullName) => {
      set({ loading: true });
      // Derive email from phone if email is not provided
      const finalEmail = email.trim() || `${phone.replace(/\s+/g, '')}@pharmafindr.com`;

      const { data, error } = await supabase.auth.signUp({
        email: finalEmail,
        password,
        options: {
          data: {
            role,
            full_name: fullName,
            phone,
          }
        }
      });

      if (error) {
        set({ loading: false });
        throw error;
      }

      // Profile is auto-created by the database trigger
      set({ loading: false });
      return data.user;
    },

    signIn: async (emailOrPhone, password) => {
      set({ loading: true });
      const email = emailOrPhone.includes('@')
        ? emailOrPhone.trim()
        : `${emailOrPhone.replace(/\s+/g, '')}@pharmafindr.com`;

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        set({ loading: false });
        throw error;
      }

      set({ loading: false });
    },

    signOut: async () => {
      set({ loading: true });
      const { error } = await supabase.auth.signOut();
      if (error) {
        set({ loading: false });
        throw error;
      }
      set({ session: null, user: null, profile: null, patientProfile: null, loading: false });
    },

    fetchPatientProfile: async () => {
      const user = get().user;
      if (!user) return;
      try {
        const { data, error } = await supabase
          .from('patient_profiles')
          .select('*')
          .eq('id', user.id)
          .single();

        if (error && error.code !== 'PGRST116' && !error.message?.includes('schema cache')) {
          console.warn('Note on patient profile:', error.message);
        }

        if (data) {
          set({
            patientProfile: {
              id: data.id,
              age: data.age ?? null,
              weight: data.weight ?? null,
              height: data.height ?? null,
              gender: data.gender ?? null,
              allergies: data.allergies ?? [],
              existing_conditions: data.existing_conditions ?? [],
              current_medications: data.current_medications ?? [],
            },
          });
        }
      } catch (e: any) {
        console.warn('Error in fetchPatientProfile:', e.message);
      }
    },

    updatePatientProfile: async (dataToUpdate) => {
      const user = get().user;
      if (!user) throw new Error('Not authenticated');

      const payload = {
        id: user.id,
        ...dataToUpdate,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from('patient_profiles')
        .upsert(payload);

      if (error) throw error;

      await get().fetchPatientProfile();
    },

    initialize: async () => {
      if (get().initialized) return;
      set({ loading: true });
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          const { data: profile, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .single();

          if (error || !profile) {
            console.warn('Error fetching profile on initialize:', error?.message);
            const meta = session.user.user_metadata || {};
            const fallbackProfile: Profile = {
              id: session.user.id,
              role: meta.role || 'patient',
              full_name: meta.full_name || null,
              phone: meta.phone || null,
              avatar_url: meta.avatar_url || null,
              created_at: new Date().toISOString(),
            };
            set({
              session,
              user: session.user,
              profile: fallbackProfile,
            });
          } else {
            set({
              session,
              user: session.user,
              profile: profile as Profile,
            });
            if (profile.role === 'patient') {
              get().fetchPatientProfile();
            }
          }
        }
      } catch (e) {
        console.warn('Error during auth initialization:', e);
      } finally {
        set({ initialized: true, loading: false });
      }
    },
  };
});