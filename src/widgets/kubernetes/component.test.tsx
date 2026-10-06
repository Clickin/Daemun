// @vitest-environment jsdom

import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders } from "test-utils/render-with-providers";

const { useApiQueryMock } = vi.hoisted(() => ({ useApiQueryMock: vi.fn<VitestMockProcedure>() }));
vi.mock("utils/query/api-query", () => ({ useApiQuery: useApiQueryMock }));

import Component from "./component";

describe("widgets/kubernetes/component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders placeholders while the status and stats requests are loading", () => {
    useApiQueryMock.mockReturnValueOnce({ data: undefined, error: undefined });
    useApiQueryMock.mockReturnValueOnce({ data: undefined, error: undefined });

    const { container } = renderWithProviders(
      <Component service={{ widget: { type: "kubernetes", namespace: "ns", app: "app" } }} />,
      { settings: { hideErrors: false } },
    );

    expect(useApiQueryMock).toHaveBeenCalledTimes(2);
    expect(useApiQueryMock.mock.calls[0][0]).toBe("/api/kubernetes/status/ns/app?");
    expect(useApiQueryMock.mock.calls[1][0]).toBe("/api/kubernetes/stats/ns/app?");
    expect(container.querySelectorAll(".service-block")).toHaveLength(2);
    expect(screen.getByText("docker.cpu")).toBeInTheDocument();
    expect(screen.getByText("docker.mem")).toBeInTheDocument();
  });

  it("renders offline status when the status endpoint reports non-running state", () => {
    useApiQueryMock.mockReturnValueOnce({ data: { status: "stopped" }, error: undefined });
    useApiQueryMock.mockReturnValueOnce({ data: { stats: { cpu: 0.1, mem: 10 } }, error: undefined });

    renderWithProviders(<Component service={{ widget: { type: "kubernetes", namespace: "ns", app: "app" } }} />, {
      settings: { hideErrors: false },
    });

    expect(screen.getByText("docker.offline")).toBeInTheDocument();
    expect(screen.getByText("widget.status")).toBeInTheDocument();
  });

  it("renders CPU percent when cpuLimit is present, otherwise the raw CPU number", () => {
    useApiQueryMock.mockReturnValueOnce({ data: { status: "running" }, error: undefined });
    useApiQueryMock.mockReturnValueOnce({
      data: { stats: { cpuLimit: true, cpuUsage: 12.3, cpu: 0.0001, mem: 1024 } },
      error: undefined,
    });

    renderWithProviders(<Component service={{ widget: { type: "kubernetes", namespace: "ns", app: "app" } }} />, {
      settings: { hideErrors: false },
    });

    expect(screen.getByText("12.3")).toBeInTheDocument();
    expect(screen.getByText("1024")).toBeInTheDocument();
  });
});
