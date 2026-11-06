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
import type { Task } from "@/types";

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
  const [isHovered, setIsHovered] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  useEffect(() => {
    if (completionRequested) setIsCompleting(true);
  }, [completionRequested]);

  const completeAnimation = () => {
    setShowCheck(true);
    setIsCompleting(false);
    if (onCompletionAnimationComplete) onCompletionAnimationComplete();
    else onComplete();
  };
  const actualTime =
    task.actualMinutes === null
      ? "—"
      : `${Number.isInteger(task.actualMinutes) ? task.actualMinutes : task.actualMinutes.toFixed(1)}m`;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 7 }}
      animate={{
        opacity: task.status === "Completed" || isCompleting ? 0.58 : 1,
        y: 0,
      }}
      exit={{ opacity: 0, height: 0, marginTop: 0, overflow: "hidden" }}
      transition={{ duration: 0.22 }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => {
        setIsHovered(false);
        setIsMenuOpen(false);
      }}
      className="relative grid min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 border-b px-2 py-3 last:border-b-0 sm:gap-3 sm:px-4"
    >
      <div className="flex items-center gap-0.5">
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
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8"
          onClick={onPause}
          disabled={disablePause || isCompleting}
          aria-label={`Pause focus timer for ${task.title}`}
          title="Pause task timer (Space)"
        >
          <Pause className="size-4 fill-current" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8 text-primary"
          onClick={onPlay}
          disabled={
            disablePlay ||
            isCompleting ||
            task.status === "Completed" ||
            task.status === "Archived"
          }
          aria-label={`${task.status === "Paused" ? "Resume" : "Start"} focus timer for ${task.title}`}
          title={`${task.status === "Paused" ? "Resume" : "Start"} task timer (Enter)`}
        >
          <Play className="size-4 fill-current" />
        </Button>
        <div className="relative">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8"
            disabled={disableEditDelete}
            aria-label={`Actions for ${task.title}`}
            title="Task actions"
            aria-expanded={isMenuOpen}
            onClick={() => setIsMenuOpen((open) => !open)}
          >
            <MoreHorizontal className="size-4" />
          </Button>
          <div
            className={`absolute left-0 top-8 z-20 w-32 rounded-xl border bg-card p-1 shadow-lg ${
              isHovered || isMenuOpen ? "block" : "hidden"
            }`}
          >
            <button
              type="button"
              onClick={() => {
                setIsMenuOpen(false);
                onEdit();
              }}
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
      <div className="relative min-w-0">
        <div className="flex min-w-0 items-center gap-2">
          <button
            type="button"
            onClick={onEdit}
            disabled={disableEditDelete}
            className={`block max-w-full truncate text-left text-sm font-medium hover:text-primary ${
              task.status === "Completed" ? "line-through" : ""
            }`}
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
              title="Completed"
            >
              <Check className="size-3" />
            </motion.span>
          )}
        </div>
        <p className="mt-1 truncate text-[11px] text-muted-foreground">
          Estimate {task.estimatedMinutes}m <span aria-hidden="true">·</span>{" "}
          Actual {actualTime}
        </p>
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
      <span className="max-w-24 rounded-full bg-secondary px-2 py-1 text-[10px] font-semibold text-muted-foreground sm:max-w-none sm:px-2.5 sm:text-[11px]">
        {task.status === "InProgress"
          ? "In progress"
          : task.status === "Completed"
            ? "Completed"
            : task.status}
      </span>
    </motion.div>
  );
}
