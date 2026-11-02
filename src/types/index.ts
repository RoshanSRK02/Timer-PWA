export type ThemePreference = "light" | "dark" | "system";
export type TimerStatus = "idle" | "running" | "paused";

export interface FocusSession {
  id: string;
  label: string;
  durationMinutes: number;
  completedAt: string;
}
