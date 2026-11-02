import { useEffect, useState } from "react";
import { Smartphone, X } from "lucide-react";
import { Button } from "@/components/ui/button";

const DISMISSED_KEY = "tempo-landscape-recommendation-dismissed";

export function OrientationRecommendation() {
  const [isPortrait, setIsPortrait] = useState(false);
  const [dismissed, setDismissed] = useState(
    () => window.sessionStorage.getItem(DISMISSED_KEY) === "true",
  );
  const [rotateError, setRotateError] = useState<string | null>(null);

  useEffect(() => {
    const query = window.matchMedia(
      "(max-width: 767px) and (orientation: portrait)",
    );
    const updateOrientation = () => setIsPortrait(query.matches);
    updateOrientation();
    query.addEventListener("change", updateOrientation);
    return () => query.removeEventListener("change", updateOrientation);
  }, []);

  async function rotateDevice() {
    setRotateError(null);
    try {
      const orientation = screen.orientation as ScreenOrientation & {
        lock?: (value: "landscape") => Promise<void>;
      };
      if (!orientation.lock) {
        setRotateError("Rotate your device manually to landscape.");
        return;
      }
      await orientation.lock("landscape");
    } catch {
      setRotateError("Rotate your device manually to landscape.");
    }
  }

  function continueAnyway() {
    window.sessionStorage.setItem(DISMISSED_KEY, "true");
    setDismissed(true);
  }

  if (!isPortrait || dismissed) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-background/85 p-5 backdrop-blur-md">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="landscape-title"
        className="w-full max-w-sm rounded-3xl border bg-card p-6 text-center shadow-2xl"
      >
        <div className="relative mx-auto flex size-16 items-center justify-center rounded-2xl bg-accent text-primary">
          <Smartphone className="size-8 -rotate-90" />
          <span className="absolute -right-1 -top-1 flex size-6 items-center justify-center rounded-full bg-background text-muted-foreground">
            <X className="size-3" />
          </span>
        </div>
        <h2 id="landscape-title" className="mt-5 text-xl font-semibold">
          Landscape Recommended
        </h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Turn your device sideways for a more comfortable timer and task
          workspace.
        </p>
        {rotateError && (
          <p className="mt-3 text-xs text-muted-foreground" role="status">
            {rotateError}
          </p>
        )}
        <div className="mt-5 grid gap-2">
          <Button type="button" onClick={() => void rotateDevice()}>
            Rotate device
          </Button>
          <Button type="button" variant="outline" onClick={continueAnyway}>
            Continue anyway
          </Button>
        </div>
      </section>
    </div>
  );
}
