import { offlineDatabase, type OfflineWorkspace } from "@/services/offline-database";
import { getSupabaseClient } from "@/services/supabase";
import type { TaskSheet } from "@/types";

const TABLE_NAME = "offline_workspaces";

interface RemoteWorkspaceRow {
  user_id: string;
  data: { sheets?: TaskSheet[] } | null;
  updated_at: string;
}

function toWorkspace(
  userId: string,
  data: { sheets?: TaskSheet[] } | null,
  updatedAt: string,
): OfflineWorkspace {
  const sheets = Array.isArray(data?.sheets)
    ? data.sheets.map((sheet) => ({
        ...sheet,
        updatedAt: sheet.updatedAt ?? sheet.createdAt ?? updatedAt,
        tasks: (sheet.tasks ?? []).map((task) => ({
          ...task,
          actualMinutes: task.actualMinutes ?? null,
          updatedAt: task.updatedAt ?? task.createdAt ?? updatedAt,
        })),
      }))
    : [];
  return {
    userId,
    sheets,
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
      const latestWorkspace =
        pending && Date.parse(pending.local.updatedAt) > Date.parse(workspace.updatedAt)
          ? pending.local
          : workspace;
      await offlineDatabase.workspaces.put(latestWorkspace);
      await offlineDatabase.syncQueue.put({
        userId: workspace.userId,
        local: latestWorkspace,
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
): Promise<OfflineWorkspace> {
  const pending = await offlineDatabase.syncQueue.get(userId);
  if (!pending) {
    const remote = await readRemoteWorkspace(userId);
    const local = await offlineDatabase.workspaces.get(userId);
    if (!local && remote) {
      await pullRemoteWorkspace(remote);
      return remote;
    }
    if (!local) {
      const empty: OfflineWorkspace = {
        userId,
        sheets: [],
        updatedAt: new Date().toISOString(),
      };
      await queueWorkspaceChange(empty);
      return syncWorkspaceQueue(userId);
    }
    if (remote && Date.parse(remote.updatedAt) > Date.parse(local.updatedAt)) {
      await pullRemoteWorkspace(remote);
      return remote;
    }
    if (
      !remote ||
      Date.parse(local.updatedAt) > Date.parse(remote.updatedAt) ||
      JSON.stringify(local.sheets) !== JSON.stringify(remote.sheets)
    ) {
      await queueWorkspaceChange(local);
      return syncWorkspaceQueue(userId);
    }
    await pullRemoteWorkspace(remote);
    return remote;
  }

  const { data, error } = await getSupabaseClient().rpc(
    "sync_offline_workspace_last_modified",
    {
      p_data: { sheets: pending.local.sheets },
      p_updated_at: pending.local.updatedAt,
    },
  );
  if (error) throw error;
  const result = Array.isArray(data) ? data[0] : data;
  if (!result) throw new Error("Workspace sync returned no result.");

  const synced = toWorkspace(userId, result.data, result.updated_at);
  let hasNewerPending = false;
  await offlineDatabase.transaction(
    "rw",
    offlineDatabase.workspaces,
    offlineDatabase.syncQueue,
    offlineDatabase.syncMetadata,
    async () => {
      const latest = await offlineDatabase.syncQueue.get(userId);
      await offlineDatabase.syncMetadata.put({ userId, remote: synced });
      if (
        latest &&
        latest.revision !== pending.revision &&
        Date.parse(latest.local.updatedAt) > Date.parse(synced.updatedAt)
      ) {
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
  return synced;
}
