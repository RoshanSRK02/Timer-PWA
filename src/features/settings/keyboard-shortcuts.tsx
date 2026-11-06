import { useEffect } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";

const shortcutSections = [
  {
    title: "Task Management",
    shortcuts: [
      ["Enter", "Start Task"],
      ["F", "Finish Task"],
    ],
  },
  { title: "Timer", shortcuts: [["Space", "Pause / Resume"]] },
  {
    title: "Navigation",
    shortcuts: [
      ["O", "OLED Mode"],
      ["Shift + F", "Enter / Exit Focus Mode"],
    ],
  },
  { title: "General", shortcuts: [["?", "Show Shortcuts"]] },
];

export function KeyboardShortcutsContent() {
  return (
    <div className="space-y-5">
      {shortcutSections.map(({ title, shortcuts }) => (
        <section key={title}>
          <h3 className="border-b pb-2 text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">
            {title}
          </h3>
          <dl className="mt-2 space-y-2">
            {shortcuts.map(([key, description]) => (
              <div key={key} className="flex items-center justify-between gap-4">
                <dt className="text-sm">{description}</dt>
                <dd>
                  <kbd className="rounded-md border bg-secondary px-2 py-1 text-xs font-semibold">
                    {key}
                  </kbd>
                </dd>
              </div>
            ))}
          </dl>
        </section>
      ))}
    </div>
  );
}

export function KeyboardShortcutsDialog({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 z-[70] flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <motion.section
        initial={{ opacity: 0, y: 12, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 8 }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="shortcuts-dialog-title"
        className="max-h-full w-full max-w-md overflow-y-auto rounded-2xl border bg-card p-5 shadow-2xl sm:p-6"
      >
        <h2 id="shortcuts-dialog-title" className="mb-5 text-xl font-semibold">
          Keyboard Shortcuts
        </h2>
        <KeyboardShortcutsContent />
        <div className="mt-6 flex justify-end">
          <Button type="button" onClick={onClose}>Close</Button>
        </div>
      </motion.section>
    </motion.div>
  );
}

export function KeyboardShortcutsPage() {
  const navigate = useNavigate();
  return (
    <section className="mx-auto max-w-xl space-y-5">
      <h1 className="text-3xl font-bold tracking-tight">Keyboard Shortcuts</h1>
      <div className="rounded-2xl border bg-card p-5 sm:p-7">
        <KeyboardShortcutsContent />
      </div>
      <Button variant="outline" onClick={() => navigate(-1)}>Back</Button>
    </section>
  );
}
