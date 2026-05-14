import { createContext, useEffect, useMemo, useState } from "react";

let lastColor = false;

const getInitialColor = () => {
  if (typeof window !== "undefined" && window.localStorage) {
    const storedPrefs = window.localStorage.getItem("theme-color");
    if (typeof storedPrefs === "string") {
      lastColor = storedPrefs;
      return storedPrefs;
    }
  }

  return "slate"; // slate as the default color;
};

export const ColorContext = createContext();

export function ColorProvider({ initialColor, children }) {
  const [color, setColor] = useState(() => initialColor ?? getInitialColor());

  const rawSetColor = (rawColor) => {
    const root = window.document.documentElement;
    const desiredClass = `theme-${rawColor}`;
    const staleThemeClasses = Array.from(root.classList).filter(
      (className) => className.startsWith("theme-") && className !== desiredClass,
    );

    if (staleThemeClasses.length) {
      root.classList.remove(...staleThemeClasses);
    }
    root.classList.add(desiredClass);

    localStorage.setItem("theme-color", rawColor);

    lastColor = rawColor;
  };

  useEffect(() => {
    if (initialColor !== undefined) setColor(initialColor ?? getInitialColor());
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [initialColor]);

  useEffect(() => {
    rawSetColor(color);
  }, [color]);

  const value = useMemo(() => ({ color, setColor }), [color]);

  return <ColorContext.Provider value={value}>{children}</ColorContext.Provider>;
}
