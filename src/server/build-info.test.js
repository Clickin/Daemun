import { afterEach, describe, expect, it } from "vitest";

import { getAssetVersion } from "./build-info";

describe("getAssetVersion", () => {
  const originalEnv = {
    HOMEPAGE_ASSET_VERSION: process.env.HOMEPAGE_ASSET_VERSION,
    VITE_REVISION: process.env.VITE_REVISION,
    VITE_VERSION: process.env.VITE_VERSION,
    REVISION: process.env.REVISION,
    VERSION: process.env.VERSION,
  };

  afterEach(() => {
    for (const [key, value] of Object.entries(originalEnv)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  });

  it("uses the Docker build revision when no explicit version is set", () => {
    delete process.env.HOMEPAGE_ASSET_VERSION;
    delete process.env.VITE_VERSION;
    delete process.env.VERSION;
    delete process.env.REVISION;
    process.env.VITE_REVISION = "docker-revision";

    expect(getAssetVersion()).toBe("docker-revision");
  });
});
