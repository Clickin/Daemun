// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { useApiQueryMock } = vi.hoisted(() => ({ useApiQueryMock: vi.fn() }));

vi.mock("utils/query/api-query", () => ({
  useApiQuery: useApiQueryMock,
}));

import Ping from "./ping";

describe("components/services/ping", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders a loading state when data is not available yet", () => {
    useApiQueryMock.mockReturnValue({ data: undefined, error: undefined });

    render(<Ping groupName="g" serviceName="s" />);

    expect(screen.getByText("ping.ping")).toBeInTheDocument();
    expect(screen.getByText("ping.ping").closest(".ping-status")).toHaveAttribute(
      "title",
      expect.stringContaining("ping.not_available"),
    );
  });

  it("renders an error label when query returns error", () => {
    useApiQueryMock.mockReturnValue({ data: undefined, error: new Error("boom") });

    render(<Ping groupName="g" serviceName="s" />);

    expect(screen.getByText("ping.error")).toBeInTheDocument();
  });

  it("renders down when the host is not alive", () => {
    useApiQueryMock.mockReturnValue({ data: { alive: false, time: 0 }, error: undefined });

    render(<Ping groupName="g" serviceName="s" />);

    expect(screen.getByText("ping.down")).toBeInTheDocument();
  });

  it("renders the ping time when the host is alive", () => {
    useApiQueryMock.mockReturnValue({ data: { alive: true, time: 123 }, error: undefined });

    render(<Ping groupName="g" serviceName="s" />);

    expect(useApiQueryMock).toHaveBeenCalledWith("/api/ping?groupName=g&serviceName=s", { refreshInterval: 30000 });
    expect(screen.getByText("123")).toBeInTheDocument();
    expect(screen.getByText("123").closest(".ping-status")).toHaveAttribute(
      "title",
      expect.stringContaining("ping.up"),
    );
  });

  it("renders an up label for basic style", () => {
    useApiQueryMock.mockReturnValue({ data: { alive: true, time: 1 }, error: undefined });

    render(<Ping groupName="g" serviceName="s" style="basic" />);

    expect(screen.getByText("ping.up")).toBeInTheDocument();
  });

  it("renders a dot when style is dot", () => {
    useApiQueryMock.mockReturnValue({ data: { alive: true, time: 5 }, error: undefined });

    const { container } = render(<Ping groupName="g" serviceName="s" style="dot" />);

    expect(screen.queryByText("5")).not.toBeInTheDocument();
    expect(container.querySelector(".rounded-full")).toBeTruthy();
  });
});
