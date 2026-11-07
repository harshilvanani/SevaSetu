import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

type Mode = 'volunteer' | 'organizer';

type AppState = {
  mode: Mode;
  setMode: (m: Mode) => void;
  activeOrgId: string | null;
  setActiveOrgId: (id: string | null) => void;
  // Coarse location for guests (signed-in users keep it on their profile).
  guestCity: string | null;
  setGuestCity: (c: string | null) => void;
};

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      mode: 'volunteer',
      setMode: (mode) => set({ mode }),
      activeOrgId: null,
      setActiveOrgId: (activeOrgId) => set({ activeOrgId }),
      guestCity: null,
      setGuestCity: (guestCity) => set({ guestCity }),
    }),
    { name: 'sevasetu-app', storage: createJSONStorage(() => AsyncStorage) },
  ),
);
