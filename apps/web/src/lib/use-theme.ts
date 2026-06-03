"use client";

import { useState, useEffect, useCallback } from "react";

type Theme = "light" | "dark" | "system";

function getSystemTheme(): "light" | "dark" {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function getStoredTheme(): Theme {
  if (typeof window === "undefined") return "system";
  try { return (localStorage.getItem("theme") as Theme) ?? "system"; } catch { return "system"; }
}

function applyTheme(resolved: "light" | "dark") {
  document.documentElement.setAttribute("data-theme", resolved);
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(getStoredTheme);

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t);
    try { localStorage.setItem("theme", t); } catch { /* noop */ }
    const resolved = t === "system" ? getSystemTheme() : t;
    applyTheme(resolved);
  }, []);

  const toggle = useCallback(() => {
    setThemeState((prev) => {
      const next = prev === "light" ? "dark" : prev === "dark" ? "system" : "light";
      try { localStorage.setItem("theme", next); } catch { /* noop */ }
      const resolved = next === "system" ? getSystemTheme() : next;
      applyTheme(resolved);
      return next;
    });
  }, []);

  // Listen for OS-level changes when in "system" mode
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => {
      if (getStoredTheme() === "system") {
        applyTheme(mq.matches ? "dark" : "light");
      }
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  // Apply theme on mount
  useEffect(() => {
    const t = getStoredTheme();
    const resolved = t === "system" ? getSystemTheme() : t;
    applyTheme(resolved);
  }, []);

  const resolved = theme === "system" ? getSystemTheme() : theme;

  return { theme, resolved, setTheme, toggle };
}
