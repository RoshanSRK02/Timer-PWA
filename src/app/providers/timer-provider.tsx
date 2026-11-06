import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PropsWithChildren,
} from "react";
import { TimerPersistenceContext } from "@/app/providers/timer-context";
import { useAuthStore } from "@/stores/use-auth-store";
import { useTimerStore } from "@/stores/use-timer-store";
import {
  chooseLatestSnapshot,
  readLocalTimerSessions,
  readRemoteTimerSnapshot,
  readTimerSnapshot,
  writeRemoteTimerSnapshot,
  writeRemoteTimerSession,
  writeTimerSession,
  writeTimerSnapshot,
} from "@/services/timer-persistence";
import type { TimerSessionRecord, TimerSnapshot } from "@/types";
import {
  isPushConfigured,
  sendTimerPush,
} from "@/services/push-notifications";
import { showTimerNotification } from "@/services/timer-notifications";

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Timer synchronization failed.";
}

export function TimerProvider({ children }: PropsWithChildren) {
  const user = useAuthStore((state) => state.user);
  const authLoading = useAuthStore((state) => state.isLoading);
  const userId = user?.id ?? null;
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryVersion, setRetryVersion] = useState(0);
  const timerHydratedRef = useRef(false);
  const notifiedSessionIdRef = useRef(
    useTimerStore.getState().lastSession?.id ?? null,
  );

  useEffect(() => {
    if (authLoading) return;

    let active = true;
    timerHydratedRef.current = false;
    let hydrated = false;
    let persistedSessionId: string | null = null;
    let writeQueue = Promise.resolve();
    const unsubscribe = useTimerStore.subscribe(() => {
      if (!active || !hydrated || !userId) return;
      const snapshot = useTimerStore.getState().toSnapshot();
      if (!snapshot) return;
      const session =
        snapshot.lastSession?.id === persistedSessionId
          ? null
          : snapshot.lastSession;

      writeQueue = writeQueue
        .then(() => saveSnapshot(snapshot, session))
        .catch((saveError: unknown) => {
          if (active) setError(getErrorMessage(saveError));
        });
    });

    async function saveSnapshot(
      snapshot: TimerSnapshot,
      session: TimerSessionRecord | null = snapshot.lastSession,
    ) {
      const writes: Promise<unknown>[] = [writeTimerSnapshot(snapshot)];
      let sessionWrite: Promise<TimerSessionRecord> | null = null;
      if (session) {
        sessionWrite = writeRemoteTimerSession(session);
        writes.push(writeTimerSession(session), sessionWrite);
      }

      const [results, winningSnapshot] = await Promise.all([
        Promise.allSettled(writes),
        writeRemoteTimerSnapshot(snapshot),
      ]);
      const failures = results
        .filter((result) => result.status === "rejected")
        .map((result) =>
          result.status === "rejected" ? getErrorMessage(result.reason) : "",
        );

      if (failures.length > 0) {
        throw new Error(failures.join(" "));
      }

      const winningSession = sessionWrite ? await sessionWrite : null;
      if (
        session &&
        winningSession &&
        Date.parse(winningSession.updatedAt) > Date.parse(session.updatedAt)
      ) {
        await writeTimerSession(winningSession);
      }

      if (
        userId &&
        Date.parse(winningSnapshot.updatedAt) > Date.parse(snapshot.updatedAt)
      ) {
        useTimerStore.getState().restoreSnapshot(winningSnapshot, userId);
      }
      if (session) persistedSessionId = session.id;
      if (active) setError(null);
    }

    async function hydrate() {
      setIsLoading(true);
      setError(null);

      if (!userId) {
        useTimerStore.setState({
          userId: null,
          status: "idle",
          taskSheetId: null,
          taskId: null,
          durationSeconds: 25 * 60,
          accumulatedSeconds: 0,
          startedAt: null,
          sessionId: null,
          sessionStartedAt: null,
          breakSession: false,
          breakLabel: null,
          updatedAt: new Date().toISOString(),
          completedSessions: 0,
          completionConfirmed: false,
          lastSession: null,
        });
        hydrated = true;
        timerHydratedRef.current = true;
        setIsLoading(false);
        return;
      }

      let localSnapshot: TimerSnapshot | undefined;
      let remoteSnapshot: TimerSnapshot | null = null;
      const readErrors: string[] = [];

      useTimerStore.getState().restoreSnapshot(null, userId);

      try {
        localSnapshot = await readTimerSnapshot(userId);
      } catch (readError) {
        readErrors.push(`Local timer storage: ${getErrorMessage(readError)}`);
      }

      try {
        remoteSnapshot = await readRemoteTimerSnapshot(userId);
      } catch (readError) {
        readErrors.push(`Supabase timer storage: ${getErrorMessage(readError)}`);
      }

      if (!active) return;

      const snapshot = chooseLatestSnapshot(localSnapshot, remoteSnapshot);
      useTimerStore.getState().restoreSnapshot(snapshot, userId);
      hydrated = true;
      timerHydratedRef.current = true;
      setIsLoading(false);

      if (readErrors.length > 0) setError(readErrors.join(" "));

      const restoredSnapshot = useTimerStore.getState().toSnapshot();
      if (!restoredSnapshot) return;
      writeQueue = writeQueue
        .then(() => saveSnapshot(restoredSnapshot, restoredSnapshot.lastSession))
        .catch((saveError: unknown) => {
          if (active) setError(getErrorMessage(saveError));
        });
    }

    void hydrate().catch((hydrateError: unknown) => {
      if (!active) return;
      hydrated = true;
      timerHydratedRef.current = false;
      setIsLoading(false);
      setError(getErrorMessage(hydrateError));
    });

    return () => {
      active = false;
      hydrated = false;
      unsubscribe();
    };
  }, [authLoading, userId, retryVersion]);

  useEffect(() => {
    if (authLoading || !userId) return;

    const timer = useTimerStore.getState();
    timer.completeIfExpired();

    const updateId = window.setInterval(() => {
      useTimerStore.getState().completeIfExpired();
    }, 1000);

    return () => window.clearInterval(updateId);
  }, [authLoading, userId]);

  useEffect(() => {
    if (authLoading || isLoading || !userId) return;
    notifiedSessionIdRef.current =
      useTimerStore.getState().lastSession?.id ?? null;

    return useTimerStore.subscribe((state) => {
      const session = state.lastSession;
      if (
        !session ||
        session.id === notifiedSessionIdRef.current ||
        session.outcome !== "completed"
      ) {
        return;
      }

      notifiedSessionIdRef.current = session.id;
      const title = session.breakSession
        ? "Break complete"
        : session.taskId
          ? "Task complete"
          : "Focus session complete";
      const body = session.breakSession
        ? "Your break is over. Ready to focus again?"
        : "Your focus session is complete. Great work!";
      void showTimerNotification(title, body).catch((notificationError: unknown) =>
        console.error("Tempo could not show the timer completion notification.", notificationError),
      );
      if (isPushConfigured() && navigator.onLine) {
        void sendTimerPush(title, body).catch((pushError: unknown) =>
          console.error("Tempo could not send the timer push notification.", pushError),
        );
      }
    });
  }, [authLoading, isLoading, userId]);

  useEffect(() => {
    if (authLoading || !userId) return;

    let synchronizing = false;
    const synchronizeTimer = async () => {
      if (
        !navigator.onLine ||
        !timerHydratedRef.current ||
        synchronizing
      ) return;
      const snapshot = useTimerStore.getState().toSnapshot();
      if (!snapshot) return;
      synchronizing = true;
      try {
        const [winner, sessions] = await Promise.all([
          writeRemoteTimerSnapshot(snapshot),
          readLocalTimerSessions(userId),
        ]);
        await Promise.all(sessions.map((session) => writeRemoteTimerSession(session)));
        if (Date.parse(winner.updatedAt) > Date.parse(snapshot.updatedAt)) {
          useTimerStore.getState().restoreSnapshot(winner, userId);
        }
        setError(null);
      } catch (syncError) {
        setError(getErrorMessage(syncError));
      } finally {
        synchronizing = false;
      }
    };

    const handleOnline = () => void synchronizeTimer();
    const handleVisibility = () => {
      if (document.visibilityState === "visible") void synchronizeTimer();
    };
    const intervalId = window.setInterval(() => void synchronizeTimer(), 5_000);
    window.addEventListener("online", handleOnline);
    document.addEventListener("visibilitychange", handleVisibility);
    const handleServiceWorkerMessage = (event: MessageEvent) => {
      if (event.data?.type === "TEMPO_SYNC_REQUEST") void synchronizeTimer();
    };
    navigator.serviceWorker?.addEventListener(
      "message",
      handleServiceWorkerMessage,
    );
    if (navigator.onLine) void synchronizeTimer();
    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("online", handleOnline);
      document.removeEventListener("visibilitychange", handleVisibility);
      navigator.serviceWorker?.removeEventListener(
        "message",
        handleServiceWorkerMessage,
      );
    };
  }, [authLoading, userId]);

  const retry = useCallback(() => {
    setRetryVersion((version) => version + 1);
  }, []);

  return (
    <TimerPersistenceContext.Provider value={{ isLoading, error, retry }}>
      {children}
    </TimerPersistenceContext.Provider>
  );
}
