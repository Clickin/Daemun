// @vitest-environment jsdom

import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders } from "test-utils/render-with-providers";

const { useApiQueryMock } = vi.hoisted(() => ({ useApiQueryMock: vi.fn() }));

vi.mock("utils/query/api-query", () => ({ useApiQuery: useApiQueryMock }));

vi.mock("./node", () => ({
  default: ({ data }) => <div data-testid="longhorn-node" data-id={data.node.id} />,
}));

import Longhorn from "./longhorn";

describe("components/widgets/longhorn", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders an error state when query errors", () => {
    useApiQueryMock.mockReturnValue({ data: undefined, error: new Error("nope") });

    renderWithProviders(<Longhorn options={{ nodes: true, total: true }} />, { settings: { target: "_self" } });

    expect(screen.getByText("widget.api_error")).toBeInTheDocument();
  });

  it("renders an empty container while loading", () => {
    useApiQueryMock.mockReturnValue({ data: undefined, error: undefined });

    const { container } = renderWithProviders(<Longhorn options={{ nodes: true, total: true }} />, {
      settings: { target: "_self" },
    });

    expect(container.querySelector(".infomation-widget-longhorn")).not.toBeNull();
    expect(screen.queryAllByTestId("longhorn-node")).toHaveLength(0);
  });

  it("filters nodes based on options (total/include)", () => {
    useApiQueryMock.mockReturnValue({
      data: {
        nodes: [{ id: "total" }, { id: "node1" }, { id: "node2" }],
      },
      error: undefined,
    });

    renderWithProviders(
      <Longhorn options={{ nodes: true, total: true, include: ["node1"], expanded: false, labels: false }} />,
      { settings: { target: "_self" } },
    );

    const nodes = screen.getAllByTestId("longhorn-node");
    expect(nodes.map((n) => n.getAttribute("data-id"))).toEqual(["total", "node1"]);
  });

  it("omits non-total nodes when options.nodes is false", () => {
    useApiQueryMock.mockReturnValue({
      data: {
        nodes: [{ id: "total" }, { id: "node1" }],
      },
      error: undefined,
    });

    renderWithProviders(<Longhorn options={{ nodes: false, total: true }} />, { settings: { target: "_self" } });

    const nodes = screen.getAllByTestId("longhorn-node");
    expect(nodes.map((n) => n.getAttribute("data-id"))).toEqual(["total"]);
  });
});
