import { create } from 'zustand';
import { Platform, Alert } from 'react-native';
import { flushOfflineSyncQueue } from '@/lib/offlineSyncQueue';

interface NetworkState {
  isConnected: boolean;
  isPoorConnection: boolean;
  wasOffline: boolean;
  isBannerDismissed: boolean;
  dismissBanner: () => void;
  triggerOfflineNotice: () => void;
  setConnected: (connected: boolean, isPoor?: boolean) => void;
  checkConnection: () => Promise<void>;
  requireOnline: (actionCallback?: () => void | Promise<void>) => Promise<boolean>;
}

export const useNetworkStore = create<NetworkState>((set, get) => ({
  isConnected: true,
  isPoorConnection: false,
  wasOffline: false,
  isBannerDismissed: false,

  dismissBanner: () => {
    set({ isBannerDismissed: true });
  },

  triggerOfflineNotice: () => {
    set({ isBannerDismissed: false });
  },

  setConnected: (connected: boolean, isPoor = false) => {
    const currentState = get().isConnected;
    if (!connected && currentState) {
      set({ isConnected: false, isPoorConnection: false, wasOffline: true, isBannerDismissed: false });
    } else if (connected) {
      const hadBeenOffline = get().wasOffline;
      set({ isConnected: true, isPoorConnection: isPoor, isBannerDismissed: false });
      if (hadBeenOffline || !isPoor) {
        flushOfflineSyncQueue();
      }
    }
  },

  checkConnection: async () => {
    try {
      if (Platform.OS === 'web' && typeof window !== 'undefined' && 'navigator' in window) {
        if (!navigator.onLine) {
          get().setConnected(false);
          return;
        }
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);

      const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';
      const response = await fetch(
        `https://aawmvtbnoobpndexdfxg.supabase.co/auth/v1/health?apikey=${encodeURIComponent(anonKey)}`,
        {
          method: 'GET',
          signal: controller.signal,
          cache: 'no-store',
        }
      );
      clearTimeout(timeoutId);

      if (response.ok || response.status === 401 || response.status === 404) {
        get().setConnected(true, false);
      } else {
        get().setConnected(false);
      }
    } catch (e) {
      get().setConnected(false);
    }
  },

  requireOnline: async (actionCallback) => {
    const { isConnected } = get();
    if (!isConnected) {
      // Re-pop the offline banner if it was dismissed
      set({ isBannerDismissed: false });
      return false;
    }
    if (actionCallback) {
      await actionCallback();
    }
    return true;
  },
}));

// Initialize window event listeners on Web
if (Platform.OS === 'web' && typeof window !== 'undefined') {
  window.addEventListener('online', () => useNetworkStore.getState().checkConnection());
  window.addEventListener('offline', () => useNetworkStore.getState().setConnected(false));
}
