import { describe, expect, it } from "vitest";

import components from "./components";

describe("widgets/components loader registry", () => {
  it("keeps legacy aliases pointed at their canonical loader", () => {
    expect(components.hoarder).toBe(components.karakeep);
    expect(components.pialert).toBe(components.netalertx);
    expect(components.jellyseerr).toBe(components.seerr);
    expect(components.overseerr).toBe(components.seerr);
  });

  it("stores loaders without executing component imports", () => {
    const loaderSource = components.plex.toString();

    expect(loaderSource).toContain("/plex/component");
  });
});
