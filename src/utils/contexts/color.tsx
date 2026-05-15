import { createContext, useEffect, useMemo, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";

type ColorValue = string;

interface ColorContextValue {
  color: ColorValue;
  setColor: Dispatch<SetStateAction<ColorValue>>;
}

interface ColorProviderProps {
  children?: ReactNode;
  initialColor?: ColorValue;
}

const getInitialColor = () => {
  if (typeof window !== "undefined" && window.localStorage) {
    const storedPrefs = window.localStorage.getItem("theme-color");
    if (typeof storedPrefs === "string") {
      return storedPrefs;
    }
  }

  return "slate"; // slate as the default color;
};

export const ColorContext = createContext<ColorContextValue>({
  color: "slate",
  setColor: () => undefined,
});

export function ColorProvider({ initialColor, children }: ColorProviderProps) {
  const [color, setColor] = useState(() => initialColor ?? getInitialColor());

  const rawSetColor = (rawColor: ColorValue) => {
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
