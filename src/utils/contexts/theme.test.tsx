// @vitest-environment jsdom

import { render, screen, waitFor } from "@testing-library/react";
import { useContext } from "react";
import { describe, expect, it, vi } from "vitest";

import { ThemeContext, ThemeProvider } from "./theme";

function Reader() {
  const { theme } = useContext(ThemeContext);
  return <div data-testid="value">{theme}</div>;
}

function matchMediaMock(matches: boolean): typeof window.matchMedia {
  return vi.fn<VitestMockProcedure>((query: string) => ({
    addEventListener: vi.fn<VitestMockProcedure>(),
    addListener: vi.fn<VitestMockProcedure>(),
    dispatchEvent: vi.fn<VitestMockProcedure>(() => false),
    matches,
    media: query,
    onchange: null,
    removeEventListener: vi.fn<VitestMockProcedure>(),
    removeListener: vi.fn<VitestMockProcedure>(),
  }));
}

describe("utils/contexts/theme", () => {
  it("initializes from localStorage and writes html classes", async () => {
    // jsdom doesn't implement matchMedia by default; ensure it exists for getInitialTheme.
    window.matchMedia = window.matchMedia || matchMediaMock(false);

    localStorage.setItem("theme-mode", "light");
    document.documentElement.className = "";

    render(
      <ThemeProvider>
        <Reader />
      </ThemeProvider>,
    );

    expect(screen.getByTestId("value")).toHaveTextContent("light");
    await waitFor(() => expect(document.documentElement.classList.contains("light")).toBe(true));
    expect(localStorage.getItem("theme-mode")).toBe("light");
  });

  it("falls back to prefers-color-scheme when localStorage is empty", async () => {
    const matchMedia = matchMediaMock(true);
    window.matchMedia = matchMedia;
    localStorage.removeItem("theme-mode");

    render(
      <ThemeProvider>
        <Reader />
      </ThemeProvider>,
    );

    expect(matchMedia).toHaveBeenCalledWith("(prefers-color-scheme: dark)");
    expect(screen.getByTestId("value")).toHaveTextContent("dark");
  });

  it("defaults to dark when prefers-color-scheme does not match", async () => {
    const matchMedia = matchMediaMock(false);
    window.matchMedia = matchMedia;
    localStorage.removeItem("theme-mode");

    render(
      <ThemeProvider>
        <Reader />
      </ThemeProvider>,
    );

    expect(matchMedia).toHaveBeenCalledWith("(prefers-color-scheme: dark)");
    expect(screen.getByTestId("value")).toHaveTextContent("dark");
    await waitFor(() => expect(localStorage.getItem("theme-mode")).toBe("dark"));
  });

  it("lets configured initial theme replace stale root scheme classes", async () => {
    document.documentElement.className = "dark scheme-dark";
    localStorage.setItem("theme-mode", "dark");

    render(
      <ThemeProvider initialTheme="light">
        <Reader />
      </ThemeProvider>,
    );

    expect(screen.getByTestId("value")).toHaveTextContent("light");
    await waitFor(() => expect(document.documentElement.classList.contains("light")).toBe(true));
    expect(document.documentElement.classList.contains("dark")).toBe(false);
    expect(document.documentElement.classList.contains("scheme-dark")).toBe(false);
    expect(document.documentElement.classList.contains("scheme-light")).toBe(true);
  });
});
