import { create } from "zustand";
import { useTaskStore } from "@/stores/use-task-store";
import type { TimerSessionRecord, TimerSnapshot } from "@/types";

const DEFAULT_DURATION = 25 * 60;

interface TimerState extends Omit<TimerSnapshot, "userId"> {
  userId: string | null;
  setDuration: (minutes: number) => void;
  startTask: (sheetId: string, taskId: string, minutes: number) => boolean;
  switchTask: (sheetId: string, taskId: string, minutes: number) => boolean;
  startBreak: (minutes: number, label: string) => boolean;
  start: () => void;
  pause: () => void;
  resume: () => void;
  stop: (now?: number) => void;
  extend: (minutes: number) => void;
  finishEarly: (now?: number) => void;
  completeIfExpired: (now?: number) => void;
  confirmTaskCompletion: () => void;
  resolveTaskCompletion: (completed: boolean, now?: number) => void;
  restoreSnapshot: (snapshot: TimerSnapshot | null, userId: string) => void;
  toSnapshot: () => TimerSnapshot | null;
}

function nowIso(now = Date.now()): string {
  return new Date(now).toISOString();
}

function getElapsedSeconds(
  state: Pick<
    TimerState,
    "status" | "accumulatedSeconds" | "startedAt" | "durationSeconds"
  >,
  now = Date.now(),
): number {
  let elapsed = state.accumulatedSeconds;

  if (state.status === "running" && state.startedAt) {
    const startedAt = Date.parse(state.startedAt);
    if (Number.isFinite(startedAt)) {
      elapsed += Math.max(0, Math.floor((now - startedAt) / 1000));
    }
  }

  return Math.min(state.durationSeconds, elapsed);
}

export function getTimerElapsedSeconds(
  state: TimerState,
  now = Date.now(),
): number {
  return getElapsedSeconds(state, now);
}

export function getTimerRemainingSeconds(
  state: TimerState,
  now = Date.now(),
): number {
  return Math.max(0, state.durationSeconds - getElapsedSeconds(state, now));
}

type TimerData = Omit<
  TimerState,
  | "setDuration"
  | "startTask"
  | "switchTask"
  | "startBreak"
  | "start"
  | "pause"
  | "resume"
  | "stop"
  | "extend"
  | "finishEarly"
  | "completeIfExpired"
  | "confirmTaskCompletion"
  | "resolveTaskCompletion"
  | "restoreSnapshot"
  | "toSnapshot"
>;

function emptyTimerState(
  userId: string | null,
  completedSessions = 0,
  lastSession: TimerSessionRecord | null = null,
  durationSeconds = DEFAULT_DURATION,
): TimerData {
  return {
    userId,
    status: "idle",
    taskSheetId: null,
    taskId: null,
    durationSeconds,
    accumulatedSeconds: 0,
    startedAt: null,
    sessionId: null,
    sessionStartedAt: null,
    breakSession: false,
    breakLabel: null,
    updatedAt: nowIso(),
    completedSessions,
    completionConfirmed: false,
    lastSession,
  };
}

function createSessionRecord(
  state: TimerState,
  actualSeconds: number,
  endedAt: string,
  outcome: TimerSessionRecord["outcome"],
): TimerSessionRecord | null {
  if (!state.userId || actualSeconds <= 0) return null;

  return {
    id: state.sessionId ?? crypto.randomUUID(),
    userId: state.userId,
    taskSheetId: state.taskSheetId,
    taskId: state.taskId,
    durationSeconds: state.durationSeconds,
    actualSeconds,
    startedAt: state.sessionStartedAt ?? state.startedAt ?? endedAt,
    endedAt,
    breakSession: state.breakSession,
    breakLabel: state.breakLabel,
    notes: "",
    outcome,
  };
}

