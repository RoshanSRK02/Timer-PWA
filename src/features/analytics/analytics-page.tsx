import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  Activity,
  BarChart3,
  CheckCircle2,
  Clock3,
  Coffee,
  Target,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card } from "@/components/ui/card";
import { readTimerSessions } from "@/services/timer-persistence";
import { useAuthStore } from "@/stores/use-auth-store";
import { useTaskStore } from "@/stores/use-task-store";
import type { TimerSessionRecord } from "@/types";

function dayStart(date: Date): Date {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

function weekStart(date: Date): Date {
  const result = dayStart(date);
  const daysSinceMonday = (result.getDay() + 6) % 7;
  result.setDate(result.getDate() - daysSinceMonday);
  return result;
}

function minutesBetween(sessions: TimerSessionRecord[], start: Date, end: Date) {
  return sessions.reduce((total, session) => {
    const started = Date.parse(session.startedAt);
    return started >= start.getTime() && started < end.getTime()
      ? total + session.actualSeconds / 60
      : total;
  }, 0);
}

function formatDuration(minutes: number): string {
  const roundedMinutes = Math.round(minutes);
  const hours = Math.floor(roundedMinutes / 60);
  const remainingMinutes = roundedMinutes % 60;
  return hours > 0 ? `${hours}h ${remainingMinutes}m` : `${remainingMinutes}m`;
}

function dateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function MetricCard({
  label,
  value,
  caption,
  icon: Icon,
}: {
  label: string;
  value: string;
  caption: string;
  icon: typeof Clock3;
}) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
          <p className="mt-2 text-2xl font-bold tracking-tight">{value}</p>
        </div>
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent text-primary">
          <Icon className="size-5" />
        </span>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">{caption}</p>
    </Card>
  );
}

