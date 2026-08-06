import { beforeEach, describe, expect, it, vi } from "vitest";

import createMockRes from "test-utils/create-mock-res";

const { checkAndCopyConfig, logger } = vi.hoisted(() => ({
  checkAndCopyConfig: vi.fn<VitestMockProcedure>(),
  logger: { error: vi.fn<VitestMockProcedure>() },
}));

vi.mock("utils/config/config", () => ({
  default: checkAndCopyConfig,
}));

vi.mock("utils/logger", () => ({
  default: () => logger,
}));

import handler from "pages/api/validate";

describe("pages/api/validate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns reduced errors for any configs that don't validate", async () => {
    checkAndCopyConfig
      .mockReturnValueOnce(true)
      .mockReturnValueOnce({
        name: "YAMLException",
        config: "settings.yaml",
        reason: "settings bad",
        mark: { line: 1, snippet: "settings: bad" },
      })
      .mockReturnValue(true);

    const req = {};
    const res = createMockRes();

    await handler(req, res);

    expect(res.body).toEqual([
      {
        name: "YAMLException",
        config: "settings.yaml",
        reason: "settings bad",
        mark: { line: 1 },
      },
    ]);
    expect(logger.error).toHaveBeenCalled();
  });

  it("returns no errors when all configs validate", async () => {
    checkAndCopyConfig.mockReturnValue(true);

    const req = {};
    const res = createMockRes();

    await handler(req, res);

    expect(res.body).toEqual([]);
    expect(logger.error).not.toHaveBeenCalled();
  });
});
