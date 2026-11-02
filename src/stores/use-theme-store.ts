import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ThemePreference } from "@/types";

interface ThemeState {
  theme: ThemePreference;
  setTheme: (theme: ThemePreference) => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      theme: "system",
      setTheme: (theme) => set({ theme }),
    }),
    { name: "tempo-theme" },
  ),
);
