import { describe, expect, it } from "vitest";

import createMockRes from "test-utils/create-mock-res";

import handler from "pages/api/revalidate";

describe("pages/api/revalidate", () => {
  it("returns the legacy success shape as a no-op reload trigger", async () => {
    const req = {};
    const res = createMockRes();

    await handler(req, res);

    expect(res.body).toEqual({ revalidated: true });
  });
});
