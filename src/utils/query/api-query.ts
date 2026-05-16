import { useQuery } from "@tanstack/react-query";
import type { hc } from "hono/client";
import type { createApp } from "../../server/app";

const staticInitialApiPaths = new Set(["/api/bookmarks", "/api/services", "/api/validate", "/api/widgets"]);

export type ApiJson = ReturnType<typeof JSON.parse>;
export type ApiApp = ReturnType<typeof createApp>;
export type ApiRpcClient = ReturnType<typeof hc<ApiApp>>;

interface ApiFetchOptions {
  baseUrl?: string;
  fetch?: typeof fetch;
  init?: RequestInit;
}

interface ApiQueryOptions<TData = ApiJson> {
  baseUrl?: string;
  enabled?: boolean;
  fallbackData?: TData;
  fetch?: typeof fetch;
  immutable?: boolean;
  initialData?: TData;
  queryKey?: readonly unknown[];
  refreshInterval?: number | false;
  schema?: unknown;
  gcTime?: number;
  refetchInterval?: number | false;
  refetchOnMount?: boolean | "always";
  refetchOnReconnect?: boolean | "always";
  refetchOnWindowFocus?: boolean | "always";
  staleTime?: number;
  [key: string]: unknown;
}

function isAbsoluteUrl(url: string) {
  return url.startsWith("http://") || url.startsWith("https://");
}

function resolveUrl(path: string, baseUrl = "/") {
  const origin = isAbsoluteUrl(baseUrl) ? baseUrl : (globalThis.location?.origin ?? "http://localhost");
  return new URL(path, origin);
}

function resolveFetchInput(path: string, baseUrl = "/") {
  const url = resolveUrl(path, baseUrl);
  return isAbsoluteUrl(baseUrl) ? url.toString() : `${url.pathname}${url.search}${url.hash}`;
}

function isStaticInitialApiPath(url?: string | null) {
  if (!url) return false;
  return staticInitialApiPaths.has(resolveUrl(url).pathname);
}

async function readResponsePayload(response: Response) {
  if (response.status === 204) return null;

  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return response.json();
  }

  return response.text();
}

function isApiFetchOptions(value: unknown): value is ApiFetchOptions {
  return Boolean(value) && typeof value === "object" && ("baseUrl" in value || "fetch" in value || "init" in value);
}

export class ApiResponseError extends Error {
  payload: unknown;
  status: number;

  constructor(response: Response, payload: unknown) {
    super(`API request failed with status ${response.status}`);
    this.name = "ApiResponseError";
    this.payload = payload;
    this.status = response.status;
  }
}

export async function fetchJson<TData = ApiJson>(
  path: string,
  { baseUrl = "/", fetch: fetcher = globalThis.fetch, init }: ApiFetchOptions = {},
): Promise<TData> {
  const response = await fetcher(resolveFetchInput(path, baseUrl), {
    method: "GET",
    ...init,
  });
  const payload = await readResponsePayload(response);

  if (!response.ok) {
    throw new ApiResponseError(response, payload);
  }

  return payload as TData;
}

export function rpcJson<TData = ApiJson>(
  path: string,
  schemaOrOptions?: unknown,
  maybeOptions?: ApiFetchOptions,
): Promise<TData> {
  return fetchJson<TData>(path, maybeOptions ?? (isApiFetchOptions(schemaOrOptions) ? schemaOrOptions : undefined));
}

export function apiQueryOptions<TData = ApiJson>(
  url?: string | null,
  {
    baseUrl,
    enabled = true,
    fetch,
    fallbackData,
    gcTime,
    immutable = false,
    initialData,
    queryKey,
    refetchInterval,
    refetchOnMount,
    refetchOnReconnect,
    refetchOnWindowFocus,
    refreshInterval,
    schema: _schema,
    staleTime,
    ...queryOptions
  }: ApiQueryOptions<NoInfer<TData>> = {},
) {
  void _schema;

  const isEnabled = Boolean(url) && enabled !== false;
  const shouldUseImmutable = immutable || isStaticInitialApiPath(url);
  const resolvedInitialData = initialData ?? fallbackData;

  return {
    queryKey: queryKey ?? ["api", url ?? "disabled"],
    queryFn: isEnabled ? () => fetchJson<TData>(url ?? "", { baseUrl, fetch }) : undefined,
    enabled: isEnabled,
    initialData: resolvedInitialData,
    gcTime: shouldUseImmutable ? Infinity : gcTime,
    refetchInterval: shouldUseImmutable ? false : (refetchInterval ?? refreshInterval),
    refetchOnMount: shouldUseImmutable ? false : refetchOnMount,
    refetchOnReconnect: shouldUseImmutable ? false : refetchOnReconnect,
    refetchOnWindowFocus: shouldUseImmutable ? false : refetchOnWindowFocus,
    staleTime: shouldUseImmutable ? Infinity : staleTime,
    ...queryOptions,
  };
}

export function useApiQuery<TData = ApiJson>(url?: string | null, options?: ApiQueryOptions<NoInfer<TData>>) {
  const query = useQuery<TData>(apiQueryOptions<TData>(url, options));

  return {
    ...query,
    isValidating: query.isFetching,
    mutate: query.refetch,
  };
}
