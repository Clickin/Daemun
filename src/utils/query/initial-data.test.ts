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
      h: "abc123",
    });
    expect(expandInitialQueryData(compact)).toEqual({
      "/api/services": [{ name: "Service One" }],
      "/api/bookmarks": [{ name: "Bookmark One" }],
      "/api/widgets": [{ type: "search" }],
      "/api/validate": [],
      "/api/hash": "abc123",
    });
  });

  it("reads baked initial query data from the document", () => {
    const documentRef = {
      getElementById: () => ({
        textContent: JSON.stringify({
          s: [{ name: "Service One" }],
          h: "abc123",
        }),
      }),
    };

    expect(readBakedInitialQueryData(documentRef)).toEqual({
      "/api/services": [{ name: "Service One" }],
      "/api/hash": "abc123",
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
    const documentRef = {
      getElementById: () => ({
        textContent: JSON.stringify({
          i: { theme: "dark", title: "Lab" },
          l: "en",
        }),
      }),
    };

    expect(readBakedInitialPageProps(documentRef)).toEqual({
      initialSettings: { theme: "dark", title: "Lab" },
      locale: "en",
    });
  });
});
