import { createContext } from "react";

export interface TimerPersistenceContextValue {
  isLoading: boolean;
  error: string | null;
  retry: () => void;
}

export const TimerPersistenceContext =
  createContext<TimerPersistenceContextValue | null>(null);
