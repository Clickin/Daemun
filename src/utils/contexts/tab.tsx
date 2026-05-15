import { createContext, useEffect, useMemo, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";

type TabValue = string | false;

interface TabContextValue {
  activeTab: TabValue;
  setActiveTab: Dispatch<SetStateAction<TabValue>>;
}

interface TabProviderProps {
  children?: ReactNode;
  initialTab?: TabValue;
}

export const TabContext = createContext<TabContextValue>({
  activeTab: false,
  setActiveTab: () => undefined,
});

export function TabProvider({ initialTab, children }: TabProviderProps) {
  const [activeTab, setActiveTab] = useState(() => initialTab ?? false);

  useEffect(() => {
    if (initialTab !== undefined) setActiveTab(initialTab ?? false);
  }, [initialTab]);

  const value = useMemo(() => ({ activeTab, setActiveTab }), [activeTab]);

  return <TabContext.Provider value={value}>{children}</TabContext.Provider>;
}
