// @vitest-environment jsdom

import { screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { renderWithProviders } from "test-utils/render-with-providers";

const { useWidgetAPI } = vi.hoisted(() => ({ useWidgetAPI: vi.fn<VitestMockProcedure>() }));
vi.mock("utils/proxy/use-widget-api", () => ({ default: useWidgetAPI }));

vi.mock("./monthly", () => ({
  default: ({ showDate }) => <div data-testid="calendar-monthly" data-show={showDate?.toFormat?.("yyyy-MM-dd") || ""} />,
}));

vi.mock("./agenda", () => ({
  default: ({ showDate }) => <div data-testid="calendar-agenda" data-show={showDate?.toFormat?.("yyyy-MM-dd") || ""} />,
}));

import Component from "./component";

describe("widgets/calendar/component", () => {
  it("renders monthly view by default", async () => {
    renderWithProviders(<Component service={{ widget: { type: "calendar", integrations: [] } }} />, {
      settings: { hideErrors: false },
    });

    expect(screen.getByTestId("calendar-monthly")).toBeInTheDocument();
    expect(screen.queryByTestId("calendar-agenda")).toBeNull();

    // showDate is set asynchronously in an effect; ensure it eventually resolves to a date string.
    await waitFor(() => {
      expect(screen.getByTestId("calendar-monthly").getAttribute("data-show")).not.toBe("");
    });
  });

  it("renders agenda view when configured", async () => {
    renderWithProviders(<Component service={{ widget: { type: "calendar", view: "agenda", integrations: [] } }} />, {
      settings: { hideErrors: false },
    });

    expect(screen.getByTestId("calendar-agenda")).toBeInTheDocument();
    expect(screen.queryByTestId("calendar-monthly")).toBeNull();

    await waitFor(() => {
      expect(screen.getByTestId("calendar-agenda").getAttribute("data-show")).not.toBe("");
    });
  });

  it("loads a configured integration through the real lazy loader", async () => {
    useWidgetAPI.mockReturnValue({ data: [], error: undefined });

    renderWithProviders(
      <Component
        service={{
          widget: {
            type: "calendar",
            timezone: "UTC",
            integrations: [
              {
                type: "sonarr",
                name: "Sonarr",
                service_group: "Media",
                service_name: "Sonarr",
              },
            ],
          },
        }}
      />,
      { settings: { hideErrors: false } },
    );

    await waitFor(() => {
      expect(useWidgetAPI).toHaveBeenCalledWith(
        expect.objectContaining({ type: "sonarr", service_name: "Sonarr" }),
        "calendar",
        expect.objectContaining({
          start: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
          end: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
          includeSeries: "true",
        }),
      );
    });
  });
});
