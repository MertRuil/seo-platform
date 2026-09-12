"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";

export type Theme = "dark" | "light";

const STORAGE_KEY = "calpeo_theme";

/**
 * Boyamadan önce <head> içinde çalışır: kayıtlı tercih yoksa sistem temasını uygular.
 * Böylece açık mod kullanıcısı her yüklemede koyu bir flaş görmez.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem("${STORAGE_KEY}");if(t!=="light"&&t!=="dark"){t=window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"}var c=document.documentElement.classList;c.toggle("dark",t==="dark");c.toggle("light",t==="light")}catch(e){}})();`;

interface ThemeContextType {
  theme: Theme;
  setTheme: (t: Theme) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: "light",
  setTheme: () => {},
  toggleTheme: () => {},
});

function applyTheme(t: Theme) {
  const c = document.documentElement.classList;
  c.toggle("dark", t === "dark");
  c.toggle("light", t === "light");
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("light");

  useEffect(() => {
    // Init script sınıfı zaten uyguladı; state'i DOM'dan oku.
    setThemeState(document.documentElement.classList.contains("dark") ? "dark" : "light");

    // Kayıtlı tercih yoksa sistem teması değiştiğinde takip et.
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = (e: MediaQueryListEvent) => {
      if (localStorage.getItem(STORAGE_KEY)) return;
      const next: Theme = e.matches ? "dark" : "light";
      applyTheme(next);
      setThemeState(next);
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t);
    try {
      localStorage.setItem(STORAGE_KEY, t);
    } catch {
      /* depolama kapalı olabilir */
    }
    applyTheme(t);
  }, []);

  const toggleTheme = useCallback(() => setTheme(theme === "dark" ? "light" : "dark"), [theme, setTheme]);

  return <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}
