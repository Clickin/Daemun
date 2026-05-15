import { useQuery } from "@tanstack/react-query";
import { hc } from "hono/client";
import type { ZodError, ZodType } from "zod";

import { schemaForApiPath } from "./schemas";

const staticInitialApiPaths = new Set(["/api/bookmarks", "/api/services", "/api/validate", "/api/widgets"]);

export type ApiJson = ReturnType<typeof JSON.parse>;
type ApiSchema<T = ApiJson> = Pick<ZodType<T>, "safeParse">;

type QueryValue = string | string[];

interface RpcJsonOptions {
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
  schema?: ApiSchema<TData>;
  refetchInterval?: number | false;
  refetchOnMount?: boolean | "always";
  refetchOnReconnect?: boolean | "always";
  refetchOnWindowFocus?: boolean | "always";
  staleTime?: number;
  [key: string]: unknown;
}

interface RpcGetTarget {
  $get: (args?: unknown, options?: { init?: RequestInit }) => Promise<Response>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && (typeof value === "object" || typeof value === "function");
}

function isStaticInitialApiPath(url?: string) {
  if (!url) return false;
  return staticInitialApiPaths.has(resolveUrl(url).pathname);
}

function collectQuery(searchParams: URLSearchParams) {
  const query: Record<string, QueryValue> = {};

  for (const [key, value] of searchParams.entries()) {
    if (query[key] === undefined) {
      query[key] = value;
    } else if (Array.isArray(query[key])) {
      query[key].push(value);
    } else {
      query[key] = [query[key], value];
    }
  }

  return query;
}

function resolveUrl(path: string, baseUrl = "/") {
  const origin =
    baseUrl.startsWith("http://") || baseUrl.startsWith("https://")
      ? baseUrl
      : (globalThis.location?.origin ?? "http://localhost");

  return new URL(path, origin);
}

function rpcTargetForPath(client: unknown, pathname: string): RpcGetTarget {
  let target: unknown = client;

  for (const segment of pathname.split("/").filter(Boolean)) {
    if (!isRecord(target)) {
      throw new Error(`Invalid RPC target for ${pathname}`);
    }
    target = target[segment];
  }

  if (!isRecord(target) || typeof target.$get !== "function") {
    throw new Error(`Missing RPC GET handler for ${pathname}`);
  }

  return target as unknown as RpcGetTarget;
}

async function readResponsePayload(response: Response) {
  if (response.status === 204) return null;

  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return response.json();
  }

  return response.text();
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

export class ApiValidationError extends Error {
  declare cause: ZodError;

  constructor(error: ZodError) {
    super(`Invalid API response: ${error.issues.map((issue) => issue.message).join("; ")}`);
    this.name = "ApiValidationError";
    this.cause = error;
  }
}

export async function rpcJson(
  path: string,
  schema: ApiSchema = schemaForApiPath(path) as ApiSchema,
  { baseUrl = "/", fetch: fetcher, init }: RpcJsonOptions = {},
) {
  const url = resolveUrl(path, baseUrl);
  const query = collectQuery(url.searchParams);
  const client = hc(baseUrl, { fetch: fetcher });
  const target = rpcTargetForPath(client, url.pathname);
  const args = Object.keys(query).length > 0 ? { query } : undefined;
  const response = await target.$get(args, { init });
  const payload = await readResponsePayload(response);

  if (!response.ok) {
    throw new ApiResponseError(response, payload);
  }

  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    throw new ApiValidationError(parsed.error);
  }

  return parsed.data;
}

export function apiQueryOptions(
  url?: string,
  {
    baseUrl,
    enabled = true,
    fetch,
    fallbackData,
    immutable = false,
    initialData,
    queryKey,
    refreshInterval,
    schema,
    ...queryOptions
  }: ApiQueryOptions = {},
) {
  const isEnabled = Boolean(url) && enabled !== false;
  const shouldUseImmutable = immutable || isStaticInitialApiPath(url);

  return {
    queryKey: queryKey ?? ["api", url ?? "disabled"],
    queryFn: () => rpcJson(url ?? "", schema ?? schemaForApiPath(url ?? ""), { baseUrl, fetch }),
    enabled: isEnabled,
    initialData: initialData ?? fallbackData,
    refetchInterval: queryOptions.refetchInterval ?? refreshInterval,
    refetchOnMount: shouldUseImmutable ? false : queryOptions.refetchOnMount,
    refetchOnReconnect: shouldUseImmutable ? false : queryOptions.refetchOnReconnect,
    refetchOnWindowFocus: shouldUseImmutable ? false : queryOptions.refetchOnWindowFocus,
    staleTime: shouldUseImmutable ? Infinity : queryOptions.staleTime,
    ...queryOptions,
  };
}

export function useApiQuery<TData = ApiJson>(url?: string, options?: ApiQueryOptions<TData>) {
  const query = useQuery(apiQueryOptions(url, options));

  return {
    ...query,
    isValidating: query.isFetching,
    mutate: query.refetch,
  };
}
