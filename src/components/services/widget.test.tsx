// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { cachedDynamic, mockLoader, unusedLoader } = vi.hoisted(() => {
  const mockLoader = vi.fn();
  const unusedLoader = vi.fn();
  const cachedDynamic = vi.fn((loader) => {
    return function MockWidget({ service }) {
      return (
        <div data-testid="mock-service-widget" data-loader={loader === mockLoader ? "mock" : "unused"}>
          {service.name}:{service.widget?.type}
        </div>
      );
    };
  });

  return { cachedDynamic, mockLoader, unusedLoader };
});

vi.mock("components/errorboundry", () => ({
  default: function ErrorBoundaryMock({ children }) {
    return <>{children}</>;
  },
}));

vi.mock("utils/dynamic", () => ({
  cachedDynamic,
}));

vi.mock("widgets/components", () => ({
  default: {
    mock: mockLoader,
    unused: unusedLoader,
  },
}));

import Widget from "./widget-resolved";

describe("components/services/widget", () => {
  beforeEach(() => {
    cachedDynamic.mockClear();
    mockLoader.mockClear();
    unusedLoader.mockClear();
  });

  it("renders the mapped widget component and passes merged service.widget", () => {
    render(<Widget widget={{ type: "mock" }} service={{ name: "Svc" }} />);

    expect(screen.getByTestId("mock-service-widget")).toHaveTextContent("Svc:mock");
    expect(screen.getByTestId("mock-service-widget")).toHaveAttribute("data-loader", "mock");
    expect(cachedDynamic).toHaveBeenCalledOnce();
    expect(cachedDynamic).toHaveBeenCalledWith(mockLoader);
    expect(mockLoader).not.toHaveBeenCalled();
    expect(unusedLoader).not.toHaveBeenCalled();
  });

  it("renders a missing widget message when the type is unknown", () => {
    render(<Widget widget={{ type: "nope" }} service={{ name: "Svc" }} />);

    expect(screen.getByText("widget.missing_type")).toBeInTheDocument();
    expect(cachedDynamic).not.toHaveBeenCalled();
    expect(mockLoader).not.toHaveBeenCalled();
    expect(unusedLoader).not.toHaveBeenCalled();
  });
});
