import { useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Task, TaskStatus } from "@/types";

const taskStatuses: TaskStatus[] = [
  "Pending",
  "InProgress",
  "Paused",
  "Completed",
  "Skipped",
  "Archived",
];

export type TaskFormValues = Pick<
  Task,
  "title" | "estimatedMinutes" | "status"
>;

interface TaskDialogProps {
  task: Task | null;
  onClose: () => void;
  onSave: (values: TaskFormValues) => void;
}

export function TaskDialog({ task, onClose, onSave }: TaskDialogProps) {
  const [title, setTitle] = useState(task?.title ?? "");
  const [estimatedMinutes, setEstimatedMinutes] = useState(
    String(task?.estimatedMinutes ?? 25),
  );
  const [status, setStatus] = useState<TaskStatus>(task?.status ?? "Pending");

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSave({
      title: title.trim(),
      estimatedMinutes: Number(estimatedMinutes),
      status,
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="task-dialog-title"
        className="w-full max-w-md rounded-2xl border bg-card p-5 shadow-2xl sm:p-6"
      >
        <h2 id="task-dialog-title" className="text-lg font-semibold">
          {task ? "Edit task" : "Add a task"}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Give your next step a name and a realistic time estimate.
        </p>
        <form className="mt-5 space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <label htmlFor="task-title" className="text-sm font-medium">
              Title
            </label>
            <Input
              id="task-title"
              autoFocus
              maxLength={120}
              placeholder="What needs your attention?"
              required
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="task-estimate" className="text-sm font-medium">
              Estimate (min)
            </label>
            <Input
              id="task-estimate"
              type="number"
              min={1}
              max={1440}
              step={1}
              required
              value={estimatedMinutes}
              onChange={(event) => setEstimatedMinutes(event.target.value)}
            />
          </div>
          {task && (
            <p className="text-xs text-muted-foreground">
              Actual time is tracked automatically from timer sessions.
            </p>
          )}
          <div className="space-y-2">
            <label htmlFor="task-status" className="text-sm font-medium">
              Status
            </label>
            <select
              id="task-status"
              value={status}
              onChange={(event) => setStatus(event.target.value as TaskStatus)}
              className="flex h-11 w-full rounded-xl border border-input bg-background px-3.5 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {taskStatuses.map((value) => (
                <option key={value} value={value}>
                  {value === "InProgress"
                    ? "In progress"
                    : value}
                </option>
              ))}
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit">{task ? "Save changes" : "Add task"}</Button>
          </div>
        </form>
      </section>
    </div>
  );
}
