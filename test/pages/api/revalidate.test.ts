import { describe, expect, it, vi } from "vitest";

import createMockRes from "test-utils/create-mock-res";

import handler from "pages/api/revalidate";
import { setStaticHomeCache } from "../../../src/server/static-home";

describe("pages/api/revalidate", () => {
  it("returns the legacy success shape after triggering the static home refresh", async () => {
    const refresh = vi.fn(async () => true);
    setStaticHomeCache({ refresh });
    const req = {};
    const res = createMockRes();

    await handler(req, res);

    expect(refresh).toHaveBeenCalledWith("api-revalidate");
    expect(res.body).toEqual({ revalidated: true });
    setStaticHomeCache(null);
  });
});
