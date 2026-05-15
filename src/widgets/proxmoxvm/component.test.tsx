// @vitest-environment jsdom

import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders } from "test-utils/render-with-providers";
import { expectBlockValue } from "test-utils/widget-assertions";

const { useApiQueryMock } = vi.hoisted(() => ({ useApiQueryMock: vi.fn<VitestMockProcedure>() }));
vi.mock("utils/query/api-query", () => ({ useApiQuery: useApiQueryMock }));

import Component from "./component";

describe("widgets/proxmoxvm/component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders placeholders while loading", () => {
    useApiQueryMock.mockReturnValue({ data: undefined, error: undefined });

    const { container } = renderWithProviders(
      <Component service={{ widget: { type: "proxmoxvm", node: "n1", vmid: "100" } }} />,
      { settings: { hideErrors: false } },
    );

    expect(container.querySelectorAll(".service-block")).toHaveLength(2);
    expect(screen.getByText("resources.cpu")).toBeInTheDocument();
    expect(screen.getByText("resources.mem")).toBeInTheDocument();
  });

  it("renders cpu percent and mem bytes when loaded", () => {
    useApiQueryMock.mockReturnValue({ data: { cpu: 0.5, mem: 1024 }, error: undefined });

    const { container } = renderWithProviders(
      <Component service={{ widget: { type: "proxmoxvm", node: "n1", vmid: "100" } }} />,
      { settings: { hideErrors: false } },
    );

    expectBlockValue(container, "resources.cpu", 50);
    expectBlockValue(container, "resources.mem", 1024);
  });
});
