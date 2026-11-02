import { offlineDatabase, type OfflineWorkspace } from "@/services/offline-database";
import { getSupabaseClient } from "@/services/supabase";
import type { Task, TaskSheet } from "@/types";

const TABLE_NAME = "offline_workspaces";

interface RemoteWorkspaceRow {
  user_id: string;
  data: { sheets?: TaskSheet[] } | null;
  updated_at: string;
}

export interface WorkspaceConflict {
  base: OfflineWorkspace | null;
  local: OfflineWorkspace;
  remote: OfflineWorkspace;
}

export type WorkspaceSyncResult =
  | { status: "synced"; workspace: OfflineWorkspace }
  | { status: "conflict"; conflict: WorkspaceConflict };

function toWorkspace(
  userId: string,
  data: { sheets?: TaskSheet[] } | null,
  updatedAt: string,
): OfflineWorkspace {
  return {
    userId,
    sheets: Array.isArray(data?.sheets) ? data.sheets : [],
    updatedAt,
  };
}

export async function readRemoteWorkspace(
  userId: string,
): Promise<OfflineWorkspace | null> {
  const { data, error } = await getSupabaseClient()
    .from(TABLE_NAME)
    .select("user_id,data,updated_at")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;
  const row = data as RemoteWorkspaceRow | null;
  return row ? toWorkspace(row.user_id, row.data, row.updated_at) : null;
}

export async function readLocalWorkspace(
  userId: string,
): Promise<OfflineWorkspace | undefined> {
  return offlineDatabase.workspaces.get(userId);
}

export async function queueWorkspaceChange(
  workspace: OfflineWorkspace,
): Promise<void> {
  await offlineDatabase.transaction(
    "rw",
    offlineDatabase.workspaces,
    offlineDatabase.syncQueue,
    offlineDatabase.syncMetadata,
    async () => {
      const [pending, metadata] = await Promise.all([
        offlineDatabase.syncQueue.get(workspace.userId),
        offlineDatabase.syncMetadata.get(workspace.userId),
      ]);
      await offlineDatabase.workspaces.put(workspace);
      await offlineDatabase.syncQueue.put({
        userId: workspace.userId,
        local: workspace,
        base: pending?.base ?? metadata?.remote ?? null,
        baseUpdatedAt:
          pending?.baseUpdatedAt ?? metadata?.remote.updatedAt ?? null,
        revision: crypto.randomUUID(),
        queuedAt: new Date().toISOString(),
      });
    },
  );
}

export async function pullRemoteWorkspace(
  workspace: OfflineWorkspace,
): Promise<void> {
  await offlineDatabase.transaction(
    "rw",
    offlineDatabase.workspaces,
    offlineDatabase.syncMetadata,
    async () => {
      await offlineDatabase.workspaces.put(workspace);
      await offlineDatabase.syncMetadata.put({
        userId: workspace.userId,
        remote: workspace,
      });
    },
  );
}

export async function syncWorkspaceQueue(
  userId: string,
): Promise<WorkspaceSyncResult> {
  const pending = await offlineDatabase.syncQueue.get(userId);
  if (!pending) {
    const remote = await readRemoteWorkspace(userId);
    const [local, metadata] = await Promise.all([
      offlineDatabase.workspaces.get(userId),
      offlineDatabase.syncMetadata.get(userId),
    ]);

    if (!remote) {
      if (!local) {
        const empty: OfflineWorkspace = {
          userId,
          sheets: [],
          updatedAt: new Date().toISOString(),
        };
        await queueWorkspaceChange(empty);
        return syncWorkspaceQueue(userId);
      }
      await queueWorkspaceChange(local);
      return syncWorkspaceQueue(userId);
    }

    const remoteChanged =
      metadata !== undefined &&
      Date.parse(remote.updatedAt) > Date.parse(metadata.remote.updatedAt);
    const localChanged =
      metadata !== undefined &&
      JSON.stringify(local?.sheets ?? []) !==
        JSON.stringify(metadata.remote.sheets);
    if (remoteChanged && localChanged && local) {
      await offlineDatabase.syncQueue.put({
        userId,
        local,
        base: metadata.remote,
        baseUpdatedAt: metadata.remote.updatedAt,
        revision: crypto.randomUUID(),
        queuedAt: new Date().toISOString(),
      });
      return syncWorkspaceQueue(userId);
    }

    if (
      !local ||
      (metadata
        ? remoteChanged
        : Date.parse(remote.updatedAt) >= Date.parse(local.updatedAt))
    ) {
      await pullRemoteWorkspace(remote);
      return { status: "synced", workspace: remote };
    }

    if (JSON.stringify(local.sheets) === JSON.stringify(remote.sheets)) {
      await pullRemoteWorkspace(remote);
      return { status: "synced", workspace: remote };
    }

    await offlineDatabase.syncQueue.put({
      userId,
      local,
      base: metadata?.remote ?? remote,
      baseUpdatedAt: metadata?.remote.updatedAt ?? remote.updatedAt,
      revision: crypto.randomUUID(),
      queuedAt: new Date().toISOString(),
    });
    return syncWorkspaceQueue(userId);
  }

  const { data, error } = await getSupabaseClient().rpc(
    "sync_offline_workspace",
    {
      p_data: { sheets: pending.local.sheets },
      p_expected_updated_at: pending.baseUpdatedAt,
    },
  );
  if (error) throw error;

  const result = Array.isArray(data) ? data[0] : data;
  if (!result) throw new Error("Workspace sync returned no result.");

  if (result.conflict) {
    const remote = await readRemoteWorkspace(userId);
    if (!remote) {
      throw new Error("A workspace conflict was reported, but remote data is unavailable.");
    }
    const latest = await offlineDatabase.syncQueue.get(userId);
    return {
      status: "conflict",
      conflict: {
        base: latest?.base ?? pending.base,
        local: latest?.local ?? pending.local,
        remote,
      },
    };
  }

  const synced = toWorkspace(
    userId,
    result.data,
    result.updated_at,
  );
  let hasNewerPending = false;
  await offlineDatabase.transaction(
    "rw",
    offlineDatabase.workspaces,
    offlineDatabase.syncQueue,
    offlineDatabase.syncMetadata,
    async () => {
      const latest = await offlineDatabase.syncQueue.get(userId);
      await offlineDatabase.syncMetadata.put({ userId, remote: synced });
      if (latest && latest.revision !== pending.revision) {
        hasNewerPending = true;
        await offlineDatabase.workspaces.put(latest.local);
        await offlineDatabase.syncQueue.put({
          ...latest,
          base: synced,
          baseUpdatedAt: synced.updatedAt,
        });
      } else {
        await offlineDatabase.workspaces.put(synced);
        await offlineDatabase.syncQueue.delete(userId);
      }
    },
  );
  if (hasNewerPending) return syncWorkspaceQueue(userId);
  return { status: "synced", workspace: synced };
}