export function AnalyticsPage() {
  const userId = useAuthStore((state) => state.user?.id);
  const taskSheets = useTaskStore((state) => state.sheets);
  const tasks = useMemo(() => taskSheets.flatMap((sheet) => sheet.tasks), [taskSheets]);
  const taskMap = useMemo(
    () => new Map(tasks.map((task) => [task.id, task])),
    [tasks],
  );
  const sessionsQuery = useQuery({
    queryKey: ["timer-sessions", userId],
    queryFn: () => readTimerSessions(userId!),
    enabled: Boolean(userId),
  });
  const sessions = sessionsQuery.data?.sessions ?? [];
  const focusSessions = sessions.filter((session) => !session.breakSession);
  const breakSessions = sessions.filter((session) => session.breakSession);
  const now = new Date();
  const today = dayStart(now);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const monday = weekStart(now);
  const nextMonday = new Date(monday);
  nextMonday.setDate(nextMonday.getDate() + 7);
  const completedTasks = tasks.filter((task) => task.status === "Completed");
  const completedToday = completedTasks.filter((task) => {
    const completedAt = Date.parse(task.completedAt ?? task.updatedAt);
    return completedAt >= today.getTime() && completedAt < tomorrow.getTime();
  }).length;
  const tasksWithActuals = completedTasks.filter(
    (task) => task.actualMinutes > 0 && task.estimatedMinutes > 0,
  );
  const estimationAccuracy = tasksWithActuals.length
    ? (tasksWithActuals.reduce(
        (sum, task) => sum + task.estimatedMinutes / task.actualMinutes,
        0,
      ) /
        tasksWithActuals.length) *
      100
    : null;
  const averageSessionMinutes = focusSessions.length
    ? focusSessions.reduce(
        (sum, session) => sum + session.actualSeconds / 60,
        0,
      ) / focusSessions.length
    : 0;
  const focusToday = minutesBetween(focusSessions, today, tomorrow);
  const focusThisWeek = minutesBetween(focusSessions, monday, nextMonday);
  const breaksToday = minutesBetween(breakSessions, today, tomorrow);

  const dailyData = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() - (6 - index));
    const nextDate = new Date(date);
    nextDate.setDate(date.getDate() + 1);
    const key = dateKey(date);
    const completedCount = completedTasks.filter((task) => {
      const completedAt = Date.parse(task.completedAt ?? task.updatedAt);
      return completedAt >= date.getTime() && completedAt < nextDate.getTime();
    }).length;

    return {
      date: key,
      day: new Intl.DateTimeFormat(undefined, { weekday: "short" }).format(date),
      focusMinutes: minutesBetween(focusSessions, date, nextDate),
      completed: completedCount,
    };
  });

  const ratioData = [
    { name: "Focus", value: focusSessions.reduce((sum, session) => sum + session.actualSeconds / 60, 0) },
    { name: "Breaks", value: breakSessions.reduce((sum, session) => sum + session.actualSeconds / 60, 0) },
  ].filter((entry) => entry.value > 0);

  const taskName = (session: TimerSessionRecord) =>
    session.breakSession
      ? session.breakLabel ?? "Break"
      : (session.taskId && taskMap.get(session.taskId)?.title) || "Deleted task";

  const chartTooltipStyle = {
    backgroundColor: "hsl(var(--card))",
    border: "1px solid hsl(var(--border))",
    borderRadius: "0.75rem",
    color: "hsl(var(--foreground))",
  };

  return (
    <div className="space-y-8">
      <header>
        <p className="mb-2 flex items-center gap-2 text-sm font-medium text-primary">
          <BarChart3 className="size-4" /> YOUR PROGRESS
        </p>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          Statistics & analytics
        </h1>
        <p className="mt-2 text-muted-foreground">
          A clear picture of where your focus time goes.
        </p>
      </header>

      {sessionsQuery.data?.syncWarning && (
        <p className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm text-muted-foreground" role="status">
          Some session data could not be synchronized. Showing available local or
          remote data. {sessionsQuery.data.syncWarning}
        </p>
      )}
      {sessionsQuery.isError && (
        <p className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive" role="alert">
          Unable to load session analytics: {sessionsQuery.error.message}
        </p>
      )}
      {sessionsQuery.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading your analytics…</p>
      ) : (
        <>
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <MetricCard
              label="Focus time today"
              value={formatDuration(focusToday)}
              caption="From recorded focus sessions"
              icon={Clock3}
            />
            <MetricCard
              label="Focus time this week"
              value={formatDuration(focusThisWeek)}
              caption="Since Monday"
              icon={Activity}
            />
            <MetricCard
              label="Tasks completed"
              value={String(completedToday)}
              caption="Completed today"
              icon={CheckCircle2}
            />
            <MetricCard
              label="Average session duration"
              value={formatDuration(averageSessionMinutes)}
              caption={`${focusSessions.length} recorded focus ${focusSessions.length === 1 ? "session" : "sessions"}`}
              icon={Target}
            />
            <MetricCard
              label="Estimation accuracy"
              value={estimationAccuracy === null ? "—" : `${Math.round(estimationAccuracy)}%`}
              caption="Average estimate ÷ actual for completed tasks"
              icon={BarChart3}
            />
            <MetricCard
              label="Break time today"
              value={formatDuration(breaksToday)}
              caption="From recorded break sessions"
              icon={Coffee}
            />
          </section>

          <section className="grid gap-5 xl:grid-cols-2">
            <Card className="p-5 sm:p-6">
              <div className="mb-5">
                <h2 className="font-semibold">Daily focus trend</h2>
                <p className="mt-1 text-xs text-muted-foreground">Minutes focused per day · last 7 days</p>
              </div>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={dailyData} margin={{ top: 8, right: 12, bottom: 0, left: -18 }}>
                    <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" />
                    <XAxis dataKey="day" tickLine={false} axisLine={false} />
                    <YAxis tickLine={false} axisLine={false} allowDecimals={false} />
                    <Tooltip contentStyle={chartTooltipStyle} formatter={(value) => [`${value} min`, "Focus"]} />
                    <Line type="monotone" dataKey="focusMinutes" name="Focus" stroke="hsl(var(--primary))" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <Card className="p-5 sm:p-6">
              <div className="mb-5">
                <h2 className="font-semibold">Tasks completed trend</h2>
                <p className="mt-1 text-xs text-muted-foreground">Tasks marked completed per day · last 7 days</p>
              </div>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dailyData} margin={{ top: 8, right: 12, bottom: 0, left: -18 }}>
                    <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" />
                    <XAxis dataKey="day" tickLine={false} axisLine={false} />
                    <YAxis tickLine={false} axisLine={false} allowDecimals={false} />
                    <Tooltip contentStyle={chartTooltipStyle} />
                    <Bar dataKey="completed" name="Tasks completed" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <Card className="p-5 sm:p-6 xl:col-span-2">
              <div className="mb-5">
                <h2 className="font-semibold">Focus vs break ratio</h2>
                <p className="mt-1 text-xs text-muted-foreground">Recorded time across all available sessions</p>
              </div>
              {ratioData.length === 0 ? (
                <div className="flex h-56 items-center justify-center text-sm text-muted-foreground">
                  Complete a focus or break session to see your time ratio.
                </div>
              ) : (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={ratioData} dataKey="value" nameKey="name" innerRadius={62} outerRadius={96} paddingAngle={4}>
                        {ratioData.map((entry) => (
                          <Cell key={entry.name} fill={entry.name === "Focus" ? "hsl(var(--primary))" : "hsl(var(--muted-foreground))"} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={chartTooltipStyle} formatter={(value) => [`${formatDuration(Number(value))}`, "Duration"]} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </Card>
          </section>

          <section>
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold">Recent sessions</h2>
              <Link
                to="/history"
                className="text-sm font-semibold text-primary hover:underline"
              >
                View full history
              </Link>
            </div>
            <Card className="divide-y">
              {sessions.slice(0, 5).map((session) => (
                <div key={session.id} className="flex items-center justify-between gap-4 px-5 py-4">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{taskName(session)}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(session.startedAt))}
                    </p>
                  </div>
                  <span className="shrink-0 text-sm font-semibold">{formatDuration(session.actualSeconds / 60)}</span>
                </div>
              ))}
              {sessions.length === 0 && (
                <p className="px-5 py-8 text-center text-sm text-muted-foreground">
                  Sessions will appear here as you use the timer.
                </p>
              )}
            </Card>
          </section>
        </>
      )}
    </div>
  );
}
