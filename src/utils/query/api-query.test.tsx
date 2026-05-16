// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { apiQueryOptions, fetchJson, rpcJson, useApiQuery } from "./api-query";

function QueryProbe({ url, options = {} }) {
  const { data, error } = useApiQuery(url, options);

  if (error) return <span>error:{error.message}</span>;
  return <span>value:{data?.value ?? "loading"}</span>;
}

function renderWithClient(ui) {
  const client = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

describe("api-query", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("fetches JSON through raw fetch", async () => {
    const fetchMock = vi.fn<VitestMockProcedure>(async (input) => {
      expect(String(input)).toBe("http://example.test/api/widgets?type=search");
      return new Response(JSON.stringify({ value: "ok" }), {
        headers: { "content-type": "application/json" },
        status: 200,
      });
    });

    await expect(
      fetchJson("/api/widgets?type=search", {
        baseUrl: "http://example.test",
        fetch: fetchMock,
      }),
    ).resolves.toEqual({ value: "ok" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("keeps the legacy rpcJson export as a raw-fetch compatibility shim", async () => {
    const schema = { safeParse: vi.fn<VitestMockProcedure>() };
    const fetchMock = vi.fn<VitestMockProcedure>(
      async () =>
        new Response(JSON.stringify({ value: 1 }), {
          headers: { "content-type": "application/json" },
          status: 200,
        }),
    );

    await expect(
      rpcJson("/api/widgets", schema, {
        fetch: fetchMock,
      }),
    ).resolves.toEqual({ value: 1 });
    expect(schema.safeParse).not.toHaveBeenCalled();
  });

  it("surfaces HTTP errors as query failures with response payloads", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ error: "nope" }), {
        headers: { "content-type": "application/json" },
        status: 500,
      }),
    );

    renderWithClient(<QueryProbe url="/api/widgets" />);

    await waitFor(() => {
      expect(screen.getByText(/error:API request failed with status 500/)).toBeInTheDocument();
    });
  });

  it("maps legacy refreshInterval to TanStack Query refetchInterval", () => {
    const options = apiQueryOptions("/api/hash", { refreshInterval: 1234 });

    expect(options.queryKey).toEqual(["api", "/api/hash"]);
    expect(options.refetchInterval).toBe(1234);
  });

  it("treats baked config endpoints as immutable initial data", () => {
    const options = apiQueryOptions("/api/widgets", {
      refetchInterval: 1000,
      refetchOnMount: "always",
      refetchOnReconnect: "always",
      refetchOnWindowFocus: "always",
      staleTime: 0,
    });

    expect(options.staleTime).toBe(Infinity);
    expect(options.gcTime).toBe(Infinity);
    expect(options.refetchInterval).toBe(false);
    expect(options.refetchOnMount).toBe(false);
    expect(options.refetchOnReconnect).toBe(false);
    expect(options.refetchOnWindowFocus).toBe(false);
  });

  it("does not create an active fetcher when the URL is disabled", () => {
    const options = apiQueryOptions(null);

    expect(options.enabled).toBe(false);
    expect(options.queryFn).toBeUndefined();
  });
});
