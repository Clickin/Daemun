import { beforeEach, describe, expect, it, vi } from "vitest";

import createMockRes from "test-utils/create-mock-res";

const { clearServiceLookupCache } = vi.hoisted(() => ({
  clearServiceLookupCache: vi.fn<VitestMockProcedure>(),
}));

vi.mock("utils/config/service-helpers", () => ({
  clearServiceLookupCache,
}));

import handler from "pages/api/revalidate";
import { setStaticHomeCache } from "../../../src/server/static-home";

describe("pages/api/revalidate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setStaticHomeCache(null);
  });

  it("returns the legacy success shape after clearing caches and triggering the static home refresh", async () => {
    const refresh = vi.fn<VitestMockProcedure>(async () => true);
    setStaticHomeCache({ refresh });
    const req = {};
    const res = createMockRes();

    await handler(req, res);

    expect(refresh).toHaveBeenCalledWith("api-revalidate");
    expect(clearServiceLookupCache).toHaveBeenCalledOnce();
    expect(res.body).toEqual({ revalidated: true });
  });
});
