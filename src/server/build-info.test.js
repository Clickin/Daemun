import { afterEach, describe, expect, it } from "vitest";

import { getAssetVersion } from "./build-info";

describe("getAssetVersion", () => {
  const originalEnv = {
    HOMEPAGE_ASSET_VERSION: process.env.HOMEPAGE_ASSET_VERSION,
    NEXT_PUBLIC_REVISION: process.env.NEXT_PUBLIC_REVISION,
    NEXT_PUBLIC_VERSION: process.env.NEXT_PUBLIC_VERSION,
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
    delete process.env.NEXT_PUBLIC_VERSION;
    delete process.env.VERSION;
    delete process.env.REVISION;
    process.env.NEXT_PUBLIC_REVISION = "docker-revision";

    expect(getAssetVersion()).toBe("docker-revision");
  });
});
