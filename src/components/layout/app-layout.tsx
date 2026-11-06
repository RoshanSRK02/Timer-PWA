import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  BarChart3,
  Clock3,
  History,
  ListTodo,
  LogOut,
  Pause,
  Play,
  Settings2,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/utils/cn";
import { Button } from "@/components/ui/button";
import { OrientationRecommendation } from "@/components/layout/orientation-recommendation";
import { useTaskStore } from "@/stores/use-task-store";
import {
  getTimerOvertimeSeconds,
  getTimerRemainingSeconds,
  useTimerStore,
} from "@/stores/use-timer-store";
import { useThemeStore } from "@/stores/use-theme-store";
import { KeyboardShortcutsDialog } from "@/features/settings/keyboard-shortcuts";

const navItems = [
  { to: "/tasks", label: "Tasks", icon: ListTodo },
  { to: "/analytics", label: "Statistics", icon: BarChart3 },
  { to: "/history", label: "History", icon: History },
  { to: "/settings", label: "Settings", icon: Settings2 },
];

function DynamicIsland({ visible }: { visible: boolean }) {
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(false);
  const [now, setNow] = useState(Date.now());
  const timer = useTimerStore();
  const sheets = useTaskStore((state) => state.sheets);
  const task = sheets
    .find((sheet) => sheet.id === timer.taskSheetId)
    ?.tasks.find((item) => item.id === timer.taskId);
  const shown = timer.status !== "idle";

  useEffect(() => {
    if (
      timer.status !== "running" &&
      !(timer.status === "overtime" && timer.startedAt)
    ) return;
    const intervalId = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(intervalId);
  }, [timer.status, timer.startedAt]);

  if (!shown || !visible) return null;

  const remaining = getTimerRemainingSeconds(timer, now);
  const overtimeSeconds = getTimerOvertimeSeconds(timer, now);
  const label =
    timer.status === "overtime"
      ? `+${String(Math.floor(overtimeSeconds / 60)).padStart(2, "0")}:${String(overtimeSeconds % 60).padStart(2, "0")}`
      : `${String(Math.floor(remaining / 60)).padStart(2, "0")}:${String(remaining % 60).padStart(2, "0")}`;

  function openTimer() {
    navigate("/");
    window.setTimeout(() => {
      document.getElementById("timer-stage")?.focus({ preventScroll: true });
      document.getElementById("timer-stage")?.scrollIntoView({ behavior: "smooth" });
    }, 100);
  }

  return (
    <div
      className="dynamic-island fixed left-1/2 top-3 z-40 -translate-x-1/2"
      onMouseEnter={() => setExpanded(true)}
      onMouseLeave={() => setExpanded(false)}
    >
      <div
        className={`overflow-hidden rounded-full border border-white/10 bg-neutral-950 text-white shadow-2xl transition-all duration-300 ${
          expanded ? "w-[min(26rem,calc(100vw-2rem))] rounded-3xl" : "w-36"
        }`}
      >
        {expanded ? (
          <div className="p-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-amber-300">
              Current Task
            </p>
            <p className="mt-1 truncate text-sm font-semibold">
              {task?.title ?? (timer.breakSession ? timer.breakLabel : "Focus session")}
            </p>
            <p className="my-3 text-center font-mono text-3xl tabular-nums">
              {label}
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {timer.status === "running" ||
              (timer.status === "overtime" && timer.startedAt) ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="border-white/20 bg-white/10 text-white hover:bg-white/20"
                  onClick={() => useTimerStore.getState().pause()}
                >
                  <Pause className="size-3.5" /> Pause
                </Button>
              ) : timer.status === "paused" || timer.status === "overtime" ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="border-white/20 bg-white/10 text-white hover:bg-white/20"
                  onClick={() => useTimerStore.getState().resume()}
                >
                  <Play className="size-3.5" /> Resume
                </Button>
              ) : null}
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="border-white/20 bg-white/10 text-white hover:bg-white/20"
                onClick={() => useTimerStore.getState().finishEarly()}
              >
                Finish
              </Button>
              <Button type="button" size="sm" onClick={openTimer}>
                Open Timer
              </Button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            className="w-full px-4 py-2 text-center font-mono text-sm font-semibold tabular-nums"
            onClick={openTimer}
            aria-label={`Open timer, ${label}`}
          >
            {label}
          </button>
        )}
      </div>
    </div>
  );
}

