import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Check,
  ChevronDown,
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
import type { Task } from "@/types";
import { SheetDialog } from "@/features/tasks/sheet-dialog";
import { TaskDialog, type TaskFormValues } from "@/features/tasks/task-dialog";
import { TaskRow } from "@/features/tasks/task-row";

type SheetDialogMode = "create" | "rename" | "delete";

interface PendingCompletion {
  taskId: string;
  updates: TaskFormValues;
}

interface PendingTaskSwitch {
  sheetId: string;
  taskId: string;
  title: string;
}

export function TaskManager() {
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
  const timerTaskId = useTimerStore((state) => state.taskId);
  const timerTaskSheetId = useTimerStore((state) => state.taskSheetId);
  const timerIsBreak = useTimerStore((state) => state.breakSession);
  const timerCompletionConfirmed = useTimerStore(
    (state) => state.completionConfirmed,
  );
  const startTask = useTimerStore((state) => state.startTask);
  const switchTask = useTimerStore((state) => state.switchTask);
  const pauseTimer = useTimerStore((state) => state.pause);
  const resolveTaskCompletion = useTimerStore(
    (state) => state.resolveTaskCompletion,
  );
  const [query, setQuery] = useState("");
  const [sheetDialog, setSheetDialog] = useState<SheetDialogMode | null>(null);
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [pendingCompletion, setPendingCompletion] =
    useState<PendingCompletion | null>(null);
  const [completionConfirmationTask, setCompletionConfirmationTask] =
    useState<Task | null>(null);
  const [pendingTaskSwitch, setPendingTaskSwitch] =
    useState<PendingTaskSwitch | null>(null);
  const [manualCompletionAnimationTaskId, setManualCompletionAnimationTaskId] =
    useState<string | null>(null);
  const [taskActionError, setTaskActionError] = useState<string | null>(null);

  const normalizedQuery = query.trim().toLocaleLowerCase();
  const visibleTasks = useMemo(
    () =>
      (activeSheet?.tasks ?? []).filter((task) =>
        task.title.toLocaleLowerCase().includes(normalizedQuery),
      ),
    [activeSheet?.tasks, normalizedQuery],
  );
  const activeTasks = visibleTasks.filter(
    (task) => task.status !== "Completed",
  );
  const completedTasks = visibleTasks.filter(
    (task) => task.status === "Completed",
  );
  const editingPendingCompletion = pendingCompletion?.taskId;
  const isTimerTask = (task: Task) =>
    timerTaskId === task.id && timerTaskSheetId === activeSheet?.id;
  const activeSheetHasTimerTask =
    timerStatus !== "idle" && timerTaskSheetId === activeSheet?.id;

  useEffect(() => {
    if (
      !timerCompletionConfirmed ||
      !timerTaskId ||
      !timerTaskSheetId
    ) {
      return;
    }

    const taskIsVisible =
      activeSheet?.id === timerTaskSheetId &&
      activeTasks.some((task) => task.id === timerTaskId);
    if (!taskIsVisible) resolveTaskCompletion(true);
  }, [
    activeSheet?.id,
    activeTasks,
    resolveTaskCompletion,
    timerCompletionConfirmed,
    timerTaskId,
    timerTaskSheetId,
  ]);

  useEffect(() => {
    if (!completionConfirmationTask && !pendingTaskSwitch) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setCompletionConfirmationTask(null);
        setPendingTaskSwitch(null);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [completionConfirmationTask, pendingTaskSwitch]);

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
      values.estimatedMinutes < 1 ||
      !Number.isFinite(values.actualMinutes) ||
      values.actualMinutes < 0
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
    } else if (
      safeValues.status === "Completed" &&
      editingTask.status !== "Completed"
    ) {
      setPendingCompletion({ taskId: editingTask.id, updates: safeValues });
      updateTask(activeSheet.id, editingTask.id, {
        ...safeValues,
        status: editingTask.status,
      });
    } else {
      updateTask(activeSheet.id, editingTask.id, safeValues);
    }

    setTaskDialogOpen(false);
    setEditingTask(null);
  }

  function finishEditedCompletion(taskId: string) {
    if (!activeSheet) return;
    if (pendingCompletion?.taskId === taskId) {
      updateTask(activeSheet.id, taskId, pendingCompletion.updates);
      setPendingCompletion(null);
      return;
    }

    setTaskStatus(activeSheet.id, taskId, "Completed", "manual");
  }

  function confirmManualCompletion() {
    if (!completionConfirmationTask) return;
    setManualCompletionAnimationTaskId(completionConfirmationTask.id);
    if (activeSheet) {
      setTaskStatus(
        activeSheet.id,
        completionConfirmationTask.id,
        "Completed",
        "manual",
      );
    }
    setCompletionConfirmationTask(null);
  }

  function finishManualCompletionAnimation(taskId: string) {
    setManualCompletionAnimationTaskId((current) =>
      current === taskId ? null : current,
    );
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
        (timerStatus === "running" || timerStatus === "paused") &&
        !timerIsBreak &&
        timerTaskId &&
        timerTaskSheetId
      ) {
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
    <section aria-labelledby="task-manager-title" className="space-y-4">
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

      <Card className="overflow-hidden">
        <div className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div className="flex min-w-0 items-center gap-2">
            <label htmlFor="active-sheet" className="sr-only">
              Active task sheet
            </label>
            <select
              id="active-sheet"
              value={activeSheet?.id ?? ""}
              onChange={(event) => setActiveSheet(event.target.value)}
              className="h-10 min-w-0 max-w-[220px] rounded-xl border border-input bg-background px-3 text-sm font-semibold text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
          <div className="relative w-full sm:max-w-xs">
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
        </div>

        <div className="overflow-x-auto">
          <div className="grid min-w-[760px] grid-cols-[minmax(210px,1fr)_86px_86px_112px_40px_40px_88px] gap-2 border-b bg-secondary/40 px-4 py-2.5 text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground sm:gap-3 sm:px-5">
            <span>Task</span>
            <span>Estimate</span>
            <span>Actual</span>
            <span>Status</span>
            <span className="sr-only">Pause</span>
            <span className="sr-only">Start or resume</span>
            <span className="text-right">Actions</span>
          </div>
          <AnimatePresence mode="popLayout" initial={false}>
            {activeTasks.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                completionRequested={
                  editingPendingCompletion === task.id ||
                  (timerCompletionConfirmed && isTimerTask(task)) ||
                  manualCompletionAnimationTaskId === task.id
                }
                onEdit={() => openEditTask(task)}
                onDelete={() =>
                  activeSheet &&
                  !isTimerTask(task) &&
                  deleteTask(activeSheet.id, task.id)
                }
                onPlay={() => startTaskTimer(task)}
                onPause={pauseTimer}
                onComplete={() => setCompletionConfirmationTask(task)}
                onCompletionAnimationComplete={() =>
                  timerCompletionConfirmed && isTimerTask(task)
                    ? resolveTaskCompletion(true)
                    : finishEditedCompletion(task.id)
                }
                disableEditDelete={isTimerTask(task)}
                disablePlay={isTimerLoading}
                disablePause={
                  !isTimerTask(task) ||
                  timerStatus !== "running" ||
                  timerIsBreak
                }
                disableCompletion={
                  isTimerTask(task) && timerStatus !== "idle"
                }
              />
            ))}
          </AnimatePresence>
          {activeTasks.length === 0 && (
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

        <details className="group border-t">
          <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-4 text-sm font-semibold hover:bg-secondary/40 sm:px-5 [&::-webkit-details-marker]:hidden">
            <ChevronDown className="size-4 text-muted-foreground transition-transform group-open:rotate-180" />
            <Check className="size-4 text-emerald-600 dark:text-emerald-400" />
            Completed tasks
            <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
              {completedTasks.length}
            </span>
          </summary>
          <div className="border-t bg-background/50">
            {completedTasks.length > 0 ? (
              <div className="overflow-x-auto">
                <div className="min-w-[760px]">
                  {completedTasks.map((task) => (
                    <motion.div
                      key={task.id}
                      layout
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                    >
                      <TaskRow
                        task={task}
                        completionRequested={
                          manualCompletionAnimationTaskId === task.id
                        }
                        onEdit={() => openEditTask(task)}
                        onDelete={() =>
                          activeSheet && deleteTask(activeSheet.id, task.id)
                        }
                        onPlay={() => startTaskTimer(task)}
                        onPause={pauseTimer}
                        onComplete={() => setCompletionConfirmationTask(task)}
                        onCompletionAnimationComplete={() =>
                          finishManualCompletionAnimation(task.id)
                        }
                        disablePlay={isTimerLoading}
                        disablePause={
                          !isTimerTask(task) ||
                          timerStatus !== "running" ||
                          timerIsBreak
                        }
                      />
                    </motion.div>
                  ))}
                </div>

              </div>
            ) : (
              <p className="px-5 py-5 text-sm text-muted-foreground">
                {normalizedQuery
                  ? "No completed tasks match your search."
                  : "Tasks you complete will appear here."}
              </p>
            )}
          </div>
        </details>
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
      <AnimatePresence>
        {completionConfirmationTask && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm"
            role="presentation"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) {
                setCompletionConfirmationTask(null);
              }
            }}
          >
            <motion.section
              initial={{ opacity: 0, y: 8, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.98 }}
              role="alertdialog"
              aria-modal="true"
              aria-labelledby="complete-task-title"
              aria-describedby="complete-task-description"
              className="w-full max-w-sm rounded-2xl border bg-card p-5 shadow-2xl sm:p-6"
            >
              <h2 id="complete-task-title" className="text-lg font-semibold">
                Complete this task?
              </h2>
              <p
                id="complete-task-description"
                className="mt-2 text-sm leading-6 text-muted-foreground"
              >
                Mark{" "}
                <span className="font-medium text-foreground">
                  {completionConfirmationTask.title}
                </span>{" "}
                as complete without starting a focus timer?
              </p>
              <div className="mt-6 flex justify-end gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setCompletionConfirmationTask(null)}
                >
                  Cancel
                </Button>
                <Button type="button" onClick={confirmManualCompletion}>
                  <Check className="size-4" /> Complete task
                </Button>
              </div>
            </motion.section>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
