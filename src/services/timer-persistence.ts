import { getSupabaseClient } from "@/services/supabase";
import type { TimerSessionRecord, TimerSnapshot, TimerStatus } from "@/types";

const DATABASE_NAME = "tempo-timer";
const DATABASE_VERSION = 1;
const STORE_NAME = "sessions";
const SESSIONS_STORE_NAME = "timerSessions";
const TABLE_NAME = "pomodoro_timer_state";
const SESSIONS_TABLE_NAME = "pomodoro_timer_sessions";

export interface TimerSessionHistory {
  sessions: TimerSessionRecord[];
  syncWarning: string | null;
}

function normalizeSession(session: TimerSessionRecord): TimerSessionRecord {
  return {
    ...session,
    updatedAt: session.updatedAt ?? session.endedAt,
    overtimeSeconds:
      session.overtimeSeconds ??
      Math.max(0, session.actualSeconds - session.durationSeconds),
  };
}

interface RemoteTimerRow {
  user_id: string;
  status: TimerStatus;
  task_sheet_id: string | null;
  task_id: string | null;
  duration_seconds: number;
  accumulated_seconds: number;
  started_at: string | null;
  session_id: string | null;
  session_started_at: string | null;
  break_session: boolean;
  break_label: string | null;
  updated_at: string;
  completed_sessions: number;
  completion_confirmed: boolean;
  last_session: TimerSessionRecord | null;
}

interface RemoteTimerSessionRow {
  id: string;
  user_id: string;
  task_sheet_id: string | null;
  task_id: string | null;
  break_session: boolean;
  break_label: string | null;
  duration_seconds: number;
  actual_seconds: number;
  overtime_seconds: number;
  started_at: string;
  ended_at: string;
  outcome: TimerSessionRecord["outcome"];
  notes: string;
  updated_at: string;
}

function fromRemoteTimerSession(
  row: RemoteTimerSessionRow,
): TimerSessionRecord {
  return {
    id: row.id,
    userId: row.user_id,
    taskSheetId: row.task_sheet_id,
    taskId: row.task_id,
    breakSession: row.break_session,
    breakLabel: row.break_label,
    durationSeconds: row.duration_seconds,
    actualSeconds: row.actual_seconds,
    overtimeSeconds: row.overtime_seconds,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    outcome: row.outcome,
    notes: row.notes ?? "",
    updatedAt: row.updated_at,
  };
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!("indexedDB" in window)) {
      reject(new Error("IndexedDB is not available in this browser."));
      return;
    }

    const request = window.indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME, { keyPath: "userId" });
      }
      if (!database.objectStoreNames.contains(SESSIONS_STORE_NAME)) {
        database.createObjectStore(SESSIONS_STORE_NAME, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error("Unable to open timer storage."));
    request.onblocked = () =>
      reject(new Error("Timer storage upgrade is blocked by another tab."));
  });
}

async function indexedDbRequest<T>(
  storeName: string,
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const database = await openDatabase();

  try {
    return await new Promise<T>((resolve, reject) => {
      const transaction = database.transaction(storeName, mode);
      const request = operation(transaction.objectStore(storeName));

      request.onerror = () =>
        reject(request.error ?? new Error("Timer storage request failed."));
      transaction.oncomplete = () => resolve(request.result);
      transaction.onerror = () =>
        reject(transaction.error ?? new Error("Timer storage transaction failed."));
      transaction.onabort = () =>
        reject(transaction.error ?? new Error("Timer storage transaction failed."));
    });
  } finally {
    database.close();
  }
}

export function readTimerSnapshot(userId: string): Promise<TimerSnapshot | undefined> {
  return indexedDbRequest(STORE_NAME, "readonly", (store) =>
    store.get(userId) as IDBRequest<TimerSnapshot | undefined>,
  );
}

export async function writeTimerSnapshot(snapshot: TimerSnapshot): Promise<void> {
  await indexedDbRequest(STORE_NAME, "readwrite", (store) => store.put(snapshot));
}

