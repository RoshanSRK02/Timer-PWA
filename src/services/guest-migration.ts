import { getSupabaseClient } from "@/services/supabase";
import {
  offlineDatabase,
  type GuestMigrationRecord,
  type OfflineWorkspace,
} from "@/services/offline-database";
import {
  queueWorkspaceChange,
  readLocalWorkspace,
  readRemoteWorkspace,
} from "@/services/workspace-sync";
import {
  readLocalTimerSessions,
  readRemoteTimerSnapshot,
  readTimerSnapshot,
  writeTimerSession,
  writeTimerSnapshot,
} from "@/services/timer-persistence";
import { GUEST_USER_ID } from "@/stores/use-auth-store";
import { useTaskStore } from "@/stores/use-task-store";
import type { Task, TaskSheet, TimerSessionRecord, TimerSnapshot } from "@/types";

function mergeTasks(local: Task[], remote: Task[]): Task[] {
  const merged = new Map<string, Task>();
  for (const task of [...local, ...remote]) {
    const previous = merged.get(task.id);
    if (!previous || Date.parse(task.updatedAt) >= Date.parse(previous.updatedAt)) {
      merged.set(task.id, task);
    }
  }
  return [...merged.values()];
}

function mergeWorkspaces(
  userId: string,
  workspaces: Array<OfflineWorkspace | null | undefined>,
): OfflineWorkspace {
  const sheets = new Map<string, TaskSheet>();
  const newestTimestamp = Math.max(
    Date.now(),
    ...workspaces
      .filter((workspace): workspace is OfflineWorkspace => Boolean(workspace))
      .map((workspace) => Date.parse(workspace.updatedAt))
      .filter(Number.isFinite),
  );
  for (const workspace of workspaces) {
    for (const sheet of workspace?.sheets ?? []) {
      const previous = sheets.get(sheet.id);
      if (!previous) {
        sheets.set(sheet.id, { ...sheet, tasks: [...sheet.tasks] });
        continue;
      }
      const newerSheet = Date.parse(sheet.updatedAt) >= Date.parse(previous.updatedAt)
        ? sheet
        : previous;
      sheets.set(sheet.id, {
        ...newerSheet,
        tasks: mergeTasks(previous.tasks, sheet.tasks),
      });
    }
  }
  return {
    userId,
    sheets: [...sheets.values()],
    updatedAt: new Date(newestTimestamp + 1).toISOString(),
  };
}

function readGuestSettings(): Record<string, unknown> {
  const settingKeys = ["tempo-theme", "tempo-timer-preferences"];
  const settings: Record<string, unknown> = {};
  for (const key of settingKeys) {
    const value = localStorage.getItem(key);
    if (value) settings[key] = JSON.parse(value) as unknown;
  }
  return settings;
}

function readSettingsObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

async function migrateSettings(userId: string): Promise<void> {
  const guestSettings = readGuestSettings();
  if (Object.keys(guestSettings).length === 0) return;
  const supabase = getSupabaseClient();
  const { data: profile, error: readError } = await supabase
    .from("profiles")
    .select("preferences")
    .eq("id", userId)
    .maybeSingle();
  if (readError) throw readError;
  const { error: updateError } = await supabase
    .from("profiles")
    .update({
      preferences: {
        ...readSettingsObject(profile?.preferences),
        ...guestSettings,
      },
    })
    .eq("id", userId);
  if (updateError) throw updateError;
}

export async function migrateGuestData(userId: string): Promise<void> {
  if (userId === GUEST_USER_ID) return;
  const migration = await offlineDatabase.guestMigrations.get(userId);
  if (migration?.completed) return;

  const guestWorkspace =
    (await readLocalWorkspace(GUEST_USER_ID)) ?? {
      userId: GUEST_USER_ID,
      sheets: useTaskStore.getState().sheets,
      updatedAt: new Date().toISOString(),
    };

  let accountRemote: OfflineWorkspace | null = null;
  if (navigator.onLine) accountRemote = await readRemoteWorkspace(userId);
  const accountLocal = await readLocalWorkspace(userId);
  const mergedWorkspace = mergeWorkspaces(userId, [
    guestWorkspace,
    accountLocal,
    accountRemote,
  ]);
  await queueWorkspaceChange(mergedWorkspace);

  const previousRecord: GuestMigrationRecord = migration ?? {
    userId,
    completed: false,
    sessionCopies: {},
    updatedAt: new Date().toISOString(),
  };
  const sessionCopies = { ...previousRecord.sessionCopies };
  for (const session of await readLocalTimerSessions(GUEST_USER_ID)) {
    const copyId = sessionCopies[session.id] ?? crypto.randomUUID();
    sessionCopies[session.id] = copyId;
  }
  const guestSnapshot = await readTimerSnapshot(GUEST_USER_ID);
  const record: GuestMigrationRecord = {
    ...previousRecord,
    sessionCopies,
    guestTimerSnapshot: guestSnapshot,
    updatedAt: new Date().toISOString(),
  };
  await offlineDatabase.guestMigrations.put(record);

  const guestSessions = await readLocalTimerSessions(GUEST_USER_ID);
  await Promise.all(
    guestSessions.map((session: TimerSessionRecord) =>
      writeTimerSession({
        ...session,
        id: sessionCopies[session.id],
        userId,
      }),
    ),
  );
  if (guestSnapshot) {
    const accountLocalSnapshot = await readTimerSnapshot(userId);
    const accountRemoteSnapshot = navigator.onLine
      ? await readRemoteTimerSnapshot(userId)
      : null;
    const latestAccountSnapshot = [accountLocalSnapshot, accountRemoteSnapshot]
      .filter((snapshot): snapshot is TimerSnapshot => snapshot !== null && snapshot !== undefined)
      .sort((first, second) => Date.parse(second.updatedAt) - Date.parse(first.updatedAt))[0];
    const selectedSnapshot =
      latestAccountSnapshot && Date.parse(latestAccountSnapshot.updatedAt) > Date.parse(guestSnapshot.updatedAt)
        ? latestAccountSnapshot
        : {
            ...guestSnapshot,
            userId,
            lastSession: guestSnapshot.lastSession
              ? {
                  ...guestSnapshot.lastSession,
                  id: sessionCopies[guestSnapshot.lastSession.id] ??
                    guestSnapshot.lastSession.id,
                  userId,
                }
              : null,
          };
    await writeTimerSnapshot(selectedSnapshot);
  }

  await migrateSettings(userId);
  await offlineDatabase.guestMigrations.put({
    ...record,
    completed: true,
    updatedAt: new Date().toISOString(),
  });
}
