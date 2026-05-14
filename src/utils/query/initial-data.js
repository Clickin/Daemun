export const BAKED_QUERY_DATA_ELEMENT_ID = "daemun-query-data";

const compactQueryPathByKey = {
  s: "/api/services",
  b: "/api/bookmarks",
  w: "/api/widgets",
  v: "/api/validate",
  h: "/api/hash",
};

const compactQueryKeyByPath = new Map(
  Object.entries(compactQueryPathByKey).map(([key, path]) => [path, key]),
);

function hasOwn(object, key) {
  return Object.prototype.hasOwnProperty.call(object, key);
}

export function isBakedInitialQueryPath(path) {
  return compactQueryKeyByPath.has(path);
}

export function compactInitialQueryData(initialQueryData) {
  if (!initialQueryData || typeof initialQueryData !== "object") return {};

  return Object.entries(compactQueryPathByKey).reduce((compact, [key, path]) => {
    if (hasOwn(initialQueryData, path) && initialQueryData[path] !== undefined) {
      compact[key] = initialQueryData[path];
    }

    return compact;
  }, {});
}

export function expandInitialQueryData(compactData) {
  if (!compactData || typeof compactData !== "object") return {};

  return Object.entries(compactQueryPathByKey).reduce((expanded, [key, path]) => {
    if (hasOwn(compactData, key) && compactData[key] !== undefined) {
      expanded[path] = compactData[key];
    }

    return expanded;
  }, {});
}

export function readBakedInitialQueryData(documentRef = globalThis.document) {
  const element = documentRef?.getElementById?.(BAKED_QUERY_DATA_ELEMENT_ID);
  if (!element?.textContent) return undefined;

  const expanded = expandInitialQueryData(JSON.parse(element.textContent));
  return Object.keys(expanded).length > 0 ? expanded : undefined;
}
