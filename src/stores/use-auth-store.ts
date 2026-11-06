import { create } from "zustand";
import type { User } from "@supabase/supabase-js";

export const GUEST_USER_ID = "guest-local";

interface AuthState {
  user: User | null;
  isLoading: boolean;
  initializationError: string | null;
  setUser: (user: User | null) => void;
  setIsLoading: (isLoading: boolean) => void;
  setInitializationError: (error: string | null) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: true,
  initializationError: null,
  setUser: (user) => set({ user }),
  setIsLoading: (isLoading) => set({ isLoading }),
  setInitializationError: (initializationError) =>
    set({ initializationError }),
}));
