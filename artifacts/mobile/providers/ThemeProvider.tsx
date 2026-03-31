import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { ColorSchemeName } from "react-native";
import { getItem, setItem, StorageKeys } from "@/lib/storage";

type Theme = "light" | "dark" | "system";

interface ThemeState {
  theme: Theme;
  setTheme: (t: Theme) => void;
}

const ThemeContext = createContext<ThemeState>({
  theme: "system",
  setTheme: () => {},
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("system");

  useEffect(() => {
    getItem<Theme>(StorageKeys.THEME).then((t) => {
      if (t) setThemeState(t);
    });
  }, []);

  async function setTheme(t: Theme) {
    setThemeState(t);
    await setItem(StorageKeys.THEME, t);
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
