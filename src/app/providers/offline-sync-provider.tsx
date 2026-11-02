import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PropsWithChildren,
} from "react";
import { useAuthStore } from "@/stores/use-auth-store";
import { useTaskStore } from "@/stores/use-task-store";
import {
  offlineDatabase,
  type OfflineWorkspace,
} from "@/services/offline-database";
import {
  pullRemoteWorkspace,
  queueWorkspaceChange,
  readLocalWorkspace,
  readRemoteWorkspace,
  resolveWorkspaceConflict,
  syncWorkspaceQueue,
  type WorkspaceConflict,
} from "@/services/workspace-sync";
import { Button } from "@/components/ui/button";

function workspaceContentEqual(
  first: OfflineWorkspace | null | undefined,
  second: OfflineWorkspace | null | undefined,
): boolean {
  return JSON.stringify(first?.sheets ?? []) === JSON.stringify(second?.sheets ?? []);
}

function applyWorkspace(workspace: OfflineWorkspace): void {
  const current = useTaskStore.getState();
  const activeSheetId = workspace.sheets.some(
    (sheet) => sheet.id === current.activeSheetId,
  )
    ? current.activeSheetId
    : workspace.sheets[0]?.id ?? "";
  useTaskStore.setState({
    sheets: workspace.sheets,
    activeSheetId,
  });
}