export async function writeTimerSession(
  session: TimerSessionRecord,
): Promise<void> {
  await indexedDbRequest(SESSIONS_STORE_NAME, "readwrite", (store) =>
    store.put(session),
  );
}

export async function readLocalTimerSessions(
  userId: string,
): Promise<TimerSessionRecord[]> {
  const sessions = await indexedDbRequest<TimerSessionRecord[]>(
    SESSIONS_STORE_NAME,
    "readonly",
    (store) => store.getAll() as IDBRequest<TimerSessionRecord[]>,
  );
  return sessions
    .filter((session) => session.userId === userId)
    .map(normalizeSession);
}

export async function readTimerSessions(
  userId: string,
): Promise<TimerSessionHistory> {
  const [localResult, remoteResult] = await Promise.allSettled([
    indexedDbRequest(SESSIONS_STORE_NAME, "readonly", (store) =>
      store.getAll() as IDBRequest<TimerSessionRecord[]>,
    ),
    Promise.resolve().then(() =>
      getSupabaseClient()
        .from(SESSIONS_TABLE_NAME)
        .select(
          "id,user_id,task_sheet_id,task_id,break_session,break_label,duration_seconds,actual_seconds,overtime_seconds,started_at,ended_at,outcome,notes,updated_at",
        )
        .eq("user_id", userId)
        .order("started_at", { ascending: false }),
    ),
  ]);
  const errors: string[] = [];
  const sessions = new Map<string, TimerSessionRecord>();

  if (localResult.status === "fulfilled") {
    for (const session of localResult.value) {
      if (session.userId === userId) {
        sessions.set(session.id, normalizeSession(session));
      }
    }
  } else {
    errors.push(`Local session history: ${localResult.reason instanceof Error ? localResult.reason.message : "Unable to read IndexedDB."}`);
  }

  if (remoteResult.status === "fulfilled") {
    if (remoteResult.value.error) {
      errors.push(`Supabase session history: ${remoteResult.value.error.message}`);
    } else {
      for (const row of remoteResult.value.data ?? []) {
        sessions.set(
          row.id,
          fromRemoteTimerSession(row as RemoteTimerSessionRow),
        );
      }
    }
  } else {
    errors.push(`Supabase session history: ${remoteResult.reason instanceof Error ? remoteResult.reason.message : "Unable to read remote sessions."}`);
  }

  if (sessions.size === 0 && errors.length === 2) {
    throw new Error(errors.join(" "));
  }

  return {
    sessions: [...sessions.values()].sort(
      (first, second) =>
        Date.parse(second.startedAt) - Date.parse(first.startedAt),
    ),
    syncWarning: errors.length > 0 ? errors.join(" ") : null,
  };
}

export async function updateTimerSessionNotes(
  userId: string,
  sessionId: string,
  notes: string,
): Promise<void> {
  const localSession = await indexedDbRequest<TimerSessionRecord | undefined>(
    SESSIONS_STORE_NAME,
    "readonly",
    (store) => store.get(sessionId) as IDBRequest<TimerSessionRecord | undefined>,
  );
  if (localSession?.userId === userId) {
    await writeTimerSession({
      ...normalizeSession(localSession),
      notes,
      updatedAt: new Date().toISOString(),
    });
  }

  const { data, error } = await getSupabaseClient().rpc(
    "update_pomodoro_timer_session_notes",
    { p_session_id: sessionId, p_notes: notes },
  );

  if (error) throw error;
  void data;
}

