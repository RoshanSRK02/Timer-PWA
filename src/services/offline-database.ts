import Dexie, { type Table } from "dexie";
import type { TaskSheet } from "@/types";

export interface OfflineWorkspace {
  userId: string;
  sheets: TaskSheet[];
  updatedAt: string;
}

export interface WorkspaceSyncQueueEntry {
  userId: string;
  local: OfflineWorkspace;
  base: OfflineWorkspace | null;
  baseUpdatedAt: string | null;
  revision: string;
  queuedAt: string;
}

export interface WorkspaceSyncMetadata {
  userId: string;
  remote: OfflineWorkspace;
}

export interface ActiveWorkspaceOwner {
  id: "active";
  userId: string;
}

class OfflineDatabase extends Dexie {
  workspaces!: Table<OfflineWorkspace, string>;
  syncQueue!: Table<WorkspaceSyncQueueEntry, string>;
  syncMetadata!: Table<WorkspaceSyncMetadata, string>;
  workspaceOwners!: Table<ActiveWorkspaceOwner, string>;

  constructor() {
    super("tempo-offline");
    this.version(1).stores({
      workspaces: "userId",
      syncQueue: "userId",
      syncMetadata: "userId",
      workspaceOwners: "id",
    });
  }
}

export const offlineDatabase = new OfflineDatabase();
