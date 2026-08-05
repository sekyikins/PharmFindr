import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@PharmFindr_recent_searches_v1';
const DEFAULT_SEARCHES = ['Paracetamol', 'Amoxicillin', 'Metformin', 'Ibuprofen', 'Coartem'];

interface RecentSearchesState {
  recentSearches: string[];
  isLoaded: boolean;
  loadRecentSearches: () => Promise<void>;
  addRecentSearch: (term: string) => Promise<void>;
  removeRecentSearch: (term: string) => Promise<void>;
  clearAllRecentSearches: () => Promise<void>;
}

export const useRecentSearchesStore = create<RecentSearchesState>((set, get) => ({
  recentSearches: DEFAULT_SEARCHES,
  isLoaded: false,

  loadRecentSearches: async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          set({ recentSearches: parsed, isLoaded: true });
          return;
        }
      }
      set({ isLoaded: true });
    } catch (e) {
      console.warn('Error loading recent searches:', e);
      set({ isLoaded: true });
    }
  },

  addRecentSearch: async (term: string) => {
    const trimmed = term.trim();
    if (!trimmed) return;

    const list = get().recentSearches;
    // Filter out existing occurrence to move to top
    const filtered = list.filter((item) => item.toLowerCase() !== trimmed.toLowerCase());
    const updatedList = [trimmed, ...filtered].slice(0, 8); // keep max 8

    set({ recentSearches: updatedList });
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updatedList));
    } catch (e) {
      console.warn('Error saving recent search:', e);
    }
  },

  removeRecentSearch: async (term: string) => {
    const list = get().recentSearches;
    const updatedList = list.filter((item) => item.toLowerCase() !== term.toLowerCase());

    set({ recentSearches: updatedList });
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updatedList));
    } catch (e) {
      console.warn('Error removing recent search:', e);
    }
  },

  clearAllRecentSearches: async () => {
    set({ recentSearches: [] });
    try {
      await AsyncStorage.removeItem(STORAGE_KEY);
    } catch (e) {
      console.warn('Error clearing recent searches:', e);
    }
  },
}));
