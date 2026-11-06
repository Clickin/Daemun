// @vitest-environment jsdom

import { keepPreviousData } from "@tanstack/react-query";
import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { useApiQueryMock } = vi.hoisted(() => ({ useApiQueryMock: vi.fn<VitestMockProcedure>() }));

vi.mock("utils/query/api-query", () => ({
  useApiQuery: useApiQueryMock,
}));

import useWidgetAPI from "./use-widget-api";

const widget = { service_group: "g", service_name: "s", index: 0 };

describe("utils/proxy/use-widget-api", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("formats the proxy url and passes refreshInterval when provided in options", () => {
    useApiQueryMock.mockReturnValue({ data: { ok: true }, error: undefined, mutate: "m" });

    const { result } = renderHook(() => useWidgetAPI(widget, "status", { refreshInterval: 123, foo: "bar" }));

    expect(useApiQueryMock).toHaveBeenCalledWith(
      expect.stringContaining("/api/services/proxy?"),
      expect.objectContaining({ refreshInterval: 123 }),
    );
    expect(result.current.data).toEqual({ ok: true });
    expect(result.current.error).toBeUndefined();
    expect(result.current.mutate).toBe("m");
  });

  it("returns data.error as the top-level error", () => {
    const dataError = { message: "nope" };
    useApiQueryMock.mockReturnValue({
      data: { error: dataError },
      error: undefined,
      mutate: vi.fn<VitestMockProcedure>(),
    });

    const { result } = renderHook(() => useWidgetAPI(widget, "status", {}));

    expect(result.current.error).toBe(dataError);
  });

  it("disables the request when endpoint is an empty string", () => {
    useApiQueryMock.mockReturnValue({ data: undefined, error: undefined, mutate: vi.fn<VitestMockProcedure>() });

    renderHook(() => useWidgetAPI(widget, ""));

    expect(useApiQueryMock).toHaveBeenCalledWith(null, {});
  });

  it("calls onSuccess once per successful fetch, like SWR", () => {
    const onSuccess = vi.fn<VitestMockProcedure>();
    useApiQueryMock.mockReturnValue({ data: { total: 1 }, dataUpdatedAt: 100, error: null, mutate: vi.fn() });

    const { rerender } = renderHook(() => useWidgetAPI(widget, "cpu", {}, { onSuccess }));
    expect(onSuccess).toHaveBeenCalledTimes(1);
    expect(onSuccess).toHaveBeenLastCalledWith({ total: 1 });

    rerender();
    expect(onSuccess).toHaveBeenCalledTimes(1);

    useApiQueryMock.mockReturnValue({ data: { total: 2 }, dataUpdatedAt: 200, error: null, mutate: vi.fn() });
    rerender();
    expect(onSuccess).toHaveBeenCalledTimes(2);
    expect(onSuccess).toHaveBeenLastCalledWith({ total: 2 });
  });

  it("does not call onSuccess before any data has been fetched", () => {
    const onSuccess = vi.fn<VitestMockProcedure>();
    useApiQueryMock.mockReturnValue({ data: undefined, dataUpdatedAt: 0, error: null, mutate: vi.fn() });

    renderHook(() => useWidgetAPI(widget, "cpu", {}, { onSuccess }));

    expect(onSuccess).not.toHaveBeenCalled();
  });

  it("maps keepPreviousData to React Query placeholder data", () => {
    useApiQueryMock.mockReturnValue({ data: undefined, error: null, mutate: vi.fn() });

    renderHook(() => useWidgetAPI(widget, "tasks", { limit: 1 }, { keepPreviousData: true }));

    expect(useApiQueryMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ placeholderData: keepPreviousData }),
    );
  });
});
