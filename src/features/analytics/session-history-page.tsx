import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Clock3, History, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  readTimerSessions,
  updateTimerSessionNotes,
} from "@/services/timer-persistence";
import { GUEST_USER_ID, useAuthStore } from "@/stores/use-auth-store";
import { useTaskStore } from "@/stores/use-task-store";
import type { TimerSessionRecord } from "@/types";

function formatDuration(seconds: number): string {
  const minutes = Math.round(seconds / 60);
  const hours = Math.floor(minutes / 60);
  return hours > 0 ? `${hours}h ${minutes % 60}m` : `${minutes}m`;
}

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "Unknown";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function startOfDate(value: string): number | null {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00`);
  return Number.isFinite(date.getTime()) ? date.getTime() : null;
}

function endOfDate(value: string): number | null {
  const start = startOfDate(value);
  return start === null ? null : start + 24 * 60 * 60 * 1000;
}

function sessionStatus(session: TimerSessionRecord): string {
  if (session.breakSession) {
    return session.outcome === "completed" ? "Break completed" : "Break stopped";
  }
  switch (session.outcome) {
    case "completed":
      return "Completed";
    case "incomplete":
      return "Incomplete";
    case "stopped":
      return "Stopped";
  }
}

export function SessionHistoryPage() {
  const userId = useAuthStore((state) => state.user?.id) ?? GUEST_USER_ID;
  const taskSheets = useTaskStore((state) => state.sheets);
  const queryClient = useQueryClient();
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [sheetFilter, setSheetFilter] = useState("");
  const [taskFilter, setTaskFilter] = useState("");
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});
  const [saveError, setSaveError] = useState<string | null>(null);
  const sessionsQuery = useQuery({
    queryKey: ["timer-sessions", userId],
    queryFn: () => readTimerSessions(userId!),
    enabled: true,
  });
  const saveNotesMutation = useMutation({
    mutationFn: ({
      sessionId,
      notes,
    }: {
      sessionId: string;
      notes: string;
    }) => updateTimerSessionNotes(userId!, sessionId, notes),
    onSuccess: (_result, variables) => {
      queryClient.setQueryData(
        ["timer-sessions", userId],
        (current: Awaited<ReturnType<typeof readTimerSessions>> | undefined) =>
          current
            ? {
                ...current,
                sessions: current.sessions.map((session) =>
                  session.id === variables.sessionId
                    ? { ...session, notes: variables.notes }
                    : session,
                ),
              }
            : current,
      );
      setSaveError(null);
    },
    onError: (error) => {
      setSaveError(
        error instanceof Error ? error.message : "Unable to save session notes.",
      );
    },
  });
  const taskMap = useMemo(
    () =>
      new Map(
        taskSheets.flatMap((sheet) =>
          sheet.tasks.map((task) => [task.id, task] as const),
        ),
      ),
    [taskSheets],
  );
  const sheetMap = useMemo(
    () => new Map(taskSheets.map((sheet) => [sheet.id, sheet.name])),
    [taskSheets],
  );
  const filteredTasks = useMemo(
    () =>
      taskSheets
        .filter((sheet) => !sheetFilter || sheet.id === sheetFilter)
        .flatMap((sheet) => sheet.tasks),
    [sheetFilter, taskSheets],
  );
  const filteredSessions = useMemo(() => {
    const after = startOfDate(fromDate);
    const before = endOfDate(toDate);
    return (sessionsQuery.data?.sessions ?? []).filter((session) => {
      const startedAt = Date.parse(session.startedAt);
      return (
        (after === null || startedAt >= after) &&
        (before === null || startedAt < before) &&
        (!sheetFilter ||
          (sheetFilter === "break"
            ? session.breakSession
            : session.taskSheetId === sheetFilter)) &&
        (!taskFilter || session.taskId === taskFilter)
      );
    });
  }, [fromDate, sessionsQuery.data?.sessions, sheetFilter, taskFilter, toDate]);

  function getTaskTitle(session: TimerSessionRecord): string {
    if (session.breakSession) return session.breakLabel ?? "Break";
    return (session.taskId && taskMap.get(session.taskId)?.title) || "Deleted task";
  }

  function getSheetName(session: TimerSessionRecord): string {
    if (session.breakSession) return "Break";
    return (session.taskSheetId && sheetMap.get(session.taskSheetId)) || "Deleted sheet";
  }

  function clearFilters() {
    setFromDate("");
    setToDate("");
    setSheetFilter("");
    setTaskFilter("");
  }

  return (
    <div className="space-y-8">
      <header>
        <p className="mb-2 flex items-center gap-2 text-sm font-medium text-primary">
          <History className="size-4" /> YOUR TIMER
        </p>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          Focus session history
        </h1>
        <p className="mt-2 text-muted-foreground">
          Review your focus sessions and breaks, and keep notes for next time.
        </p>
      </header>

      <Card className="p-4 sm:p-5">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[1fr_1fr_1.2fr_1.2fr_auto] xl:items-end">
          <div className="space-y-1.5">
            <label htmlFor="history-from" className="text-xs font-medium text-muted-foreground">From date</label>
            <Input id="history-from" type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="history-to" className="text-xs font-medium text-muted-foreground">To date</label>
            <Input id="history-to" type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="history-sheet" className="text-xs font-medium text-muted-foreground">Sheet</label>
            <select id="history-sheet" value={sheetFilter} onChange={(event) => { setSheetFilter(event.target.value); setTaskFilter(""); }} className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <option value="">All sheets</option>
              <option value="break">Breaks</option>
              {taskSheets.map((sheet) => <option key={sheet.id} value={sheet.id}>{sheet.name}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <label htmlFor="history-task" className="text-xs font-medium text-muted-foreground">Task</label>
            <select id="history-task" value={taskFilter} onChange={(event) => setTaskFilter(event.target.value)} disabled={sheetFilter === "break"} className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50">
              <option value="">All tasks</option>
              {filteredTasks.map((task) => <option key={task.id} value={task.id}>{task.title}</option>)}
            </select>
          </div>
          <Button type="button" variant="outline" onClick={clearFilters}>Clear filters</Button>
        </div>
      </Card>

      {sessionsQuery.data?.syncWarning && (
        <p className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm text-muted-foreground" role="status">
          Showing available session data. {sessionsQuery.data.syncWarning}
        </p>
      )}
      {saveError && (
        <p className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive" role="alert">
          {saveError}
        </p>
      )}
      {sessionsQuery.isError && (
        <p className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive" role="alert">
          Unable to load session history: {sessionsQuery.error.message}
        </p>
      )}
      {sessionsQuery.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading your sessions…</p>
      ) : (
        <Card className="overflow-hidden">
          <div className="hidden grid-cols-[1.25fr_1fr_1.1fr_1.1fr_0.7fr_0.9fr_1.4fr_auto] gap-3 border-b bg-secondary/60 px-5 py-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground xl:grid">
            <span>Task</span><span>Sheet</span><span>Start time</span><span>End time</span><span>Duration</span><span>Status</span><span>Notes</span><span />
          </div>
          {filteredSessions.map((session) => {
            const notes = noteDrafts[session.id] ?? session.notes ?? "";
            const saving = saveNotesMutation.isPending && saveNotesMutation.variables?.sessionId === session.id;
            return (
              <div key={session.id} className="grid gap-3 border-b p-4 last:border-b-0 sm:p-5 xl:grid-cols-[1.25fr_1fr_1.1fr_1.1fr_0.7fr_0.9fr_1.4fr_auto] xl:items-center xl:gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{getTaskTitle(session)}</p>
                  <p className="mt-1 text-[11px] text-muted-foreground xl:hidden">{getSheetName(session)}</p>
                </div>
                <span className="hidden truncate text-sm xl:block">{getSheetName(session)}</span>
                <div>
                  <span className="text-[10px] font-medium uppercase text-muted-foreground xl:hidden">Start</span>
                  <p className="text-xs">{formatDateTime(session.startedAt)}</p>
                </div>
                <div>
                  <span className="text-[10px] font-medium uppercase text-muted-foreground xl:hidden">End</span>
                  <p className="text-xs">{formatDateTime(session.endedAt)}</p>
                </div>
                <div className="text-xs">
                  <p className="flex items-center gap-1">
                    <Clock3 className="size-3.5 text-muted-foreground" />
                    Actual {formatDuration(session.actualSeconds)}
                  </p>
                  <p className="mt-1 text-[10px] text-muted-foreground">
                    Estimate {formatDuration(session.durationSeconds)} · Overtime{" "}
                    {formatDuration(session.overtimeSeconds)}
                  </p>
                </div>
                <span className="w-fit rounded-full bg-secondary px-2.5 py-1 text-xs font-medium">{sessionStatus(session)}</span>
                <div className="min-w-0">
                  <label htmlFor={`notes-${session.id}`} className="sr-only">Notes for {getTaskTitle(session)}</label>
                  <Input
                    id={`notes-${session.id}`}
                    value={notes}
                    onChange={(event) => setNoteDrafts((drafts) => ({ ...drafts, [session.id]: event.target.value }))}
                    placeholder="Add a note…"
                    maxLength={1000}
                    className="h-9 text-xs"
                  />
                </div>
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  aria-label={`Save notes for ${getTaskTitle(session)}`}
                  title="Save notes"
                  disabled={saving || notes === (session.notes ?? "")}
                  onClick={() => saveNotesMutation.mutate({ sessionId: session.id, notes })}
                >
                  <Save className="size-4" />
                </Button>
              </div>
            );
          })}
          {filteredSessions.length === 0 && (
            <p className="px-5 py-12 text-center text-sm text-muted-foreground">
              No sessions match these filters.
            </p>
          )}
        </Card>
      )}
      {filteredSessions.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {filteredSessions.length} {filteredSessions.length === 1 ? "session" : "sessions"}
        </p>
      )}
    </div>
  );
}
