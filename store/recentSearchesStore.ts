import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

const LEGACY_STORAGE_KEY = '@PharmFindr_recent_searches_v1';

const getStorageKey = (userId?: string | null) => {
  if (userId) {
    return `@PharmFindr_recent_searches_user_${userId}`;
  }
  return `@PharmFindr_recent_searches_guest`;
};

interface RecentSearchesState {
  recentSearches: string[];
  isLoaded: boolean;
  currentUserId: string | null;
  loadRecentSearches: (userId?: string | null) => Promise<void>;
  addRecentSearch: (term: string, userId?: string | null) => Promise<void>;
  removeRecentSearch: (term: string, userId?: string | null) => Promise<void>;
  clearAllRecentSearches: (userId?: string | null) => Promise<void>;
  resetStore: () => void;
}

export const useRecentSearchesStore = create<RecentSearchesState>((set, get) => ({
  recentSearches: [],
  isLoaded: false,
  currentUserId: null,

  loadRecentSearches: async (userId?: string | null) => {
    const targetUserId = userId || null;
    const key = getStorageKey(targetUserId);

    // Clean up legacy global dummy storage if present
    try {
      await AsyncStorage.removeItem(LEGACY_STORAGE_KEY);
    } catch (_) {}

    try {
      const stored = await AsyncStorage.getItem(key);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          set({ recentSearches: parsed, isLoaded: true, currentUserId: targetUserId });
          return;
        }
      }
      set({ recentSearches: [], isLoaded: true, currentUserId: targetUserId });
    } catch (e) {
      console.warn('Error loading recent searches:', e);
      set({ recentSearches: [], isLoaded: true, currentUserId: targetUserId });
    }
  },

  addRecentSearch: async (term: string, userId?: string | null) => {
    const trimmed = term.trim();
    if (!trimmed) return;

    const targetUserId = userId !== undefined ? userId : get().currentUserId;
    const key = getStorageKey(targetUserId);
    const list = get().recentSearches;

    // Filter out existing occurrence so recent item moves to top
    const filtered = list.filter((item) => item.toLowerCase() !== trimmed.toLowerCase());
    const updatedList = [trimmed, ...filtered].slice(0, 8); // keep max 8

    set({ recentSearches: updatedList, currentUserId: targetUserId || null });
    try {
      await AsyncStorage.setItem(key, JSON.stringify(updatedList));
    } catch (e) {
      console.warn('Error saving recent search:', e);
    }
  },

  removeRecentSearch: async (term: string, userId?: string | null) => {
    const targetUserId = userId !== undefined ? userId : get().currentUserId;
    const key = getStorageKey(targetUserId);
    const list = get().recentSearches;
    const updatedList = list.filter((item) => item.toLowerCase() !== term.toLowerCase());

    set({ recentSearches: updatedList });
    try {
      await AsyncStorage.setItem(key, JSON.stringify(updatedList));
    } catch (e) {
      console.warn('Error removing recent search:', e);
    }
  },

  clearAllRecentSearches: async (userId?: string | null) => {
    const targetUserId = userId !== undefined ? userId : get().currentUserId;
    const key = getStorageKey(targetUserId);
    set({ recentSearches: [] });
    try {
      await AsyncStorage.removeItem(key);
    } catch (e) {
      console.warn('Error clearing recent searches:', e);
    }
  },

  resetStore: () => {
    set({ recentSearches: [], isLoaded: false, currentUserId: null });
  },
}));