export async function resolveWorkspaceConflict(
  conflict: WorkspaceConflict,
  resolution: "local" | "remote" | "merge",
): Promise<OfflineWorkspace> {
  const { remote } = conflict;
  const latest = await offlineDatabase.syncQueue.get(conflict.local.userId);
  const local = latest?.local ?? conflict.local;
  const base = latest?.base ?? conflict.base;
  if (resolution === "remote") {
    await pullRemoteWorkspace(remote);
    await offlineDatabase.syncQueue.delete(local.userId);
    return remote;
  }

  const chosen =
    resolution === "merge"
      ? {
          userId: local.userId,
          sheets: mergeSheets(base?.sheets ?? [], local.sheets, remote.sheets),
          updatedAt: new Date().toISOString(),
        }
      : { ...local, updatedAt: new Date().toISOString() };

  await offlineDatabase.transaction(
    "rw",
    offlineDatabase.workspaces,
    offlineDatabase.syncQueue,
    offlineDatabase.syncMetadata,
    async () => {
      await offlineDatabase.workspaces.put(chosen);
      await offlineDatabase.syncMetadata.put({
        userId: local.userId,
        remote,
      });
      await offlineDatabase.syncQueue.put({
        userId: local.userId,
        local: chosen,
        base: remote,
        baseUpdatedAt: remote.updatedAt,
        revision: crypto.randomUUID(),
        queuedAt: new Date().toISOString(),
      });
    },
  );
  return chosen;
}

function stableEqual(first: unknown, second: unknown): boolean {
  return JSON.stringify(first) === JSON.stringify(second);
}

function mergeRecord<T extends { id: string }>(
  base: T | undefined,
  local: T | undefined,
  remote: T | undefined,
): T | undefined {
  if (!local) {
    if (!remote || stableEqual(remote, base)) return undefined;
    return remote;
  }
  if (!remote) {
    if (!base || stableEqual(local, base)) return undefined;
    return local;
  }
  if (!base) return local;

  const merged: Record<string, unknown> = {};
  const keys = new Set([
    ...Object.keys(base),
    ...Object.keys(local),
    ...Object.keys(remote),
  ]);
  for (const key of keys) {
    const baseValue = (base as Record<string, unknown>)[key];
    const localValue = (local as Record<string, unknown>)[key];
    const remoteValue = (remote as Record<string, unknown>)[key];
    merged[key] = stableEqual(localValue, baseValue)
      ? remoteValue
      : localValue;
  }
  return merged as T;
}

function mergeTasks(
  base: Task[],
  local: Task[],
  remote: Task[],
): Task[] {
  const baseById = new Map(base.map((task) => [task.id, task]));
  const localById = new Map(local.map((task) => [task.id, task]));
  const remoteById = new Map(remote.map((task) => [task.id, task]));
  const ids = new Set([...baseById.keys(), ...localById.keys(), ...remoteById.keys()]);
  return [...ids]
    .map((id) =>
      mergeRecord(baseById.get(id), localById.get(id), remoteById.get(id)),
    )
    .filter((task): task is Task => Boolean(task));
}

function mergeSheets(
  base: TaskSheet[],
  local: TaskSheet[],
  remote: TaskSheet[],
): TaskSheet[] {
  const baseById = new Map(base.map((sheet) => [sheet.id, sheet]));
  const localById = new Map(local.map((sheet) => [sheet.id, sheet]));
  const remoteById = new Map(remote.map((sheet) => [sheet.id, sheet]));
  const ids = new Set([...baseById.keys(), ...localById.keys(), ...remoteById.keys()]);

  return [...ids].flatMap((id) => {
    const baseSheet = baseById.get(id);
    const localSheet = localById.get(id);
    const remoteSheet = remoteById.get(id);
    if (!localSheet || !remoteSheet) {
      const merged = mergeRecord(baseSheet, localSheet, remoteSheet);
      return merged ? [merged] : [];
    }
    const merged = mergeRecord(
      baseSheet
        ? { ...baseSheet, tasks: [] }
        : undefined,
      { ...localSheet, tasks: [] },
      { ...remoteSheet, tasks: [] },
    );
    if (!merged) return [];
    return [
      {
        ...merged,
        tasks: mergeTasks(
          baseSheet?.tasks ?? [],
          localSheet.tasks,
          remoteSheet.tasks,
        ),
      },
    ];
  });
}
