import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  Task,
  TaskCompletionMethod,
  TaskSheet,
  TaskStatus,
} from "@/types";

interface TaskState {
  sheets: TaskSheet[];
  activeSheetId: string;
  appliedTimerSessionIds: string[];
  createSheet: (name: string) => string;
  renameSheet: (sheetId: string, name: string) => void;
  deleteSheet: (sheetId: string) => void;
  setActiveSheet: (sheetId: string) => void;
  addTask: (
    sheetId: string,
    task: Pick<Task, "title" | "estimatedMinutes" | "status">,
  ) => void;
  updateTask: (
    sheetId: string,
    taskId: string,
    updates: Pick<
      Task,
      "title" | "estimatedMinutes" | "status"
    >,
  ) => void;
  deleteTask: (sheetId: string, taskId: string) => void;
  setTaskStatus: (
    sheetId: string,
    taskId: string,
    status: TaskStatus,
    completionMethod?: TaskCompletionMethod,
  ) => void;
  applyTimerSession: (
    sheetId: string,
    taskId: string,
    sessionId: string,
    minutes: number,
    status: TaskStatus,
    updatedAt: string,
  ) => void;
}

function createId(): string {
  return crypto.randomUUID();
}

function createSheetData(name: string): TaskSheet {
  return {
    id: createId(),
    name,
    tasks: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function updateSheet(
  sheets: TaskSheet[],
  sheetId: string,
  update: (sheet: TaskSheet) => TaskSheet,
): TaskSheet[] {
  return sheets.map((sheet) => (sheet.id === sheetId ? update(sheet) : sheet));
}

const initialSheet = createSheetData("My Tasks");

export const useTaskStore = create<TaskState>()(
  persist(
    (set) => ({
      sheets: [initialSheet],
      activeSheetId: initialSheet.id,
      appliedTimerSessionIds: [],
      createSheet: (name) => {
        const sheet = createSheetData(name.trim());
        set((state) => ({
          sheets: [...state.sheets, sheet],
          activeSheetId: sheet.id,
        }));
        return sheet.id;
      },
      renameSheet: (sheetId, name) =>
        set((state) => ({
          sheets: updateSheet(state.sheets, sheetId, (sheet) => ({
            ...sheet,
            name: name.trim(),
            updatedAt: new Date().toISOString(),
          })),
        })),
      deleteSheet: (sheetId) =>
        set((state) => {
          const sheets = state.sheets.filter((sheet) => sheet.id !== sheetId);
          if (sheets.length === 0) {
            const replacement = createSheetData("My Tasks");
            return { sheets: [replacement], activeSheetId: replacement.id };
          }

          return {
            sheets,
            activeSheetId:
              state.activeSheetId === sheetId
                ? sheets[0]!.id
                : state.activeSheetId,
          };
        }),
      setActiveSheet: (activeSheetId) => set({ activeSheetId }),
      addTask: (sheetId, task) =>
        set((state) => {
          const timestamp = new Date().toISOString();
          return {
            sheets: state.sheets.map((sheet) => ({
              ...sheet,
              ...(sheet.id === sheetId ? { updatedAt: timestamp } : {}),
              tasks: [
                ...(sheet.id === sheetId
                  ? [
                      {
                        ...task,
                        actualMinutes: null,
                        id: createId(),
                        createdAt: timestamp,
                        updatedAt: timestamp,
                        completedAt:
                          task.status === "Completed" ? timestamp : null,
                        completionMethod:
                          task.status === "Completed" ? ("manual" as const) : null,
                      },
                    ]
                  : []),
                ...sheet.tasks.map((existingTask) =>
                  task.status === "InProgress" &&
                  existingTask.status === "InProgress"
                    ? {
                        ...existingTask,
                        status: "Paused" as const,
                        updatedAt: timestamp,
                      }
                    : existingTask,
                ),
              ],
            })),
          };
        }),
      updateTask: (sheetId, taskId, updates) =>
        set((state) => {
          const timestamp = new Date().toISOString();
          return {
            sheets: state.sheets.map((sheet) => ({
              ...sheet,
              ...(sheet.id === sheetId ? { updatedAt: timestamp } : {}),
              tasks: sheet.tasks.map((task) => {
                const isTarget = sheet.id === sheetId && task.id === taskId;
                if (!isTarget) {
                  return updates.status === "InProgress" &&
                    task.status === "InProgress"
                    ? { ...task, status: "Paused" as const, updatedAt: timestamp }
                    : task;
                }

                return {
                  ...task,
                  ...updates,
                  actualMinutes:
                    updates.status === "Completed" &&
                    task.status !== "Completed"
                      ? null
                      : task.actualMinutes,
                  updatedAt: timestamp,
                  completedAt:
                    updates.status === "Completed"
                      ? task.status === "Completed"
                        ? task.completedAt ?? task.updatedAt
                        : timestamp
                      : null,
                  completionMethod:
                    updates.status === "Completed"
                      ? task.status === "Completed"
                        ? task.completionMethod ?? null
                        : ("manual" as const)
                      : null,
                };
              }),
            })),
          };
        }),
      deleteTask: (sheetId, taskId) =>
        set((state) => {
          const timestamp = new Date().toISOString();
          return {
            sheets: updateSheet(state.sheets, sheetId, (sheet) => ({
              ...sheet,
              updatedAt: timestamp,
              tasks: sheet.tasks.filter((task) => task.id !== taskId),
            })),
          };
        }),
      setTaskStatus: (sheetId, taskId, status, completionMethod = "manual") =>
        set((state) => {
          const timestamp = new Date().toISOString();
          return {
            sheets: state.sheets.map((sheet) => ({
              ...sheet,
              ...(sheet.id === sheetId ? { updatedAt: timestamp } : {}),
              tasks: sheet.tasks.map((task) =>
                sheet.id === sheetId && task.id === taskId
                  ? {
                      ...task,
                      status,
                      actualMinutes:
                        status === "Completed" &&
                        completionMethod === "manual"
                          ? null
                          : task.actualMinutes,
                      updatedAt: timestamp,
                      completedAt:
                        status === "Completed"
                          ? task.completedAt ?? timestamp
                          : null,
                      completionMethod:
                        status === "Completed" ? completionMethod : null,
                    }
                  : status === "InProgress" && task.status === "InProgress"
                    ? { ...task, status: "Paused" as const, updatedAt: timestamp }
                    : task,
              ),
            })),
          };
        }),
      applyTimerSession: (sheetId, taskId, sessionId, minutes, status, updatedAt) =>
        set((state) => {
          const alreadyApplied =
            state.appliedTimerSessionIds.includes(sessionId);
          const appliedTimerSessionIds = alreadyApplied
            ? state.appliedTimerSessionIds
            : [...state.appliedTimerSessionIds.slice(-999), sessionId];

          return {
            appliedTimerSessionIds,
            sheets: updateSheet(state.sheets, sheetId, (sheet) => ({
              ...sheet,
              updatedAt,
              tasks: sheet.tasks.map((task) =>
                task.id === taskId
                  ? {
                      ...task,
                      actualMinutes: alreadyApplied
                        ? task.actualMinutes
                        : (task.actualMinutes ?? 0) + minutes,
                      status,
                      updatedAt,
                      completedAt:
                        status === "Completed"
                          ? task.completedAt ?? updatedAt
                          : null,
                      completionMethod:
                        status === "Completed" ? ("timer" as const) : null,
                    }
                  : task,
              ),
            })),
          };
        }),
    }),
    {
      name: "tempo-task-sheets",
      version: 6,
      migrate: (persistedState: unknown) => {
        const state = persistedState as Partial<TaskState> | undefined;
        if (
          !state?.sheets?.length ||
          !state.sheets.some((sheet) => sheet.id === state.activeSheetId)
        ) {
          const replacement = createSheetData("My Tasks");
          return {
            ...state,
            sheets: [replacement],
            activeSheetId: replacement.id,
            appliedTimerSessionIds: state?.appliedTimerSessionIds ?? [],
          };
        }

        let keptInProgress = false;
        return {
          ...state,
          appliedTimerSessionIds: state.appliedTimerSessionIds ?? [],
          sheets: state.sheets.map((sheet) => ({
            ...sheet,
            updatedAt: sheet.updatedAt ?? sheet.createdAt,
            tasks: sheet.tasks.map((task) => {
              const normalizedTask =
                task.status === "Completed"
                  ? {
                      ...task,
                      actualMinutes:
                        task.completionMethod === "timer"
                          ? task.actualMinutes ?? 0
                          : null,
                      completedAt: task.completedAt ?? task.updatedAt,
                    }
                  : {
                      ...task,
                      actualMinutes: null,
                      completedAt: null,
                    };
              if (task.status !== "InProgress") return normalizedTask;
              if (keptInProgress) {
                return {
                  ...normalizedTask,
                  status: "Paused" as const,
                  completedAt: null,
                };
              }
              keptInProgress = true;
              return normalizedTask;
            }),
          })),
        };
      },
    },
  ),
);
