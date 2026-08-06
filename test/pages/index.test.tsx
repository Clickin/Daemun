// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ColorContext } from "utils/contexts/color";
import { SettingsContext } from "utils/contexts/settings";
import { TabContext } from "utils/contexts/tab";
import { ThemeContext } from "utils/contexts/theme";
import type { HomePageProps, ServiceGroupRecord, SettingsRecord, UnknownRecord } from "../../src/types";

type IndexTestState = {
  bookmarksData: HomePageProps["fallback"]["/api/bookmarks"];
  quickLaunchProps: {
    isOpen?: boolean;
    servicesAndBookmarks?: Array<{ name?: string }>;
  } | null;
  servicesData: ServiceGroupRecord[];
  throwIn: string | null;
  validateData: unknown;
  widgetCalls: Array<{ style?: { isRightAligned?: boolean }; widget: UnknownRecord }>;
  widgetsData: UnknownRecord[];
};

const { state, i18n, loadLanguage, useApiQueryMock } = vi.hoisted(() => {
  const state: IndexTestState = {
    throwIn: null,
    validateData: [],
    servicesData: [],
    bookmarksData: [],
    widgetsData: [],
    quickLaunchProps: null,
    widgetCalls: [],
  };

  const i18n = { language: "en", changeLanguage: vi.fn<VitestMockProcedure>() };
  const loadLanguage = vi.fn<VitestMockProcedure>(async (language) => language);

  const useApiQueryMock = vi.fn<VitestMockProcedure>((key) => {
    if (key === "/api/validate") return { data: state.validateData };
    if (key === "/api/services") return { data: state.servicesData };
    if (key === "/api/bookmarks") return { data: state.bookmarksData };
    if (key === "/api/widgets") return { data: state.widgetsData };
    return { data: undefined };
  });

  return {
    state,
    i18n,
    loadLanguage,
    useApiQueryMock,
  };
});

vi.mock("utils/dynamic", () => ({
  default: (loader) => {
    if (loader.toString().includes("quicklaunch")) {
      return (props) => {
        state.quickLaunchProps = props;
        return (
          <div data-testid="quicklaunch">
            {props.isOpen ? "open" : "closed"}:{props.servicesAndBookmarks?.length ?? 0}
          </div>
        );
      };
    }

    return () => null;
  },
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    i18n,
    t: (k) => k,
  }),
}));

vi.mock("utils/query/api-query", () => ({
  useApiQuery: useApiQueryMock,
}));

vi.mock("utils/i18n", () => ({
  loadLanguage,
}));

vi.mock("components/bookmarks/group", () => ({
  default: ({ bookmarks }) => <div data-testid="bookmarks-group">{bookmarks?.name}</div>,
}));

vi.mock("components/services/group", () => ({
  default: ({ group }) => <div data-testid="services-group">{group?.name}</div>,
}));

vi.mock("components/errorboundry", () => ({
  default: ({ children }) => <>{children}</>,
}));

vi.mock("components/tab", () => ({
  default: ({ tab }) => <li data-testid="tab">{tab}</li>,
  slugifyAndEncode: (tabName) =>
    tabName !== undefined ? encodeURIComponent(tabName.toString().replace(/\\s+/g, "-").toLowerCase()) : "",
}));

vi.mock("components/quicklaunch", () => ({
  default: (props) => {
    state.quickLaunchProps = props;
    return (
      <div data-testid="quicklaunch">
        {props.isOpen ? "open" : "closed"}:{props.servicesAndBookmarks?.length ?? 0}
      </div>
    );
  },
}));

vi.mock("components/widgets/widget", () => ({
  default: ({ widget, style }) => {
    state.widgetCalls.push({ widget, style });
    return <div data-testid="widget">{widget?.type}</div>;
  },
}));

vi.mock("components/toggles/revalidate", () => ({
  default: () => null,
}));

async function renderIndex({
  initialSettings = { title: "Daemun", layout: {} },
  fallback = {} as HomePageProps["fallback"],
  theme = "dark",
  color = "slate",
  activeTab = "",
  settings = initialSettings,
}: {
  activeTab?: string;
  color?: string;
  fallback?: HomePageProps["fallback"];
  initialSettings?: SettingsRecord;
  settings?: SettingsRecord;
  theme?: string;
} = {}) {
  const { default: Wrapper } = await import("pages/index.tsx");

  const setTheme = vi.fn<VitestMockProcedure>();
  const setColor = vi.fn<VitestMockProcedure>();
  const setSettings = vi.fn<VitestMockProcedure>();
  const setActiveTab = vi.fn<VitestMockProcedure>();

  const renderResult = render(
    <ThemeContext.Provider value={{ theme, setTheme }}>
      <ColorContext.Provider value={{ color, setColor }}>
        <SettingsContext.Provider value={{ settings, setSettings }}>
          <TabContext.Provider value={{ activeTab, setActiveTab }}>
            <Wrapper initialSettings={initialSettings} fallback={fallback} />
          </TabContext.Provider>
        </SettingsContext.Provider>
      </ColorContext.Provider>
    </ThemeContext.Provider>,
  );

  return { ...renderResult, setTheme, setColor, setSettings, setActiveTab };
}