export const useTimerStore = create<TimerState>((set, get) => ({
  ...emptyTimerState(null),
  setDuration: (minutes) => {
    if (!Number.isFinite(minutes) || minutes < 1 || get().status !== "idle") {
      return;
    }

    set({
      durationSeconds: Math.floor(minutes * 60),
      accumulatedSeconds: 0,
      startedAt: null,
      sessionId: null,
      sessionStartedAt: null,
      breakSession: false,
      breakLabel: null,
      updatedAt: nowIso(),
    });
  },
  startTask: (sheetId, taskId, minutes) => {
    const current = get();
    const taskState = useTaskStore.getState();
    const sheet = taskState.sheets.find((item) => item.id === sheetId);
    const task = sheet?.tasks.find((item) => item.id === taskId);
    if (!task || task.status === "Completed" || task.status === "Archived") {
      return false;
    }

    if (current.status !== "idle") {
      if (current.taskId !== taskId || current.taskSheetId !== sheetId) {
        return false;
      }
      if (current.status === "paused") get().resume();
      return current.status !== "awaiting-completion";
    }

    if (!Number.isFinite(minutes) || minutes < 1) return false;

    taskState.setTaskStatus(sheetId, taskId, "InProgress");
    const timestamp = nowIso();
    set({
      status: "running",
      taskSheetId: sheetId,
      taskId,
      durationSeconds: Math.floor(minutes * 60),
      accumulatedSeconds: 0,
      startedAt: timestamp,
      sessionId: crypto.randomUUID(),
      sessionStartedAt: timestamp,
      breakSession: false,
      breakLabel: null,
      updatedAt: timestamp,
    });
    return true;
  },
  switchTask: (sheetId, taskId, minutes) => {
    const current = get();
    const taskState = useTaskStore.getState();
    const targetSheet = taskState.sheets.find((item) => item.id === sheetId);
    const targetTask = targetSheet?.tasks.find((item) => item.id === taskId);
    if (
      !targetTask ||
      targetTask.status === "Completed" ||
      targetTask.status === "Archived" ||
      !Number.isFinite(minutes) ||
      minutes < 1 ||
      (current.status !== "running" && current.status !== "paused") ||
      current.breakSession ||
      !current.taskId ||
      !current.taskSheetId
    ) {
      return false;
    }

    if (current.taskId === taskId && current.taskSheetId === sheetId) {
      return get().startTask(sheetId, taskId, minutes);
    }

    const elapsedSeconds = getElapsedSeconds(current);
    const endedAt = nowIso();
    const lastSession = createSessionRecord(
      current,
      elapsedSeconds,
      endedAt,
      "stopped",
    );
    if (lastSession) {
      taskState.applyTimerSession(
        current.taskSheetId,
        current.taskId,
        lastSession.id,
        elapsedSeconds / 60,
        "Paused",
      );
    } else {
      taskState.setTaskStatus(
        current.taskSheetId,
        current.taskId,
        "Paused",
      );
    }

    set({
      ...emptyTimerState(
        current.userId,
        current.completedSessions,
        lastSession ?? current.lastSession,
        current.durationSeconds,
      ),
      updatedAt: endedAt,
    });
    return get().startTask(sheetId, taskId, minutes);
  },
  startBreak: (minutes, label) => {
    const current = get();
    if (
      current.status !== "idle" ||
      !Number.isFinite(minutes) ||
      minutes < 1
    ) {
      return false;
    }

    const timestamp = nowIso();
    set({
      status: "running",
      taskSheetId: null,
      taskId: null,
      durationSeconds: Math.floor(minutes * 60),
      accumulatedSeconds: 0,
      startedAt: timestamp,
      sessionId: crypto.randomUUID(),
      sessionStartedAt: timestamp,
      breakSession: true,
      breakLabel: label,
      completionConfirmed: false,
      updatedAt: timestamp,
    });
    return true;
  },
  start: () => {
    const current = get();
    if (current.status === "paused") {
      get().resume();
      return;
    }
    if (current.status !== "idle") return;
    const hasInProgressTask = useTaskStore
      .getState()
      .sheets.some((sheet) =>
        sheet.tasks.some((task) => task.status === "InProgress"),
      );
    if (hasInProgressTask) return;

    const timestamp = nowIso();
    set({
      status: "running",
      accumulatedSeconds: 0,
      startedAt: timestamp,
      sessionId: crypto.randomUUID(),
      sessionStartedAt: timestamp,
      breakSession: false,
      breakLabel: null,
      updatedAt: timestamp,
    });
  },
  pause: () => {
    const current = get();
    if (current.status !== "running") return;

    const timestamp = Date.now();
    if (current.taskSheetId && current.taskId) {
      useTaskStore
        .getState()
        .setTaskStatus(current.taskSheetId, current.taskId, "Paused");
    }
    set({
      status: "paused",
      accumulatedSeconds: getElapsedSeconds(current, timestamp),
      startedAt: null,
      updatedAt: nowIso(timestamp),
    });
  },
  resume: () => {
    const current = get();
    if (current.status !== "paused") return;

    const timestamp = nowIso();
    if (current.taskSheetId && current.taskId) {
      useTaskStore
        .getState()
        .setTaskStatus(current.taskSheetId, current.taskId, "InProgress");
    }
    set({
      status: "running",
      startedAt: timestamp,
      updatedAt: timestamp,
    });
  },
  stop: (now = Date.now()) => {
    const current = get();
    if (current.status !== "running" && current.status !== "paused") return;

    const elapsedSeconds = getElapsedSeconds(current, now);
    const endedAt = nowIso(now);
    const lastSession = createSessionRecord(
      current,
      elapsedSeconds,
      endedAt,
      "stopped",
    );
    if (current.taskSheetId && current.taskId && lastSession) {
      const taskStore = useTaskStore.getState();
      taskStore.applyTimerSession(
        current.taskSheetId,
        current.taskId,
        lastSession.id,
        elapsedSeconds / 60,
        "Pending",
      );
    } else if (current.taskSheetId && current.taskId) {
      useTaskStore
        .getState()
        .setTaskStatus(current.taskSheetId, current.taskId, "Pending");
    }

    set({
      ...emptyTimerState(
        current.userId,
        current.completedSessions,
        lastSession ?? current.lastSession,
        current.durationSeconds,
      ),
      updatedAt: endedAt,
    });
  },
  extend: (minutes) => {
    const current = get();
    if (
      !Number.isFinite(minutes) ||
      minutes < 1 ||
      (current.status !== "running" && current.status !== "paused")
    ) {
      return;
    }

    set({
      durationSeconds: current.durationSeconds + Math.floor(minutes * 60),
      updatedAt: nowIso(),
    });
  },
  finishEarly: (now = Date.now()) => {
    const current = get();
    if (current.status !== "running" && current.status !== "paused") return;
    const elapsedSeconds = getElapsedSeconds(current, now);
    if (elapsedSeconds < 1) return;

    const endedAt = nowIso(now);
    if (current.breakSession) {
      const lastSession = createSessionRecord(
        current,
        elapsedSeconds,
        endedAt,
        "completed",
      );
      set({
        ...emptyTimerState(
          current.userId,
          current.completedSessions + 1,
          lastSession ?? current.lastSession,
          current.durationSeconds,
        ),
        updatedAt: endedAt,
      });
      return;
    }

    set({
      status: "awaiting-completion",
      durationSeconds: elapsedSeconds,
      accumulatedSeconds: elapsedSeconds,
      startedAt: null,
      updatedAt: endedAt,
      completedSessions: current.completedSessions + 1,
      completionConfirmed: false,
    });
  },
  completeIfExpired: (now = Date.now()) => {
    const current = get();
    if (
      current.status !== "running" ||
      getTimerRemainingSeconds(current, now) > 0
    ) {
      return;
    }

    const endedAt = nowIso(now);
    const lastSession = current.lastSession;
    if (current.breakSession) {
      const session = createSessionRecord(
        current,
        current.durationSeconds,
        endedAt,
        "completed",
      );
      set({
        ...emptyTimerState(
          current.userId,
          current.completedSessions + 1,
          session ?? current.lastSession,
          current.durationSeconds,
        ),
        updatedAt: endedAt,
      });
      return;
    }
    set({
      status: "awaiting-completion",
      accumulatedSeconds: current.durationSeconds,
      startedAt: null,
      sessionId: current.sessionId,
      sessionStartedAt: current.sessionStartedAt,
      updatedAt: endedAt,
      completedSessions: current.completedSessions + 1,
      completionConfirmed: false,
      breakSession: false,
      breakLabel: null,
      lastSession,
    });
  },
  confirmTaskCompletion: () => {
    const current = get();
    if (current.status !== "awaiting-completion" || !current.taskId) return;
    set({ completionConfirmed: true, updatedAt: nowIso() });
  },
  resolveTaskCompletion: (completed, now = Date.now()) => {
    const current = get();
    if (current.status !== "awaiting-completion") return;

    const endedAt = nowIso(now);
    const lastSession = createSessionRecord(
      current,
      current.accumulatedSeconds,
      endedAt,
      completed ? "completed" : "incomplete",
    );
    if (lastSession && current.taskSheetId && current.taskId) {
      useTaskStore.getState().applyTimerSession(
        current.taskSheetId,
        current.taskId,
        lastSession.id,
        current.accumulatedSeconds / 60,
        completed ? "Completed" : "Pending",
      );
    } else if (current.taskSheetId && current.taskId) {
      useTaskStore.getState().setTaskStatus(
        current.taskSheetId,
        current.taskId,
        completed ? "Completed" : "Pending",
        completed ? "timer" : "manual",
      );
    }
    set({
      ...emptyTimerState(
        current.userId,
        current.completedSessions,
        lastSession ?? current.lastSession,
        current.durationSeconds,
      ),
      updatedAt: endedAt,
    });
  },
  restoreSnapshot: (snapshot, userId) => {
    if (!snapshot) {
      set({
        ...emptyTimerState(
          userId,
          get().userId === userId ? get().completedSessions : 0,
        ),
        updatedAt: nowIso(),
      });
      return;
    }

    const restored: Omit<
      TimerSnapshot,
      "userId"
    > & { userId: string } = {
      ...snapshot,
      userId,
      completionConfirmed: snapshot.completionConfirmed ?? false,
      sessionId: snapshot.sessionId ?? null,
      sessionStartedAt: snapshot.sessionStartedAt ?? snapshot.startedAt,
      breakSession: snapshot.breakSession ?? false,
      breakLabel: snapshot.breakLabel ?? null,
      lastSession: snapshot.lastSession ?? null,
    };

    if (
      restored.status !== "idle" &&
      Boolean(restored.taskId) !== Boolean(restored.taskSheetId)
    ) {
      restored.taskId = null;
      restored.taskSheetId = null;
    }

    set(restored);
    get().completeIfExpired();
  },
  toSnapshot: () => {
    const current = get();
    if (!current.userId) return null;

    return {
      userId: current.userId,
      status: current.status,
      taskSheetId: current.taskSheetId,
      taskId: current.taskId,
      durationSeconds: current.durationSeconds,
      accumulatedSeconds:
        current.accumulatedSeconds,
      startedAt:
        current.status === "running" ? current.startedAt : null,
      updatedAt: current.updatedAt,
      completedSessions: current.completedSessions,
      completionConfirmed: current.completionConfirmed,
      sessionId: current.sessionId,
      sessionStartedAt: current.sessionStartedAt,
      breakSession: current.breakSession,
      breakLabel: current.breakLabel,
      lastSession: current.lastSession,
    };
  },
}));
