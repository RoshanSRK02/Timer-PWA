import { create } from "zustand";
import { useTaskStore } from "@/stores/use-task-store";
import type {
  SuspendedFocusTimer,
  TimerSessionRecord,
  TimerSnapshot,
} from "@/types";

const DEFAULT_DURATION = 25 * 60;

interface TimerState extends Omit<TimerSnapshot, "userId"> {
  userId: string | null;
  displayReset: boolean;
  resetDisplay: () => void;
  setDuration: (minutes: number) => void;
  startTask: (sheetId: string, taskId: string, minutes: number) => boolean;
  switchTask: (sheetId: string, taskId: string, minutes: number) => boolean;
  startBreak: (minutes: number, label: string) => boolean;
  resumeFocusSession: () => void;
  extendBreak: (minutes: number) => void;
  start: () => void;
  pause: () => void;
  resume: () => void;
  stop: (now?: number) => void;
  extend: (minutes: number) => void;
  finishEarly: (now?: number) => void;
  completeActiveTask: (now?: number) => void;
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

  if (
    (state.status === "running" || state.status === "overtime") &&
    state.startedAt
  ) {
    const startedAt = Date.parse(state.startedAt);
    if (Number.isFinite(startedAt)) {
      elapsed += Math.max(0, Math.floor((now - startedAt) / 1000));
    }
  }

  return state.status === "overtime"
    ? elapsed
    : Math.min(state.durationSeconds, elapsed);
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

export function getTimerOvertimeSeconds(
  state: TimerState,
  now = Date.now(),
): number {
  return state.status === "overtime"
    ? Math.max(0, getElapsedSeconds(state, now) - state.durationSeconds)
    : 0;
}

type TimerData = Omit<
  TimerState,
  | "resetDisplay"
  | "setDuration"
  | "startTask"
  | "switchTask"
  | "startBreak"
  | "resumeFocusSession"
  | "extendBreak"
  | "start"
  | "pause"
  | "resume"
  | "stop"
  | "extend"
  | "finishEarly"
  | "completeActiveTask"
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
    displayReset: false,
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
    breakComplete: false,
    suspendedFocus: null,
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
    overtimeSeconds: Math.max(0, actualSeconds - state.durationSeconds),
    startedAt: state.sessionStartedAt ?? state.startedAt ?? endedAt,
    endedAt,
    breakSession: state.breakSession,
    breakLabel: state.breakLabel,
    notes: "",
    outcome,
    updatedAt: endedAt,
  };
}

