import { createContext, useEffect, useMemo, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";

type ThemeValue = "dark" | "light" | string;

interface ThemeContextValue {
  theme: ThemeValue;
  setTheme: Dispatch<SetStateAction<ThemeValue>>;
}

interface ThemeProviderProps {
  children?: ReactNode;
  initialTheme?: ThemeValue;
}

const getInitialTheme = () => {
  if (typeof window !== "undefined" && window.localStorage) {
    const storedPrefs = window.localStorage.getItem("theme-mode");
    if (typeof storedPrefs === "string") {
      return storedPrefs;
    }

    const userMedia = window.matchMedia("(prefers-color-scheme: dark)");
    if (userMedia.matches) {
      return "dark";
    }
  }

  return "dark"; // dark as the default mode
};

export const ThemeContext = createContext<ThemeContextValue>({
  theme: "dark",
  setTheme: () => undefined,
});

export function ThemeProvider({ initialTheme, children }: ThemeProviderProps) {
  const [theme, setTheme] = useState(() => initialTheme ?? getInitialTheme());

  const rawSetTheme = (rawTheme: ThemeValue) => {
    const root = window.document.documentElement;
    const isDark = rawTheme === "dark";

    root.classList.remove("dark", "light", "scheme-dark", "scheme-light");
    root.classList.add(rawTheme, isDark ? "scheme-dark" : "scheme-light");

    window.localStorage?.setItem("theme-mode", rawTheme);
  };

  useEffect(() => {
    if (initialTheme !== undefined) setTheme(initialTheme ?? getInitialTheme());
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [initialTheme]);

  useEffect(() => {
    rawSetTheme(theme);
  }, [theme]);

  const value = useMemo(() => ({ theme, setTheme }), [theme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
