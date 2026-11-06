import { useEffect, type PropsWithChildren } from "react";
import { useThemeStore } from "@/stores/use-theme-store";

export function ThemeProvider({ children }: PropsWithChildren) {
  const theme = useThemeStore((state) => state.theme);

  useEffect(() => {
    const root = document.documentElement;
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const applyTheme = () => {
      const isSystemDark = theme === "system" && mediaQuery.matches;
      const isDark =
        theme === "dark" ||
        theme === "oled" ||
        isSystemDark;
      root.classList.toggle("dark", isDark);
      root.classList.toggle("oled", theme === "oled");
      root.style.colorScheme = isDark ? "dark" : "light";
      const themeColor = document.querySelector<HTMLMetaElement>(
        'meta[name="theme-color"]',
      );
      if (themeColor) {
        themeColor.content =
          theme === "oled"
            ? "#000000"
            : isDark
              ? "#131620"
              : "#f7f8fa";
      }
    };

    applyTheme();
    mediaQuery.addEventListener("change", applyTheme);

    return () => mediaQuery.removeEventListener("change", applyTheme);
  }, [theme]);

  return children;
}
