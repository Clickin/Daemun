import { createContext, useEffect, useMemo, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";
import type { SettingsRecord } from "../../types";

interface SettingsContextValue {
  settings: SettingsRecord;
  setSettings: Dispatch<SetStateAction<SettingsRecord>>;
}

interface SettingsProviderProps {
  children?: ReactNode;
  initialSettings?: SettingsRecord;
}

export const SettingsContext = createContext<SettingsContextValue>({
  settings: {},
  setSettings: () => undefined,
});

export function SettingsProvider({ initialSettings, children }: SettingsProviderProps) {
  const [settings, setSettings] = useState(() => initialSettings ?? {});

  useEffect(() => {
    if (initialSettings !== undefined) setSettings(initialSettings ?? {});
  }, [initialSettings]);

  const value = useMemo(() => ({ settings, setSettings }), [settings]);

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}
