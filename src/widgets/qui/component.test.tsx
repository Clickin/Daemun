// @vitest-environment jsdom

import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders } from "test-utils/render-with-providers";
import { expectBlockValue } from "test-utils/widget-assertions";

const { useWidgetAPI } = vi.hoisted(() => ({ useWidgetAPI: vi.fn<VitestMockProcedure>() }));
vi.mock("utils/proxy/use-widget-api", () => ({ default: useWidgetAPI }));

import Component from "./component";

describe("widgets/qui/component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows aggregate torrent counts using the default fields", () => {
    useWidgetAPI.mockImplementation((_widget, endpoint) => ({
      data:
        endpoint === "torrentsAll"
          ? {
              stats: { total: 8, seeding: 5, downloading: 3, totalDownloadSpeed: 1024, totalUploadSpeed: 2048, error: 0 },
              counts: { status: { all: 8, completed: 5, errored: 0 } },
            }
          : undefined,
      error: undefined,
    }));

    const service = { widget: { type: "qui", fields: [] as string[] } };
    const { container } = renderWithProviders(<Component service={service} />, { settings: { hideErrors: false } });

    expect(service.widget.fields).toEqual(["leech", "download", "seed", "upload"]);
    expect(container.querySelectorAll(".service-block")).toHaveLength(4);
    expectBlockValue(container, "qui.leech", "3 / 3");
    expectBlockValue(container, "qui.seed", "5 / 5");
    expect(screen.queryByText("qui.total")).toBeNull();
  });

  it("shows per-instance-only values and caps configured fields at four", () => {
    useWidgetAPI.mockImplementation((_widget, endpoint) => ({
      data:
        endpoint === "torrents"
          ? {
              stats: { total: 7, seeding: 2, downloading: 5, totalDownloadSpeed: 0, totalUploadSpeed: 0, error: 3 },
              counts: { status: { all: 7, completed: 2, errored: 3 } },
              serverState: { global_ratio: "2.25", free_space_on_disk: 1_073_741_824 },
            }
          : undefined,
      error: undefined,
    }));

    const service = {
      widget: { type: "qui", instance: "3", fields: ["ratio", "freeSpace", "total", "errored", "seed"] },
    };
    const { container } = renderWithProviders(<Component service={service} />, { settings: { hideErrors: false } });

    expect(service.widget.fields).toEqual(["ratio", "freeSpace", "total", "errored"]);
    expect(container.querySelectorAll(".service-block")).toHaveLength(4);
    expectBlockValue(container, "qui.ratio", "2.25");
    expectBlockValue(container, "qui.total", "7");
    expectBlockValue(container, "qui.errored", "3");
    expect(screen.queryByText("qui.seed")).toBeNull();
  });
});
