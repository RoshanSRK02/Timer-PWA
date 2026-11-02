import { useState } from "react";
import { Link, NavLink, Outlet } from "react-router-dom";
import {
  BarChart3,
  Clock3,
  History,
  LogOut,
  Settings2,
  Sparkles,
  ListTodo,
  Timer,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/utils/cn";
import { Button } from "@/components/ui/button";
import { OrientationRecommendation } from "@/components/layout/orientation-recommendation";

const navItems = [
  { to: "/tasks", label: "Tasks", icon: ListTodo, end: false },
  { to: "/", label: "Timer", icon: Timer, end: true },
  { to: "/analytics", label: "Statistics", icon: BarChart3, end: false },
  { to: "/settings", label: "Settings", icon: Settings2, end: false },
];

export function AppLayout() {
  const { user, signOut } = useAuth();
  const [signOutError, setSignOutError] = useState<string | null>(null);

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

  return (
    <div className="min-h-screen bg-background lg:grid lg:grid-cols-[248px_minmax(0,1fr)]">
      <aside className="hidden border-r bg-card/70 px-5 py-7 lg:flex lg:flex-col">
        <Link to="/" className="mb-12 flex items-center gap-3 px-2">
          <span className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Clock3 className="size-5" />
          </span>
          <span className="text-xl font-bold tracking-tight">tempo</span>
        </Link>
        <p className="mb-3 px-3 text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
          Workspace
        </p>
        <nav className="space-y-1">
          {navItems.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                )
              }
            >
              <Icon className="size-[18px]" />
              {label}
            </NavLink>
          ))}
          <NavLink
            to="/history"
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                isActive
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground",
              )
            }
          >
            <History className="size-[18px]" />
            Session history
          </NavLink>
        </nav>
        <div className="mt-auto rounded-2xl bg-accent p-4">
          <Sparkles className="mb-3 size-5 text-primary" />
          <p className="text-sm font-semibold">Make room for focus</p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            Small, intentional sessions add up to meaningful progress.
          </p>
        </div>
      </aside>

      <div className="flex min-h-screen min-w-0 flex-col">
        <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b bg-background/85 px-5 backdrop-blur-md sm:px-8 lg:px-10">
          <Link to="/" className="flex items-center gap-2 font-bold lg:hidden">
            <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Clock3 className="size-4" />
            </span>
            tempo
          </Link>
          <div className="hidden text-sm text-muted-foreground lg:block">
            Your space to do great work.
          </div>
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

        <nav className="mobile-tab-bar fixed inset-x-0 bottom-0 z-20 grid grid-cols-4 border-t bg-card/95 p-2 backdrop-blur lg:hidden">
          {navItems.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
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
      <OrientationRecommendation />
    </div>
  );
}
