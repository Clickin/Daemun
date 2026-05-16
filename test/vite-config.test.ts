import { describe, expect, it } from "vitest";

import { clientManualChunks } from "../vite.config.mjs";

describe("clientManualChunks", () => {
  it("keeps only narrow always-needed client vendor chunks", () => {
    expect(clientManualChunks("G:/repo/node_modules/react/index.js")).toBe("vendor-react");
    expect(clientManualChunks("G:/repo/node_modules/react-dom/client.js")).toBe("vendor-react");
    expect(clientManualChunks("G:/repo/node_modules/scheduler/index.js")).toBe("vendor-react");
    expect(clientManualChunks("G:/repo/node_modules/@inertiajs/core/dist/index.js")).toBe("vendor-inertia");
    expect(clientManualChunks("G:/repo/node_modules/@inertiajs/react/dist/index.js")).toBe("vendor-inertia");
    expect(clientManualChunks("G:/repo/node_modules/@tanstack/query-core/build/index.js")).toBe("vendor-query");
    expect(clientManualChunks("G:/repo/node_modules/@tanstack/react-query/build/index.js")).toBe("vendor-query");
    expect(clientManualChunks("G:/repo/node_modules/i18next/dist/esm/i18next.js")).toBe("vendor-i18n");
    expect(clientManualChunks("G:/repo/node_modules/react-i18next/dist/es/index.js")).toBe("vendor-i18n");
  });

  it("does not create broad vendor or app chunks that pull lazy widgets into the entry", () => {
    expect(clientManualChunks("G:/repo/node_modules/zod/index.js")).toBeUndefined();
    expect(clientManualChunks("G:/repo/node_modules/@headlessui/react/dist/index.js")).toBeUndefined();
    expect(clientManualChunks("G:/repo/node_modules/@floating-ui/react/dist/index.js")).toBeUndefined();
    expect(clientManualChunks("G:/repo/node_modules/@tanstack/react-virtual/dist/index.js")).toBeUndefined();
    expect(clientManualChunks("G:/repo/node_modules/es-toolkit/dist/index.js")).toBeUndefined();
    expect(clientManualChunks("G:/repo/node_modules/laravel-precognition/dist/index.js")).toBeUndefined();
    expect(clientManualChunks("G:/repo/node_modules/react-icons/fa/index.js")).toBeUndefined();
    expect(clientManualChunks("G:/repo/src/components/widgets/search/search.tsx")).toBeUndefined();
    expect(clientManualChunks("G:/repo/src/components/services/widget.tsx")).toBeUndefined();
    expect(clientManualChunks("G:/repo/src/components/bookmarks/list.tsx")).toBeUndefined();
    expect(clientManualChunks("G:/repo/src/components/quicklaunch.tsx")).toBeUndefined();
    expect(clientManualChunks("G:/repo/src/widgets/plex/component.tsx")).toBeUndefined();
  });
});
