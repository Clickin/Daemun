// @vitest-environment jsdom

import { screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";

import { renderWithProviders } from "test-utils/render-with-providers";

const { useWidgetAPI } = vi.hoisted(() => ({ useWidgetAPI: vi.fn<VitestMockProcedure>() }));
vi.mock("utils/proxy/use-widget-api", () => ({ default: useWidgetAPI }));

import Component from "./component";

it("renders active and total Pulse resources", () => {
  useWidgetAPI.mockReturnValue({
    data: {
      resources: [
        { type: "node", status: "online" },
        { type: "node", status: "offline" },
        { type: "vm", status: "running" },
      ],
      stats: { byType: { node: 2, vm: 1, container: 0 } },
    },
  });

  renderWithProviders(<Component service={{ widget: { type: "pulse" } }} />, { settings: { hideErrors: false } });

  expect(screen.getByText("1 / 2")).toBeInTheDocument();
  expect(screen.getByText("1 / 1")).toBeInTheDocument();
  expect(screen.getByText("0 / 0")).toBeInTheDocument();
});
