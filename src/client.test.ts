import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

describe("client bootstrap", () => {
  it("does not import the Inertia client runtime", () => {
    const source = readFileSync(path.resolve(process.cwd(), "src/client.tsx"), "utf8");

    expect(source).not.toContain("@inertiajs/react");
    expect(source).not.toContain("createInertiaApp");
  });
});
