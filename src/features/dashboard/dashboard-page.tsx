import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowUpRight,
  Check,
  Coffee,
  Pause,
  Play,
  RotateCcw,
  Sparkles,
  Target,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useTimerStore } from "@/stores/use-timer-store";
import { formatTime } from "@/utils/format-time";

const presets = [
  { label: "Focus", minutes: 25, icon: Target },
  { label: "Short break", minutes: 5, icon: Coffee },
  { label: "Long break", minutes: 15, icon: Sparkles },
];

const intentions = [
  {
    title: "Make space for deep work",
    description:
      "Choose one meaningful task and give it your full attention.",
  },
  {
    title: "Start with the next small step",
    description:
      "You don't need the whole plan. Just begin with what's in front of you.",
  },
  {
    title: "Progress over perfection",
    description:
      "Show up, stay curious, and let a first draft be a first draft.",
  },
];

export function DashboardPage() {
  const {
    durationSeconds,
    remainingSeconds,
    status,
    completedSessions,
    setDuration,
    start,
    pause,
    reset,
    tick,
  } = useTimerStore();
  const selectedPreset =
    presets.find((preset) => preset.minutes * 60 === durationSeconds)?.label ??
    "Custom";
  const [intentionIndex, setIntentionIndex] = useState(0);
  const intention = intentions[intentionIndex]!;
  const progress =
    durationSeconds > 0
      ? ((durationSeconds - remainingSeconds) / durationSeconds) * 100
      : 0;

  useEffect(() => {
    if (status !== "running") return;
    const intervalId = window.setInterval(tick, 1000);
    return () => window.clearInterval(intervalId);
  }, [status, tick]);

  return (
    <div className="space-y-8">
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end"
      >
        <div>
          <p className="mb-2 flex items-center gap-2 text-sm font-medium text-primary">
            <Sparkles className="size-4" />
            {new Intl.DateTimeFormat("en-US", {
              weekday: "long",
              month: "long",
              day: "numeric",
            })
              .format(new Date())
              .toUpperCase()}
          </p>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Find your focus.
          </h1>
          <p className="mt-2 max-w-lg text-sm leading-6 text-muted-foreground sm:text-base">
            One thing at a time. Take a breath, set your intention, and begin.
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-xl border bg-card px-4 py-3 text-sm">
          <Zap className="size-4 text-amber-500" />
          <span className="font-semibold">{completedSessions}</span>
          <span className="text-muted-foreground">sessions today</span>
        </div>
      </motion.section>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.55fr)_minmax(280px,0.8fr)]">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.08 }}
        >
          <Card className="relative flex min-h-[480px] flex-col items-center justify-center overflow-hidden px-5 py-10 sm:min-h-[520px]">
            <div className="pointer-events-none absolute -right-24 -top-32 size-80 rounded-full bg-primary/[0.05] blur-3xl" />
            <div className="relative mb-8 flex items-center gap-1 rounded-xl bg-secondary p-1">
              {presets.map(({ label, minutes, icon: Icon }) => (
                <button
                  type="button"
                  key={label}
                  onClick={() => setDuration(minutes)}
                  aria-pressed={selectedPreset === label}
                  className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition sm:px-4 sm:text-sm ${
                    selectedPreset === label
                      ? "bg-card text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Icon className="size-4" />
                  <span className="hidden sm:inline">{label}</span>
                  <span className="sm:hidden">{minutes}m</span>
                </button>
              ))}
            </div>

            <div className="relative flex size-64 items-center justify-center sm:size-[290px]">
              <svg
                className="absolute inset-0 size-full -rotate-90"
                viewBox="0 0 280 280"
                aria-hidden="true"
              >
                <circle
                  cx="140"
                  cy="140"
                  r="128"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="text-secondary"
                />
                <motion.circle
                  cx="140"
                  cy="140"
                  r="128"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                  className="text-primary"
                  strokeDasharray={2 * Math.PI * 128}
                  animate={{
                    strokeDashoffset:
                      2 * Math.PI * 128 * (1 - progress / 100),
                  }}
                  transition={{ duration: 0.5 }}
                />
              </svg>
              <div className="text-center">
                <p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">
                  {status === "running" ? "In the zone" : selectedPreset}
                </p>
                <p
                  className="font-mono text-6xl font-semibold tracking-[-0.06em] tabular-nums sm:text-7xl"
                  role="timer"
                  aria-live="off"
                >
                  {formatTime(remainingSeconds)}
                </p>
                <p className="mt-3 text-sm text-muted-foreground">
                  {status === "running"
                    ? "Stay with this moment"
                    : "A little progress goes a long way"}
                </p>
              </div>
            </div>

            <div className="relative mt-8 flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={reset}
                aria-label="Reset timer"
              >
                <RotateCcw className="size-4" />
              </Button>
              <Button
                size="default"
                className="min-w-36 rounded-xl px-7"
                onClick={status === "running" ? pause : start}
              >
                {status === "running" ? (
                  <>
                    <Pause className="size-4" /> Pause
                  </>
                ) : (
                  <>
                    <Play className="size-4 fill-current" />{" "}
                    {status === "paused" ? "Resume" : "Start focus"}
                  </>
                )}
              </Button>
            </div>
          </Card>
        </motion.div>

        <div className="space-y-5">
          <Card className="p-5 sm:p-6">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold">Today’s intention</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Keep your next step in view
                </p>
              </div>
              <span className="flex size-9 items-center justify-center rounded-xl bg-accent text-primary">
                <Target className="size-[18px]" />
              </span>
            </div>
            <div className="flex items-start gap-3 rounded-xl border bg-background p-4">
              <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border border-primary/40 text-primary">
                <Check className="size-3" />
              </span>
              <div>
                <p className="text-sm font-medium">{intention.title}</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  {intention.description}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() =>
                setIntentionIndex((current) => (current + 1) % intentions.length)
              }
              className="mt-4 flex w-full items-center justify-between text-xs font-semibold text-primary hover:opacity-75"
            >
              Change intention <ArrowUpRight className="size-4" />
            </button>
          </Card>

          <Card className="overflow-hidden p-5 sm:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold">A gentle reminder</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Your best work needs room to breathe.
                </p>
              </div>
              <span className="text-2xl" aria-hidden="true">
                ☁️
              </span>
            </div>
            <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-secondary">
              <motion.div
                className="h-full rounded-full bg-primary"
                animate={{ width: `${Math.min(completedSessions * 20, 100)}%` }}
                transition={{ duration: 0.5 }}
              />
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">
              {completedSessions} of 5 focus sessions today
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}
