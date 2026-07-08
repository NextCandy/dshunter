import { useEffect, useState, type ReactNode } from "react";
import {
  applyTheme,
  getThemeStorage,
  LEGACY_THEME_STORAGE_KEY,
  readStoredTheme,
  resolveSystemTheme,
  THEME_STORAGE_KEY,
  ThemeCtx,
  type Theme,
} from "./theme";

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("dark");

  useEffect(() => {
    const saved = readStoredTheme();
    setThemeState(saved);
    applyTheme(saved);
    if (!window.matchMedia) return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => {
      if (readStoredTheme() === "system") applyTheme("system");
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const setTheme = (t: Theme) => {
    const storage = getThemeStorage();
    storage?.setItem(THEME_STORAGE_KEY, t);
    storage?.setItem(LEGACY_THEME_STORAGE_KEY, t);
    setThemeState(t);
    applyTheme(t);
  };

  const resolved: "light" | "dark" =
    theme === "system" ? (typeof window === "undefined" ? "light" : resolveSystemTheme()) : theme;

  return <ThemeCtx.Provider value={{ theme, setTheme, resolved }}>{children}</ThemeCtx.Provider>;
}
