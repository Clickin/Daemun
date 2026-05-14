import { describe, expect, it } from "vitest";

import {
  compactInitialQueryData,
  expandInitialQueryData,
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
});
