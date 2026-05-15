import type { Context, Handler } from "hono";
import type { StatusCode } from "hono/utils/http-status";

import type { QueryRecord, QueryValue, UnknownRecord } from "../types";

export interface NextApiRequestCompat {
  body: unknown;
  headers: Record<string, string>;
  method: string;
  query: QueryRecord;
  url: string;
}

export interface NextApiResponseCompat {
  body: unknown;
  finished: boolean;
  headers: Headers;
  statusCode: StatusCode;
  end(payload?: unknown): NextApiResponseCompat;
  getHeader(name: string): string | null;
  json(payload: unknown): NextApiResponseCompat;
  revalidate(): Promise<boolean>;
  send(payload: unknown): NextApiResponseCompat;
  setHeader(name: string, value: string | number | readonly (string | number)[]): NextApiResponseCompat;
  status(code: StatusCode): NextApiResponseCompat;
}

export type NextApiHandlerCompat = (
  req: NextApiRequestCompat,
  res: NextApiResponseCompat,
) => unknown | Promise<unknown>;

export type RouteQueryResolver = (c: Context) => QueryRecord;

function collectQuery(url: string): QueryRecord {
  const query: QueryRecord = {};

  for (const [key, value] of new URL(url).searchParams.entries()) {
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

function collectHeaders(headers: Headers): Record<string, string> {
  return Object.fromEntries(Array.from(headers.entries()).map(([key, value]) => [key.toLowerCase(), value]));
}

async function readBody(c: Context): Promise<unknown> {
  if (["GET", "HEAD"].includes(c.req.method)) return undefined;

  const contentType = c.req.header("content-type") || "";
  if (contentType.includes("application/json")) {
    try {
      return await c.req.json();
    } catch {
      return undefined;
    }
  }

  if (contentType.includes("application/x-www-form-urlencoded") || contentType.includes("multipart/form-data")) {
    return c.req.parseBody();
  }

  const text = await c.req.text();
  return text.length ? text : undefined;
}

function createApiResponse(): NextApiResponseCompat {
  const headers = new Headers();

  const res: NextApiResponseCompat = {
    body: undefined,
    finished: false,
    headers,
    statusCode: 200,
    status(code: StatusCode) {
      this.statusCode = code;
      return this;
    },
    setHeader(name: string, value: string | number | readonly (string | number)[]) {
      if (Array.isArray(value)) {
        value.forEach((entry) => headers.append(name, String(entry)));
      } else {
        headers.set(name, String(value));
      }
      return this;
    },
    getHeader(name: string) {
      return headers.get(name);
    },
    json(payload: unknown) {
      if (!headers.has("content-type")) {
        headers.set("content-type", "application/json; charset=utf-8");
      }
      this.body = payload;
      this.finished = true;
      return this;
    },
    send(payload: unknown) {
      this.body = payload;
      this.finished = true;
      return this;
    },
    end(payload: unknown = "") {
      this.body = payload;
      this.finished = true;
      return this;
    },
    async revalidate() {
      return true;
    },
  };

  return res;
}

function toHeaderRecord(headers: Headers): Record<string, string> {
  const record: Record<string, string> = {};

  headers.forEach((value, key) => {
    record[key] = value;
  });

  return record;
}

function isBodyInit(value: unknown): value is BodyInit {
  return (
    typeof value === "string" ||
    value instanceof ArrayBuffer ||
    ArrayBuffer.isView(value) ||
    value instanceof Blob ||
    value instanceof FormData ||
    value instanceof URLSearchParams ||
    value instanceof ReadableStream
  );
}

function toResponse(c: Context, res: NextApiResponseCompat): Response {
  const status = res.statusCode || 200;
  const headers = toHeaderRecord(res.headers);

  if (res.body === undefined) {
    return c.body(null, status, headers);
  }

  if (isBodyInit(res.body)) {
    return c.body(res.body, status, headers);
  }

  if (!res.headers.has("content-type")) {
    res.headers.set("content-type", "application/json; charset=utf-8");
    headers["content-type"] = "application/json; charset=utf-8";
  }

  return c.json(res.body, status, headers);
}

export function splitCatchAll(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split("/")
    .filter(Boolean)
    .map((segment) => decodeURIComponent(segment));
}

export function honoApiHandler(handler: NextApiHandlerCompat, getRouteQuery: RouteQueryResolver = () => ({})): Handler {
  return async (c) => {
    const req: NextApiRequestCompat = {
      body: await readBody(c),
      headers: collectHeaders(c.req.raw.headers),
      method: c.req.method,
      query: {
        ...collectQuery(c.req.url),
        ...getRouteQuery(c),
      },
      url: new URL(c.req.url).pathname + new URL(c.req.url).search,
    };
    const res = createApiResponse();

    await handler(req, res);

    return toResponse(c, res);
  };
}

export { createApiResponse };
