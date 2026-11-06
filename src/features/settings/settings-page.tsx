import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Check, Database, Keyboard, MoonStar, Settings2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { TimerSettings } from "@/features/dashboard/timer-settings";
import { PushNotificationSettings } from "@/features/settings/push-notification-settings";
import { isSupabaseConfigured } from "@/services/supabase";

export function SettingsPage() {
  const supabaseConfigured = isSupabaseConfigured();

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="mx-auto max-w-3xl space-y-8"
    >
      <div>
        <p className="mb-2 flex items-center gap-2 text-sm font-medium text-primary">
          <Settings2 className="size-4" /> YOUR PREFERENCES
        </p>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          Settings
        </h1>
        <p className="mt-2 text-muted-foreground">
          Make your workspace feel like yours.
        </p>
      </div>

      <Card className="p-5 sm:p-7">
        <div className="mb-6 flex items-start gap-4">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent text-primary">
            <MoonStar className="size-5" />
          </span>
          <div>
            <h2 className="font-semibold">Timer sound</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Choose a session alarm and set its volume.
            </p>
          </div>
        </div>
        <TimerSettings />
      </Card>

      <PushNotificationSettings />

      <Card className="p-5 sm:p-7">
        <div className="mb-6 flex items-start gap-4">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent text-primary">
            <MoonStar className="size-5" />
          </span>
          <div>
            <h2 className="font-semibold">Appearance</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Choose a theme, or follow your device settings.
            </p>
          </div>
        </div>
        <ThemeToggle />
      </Card>

      <Card className="p-5 sm:p-7">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent text-primary">
              <Keyboard className="size-5" />
            </span>
            <div>
              <h2 className="font-semibold">Keyboard Shortcuts</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                View timer, task, and navigation shortcuts.
              </p>
            </div>
          </div>
          <Link
            to="/shortcuts"
            className="shrink-0 rounded-lg border px-3 py-2 text-sm font-medium hover:bg-secondary"
          >
            View shortcuts
          </Link>
        </div>
      </Card>

      <Card className="p-5 sm:p-7">
        <h2 className="font-semibold">About</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Application version
        </p>
        <p className="mt-3 font-mono text-sm">
          {import.meta.env.VITE_APP_VERSION ?? "v1.0.0"}
        </p>
      </Card>

      <Card className="p-5 sm:p-7">
        <div className="mb-5 flex items-start gap-4">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent text-primary">
            <Database className="size-5" />
          </span>
          <div>
            <h2 className="font-semibold">Backend connection</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Supabase powers authentication and data when configured.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-xl border bg-background px-4 py-3">
          <span
            className={`size-2.5 rounded-full ${
              supabaseConfigured ? "bg-emerald-500" : "bg-amber-500"
            }`}
          />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">
              {supabaseConfigured ? "Connected configuration" : "Not configured"}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {supabaseConfigured
                ? "Supabase environment variables are available."
                : "Add the Supabase keys to your local .env file to connect."}
            </p>
          </div>
          {supabaseConfigured && (
            <Check className="size-4 text-emerald-600" aria-hidden="true" />
          )}
        </div>
      </Card>

      <p className="px-1 text-xs leading-relaxed text-muted-foreground">
        Add <code className="rounded bg-secondary px-1.5 py-0.5">VITE_SUPABASE_URL</code>{" "}
        and <code className="rounded bg-secondary px-1.5 py-0.5">VITE_SUPABASE_ANON_KEY</code>{" "}
        to a local <code className="rounded bg-secondary px-1.5 py-0.5">.env</code>{" "}
        file. Never put service-role keys in client-side environment variables.
      </p>
    </motion.div>
  );
}
