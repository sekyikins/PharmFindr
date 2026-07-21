import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

const supabaseUrl = (process.env.EXPO_PUBLIC_SUPABASE_URL || '').trim();
const supabaseAnonKey = (process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '').trim();

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase URL or Anon Key is missing from environment variables.');
}

// Use AsyncStorage on native, localStorage (via window) on web
const getStorage = () => {
  if (Platform.OS === 'web') {
    return {
      getItem: (key: string) => Promise.resolve(localStorage.getItem(key)),
      setItem: (key: string, value: string) => { localStorage.setItem(key, value); return Promise.resolve(); },
      removeItem: (key: string) => { localStorage.removeItem(key); return Promise.resolve(); },
    };
  }
  // Dynamically require AsyncStorage only on native
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const AsyncStorage = require('@react-native-async-storage/async-storage').default;
  return AsyncStorage;
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: getStorage() as any,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