export function OfflineSyncProvider({ children }: PropsWithChildren) {
  const user = useAuthStore((state) => state.user);
  const authLoading = useAuthStore((state) => state.isLoading);
  const userId = user?.id ?? null;
  const [isLoading, setIsLoading] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingCount, setPendingCount] = useState(0);
  const [conflict, setConflict] = useState<WorkspaceConflict | null>(null);
  const [isResolvingConflict, setIsResolvingConflict] = useState(false);
  const applyingRemote = useRef(false);
  const initializedUser = useRef<string | null>(null);
  const syncInProgress = useRef(false);
  const writeChain = useRef(Promise.resolve());

  const updatePendingCount = useCallback(async (id: string) => {
    const queued = await offlineDatabase.syncQueue.get(id);
    setPendingCount(queued ? 1 : 0);
  }, []);

  const requestBackgroundSync = useCallback(async () => {
    if (!("serviceWorker" in navigator)) return;
    try {
      const registration = await navigator.serviceWorker.ready;
      const syncRegistration = registration as ServiceWorkerRegistration & {
        sync?: { register: (tag: string) => Promise<void> };
      };
      await syncRegistration.sync?.register("tempo-workspace-sync");
    } catch (error) {
      setSyncError(
        error instanceof Error
          ? `Background sync is unavailable; changes will sync when the app is open: ${error.message}`
          : "Background sync is unavailable; changes will sync when the app is open.",
      );
    }
  }, []);

  const applyRemote = useCallback((workspace: OfflineWorkspace) => {
    applyingRemote.current = true;
    try {
      applyWorkspace(workspace);
    } finally {
      applyingRemote.current = false;
    }
  }, []);

  const runSync = useCallback(async () => {
    if (
      !userId ||
      initializedUser.current !== userId ||
      !navigator.onLine ||
      syncInProgress.current
    ) {
      return;
    }
    syncInProgress.current = true;
    setSyncError(null);
    try {
      const result = await syncWorkspaceQueue(userId);
      if (result.status === "conflict") {
        setConflict(result.conflict);
        return;
      }

      const current = {
        userId,
        sheets: useTaskStore.getState().sheets,
        updatedAt: result.workspace.updatedAt,
      };
      if (!workspaceContentEqual(current, result.workspace)) {
        applyRemote(result.workspace);
      }
      await updatePendingCount(userId);
    } catch (error) {
      setSyncError(
        error instanceof Error ? error.message : "Workspace synchronization failed.",
      );
      await updatePendingCount(userId);
    } finally {
      syncInProgress.current = false;
    }
  }, [applyRemote, updatePendingCount, userId]);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      void runSync();
    };
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [runSync]);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    const handleServiceWorkerMessage = (event: MessageEvent) => {
      if (event.data?.type === "TEMPO_SYNC_REQUEST") void runSync();
    };
    navigator.serviceWorker.addEventListener("message", handleServiceWorkerMessage);
    return () =>
      navigator.serviceWorker.removeEventListener(
        "message",
        handleServiceWorkerMessage,
      );
  }, [runSync]);

  useEffect(() => {
    if (authLoading || !userId) return;
    if (initializedUser.current === userId) {
      if (navigator.onLine) void runSync();
      return;
    }
    const currentUserId = userId;
    let active = true;
    setIsLoading(true);
    setSyncError(null);

    async function initialize() {
      let local = await readLocalWorkspace(currentUserId);
      const owner = await offlineDatabase.workspaceOwners.get("active");
      let remote: OfflineWorkspace | null = null;
      let remoteError: unknown = null;
      if (navigator.onLine) {
        try {
          remote = await readRemoteWorkspace(currentUserId);
        } catch (error) {
          remoteError = error;
        }
      }
      if (!active) return;

      if (!local && remote) {
        await pullRemoteWorkspace(remote);
        local = remote;
      } else if (!local) {
        local = {
          userId: currentUserId,
          sheets: owner && owner.userId !== currentUserId
            ? []
            : useTaskStore.getState().sheets,
          updatedAt: new Date().toISOString(),
        };
        await queueWorkspaceChange(local);
      } else if (remote) {
        const queued = await offlineDatabase.syncQueue.get(currentUserId);
        if (!queued && Date.parse(remote.updatedAt) > Date.parse(local.updatedAt)) {
          await pullRemoteWorkspace(remote);
          local = remote;
        }
      }

      if (!active) return;
      if (!local) {
        throw new Error("Unable to load a local or remote workspace.");
      }
      applyRemote(local);
      initializedUser.current = currentUserId;
      await offlineDatabase.workspaceOwners.put({
        id: "active",
        userId: currentUserId,
      });
      if (remoteError) {
        setSyncError(
          remoteError instanceof Error
            ? `Using your local workspace. Sync will retry when connected: ${remoteError.message}`
            : "Using your local workspace. Sync will retry when connected.",
        );
      }
      await updatePendingCount(currentUserId);
      if (await offlineDatabase.syncQueue.get(currentUserId)) {
        await requestBackgroundSync();
      }
      setIsLoading(false);
      if (navigator.onLine) void runSync();
    }

    void initialize().catch((error: unknown) => {
      if (!active) return;
      setSyncError(
        error instanceof Error ? error.message : "Unable to initialize offline storage.",
      );
      setIsLoading(false);
    });

    return () => {
      active = false;
    };
  }, [
    applyRemote,
    authLoading,
    requestBackgroundSync,
    runSync,
    updatePendingCount,
    userId,
  ]);

  useEffect(() => {
    if (!userId || isLoading || initializedUser.current !== userId) return;
    let previousSheets = useTaskStore.getState().sheets;
    const unsubscribe = useTaskStore.subscribe((state) => {
      if (applyingRemote.current || state.sheets === previousSheets) return;
      previousSheets = state.sheets;
      const workspace: OfflineWorkspace = {
        userId,
        sheets: state.sheets,
        updatedAt: new Date().toISOString(),
      };
      writeChain.current = writeChain.current
        .then(() => queueWorkspaceChange(workspace))
        .then(() => updatePendingCount(userId))
        .then(() => requestBackgroundSync())
        .then(() => {
          if (navigator.onLine) void runSync();
        })
        .catch((error: unknown) => {
          setSyncError(
            error instanceof Error
              ? `Local offline save failed: ${error.message}`
              : "Local offline save failed.",
          );
        });
    });
    return unsubscribe;
  }, [isLoading, requestBackgroundSync, runSync, updatePendingCount, userId]);

  const resolveConflict = useCallback(
    async (resolution: "local" | "remote" | "merge") => {
      if (!conflict || isResolvingConflict) return;
      setIsResolvingConflict(true);
      try {
        const workspace = await resolveWorkspaceConflict(conflict, resolution);
        applyRemote(workspace);
        setConflict(null);
        await updatePendingCount(workspace.userId);
        if (resolution !== "remote") void runSync();
      } catch (error) {
        setSyncError(
          error instanceof Error ? error.message : "Unable to resolve workspace conflict.",
        );
      } finally {
        setIsResolvingConflict(false);
      }
    },
    [applyRemote, conflict, isResolvingConflict, runSync, updatePendingCount],
  );

  if (authLoading || isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-sm text-muted-foreground">
        Preparing your offline workspace…
      </div>
    );
  }

  return (
    <>
      {children}
      {userId && (
        <div
          className="fixed bottom-20 right-4 z-30 rounded-full border bg-card/95 px-3 py-1.5 text-xs shadow-lg backdrop-blur lg:bottom-4"
          role="status"
          aria-live="polite"
        >
          <span
            className={`mr-2 inline-block size-2 rounded-full ${
              isOnline ? "bg-emerald-500" : "bg-amber-500"
            }`}
          />
          {isOnline
            ? pendingCount
              ? `Sync pending (${pendingCount})`
              : "Synced"
            : `Offline${pendingCount ? ` · ${pendingCount} pending` : ""}`}
        </div>
      )}
      {syncError && (
        <div
          className="fixed bottom-32 right-4 z-30 max-w-sm rounded-xl border border-amber-500/30 bg-card p-3 text-xs text-muted-foreground shadow-lg lg:bottom-14"
          role="alert"
        >
          <p>{syncError}</p>
          {isOnline && (
            <button
              type="button"
              onClick={() => void runSync()}
              className="mt-2 font-semibold text-primary hover:underline"
            >
              Retry synchronization
            </button>
          )}
        </div>
      )}
      {conflict && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="sync-conflict-title"
            className="max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-2xl border bg-card p-5 shadow-2xl sm:p-7"
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-600">
              Sync conflict detected
            </p>
            <h2 id="sync-conflict-title" className="mt-1 text-xl font-semibold">
              Choose which workspace version to keep
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              This workspace changed locally and remotely since the last sync.
              Compare the versions before resolving the conflict.
            </p>
            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              <div>
                <h3 className="mb-2 text-sm font-semibold">Local version</h3>
                <pre className="max-h-64 overflow-auto rounded-xl border bg-background p-3 text-[11px] leading-relaxed">
                  {JSON.stringify(conflict.local.sheets, null, 2)}
                </pre>
              </div>
              <div>
                <h3 className="mb-2 text-sm font-semibold">Remote version</h3>
                <pre className="max-h-64 overflow-auto rounded-xl border bg-background p-3 text-[11px] leading-relaxed">
                  {JSON.stringify(conflict.remote.sheets, null, 2)}
                </pre>
              </div>
            </div>
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <Button type="button" variant="outline" disabled={isResolvingConflict} onClick={() => void resolveConflict("remote")}>
                Keep remote
              </Button>
              <Button type="button" variant="outline" disabled={isResolvingConflict} onClick={() => void resolveConflict("merge")}>
                Merge changes
              </Button>
              <Button type="button" disabled={isResolvingConflict} onClick={() => void resolveConflict("local")}>
                Keep local
              </Button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
