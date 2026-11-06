import { Check, Monitor, Moon, MoonStar, Sun } from "lucide-react";
import { useTheme } from "@/hooks/use-theme";
import type { ThemePreference } from "@/types";
import { cn } from "@/utils/cn";

const options: {
  value: ThemePreference;
  label: string;
  icon: typeof Sun;
}[] = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "oled", label: "OLED", icon: MoonStar },
  { value: "system", label: "System", icon: Monitor },
];

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label="Color theme">
      {options.map(({ value, label, icon: Icon }) => (
        <button
          key={value}
          type="button"
          aria-pressed={theme === value}
          onClick={() => setTheme(value)}
          className={cn(
            "inline-flex h-10 items-center gap-2 rounded-xl border px-3 text-sm font-medium transition-colors",
            theme === value
              ? "border-primary/30 bg-accent text-accent-foreground"
              : "bg-card text-muted-foreground hover:bg-secondary",
          )}
        >
          <Icon className="size-4" aria-hidden="true" />
          {label}
          {theme === value && (
            <Check className="size-3.5" aria-hidden="true" />
          )}
        </button>
      ))}
    </div>
  );
}
