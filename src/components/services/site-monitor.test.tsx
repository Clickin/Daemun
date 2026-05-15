// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { useApiQueryMock } = vi.hoisted(() => ({ useApiQueryMock: vi.fn<VitestMockProcedure>() }));

vi.mock("utils/query/api-query", () => ({
  useApiQuery: useApiQueryMock,
}));

import SiteMonitor from "./site-monitor";

describe("components/services/site-monitor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders a loading state when data is not available yet", () => {
    useApiQueryMock.mockReturnValue({ data: undefined, error: undefined });

    render(<SiteMonitor groupName="g" serviceName="s" />);

    expect(screen.getByText("siteMonitor.response")).toBeInTheDocument();
    expect(screen.getByText("siteMonitor.response").closest(".site-monitor-status")).toHaveAttribute(
      "title",
      expect.stringContaining("siteMonitor.not_available"),
    );
  });

  it("renders response time when status is up", () => {
    useApiQueryMock.mockReturnValue({ data: { status: 200, latency: 10 }, error: undefined });

    render(<SiteMonitor groupName="g" serviceName="s" />);

    expect(useApiQueryMock).toHaveBeenCalledWith("/api/siteMonitor?groupName=g&serviceName=s", { refreshInterval: 30000 });
    expect(screen.getByText("10")).toBeInTheDocument();
  });

  it("renders up label for basic style when status is ok", () => {
    useApiQueryMock.mockReturnValue({ data: { status: 200, latency: 1 }, error: undefined });

    render(<SiteMonitor groupName="g" serviceName="s" style="basic" />);

    expect(screen.getByText("siteMonitor.up")).toBeInTheDocument();
  });

  it("renders down label for failing status in basic style", () => {
    useApiQueryMock.mockReturnValue({ data: { status: 500, latency: 0 }, error: undefined });

    render(<SiteMonitor groupName="g" serviceName="s" style="basic" />);

    expect(screen.getByText("siteMonitor.down")).toBeInTheDocument();
  });

  it("renders the http status code for failing status in non-basic style", () => {
    useApiQueryMock.mockReturnValue({ data: { status: 500, latency: 0 }, error: undefined });

    render(<SiteMonitor groupName="g" serviceName="s" />);

    expect(screen.getByText("500")).toBeInTheDocument();
  });

  it("renders an error label when query returns error", () => {
    useApiQueryMock.mockReturnValue({ data: undefined, error: new Error("boom") });

    render(<SiteMonitor groupName="g" serviceName="s" />);

    expect(screen.getByText("siteMonitor.error")).toBeInTheDocument();
  });

  it("treats an embedded data.error as an error state", () => {
    useApiQueryMock.mockReturnValue({ data: { error: "bad" }, error: undefined });

    render(<SiteMonitor groupName="g" serviceName="s" />);

    expect(screen.getByText("siteMonitor.error")).toBeInTheDocument();
  });

  it("renders a dot when style is dot", () => {
    useApiQueryMock.mockReturnValue({ data: { status: 500, latency: 0 }, error: undefined });

    const { container } = render(<SiteMonitor groupName="g" serviceName="s" style="dot" />);

    expect(container.querySelector(".rounded-full")).toBeTruthy();
    expect(screen.queryByText("500")).toBeNull();
  });
});