describe("pages/index Wrapper", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.validateData = [];
    state.servicesData = [];
    state.bookmarksData = [];
    state.widgetsData = [];
    state.widgetCalls = [];
    document.documentElement.className = "dark theme-slate";
    window.location.hash = "";
    i18n.changeLanguage.mockClear();
  });

  it("applies theme/color classes and renders a background overlay when configured", async () => {
    await renderIndex({
      initialSettings: {
        title: "Daemun",
        color: "slate",
        background: { image: "https://example.com/bg.jpg", opacity: 10, blur: true, saturate: 150, brightness: 125 },
        layout: {},
      },
      theme: "dark",
      color: "emerald",
    });

    await waitFor(() => {
      expect(document.documentElement.classList.contains("scheme-dark")).toBe(true);
    });
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(document.documentElement.classList.contains("theme-emerald")).toBe(true);
    expect(document.documentElement.classList.contains("theme-slate")).toBe(false);

    expect(document.querySelector("#background")).toBeTruthy();
    expect(document.querySelector("#inner_wrapper")?.className).toContain("backdrop-blur");
    expect(document.querySelector("#inner_wrapper")?.className).toContain("backdrop-saturate-150");
    expect(document.querySelector("#inner_wrapper")?.className).toContain("backdrop-brightness-125");
  });

  it("supports legacy string backgrounds in settings", async () => {
    await renderIndex({
      initialSettings: {
        title: "Daemun",
        color: "slate",
        background: "https://example.com/bg.jpg",
        layout: {},
      },
      theme: "dark",
      color: "emerald",
    });

    expect(document.querySelector("#background")).toBeTruthy();
  });
});

describe("pages/index Index routing + query branches", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.servicesData = [];
    state.bookmarksData = [];
    state.widgetsData = [];
  });

  it("renders the validation error screen when /api/validate returns an error", async () => {
    state.validateData = { error: "bad config" };

    await renderIndex({ initialSettings: { title: "Daemun", layout: {} }, settings: { layout: {} } });

    expect(screen.getByText("Error")).toBeInTheDocument();
    expect(screen.getByText("bad config")).toBeInTheDocument();
  });

  it("renders config errors when /api/validate returns a list of errors", async () => {
    state.validateData = [{ config: "services.yaml", name: "Service 1", reason: "broken", mark: { line: 4 } }];

    await renderIndex({ initialSettings: { title: "Daemun", layout: {} }, settings: { layout: {} } });

    expect(screen.getByText(/services.yaml/)).toBeInTheDocument();
    expect(screen.getByText(/line 4/)).toBeInTheDocument();
  });

  it("does not query the config hash from the browser", async () => {
    state.validateData = [];

    await renderIndex({ initialSettings: { title: "Daemun", layout: {} }, settings: { layout: {} } });

    expect(useApiQueryMock.mock.calls.map(([key]) => key)).not.toContain("/api/hash");
  });
});

