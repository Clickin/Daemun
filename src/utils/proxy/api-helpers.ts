import type { UnknownRecord } from "../../types";

type ApiCallArgs = Record<string, unknown>;

interface ProxyWidget {
  index?: string;
  service_group?: string;
  service_name?: string;
}

function isProxyWidget(value: unknown): value is ProxyWidget {
  return Boolean(value) && typeof value === "object";
}

export function formatApiCall(url: string, args: ApiCallArgs) {
  const find = /\{.*?\}/g;
  const replace = (match: string) => {
    const key = match.replace(/\{|\}/g, "");
    let value = args[key];
    if (key === "url") {
      value = String(value ?? "").replace(/\/+$/, ""); // remove trailing slashes
    }
    return value?.toString() || "";
  };

  return url.replace(find, replace).replace(find, replace);
}

export function parseVersionForUrl(version: unknown, defaultValue: number | null = null) {
  if (version === undefined || version === null || version === "") {
    return defaultValue;
  }

  if (typeof version === "number") {
    return Number.isInteger(version) && version >= 0 ? version : defaultValue;
  }

  if (typeof version === "string" && /^\d+$/.test(version)) {
    return Number(version);
  }

  return defaultValue;
}

export function getURLSearchParams(widget: unknown, endpoint?: string) {
  const proxyWidget = isProxyWidget(widget) ? widget : {};
  const params = new URLSearchParams({
    group: proxyWidget.service_group ?? "",
    service: proxyWidget.service_name ?? "",
    index: proxyWidget.index ?? "",
  });
  if (endpoint) {
    params.append("endpoint", endpoint);
  }
  return params;
}

export function formatProxyUrl(widget: unknown, endpoint?: string, queryParams?: UnknownRecord) {
  const params = getURLSearchParams(widget, endpoint);
  if (queryParams) {
    params.append("query", JSON.stringify(queryParams));
  }
  return `/api/services/proxy?${params.toString()}`;
}

export function asJson(data: unknown): ReturnType<typeof JSON.parse> {
  if ((Buffer.isBuffer(data) || typeof data === "string") && data.length > 0) {
    const json = JSON.parse(data.toString());
    return json;
  }
  return data;
}

export function jsonArrayTransform<T>(data: unknown, transform: (items: ReturnType<typeof JSON.parse>[]) => T) {
  const json = asJson(data);
  if (json instanceof Array) {
    return transform(json);
  }
  return json;
}

export function jsonArrayFilter(data: unknown, filter: (item: ReturnType<typeof JSON.parse>) => boolean) {
  return jsonArrayTransform(data, (items) => items.filter(filter));
}

export function sanitizeErrorURL(errorURL: string | URL) {
  // Dont display sensitive params on frontend
  const url = new URL(errorURL);
  ["apikey", "api_key", "token", "t", "access_token", "auth"].forEach((key) => {
    if (url.searchParams.has(key)) url.searchParams.set(key, "***");
    if (url.hash.includes(key)) url.hash = url.hash.replace(new RegExp(`${key}=[^&]+`), `${key}=***`);
  });
  return url.toString();
}
