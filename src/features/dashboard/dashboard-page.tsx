import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowUpRight,
  CheckCircle2,
  Check,
  Coffee,
  Focus,
  Pause,
  Play,
  Plus,
  TimerReset,
  Sparkles,
  Target,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { BreakDurationDialog } from "@/features/dashboard/break-duration-dialog";
import { FlipClock } from "@/features/dashboard/flip-clock";
import { TimerSettings } from "@/features/dashboard/timer-settings";
import { useTimerPersistence } from "@/hooks/use-timer-persistence";
import { TaskManager } from "@/features/tasks/task-manager";
import { PopOutTimerButton } from "@/features/dashboard/pop-out-timer";
import { useTaskStore } from "@/stores/use-task-store";
import { useTimerPreferencesStore } from "@/stores/use-timer-preferences-store";
import { playAlarmSound } from "@/services/alarm-sounds";
import {
  getTimerOvertimeSeconds,
  getTimerRemainingSeconds,
  useTimerStore,
} from "@/stores/use-timer-store";
import { KeyboardShortcutsDialog } from "@/features/settings/keyboard-shortcuts";

const presets = [
  { label: "Focus", minutes: 25, icon: Target },
  { label: "Short break", minutes: 5, icon: Coffee },
  { label: "Long break", minutes: 15, icon: Sparkles },
];

const intentions = [
  {
    title: "Make space for deep work",
    description:
      "Choose one meaningful task and give it your full attention.",
  },
  {
    title: "Start with the next small step",
    description:
      "You don't need the whole plan. Just begin with what's in front of you.",
  },
  {
    title: "Progress over perfection",
    description:
      "Show up, stay curious, and let a first draft be a first draft.",
  },
];

