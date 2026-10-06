// @vitest-environment jsdom

import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders } from "test-utils/render-with-providers";

const { useApiQueryMock } = vi.hoisted(() => ({ useApiQueryMock: vi.fn() }));
vi.mock("utils/query/api-query", () => ({ useApiQuery: useApiQueryMock }));

import Component from "./component";

describe("widgets/docker/component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uses Daemun's per-container routes and renders placeholders while loading", () => {
    useApiQueryMock.mockReturnValue({ data: undefined, error: undefined });

    const { container } = renderWithProviders(
      <Component service={{ widget: { type: "docker", container: "c", server: "s" } }} />,
      { settings: { hideErrors: false } },
    );

    expect(useApiQueryMock.mock.calls.map(([url]) => url)).toEqual([
      "/api/docker/status/c/s",
      "/api/docker/stats/c/s",
    ]);
    expect(container.querySelectorAll(".service-block")).toHaveLength(4);
  });

  it("shows offline status when the container is stopped", () => {
    useApiQueryMock.mockReturnValueOnce({ data: { status: "exited" }, error: undefined });
    useApiQueryMock.mockReturnValueOnce({ data: undefined, error: undefined });

    renderWithProviders(<Component service={{ widget: { type: "docker", container: "c" } }} />, {
      settings: { hideErrors: false },
    });

    expect(screen.getByText("docker.offline")).toBeInTheDocument();
  });

  it("formats CPU, memory and network stats returned by the Hono route", () => {
    useApiQueryMock.mockReturnValueOnce({ data: { status: "running" }, error: undefined });
    useApiQueryMock.mockReturnValueOnce({
      data: {
        stats: {
          cpu_stats: { cpu_usage: { total_usage: 120 }, system_cpu_usage: 200, online_cpus: 1 },
          precpu_stats: { cpu_usage: { total_usage: 100 }, system_cpu_usage: 100 },
          memory_stats: { usage: 1000, total_inactive_file: 100 },
          networks: { eth0: { rx_bytes: 4, tx_bytes: 6 } },
        },
      },
      error: undefined,
    });

    const { container } = renderWithProviders(<Component service={{ widget: { type: "docker", container: "c" } }} />, {
      settings: { hideErrors: false },
    });

    expect(container.textContent).toContain("20");
    expect(container.textContent).toContain("900");
    expect(container.textContent).toContain("4");
    expect(container.textContent).toContain("6");
  });

  it("omits memory and network blocks when Docker provides no such stats", () => {
    useApiQueryMock.mockReturnValueOnce({ data: { status: "running" }, error: undefined });
    useApiQueryMock.mockReturnValueOnce({
      data: {
        stats: {
          cpu_stats: { cpu_usage: { total_usage: 120 }, system_cpu_usage: 200, online_cpus: 1 },
          precpu_stats: { cpu_usage: { total_usage: 100 }, system_cpu_usage: 100 },
          memory_stats: {},
        },
      },
      error: undefined,
    });

    renderWithProviders(<Component service={{ widget: { type: "docker", container: "c" } }} />, {
      settings: { hideErrors: false },
    });

    expect(screen.getByText("docker.cpu")).toBeInTheDocument();
    expect(screen.queryByText("docker.mem")).not.toBeInTheDocument();
    expect(screen.queryByText("docker.rx")).not.toBeInTheDocument();
  });

  it("surfaces API errors instead of treating them as an offline container", () => {
    useApiQueryMock.mockReturnValueOnce({ data: undefined, error: undefined });
    useApiQueryMock.mockReturnValueOnce({ data: { error: { message: "socket unreachable" } }, error: undefined });

    renderWithProviders(<Component service={{ widget: { type: "docker", container: "c" } }} />, {
      settings: { hideErrors: false },
    });

    expect(screen.queryByText("docker.offline")).not.toBeInTheDocument();
    expect(useApiQueryMock).toHaveBeenCalledTimes(2);
  });
});
