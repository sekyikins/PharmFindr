import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MedicineItem, MASTER_MEDICINES_CATALOGUE, getMedicineByIdOrName } from '@/lib/medicineCatalogue';

const STORAGE_KEY = '@PharmFindr_saved_medicines_v1';

interface SavedMedicinesState {
  savedMedicines: MedicineItem[];
  isLoaded: boolean;
  loadSavedMedicines: () => Promise<void>;
  isSaved: (medicineId: string) => boolean;
  toggleSaveMedicine: (medicine: MedicineItem) => Promise<boolean>;
  removeSavedMedicine: (medicineId: string) => Promise<void>;
  clearAllSaved: () => Promise<void>;
}

export const useSavedMedicinesStore = create<SavedMedicinesState>((set, get) => ({
  savedMedicines: [
    // Pre-populate with essential default saved items if empty
    MASTER_MEDICINES_CATALOGUE[0], // Paracetamol
    MASTER_MEDICINES_CATALOGUE[1], // Amoxicillin
  ],
  isLoaded: false,

  loadSavedMedicines: async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          set({ savedMedicines: parsed, isLoaded: true });
          return;
        }
      }
      set({ isLoaded: true });
    } catch (e) {
      console.warn('Error loading saved medicines:', e);
      set({ isLoaded: true });
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
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updatedList));
    } catch (e) {
      console.warn('Error saving medicines:', e);
    }
    return nowSaved;
  },

  removeSavedMedicine: async (medicineId: string) => {
    const list = get().savedMedicines;
    const updatedList = list.filter(
      (m) => m.id !== medicineId && m.name.toLowerCase() !== medicineId.toLowerCase()
    );
    set({ savedMedicines: updatedList });
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updatedList));
    } catch (e) {
      console.warn('Error removing saved medicine:', e);
    }
  },

  clearAllSaved: async () => {
    set({ savedMedicines: [] });
    try {
      await AsyncStorage.removeItem(STORAGE_KEY);
    } catch (e) {
      console.warn('Error clearing saved medicines:', e);
    }
  },
}));
