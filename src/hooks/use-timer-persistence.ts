import { useContext } from "react";
import { TimerPersistenceContext } from "@/app/providers/timer-context";

export function useTimerPersistence() {
  const context = useContext(TimerPersistenceContext);
  if (!context) {
    throw new Error("useTimerPersistence must be used within TimerProvider.");
  }
  return context;
}
