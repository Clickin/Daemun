import type { UnknownRecord } from "../../types";

export const BAKED_QUERY_DATA_ELEMENT_ID = "daemun-query-data";
export const BAKED_PAGE_PROPS_ELEMENT_ID = "daemun-page-props";

const compactQueryPathByKey = {
  s: "/api/services",
  b: "/api/bookmarks",
  w: "/api/widgets",
  v: "/api/validate",
  h: "/api/hash",
};

const compactQueryKeyByPath = new Map<string, keyof typeof compactQueryPathByKey>(
  Object.entries(compactQueryPathByKey).map(([key, path]) => [path, key]),
);

function hasOwn(object: object, key: PropertyKey): boolean {
  return Object.prototype.hasOwnProperty.call(object, key);
}

function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(value) && typeof value === "object";
}

export function isBakedInitialQueryPath(path: string): boolean {
  return compactQueryKeyByPath.has(path);
}

export function compactInitialQueryData(initialQueryData: unknown): UnknownRecord {
  if (!isRecord(initialQueryData)) return {};

  return Object.entries(compactQueryPathByKey).reduce<UnknownRecord>((compact, [key, path]) => {
    if (hasOwn(initialQueryData, path) && initialQueryData[path] !== undefined) {
      compact[key] = initialQueryData[path];
    }

    return compact;
  }, {});
}

export function expandInitialQueryData(compactData: unknown): UnknownRecord {
  if (!isRecord(compactData)) return {};

  return Object.entries(compactQueryPathByKey).reduce<UnknownRecord>((expanded, [key, path]) => {
    if (hasOwn(compactData, key) && compactData[key] !== undefined) {
      expanded[path] = compactData[key];
    }

    return expanded;
  }, {});
}

export function readBakedInitialQueryData(documentRef: Document | undefined = globalThis.document): UnknownRecord | undefined {
  const element = documentRef?.getElementById?.(BAKED_QUERY_DATA_ELEMENT_ID);
  if (!element?.textContent) return undefined;

  const expanded = expandInitialQueryData(JSON.parse(element.textContent));
  return Object.keys(expanded).length > 0 ? expanded : undefined;
}

export function compactInitialPageProps(pageProps: unknown): UnknownRecord {
  if (!isRecord(pageProps)) return {};

  const compact: UnknownRecord = {};
  if (pageProps.initialSettings !== undefined) compact.i = pageProps.initialSettings;
  if (pageProps.locale !== undefined) compact.l = pageProps.locale;

  return compact;
}

export function expandInitialPageProps(compactProps: unknown): UnknownRecord {
  if (!isRecord(compactProps)) return {};

  const pageProps: UnknownRecord = {};
  if (hasOwn(compactProps, "i")) pageProps.initialSettings = compactProps.i;
  if (hasOwn(compactProps, "l")) pageProps.locale = compactProps.l;

  return pageProps;
}

export function readBakedInitialPageProps(documentRef: Document | undefined = globalThis.document): UnknownRecord | undefined {
  const element = documentRef?.getElementById?.(BAKED_PAGE_PROPS_ELEMENT_ID);
  if (!element?.textContent) return undefined;

  const expanded = expandInitialPageProps(JSON.parse(element.textContent));
  return Object.keys(expanded).length > 0 ? expanded : undefined;
}
