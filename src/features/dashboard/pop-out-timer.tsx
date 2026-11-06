import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { createRoot, type Root } from "react-dom/client";
import { Pin } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  getTimerOvertimeSeconds,
  getTimerRemainingSeconds,
  useTimerStore,
} from "@/stores/use-timer-store";
import { useTaskStore } from "@/stores/use-task-store";

interface DocumentPictureInPictureApi {
  requestWindow(options?: { width?: number; height?: number }): Promise<Window>;
}

type WindowWithDocumentPictureInPicture = Window & {
  documentPictureInPicture?: DocumentPictureInPictureApi;
};

function formatTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;
  return [hours, minutes, remainingSeconds]
    .map((value) => String(value).padStart(2, "0"))
    .join(":");
}

function formatOvertime(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  return `+${String(minutes).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

function PopOutTimerWindow({
  onReturn,
}: {
  onReturn: () => void;
}) {
  const timer = useTimerStore();
  const sheets = useTaskStore((state) => state.sheets);
  const [now, setNow] = useState(Date.now());
  const task = sheets
    .find((sheet) => sheet.id === timer.taskSheetId)
    ?.tasks.find((item) => item.id === timer.taskId);
  const isRunning =
    timer.status === "running" ||
    (timer.status === "overtime" && Boolean(timer.startedAt));
  const isPaused =
    timer.status === "paused" ||
    (timer.status === "overtime" && !timer.startedAt);
  const overtimeSeconds = getTimerOvertimeSeconds(timer, now);
  const displayTime =
    timer.status === "overtime"
      ? formatOvertime(overtimeSeconds)
      : formatTime(getTimerRemainingSeconds(timer, now));

  useEffect(() => {
    if (!isRunning) return;
    const intervalId = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(intervalId);
  }, [isRunning, timer.startedAt]);

  function togglePause() {
    const actions = useTimerStore.getState();
    if (isRunning) actions.pause();
    else if (isPaused) actions.resume();
  }

  function finishTask() {
    const actions = useTimerStore.getState();
    if (actions.status === "overtime") {
      actions.resolveTaskCompletion(true);
      return;
    }

    actions.finishEarly();
    if (useTimerStore.getState().status === "awaiting-completion") {
      useTimerStore.getState().resolveTaskCompletion(true);
    }
  }

  const buttonStyle: CSSProperties = {
    minHeight: 40,
    flex: "1 1 0",
    border: "1px solid rgba(255,255,255,.18)",
    borderRadius: 10,
    background: "rgba(255,255,255,.08)",
    color: "#fff",
    font: "600 13px system-ui, sans-serif",
    cursor: "pointer",
  };

  return (
    <main
      style={{
        boxSizing: "border-box",
        minHeight: "100vh",
        padding: 18,
        background: "#111318",
        color: "#f5f5f5",
        fontFamily: "Inter, system-ui, sans-serif",
      }}
    >
      {timer.status === "overtime" && (
        <p
          style={{
            margin: "16px 0 -12px",
            color: "#fbbf24",
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: ".15em",
            textAlign: "center",
          }}
        >
          OVERTIME
        </p>
      )}
      <p
        style={{
          margin: "0 0 8px",
          color: "#a78bfa",
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: ".14em",
          textTransform: "uppercase",
        }}
      >
        {timer.status === "overtime" ? "Overtime" : "Current task"}
      </p>
      <h1
        title={task?.title ?? "Focus session"}
        style={{
          overflow: "hidden",
          margin: 0,
          fontSize: 16,
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {task?.title ?? "Focus session"}
      </h1>
      <p
        aria-live="off"
        style={{
          margin: "20px 0",
          color: timer.status === "overtime" ? "#fbbf24" : "#fff",
          fontFamily: "ui-monospace, SFMono-Regular, monospace",
          fontSize: 38,
          fontVariantNumeric: "tabular-nums",
          fontWeight: 700,
          textAlign: "center",
        }}
      >
        {displayTime}
      </p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        <button
          type="button"
          style={buttonStyle}
          disabled={!isRunning && !isPaused}
          onClick={togglePause}
        >
          {isRunning ? "Pause" : "Resume"}
        </button>
        <button
          type="button"
          style={{ ...buttonStyle, borderColor: "rgba(167,139,250,.55)" }}
          disabled={!task || timer.status === "idle"}
          onClick={finishTask}
        >
          Finish
        </button>
        <button
          type="button"
          style={{ ...buttonStyle, background: "#7c3aed", borderColor: "#7c3aed" }}
          onClick={onReturn}
        >
          Return to App
        </button>
      </div>
    </main>
  );
}

function copyStyles(from: Document, to: Document): void {
  for (const styleSheet of from.querySelectorAll<HTMLLinkElement>(
    'link[rel="stylesheet"]',
  )) {
    to.head.append(styleSheet.cloneNode(true));
  }
}

export function PopOutTimerButton() {
  const timerStatus = useTimerStore((state) => state.status);
  const taskId = useTimerStore((state) => state.taskId);
  const taskSheetId = useTimerStore((state) => state.taskSheetId);
  const [isMobileBrowser, setIsMobileBrowser] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const popupRef = useRef<Window | null>(null);
  const rootRef = useRef<Root | null>(null);
  const activeTimer =
    timerStatus === "running" ||
    timerStatus === "paused" ||
    timerStatus === "overtime";

  useEffect(() => {
    const mobileQuery = window.matchMedia("(pointer: coarse) and (hover: none)");
    const updateMobileState = () => setIsMobileBrowser(mobileQuery.matches);
    updateMobileState();
    mobileQuery.addEventListener("change", updateMobileState);
    return () => mobileQuery.removeEventListener("change", updateMobileState);
  }, []);

  useEffect(() => {
    if (import.meta.env.DEV) {
      console.info(
        `[Tempo] Document Picture-in-Picture supported: ${Boolean(
          (window as WindowWithDocumentPictureInPicture)
            .documentPictureInPicture,
        )}`,
      );
    }
  }, []);

  const closePopup = useCallback(() => {
    rootRef.current?.unmount();
    rootRef.current = null;
    const popup = popupRef.current;
    popupRef.current = null;
    setIsOpen(false);
    if (popup && !popup.closed) popup.close();
  }, []);

  useEffect(() => {
    if (!isOpen || (activeTimer && taskId && taskSheetId)) return;
    closePopup();
  }, [activeTimer, closePopup, isOpen, taskId, taskSheetId]);

  useEffect(
    () => () => {
      rootRef.current?.unmount();
      rootRef.current = null;
      if (popupRef.current && !popupRef.current.closed) {
        popupRef.current.close();
      }
      popupRef.current = null;
    },
    [],
  );

  function mountPopup(popup: Window, fallback: boolean) {
    popupRef.current = popup;
    popup.document.title = "Tempo — Pop Out Timer";
    popup.document.documentElement.className =
      document.documentElement.className;
    popup.document.body.style.cssText =
      "margin:0;min-width:280px;background:#111318";
    copyStyles(document, popup.document);
    popup.document.body.replaceChildren();
    const container = popup.document.createElement("div");
    popup.document.body.append(container);
    const root = createRoot(container);
    rootRef.current = root;
    root.render(
      <PopOutTimerWindow
        onReturn={() => {
          closePopup();
          window.focus();
          document
            .getElementById("timer-stage")
            ?.scrollIntoView({ behavior: "smooth", block: "center" });
        }}
      />,
    );
    popup.addEventListener(
      "pagehide",
      () => {
        if (rootRef.current === root) root.unmount();
        if (rootRef.current === root) rootRef.current = null;
        if (popupRef.current === popup) popupRef.current = null;
        setIsOpen(false);
      },
      { once: true },
    );
    setIsOpen(true);
    if (import.meta.env.DEV) {
      console.info(
        fallback
          ? "[Tempo] Pop-out opened using fallback popup."
          : "[Tempo] Pop-out opened using Document Picture-in-Picture.",
      );
    }
  }

  function openFallback(): boolean {
    const fallback = window.open(
      "",
      "tempo-pop-out-timer",
      "popup=yes,width=360,height=250,resizable=yes",
    );
    if (!fallback) return false;
    mountPopup(fallback, true);
    return true;
  }

  async function openPopup() {
    setError(null);
    const pictureInPicture = (
      window as WindowWithDocumentPictureInPicture
    ).documentPictureInPicture;
    if (pictureInPicture) {
      try {
        const popup = await pictureInPicture.requestWindow({
          width: 360,
          height: 250,
        });
        mountPopup(popup, false);
        return;
      } catch (openError) {
        if (import.meta.env.DEV) {
          console.info("[Tempo] Picture-in-Picture failed; trying popup fallback.", openError);
        }
        if (openFallback()) return;
        setError(
          "Picture-in-Picture could not open and the browser blocked the fallback popup.",
        );
        return;
      }
    }

    if (openFallback()) return;
    setError("The browser blocked the pop-out timer window.");
  }

  if (isMobileBrowser || !taskId || !taskSheetId || !activeTimer) return null;

  return (
    <div className="pop-out-timer-control flex flex-col items-end gap-1">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => (isOpen ? closePopup() : void openPopup())}
        aria-label={isOpen ? "Close pop-out timer" : "Pop out timer"}
        title="Keep the timer visible while working in other tabs or applications"
      >
        <Pin className="size-4" />
        {isOpen ? "Close Pop Out" : "Pop Out Timer"}
      </Button>
      {error && (
        <p className="max-w-64 text-right text-xs text-muted-foreground" role="status">
          {error}
        </p>
      )}
    </div>
  );
}