export function DashboardPage() {
  const timer = useTimerStore();
  const {
    durationSeconds,
    status,
    completedSessions,
    taskId: activeTaskId,
    taskSheetId: activeTaskSheetId,
    setDuration,
    start,
    pause,
    extend,
    finishEarly,
    resolveTaskCompletion,
  } = timer;
  const { isLoading: isTimerLoading, error: timerPersistenceError, retry } =
    useTimerPersistence();
  const taskSheets = useTaskStore((state) => state.sheets);
  const activeTask = taskSheets
    .find((sheet) => sheet.id === activeTaskSheetId)
    ?.tasks.find((task) => task.id === activeTaskId);
  const selectedPreset =
    presets.find((preset) => preset.minutes * 60 === durationSeconds)?.label ??
    "Custom";
  const [intentionIndex, setIntentionIndex] = useState(0);
  const [clockNow, setClockNow] = useState(Date.now());
  const [breakDrawerOpen, setBreakDrawerOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [alarmError, setAlarmError] = useState<string | null>(null);
  const [nextTaskPrompt, setNextTaskPrompt] = useState<{
    sheetId: string;
    taskId: string;
    title: string;
    deadline: number;
  } | null>(null);
  const [isAutoPlayCountdown, setIsAutoPlayCountdown] = useState(true);
  const [timerStageError, setTimerStageError] = useState<string | null>(null);
  const [wakeLockError, setWakeLockError] = useState<string | null>(null);
  const [focusMode, setFocusMode] = useState(false);
  const [isMobileLandscape, setIsMobileLandscape] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const isCompactMobileFocus = focusMode && isMobileLandscape;
  const timerStageRef = useRef<HTMLDivElement>(null);
  const lastSessionIdRef = useRef(timer.lastSession?.id ?? null);
  const lastAutoPlaySessionIdRef = useRef(timer.lastSession?.id ?? null);
  const hasHydratedTimerRef = useRef(false);
  const lastAlarmStatusRef = useRef(status);
  const intention = intentions[intentionIndex]!;
  const remainingSeconds = getTimerRemainingSeconds(timer, clockNow);
  const overtimeSeconds = getTimerOvertimeSeconds(timer, clockNow);
  const progress =
    durationSeconds > 0
      ? ((durationSeconds - remainingSeconds) / durationSeconds) * 100
      : 0;
  const alarmSound = useTimerPreferencesStore((state) => state.alarmSound);
  const volume = useTimerPreferencesStore((state) => state.volume);
  const autoPlay = useTimerPreferencesStore((state) => state.autoPlay);
  const setAutoPlay = useTimerPreferencesStore((state) => state.setAutoPlay);
  const startTask = timer.startTask;
  const nextTaskCountdown = nextTaskPrompt
    ? Math.max(0, Math.ceil((nextTaskPrompt.deadline - clockNow) / 1000))
    : 0;

  useEffect(() => {
    const mediaQuery = window.matchMedia(
      "(max-width: 1023px) and (max-height: 600px) and (orientation: landscape) and (pointer: coarse)",
    );
    const updateMobileLandscape = () => setIsMobileLandscape(mediaQuery.matches);
    updateMobileLandscape();
    mediaQuery.addEventListener("change", updateMobileLandscape);
    return () => mediaQuery.removeEventListener("change", updateMobileLandscape);
  }, []);

  const toggleFocusMode = useCallback(async () => {
    setTimerStageError(null);
    if (focusMode) {
      setFocusMode(false);
      try {
        if (document.fullscreenElement === timerStageRef.current) {
          await document.exitFullscreen();
        }
      } catch (error) {
        setTimerStageError(
          error instanceof Error
            ? error.message
            : "Fullscreen mode could not be closed.",
        );
      }
      return;
    }

    setFocusMode(true);
    try {
      await timerStageRef.current?.requestFullscreen();
    } catch (error) {
      setTimerStageError(
        error instanceof Error
          ? error.message
          : "Fullscreen mode could not be opened.",
      );
    }
  }, [focusMode]);

  useEffect(() => {
    if (
      status !== "running" &&
      !(status === "overtime" && timer.startedAt) &&
      !nextTaskPrompt
    ) return;
    const intervalId = window.setInterval(() => setClockNow(Date.now()), 250);
    return () => window.clearInterval(intervalId);
  }, [status, timer.startedAt, nextTaskPrompt]);

  useEffect(() => {
    const handleToggleFocus = () => void toggleFocusMode();
    const handleShowShortcuts = () => setShortcutsOpen(true);
    window.addEventListener("tempo:toggle-focus", handleToggleFocus);
    window.addEventListener("tempo:show-shortcuts", handleShowShortcuts);
    return () => {
      window.removeEventListener("tempo:toggle-focus", handleToggleFocus);
      window.removeEventListener("tempo:show-shortcuts", handleShowShortcuts);
    };
  }, [toggleFocusMode]);

  useEffect(() => {
    if (!focusMode) return;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") void toggleFocusMode();
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [focusMode, toggleFocusMode]);

  useEffect(() => {
    document.body.classList.toggle("focus-mode", focusMode);
    return () => document.body.classList.remove("focus-mode");
  }, [focusMode]);

  useEffect(() => {
    if (status !== "running" && !(status === "overtime" && timer.startedAt)) {
      setWakeLockError(null);
      return;
    }

    if (!("wakeLock" in navigator)) return;
    let active = true;
    let wakeLock: WakeLockSentinel | null = null;
    const requestWakeLock = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        wakeLock = await navigator.wakeLock.request("screen");
        setWakeLockError(null);
      } catch (error) {
        if (active) {
          setWakeLockError(
            error instanceof Error
              ? `Screen wake lock unavailable: ${error.message}`
              : "Screen wake lock is unavailable in this browser.",
          );
        }
      }
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible" && (!wakeLock || wakeLock.released)) {
        void requestWakeLock();
      }
    };
    void requestWakeLock();
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      active = false;
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      if (wakeLock && !wakeLock.released) void wakeLock.release();
    };
  }, [status, timer.startedAt]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      const fullscreen = document.fullscreenElement === timerStageRef.current;
      setIsFullscreen(fullscreen);
      if (!fullscreen) setFocusMode(false);
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () =>
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  useEffect(() => {
    if (!hasHydratedTimerRef.current) {
      lastAlarmStatusRef.current = status;
      lastSessionIdRef.current = timer.lastSession?.id ?? null;
      return;
    }

    const enteredCompletion = status === "awaiting-completion" &&
      lastAlarmStatusRef.current !== "awaiting-completion";
    const endedBreak =
      timer.lastSession?.id !== lastSessionIdRef.current &&
      timer.lastSession?.breakSession;
    lastAlarmStatusRef.current = status;
    lastSessionIdRef.current = timer.lastSession?.id ?? null;

    if (!enteredCompletion && !endedBreak) return;

    void playAlarmSound(alarmSound, volume).catch((error: unknown) => {
      setAlarmError(
        error instanceof Error ? error.message : "Unable to play the timer alarm.",
      );
    });
  }, [
    alarmSound,
    isTimerLoading,
    status,
    timer.lastSession?.breakSession,
    timer.lastSession?.id,
    volume,
  ]);

  useEffect(() => {
    if (isTimerLoading) {
      hasHydratedTimerRef.current = false;
      return;
    }

    if (!hasHydratedTimerRef.current) {
      hasHydratedTimerRef.current = true;
      lastAutoPlaySessionIdRef.current = timer.lastSession?.id ?? null;
      return;
    }

    const latestSession = timer.lastSession;
    if (
      latestSession?.id === lastAutoPlaySessionIdRef.current ||
      latestSession?.outcome !== "completed" ||
      !latestSession.taskId ||
      !latestSession.taskSheetId
    ) {
      return;
    }

    const sheet = taskSheets.find(
      (item) => item.id === latestSession.taskSheetId,
    );
    const completedIndex = sheet?.tasks.findIndex(
      (task) => task.id === latestSession.taskId,
    );
    const nextTask =
      sheet && completedIndex !== undefined && completedIndex >= 0
        ? sheet.tasks
            .slice(completedIndex + 1)
            .find((task) => task.status === "Pending")
        : undefined;

    if (nextTask && sheet) {
      setNextTaskPrompt({
        sheetId: sheet.id,
        taskId: nextTask.id,
        title: nextTask.title,
        deadline: Date.now() + 10_000,
      });
      setIsAutoPlayCountdown(true);
    }
    lastAutoPlaySessionIdRef.current = latestSession.id;
  }, [isTimerLoading, taskSheets, timer.lastSession]);

  useEffect(() => {
    if (
      !nextTaskPrompt ||
      !isAutoPlayCountdown ||
      !autoPlay ||
      status !== "idle"
    ) {
      return;
    }

    if (nextTaskPrompt.deadline > Date.now()) return;

    const sheet = taskSheets.find(
      (item) => item.id === nextTaskPrompt.sheetId,
    );
    const task = sheet?.tasks.find(
      (item) => item.id === nextTaskPrompt.taskId,
    );
    if (task?.status === "Pending") {
      startTask(
        nextTaskPrompt.sheetId,
        nextTaskPrompt.taskId,
        task.estimatedMinutes,
      );
    }
    setNextTaskPrompt(null);
    setIsAutoPlayCountdown(false);
  }, [
    autoPlay,
    clockNow,
    isAutoPlayCountdown,
    nextTaskPrompt,
    startTask,
    status,
    taskSheets,
  ]);

  function startNextTaskNow() {
    if (!nextTaskPrompt) return;
    const sheet = taskSheets.find(
      (item) => item.id === nextTaskPrompt.sheetId,
    );
    const task = sheet?.tasks.find(
      (item) => item.id === nextTaskPrompt.taskId,
    );
    if (task?.status === "Pending") {
      startTask(
        nextTaskPrompt.sheetId,
        nextTaskPrompt.taskId,
        task.estimatedMinutes,
      );
    }
    setNextTaskPrompt(null);
    setIsAutoPlayCountdown(false);
  }

  const completionDialog =
    status === "awaiting-completion" && !timer.completionConfirmed ? (
      <motion.div
        className="fixed inset-0 z-[60] flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        role="presentation"
      >
        <motion.section
          initial={{ opacity: 0, y: 12, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 8 }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="timer-completion-title"
          className="w-full max-w-sm rounded-2xl border bg-card p-6 shadow-2xl"
        >
          <span className="mb-4 flex size-11 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="size-6" />
          </span>
          <h2 id="timer-completion-title" className="text-xl font-semibold tracking-tight">
            Was the task completed?
          </h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {activeTask?.title
              ? `Your focus session for “${activeTask.title}” has ended.`
              : "Your focus session has ended."}
          </p>
          <div className="mt-6 grid grid-cols-2 gap-3">
            <Button type="button" variant="outline" onClick={() => resolveTaskCompletion(false)}>
              No
            </Button>
            <Button
              type="button"
              onClick={() => resolveTaskCompletion(true)}
              className="bg-emerald-600 text-white hover:bg-emerald-700"
            >
              <Check className="size-4" /> Yes
            </Button>
          </div>
        </motion.section>
      </motion.div>
    ) : null;
  const breakDialog = (
    <BreakDurationDialog
      open={breakDrawerOpen}
      onClose={() => setBreakDrawerOpen(false)}
      disabled={timer.breakSession || status === "awaiting-completion" || isTimerLoading}
    />
  );
  const nextTaskPromptView = (
    <AnimatePresence>
      {nextTaskPrompt && (
        <motion.aside
          initial={{ opacity: 0, y: 16, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 12, scale: 0.98 }}
          className="fixed bottom-5 right-5 z-40 w-[min(24rem,calc(100vw-2.5rem))] rounded-2xl border bg-card p-5 shadow-2xl"
          aria-live="polite"
        >
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
            Next task
          </p>
          <p className="mt-1 truncate font-semibold">{nextTaskPrompt.title}</p>
          <p className="mt-2 text-sm text-muted-foreground">
            {nextTaskCountdown > 0
              ? `Starting in ${nextTaskCountdown} seconds`
              : autoPlay
                ? "Starting now..."
                : "Ready when you are"}
          </p>
          <div className="mt-4 flex gap-2">
            <Button
              type="button"
              size="sm"
              className="flex-1"
              onClick={startNextTaskNow}
              disabled={status !== "idle"}
            >
              <Play className="size-4 fill-current" /> Start now
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                setNextTaskPrompt(null);
                setIsAutoPlayCountdown(false);
              }}
            >
              Cancel
            </Button>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );

  return (
    <div className={`space-y-8 ${focusMode ? "focus-mode-active" : ""}`}>
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="focus-hidden flex flex-col justify-between gap-5 sm:flex-row sm:items-end"
      >
        <div>
          <p className="mb-2 flex items-center gap-2 text-sm font-medium text-primary">
            <Sparkles className="size-4" />
            {new Intl.DateTimeFormat("en-US", {
              weekday: "long",
              month: "long",
              day: "numeric",
            })
              .format(new Date())
              .toUpperCase()}
          </p>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Find your focus.
          </h1>
          <p className="mt-2 max-w-lg text-sm leading-6 text-muted-foreground sm:text-base">
            One thing at a time. Take a breath, set your intention, and begin.
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-xl border bg-card px-4 py-3 text-sm">
          <Zap className="size-4 text-amber-500" />
          <span className="font-semibold">{completedSessions}</span>
          <span className="text-muted-foreground">sessions today</span>
        </div>
      </motion.section>

      <div className="focus-workspace-layout">
      <div
        ref={timerStageRef}
        id="timer-stage"
        tabIndex={-1}
        className={`timer-stage ${
          isFullscreen ? "timer-fullscreen" : ""
        } ${isCompactMobileFocus ? "mobile-compact-focus" : ""} ${status === "overtime" ? "timer-overtime" : ""} oled-pixel-shift relative space-y-4`}
      >
        <div className="flex flex-wrap items-center justify-end gap-2">
          <PopOutTimerButton />
          <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => void toggleFocusMode()}
          aria-pressed={focusMode}
          title={focusMode ? "Exit Focus Mode (Esc)" : "Enter Focus Mode"}
          >
          <Focus className="size-4" />
          <span>{focusMode ? "Exit Focus" : "Focus Mode"}</span>
          </Button>
        </div>
        {timerStageError && (
          <p className="text-right text-xs text-destructive" role="alert">
            {timerStageError}
          </p>
        )}
        {wakeLockError && (
          <p className="text-right text-xs text-muted-foreground" role="status">
            {wakeLockError}
          </p>
        )}

      <div className="timer-grid grid gap-5 xl:grid-cols-[minmax(0,1.55fr)_minmax(280px,0.8fr)]">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.08 }}
        >
          <Card className="timer-card relative flex min-h-[480px] flex-col items-center justify-center overflow-hidden px-5 py-10 sm:min-h-[520px]">
            {!isCompactMobileFocus && (
              <div className="oled-hidden pointer-events-none absolute -right-24 -top-32 size-80 rounded-full bg-primary/[0.05] blur-3xl" />
            )}
            <div className={`timer-preset-tabs focus-hidden relative mb-8 flex items-center gap-1 rounded-xl bg-secondary p-1 ${timer.breakSession ? "hidden" : ""}`}>
              {presets.map(({ label, minutes, icon: Icon }) => (
                <button
                  type="button"
                  key={label}
                  onClick={() => setDuration(minutes)}
                  disabled={status !== "idle" || isTimerLoading}
                  aria-pressed={selectedPreset === label}
                  className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition sm:px-4 sm:text-sm ${
                    selectedPreset === label
                      ? "bg-primary text-white shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Icon className="size-4" />
                  <span className="hidden sm:inline">{label}</span>
                  <span className="sm:hidden">{minutes}m</span>
                </button>
              ))}
            </div>

            {!isCompactMobileFocus && (
            <div className="timer-visualization relative flex size-64 items-center justify-center sm:size-[290px]">
              <svg
                className="absolute inset-0 size-full -rotate-90"
                viewBox="0 0 280 280"
                aria-hidden="true"
              >
                <circle
                  cx="140"
                  cy="140"
                  r="128"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="text-secondary"
                />
                <motion.circle
                  cx="140"
                  cy="140"
                  r="128"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                  className="text-primary"
                  strokeDasharray={2 * Math.PI * 128}
                  animate={{
                    strokeDashoffset:
                      2 * Math.PI * 128 * (1 - progress / 100),
                  }}
                  transition={{ duration: 0.5 }}
                />
              </svg>
              <div className="text-center">
                <p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">
                  {status === "overtime"
                    ? "OVERTIME"
                    : timer.breakSession
                      ? "BREAK"
                    : activeTask
                    ? "Task focus"
                    : status === "awaiting-completion"
                      ? "Session complete"
                    : status === "running"
                      ? "In the zone"
                      : selectedPreset}
                </p>
              </div>
            </div>
            )}

            <FlipClock
              totalSeconds={
                status === "overtime"
                  ? overtimeSeconds
                    : status === "idle" && timer.displayReset
                      ? 0
                    : status === "idle" && timer.lastSession?.outcome === "completed"
                    ? 0
                    : remainingSeconds
              }
              overtime={status === "overtime"}
            />
            {status === "overtime" && (
              <p className="timer-overtime-label relative mt-2 rounded-full bg-amber-500/10 px-3 py-1 text-xs font-bold tracking-[0.16em] text-amber-600 dark:text-amber-400">
                OVERTIME
              </p>
            )}
            <p className="timer-task-name relative mt-3 max-w-[80%] truncate text-center text-sm text-muted-foreground">
              {activeTask?.title ??
                (timer.breakSession
                  ? "Let your mind reset"
                  : status === "running"
                    ? "Stay with this moment"
                    : "A little progress goes a long way")}
            </p>
            {timer.breakSession && timer.breakComplete && (
              <div
                className="relative mt-4 flex flex-wrap items-center justify-center gap-2 rounded-xl border border-primary/30 bg-accent/40 p-3"
                role="status"
                aria-live="polite"
              >
                <span className="w-full text-center text-sm font-semibold">
                  Break Complete
                </span>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => timer.resumeFocusSession()}
                >
                  Resume Focus Session
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => timer.extendBreak(5)}
                >
                  Extend Break
                </Button>
              </div>
            )}

            <div className={`timer-primary-controls relative mt-8 flex items-center gap-3 ${timer.breakComplete ? "hidden" : ""}`}>
              {status === "overtime" ? (
                <Button
                  size="default"
                  className="min-w-36 rounded-xl px-7"
                  onClick={timer.startedAt ? pause : timer.resume}
                  title="Pause or resume overtime (Space)"
                >
                  {timer.startedAt ? (
                    <><Pause className="size-4" /> Pause overtime</>
                  ) : (
                    <><Play className="size-4 fill-current" /> Resume overtime</>
                  )}
                </Button>
              ) : status !== "awaiting-completion" && (
                <Button
                  size="default"
                  className="min-w-36 rounded-xl px-7"
                  onClick={status === "running" ? pause : start}
                  disabled={isTimerLoading}
                  title={`${status === "running" ? "Pause" : "Resume"} timer (Space)`}
                >
                  {status === "running" ? (
                    <>
                      <Pause className="size-4" /> Pause
                    </>
                  ) : (
                    <>
                      <Play className="size-4 fill-current" />{" "}
                      {status === "paused" ? "Resume" : "Start focus"}
                    </>
                  )}
                </Button>
              )}
            </div>
            <div className={`timer-extension-controls relative mt-4 flex flex-wrap items-center justify-center gap-2 ${timer.breakComplete ? "hidden" : ""}`}>
              {[5, 10, 15, 30].map((minutes) => (
                <Button
                  type="button"
                  key={minutes}
                  size="sm"
                  variant="outline"
                  disabled={
                    status !== "running" &&
                    status !== "paused" &&
                    status !== "overtime"
                  }
                  onClick={() => extend(minutes)}
                  aria-label={`Add ${minutes} minutes to timer`}
                >
                  <Plus className="size-3" />
                  {minutes}
                </Button>
              ))}
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={
                  (status !== "running" && status !== "paused" && status !== "overtime") ||
                  status !== "overtime" && remainingSeconds === durationSeconds
                }
                onClick={() => finishEarly()}
                title="Finish task (F)"
              >
                <TimerReset className="size-4" />
              {status === "overtime" ? "Finish" : "Finish early"}
              </Button>
            </div>
            <div className="timer-secondary-controls relative mt-4 flex w-full flex-col items-center gap-4">
              <Button
                type="button"
                size="sm"
                variant={
                  status === "running" || status === "paused" || status === "overtime"
                    ? "default"
                    : "outline"
                }
                disabled={
                  timer.breakSession ||
                  status === "awaiting-completion" ||
                  isTimerLoading
                }
                onClick={() => setBreakDrawerOpen(true)}
                className={
                  status === "running" || status === "paused" || status === "overtime"
                    ? "bg-primary text-white hover:bg-primary/90"
                    : ""
                }
              >
                <Coffee className="size-4" /> Take a break
              </Button>
              <div className="flex w-full flex-wrap items-end justify-center gap-3">
                <TimerSettings />
              </div>
              <label className="flex min-h-11 items-center gap-2 text-xs font-medium text-muted-foreground">
                <input
                  type="checkbox"
                  checked={autoPlay}
                  onChange={(event) => setAutoPlay(event.target.checked)}
                  className="size-3.5 accent-primary"
                />
                Auto play next task
              </label>
            </div>
            {alarmError && (
              <p className="relative mt-2 text-center text-xs text-destructive" role="alert">
                {alarmError}
              </p>
            )}
            {isTimerLoading && (
              <p className="relative mt-3 text-xs text-muted-foreground">
                Restoring your timer...
              </p>
            )}
            {timerPersistenceError && (
              <div
                className="relative mt-4 flex max-w-md items-center gap-3 rounded-xl border border-amber-500/30 bg-amber-500/5 px-3 py-2.5 text-left text-xs"
                role="alert"
              >
                <span className="min-w-0 flex-1 text-muted-foreground">
                  Timer persistence needs attention: {timerPersistenceError}
                </span>
                <button
                  type="button"
                  onClick={retry}
                  className="shrink-0 font-semibold text-primary hover:underline"
                >
                  Retry
                </button>
              </div>
            )}
          </Card>
        </motion.div>

        <div className={`space-y-5 ${focusMode ? "focus-hidden" : ""}`}>
          <Card className="p-5 sm:p-6">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold">Today’s intention</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Keep your next step in view
                </p>
              </div>
              <span className="flex size-9 items-center justify-center rounded-xl bg-accent text-primary">
                <Target className="size-[18px]" />
              </span>
            </div>
            <div className="flex items-start gap-3 rounded-xl border bg-background p-4">
              <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border border-primary/40 text-primary">
                <Check className="size-3" />
              </span>
              <div>
                <p className="text-sm font-medium">{intention.title}</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  {intention.description}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() =>
                setIntentionIndex((current) => (current + 1) % intentions.length)
              }
              className="mt-4 flex w-full items-center justify-between text-xs font-semibold text-primary hover:opacity-75"
            >
              Change intention <ArrowUpRight className="size-4" />
            </button>
          </Card>

          <Card className="overflow-hidden p-5 sm:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold">A gentle reminder</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Your best work needs room to breathe.
                </p>
              </div>
              <span className="text-2xl" aria-hidden="true">
                ☁️
              </span>
            </div>
            <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-secondary">
              <motion.div
                className="h-full rounded-full bg-primary"
                animate={{ width: `${Math.min(completedSessions * 20, 100)}%` }}
                transition={{ duration: 0.5 }}
              />
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">
              {completedSessions} of 5 focus sessions today
            </p>
          </Card>
        </div>
      </div>

        {completionDialog
          ? isFullscreen && timerStageRef.current
            ? createPortal(completionDialog, timerStageRef.current)
            : completionDialog
          : null}
        <AnimatePresence>
          {shortcutsOpen && (
            <KeyboardShortcutsDialog onClose={() => setShortcutsOpen(false)} />
          )}
        </AnimatePresence>
        {isFullscreen && !focusMode && <TaskManager />}
      </div>

      {!isFullscreen && !focusMode && <TaskManager />}
      </div>

      {isFullscreen && timerStageRef.current
        ? createPortal(breakDialog, timerStageRef.current)
        : breakDialog}

      {isFullscreen && timerStageRef.current
        ? createPortal(nextTaskPromptView, timerStageRef.current)
        : nextTaskPromptView}

    </div>
  );
}
