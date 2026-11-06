export type ThemePreference = "light" | "dark" | "oled" | "system";
export type TimerStatus =
  | "idle"
  | "running"
  | "paused"
  | "awaiting-completion"
  | "overtime";

export interface SuspendedFocusTimer {
  status: "running" | "paused" | "overtime";
  wasRunning: boolean;
  taskSheetId: string | null;
  taskId: string | null;
  durationSeconds: number;
  accumulatedSeconds: number;
  sessionId: string | null;
  sessionStartedAt: string | null;
}

export interface TimerSnapshot {
  userId: string;
  displayReset: boolean;
  status: TimerStatus;
  taskSheetId: string | null;
  taskId: string | null;
  durationSeconds: number;
  accumulatedSeconds: number;
  startedAt: string | null;
  sessionId: string | null;
  sessionStartedAt: string | null;
  breakSession: boolean;
  breakLabel: string | null;
  breakComplete: boolean;
  suspendedFocus: SuspendedFocusTimer | null;
  updatedAt: string;
  completedSessions: number;
  completionConfirmed: boolean;
  lastSession: TimerSessionRecord | null;
}

export interface TimerSessionRecord {
  id: string;
  userId: string;
  taskSheetId: string | null;
  taskId: string | null;
  durationSeconds: number;
  actualSeconds: number;
  overtimeSeconds: number;
  startedAt: string;
  endedAt: string;
  breakSession: boolean;
  breakLabel: string | null;
  notes: string;
  outcome: "stopped" | "completed" | "incomplete";
  updatedAt: string;
}

export interface FocusSession {
  id: string;
  label: string;
  durationMinutes: number;
  completedAt: string;
}

export type TaskStatus =
  | "Pending"
  | "InProgress"
  | "Paused"
  | "Completed"
  | "Skipped"
  | "Archived";

export type TaskCompletionMethod = "manual" | "timer";

export interface Task {
  id: string;
  title: string;
  description?: string;
  estimatedMinutes: number;
  actualMinutes: number | null;
  status: TaskStatus;
  createdAt: string;
  updatedAt: string;
  completedAt?: string | null;
  completionMethod?: TaskCompletionMethod | null;
}

export interface TaskSheet {
  id: string;
  name: string;
  tasks: Task[];
  createdAt: string;
  updatedAt: string;
}
