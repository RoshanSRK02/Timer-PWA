import { useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface SheetDialogProps {
  mode: "create" | "rename" | "delete";
  currentName: string;
  onClose: () => void;
  onConfirm: (name?: string) => void;
}

export function SheetDialog({
  mode,
  currentName,
  onClose,
  onConfirm,
}: SheetDialogProps) {
  const [name, setName] = useState(mode === "rename" ? currentName : "");

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onConfirm(name.trim());
  }

  const title =
    mode === "create"
      ? "Create a sheet"
      : mode === "rename"
        ? "Rename sheet"
        : "Delete this sheet?";

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
        aria-labelledby="sheet-dialog-title"
        className="w-full max-w-sm rounded-2xl border bg-card p-5 shadow-2xl sm:p-6"
      >
        <h2 id="sheet-dialog-title" className="text-lg font-semibold">
          {title}
        </h2>
        {mode === "delete" ? (
          <>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              “{currentName}” and all its tasks will be permanently removed.
              This action cannot be undone.
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={onClose}>
                Cancel
              </Button>
              <Button
                type="button"
                className="bg-destructive text-destructive-foreground hover:opacity-90"
                onClick={() => onConfirm()}
              >
                Delete sheet
              </Button>
            </div>
          </>
        ) : (
          <form className="mt-4 space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <label htmlFor="sheet-name" className="text-sm font-medium">
                Sheet name
              </label>
              <Input
                id="sheet-name"
                autoFocus
                maxLength={48}
                placeholder="e.g. This week"
                required
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit">
                {mode === "create" ? "Create sheet" : "Save name"}
              </Button>
            </div>
          </form>
        )}
      </section>
    </div>
  );
}
