// @vitest-environment jsdom

import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { useApiQueryMock, Resource, Error } = vi.hoisted(() => ({
  useApiQueryMock: vi.fn(),
  Resource: vi.fn(() => <div data-testid="resource" />),
  Error: vi.fn(() => <div data-testid="error" />),
}));

vi.mock("utils/query/api-query", () => ({ useApiQuery: useApiQueryMock }));
vi.mock("../widget/resource", () => ({ default: Resource }));
vi.mock("../widget/error", () => ({ default: Error }));

import Memory from "./memory";

describe("components/widgets/resources/memory", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders a placeholder Resource while loading", () => {
    useApiQueryMock.mockReturnValue({ data: undefined, error: undefined });

    render(<Memory expanded />);

    const props = Resource.mock.calls[0][0];
    expect(props.value).toBe("-");
  });

  it("calculates percentage from active/total and renders available/total", () => {
    useApiQueryMock.mockReturnValue({
      data: { memory: { available: 10, total: 20, active: 5 } },
      error: undefined,
    });

    render(<Memory expanded={false} />);

    const props = Resource.mock.calls[0][0];
    expect(props.value).toBe("10");
    expect(props.expandedValue).toBe("20");
    expect(props.percentage).toBe(25);
  });

  it("renders Error when query errors", () => {
    useApiQueryMock.mockReturnValue({ data: undefined, error: new Error("nope") });

    render(<Memory expanded />);

    expect(Error).toHaveBeenCalled();
  });
});
