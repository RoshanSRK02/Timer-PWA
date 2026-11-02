import { NavLink, Outlet } from "react-router-dom";
import { Clock3, LayoutDashboard, Settings2, Sparkles } from "lucide-react";
import { cn } from "@/utils/cn";

const navItems = [
  { to: "/", label: "Focus", icon: LayoutDashboard, end: true },
  { to: "/settings", label: "Settings", icon: Settings2, end: false },
];

export function AppLayout() {
  return (
    <div className="min-h-screen bg-background lg:grid lg:grid-cols-[248px_minmax(0,1fr)]">
      <aside className="hidden border-r bg-card/70 px-5 py-7 lg:flex lg:flex-col">
        <a href="/" className="mb-12 flex items-center gap-3 px-2">
          <span className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Clock3 className="size-5" />
          </span>
          <span className="text-xl font-bold tracking-tight">tempo</span>
        </a>
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
          <a href="/" className="flex items-center gap-2 font-bold lg:hidden">
            <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Clock3 className="size-4" />
            </span>
            tempo
          </a>
          <div className="hidden text-sm text-muted-foreground lg:block">
            Your space to do great work.
          </div>
          <div className="ml-auto flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <span className="size-2 rounded-full bg-emerald-500" />
            Ready when you are
          </div>
        </header>

        <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-8 pb-24 sm:px-8 lg:px-10 lg:py-10 lg:pb-10">
          <Outlet />
        </main>

        <nav className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-2 border-t bg-card/95 p-2 backdrop-blur lg:hidden">
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
    </div>
  );
}
