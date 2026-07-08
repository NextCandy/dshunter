import { createContext, useContext } from "react";

export type Theme = "light" | "dark" | "system";

type ThemeContextValue = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  resolved: "light" | "dark";
};

export const ThemeCtx = createContext<ThemeContextValue | null>(null);

export const THEME_STORAGE_KEY = "theme";
export const LEGACY_THEME_STORAGE_KEY = "domainops-theme";

export function getThemeStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage ?? null;
  } catch {
    return null;
  }
}

export function readStoredTheme(): Theme {
  const storage = getThemeStorage();
  const saved = storage?.getItem(THEME_STORAGE_KEY) ?? storage?.getItem(LEGACY_THEME_STORAGE_KEY);
  return saved === "light" || saved === "dark" || saved === "system" ? saved : "dark";
}

export function resolveSystemTheme(): "light" | "dark" {
  if (typeof window === "undefined" || !window.matchMedia) return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function applyTheme(theme: Theme) {
  if (typeof document === "undefined") return;
  const resolved = theme === "system" ? resolveSystemTheme() : theme;
  const root = document.documentElement;
  root.classList.toggle("dark", resolved === "dark");
  root.style.colorScheme = resolved;
}

export function useTheme() {
  const context = useContext(ThemeCtx);
  if (!context) throw new Error("useTheme must be used inside ThemeProvider");
  return context;
}

// Inline script to run before hydration and avoid a flash of the wrong theme.
export const themeInitScript = `
(function(){try{
  var k='${THEME_STORAGE_KEY}';
  var legacy='${LEGACY_THEME_STORAGE_KEY}';
  var t=localStorage.getItem(k)||localStorage.getItem(legacy)||'dark';
  var d=t==='dark'||(t==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);
  var r=document.documentElement;
  if(d){r.classList.add('dark');}
  r.style.colorScheme=d?'dark':'light';
}catch(e){}})();
`.trim();
