import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Coffee, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTimerStore } from "@/stores/use-timer-store";

interface BreakDrawerProps {
  open: boolean;
  onClose: () => void;
  disabled?: boolean;
}

export function BreakDrawer({
  open,
  onClose,
  disabled = false,
}: BreakDrawerProps) {
  const startBreak = useTimerStore((state) => state.startBreak);
  const [customMinutes, setCustomMinutes] = useState("20");

  function beginBreak(minutes: number) {
    if (startBreak(minutes, "Break")) onClose();
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 bg-black/35 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) onClose();
          }}
        >
          <motion.aside
            role="dialog"
            aria-modal="true"
            aria-labelledby="break-drawer-title"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 280 }}
            className="absolute inset-y-0 right-0 flex w-full max-w-sm flex-col border-l bg-card p-6 shadow-2xl"
          >
            <div className="flex items-start justify-between">
              <span className="flex size-11 items-center justify-center rounded-2xl bg-accent text-primary">
                <Coffee className="size-5" />
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={onClose}
                aria-label="Close break drawer"
              >
                <X className="size-4" />
              </Button>
            </div>
            <h2
              id="break-drawer-title"
              className="mt-5 text-xl font-semibold tracking-tight"
            >
              Take a breather
            </h2>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              Choose a little time to reset. Your break timer will start
              immediately.
            </p>
            <div className="mt-6 grid grid-cols-3 gap-2">
              {[5, 10, 15].map((minutes) => (
                <Button
                  type="button"
                  key={minutes}
                  variant="outline"
                  className="h-14 flex-col gap-0"
                  disabled={disabled}
                  onClick={() => beginBreak(minutes)}
                >
                  <span className="text-base font-semibold">{minutes}</span>
                  <span className="text-[10px] text-muted-foreground">
                    minutes
                  </span>
                </Button>
              ))}
            </div>
            <form
              className="mt-4 flex items-end gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                const minutes = Number(customMinutes);
                if (Number.isFinite(minutes) && minutes > 0) beginBreak(minutes);
              }}
            >
              <div className="flex-1 space-y-2">
                <label htmlFor="custom-break" className="text-sm font-medium">
                  Custom minutes
                </label>
                <Input
                  id="custom-break"
                  type="number"
                  min={1}
                  max={240}
                  step={1}
                  value={customMinutes}
                  onChange={(event) => setCustomMinutes(event.target.value)}
                />
              </div>
              <Button type="submit" disabled={disabled}>
                Start custom
              </Button>
            </form>
            {disabled && (
              <p className="mt-3 text-xs text-muted-foreground">
                A break is already active. Resume your focus session or extend the break.
              </p>
            )}
          </motion.aside>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
