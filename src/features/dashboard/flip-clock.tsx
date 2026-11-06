import { AnimatePresence, motion } from "framer-motion";

interface FlipDigitProps {
  value: string;
  label: string;
}

function FlipDigit({ value, label }: FlipDigitProps) {
  return (
    <div
      className="flip-digit"
      aria-label={`${label} ${value}`}
      role="group"
    >
      <div className="flip-digit__face">
        <span className="flip-digit__value">{value}</span>
      </div>
      <div className="flip-digit__seam" aria-hidden="true" />
      <AnimatePresence initial={false} mode="sync">
        <motion.div
          key={value}
          className="flip-digit__flipper"
          initial={{ rotateX: 0 }}
          animate={{ rotateX: -180 }}
          transition={{ duration: 0.42, ease: [0.35, 0.05, 0.2, 1] }}
          style={{ transformOrigin: "bottom", transformStyle: "preserve-3d" }}
          aria-hidden="true"
        >
          <div className="flip-digit__half flip-digit__half--top">
            <span className="flip-digit__value">{value}</span>
          </div>
          <div
            className="flip-digit__half flip-digit__half--bottom"
            style={{ transform: "rotateX(180deg)", backfaceVisibility: "hidden" }}
          >
            <span className="flip-digit__value">{value}</span>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

function ClockUnit({ value, label }: { value: number; label: string }) {
  const digits = String(value).padStart(2, "0");

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="flex gap-1.5 sm:gap-2">
        <FlipDigit value={digits[0]!} label={`${label} tens`} />
        <FlipDigit value={digits[1]!} label={`${label} units`} />
      </div>
      <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground sm:text-xs">
        {label}
      </span>
    </div>
  );
}

export function FlipClock({
  totalSeconds,
  overtime = false,
}: {
  totalSeconds: number;
  overtime?: boolean;
}) {
  const clampedSeconds = Math.max(0, Math.floor(totalSeconds));
  if (overtime) {
    const minutes = Math.floor(clampedSeconds / 60);
    const seconds = clampedSeconds % 60;
    return (
      <div
        className="flex items-center justify-center gap-2"
        role="timer"
        aria-label={`Overtime ${minutes} minutes ${seconds} seconds`}
        aria-live="off"
      >
        <span className="mb-6 text-4xl font-semibold text-amber-500 sm:text-6xl">+</span>
        <ClockUnit value={minutes} label="Overtime minutes" />
        <span className="mb-6 text-2xl font-light text-amber-500/70 sm:text-4xl">:</span>
        <ClockUnit value={seconds} label="Overtime seconds" />
      </div>
    );
  }
  const hours = Math.floor(clampedSeconds / 3600);
  const minutes = Math.floor((clampedSeconds % 3600) / 60);
  const seconds = clampedSeconds % 60;

  return (
    <div
      className="flex items-center justify-center gap-2.5 sm:gap-4"
      role="timer"
      aria-label={`${hours} hours ${minutes} minutes ${seconds} seconds remaining`}
      aria-live="off"
    >
      <ClockUnit value={hours} label="Hours" />
      <span className="mb-6 text-2xl font-light text-muted-foreground/60 sm:text-4xl">
        :
      </span>
      <ClockUnit value={minutes} label="Minutes" />
      <span className="mb-6 text-2xl font-light text-muted-foreground/60 sm:text-4xl">
        :
      </span>
      <ClockUnit value={seconds} label="Seconds" />
    </div>
  );
}
