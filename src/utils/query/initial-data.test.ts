import { describe, expect, it } from "vitest";

import {
  compactInitialPageProps,
  compactInitialQueryData,
  expandInitialPageProps,
  expandInitialQueryData,
  readBakedInitialPageProps,
  readBakedInitialQueryData,
} from "./initial-data";

describe("initial query data helpers", () => {
  function documentWithJson(value: unknown): Document {
    return {
      getElementById: () => ({
        textContent: JSON.stringify(value),
      }),
    } as unknown as Document;
  }

  it("compacts and expands baked dashboard query data", () => {
    const initialQueryData = {
      "/api/services": [{ name: "Service One" }],
      "/api/bookmarks": [{ name: "Bookmark One" }],
      "/api/widgets": [{ type: "search" }],
      "/api/validate": [],
      "/api/hash": "abc123",
      "/api/future": { keep: true },
    };

    const compact = compactInitialQueryData(initialQueryData);

    expect(compact).toEqual({
      s: [{ name: "Service One" }],
      b: [{ name: "Bookmark One" }],
      w: [{ type: "search" }],
      v: [],
    });
    expect(expandInitialQueryData(compact)).toEqual({
      "/api/services": [{ name: "Service One" }],
      "/api/bookmarks": [{ name: "Bookmark One" }],
      "/api/widgets": [{ type: "search" }],
      "/api/validate": [],
    });
  });

  it("reads baked initial query data from the document", () => {
    const documentRef = documentWithJson({
      s: [{ name: "Service One" }],
    });

    expect(readBakedInitialQueryData(documentRef)).toEqual({
      "/api/services": [{ name: "Service One" }],
    });
  });

  it("compacts and expands baked page props", () => {
    const compact = compactInitialPageProps({
      fallback: { "/api/services": [] },
      initialSettings: { theme: "dark", title: "Lab" },
      locale: "en",
    });

    expect(compact).toEqual({
      i: { theme: "dark", title: "Lab" },
      l: "en",
    });
    expect(expandInitialPageProps(compact)).toEqual({
      initialSettings: { theme: "dark", title: "Lab" },
      locale: "en",
    });
  });

  it("reads baked initial page props from the document", () => {
    const documentRef = documentWithJson({
      i: { theme: "dark", title: "Lab" },
      l: "en",
    });

    expect(readBakedInitialPageProps(documentRef)).toEqual({
      initialSettings: { theme: "dark", title: "Lab" },
      locale: "en",
    });
  });
});
