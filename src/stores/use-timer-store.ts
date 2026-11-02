import { create } from "zustand";
import type { TimerStatus } from "@/types";

const DEFAULT_DURATION = 25 * 60;

interface TimerState {
  durationSeconds: number;
  remainingSeconds: number;
  status: TimerStatus;
  completedSessions: number;
  setDuration: (minutes: number) => void;
  start: () => void;
  pause: () => void;
  reset: () => void;
  tick: () => void;
}

export const useTimerStore = create<TimerState>((set) => ({
  durationSeconds: DEFAULT_DURATION,
  remainingSeconds: DEFAULT_DURATION,
  status: "idle",
  completedSessions: 0,
  setDuration: (minutes) =>
    set({
      durationSeconds: minutes * 60,
      remainingSeconds: minutes * 60,
      status: "idle",
    }),
  start: () =>
    set((state) => ({
      status: state.remainingSeconds > 0 ? "running" : "idle",
    })),
  pause: () => set({ status: "paused" }),
  reset: () =>
    set((state) => ({
      remainingSeconds: state.durationSeconds,
      status: "idle",
    })),
  tick: () =>
    set((state) => {
      if (state.status !== "running") return state;

      if (state.remainingSeconds <= 1) {
        return {
          remainingSeconds: 0,
          status: "idle",
          completedSessions: state.completedSessions + 1,
        };
      }

      return { remainingSeconds: state.remainingSeconds - 1 };
    }),
}));
