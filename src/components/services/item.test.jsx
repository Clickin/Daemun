// @vitest-environment jsdom

import { act, fireEvent, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { renderWithProviders } from "test-utils/render-with-providers";

vi.mock("components/resolvedicon", () => ({
  default: function ResolvedIconMock() {
    return <div data-testid="resolved-icon" />;
  },
}));

vi.mock("widgets/docker/component", () => ({
  default: function DockerWidgetMock() {
    return <div data-testid="docker-widget" />;
  },
}));

vi.mock("widgets/kubernetes/component", () => ({
  default: function KubernetesWidgetMock() {
    return <div data-testid="kubernetes-widget" />;
  },
}));

vi.mock("widgets/proxmoxvm/component", () => ({
  default: function ProxmoxVMWidgetMock() {
    return <div data-testid="proxmoxvm-widget" />;
  },
}));

vi.mock("./ping", () => ({
  default: function PingMock() {
    return <div data-testid="ping" />;
  },
}));
vi.mock("./site-monitor", () => ({
  default: function SiteMonitorMock() {
    return <div data-testid="site-monitor" />;
  },
}));
vi.mock("./status", () => ({
  default: function StatusMock() {
    return <div data-testid="status" />;
  },
}));
vi.mock("./kubernetes-status", () => ({
  default: function KubernetesStatusMock() {
    return <div data-testid="kubernetes-status" />;
  },
}));
vi.mock("./proxmox-status", () => ({
  default: function ProxmoxStatusMock() {
    return <div data-testid="proxmox-status" />;
  },
}));
vi.mock("./widget", () => ({
  default: function ServiceWidgetMock({ widget }) {
    return <div data-testid="service-widget">idx:{widget.index}</div>;
  },
}));

import Item from "./item";

async function flushLazyImports() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe("components/services/item", () => {
  it("renders the service title as a link when href is provided", () => {
    renderWithProviders(
      <Item
        groupName="G"
        useEqualHeights={false}
        service={{
          id: "svc1",
          name: "My Service",
          description: "Desc",
          href: "https://example.com",
          icon: "mdi:test",
          widgets: [],
        }}
      />,
      { settings: { target: "_self", showStats: false, statusStyle: "basic" } },
    );

    const links = screen.getAllByRole("link");
    expect(links.some((l) => l.getAttribute("href") === "https://example.com")).toBe(true);
    expect(screen.getByText("My Service")).toBeInTheDocument();
  });

  it("renders the icon without a link when href is missing or '#'", () => {
    renderWithProviders(
      <Item
        groupName="G"
        useEqualHeights={false}
        service={{
          id: "svc1",
          name: "My Service",
          description: "Desc",
          href: "#",
          icon: "mdi:test",
          widgets: [],
        }}
      />,
      { settings: { target: "_self", showStats: false, statusStyle: "basic" } },
    );

    // The title area should not create a clickable href="#" link.
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.getByTestId("resolved-icon")).toBeInTheDocument();
  });

  it("toggles container stats on click when stats are hidden by default", async () => {
    renderWithProviders(
      <Item
        groupName="G"
        useEqualHeights={false}
        service={{
          id: "svc1",
          name: "My Service",
          description: "Desc",
          href: "https://example.com",
          container: "c",
          server: "s",
          ping: true,
          siteMonitor: true,
          widgets: [{ index: 1 }, { index: 2 }],
        }}
      />,
      { settings: { showStats: false, statusStyle: "basic" } },
    );

    expect(screen.queryByTestId("docker-widget")).not.toBeInTheDocument();
    expect(screen.getByTestId("ping")).toBeInTheDocument();
    expect(screen.getByTestId("site-monitor")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "View container stats" }));
    expect(await screen.findByTestId("docker-widget")).toBeInTheDocument();

    expect(screen.getAllByTestId("service-widget")).toHaveLength(2);
  });

  it("shows stats by default when settings.showStats is enabled, unless overridden by the service", async () => {
    const baseService = {
      id: "svc1",
      name: "My Service",
      description: "Desc",
      container: "c",
      server: "s",
      widgets: [],
    };

    renderWithProviders(<Item groupName="G" useEqualHeights={false} service={baseService} />, {
      settings: { showStats: true, statusStyle: "basic" },
    });
    expect(await screen.findByTestId("docker-widget")).toBeInTheDocument();

    renderWithProviders(
      <Item groupName="G" useEqualHeights={false} service={{ ...baseService, id: "svc2", showStats: false }} />,
      {
        settings: { showStats: true, statusStyle: "basic" },
      },
    );
    expect(screen.getAllByTestId("docker-widget")).toHaveLength(1);
  });

  it("closes stats after a short delay when toggled closed", async () => {
    vi.useFakeTimers();

    try {
      renderWithProviders(
        <Item
          groupName="G"
          useEqualHeights={false}
          service={{
            id: "svc1",
            name: "My Service",
            description: "Desc",
            container: "c",
            server: "s",
            widgets: [],
          }}
        />,
        { settings: { showStats: false, statusStyle: "basic" } },
      );

      const btn = screen.getByRole("button", { name: "View container stats" });
      fireEvent.click(btn);
      await flushLazyImports();
      expect(screen.getByTestId("docker-widget")).toBeInTheDocument();

      fireEvent.click(btn);
      // Still rendered while the close animation runs.
      expect(screen.getByTestId("docker-widget")).toBeInTheDocument();

      act(() => {
        vi.advanceTimersByTime(300);
      });
      expect(screen.queryByTestId("docker-widget")).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("toggles app and proxmox stats using their respective status tags", async () => {
    renderWithProviders(
      <Item
        groupName="G"
        useEqualHeights={false}
        service={{
          id: "svc1",
          name: "My Service",
          description: "Desc",
          app: "app",
          namespace: "default",
          proxmoxNode: "pve",
          proxmoxVMID: "100",
          proxmoxType: "qemu",
          widgets: [],
        }}
      />,
      { settings: { showStats: false, statusStyle: "basic" } },
    );

    const appBtn = screen.getByTestId("kubernetes-status").closest("button");
    expect(appBtn).toBeTruthy();
    fireEvent.click(appBtn);
    expect(await screen.findByTestId("kubernetes-widget")).toBeInTheDocument();

    const proxmoxBtn = screen.getByTestId("proxmox-status").closest("button");
    expect(proxmoxBtn).toBeTruthy();
    fireEvent.click(proxmoxBtn);
    expect(await screen.findByTestId("proxmoxvm-widget")).toBeInTheDocument();
  });

  it("does not render the app status tag when the service is marked external", () => {
    renderWithProviders(
      <Item
        groupName="G"
        useEqualHeights={false}
        service={{
          id: "svc1",
          name: "My Service",
          description: "Desc",
          app: "app",
          external: true,
          widgets: [],
        }}
      />,
      { settings: { showStats: false, statusStyle: "basic" } },
    );

    expect(screen.queryByTestId("kubernetes-status")).not.toBeInTheDocument();
  });
});
