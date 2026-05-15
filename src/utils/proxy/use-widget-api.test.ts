import { beforeEach, describe, expect, it, vi } from "vitest";

const { useApiQueryMock } = vi.hoisted(() => ({ useApiQueryMock: vi.fn<VitestMockProcedure>() }));

vi.mock("utils/query/api-query", () => ({
  useApiQuery: useApiQueryMock,
}));

import useWidgetAPI from "./use-widget-api";

describe("utils/proxy/use-widget-api", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("formats the proxy url and passes refreshInterval when provided in options", () => {
    useApiQueryMock.mockReturnValue({ data: { ok: true }, error: undefined, mutate: "m" });

    const widget = { service_group: "g", service_name: "s", index: 0 };
    const result = useWidgetAPI(widget, "status", { refreshInterval: 123, foo: "bar" });

    expect(useApiQueryMock).toHaveBeenCalledWith(
      expect.stringContaining("/api/services/proxy?"),
      expect.objectContaining({ refreshInterval: 123 }),
    );
    expect(result.data).toEqual({ ok: true });
    expect(result.error).toBeUndefined();
    expect(result.mutate).toBe("m");
  });

  it("returns data.error as the top-level error", () => {
    const dataError = { message: "nope" };
    useApiQueryMock.mockReturnValue({
      data: { error: dataError },
      error: undefined,
      mutate: vi.fn<VitestMockProcedure>(),
    });

    const widget = { service_group: "g", service_name: "s", index: 0 };
    const result = useWidgetAPI(widget, "status", {});

    expect(result.error).toBe(dataError);
  });

  it("disables the request when endpoint is an empty string", () => {
    useApiQueryMock.mockReturnValue({ data: undefined, error: undefined, mutate: vi.fn<VitestMockProcedure>() });

    const widget = { service_group: "g", service_name: "s", index: 0 };
    useWidgetAPI(widget, "");

    expect(useApiQueryMock).toHaveBeenCalledWith(null, {});
  });
});
