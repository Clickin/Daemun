// @vitest-environment jsdom

import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders } from "test-utils/render-with-providers";

const { useApiQueryMock } = vi.hoisted(() => ({ useApiQueryMock: vi.fn() }));
vi.mock("utils/query/api-query", () => ({ useApiQuery: useApiQueryMock }));

vi.mock("./node", () => ({
  default: ({ type }) => <div data-testid="kube-node" data-type={type} />,
}));

import Kubernetes from "./kubernetes";

describe("components/widgets/kubernetes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders an error state when query errors", () => {
    useApiQueryMock.mockReturnValue({ data: undefined, error: new Error("nope") });

    renderWithProviders(<Kubernetes options={{ cluster: { show: true }, nodes: { show: true } }} />, {
      settings: { target: "_self" },
    });

    expect(screen.getByText("widget.api_error")).toBeInTheDocument();
  });

  it("renders placeholder nodes while loading", () => {
    useApiQueryMock.mockReturnValue({ data: undefined, error: undefined });

    renderWithProviders(<Kubernetes options={{ cluster: { show: true }, nodes: { show: true } }} />, {
      settings: { target: "_self" },
    });

    expect(screen.getAllByTestId("kube-node").map((n) => n.getAttribute("data-type"))).toEqual(["cluster", "node"]);
  });

  it("renders a node per returned entry when data is available", () => {
    useApiQueryMock.mockReturnValue({
      data: { cluster: {}, nodes: [{ name: "n1" }, { name: "n2" }] },
      error: undefined,
    });

    renderWithProviders(<Kubernetes options={{ cluster: { show: true }, nodes: { show: true } }} />, {
      settings: { target: "_self" },
    });

    // cluster + 2 nodes
    expect(screen.getAllByTestId("kube-node")).toHaveLength(3);
  });
});