describe("pages/index Home behavior", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.validateData = [];
    state.servicesData = [
      {
        name: "Services",
        services: [{ name: "s1", href: "http://svc/1" }, { name: "s2" }],
        groups: [{ name: "Nested", services: [{ name: "s3", href: "http://svc/3" }], groups: [] }],
      },
    ];
    state.bookmarksData = [{ name: "Bookmarks", bookmarks: [{ name: "b1", href: "http://bm/1" }, { name: "b2" }] }];
    state.widgetsData = [{ type: "glances" }, { type: "search" }];
    state.quickLaunchProps = null;
    state.widgetCalls = [];
  });

  it("passes href-bearing services and bookmarks to QuickLaunch and toggles search on keydown", async () => {
    await renderIndex({
      initialSettings: { title: "Daemun", layout: {} },
      settings: { title: "Daemun", layout: {}, language: "en" },
    });

    expect(screen.queryByTestId("quicklaunch")).toBeNull();
    expect(state.quickLaunchProps).toBeNull();

    fireEvent.keyDown(document.body, { key: "a" });
    await waitFor(() => {
      expect(screen.getByTestId("quicklaunch")).toHaveTextContent("open:3");
    });
    expect(state.quickLaunchProps.servicesAndBookmarks.map((i) => i.name)).toEqual(["b1", "s1", "s3"]);

    fireEvent.keyDown(document.body, { key: "Escape" });
    await waitFor(() => {
      expect(screen.queryByTestId("quicklaunch")).toBeNull();
    });
  });

  it("renders services and bookmark groups when present", async () => {
    await renderIndex({
      initialSettings: { title: "Daemun", layout: {} },
      settings: { title: "Daemun", layout: {}, language: "en" },
    });

    expect(await screen.findByTestId("services-group")).toHaveTextContent("Services");
    expect(screen.getByTestId("bookmarks-group")).toHaveTextContent("Bookmarks");
  });

  it("renders tab navigation and filters groups by active tab", async () => {
    state.servicesData = [{ name: "Services", services: [], groups: [] }];
    state.bookmarksData = [{ name: "Bookmarks", bookmarks: [] }];

    await renderIndex({
      initialSettings: { title: "Daemun", layout: { Services: { tab: "Main" }, Bookmarks: { tab: "Main" } } },
      settings: { title: "Daemun", layout: { Services: { tab: "Main" }, Bookmarks: { tab: "Main" } } },
      activeTab: "main",
    });

    expect(await screen.findAllByTestId("tab")).toHaveLength(1);
    expect(screen.getAllByTestId("services-group")[0]).toHaveTextContent("Services");
    expect(screen.getAllByTestId("bookmarks-group")[0]).toHaveTextContent("Bookmarks");
  });

  it("waits for settings.layout to populate when it differs from initial settings", async () => {
    state.servicesData = [{ name: "Services", services: [], groups: [] }];
    state.bookmarksData = [{ name: "Bookmarks", bookmarks: [] }];

    await renderIndex({
      initialSettings: { title: "Daemun", layout: {} },
      // Missing layout triggers the temporary `<div />` return to avoid eager widget fetches.
      settings: { title: "Daemun" },
    });

    expect(screen.queryByTestId("services-group")).toBeNull();
    expect(screen.queryByTestId("bookmarks-group")).toBeNull();
  });

  it("applies cardBlur classes for tabs and boxed headers when configured", async () => {
    state.servicesData = [{ name: "Services", services: [], groups: [] }];
    state.bookmarksData = [{ name: "Bookmarks", bookmarks: [] }];
    state.widgetsData = [{ type: "search" }];

    await renderIndex({
      initialSettings: { title: "Daemun", layout: { Services: { tab: "Main" }, Bookmarks: { tab: "Main" } } },
      settings: {
        title: "Daemun",
        layout: { Services: { tab: "Main" }, Bookmarks: { tab: "Main" } },
        headerStyle: "boxed",
        cardBlur: "sm",
      },
      activeTab: "main",
    });

    expect(document.querySelector("#myTab")?.className).toContain("backdrop-blur-sm");
    expect(document.querySelector("#information-widgets")?.className).toContain("backdrop-blur-sm");
  });

  it("applies settings-driven language/theme/color updates and renders head tags", async () => {
    state.servicesData = [];
    state.bookmarksData = [];
    state.widgetsData = [];

    const { setTheme, setColor, setSettings } = await renderIndex({
      initialSettings: { title: "Daemun", layout: {} },
      settings: {
        title: "Daemun",
        layout: {},
        language: "en",
        theme: "light",
        color: "emerald",
        disableIndexing: true,
        base: "/base/",
        favicon: "/x.ico",
      },
      theme: "dark",
      color: "slate",
    });

    await waitFor(() => {
      expect(setSettings).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(loadLanguage).toHaveBeenCalledWith("en");
      expect(i18n.changeLanguage).toHaveBeenCalledWith("en");
    });
    expect(setTheme).toHaveBeenCalledWith("light");
    expect(setColor).toHaveBeenCalledWith("emerald");

    expect(document.querySelector('meta[name="robots"][content="noindex, nofollow"]')).toBeTruthy();
    expect(document.querySelector("base")?.getAttribute("href")).toBe("/base/");
    expect(document.querySelector('link[rel="icon"]')?.getAttribute("href")).toBe("/x.ico");
  });

  it("marks information widgets as right-aligned for known widget types", async () => {
    await renderIndex({
      initialSettings: { title: "Daemun", layout: {} },
      settings: { title: "Daemun", layout: {}, language: "en" },
    });

    await waitFor(() => {
      expect(state.widgetCalls.length).toBeGreaterThan(0);
    });

    const rightAligned = state.widgetCalls.filter((c) => c.style?.isRightAligned).map((c) => c.widget.type);
    expect(rightAligned).toEqual(["search"]);
  });
});
