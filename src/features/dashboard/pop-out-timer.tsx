import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { createRoot, type Root } from "react-dom/client";
import { PictureInPicture2 } from "lucide-react";
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
      ? `+${formatTime(overtimeSeconds)}`
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
  const [isOpen, setIsOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const popupRef = useRef<Window | null>(null);
  const rootRef = useRef<Root | null>(null);

  const closePopup = useCallback(() => {
    rootRef.current?.unmount();
    rootRef.current = null;
    const popup = popupRef.current;
    popupRef.current = null;
    setIsOpen(false);
    if (popup && !popup.closed) popup.close();
  }, []);

  useEffect(() => {
    if (!isOpen || (timerStatus !== "idle" && taskId)) return;
    closePopup();
  }, [closePopup, isOpen, taskId, timerStatus]);

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

  async function openPopup() {
    setError(null);
    const pictureInPicture = (
      window as WindowWithDocumentPictureInPicture
    ).documentPictureInPicture;
    if (!pictureInPicture) {
      setError(
        "Picture-in-Picture is not supported in this browser. Keep the timer open in the app.",
      );
      return;
    }

    try {
      const popup = await pictureInPicture.requestWindow({
        width: 360,
        height: 220,
      });
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
          if (rootRef.current) rootRef.current.unmount();
          rootRef.current = null;
          popupRef.current = null;
          setIsOpen(false);
        },
        { once: true },
      );
      setIsOpen(true);
    } catch (openError) {
      setError(
        openError instanceof Error
          ? `Could not open the pop-out timer: ${openError.message}`
          : "Could not open the pop-out timer.",
      );
    }
  }

  if (!taskId || timerStatus === "idle") return null;

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => (isOpen ? closePopup() : void openPopup())}
        aria-label={isOpen ? "Close pop-out timer" : "Pop out timer"}
        title={
          "documentPictureInPicture" in window
            ? undefined
            : "Picture-in-Picture is unsupported in this browser"
        }
      >
        <PictureInPicture2 className="size-4" />
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
