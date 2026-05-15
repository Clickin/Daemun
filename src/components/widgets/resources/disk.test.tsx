// @vitest-environment jsdom

import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { useApiQueryMock, Resource, Error } = vi.hoisted(() => ({
  useApiQueryMock: vi.fn<VitestMockProcedure>((..._args: unknown[]) => undefined),
  Resource: vi.fn<VitestMockProcedure>((props: Record<string, unknown>) => (
    <div data-testid="resource" data-prop-count={Object.keys(props).length} />
  )),
  Error: vi.fn<VitestMockProcedure>(() => <div data-testid="error" />),
}));

vi.mock("utils/query/api-query", () => ({ useApiQuery: useApiQueryMock }));
vi.mock("../widget/resource", () => ({ default: Resource }));
vi.mock("../widget/error", () => ({ default: Error }));

import Disk from "./disk";

describe("components/widgets/resources/disk", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders a placeholder Resource while loading", () => {
    useApiQueryMock.mockReturnValue({ data: undefined, error: undefined });

    render(<Disk options={{ disk: "/" }} expanded />);

    const props = Resource.mock.calls[0]![0];
    expect(props.value).toBe("-");
  });

  it("computes percent used from size/available and renders bytes", () => {
    useApiQueryMock.mockReturnValue({
      data: { drive: { size: 100, available: 40 } },
      error: undefined,
    });

    render(<Disk options={{ disk: "/data" }} diskUnits="bytes" expanded={false} />);

    const props = Resource.mock.calls[0]![0];
    expect(props.value).toBe("40");
    expect(props.expandedValue).toBe("100");
    expect(props.percentage).toBe(60);
  });

  it("renders Error when query errors", () => {
    useApiQueryMock.mockReturnValue({ data: undefined, error: new globalThis.Error("nope") });

    render(<Disk options={{ disk: "/" }} expanded />);

    expect(Error).toHaveBeenCalled();
  });
});