export const useTimerStore = create<TimerState>((set, get) => ({
  ...emptyTimerState(null),
  resetDisplay: () => set({ displayReset: true }),
  setDuration: (minutes) => {
    if (!Number.isFinite(minutes) || minutes < 1 || get().status !== "idle") {
      return;
    }

    set({
      durationSeconds: Math.floor(minutes * 60),
      displayReset: false,
      accumulatedSeconds: 0,
      startedAt: null,
      sessionId: null,
      sessionStartedAt: null,
      breakSession: false,
      breakLabel: null,
      lastSession: null,
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
      if (current.status === "overtime" && !current.startedAt) get().resume();
      return current.status !== "awaiting-completion";
    }

    if (!Number.isFinite(minutes) || minutes < 1) return false;

    taskState.setTaskStatus(sheetId, taskId, "InProgress");
    const timestamp = nowIso();
    set({
      status: "running",
      displayReset: false,
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
      (current.status !== "running" &&
        current.status !== "paused" &&
        current.status !== "overtime") ||
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
        lastSession.updatedAt,
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
      (current.status !== "idle" &&
        current.status !== "running" &&
        current.status !== "paused" &&
        current.status !== "overtime") ||
      current.breakSession ||
      !Number.isFinite(minutes) ||
      minutes < 1
    ) {
      return false;
    }

    const timestamp = nowIso();
    const suspendedFocus: SuspendedFocusTimer | null =
      current.status !== "idle" && !current.breakSession
        ? {
            status: current.status,
            wasRunning:
              current.status === "running" ||
              (current.status === "overtime" && Boolean(current.startedAt)),
            taskSheetId: current.taskSheetId,
            taskId: current.taskId,
            durationSeconds: current.durationSeconds,
            accumulatedSeconds: getElapsedSeconds(current),
            sessionId: current.sessionId,
            sessionStartedAt: current.sessionStartedAt,
          }
        : null;
    if (suspendedFocus?.taskSheetId && suspendedFocus.taskId) {
      useTaskStore.getState().setTaskStatus(
        suspendedFocus.taskSheetId,
        suspendedFocus.taskId,
        "Paused",
      );
    }
    set({
      status: "running",
      displayReset: false,
      taskSheetId: null,
      taskId: null,
      durationSeconds: Math.floor(minutes * 60),
      accumulatedSeconds: 0,
      startedAt: timestamp,
      sessionId: crypto.randomUUID(),
      sessionStartedAt: timestamp,
      breakSession: true,
      breakLabel: label,
      breakComplete: false,
      suspendedFocus,
      completionConfirmed: false,
      updatedAt: timestamp,
    });
    return true;
  },
  resumeFocusSession: () => {
    const current = get();
    if (!current.breakSession || current.status === "running") return;
    const timestamp = Date.now();
    const endedAt = nowIso(timestamp);
    const elapsedSeconds = getElapsedSeconds(current, timestamp);
    const breakSession = current.breakComplete
      ? current.lastSession
      : createSessionRecord(
          current,
          elapsedSeconds,
          endedAt,
          "stopped",
        );
    const suspended = current.suspendedFocus;
    if (!suspended) {
      set({
        ...emptyTimerState(
          current.userId,
          current.completedSessions,
          breakSession ?? current.lastSession,
          current.durationSeconds,
        ),
        updatedAt: endedAt,
      });
      return;
    }

    if (suspended.taskSheetId && suspended.taskId) {
      const shouldRun =
        suspended.status === "running" ||
        (suspended.status === "overtime" && suspended.wasRunning);
      useTaskStore.getState().setTaskStatus(
        suspended.taskSheetId,
        suspended.taskId,
        shouldRun ? "InProgress" : "Paused",
      );
    }
    const shouldRun =
      suspended.status === "running" ||
      (suspended.status === "overtime" && suspended.wasRunning);
    set({
      status: suspended.status,
      displayReset: false,
      taskSheetId: suspended.taskSheetId,
      taskId: suspended.taskId,
      durationSeconds: suspended.durationSeconds,
      accumulatedSeconds: suspended.accumulatedSeconds,
      startedAt: shouldRun ? endedAt : null,
      sessionId: suspended.sessionId,
      sessionStartedAt: suspended.sessionStartedAt,
      breakSession: false,
      breakLabel: null,
      breakComplete: false,
      suspendedFocus: null,
      lastSession: breakSession ?? current.lastSession,
      updatedAt: endedAt,
    });
  },
  extendBreak: (minutes) => {
    const current = get();
    if (
      !current.breakSession ||
      (current.status !== "paused" && current.status !== "running") ||
      !Number.isFinite(minutes) ||
      minutes < 1
    ) {
      return;
    }
    const timestamp = nowIso();
    set({
      status: "running",
      displayReset: false,
      durationSeconds: Math.floor(minutes * 60),
      accumulatedSeconds: 0,
      startedAt: timestamp,
      sessionId: crypto.randomUUID(),
      sessionStartedAt: timestamp,
      breakComplete: false,
      updatedAt: timestamp,
    });
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
      displayReset: false,
      accumulatedSeconds: 0,
      startedAt: timestamp,
      sessionId: crypto.randomUUID(),
      sessionStartedAt: timestamp,
      breakSession: false,
      breakLabel: null,
      breakComplete: false,
      suspendedFocus: null,
      updatedAt: timestamp,
    });
  },
  pause: () => {
    const current = get();
    if (current.status !== "running" && current.status !== "overtime") return;

    const timestamp = Date.now();
    if (current.taskSheetId && current.taskId) {
      useTaskStore
        .getState()
        .setTaskStatus(current.taskSheetId, current.taskId, "Paused");
    }
    set({
      status: current.status === "overtime" ? "overtime" : "paused",
      accumulatedSeconds: getElapsedSeconds(current, timestamp),
      startedAt: null,
      updatedAt: nowIso(timestamp),
    });
  },
  resume: () => {
    const current = get();
    if (current.breakSession && current.breakComplete) return;
    if (
      current.status !== "paused" &&
      !(current.status === "overtime" && !current.startedAt)
    ) return;

    const timestamp = nowIso();
    if (current.taskSheetId && current.taskId) {
      useTaskStore
        .getState()
        .setTaskStatus(current.taskSheetId, current.taskId, "InProgress");
    }
    set({
      status: current.status === "overtime" ? "overtime" : "running",
      displayReset: false,
      startedAt: timestamp,
      updatedAt: timestamp,
    });
  },
  stop: (now = Date.now()) => {
    const current = get();
    if (
      current.status !== "running" &&
      current.status !== "paused" &&
      current.status !== "overtime"
    ) return;

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
        lastSession.updatedAt,
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
      (current.status !== "running" &&
        current.status !== "paused" &&
        current.status !== "overtime")
    ) {
      return;
    }

    const addedSeconds = Math.floor(minutes * 60);
    set({
      durationSeconds: current.durationSeconds + addedSeconds,
      accumulatedSeconds:
        current.status === "overtime"
          ? current.accumulatedSeconds + addedSeconds
          : current.accumulatedSeconds,
      updatedAt: nowIso(),
    });
  },
  finishEarly: (now = Date.now()) => {
    const current = get();
    if (
      current.status !== "running" &&
      current.status !== "paused" &&
      current.status !== "overtime"
    ) return;
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
        status: "paused",
        accumulatedSeconds: elapsedSeconds,
        startedAt: null,
        breakComplete: true,
        lastSession: lastSession ?? current.lastSession,
        updatedAt: endedAt,
      });
      return;
    }

    if (current.status === "overtime") {
      get().resolveTaskCompletion(true, now);
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
  completeActiveTask: (now = Date.now()) => {
    const current = get();
    if (
      !current.taskSheetId ||
      !current.taskId ||
      !["running", "paused", "awaiting-completion", "overtime"].includes(
        current.status,
      )
    ) {
      return;
    }

    const elapsedSeconds = getElapsedSeconds(current, now);
    const endedAt = nowIso(now);
    const lastSession = createSessionRecord(
      current,
      elapsedSeconds,
      endedAt,
      "completed",
    );
    if (elapsedSeconds > 0) {
      useTaskStore.getState().applyTimerSession(
        current.taskSheetId,
        current.taskId,
        current.sessionId ?? crypto.randomUUID(),
        elapsedSeconds / 60,
        "Completed",
        endedAt,
      );
    } else {
      useTaskStore.getState().setTaskStatus(
        current.taskSheetId,
        current.taskId,
        "Completed",
        "manual",
      );
    }
    set({
      ...emptyTimerState(
        current.userId,
        current.completedSessions +
          (current.status !== "awaiting-completion" && elapsedSeconds > 0
            ? 1
            : 0),
        lastSession ?? current.lastSession,
        current.durationSeconds,
      ),
      displayReset: true,
      updatedAt: endedAt,
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
        status: "paused",
        accumulatedSeconds: current.durationSeconds,
        startedAt: null,
        breakComplete: true,
        lastSession: session ?? current.lastSession,
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
    if (
      current.status !== "awaiting-completion" &&
      current.status !== "overtime"
    ) return;

    if (!completed && current.status === "awaiting-completion") {
      const timestamp = nowIso(now);
      set({
        status: "overtime",
        accumulatedSeconds: current.durationSeconds,
        startedAt: timestamp,
        updatedAt: timestamp,
        completionConfirmed: false,
      });
      return;
    }

    const endedAt = nowIso(now);
    const actualSeconds = getElapsedSeconds(current, now);
    const lastSession = createSessionRecord(
      current,
      actualSeconds,
      endedAt,
      completed ? "completed" : "incomplete",
    );
    if (lastSession && current.taskSheetId && current.taskId) {
      useTaskStore.getState().applyTimerSession(
        current.taskSheetId,
        current.taskId,
        lastSession.id,
        actualSeconds / 60,
        completed ? "Completed" : "Pending",
        lastSession.updatedAt,
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
      displayReset: completed,
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
      displayReset: snapshot.displayReset ?? false,
      completionConfirmed: snapshot.completionConfirmed ?? false,
      sessionId: snapshot.sessionId ?? null,
      sessionStartedAt: snapshot.sessionStartedAt ?? snapshot.startedAt,
      breakSession: snapshot.breakSession ?? false,
      breakLabel: snapshot.breakLabel ?? null,
      breakComplete: snapshot.breakComplete ?? false,
      suspendedFocus: snapshot.suspendedFocus ?? null,
      lastSession: snapshot.lastSession
        ? {
            ...snapshot.lastSession,
            overtimeSeconds:
              snapshot.lastSession.overtimeSeconds ??
              Math.max(
                0,
                snapshot.lastSession.actualSeconds -
                  snapshot.lastSession.durationSeconds,
              ),
          }
        : null,
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
      displayReset: current.displayReset,
      status: current.status,
      taskSheetId: current.taskSheetId,
      taskId: current.taskId,
      durationSeconds: current.durationSeconds,
      accumulatedSeconds:
        current.accumulatedSeconds,
      startedAt:
        current.status === "running" || current.status === "overtime"
          ? current.startedAt
          : null,
      updatedAt: current.updatedAt,
      completedSessions: current.completedSessions,
      completionConfirmed: current.completionConfirmed,
      sessionId: current.sessionId,
      sessionStartedAt: current.sessionStartedAt,
      breakSession: current.breakSession,
      breakLabel: current.breakLabel,
      breakComplete: current.breakComplete,
      suspendedFocus: current.suspendedFocus,
      lastSession: current.lastSession,
    };
  },
}));
