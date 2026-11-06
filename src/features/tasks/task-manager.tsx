import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import {
  ClipboardList,
  FilePlus2,
  Pencil,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useTimerPersistence } from "@/hooks/use-timer-persistence";
import { useTaskStore } from "@/stores/use-task-store";
import { useTimerStore } from "@/stores/use-timer-store";
import { GUEST_USER_ID, useAuthStore } from "@/stores/use-auth-store";
import { readTimerSessions } from "@/services/timer-persistence";
import type { Task } from "@/types";
import { SheetDialog } from "@/features/tasks/sheet-dialog";
import { TaskDialog, type TaskFormValues } from "@/features/tasks/task-dialog";
import { TaskRow } from "@/features/tasks/task-row";

type SheetDialogMode = "create" | "rename" | "delete";

interface PendingTaskSwitch {
  sheetId: string;
  taskId: string;
  title: string;
}

export function TaskManager() {
  const userId = useAuthStore((state) => state.user?.id) ?? GUEST_USER_ID;
  const { isLoading: isTimerLoading } = useTimerPersistence();
  const sheets = useTaskStore((state) => state.sheets);
  const activeSheetId = useTaskStore((state) => state.activeSheetId);
  const activeSheet = sheets.find((sheet) => sheet.id === activeSheetId);
  const createSheet = useTaskStore((state) => state.createSheet);
  const renameSheet = useTaskStore((state) => state.renameSheet);
  const deleteSheet = useTaskStore((state) => state.deleteSheet);
  const setActiveSheet = useTaskStore((state) => state.setActiveSheet);
  const addTask = useTaskStore((state) => state.addTask);
  const updateTask = useTaskStore((state) => state.updateTask);
  const deleteTask = useTaskStore((state) => state.deleteTask);
  const setTaskStatus = useTaskStore((state) => state.setTaskStatus);
  const timerStatus = useTimerStore((state) => state.status);
  const timerStartedAt = useTimerStore((state) => state.startedAt);
  const timerTaskId = useTimerStore((state) => state.taskId);
  const timerTaskSheetId = useTimerStore((state) => state.taskSheetId);
  const timerIsBreak = useTimerStore((state) => state.breakSession);
  const timerCompletionConfirmed = useTimerStore(
    (state) => state.completionConfirmed,
  );
  const startTask = useTimerStore((state) => state.startTask);
  const switchTask = useTimerStore((state) => state.switchTask);
  const pauseTimer = useTimerStore((state) => state.pause);
  const completeActiveTask = useTimerStore(
    (state) => state.completeActiveTask,
  );
  const resetTimerDisplay = useTimerStore((state) => state.resetDisplay);
  const resolveTaskCompletion = useTimerStore(
    (state) => state.resolveTaskCompletion,
  );
  const [query, setQuery] = useState("");
  const [taskFilter, setTaskFilter] = useState<"All" | "Active" | "Completed">(
    "All",
  );
  const [sheetDialog, setSheetDialog] = useState<SheetDialogMode | null>(null);
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [pendingTaskSwitch, setPendingTaskSwitch] =
    useState<PendingTaskSwitch | null>(null);
  const [manualCompletionAnimationTaskId, setManualCompletionAnimationTaskId] =
    useState<string | null>(null);
  const [taskActionError, setTaskActionError] = useState<string | null>(null);
  const sessionsQuery = useQuery({
    queryKey: ["timer-sessions", userId],
    queryFn: () => readTimerSessions(userId!),
    enabled: true,
  });

  const normalizedQuery = query.trim().toLocaleLowerCase();
  const visibleTasks = useMemo(() => {
    const tasks = (activeSheet?.tasks ?? [])
      .filter((task) =>
        `${task.title} ${task.description ?? ""}`
          .toLocaleLowerCase()
          .includes(normalizedQuery),
      )
      .filter((task) =>
        taskFilter === "All"
          ? true
          : taskFilter === "Completed"
            ? task.status === "Completed"
            : task.status !== "Completed" && task.status !== "Archived",
      );
    return tasks.sort((first, second) =>
      Number(first.status === "Completed") -
      Number(second.status === "Completed"),
    );
  }, [activeSheet?.tasks, normalizedQuery, taskFilter]);
  const isTimerTask = (task: Task) =>
    timerTaskId === task.id && timerTaskSheetId === activeSheet?.id;
  const activeSheetHasTimerTask =
    timerStatus !== "idle" && timerTaskSheetId === activeSheet?.id;
  const todaySummary = useMemo(() => {
    const now = new Date();
    const sessions = (sessionsQuery.data?.sessions ?? []).filter(
      (session) => new Date(session.startedAt).toDateString() === now.toDateString(),
    );
    const focusSeconds = sessions
      .filter((session) => !session.breakSession)
      .reduce((total, session) => total + session.actualSeconds, 0);
    const breakSeconds = sessions
      .filter((session) => session.breakSession)
      .reduce((total, session) => total + session.actualSeconds, 0);
    const taskIds = new Set(
      sessions
        .filter((session) => !session.breakSession && session.taskId)
        .map((session) => session.taskId!),
    );
    for (const task of sheets.flatMap((sheet) => sheet.tasks)) {
      if (task.completedAt && new Date(task.completedAt).toDateString() === now.toDateString()) {
        taskIds.add(task.id);
      }
    }
    const format = (seconds: number) => {
      const minutes = Math.round(seconds / 60);
      const hours = Math.floor(minutes / 60);
      return hours ? `${hours}h ${minutes % 60}m` : `${minutes}m`;
    };
    return {
      focus: format(focusSeconds),
      breaks: format(breakSeconds),
      tasks: taskIds.size,
    };
  }, [sessionsQuery.data?.sessions, sheets]);

  useEffect(() => {
    if (
      !timerCompletionConfirmed ||
      !timerTaskId ||
      !timerTaskSheetId
    ) {
      return;
    }

    const timerTaskExists =
      activeSheet?.id === timerTaskSheetId &&
      activeSheet.tasks.some((task) => task.id === timerTaskId);
    if (!timerTaskExists) resolveTaskCompletion(true);
  }, [
    activeSheet?.id,
    activeSheet?.tasks,
    resolveTaskCompletion,
    timerCompletionConfirmed,
    timerTaskId,
    timerTaskSheetId,
  ]);

  useEffect(() => {
    if (!pendingTaskSwitch) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setPendingTaskSwitch(null);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [pendingTaskSwitch]);

  useEffect(() => {
    if (!manualCompletionAnimationTaskId) return;

    const timeoutId = window.setTimeout(
      () => setManualCompletionAnimationTaskId(null),
      1000,
    );
    return () => window.clearTimeout(timeoutId);
  }, [manualCompletionAnimationTaskId]);

  function openCreateTask() {
    setEditingTask(null);
    setTaskDialogOpen(true);
  }

  function openEditTask(task: Task) {
    setEditingTask(task);
    setTaskDialogOpen(true);
  }

  function saveTask(values: TaskFormValues) {
    if (
      !activeSheet ||
      !values.title.trim() ||
      !Number.isFinite(values.estimatedMinutes) ||
      values.estimatedMinutes < 1
    ) {
      return;
    }

    if (
      values.status === "InProgress" &&
      timerStatus !== "idle" &&
      !(
        editingTask &&
        timerTaskId === editingTask.id &&
        timerTaskSheetId === activeSheet.id
      )
    ) {
      setTaskActionError("Stop the current timer before starting another task.");
      return;
    }

    const safeValues = { ...values, title: values.title.trim() };
    if (!editingTask) {
      addTask(activeSheet.id, safeValues);
    } else {
      updateTask(activeSheet.id, editingTask.id, safeValues);
    }

    setTaskDialogOpen(false);
    setEditingTask(null);
  }

  function confirmSheetDialog(name?: string) {
    if (sheetDialog === "create") {
      if (!name?.trim()) return;
      createSheet(name);
    } else if (sheetDialog === "rename") {
      if (!name?.trim() || !activeSheet) return;
      renameSheet(activeSheet.id, name);
    } else if (sheetDialog === "delete" && activeSheet) {
      if (activeSheetHasTimerTask) {
        setTaskActionError(
          "Stop the active task timer before deleting this sheet.",
        );
        setSheetDialog(null);
        return;
      }
      deleteSheet(activeSheet.id);
    }
    setSheetDialog(null);
  }

  function startTaskTimer(task: Task) {
    if (!activeSheet) return;

    const sameTimerTask =
      timerTaskId === task.id && timerTaskSheetId === activeSheet.id;
    if (timerStatus !== "idle" && !sameTimerTask) {
      if (
        (timerStatus === "running" ||
          timerStatus === "paused" ||
          timerStatus === "overtime") &&
        !timerIsBreak &&
        timerTaskId &&
        timerTaskSheetId
      ) {
        if (window.matchMedia("(max-width: 767px)").matches) {
          if (!switchTask(activeSheet.id, task.id, task.estimatedMinutes)) {
            setTaskActionError("The task timer could not be switched.");
            return;
          }
          setTaskActionError(null);
          return;
        }
        setPendingTaskSwitch({
          sheetId: activeSheet.id,
          taskId: task.id,
          title: task.title,
        });
        setTaskActionError(null);
      } else {
        setTaskActionError(
          "Finish the current break or resolve the timer before starting another task.",
        );
      }
      return;
    }

    if (!startTask(activeSheet.id, task.id, task.estimatedMinutes)) {
      setTaskActionError("The task timer could not be started.");
      return;
    }

    setTaskActionError(null);
  }

  function confirmTaskSwitch() {
    if (!pendingTaskSwitch) return;
    const target = useTaskStore
      .getState()
      .sheets.find((sheet) => sheet.id === pendingTaskSwitch.sheetId)
      ?.tasks.find((task) => task.id === pendingTaskSwitch.taskId);
    if (!target) {
      setTaskActionError("That task is no longer available.");
      setPendingTaskSwitch(null);
      return;
    }

    if (
      !switchTask(
        pendingTaskSwitch.sheetId,
        pendingTaskSwitch.taskId,
        target.estimatedMinutes,
      )
    ) {
      setTaskActionError("The task timer could not be switched.");
      setPendingTaskSwitch(null);
      return;
    }

    setTaskActionError(null);
    setPendingTaskSwitch(null);
  }

  return (
    <section
      aria-labelledby="task-manager-title"
      className="task-manager-panel min-w-0 space-y-4"
    >
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="mb-1 flex items-center gap-2 text-sm font-medium text-primary">
            <ClipboardList className="size-4" /> YOUR WORK
          </p>
          <h2
            id="task-manager-title"
            className="text-2xl font-bold tracking-tight"
          >
            Tasks
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Break your focus into clear, manageable steps.
          </p>
        </div>
        <Button type="button" onClick={openCreateTask}>
          <Plus className="size-4" /> Add task
        </Button>
      </div>

      <p className="flex min-w-0 items-center gap-2 overflow-hidden whitespace-nowrap text-xs text-muted-foreground sm:text-sm" aria-label="Today summary">
        <span className="shrink-0 font-semibold text-foreground">Today</span>
        <span className="truncate">{todaySummary.focus} • {todaySummary.tasks} Tasks • {todaySummary.breaks} Breaks</span>
      </p>
      {sessionsQuery.error && (
        <p className="text-xs text-destructive" role="alert">
          Today’s timer summary could not be loaded: {sessionsQuery.error instanceof Error
            ? sessionsQuery.error.message
            : "Unable to read timer sessions."}
        </p>
      )}
      {sessionsQuery.data?.syncWarning && (
        <p className="text-xs text-amber-700 dark:text-amber-300" role="status">
          Today’s summary may be incomplete: {sessionsQuery.data.syncWarning}
        </p>
      )}

      <Card className="overflow-hidden">
        <div className="flex flex-col gap-3 border-b p-4 sm:px-5">
          <div className="flex min-w-0 items-center gap-2">
            <label htmlFor="active-sheet" className="sr-only">
              Active task sheet
            </label>
            <select
              id="active-sheet"
              value={activeSheet?.id ?? ""}
              onChange={(event) => setActiveSheet(event.target.value)}
              className="h-10 w-full min-w-0 max-w-[220px] flex-1 rounded-xl border border-input bg-background px-3 text-sm font-semibold text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {sheets.map((sheet) => (
                <option key={sheet.id} value={sheet.id}>
                  {sheet.name}
                </option>
              ))}
            </select>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-9"
              onClick={() => setSheetDialog("create")}
              aria-label="Create sheet"
              title="Create sheet"
            >
              <FilePlus2 className="size-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-9"
              onClick={() => setSheetDialog("rename")}
              disabled={!activeSheet}
              aria-label="Rename active sheet"
              title="Rename sheet"
            >
              <Pencil className="size-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-9 text-muted-foreground hover:text-destructive"
              onClick={() => setSheetDialog("delete")}
              disabled={!activeSheet || activeSheetHasTimerTask}
              aria-label="Delete active sheet"
              title="Delete sheet"
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
          <div className="relative w-full">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              aria-label="Search tasks"
              placeholder="Search tasks..."
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="h-10 pl-9"
            />
          </div>
          <div className="flex shrink-0 rounded-xl bg-secondary p-1" role="group" aria-label="Filter tasks">
            {(["All", "Active", "Completed"] as const).map((filter) => (
              <button
                type="button"
                key={filter}
                aria-pressed={taskFilter === filter}
                onClick={() => setTaskFilter(filter)}
                className={`rounded-lg px-3 py-2 text-xs font-semibold transition ${
                  taskFilter === filter
                    ? "bg-primary text-white shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {filter}
              </button>
            ))}
          </div>
        </div>

        <div>
          <AnimatePresence mode="popLayout" initial={false}>
            {visibleTasks.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                completionRequested={
                  manualCompletionAnimationTaskId === task.id
                }
                onEdit={() => openEditTask(task)}
                onDelete={() =>
                  activeSheet &&
                  !isTimerTask(task) &&
                  deleteTask(activeSheet.id, task.id)
                }
                onDuplicate={() =>
                  activeSheet &&
                  addTask(activeSheet.id, {
                    title: `${task.title} copy`,
                    description: task.description,
                    estimatedMinutes: task.estimatedMinutes,
                    status: "Pending",
                  })
                }
                onArchive={() =>
                  activeSheet &&
                  setTaskStatus(activeSheet.id, task.id, "Archived")
                }
                onPlay={() => startTaskTimer(task)}
                onPause={pauseTimer}
                onComplete={() => {
                  if (!activeSheet) return;
                  setManualCompletionAnimationTaskId(task.id);
                  if (isTimerTask(task) && timerStatus !== "idle") {
                    completeActiveTask();
                  } else {
                    setTaskStatus(activeSheet.id, task.id, "Completed", "manual");
                    resetTimerDisplay();
                  }
                }}
                onCompletionAnimationComplete={() =>
                  setManualCompletionAnimationTaskId(null)
                }
                disableEditDelete={isTimerTask(task)}
                disablePlay={isTimerLoading}
                disablePause={
                  !isTimerTask(task) ||
                  (timerStatus !== "running" &&
                    !(timerStatus === "overtime" && Boolean(timerStartedAt))) ||
                  timerIsBreak
                }
                disableCompletion={false}
              />
            ))}
          </AnimatePresence>
          {visibleTasks.length === 0 && (
            <div className="flex flex-col items-center px-5 py-10 text-center">
              <span className="mb-3 flex size-11 items-center justify-center rounded-2xl bg-accent text-primary">
                <ClipboardList className="size-5" />
              </span>
              <p className="text-sm font-semibold">
                {normalizedQuery ? "No matching tasks" : "A fresh start"}
              </p>
              <p className="mt-1 max-w-xs text-xs leading-5 text-muted-foreground">
                {normalizedQuery
                  ? "Try another search, or add a new task."
                  : "Add a task to this sheet and turn your next step into focus time."}
              </p>
              {!normalizedQuery && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="mt-4"
                  onClick={openCreateTask}
                >
                  <Plus className="size-4" /> Add your first task
                </Button>
              )}
            </div>
          )}
        </div>

        {taskActionError && (
          <p className="border-t px-5 py-3 text-xs text-destructive" role="alert">
            {taskActionError}
          </p>
        )}

      </Card>

      <AnimatePresence>
        {taskDialogOpen && (
          <TaskDialog
            key={editingTask?.id ?? "new-task"}
            task={editingTask}
            onClose={() => {
              setTaskDialogOpen(false);
              setEditingTask(null);
            }}
            onSave={saveTask}
            onDelete={
              editingTask && activeSheet && !isTimerTask(editingTask)
                ? () => {
                    deleteTask(activeSheet.id, editingTask.id);
                    setTaskDialogOpen(false);
                    setEditingTask(null);
                  }
                : undefined
            }
          />
        )}
        {sheetDialog && (
          <SheetDialog
            mode={sheetDialog}
            currentName={activeSheet?.name ?? ""}
            onClose={() => setSheetDialog(null)}
            onConfirm={confirmSheetDialog}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {pendingTaskSwitch && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm"
            role="presentation"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) {
                setPendingTaskSwitch(null);
              }
            }}
          >
            <motion.section
              initial={{ opacity: 0, y: 8, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.98 }}
              role="alertdialog"
              aria-modal="true"
              aria-labelledby="switch-task-title"
              aria-describedby="switch-task-description"
              className="w-full max-w-sm rounded-2xl border bg-card p-5 shadow-2xl sm:p-6"
            >
              <h2 id="switch-task-title" className="text-lg font-semibold">
                Pause current task and start new task?
              </h2>
              <p
                id="switch-task-description"
                className="mt-2 text-sm leading-6 text-muted-foreground"
              >
                The current task’s elapsed time will be saved as a paused focus
                session before starting{" "}
                <span className="font-medium text-foreground">
                  {pendingTaskSwitch.title}
                </span>
                .
              </p>
              <div className="mt-6 flex justify-end gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setPendingTaskSwitch(null)}
                >
                  Cancel
                </Button>
                <Button type="button" onClick={confirmTaskSwitch}>
                  Pause &amp; Start
                </Button>
              </div>
            </motion.section>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
