import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { type MedicineItem } from '@/lib/medicineCatalogue';

const getStorageKey = (userId?: string) => {
  return userId ? `@PharmFindr_saved_medicines_user_${userId}` : '@PharmFindr_saved_medicines_guest';
};

interface SavedMedicinesState {
  savedMedicines: MedicineItem[];
  isLoaded: boolean;
  currentUserId?: string;
  loadSavedMedicines: (userId?: string) => Promise<void>;
  isSaved: (medicineId: string) => boolean;
  toggleSaveMedicine: (medicine: MedicineItem) => Promise<boolean>;
  removeSavedMedicine: (medicineId: string) => Promise<void>;
  clearAllSaved: (userId?: string) => Promise<void>;
}

export const useSavedMedicinesStore = create<SavedMedicinesState>((set, get) => ({
  savedMedicines: [],
  isLoaded: false,
  currentUserId: undefined,

  loadSavedMedicines: async (userId?: string) => {
    set({ currentUserId: userId });
    try {
      const key = getStorageKey(userId);
      const stored = await AsyncStorage.getItem(key);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          set({ savedMedicines: parsed, isLoaded: true });
          return;
        }
      }
      set({ savedMedicines: [], isLoaded: true });
    } catch (e) {
      console.warn('Error loading saved medicines:', e);
      set({ savedMedicines: [], isLoaded: true });
    }
  },

  isSaved: (medicineId: string) => {
    const list = get().savedMedicines;
    return list.some(
      (m) => m.id === medicineId || m.name.toLowerCase() === medicineId.toLowerCase()
    );
  },

  toggleSaveMedicine: async (medicine: MedicineItem) => {
    const list = get().savedMedicines;
    const userId = get().currentUserId;
    const key = getStorageKey(userId);

    const exists = list.some(
      (m) => m.id === medicine.id || m.name.toLowerCase() === medicine.name.toLowerCase()
    );

    let updatedList: MedicineItem[];
    let nowSaved = false;

    if (exists) {
      updatedList = list.filter(
        (m) => m.id !== medicine.id && m.name.toLowerCase() !== medicine.name.toLowerCase()
      );
      nowSaved = false;
    } else {
      updatedList = [medicine, ...list];
      nowSaved = true;
    }

    set({ savedMedicines: updatedList });
    try {
      await AsyncStorage.setItem(key, JSON.stringify(updatedList));
    } catch (e) {
      console.warn('Error saving medicines:', e);
    }
    return nowSaved;
  },

  removeSavedMedicine: async (medicineId: string) => {
    const list = get().savedMedicines;
    const userId = get().currentUserId;
    const key = getStorageKey(userId);

    const updatedList = list.filter(
      (m) => m.id !== medicineId && m.name.toLowerCase() !== medicineId.toLowerCase()
    );
    set({ savedMedicines: updatedList });
    try {
      await AsyncStorage.setItem(key, JSON.stringify(updatedList));
    } catch (e) {
      console.warn('Error removing saved medicine:', e);
    }
  },

  clearAllSaved: async (userId?: string) => {
    const key = getStorageKey(userId || get().currentUserId);
    set({ savedMedicines: [] });
    try {
      await AsyncStorage.removeItem(key);
    } catch (e) {
      console.warn('Error clearing saved medicines:', e);
    }
  },
}));
