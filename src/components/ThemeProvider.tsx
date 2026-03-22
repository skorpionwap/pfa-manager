import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
import { getSetting, setSetting } from "@/lib/db";
import { getThemeById, applyTheme, THEMES, type Theme } from "@/lib/themes";

interface ThemeContextValue {
  theme: Theme;
  setTheme: (id: string) => void;
  themes: Theme[];
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: THEMES[0],
  setTheme: () => {},
  themes: THEMES,
});

export function useTheme() {
  return useContext(ThemeContext);
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(THEMES[0]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const id = await getSetting("theme");
        const t = getThemeById(id);
        applyTheme(t);
        setThemeState(t);
      } catch {
        applyTheme(THEMES[0]);
      }
      setReady(true);
    })();
  }, []);

  const setTheme = useCallback(async (id: string) => {
    const t = getThemeById(id);
    applyTheme(t);
    setThemeState(t);
    try { await setSetting("theme", id); } catch {}
  }, []);

  if (!ready) return null;

  return (
    <ThemeContext.Provider value={{ theme, setTheme, themes: THEMES }}>
      {children}
    </ThemeContext.Provider>
  );
}
