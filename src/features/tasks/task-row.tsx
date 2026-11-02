import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Check,
  MoreHorizontal,
  Pause,
  Pencil,
  Play,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Task, TaskStatus } from "@/types";

const statusStyles: Record<TaskStatus, string> = {
  Pending: "bg-secondary text-secondary-foreground",
  InProgress: "bg-blue-500/10 text-blue-700 dark:text-blue-300",
  Paused: "bg-violet-500/10 text-violet-700 dark:text-violet-300",
  Completed: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  Skipped: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
  Archived: "bg-muted text-muted-foreground",
};

interface TaskRowProps {
  task: Task;
  completionRequested?: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onPlay: () => void;
  onPause: () => void;
  onComplete: () => void;
  onCompletionAnimationComplete?: () => void;
  disableEditDelete?: boolean;
  disableCompletion?: boolean;
  disablePlay?: boolean;
  disablePause?: boolean;
}

export function TaskRow({
  task,
  completionRequested = false,
  onEdit,
  onDelete,
  onPlay,
  onPause,
  onComplete,
  onCompletionAnimationComplete,
  disableEditDelete = false,
  disableCompletion = false,
  disablePlay = false,
  disablePause = true,
}: TaskRowProps) {
  const [isCompleting, setIsCompleting] = useState(false);
  const [showCheck, setShowCheck] = useState(task.status === "Completed");

  useEffect(() => {
    if (completionRequested) setIsCompleting(true);
  }, [completionRequested]);

  const completeAnimation = () => {
    setShowCheck(true);
    setIsCompleting(false);
    if (onCompletionAnimationComplete) onCompletionAnimationComplete();
    else onComplete();
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 7 }}
      animate={{ opacity: isCompleting ? 0.48 : 1, y: 0 }}
      exit={{ opacity: 0, height: 0, marginTop: 0, overflow: "hidden" }}
      transition={{ duration: 0.22 }}
      className="relative grid min-w-[760px] grid-cols-[minmax(210px,1fr)_86px_86px_112px_40px_40px_88px] items-center gap-2 border-b px-4 py-3 last:border-b-0 sm:gap-3 sm:px-5"
    >
      <div className="relative min-w-0">
        <div className="flex min-w-0 items-center gap-2">
          <button
            type="button"
            onClick={onEdit}
            disabled={disableEditDelete}
            className="block max-w-full truncate text-left text-sm font-medium hover:text-primary"
            title={task.title}
          >
            {task.title}
          </button>
          {showCheck && (
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="flex size-4 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white"
              aria-label="Completed"
            >
              <Check className="size-3" />
            </motion.span>
          )}
        </div>
        <AnimatePresence>
          {isCompleting && (
            <motion.span
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ duration: 0.42, ease: "easeInOut" }}
              onAnimationComplete={completeAnimation}
              className="absolute left-0 top-1/2 h-px w-full origin-left bg-muted-foreground"
              aria-hidden="true"
            />
          )}
        </AnimatePresence>
      </div>
      <span className="text-sm tabular-nums text-muted-foreground">
        {task.estimatedMinutes}m
      </span>
      <span className="text-sm tabular-nums text-muted-foreground">
        {Number.isInteger(task.actualMinutes)
          ? task.actualMinutes
          : task.actualMinutes.toFixed(1)}
        m
      </span>
      <span
        className={`w-fit rounded-full px-2.5 py-1 text-[11px] font-semibold ${statusStyles[task.status]}`}
      >
        {task.status === "InProgress" ? "In progress" : task.status}
      </span>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-9 text-amber-600 hover:text-amber-700 dark:text-amber-400"
        onClick={onPause}
        disabled={disablePause || isCompleting}
        aria-label={`Pause focus timer for ${task.title}`}
        title="Pause task timer"
      >
        <Pause className="size-4 fill-current" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-9 text-primary"
        onClick={onPlay}
        disabled={
          disablePlay ||
          isCompleting ||
          task.status === "Completed" ||
          task.status === "Archived"
        }
        aria-label={`${task.status === "Paused" ? "Resume" : "Start"} focus timer for ${task.title}`}
        title={task.status === "Paused" ? "Resume task timer" : "Start task timer"}
      >
        <Play className="size-4 fill-current" />
      </Button>
      <div className="flex items-center justify-end gap-0.5">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8 text-emerald-600 hover:text-emerald-700 dark:text-emerald-400"
          onClick={onComplete}
          disabled={
            isCompleting ||
            disableCompletion ||
            task.status === "Completed" ||
            task.status === "Archived"
          }
          aria-label={`Complete ${task.title}`}
          title="Complete task"
        >
          <Check className="size-4" />
        </Button>
        <div className="group relative">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8"
            disabled={disableEditDelete}
            aria-label={`Actions for ${task.title}`}
            title="Task actions"
          >
            <MoreHorizontal className="size-4" />
          </Button>
          <div className="absolute right-0 top-8 z-20 hidden w-32 rounded-xl border bg-card p-1 shadow-lg group-focus-within:block group-hover:block">
            <button
              type="button"
              onClick={onEdit}
              disabled={disableEditDelete}
              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs hover:bg-secondary"
            >
              <Pencil className="size-3.5" /> Edit
            </button>
            <button
              type="button"
              onClick={onDelete}
              disabled={disableEditDelete}
              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs text-destructive hover:bg-destructive/5"
            >
              <Trash2 className="size-3.5" /> Delete
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
