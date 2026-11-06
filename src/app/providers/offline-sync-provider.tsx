import { useCallback, useEffect, useRef, useState, type PropsWithChildren } from "react";
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
  syncWorkspaceQueue,
} from "@/services/workspace-sync";

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
  const applyingRemote = useRef(false);
  const initializedUser = useRef<string | null>(null);
  const syncInProgress = useRef(false);
  const writeChain = useRef(Promise.resolve());

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
      const workspace = await syncWorkspaceQueue(userId);
      const current = useTaskStore.getState().sheets;
      if (JSON.stringify(current) !== JSON.stringify(workspace.sheets)) {
        applyRemote(workspace);
      }
    } catch (error) {
      setSyncError(
        error instanceof Error ? error.message : "Workspace synchronization failed.",
      );
    } finally {
      syncInProgress.current = false;
    }
  }, [applyRemote, userId]);

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
    if (!userId || !isOnline || initializedUser.current !== userId) return;
    const intervalId = window.setInterval(() => void runSync(), 10_000);
    const handleFocus = () => void runSync();
    window.addEventListener("focus", handleFocus);
    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", handleFocus);
    };
  }, [isOnline, runSync, userId]);

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

      const queued = await offlineDatabase.syncQueue.get(currentUserId);
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
        if (
          (!queued || Date.parse(remote.updatedAt) > Date.parse(queued.local.updatedAt)) &&
          Date.parse(remote.updatedAt) > Date.parse(local.updatedAt)
        ) {
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
  }, [isLoading, requestBackgroundSync, runSync, userId]);

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
      {syncError && (
        <div
          className="fixed bottom-20 right-4 z-30 max-w-sm rounded-xl border border-amber-500/30 bg-card p-3 text-xs text-muted-foreground shadow-lg lg:bottom-4"
          role="alert"
        >
          <p>Synchronization will retry automatically: {syncError}</p>
        </div>
      )}
    </>
  );
}
