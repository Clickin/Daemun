// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { apiQueryOptions, rpcJson, useApiQuery } from "./api-query";

function QueryProbe({ url, options }) {
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

  it("fetches through the Hono RPC client and validates JSON with zod", async () => {
    const fetchMock = vi.fn<VitestMockProcedure>(async (input) => {
      expect(String(input)).toBe("http://example.test/api/widgets?type=search");
      return new Response(JSON.stringify({ value: "ok" }), {
        headers: { "content-type": "application/json" },
        status: 200,
      });
    });

    await expect(
      rpcJson("/api/widgets?type=search", z.object({ value: z.string() }), {
        baseUrl: "http://example.test",
        fetch: fetchMock,
      }),
    ).resolves.toEqual({ value: "ok" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("surfaces zod validation errors as query failures", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ value: 1 }), {
        headers: { "content-type": "application/json" },
        status: 200,
      }),
    );

    renderWithClient(<QueryProbe url="/api/widgets" options={{ schema: z.object({ value: z.string() }) }} />);

    await waitFor(() => {
      expect(screen.getByText(/error:Invalid API response/)).toBeInTheDocument();
    });
  });

  it("maps legacy refreshInterval to TanStack Query refetchInterval", () => {
    const options = apiQueryOptions("/api/hash", { refreshInterval: 1234 });

    expect(options.queryKey).toEqual(["api", "/api/hash"]);
    expect(options.refetchInterval).toBe(1234);
  });

  it("treats baked config endpoints as immutable initial data", () => {
    const options = apiQueryOptions("/api/widgets");

    expect(options.staleTime).toBe(Infinity);
    expect(options.refetchOnMount).toBe(false);
    expect(options.refetchOnReconnect).toBe(false);
    expect(options.refetchOnWindowFocus).toBe(false);
  });
});
