// @vitest-environment jsdom

import { render, screen, waitFor } from "@testing-library/react";
import { useQuery } from "@tanstack/react-query";
import { useContext } from "react";
import { describe, expect, it } from "vitest";

import { AppProviders } from "./app";
import { ColorContext } from "./utils/contexts/color";
import { SettingsContext } from "./utils/contexts/settings";
import { TabContext } from "./utils/contexts/tab";
import { ThemeContext } from "./utils/contexts/theme";

function ContextProbe() {
  const { color } = useContext(ColorContext);
  const { settings } = useContext(SettingsContext);
  const { activeTab } = useContext(TabContext);
  const { theme } = useContext(ThemeContext);
  const { data: widgets } = useQuery({ queryKey: ["api", "/api/widgets"], queryFn: async () => [] });

  return (
    <div>
      <span>title:{settings.title}</span>
      <span>theme:{theme}</span>
      <span>color:{color}</span>
      <span>tab:{String(activeTab)}</span>
      <span>widgets:{widgets?.length ?? 0}</span>
    </div>
  );
}

describe("AppProviders", () => {
  it("renders children inside the Daemun app provider contract", async () => {
    render(
      <AppProviders
        initialQueryData={{ "/api/widgets": [{ type: "search" }] }}
        initialSettings={{ color: "emerald", theme: "light", title: "Daemun" }}
      >
        <ContextProbe />
      </AppProviders>,
    );

    expect(screen.getByText("title:Daemun")).toBeInTheDocument();
    expect(screen.getByText("theme:light")).toBeInTheDocument();
    expect(screen.getByText("color:emerald")).toBeInTheDocument();
    expect(screen.getByText("tab:false")).toBeInTheDocument();
    expect(screen.getByText("widgets:1")).toBeInTheDocument();

    await waitFor(() => {
      expect(document.documentElement.classList.contains("scheme-light")).toBe(true);
      expect(document.documentElement.classList.contains("theme-emerald")).toBe(true);
    });
  });
});