export function AppLayout() {
  const { user, signOut } = useAuth();
  const [signOutError, setSignOutError] = useState<string | null>(null);
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);

  useEffect(() => {
    function handleShortcuts(event: KeyboardEvent) {
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        (target.isContentEditable ||
          ["INPUT", "TEXTAREA", "SELECT", "BUTTON", "A"].includes(target.tagName))
      ) return;
      const key = event.key.toLowerCase();
      const timer = useTimerStore.getState();

      if (event.key === " ") {
        event.preventDefault();
        if (timer.status === "running" || (timer.status === "overtime" && timer.startedAt)) timer.pause();
        else if (timer.status === "paused" || timer.status === "overtime") timer.resume();
      } else if (key === "enter") {
        const state = useTaskStore.getState();
        const sheet = state.sheets.find((item) => item.id === state.activeSheetId);
        const selectedTask =
          sheet && timer.taskSheetId === sheet.id && timer.taskId
            ? sheet.tasks.find((item) => item.id === timer.taskId)
            : undefined;
        const task =
          selectedTask ??
          sheet?.tasks.find(
            (item) => item.status === "Pending" || item.status === "Paused",
          );
        if (sheet && task) timer.startTask(sheet.id, task.id, task.estimatedMinutes);
      } else if (key === "f" && !event.shiftKey) {
        if (timer.status === "running" || timer.status === "paused" || timer.status === "overtime") {
          timer.finishEarly();
        }
      } else if (key === "o") {
        useThemeStore.getState().setTheme(
          useThemeStore.getState().theme === "oled" ? "dark" : "oled",
        );
      } else if (key === "t") {
        window.dispatchEvent(new CustomEvent("tempo:toggle-drawer"));
      } else if (key === "?" || (key === "/" && event.shiftKey)) {
        event.preventDefault();
        if (document.fullscreenElement) {
          window.dispatchEvent(new CustomEvent("tempo:show-shortcuts"));
        } else {
          setShortcutsOpen(true);
        }
      } else if (key === "f" && event.shiftKey) {
        window.dispatchEvent(new CustomEvent("tempo:toggle-focus"));
      }
    }

    window.addEventListener("keydown", handleShortcuts);
    return () => window.removeEventListener("keydown", handleShortcuts);
  }, []);

  async function handleSignOut() {
    setSignOutError(null);
    try {
      await signOut();
    } catch (error) {
      setSignOutError(
        error instanceof Error ? error.message : "Unable to sign out.",
      );
    }
  }

  const version = import.meta.env.VITE_APP_VERSION ?? "v1.0.0";

  return (
    <div className="relative min-h-screen bg-background lg:grid lg:grid-cols-[72px_minmax(0,1fr)]">
      <aside
        onMouseEnter={() => setSidebarExpanded(true)}
        onMouseLeave={() => setSidebarExpanded(false)}
        className={`desktop-sidebar group fixed inset-y-0 left-0 z-30 hidden border-r bg-card/95 px-3 py-5 shadow-sm transition-[width] duration-300 lg:flex lg:flex-col ${
          sidebarExpanded ? "w-[232px]" : "w-[72px]"
        }`}
      >
        <Link to="/" className="mb-10 flex min-h-10 items-center gap-3 px-1">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Clock3 className="size-5" />
          </span>
          <span className={`overflow-hidden text-xl font-bold tracking-tight transition-opacity ${
            sidebarExpanded ? "opacity-100" : "w-0 opacity-0"
          }`}>tempo</span>
        </Link>
        <nav className="space-y-2" aria-label="Main navigation">
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                cn(
                  "flex h-11 items-center gap-3 overflow-hidden rounded-xl px-3 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                )
              }
              title={sidebarExpanded ? undefined : label}
              aria-label={label}
            >
              <Icon className="size-[18px] shrink-0" />
              <span className={`whitespace-nowrap transition-opacity ${
                sidebarExpanded ? "opacity-100" : "opacity-0"
              }`}>{label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto overflow-hidden border-t pt-4">
          <p className={`truncate px-2 text-[10px] text-muted-foreground ${
            sidebarExpanded ? "opacity-100" : "opacity-0"
          }`}>{version}</p>
        </div>
      </aside>

      <div className="flex min-h-screen min-w-0 flex-col lg:col-start-2">
        <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b bg-background/85 px-5 backdrop-blur-md sm:px-8 lg:px-10">
          <Link to="/" className="flex items-center gap-2 font-bold lg:hidden">
            <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Clock3 className="size-4" />
            </span>
            tempo
          </Link>
          <Link to="/" className="hidden text-sm text-muted-foreground lg:block">
            Your space to do great work.
          </Link>
          <div className="ml-auto flex min-w-0 items-center gap-2">
            {signOutError && (
              <span className="max-w-40 truncate text-xs text-destructive" role="alert">
                {signOutError}
              </span>
            )}
            <span className="hidden max-w-48 truncate text-xs text-muted-foreground sm:block">
              {user?.email}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => void handleSignOut()}
              aria-label="Sign out"
              title="Sign out"
            >
              <LogOut className="size-4" />
            </Button>
          </div>
        </header>

        <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-8 pb-24 sm:px-8 lg:px-10 lg:py-10 lg:pb-10">
          <Outlet />
        </main>
        <footer className="px-5 pb-20 text-right text-xs text-muted-foreground sm:px-8 lg:px-10 lg:pb-4">
          {version}
        </footer>

        <nav className="mobile-tab-bar fixed inset-x-0 bottom-0 z-20 grid grid-cols-4 border-t bg-card/95 p-2 backdrop-blur lg:hidden">
          {[
            { to: "/tasks", label: "Tasks", icon: ListTodo },
            { to: "/", label: "Timer", icon: Clock3 },
            { to: "/analytics", label: "Statistics", icon: BarChart3 },
            { to: "/settings", label: "Settings", icon: Settings2 },
          ].map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                cn(
                  "flex flex-col items-center gap-1 rounded-xl py-2 text-xs font-medium",
                  isActive ? "text-primary" : "text-muted-foreground",
                )
              }
            >
              <Icon className="size-5" />
              {label}
            </NavLink>
          ))}
        </nav>
      </div>
      <DynamicIsland visible={!sidebarExpanded} />
      {shortcutsOpen && (
        <KeyboardShortcutsDialog onClose={() => setShortcutsOpen(false)} />
      )}
      <OrientationRecommendation />
    </div>
  );
}