export async function readRemoteTimerSnapshot(
  userId: string,
): Promise<TimerSnapshot | null> {
  const { data, error } = await getSupabaseClient()
    .from(TABLE_NAME)
    .select(
      "user_id,status,task_sheet_id,task_id,duration_seconds,accumulated_seconds,started_at,session_id,session_started_at,break_session,break_label,updated_at,completed_sessions,completion_confirmed,last_session",
    )
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const row = data as RemoteTimerRow;
  return {
    userId: row.user_id,
    status: row.status,
    taskSheetId: row.task_sheet_id,
    taskId: row.task_id,
    durationSeconds: row.duration_seconds,
    accumulatedSeconds: row.accumulated_seconds,
    startedAt: row.started_at,
    sessionId: row.session_id,
    sessionStartedAt: row.session_started_at,
    breakSession: row.break_session,
    breakLabel: row.break_label,
    updatedAt: row.updated_at,
    completedSessions: row.completed_sessions,
    completionConfirmed: row.completion_confirmed,
    lastSession: row.last_session ? normalizeSession(row.last_session) : null,
  };
}

export async function writeRemoteTimerSnapshot(
  snapshot: TimerSnapshot,
): Promise<TimerSnapshot> {
  const row: RemoteTimerRow = {
    user_id: snapshot.userId,
    status: snapshot.status,
    task_sheet_id: snapshot.taskSheetId,
    task_id: snapshot.taskId,
    duration_seconds: snapshot.durationSeconds,
    accumulated_seconds: snapshot.accumulatedSeconds,
    started_at: snapshot.startedAt,
    session_id: snapshot.sessionId,
    session_started_at: snapshot.sessionStartedAt,
    break_session: snapshot.breakSession,
    break_label: snapshot.breakLabel,
    updated_at: snapshot.updatedAt,
    completed_sessions: snapshot.completedSessions,
    completion_confirmed: snapshot.completionConfirmed,
    last_session: snapshot.lastSession,
  };
  const { data, error } = await getSupabaseClient().rpc(
    "sync_pomodoro_timer_state_last_modified",
    { p_snapshot: row },
  );

  if (error) throw error;
  if (!data) throw new Error("Timer synchronization returned no winning state.");
  const winner = data as RemoteTimerRow;
  return {
    userId: winner.user_id,
    status: winner.status,
    taskSheetId: winner.task_sheet_id,
    taskId: winner.task_id,
    durationSeconds: winner.duration_seconds,
    accumulatedSeconds: winner.accumulated_seconds,
    startedAt: winner.started_at,
    sessionId: winner.session_id,
    sessionStartedAt: winner.session_started_at,
    breakSession: winner.break_session,
    breakLabel: winner.break_label,
    updatedAt: winner.updated_at,
    completedSessions: winner.completed_sessions,
    completionConfirmed: winner.completion_confirmed,
    lastSession: winner.last_session
      ? normalizeSession(winner.last_session)
      : null,
  };
}

export async function writeRemoteTimerSession(
  session: TimerSessionRecord,
): Promise<TimerSessionRecord> {
  const { data, error } = await getSupabaseClient().rpc(
    "sync_pomodoro_timer_session_last_modified",
    {
      p_session: {
        id: session.id,
        user_id: session.userId,
        task_sheet_id: session.taskSheetId,
        task_id: session.taskId,
        break_session: session.breakSession,
        break_label: session.breakLabel,
        notes: session.notes,
        duration_seconds: session.durationSeconds,
        actual_seconds: session.actualSeconds,
        overtime_seconds: session.overtimeSeconds,
        started_at: session.startedAt,
        ended_at: session.endedAt,
        outcome: session.outcome,
        updated_at: session.updatedAt,
      },
    },
  );

  if (error) throw error;
  if (!data) throw new Error("Timer session synchronization returned no winning session.");
  return fromRemoteTimerSession(data as RemoteTimerSessionRow);
}

export function chooseLatestSnapshot(
  local: TimerSnapshot | undefined,
  remote: TimerSnapshot | null,
): TimerSnapshot | null {
  if (!local) return remote;
  if (!remote) return local;

  return Date.parse(remote.updatedAt) > Date.parse(local.updatedAt)
    ? remote
    : local;
}
