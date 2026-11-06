import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Coffee } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTimerStore } from "@/stores/use-timer-store";

interface BreakDurationDialogProps {
  open: boolean;
  onClose: () => void;
  disabled?: boolean;
}

export function BreakDurationDialog({
  open,
  onClose,
  disabled = false,
}: BreakDurationDialogProps) {
  const startBreak = useTimerStore((state) => state.startBreak);
  const [selectedMinutes, setSelectedMinutes] = useState<number | null>(5);
  const [customMinutes, setCustomMinutes] = useState("");

  function beginBreak() {
    const minutes = selectedMinutes ?? Number(customMinutes);
    if (!Number.isFinite(minutes) || minutes < 1 || minutes > 240) return;
    if (startBreak(minutes, "Break")) onClose();
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) onClose();
          }}
        >
          <motion.section
            role="dialog"
            aria-modal="true"
            aria-labelledby="break-dialog-title"
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            className="w-full max-w-sm rounded-2xl border bg-card p-5 shadow-2xl sm:p-6"
          >
            <div className="flex items-center gap-3">
              <span className="flex size-10 items-center justify-center rounded-xl bg-accent text-primary">
                <Coffee className="size-5" />
              </span>
              <h2
                id="break-dialog-title"
                className="text-lg font-semibold tracking-tight"
              >
                Take a Break
              </h2>
            </div>

            <div className="mt-5 grid grid-cols-3 gap-2">
              {[5, 10, 15].map((minutes) => (
                <Button
                  type="button"
                  key={minutes}
                  variant={selectedMinutes === minutes ? "default" : "outline"}
                  className="h-11"
                  disabled={disabled}
                  aria-pressed={selectedMinutes === minutes}
                  onClick={() => setSelectedMinutes(minutes)}
                >
                  {minutes} min
                </Button>
              ))}
            </div>

            <div className="mt-4 space-y-2">
              <label htmlFor="custom-break" className="text-sm font-medium">
                Custom Minutes
              </label>
              <Input
                id="custom-break"
                type="number"
                min={1}
                max={240}
                step={1}
                placeholder="Enter minutes"
                value={customMinutes}
                disabled={disabled}
                onChange={(event) => {
                  setCustomMinutes(event.target.value);
                  setSelectedMinutes(null);
                }}
              />
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button
                type="button"
                disabled={
                  disabled ||
                  (selectedMinutes === null &&
                    (!Number.isFinite(Number(customMinutes)) ||
                      Number(customMinutes) < 1 ||
                      Number(customMinutes) > 240))
                }
                onClick={beginBreak}
              >
                Start Break
              </Button>
            </div>
          </motion.section>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
