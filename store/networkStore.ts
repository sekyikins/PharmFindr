import { create } from 'zustand';
import { Platform } from 'react-native';
import { flushOfflineSyncQueue } from '@/lib/offlineSyncQueue';

interface NetworkState {
  isConnected: boolean;
  isPoorConnection: boolean;
  wasOffline: boolean;
  setConnected: (connected: boolean, isPoor?: boolean) => void;
  checkConnection: () => Promise<void>;
}

export const useNetworkStore = create<NetworkState>((set, get) => ({
  isConnected: true,
  isPoorConnection: false,
  wasOffline: false,

  setConnected: (connected: boolean, isPoor = false) => {
    const currentState = get().isConnected;
    if (!connected && currentState) {
      set({ isConnected: false, isPoorConnection: false, wasOffline: true });
    } else if (connected) {
      const hadBeenOffline = get().wasOffline;
      set({ isConnected: true, isPoorConnection: isPoor });
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
      const startTime = Date.now();

      const response = await fetch('https://aawmvtbnoobpndexdfxg.supabase.co/rest/v1/', {
        method: 'HEAD',
        signal: controller.signal,
        cache: 'no-store',
      });
      clearTimeout(timeoutId);

      const duration = Date.now() - startTime;
      const isSlow = duration > 2500;

      if (response.ok || response.status === 401 || response.status === 404) {
        get().setConnected(true, isSlow);
      } else {
        get().setConnected(false);
      }
    } catch (e) {
      get().setConnected(false);
    }
  },
}));

// Initialize window event listeners on Web
if (Platform.OS === 'web' && typeof window !== 'undefined') {
  window.addEventListener('online', () => useNetworkStore.getState().checkConnection());
  window.addEventListener('offline', () => useNetworkStore.getState().setConnected(false));
}
